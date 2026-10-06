import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { getAuthSecret, protectAuthValue } from './auth.security';

export const sessionCookie = 'kore_session';
export const csrfCookie = 'kore_csrf';
export const sessionDuration = 8 * 60 * 60 * 1000;

export const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || new URL(process.env.APP_PUBLIC_URL || 'https://kinventoryservices.com').protocol === 'https:',
  sameSite: 'strict' as const,
  path: '/'
});

export async function issueSession(req: Request, res: Response, usuario: any) {
  const id = crypto.randomUUID();
  const csrf = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + sessionDuration);
  const version = Number(usuario.version_sesion);
  await query(`INSERT INTO auth_sesiones
    (id, usuario_id, version_sesion, csrf_hash, expira_at) VALUES (?, ?, ?, ?, ?)`,
  [id, usuario.id, version, protectAuthValue(csrf), expires]);
  const token = jwt.sign({ id: usuario.id, jti: id, version }, getAuthSecret(), {
    algorithm: 'HS256', expiresIn: '8h', issuer: 'kore-inventory', audience: 'kore-web'
  });
  res.cookie(sessionCookie, token, { ...cookieOptions(), expires });
  res.cookie(csrfCookie, csrf, { ...cookieOptions(), httpOnly: false, expires });
  await query('UPDATE usuarios SET ultimo_login = UTC_TIMESTAMP(), ultimo_ip = ? WHERE id = ?', [req.ip || null, usuario.id]);
  return { token: 'cookie', usuario: {
    id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido, email: usuario.email,
    tipo_usuario: usuario.tipo_usuario, empresa_id_default: usuario.empresa_id_default,
    empresa_id: usuario.empresa_id_default, bodega_id: usuario.bodega_id || null,
    estado_verificacion: usuario.estado, mfa_activo: Boolean(usuario.mfa_secret)
  } };
}

export async function revokeUserSessions(usuarioId: number) {
  await query('UPDATE usuarios_seguridad SET version_sesion = version_sesion + 1 WHERE usuario_id = ?', [usuarioId]);
  await query('UPDATE auth_sesiones SET revocada_at = UTC_TIMESTAMP() WHERE usuario_id = ? AND revocada_at IS NULL', [usuarioId]);
}

export function clearSession(res: Response) {
  res.clearCookie(sessionCookie, cookieOptions());
  res.clearCookie(csrfCookie, { ...cookieOptions(), httpOnly: false });
}