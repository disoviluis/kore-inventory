/**
 * =================================
 * KORE INVENTORY - PERMISOS CONTROLLER
 * Controlador para obtener permisos del usuario
 * =================================
 */

import { Request, Response } from 'express';
import pool from '../../shared/database';
import { RowDataPacket } from 'mysql2';

/**
 * Obtener módulos permitidos para el usuario actual
 * GET /api/auth/permisos/modulos
 */
export const getModulosPermitidos = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuario = (req as any).user;

    if (!usuario) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    // Super admin tiene acceso a TODOS los módulos
    if (usuario.tipo_usuario === 'super_admin') {
      const [modulos] = await pool.execute<RowDataPacket[]>(
        `SELECT DISTINCT
          m.id,
          m.nombre,
          m.nombre_mostrar,
          m.icono,
          m.nivel,
          m.categoria,
          m.orden
        FROM modulos m
        WHERE m.activo = 1
        ORDER BY m.orden ASC, m.nombre_mostrar ASC`
      );

      res.json({
        success: true,
        data: {
          tipo_usuario: 'super_admin',
          modulos: modulos
        }
      });
      return;
    }

    // Admin empresa tiene acceso a TODOS los módulos excepto PLATAFORMA
    if (usuario.tipo_usuario === 'admin_empresa') {
      const [modulos] = await pool.execute<RowDataPacket[]>(
        `SELECT DISTINCT
          m.id,
          m.nombre,
          m.nombre_mostrar,
          m.icono,
          m.nivel,
          m.categoria,
          m.orden
        FROM modulos m
        WHERE m.activo = 1
          AND (m.nivel != 'platform' OR m.nivel IS NULL)
        ORDER BY m.orden ASC, m.nombre_mostrar ASC`
      );

      res.json({
        success: true,
        data: {
          tipo_usuario: 'admin_empresa',
          modulos: modulos
        }
      });
      return;
    }

    // Para otros usuarios, obtener módulos según sus roles y permisos
    const [modulos] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT
        m.id,
        m.nombre,
        m.nombre_mostrar,
        m.icono,
        m.nivel,
        m.categoria,
        m.orden
      FROM usuarios u
      INNER JOIN usuario_rol ur ON u.id = ur.usuario_id
      INNER JOIN roles r ON ur.rol_id = r.id
      INNER JOIN rol_permiso rp ON r.id = rp.rol_id
      INNER JOIN permisos p ON rp.permiso_id = p.id
      INNER JOIN modulos m ON p.modulo_id = m.id
      WHERE u.id = ?
        AND u.activo = 1
        AND r.activo = 1
        AND p.activo = 1
        AND m.activo = 1
      ORDER BY m.orden ASC, m.nombre_mostrar ASC`,
      [usuario.id]
    );

    res.json({
      success: true,
      data: {
        tipo_usuario: usuario.tipo_usuario,
        modulos: modulos
      }
    });

  } catch (error: any) {
    console.error('Error al obtener módulos permitidos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener módulos permitidos',
      error: error.message
    });
  }
};

/**
 * Obtener permisos detallados del usuario (módulo + acción)
 * GET /api/auth/permisos
 */
export const getPermisosUsuario = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuario = (req as any).user;
    const { empresa_id } = req.query;

    if (!usuario) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    // Super admin tiene TODOS los permisos
    if (usuario.tipo_usuario === 'super_admin') {
      const [permisos] = await pool.execute<RowDataPacket[]>(
        `SELECT DISTINCT
          p.id,
          p.codigo,
          m.nombre AS modulo,
          m.nombre_mostrar AS modulo_mostrar,
          a.nombre AS accion,
          a.nombre_mostrar AS accion_mostrar
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
          tipo_usuario: 'super_admin',
          permisos: permisos
        }
      });
      return;
    }

    // Admin empresa tiene TODOS los permisos excepto PLATAFORMA
    if (usuario.tipo_usuario === 'admin_empresa') {
      const [permisos] = await pool.execute<RowDataPacket[]>(
        `SELECT DISTINCT
          p.id,
          p.codigo,
          m.nombre AS modulo,
          m.nombre_mostrar AS modulo_mostrar,
          a.nombre AS accion,
          a.nombre_mostrar AS accion_mostrar
        FROM permisos p
        INNER JOIN modulos m ON p.modulo_id = m.id
        INNER JOIN acciones a ON p.accion_id = a.id
        WHERE p.activo = 1
          AND m.activo = 1
          AND a.activo = 1
          AND (m.nivel != 'platform' OR m.nivel IS NULL)
        ORDER BY m.orden ASC, a.nombre ASC`
      );

      res.json({
        success: true,
        data: {
          tipo_usuario: 'admin_empresa',
          permisos: permisos
        }
      });
      return;
    }

    // Para otros usuarios, obtener permisos según sus roles
    // Si se especifica empresa_id, filtrar roles de esa empresa
    let query = `
      SELECT DISTINCT
        p.id,
        p.codigo,
        m.nombre AS modulo,
        m.nombre_mostrar AS modulo_mostrar,
        a.nombre AS accion,
        a.nombre_mostrar AS accion_mostrar
      FROM usuarios u
      INNER JOIN usuario_rol ur ON u.id = ur.usuario_id
      INNER JOIN roles r ON ur.rol_id = r.id
      INNER JOIN rol_permiso rp ON r.id = rp.rol_id
      INNER JOIN permisos p ON rp.permiso_id = p.id
      INNER JOIN modulos m ON p.modulo_id = m.id
      INNER JOIN acciones a ON p.accion_id = a.id
      WHERE u.id = ?
        AND u.activo = 1
        AND r.activo = 1
        AND p.activo = 1
        AND m.activo = 1
    `;

    const params: any[] = [usuario.id];

    if (empresa_id) {
      query += ` AND (r.empresa_id = ? OR r.empresa_id IS NULL)`;
      params.push(empresa_id);
    }

    query += ` ORDER BY m.orden ASC, a.nombre ASC`;

    const [permisos] = await pool.execute<RowDataPacket[]>(query, params);

    res.json({
      success: true,
      data: {
        tipo_usuario: usuario.tipo_usuario,
        permisos: permisos
      }
    });

  } catch (error: any) {
    console.error('Error al obtener permisos del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener permisos del usuario',
      error: error.message
    });
  }
};
