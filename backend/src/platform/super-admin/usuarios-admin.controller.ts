import { Request, Response } from 'express';
import pool from '../../shared/database';
import logger from '../../shared/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import bcrypt from 'bcryptjs';

/**
 * ========================================
 * MÓDULO: SUPER ADMIN - GESTIÓN DE USUARIOS
 * ========================================
 * CRUD de usuarios, asignación de roles y empresas
 */

/**
 * GET /api/super-admin/usuarios
 * Lista todos los usuarios del sistema
 */
export const getUsuarios = async (req: Request, res: Response) => {
  try {
    const { tipo_usuario, activo, empresa_id, search, limit = 50, offset = 0 } = req.query;

    let whereConditions: string[] = [];
    let params: any[] = [];

    if (tipo_usuario) {
      whereConditions.push('u.tipo_usuario = ?');
      params.push(tipo_usuario);
    }

    if (activo !== undefined) {
      whereConditions.push('u.activo = ?');
      params.push(activo === 'true' || activo === '1' ? 1 : 0);
    }

    if (empresa_id) {
      whereConditions.push('ue.empresa_id = ?');
      params.push(empresa_id);
    }

    if (search) {
      whereConditions.push('(u.nombre LIKE ? OR u.apellido LIKE ? OR u.email LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const query = `
      SELECT 
        u.id,
        u.nombre,
        u.apellido,
        u.email,
        u.tipo_usuario,
        u.activo,
        u.email_verificado,
        u.ultimo_login,
        u.created_at,
        GROUP_CONCAT(DISTINCT e.nombre SEPARATOR ', ') as empresas,
        GROUP_CONCAT(DISTINCT r.nombre SEPARATOR ', ') as roles
      FROM usuarios u
      LEFT JOIN usuario_empresa ue ON u.id = ue.usuario_id
      LEFT JOIN empresas e ON ue.empresa_id = e.id
      LEFT JOIN usuario_rol ur ON u.id = ur.usuario_id
      LEFT JOIN roles r ON ur.rol_id = r.id
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(Number(limit), Number(offset));

    const [usuarios] = await pool.query<RowDataPacket[]>(query, params);

    // Contar total
    const countQuery = `
      SELECT COUNT(DISTINCT u.id) as total 
      FROM usuarios u
      LEFT JOIN usuario_empresa ue ON u.id = ue.usuario_id
      ${whereClause}
    `;
    const [countResult] = await pool.query<RowDataPacket[]>(
      countQuery, 
      params.slice(0, -2)
    );

    res.json({
      success: true,
      data: usuarios,
      pagination: {
        total: countResult[0].total,
        limit: Number(limit),
        offset: Number(offset)
      }
    });

  } catch (error: any) {
    logger.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios',
      error: error.message
    });
  }
};

/**
 * GET /api/super-admin/usuarios/:id
 * Obtiene detalle completo de un usuario
 */
export const getUsuarioById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [usuarios] = await pool.query<RowDataPacket[]>(`
      SELECT 
        u.*,
        u.password as _password
      FROM usuarios u
      WHERE u.id = ?
    `, [id]);

    if (usuarios.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const usuario = usuarios[0];
    delete usuario._password; // No enviar password

    // Obtener empresas asignadas
    const [empresas] = await pool.query<RowDataPacket[]>(`
      SELECT 
        e.id,
        e.nombre,
        e.estado,
        ue.activo as asignacion_activa,
        ue.created_at as fecha_asignacion
      FROM usuario_empresa ue
      INNER JOIN empresas e ON ue.empresa_id = e.id
      WHERE ue.usuario_id = ?
    `, [id]);

    // Obtener roles por empresa
    const [roles] = await pool.query<RowDataPacket[]>(`
      SELECT 
        r.id,
        r.nombre,
        r.tipo,
        r.es_admin,
        ur.empresa_id,
        e.nombre as empresa_nombre
      FROM usuario_rol ur
      INNER JOIN roles r ON ur.rol_id = r.id
      LEFT JOIN empresas e ON ur.empresa_id = e.id
      WHERE ur.usuario_id = ?
    `, [id]);

    return res.json({
      success: true,
      data: {
        ...usuario,
        empresas,
        roles
      }
    });

  } catch (error: any) {
    logger.error('Error al obtener detalle de usuario:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener detalle de usuario',
      error: error.message
    });
  }
};

/**
 * POST /api/super-admin/usuarios
 * Crea un nuevo usuario y lo asigna a empresa(s)
 */
export const createUsuario = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const {
      nombre,
      apellido,
      email,
      password,
      tipo_usuario = 'usuario',
      activo = true,
      email_verificado = false,
      empresas_ids = [], // Array de IDs de empresas
      roles_por_empresa = {} // Objeto: { empresa_id: rol_id }
    } = req.body;

    // Validar email único
    const [existingUsers] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      throw new Error('El email ya está registrado');
    }

    // Hashear password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const [result] = await connection.query<ResultSetHeader>(`
      INSERT INTO usuarios (
        nombre, apellido, email, password, tipo_usuario, 
        activo, email_verificado
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [nombre, apellido, email, hashedPassword, tipo_usuario, activo ? 1 : 0, email_verificado ? 1 : 0]);

    const usuarioId = result.insertId;

    // Asignar empresas
    if (empresas_ids.length > 0) {
      for (const empresaId of empresas_ids) {
        await connection.query(`
          INSERT INTO usuario_empresa (usuario_id, empresa_id, activo)
          VALUES (?, ?, 1)
        `, [usuarioId, empresaId]);

        // Asignar rol si se especificó
        if (roles_por_empresa[empresaId]) {
          await connection.query(`
            INSERT INTO usuario_rol (usuario_id, rol_id, empresa_id)
            VALUES (?, ?, ?)
          `, [usuarioId, roles_por_empresa[empresaId], empresaId]);
        }
      }
    }

    // Auditoría
    await connection.query(`
      INSERT INTO auditoria_logs (
        usuario_id, accion, tabla, registro_id, modulo
      ) VALUES (?, 'crear', 'usuarios', ?, 'super-admin')
    `, [req.body.usuario_id || null, usuarioId]);

    await connection.commit();

    logger.info(`Usuario creado exitosamente: ${email} (ID: ${usuarioId})`);

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: {
        id: usuarioId,
        email,
        nombre,
        apellido
      }
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al crear usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * PUT /api/super-admin/usuarios/:id
 * Actualiza datos de un usuario
 */
export const updateUsuario = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      apellido,
      email,
      tipo_usuario,
      activo,
      email_verificado
    } = req.body;

    // Verificar si el usuario existe
    const [usuarios] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM usuarios WHERE id = ?',
      [id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Si se cambió el email, verificar que no exista
    if (email !== usuarios[0].email) {
      const [existingUsers] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM usuarios WHERE email = ? AND id != ?',
        [email, id]
      );

      if (existingUsers.length > 0) {
        throw new Error('El email ya está registrado por otro usuario');
      }
    }

    // Actualizar usuario
    await pool.query(`
      UPDATE usuarios SET
        nombre = ?,
        apellido = ?,
        email = ?,
        tipo_usuario = ?,
        activo = ?,
        email_verificado = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [nombre, apellido, email, tipo_usuario, activo ? 1 : 0, email_verificado ? 1 : 0, id]);

    // Auditoría
    await pool.query(`
      INSERT INTO auditoria_logs (
        usuario_id, accion, tabla, registro_id, modulo
      ) VALUES (?, 'actualizar', 'usuarios', ?, 'super-admin')
    `, [req.body.usuario_id || null, id]);

    logger.info(`Usuario actualizado: ${email} (ID: ${id})`);

    return res.json({
      success: true,
      message: 'Usuario actualizado exitosamente'
    });

  } catch (error: any) {
    logger.error('Error al actualizar usuario:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario',
      error: error.message
    });
  }
};

/**
 * PUT /api/super-admin/usuarios/:id/password
 * Cambia la contraseña de un usuario
 */
export const cambiarPasswordUsuario = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      'UPDATE usuarios SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, id]
    );

    // Auditoría
    await pool.query(`
      INSERT INTO auditoria_logs (
        usuario_id, accion, tabla, registro_id, modulo
      ) VALUES (?, 'cambiar_password', 'usuarios', ?, 'super-admin')
    `, [req.body.usuario_id || null, id]);

    logger.info(`Contraseña cambiada para usuario ID: ${id}`);

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error: any) {
    logger.error('Error al cambiar contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar contraseña',
      error: error.message
    });
  }
};

/**
 * POST /api/super-admin/usuarios/:id/empresas
 * Asigna un usuario a una empresa
 */
export const asignarUsuarioEmpresa = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { empresa_id, rol_id } = req.body;

    // Verificar si ya está asignado
    const [existing] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ?',
      [id, empresa_id]
    );

    if (existing.length > 0) {
      throw new Error('El usuario ya está asignado a esta empresa');
    }

    // Asignar usuario a empresa
    await connection.query(
      'INSERT INTO usuario_empresa (usuario_id, empresa_id, activo) VALUES (?, ?, 1)',
      [id, empresa_id]
    );

    // Asignar rol si se especificó
    if (rol_id) {
      await connection.query(
        'INSERT INTO usuario_rol (usuario_id, rol_id, empresa_id) VALUES (?, ?, ?)',
        [id, rol_id, empresa_id]
      );
    }

    // Auditoría
    await connection.query(`
      INSERT INTO auditoria_logs (
        usuario_id, accion, tabla, registro_id, empresa_id, modulo
      ) VALUES (?, 'asignar_empresa', 'usuario_empresa', ?, ?, 'super-admin')
    `, [req.body.usuario_id || null, id, empresa_id]);

    await connection.commit();

    logger.info(`Usuario ${id} asignado a empresa ${empresa_id}`);

    res.json({
      success: true,
      message: 'Usuario asignado a empresa exitosamente'
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al asignar usuario a empresa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar usuario a empresa',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * DELETE /api/super-admin/usuarios/:id/empresas/:empresaId
 * Desasigna un usuario de una empresa
 */
export const desasignarUsuarioEmpresa = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id, empresaId } = req.params;

    // Eliminar asignación
    await connection.query(
      'DELETE FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    // Eliminar roles de esa empresa
    await connection.query(
      'DELETE FROM usuario_rol WHERE usuario_id = ? AND empresa_id = ?',
      [id, empresaId]
    );

    // Auditoría
    await connection.query(`
      INSERT INTO auditoria_logs (
        usuario_id, accion, tabla, registro_id, empresa_id, modulo
      ) VALUES (?, 'desasignar_empresa', 'usuario_empresa', ?, ?, 'super-admin')
    `, [req.body.usuario_id || null, id, empresaId]);

    await connection.commit();

    logger.info(`Usuario ${id} desasignado de empresa ${empresaId}`);

    res.json({
      success: true,
      message: 'Usuario desasignado de empresa exitosamente'
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al desasignar usuario de empresa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desasignar usuario de empresa',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * DELETE /api/super-admin/usuarios/:id
 * Elimina un usuario (solo si no tiene actividad)
 */
export const deleteUsuario = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // Verificar si es super admin (no se puede eliminar)
    const [usuarios] = await connection.query<RowDataPacket[]>(
      'SELECT tipo_usuario FROM usuarios WHERE id = ?',
      [id]
    );

    if (usuarios.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    if (usuarios[0].tipo_usuario === 'super_admin') {
      throw new Error('No se puede eliminar un usuario Super Admin');
    }

    // Eliminar registros relacionados
    await connection.query('DELETE FROM usuario_empresa WHERE usuario_id = ?', [id]);
    await connection.query('DELETE FROM usuario_rol WHERE usuario_id = ?', [id]);
    
    // Eliminar usuario
    await connection.query('DELETE FROM usuarios WHERE id = ?', [id]);

    // Auditoría
    await connection.query(`
      INSERT INTO auditoria_logs (
        usuario_id, accion, tabla, registro_id, modulo
      ) VALUES (?, 'eliminar', 'usuarios', ?, 'super-admin')
    `, [req.body.usuario_id || null, id]);

    await connection.commit();

    logger.info(`Usuario eliminado: ID ${id}`);

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al eliminar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario',
      error: error.message
    });
  } finally {
    connection.release();
  }
};
