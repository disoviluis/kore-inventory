import { Request, Response, NextFunction } from 'express';
import pool from '../../shared/database';
import logger from '../../shared/logger';
import { RowDataPacket } from 'mysql2';

/**
 * ========================================
 * MIDDLEWARE: Verificación de Licencia Activa
 * ========================================
 * Verifica que la empresa tenga una licencia válida y activa
 * Bloquea acceso si la licencia está vencida o la empresa suspendida
 */

interface LicenciaActiva extends RowDataPacket {
  licencia_id: number;
  estado: string;
  fecha_fin: Date;
  dias_restantes: number;
  empresa_estado: string;
  plan_nombre: string;
  auto_renovacion: boolean;
}

export const verificarLicenciaActiva = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Obtener usuario autenticado
    const usuario = (req as any).user;
    
    if (!usuario) {
      res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
      return;
    }

    // Super admin tiene acceso ilimitado
    if (usuario.tipo_usuario === 'super_admin') {
      next();
      return;
    }

    // Obtener empresa_id del contexto (query, body o usuario)
    // Soportar ambos formatos: empresa_id y empresaId
    const empresaId = req.query.empresa_id || req.query.empresaId || req.body.empresa_id || req.body.empresaId || usuario.empresa_id;

    if (!empresaId) {
      res.status(400).json({
        success: false,
        message: 'empresa_id requerido'
      });
      return;
    }

    // Verificar licencia activa
    const [licencias] = await pool.query<LicenciaActiva[]>(`
      SELECT 
        l.id as licencia_id,
        l.estado,
        l.fecha_fin,
        DATEDIFF(l.fecha_fin, CURDATE()) as dias_restantes,
        e.estado as empresa_estado,
        p.nombre as plan_nombre,
        l.auto_renovacion
      FROM licencias l
      INNER JOIN empresas e ON l.empresa_id = e.id
      INNER JOIN planes p ON l.plan_id = p.id
      WHERE l.empresa_id = ?
        AND l.estado IN ('activa')
      ORDER BY l.fecha_fin DESC
      LIMIT 1
    `, [empresaId]);

    // No tiene licencia activa
    if (licencias.length === 0) {
      // Verificar si está en trial
      const [empresas] = await pool.query<RowDataPacket[]>(`
        SELECT 
          estado,
          fecha_fin_trial,
          DATEDIFF(fecha_fin_trial, CURDATE()) as dias_trial_restantes
        FROM empresas
        WHERE id = ?
      `, [empresaId]);

      if (empresas.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Empresa no encontrada'
        });
        return;
      }

      const empresa = empresas[0];

      // Trial activo
      if (empresa.estado === 'trial' && empresa.dias_trial_restantes >= 0) {
        // Agregar info al request para mostrar en UI
        (req as any).licenciaInfo = {
          tipo: 'trial',
          dias_restantes: empresa.dias_trial_restantes,
          fecha_vencimiento: empresa.fecha_fin_trial
        };
        next();
        return;
      }

      // Trial vencido o empresa suspendida
      if (empresa.estado === 'suspendida') {
        res.status(403).json({
          success: false,
          codigo: 'LICENCIA_VENCIDA',
          message: 'Tu licencia ha expirado. Renueva para continuar usando el sistema.',
          data: {
            empresa_estado: empresa.estado,
            accion_requerida: 'renovar_licencia',
            url_renovacion: '/planes',
            soporte_email: 'soporte@koreinventory.com'
          }
        });
        return;
      }

      // Empresa cancelada
      if (empresa.estado === 'cancelada') {
        res.status(403).json({
          success: false,
          codigo: 'EMPRESA_CANCELADA',
          message: 'Esta cuenta ha sido cancelada.',
          data: {
            soporte_email: 'soporte@koreinventory.com'
          }
        });
        return;
      }

      // Estado desconocido
      res.status(403).json({
        success: false,
        codigo: 'SIN_LICENCIA',
        message: 'No tienes una licencia activa.',
        data: {
          accion_requerida: 'contratar_plan',
          url_planes: '/planes'
        }
      });
      return;
    }

    const licencia = licencias[0];

    // Verificar que la empresa no esté suspendida
    if (licencia.empresa_estado === 'suspendida') {
      res.status(403).json({
        success: false,
        codigo: 'EMPRESA_SUSPENDIDA',
        message: 'Tu cuenta ha sido suspendida. Contacta a soporte.',
        data: {
          soporte_email: 'soporte@koreinventory.com'
        }
      });
      return;
    }

    // Verificar que la licencia no haya vencido
    if (licencia.dias_restantes < 0) {
      res.status(403).json({
        success: false,
        codigo: 'LICENCIA_VENCIDA',
        message: 'Tu licencia ha expirado',
        data: {
          fecha_vencimiento: licencia.fecha_fin,
          accion_requerida: 'renovar_licencia',
          url_renovacion: '/planes'
        }
      });
      return;
    }

    // Licencia válida y activa
    // Agregar información de la licencia al request
    (req as any).licenciaInfo = {
      tipo: 'pagada',
      id: licencia.licencia_id,
      plan: licencia.plan_nombre,
      dias_restantes: licencia.dias_restantes,
      fecha_vencimiento: licencia.fecha_fin,
      auto_renovacion: licencia.auto_renovacion,
      estado: licencia.estado
    };

    // Advertencia si está por vencer (7 días o menos)
    if (licencia.dias_restantes <= 7 && licencia.dias_restantes > 0) {
      (req as any).licenciaAdvertencia = {
        codigo: 'LICENCIA_POR_VENCER',
        mensaje: `Tu licencia vence en ${licencia.dias_restantes} día${licencia.dias_restantes !== 1 ? 's' : ''}`,
        dias_restantes: licencia.dias_restantes,
        fecha_vencimiento: licencia.fecha_fin,
        auto_renovacion: licencia.auto_renovacion
      };
    }

    // Continuar con la petición
    next();

  } catch (error: any) {
    logger.error('Error en verificarLicenciaActiva:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar licencia',
      error: error.message
    });
  }
};

/**
 * Middleware ligero: solo verifica que la empresa esté activa (trial o con licencia)
 * Útil para endpoints que no requieren licencia pagada (ej: ver planes, perfil de usuario)
 */
export const verificarEmpresaActiva = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const usuario = (req as any).user;
    
    if (!usuario) {
      res.status(401).json({ success: false, message: 'No autenticado' });
      return;
    }

    if (usuario.tipo_usuario === 'super_admin') {
      next();
      return;
    }

    // Soportar ambos formatos: empresa_id y empresaId
    const empresaId = req.query.empresa_id || req.query.empresaId || req.body.empresa_id || req.body.empresaId || usuario.empresa_id;

    if (!empresaId) {
      res.status(400).json({ success: false, message: 'empresa_id requerido' });
      return;
    }

    const [empresas] = await pool.query<RowDataPacket[]>(
      'SELECT estado FROM empresas WHERE id = ?',
      [empresaId]
    );

    if (empresas.length === 0) {
      res.status(404).json({ success: false, message: 'Empresa no encontrada' });
      return;
    }

    const empresa = empresas[0];

    if (empresa.estado === 'suspendida' || empresa.estado === 'cancelada') {
      res.status(403).json({
        success: false,
        codigo: 'EMPRESA_INACTIVA',
        message: 'Esta cuenta está inactiva',
        data: { estado: empresa.estado }
      });
      return;
    }

    next();

  } catch (error: any) {
    logger.error('Error en verificarEmpresaActiva:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar empresa',
      error: error.message
    });
  }
};

export default { verificarLicenciaActiva, verificarEmpresaActiva };
