/**
 * =================================
 * KORE INVENTORY - PERMISSIONS MIDDLEWARE
 * Middleware para validar permisos granulares(módulo + acción)
 * =================================
 */

import { Request, Response, NextFunction } from 'express';
import pool from '../../shared/database';
import { RowDataPacket } from 'mysql2';
import logger from '../../shared/logger';

/**
 * Verificar si el usuario tiene un permiso específico
 * @param modulo - Nombre del módulo (ej: 'traslados', 'productos')
 * @param accion - Nombre de la acción (ej: 'create', 'edit', 'delete')
 */
export const requirePermission = (modulo: string, accion: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const usuario = (req as any).user;

      if (!usuario) {
        logger.warning('Intento de acceso sin autenticación');
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Super admin siempre tiene acceso
      if (usuario.tipo_usuario === 'super_admin') {
        logger.debug(`Super Admin accediendo a ${modulo}.${accion}`);
        return next();
      }

      // Admin empresa tiene acceso a todo excepto módulos de plataforma
      if (usuario.tipo_usuario === 'admin_empresa') {
        // Verificar si el módulo es de plataforma
        const [modulos] = await pool.execute<RowDataPacket[]>(
          `SELECT nivel FROM modulos WHERE nombre = ? AND activo = 1`,
          [modulo]
        );

        if (modulos.length > 0 && modulos[0].nivel === 'platform') {
          logger.warning(`Admin empresa intentó acceder a módulo de plataforma: ${modulo}`);
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para acceder a este módulo'
          });
        }

        logger.debug(`Admin empresa accediendo a ${modulo}.${accion}`);
        return next();
      }

      // Para otros usuarios, verificar permisos en base de datos
      const [permisos] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count
        FROM usuarios u
        INNER JOIN usuario_rol ur ON u.id = ur.usuario_id
        INNER JOIN roles r ON ur.rol_id = r.id
        INNER JOIN rol_permiso rp ON r.id = rp.rol_id
        INNER JOIN permisos p ON rp.permiso_id = p.id
        INNER JOIN modulos m ON p.modulo_id = m.id
        INNER JOIN acciones a ON p.accion_id = a.id
        WHERE u.id = ?
          AND m.nombre = ?
          AND a.nombre = ?
          AND u.activo = 1
          AND r.activo = 1
          AND p.activo = 1
          AND m.activo = 1`,
        [usuario.id, modulo, accion]
      );

      if (permisos[0].count === 0) {
        logger.warning(
          `Permiso denegado - Usuario: ${usuario.id} (${usuario.email}) - ${modulo}.${accion}`
        );
        return res.status(403).json({
          success: false,
          message: `No tienes permisos para ${accion} en ${modulo}`,
          detail: {
            modulo,
            accion,
            required: `${modulo}.${accion}`
          }
        });
      }

      logger.debug(`Permiso concedido - Usuario: ${usuario.id} - ${modulo}.${accion}`);
      next();

    } catch (error: any) {
      logger.error('Error al verificar permisos:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al verificar permisos',
        error: error.message
      });
    }
  };
};

/**
 * Verificar si el usuario tiene al menos UNA acción en el módulo
 * (útil para endpoints de listado que solo requieren ver el módulo)
 */
export const requireModuleAccess = (modulo: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const usuario = (req as any).user;

      if (!usuario) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Super admin y admin empresa tienen acceso
      if (usuario.tipo_usuario === 'super_admin' || usuario.tipo_usuario === 'admin_empresa') {
        return next();
      }

      // Verificar si tiene AL MENOS un permiso en el módulo
      const [permisos] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count
        FROM usuarios u
        INNER JOIN usuario_rol ur ON u.id = ur.usuario_id
        INNER JOIN roles r ON ur.rol_id = r.id
        INNER JOIN rol_permiso rp ON r.id = rp.rol_id
        INNER JOIN permisos p ON rp.permiso_id = p.id
        INNER JOIN modulos m ON p.modulo_id = m.id
        WHERE u.id = ?
          AND m.nombre = ?
          AND u.activo = 1
          AND r.activo = 1
          AND p.activo = 1
          AND m.activo = 1`,
        [usuario.id, modulo]
      );

      if (permisos[0].count === 0) {
        logger.warning(`Acceso denegado al módulo - Usuario: ${usuario.id} - ${modulo}`);
        return res.status(403).json({
          success: false,
          message: `No tienes acceso al módulo ${modulo}`
        });
      }

      next();

    } catch (error: any) {
      logger.error('Error al verificar acceso al módulo:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al verificar acceso',
        error: error.message
      });
    }
  };
};

/**
 * Verificar múltiples permisos (requiere TODOS los especificados)
 * @param permissions - Array de objetos {modulo, accion}
 */
export const requirePermissions = (permissions: Array<{modulo: string, accion: string}>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const usuario = (req as any).user;

      if (!usuario) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Super admin siempre tiene acceso
      if (usuario.tipo_usuario === 'super_admin') {
        return next();
      }

      // Admin empresa tiene acceso (verificar plataforma por cada módulo)
      if (usuario.tipo_usuario === 'admin_empresa') {
        for (const perm of permissions) {
          const [modulos] = await pool.execute<RowDataPacket[]>(
            `SELECT nivel FROM modulos WHERE nombre = ? AND activo = 1`,
            [perm.modulo]
          );

          if (modulos.length > 0 && modulos[0].nivel === 'platform') {
            return res.status(403).json({
              success: false,
              message: `No tienes permisos para acceder al módulo ${perm.modulo}`
            });
          }
        }
        return next();
      }

      // Verificar cada permiso requerido
      for (const perm of permissions) {
        const [permisos] = await pool.execute<RowDataPacket[]>(
          `SELECT COUNT(*) as count
          FROM usuarios u
          INNER JOIN usuario_rol ur ON u.id = ur.usuario_id
          INNER JOIN roles r ON ur.rol_id = r.id
          INNER JOIN rol_permiso rp ON r.id = rp.rol_id
          INNER JOIN permisos p ON rp.permiso_id = p.id
          INNER JOIN modulos m ON p.modulo_id = m.id
          INNER JOIN acciones a ON p.accion_id = a.id
          WHERE u.id = ?
            AND m.nombre = ?
            AND a.nombre = ?
            AND u.activo = 1
            AND r.activo = 1
            AND p.activo = 1
            AND m.activo = 1`,
          [usuario.id, perm.modulo, perm.accion]
        );

        if (permisos[0].count === 0) {
          logger.warning(`Permiso denegado - ${perm.modulo}.${perm.accion}`);
          return res.status(403).json({
            success: false,
            message: `No tienes todos los permisos requeridos`,
            missing: `${perm.modulo}.${perm.accion}`
          });
        }
      }

      next();

    } catch (error: any) {
      logger.error('Error al verificar permisos múltiples:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al verificar permisos',
        error: error.message
      });
    }
  };
};
