/**
 * =================================
 * KORE INVENTORY - CUENTAS POR COBRAR CONTROLLER
 * Controlador para gestión de cartera de clientes
 * =================================
 */

import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { errorResponse, successResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

/**
 * Obtener todas las cuentas por cobrar
 * GET /api/finanzas/cuentas-por-cobrar
 */
export const getCuentasPorCobrar = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId } = req.query;
    const { estado, clienteId, fechaDesde, fechaHasta } = req.query;

    if (!empresaId) {
      return errorResponse(res, 'El ID de empresa es requerido', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    let sql = `
      SELECT 
        cxc.*,
        c.nombre as cliente_nombre,
        c.numero_documento as cliente_documento,
        c.email as cliente_email,
        c.telefono as cliente_telefono,
        v.numero_factura,
        v.vendedor_id,
        u.nombre as vendedor_nombre
      FROM cuentas_por_cobrar cxc
      INNER JOIN clientes c ON cxc.cliente_id = c.id
      INNER JOIN ventas v ON cxc.venta_id = v.id
      LEFT JOIN usuarios u ON v.vendedor_id = u.id
      WHERE cxc.empresa_id = ?
    `;

    const params: any[] = [empresaId];

    if (estado) {
      sql += ' AND cxc.estado = ?';
      params.push(estado);
    }

    if (clienteId) {
      sql += ' AND cxc.cliente_id = ?';
      params.push(clienteId);
    }

    if (fechaDesde) {
      sql += ' AND cxc.fecha_emision >= ?';
      params.push(fechaDesde);
    }

    if (fechaHasta) {
      sql += ' AND cxc.fecha_emision <= ?';
      params.push(fechaHasta);
    }

    sql += ' ORDER BY cxc.fecha_vencimiento ASC, cxc.estado DESC';

    const cuentas = await query(sql, params);

    logger.info(`Cuentas por cobrar obtenidas para empresa ${empresaId}: ${cuentas.length} registros`);

    return successResponse(
      res,
      'Cuentas por cobrar obtenidas exitosamente',
      cuentas,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener cuentas por cobrar:', error);
    return errorResponse(
      res,
      'Error al obtener cuentas por cobrar',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Obtener detalle de una cuenta por cobrar
 * GET /api/finanzas/cuentas-por-cobrar/:id
 */
export const getCuentaPorCobrarById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const cuentasResult = await query(
      `SELECT 
        cxc.*,
        c.nombre as cliente_nombre,
        c.numero_documento as cliente_documento,
        c.email as cliente_email,
        c.telefono as cliente_telefono,
        c.direccion as cliente_direccion,
        v.numero_factura,
        v.subtotal,
        v.descuento,
        v.impuesto,
        v.total as valor_factura,
        v.vendedor_id,
        u.nombre as vendedor_nombre
      FROM cuentas_por_cobrar cxc
      INNER JOIN clientes c ON cxc.cliente_id = c.id
      INNER JOIN ventas v ON cxc.venta_id = v.id
      LEFT JOIN usuarios u ON v.vendedor_id = u.id
      WHERE cxc.id = ?`,
      [id]
    );

    if (cuentasResult.length === 0) {
      return errorResponse(res, 'Cuenta por cobrar no encontrada', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);
    }

    // Obtener pagos aplicados
    const pagos = await query(
      `SELECT 
        rcd.*,
        rc.numero_recibo,
        rc.fecha_recibo,
        rc.metodo_pago,
        rc.referencia
      FROM recibos_caja_detalle rcd
      INNER JOIN recibos_caja rc ON rcd.recibo_caja_id = rc.id
      WHERE rcd.cuenta_por_cobrar_id = ?
      ORDER BY rc.fecha_recibo DESC`,
      [id]
    );

    const resultado = {
      ...cuentasResult[0],
      pagos
    };

    return successResponse(
      res,
      'Detalle de cuenta por cobrar obtenido exitosamente',
      resultado,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener cuenta por cobrar:', error);
    return errorResponse(
      res,
      'Error al obtener cuenta por cobrar',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Obtener cuentas por cobrar de un cliente
 * GET /api/finanzas/cuentas-por-cobrar/cliente/:clienteId
 */
export const getCxCByCliente = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { clienteId } = req.params;
    const { empresaId } = req.query;

    const cuentas = await query(
      `SELECT 
        cxc.*,
        v.numero_factura
      FROM cuentas_por_cobrar cxc
      INNER JOIN ventas v ON cxc.venta_id = v.id
      WHERE cxc.cliente_id = ? 
      AND cxc.empresa_id = ?
      AND cxc.estado IN ('vigente', 'vencida')
      ORDER BY cxc.fecha_vencimiento ASC`,
      [clienteId, empresaId]
    );

    return successResponse(
      res,
      'Cuentas del cliente obtenidas exitosamente',
      cuentas,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener cuentas del cliente:', error);
    return errorResponse(
      res,
      'Error al obtener cuentas del cliente',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Obtener resumen de cartera para dashboard
 * GET /api/finanzas/cuentas-por-cobrar/dashboard/resumen
 */
export const getResumenCartera = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId } = req.query;

    if (!empresaId) {
      return errorResponse(res, 'El ID de empresa es requerido', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    // Total vigente, vencida
    const totalesResult = await query(
      `SELECT 
        SUM(CASE WHEN estado = 'vigente' THEN saldo_pendiente ELSE 0 END) as cartera_vigente,
        SUM(CASE WHEN estado = 'vencida' THEN saldo_pendiente ELSE 0 END) as cartera_vencida,
        SUM(CASE WHEN estado IN ('vigente', 'vencida') THEN saldo_pendiente ELSE 0 END) as total_cartera,
        COUNT(CASE WHEN estado = 'vigente' THEN 1 END) as facturas_vigentes,
        COUNT(CASE WHEN estado = 'vencida' THEN 1 END) as facturas_vencidas
      FROM cuentas_por_cobrar
      WHERE empresa_id = ?`,
      [empresaId]
    );

    // Por rangos de vencimiento
    const rangosResult = await query(
      `SELECT 
        rango_vencimiento,
        COUNT(*) as cantidad_facturas,
        SUM(saldo_pendiente) as total
      FROM cuentas_por_cobrar
      WHERE empresa_id = ? 
      AND estado IN ('vigente', 'vencida')
      GROUP BY rango_vencimiento
      ORDER BY FIELD(rango_vencimiento, 'al_dia', '1-30', '31-60', '61-90', 'mas_90')`,
      [empresaId]
    );

    // Top clientes con mayor saldo
    const topClientesResult = await query(
      `SELECT 
        c.id,
        c.nombre,
        c.numero_documento,
        SUM(cxc.saldo_pendiente) as saldo_total,
        COUNT(cxc.id) as facturas_pendientes
      FROM cuentas_por_cobrar cxc
      INNER JOIN clientes c ON cxc.cliente_id = c.id
      WHERE cxc.empresa_id = ? 
      AND cxc.estado IN ('vigente', 'vencida')
      GROUP BY c.id, c.nombre, c.numero_documento
      ORDER BY saldo_total DESC
      LIMIT 10`,
      [empresaId]
    );

    const resumen = {
      totales: totalesResult[0] || {
        cartera_vigente: 0,
        cartera_vencida: 0,
        total_cartera: 0,
        facturas_vigentes: 0,
        facturas_vencidas: 0
      },
      rangos: rangosResult,
      topClientes: topClientesResult
    };

    return successResponse(
      res,
      'Resumen de cartera obtenido exitosamente',
      resumen,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener resumen de cartera:', error);
    return errorResponse(
      res,
      'Error al obtener resumen de cartera',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Obtener reporte de edades de cartera (Aging Report)
 * GET /api/finanzas/cuentas-por-cobrar/reportes/edades
 */
export const getReporteEdades = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId } = req.query;

    if (!empresaId) {
      return errorResponse(res, 'El ID de empresa es requerido', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    // Reporte agrupado por cliente
    const reporteResult = await query(
      `SELECT 
        c.id as cliente_id,
        c.nombre as cliente_nombre,
        c.numero_documento,
        SUM(CASE WHEN cxc.rango_vencimiento = 'al_dia' THEN cxc.saldo_pendiente ELSE 0 END) as al_dia,
        SUM(CASE WHEN cxc.rango_vencimiento = '1-30' THEN cxc.saldo_pendiente ELSE 0 END) as rango_1_30,
        SUM(CASE WHEN cxc.rango_vencimiento = '31-60' THEN cxc.saldo_pendiente ELSE 0 END) as rango_31_60,
        SUM(CASE WHEN cxc.rango_vencimiento = '61-90' THEN cxc.saldo_pendiente ELSE 0 END) as rango_61_90,
        SUM(CASE WHEN cxc.rango_vencimiento = 'mas_90' THEN cxc.saldo_pendiente ELSE 0 END) as mas_90,
        SUM(cxc.saldo_pendiente) as total
      FROM cuentas_por_cobrar cxc
      INNER JOIN clientes c ON cxc.cliente_id = c.id
      WHERE cxc.empresa_id = ? 
      AND cxc.estado IN ('vigente', 'vencida')
      GROUP BY c.id, c.nombre, c.numero_documento
      HAVING total > 0
      ORDER BY total DESC`,
      [empresaId]
    );

    return successResponse(
      res,
      'Reporte de edades de cartera obtenido exitosamente',
      reporteResult,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener reporte de edades:', error);
    return errorResponse(
      res,
      'Error al obtener reporte de edades',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};
