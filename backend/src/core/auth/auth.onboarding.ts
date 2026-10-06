import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
import { normalizeAuthEmail, protectAuthValue, validAuthPassword, validMfaCode } from './auth.security';
import { authMailConfigured, authPublicUrl, sendAuthMail } from './auth.mail';
import { recordLegalAcceptance } from './legal.service';
import { consumeMfaProof } from './auth.mfa';

const genericRecovery = { success: true, message: 'Si la cuenta es elegible, recibira un correo con las instrucciones.' };
type Query = (sql: string, params?: any[]) => Promise<any>;

export async function createAccessChallenge(userId: number, email: string, type: 'invitacion' | 'recuperacion', actorId: number | null) {
  if (!await authMailConfigured()) throw Object.assign(new Error('Configure el correo de acceso antes de enviar invitaciones'), { status: 503 });
  const token = crypto.randomBytes(32).toString('hex');
  const code = crypto.randomInt(100000, 1000000).toString();
  const id = crypto.randomUUID();
  await withTransaction(async tx => {
    await tx('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [userId]);
    const pending = await tx(`SELECT id FROM auth_desafios WHERE usuario_id = ? AND tipo = ?
      AND created_at > UTC_TIMESTAMP() - INTERVAL 1 HOUR`, [userId, type]);
    if (pending.length >= 5) throw Object.assign(new Error('Limite de envios alcanzado. Intente mas tarde.'), { status: 429 });
    await tx('UPDATE auth_desafios SET consumido_at = UTC_TIMESTAMP() WHERE usuario_id = ? AND tipo = ? AND consumido_at IS NULL', [userId, type]);
    await tx(`INSERT INTO auth_desafios
      (id, usuario_id, tipo, email, token_hash, codigo_hash, expira_at, codigo_expira_at, ultimo_envio_at, creado_por)
      VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP() + INTERVAL 24 HOUR,
        UTC_TIMESTAMP() + INTERVAL 10 MINUTE, UTC_TIMESTAMP(), ?)`,
    [id, userId, type, email, protectAuthValue(token), protectAuthValue(`${id}:${code}`), actorId]);
    await tx('INSERT INTO acceso_auditoria (usuario_id, actor_id, accion, datos) VALUES (?, ?, ?, ?)',
      [userId, actorId, type, JSON.stringify({ email_destino: email })]);
  });
  const link = `${authPublicUrl()}/activar-cuenta.html#${token}`;
  try {
    await sendAuthMail(email, type === 'invitacion' ? 'Kore Inventory: confirme su cuenta' : 'Kore Inventory: recuperacion de acceso',
      `Abra ${link}\n\nCodigo: ${code}\nEl codigo vence en 10 minutos y el enlace en 24 horas. Puede solicitar otro codigo desde el enlace.\nSi no reconoce esta solicitud, ignore este correo. No comparta el codigo.`);
    return { enviado: true };
  } catch {
    return { enviado: false, message: 'La invitacion quedo pendiente; el correo no pudo enviarse. Revise SMTP y vuelva a enviar.' };
  }
}

export const resendAccessCode = async (req: Request, res: Response) => {
  try {
    if (typeof req.body.token !== 'string' || !/^[a-f0-9]{64}$/.test(req.body.token)) throw new Error('Enlace no valido');
    const code = crypto.randomInt(100000, 1000000).toString();
    const challenge = await withTransaction(async tx => {
      const rows = await tx('SELECT * FROM auth_desafios WHERE token_hash = ? FOR UPDATE', [protectAuthValue(req.body.token)]);
      const row = rows[0];
      if (!row || row.consumido_at || new Date(row.expira_at).getTime() <= Date.now() || row.envios >= 5 ||
          new Date(row.ultimo_envio_at).getTime() > Date.now() - 60000) throw new Error('Enlace no disponible o limite de envios alcanzado');
      await tx(`UPDATE auth_desafios SET codigo_hash = ?, codigo_expira_at = UTC_TIMESTAMP() + INTERVAL 10 MINUTE,
        intentos = 0, envios = envios + 1, ultimo_envio_at = UTC_TIMESTAMP() WHERE id = ?`, [protectAuthValue(`${row.id}:${code}`), row.id]);
      return row;
    });
    await sendAuthMail(challenge.email, 'Kore Inventory: nuevo codigo', `Codigo: ${code}\nVence en 10 minutos. No comparta este codigo.`);
    return res.json({ success: true, message: 'Codigo enviado' });
  } catch (error: any) {
    return res.status(error.status || 400).json({ success: false, message: 'No se pudo enviar el codigo. Espere un minuto o solicite una nueva invitacion al administrador.' });
  }
};

export const accessChallengeInfo = async (req: Request, res: Response) => {
  try {
    const token = req.body.token;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new Error('Enlace no valido');
    const rows = await query(`SELECT tipo, email FROM auth_desafios WHERE token_hash = ?
      AND consumido_at IS NULL AND expira_at > UTC_TIMESTAMP()`, [protectAuthValue(token)]);
    if (!rows.length) throw new Error('Enlace no disponible');
    return res.json({ success: true, data: rows[0] });
  } catch { return res.status(400).json({ success: false, message: 'Enlace vencido o no disponible' }); }
};

async function startApprovedTrials(tx: Query, userId: number, userType: string) {
  if (userType === 'super_admin') return;
  const companies = await tx(`SELECT e.id, e.plan_id, s.es_nueva, s.trial_utilizado
    FROM empresas e JOIN empresas_suscripcion s ON s.empresa_id = e.id
    JOIN usuario_empresa ue ON ue.empresa_id = e.id AND ue.usuario_id = ? AND ue.activo = 1
    WHERE s.es_nueva = 1 AND s.trial_utilizado = 0 AND e.estado = 'trial'
    AND (? = 'admin_empresa' OR EXISTS (SELECT 1 FROM usuario_rol ur JOIN roles r ON r.id = ur.rol_id
      WHERE ur.usuario_id = ? AND ur.empresa_id = e.id AND r.activo = 1 AND r.es_admin = 1))
    ORDER BY e.id FOR UPDATE`, [userId, userType, userId]);
  for (const company of companies) {
    await tx(`UPDATE empresas_suscripcion SET trial_inicio_at = UTC_TIMESTAMP(),
      trial_fin_at = UTC_TIMESTAMP() + INTERVAL 30 DAY, trial_utilizado = 1 WHERE empresa_id = ? AND trial_utilizado = 0`, [company.id]);
    await tx(`UPDATE empresas e JOIN empresas_suscripcion s ON s.empresa_id = e.id
      SET e.fecha_inicio_trial = DATE(s.trial_inicio_at), e.fecha_fin_trial = DATE(s.trial_fin_at) WHERE e.id = ?`, [company.id]);
    await tx(`INSERT INTO licencias_eventos (empresa_id, evento, descripcion, datos)
      VALUES (?, 'trial_iniciado', 'Prueba unica de 30 dias iniciada al verificar administrador', ?)`, [company.id, JSON.stringify({ usuario_id: userId })]);
  }
}

export const completeAccessChallenge = async (req: Request, res: Response) => {
  try {
    if (typeof req.body.token !== 'string' || !/^[a-f0-9]{64}$/.test(req.body.token) ||
        typeof req.body.codigo !== 'string' || !/^\d{6}$/.test(req.body.codigo) || !validAuthPassword(req.body.password)) {
      return res.status(400).json({ success: false, message: 'Revise el codigo y la contrasena: minimo 15 caracteres y maximo 72 bytes' });
    }
    const hashed = await bcrypt.hash(req.body.password, 12);
    const outcome = await withTransaction(async tx => {
      const rows = await tx('SELECT * FROM auth_desafios WHERE token_hash = ? FOR UPDATE', [protectAuthValue(req.body.token)]);
      const row = rows[0];
      if (!row || row.consumido_at || row.intentos >= 5 || new Date(row.expira_at).getTime() <= Date.now() || new Date(row.codigo_expira_at).getTime() <= Date.now()) return false;
      if (protectAuthValue(`${row.id}:${req.body.codigo}`) !== row.codigo_hash) {
        await tx('UPDATE auth_desafios SET intentos = intentos + 1 WHERE id = ?', [row.id]);
        return false;
      }
      const users = await tx(`SELECT u.*, s.estado, s.mfa_secret, s.mfa_ultimo_paso FROM usuarios u
        JOIN usuarios_seguridad s ON s.usuario_id = u.id WHERE u.id = ? FOR UPDATE`, [row.usuario_id]);
      const user = users[0];
      if (!user || !user.activo || user.estado === 'suspendido') return false;
      if (row.tipo === 'recuperacion' && (user.estado !== 'verificado' || user.email !== row.email)) return false;
      if (!await consumeMfaProof(tx, user, req.body.codigo_mfa)) {
        await tx('UPDATE auth_desafios SET intentos = intentos + 1 WHERE id = ?', [row.id]);
        return false;
      }
      await recordLegalAcceptance(tx, req, user.id, user.empresa_id_default || null);
      await tx(`UPDATE usuarios SET email = ?, password = ?, email_verificado = 1,
        email_verificado_at = UTC_TIMESTAMP(), intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?`, [row.email, hashed, user.id]);
      await tx(`UPDATE usuarios_seguridad SET estado = 'verificado', email_verificado_at = UTC_TIMESTAMP(),
        version_sesion = version_sesion + 1, correo_pendiente = NULL, mfa_ultimo_paso = ? WHERE usuario_id = ?`,
      [user.mfa_secret ? Math.floor(Date.now() / 30000) : null, user.id]);
      await tx('UPDATE auth_sesiones SET revocada_at = UTC_TIMESTAMP() WHERE usuario_id = ? AND revocada_at IS NULL', [user.id]);
      await tx('UPDATE auth_desafios SET consumido_at = UTC_TIMESTAMP() WHERE usuario_id = ? AND consumido_at IS NULL', [user.id]);
      await tx('INSERT INTO acceso_auditoria (usuario_id, actor_id, accion, datos) VALUES (?, ?, ?, ?)',
        [user.id, row.creado_por, row.tipo === 'invitacion' ? 'correo_verificado' : 'password_recuperada', JSON.stringify({ correo_anterior: user.email, correo_verificado: row.email })]);
      if (row.tipo === 'invitacion') await startApprovedTrials(tx, user.id, user.tipo_usuario);
      return true;
    });
    if (!outcome) return res.status(400).json({ success: false, message: 'Codigo o enlace no disponible. Verifique tambien el codigo MFA si su cuenta lo tiene activo.' });
    return res.json({ success: true, message: 'Cuenta confirmada. Inicie sesion con su correo y nueva contrasena.' });
  } catch (error: any) {
    return res.status(error.status || 400).json({ success: false, message: error.code === 'ER_DUP_ENTRY' ? 'El correo ya pertenece a otra cuenta' : error.code ? 'No se pudo confirmar la cuenta' : error.message || 'No se pudo confirmar la cuenta' });
  }
};

export const requestPasswordRecovery = async (req: Request, res: Response) => {
  try {
    const email = normalizeAuthEmail(req.body.email);
    if (email && await authMailConfigured()) {
      const users = await query(`SELECT u.id FROM usuarios u JOIN usuarios_seguridad s ON s.usuario_id = u.id
        WHERE u.email = ? AND u.activo = 1 AND s.estado = 'verificado' AND s.email_verificado_at IS NOT NULL`, [email]);
      if (users.length) void createAccessChallenge(users[0].id, email, 'recuperacion', null).catch((): void => {});
    }
  } catch { }
  return res.json(genericRecovery);
};