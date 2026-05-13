import { Request, Response } from 'express';
import pool from '../../shared/database';
import logger from '../../shared/logger';
import { RowDataPacket } from 'mysql2';

/**
 * ========================================
 * MÓDULO: API PÚBLICA
 * Endpoints sin autenticación para landing page
 * ========================================
 */

/**
 * Obtener planes activos (solo datos públicos)
 * Endpoint público - NO requiere autenticación
 */
export const getPlanesPublicos = async (req: Request, res: Response): Promise<void> => {
  try {
    const [planes] = await pool.query<RowDataPacket[]>(
      `SELECT 
        id,
        nombre,
        descripcion,
        precio_mensual,
        precio_anual,
        max_empresas,
        max_usuarios_por_empresa,
        max_productos,
        max_facturas_mes,
        modulos_incluidos,
        soporte_nivel,
        api_access,
        white_label,
        reportes_avanzados,
        multi_bodega,
        destacado
      FROM planes
      WHERE activo = 1
      ORDER BY precio_mensual ASC`
    );

    res.json({
      success: true,
      data: planes
    });
  } catch (error) {
    logger.error('Error al obtener planes públicos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener planes'
    });
  }
};

/**
 * Obtener información básica del sistema
 * Endpoint público para landing page
 */
export const getInfoPublica = async (req: Request, res: Response): Promise<void> => {
  try {
    // Estadísticas generales públicas (sin datos sensibles)
    const [stats] = await pool.query<RowDataPacket[]>(
      `SELECT 
        COUNT(DISTINCT e.id) as total_empresas_activas,
        COUNT(DISTINCT p.id) as total_planes_disponibles
      FROM empresas e
      CROSS JOIN planes p
      WHERE e.estado = 'activa' AND p.activo = 1`
    );

    res.json({
      success: true,
      data: {
        version: '2.0.0',
        nombre_sistema: 'KORE Inventory',
        estadisticas: stats[0]
      }
    });
  } catch (error) {
    logger.error('Error al obtener info pública:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información'
    });
  }
};
