import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../../shared/database';
import { normalizeAuthEmail, protectAuthValue } from './auth.security';

const authIpWindowSeconds = 15 * 60;
const authIpRequestLimit = 60;

export const authIpLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = protectAuthValue(`auth-ip-limit:${ip}`);
    const result = await withTransaction(async tx => {
      await tx('INSERT IGNORE INTO auth_limites (clave, inicio_at, intentos) VALUES (?, UTC_TIMESTAMP(), 0)', [key]);
      const rows = await tx(
        `SELECT intentos,
          inicio_at <= UTC_TIMESTAMP() - INTERVAL 15 MINUTE AS ventana_vencida,
          GREATEST(0, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), inicio_at + INTERVAL 15 MINUTE)) AS reinicio_en
         FROM auth_limites WHERE clave = ? FOR UPDATE`,
        [key]
      );
      const expired = Number(rows[0].ventana_vencida) === 1;
      const attempts = expired ? 0 : Number(rows[0].intentos);
      const allowed = attempts < authIpRequestLimit;
      const retryAfter = expired ? authIpWindowSeconds : Number(rows[0].reinicio_en);

      if (allowed) {
        await tx(
          `UPDATE auth_limites SET inicio_at = IF(?, UTC_TIMESTAMP(), inicio_at),
            intentos = IF(?, 1, intentos + 1) WHERE clave = ?`,
          [expired, expired, key]
        );
      }
      return { allowed, remaining: Math.max(0, authIpRequestLimit - attempts - 1), retryAfter };
    });

    const resetAfter = Math.max(0, result.retryAfter);
    res.setHeader('RateLimit-Limit', String(authIpRequestLimit));
    res.setHeader('RateLimit-Remaining', String(result.allowed ? result.remaining : 0));
    res.setHeader('RateLimit-Reset', String(resetAfter));
    if (!result.allowed) {
      res.setHeader('Retry-After', String(resetAfter));
      res.status(429).json({ success: false, message: 'Demasiados intentos. Intente mas tarde.' });
      return;
    }
    next();
  } catch {
    res.status(503).json({ success: false, message: 'No se pudo validar el acceso. Intente mas tarde.' });
  }
};

export const authAccountLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subject = normalizeAuthEmail(req.body?.email) || String(req.body?.token || '').slice(0, 256) || req.ip || 'unknown';
    const key = protectAuthValue(`limit:${subject}`);
    const allowed = await withTransaction(async tx => {
      await tx(`INSERT IGNORE INTO auth_limites (clave, inicio_at, intentos) VALUES (?, UTC_TIMESTAMP(), 0)`, [key]);
      const rows = await tx('SELECT intentos, inicio_at FROM auth_limites WHERE clave = ? FOR UPDATE', [key]);
      const fresh = new Date(rows[0].inicio_at).getTime() <= Date.now() - 15 * 60 * 1000;
      if (!fresh && rows[0].intentos >= 20) return false;
      await tx(`UPDATE auth_limites SET inicio_at = IF(?, UTC_TIMESTAMP(), inicio_at),
        intentos = IF(?, 1, intentos + 1) WHERE clave = ?`, [fresh, fresh, key]);
      return true;
    });
    if (!allowed) { res.status(429).json({ success: false, message: 'Demasiados intentos. Intente mas tarde.' }); return; }
    next();
  } catch {
    res.status(503).json({ success: false, message: 'No se pudo validar el acceso. Intente mas tarde.' });
  }
};

export async function cleanupAuthRecords() {
  await query('DELETE FROM auth_limites WHERE inicio_at < UTC_TIMESTAMP() - INTERVAL 1 DAY');
  await query('DELETE FROM auth_sesiones WHERE expira_at < UTC_TIMESTAMP() - INTERVAL 1 DAY');
  await query('DELETE FROM auth_desafios WHERE expira_at < UTC_TIMESTAMP() - INTERVAL 30 DAY');
}