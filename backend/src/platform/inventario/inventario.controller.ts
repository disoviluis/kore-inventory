/**
 * =================================
 * KORE INVENTORY - INVENTARIO CONTROLLER
 * Controlador de movimientos de inventario
 * =================================
 */

import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

/**
 * Obtener todos los movimientos de inventario
 * GET /api/inventario?empresaId=X
 */
export const getMovimientos = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId, tipo, fechaInicio, fechaFin } = req.query;

    if (!empresaId) {
      return errorResponse(
        res,
        'ID de empresa es requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    let whereClause = 'p.empresa_id = ?';
    const params: any[] = [empresaId];

    if (tipo) {
      whereClause += ' AND im.tipo_movimiento = ?';
      params.push(tipo);
    }

    if (fechaInicio) {
      whereClause += ' AND im.fecha >= ?';
      params.push(fechaInicio);
    }

    if (fechaFin) {
      whereClause += ' AND im.fecha <= ?';
      params.push(fechaFin);
    }

    const movimientos = await query(
      `SELECT 
        im.id,
        im.producto_id,
        p.nombre as producto_nombre,
        p.sku,
        p.codigo_barras,
        im.tipo_movimiento,
        im.cantidad,
        im.stock_anterior,
        im.stock_nuevo,
        im.motivo,
        im.referencia_tipo,
        im.referencia_id,
        im.usuario_id,
        u.nombre as usuario_nombre,
        u.apellido as usuario_apellido,
        im.fecha,
        im.notas,
        im.created_at
      FROM inventario_movimientos im
      INNER JOIN productos p ON im.producto_id = p.id
      LEFT JOIN usuarios u ON im.usuario_id = u.id
      WHERE ${whereClause}
      ORDER BY im.fecha DESC, im.created_at DESC
      LIMIT 500`,
      params
    );

    logger.info(`Movimientos de inventario obtenidos para empresa ${empresaId}: ${movimientos.length}`);
    return successResponse(res, 'Movimientos obtenidos exitosamente', movimientos, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener movimientos:', error);
    return errorResponse(res, 'Error al obtener movimientos', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Obtener resumen de inventario
 * GET /api/inventario/resumen?empresaId=X
 */
export const getResumen = async (req: Request, res: Response): Promise<Response> => {
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

    const [productos, alertas, valorTotal] = await Promise.all([
      // Total de productos
      query(
        `SELECT COUNT(*) as total FROM productos WHERE empresa_id = ? AND estado = 'activo'`,
        [empresaId]
      ),
      // Productos con stock bajo
      query(
        `SELECT COUNT(*) as total FROM productos 
         WHERE empresa_id = ? AND estado = 'activo' AND stock_actual <= stock_minimo`,
        [empresaId]
      ),
      // Valor total del inventario
      query(
        `SELECT SUM(stock_actual * precio_compra) as valor_total 
         FROM productos 
         WHERE empresa_id = ? AND estado = 'activo'`,
        [empresaId]
      )
    ]);

    const resumen = {
      total_productos: productos[0]?.total || 0,
      productos_alerta: alertas[0]?.total || 0,
      valor_inventario: valorTotal[0]?.valor_total || 0
    };

    return successResponse(res, 'Resumen obtenido exitosamente', resumen, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener resumen:', error);
    return errorResponse(res, 'Error al obtener resumen', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Obtener productos con stock bajo
 * GET /api/inventario/alertas?empresaId=X
 */
export const getAlertas = async (req: Request, res: Response): Promise<Response> => {
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

    const productos = await query(
      `SELECT 
        id,
        nombre,
        sku,
        stock_actual,
        stock_minimo,
        stock_maximo,
        unidad_medida,
        precio_compra,
        precio_venta,
        ubicacion_almacen
      FROM productos
      WHERE empresa_id = ? 
        AND estado = 'activo'
        AND stock_actual <= stock_minimo
      ORDER BY stock_actual ASC`,
      [empresaId]
    );

    return successResponse(res, 'Alertas obtenidas exitosamente', productos, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener alertas:', error);
    return errorResponse(res, 'Error al obtener alertas', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Registrar ajuste de inventario
 * POST /api/inventario/ajuste
 */
export const registrarAjuste = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { producto_id, cantidad, motivo, notas, usuario_id } = req.body;

    if (!producto_id || cantidad === undefined) {
      return errorResponse(
        res,
        'Producto ID y cantidad son requeridos',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Obtener producto actual
    const productos = await query(
      'SELECT id, stock_actual, empresa_id FROM productos WHERE id = ?',
      [producto_id]
    );

    if (productos.length === 0) {
      return errorResponse(
        res,
        'Producto no encontrado',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    const producto = productos[0];
    const stockAnterior = producto.stock_actual;
    const stockNuevo = stockAnterior + cantidad;

    if (stockNuevo < 0) {
      return errorResponse(
        res,
        'El ajuste resultaría en stock negativo',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Actualizar stock del producto
    await query(
      'UPDATE productos SET stock_actual = ?, updated_at = NOW() WHERE id = ?',
      [stockNuevo, producto_id]
    );

    // Registrar movimiento
    const result = await query(
      `INSERT INTO inventario_movimientos 
        (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, referencia_tipo, usuario_id, fecha, notas, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW())`,
      [
        producto_id,
        cantidad >= 0 ? 'entrada' : 'salida',
        Math.abs(cantidad),
        stockAnterior,
        stockNuevo,
        motivo || 'ajuste_manual',
        'ajuste',
        usuario_id,
        notas
      ]
    );

    logger.info(`Ajuste de inventario registrado: Producto ${producto_id}, cantidad ${cantidad}`);
    
    return successResponse(
      res, 
      'Ajuste registrado exitosamente', 
      { 
        id: result.insertId,
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo 
      }, 
      CONSTANTS.HTTP_STATUS.CREATED
    );

  } catch (error) {
    logger.error('Error al registrar ajuste:', error);
    return errorResponse(res, 'Error al registrar ajuste', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Obtener historial de un producto
 * GET /api/inventario/producto/:id
 */
export const getHistorialProducto = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const movimientos = await query(
      `SELECT 
        im.*,
        u.nombre as usuario_nombre,
        u.apellido as usuario_apellido
      FROM inventario_movimientos im
      LEFT JOIN usuarios u ON im.usuario_id = u.id
      WHERE im.producto_id = ?
      ORDER BY im.fecha DESC, im.created_at DESC
      LIMIT 100`,
      [id]
    );

    return successResponse(res, 'Historial obtenido exitosamente', movimientos, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener historial:', error);
    return errorResponse(res, 'Error al obtener historial', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};
