/**
 * =================================
 * KORE INVENTORY - ROLES CONTROLLER
 * Gestión de Roles y Permisos
 * =================================
 */

import { Request, Response } from 'express';
import pool from '../../shared/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ============================================
// TIPOS
// ============================================

interface Rol extends RowDataPacket {
  id: number;
  empresa_id: number | null;
  nombre: string;
  descripcion: string | null;
  slug: string;
  tipo: 'sistema' | 'personalizado';
  es_admin: boolean;
  nivel: number; // Nivel de privilegio (10-100)
  activo: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: number | null;
}

interface Usuario extends RowDataPacket {
  id: number;
  tipo_usuario: string;
  empresa_id: number | null;
  nivel_privilegio: number | null;
}

interface Permiso extends RowDataPacket {
  id: number;
  modulo_id: number;
  modulo_nombre: string;
  modulo_mostrar: string;
  modulo_icono: string;
  accion_id: number;
  accion_nombre: string;
  accion_mostrar: string;
  codigo: string;
  descripcion: string | null;
  activo: boolean;
}

interface Modulo extends RowDataPacket {
  id: number;
  nombre: string;
  nombre_mostrar: string;
  descripcion: string | null;
  icono: string | null;
  nivel: 'platform' | 'core' | 'tenant';
  categoria: string | null;
  orden: number;
  activo: boolean;
}

interface Accion extends RowDataPacket {
  id: number;
  nombre: string;
  nombre_mostrar: string;
  descripcion: string | null;
  activo: boolean;
}

// ============================================
// FUNCIONES DE VALIDACIÓN DE JERARQUÍAS
// ============================================

/**
 * Obtener nivel de privilegio del usuario actual
 */
async function obtenerNivelUsuario(usuarioId: number): Promise<number> {
  const [result] = await pool.execute<RowDataPacket[]>(
    `SELECT nivel_privilegio FROM usuarios WHERE id = ?`,
    [usuarioId]
  );

  if (result.length === 0 || !result[0].nivel_privilegio) {
    // Si no tiene nivel, buscar el más alto de sus roles
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
  empresaIdRol: number | null,
  operacion: 'crear' | 'editar' | 'eliminar'
): Promise<{ valid: boolean; message?: string }> {
  // Obtener nivel del usuario
  const nivelUsuario = await obtenerNivelUsuario(usuario.id);

  // Regla 1: Solo puedes crear/editar/eliminar roles de nivel menor al tuyo
  if (nivelRol >= nivelUsuario) {
    return {
      valid: false,
      message: `No puedes ${operacion} un rol de nivel igual o superior al tuyo (${nivelUsuario})`
    };
  }

  // Regla 2: Solo super_admin puede crear roles globales
  if (empresaIdRol === null && usuario.tipo_usuario !== 'super_admin') {
    return {
      valid: false,
      message: 'Solo el Super Admin puede crear roles globales'
    };
  }

  // Regla 3: Admin empresa solo puede crear roles hasta nivel 60
  if (usuario.tipo_usuario === 'admin_empresa' && nivelRol > 60) {
    return {
      valid: false,
      message: 'No puedes crear roles de nivel superior a 60'
    };
  }

  // Regla 4: Admin empresa solo crea roles para SU empresa
  if (usuario.tipo_usuario === 'admin_empresa' && empresaIdRol !== usuario.empresa_id) {
    return {
      valid: false,
      message: 'Solo puedes crear roles para tu empresa'
    };
  }

  return { valid: true };
}

/**
 * Sincronizar nivel_privilegio de un usuario
 */
async function sincronizarNivelPrivilegio(connection: any, usuarioId: number): Promise<void> {
  await connection.execute(
    `UPDATE usuarios u
     SET nivel_privilegio = (
       SELECT MAX(r.nivel)
       FROM usuario_rol ur
       INNER JOIN roles r ON ur.rol_id = r.id
       WHERE ur.usuario_id = ?
     )
     WHERE u.id = ?`,
    [usuarioId, usuarioId]
  );
}

// ============================================
// OBTENER ROLES (filtrados por empresa o todos para super_admin)
// ============================================

export const getRoles = async (req: Request, res: Response): Promise<void> => {
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

    let query = `
      SELECT 
        r.id,
        r.empresa_id,
        r.nombre,
        r.descripcion,
        r.slug,
        r.tipo,
        r.es_admin,
        r.nivel,
        r.activo,
        r.created_at,
        r.updated_at,
        r.created_by,
        e.nombre AS empresa_nombre,
        (SELECT COUNT(*) FROM usuario_rol WHERE rol_id = r.id) AS usuarios_count
      FROM roles r
      LEFT JOIN empresas e ON r.empresa_id = e.id
      WHERE 1=1
    `;

    const params: any[] = [];

    // super_admin ve todos los roles
    // admin_empresa ve SOLO roles de su empresa (tipo='personalizado')
    // admin_empresa NO puede ver roles de sistema (nivel >= 80) ni roles globales
    if (usuario.tipo_usuario !== 'super_admin') {
      // Filtrar por empresa y EXCLUIR roles de sistema
      query += ` AND r.empresa_id = ? 
                 AND r.tipo = 'personalizado' 
                 AND r.nivel < 80`;
      params.push(empresa_id || usuario.empresa_id);
    } else if (empresa_id) {
      // super_admin puede filtrar por empresa (ve sistema + personalizados)
      query += ' AND (r.empresa_id = ? OR r.empresa_id IS NULL)';
      params.push(empresa_id);
    }

    query += ' ORDER BY r.nivel DESC, r.empresa_id IS NULL DESC, r.nombre ASC';

    const [roles] = await pool.execute<Rol[]>(query, params);

    res.json({
      success: true,
      data: roles
    });
  } catch (error: any) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener roles',
      error: error.message
    });
  }
};

// ============================================
// OBTENER ROL POR ID (con permisos asignados)
// ============================================

export const getRolById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const usuario = (req as any).user;

    if (!usuario) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    // Obtener información del rol
    const [roles] = await pool.execute<Rol[]>(
      `SELECT 
        r.*,
        e.nombre AS empresa_nombre
      FROM roles r
      LEFT JOIN empresas e ON r.empresa_id = e.id
      WHERE r.id = ?`,
      [id]
    );

    if (roles.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Rol no encontrado'
      });
      return;
    }

    const rol = roles[0];

    // Verificar permisos: admin_empresa solo puede ver roles de su empresa
    if (usuario.tipo_usuario !== 'super_admin') {
      if (rol.empresa_id !== null && rol.empresa_id !== usuario.empresa_id) {
        res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver este rol'
        });
        return;
      }
    }

    // Obtener permisos asignados al rol
    const [permisos] = await pool.execute<any[]>(
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
    console.error('Error al obtener rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener rol',
      error: error.message
    });
  }
};

// ============================================
// OBTENER MÓDULOS Y ACCIONES (para matriz de permisos)
// ============================================

export const getModulosAcciones = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuario = (req as any).user;

    if (!usuario) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    // Obtener todos los módulos activos
    let modulosQuery = `
      SELECT 
        id,
        nombre,
        nombre_mostrar,
        descripcion,
        icono,
        nivel,
        categoria,
        orden,
        activo
      FROM modulos
      WHERE activo = 1
    `;

    // admin_empresa solo ve módulos core y tenant (no platform)
    if (usuario.tipo_usuario !== 'super_admin') {
      modulosQuery += ` AND nivel IN ('core', 'tenant')`;
    }

    modulosQuery += ` ORDER BY orden ASC, nombre_mostrar ASC`;

    const [modulos] = await pool.execute<Modulo[]>(modulosQuery);

    // Obtener todas las acciones activas
    const [acciones] = await pool.execute<Accion[]>(
      `SELECT 
        id,
        nombre,
        nombre_mostrar,
        descripcion,
        activo
      FROM acciones
      WHERE activo = 1
      ORDER BY 
        CASE nombre
          WHEN 'view' THEN 1
          WHEN 'create' THEN 2
          WHEN 'edit' THEN 3
          WHEN 'delete' THEN 4
          WHEN 'approve' THEN 5
          WHEN 'export' THEN 6
          WHEN 'import' THEN 7
          WHEN 'print' THEN 8
          ELSE 99
        END`
    );

    // Obtener todos los permisos existentes (combinaciones módulo-acción)
    const [permisos] = await pool.execute<Permiso[]>(
      `SELECT 
        p.id,
        p.modulo_id,
        m.nombre AS modulo_nombre,
        m.nombre_mostrar AS modulo_mostrar,
        m.icono AS modulo_icono,
        p.accion_id,
        a.nombre AS accion_nombre,
        a.nombre_mostrar AS accion_mostrar,
        p.codigo,
        p.descripcion,
        p.activo
      FROM permisos p
      INNER JOIN modulos m ON p.modulo_id = m.id
      INNER JOIN acciones a ON p.accion_id = a.id
      WHERE p.activo = 1
        AND m.activo = 1
        AND a.activo = 1
      ORDER BY m.orden ASC, a.nombre ASC`
    );

    res.json({
      success: true,
      data: {
        modulos,
        acciones,
        permisos
      }
    });
  } catch (error: any) {
    console.error('Error al obtener módulos y acciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener módulos y acciones',
      error: error.message
    });
  }
};

// ============================================
// CREAR ROL
// ============================================

export const createRol = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const usuario = (req as any).user;
    const { nombre, descripcion, empresa_id, nivel, permisos_ids } = req.body;

    if (!usuario) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      await connection.rollback();
      connection.release();
      return;
    }

    // Validaciones básicas
    if (!nombre || !nombre.trim()) {
      res.status(400).json({
        success: false,
        message: 'El nombre del rol es obligatorio'
      });
      await connection.rollback();
      connection.release();
      return;
    }

    // Validar nivel
    const nivelFinal = nivel || 20; // Default nivel 20 si no se especifica
    if (nivelFinal < 10 || nivelFinal > 100) {
      res.status(400).json({
        success: false,
        message: 'El nivel del rol debe estar entre 10 y 100'
      });
      await connection.rollback();
      connection.release();
      return;
    }

    // Validar que admin_empresa solo pueda crear roles para su empresa
    let empresaIdFinal: number | null = null;
    if (usuario.tipo_usuario !== 'super_admin') {
      empresaIdFinal = usuario.empresa_id;
    } else {
      empresaIdFinal = empresa_id || null;
    }

    // Validar que no exista un rol con el mismo nombre en la MISMA empresa
    // Solo comparamos dentro del scope de la empresa actual
    const [existentes] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM roles 
       WHERE nombre = ? 
       AND empresa_id <=> ?`,
      [nombre.trim(), empresaIdFinal]
    );

    if (existentes.length > 0) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: 'Ya existe un rol con ese nombre en esta empresa'
      });
      connection.release();
      return;
    }

    // ⭐ VALIDAR JERARQUÍA
    const validacion = await validarJerarquiaRol(
      usuario,
      nivelFinal,
      empresaIdFinal,
      'crear'
    );

    if (!validacion.valid) {
      res.status(403).json({
        success: false,
        message: validacion.message
      });
      await connection.rollback();
      connection.release();
      return;
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
      ) VALUES (?, ?, ?, ?, 'personalizado', ?, 0, 1, ?)`,
      [empresaIdFinal, nombre.trim(), descripcion || null, slug, nivelFinal, usuario.id]
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

    res.status(201).json({
      success: true,
      message: 'Rol creado exitosamente',
      data: {
        id: rolId,
        nombre,
        slug,
        nivel: nivelFinal,
        permisos_count: permisos_ids?.length || 0
      }
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error al crear rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear rol',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ============================================
// ACTUALIZAR ROL
// ============================================

export const updateRol = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const usuario = (req as any).user;
    const { nombre, descripcion, nivel, activo, permisos_ids } = req.body;

    if (!usuario) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      await connection.rollback();
      connection.release();
      return;
    }

    // Verificar que el rol existe
    const [roles] = await connection.execute<Rol[]>(
      'SELECT * FROM roles WHERE id = ?',
      [id]
    );

    if (roles.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: 'Rol no encontrado'
      });
      return;
    }

    const rol = roles[0];

    // Validar permisos: no se pueden editar roles de sistema
    if (rol.tipo === 'sistema') {
      await connection.rollback();
      res.status(403).json({
        success: false,
        message: 'No se pueden modificar roles de sistema'
      });
      return;
    }

    // Validar que admin_empresa solo edite roles de su empresa
    if (usuario.tipo_usuario !== 'super_admin') {
      if (rol.empresa_id !== usuario.empresa_id) {
        await connection.rollback();
        res.status(403).json({
          success: false,
          message: 'No tienes permiso para editar este rol'
        });
        connection.release();
        return;
      }
    }

    // ⭐ VALIDAR JERARQUÍA si se cambia el nivel
    if (nivel !== undefined && nivel !== rol.nivel) {
      if (nivel < 10 || nivel > 100) {
        res.status(400).json({
          success: false,
          message: 'El nivel del rol debe estar entre 10 y 100'
        });
        await connection.rollback();
        connection.release();
        return;
      }

      const validacion = await validarJerarquiaRol(
        usuario,
        nivel,
        rol.empresa_id,
        'editar'
      );

      if (!validacion.valid) {
        res.status(403).json({
          success: false,
          message: validacion.message
        });
        await connection.rollback();
        connection.release();
        return;
      }
    }

    // Actualizar información del rol
    if (nombre || descripcion !== undefined || activo !== undefined) {
      const updates: string[] = [];
      const params: any[] = [];

      if (nombre && nombre.trim()) {
        // Validar que no exista otro rol con el mismo nombre en la misma empresa
        const [existentes] = await connection.execute<RowDataPacket[]>(
          `SELECT id FROM roles 
           WHERE nombre = ? 
           AND empresa_id <=> ?
           AND id != ?`,
          [nombre.trim(), rol.empresa_id, id]
        );

        if (existentes.length > 0) {
          await connection.rollback();
          res.status(400).json({
            success: false,
            message: 'Ya existe otro rol con ese nombre en esta empresa'
          });
          return;
        }

        updates.push('nombre = ?');
        params.push(nombre.trim());
        
        // Actualizar slug si cambia el nombre
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

      params.push(id);

      await connection.execute(
        `UPDATE roles SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    // Actualizar permisos si se proporcionaron
    if (permisos_ids !== undefined && Array.isArray(permisos_ids)) {
      // Eliminar permisos actuales
      await connection.execute(
        'DELETE FROM rol_permiso WHERE rol_id = ?',
        [id]
      );

      // Insertar nuevos permisos
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

    // ⭐ Si se actualizó el nivel, sincronizar nivel_privilegio de usuarios con este rol
    if (nivel !== undefined && nivel !== rol.nivel) {
      const [usuariosConRol] = await connection.execute<RowDataPacket[]>(
        'SELECT DISTINCT usuario_id FROM usuario_rol WHERE rol_id = ?',
        [id]
      );

      for (const row of usuariosConRol) {
        await sincronizarNivelPrivilegio(connection, row.usuario_id);
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Rol actualizado exitosamente'
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error al actualizar rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar rol',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ============================================
// ELIMINAR ROL (soft delete)
// ============================================

export const deleteRol = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const usuario = (req as any).user;

    if (!usuario) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    // Verificar que el rol existe
    const [roles] = await pool.execute<Rol[]>(
      'SELECT * FROM roles WHERE id = ?',
      [id]
    );

    if (roles.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Rol no encontrado'
      });
      return;
    }

    const rol = roles[0];

    // Validar que no es un rol de sistema
    if (rol.tipo === 'sistema') {
      res.status(403).json({
        success: false,
        message: 'No se pueden eliminar roles de sistema'
      });
      return;
    }

    // ⭐ VALIDAR JERARQUÍA
    const validacion = await validarJerarquiaRol(
      usuario,
      rol.nivel,
      rol.empresa_id,
      'eliminar'
    );

    if (!validacion.valid) {
      res.status(403).json({
        success: false,
        message: validacion.message
      });
      return;
    }

    // Validar permisos
    if (usuario.tipo_usuario !== 'super_admin') {
      if (rol.empresa_id !== usuario.empresa_id) {
        res.status(403).json({
          success: false,
          message: 'No tienes permiso para eliminar este rol'
        });
        return;
      }
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
      return;
    }

    // Desactivar el rol (soft delete)
    await pool.execute(
      'UPDATE roles SET activo = 0 WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Rol eliminado exitosamente'
    });
  } catch (error: any) {
    console.error('Error al eliminar rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar rol',
      error: error.message
    });
  }
};
