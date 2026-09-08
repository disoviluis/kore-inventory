import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

const TIPOS = ['activo', 'pasivo', 'patrimonio', 'ingreso', 'costo', 'gasto'];
const NATURALEZAS = ['debito', 'credito'];

const usuarioPuedeAccederEmpresa = async (req: Request, empresaId: number): Promise<boolean> => {
  const usuario = (req as any).user;
  if (usuario?.tipo_usuario === 'super_admin') return true;
  if (!usuario?.id) return false;

  const relaciones = await query(
    `SELECT 1 FROM usuario_empresa
     WHERE usuario_id = ? AND empresa_id = ? AND activo = 1
     LIMIT 1`,
    [usuario.id, empresaId]
  );
  return relaciones.length > 0;
};

export const listarPlanCuentas = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = Number(req.query.empresa_id);
    if (!empresaId) {
      return errorResponse(res, 'empresa_id es obligatorio', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }
    if (!(await usuarioPuedeAccederEmpresa(req, empresaId))) {
      return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    }

    const cuentas = await query(
      `SELECT id, empresa_id, catalogo_puc_base_id, codigo, nombre, tipo, nivel,
              cuenta_padre_id, naturaleza, acepta_movimientos, es_personalizada,
              activa, created_at, updated_at
       FROM plan_cuentas
       WHERE empresa_id = ?
       ORDER BY codigo ASC`,
      [empresaId]
    );

    return successResponse(res, 'Plan de cuentas obtenido exitosamente', cuentas, CONSTANTS.HTTP_STATUS.OK);
  } catch (error) {
    logger.error('Error al listar el plan de cuentas:', error);
    return errorResponse(res, 'Error al listar el plan de cuentas', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

export const crearCuenta = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      empresa_id: empresaId,
      codigo,
      nombre,
      tipo,
      nivel,
      cuenta_padre_id: cuentaPadreId,
      naturaleza,
      acepta_movimientos: aceptaMovimientos = 1
    } = req.body || {};

    if (!empresaId || !codigo || !nombre || !tipo || !nivel || !naturaleza) {
      return errorResponse(res, 'empresa_id, codigo, nombre, tipo, nivel y naturaleza son obligatorios', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }
    if (!(await usuarioPuedeAccederEmpresa(req, Number(empresaId)))) {
      return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    }
    if (!TIPOS.includes(tipo) || !NATURALEZAS.includes(naturaleza)) {
      return errorResponse(res, 'Tipo o naturaleza contable no válida', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    if (cuentaPadreId) {
      const padres = await query(
        `SELECT id, nivel, tipo, naturaleza, acepta_movimientos
         FROM plan_cuentas
         WHERE id = ? AND empresa_id = ? AND activa = 1
         LIMIT 1`,
        [cuentaPadreId, Number(empresaId)]
      );
      if (!padres.length) {
        return errorResponse(res, 'La cuenta padre no existe en la empresa activa', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
      }
      if (padres[0].acepta_movimientos) {
        return errorResponse(res, 'La cuenta padre debe dejar de aceptar movimientos antes de tener cuentas hijas', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
      }
      if (padres[0].tipo !== tipo || padres[0].naturaleza !== naturaleza || Number(nivel) <= Number(padres[0].nivel)) {
        return errorResponse(res, 'La cuenta hija debe conservar tipo, naturaleza y una jerarquía válida', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
      }
    }

    const resultado = await query(
      `INSERT INTO plan_cuentas
        (empresa_id, codigo, nombre, tipo, nivel, cuenta_padre_id, naturaleza, acepta_movimientos, es_personalizada, activa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
      [Number(empresaId), String(codigo).trim(), String(nombre).trim(), tipo, Number(nivel), cuentaPadreId || null, naturaleza, aceptaMovimientos ? 1 : 0]
    );

    return successResponse(
      res,
      'Cuenta contable creada exitosamente',
      { id: resultado.insertId },
      CONSTANTS.HTTP_STATUS.CREATED
    );
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return errorResponse(res, 'Ya existe una cuenta con ese código en la empresa', error, CONSTANTS.HTTP_STATUS.CONFLICT);
    }
    logger.error('Error al crear cuenta contable:', error);
    return errorResponse(res, 'Error al crear cuenta contable', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

export const inactivarCuenta = async (req: Request, res: Response): Promise<Response> => {
  try {
    const cuentaId = Number(req.params.id);
    const empresaId = Number(req.body?.empresa_id || req.query.empresa_id);
    if (!cuentaId || !empresaId) {
      return errorResponse(res, 'Cuenta y empresa son obligatorias', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }
    if (!(await usuarioPuedeAccederEmpresa(req, empresaId))) {
      return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    }

    const movimientos = await query(
      `SELECT COUNT(*) AS total
       FROM movimientos_contables mc
       INNER JOIN comprobantes_contables cc ON cc.id = mc.comprobante_id
       WHERE mc.cuenta_id = ? AND cc.empresa_id = ?`,
      [cuentaId, empresaId]
    );
    if (Number(movimientos[0]?.total || 0) > 0) {
      return errorResponse(res, 'No se puede inactivar una cuenta con movimientos contables', null, CONSTANTS.HTTP_STATUS.CONFLICT);
    }

    const resultado = await query(
      `UPDATE plan_cuentas SET activa = 0
       WHERE id = ? AND empresa_id = ?`,
      [cuentaId, empresaId]
    );
    if (!resultado.affectedRows) {
      return errorResponse(res, 'Cuenta contable no encontrada', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);
    }

    return successResponse(res, 'Cuenta contable inactivada exitosamente', null, CONSTANTS.HTTP_STATUS.OK);
  } catch (error) {
    logger.error('Error al inactivar cuenta contable:', error);
    return errorResponse(res, 'Error al inactivar cuenta contable', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};