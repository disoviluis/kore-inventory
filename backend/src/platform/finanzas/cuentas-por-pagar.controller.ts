import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
import { errorResponse, successResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

const validarAccesoEmpresa = async (req: Request, empresaId: number): Promise<boolean> => {
  const usuario = (req as any).user;
  if (!usuario || !Number.isInteger(empresaId) || empresaId <= 0) return false;
  if (usuario.tipo_usuario === 'super_admin') return true;

  const empresas = await query(
    `SELECT empresa_id
     FROM usuario_empresa
     WHERE usuario_id = ? AND empresa_id = ? AND activo = 1
     LIMIT 1`,
    [usuario.id, empresaId]
  );
  return empresas.length > 0;
};

const obtenerEmpresaId = (req: Request): number =>
  Number(req.query.empresaId || req.body.empresaId);

const responderAccesoEmpresa = async (req: Request, res: Response): Promise<number | Response> => {
  const empresaId = obtenerEmpresaId(req);
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    return errorResponse(res, 'El ID de empresa es requerido', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
  }
  if (!(await validarAccesoEmpresa(req, empresaId))) {
    return errorResponse(res, 'No tienes acceso a la empresa seleccionada', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
  }
  return empresaId;
};

export const getCuentasPorPagar = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = await responderAccesoEmpresa(req, res);
    if (typeof empresaId !== 'number') return empresaId;

    const { estado, proveedorId, fechaDesde, fechaHasta } = req.query;
    let sql = `
      SELECT cxp.*, p.razon_social AS proveedor_nombre,
        p.numero_documento AS proveedor_documento,
        c.numero_compra,
        GREATEST(DATEDIFF(CURDATE(), cxp.fecha_vencimiento), 0) AS dias_vencimiento
      FROM cuentas_por_pagar cxp
      INNER JOIN proveedores p ON p.id = cxp.proveedor_id AND p.empresa_id = cxp.empresa_id
      INNER JOIN compras c ON c.id = cxp.compra_id AND c.empresa_id = cxp.empresa_id
      WHERE cxp.empresa_id = ?`;
    const params: any[] = [empresaId];

    if (estado) {
      sql += ' AND cxp.estado = ?';
      params.push(estado);
    }
    if (proveedorId) {
      sql += ' AND cxp.proveedor_id = ?';
      params.push(proveedorId);
    }
    if (fechaDesde) {
      sql += ' AND cxp.fecha_emision >= ?';
      params.push(fechaDesde);
    }
    if (fechaHasta) {
      sql += ' AND cxp.fecha_emision <= ?';
      params.push(fechaHasta);
    }

    sql += ' ORDER BY cxp.fecha_vencimiento ASC, cxp.id DESC LIMIT 500';
    const cuentas = await query(sql, params);
    return successResponse(res, 'Cuentas por pagar obtenidas exitosamente', cuentas);
  } catch (error) {
    logger.error('Error al obtener cuentas por pagar:', error);
    return errorResponse(res, 'Error al obtener cuentas por pagar', error);
  }
};

export const getCuentaPorPagarById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = await responderAccesoEmpresa(req, res);
    if (typeof empresaId !== 'number') return empresaId;

    const cuentas = await query(
      `SELECT cxp.*, p.razon_social AS proveedor_nombre,
        p.numero_documento AS proveedor_documento, p.email AS proveedor_email,
        p.telefono AS proveedor_telefono, c.numero_compra, c.subtotal,
        c.impuestos, c.descuento, c.total AS valor_compra
       FROM cuentas_por_pagar cxp
       INNER JOIN proveedores p ON p.id = cxp.proveedor_id AND p.empresa_id = cxp.empresa_id
       INNER JOIN compras c ON c.id = cxp.compra_id AND c.empresa_id = cxp.empresa_id
       WHERE cxp.id = ? AND cxp.empresa_id = ?`,
      [req.params.id, empresaId]
    );

    if (cuentas.length === 0) {
      return errorResponse(res, 'Cuenta por pagar no encontrada', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);
    }

    const pagos = await query(
      `SELECT ced.*, ce.numero_comprobante, ce.fecha_pago, ce.metodo_pago,
        ce.referencia, ce.anulado
       FROM comprobantes_egreso_detalle ced
       INNER JOIN comprobantes_egreso ce ON ce.id = ced.comprobante_egreso_id
       WHERE ced.cuenta_por_pagar_id = ? AND ce.empresa_id = ?
       ORDER BY ce.fecha_pago DESC, ce.id DESC`,
      [req.params.id, empresaId]
    );

    return successResponse(res, 'Detalle de cuenta por pagar obtenido exitosamente', {
      ...cuentas[0],
      pagos
    });
  } catch (error) {
    logger.error('Error al obtener cuenta por pagar:', error);
    return errorResponse(res, 'Error al obtener cuenta por pagar', error);
  }
};

export const getCuentasPorProveedor = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = await responderAccesoEmpresa(req, res);
    if (typeof empresaId !== 'number') return empresaId;

    const cuentas = await query(
      `SELECT cxp.*, c.numero_compra,
        GREATEST(DATEDIFF(CURDATE(), cxp.fecha_vencimiento), 0) AS dias_vencimiento
       FROM cuentas_por_pagar cxp
       INNER JOIN compras c ON c.id = cxp.compra_id AND c.empresa_id = cxp.empresa_id
       WHERE cxp.proveedor_id = ? AND cxp.empresa_id = ?
         AND cxp.estado IN ('vigente', 'vencida') AND cxp.saldo_pendiente > 0
       ORDER BY cxp.fecha_vencimiento ASC`,
      [req.params.proveedorId, empresaId]
    );
    return successResponse(res, 'Cuentas del proveedor obtenidas exitosamente', cuentas);
  } catch (error) {
    logger.error('Error al obtener cuentas del proveedor:', error);
    return errorResponse(res, 'Error al obtener cuentas del proveedor', error);
  }
};

export const getResumenCuentasPorPagar = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = await responderAccesoEmpresa(req, res);
    if (typeof empresaId !== 'number') return empresaId;

    const totales = await query(
      `SELECT
        COALESCE(SUM(CASE WHEN estado IN ('vigente', 'vencida') THEN saldo_pendiente ELSE 0 END), 0) AS total_por_pagar,
        COALESCE(SUM(CASE WHEN estado = 'vigente' THEN saldo_pendiente ELSE 0 END), 0) AS saldo_vigente,
        COALESCE(SUM(CASE WHEN estado = 'vencida' THEN saldo_pendiente ELSE 0 END), 0) AS saldo_vencido,
        COUNT(CASE WHEN estado = 'vigente' THEN 1 END) AS cuentas_vigentes,
        COUNT(CASE WHEN estado = 'vencida' THEN 1 END) AS cuentas_vencidas
       FROM cuentas_por_pagar WHERE empresa_id = ?`,
      [empresaId]
    );
    const rangos = await query(
      `SELECT
        CASE
          WHEN fecha_vencimiento >= CURDATE() THEN 'al_dia'
          WHEN DATEDIFF(CURDATE(), fecha_vencimiento) <= 30 THEN '1-30'
          WHEN DATEDIFF(CURDATE(), fecha_vencimiento) <= 60 THEN '31-60'
          WHEN DATEDIFF(CURDATE(), fecha_vencimiento) <= 90 THEN '61-90'
          ELSE 'mas_90'
        END AS rango_vencimiento,
        COUNT(*) AS cantidad_cuentas, SUM(saldo_pendiente) AS total
       FROM cuentas_por_pagar
       WHERE empresa_id = ? AND estado IN ('vigente', 'vencida')
       GROUP BY rango_vencimiento
       ORDER BY FIELD(rango_vencimiento, 'al_dia', '1-30', '31-60', '61-90', 'mas_90')`,
      [empresaId]
    );

    return successResponse(res, 'Resumen de cuentas por pagar obtenido exitosamente', {
      totales: totales[0],
      rangos
    });
  } catch (error) {
    logger.error('Error al obtener resumen de cuentas por pagar:', error);
    return errorResponse(res, 'Error al obtener resumen de cuentas por pagar', error);
  }
};

export const crearComprobanteEgreso = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = await responderAccesoEmpresa(req, res);
    if (typeof empresaId !== 'number') return empresaId;

    const { proveedorId, metodo_pago, referencia, observaciones, detallePagos, cuenta_bancaria_id } = req.body;
    const usuarioId = (req as any).user?.id;
    if (!Number.isInteger(Number(proveedorId)) || !metodo_pago || !Array.isArray(detallePagos) || detallePagos.length === 0) {
      return errorResponse(res, 'Datos incompletos para registrar el pago', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    const ids = detallePagos.map((detalle: any) => Number(detalle.cuenta_por_pagar_id));
    if (ids.some((id: number) => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
      return errorResponse(res, 'El detalle del pago contiene cuentas inválidas o repetidas', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    const resultado = await withTransaction(async (txQuery) => {
      const numeroComprobante = `CE-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      let valorTotal = 0;
      const aplicaciones: Array<{ cuentaId: number; valor: number; saldoAnterior: number; saldoNuevo: number }> = [];

      for (const detalle of detallePagos) {
        const valor = Number(detalle.valor_aplicado);
        if (!Number.isFinite(valor) || valor <= 0) throw new Error('Cada valor aplicado debe ser mayor a cero');

        const cuentas = await txQuery(
          `SELECT id, saldo_pendiente
           FROM cuentas_por_pagar
           WHERE id = ? AND empresa_id = ? AND proveedor_id = ?
             AND estado IN ('vigente', 'vencida')
           FOR UPDATE`,
          [detalle.cuenta_por_pagar_id, empresaId, proveedorId]
        );
        if (cuentas.length === 0) throw new Error('Una cuenta seleccionada no pertenece a la empresa o al proveedor');

        const saldoAnterior = Number(cuentas[0].saldo_pendiente);
        if (valor > saldoAnterior) throw new Error('Un valor aplicado supera el saldo pendiente');
        const saldoNuevo = Math.round((saldoAnterior - valor) * 100) / 100;
        valorTotal += valor;
        aplicaciones.push({ cuentaId: Number(detalle.cuenta_por_pagar_id), valor, saldoAnterior, saldoNuevo });
      }

      const comprobante = await txQuery(
        `INSERT INTO comprobantes_egreso
          (empresa_id, proveedor_id, numero_comprobante, fecha_pago, valor_total,
           metodo_pago, referencia, observaciones, usuario_id, cuenta_bancaria_id)
         VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?)`,
        [empresaId, proveedorId, numeroComprobante, valorTotal, metodo_pago, referencia || null, observaciones || null, usuarioId, cuenta_bancaria_id || null]
      );

      if (cuenta_bancaria_id && metodo_pago !== 'efectivo') {
        const cuentasBancarias = await txQuery(
          'SELECT id, saldo_actual FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? AND activo = 1 FOR UPDATE',
          [cuenta_bancaria_id, empresaId]
        );
        if (cuentasBancarias.length === 0) throw new Error('La cuenta bancaria no existe o está inactiva');
        const saldoAnterior = Number(cuentasBancarias[0].saldo_actual);
        const saldoNuevo = saldoAnterior - valorTotal;
        if (saldoNuevo < 0) throw new Error('El pago dejaría la cuenta bancaria en saldo negativo');
        await txQuery(
          `INSERT INTO movimientos_bancarios
           (empresa_id, cuenta_bancaria_id, tipo, origen, referencia, descripcion, valor, saldo_anterior, saldo_nuevo, created_by)
           VALUES (?, ?, 'retiro', 'pago_proveedor', ?, ?, ?, ?, ?, ?)`,
          [empresaId, cuenta_bancaria_id, numeroComprobante, `Pago a proveedor ${proveedorId}`, valorTotal, saldoAnterior, saldoNuevo, usuarioId]
        );
        await txQuery('UPDATE cuentas_bancarias SET saldo_actual = ? WHERE id = ? AND empresa_id = ?', [saldoNuevo, cuenta_bancaria_id, empresaId]);
      }

      for (const aplicacion of aplicaciones) {
        await txQuery(
          `INSERT INTO comprobantes_egreso_detalle
            (comprobante_egreso_id, cuenta_por_pagar_id, valor_aplicado, saldo_anterior, saldo_nuevo)
           VALUES (?, ?, ?, ?, ?)`,
          [comprobante.insertId, aplicacion.cuentaId, aplicacion.valor, aplicacion.saldoAnterior, aplicacion.saldoNuevo]
        );
        await txQuery(
          `UPDATE cuentas_por_pagar
           SET valor_pagado = valor_original - ?, saldo_pendiente = ?,
             estado = CASE WHEN ? = 0 THEN 'pagada'
               WHEN fecha_vencimiento < CURDATE() THEN 'vencida' ELSE 'vigente' END
           WHERE id = ? AND empresa_id = ?`,
          [aplicacion.saldoNuevo, aplicacion.saldoNuevo, aplicacion.saldoNuevo, aplicacion.cuentaId, empresaId]
        );
      }

      return { id: comprobante.insertId, numero_comprobante: numeroComprobante, valor_total: valorTotal };
    });

    logger.info(`Comprobante de egreso ${resultado.numero_comprobante} creado por usuario ${usuarioId}`);
    return successResponse(res, 'Pago a proveedor aplicado exitosamente', resultado, CONSTANTS.HTTP_STATUS.CREATED);
  } catch (error) {
    logger.error('Error al crear comprobante de egreso:', error);
    const message = error instanceof Error ? error.message : 'Error al procesar el pago';
    const status = message.includes('cuenta') || message.includes('valor')
      ? CONSTANTS.HTTP_STATUS.BAD_REQUEST
      : CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR;
    return errorResponse(res, message, error, status);
  }
};