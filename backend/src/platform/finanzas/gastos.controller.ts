import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
import { errorResponse, successResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

const getEmpresaId = (req: Request) => Number(req.query.empresaId || req.body.empresaId);

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

export const listarGastos = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    if (!(await validarEmpresa(req, empresaId))) return errorResponse(res, 'No tienes acceso a la empresa seleccionada', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    const { fechaDesde, fechaHasta, categoria, estado = 'registrado' } = req.query;
    let sql = `SELECT g.*, CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) AS usuario_nombre
      FROM gastos g LEFT JOIN usuarios u ON u.id = g.usuario_id WHERE g.empresa_id = ?`;
    const params: any[] = [empresaId];
    if (fechaDesde) { sql += ' AND g.fecha >= ?'; params.push(fechaDesde); }
    if (fechaHasta) { sql += ' AND g.fecha <= ?'; params.push(fechaHasta); }
    if (categoria) { sql += ' AND g.categoria = ?'; params.push(categoria); }
    if (estado) { sql += ' AND g.estado = ?'; params.push(estado); }
    sql += ' ORDER BY g.fecha DESC, g.id DESC LIMIT 500';
    return successResponse(res, 'Gastos obtenidos exitosamente', await query(sql, params));
  } catch (error) {
    logger.error('Error al listar gastos:', error);
    return errorResponse(res, 'Error al obtener gastos', error);
  }
};

export const resumenGastos = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    if (!(await validarEmpresa(req, empresaId))) return errorResponse(res, 'No tienes acceso a la empresa seleccionada', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    const fechaDesde = req.query.fechaDesde || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const fechaHasta = req.query.fechaHasta || new Date().toISOString().slice(0, 10);
    const datos = await query(`SELECT COUNT(*) AS cantidad, COALESCE(SUM(monto), 0) AS total,
      COALESCE(SUM(CASE WHEN estado = 'registrado' THEN monto ELSE 0 END), 0) AS total_registrado
      FROM gastos WHERE empresa_id = ? AND fecha BETWEEN ? AND ?`, [empresaId, fechaDesde, fechaHasta]);
    const categorias = await query(`SELECT categoria, SUM(monto) AS total FROM gastos
      WHERE empresa_id = ? AND estado = 'registrado' AND fecha BETWEEN ? AND ? GROUP BY categoria ORDER BY total DESC`, [empresaId, fechaDesde, fechaHasta]);
    return successResponse(res, 'Resumen de gastos', { periodo: { fechaDesde, fechaHasta }, totales: datos[0], categorias });
  } catch (error) {
    logger.error('Error en resumen de gastos:', error);
    return errorResponse(res, 'Error al obtener resumen de gastos', error);
  }
};

export const crearGasto = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    const usuario = (req as any).user;
    if (!(await validarEmpresa(req, empresaId))) return errorResponse(res, 'No tienes acceso a la empresa seleccionada', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    const { fecha, categoria, descripcion, proveedor, metodo_pago, monto, observaciones, cuenta_bancaria_id } = req.body;
    const montoNumerico = Number(monto);
    if (!fecha || !categoria || !descripcion || !Number.isFinite(montoNumerico) || montoNumerico <= 0) return errorResponse(res, 'Fecha, categoría, descripción y monto mayor a cero son obligatorios', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    const metodo = metodo_pago || 'efectivo';
    if (metodo !== 'efectivo' && !cuenta_bancaria_id) return errorResponse(res, 'Debe seleccionar la cuenta bancaria del pago', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);

    const gastoId = await withTransaction(async (txQuery) => {
      const result: any = await txQuery(`INSERT INTO gastos (empresa_id, fecha, categoria, descripcion, proveedor, metodo_pago, cuenta_bancaria_id, monto, observaciones, usuario_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [empresaId, fecha, categoria.trim(), descripcion.trim(), proveedor || null, metodo, metodo === 'efectivo' ? null : cuenta_bancaria_id, montoNumerico, observaciones || null, usuario.id]);

      if (metodo !== 'efectivo') {
        const cuentas = await txQuery('SELECT id, saldo_actual FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? AND activo = 1 FOR UPDATE', [cuenta_bancaria_id, empresaId]);
        if (cuentas.length === 0) throw new Error('La cuenta bancaria no existe o está inactiva');
        const saldoAnterior = Number(cuentas[0].saldo_actual);
        const saldoNuevo = saldoAnterior - montoNumerico;
        if (saldoNuevo < 0) throw new Error('El gasto dejaría la cuenta bancaria en saldo negativo');
        await txQuery(`INSERT INTO movimientos_bancarios
          (empresa_id, cuenta_bancaria_id, tipo, origen, referencia, descripcion, valor, saldo_anterior, saldo_nuevo, created_by)
          VALUES (?, ?, 'retiro', 'gasto', ?, ?, ?, ?, ?, ?)`,
          [empresaId, cuenta_bancaria_id, `GASTO-${result.insertId}`, descripcion.trim(), montoNumerico, saldoAnterior, saldoNuevo, usuario.id]);
        await txQuery('UPDATE cuentas_bancarias SET saldo_actual = ? WHERE id = ? AND empresa_id = ?', [saldoNuevo, cuenta_bancaria_id, empresaId]);
      }

      return result.insertId;
    });

    return successResponse(res, 'Gasto registrado exitosamente', { id: gastoId }, CONSTANTS.HTTP_STATUS.CREATED);
  } catch (error: any) {
    logger.error('Error al crear gasto:', error);
    return errorResponse(res, error?.message || 'Error al registrar gasto', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
  }
};

export const anularGasto = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    const usuario = (req as any).user;
    if (!(await validarEmpresa(req, empresaId))) return errorResponse(res, 'No tienes acceso a la empresa seleccionada', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    const motivo = String(req.body.motivo || '').trim();
    if (!motivo) return errorResponse(res, 'El motivo de anulación es obligatorio', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    const resultado = await withTransaction(async (txQuery) => {
      const gastos = await txQuery('SELECT * FROM gastos WHERE id = ? AND empresa_id = ? AND estado = \'registrado\' FOR UPDATE', [req.params.id, empresaId]);
      if (gastos.length === 0) throw new Error('Gasto no encontrado o ya anulado');
      const gasto = gastos[0];

      if (gasto.metodo_pago !== 'efectivo' && gasto.cuenta_bancaria_id) {
        const cuentas = await txQuery('SELECT id, saldo_actual FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? FOR UPDATE', [gasto.cuenta_bancaria_id, empresaId]);
        if (cuentas.length === 0) throw new Error('La cuenta bancaria del gasto no existe');
        const saldoAnterior = Number(cuentas[0].saldo_actual);
        const saldoNuevo = saldoAnterior + Number(gasto.monto);
        await txQuery(`INSERT INTO movimientos_bancarios
          (empresa_id, cuenta_bancaria_id, tipo, origen, referencia, descripcion, valor, saldo_anterior, saldo_nuevo, created_by)
          VALUES (?, ?, 'deposito', 'gasto', ?, ?, ?, ?, ?, ?)`,
          [empresaId, gasto.cuenta_bancaria_id, `GASTO-${gasto.id}`, `Anulación de gasto ${gasto.id}`, gasto.monto, saldoAnterior, saldoNuevo, usuario.id]);
        await txQuery('UPDATE cuentas_bancarias SET saldo_actual = ? WHERE id = ? AND empresa_id = ?', [saldoNuevo, gasto.cuenta_bancaria_id, empresaId]);
      }

      return txQuery(`UPDATE gastos SET estado = 'anulado', fecha_anulacion = NOW(), usuario_anula_id = ?, motivo_anulacion = ? WHERE id = ? AND empresa_id = ?`, [usuario.id, motivo, req.params.id, empresaId]);
    });
    return successResponse(res, 'Gasto anulado exitosamente', { actualizado: resultado.affectedRows });
  } catch (error) {
    logger.error('Error al anular gasto:', error);
    return errorResponse(res, 'Error al anular gasto', error, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
  }
};
