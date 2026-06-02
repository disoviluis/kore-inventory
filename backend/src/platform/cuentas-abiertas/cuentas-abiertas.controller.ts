/**
 * =================================
 * KORE INVENTORY - CUENTAS ABIERTAS CONTROLLER
 * Controlador para manejo de cuentas abiertas (tabs) en POS
 * Para tiendas de barrio, bares y restaurantes
 * =================================
 */

import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

/**
 * Función auxiliar para recalcular totales de cuenta
 * (Reemplaza los triggers de BD)
 */
async function recalcularTotalesCuenta(cuentaId: number): Promise<void> {
  const totalesResult = await query(
    `SELECT 
      COALESCE(SUM(subtotal), 0) as subtotal,
      COALESCE(SUM(iva_valor + impoconsumo_valor + otros_impuestos), 0) as total_impuestos,
      COALESCE(SUM(total), 0) as total
    FROM cuenta_abierta_detalle
    WHERE cuenta_abierta_id = ?`,
    [cuentaId]
  );

  const totales = totalesResult[0];

  await query(
    `UPDATE cuentas_abiertas
     SET subtotal = ?, total_impuestos = ?, total = ?
     WHERE id = ?`,
    [totales.subtotal, totales.total_impuestos, totales.total, cuentaId]
  );
}

/**
 * Función auxiliar para generar número de cuenta
 * (Reemplaza la función de BD)
 */
async function generarNumeroCuenta(empresaId: number): Promise<string> {
  const result = await query(
    `SELECT COUNT(*) + 1 as numero 
     FROM cuentas_abiertas 
     WHERE empresa_id = ?`,
    [empresaId]
  );
  
  const numero = result[0].numero;
  return `CTA-${String(numero).padStart(6, '0')}`;
}

/**
 * Crear (abrir) una nueva cuenta
 * POST /api/cuentas-abiertas
 */
export const abrirCuenta = async (req: Request, res: Response): Promise<Response> => {
  const connection = await query('SELECT 1');
  
  try {
    const {
      empresa_id,
      tipo_identificacion = 'cliente',
      mesa_numero = null,
      cliente_id = null,
      cliente_nombre,
      notas = null
    } = req.body;

    const usuarioId = (req as any).user?.id;

    // Validaciones con logs detallados
    logger.info(`abrirCuenta - Datos recibidos: empresa_id=${empresa_id}, cliente_nombre=${cliente_nombre}, usuarioId=${usuarioId}`);
    
    if (!empresa_id) {
      return errorResponse(
        res,
        'empresa_id es requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }
    
    if (!cliente_nombre) {
      return errorResponse(
        res,
        'cliente_nombre es requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }
    
    if (!usuarioId) {
      return errorResponse(
        res,
        'Usuario no autenticado correctamente',
        null,
        CONSTANTS.HTTP_STATUS.UNAUTHORIZED
      );
    }

    // Generar número de cuenta
    const numero_cuenta = await generarNumeroCuenta(empresa_id);

    // Crear cuenta abierta
    const result = await query(
      `INSERT INTO cuentas_abiertas (
        empresa_id, numero_cuenta, tipo_identificacion, mesa_numero,
        cliente_id, cliente_nombre, usuario_apertura, notas, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'abierta')`,
      [
        empresa_id,
        numero_cuenta,
        tipo_identificacion,
        mesa_numero,
        cliente_id,
        cliente_nombre,
        usuarioId,
        notas
      ]
    );

    const cuentaId = result.insertId;

    logger.info(`Cuenta abierta ${numero_cuenta} (ID: ${cuentaId}) para empresa ${empresa_id} por usuario ${usuarioId}`);

    return successResponse(
      res,
      'Cuenta abierta exitosamente',
      {
        cuenta_id: cuentaId,
        numero_cuenta,
        empresa_id,
        cliente_nombre,
        fecha_apertura: new Date()
      },
      CONSTANTS.HTTP_STATUS.CREATED
    );

  } catch (error) {
    logger.error('Error al abrir cuenta:', error);
    return errorResponse(
      res,
      'Error al abrir cuenta',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Listar cuentas abiertas de una empresa
 * GET /api/cuentas-abiertas/:empresaId?estado=abierta
 */
export const listarCuentasAbiertas = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId } = req.params;
    const { estado = 'abierta' } = req.query;

    if (!empresaId) {
      return errorResponse(
        res,
        'empresaId es requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const cuentas = await query(
      `SELECT 
        ca.id,
        ca.numero_cuenta,
        ca.tipo_identificacion,
        ca.mesa_numero,
        ca.cliente_id,
        ca.cliente_nombre,
        ca.subtotal,
        ca.total_impuestos,
        ca.total,
        ca.estado,
        ca.cuenta_solicitada,
        ca.fecha_cuenta_solicitada,
        ca.fecha_apertura,
        ca.notas,
        ca.usuario_apertura,
        u.nombre as usuario_nombre,
        (SELECT COUNT(*) FROM cuenta_abierta_detalle WHERE cuenta_abierta_id = ca.id) as items_count
      FROM cuentas_abiertas ca
      LEFT JOIN usuarios u ON ca.usuario_apertura = u.id
      WHERE ca.empresa_id = ? 
        AND ca.estado = ?
      ORDER BY ca.fecha_apertura DESC`,
      [empresaId, estado]
    );

    logger.info(`Cuentas abiertas obtenidas para empresa ${empresaId}: ${cuentas.length} registros`);

    return successResponse(
      res,
      'Cuentas obtenidas exitosamente',
      cuentas,
      CONSTANTS.HTTP_STATUS.OK
    );

  } catch (error) {
    logger.error('Error al listar cuentas abiertas:', error);
    return errorResponse(
      res,
      'Error al listar cuentas abiertas',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Obtener detalle de una cuenta específica
 * GET /api/cuentas-abiertas/:id/detalle
 */
export const obtenerDetalleCuenta = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    if (!id) {
      return errorResponse(
        res,
        'ID de cuenta es requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Obtener datos de la cuenta
    const cuentaResult = await query(
      `SELECT 
        ca.*,
        u1.nombre as usuario_apertura_nombre,
        u2.nombre as usuario_cierre_nombre,
        c.numero_documento as cliente_documento,
        c.email as cliente_email,
        c.telefono as cliente_telefono
      FROM cuentas_abiertas ca
      LEFT JOIN usuarios u1 ON ca.usuario_apertura = u1.id
      LEFT JOIN usuarios u2 ON ca.usuario_cierre = u2.id
      LEFT JOIN clientes c ON ca.cliente_id = c.id
      WHERE ca.id = ?`,
      [id]
    );

    if (cuentaResult.length === 0) {
      return errorResponse(
        res,
        'Cuenta no encontrada',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    const cuenta = cuentaResult[0];

    // Obtener items de la cuenta
    const items = await query(
      `SELECT 
        cad.*,
        u.nombre as usuario_nombre
      FROM cuenta_abierta_detalle cad
      LEFT JOIN usuarios u ON cad.usuario_id = u.id
      WHERE cad.cuenta_abierta_id = ?
      ORDER BY cad.fecha_agregado ASC`,
      [id]
    );

    return successResponse(
      res,
      'Detalle de cuenta obtenido exitosamente',
      {
        cuenta,
        items,
        totales: {
          subtotal: cuenta.subtotal,
          total_impuestos: cuenta.total_impuestos,
          total: cuenta.total,
          items_count: items.length
        }
      },
      CONSTANTS.HTTP_STATUS.OK
    );

  } catch (error) {
    logger.error('Error al obtener detalle de cuenta:', error);
    return errorResponse(
      res,
      'Error al obtener detalle de cuenta',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Agregar item a cuenta abierta
 * POST /api/cuentas-abiertas/:id/items
 */
export const agregarItemCuenta = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const {
      producto_id,
      cantidad = 1,
      precio_unitario,
      notas = null
    } = req.body;

    const usuarioId = (req as any).user?.id;

    // Validaciones
    if (!id || !producto_id || !precio_unitario) {
      return errorResponse(
        res,
        'Campos requeridos: producto_id, precio_unitario',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Verificar que la cuenta existe y está abierta
    const cuentaResult = await query(
      `SELECT id, empresa_id, estado FROM cuentas_abiertas WHERE id = ?`,
      [id]
    );

    if (cuentaResult.length === 0) {
      return errorResponse(
        res,
        'Cuenta no encontrada',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    if (cuentaResult[0].estado !== 'abierta') {
      return errorResponse(
        res,
        'La cuenta ya está cerrada o cancelada',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Obtener información del producto
    const productoResult = await query(
      `SELECT 
        id, nombre, sku, stock_actual, aplica_iva, porcentaje_iva,
        permite_venta_sin_stock
      FROM productos
      WHERE id = ? AND estado = 'activo'`,
      [producto_id]
    );

    if (productoResult.length === 0) {
      return errorResponse(
        res,
        'Producto no encontrado o inactivo',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    const producto = productoResult[0];

    // Verificar stock
    if (!producto.permite_venta_sin_stock && producto.stock_actual < cantidad) {
      return errorResponse(
        res,
        `Stock insuficiente. Disponible: ${producto.stock_actual}`,
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Calcular totales
    const subtotal = precio_unitario * cantidad;
    const iva_porcentaje = producto.aplica_iva ? producto.porcentaje_iva : 0;
    const iva_valor = (subtotal * iva_porcentaje) / 100;
    const impoconsumo_porcentaje = 0; // Por ahora no se maneja impoconsumo
    const impoconsumo_valor = 0;
    const total = subtotal + iva_valor + impoconsumo_valor;

    // Insertar item
    const result = await query(
      `INSERT INTO cuenta_abierta_detalle (
        cuenta_abierta_id, producto_id, producto_nombre, producto_sku,
        cantidad, precio_unitario, subtotal,
        iva_porcentaje, iva_valor, impoconsumo_porcentaje, impoconsumo_valor,
        total, usuario_id, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, producto_id, producto.nombre, producto.sku,
        cantidad, precio_unitario, subtotal,
        iva_porcentaje, iva_valor, impoconsumo_porcentaje, impoconsumo_valor,
        total, usuarioId, notas
      ]
    );

    // Descontar del inventario
    await query(
      `UPDATE productos 
       SET stock_actual = stock_actual - ?
       WHERE id = ?`,
      [cantidad, producto_id]
    );

    // Registrar movimiento de inventario
    await query(
      `INSERT INTO inventario_movimientos (
        empresa_id, producto_id, tipo_movimiento, cantidad, observacion, usuario_id
      ) VALUES (?, ?, 'salida', ?, ?, ?)`,
      [cuentaResult[0].empresa_id, producto_id, cantidad, `Agregado a cuenta abierta #${id}`, usuarioId]
    );

    // Recalcular totales de la cuenta
    await recalcularTotalesCuenta(parseInt(id));

    logger.info(`Item agregado a cuenta ${id}: ${producto.nombre} x${cantidad}`);

    return successResponse(
      res,
      'Item agregado exitosamente',
      {
        item_id: result.insertId,
        producto_nombre: producto.nombre,
        cantidad,
        total
      },
      CONSTANTS.HTTP_STATUS.CREATED
    );

  } catch (error) {
    logger.error('Error al agregar item a cuenta:', error);
    return errorResponse(
      res,
      'Error al agregar item a cuenta',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Eliminar item de cuenta abierta
 * DELETE /api/cuentas-abiertas/:id/items/:itemId
 */
export const eliminarItemCuenta = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id, itemId } = req.params;
    const usuarioId = (req as any).user?.id;

    // Obtener información del item antes de eliminarlo
    const itemResult = await query(
      `SELECT cad.*, ca.empresa_id, ca.estado
       FROM cuenta_abierta_detalle cad
       INNER JOIN cuentas_abiertas ca ON cad.cuenta_abierta_id = ca.id
       WHERE cad.id = ? AND cad.cuenta_abierta_id = ?`,
      [itemId, id]
    );

    if (itemResult.length === 0) {
      return errorResponse(
        res,
        'Item no encontrado',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    const item = itemResult[0];

    if (item.estado !== 'abierta') {
      return errorResponse(
        res,
        'No se puede eliminar un item de una cuenta cerrada',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Eliminar item
    await query(
      `DELETE FROM cuenta_abierta_detalle WHERE id = ?`,
      [itemId]
    );

    // Reversar inventario
    await query(
      `UPDATE productos 
       SET stock_actual = stock_actual + ?
       WHERE id = ?`,
      [item.cantidad, item.producto_id]
    );

    // Registrar movimiento de inventario
    await query(
      `INSERT INTO inventario_movimientos (
        empresa_id, producto_id, tipo_movimiento, cantidad, observacion, usuario_id
      ) VALUES (?, ?, 'entrada', ?, ?, ?)`,
      [item.empresa_id, item.producto_id, item.cantidad, `Eliminado de cuenta abierta #${id}`, usuarioId]
    );

    // Recalcular totales de la cuenta
    await recalcularTotalesCuenta(parseInt(id));

    logger.info(`Item ${itemId} eliminado de cuenta ${id}`);

    return successResponse(
      res,
      'Item eliminado exitosamente',
      null,
      CONSTANTS.HTTP_STATUS.OK
    );

  } catch (error) {
    logger.error('Error al eliminar item de cuenta:', error);
    return errorResponse(
      res,
      'Error al eliminar item de cuenta',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Marcar que el cliente pidió la cuenta (solo para estadísticas)
 * POST /api/cuentas-abiertas/:id/solicitar-cuenta
 */
export const solicitarCuenta = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    await query(
      `UPDATE cuentas_abiertas
       SET cuenta_solicitada = TRUE, fecha_cuenta_solicitada = NOW()
       WHERE id = ? AND estado = 'abierta'`,
      [id]
    );

    logger.info(`Cuenta ${id} marcada como solicitada`);

    return successResponse(
      res,
      'Cuenta solicitada marcada',
      null,
      CONSTANTS.HTTP_STATUS.OK
    );

  } catch (error) {
    logger.error('Error al marcar cuenta solicitada:', error);
    return errorResponse(
      res,
      'Error al marcar cuenta solicitada',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Cerrar cuenta y convertir en venta
 * POST /api/cuentas-abiertas/:id/cerrar
 */
export const cerrarCuenta = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const {
      metodo_pago = 'efectivo',
      monto_recibido,
      notas = null,
      pagos = [] // Para pagos múltiples
    } = req.body;

    const usuarioId = (req as any).user?.id;

    // Obtener datos de la cuenta
    const cuentaResult = await query(
      `SELECT * FROM cuentas_abiertas WHERE id = ?`,
      [id]
    );

    if (cuentaResult.length === 0) {
      return errorResponse(
        res,
        'Cuenta no encontrada',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    const cuenta = cuentaResult[0];

    if (cuenta.estado !== 'abierta') {
      return errorResponse(
        res,
        'La cuenta ya está cerrada o cancelada',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Obtener items de la cuenta
    const items = await query(
      `SELECT * FROM cuenta_abierta_detalle WHERE cuenta_abierta_id = ?`,
      [id]
    );

    if (items.length === 0) {
      return errorResponse(
        res,
        'No se puede cerrar una cuenta sin items',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Generar número de factura
    const contadorResult = await query(
      `SELECT COUNT(*) + 1 as contador FROM ventas WHERE empresa_id = ?`,
      [cuenta.empresa_id]
    );
    const contador = contadorResult[0].contador;
    const numero_factura = `FACT-${String(contador).padStart(6, '0')}`;

    // Crear venta
    const ventaResult = await query(
      `INSERT INTO ventas (
        empresa_id, numero_factura, cliente_id, vendedor_id,
        subtotal, total_impuestos, total, metodo_pago,
        monto_recibido, cambio, observaciones, fecha_venta, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'completada')`,
      [
        cuenta.empresa_id,
        numero_factura,
        cuenta.cliente_id,
        usuarioId,
        cuenta.subtotal,
        cuenta.total_impuestos,
        cuenta.total,
        metodo_pago,
        monto_recibido || cuenta.total,
        (monto_recibido || cuenta.total) - cuenta.total,
        notas || `Cuenta abierta cerrada: ${cuenta.numero_cuenta}`
      ]
    );

    const ventaId = ventaResult.insertId;

    // Insertar detalle de venta
    for (const item of items) {
      await query(
        `INSERT INTO venta_detalle (
          venta_id, producto_id, cantidad, precio_unitario, subtotal,
          iva_porcentaje, iva_valor, impoconsumo_porcentaje, impoconsumo_valor, total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ventaId,
          item.producto_id,
          item.cantidad,
          item.precio_unitario,
          item.subtotal,
          item.iva_porcentaje,
          item.iva_valor,
          item.impoconsumo_porcentaje,
          item.impoconsumo_valor,
          item.total
        ]
      );
    }

    // Cerrar cuenta
    await query(
      `UPDATE cuentas_abiertas
       SET estado = 'cerrada', venta_id = ?, usuario_cierre = ?, fecha_cierre = NOW()
       WHERE id = ?`,
      [ventaId, usuarioId, id]
    );

    logger.info(`Cuenta ${cuenta.numero_cuenta} cerrada y convertida en venta ${numero_factura}`);

    return successResponse(
      res,
      'Cuenta cerrada exitosamente',
      {
        venta_id: ventaId,
        numero_factura,
        total: cuenta.total,
        cambio: (monto_recibido || cuenta.total) - cuenta.total
      },
      CONSTANTS.HTTP_STATUS.OK
    );

  } catch (error) {
    logger.error('Error al cerrar cuenta:', error);
    return errorResponse(
      res,
      'Error al cerrar cuenta',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Cancelar cuenta (reversar inventario)
 * DELETE /api/cuentas-abiertas/:id
 */
export const cancelarCuenta = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { motivo = 'Cancelada por usuario' } = req.body;
    const usuarioId = (req as any).user?.id;

    //Obtener cuenta
    const cuentaResult = await query(
      `SELECT * FROM cuentas_abiertas WHERE id = ?`,
      [id]
    );

    if (cuentaResult.length === 0) {
      return errorResponse(
        res,
        'Cuenta no encontrada',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    const cuenta = cuentaResult[0];

    if (cuenta.estado !== 'abierta') {
      return errorResponse(
        res,
        'Solo se pueden cancelar cuentas abiertas',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Obtener items para reversar inventario
    const items = await query(
      `SELECT * FROM cuenta_abierta_detalle WHERE cuenta_abierta_id = ?`,
      [id]
    );

    // Reversar inventario
    for (const item of items) {
      await query(
        `UPDATE productos 
         SET stock_actual = stock_actual + ?
         WHERE id = ?`,
        [item.cantidad, item.producto_id]
      );

      // Registrar movimiento
      await query(
        `INSERT INTO inventario_movimientos (
          empresa_id, producto_id, tipo_movimiento, cantidad, observacion, usuario_id
        ) VALUES (?, ?, 'entrada', ?, ?, ?)`,
        [cuenta.empresa_id, item.producto_id, item.cantidad, `Cancelación de cuenta ${cuenta.numero_cuenta}: ${motivo}`, usuarioId]
      );
    }

    // Marcar cuenta como cancelada
    await query(
      `UPDATE cuentas_abiertas
       SET estado = 'cancelada', usuario_cierre = ?, fecha_cierre = NOW(), notas = CONCAT(COALESCE(notas, ''), '\nMotivo cancelación: ', ?)
       WHERE id = ?`,
      [usuarioId, motivo, id]
    );

    logger.info(`Cuenta ${cuenta.numero_cuenta} cancelada. Motivo: ${motivo}`);

    return successResponse(
      res,
      'Cuenta cancelada exitosamente',
      { items_reversados: items.length },
      CONSTANTS.HTTP_STATUS.OK
    );

  } catch (error) {
    logger.error('Error al cancelar cuenta:', error);
    return errorResponse(
      res,
      'Error al cancelar cuenta',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};
