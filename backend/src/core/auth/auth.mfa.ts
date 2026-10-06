import { protectAuthValue, validMfaCode } from './auth.security';

type Query = (sql: string, params?: any[]) => Promise<any>;

export async function consumeMfaProof(tx: Query, user: any, code: unknown): Promise<boolean> {
  if (!user.mfa_secret) return true;
  if (validMfaCode(code, user.mfa_secret, user.mfa_ultimo_paso)) return true;
  if (typeof code !== 'string' || !/^[a-f0-9]{16}$/.test(code)) return false;
  const hash = protectAuthValue(`mfa-backup:${user.id}:${code}`);
  const rows = await tx('SELECT codigo_hash FROM auth_mfa_respaldo WHERE usuario_id = ? AND codigo_hash = ? AND usado_at IS NULL FOR UPDATE', [user.id, hash]);
  if (!rows.length) return false;
  await tx('UPDATE auth_mfa_respaldo SET usado_at = UTC_TIMESTAMP() WHERE usuario_id = ? AND codigo_hash = ?', [user.id, hash]);
  return true;
}