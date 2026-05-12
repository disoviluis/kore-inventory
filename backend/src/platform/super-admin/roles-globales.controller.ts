import { Request, Response } from 'express';
import pool from '../../shared/database';
import logger from '../../shared/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * ========================================
 * MÓDULO: SUPER ADMIN - GESTIÓN DE ROLES GLOBALES
 * ========================================
 * Gestión de roles globales (empresa_id = NULL)
 * Solo accesible por super_admin
 */

/**
 * Obtener nivel de privilegio del usuario actual
 */
async function obtenerNivelUsuario(usuarioId: number): Promise<number> {
  const [result] = await pool.execute<RowDataPacket[]>(
    `SELECT nivel_privilegio FROM usuarios WHERE id = ?`,
    [usuarioId]
  );

  if (result.length === 0 || !result[0].nivel_privilegio) {
    const [roles] = await pool.execute<RowDataPacket[]>(
      `SELECT MAX(r.nivel) as max_nivel
       FROM usuario_rol ur
       INNER JOIN roles r ON ur.rol_id = r.id
       WHERE ur.usuario_id = ?`,
      [usuarioId]
    );
    return roles[0]?.max_nivel || 0;
  }

  return result[0].nivel_privilegio;
}

/**
 * Validar jerarquía de roles
 */
async function validarJerarquiaRol(
  usuario: any,
  nivelRol: number,
  operacion: 'crear' | 'editar' | 'eliminar'
): Promise<{ valid: boolean; message?: string }> {
  const nivelUsuario = await obtenerNivelUsuario(usuario.id);

  // Regla 1: Solo puedes crear/editar/eliminar roles de nivel menor al tuyo
  if (nivelRol >= nivelUsuario) {
    return {
      valid: false,
      message: `No puedes ${operacion} un rol de nivel igual o superior al tuyo (${nivelUsuario})`
    };
  }

  // Regla 2: Los roles globales deben estar entre 80 y 99
  if (nivelRol < 80 || nivelRol > 99) {
    return {
      valid: false,
      message: 'Los roles globales deben tener un nivel entre 80 y 99'
    };
  }

  return { valid: true };
}

/**
 * Sincronizar nivel_privilegio de usuarios con un rol específico
 */
async function sincronizarUsuariosConRol(connection: any, rolId: number): Promise<void> {
  const [usuariosConRol] = await connection.execute(
    'SELECT DISTINCT usuario_id FROM usuario_rol WHERE rol_id = ?',
    [rolId]
  ) as any[];

  for (const row of usuariosConRol) {
    await connection.execute(
      `UPDATE usuarios u
       SET nivel_privilegio = (
         SELECT MAX(r.nivel)
         FROM usuario_rol ur
         INNER JOIN roles r ON ur.rol_id = r.id
         WHERE ur.usuario_id = ?
       )
       WHERE u.id = ?`,
      [row.usuario_id, row.usuario_id]
    );
  }
}

/**
 * GET /api/super-admin/roles-globales
 * Lista roles globales (empresa_id = NULL)
 */
export const getRolesGlobales = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuario = (req as any).user;

    if (usuario.tipo_usuario !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Solo el Super Admin puede acceder a los roles globales'
      });
    }

    const [roles] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        r.id,
        r.nombre,
        r.descripcion,
        r.slug,
        r.tipo,
        r.nivel,
        r.es_admin,
        r.activo,
        r.created_at,
        r.updated_at,
        (SELECT COUNT(*) FROM usuario_rol WHERE rol_id = r.id) as usuarios_count
      FROM roles r
      WHERE r.empresa_id IS NULL
      ORDER BY r.nivel DESC, r.nombre ASC`
    );

    res.json({
      success: true,
      data: roles
    });

  } catch (error: any) {
    logger.error('Error al obtener roles globales:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener roles globales',
      error: error.message
    });
  }
};

/**
 * GET /api/super-admin/roles-globales/:id
 * Obtener un rol global por ID con sus permisos
 */
export const getRolGlobalById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const usuario = (req as any).user;

    if (usuario.tipo_usuario !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Solo el Super Admin puede acceder a los roles globales'
      });
    }

    // Obtener información del rol
    const [roles] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM roles WHERE id = ? AND empresa_id IS NULL`,
      [id]
    );

    if (roles.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Rol global no encontrado'
      });
    }

    const rol = roles[0];

    // Obtener permisos asignados al rol
    const [permisos] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        rp.permiso_id,
        p.codigo,
        p.modulo_id,
        m.nombre AS modulo_nombre,
        m.nombre_mostrar AS modulo_mostrar,
        p.accion_id,
        a.nombre AS accion_nombre,
        a.nombre_mostrar AS accion_mostrar
      FROM rol_permiso rp
      INNER JOIN permisos p ON rp.permiso_id = p.id
      INNER JOIN modulos m ON p.modulo_id = m.id
      INNER JOIN acciones a ON p.accion_id = a.id
      WHERE rp.rol_id = ?
        AND p.activo = 1
        AND m.activo = 1
        AND a.activo = 1
      ORDER BY m.orden ASC, m.nombre_mostrar ASC, a.nombre ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...rol,
        permisos
      }
    });

  } catch (error: any) {
    logger.error('Error al obtener rol global:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener rol global',
      error: error.message
    });
  }
};

/**
 * POST /api/super-admin/roles-globales
 * Crear un rol global
 */
export const createRolGlobal = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const usuario = (req as any).user;
    const { nombre, descripcion, nivel, permisos_ids } = req.body;

    if (usuario.tipo_usuario !== 'super_admin') {
      await connection.rollback();
      connection.release();
      res.status(403).json({
        success: false,
        message: 'Solo el Super Admin puede crear roles globales'
      });
    }

    // Validaciones básicas
    if (!nombre || !nombre.trim()) {
      await connection.rollback();
      connection.release();
      res.status(400).json({
        success: false,
        message: 'El nombre del rol es obligatorio'
      });
    }

    if (!nivel || nivel < 80 || nivel > 99) {
      await connection.rollback();
      connection.release();
      res.status(400).json({
        success: false,
        message: 'Los roles globales deben tener un nivel entre 80 y 99'
      });
    }

    // Validar jerarquía
    const validacion = await validarJerarquiaRol(usuario, nivel, 'crear');
    
    if (!validacion.valid) {
      await connection.rollback();
      connection.release();
      res.status(403).json({
        success: false,
        message: validacion.message
      });
    }

    // Validar que no exista un rol global con el mismo nombre
    const [existentes] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM roles WHERE nombre = ? AND empresa_id IS NULL`,
      [nombre.trim()]
    );

    if (existentes.length > 0) {
      await connection.rollback();
      connection.release();
      res.status(400).json({
        success: false,
        message: 'Ya existe un rol global con ese nombre'
      });
    }

    // Generar slug
    const slug = nombre.toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '_');

    // Crear el rol
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO roles (
        empresa_id,
        nombre,
        descripcion,
        slug,
        tipo,
        nivel,
        es_admin,
        activo,
        created_by
      ) VALUES (NULL, ?, ?, ?, 'sistema', ?, 0, 1, ?)`,
      [nombre.trim(), descripcion || null, slug, nivel, usuario.id]
    );

    const rolId = result.insertId;

    // Asignar permisos si se proporcionaron
    if (permisos_ids && Array.isArray(permisos_ids) && permisos_ids.length > 0) {
      const permisosValues = permisos_ids.map((permisoId: number) => [
        rolId,
        permisoId,
        usuario.id
      ]);

      await connection.query(
        `INSERT INTO rol_permiso (rol_id, permiso_id, created_by) VALUES ?`,
        [permisosValues]
      );
    }

    await connection.commit();

    logger.info(`Rol global creado: ${nombre} (nivel ${nivel}) por usuario ${usuario.id}`);

    res.status(201).json({
      success: true,
      message: 'Rol global creado exitosamente',
      data: {
        id: rolId,
        nombre,
        slug,
        nivel,
        permisos_count: permisos_ids?.length || 0
      }
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al crear rol global:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear rol global',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * PUT /api/super-admin/roles-globales/:id
 * Actualizar un rol global
 */
export const updateRolGlobal = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const usuario = (req as any).user;
    const { nombre, descripcion, nivel, activo, permisos_ids } = req.body;

    if (usuario.tipo_usuario !== 'super_admin') {
      await connection.rollback();
      connection.release();
      res.status(403).json({
        success: false,
        message: 'Solo el Super Admin puede editar roles globales'
      });
    }

    // Verificar que el rol existe y es global
    const [roles] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM roles WHERE id = ? AND empresa_id IS NULL',
      [id]
    );

    if (roles.length === 0) {
      await connection.rollback();
      connection.release();
      res.status(404).json({
        success: false,
        message: 'Rol global no encontrado'
      });
    }

    const rol = roles[0];

    // No se puede editar el rol super_admin
    if (rol.slug === 'super_admin') {
      await connection.rollback();
      connection.release();
      res.status(403).json({
        success: false,
        message: 'No se puede modificar el rol Super Administrador'
      });
    }

    // Validar jerarquía si se cambia el nivel
    if (nivel !== undefined && nivel !== rol.nivel) {
      if (nivel < 80 || nivel > 99) {
        await connection.rollback();
        connection.release();
        res.status(400).json({
          success: false,
          message: 'Los roles globales deben tener un nivel entre 80 y 99'
        });
      }

      const validacion = await validarJerarquiaRol(usuario, nivel, 'editar');
      
      if (!validacion.valid) {
        await connection.rollback();
        connection.release();
        res.status(403).json({
          success: false,
          message: validacion.message
        });
      }
    }

    // Actualizar información del rol
    const updates: string[] = [];
    const params: any[] = [];

    if (nombre && nombre.trim()) {
      // Validar que no exista otro rol global con el mismo nombre
      const [existentes] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM roles WHERE nombre = ? AND empresa_id IS NULL AND id != ?`,
        [nombre.trim(), id]
      );

      if (existentes.length > 0) {
        await connection.rollback();
        connection.release();
        res.status(400).json({
          success: false,
          message: 'Ya existe otro rol global con ese nombre'
        });
      }

      updates.push('nombre = ?');
      params.push(nombre.trim());
      
      const slug = nombre.toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '_');
      updates.push('slug = ?');
      params.push(slug);
    }

    if (descripcion !== undefined) {
      updates.push('descripcion = ?');
      params.push(descripcion || null);
    }

    if (nivel !== undefined) {
      updates.push('nivel = ?');
      params.push(nivel);
    }

    if (activo !== undefined) {
      updates.push('activo = ?');
      params.push(activo ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push(id);
      await connection.execute(
        `UPDATE roles SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    // Actualizar permisos si se proporcionaron
    if (permisos_ids !== undefined && Array.isArray(permisos_ids)) {
      await connection.execute(
        'DELETE FROM rol_permiso WHERE rol_id = ?',
        [id]
      );

      if (permisos_ids.length > 0) {
        const permisosValues = permisos_ids.map((permisoId: number) => [
          id,
          permisoId,
          usuario.id
        ]);

        await connection.query(
          `INSERT INTO rol_permiso (rol_id, permiso_id, created_by) VALUES ?`,
          [permisosValues]
        );
      }
    }

    // Si se actualizó el nivel, sincronizar usuarios con este rol
    if (nivel !== undefined && nivel !== rol.nivel) {
      await sincronizarUsuariosConRol(connection, Number(id));
    }

    await connection.commit();

    logger.info(`Rol global actualizado: ${id} por usuario ${usuario.id}`);

    res.json({
      success: true,
      message: 'Rol global actualizado exitosamente'
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al actualizar rol global:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar rol global',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * DELETE /api/super-admin/roles-globales/:id
 * Eliminar (desactivar) un rol global
 */
export const deleteRolGlobal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const usuario = (req as any).user;

    if (usuario.tipo_usuario !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Solo el Super Admin puede eliminar roles globales'
      });
    }

    // Verificar que el rol existe y es global
    const [roles] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM roles WHERE id = ? AND empresa_id IS NULL',
      [id]
    );

    if (roles.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Rol global no encontrado'
      });
    }

    const rol = roles[0];

    // No se pueden eliminar roles críticos del sistema
    if (['super_admin', 'admin_empresa'].includes(rol.slug)) {
      res.status(403).json({
        success: false,
        message: 'No se pueden eliminar roles críticos del sistema'
      });
    }

    // Validar jerarquía
    const validacion = await validarJerarquiaRol(usuario, rol.nivel, 'eliminar');
    
    if (!validacion.valid) {
      res.status(403).json({
        success: false,
        message: validacion.message
      });
    }

    // Verificar que no haya usuarios con este rol
    const [usuarios] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM usuario_rol WHERE rol_id = ?',
      [id]
    );

    if (usuarios[0].count > 0) {
      res.status(400).json({
        success: false,
        message: `No se puede eliminar el rol porque tiene ${usuarios[0].count} usuario(s) asignado(s)`
      });
    }

    // Desactivar el rol (soft delete)
    await pool.execute(
      'UPDATE roles SET activo = 0 WHERE id = ?',
      [id]
    );

    logger.info(`Rol global eliminado: ${id} por usuario ${usuario.id}`);

    res.json({
      success: true,
      message: 'Rol global eliminado exitosamente'
    });

  } catch (error: any) {
    logger.error('Error al eliminar rol global:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar rol global',
      error: error.message
    });
  }
};
