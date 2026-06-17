/**
 * =================================
 * KORE INVENTORY - VENTAS CONTROLLER
 * Controlador de ventas y punto de venta (POS)
 * =================================
 */

import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';
import { generarNumeroFactura, generarCUFE, generarQRCode, calcularRetenciones, numeroATexto } from '../../shared/dian-utils';

/**
 * Buscar clientes por documento o nombre
 * GET /api/ventas/buscar-cliente?empresaId=X&tipo=documento|nombre&valor=123
 */
export const buscarCliente = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId, tipo, valor } = req.query;

    if (!empresaId || !tipo || !valor) {
      return errorResponse(
        res,
        'Par​ámetros requeridos: empresaId, tipo (documento|nombre), valor',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    let clientes;

    if (tipo === 'documento') {
      clientes = await query(
        `SELECT 
          id, tipo_documento, numero_documento, nombre, apellido, 
          razon_social, email, telefono, celular, direccion, 
          ciudad, limite_credito, dias_credito, estado
        FROM clientes
        WHERE empresa_id = ? AND numero_documento LIKE ? AND estado = 'activo'
        LIMIT 10`,
        [empresaId, `%${valor}%`]
      );
    } else {
      // Búsqueda por nombre
      clientes = await query(
        `SELECT 
          id, tipo_documento, numero_documento, nombre, apellido, 
          razon_social, email, telefono, celular, direccion, 
          ciudad, limite_credito, dias_credito, estado
        FROM clientes
        WHERE empresa_id = ? 
          AND (nombre LIKE ? OR apellido LIKE ? OR razon_social LIKE ?)
          AND estado = 'activo'
        LIMIT 10`,
        [empresaId, `%${valor}%`, `%${valor}%`, `%${valor}%`]
      );
    }

    return successResponse(res, 'Clientes encontrados', clientes, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al buscar cliente:', error);
    return errorResponse(res, 'Error al buscar cliente', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Buscar productos por nombre, SKU o código de barras
 * GET /api/ventas/buscar-producto?empresaId=X&busqueda=camisa
 */
export const buscarProducto = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId, busqueda } = req.query;

    if (!empresaId || !busqueda) {
      return errorResponse(
        res,
        'Parámetros requeridos: empresaId, busqueda',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const productos = await query(
      `SELECT 
        p.id, p.nombre, p.sku, p.codigo_barras, 
        p.precio_minorista as precio_venta,
        p.stock_actual, p.unidad_medida, p.imagen_url,
        p.aplica_iva, p.porcentaje_iva, p.iva_incluido_en_precio,
        p.permite_venta_sin_stock,
        c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.empresa_id = ? 
        AND p.estado = 'activo'
        AND p.maneja_inventario = 1
        AND (
          p.nombre LIKE ? 
          OR p.sku LIKE ? 
          OR p.codigo_barras LIKE ?
        )
      LIMIT 20`,
      [empresaId, `%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`]
    );

    return successResponse(res, 'Productos encontrados', productos, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al buscar producto:', error);
    return errorResponse(res, 'Error al buscar producto', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Obtener todas las ventas de una empresa
 * GET /api/ventas?empresaId=X&fecha_desde=2024-01-01&fecha_hasta=2024-12-31
 */
export const getVentas = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId, fecha_desde, fecha_hasta, estado } = req.query;

    if (!empresaId) {
      return errorResponse(
        res,
        'ID de empresa es requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    let sqlQuery = `
      SELECT 
        v.id, v.numero_factura, v.fecha_venta, v.subtotal, v.descuento,
        v.impuesto, v.total, v.estado, v.metodo_pago, v.observaciones,
        c.nombre as cliente_nombre, c.apellido as cliente_apellido,
        c.razon_social, c.numero_documento,
        u.nombre as vendedor_nombre, u.apellido as vendedor_apellido
      FROM ventas v
      INNER JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.vendedor_id = u.id
      WHERE v.empresa_id = ?
    `;

    const params: any[] = [empresaId];

    if (fecha_desde) {
      sqlQuery += ' AND DATE(v.fecha_venta) >= ?';
      params.push(fecha_desde);
    }

    if (fecha_hasta) {
      sqlQuery += ' AND DATE(v.fecha_venta) <= ?';
      params.push(fecha_hasta);
    }

    if (estado) {
      sqlQuery += ' AND v.estado = ?';
      params.push(estado);
    }

    sqlQuery += ' ORDER BY v.fecha_venta DESC LIMIT 100';

    const ventas = await query(sqlQuery, params);

    return successResponse(res, 'Ventas obtenidas exitosamente', ventas, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener ventas:', error);
    return errorResponse(res, 'Error al obtener ventas', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Obtener detalle de una venta
 * GET /api/ventas/:id
 */
export const getVentaById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { empresaId } = req.query;

    if (!empresaId) {
      return errorResponse(
        res,
        'empresaId es requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Determinar si es ID numérico o número de factura
    const isNumericId = /^\d+$/.test(id);
    const whereClause = isNumericId 
      ? 'v.id = ? AND v.empresa_id = ?' 
      : 'v.numero_factura = ? AND v.empresa_id = ?';

    const ventas = await query(
      `SELECT 
        v.*, 
        c.nombre as cliente_nombre, c.apellido as cliente_apellido,
        c.razon_social, c.numero_documento, c.tipo_documento as cliente_tipo_documento,
        c.email, c.telefono, c.direccion, c.ciudad,
        u.nombre as vendedor_nombre, u.apellido as vendedor_apellido
      FROM ventas v
      INNER JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN usuarios u ON v.vendedor_id = u.id
      WHERE ${whereClause}`,
      [id, empresaId]
    );

    if (ventas.length === 0) {
      return errorResponse(
        res,
        'Venta no encontrada',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    const venta = ventas[0];

    // Cargar detalles de productos
    const detalles = await query(
      `SELECT 
        vd.*, 
        p.nombre as producto_nombre, p.sku, p.codigo_barras
      FROM venta_detalle vd
      INNER JOIN productos p ON vd.producto_id = p.id
      WHERE vd.venta_id = ?`,
      [venta.id]
    );

    // Cargar impuestos aplicados
    const impuestos = await query(
      `SELECT 
        vi.*,
        i.nombre as impuesto_nombre, i.codigo
      FROM venta_impuestos vi
      LEFT JOIN impuestos i ON vi.impuesto_id = i.id
      WHERE vi.venta_id = ?`,
      [venta.id]
    );

    // Cargar pagos
    const pagos = await query(
      `SELECT * FROM venta_pagos WHERE venta_id = ?`,
      [venta.id]
    );

    venta.productos = detalles;
    venta.impuestos = impuestos;
    venta.pagos = pagos;

    return successResponse(res, 'Venta obtenida exitosamente', venta, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener venta:', error);
    return errorResponse(res, 'Error al obtener venta', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Crear una nueva venta
 * POST /api/ventas
 */
export const createVenta = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      empresa_id,
      cliente_id,
      productos,
      subtotal,
      descuento,
      impuesto,
      total,
      metodo_pago,
      forma_pago, // 'contado' o 'credito'
      fecha_vencimiento, // Solo si es crédito
      pagos,
      notas,
      vendedor_id,
        impuestos,
        // Propina
        propina_habilitada,
        propina_porcentaje,
        propina_valor,
        propina_base
      } = req.body;

      // Validaciones
    if (pagos && Array.isArray(pagos) && pagos.length > 0) {
      const totalPagos = pagos.reduce((sum: number, p: any) => sum + parseFloat(p.monto), 0);
      
      // Permitir pagos mayores o iguales al total (para cálculo de cambio)
      // Tolerancia de 1 centavo para evitar errores de redondeo
      if (totalPagos < total - 0.01) {
        return errorResponse(
          res,
          `La suma de pagos ($${totalPagos.toFixed(2)}) es menor al total de la venta ($${total})`,
          null,
          CONSTANTS.HTTP_STATUS.BAD_REQUEST
        );
      }
      
      // Registrar el cambio si el pago excede el total
      const cambio = totalPagos - total;
      if (cambio > 0.01) {
        logger.info(`Venta con cambio: Total=$${total}, Pagado=$${totalPagos.toFixed(2)}, Cambio=$${cambio.toFixed(2)}`);
      }
    }

    // Obtener configuración de empresa para generar número de factura
    const empresaResult = await query(
      `SELECT prefijo_factura, numeracion_actual, software_id, pin_software, ambiente, nit
       FROM empresas WHERE id = ?`,
      [empresa_id]
    );

    if (empresaResult.length === 0) {
      return errorResponse(res, 'Empresa no encontrada', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);
    }

    const empresa = empresaResult[0];
    const prefijo = empresa.prefijo_factura || 'FAC';
    const consecutivo = (empresa.numeracion_actual || 0) + 1;
    const numeroFactura = generarNumeroFactura(prefijo, consecutivo);

    // Obtener datos del cliente para CUFE
    const clienteResult = await query(
      `SELECT tipo_documento, numero_documento, tipo_cliente, 
              responsabilidad_tributaria FROM clientes WHERE id = ?`,
      [cliente_id]
    );

    if (clienteResult.length === 0) {
      return errorResponse(res, 'Cliente no encontrado', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);
    }

    const cliente = clienteResult[0];

    // Calcular retenciones automáticamente
    const esGranContribuyente = cliente.responsabilidad_tributaria?.includes('Gran Contribuyente') || false;
    const retenciones = calcularRetenciones(
      subtotal,
      impuesto,
      total,
      esGranContribuyente,
      cliente.tipo_cliente === 'empresa' ? 'juridica' : 'natural'
    );

    // Ajustar total con retenciones
    const totalFinal = total - retenciones.retencionFuente - retenciones.retencionIVA - retenciones.retencionICA;

    // Generar CUFE
    const fecha = new Date();
    const fechaStr = fecha.toISOString().split('T')[0]; // YYYY-MM-DD
    const horaStr = fecha.toTimeString().split(' ')[0]; // HH:MM:SS

    const cufe = generarCUFE({
      numeroFactura,
      fecha: fechaStr,
      hora: horaStr,
      subtotal,
      impuesto,
      total: totalFinal,
      nitEmisor: empresa.nit,
      tipoDocAdquiriente: cliente.tipo_documento === 'nit' ? '31' : '13',
      numDocAdquiriente: cliente.numero_documento,
      softwareId: empresa.software_id || 'SW-12345678',
      ambiente: empresa.ambiente === 'produccion' ? '1' : '2',
      pin: empresa.pin_software || '98765'
    });

    // Generar QR Code
    const qrData = {
      NumFac: numeroFactura,
      FecFac: fechaStr,
      NitFac: empresa.nit,
      DocAdq: cliente.numero_documento,
      ValFac: subtotal.toFixed(2),
      ValIva: impuesto.toFixed(2),
      ValOtroIm: '0.00',
      ValTotal: totalFinal.toFixed(2),
      CUFE: cufe
    };

    const qrCode = await generarQRCode(qrData);

    // Calcular total de retenciones
    const totalRetenciones = retenciones.retencionIVA + retenciones.retencionFuente + retenciones.retencionICA;

    // Determinar estado de la venta
    const estadoVenta = (forma_pago === 'credito') ? 'pendiente' : 'pagada';

    // Obtener turno activo del usuario (si existe)
    const usuario = (req as any).user;
    let turnoId = null;
    
    if (usuario?.id) {
      const turnoActivo = await query(
        'SELECT id FROM turnos_caja WHERE usuario_id = ? AND empresa_id = ? AND estado = "abierto" LIMIT 1',
        [usuario.id, empresa_id]
      );
      
      if (turnoActivo.length > 0) {
        turnoId = turnoActivo[0].id;
      }
    }

    // Insertar venta
    const resultVenta = await query(
      `INSERT INTO ventas (
        empresa_id, numero_factura, cliente_id, fecha_venta,
        subtotal, descuento, impuesto, total, 
        retenciones,
        estado, metodo_pago, forma_pago, fecha_vencimiento, notas, vendedor_id,
        cufe, qr_code,
        propina_habilitada, propina_porcentaje, propina_valor, propina_base,
        turno_id
        ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresa_id,
        numeroFactura,
        cliente_id,
        subtotal || 0,
        descuento || 0,
        impuesto || 0,
        totalFinal,
        totalRetenciones,
        estadoVenta,
        metodo_pago || 'efectivo',
        forma_pago || 'contado',
        forma_pago === 'credito' ? fecha_vencimiento : null,
        notas || null,
        vendedor_id || null,
        cufe,
        qrCode,
        // Propina
        propina_habilitada || false,
        propina_porcentaje || 0,
        propina_valor || 0,
        propina_base || 0,
        turnoId
        ]
      );

    const ventaId = resultVenta.insertId;

    // Actualizar numeración en empresa
    await query(
      'UPDATE empresas SET numeracion_actual = ? WHERE id = ?',
      [consecutivo, empresa_id]
    );

    // Insertar detalles y actualizar stock
    for (const producto of productos) {
      // Insertar detalle con nuevos campos para ventas contra pedido
      await query(
        `INSERT INTO venta_detalle (
          venta_id, producto_id, cantidad, precio_unitario, descuento, subtotal,
          tipo_venta, estado_entrega, fecha_entrega_estimada, notas_entrega
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ventaId,
          producto.producto_id,
          producto.cantidad,
          producto.precio_unitario,
          producto.descuento || 0,
          producto.subtotal,
          producto.tipo_venta || 'inmediata',
          producto.estado_entrega || null,
          producto.fecha_entrega_estimada || null,
          producto.notas_entrega || null
        ]
      );

      // Actualizar stock solo si NO es venta contra pedido
      if (producto.tipo_venta !== 'contra_pedido') {
        await query(
          'UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?',
          [producto.cantidad, producto.producto_id]
        );
      }
    }

    // Insertar impuestos adicionales si existen
    if (impuestos && Array.isArray(impuestos) && impuestos.length > 0) {
      for (const impuesto of impuestos) {
        await query(
          `INSERT INTO venta_impuestos (
            venta_id, impuesto_id, codigo_impuesto, nombre_impuesto, 
            base_gravable, tasa, valor, tipo_afectacion
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ventaId,
            impuesto.impuesto_id,
            impuesto.codigo || '',
            impuesto.nombre || '',
            impuesto.base_calculo || 0,
            impuesto.tasa || 0,
            impuesto.valor || 0,
            impuesto.afecta_total || 'suma'
          ]
        );
      }
      logger.info(`${impuestos.length} impuestos adicionales registrados para venta ${ventaId}`);
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
      logger.info(`${pagos.length} métodos de pago registrados para venta ${ventaId}`);
    }

    // Crear Cuenta por Cobrar si es venta a crédito
    if (forma_pago === 'credito') {
      // Calcular días de vencimiento
      const fechaActual = new Date();
      const fechaVenc = new Date(fecha_vencimiento);
      const diasVencimiento = Math.floor((fechaVenc.getTime() - fechaActual.getTime()) / (1000 * 60 * 60 * 24));

      // Determinar rango de vencimiento
      let rangoVencimiento = 'al_dia';
      if (diasVencimiento < 0) {
        const diasNegativo = Math.abs(diasVencimiento);
        if (diasNegativo <= 30) rangoVencimiento = '1-30';
        else if (diasNegativo <= 60) rangoVencimiento = '31-60';
        else if (diasNegativo <= 90) rangoVencimiento = '61-90';
        else rangoVencimiento = 'mas_90';
      }

      // Determinar estado de la CxC
      const estadoCxC = diasVencimiento < 0 ? 'vencida' : 'vigente';

      await query(
        `INSERT INTO cuentas_por_cobrar (
          empresa_id, venta_id, cliente_id, fecha_emision, fecha_vencimiento,
          valor_original, saldo_pendiente, estado, dias_vencimiento, rango_vencimiento
        ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
        [
          empresa_id,
          ventaId,
          cliente_id,
          fecha_vencimiento,
          totalFinal,
          totalFinal,
          estadoCxC,
          diasVencimiento,
          rangoVencimiento
        ]
      );

      logger.info(`Cuenta por cobrar creada para venta ${numeroFactura} - Vence: ${fecha_vencimiento}`);
    }

    logger.info(`Venta creada: ${numeroFactura} (ID: ${ventaId})`);

    return successResponse(
      res,
      'Venta creada exitosamente',
      { 
        id: ventaId, 
        numero_factura: numeroFactura,
        cufe: cufe,
        qr_code: qrCode
      },
      CONSTANTS.HTTP_STATUS.CREATED
    );

  } catch (error) {
    logger.error('Error al crear venta:', error);
    return errorResponse(res, 'Error al crear venta', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Anular una venta (no eliminar, cambiar estado)
 * PUT /api/ventas/:id/anular
 */
export const anularVenta = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    // Verificar que la venta existe
    const ventas = await query('SELECT * FROM ventas WHERE id = ?', [id]);

    if (ventas.length === 0) {
      return errorResponse(
        res,
        'Venta no encontrada',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    const venta = ventas[0];

    if (venta.estado === 'anulada') {
      return errorResponse(
        res,
        'La venta ya está anulada',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Obtener detalles de la venta para restaurar stock
    const detalles = await query(
      'SELECT producto_id, cantidad FROM venta_detalle WHERE venta_id = ?',
      [id]
    );

    // Restaurar stock de cada producto
    for (const detalle of detalles) {
      await query(
        'UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?',
        [detalle.cantidad, detalle.producto_id]
      );
    }

    // Anular la venta
    await query(
      `UPDATE ventas SET estado = 'anulada', notas = CONCAT(IFNULL(notas, ''), '\n[ANULADA] ', ?) WHERE id = ?`,
      [motivo || 'Sin motivo especificado', id]
    );

    logger.info(`Venta anulada: ${venta.numero_factura} (ID: ${id})`);

    return successResponse(res, 'Venta anulada exitosamente', null, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al anular venta:', error);
    return errorResponse(res, 'Error al anular venta', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

// =====================================================
// TURNOS DE CAJA (Apertura/Cierre)
// =====================================================

/**
 * Abrir turno de caja
 * POST /api/ventas/turno/abrir
 */
export const abrirTurno = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId, bodegaId, baseInicial } = req.body;
    const usuario = (req as any).user;

    if (!empresaId || !bodegaId || baseInicial === undefined) {
      return errorResponse(res, 'Faltan parámetros: empresaId, bodegaId, baseInicial', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    // Verificar si el usuario ya tiene un turno abierto
    const turnoActivo = await query(
      'SELECT id FROM turnos_caja WHERE usuario_id = ? AND empresa_id = ? AND estado = "abierto"',
      [usuario.id, empresaId]
    );

    if (turnoActivo.length > 0) {
      return errorResponse(res, 'Ya tienes un turno abierto. Ciérralo antes de abrir uno nuevo.', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    // Crear nuevo turno
    const result = await query(
      `INSERT INTO turnos_caja (empresa_id, usuario_id, bodega_id, base_inicial, estado)
       VALUES (?, ?, ?, ?, 'abierto')`,
      [empresaId, usuario.id, bodegaId, baseInicial]
    );

    const turnoId = result.insertId;

    logger.info(`Turno abierto: ${turnoId} - Usuario: ${usuario.id} - Bodega: ${bodegaId}`);

    return successResponse(res, 'Turno abierto exitosamente', { turnoId }, CONSTANTS.HTTP_STATUS.CREATED);

  } catch (error) {
    logger.error('Error al abrir turno:', error);
    return errorResponse(res, 'Error al abrir turno', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Obtener turno actual del usuario
 * GET /api/ventas/turno/actual?empresaId=X
 */
export const getTurnoActual = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId } = req.query;
    const usuario = (req as any).user;

    if (!empresaId) {
      return errorResponse(res, 'Parámetro empresaId requerido', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    const turnos = await query(
      `SELECT t.*, b.nombre as bodega_nombre, u.nombre as usuario_nombre, u.apellido as usuario_apellido
       FROM turnos_caja t
       LEFT JOIN bodegas b ON t.bodega_id = b.id
       LEFT JOIN usuarios u ON t.usuario_id = u.id
       WHERE t.usuario_id = ? AND t.empresa_id = ? AND t.estado = 'abierto'
       LIMIT 1`,
      [usuario.id, empresaId]
    );

    if (turnos.length === 0) {
      return successResponse(res, 'No hay turno activo', null, CONSTANTS.HTTP_STATUS.OK);
    }

    return successResponse(res, 'Turno actual', turnos[0], CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener turno actual:', error);
    return errorResponse(res, 'Error al obtener turno actual', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Obtener resumen del turno para cierre
 * GET /api/ventas/turno/:turnoId/resumen
 */
export const getResumenTurno = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { turnoId } = req.params;

    // Obtener datos del turno
    const turnos = await query('SELECT * FROM turnos_caja WHERE id = ?', [turnoId]);

    if (turnos.length === 0) {
      return errorResponse(res, 'Turno no encontrado', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);
    }

    const turno = turnos[0];

    // Obtener ventas del turno agrupadas por método de pago
    const ventas = await query(
      `SELECT metodo_pago, COUNT(*) as cantidad, SUM(total) as total
       FROM ventas
       WHERE turno_id = ? AND estado != 'anulada'
       GROUP BY metodo_pago`,
      [turnoId]
    );

    // Obtener gastos del turno
    const gastos = await query(
      `SELECT id, descripcion, monto, fecha_registro
       FROM gastos_caja
       WHERE turno_id = ?
       ORDER BY fecha_registro DESC`,
      [turnoId]
    );

    const totalGastos = gastos.reduce((sum: number, g: any) => sum + parseFloat(g.monto), 0);
    const totalVentas = ventas.reduce((sum: number, v: any) => sum + parseFloat(v.total), 0);
    
    // Calcular efectivo a entregar (ventas en efectivo - base - gastos)
    const ventasEfectivo = ventas.find((v: any) => v.metodo_pago === 'efectivo');
    const montoEfectivo = ventasEfectivo ? parseFloat(ventasEfectivo.total) : 0;
    const efectivoAEntregar = montoEfectivo - parseFloat(turno.base_inicial) - totalGastos;

    const resumen = {
      turno,
      ventas_por_metodo: ventas,
      gastos,
      total_ventas: totalVentas,
      total_gastos: totalGastos,
      efectivo_a_entregar: efectivoAEntregar,
      base_inicial: parseFloat(turno.base_inicial)
    };

    return successResponse(res, 'Resumen del turno', resumen, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener resumen del turno:', error);
    return errorResponse(res, 'Error al obtener resumen del turno', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Cerrar turno de caja
 * POST /api/ventas/turno/:turnoId/cerrar
 */
export const cerrarTurno = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { turnoId } = req.params;
    const { efectivoContado, notas } = req.body;

    // Obtener resumen del turno
    const resumenResponse = await getResumenTurno({ params: { turnoId } } as any, {} as Response);
    const resumen = (resumenResponse as any).data;

    if (!resumen) {
      return errorResponse(res, 'No se pudo obtener resumen del turno', null, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    const diferencia = efectivoContado !== undefined ? efectivoContado - resumen.efectivo_a_entregar : null;

    // Guardar totales por método de pago
    for (const venta of resumen.ventas_por_metodo) {
      await query(
        `INSERT INTO turnos_caja_totales (turno_id, metodo_pago, total, cantidad_transacciones)
         VALUES (?, ?, ?, ?)`,
        [turnoId, venta.metodo_pago, venta.total, venta.cantidad]
      );
    }

    // Cerrar turno
    await query(
      `UPDATE turnos_caja 
       SET fecha_cierre = NOW(), 
           estado = 'cerrado',
           total_ventas = ?,
           total_gastos = ?,
           efectivo_a_entregar = ?,
           efectivo_contado = ?,
           diferencia = ?,
           notas_cierre = ?
       WHERE id = ?`,
      [
        resumen.total_ventas,
        resumen.total_gastos,
        resumen.efectivo_a_entregar,
        efectivoContado || null,
        diferencia,
        notas || null,
        turnoId
      ]
    );

    logger.info(`Turno cerrado: ${turnoId}`);

    return successResponse(res, 'Turno cerrado exitosamente', resumen, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al cerrar turno:', error);
    return errorResponse(res, 'Error al cerrar turno', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Registrar gasto en el turno
 * POST /api/ventas/turno/:turnoId/gastos
 */
export const registrarGasto = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { turnoId } = req.params;
    const { descripcion, monto } = req.body;
    const usuario = (req as any).user;

    if (!descripcion || !monto) {
      return errorResponse(res, 'Faltan parámetros: descripcion, monto', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    // Verificar que el turno existe y está abierto
    const turnos = await query('SELECT id FROM turnos_caja WHERE id = ? AND estado = "abierto"', [turnoId]);

    if (turnos.length === 0) {
      return errorResponse(res, 'Turno no encontrado o ya cerrado', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);
    }

    // Registrar gasto
    const result = await query(
      'INSERT INTO gastos_caja (turno_id, descripcion, monto, usuario_id) VALUES (?, ?, ?, ?)',
      [turnoId, descripcion, monto, usuario.id]
    );

    logger.info(`Gasto registrado en turno ${turnoId}: ${descripcion} - $${monto}`);

    return successResponse(res, 'Gasto registrado', { gastoId: result.insertId }, CONSTANTS.HTTP_STATUS.CREATED);

  } catch (error) {
    logger.error('Error al registrar gasto:', error);
    return errorResponse(res, 'Error al registrar gasto', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Obtener gastos del turno
 * GET /api/ventas/turno/:turnoId/gastos
 */
export const getGastosTurno = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { turnoId } = req.params;

    const gastos = await query(
      `SELECT g.*, u.nombre as usuario_nombre, u.apellido as usuario_apellido
       FROM gastos_caja g
       LEFT JOIN usuarios u ON g.usuario_id = u.id
       WHERE g.turno_id = ?
       ORDER BY g.fecha_registro DESC`,
      [turnoId]
    );

    return successResponse(res, 'Gastos del turno', gastos, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener gastos del turno:', error);
    return errorResponse(res, 'Error al obtener gastos del turno', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};
