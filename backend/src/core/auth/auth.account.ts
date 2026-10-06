import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
import { encryptAuthSecret, validMfaCode, protectAuthValue } from './auth.security';
import { currentLegalDocuments, recordLegalAcceptance } from './legal.service';
import { revokeUserSessions, clearSession } from './auth.sessions';
import { consumeMfaProof } from './auth.mfa';

export const getAccountSecurity = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const acceptances = await query('SELECT documento_id FROM aceptaciones_legales WHERE usuario_id = ?', [user.id]);
  return res.json({ success: true, data: { usuario: user, documentos: await currentLegalDocuments(),
    aceptados: acceptances.map((row: any) => row.documento_id) } });
};

export const acceptAccountDocuments = async (req: Request, res: Response) => {
  try {
    await withTransaction(tx => recordLegalAcceptance(tx, req, (req as any).user.id, (req as any).user.empresa_id || null));
    return res.json({ success: true, message: 'Aceptacion registrada' });
  } catch (error: any) { return res.status(error.status || 400).json({ success: false, message: error.message }); }
};

export const setupAccountMfa = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const rows = await query(`SELECT u.password, u.email, s.mfa_secret FROM usuarios u
      JOIN usuarios_seguridad s ON s.usuario_id = u.id WHERE u.id = ?`, [userId]);
    if (typeof req.body.password !== 'string' || !await bcrypt.compare(req.body.password, rows[0].password) || rows[0].mfa_secret) {
      return res.status(400).json({ success: false, message: 'No fue posible preparar MFA; revise su contrasena o su configuracion actual' });
    }
    const secret = authenticator.generateSecret();
    await query('UPDATE usuarios_seguridad SET mfa_pendiente = ? WHERE usuario_id = ? AND mfa_secret IS NULL', [encryptAuthSecret(secret), userId]);
    const uri = authenticator.keyuri(rows[0].email, 'Kore Inventory', secret);
    return res.json({ success: true, data: { secret, qr: await QRCode.toDataURL(uri) } });
  } catch { return res.status(400).json({ success: false, message: 'No se pudo preparar MFA' }); }
};

export const confirmAccountMfa = async (req: Request, res: Response) => {
  try {
    const backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(8).toString('hex'));
    await withTransaction(async tx => {
      const rows = await tx('SELECT * FROM usuarios_seguridad WHERE usuario_id = ? FOR UPDATE', [(req as any).user.id]);
      const row = rows[0];
      if (!row.mfa_pendiente || row.mfa_secret || !validMfaCode(req.body.codigo, row.mfa_pendiente, null)) throw new Error('Codigo MFA no valido');
      await tx(`UPDATE usuarios_seguridad SET mfa_secret = mfa_pendiente, mfa_pendiente = NULL,
        mfa_obligatorio = IF(?, 1, mfa_obligatorio),
        mfa_ultimo_paso = ?, version_sesion = version_sesion + 1 WHERE usuario_id = ?`,
      [['super_admin', 'admin_empresa'].includes((req as any).user.tipo_usuario), Math.floor(Date.now() / 30000), row.usuario_id]);
      await tx('DELETE FROM auth_mfa_respaldo WHERE usuario_id = ?', [row.usuario_id]);
      for (const code of backupCodes) await tx('INSERT INTO auth_mfa_respaldo (usuario_id, codigo_hash) VALUES (?, ?)', [row.usuario_id, protectAuthValue(`mfa-backup:${row.usuario_id}:${code}`)]);
      await tx('INSERT INTO acceso_auditoria (usuario_id, actor_id, accion) VALUES (?, ?, ?)', [row.usuario_id, row.usuario_id, 'mfa_activado']);
    });
    clearSession(res);
    return res.json({ success: true, message: 'MFA activado', data: { codigos_respaldo: backupCodes } });
  } catch (error: any) { return res.status(400).json({ success: false, message: error.message }); }
};

export const revokeAccountSessions = async (req: Request, res: Response) => {
  await revokeUserSessions((req as any).user.id);
  clearSession(res);
  return res.json({ success: true, message: 'Todas sus sesiones fueron cerradas' });
};

export const getLegalDocuments = async (_req: Request, res: Response) => {
  return res.json({ success: true, data: await currentLegalDocuments() });
};

export const getLegalAdministration = async (_req: Request, res: Response) => {
  const rows = await query('SELECT * FROM documentos_legales ORDER BY id DESC LIMIT 100');
  return res.json({ success: true, data: rows });
};

export const publishLegalDocument = async (req: Request, res: Response) => {
  try {
    const { tipo, version, titulo, contenido, operador_nombre, operador_nit, operador_contacto } = req.body;
    if (!['terminos', 'privacidad'].includes(tipo) ||
      ![version, titulo, contenido, operador_nombre, operador_nit, operador_contacto].every(value => typeof value === 'string' && value.trim()) ||
      version.length > 60 || titulo.length > 150 || contenido.length > 100000 || operador_nombre.length > 200 || operador_nit.length > 40 || operador_contacto.length > 254) {
      throw new Error('Complete el documento, su version y la identidad y contacto del operador');
    }
    if (req.body.revision_legal_confirmada !== true) throw new Error('Confirme la revision juridica antes de publicar');
    const hash = crypto.createHash('sha256').update(JSON.stringify({ tipo, version, titulo, contenido, operador_nombre, operador_nit, operador_contacto })).digest('hex');
    const result = await query(`INSERT INTO documentos_legales
      (tipo, version, titulo, contenido, hash, operador_nombre, operador_nit, operador_contacto, publicado_at, creado_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?)`,
    [tipo, version, titulo, contenido, hash, operador_nombre, operador_nit, operador_contacto, (req as any).user.id]);
    return res.status(201).json({ success: true, message: 'Version publicada e inmutable', data: { id: result.insertId, hash } });
  } catch (error: any) { return res.status(400).json({ success: false, message: error.code === 'ER_DUP_ENTRY' ? 'Esa version ya existe; publique una nueva' : error.message }); }
};

export const resetAccountMfa = async (req: Request, res: Response) => {
  try {
    await withTransaction(async tx => {
      const rows = await tx(`SELECT u.id, u.password, s.* FROM usuarios u JOIN usuarios_seguridad s ON s.usuario_id = u.id WHERE u.id = ? FOR UPDATE`, [(req as any).user.id]);
      const user = rows[0];
      if (typeof req.body.password !== 'string' || !await bcrypt.compare(req.body.password, user.password) || !user.mfa_secret || !await consumeMfaProof(tx, user, req.body.codigo)) throw new Error('Contrasena o codigo MFA no valido');
      await tx(`UPDATE usuarios_seguridad SET mfa_secret = NULL, mfa_pendiente = NULL,
        mfa_ultimo_paso = NULL, version_sesion = version_sesion + 1 WHERE usuario_id = ?`, [user.id]);
      await tx('DELETE FROM auth_mfa_respaldo WHERE usuario_id = ?', [user.id]);
      await tx('INSERT INTO acceso_auditoria (usuario_id, actor_id, accion) VALUES (?, ?, ?)', [user.id, user.id, 'mfa_reconfiguracion']);
    });
    clearSession(res);
    return res.json({ success: true, message: 'Autenticador retirado. Configure el nuevo dispositivo al iniciar sesion.' });
  } catch { return res.status(400).json({ success: false, message: 'No se pudo reconfigurar MFA' }); }
};