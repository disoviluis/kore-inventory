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

    // Obtener items de la cuenta con datos del producto
    const items = await query(
      `SELECT 
        cad.*,
        p.nombre as producto_nombre,
        p.sku as producto_sku,
        p.aplica_iva,
        p.porcentaje_iva,
        u.nombre as usuario_nombre
      FROM cuenta_abierta_detalle cad
      LEFT JOIN productos p ON cad.producto_id = p.id
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
    const bodegaId = (req as any).user?.bodega_id || null;

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

    // Verificar stock según si el cajero tiene bodega asignada o no
    let stockDisponible = producto.stock_actual;

    if (bodegaId) {
      // Verificar stock en la bodega específica del cajero
      const stockBodegaResult = await query(
        `SELECT stock_disponible FROM productos_bodegas WHERE producto_id = ? AND bodega_id = ?`,
        [producto_id, bodegaId]
      );
      stockDisponible = stockBodegaResult.length > 0 ? stockBodegaResult[0].stock_disponible : 0;
    }

    // Verificar stock insuficiente
    if (!producto.permite_venta_sin_stock && stockDisponible < cantidad) {
      // Obtener disponibilidad en otras bodegas de la empresa
      const cuentaEmpresaId = cuentaResult[0].empresa_id;
      const otrasBogegas = await query(
        `SELECT b.nombre as bodega_nombre, b.tipo, pb.stock_disponible
         FROM productos_bodegas pb
         INNER JOIN bodegas b ON pb.bodega_id = b.id
         WHERE pb.producto_id = ? AND b.empresa_id = ? AND pb.stock_disponible > 0
         ORDER BY pb.stock_disponible DESC`,
        [producto_id, cuentaEmpresaId]
      );

      return errorResponse(
        res,
        `Stock insuficiente en esta tienda. Disponible: ${stockDisponible}`,
        { stock_en_tienda: stockDisponible, disponibilidad_otras_bodegas: otrasBogegas },
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Calcular totales
    const subtotal = precio_unitario * cantidad;
    const iva_porcentaje = producto.aplica_iva ? (producto.porcentaje_iva || 19) : 0;
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

    // Obtener stock actual antes de descontar
    const stockAnterior = producto.stock_actual;
    const stockNuevo = stockAnterior - cantidad;

    // Descontar del inventario global
    await query(
      `UPDATE productos 
       SET stock_actual = stock_actual - ?
       WHERE id = ?`,
      [cantidad, producto_id]
    );

    // Descontar del inventario de la bodega del cajero (si tiene bodega asignada)
    if (bodegaId) {
      await query(
        `UPDATE productos_bodegas 
         SET stock_actual = stock_actual - ?,
             stock_disponible = stock_disponible - ?
         WHERE producto_id = ? AND bodega_id = ?`,
        [cantidad, cantidad, producto_id, bodegaId]
      );
    }

    // Registrar movimiento de inventario
    await query(
      `INSERT INTO inventario_movimientos (
        producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id
      ) VALUES (?, 'salida', ?, ?, ?, ?, ?)`,
      [producto_id, cantidad, stockAnterior, stockNuevo, `Agregado a cuenta abierta #${id}`, usuarioId]
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
 * Actualizar item de cuenta abierta (cantidad o precio)
 * PUT /api/cuentas-abiertas/:id/items/:itemId
 */
export const actualizarItemCuenta = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id, itemId } = req.params;
    const { cantidad, precio_unitario } = req.body;
    const usuarioId = (req as any).user?.id;

    // Al menos uno debe estar presente
    if (!cantidad && !precio_unitario) {
      return errorResponse(
        res,
        'Debe proporcionar al menos cantidad o precio_unitario',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Obtener información del item actual
    const itemResult = await query(
      `SELECT cad.*, ca.empresa_id, ca.estado, p.nombre as producto_nombre
       FROM cuenta_abierta_detalle cad
       INNER JOIN cuentas_abiertas ca ON cad.cuenta_abierta_id = ca.id
       INNER JOIN productos p ON cad.producto_id = p.id
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
        'No se puede actualizar un item de una cuenta cerrada',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const cantidadAnterior = item.cantidad;
    const precioAnterior = item.precio_unitario;
    const nuevaCantidad = cantidad !== undefined ? parseFloat(cantidad) : cantidadAnterior;
    const nuevoPrecio = precio_unitario !== undefined ? parseFloat(precio_unitario) : precioAnterior;

    if (nuevaCantidad <= 0) {
      return errorResponse(
        res,
        'La cantidad debe ser mayor a 0',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Calcular nuevos totales
    const subtotal = nuevaCantidad * nuevoPrecio;
    const ivaValor = item.iva_porcentaje ? (subtotal * item.iva_porcentaje / 100) : 0;
    const impoconsumoValor = item.impoconsumo_porcentaje ? (subtotal * item.impoconsumo_porcentaje / 100) : 0;
    const total = subtotal + ivaValor + impoconsumoValor;

    // Actualizar el item
    await query(
      `UPDATE cuenta_abierta_detalle 
       SET cantidad = ?, 
           precio_unitario = ?,
           subtotal = ?,
           iva_valor = ?,
           impoconsumo_valor = ?,
           total = ?
       WHERE id = ?`,
      [nuevaCantidad, nuevoPrecio, subtotal, ivaValor, impoconsumoValor, total, itemId]
    );

    // Ajustar inventario si cambió la cantidad
    if (cantidad !== undefined && nuevaCantidad !== cantidadAnterior) {
      const diferencia = nuevaCantidad - cantidadAnterior;
      
      // Obtener stock actual
      const productoResult = await query(
        `SELECT stock_actual FROM productos WHERE id = ?`,
        [item.producto_id]
      );
      const stockAnterior = productoResult[0]?.stock_actual || 0;
      const stockNuevo = stockAnterior - diferencia; // Si aumentó cantidad, reduce stock

      // Actualizar stock global
      await query(
        `UPDATE productos 
         SET stock_actual = stock_actual - ?
         WHERE id = ?`,
        [diferencia, item.producto_id]
      );

      // Obtener bodega del usuario que agregó el item originalmente
      const usuarioBodegaResult = await query(
        `SELECT bodega_id FROM usuarios WHERE id = ?`,
        [item.usuario_id]
      );
      const bodegaId = usuarioBodegaResult[0]?.bodega_id || null;

      // Actualizar stock en la bodega del cajero (si tenía bodega asignada)
      if (bodegaId) {
        await query(
          `UPDATE productos_bodegas 
           SET stock_actual = stock_actual - ?,
               stock_disponible = stock_disponible - ?
           WHERE producto_id = ? AND bodega_id = ?`,
          [diferencia, diferencia, item.producto_id, bodegaId]
        );
      }

      // Registrar movimiento de inventario
      const tipoMovimiento = diferencia > 0 ? 'salida' : 'entrada';
      const cantidadMovimiento = Math.abs(diferencia);
      await query(
        `INSERT INTO inventario_movimientos (
          producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.producto_id, 
          tipoMovimiento, 
          cantidadMovimiento, 
          stockAnterior, 
          stockNuevo, 
          `Actualización cantidad en cuenta abierta #${id}`, 
          usuarioId
        ]
      );
    }

    // Recalcular totales de la cuenta
    await recalcularTotalesCuenta(parseInt(id));

    logger.info(`Item ${itemId} actualizado en cuenta ${id}: ${item.producto_nombre} - cantidad: ${cantidadAnterior} → ${nuevaCantidad}`);

    return successResponse(
      res,
      'Item actualizado exitosamente',
      {
        item_id: itemId,
        producto_nombre: item.producto_nombre,
        cantidad_anterior: cantidadAnterior,
        cantidad_nueva: nuevaCantidad,
        precio_anterior: precioAnterior,
        precio_nuevo: nuevoPrecio,
        total_nuevo: total
      },
      CONSTANTS.HTTP_STATUS.OK
    );

  } catch (error) {
    logger.error('Error al actualizar item de cuenta:', error);
    return errorResponse(
      res,
      'Error al actualizar item de cuenta',
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

    // Obtener stock actual antes de reversar
    const productoResult = await query(
      `SELECT stock_actual FROM productos WHERE id = ?`,
      [item.producto_id]
    );
    const stockAnterior = productoResult[0]?.stock_actual || 0;
    const stockNuevo = stockAnterior + item.cantidad;

    // Reversar inventario global
    await query(
      `UPDATE productos 
       SET stock_actual = stock_actual + ?
       WHERE id = ?`,
      [item.cantidad, item.producto_id]
    );

    // Obtener bodega del usuario que agregó el item
    const usuarioBodegaResult = await query(
      `SELECT bodega_id FROM usuarios WHERE id = ?`,
      [item.usuario_id]
    );
    const bodegaIdItem = usuarioBodegaResult[0]?.bodega_id || null;

    // Reversar stock en la bodega del cajero (si tenía bodega asignada)
    if (bodegaIdItem) {
      await query(
        `UPDATE productos_bodegas 
         SET stock_actual = stock_actual + ?,
             stock_disponible = stock_disponible + ?
         WHERE producto_id = ? AND bodega_id = ?`,
        [item.cantidad, item.cantidad, item.producto_id, bodegaIdItem]
      );
    }

    // Registrar movimiento de inventario
    await query(
      `INSERT INTO inventario_movimientos (
        producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id
      ) VALUES (?, 'entrada', ?, ?, ?, ?, ?)`,
      [item.producto_id, item.cantidad, stockAnterior, stockNuevo, `Eliminado de cuenta abierta #${id}`, usuarioId]
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
      empresa_id, // Requerido
      metodo_pago = 'efectivo', // Para compatibilidad con versión anterior
      monto_recibido, // Para compatibilidad con versión anterior
      notas = null,
      pagos = [] // Array de pagos múltiples
    } = req.body;

    // Validar empresa_id
    if (!empresa_id) {
      return errorResponse(
        res,
        'empresa_id requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

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

    // Calcular total de pagos
    let totalPagado = 0;
    let metodoPagoResumen = metodo_pago;
    
    if (pagos && Array.isArray(pagos) && pagos.length > 0) {
      totalPagado = pagos.reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);
      metodoPagoResumen = pagos.length === 1 ? pagos[0].metodo_pago : 'Múltiple';
    } else if (monto_recibido) {
      // Compatibilidad con versión anterior (sin array de pagos)
      totalPagado = parseFloat(monto_recibido);
    } else {
      totalPagado = cuenta.total;
    }

    const cambio = totalPagado - cuenta.total;

    // Generar número de factura
    const contadorResult = await query(
      `SELECT COUNT(*) + 1 as contador FROM ventas WHERE empresa_id = ?`,
      [cuenta.empresa_id]
    );
    const contador = contadorResult[0].contador;
    const numero_factura = `FACT-${String(contador).padStart(6, '0')}`;

    // Manejar cliente_id NULL (para tabs rápidos sin cliente registrado)
    let clienteIdFinal = cuenta.cliente_id;
    
    if (!clienteIdFinal) {
      // Buscar o crear cliente genérico "Mostrador"
      const clienteGenericoResult = await query(
        `SELECT id FROM clientes WHERE empresa_id = ? AND nombre = 'Mostrador' LIMIT 1`,
        [cuenta.empresa_id]
      );
      
      if (clienteGenericoResult.length > 0) {
        clienteIdFinal = clienteGenericoResult[0].id;
      } else {
        // Crear cliente genérico
        const nuevoClienteResult = await query(
          `INSERT INTO clientes (empresa_id, nombre, tipo_documento, numero_documento, telefono, direccion, estado)
           VALUES (?, 'Mostrador', 'NIT', '222222222', '', 'Punto de Venta', 'activo')`,
          [cuenta.empresa_id]
        );
        clienteIdFinal = nuevoClienteResult.insertId;
        logger.info(`Cliente genérico 'Mostrador' creado para empresa ${cuenta.empresa_id}`);
      }
    }

    // Preparar nombre descriptivo para la venta
    let nombreDescriptivo = '';
    if (cuenta.tipo_identificacion === 'mesa') {
      nombreDescriptivo = `Mesa ${cuenta.mesa_numero}`;
    } else if (cuenta.tipo_identificacion === 'tab_nombre') {
      nombreDescriptivo = cuenta.cliente_nombre;
    } else if (cuenta.cliente_nombre) {
      nombreDescriptivo = cuenta.cliente_nombre;
    }
    
    const observacionesVenta = notas || 
      `${nombreDescriptivo} (${cuenta.numero_cuenta})`;

    // Crear venta
    const ventaResult = await query(
      `INSERT INTO ventas (
        empresa_id, numero_factura, cliente_id, vendedor_id,
        fecha_venta, subtotal, impuesto, total, metodo_pago,
        observaciones, estado, forma_pago
      ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, 'pagada', 'contado')`,
      [
        cuenta.empresa_id,
        numero_factura,
        clienteIdFinal, // Usar cliente genérico si es NULL
        usuarioId,
        cuenta.subtotal,
        cuenta.total_impuestos, // En cuentas_abiertas es total_impuestos, en ventas es impuesto
        cuenta.total,
        metodoPagoResumen,
        observacionesVenta
      ]
    );

    const ventaId = ventaResult.insertId;

    // Insertar detalle de venta
    for (const item of items) {
      await query(
        `INSERT INTO venta_detalle (
          venta_id, producto_id, cantidad, precio_unitario, subtotal
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          ventaId,
          item.producto_id,
          item.cantidad,
          item.precio_unitario,
          item.total // El total del item es el subtotal en venta_detalle
        ]
      );
    }

    // Insertar pagos múltiples
    if (pagos && Array.isArray(pagos) && pagos.length > 0) {
      for (const pago of pagos) {
        await query(
          `INSERT INTO venta_pagos (
            venta_id, metodo_pago, monto, referencia, banco, notas
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            ventaId,
            pago.metodo_pago,
            pago.monto,
            pago.referencia || null,
            pago.banco || null,
            pago.notas || null
          ]
        );
      }
      logger.info(`${pagos.length} métodos de pago registrados para venta ${numero_factura}`);
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
        cambio
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
      // Obtener stock actual antes de reversar
      const productoResult = await query(
        `SELECT stock_actual FROM productos WHERE id = ?`,
        [item.producto_id]
      );
      const stockAnterior = productoResult[0]?.stock_actual || 0;
      const stockNuevo = stockAnterior + item.cantidad;

      // Reversar inventario global
      await query(
        `UPDATE productos 
         SET stock_actual = stock_actual + ?
         WHERE id = ?`,
        [item.cantidad, item.producto_id]
      );

      // Obtener bodega del usuario que agregó el item
      const usuarioBodegaResult = await query(
        `SELECT bodega_id FROM usuarios WHERE id = ?`,
        [item.usuario_id]
      );
      const bodegaIdItem = usuarioBodegaResult[0]?.bodega_id || null;

      // Reversar stock en la bodega del cajero (si tenía bodega asignada)
      if (bodegaIdItem) {
        await query(
          `UPDATE productos_bodegas 
           SET stock_actual = stock_actual + ?,
               stock_disponible = stock_disponible + ?
           WHERE producto_id = ? AND bodega_id = ?`,
          [item.cantidad, item.cantidad, item.producto_id, bodegaIdItem]
        );
      }

      // Registrar movimiento
      await query(
        `INSERT INTO inventario_movimientos (
          producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id
        ) VALUES (?, 'entrada', ?, ?, ?, ?, ?)`,
        [item.producto_id, item.cantidad, stockAnterior, stockNuevo, `Cancelación de cuenta ${cuenta.numero_cuenta}: ${motivo}`, usuarioId]
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
