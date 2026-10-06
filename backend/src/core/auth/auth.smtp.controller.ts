import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
import { loadAccessSmtpConfig, validateSmtpConfig, safeSmtpConfig, encryptedSmtpPassword, smtpMailbox, describeSmtpFailure } from './auth.smtp';
import { sendAuthMail } from './auth.mail';
import logger from '../../shared/logger';

export const getGlobalSmtp = async (_req: Request, res: Response) => {
  try {
    const config = await loadAccessSmtpConfig();
    const rows = await query('SELECT ultima_prueba_at, ultima_prueba_estado FROM auth_smtp_configuracion WHERE id = 1');
    return res.json({ success: true, data: { ...safeSmtpConfig(config), lastTestAt: rows[0]?.ultima_prueba_at || null,
      lastTestStatus: rows[0]?.ultima_prueba_estado || 'pendiente' } });
  } catch { return res.status(503).json({ success: false, message: 'No se pudo cargar SMTP. Revise la migracion y la clave de seguridad del servidor.' }); }
};

export const saveGlobalSmtp = async (req: Request, res: Response) => {
  try {
    const previous = await loadAccessSmtpConfig();
    const config = validateSmtpConfig(req.body, previous);
    if (!Number.isInteger(req.body.version) || req.body.version < 0) throw new Error('Version de configuracion no valida');
    const encrypted = encryptedSmtpPassword(config);
    await withTransaction(async tx => {
      const rows = await tx('SELECT version FROM auth_smtp_configuracion WHERE id = 1 FOR UPDATE');
      const currentVersion = Number(rows[0]?.version || 0);
      if (currentVersion !== req.body.version) throw Object.assign(new Error('Otro administrador cambio SMTP. Recargue antes de guardar.'), { status: 409 });
      const values = [config.host, config.port, config.security, config.user, encrypted, config.fromEmail,
        config.fromName, config.enabled, (req as any).user.id];
      if (rows.length) {
        await tx(`UPDATE auth_smtp_configuracion SET host = ?, port = ?, seguridad = ?, usuario = ?, secreto_cifrado = ?,
          remitente_email = ?, remitente_nombre = ?, activo = ?, actualizado_por = ?, version = version + 1,
          ultima_prueba_at = NULL, ultima_prueba_estado = 'pendiente' WHERE id = 1`, values);
      } else {
        await tx(`INSERT INTO auth_smtp_configuracion
          (host, port, seguridad, usuario, secreto_cifrado, remitente_email, remitente_nombre, activo, actualizado_por, id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, values);
      }
      await tx('INSERT INTO acceso_auditoria (usuario_id, actor_id, accion, datos) VALUES (?, ?, ?, ?)',
        [(req as any).user.id, (req as any).user.id, 'smtp_global_actualizado',
          JSON.stringify({ host: config.host, port: config.port, remitente: config.fromEmail, activo: config.enabled, version: currentVersion + 1 })]);
    });
    return res.json({ success: true, message: 'Configuracion SMTP guardada. El siguiente envio usara estos datos; no se requiere reinicio.' });
  } catch (error: any) {
    return res.status(error.status || (error.code === 'ER_DUP_ENTRY' ? 409 : error.code ? 503 : 400)).json({ success: false,
      message: error.code ? 'No se pudo guardar SMTP. Recargue y revise la configuracion del servidor.' : error.message });
  }
};

export const testGlobalSmtp = async (req: Request, res: Response) => {
  let version: number | null = null;
  try {
    const config = await loadAccessSmtpConfig();
    if (!config || !config.enabled) return res.status(400).json({ success: false, message: 'Guarde y active SMTP antes de enviar una prueba.' });
    if (req.body.version !== config.version) return res.status(409).json({ success: false, message: 'Recargue SMTP antes de probar la version vigente.' });
    const destination = smtpMailbox(req.body.email);
    if (!destination) return res.status(400).json({ success: false, message: 'Correo de prueba no valido' });
    version = config.source === 'global' ? config.version : null;
    await sendAuthMail(destination, 'Kore Inventory: prueba de correo de acceso',
      'Este mensaje confirma que el servidor SMTP acepto un envio de prueba de Kore Inventory. No contiene invitaciones, codigos ni credenciales.', config);
    if (version !== null) await query(`UPDATE auth_smtp_configuracion SET ultima_prueba_at = UTC_TIMESTAMP(),
      ultima_prueba_estado = 'exitoso' WHERE id = 1 AND version = ?`, [version]);
    return res.json({ success: true, message: 'El servidor SMTP acepto el envio. Confirme la recepcion en el buzon de prueba y revise spam.' });
  } catch (error) {
    if (version !== null) {
      try { await query(`UPDATE auth_smtp_configuracion SET ultima_prueba_at = UTC_TIMESTAMP(), ultima_prueba_estado = 'fallido'
        WHERE id = 1 AND version = ?`, [version]); } catch { }
    }
    const failure = describeSmtpFailure(error);
    logger.warning(`Prueba SMTP fallida: ${failure.code}`);
    return res.status(502).json({ success: false, codigo: failure.code, message: failure.message });
  }
};