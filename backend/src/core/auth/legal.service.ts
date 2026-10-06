import { Request } from 'express';
import { query } from '../../shared/database';

type Query = (sql: string, params?: any[]) => Promise<any>;

export const currentLegalDocuments = async (tx: Query = query) => tx(`
  SELECT d.* FROM documentos_legales d
  WHERE d.id IN (SELECT MAX(id) FROM documentos_legales
    WHERE publicado_at IS NOT NULL AND publicado_at <= UTC_TIMESTAMP() GROUP BY tipo)
  ORDER BY d.tipo`);

export async function needsLegalAcceptance(userId: number): Promise<boolean> {
  const rows = await query(`SELECT d.id FROM documentos_legales d
    WHERE d.id IN (SELECT MAX(id) FROM documentos_legales
      WHERE publicado_at IS NOT NULL AND publicado_at <= UTC_TIMESTAMP() GROUP BY tipo)
    AND NOT EXISTS (SELECT 1 FROM aceptaciones_legales a WHERE a.usuario_id = ? AND a.documento_id = d.id AND a.hash = d.hash)`, [userId]);
  return rows.length > 0;
}

export async function recordLegalAcceptance(tx: Query, req: Request, userId: number, companyId: number | null) {
  const documents = await currentLegalDocuments(tx);
  if (!['terminos', 'privacidad'].every(type => documents.some((document: any) => document.tipo === type))) {
    throw Object.assign(new Error('El administrador debe publicar los terminos y la politica de privacidad antes de activar cuentas'), { status: 503 });
  }
  const accepted = req.body.aceptaciones;
  if (!Array.isArray(accepted) || !documents.every((document: any) =>
    accepted.some((entry: any) => Number(entry?.id) === document.id && entry?.hash === document.hash))) {
    throw Object.assign(new Error('Debe aceptar las versiones vigentes de los documentos legales'), { status: 428 });
  }
  for (const document of documents) {
    await tx(`INSERT IGNORE INTO aceptaciones_legales
      (usuario_id, documento_id, empresa_id, hash, ip, agente, aceptado_at)
      VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
    [userId, document.id, companyId, document.hash, req.ip || null, String(req.headers['user-agent'] || '').slice(0, 255)]);
  }
}