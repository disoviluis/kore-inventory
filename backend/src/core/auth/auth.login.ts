import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../../shared/database';
import { normalizeAuthEmail, validMfaCode } from './auth.security';
import { issueSession } from './auth.sessions';
import { needsLegalAcceptance } from './legal.service';
import { consumeMfaProof } from './auth.mfa';

const dummyPassword = bcrypt.hash('not-a-user-password', 12);

export const secureLogin = async (req: Request, res: Response) => {
  try {
    const email = normalizeAuthEmail(req.body?.email);
    const password = req.body?.password;
    if (!email || typeof password !== 'string' || !password || Buffer.byteLength(password) > 1024) {
      return res.status(400).json({ success: false, message: 'Email y contrasena validos son requeridos' });
    }
    const usuario = await withTransaction(async tx => {
      const users = await tx(`SELECT u.*, s.estado, s.version_sesion, s.mfa_secret, s.mfa_ultimo_paso, s.mfa_obligatorio
        FROM usuarios u JOIN usuarios_seguridad s ON s.usuario_id = u.id
        WHERE u.email = ? AND (u.rol_id IS NULL OR EXISTS
          (SELECT 1 FROM roles r WHERE r.id = u.rol_id AND r.activo = 1 AND r.nivel >= u.nivel_privilegio))
        LIMIT 1 FOR UPDATE`, [email]);
      const user = users[0];
      const passwordValid = await bcrypt.compare(password, user?.password || await dummyPassword);
      if (!user || Number(user.activo) !== 1 || ['invitado', 'suspendido'].includes(user.estado)) return null;
      if (user.bloqueado_hasta && new Date(user.bloqueado_hasta).getTime() > Date.now()) return null;
      if (user.bloqueado_hasta) user.intentos_fallidos = 0;
      const mfaValid = passwordValid && await consumeMfaProof(tx, user, req.body.codigo_mfa);
      if (!passwordValid || !mfaValid) {
        const attempts = Number(user.intentos_fallidos || 0) + 1;
        await tx(`UPDATE usuarios SET intentos_fallidos = ?,
          bloqueado_hasta = IF(? >= 5, UTC_TIMESTAMP() + INTERVAL 15 MINUTE, NULL) WHERE id = ?`,
        [attempts, attempts, user.id]);
        return null;
      }
      await tx('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?', [user.id]);
      if (bcrypt.getRounds(user.password) < 12) await tx('UPDATE usuarios SET password = ? WHERE id = ?', [await bcrypt.hash(password, 12), user.id]);
      if (user.mfa_secret) await tx('UPDATE usuarios_seguridad SET mfa_ultimo_paso = ? WHERE usuario_id = ?', [Math.floor(Date.now() / 30000), user.id]);
      return user;
    });
    if (!usuario) return res.status(401).json({ success: false, message: 'No fue posible iniciar sesion. Revise sus credenciales o contacte al administrador.' });
    const data = await issueSession(req, res, usuario);
    const pendingLegal = usuario.estado === 'verificado' && await needsLegalAcceptance(usuario.id);
    const pendingMfa = (usuario.mfa_obligatorio || usuario.estado === 'verificado' && ['super_admin', 'admin_empresa'].includes(usuario.tipo_usuario)) && !usuario.mfa_secret;
    return res.json({ success: true, message: 'Sesion iniciada', data: { ...data, requiere_seguridad: pendingLegal || pendingMfa } });
  } catch {
    return res.status(503).json({ success: false, message: 'El acceso no esta disponible. Contacte al administrador.' });
  }
};

export const sessionLogout = async (req: Request, res: Response) => {
  const { clearSession } = await import('./auth.sessions');
  await query('UPDATE auth_sesiones SET revocada_at = UTC_TIMESTAMP() WHERE id = ?', [(req as any).authSessionId]);
  clearSession(res);
  return res.json({ success: true, message: 'Sesion cerrada' });
};