import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { runSubscriptionMaintenance } from '../../core/auth/subscription.job';
export { requirePaymentWorkflow as procesarRenovaciones } from '../../core/auth/subscription.controller';

export const procesarNotificaciones = async (_req: Request, res: Response) => {
  try { return res.json({ success: true, data: await runSubscriptionMaintenance() }); }
  catch { return res.status(503).json({ success: false, message: 'No se pudo completar la revision de suscripciones' }); }
};

export const getEstadoLicencias = async (_req: Request, res: Response) => {
  const rows = await query(`SELECT COUNT(*) AS total,
    SUM(l.estado = 'activa' AND COALESCE(v.fin_at, DATE_ADD(l.fecha_fin, INTERVAL 1 DAY)) > UTC_TIMESTAMP()) AS activas,
    SUM(l.estado = 'vencida' OR (l.estado = 'activa' AND COALESCE(v.fin_at, DATE_ADD(l.fecha_fin, INTERVAL 1 DAY)) <= UTC_TIMESTAMP())) AS vencidas,
    SUM(l.estado = 'suspendida') AS suspendidas, SUM(l.estado = 'cancelada') AS canceladas,
    SUM(l.estado = 'activa' AND COALESCE(v.fin_at, DATE_ADD(l.fecha_fin, INTERVAL 1 DAY)) > UTC_TIMESTAMP()
      AND COALESCE(v.fin_at, DATE_ADD(l.fecha_fin, INTERVAL 1 DAY)) <= UTC_TIMESTAMP() + INTERVAL 7 DAY) AS proximas_vencer,
    0 AS con_auto_renovacion FROM licencias l LEFT JOIN licencias_vigencias v ON v.licencia_id = l.id`);
  return res.json({ success: true, data: rows[0] });
};

export const getHistorialLicencia = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const licenses = await query(`SELECT l.*, e.nombre AS empresa_nombre, p.nombre AS plan_nombre
    FROM licencias l JOIN empresas e ON e.id = l.empresa_id JOIN planes p ON p.id = l.plan_id WHERE l.id = ?`, [id]);
  if (!licenses.length) return res.status(404).json({ success: false, message: 'Licencia no encontrada' });
  const payments = await query('SELECT * FROM pagos_licencias WHERE licencia_id = ? ORDER BY fecha_pago DESC', [id]);
  const events = await query('SELECT * FROM licencias_eventos WHERE licencia_id = ? ORDER BY created_at DESC', [id]);
  return res.json({ success: true, data: { licencia: licenses[0], pagos: payments, eventos: events } });
};