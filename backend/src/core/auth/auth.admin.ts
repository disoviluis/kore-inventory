import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
import { normalizeAuthEmail } from './auth.security';
import { authMailConfigured } from './auth.mail';
import { createAccessChallenge } from './auth.onboarding';

const isOperator = (req: Request) => (req as any).user?.tipo_usuario === 'super_admin';
const failure = (res: Response, error: any) => res.status(error.status || (error.code && error.code !== 'ER_DUP_ENTRY' ? 503 : 400)).json({ success: false,
  message: error.code === 'ER_DUP_ENTRY' ? 'Ese correo ya esta registrado o pendiente de verificacion' : error.code ? 'No se pudo completar la operacion' : error.message || 'No se pudo completar la operacion' });

export const getAccessMigration = async (req: Request, res: Response) => {
  try {
    const company = Number(req.query.empresa_id) || null;
    const rows = await query(`SELECT u.id, u.nombre, u.apellido, u.email, u.activo, u.tipo_usuario,
      s.estado, s.email_verificado_at, s.correo_pendiente, s.mfa_secret IS NOT NULL AS mfa_activo,
      GROUP_CONCAT(DISTINCT e.nombre SEPARATOR ', ') AS empresas
      FROM usuarios u JOIN usuarios_seguridad s ON s.usuario_id = u.id
      LEFT JOIN usuario_empresa ue ON ue.usuario_id = u.id AND ue.activo = 1
      LEFT JOIN empresas e ON e.id = ue.empresa_id
      WHERE (? IS NULL OR ue.empresa_id = ?) GROUP BY u.id ORDER BY u.id DESC LIMIT 500`, [company, company]);
    return res.json({ success: true, data: rows, correo_configurado: await authMailConfigured() });
  } catch (error) { return failure(res, error); }
};

export const inviteExistingUser = async (req: Request, res: Response) => {
  try {
    if (!isOperator(req)) throw Object.assign(new Error('Solo Super Admin puede aprobar la migracion'), { status: 403 });
    if (req.body.misma_persona_confirmada !== true) throw new Error('Confirme que el correo corresponde a la misma persona; para cuentas compartidas cree un usuario nuevo');
    const email = normalizeAuthEmail(req.body.email);
    if (!email || email.length > 100) throw new Error('Correo no valido (maximo 100 caracteres)');
    if (!await authMailConfigured()) throw Object.assign(new Error('Configure primero el correo de acceso'), { status: 503 });
    const userId = Number(req.params.id);
    const user = await withTransaction(async tx => {
      const users = await tx(`SELECT u.*, s.estado FROM usuarios u JOIN usuarios_seguridad s ON s.usuario_id = u.id
        WHERE u.id = ? FOR UPDATE`, [userId]);
      if (!users.length) throw new Error('Usuario no encontrado');
      const target = users[0];
      if (!target.activo || target.estado === 'suspendido') throw new Error('Reactive la cuenta explicitamente antes de invitarla');
      const duplicate = await tx('SELECT id FROM usuarios WHERE email = ? AND id <> ?', [email, userId]);
      if (duplicate.length) throw new Error('El correo pertenece a otro usuario; no se puede transferir su historial');
      if (req.body.bloquear_hasta_verificar === true && target.tipo_usuario === 'super_admin') throw new Error('No se puede bloquear al Super Admin durante su migracion');
      await tx(`UPDATE usuarios_seguridad SET correo_pendiente = ?, actualizado_por = ?,
        estado = IF(?, 'invitado', estado), version_sesion = version_sesion + IF(?, 1, 0)
        WHERE usuario_id = ?`, [email, (req as any).user.id, req.body.bloquear_hasta_verificar === true, req.body.bloquear_hasta_verificar === true, userId]);
      return target;
    });
    const delivery = await createAccessChallenge(user.id, email, 'invitacion', (req as any).user.id);
    return res.json({ success: true, message: delivery.enviado ? 'Invitacion enviada; el historial y las licencias se conservan' : delivery.message, data: delivery });
  } catch (error) { return failure(res, error); }
};

export const createInvitedUser = async (req: Request, res: Response) => {
  try {
    if (!isOperator(req)) throw Object.assign(new Error('Las altas deben ser aprobadas por Super Admin'), { status: 403 });
    const email = normalizeAuthEmail(req.body.email);
    const nombre = String(req.body.nombre || '').trim();
    const apellido = String(req.body.apellido || '').trim();
    if (!email || email.length > 100 || !nombre || nombre.length > 100 || apellido.length > 100) throw new Error('Nombre o correo no valido');
    if (!await authMailConfigured()) throw Object.assign(new Error('Configure primero el correo de acceso'), { status: 503 });
    const companies = [...new Set((Array.isArray(req.body.empresas_ids) ? req.body.empresas_ids : [req.body.empresa_id]).map(Number))] as number[];
    if (!companies.length || companies.length > 50 || companies.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error('Seleccione al menos una empresa valida');
    const actorId = (req as any).user.id;
    const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    const id = await withTransaction(async tx => {
      let type = req.body.tipo_usuario || 'usuario';
      if (!['usuario', 'admin_empresa', 'soporte', 'super_admin'].includes(type)) throw new Error('Tipo de usuario no valido');
      let level = { usuario: 50, admin_empresa: 95, soporte: 80, super_admin: 100 }[type as 'usuario'];
      if (req.body.rol_id) {
        const roles = await tx('SELECT * FROM roles WHERE id = ? AND empresa_id IS NULL AND activo = 1', [Number(req.body.rol_id)]);
        if (!roles.length) throw new Error('Rol global no valido');
        level = Number(roles[0].nivel);
        type = level >= 100 ? 'super_admin' : level >= 80 ? 'admin_empresa' : level >= 50 ? 'soporte' : 'usuario';
      }
      for (const companyId of companies.sort((left, right) => left - right)) {
        const rows = await tx(`SELECT e.id, p.max_usuarios_por_empresa FROM empresas e
          LEFT JOIN planes p ON p.id = e.plan_id WHERE e.id = ? FOR UPDATE`, [companyId]);
        if (!rows.length) throw new Error('Empresa no encontrada');
        const counts = await tx(`SELECT COUNT(*) AS total FROM usuario_empresa ue JOIN usuarios u ON u.id = ue.usuario_id
          WHERE ue.empresa_id = ? AND ue.activo = 1 AND u.activo = 1 AND u.tipo_usuario <> 'super_admin'`, [companyId]);
        if (type !== 'super_admin' && rows[0].max_usuarios_por_empresa !== null && counts[0].total >= Number(rows[0].max_usuarios_por_empresa)) throw new Error('Se alcanzo el limite de usuarios del plan');
      }
      const result = await tx(`INSERT INTO usuarios
        (nombre, apellido, email, password, tipo_usuario, nivel_privilegio, rol_id, empresa_id_default, activo, email_verificado, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)`,
      [nombre, apellido || null, email, randomPassword, type, level, req.body.rol_id || null, companies[0], actorId]);
      await tx(`INSERT INTO usuarios_seguridad (usuario_id, estado, correo_pendiente, actualizado_por)
        VALUES (?, 'invitado', ?, ?)`, [result.insertId, email, actorId]);
      for (const companyId of companies) {
        await tx('INSERT INTO usuario_empresa (usuario_id, empresa_id, activo) VALUES (?, ?, 1)', [result.insertId, companyId]);
        const companyRoles = req.body.roles_por_empresa?.[companyId] ? [req.body.roles_por_empresa[companyId]] : req.body.roles_ids || [];
        if (!Array.isArray(companyRoles) || companyRoles.length > 50) throw new Error('Roles no validos');
        for (const roleId of [...new Set(companyRoles.map(Number))]) {
          const roles = await tx('SELECT id FROM roles WHERE id = ? AND activo = 1 AND (empresa_id = ? OR empresa_id IS NULL)', [roleId, companyId]);
          if (!roles.length) throw new Error('El rol no pertenece a la empresa');
          await tx('INSERT INTO usuario_rol (usuario_id, rol_id, empresa_id, created_by) VALUES (?, ?, ?, ?)', [result.insertId, roleId, companyId, actorId]);
        }
      }
      const warehouseIds = Array.isArray(req.body.bodegas_ids) ? req.body.bodegas_ids : req.body.bodega_id ? [req.body.bodega_id] : [];
      if (warehouseIds.length > 50 || (warehouseIds.length && companies.length !== 1)) throw new Error('Bodegas no validas');
      for (const warehouseId of [...new Set(warehouseIds.map(Number))]) {
        const warehouses = await tx('SELECT id FROM bodegas WHERE id = ? AND empresa_id = ?', [warehouseId, companies[0]]);
        if (!warehouses.length) throw new Error('La bodega no pertenece a la empresa');
        await tx('INSERT INTO usuarios_bodegas (usuario_id, empresa_id, bodega_id) VALUES (?, ?, ?)', [result.insertId, companies[0], warehouseId]);
      }
      if (warehouseIds.length) await tx('UPDATE usuarios SET bodega_id = ? WHERE id = ?', [Number(warehouseIds[0]), result.insertId]);
      return result.insertId;
    });
    const delivery = await createAccessChallenge(id, email, 'invitacion', actorId);
    return res.status(201).json({ success: true, message: delivery.enviado ? 'Usuario invitado. Debe verificar su correo antes de acceder.' : delivery.message, data: { id, ...delivery } });
  } catch (error) { return failure(res, error); }
};

export const deactivateAccessUser = async (req: Request, res: Response) => {
  try {
    if (!isOperator(req)) throw Object.assign(new Error('Solo Super Admin puede retirar el acceso global'), { status: 403 });
    const userId = Number(req.params.id);
    await withTransaction(async tx => {
      const users = await tx('SELECT id, tipo_usuario FROM usuarios WHERE id = ? FOR UPDATE', [userId]);
      if (!users.length) throw new Error('Usuario no encontrado');
      if (users[0].tipo_usuario === 'super_admin') throw new Error('El Super Admin no puede desactivarse por esta operacion');
      await tx('UPDATE usuarios SET activo = 0 WHERE id = ?', [userId]);
      await tx(`UPDATE usuarios_seguridad SET estado = 'suspendido', version_sesion = version_sesion + 1,
        correo_pendiente = NULL, actualizado_por = ? WHERE usuario_id = ?`, [(req as any).user.id, userId]);
      await tx('UPDATE auth_sesiones SET revocada_at = UTC_TIMESTAMP() WHERE usuario_id = ?', [userId]);
      await tx('UPDATE auth_desafios SET consumido_at = UTC_TIMESTAMP() WHERE usuario_id = ? AND consumido_at IS NULL', [userId]);
      await tx('INSERT INTO acceso_auditoria (usuario_id, actor_id, accion) VALUES (?, ?, ?)', [userId, (req as any).user.id, 'acceso_desactivado']);
    });
    return res.json({ success: true, message: 'Acceso desactivado; historial y asignaciones conservados' });
  } catch (error) { return failure(res, error); }
};

export const reactivateAccessUser = async (req: Request, res: Response) => {
  try {
    await withTransaction(async tx => {
      const users = await tx('SELECT id, tipo_usuario FROM usuarios WHERE id = ? FOR UPDATE', [Number(req.params.id)]);
      if (!users.length) throw new Error('Usuario no encontrado');
      if (users[0].tipo_usuario === 'super_admin') throw new Error('El Super Admin no puede cambiarse por esta operacion');
      await tx('UPDATE usuarios SET activo = 1 WHERE id = ?', [Number(req.params.id)]);
      await tx(`UPDATE usuarios_seguridad SET estado = 'invitado', version_sesion = version_sesion + 1 WHERE usuario_id = ?`, [Number(req.params.id)]);
      await tx('INSERT INTO acceso_auditoria (usuario_id, actor_id, accion) VALUES (?, ?, ?)', [Number(req.params.id), (req as any).user.id, 'reactivacion_pendiente_verificacion']);
    });
    return res.json({ success: true, message: 'Cuenta habilitada para recibir una nueva invitacion; aun no puede iniciar sesion' });
  } catch (error) { return failure(res, error); }
};