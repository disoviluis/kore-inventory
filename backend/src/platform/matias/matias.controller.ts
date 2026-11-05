import { Request, Response } from 'express';
import pool from '../../shared/database';
import { decryptAuthSecret, encryptAuthSecret } from '../../core/auth/auth.security';
import { emitMatiasInvoice, probeMatias, lookupMatiasDocument } from './matias.client';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import crypto from 'crypto';
import { buildMatiasSandboxInvoice, MatiasInvoiceValidationError, MatiasLine, MatiasPayment, MatiasSale } from './matias.invoice';
import logger from '../../shared/logger';

const sandboxUrl = 'https://sandbox-api.matias-api.com/api/ubl2.1';

export const matiasServiceCatalog: ReadonlyArray<readonly [string, string]> = [
  ['factura_electronica', 'Factura electronica'],
  ['pos_electronico', 'POS electronico'],
  ['nota_credito', 'Nota credito'],
  ['nota_debito', 'Nota debito'],
  ['documento_soporte', 'Documento soporte'],
  ['nomina_electronica', 'Nomina electronica'],
  ['radian', 'RADIAN y recepcion'],
  ['envio_masivo', 'Envio masivo'],
  ['webhooks', 'Webhooks']
];

// Companies created after the Phase 1 migration have no service rows; create them inactive on demand.
async function ensureMatiasServices(empresaId: number) {
  const rows = ['sandbox', 'produccion'].flatMap(entorno => matiasServiceCatalog.map(([codigo, nombre]) => [empresaId, entorno, codigo, nombre]));
  await pool.query(
    'INSERT IGNORE INTO matias_servicios (empresa_id, entorno, codigo, nombre) VALUES ?',
    [rows]
  );
}

async function puedeOperarEmpresa(req: Request, empresaId: number): Promise<boolean> {
  const user: any = (req as any).user;
  if (!user) return false;
  if (user.tipo_usuario === 'super_admin') return true;
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT 1 FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ? AND activo = 1 LIMIT 1',
    [user.id, empresaId]
  );
  return rows.length > 0 && ['super_admin', 'admin_empresa'].includes(user.tipo_usuario);
}

async function audit(req: Request, empresaId: number, entorno: string, accion: string, resultado: 'ok' | 'error', detalle?: any) {
  const user: any = (req as any).user;
  await pool.execute(
    `INSERT INTO matias_eventos_auditoria
      (empresa_id, entorno, usuario_id, accion, resultado, detalle, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [empresaId, entorno, user?.id || null, accion, resultado,
      detalle ? JSON.stringify(detalle) : null,
      req.ip?.slice(0, 45) || null, String(req.get('user-agent') || '').slice(0, 500)]
  );
}

export async function getMatiasConnection(req: Request, res: Response) {
  const empresaId = Number(req.params.empresaId);
  if (!await puedeOperarEmpresa(req, empresaId)) return res.status(403).json({ success: false, message: 'No tiene acceso a esta empresa' });

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, entorno, base_url, matias_company_uuid, matias_company_id, nit, razon_social,
            token_id, estado, ultimo_uso_at, ultimo_prueba_at, expires_at, ultimo_error,
            disabled_at, updated_at,
            CASE WHEN pat_cifrado IS NOT NULL AND pat_cifrado <> '' THEN 1 ELSE 0 END AS tiene_pat
       FROM matias_conexiones WHERE empresa_id = ? ORDER BY updated_at DESC LIMIT 1`,
    [empresaId]
  );

  const entorno = req.query.entorno === 'produccion' || (!req.query.entorno && rows[0]?.entorno === 'produccion')
    ? 'produccion' : 'sandbox';
  await ensureMatiasServices(empresaId);
  const [services] = await pool.execute<RowDataPacket[]>(
    `SELECT codigo, nombre, entorno, contratado, activo_local, activo_proveedor,
            ultima_verificacion_at, datos_publicos, version_api
       FROM matias_servicios WHERE empresa_id = ? AND entorno = ? ORDER BY nombre`,
    [empresaId, entorno]
  );

  return res.json({ success: true, data: { connection: rows[0] || null, services } });
}

export async function saveMatiasConnection(req: Request, res: Response) {
  const empresaId = Number(req.params.empresaId);
  if (!await puedeOperarEmpresa(req, empresaId)) return res.status(403).json({ success: false, message: 'No tiene acceso a esta empresa' });

  const entorno = req.body.entorno === 'produccion' ? 'produccion' : 'sandbox';
  const baseUrl = entorno === 'sandbox' ? sandboxUrl : String(req.body.base_url || '').trim();
  const pat = typeof req.body.pat === 'string' ? req.body.pat.trim() : '';
  const matiasCompanyUuid = typeof req.body.matias_company_uuid === 'string' ? req.body.matias_company_uuid.trim() : null;
  const matiasCompanyId = typeof req.body.matias_company_id === 'string' ? req.body.matias_company_id.trim() : null;
  const nit = typeof req.body.nit === 'string' ? req.body.nit.replace(/[^0-9]/g, '') : null;
  const razonSocial = typeof req.body.razon_social === 'string' ? req.body.razon_social.trim() : null;

  if (!baseUrl || (entorno === 'produccion' && !/^https:\/\//i.test(baseUrl))) {
    await audit(req, empresaId, entorno, 'guardar_conexion', 'error', { motivo: 'URL invalida' });
    return res.status(400).json({ success: false, message: 'La URL de produccion debe usar HTTPS' });
  }
  if (pat && pat.length < 20) {
    await audit(req, empresaId, entorno, 'guardar_conexion', 'error', { motivo: 'PAT invalido' });
    return res.status(400).json({ success: false, message: 'El PAT no tiene un formato valido' });
  }

  const user: any = (req as any).user;
  const [existing] = await pool.execute<RowDataPacket[]>(
    'SELECT pat_cifrado FROM matias_conexiones WHERE empresa_id = ? AND entorno = ?',
    [empresaId, entorno]
  );
  const encryptedPat = pat ? encryptAuthSecret(pat) : (existing[0]?.pat_cifrado || null);
  const expiresAt = req.body.expires_at ? String(req.body.expires_at) : null;

  await pool.execute(
    `INSERT INTO matias_conexiones
      (empresa_id, entorno, base_url, matias_company_uuid, matias_company_id, nit, razon_social,
       pat_cifrado, token_id, estado, expires_at, ultimo_error, created_by, updated_by, disabled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
     ON DUPLICATE KEY UPDATE
       base_url = VALUES(base_url), matias_company_uuid = VALUES(matias_company_uuid),
       matias_company_id = VALUES(matias_company_id), nit = VALUES(nit), razon_social = VALUES(razon_social),
       pat_cifrado = VALUES(pat_cifrado), token_id = VALUES(token_id), estado = VALUES(estado),
       expires_at = VALUES(expires_at), ultimo_error = NULL, updated_by = VALUES(updated_by), disabled_at = NULL`,
    [empresaId, entorno, baseUrl, matiasCompanyUuid, matiasCompanyId, nit, razonSocial,
      encryptedPat, req.body.token_id || null, entorno === 'sandbox' ? 'sandbox_pendiente' : 'configurado',
      expiresAt, user.id, user.id]
  );

  await audit(req, empresaId, entorno, 'guardar_conexion', 'ok', {
    base_url: baseUrl, matias_company_uuid: matiasCompanyUuid, tiene_pat: Boolean(encryptedPat)
  });
  return res.json({ success: true, message: 'Conexion Matias guardada' });
}

export async function probeMatiasConnection(req: Request, res: Response) {
  const empresaId = Number(req.params.empresaId);
  if (!await puedeOperarEmpresa(req, empresaId)) return res.status(403).json({ success: false, message: 'No tiene acceso a esta empresa' });
  const entorno = req.query.entorno === 'produccion' ? 'produccion' : 'sandbox';

  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT base_url, pat_cifrado FROM matias_conexiones WHERE empresa_id = ? AND entorno = ?',
    [empresaId, entorno]
  );
  if (!rows[0]?.pat_cifrado) {
    await audit(req, empresaId, entorno, 'probar_conexion', 'error', { motivo: 'PAT faltante' });
    return res.status(400).json({ success: false, message: 'No hay PAT configurado para este entorno' });
  }

  let pat: string;
  try {
    pat = decryptAuthSecret(rows[0].pat_cifrado);
  } catch {
    await audit(req, empresaId, entorno, 'probar_conexion', 'error', { motivo: 'No se pudo descifrar PAT' });
    return res.status(500).json({ success: false, message: 'La conexion Matias tiene un secreto invalido' });
  }

  const result = await probeMatias(rows[0].base_url, pat);
  const state = result.ok ? (entorno === 'sandbox' ? 'configurado' : 'ready_produccion') : 'error';
  await pool.execute(
    `UPDATE matias_conexiones SET estado = ?, ultimo_prueba_at = NOW(), ultimo_error = ?, ultimo_uso_at = NOW()
     WHERE empresa_id = ? AND entorno = ?`,
    [state, result.ok ? null : result.error?.slice(0, 2000) || null, empresaId, entorno]
  );
  await audit(req, empresaId, entorno, 'probar_conexion', result.ok ? 'ok' : 'error', { status: result.status });

  if (!result.ok) return res.status(result.status === 401 ? 401 : 422).json({ success: false, message: result.error || 'No fue posible probar Matias' });
  return res.json({ success: true, message: 'Conexion Matias probada exitosamente', data: { estado: state } });
}

export async function revokeMatiasConnection(req: Request, res: Response) {
  const empresaId = Number(req.params.empresaId);
  if (!await puedeOperarEmpresa(req, empresaId)) return res.status(403).json({ success: false, message: 'No tiene acceso a esta empresa' });
  const entorno = req.query.entorno === 'produccion' ? 'produccion' : 'sandbox';
  await pool.execute(
    `UPDATE matias_conexiones SET pat_cifrado = NULL, estado = 'revocado', disabled_at = NOW(), ultimo_error = NULL
     WHERE empresa_id = ? AND entorno = ?`,
    [empresaId, entorno]
  );
  await audit(req, empresaId, entorno, 'revocar_conexion', 'ok', { estado: 'revocado' });
  return res.json({ success: true, message: 'Conexion Matias revocada' });
}

export async function getMatiasVentaDocument(req: Request, res: Response) {
  const empresaId = Number(req.params.empresaId);
  const ventaId = Number(req.params.ventaId);
  if (!await puedeOperarEmpresa(req, empresaId)) return res.status(403).json({ success: false, message: 'No tiene acceso a esta empresa' });
  if (!Number.isInteger(ventaId) || ventaId <= 0) return res.status(400).json({ success: false, message: 'Venta invalida' });

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, empresa_id, venta_id, entorno, tipo_documento_id, request_uuid, matias_uuid,
            document_number, cufe, zip_key, xml_name, pdf_path, qr_url, estado,
            dian_status_code, dian_status_description, dian_is_valid, warning_payload,
            error_payload, provider_reference, attempt_count, last_attempt_at, accepted_at,
            rejected_at, created_at, updated_at
       FROM matias_documentos WHERE empresa_id = ? AND venta_id = ?
       ORDER BY updated_at DESC, id DESC LIMIT 1`,
    [empresaId, ventaId]
  );
  return res.json({ success: true, data: rows[0] || null });
}

export async function previewMatiasSandboxInvoice(req: Request, res: Response) {
  return processMatiasSandboxInvoice(req, res, true);
}

export async function emitMatiasSandboxInvoice(req: Request, res: Response) {
  return processMatiasSandboxInvoice(req, res, false);
}

async function processMatiasSandboxInvoice(req: Request, res: Response, preview: boolean) {
  const empresaId = Number(req.params.empresaId);
  const ventaId = Number(req.params.ventaId);
  if (!await puedeOperarEmpresa(req, empresaId)) return res.status(403).json({ success: false, message: 'No tiene acceso a esta empresa' });
  if (!Number.isInteger(ventaId) || ventaId <= 0) return res.status(400).json({ success: false, message: 'Venta invalida' });

  const recordError = async (motivo: string) => {
    if (preview) logger.warning(`MATIAS previsualizacion empresa ${empresaId}, venta ${ventaId}: ${motivo}`);
    else await audit(req, empresaId, 'sandbox', 'emitir_invoice_sandbox', 'error', { venta_id: ventaId, motivo });
  };
  const [connections] = await pool.execute<RowDataPacket[]>(
    `SELECT id, base_url, matias_company_uuid, pat_cifrado, estado
       FROM matias_conexiones WHERE empresa_id = ? AND entorno = 'sandbox' LIMIT 1`,
    [empresaId]
  );
  const connection = connections[0];
  if (!connection?.pat_cifrado || !['configurado', 'ready_produccion', 'activo'].includes(connection.estado)) {
    await recordError('conexion_no_probada');
    return res.status(400).json({ success: false, message: 'Debe probar la conexion sandbox antes de emitir' });
  }
  if (!connection.matias_company_uuid) {
    await recordError('client_uuid_faltante');
    return res.status(400).json({ success: false, message: 'Debe configurar el client_uuid de Sandbox antes de emitir' });
  }
  if (connection.base_url !== sandboxUrl) {
    await recordError('url_no_sandbox');
    return res.status(422).json({ success: false, message: 'La emision de prueba requiere la URL oficial de Sandbox' });
  }

  const [serviceRows] = await pool.execute<RowDataPacket[]>(
    `SELECT activo_local FROM matias_servicios
     WHERE empresa_id = ? AND entorno = 'sandbox' AND codigo = 'factura_electronica' LIMIT 1`,
    [empresaId]
  );
  if (!serviceRows[0]?.activo_local) {
    await recordError('servicio_inactivo');
    return res.status(400).json({ success: false, message: 'El servicio Factura electronica no esta activado para sandbox' });
  }

  const [ventas] = await pool.execute<(RowDataPacket & MatiasSale)[]>(
    `SELECT v.id, v.numero_factura, v.subtotal, v.descuento, v.impuesto, v.total,
            v.fecha_venta, v.metodo_pago, v.forma_pago, v.estado,
            v.retenciones, v.impuestos_adicionales, v.propina_valor,
            c.tipo_documento, c.numero_documento, c.digito_verificacion,
            c.nombre, c.apellido, c.razon_social, c.email, c.direccion, c.ciudad,
            c.tipo_cliente, c.regimen_tributario, c.responsabilidad_fiscal,
            e.resolucion_dian, e.prefijo_factura
       FROM ventas v
       JOIN clientes c ON c.id = v.cliente_id AND c.empresa_id = v.empresa_id
       JOIN empresas e ON e.id = v.empresa_id
       WHERE v.id = ? AND v.empresa_id = ? LIMIT 1`,
    [ventaId, empresaId]
  );
  if (!ventas[0]) {
    await recordError('venta_no_encontrada');
    return res.status(404).json({ success: false, message: 'Venta no encontrada para esta empresa' });
  }
  const sale = ventas[0];

  const [details] = await pool.execute<(RowDataPacket & MatiasLine)[]>(
    `SELECT vd.producto_id, vd.cantidad, vd.precio_unitario, vd.descuento, vd.subtotal,
            p.nombre, p.descripcion, p.porcentaje_iva, p.aplica_iva, p.tipo_impuesto,
            COALESCE(vd.unidad_medida, p.unidad_medida) AS unidad_medida
       FROM venta_detalle vd
       LEFT JOIN productos p ON p.id = vd.producto_id AND p.empresa_id = ?
       WHERE vd.venta_id = ? ORDER BY vd.id`,
    [empresaId, ventaId]
  );
  const [payments] = await pool.execute<(RowDataPacket & MatiasPayment)[]>(
    `SELECT metodo_pago, monto FROM venta_pagos WHERE venta_id = ? ORDER BY id`,
    [ventaId]
  );

  const [existingRows] = await pool.execute<RowDataPacket[]>(
    `SELECT d.id, d.request_uuid, d.attempt_count, d.estado, d.tipo_documento_id,
            d.cufe, d.matias_uuid, d.response_payload, d.request_payload, d.payload_hash,
            (SELECT i.http_status FROM matias_documento_intentos i
             WHERE i.documento_id = d.id ORDER BY i.numero_intento DESC LIMIT 1) AS last_http_status
       FROM matias_documentos d WHERE d.empresa_id = ? AND d.venta_id = ? AND d.entorno = 'sandbox'
       ORDER BY d.id`,
    [empresaId, ventaId]
  );
  const existing = existingRows[0];
  const resolutionDocument = existingRows.find(row => row.tipo_documento_id === 7);
  const resolutionRecoveryRequested = !preview && req.body?.retry_resolution_document_id !== undefined;
  const parsePayload = (value: string | Record<string, unknown> | null) =>
    typeof value === 'string' ? JSON.parse(value) : value;
  const previousRequest = resolutionDocument ? parsePayload(resolutionDocument.request_payload) : null;
  const previousResponse = resolutionDocument ? parsePayload(resolutionDocument.response_payload) : null;
  const resolutionRecovery = resolutionRecoveryRequested && req.body?.portal_absence_confirmed === true &&
    resolutionDocument && Number(req.body.retry_resolution_document_id) === resolutionDocument.id &&
    resolutionDocument.estado === 'unknown' && resolutionDocument.attempt_count === 1 &&
    resolutionDocument.last_http_status === 400 && !resolutionDocument.cufe && !resolutionDocument.matias_uuid &&
    previousRequest?.resolution_number === '1876000001' && sale.resolucion_dian === '18760000001' &&
    previousResponse?.message === 'La resolución de facturación: 1876000001, no existe. Empresa KORE PRUEBAS MATIAS SOPORTE SAS-900999002' &&
    existingRows.every(row => row.id === resolutionDocument.id || (row.tipo_documento_id === 1 &&
      row.estado === 'unknown' && row.last_http_status === 422 && !row.cufe && !row.matias_uuid));
  const recoveryRequested = !preview && req.body?.retry_validation_document_id !== undefined;
  const recoverable = recoveryRequested && req.body?.portal_absence_confirmed === true && existingRows.length === 1 &&
    Number(req.body.retry_validation_document_id) === existing?.id &&
    existing.estado === 'unknown' && existing.tipo_documento_id === 1 &&
    existing.attempt_count === 1 && existing.last_http_status === 422 && !existing.cufe && !existing.matias_uuid;
  let validationRecovery = false;
  if (recoverable) {
    const response = typeof existing.response_payload === 'string'
      ? JSON.parse(existing.response_payload) : existing.response_payload;
    validationRecovery = response?.message === 'El campo type_document_id no existe en la tabla accounting_documents';
  }
  if ((existing && !validationRecovery && !resolutionRecovery) || (recoveryRequested && !validationRecovery) ||
      (resolutionRecoveryRequested && !resolutionRecovery)) {
    await recordError('solicitud_fiscal_existente');
    return res.status(409).json({
      success: false,
      message: 'La venta ya tiene una solicitud fiscal. Consulte su estado en MATÍAS antes de intentar otra emisión.',
      data: existing ? { estado: existing.estado, request_uuid: existing.request_uuid } : null
    });
  }

  const requestUuid = crypto.randomUUID();
  let invoice: ReturnType<typeof buildMatiasSandboxInvoice>;
  try {
    invoice = buildMatiasSandboxInvoice(sale, details, payments, connection.matias_company_uuid, requestUuid, req.body || {});
  } catch (error) {
    if (!(error instanceof MatiasInvoiceValidationError)) throw error;
    await recordError(error.message);
    return res.status(422).json({ success: false, message: error.message });
  }
  if (invoice.blockingErrors.length) {
    await recordError('desglose_retenciones_pendiente');
    return res.status(422).json({
      success: false, message: invoice.blockingErrors.join(' '),
      ...(preview ? { data: { ...invoice, ready: false, preview: true } } : {})
    });
  }
  if (preview) {
    return res.json({ success: true, message: 'Previsualizacion local; no se ha enviado a MATIAS', data: { ...invoice, ready: true, preview: true } });
  }
  const { payload } = invoice;
  const { prefix, document_number: documentNumber } = payload;
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  if (resolutionRecovery && JSON.stringify({ ...previousRequest, uuid: payload.uuid, resolution_number: payload.resolution_number }) !== JSON.stringify(payload)) {
    await recordError('recuperacion_resolucion_payload_cambiado');
    return res.status(409).json({ success: false, message: 'Hay cambios adicionales a la resolucion; revise el documento antes de reintentar' });
  }

  let pat: string;
  try {
    pat = decryptAuthSecret(connection.pat_cifrado);
  } catch {
    await recordError('pat_invalido');
    return res.status(500).json({ success: false, message: 'La conexion Matias tiene un secreto invalido' });
  }
  if (validationRecovery || resolutionRecovery) {
    const previousDocument = resolutionRecovery ? resolutionDocument : existing;
    const lookup = await lookupMatiasDocument(connection.base_url, pat, connection.matias_company_uuid, previousDocument.request_uuid);
    if (!lookup.ok || lookup.data?.dataRecord !== null) {
      await recordError('recuperacion_bloqueada_consulta_proveedor');
      return res.status(409).json({ success: false, message: 'No se confirmo ausencia del documento en MATIAS; no se reenvio' });
    }
    await audit(req, empresaId, 'sandbox', resolutionRecovery ? 'recuperar_resolucion' : 'recuperar_validacion_tipo', 'ok', {
      venta_id: ventaId, documento_anterior_id: previousDocument.id, request_uuid_anterior: previousDocument.request_uuid,
      request_uuid_nuevo: requestUuid, portal_absence_confirmed: true, consulta_proveedor: 'dataRecord_null',
      ...(resolutionRecovery ? { request_payload_anterior: previousRequest, response_payload_anterior: previousResponse,
        payload_hash_anterior: previousDocument.payload_hash, numero_intento_anterior: previousDocument.attempt_count } : {})
    });
  }

  let documentId: number;
  if (resolutionRecovery) {
    const [claimed] = await pool.execute<ResultSetHeader>(
      `UPDATE matias_documentos SET estado = 'emitting', request_uuid = ?, request_payload = ?,
       payload_hash = ?, attempt_count = attempt_count + 1, last_attempt_at = NOW()
       WHERE id = ? AND empresa_id = ? AND estado = 'unknown' AND attempt_count = 1 AND payload_hash = ?`,
      [requestUuid, JSON.stringify(payload), payloadHash, resolutionDocument.id, empresaId, resolutionDocument.payload_hash]
    );
    if (claimed.affectedRows !== 1) {
      await recordError('recuperacion_resolucion_concurrente');
      return res.status(409).json({ success: false, message: 'El documento cambio; no se reenvio' });
    }
    documentId = resolutionDocument.id;
  } else {
  try {
    const [inserted] = await pool.execute<ResultSetHeader>(
      `INSERT INTO matias_documentos
        (empresa_id, venta_id, entorno, tipo_documento_id, tipo_operacion_id, request_uuid,
         document_number, estado, payload_hash, request_payload, attempt_count, last_attempt_at, created_by)
       VALUES (?, ?, 'sandbox', ?, ?, ?, ?, 'emitting', ?, ?, 1, NOW(), ?)`,
      [empresaId, ventaId, payload.type_document_id, payload.operation_type_id,
        requestUuid, `${prefix}${documentNumber}`, payloadHash, JSON.stringify(payload), (req as any).user?.id || null]
    );
    documentId = inserted.insertId;
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ER_DUP_ENTRY') throw error;
    await recordError('solicitud_fiscal_concurrente');
    return res.status(409).json({ success: false, message: 'Ya existe una solicitud fiscal concurrente; consulte su estado. No se reenvio' });
  }
  }

  const result = await emitMatiasInvoice(connection.base_url, pat, connection.matias_company_uuid, payload);
  const responsePayload = result.data || null;
  const dian = responsePayload?.response || {};
  const isValid = String(dian.IsValid || '').toLowerCase() === 'true';
  const cufe = responsePayload?.XmlDocumentKey || null;
  const matiasUuid = responsePayload?.uuid || null;
  const accepted = result.ok && result.status === 200 && isValid;
  const rejected = result.ok && result.status === 200 && String(dian.IsValid || '').toLowerCase() === 'false';
  let state: 'accepted' | 'rejected' | 'emitted' | 'unknown' = 'unknown';
  if (accepted) state = 'accepted';
  else if (rejected) state = 'rejected';
  else if (result.ok && responsePayload?.success !== false) state = 'emitted';

  await pool.execute(
    `UPDATE matias_documentos SET
       matias_uuid = ?, cufe = ?, zip_key = ?, xml_name = ?, pdf_path = ?, qr_url = ?,
       estado = ?, dian_status_code = ?, dian_status_description = ?, dian_is_valid = ?,
       response_payload = ?, warning_payload = ?, error_payload = ?, provider_reference = ?,
       accepted_at = CASE WHEN ? = 'accepted' THEN NOW() ELSE accepted_at END,
       rejected_at = CASE WHEN ? = 'rejected' THEN NOW() ELSE rejected_at END,
       updated_at = NOW()
     WHERE id = ? AND empresa_id = ?`,
    [matiasUuid, cufe, responsePayload?.ZipKey || null, responsePayload?.XmlDocumentName || null,
      responsePayload?.pdf?.url || responsePayload?.pdf?.path || null,
      responsePayload?.qr?.url || null, state, dian.StatusCode || null,
      dian.StatusDescription || dian.StatusMessage || null, dian.IsValid || null,
      JSON.stringify(responsePayload || {}), JSON.stringify(responsePayload?.warnings || []),
      result.ok ? null : JSON.stringify({ message: result.error, code: result.code, reference: result.reference }),
      result.reference || result.code || null, state, state, documentId, empresaId]
  );

  const attemptCount = resolutionRecovery ? 2 : 1;
  await pool.execute(
    `INSERT INTO matias_documento_intentos
      (documento_id, empresa_id, numero_intento, request_hash, http_status, provider_code, provider_message, success, response_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [documentId, empresaId, attemptCount, payloadHash, result.status, result.code || dian.StatusCode || null,
      result.error || dian.StatusDescription || dian.StatusMessage || null, result.ok ? 1 : 0,
      JSON.stringify(responsePayload || { message: result.error })]
  );

  await audit(req, empresaId, 'sandbox', 'emitir_invoice_sandbox', result.ok ? 'ok' : 'error', {
    venta_id: ventaId, estado: state, matias_uuid: matiasUuid, http_status: result.status,
    provider_code: result.code || dian.StatusCode || null
  });

  return res.status(result.ok ? 200 : (result.status || 500)).json({
    success: result.ok,
    message: state === 'accepted' ? 'Factura sandbox aceptada' : (state === 'rejected' ? 'Factura sandbox rechazada' : (result.error || 'Factura enviada; estado pendiente')),
    data: {
      estado: state,
      cufe,
      matias_uuid: matiasUuid,
      document_number: `${prefix}${documentNumber}`,
      warnings: responsePayload?.warnings || [],
      dian: responsePayload?.response || null
    }
  });
}

export async function setMatiasService(req: Request, res: Response) {
  const empresaId = Number(req.params.empresaId);
  const codigo = String(req.params.codigo || '').trim();
  if (!await puedeOperarEmpresa(req, empresaId)) return res.status(403).json({ success: false, message: 'No tiene acceso a esta empresa' });
  const entorno = req.body.entorno === 'produccion' ? 'produccion' : 'sandbox';
  const activoLocal = req.body.activo === true ? 1 : 0;
  if (!matiasServiceCatalog.some(([known]) => known === codigo)) {
    return res.status(400).json({ success: false, message: 'Servicio Matias no reconocido' });
  }
  const [connections] = await pool.execute<RowDataPacket[]>(
    `SELECT estado, pat_cifrado FROM matias_conexiones WHERE empresa_id = ? AND entorno = ? LIMIT 1`,
    [empresaId, entorno]
  );
  if (activoLocal && (!connections[0] || !connections[0].pat_cifrado || !['configurado', 'ready_produccion', 'activo'].includes(connections[0].estado))) {
    await audit(req, empresaId, entorno, 'activar_servicio', 'error', { codigo });
    return res.status(400).json({ success: false, message: 'Debe probar la conexion antes de activar un servicio' });
  }

  await ensureMatiasServices(empresaId);
  const [updated] = await pool.execute<ResultSetHeader>(
    `UPDATE matias_servicios SET activo_local = ?, ultima_verificacion_at = NOW()
     WHERE empresa_id = ? AND entorno = ? AND codigo = ?`,
    [activoLocal, empresaId, entorno, codigo]
  );
  if (!updated.affectedRows) {
    await audit(req, empresaId, entorno, 'activar_servicio', 'error', { codigo, motivo: 'servicio_no_registrado' });
    return res.status(500).json({ success: false, message: 'No fue posible actualizar el servicio' });
  }
  await audit(req, empresaId, entorno, activoLocal ? 'activar_servicio' : 'desactivar_servicio', 'ok', { codigo });
  return res.json({ success: true, message: activoLocal ? 'Servicio activado' : 'Servicio desactivado' });
}
