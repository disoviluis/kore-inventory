import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
import { requestedCompany, assertCompanyMembership, companySubscription, addCalendarMonths } from './subscription.service';
import { recordLegalAcceptance } from './legal.service';

type Query = (sql: string, params?: any[]) => Promise<any>;
const fail = (res: Response, error: any) => res.status(error.status || 400).json({ success: false,
  message: error.code === 'ER_DUP_ENTRY' ? 'La referencia de pago ya fue utilizada' : error.message || 'No se pudo procesar la suscripcion' });

async function assertSubscriptionAdmin(req: Request, companyId: number, tx: Query = query) {
  const user = (req as any).user;
  await assertCompanyMembership(user, companyId, tx);
  if (['super_admin', 'admin_empresa'].includes(user.tipo_usuario)) return;
  const roles = await tx(`SELECT r.id FROM usuario_rol ur JOIN roles r ON r.id = ur.rol_id
    WHERE ur.usuario_id = ? AND ur.empresa_id = ? AND r.es_admin = 1 AND r.activo = 1`, [user.id, companyId]);
  if (!roles.length) throw Object.assign(new Error('Solo el administrador de la empresa puede gestionar su suscripcion'), { status: 403 });
}

export const getSubscription = async (req: Request, res: Response) => {
  try {
    const companyId = Number(req.params.empresaId);
    await assertCompanyMembership((req as any).user, companyId);
    const subscription = await companySubscription(companyId);
    const plans = await query(`SELECT id, nombre, descripcion, precio_mensual, precio_anual,
      max_usuarios_por_empresa, max_productos, max_facturas_mes, modulos_incluidos FROM planes WHERE activo = 1 ORDER BY precio_mensual`);
    const requests = await query('SELECT * FROM solicitudes_suscripcion WHERE empresa_id = ? ORDER BY id DESC LIMIT 50', [companyId]);
    let canManage = true;
    try { await assertSubscriptionAdmin(req, companyId); } catch { canManage = false; }
    return res.json({ success: true, data: { ...subscription, planes: plans, solicitudes: requests, puede_gestionar: canManage } });
  } catch (error) { return fail(res, error); }
};

export const requestSubscription = async (req: Request, res: Response) => {
  try {
    const companyId = Number(req.params.empresaId);
    const periodicity = req.body.periodicidad;
    const months = periodicity === 'anual' ? 1 : Number(req.body.meses || 1);
    if (!['mensual', 'anual'].includes(periodicity) || !Number.isInteger(months) || months < 1 || months > 24) throw new Error('Periodo no valido');
    const result = await withTransaction(async tx => {
      await assertSubscriptionAdmin(req, companyId, tx);
      const companies = await tx('SELECT id, estado FROM empresas WHERE id = ? FOR UPDATE', [companyId]);
      if (!companies.length || companies[0].estado === 'cancelada') throw new Error('Empresa no disponible');
      const plans = await tx('SELECT * FROM planes WHERE id = ? AND activo = 1', [Number(req.body.plan_id)]);
      if (!plans.length) throw new Error('Plan no disponible');
      const plan = plans[0];
      const amount = Number(periodicity === 'anual' ? plan.precio_anual : Number(plan.precio_mensual) * months);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999.99) throw new Error('El plan no tiene un precio valido para este periodo');
      await recordLegalAcceptance(tx, req, (req as any).user.id, companyId);
      const pending = await tx(`SELECT * FROM solicitudes_suscripcion WHERE empresa_id = ? AND estado = 'pendiente' FOR UPDATE`, [companyId]);
      if (pending.length) {
        if (pending[0].plan_id === plan.id && pending[0].periodicidad === periodicity && pending[0].meses === months) return { id: pending[0].id, monto: pending[0].monto };
        throw new Error('Ya hay una solicitud pendiente. Cancelela antes de seleccionar otro plan');
      }
      const request = await tx(`INSERT INTO solicitudes_suscripcion
        (empresa_id, usuario_id, plan_id, periodicidad, meses, monto, observaciones,
          documentos_aceptados, aceptacion_ip, aceptacion_agente) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, (req as any).user.id, plan.id, periodicity, months, amount.toFixed(2), String(req.body.observaciones || '').slice(0, 1000) || null,
        JSON.stringify(req.body.aceptaciones), req.ip || null, String(req.headers['user-agent'] || '').slice(0, 255)]);
      await tx(`INSERT INTO licencias_eventos (empresa_id, evento, descripcion, datos) VALUES (?, 'plan_solicitado', 'Solicitud pendiente de confirmacion manual de pago', ?)`,
        [companyId, JSON.stringify({ solicitud_id: request.insertId, usuario_id: (req as any).user.id, monto: amount })]);
      return { id: request.insertId, monto: amount };
    });
    return res.status(201).json({ success: true, message: 'Solicitud registrada. La licencia se activara solo cuando Super Admin confirme el pago.', data: result });
  } catch (error) { return fail(res, error); }
};

export const cancelSubscriptionRequest = async (req: Request, res: Response) => {
  try {
    const companyId = Number(req.params.empresaId);
    await assertSubscriptionAdmin(req, companyId);
    await query(`UPDATE solicitudes_suscripcion SET estado = 'rechazada', observaciones = 'Cancelada por administrador de empresa'
      WHERE id = ? AND empresa_id = ? AND estado = 'pendiente'`, [Number(req.params.id), companyId]);
    return res.json({ success: true, message: 'Solicitud cancelada; no se realizo ningun cobro' });
  } catch (error) { return fail(res, error); }
};

export const listSubscriptionRequests = async (_req: Request, res: Response) => {
  const rows = await query(`SELECT s.*, e.nombre AS empresa_nombre, p.nombre AS plan_nombre
    FROM solicitudes_suscripcion s JOIN empresas e ON e.id = s.empresa_id JOIN planes p ON p.id = s.plan_id
    ORDER BY s.id DESC LIMIT 500`);
  return res.json({ success: true, data: rows });
};

export const approveSubscriptionRequest = async (req: Request, res: Response) => {
  try {
    const reference = typeof req.body.referencia === 'string' ? req.body.referencia.trim() : '';
    if (!reference || reference.length > 100 || req.body.pago_confirmado !== true) throw new Error('Debe confirmar que recibio el pago e indicar su referencia real');
    const requestId = Number(req.params.id);
    const initial = await query('SELECT empresa_id FROM solicitudes_suscripcion WHERE id = ?', [requestId]);
    if (!initial.length) throw new Error('Solicitud no encontrada');
    const result = await withTransaction(async tx => {
      const companyId = initial[0].empresa_id;
      await tx('SELECT id FROM empresas WHERE id = ? FOR UPDATE', [companyId]);
      const requests = await tx('SELECT * FROM solicitudes_suscripcion WHERE id = ? FOR UPDATE', [requestId]);
      const request = requests[0];
      if (request.estado === 'aprobada') {
        if (request.referencia !== reference) throw new Error('La solicitud ya fue aprobada con otra referencia');
        return { licencia_id: request.licencia_id, ya_aprobada: true };
      }
      if (request.estado !== 'pendiente') throw new Error('La solicitud no esta pendiente');
      if (Number(req.body.monto_recibido) !== Number(request.monto)) throw new Error('El monto recibido no coincide con el monto de la solicitud');
      const previousPayments = await tx("SELECT id FROM pagos_licencias WHERE referencia_pago = ? AND estado = 'exitoso' LIMIT 1", [reference]);
      if (previousPayments.length) throw new Error('La referencia ya figura en un pago anterior');
      const plans = await tx('SELECT * FROM planes WHERE id = ? AND activo = 1', [request.plan_id]);
      if (!plans.length) throw new Error('El plan ya no esta disponible');
      const plan = plans[0];
      const counts = await tx(`SELECT
        (SELECT COUNT(*) FROM usuario_empresa ue JOIN usuarios u ON u.id = ue.usuario_id
          WHERE ue.empresa_id = ? AND ue.activo = 1 AND u.activo = 1 AND u.tipo_usuario <> 'super_admin') AS usuarios,
        (SELECT COUNT(*) FROM productos WHERE empresa_id = ? AND estado = 'activo') AS productos,
        (SELECT COUNT(*) FROM bodegas WHERE empresa_id = ? AND estado = 'activa') AS bodegas`, [companyId, companyId, companyId]);
      if ((plan.max_usuarios_por_empresa !== null && counts[0].usuarios > plan.max_usuarios_por_empresa) ||
          (plan.max_productos !== null && counts[0].productos > plan.max_productos)) throw new Error('La empresa supera los limites del plan seleccionado; ajuste el plan sin borrar datos');
          if (!Number(plan.multi_bodega) && Number(counts[0].bodegas) > 1) throw new Error('La empresa tiene varias bodegas activas; seleccione un plan multi-bodega sin borrar datos');
      const current = await companySubscription(companyId, tx);
      if (current.empresa.estado === 'cancelada') throw new Error('No se puede activar una empresa cancelada');
      if (current.licencia && current.licencia.plan_id !== plan.id) throw new Error('El cambio de plan debe realizarse al vencer el periodo actual; no se perderan dias pagados');
      const nowRows = await tx('SELECT UTC_TIMESTAMP() AS ahora');
      const now = new Date(nowRows[0].ahora);
      const paidEnd = current.licencia ? new Date(current.licencia.fin_at) : now;
      const start = paidEnd > now ? paidEnd : now;
      const end = addCalendarMonths(start, request.periodicidad === 'anual' ? 12 : request.meses);
      const license = await tx(`INSERT INTO licencias
        (empresa_id, plan_id, estado, fecha_inicio, fecha_fin, tipo_facturacion, auto_renovacion, monto, moneda,
         limite_usuarios, limite_productos, limite_facturas_mes, notas)
        VALUES (?, ?, 'activa', ?, ?, ?, 0, ?, 'COP', ?, ?, ?, ?)`,
      [companyId, plan.id, start, end, request.periodicidad, request.monto, plan.max_usuarios_por_empresa, plan.max_productos,
        plan.max_facturas_mes, JSON.stringify({ control_comercial_version: 2, solicitud_id: requestId })]);
      await tx('INSERT INTO licencias_vigencias (licencia_id, inicio_at, fin_at) VALUES (?, ?, ?)', [license.insertId, start, end]);
      await tx(`INSERT INTO pagos_licencias
        (licencia_id, empresa_id, plan_id, monto, moneda, tipo, metodo_pago, estado, referencia_pago, datos_pago,
         periodo_inicio, periodo_fin, fecha_pago, descripcion)
        VALUES (?, ?, ?, ?, 'COP', ?, 'manual', 'exitoso', ?, ?, ?, ?, UTC_TIMESTAMP(), ?)`,
      [license.insertId, companyId, plan.id, request.monto, request.periodicidad, reference,
        JSON.stringify({ solicitud_id: requestId, confirmado_por: (req as any).user.id }), start, end, 'Pago manual confirmado por Super Admin']);
      await tx(`UPDATE solicitudes_suscripcion SET estado = 'aprobada', referencia = ?, confirmada_por = ?,
        confirmada_at = UTC_TIMESTAMP(), licencia_id = ? WHERE id = ?`, [reference, (req as any).user.id, license.insertId, requestId]);
      await tx("UPDATE empresas SET estado = 'activa', plan_id = ? WHERE id = ?", [plan.id, companyId]);
      await tx(`INSERT INTO licencias_eventos (empresa_id, licencia_id, evento, descripcion, datos)
        VALUES (?, ?, 'pago_manual_confirmado', 'Pago recibido y licencia emitida', ?)`,
      [companyId, license.insertId, JSON.stringify({ solicitud_id: requestId, actor_id: (req as any).user.id, referencia: reference, inicio: start, fin: end })]);
      return { licencia_id: license.insertId, fecha_inicio: start, fecha_fin: end };
    });
    return res.json({ success: true, message: 'Pago confirmado y licencia emitida', data: result });
  } catch (error) { return fail(res, error); }
};

export const rejectSubscriptionRequest = async (req: Request, res: Response) => {
  await query(`UPDATE solicitudes_suscripcion SET estado = 'rechazada', observaciones = ?, confirmada_por = ?,
    confirmada_at = UTC_TIMESTAMP() WHERE id = ? AND estado = 'pendiente'`,
  [String(req.body.motivo || 'Pago no confirmado').slice(0, 1000), (req as any).user.id, Number(req.params.id)]);
  return res.json({ success: true, message: 'Solicitud rechazada; no se emitio una licencia' });
};

export const requirePaymentWorkflow = (_req: Request, res: Response) => res.status(409).json({
  success: false, message: 'Use Suscripciones y confirme una solicitud con referencia de pago real. No se emiten ni eliminan licencias desde el CRUD anterior.'
});