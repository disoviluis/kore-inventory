import { query, withTransaction } from '../../shared/database';
import { authMailConfigured, authPublicUrl, sendAuthMail } from './auth.mail';
import { cleanupAuthRecords } from './auth.limits';

export async function runSubscriptionMaintenance() {
  await cleanupAuthRecords();
  if (!await authMailConfigured()) return { enviados: 0, fallidos: 0, correo_configurado: false };
  const companies = await query(`SELECT e.id, e.nombre,
    COALESCE((SELECT MAX(COALESCE(v.fin_at, DATE_ADD(l.fecha_fin, INTERVAL 1 DAY))) FROM licencias l
      LEFT JOIN licencias_vigencias v ON v.licencia_id = l.id
      WHERE l.empresa_id = e.id AND l.estado = 'activa' AND l.monto > 0), s.trial_fin_at) AS fin_at
    FROM empresas e JOIN empresas_suscripcion s ON s.empresa_id = e.id
    WHERE e.estado IN ('trial','activa')`);
  let sent = 0;
  let failed = 0;
  for (const company of companies) {
    if (!company.fin_at) continue;
    const expiration = new Date(company.fin_at);
    const days = Math.ceil((expiration.getTime() - Date.now()) / 86400000);
    if (![7, 3, 1, 0].includes(days)) continue;
    const users = await query(`SELECT DISTINCT u.id, u.email FROM usuarios u
      JOIN usuarios_seguridad s ON s.usuario_id = u.id JOIN usuario_empresa ue ON ue.usuario_id = u.id
      WHERE ue.empresa_id = ? AND ue.activo = 1 AND u.activo = 1 AND s.estado = 'verificado'
      AND (u.tipo_usuario = 'admin_empresa' OR EXISTS (SELECT 1 FROM usuario_rol ur JOIN roles r ON r.id = ur.rol_id
        WHERE ur.usuario_id = u.id AND ur.empresa_id = ue.empresa_id AND r.es_admin = 1 AND r.activo = 1))`, [company.id]);
    for (const user of users) {
      const claimed = await withTransaction(async tx => {
        const inserted = await tx(`INSERT IGNORE INTO licencias_avisos (empresa_id, usuario_id, vencimiento_at, dias, actualizado_at)
          VALUES (?, ?, ?, ?, UTC_TIMESTAMP())`, [company.id, user.id, expiration, days]);
        if (inserted.affectedRows) return true;
        const rows = await tx(`SELECT * FROM licencias_avisos WHERE empresa_id = ? AND usuario_id = ? AND vencimiento_at = ? AND dias = ? FOR UPDATE`, [company.id, user.id, expiration, days]);
        if (rows[0].estado === 'enviado' || new Date(rows[0].actualizado_at).getTime() > Date.now() - 3600000) return false;
        await tx(`UPDATE licencias_avisos SET actualizado_at = UTC_TIMESTAMP() WHERE empresa_id = ? AND usuario_id = ? AND vencimiento_at = ? AND dias = ?`, [company.id, user.id, expiration, days]);
        return true;
      });
      if (!claimed) continue;
      try {
        await sendAuthMail(user.email, 'Kore Inventory: vencimiento de suscripcion',
          `${company.nombre}: su suscripcion vence el ${expiration.toISOString()}.\nRevise su plan en ${authPublicUrl()}/suscripcion.html?empresa_id=${company.id}\nNo se realizara un cobro automatico.`);
        await query(`UPDATE licencias_avisos SET estado = 'enviado', actualizado_at = UTC_TIMESTAMP()
          WHERE empresa_id = ? AND usuario_id = ? AND vencimiento_at = ? AND dias = ?`, [company.id, user.id, expiration, days]);
        sent++;
      } catch { failed++; }
    }
  }
  return { enviados: sent, fallidos: failed, correo_configurado: true };
}