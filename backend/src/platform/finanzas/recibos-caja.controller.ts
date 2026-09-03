/**
 * =================================
 * KORE INVENTORY - RECIBOS DE CAJA CONTROLLER
 * Controlador para gestión de pagos de clientes
 * =================================
 */

import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
import { errorResponse, successResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

/**
 * Crear recibo de caja (aplicar pago)
 * POST /api/finanzas/recibos-caja
 */
export const crearReciboCaja = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      empresaId,
      clienteId,
      metodo_pago,
      referencia,
      observaciones,
      cuenta_bancaria_id,
      detallePagos // Array de { cuenta_por_cobrar_id, valor_aplicado }
    } = req.body;

    const usuarioId = (req as any).user?.id;

    if (!empresaId || !clienteId || !metodo_pago || !Array.isArray(detallePagos) || detallePagos.length === 0) {
      return errorResponse(res, 'Datos incompletos', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    const idsCuentas = detallePagos.map((detalle: any) => Number(detalle.cuenta_por_cobrar_id));
    if (idsCuentas.some((id: number) => !Number.isInteger(id) || id <= 0) || new Set(idsCuentas).size !== idsCuentas.length) {
      return errorResponse(res, 'El detalle contiene facturas inválidas o repetidas', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    const valor_total = detallePagos.reduce((sum: number, d: any) => sum + Number(d.valor_aplicado), 0);
    if (!Number.isFinite(valor_total) || valor_total <= 0) {
      return errorResponse(res, 'El valor total debe ser mayor a cero', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    const { reciboCajaId, numeroRecibo } = await withTransaction(async (txQuery) => {
      // El bloqueo evita que dos cajeros generen el mismo consecutivo.
      const ultimoReciboResult = await txQuery(
        `SELECT numero_recibo
         FROM recibos_caja
         WHERE empresa_id = ?
         ORDER BY id DESC
         LIMIT 1
         FOR UPDATE`,
        [empresaId]
      );

      let consecutivo = 1;
      if (ultimoReciboResult.length > 0) {
        const parte = String(ultimoReciboResult[0].numero_recibo).split('-')[1];
        consecutivo = (parseInt(parte, 10) || 0) + 1;
      }
      const numeroRecibo = `RC-${consecutivo.toString().padStart(4, '0')}`;

      const reciboResult = await txQuery(
        `INSERT INTO recibos_caja (
          empresa_id,
          cliente_id,
          numero_recibo,
          fecha_recibo,
          metodo_pago,
          valor_total,
          referencia,
          observaciones,
          usuario_id,
          cuenta_bancaria_id
        ) VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?)`,
        [empresaId, clienteId, numeroRecibo, metodo_pago, valor_total, referencia || null, observaciones || null, usuarioId, cuenta_bancaria_id || null]
      );

      const reciboCajaId = reciboResult.insertId;

      for (const detalle of detallePagos) {
        const valorAplicado = Number(detalle.valor_aplicado);
        if (!Number.isFinite(valorAplicado) || valorAplicado <= 0) {
          throw new Error('Cada valor aplicado debe ser mayor a cero');
        }

        const cxcResult = await txQuery(
          `SELECT id, venta_id, saldo_pendiente
           FROM cuentas_por_cobrar
           WHERE id = ? AND empresa_id = ? AND cliente_id = ?
           FOR UPDATE`,
          [detalle.cuenta_por_cobrar_id, empresaId, clienteId]
        );

        if (cxcResult.length === 0) {
          throw new Error('Una factura seleccionada no pertenece a la empresa o al cliente');
        }

        const saldoAnterior = Number(cxcResult[0].saldo_pendiente);
        if (valorAplicado > saldoAnterior) {
          throw new Error('Un valor aplicado supera el saldo pendiente de la factura');
        }
        const saldoNuevo = Math.round((saldoAnterior - valorAplicado) * 100) / 100;

        await txQuery(
          `INSERT INTO recibos_caja_detalle (
            recibo_caja_id,
            cuenta_por_cobrar_id,
            venta_id,
            saldo_anterior,
            valor_aplicado,
            saldo_nuevo
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [reciboCajaId, cxcResult[0].id, cxcResult[0].venta_id, saldoAnterior, valorAplicado, saldoNuevo]
        );

        await txQuery(
          `UPDATE cuentas_por_cobrar
           SET saldo_pendiente = ?,
               ultimo_pago_valor = ?,
               ultimo_pago_fecha = NOW(),
               estado = CASE
                 WHEN ? = 0 THEN 'pagada'
                 WHEN fecha_vencimiento < CURDATE() THEN 'vencida'
                 ELSE 'vigente'
               END
           WHERE id = ?`,
          [saldoNuevo, valorAplicado, saldoNuevo, cxcResult[0].id]
        );

        if (saldoNuevo === 0) {
          await txQuery(`UPDATE ventas SET estado = 'pagada' WHERE id = ?`, [cxcResult[0].venta_id]);
        }
      }

      if (cuenta_bancaria_id && metodo_pago !== 'efectivo') {
        const cuentasBancarias = await txQuery(
          'SELECT id, saldo_actual FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? AND activo = 1 FOR UPDATE',
          [cuenta_bancaria_id, empresaId]
        );
        if (cuentasBancarias.length === 0) {
          throw new Error('La cuenta bancaria no existe o está inactiva');
        }
        const saldoAnterior = Number(cuentasBancarias[0].saldo_actual);
        const saldoNuevo = saldoAnterior + valor_total;
        await txQuery(
          `INSERT INTO movimientos_bancarios
           (empresa_id, cuenta_bancaria_id, tipo, origen, referencia, descripcion, valor, saldo_anterior, saldo_nuevo, created_by)
           VALUES (?, ?, 'deposito', 'recibo_caja', ?, ?, ?, ?, ?, ?)`,
          [empresaId, cuenta_bancaria_id, numeroRecibo, `Cobro a cliente ${clienteId}`, valor_total, saldoAnterior, saldoNuevo, usuarioId]
        );
        await txQuery('UPDATE cuentas_bancarias SET saldo_actual = ? WHERE id = ? AND empresa_id = ?', [saldoNuevo, cuenta_bancaria_id, empresaId]);
      }

      return { reciboCajaId, numeroRecibo };
    });

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
  } catch (error: any) {
    logger.error('Error al crear recibo de caja:', error);
    return errorResponse(
      res,
      error?.message || 'Error al procesar el pago',
      null,
      CONSTANTS.HTTP_STATUS.BAD_REQUEST
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
    const { id } = req.params;
    const { motivo_anulacion } = req.body;
    const usuarioId = (req as any).user?.id;

    if (!motivo_anulacion) {
      return errorResponse(res, 'El motivo de anulación es requerido', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    await withTransaction(async (txQuery) => {
      const reciboResult = await txQuery('SELECT * FROM recibos_caja WHERE id = ? FOR UPDATE', [id]);

      if (reciboResult.length === 0) {
        throw new Error('Recibo de caja no encontrado');
      }

      const recibo = reciboResult[0];
      if (recibo.anulado) {
        throw new Error('El recibo ya está anulado');
      }

      const detalles = await txQuery(
        'SELECT * FROM recibos_caja_detalle WHERE recibo_caja_id = ?',
        [id]
      );

      // Se devuelve el valor aplicado sobre el saldo vigente para no pisar pagos posteriores.
      for (const detalle of detalles) {
        await txQuery(
          `UPDATE cuentas_por_cobrar
           SET saldo_pendiente = saldo_pendiente + ?,
               estado = CASE
                 WHEN fecha_vencimiento < CURDATE() THEN 'vencida'
                 ELSE 'vigente'
               END
           WHERE id = ?`,
          [detalle.valor_aplicado, detalle.cuenta_por_cobrar_id]
        );

        await txQuery(
          `UPDATE ventas v
           INNER JOIN cuentas_por_cobrar cxc ON v.id = cxc.venta_id
           SET v.estado = 'pendiente'
           WHERE cxc.id = ? AND v.estado = 'pagada'`,
          [detalle.cuenta_por_cobrar_id]
        );
      }

      if (recibo.cuenta_bancaria_id && recibo.metodo_pago !== 'efectivo') {
        const cuentasBancarias = await txQuery(
          'SELECT id, saldo_actual FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? FOR UPDATE',
          [recibo.cuenta_bancaria_id, recibo.empresa_id]
        );
        if (cuentasBancarias.length === 0) {
          throw new Error('La cuenta bancaria del recibo no existe');
        }
        const saldoAnterior = Number(cuentasBancarias[0].saldo_actual);
        const saldoNuevo = saldoAnterior - Number(recibo.valor_total);
        await txQuery(
          `INSERT INTO movimientos_bancarios
           (empresa_id, cuenta_bancaria_id, tipo, origen, referencia, descripcion, valor, saldo_anterior, saldo_nuevo, created_by)
           VALUES (?, ?, 'retiro', 'recibo_caja', ?, ?, ?, ?, ?, ?)`,
          [recibo.empresa_id, recibo.cuenta_bancaria_id, recibo.numero_recibo, `Anulación del recibo ${recibo.numero_recibo}`, recibo.valor_total, saldoAnterior, saldoNuevo, usuarioId]
        );
        await txQuery('UPDATE cuentas_bancarias SET saldo_actual = ? WHERE id = ?', [saldoNuevo, recibo.cuenta_bancaria_id]);
      }

      await txQuery(
        `UPDATE recibos_caja
         SET anulado = 1,
             motivo_anulacion = ?,
             fecha_anulacion = NOW(),
             usuario_anulacion_id = ?
         WHERE id = ?`,
        [motivo_anulacion, usuarioId, id]
      );
    });

    logger.info(`Recibo de caja ${id} anulado por usuario ${usuarioId}`);

    return successResponse(
      res,
      'Recibo de caja anulado exitosamente',
      null,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error: any) {
    logger.error('Error al anular recibo de caja:', error);
    return errorResponse(
      res,
      error?.message || 'Error al anular recibo de caja',
      null,
      CONSTANTS.HTTP_STATUS.BAD_REQUEST
    );
  }
};
