/**
 * =================================
 * KORE INVENTORY - CUENTAS ABIERTAS CONTROLLER
 * Controlador para manejo de cuentas abiertas (tabs) en POS
 * Para tiendas de barrio, bares y restaurantes
 * =================================
 */

import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';
import { moverStock } from '../../shared/inventario';
import { assertPlanQuota } from '../../core/auth/subscription.service';
import { calcular, conciliarPagos, centavos, ErrorCalculo } from '../../../../frontend/public/assets/js/pos-calculos';
import { generarNumeroFactura } from '../../shared/dian-utils';

/**
 * Función auxiliar para recalcular totales de cuenta
 * (Reemplaza los triggers de BD)
 */
async function recalcularTotalesCuenta(cuentaId: number, tx: typeof query): Promise<void> {
  const totalesResult = await tx(
    `SELECT 
      COALESCE(SUM(subtotal), 0) as subtotal,
      COALESCE(SUM(iva_valor + impoconsumo_valor + otros_impuestos), 0) as total_impuestos,
      COALESCE(SUM(total), 0) as total
    FROM cuenta_abierta_detalle
    WHERE cuenta_abierta_id = ?`,
    [cuentaId]
  );

  const totales = totalesResult[0];

  await tx(
    `UPDATE cuentas_abiertas
     SET subtotal = ?, total_impuestos = ?, total = ?
     WHERE id = ?`,
    [totales.subtotal, totales.total_impuestos, totales.total, cuentaId]
  );
}

async function bloquearCuentaAbierta(tx: typeof query, cuentaId: string): Promise<void> {
  const cuentas = await tx('SELECT estado FROM cuentas_abiertas WHERE id = ? FOR UPDATE', [cuentaId]);
  if (!cuentas.length || cuentas[0].estado !== 'abierta') throw new ErrorCalculo('La cuenta ya no esta abierta; actualice el POS');
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
        p.iva_incluido_en_precio,
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
        id, nombre, sku, stock_actual, aplica_iva, porcentaje_iva, tipo_impuesto, iva_incluido_en_precio,
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

    // Calcular totales
    const calculo = calcular({ productos: [{ ...producto, cantidad, precio_unitario }] });
    const subtotal = calculo.subtotal;
    const iva_porcentaje = Number(producto.aplica_iva) === 1 && (!producto.tipo_impuesto || producto.tipo_impuesto === 'gravado')
      ? Number(producto.porcentaje_iva) : 0;
    const iva_valor = calculo.impuesto;
    const impoconsumo_porcentaje = 0; // Por ahora no se maneja impoconsumo
    const impoconsumo_valor = 0;
    const total = calculo.total;

    const result = await withTransaction(async (txQuery) => {
      await bloquearCuentaAbierta(txQuery, id);
      const insercion = await txQuery(
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

      await moverStock(txQuery, {
        productoId: Number(producto_id),
        cantidad: Number(cantidad),
        bodegaId,
        usuarioId,
        signo: -1,
        motivo: `Agregado a cuenta abierta #${id}`,
        referenciaTipo: 'venta',
        referenciaId: Number(id)
      });

      await recalcularTotalesCuenta(parseInt(id), txQuery);
      return insercion;
    });

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

  } catch (error: any) {
    logger.error('Error al agregar item a cuenta:', error);
    return errorResponse(
      res,
      error?.message || 'Error al agregar item a cuenta',
      null,
      error.status || CONSTANTS.HTTP_STATUS.BAD_REQUEST
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
      `SELECT cad.*, ca.empresa_id, ca.estado, p.nombre as producto_nombre, p.iva_incluido_en_precio
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
    const calculo = calcular({
      productos: [{ cantidad: nuevaCantidad, precio_unitario: nuevoPrecio,
        aplica_iva: Number(item.iva_porcentaje) > 0, porcentaje_iva: item.iva_porcentaje,
        iva_incluido_en_precio: item.iva_incluido_en_precio }],
      impuestos: [
        { id: 1, codigo: 'INC', nombre: 'Impoconsumo', tipo: 'porcentaje', tasa: item.impoconsumo_porcentaje ?? 0,
          aplica_sobre: 'subtotal', afecta_total: 'suma' },
        { id: 2, codigo: 'OTROS', nombre: 'Otros impuestos registrados', tipo: 'valor_fijo', tasa: item.otros_impuestos ?? 0,
          aplica_sobre: 'subtotal', afecta_total: 'suma' }
      ]
    });
    const subtotal = calculo.subtotal;
    const ivaValor = calculo.impuesto;
    const impoconsumoValor = calculo.impuestos[0].valor;
    const total = calculo.total;

    await withTransaction(async (txQuery) => {
      await bloquearCuentaAbierta(txQuery, id);
      const actual = await txQuery('SELECT cantidad, precio_unitario FROM cuenta_abierta_detalle WHERE id = ? FOR UPDATE', [itemId]);
      if (!actual.length || Number(actual[0].cantidad) !== Number(cantidadAnterior) ||
        Number(actual[0].precio_unitario) !== Number(precioAnterior)) {
        throw new ErrorCalculo('El item cambio; actualice la cuenta antes de editarlo');
      }
      await txQuery(
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

      if (cantidad !== undefined && nuevaCantidad !== cantidadAnterior) {
        const diferencia = nuevaCantidad - cantidadAnterior;

        const usuarioBodegaResult = await txQuery(
          `SELECT bodega_id FROM usuarios WHERE id = ?`,
          [item.usuario_id]
        );
        const bodegaId = usuarioBodegaResult[0]?.bodega_id || null;

        await moverStock(txQuery, {
          productoId: Number(item.producto_id),
          cantidad: Math.abs(diferencia),
          bodegaId,
          usuarioId,
          signo: diferencia > 0 ? -1 : 1,
          motivo: `Actualizaci\u00f3n cantidad en cuenta abierta #${id}`,
          referenciaTipo: 'venta',
          referenciaId: Number(id)
        });
      }
      await recalcularTotalesCuenta(parseInt(id), txQuery);
    });

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

  } catch (error: any) {
    logger.error('Error al actualizar item de cuenta:', error);
    return errorResponse(
      res,
      error?.message || 'Error al actualizar item de cuenta',
      null,
      error.status || CONSTANTS.HTTP_STATUS.BAD_REQUEST
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

    await withTransaction(async (txQuery) => {
      await bloquearCuentaAbierta(txQuery, id);
      const actual = await txQuery('SELECT cantidad FROM cuenta_abierta_detalle WHERE id = ? FOR UPDATE', [itemId]);
      if (!actual.length || Number(actual[0].cantidad) !== Number(item.cantidad)) {
        throw new ErrorCalculo('El item cambio; actualice la cuenta antes de eliminarlo');
      }
      await txQuery(`DELETE FROM cuenta_abierta_detalle WHERE id = ?`, [itemId]);

      const usuarioBodegaResult = await txQuery(
        `SELECT bodega_id FROM usuarios WHERE id = ?`,
        [item.usuario_id]
      );
      const bodegaIdItem = usuarioBodegaResult[0]?.bodega_id || null;

      await moverStock(txQuery, {
        productoId: Number(item.producto_id),
        cantidad: Number(item.cantidad),
        bodegaId: bodegaIdItem,
        usuarioId,
        signo: 1,
        motivo: `Eliminado de cuenta abierta #${id}`,
        referenciaTipo: 'devolucion',
        referenciaId: Number(id)
      });
      await recalcularTotalesCuenta(parseInt(id), txQuery);
    });

    logger.info(`Item ${itemId} eliminado de cuenta ${id}`);

    return successResponse(
      res,
      'Item eliminado exitosamente',
      null,
      CONSTANTS.HTTP_STATUS.OK
    );

  } catch (error) {
    logger.error('Error al eliminar item de cuenta:', error);
    if ((error as any).status) return errorResponse(res, (error as any).message, null, (error as any).status);
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
       SET cuenta_solicitada = TRUE, fecha_cuenta_solicitada = CONVERT_TZ(NOW(), '+00:00', '-05:00')
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

    const resultado = await withTransaction(async query => {
      // Obtener datos de la cuenta
      const cuentaResult = await query(
        `SELECT * FROM cuentas_abiertas WHERE id = ? AND empresa_id = ? FOR UPDATE`,
        [id, empresa_id]
      );

      if (cuentaResult.length === 0) {
        throw new ErrorCalculo('Cuenta no encontrada en la empresa');
      }

      const cuenta = cuentaResult[0];

      if (cuenta.estado !== 'abierta') {
        throw new ErrorCalculo('La cuenta ya esta cerrada o cancelada');
      }

      // Obtener items de la cuenta
      const items = await query(
        `SELECT * FROM cuenta_abierta_detalle WHERE cuenta_abierta_id = ?`,
        [id]
      );

      if (items.length === 0) {
        throw new ErrorCalculo('No se puede cerrar una cuenta sin items');
      }

      const subtotalCentavos = items.reduce((sum: number, item: { subtotal: string }) => sum + centavos(item.subtotal), 0);
      const impuestosCentavos = items.reduce((sum: number, item: { iva_valor: string; impoconsumo_valor: string; otros_impuestos: string }) =>
        sum + centavos(item.iva_valor) + centavos(item.impoconsumo_valor) + centavos(item.otros_impuestos ?? 0), 0);
      if (subtotalCentavos !== centavos(cuenta.subtotal) || impuestosCentavos !== centavos(cuenta.total_impuestos) ||
        subtotalCentavos + impuestosCentavos !== centavos(cuenta.total)) {
        throw new ErrorCalculo('Los detalles de la cuenta no concilian con sus totales; revise la cuenta antes de cobrar');
      }
      const propinaValor = centavos(cuenta.propina_valor ?? 0) / 100;
      const totalConPropina = (centavos(cuenta.total) + centavos(propinaValor)) / 100;
      if (req.body.total === undefined || centavos(req.body.total) !== centavos(totalConPropina)) {
        throw new ErrorCalculo('El total mostrado no coincide con la cuenta y su propina registrada. Actualice la cuenta antes de cobrar');
      }
      const conciliacion = conciliarPagos(pagos.length ? pagos :
        monto_recibido !== undefined ? [{ metodo_pago, monto: monto_recibido }] : [], totalConPropina);
      const pagosNetos = conciliacion.pagos;
      const metodoPagoResumen = pagosNetos.length === 1 ? pagosNetos[0].metodo_pago : 'Múltiple';
      const cambio = conciliacion.cambio;

      // Generar número de factura
      const contadorResult = await query(
        `SELECT prefijo_factura, numeracion_actual FROM empresas WHERE id = ? FOR UPDATE`,
        [cuenta.empresa_id]
      );
      if (!contadorResult.length) throw new ErrorCalculo('Empresa no encontrada');
      const contador = Number(contadorResult[0].numeracion_actual) + 1;
      if (!Number.isSafeInteger(contador) || contador < 1) throw new ErrorCalculo('Numeracion de empresa invalida');
      await query('UPDATE empresas SET numeracion_actual = ? WHERE id = ?', [contador, cuenta.empresa_id]);
      const numero_factura = generarNumeroFactura(contadorResult[0].prefijo_factura || 'FAC', contador);

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

      // Buscar turno activo del usuario (para asociar venta al turno)
      let turnoId = null;
      if (usuarioId) {
        const turnoActivo = await query(
          'SELECT id FROM turnos_caja WHERE usuario_id = ? AND empresa_id = ? AND estado = "abierto" LIMIT 1 FOR UPDATE',
          [usuarioId, cuenta.empresa_id]
        );

        if (turnoActivo.length > 0) {
          turnoId = turnoActivo[0].id;
        }
      }

      // Bodega/tienda que cierra la cuenta (para poder filtrar ventas por punto de venta)
      let bodegaId = null;
      if (usuarioId) {
        const usuarioBodegaResult = await query(
          `SELECT bodega_id FROM usuarios WHERE id = ?`,
          [usuarioId]
        );
        bodegaId = usuarioBodegaResult[0]?.bodega_id || null;
      }

      // Crear venta
      if ((req as any).user?.tipo_usuario !== 'super_admin') await assertPlanQuota(query, Number(cuenta.empresa_id), 'facturas');
      const ventaResult = await query(
        `INSERT INTO ventas (
        empresa_id, numero_factura, cliente_id, vendedor_id,
        fecha_venta, subtotal, impuesto, total, metodo_pago,
        observaciones, estado, forma_pago, turno_id, bodega_id,
        propina_habilitada, propina_porcentaje, propina_valor, propina_base, mesero_id
      ) VALUES (?, ?, ?, ?, CONVERT_TZ(NOW(), '+00:00', '-05:00'), ?, ?, ?, ?, ?, 'pagada', 'contado', ?, ?, ?, ?, ?, ?, ?)`,
        [
          cuenta.empresa_id,
          numero_factura,
          clienteIdFinal, // Usar cliente genérico si es NULL
          usuarioId,
          cuenta.subtotal,
          cuenta.total_impuestos, // En cuentas_abiertas es total_impuestos, en ventas es impuesto
          totalConPropina,
          metodoPagoResumen,
          observacionesVenta,
          turnoId,
          bodegaId,
          Number(cuenta.propina_habilitada) ? 1 : 0,
          Number(cuenta.propina_porcentaje) || 0,
          propinaValor,
          Number(cuenta.subtotal) || 0,
          cuenta.mesero_id || null
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
            item.subtotal
          ]
        );
      }

      // Insertar pagos múltiples
      if (pagosNetos.length > 0) {
        for (const pago of pagosNetos) {
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
        logger.info(`${pagosNetos.length} metodos de pago registrados para venta ${numero_factura}`);
      }

      // Cerrar cuenta
      await query(
        `UPDATE cuentas_abiertas
       SET estado = 'cerrada', venta_id = ?, usuario_cierre = ?, fecha_cierre = CONVERT_TZ(NOW(), '+00:00', '-05:00')
       WHERE id = ?`,
        [ventaId, usuarioId, id]
      );

      logger.info(`Cuenta ${cuenta.numero_cuenta} cerrada y convertida en venta ${numero_factura}`);

      return {
        venta_id: ventaId,
        numero_factura,
        total: totalConPropina,
        cambio
      };
    });
    return successResponse(res, 'Cuenta cerrada exitosamente', resultado, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al cerrar cuenta:', error);
    if (error instanceof ErrorCalculo) return errorResponse(res, error.message, null, error.status);
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

    const resultado = await withTransaction(async (txQuery) => {
      const cuentaResult = await txQuery(
        `SELECT * FROM cuentas_abiertas WHERE id = ? FOR UPDATE`,
        [id]
      );

      if (cuentaResult.length === 0) throw new Error('Cuenta no encontrada');
      const cuenta = cuentaResult[0];
      if (cuenta.estado !== 'abierta') throw new Error('Solo se pueden cancelar cuentas abiertas');

      const items = await txQuery(
        `SELECT * FROM cuenta_abierta_detalle WHERE cuenta_abierta_id = ?`,
        [id]
      );

      // Evita que cocina siga mostrando pedidos de una cuenta cancelada.
      await txQuery(
        `UPDATE comanda_items ci
         INNER JOIN comandas c ON c.id = ci.comanda_id
         SET ci.estado = 'cancelado', ci.motivo_cancelacion = ?, ci.usuario_estado_id = ?
         WHERE c.cuenta_abierta_id = ?
           AND ci.estado NOT IN ('entregado', 'cancelado')`,
        [`Cancelación de cuenta ${cuenta.numero_cuenta}: ${motivo}`, usuarioId, id]
      );

      for (const item of items) {
        await moverStock(txQuery, {
          productoId: Number(item.producto_id),
          cantidad: Number(item.cantidad),
          bodegaId: (await txQuery('SELECT bodega_id FROM usuarios WHERE id = ?', [item.usuario_id]))[0]?.bodega_id || null,
          usuarioId,
          signo: 1,
          motivo: `Cancelación de cuenta ${cuenta.numero_cuenta}: ${motivo}`,
          referenciaTipo: 'devolucion',
          referenciaId: Number(id)
        });
      }

      await txQuery(
        `UPDATE cuentas_abiertas
         SET estado = 'cancelada', usuario_cierre = ?, fecha_cierre = CONVERT_TZ(NOW(), '+00:00', '-05:00'), notas = CONCAT(COALESCE(notas, ''), '\nMotivo cancelación: ', ?)
         WHERE id = ?`,
        [usuarioId, motivo, id]
      );

      return { itemsReversados: items.length };
    });

    logger.info(`Cuenta ${id} cancelada. Motivo: ${motivo}`);

    return successResponse(
      res,
      'Cuenta cancelada exitosamente',
      { items_reversados: resultado.itemsReversados },
      CONSTANTS.HTTP_STATUS.OK
    );

  } catch (error) {
    logger.error('Error al cancelar cuenta:', error);
    if ((error as any).status) return errorResponse(res, (error as any).message, null, (error as any).status);
    return errorResponse(
      res,
      'Error al cancelar cuenta',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};
