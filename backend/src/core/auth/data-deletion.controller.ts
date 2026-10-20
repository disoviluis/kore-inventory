import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
import { authMailConfigured, authPublicUrl, sendAuthMail } from './auth.mail';
import {
  addDeletionEvent, assertCompanyDataAdmin, deletionModules, DeletionType, executeDeletionTransaction,
  listCompanyDataAdmins, listPlatformDataAdmins, validateDeletionScope
} from './data-deletion.service';

const respondError = (res: Response, error: any) => res.status(error.status || 400).json({
  success: false, message: error.message || 'No se pudo procesar la solicitud de datos'
});
const userOf = (req: Request) => (req as any).user;
const isPlatformAdmin = (req: Request) => userOf(req)?.tipo_usuario === 'super_admin';
const validId = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) > 0;

async function notify(recipients: string[], subject: string, text: string) {
  if (!recipients.length || !await authMailConfigured()) return { enviados: 0, correo_configurado: false };
  let sent = 0;
  for (const recipient of recipients) {
    try { await sendAuthMail(recipient, subject, text); sent++; } catch { }
  }
  return { enviados: sent, correo_configurado: true };
}

async function companyRequestData(tx: (sql: string, params?: any[]) => Promise<any>, companyId: number, requestId: number) {
  const rows = await tx(`SELECT d.*, e.nombre AS empresa_nombre, u.nombre AS solicitante_nombre, u.email AS solicitante_email
    FROM solicitudes_borrado_datos d JOIN empresas e ON e.id = d.empresa_id JOIN usuarios u ON u.id = d.solicitada_por
    WHERE d.id = ? AND d.empresa_id = ?`, [requestId, companyId]);
  return rows[0] || null;
}

export const listCompanyDataRequests = async (req: Request, res: Response) => {
  try {
    const companyId = Number(req.params.id);
    await withTransaction(async tx => assertCompanyDataAdmin(tx, userOf(req), companyId));
    const rows = await query(`SELECT id, empresa_id, tipo, origen, estado, modulos, motivo, confirmo_datos_sinteticos,
      solicitada_por, aprobada_empresa_por, aprobada_empresa_at, revisada_por, revisada_at, ejecutada_por, ejecutada_at,
      resultado, certificado, certificado_sha256, error_codigo, created_at, updated_at
      FROM solicitudes_borrado_datos WHERE empresa_id = ? ORDER BY id DESC LIMIT 100`, [companyId]);
    return res.json({ success: true, data: rows });
  } catch (error) { return respondError(res, error); }
};

export const createCompanyDataRequest = async (req: Request, res: Response) => {
  try {
    if (isPlatformAdmin(req)) throw Object.assign(new Error('Use la solicitud de Plataforma para iniciar esta operación'), { status: 400 });
    const companyId = Number(req.params.id);
    const type = req.body.tipo as DeletionType;
    if (!['restablecimiento_pruebas', 'terminacion'].includes(type)) throw Object.assign(new Error('Tipo de solicitud no válido'), { status: 400 });
    const modules = validateDeletionScope(type, req.body.modulos, req.body.confirmo_datos_sinteticos);
    const reason = String(req.body.motivo || '').trim().slice(0, 1000);
    if (reason.length < 10) throw Object.assign(new Error('Explique el motivo de la solicitud (mínimo 10 caracteres)'), { status: 400 });
    const requestId = await withTransaction(async tx => {
      await assertCompanyDataAdmin(tx, userOf(req), companyId);
      const pending = await tx(`SELECT id FROM solicitudes_borrado_datos WHERE empresa_id = ?
        AND estado IN ('pendiente_empresa','pendiente_super_admin','aprobada','ejecutando') FOR UPDATE`, [companyId]);
      if (pending.length) throw Object.assign(new Error('La empresa ya tiene una solicitud de datos abierta'), { status: 409 });
      const companies = await tx('SELECT id, estado FROM empresas WHERE id = ?', [companyId]);
      if (!companies.length) throw Object.assign(new Error('Empresa no encontrada'), { status: 404 });
      const result = await tx(`INSERT INTO solicitudes_borrado_datos
        (empresa_id, tipo, origen, estado, modulos, motivo, confirmo_datos_sinteticos, estado_empresa_anterior,
         solicitada_por, aprobada_empresa_por, aprobada_empresa_at, aprobada_empresa_ip)
        VALUES (?, ?, 'empresa', 'pendiente_super_admin', ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?)`,
      [companyId, type, JSON.stringify(modules), reason, req.body.confirmo_datos_sinteticos === true ? 1 : 0, companies[0].estado,
        userOf(req).id, userOf(req).id, req.ip || null]);
      await addDeletionEvent(tx, result.insertId, userOf(req).id, 'solicitud_empresa_creada', { tipo: type, modulos: modules });
      return result.insertId;
    });
    const admins = await listPlatformDataAdmins();
    const notification = await notify(admins.map((admin: any) => admin.email), `Solicitud de datos pendiente #${requestId}`,
      `Se solicitó ${type === 'restablecimiento_pruebas' ? 'un restablecimiento de datos de prueba' : 'la terminación del servicio'} para la empresa #${companyId}.\nMódulos: ${modules.join(', ')}\nMotivo: ${reason}\nRevise en ${authPublicUrl()}/solicitudes-datos.html?solicitud_id=${requestId}`);
    return res.status(201).json({ success: true, message: 'Solicitud registrada para revisión de Super Admin', data: { id: requestId, aviso_correo: notification } });
  } catch (error) { return respondError(res, error); }
};

export const createPlatformDataRequest = async (req: Request, res: Response) => {
  try {
    if (!isPlatformAdmin(req)) throw Object.assign(new Error('Solo Super Admin puede iniciar esta solicitud'), { status: 403 });
    const companyId = Number(req.body.empresa_id);
    if (!validId(companyId)) throw Object.assign(new Error('Empresa no válida'), { status: 400 });
    const type = req.body.tipo as DeletionType;
    if (!['restablecimiento_pruebas', 'terminacion'].includes(type)) throw Object.assign(new Error('Tipo de solicitud no válido'), { status: 400 });
    const modules = validateDeletionScope(type, req.body.modulos, req.body.confirmo_datos_sinteticos);
    const reason = String(req.body.motivo || '').trim().slice(0, 1000);
    if (reason.length < 10) throw Object.assign(new Error('Explique el motivo de la solicitud (mínimo 10 caracteres)'), { status: 400 });
    const requestId = await withTransaction(async tx => {
      const companies = await tx('SELECT id, estado FROM empresas WHERE id = ? FOR UPDATE', [companyId]);
      if (!companies.length) throw Object.assign(new Error('Empresa no encontrada'), { status: 404 });
      const pending = await tx(`SELECT id FROM solicitudes_borrado_datos WHERE empresa_id = ?
        AND estado IN ('pendiente_empresa','pendiente_super_admin','aprobada','ejecutando') FOR UPDATE`, [companyId]);
      if (pending.length) throw Object.assign(new Error('La empresa ya tiene una solicitud de datos abierta'), { status: 409 });
      const result = await tx(`INSERT INTO solicitudes_borrado_datos
        (empresa_id, tipo, origen, estado, modulos, motivo, confirmo_datos_sinteticos, estado_empresa_anterior, solicitada_por)
        VALUES (?, ?, 'super_admin', 'pendiente_empresa', ?, ?, ?, ?, ?)`,
      [companyId, type, JSON.stringify(modules), reason, req.body.confirmo_datos_sinteticos === true ? 1 : 0, companies[0].estado, userOf(req).id]);
      await addDeletionEvent(tx, result.insertId, userOf(req).id, 'solicitud_super_admin_creada', { tipo: type, modulos: modules });
      return result.insertId;
    });
    const admins = await listCompanyDataAdmins(companyId);
    const notification = await notify(admins.map((admin: any) => admin.email), `Aprobación requerida para solicitud #${requestId}`,
      `Super Admin solicita ${type === 'restablecimiento_pruebas' ? 'restablecer datos de prueba' : 'tramitar la terminación del servicio'} de su empresa.\nMódulos: ${modules.join(', ')}\nMotivo: ${reason}\nApruebe o rechace dentro de Kore Inventory: ${authPublicUrl()}/solicitudes-datos.html?empresa_id=${companyId}&solicitud_id=${requestId}. El correo no equivale a una aprobación.`);
    return res.status(201).json({ success: true, message: 'Solicitud enviada al administrador de la empresa para aprobación', data: { id: requestId, aviso_correo: notification } });
  } catch (error) { return respondError(res, error); }
};

export const respondCompanyDataRequest = async (req: Request, res: Response) => {
  try {
    if (isPlatformAdmin(req)) throw Object.assign(new Error('La aprobación debe realizarla un administrador de la empresa'), { status: 403 });
    const companyId = Number(req.params.id);
    const requestId = Number(req.params.solicitudId);
    const approve = req.params.decision === 'aprobar';
    if (!validId(requestId)) throw Object.assign(new Error('Solicitud no válida'), { status: 400 });
    const request = await withTransaction(async tx => {
      await assertCompanyDataAdmin(tx, userOf(req), companyId);
      const rows = await tx('SELECT * FROM solicitudes_borrado_datos WHERE id = ? AND empresa_id = ? FOR UPDATE', [requestId, companyId]);
      const item = rows[0];
      if (!item || item.origen !== 'super_admin' || item.estado !== 'pendiente_empresa') throw Object.assign(new Error('La solicitud no está esperando aprobación de esta empresa'), { status: 409 });
      if (!approve) {
        await tx("UPDATE solicitudes_borrado_datos SET estado = 'rechazada', aprobada_empresa_por = ?, aprobada_empresa_at = UTC_TIMESTAMP(), aprobada_empresa_ip = ? WHERE id = ?",
          [userOf(req).id, req.ip || null, requestId]);
        await addDeletionEvent(tx, requestId, userOf(req).id, 'empresa_rechazo', { motivo: String(req.body.motivo || '').slice(0, 1000) });
      } else {
        await tx("UPDATE solicitudes_borrado_datos SET estado = 'aprobada', aprobada_empresa_por = ?, aprobada_empresa_at = UTC_TIMESTAMP(), aprobada_empresa_ip = ? WHERE id = ?",
          [userOf(req).id, req.ip || null, requestId]);
        await addDeletionEvent(tx, requestId, userOf(req).id, 'empresa_aprobacion', { tipo: item.tipo, modulos: JSON.parse(item.modulos) });
      }
      return item;
    });
    const admins = await listPlatformDataAdmins();
    await notify(admins.map((admin: any) => admin.email), `Respuesta de empresa a solicitud #${requestId}`,
      `La empresa #${companyId} ${approve ? 'aprobó' : 'rechazó'} la solicitud de datos. Revise en ${authPublicUrl()}/solicitudes-datos.html?solicitud_id=${requestId}`);
    return res.json({ success: true, message: approve ? 'Aprobación registrada; Super Admin debe ejecutar la operación' : 'Solicitud rechazada' });
  } catch (error) { return respondError(res, error); }
};

export const listPlatformDataRequests = async (req: Request, res: Response) => {
  try {
    if (!isPlatformAdmin(req)) throw Object.assign(new Error('Acceso reservado a Super Admin'), { status: 403 });
    const status = typeof req.query.estado === 'string' ? req.query.estado : null;
    const rows = await query(`SELECT d.*, e.nombre AS empresa_nombre, u.nombre AS solicitante_nombre, u.email AS solicitante_email,
      ap.email AS aprobador_empresa_email, rp.email AS revisor_email, ep.email AS ejecutor_email
      FROM solicitudes_borrado_datos d JOIN empresas e ON e.id = d.empresa_id JOIN usuarios u ON u.id = d.solicitada_por
      LEFT JOIN usuarios ap ON ap.id = d.aprobada_empresa_por LEFT JOIN usuarios rp ON rp.id = d.revisada_por
      LEFT JOIN usuarios ep ON ep.id = d.ejecutada_por WHERE (? IS NULL OR d.estado = ?) ORDER BY d.id DESC LIMIT 300`, [status, status]);
    return res.json({ success: true, data: rows, modulos: deletionModules });
  } catch (error) { return respondError(res, error); }
};

export const reviewPlatformDataRequest = async (req: Request, res: Response) => {
  try {
    const requestId = Number(req.params.id);
    const approve = req.params.decision === 'aprobar';
    const request = await withTransaction(async tx => {
      const rows = await tx('SELECT * FROM solicitudes_borrado_datos WHERE id = ? FOR UPDATE', [requestId]);
      const item = rows[0];
      if (!item) throw Object.assign(new Error('Solicitud no encontrada'), { status: 404 });
      const companyRequestReady = item.origen === 'empresa' && item.estado === 'pendiente_super_admin';
      const platformRequestReady = item.origen === 'super_admin' && item.estado === 'aprobada' && item.aprobada_empresa_por;
      if (approve && !companyRequestReady && !platformRequestReady) throw Object.assign(new Error('La empresa debe aprobar primero o la solicitud ya fue revisada'), { status: 409 });
      if (!approve && !['pendiente_empresa', 'pendiente_super_admin', 'aprobada'].includes(item.estado)) throw Object.assign(new Error('La solicitud ya no se puede rechazar'), { status: 409 });
      if (approve) await tx("UPDATE solicitudes_borrado_datos SET estado = 'aprobada', revisada_por = ?, revisada_at = UTC_TIMESTAMP() WHERE id = ?", [userOf(req).id, requestId]);
      else await tx("UPDATE solicitudes_borrado_datos SET estado = 'rechazada', revisada_por = ?, revisada_at = UTC_TIMESTAMP() WHERE id = ?", [userOf(req).id, requestId]);
      await addDeletionEvent(tx, requestId, userOf(req).id, approve ? 'super_admin_aprobacion' : 'super_admin_rechazo', { motivo: String(req.body.motivo || '').slice(0, 1000) });
      return item;
    });
    return res.json({ success: true, message: approve ? 'Solicitud aprobada; la ejecución aún requiere confirmación separada' : 'Solicitud rechazada', data: { empresa_id: request.empresa_id } });
  } catch (error) { return respondError(res, error); }
};

export const executePlatformDataRequest = async (req: Request, res: Response) => {
  try {
    const requestId = Number(req.params.id);
    const backupReference = String(req.body.respaldo_referencia || '').trim().slice(0, 255);
    const result = await executeDeletionTransaction(requestId, userOf(req).id, backupReference);
    const rows = await query('SELECT empresa_id FROM solicitudes_borrado_datos WHERE id = ?', [requestId]);
    const admins = rows.length ? await listCompanyDataAdmins(Number(rows[0].empresa_id)) : [];
    await notify(admins.map((admin: any) => admin.email), `Operación de datos completada #${requestId}`,
      `La operación solicitada fue completada. El certificado y su hash están disponibles en Kore Inventory: ${authPublicUrl()}/solicitudes-datos.html?empresa_id=${rows[0]?.empresa_id || ''}&solicitud_id=${requestId}. La constancia describe los datos retenidos y no certifica la expiración de respaldos externos.`);
    return res.json({ success: true, message: result.repetida ? 'La operación ya estaba completada' : 'Operación completada; certificado emitido', data: result });
  } catch (error) { return respondError(res, error); }
};

export const getPlatformDataCertificate = async (req: Request, res: Response) => {
  try {
    if (!isPlatformAdmin(req)) throw Object.assign(new Error('Acceso reservado a Super Admin'), { status: 403 });
    const rows = await query('SELECT id, empresa_id, certificado, certificado_sha256 FROM solicitudes_borrado_datos WHERE id = ?', [Number(req.params.id)]);
    if (!rows.length || !rows[0].certificado) throw Object.assign(new Error('El certificado aún no está disponible'), { status: 404 });
    return res.json({ success: true, data: rows[0] });
  } catch (error) { return respondError(res, error); }
};

export const getCompanyDataCertificate = async (req: Request, res: Response) => {
  try {
    const companyId = Number(req.params.id);
    await withTransaction(async tx => assertCompanyDataAdmin(tx, userOf(req), companyId));
    const rows = await query('SELECT id, empresa_id, certificado, certificado_sha256 FROM solicitudes_borrado_datos WHERE id = ? AND empresa_id = ?',
      [Number(req.params.solicitudId), companyId]);
    if (!rows.length || !rows[0].certificado) throw Object.assign(new Error('El certificado aún no está disponible'), { status: 404 });
    return res.json({ success: true, data: rows[0] });
  } catch (error) { return respondError(res, error); }
};
