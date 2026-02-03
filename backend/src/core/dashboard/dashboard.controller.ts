/**
 * =================================
 * KORE INVENTORY - DASHBOARD CONTROLLER
 * Controlador de estadísticas del dashboard
 * =================================
 */

import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

/**
 * Obtener estadísticas del dashboard
 * GET /api/dashboard/stats
 */
export const getStats = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId } = req.query;

    if (!empresaId) {
      return errorResponse(
        res,
        'ID de empresa es requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Obtener estadísticas en paralelo
    const [
      ventasDelMes,
      facturasEmitidas,
      productosEnStock,
      clientesActivos
    ] = await Promise.all([
      // Ventas del mes actual
      query(
        `SELECT 
          COALESCE(SUM(total), 0) as total_ventas,
          COUNT(*) as cantidad_ventas
        FROM ventas 
        WHERE empresa_id = ?
          AND MONTH(fecha_venta) = MONTH(CURRENT_DATE())
          AND YEAR(fecha_venta) = YEAR(CURRENT_DATE())
          AND estado != 'cancelada'`,
        [empresaId]
      ),

      // Facturas emitidas
      query(
        `SELECT COUNT(*) as total_facturas
        FROM ventas 
        WHERE empresa_id = ?
          AND estado IN ('completada', 'pendiente')`,
        [empresaId]
      ),

      // Productos en stock
      query(
        `SELECT COUNT(*) as total_productos
        FROM productos 
        WHERE empresa_id = ?
          AND stock_actual > 0
          AND estado = 'activo'`,
        [empresaId]
      ),

      // Clientes activos
      query(
        `SELECT COUNT(*) as total_clientes
        FROM clientes 
        WHERE empresa_id = ?
          AND estado = 'activo'`,
        [empresaId]
      )
    ]);

    // Obtener ventas de los últimos 6 meses
    const ventasMensuales = await query(
      `SELECT 
        DATE_FORMAT(fecha_venta, '%Y-%m') as mes,
        COALESCE(SUM(total), 0) as total,
        COUNT(*) as cantidad
      FROM ventas 
      WHERE empresa_id = ?
        AND fecha_venta >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
        AND estado != 'cancelada'
      GROUP BY DATE_FORMAT(fecha_venta, '%Y-%m')
      ORDER BY mes ASC`,
      [empresaId]
    );

    // Obtener productos más vendidos
    const topProductos = await query(
      `SELECT 
        p.id,
        p.nombre,
        p.codigo,
        SUM(vd.cantidad) as total_vendido,
        SUM(vd.subtotal) as total_ingresos
      FROM productos p
      INNER JOIN venta_detalle vd ON p.id = vd.producto_id
      INNER JOIN ventas v ON vd.venta_id = v.id
      WHERE p.empresa_id = ?
        AND v.fecha_venta >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND v.estado != 'cancelada'
      GROUP BY p.id, p.nombre, p.codigo
      ORDER BY total_vendido DESC
      LIMIT 5`,
      [empresaId]
    );

    // Obtener últimas ventas
    const ultimasVentas = await query(
      `SELECT 
        v.id,
        v.numero_factura,
        v.fecha_venta,
        v.total,
        v.estado,
        c.nombre as cliente_nombre,
        c.documento as cliente_documento
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      WHERE v.empresa_id = ?
      ORDER BY v.fecha_venta DESC
      LIMIT 10`,
      [empresaId]
    );

    const stats = {
      ventasDelMes: {
        total: Number(ventasDelMes[0].total_ventas) || 0,
        cantidad: Number(ventasDelMes[0].cantidad_ventas) || 0,
        porcentaje: 0 // TODO: Calcular comparación con mes anterior
      },
      facturasEmitidas: {
        total: Number(facturasEmitidas[0].total_facturas) || 0,
        porcentaje: 0
      },
      productosEnStock: {
        total: Number(productosEnStock[0].total_productos) || 0,
        porcentaje: 0
      },
      clientesActivos: {
        total: Number(clientesActivos[0].total_clientes) || 0,
        porcentaje: 0
      },
      ventasMensuales: ventasMensuales,
      topProductos: topProductos,
      ultimasVentas: ultimasVentas
    };

    logger.info(`Estadísticas obtenidas para empresa ${empresaId}`);
    
    return successResponse(
      res,
      'Estadísticas obtenidas exitosamente',
      stats,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener estadísticas:', error);
    return errorResponse(
      res,
      'Error al obtener estadísticas',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Obtener actividad reciente
 * GET /api/dashboard/actividad
 */
export const getActividad = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId } = req.query;

    if (!empresaId) {
      return errorResponse(
        res,
        'ID de empresa es requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const actividad = await query(
      `SELECT 
        'venta' as tipo,
        v.id,
        CONCAT('Nueva venta #', v.numero_factura) as descripcion,
        v.fecha_venta as fecha,
        u.nombre as usuario_nombre
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.empresa_id = ?
      ORDER BY v.fecha_venta DESC
      LIMIT 20`,
      [empresaId]
    );

    return successResponse(
      res,
      'Actividad reciente obtenida exitosamente',
      actividad,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener actividad:', error);
    return errorResponse(
      res,
      'Error al obtener actividad',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};
