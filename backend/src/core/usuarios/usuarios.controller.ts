/**
 * =================================
 * KORE INVENTORY - USUARIOS CONTROLLER
 * Gestión de Usuarios para Admin de Empresa
 * =================================
 */

import { Request, Response } from 'express';
import pool from '../../shared/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import bcrypt from 'bcryptjs';

// ============================================
// TIPOS
// ============================================

interface Usuario extends RowDataPacket {
  id: number;
  nombre: string;
  apellido: string | null;
  email: string;
  tipo_usuario: 'super_admin' | 'admin_empresa' | 'usuario' | 'soporte';
  activo: boolean;
  email_verificado: boolean;
  telefono: string | null;
  ultimo_login: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// OBTENER USUARIOS DE LA EMPRESA
// ============================================

export const getUsuariosEmpresa = async (req: Request, res: Response): Promise<void> => {
  try {
    const { empresa_id } = req.query;
    const usuario = (req as any).user;

    if (!usuario) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    let empresaIdFinal: number;

    // super_admin puede especificar empresa_id, admin_empresa usa la suya
    if (usuario.tipo_usuario === 'super_admin') {
      empresaIdFinal = empresa_id ? Number(empresa_id) : usuario.empresa_id;
    } else {
      // admin_empresa y otros siempre usan su propia empresa_id
      empresaIdFinal = usuario.empresa_id;
    }

    if (!empresaIdFinal) {
      res.status(400).json({
        success: false,
        message: 'empresa_id es requerido'
      });
      return;
    }

    console.log(`[USUARIOS] Usuario tipo: ${usuario.tipo_usuario}, empresa_id: ${empresaIdFinal}, query empresa_id: ${empresa_id}`);

    const query = `
      SELECT 
        u.id,
        u.nombre,
        u.apellido,
        u.email,
        u.tipo_usuario,
        u.telefono,
        u.activo,
        u.email_verificado,
        u.ultimo_login,
        u.created_at,
        u.updated_at,
        GROUP_CONCAT(DISTINCT r.id) as roles_ids,
        GROUP_CONCAT(DISTINCT r.nombre) as roles_nombres
      FROM usuarios u
      INNER JOIN usuario_empresa ue ON u.id = ue.usuario_id
      LEFT JOIN usuario_rol ur ON u.id = ur.usuario_id AND ur.empresa_id = ?
      LEFT JOIN roles r ON ur.rol_id = r.id
      WHERE ue.empresa_id = ?
        AND ue.activo = 1
        AND u.tipo_usuario != 'super_admin'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `;

    const [usuarios] = await pool.execute<Usuario[]>(query, [empresaIdFinal, empresaIdFinal]);

    // Transformar roles_ids y roles_nombres en arrays
    const usuariosConRoles = usuarios.map(u => ({
      ...u,
      roles_ids: u.roles_ids ? u.roles_ids.split(',').map(Number) : [],
      roles_nombres: u.roles_nombres ? u.roles_nombres.split(',') : []
    }));

    res.json({
      success: true,
      data: usuariosConRoles
    });
  } catch (error: any) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios',
      error: error.message
    });
  }
};

// ============================================
// OBTENER USUARIO POR ID
// ============================================

export const getUsuarioById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const usuario = (req as any).user;

    // Obtener información del usuario
    const [usuarios] = await pool.execute<Usuario[]>(
      `SELECT 
        u.*,
        GROUP_CONCAT(DISTINCT ue.empresa_id) as empresas_ids,
        GROUP_CONCAT(DISTINCT e.nombre) as empresas_nombres
      FROM usuarios u
      LEFT JOIN usuario_empresa ue ON u.id = ue.usuario_id AND ue.activo = 1
      LEFT JOIN empresas e ON ue.empresa_id = e.id
      WHERE u.id = ?
      GROUP BY u.id`,
      [id]
    );

    if (usuarios.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    const usuarioData = usuarios[0];

    // Verificar permisos: admin_empresa solo puede ver usuarios de su empresa
    if (usuario.tipo_usuario !== 'super_admin') {
      const empresasIds = usuarioData.empresas_ids ? 
        usuarioData.empresas_ids.split(',').map(Number) : [];
      
      if (!empresasIds.includes(usuario.empresa_id)) {
        res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver este usuario'
        });
        return;
      }
    }

    // Obtener roles asignados
    const [roles] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        ur.rol_id,
        ur.empresa_id,
        r.nombre as rol_nombre,
        e.nombre as empresa_nombre
      FROM usuario_rol ur
      INNER JOIN roles r ON ur.rol_id = r.id
      INNER JOIN empresas e ON ur.empresa_id = e.id
      WHERE ur.usuario_id = ?`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...usuarioData,
        empresas_ids: usuarioData.empresas_ids ? 
          usuarioData.empresas_ids.split(',').map(Number) : [],
        empresas_nombres: usuarioData.empresas_nombres ? 
          usuarioData.empresas_nombres.split(',') : [],
        roles
      }
    });
  } catch (error: any) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuario',
      error: error.message
    });
  }
};

// ============================================
// CREAR USUARIO
// ============================================

export const createUsuario = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const usuario = (req as any).user;
    const {
      nombre,
      apellido,
      email,
      password,
      telefono,
      tipo_usuario = 'usuario',
      activo = true,
      roles_ids = [] // Array de rol_ids a asignar
    } = req.body;

    // Validaciones
    if (!nombre || !email || !password) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: 'Nombre, email y contraseña son obligatorios'
      });
      return;
    }

    // Solo super_admin puede crear admin_empresa
    if (tipo_usuario === 'admin_empresa' && usuario.tipo_usuario !== 'super_admin') {
      await connection.rollback();
      res.status(403).json({
        success: false,
        message: 'No tienes permiso para crear administradores de empresa'
      });
      return;
    }

    // Validar email único
    const [existentes] = await connection.execute<RowDataPacket[]>(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );

    if (existentes.length > 0) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
      return;
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO usuarios (
        nombre,
        apellido,
        email,
        password,
        telefono,
        tipo_usuario,
        activo,
        email_verificado,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [nombre, apellido || null, email, hashedPassword, telefono || null, tipo_usuario, activo ? 1 : 0, usuario.id]
    );

    const usuarioId = result.insertId;

    // Asignar a la empresa del admin
    const empresaId = usuario.tipo_usuario === 'super_admin' && req.body.empresa_id
      ? req.body.empresa_id
      : usuario.empresa_id;

    if (empresaId) {
      await connection.execute(
        `INSERT INTO usuario_empresa (usuario_id, empresa_id, activo, created_at)
         VALUES (?, ?, 1, NOW())`,
        [usuarioId, empresaId]
      );

      // Asignar roles si se proporcionaron
      if (roles_ids && Array.isArray(roles_ids) && roles_ids.length > 0) {
        for (const rolId of roles_ids) {
          await connection.execute(
            `INSERT INTO usuario_rol (usuario_id, rol_id, empresa_id, created_by)
             VALUES (?, ?, ?, ?)`,
            [usuarioId, rolId, empresaId, usuario.id]
          );
        }
      }
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: {
        id: usuarioId,
        nombre,
        email
      }
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error al crear usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ============================================
// ACTUALIZAR USUARIO
// ============================================

export const updateUsuario = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const usuario = (req as any).user;
    const {
      nombre,
      apellido,
      telefono,
      activo,
      password,
      roles_ids
    } = req.body;

    // Verificar que el usuario existe y pertenece a la empresa
    const [usuarios] = await connection.execute<Usuario[]>(
      `SELECT u.*, ue.empresa_id
       FROM usuarios u
       INNER JOIN usuario_empresa ue ON u.id = ue.usuario_id
       WHERE u.id = ? AND ue.empresa_id = ?`,
      [id, usuario.empresa_id]
    );

    if (usuarios.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado o no pertenece a tu empresa'
      });
      return;
    }

    // No permitir editar super_admin
    if (usuarios[0].tipo_usuario === 'super_admin' && usuario.tipo_usuario !== 'super_admin') {
      await connection.rollback();
      res.status(403).json({
        success: false,
        message: 'No tienes permiso para editar este usuario'
      });
      return;
    }

    // Actualizar información básica
    const updates: string[] = [];
    const params: any[] = [];

    if (nombre !== undefined) {
      updates.push('nombre = ?');
      params.push(nombre);
    }

    if (apellido !== undefined) {
      updates.push('apellido = ?');
      params.push(apellido || null);
    }

    if (telefono !== undefined) {
      updates.push('telefono = ?');
      params.push(telefono || null);
    }

    if (activo !== undefined) {
      updates.push('activo = ?');
      params.push(activo ? 1 : 0);
    }

    if (password && password.trim()) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      params.push(hashedPassword);
    }

    if (updates.length > 0) {
      params.push(id);
      await connection.execute(
        `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    // Actualizar roles si se proporcionaron
    if (roles_ids !== undefined && Array.isArray(roles_ids)) {
      // Eliminar roles actuales de esta empresa
      await connection.execute(
        'DELETE FROM usuario_rol WHERE usuario_id = ? AND empresa_id = ?',
        [id, usuario.empresa_id]
      );

      // Insertar nuevos roles
      if (roles_ids.length > 0) {
        for (const rolId of roles_ids) {
          await connection.execute(
            `INSERT INTO usuario_rol (usuario_id, rol_id, empresa_id, created_by)
             VALUES (?, ?, ?, ?)`,
            [id, rolId, usuario.empresa_id, usuario.id]
          );
        }
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente'
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ============================================
// DESACTIVAR USUARIO
// ============================================

export const deleteUsuario = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const usuario = (req as any).user;

    // Verificar que el usuario existe y pertenece a la empresa
    const [usuarios] = await pool.execute<Usuario[]>(
      `SELECT u.*, ue.empresa_id
       FROM usuarios u
       INNER JOIN usuario_empresa ue ON u.id = ue.usuario_id
       WHERE u.id = ? AND ue.empresa_id = ?`,
      [id, usuario.empresa_id]
    );

    if (usuarios.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }

    // No permitir desactivar super_admin ni admin_empresa
    if (['super_admin', 'admin_empresa'].includes(usuarios[0].tipo_usuario)) {
      res.status(403).json({
        success: false,
        message: 'No se pueden desactivar administradores'
      });
      return;
    }

    // Desactivar usuario (soft delete)
    await pool.execute(
      'UPDATE usuarios SET activo = 0 WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Usuario desactivado exitosamente'
    });
  } catch (error: any) {
    console.error('Error al desactivar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desactivar usuario',
      error: error.message
    });
  }
};
