import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { query, withTransaction } from '../../shared/database';
import { normalizeAuthEmail, protectAuthValue } from './auth.security';

export const authIpLimit = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos. Intente mas tarde.' }
});

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