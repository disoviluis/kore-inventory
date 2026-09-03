import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
import { errorResponse, successResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

const TOLERANCIA_DIAS = 5;

const getEmpresaId = (req: Request) => Number(req.query.empresa_id || req.body.empresa_id);

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

const validarCuenta = async (empresaId: number, cuentaId: number) => {
  const cuentas = await query('SELECT id FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? LIMIT 1', [cuentaId, empresaId]);
  return cuentas.length > 0;
};

const diasEntre = (a: string, b: string) => Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

/**
 * GET /api/finanzas/bancos/conciliacion/movimientos
 */
export const movimientosPeriodo = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    if (!(await validarEmpresa(req, empresaId))) return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);

    const cuentaId = Number(req.query.cuenta_bancaria_id);
    const { desde, hasta } = req.query;
    if (!cuentaId || !desde || !hasta) return errorResponse(res, 'Cuenta y rango de fechas son obligatorios', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    if (!(await validarCuenta(empresaId, cuentaId))) return errorResponse(res, 'La cuenta bancaria no pertenece a la empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);

    const movimientos = await query(
      `SELECT id, tipo, origen, fecha_movimiento, referencia, descripcion, valor, conciliado
       FROM movimientos_bancarios
       WHERE empresa_id = ? AND cuenta_bancaria_id = ?
         AND DATE(fecha_movimiento) BETWEEN ? AND ?
       ORDER BY fecha_movimiento ASC, id ASC`,
      [empresaId, cuentaId, desde, hasta]
    );

    const [saldos] = await query(
      `SELECT COALESCE(saldo_actual, 0) AS saldo_actual FROM cuentas_bancarias WHERE id = ?`,
      [cuentaId]
    );

    return successResponse(res, 'Movimientos del período', { movimientos, saldo_actual: Number(saldos?.saldo_actual) || 0 });
  } catch (error: any) {
    logger.error('Error al obtener movimientos de conciliación:', error);
    return errorResponse(res, 'Error al obtener movimientos', error);
  }
};

/**
 * POST /api/finanzas/bancos/conciliacion/cruzar
 * Compara los movimientos en libros contra las filas del extracto bancario.
 */
export const cruzarExtracto = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    if (!(await validarEmpresa(req, empresaId))) return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);

    const cuentaId = Number(req.body.cuenta_bancaria_id);
    const { desde, hasta, extracto } = req.body;
    if (!cuentaId || !desde || !hasta || !Array.isArray(extracto) || extracto.length === 0) {
      return errorResponse(res, 'Cuenta, rango de fechas y extracto son obligatorios', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }
    if (!(await validarCuenta(empresaId, cuentaId))) return errorResponse(res, 'La cuenta bancaria no pertenece a la empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);

    const movimientos = await query(
      `SELECT id, tipo, fecha_movimiento, referencia, descripcion, valor, conciliado
       FROM movimientos_bancarios
       WHERE empresa_id = ? AND cuenta_bancaria_id = ?
         AND DATE(fecha_movimiento) BETWEEN ? AND ?
       ORDER BY fecha_movimiento ASC, id ASC`,
      [empresaId, cuentaId, desde, hasta]
    );

    const filasExtracto = extracto.map((fila: any, indice: number) => ({
      indice: indice + 1,
      fecha: String(fila.fecha || '').slice(0, 10),
      valor: Math.abs(Number(fila.valor)),
      referencia: String(fila.referencia || '').trim(),
      descripcion: String(fila.descripcion || '').trim(),
      usada: false
    }));

    const conciliables: any[] = [];
    const soloLibros: any[] = [];

    for (const movimiento of movimientos) {
      const fechaLibro = String(movimiento.fecha_movimiento).slice(0, 10);
      const valorLibro = Math.abs(Number(movimiento.valor));
      const referenciaLibro = String(movimiento.referencia || '').trim().toLowerCase();

      const candidatas = filasExtracto.filter(fila =>
        !fila.usada &&
        Math.abs(fila.valor - valorLibro) < 0.01 &&
        (!fila.fecha || diasEntre(fila.fecha, fechaLibro) <= TOLERANCIA_DIAS)
      );

      // Se prefiere la fila cuya referencia coincide con la del libro.
      const coincidencia =
        candidatas.find(fila => referenciaLibro && fila.referencia.toLowerCase() === referenciaLibro) ||
        candidatas[0];

      if (coincidencia) {
        coincidencia.usada = true;
        conciliables.push({
          movimiento_id: movimiento.id,
          fecha_libros: fechaLibro,
          descripcion: movimiento.descripcion,
          valor: valorLibro,
          ya_conciliado: Number(movimiento.conciliado) === 1,
          extracto_fila: coincidencia.indice,
          extracto_fecha: coincidencia.fecha,
          extracto_referencia: coincidencia.referencia
        });
      } else {
        soloLibros.push({
          movimiento_id: movimiento.id,
          fecha: fechaLibro,
          descripcion: movimiento.descripcion,
          referencia: movimiento.referencia,
          valor: valorLibro
        });
      }
    }

    const soloBanco = filasExtracto
      .filter(fila => !fila.usada)
      .map(fila => ({ fila: fila.indice, fecha: fila.fecha, descripcion: fila.descripcion, referencia: fila.referencia, valor: fila.valor }));

    const totalLibros = movimientos.reduce((suma: number, movimiento: any) => suma + Math.abs(Number(movimiento.valor)), 0);
    const totalExtracto = filasExtracto.reduce((suma: number, fila: any) => suma + fila.valor, 0);

    return successResponse(res, 'Cruce realizado', {
      resumen: {
        movimientos_libros: movimientos.length,
        filas_extracto: filasExtracto.length,
        coincidencias: conciliables.length,
        solo_libros: soloLibros.length,
        solo_banco: soloBanco.length,
        total_libros: totalLibros,
        total_extracto: totalExtracto,
        diferencia: Math.round((totalLibros - totalExtracto) * 100) / 100
      },
      conciliables,
      solo_libros: soloLibros,
      solo_banco: soloBanco
    });
  } catch (error: any) {
    logger.error('Error al cruzar extracto bancario:', error);
    return errorResponse(res, error?.message || 'Error al cruzar el extracto', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
  }
};

/**
 * POST /api/finanzas/bancos/conciliacion/cerrar
 */
export const cerrarConciliacion = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    const usuario = (req as any).user;
    if (!(await validarEmpresa(req, empresaId))) return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);

    const cuentaId = Number(req.body.cuenta_bancaria_id);
    const { desde, hasta, movimientos, saldo_extracto, observaciones } = req.body;
    if (!cuentaId || !desde || !hasta || !Array.isArray(movimientos)) {
      return errorResponse(res, 'Cuenta, período y movimientos son obligatorios', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }
    if (!(await validarCuenta(empresaId, cuentaId))) return errorResponse(res, 'La cuenta bancaria no pertenece a la empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);

    const ids = movimientos.map((id: any) => Number(id));
    if (ids.some((id: number) => !Number.isInteger(id) || id <= 0)) {
      return errorResponse(res, 'La lista de movimientos contiene identificadores inválidos', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    const resultado = await withTransaction(async (txQuery) => {
      let conciliados = 0;

      for (const movimientoId of ids) {
        const actualizado = await txQuery(
          `UPDATE movimientos_bancarios
           SET conciliado = 1, fecha_conciliacion = NOW(), conciliado_por = ?
           WHERE id = ? AND empresa_id = ? AND cuenta_bancaria_id = ? AND conciliado = 0`,
          [usuario.id, movimientoId, empresaId, cuentaId]
        );
        conciliados += actualizado.affectedRows;
      }

      const totales = await txQuery(
        `SELECT COALESCE(SUM(CASE WHEN tipo IN ('deposito','nota_credito') THEN valor ELSE -valor END), 0) AS saldo_libros
         FROM movimientos_bancarios
         WHERE empresa_id = ? AND cuenta_bancaria_id = ? AND DATE(fecha_movimiento) BETWEEN ? AND ?`,
        [empresaId, cuentaId, desde, hasta]
      );

      const saldoLibros = Number(totales[0].saldo_libros) || 0;
      const saldoExtracto = Number(saldo_extracto) || 0;
      const diferencia = Math.round((saldoLibros - saldoExtracto) * 100) / 100;

      const cierre = await txQuery(
        `INSERT INTO conciliaciones_bancarias
         (empresa_id, cuenta_bancaria_id, fecha_desde, fecha_hasta, saldo_libros, saldo_extracto, diferencia, movimientos_conciliados, observaciones, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [empresaId, cuentaId, desde, hasta, saldoLibros, saldoExtracto, diferencia, conciliados, observaciones || null, usuario.id]
      );

      return { id: cierre.insertId, conciliados, saldo_libros: saldoLibros, saldo_extracto: saldoExtracto, diferencia };
    });

    return successResponse(res, 'Conciliación cerrada exitosamente', resultado, CONSTANTS.HTTP_STATUS.CREATED);
  } catch (error: any) {
    logger.error('Error al cerrar conciliación:', error);
    return errorResponse(res, error?.message || 'Error al cerrar la conciliación', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
  }
};

/**
 * GET /api/finanzas/bancos/conciliacion/historial
 */
export const historialConciliaciones = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    if (!(await validarEmpresa(req, empresaId))) return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);

    const historial = await query(
      `SELECT c.*, cb.banco, cb.nombre AS cuenta_nombre,
              CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) AS usuario_nombre
       FROM conciliaciones_bancarias c
       INNER JOIN cuentas_bancarias cb ON cb.id = c.cuenta_bancaria_id
       LEFT JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.empresa_id = ?
       ORDER BY c.fecha_hasta DESC, c.id DESC
       LIMIT 100`,
      [empresaId]
    );

    return successResponse(res, 'Historial de conciliaciones', historial);
  } catch (error: any) {
    logger.error('Error al obtener historial de conciliaciones:', error);
    return errorResponse(res, 'Error al obtener historial', error);
  }
};
