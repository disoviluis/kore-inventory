/**
 * =================================
 * KORE INVENTORY - RECIBOS DE CAJA CONTROLLER
 * Controlador para gestión de pagos de clientes
 * =================================
 */

import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { errorResponse, successResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

/**
 * Crear recibo de caja (aplicar pago)
 * POST /api/finanzas/recibos-caja
 */
export const crearReciboCaja = async (req: Request, res: Response): Promise<Response> => {
  const connection = await query('SELECT 1'); // Para obtener conexión
  
  try {
    await query('START TRANSACTION');

    const {
      empresaId,
      clienteId,
      metodo_pago,
      referencia,
      observaciones,
      detallePagos // Array de { cuenta_por_cobrar_id, valor_aplicado }
    } = req.body;

    const usuarioId = (req as any).user?.id;

    // Validaciones
    if (!empresaId || !clienteId || !metodo_pago || !detallePagos || detallePagos.length === 0) {
      await query('ROLLBACK');
      return errorResponse(res, 'Datos incompletos', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    // Calcular valor total
    const valor_total = detallePagos.reduce((sum: number, d: any) => sum + parseFloat(d.valor_aplicado), 0);

    if (valor_total <= 0) {
      await query('ROLLBACK');
      return errorResponse(res, 'El valor total debe ser mayor a cero', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    // Generar número de recibo
    const ultimoReciboResult = await query(
      `SELECT numero_recibo 
       FROM recibos_caja 
       WHERE empresa_id = ? 
       ORDER BY id DESC 
       LIMIT 1`,
      [empresaId]
    );

    let numeroRecibo = 'RC-0001';
    if (ultimoReciboResult.length > 0) {
      const ultimo = ultimoReciboResult[0].numero_recibo;
      const numero = parseInt(ultimo.split('-')[1]) + 1;
      numeroRecibo = `RC-${numero.toString().padStart(4, '0')}`;
    }

    // Crear recibo de caja
    const reciboResult = await query(
      `INSERT INTO recibos_caja (
        empresa_id,
        cliente_id,
        numero_recibo,
        metodo_pago,
        valor_total,
        referencia,
        observaciones,
        usuario_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, clienteId, numeroRecibo, metodo_pago, valor_total, referencia || null, observaciones || null, usuarioId]
    );

    const reciboCajaId = reciboResult.insertId;

    // Aplicar pagos a cada cuenta por cobrar
    for (const detalle of detallePagos) {
      const { cuenta_por_cobrar_id, valor_aplicado } = detalle;

      // Obtener saldo actual
      const cxcResult = await query(
        'SELECT saldo_pendiente FROM cuentas_por_cobrar WHERE id = ?',
        [cuenta_por_cobrar_id]
      );

      if (cxcResult.length === 0) {
        await query('ROLLBACK');
        return errorResponse(
          res,
          `Cuenta por cobrar ${cuenta_por_cobrar_id} no encontrada`,
          null,
          CONSTANTS.HTTP_STATUS.NOT_FOUND
        );
      }

      const saldo_anterior = parseFloat(cxcResult[0].saldo_pendiente);
      const valor_a_aplicar = parseFloat(valor_aplicado);

      if (valor_a_aplicar > saldo_anterior) {
        await query('ROLLBACK');
        return errorResponse(
          res,
          `El valor a aplicar ($${valor_a_aplicar}) supera el saldo pendiente ($${saldo_anterior})`,
          null,
          CONSTANTS.HTTP_STATUS.BAD_REQUEST
        );
      }

      const saldo_nuevo = saldo_anterior - valor_a_aplicar;

      // Insertar detalle
      await query(
        `INSERT INTO recibos_caja_detalle (
          recibo_caja_id,
          cuenta_por_cobrar_id,
          saldo_anterior,
          valor_aplicado,
          saldo_nuevo
        ) VALUES (?, ?, ?, ?, ?)`,
        [reciboCajaId, cuenta_por_cobrar_id, saldo_anterior, valor_a_aplicar, saldo_nuevo]
      );

      // Actualizar cuenta por cobrar
      const nuevoEstado = saldo_nuevo === 0 ? 'pagada' : (saldo_anterior > 0 ? 'vigente' : 'vencida');
      
      await query(
        `UPDATE cuentas_por_cobrar 
         SET saldo_pendiente = ?,
             ultimo_pago_valor = ?,
             ultimo_pago_fecha = NOW(),
             estado = ?
         WHERE id = ?`,
        [saldo_nuevo, valor_a_aplicar, nuevoEstado, cuenta_por_cobrar_id]
      );

      // Si está totalmente pagada, actualizar venta
      if (saldo_nuevo === 0) {
        await query(
          `UPDATE ventas v
           INNER JOIN cuentas_por_cobrar cxc ON v.id = cxc.venta_id
           SET v.estado = 'pagada'
           WHERE cxc.id = ?`,
          [cuenta_por_cobrar_id]
        );
      }
    }

    await query('COMMIT');

    // Obtener recibo completo
    const reciboCompleto = await query(
      `SELECT 
        rc.*,
        c.nombre as cliente_nombre,
        c.numero_documento as cliente_documento,
        u.nombre as usuario_nombre
      FROM recibos_caja rc
      INNER JOIN clientes c ON rc.cliente_id = c.id
      LEFT JOIN usuarios u ON rc.usuario_id = u.id
      WHERE rc.id = ?`,
      [reciboCajaId]
    );

    const detalles = await query(
      `SELECT 
        rcd.*,
        cxc.venta_id,
        v.numero_factura
      FROM recibos_caja_detalle rcd
      INNER JOIN cuentas_por_cobrar cxc ON rcd.cuenta_por_cobrar_id = cxc.id
      INNER JOIN ventas v ON cxc.venta_id = v.id
      WHERE rcd.recibo_caja_id = ?`,
      [reciboCajaId]
    );

    logger.info(`Recibo de caja ${numeroRecibo} creado exitosamente por usuario ${usuarioId}`);

    return successResponse(
      res,
      'Pago aplicado exitosamente',
      {
        recibo: reciboCompleto[0],
        detalles
      },
      CONSTANTS.HTTP_STATUS.CREATED
    );
  } catch (error) {
    await query('ROLLBACK');
    logger.error('Error al crear recibo de caja:', error);
    return errorResponse(
      res,
      'Error al procesar el pago',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Obtener todos los recibos de caja
 * GET /api/finanzas/recibos-caja
 */
export const getRecibosCaja = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId } = req.query;
    const { clienteId, fechaDesde, fechaHasta } = req.query;

    if (!empresaId) {
      return errorResponse(res, 'El ID de empresa es requerido', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    let sql = `
      SELECT 
        rc.*,
        c.nombre as cliente_nombre,
        c.numero_documento as cliente_documento,
        u.nombre as usuario_nombre
      FROM recibos_caja rc
      INNER JOIN clientes c ON rc.cliente_id = c.id
      LEFT JOIN usuarios u ON rc.usuario_id = u.id
      WHERE rc.empresa_id = ?
    `;

    const params: any[] = [empresaId];

    if (clienteId) {
      sql += ' AND rc.cliente_id = ?';
      params.push(clienteId);
    }

    if (fechaDesde) {
      sql += ' AND rc.fecha_recibo >= ?';
      params.push(fechaDesde);
    }

    if (fechaHasta) {
      sql += ' AND rc.fecha_recibo <= ?';
      params.push(fechaHasta);
    }

    sql += ' ORDER BY rc.fecha_recibo DESC, rc.id DESC';

    const recibos = await query(sql, params);

    return successResponse(
      res,
      'Recibos de caja obtenidos exitosamente',
      recibos,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener recibos de caja:', error);
    return errorResponse(
      res,
      'Error al obtener recibos de caja',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Obtener detalle de un recibo de caja
 * GET /api/finanzas/recibos-caja/:id
 */
export const getReciboCajaById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const reciboResult = await query(
      `SELECT 
        rc.*,
        c.nombre as cliente_nombre,
        c.numero_documento as cliente_documento,
        c.telefono as cliente_telefono,
        c.email as cliente_email,
        c.direccion as cliente_direccion,
        u.nombre as usuario_nombre
      FROM recibos_caja rc
      INNER JOIN clientes c ON rc.cliente_id = c.id
      LEFT JOIN usuarios u ON rc.usuario_id = u.id
      WHERE rc.id = ?`,
      [id]
    );

    if (reciboResult.length === 0) {
      return errorResponse(res, 'Recibo de caja no encontrado', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);
    }

    const detalles = await query(
      `SELECT 
        rcd.*,
        cxc.venta_id,
        v.numero_factura,
        v.fecha_venta,
        cxc.fecha_vencimiento
      FROM recibos_caja_detalle rcd
      INNER JOIN cuentas_por_cobrar cxc ON rcd.cuenta_por_cobrar_id = cxc.id
      INNER JOIN ventas v ON cxc.venta_id = v.id
      WHERE rcd.recibo_caja_id = ?`,
      [id]
    );

    const resultado = {
      ...reciboResult[0],
      detalles
    };

    return successResponse(
      res,
      'Detalle del recibo obtenido exitosamente',
      resultado,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener recibo de caja:', error);
    return errorResponse(
      res,
      'Error al obtener recibo de caja',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Anular un recibo de caja
 * DELETE /api/finanzas/recibos-caja/:id
 */
export const anularReciboCaja = async (req: Request, res: Response): Promise<Response> => {
  try {
    await query('START TRANSACTION');

    const { id } = req.params;
    const { motivo_anulacion } = req.body;
    const usuarioId = (req as any).user?.id;

    if (!motivo_anulacion) {
      await query('ROLLBACK');
      return errorResponse(res, 'El motivo de anulación es requerido', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    // Verificar que el recibo existe y no está anulado
    const reciboResult = await query(
      'SELECT * FROM recibos_caja WHERE id = ?',
      [id]
    );

    if (reciboResult.length === 0) {
      await query('ROLLBACK');
      return errorResponse(res, 'Recibo de caja no encontrado', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);
    }

    if (reciboResult[0].anulado) {
      await query('ROLLBACK');
      return errorResponse(res, 'El recibo ya está anulado', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    // Obtener detalles del recibo
    const detalles = await query(
      'SELECT * FROM recibos_caja_detalle WHERE recibo_caja_id = ?',
      [id]
    );

    // Revertir cada aplicación de pago
    for (const detalle of detalles) {
      await query(
        `UPDATE cuentas_por_cobrar 
         SET saldo_pendiente = saldo_anterior,
             estado = CASE 
               WHEN DATEDIFF(fecha_vencimiento, CURDATE()) < 0 THEN 'vencida'
               ELSE 'vigente'
             END
         WHERE id = ?`,
        [detalle.cuenta_por_cobrar_id]
      );

      // Actualizar estado de venta a pendiente si fue marcada como pagada
      await query(
        `UPDATE ventas v
         INNER JOIN cuentas_por_cobrar cxc ON v.id = cxc.venta_id
         SET v.estado = 'pendiente'
         WHERE cxc.id = ? AND v.estado = 'pagada'`,
        [detalle.cuenta_por_cobrar_id]
      );
    }

    // Marcar recibo como anulado
    await query(
      `UPDATE recibos_caja 
       SET anulado = 1,
           motivo_anulacion = ?,
           fecha_anulacion = NOW(),
           usuario_anulacion_id = ?
       WHERE id = ?`,
      [motivo_anulacion, usuarioId, id]
    );

    await query('COMMIT');

    logger.info(`Recibo de caja ${id} anulado por usuario ${usuarioId}`);

    return successResponse(
      res,
      'Recibo de caja anulado exitosamente',
      null,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    await query('ROLLBACK');
    logger.error('Error al anular recibo de caja:', error);
    return errorResponse(
      res,
      'Error al anular recibo de caja',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};
