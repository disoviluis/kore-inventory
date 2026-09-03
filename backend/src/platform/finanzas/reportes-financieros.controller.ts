import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { errorResponse, successResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

const getEmpresaId = (req: Request) => Number(req.query.empresaId || req.query.empresa_id);

const validarEmpresa = async (req: Request, empresaId: number) => {
  const usuario = (req as any).user;
  if (!usuario || !Number.isInteger(empresaId) || empresaId <= 0) return false;
  if (usuario.tipo_usuario === 'super_admin') return true;
  const acceso = await query(
    'SELECT 1 FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ? AND activo = 1 LIMIT 1',
    [usuario.id, empresaId]
  );
  return acceso.length > 0;
};

const rangoFechas = (req: Request) => {
  const hoy = new Date();
  const desde = String(req.query.desde || new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10));
  const hasta = String(req.query.hasta || hoy.toISOString().slice(0, 10));
  return { desde, hasta };
};

/**
 * GET /api/finanzas/reportes/estado-resultados
 * Ingresos y costos por causación: incluye ventas a crédito no anuladas.
 */
export const estadoResultados = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    if (!(await validarEmpresa(req, empresaId))) return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    const { desde, hasta } = rangoFechas(req);

    const [ingresos] = await query(
      `SELECT COALESCE(SUM(total), 0) AS total_ingresos, COUNT(*) AS facturas
       FROM ventas
       WHERE empresa_id = ? AND estado <> 'anulada' AND DATE(fecha_venta) BETWEEN ? AND ?`,
      [empresaId, desde, hasta]
    );

    const [costo] = await query(
      `SELECT COALESCE(SUM(vd.cantidad * COALESCE(p.precio_compra, 0)), 0) AS costo_ventas
       FROM venta_detalle vd
       INNER JOIN ventas v ON v.id = vd.venta_id
       INNER JOIN productos p ON p.id = vd.producto_id
       WHERE v.empresa_id = ? AND v.estado <> 'anulada' AND DATE(v.fecha_venta) BETWEEN ? AND ?`,
      [empresaId, desde, hasta]
    );

    const gastosPorCategoria = await query(
      `SELECT categoria, COALESCE(SUM(monto), 0) AS total
       FROM gastos
       WHERE empresa_id = ? AND estado = 'registrado' AND fecha BETWEEN ? AND ?
       GROUP BY categoria
       ORDER BY total DESC`,
      [empresaId, desde, hasta]
    );

    const [gastosCaja] = await query(
      `SELECT COALESCE(SUM(g.monto), 0) AS total
       FROM gastos_caja g
       INNER JOIN turnos_caja t ON t.id = g.turno_id
       WHERE t.empresa_id = ? AND DATE(g.fecha_registro) BETWEEN ? AND ?`,
      [empresaId, desde, hasta]
    );

    const totalIngresos = Number(ingresos.total_ingresos) || 0;
    const costoVentas = Number(costo.costo_ventas) || 0;
    const totalGastosGenerales = gastosPorCategoria.reduce((suma: number, fila: any) => suma + Number(fila.total), 0);
    const totalGastosCaja = Number(gastosCaja.total) || 0;
    const utilidadBruta = totalIngresos - costoVentas;
    const utilidadNeta = utilidadBruta - totalGastosGenerales - totalGastosCaja;

    return successResponse(res, 'Estado de resultados', {
      periodo: { desde, hasta },
      ingresos: { total: totalIngresos, facturas: Number(ingresos.facturas) || 0 },
      costo_ventas: costoVentas,
      utilidad_bruta: utilidadBruta,
      margen_bruto_pct: totalIngresos > 0 ? Math.round((utilidadBruta / totalIngresos) * 1000) / 10 : 0,
      gastos: {
        generales: totalGastosGenerales,
        caja: totalGastosCaja,
        total: totalGastosGenerales + totalGastosCaja,
        por_categoria: gastosPorCategoria
      },
      utilidad_neta: utilidadNeta,
      margen_neto_pct: totalIngresos > 0 ? Math.round((utilidadNeta / totalIngresos) * 1000) / 10 : 0
    });
  } catch (error: any) {
    logger.error('Error en estado de resultados:', error);
    return errorResponse(res, 'Error al generar el estado de resultados', error);
  }
};

/**
 * GET /api/finanzas/reportes/flujo-caja
 * Movimiento real de dinero: ventas de contado, cobros, gastos y pagos a proveedores.
 */
export const flujoCaja = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    if (!(await validarEmpresa(req, empresaId))) return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    const { desde, hasta } = rangoFechas(req);

    const [ventasContado] = await query(
      `SELECT COALESCE(SUM(total), 0) AS total
       FROM ventas
       WHERE empresa_id = ? AND estado <> 'anulada'
         AND COALESCE(forma_pago, 'contado') <> 'credito'
         AND DATE(fecha_venta) BETWEEN ? AND ?`,
      [empresaId, desde, hasta]
    );

    const [cobros] = await query(
      `SELECT COALESCE(SUM(valor_total), 0) AS total
       FROM recibos_caja
       WHERE empresa_id = ? AND anulado = 0 AND fecha_recibo BETWEEN ? AND ?`,
      [empresaId, desde, hasta]
    );

    const [gastosGenerales] = await query(
      `SELECT COALESCE(SUM(monto), 0) AS total
       FROM gastos
       WHERE empresa_id = ? AND estado = 'registrado' AND fecha BETWEEN ? AND ?`,
      [empresaId, desde, hasta]
    );

    const [gastosCaja] = await query(
      `SELECT COALESCE(SUM(g.monto), 0) AS total
       FROM gastos_caja g
       INNER JOIN turnos_caja t ON t.id = g.turno_id
       WHERE t.empresa_id = ? AND DATE(g.fecha_registro) BETWEEN ? AND ?`,
      [empresaId, desde, hasta]
    );

    const [pagosProveedores] = await query(
      `SELECT COALESCE(SUM(valor_total), 0) AS total
       FROM comprobantes_egreso
       WHERE empresa_id = ? AND anulado = 0 AND fecha_pago BETWEEN ? AND ?`,
      [empresaId, desde, hasta]
    );

    const [saldosBancos] = await query(
      `SELECT COALESCE(SUM(saldo_actual), 0) AS total FROM cuentas_bancarias WHERE empresa_id = ? AND activo = 1`,
      [empresaId]
    );

    const entradas = {
      ventas_contado: Number(ventasContado.total) || 0,
      cobros_clientes: Number(cobros.total) || 0
    };
    const salidas = {
      gastos_generales: Number(gastosGenerales.total) || 0,
      gastos_caja: Number(gastosCaja.total) || 0,
      pagos_proveedores: Number(pagosProveedores.total) || 0
    };

    const totalEntradas = entradas.ventas_contado + entradas.cobros_clientes;
    const totalSalidas = salidas.gastos_generales + salidas.gastos_caja + salidas.pagos_proveedores;

    return successResponse(res, 'Flujo de caja', {
      periodo: { desde, hasta },
      entradas,
      salidas,
      total_entradas: totalEntradas,
      total_salidas: totalSalidas,
      flujo_neto: Math.round((totalEntradas - totalSalidas) * 100) / 100,
      saldo_bancos: Number(saldosBancos.total) || 0
    });
  } catch (error: any) {
    logger.error('Error en flujo de caja:', error);
    return errorResponse(res, 'Error al generar el flujo de caja', error);
  }
};
