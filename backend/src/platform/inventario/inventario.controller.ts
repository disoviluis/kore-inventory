/**
 * =================================
 * KORE INVENTORY - INVENTARIO CONTROLLER
 * Controlador de movimientos de inventario
 * =================================
 */

import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
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
        precio_minorista as precio_venta,
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
    const { producto_id, cantidad, motivo, notas, bodega_id } = req.body;
    const usuario = (req as any).user;

    if (!producto_id || cantidad === undefined) {
      return errorResponse(
        res,
        'Producto ID y cantidad son requeridos',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    if (!usuario?.id) {
      return errorResponse(res, 'Usuario no autenticado', null, CONSTANTS.HTTP_STATUS.UNAUTHORIZED);
    }

    // La bodega se toma del usuario o de la bodega principal cuando el usuario no tiene una asignada.
    const productos = await query(
      'SELECT id, stock_actual, empresa_id FROM productos WHERE id = ? AND estado = "activo"',
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
    const bodegaId = bodega_id || usuario.bodega_id || (await query(
      'SELECT id FROM bodegas WHERE empresa_id = ? AND es_principal = 1 AND estado = "activa" LIMIT 1',
      [producto.empresa_id]
    ))[0]?.id;

    if (!bodegaId) {
      return errorResponse(res, 'Debe existir una bodega para registrar el ajuste', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    const result = await withTransaction(async (txQuery) => {
      const bodegas = await txQuery(
        'SELECT id FROM bodegas WHERE id = ? AND empresa_id = ? AND estado = "activa" LIMIT 1',
        [bodegaId, producto.empresa_id]
      );
      if (bodegas.length === 0) throw new Error('La bodega no pertenece a la empresa o está inactiva');

      const filasStock = await txQuery(
        'SELECT stock_actual FROM productos_bodegas WHERE producto_id = ? AND bodega_id = ? FOR UPDATE',
        [producto_id, bodegaId]
      );
      const stockAnterior = filasStock.length > 0 ? Number(filasStock[0].stock_actual) : 0;
      const stockNuevo = stockAnterior + Number(cantidad);
      if (stockNuevo < 0) throw new Error('El ajuste resultaría en stock negativo');

      if (filasStock.length > 0) {
        await txQuery(
          'UPDATE productos_bodegas SET stock_actual = ? WHERE producto_id = ? AND bodega_id = ?',
          [stockNuevo, producto_id, bodegaId]
        );
      } else {
        await txQuery(
          'INSERT INTO productos_bodegas (producto_id, bodega_id, stock_actual) VALUES (?, ?, ?)',
          [producto_id, bodegaId, stockNuevo]
        );
      }

      const totalGlobal: any[] = await txQuery(
        'SELECT COALESCE(SUM(stock_actual), 0) AS total FROM productos_bodegas WHERE producto_id = ?',
        [producto_id]
      );
      await txQuery('UPDATE productos SET stock_actual = ?, updated_at = NOW() WHERE id = ?', [totalGlobal[0].total, producto_id]);

      return txQuery(
        `INSERT INTO inventario_movimientos
          (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, referencia_tipo, usuario_id, fecha, notas, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW())`,
        [producto_id, Number(cantidad) >= 0 ? 'entrada' : 'salida', Math.abs(Number(cantidad)), stockAnterior, stockNuevo,
          motivo || 'ajuste_manual', 'ajuste', usuario.id, notas]
      );
    });

    logger.info(`Ajuste de inventario registrado: Producto ${producto_id}, cantidad ${cantidad}`);
    
    return successResponse(
      res, 
      'Ajuste registrado exitosamente', 
      { 
        id: result.insertId,
        bodega_id: bodegaId,
        movimiento_id: result.insertId
      }, 
      CONSTANTS.HTTP_STATUS.CREATED
    );

  } catch (error) {
    logger.error('Error al registrar ajuste:', error);
    return errorResponse(res, 'Error al registrar ajuste', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Aplicar diferencias de un conteo físico en una sola transacción.
 * POST /api/inventario/ajuste-masivo
 */
export const registrarAjusteMasivo = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { bodega_id, ajustes, notas } = req.body;
    const usuario = (req as any).user;
    if (!usuario?.id) return errorResponse(res, 'Usuario no autenticado', null, CONSTANTS.HTTP_STATUS.UNAUTHORIZED);
    if (!bodega_id || !Array.isArray(ajustes) || ajustes.length === 0) {
      return errorResponse(res, 'Bodega y ajustes son requeridos', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    const productoIds = ajustes.map((ajuste: any) => Number(ajuste.producto_id));
    if (productoIds.some((id: number) => !Number.isInteger(id) || id <= 0) || new Set(productoIds).size !== productoIds.length) {
      return errorResponse(res, 'La carga contiene productos inválidos o duplicados', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    const result = await withTransaction(async (txQuery) => {
      const bodegas = await txQuery('SELECT id, empresa_id FROM bodegas WHERE id = ? AND estado = "activa" LIMIT 1', [bodega_id]);
      if (bodegas.length === 0) throw new Error('La bodega no existe o está inactiva');
      const empresaId = bodegas[0].empresa_id;
      const aplicados: any[] = [];

      for (const ajuste of ajustes) {
        const cantidad = Number(ajuste.cantidad);
        if (!Number.isInteger(cantidad)) throw new Error(`Cantidad inválida para el producto ${ajuste.producto_id}`);
        const productos = await txQuery('SELECT id FROM productos WHERE id = ? AND empresa_id = ? AND estado = "activo" LIMIT 1', [ajuste.producto_id, empresaId]);
        if (productos.length === 0) throw new Error(`Producto no válido para esta empresa: ${ajuste.producto_id}`);

        const filasStock = await txQuery('SELECT stock_actual FROM productos_bodegas WHERE producto_id = ? AND bodega_id = ? FOR UPDATE', [ajuste.producto_id, bodega_id]);
        const anterior = filasStock.length > 0 ? Number(filasStock[0].stock_actual) : 0;
        const nuevo = anterior + cantidad;
        if (nuevo < 0) throw new Error(`El ajuste dejaría stock negativo para el producto ${ajuste.producto_id}`);
        if (cantidad === 0) continue;

        if (filasStock.length > 0) {
          await txQuery('UPDATE productos_bodegas SET stock_actual = ? WHERE producto_id = ? AND bodega_id = ?', [nuevo, ajuste.producto_id, bodega_id]);
        } else {
          await txQuery('INSERT INTO productos_bodegas (producto_id, bodega_id, stock_actual) VALUES (?, ?, ?)', [ajuste.producto_id, bodega_id, nuevo]);
        }
        const totalGlobal: any[] = await txQuery('SELECT COALESCE(SUM(stock_actual), 0) AS total FROM productos_bodegas WHERE producto_id = ?', [ajuste.producto_id]);
        await txQuery('UPDATE productos SET stock_actual = ?, updated_at = NOW() WHERE id = ?', [totalGlobal[0].total, ajuste.producto_id]);
        const movimiento: any = await txQuery(
          `INSERT INTO inventario_movimientos
            (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, referencia_tipo, usuario_id, fecha, notas, created_at)
           VALUES (?, ?, ?, ?, ?, 'inventario_fisico', 'ajuste', ?, NOW(), ?, NOW())`,
          [ajuste.producto_id, cantidad > 0 ? 'entrada' : 'salida', Math.abs(cantidad), anterior, nuevo, usuario.id, ajuste.observaciones || notas || null]
        );
        aplicados.push({
          producto_id: ajuste.producto_id,
          diferencia: cantidad,
          stock_anterior: anterior,
          stock_nuevo: nuevo,
          movimiento_id: movimiento.insertId
        });
      }
      return aplicados;
    });

    return successResponse(res, 'Inventario físico aplicado exitosamente', { aplicados: result.length, cambios: result }, CONSTANTS.HTTP_STATUS.OK);
  } catch (error: any) {
    logger.error('Error en ajuste masivo:', error);
    return errorResponse(res, error.message || 'Error al aplicar inventario físico', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
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
