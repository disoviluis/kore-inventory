import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { query, withTransaction } from '../../shared/database';
import {
  deleteS3PrivateObject,
  createS3PrivateDownloadUrl,
  createS3PrivateUploadUrl,
  getS3PrivateObjectMetadata,
  getS3PrivateObjectPrefix
} from '../../shared/s3';
import {
  allowedEvidenceMimeTypes,
  allowedEvidenceTypes,
  EvidenceType,
  isValidPrivateEvidenceKey,
  matchesEvidenceFileSignature
} from './evidencias.rules';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const tenantId = (req: Request): number => Number((req as any).activosEmpresaId);
const actorId = (req: Request): number => Number((req as any).user?.id);
const safeId = (value: unknown): number | null => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
const cleanText = (value: unknown, max: number): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return text ? text.slice(0, max) : null;
};
const failure = (res: Response, status: number, message: string): Response =>
  res.status(status).json({ success: false, message });

const validateEntity = async (type: EvidenceType, id: number, companyId: number): Promise<boolean> => {
  const sqlByType: Record<EvidenceType, string> = {
    activo: 'SELECT id FROM activos WHERE id = ? AND empresa_id = ? LIMIT 1',
    mantenimiento: 'SELECT id FROM mantenimiento_ordenes WHERE id = ? AND empresa_id = ? LIMIT 1',
    repuesto: 'SELECT producto_id AS id FROM repuestos_catalogo WHERE producto_id = ? AND empresa_id = ? LIMIT 1',
    inventario: 'SELECT id FROM inventarios_fisicos WHERE id = ? AND empresa_id = ? LIMIT 1',
    sesion_conteo: `SELECT s.id FROM inventarios_sesiones s
      INNER JOIN inventarios_rondas r ON r.id = s.ronda_id AND r.empresa_id = s.empresa_id
      WHERE s.id = ? AND s.empresa_id = ? LIMIT 1`,
    ajuste: 'SELECT id FROM inventarios_ajustes WHERE id = ? AND empresa_id = ? LIMIT 1'
  };
  const rows = await query(sqlByType[type], [id, companyId]);
  return rows.length > 0;
};

const validateSessionMember = async (req: Request, type: EvidenceType, sessionId: number, companyId: number): Promise<boolean> => {
  if (type !== 'sesion_conteo') return true;
  const members = await query(
    `SELECT id FROM inventarios_sesiones_integrantes
     WHERE empresa_id = ? AND sesion_id = ? AND usuario_id = ? LIMIT 1`,
    [companyId, sessionId, actorId(req)]
  );
  return members.length > 0;
};

const validateRequest = (req: Request, res: Response): { type: EvidenceType; id: number; companyId: number } | null => {
  const type = String(req.params.tipo) as EvidenceType;
  const id = safeId(req.params.id);
  const companyId = tenantId(req);
  if (!allowedEvidenceTypes.has(type) || !id || !Number.isSafeInteger(companyId) || companyId <= 0) {
    failure(res, 400, 'Entidad o empresa invalida');
    return null;
  }
  return { type, id, companyId };
};

export const createEvidenceUploadUrl = async (req: Request, res: Response): Promise<Response> => {
  const context = validateRequest(req, res);
  if (!context) return res;
  const filename = cleanText(req.body.filename, 180);
  const contentType = cleanText(req.body.content_type, 80) || '';
  const size = Number(req.body.tamano_bytes);
  const extension = allowedEvidenceMimeTypes[contentType];
  if (!filename || !extension || !Number.isSafeInteger(size) || size <= 0 || size > MAX_FILE_BYTES) {
    return failure(res, 400, 'Archivo invalido: usa PDF, JPG, PNG o WEBP de hasta 10 MB');
  }

  try {
    if (!await validateSessionMember(req, context.type, context.id, context.companyId)) {
      return failure(res, 403, 'Solo el equipo asignado puede adjuntar evidencia a esta sesion');
    }
    if (!await validateEntity(context.type, context.id, context.companyId)) return failure(res, 404, 'Entidad no encontrada');
    const currentFiles = await query(
      `SELECT COUNT(*) AS total FROM activos_archivos
       WHERE empresa_id = ? AND entidad_tipo = ? AND entidad_id = ? AND nivel_acceso = 'privado'`,
      [context.companyId, context.type, context.id]
    );
    if (Number(currentFiles[0].total) >= 50) return failure(res, 409, 'La entidad alcanzo el limite de 50 evidencias');
    const key = `empresa/${context.companyId}/evidencias/${context.type}/${context.id}/${randomUUID()}.${extension}`;
    const uploadUrl = await createS3PrivateUploadUrl(key, contentType, size);
    return res.json({ success: true, data: { upload_url: uploadUrl, key, expires_in: 900 } });
  } catch (error: any) {
    console.error('Error al preparar evidencia privada:', error);
    if (error.message?.includes('AWS_S3_PRIVATE_BUCKET')) {
      return failure(res, 503, 'El bucket privado de evidencias no esta configurado');
    }
    return failure(res, 500, 'No se pudo preparar la carga privada');
  }
};

export const finalizeEvidenceUpload = async (req: Request, res: Response): Promise<Response> => {
  const context = validateRequest(req, res);
  if (!context) return res;
  const key = cleanText(req.body.key, 700);
  const filename = cleanText(req.body.filename, 255);
  const contentType = cleanText(req.body.content_type, 80) || '';
  const size = Number(req.body.tamano_bytes);
  if (!key || !isValidPrivateEvidenceKey(key, context.companyId, context.type, context.id, contentType)
      || !filename || !Number.isSafeInteger(size) || size <= 0 || size > MAX_FILE_BYTES) {
    return failure(res, 400, 'Referencia de evidencia invalida');
  }

  let uploadedKey: string | null = null;
  try {
    if (!await validateSessionMember(req, context.type, context.id, context.companyId)) {
      return failure(res, 403, 'Solo el equipo asignado puede adjuntar evidencia a esta sesion');
    }
    if (!await validateEntity(context.type, context.id, context.companyId)) return failure(res, 404, 'Entidad no encontrada');
    uploadedKey = key;
    const object = await getS3PrivateObjectMetadata(key);
    if (Number(object.ContentLength) !== size || object.ContentType !== contentType) {
      await deleteS3PrivateObject(key);
      uploadedKey = null;
      return failure(res, 400, 'El archivo cargado no coincide con el tipo o tamano declarado');
    }
    const signature = await getS3PrivateObjectPrefix(key);
    if (!matchesEvidenceFileSignature(contentType, signature)) {
      await deleteS3PrivateObject(key);
      uploadedKey = null;
      return failure(res, 400, 'El contenido real no coincide con el tipo de archivo permitido');
    }
    const result = await withTransaction(async (tx) => {
      const entitySqlByType: Record<EvidenceType, string> = {
        activo: 'SELECT id FROM activos WHERE id = ? AND empresa_id = ? FOR UPDATE',
        mantenimiento: 'SELECT id FROM mantenimiento_ordenes WHERE id = ? AND empresa_id = ? FOR UPDATE',
        repuesto: 'SELECT producto_id AS id FROM repuestos_catalogo WHERE producto_id = ? AND empresa_id = ? FOR UPDATE',
        inventario: 'SELECT id FROM inventarios_fisicos WHERE id = ? AND empresa_id = ? FOR UPDATE',
        sesion_conteo: `SELECT s.id FROM inventarios_sesiones s
          INNER JOIN inventarios_rondas r ON r.id = s.ronda_id AND r.empresa_id = s.empresa_id
          WHERE s.id = ? AND s.empresa_id = ? FOR UPDATE`,
        ajuste: 'SELECT id FROM inventarios_ajustes WHERE id = ? AND empresa_id = ? FOR UPDATE'
      };
      const entityRows = await tx(entitySqlByType[context.type], [context.id, context.companyId]);
      if (!entityRows.length) throw Object.assign(new Error('Entidad no encontrada'), { status: 404 });
      const currentFiles = await tx(
        `SELECT COUNT(*) AS total FROM activos_archivos
         WHERE empresa_id = ? AND entidad_tipo = ? AND entidad_id = ? AND nivel_acceso = 'privado' FOR UPDATE`,
        [context.companyId, context.type, context.id]
      );
      if (Number(currentFiles[0].total) >= 50) throw Object.assign(new Error('La entidad alcanzo el limite de 50 evidencias'), { status: 409 });
      const inserted = await tx(
        `INSERT INTO activos_archivos
          (empresa_id, entidad_tipo, entidad_id, origen, s3_key, nivel_acceso,
           nombre_archivo, mime_type, tamano_bytes, creado_por)
         VALUES (?, ?, ?, 's3_upload', ?, 'privado', ?, ?, ?, ?)`,
        [context.companyId, context.type, context.id, key, filename, contentType, size, actorId(req)]
      );
      return { id: Number(inserted.insertId) };
    });
    return res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error.status) {
      if (uploadedKey) await deleteS3PrivateObject(uploadedKey).catch((): void => {});
      return failure(res, error.status, error.message);
    }
    if (error.code === 'ER_DUP_ENTRY') {
      const existing = await query(
        `SELECT id FROM activos_archivos
         WHERE empresa_id = ? AND entidad_tipo = ? AND entidad_id = ? AND s3_key = ? LIMIT 1`,
        [context.companyId, context.type, context.id, key]
      );
      if (existing.length) return res.json({ success: true, data: { id: Number(existing[0].id), duplicate: true } });
      return failure(res, 409, 'La evidencia ya fue registrada');
    }
    console.error('Error al registrar evidencia privada:', error);
    if (uploadedKey) await deleteS3PrivateObject(uploadedKey).catch((): void => {});
    if (error.message?.includes('AWS_S3_PRIVATE_BUCKET')) return failure(res, 503, 'El bucket privado de evidencias no esta configurado');
    return failure(res, 500, 'No se pudo registrar la evidencia');
  }
};

export const listEvidence = async (req: Request, res: Response): Promise<Response> => {
  const context = validateRequest(req, res);
  if (!context) return res;
  try {
    if (!await validateSessionMember(req, context.type, context.id, context.companyId)) {
      return failure(res, 403, 'No perteneces al equipo de esta sesion');
    }
    if (!await validateEntity(context.type, context.id, context.companyId)) return failure(res, 404, 'Entidad no encontrada');
    const files = await query(
      `SELECT id, s3_key, nombre_archivo, mime_type, tamano_bytes, creado_por, created_at
       FROM activos_archivos
       WHERE empresa_id = ? AND entidad_tipo = ? AND entidad_id = ? AND nivel_acceso = 'privado'
       ORDER BY created_at DESC, id DESC LIMIT 50`,
      [context.companyId, context.type, context.id]
    );
    const data = await Promise.all(files.map(async (file: any) => ({
      id: Number(file.id), nombre_archivo: file.nombre_archivo, mime_type: file.mime_type,
      tamano_bytes: Number(file.tamano_bytes), creado_por: file.creado_por, created_at: file.created_at,
      download_url: await createS3PrivateDownloadUrl(file.s3_key)
    })));
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error al listar evidencias privadas:', error);
    if (error.message?.includes('AWS_S3_PRIVATE_BUCKET')) return failure(res, 503, 'El bucket privado de evidencias no esta configurado');
    return failure(res, 500, 'No se pudo cargar la evidencia');
  }
};