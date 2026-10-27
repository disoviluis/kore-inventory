import { Request, Response } from 'express';
import pool from '../../shared/database';
import { decryptAuthSecret, encryptAuthSecret } from '../../core/auth/auth.security';
import { emitMatiasInvoice, probeMatias } from './matias.client';
import { RowDataPacket } from 'mysql2';
import crypto from 'crypto';

const sandboxUrl = 'https://sandbox-api.matias-api.com/api/ubl2.1';

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

  const [services] = await pool.execute<RowDataPacket[]>(
    `SELECT codigo, nombre, contratado, activo_local, activo_proveedor,
            ultima_verificacion_at, datos_publicos, version_api
       FROM matias_servicios WHERE empresa_id = ? ORDER BY nombre`,
    [empresaId]
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
       ORDER BY updated_at DESC LIMIT 1`,
    [empresaId, ventaId]
  );
  return res.json({ success: true, data: rows[0] || null });
}

function money(value: unknown): string {
  const number = Math.max(0, Number(value || 0));
  return number.toFixed(2);
}

export async function emitMatiasSandboxInvoice(req: Request, res: Response) {
  const empresaId = Number(req.params.empresaId);
  const ventaId = Number(req.params.ventaId);
  if (!await puedeOperarEmpresa(req, empresaId)) return res.status(403).json({ success: false, message: 'No tiene acceso a esta empresa' });
  if (!Number.isInteger(ventaId) || ventaId <= 0) return res.status(400).json({ success: false, message: 'Venta invalida' });

  const [connections] = await pool.execute<RowDataPacket[]>(
    `SELECT id, base_url, matias_company_uuid, pat_cifrado, estado
       FROM matias_conexiones WHERE empresa_id = ? AND entorno = 'sandbox' LIMIT 1`,
    [empresaId]
  );
  const connection = connections[0];
  if (!connection?.pat_cifrado || !['configurado', 'ready_produccion', 'activo'].includes(connection.estado)) {
    await audit(req, empresaId, 'sandbox', 'emitir_invoice_sandbox', 'error', { venta_id: ventaId, motivo: 'conexion_no_probada' });
    return res.status(400).json({ success: false, message: 'Debe probar la conexion sandbox antes de emitir' });
  }

  const [serviceRows] = await pool.execute<RowDataPacket[]>(
    `SELECT activo_local FROM matias_servicios
     WHERE empresa_id = ? AND entorno = 'sandbox' AND codigo = 'factura_electronica' LIMIT 1`,
    [empresaId]
  );
  if (!serviceRows[0]?.activo_local) {
    await audit(req, empresaId, 'sandbox', 'emitir_invoice_sandbox', 'error', { venta_id: ventaId, motivo: 'servicio_inactivo' });
    return res.status(400).json({ success: false, message: 'El servicio Factura electronica no esta activado para sandbox' });
  }

  const [ventas] = await pool.execute<RowDataPacket[]>(
    `SELECT v.id, v.numero_factura, v.subtotal, v.descuento, v.impuesto, v.total,
            v.fecha_venta, v.metodo_pago, v.forma_pago,
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
    await audit(req, empresaId, 'sandbox', 'emitir_invoice_sandbox', 'error', { venta_id: ventaId, motivo: 'venta_no_encontrada' });
    return res.status(404).json({ success: false, message: 'Venta no encontrada para esta empresa' });
  }
  const sale = ventas[0];

  const [details] = await pool.execute<RowDataPacket[]>(
    `SELECT vd.cantidad, vd.precio_unitario, vd.descuento, vd.subtotal,
            p.nombre, p.descripcion, p.codigo_unspsc
       FROM venta_detalle vd
       LEFT JOIN productos p ON p.id = vd.producto_id AND p.empresa_id = ?
       WHERE vd.venta_id = ? ORDER BY vd.id`,
    [empresaId, ventaId]
  );
  if (!details.length) return res.status(400).json({ success: false, message: 'La venta no tiene productos' });

  const [payments] = await pool.execute<RowDataPacket[]>(
    `SELECT metodo_pago, monto FROM venta_pagos WHERE venta_id = ? ORDER BY id`,
    [ventaId]
  );

  const [existingRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, request_uuid, attempt_count, estado
       FROM matias_documentos WHERE empresa_id = ? AND venta_id = ? AND entorno = 'sandbox'
       LIMIT 1`,
    [empresaId, ventaId]
  );
  const existing = existingRows[0];
  if (existing && ['accepted', 'emitted', 'emitting'].includes(existing.estado)) {
    return res.json({ success: true, data: { estado: existing.estado, message: 'La venta ya tiene una solicitud fiscal; consulte su estado antes de emitir nuevamente' } });
  }

  const prefix = String(sale.prefijo_factura || 'FAC').trim();
  const documentNumber = String(sale.numero_factura || '').replace(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`, 'i'), '') || String(sale.numero_factura || '');
  const customerName = sale.razon_social || `${sale.nombre || ''} ${sale.apellido || ''}`.trim() || 'CLIENTE';
  const documentType = String(sale.tipo_documento || '').toUpperCase();
  const customerDni = String(sale.numero_documento || '').replace(/[^0-9]/g, '').replace(/\-.*$/, '') || '222222222222';
  const requestUuid = existing?.request_uuid || crypto.randomUUID();
  const paymentValue = payments.length ? payments.reduce((sum, payment) => sum + Number(payment.monto || 0), 0) : Number(sale.total || 0);

  const payload = {
    uuid: requestUuid,
    resolution_number: String(sale.resolucion_dian || ''),
    prefix,
    document_number: documentNumber,
    operation_type_id: 1,
    type_document_id: 1,
    payments: [{ payment_method_id: 1, means_payment_id: 10, value_paid: money(paymentValue) }],
    customer: {
      company_name: customerName,
      dni: customerDni,
      dv: sale.digito_verificacion ? String(sale.digito_verificacion) : undefined,
      email: sale.email || undefined,
      address: sale.direccion || undefined,
      city_name: sale.ciudad || undefined
    },
    lines: details.map((line: any) => ({
      invoiced_quantity: String(Number(line.cantidad || 0)),
      line_extension_amount: money(line.subtotal),
      description: String(line.nombre || line.descripcion || 'Producto'),
      price_amount: money(line.precio_unitario),
      base_quantity: '1'
    })),
    legal_monetary_totals: {
      line_extension_amount: money(sale.subtotal),
      tax_exclusive_amount: money(Number(sale.subtotal || 0) - Number(sale.descuento || 0)),
      tax_inclusive_amount: money(sale.total),
      payable_amount: money(sale.total)
    },
    graphic_representation: true
  };
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  if (!sale.resolucion_dian || !documentNumber || !customerDni) {
    await audit(req, empresaId, 'sandbox', 'emitir_invoice_sandbox', 'error', { venta_id: ventaId, motivo: 'datos_fiscales_incompletos' });
    return res.status(422).json({ success: false, message: 'La venta requiere resolucion, numero fiscal y documento del cliente' });
  }

  let documentId: number;
  if (existing) {
    documentId = existing.id;
    await pool.execute(
      `UPDATE matias_documentos SET estado = 'emitting', payload_hash = ?, request_payload = ?,
              attempt_count = attempt_count + 1, last_attempt_at = NOW(), updated_at = NOW()
       WHERE id = ? AND empresa_id = ?`,
      [payloadHash, JSON.stringify(payload), documentId, empresaId]
    );
  } else {
    const [inserted] = await pool.execute(
      `INSERT INTO matias_documentos
        (empresa_id, venta_id, entorno, tipo_documento_id, tipo_operacion_id, request_uuid,
         document_number, estado, payload_hash, request_payload, attempt_count, last_attempt_at, created_by)
       VALUES (?, ?, 'sandbox', 1, 1, ?, ?, 'emitting', ?, ?, 1, NOW(), ?)`,
      [empresaId, ventaId, requestUuid, `${prefix}${documentNumber}`, payloadHash, JSON.stringify(payload), (req as any).user?.id || null]
    );
    documentId = (inserted as any).insertId;
  }

  let pat: string;
  try {
    pat = decryptAuthSecret(connection.pat_cifrado);
  } catch {
    await pool.execute(`UPDATE matias_documentos SET estado = 'unknown', error_payload = ? WHERE id = ?`,
      [JSON.stringify({ message: 'No se pudo descifrar PAT' }), documentId]);
    await audit(req, empresaId, 'sandbox', 'emitir_invoice_sandbox', 'error', { venta_id: ventaId, motivo: 'pat_invalido' });
    return res.status(500).json({ success: false, message: 'La conexion Matias tiene un secreto invalido' });
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

  const attemptCount = existing ? Number(existing.attempt_count || 0) + 1 : 1;
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

  const [connections] = await pool.execute<RowDataPacket[]>(
    `SELECT estado, pat_cifrado FROM matias_conexiones WHERE empresa_id = ? AND entorno = ? LIMIT 1`,
    [empresaId, entorno]
  );
  if (activoLocal && (!connections[0] || !connections[0].pat_cifrado || !['configurado', 'ready_produccion', 'activo'].includes(connections[0].estado))) {
    await audit(req, empresaId, entorno, 'activar_servicio', 'error', { codigo });
    return res.status(400).json({ success: false, message: 'Debe probar la conexion antes de activar un servicio' });
  }

  await pool.execute(
    `UPDATE matias_servicios SET activo_local = ?, ultima_verificacion_at = NOW()
     WHERE empresa_id = ? AND entorno = ? AND codigo = ?`,
    [activoLocal, empresaId, entorno, codigo]
  );
  await audit(req, empresaId, entorno, activoLocal ? 'activar_servicio' : 'desactivar_servicio', 'ok', { codigo });
  return res.json({ success: true, message: activoLocal ? 'Servicio activado' : 'Servicio desactivado' });
}
