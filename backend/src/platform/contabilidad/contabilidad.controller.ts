import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

const TIPOS = ['activo', 'pasivo', 'patrimonio', 'ingreso', 'costo', 'gasto'];
const NATURALEZAS = ['debito', 'credito'];

const cuentaTieneMovimientos = async (cuentaId: number, empresaId: number): Promise<boolean> => {
  const movimientos = await query(
    `SELECT COUNT(*) AS total
     FROM movimientos_contables mc
     INNER JOIN comprobantes_contables cc ON cc.id = mc.comprobante_id
     WHERE mc.cuenta_id = ? AND cc.empresa_id = ?`,
    [cuentaId, empresaId]
  );
  return Number(movimientos[0]?.total || 0) > 0;
};

const cuentaEstaConfigurada = async (cuentaId: number, empresaId: number): Promise<boolean> => {
  const configurada = await query(
    `SELECT COUNT(*) AS total FROM configuracion_contable
     WHERE empresa_id = ? AND (
       cuenta_caja_id = ? OR cuenta_bancos_id = ? OR cuenta_clientes_id = ? OR
       cuenta_proveedores_id = ? OR cuenta_ingresos_ventas_id = ? OR
       cuenta_devoluciones_ventas_id = ? OR cuenta_iva_generado_id = ? OR
       cuenta_iva_descontable_id = ? OR cuenta_retenciones_id = ? OR
       cuenta_inventario_id = ? OR cuenta_costo_ventas_id = ? OR
       cuenta_gastos_generales_id = ? OR cuenta_diferencia_inventario_id = ? OR
       cuenta_propinas_pagar_id = ? OR cuenta_resultado_ejercicio_id = ?
     )`,
    [empresaId, ...Array(15).fill(cuentaId)]
  );
  return Number(configurada[0]?.total || 0) > 0;
};

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
              activa, created_at, updated_at,
              EXISTS (
                SELECT 1 FROM configuracion_contable cc
                WHERE cc.empresa_id = plan_cuentas.empresa_id AND (
                  cc.cuenta_caja_id = plan_cuentas.id OR cc.cuenta_bancos_id = plan_cuentas.id OR
                  cc.cuenta_clientes_id = plan_cuentas.id OR cc.cuenta_proveedores_id = plan_cuentas.id OR
                  cc.cuenta_ingresos_ventas_id = plan_cuentas.id OR cc.cuenta_devoluciones_ventas_id = plan_cuentas.id OR
                  cc.cuenta_iva_generado_id = plan_cuentas.id OR cc.cuenta_iva_descontable_id = plan_cuentas.id OR
                  cc.cuenta_retenciones_id = plan_cuentas.id OR cc.cuenta_inventario_id = plan_cuentas.id OR
                  cc.cuenta_costo_ventas_id = plan_cuentas.id OR cc.cuenta_gastos_generales_id = plan_cuentas.id OR
                  cc.cuenta_diferencia_inventario_id = plan_cuentas.id OR cc.cuenta_propinas_pagar_id = plan_cuentas.id OR
                  cc.cuenta_resultado_ejercicio_id = plan_cuentas.id
                )
              ) AS usada_en_configuracion
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

    if (await cuentaTieneMovimientos(cuentaId, empresaId)) {
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

export const obtenerRequisitosEmpresa = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = Number(req.params.empresaId || req.query.empresa_id);
    if (!empresaId) {
      return errorResponse(res, 'empresa_id es obligatorio', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }
    if (!(await usuarioPuedeAccederEmpresa(req, empresaId))) {
      return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    }

    const [empresas, facturacion, bancos, cajas, clientes, proveedores, productos, impuestos, cuentas] = await Promise.all([
      query(
        `SELECT id, nombre, nit, razon_social, ciudad, pais
         FROM empresas WHERE id = ? AND estado != 'cancelada' LIMIT 1`,
        [empresaId]
      ),
      query(
        `SELECT id, empresa_id FROM configuracion_factura WHERE empresa_id = ? LIMIT 1`,
        [empresaId]
      ),
      query(
        `SELECT COUNT(*) AS total FROM cuentas_bancarias WHERE empresa_id = ? AND activo = 1`,
        [empresaId]
      ),
      query(
        `SELECT COUNT(*) AS total FROM cajas WHERE empresa_id = ? AND activo = 1`,
        [empresaId]
      ),
      query(`SELECT COUNT(*) AS total FROM clientes WHERE empresa_id = ?`, [empresaId]),
      query(`SELECT COUNT(*) AS total FROM proveedores WHERE empresa_id = ?`, [empresaId]),
      query(`SELECT COUNT(*) AS total FROM productos WHERE empresa_id = ? AND estado != 'inactivo'`, [empresaId]),
      query(`SELECT COUNT(*) AS total FROM impuestos WHERE empresa_id = ? AND activo = 1`, [empresaId]),
      query(`SELECT COUNT(*) AS total FROM plan_cuentas WHERE empresa_id = ? AND activa = 1`, [empresaId])
    ]);

    if (!empresas.length) {
      return errorResponse(res, 'Empresa no encontrada o inactiva', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);
    }

    const empresa = empresas[0];
    const totalBancos = Number(bancos[0]?.total || 0);
    const totalCajas = Number(cajas[0]?.total || 0);
    const requisitos = [
      {
        codigo: 'empresa_basica',
        titulo: 'Datos básicos de empresa',
        estado: empresa.nombre && empresa.nit ? 'completo' : 'pendiente',
        obligatorio: true,
        detalle: empresa.nombre && empresa.nit ? 'Nombre y NIT disponibles.' : 'Faltan nombre o NIT en Empresa.',
        modulo: 'empresa'
      },
      {
        codigo: 'facturacion',
        titulo: 'Configuración de facturación',
        estado: facturacion.length ? 'completo' : 'pendiente',
        obligatorio: true,
        detalle: facturacion.length ? 'Existe configuración de facturación.' : 'Debe completarse la configuración de facturación.',
        modulo: 'facturacion'
      },
      {
        codigo: 'dinero',
        titulo: 'Medios de dinero revisados',
        estado: totalBancos + totalCajas > 0 ? 'completo' : 'requiere_revision',
        obligatorio: false,
        detalle: `${totalCajas} caja(s) y ${totalBancos} cuenta(s) bancaria(s) activas.`,
        modulo: 'bancos'
      },
      {
        codigo: 'terceros',
        titulo: 'Terceros disponibles',
        estado: Number(clientes[0]?.total || 0) + Number(proveedores[0]?.total || 0) > 0 ? 'completo' : 'no_aplica',
        obligatorio: false,
        detalle: `${clientes[0]?.total || 0} cliente(s) y ${proveedores[0]?.total || 0} proveedor(es).`,
        modulo: 'clientes_proveedores'
      },
      {
        codigo: 'operacion',
        titulo: 'Datos operativos disponibles',
        estado: Number(productos[0]?.total || 0) + Number(impuestos[0]?.total || 0) > 0 ? 'completo' : 'requiere_revision',
        obligatorio: false,
        detalle: `${productos[0]?.total || 0} producto(s) activos y ${impuestos[0]?.total || 0} impuesto(s) activos.`,
        modulo: 'operacion'
      },
      {
        codigo: 'plan_cuentas',
        titulo: 'Plan de cuentas disponible',
        estado: Number(cuentas[0]?.total || 0) > 0 ? 'completo' : 'pendiente',
        obligatorio: true,
        detalle: `${cuentas[0]?.total || 0} cuenta(s) activas.`,
        modulo: 'contabilidad'
      }
    ];

    return successResponse(
      res,
      'Requisitos de parametrización obtenidos exitosamente',
      { empresa, empresa_id: empresaId, requisitos },
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener requisitos de parametrización:', error);
    return errorResponse(res, 'Error al obtener requisitos de parametrización', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

export const editarCuenta = async (req: Request, res: Response): Promise<Response> => {
  try {
    const cuentaId = Number(req.params.id);
    const empresaId = Number(req.body?.empresa_id);
    const { nombre, acepta_movimientos: aceptaMovimientos } = req.body || {};
    if (!cuentaId || !empresaId || !nombre?.trim()) {
      return errorResponse(res, 'Cuenta, empresa y nombre son obligatorios', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }
    if (!(await usuarioPuedeAccederEmpresa(req, empresaId))) {
      return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    }
    if (await cuentaTieneMovimientos(cuentaId, empresaId) && aceptaMovimientos === 0) {
      return errorResponse(res, 'No se puede cambiar esta cuenta porque tiene movimientos contables', null, CONSTANTS.HTTP_STATUS.CONFLICT);
    }

    const configurada = await cuentaEstaConfigurada(cuentaId, empresaId);
    if (configurada && aceptaMovimientos === 0) {
      return errorResponse(res, 'No se puede desactivar una cuenta usada por la configuración contable', null, CONSTANTS.HTTP_STATUS.CONFLICT);
    }

    const resultado = await query(
      `UPDATE plan_cuentas
       SET nombre = ?, acepta_movimientos = COALESCE(?, acepta_movimientos), updated_at = NOW()
       WHERE id = ? AND empresa_id = ? AND es_personalizada = 1`,
      [String(nombre).trim(), aceptaMovimientos === undefined ? null : (aceptaMovimientos ? 1 : 0), cuentaId, empresaId]
    );
    if (!resultado.affectedRows) {
      return errorResponse(res, 'Solo se pueden editar cuentas personalizadas existentes', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);
    }
    return successResponse(res, 'Cuenta contable actualizada exitosamente', null, CONSTANTS.HTTP_STATUS.OK);
  } catch (error) {
    logger.error('Error al editar cuenta contable:', error);
    return errorResponse(res, 'Error al editar cuenta contable', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};