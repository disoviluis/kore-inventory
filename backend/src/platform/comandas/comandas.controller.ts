import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

const getEmpresaId = (req: Request) => Number(req.query.empresa_id || req.body.empresa_id);

const validarEmpresa = async (req: Request, empresaId: number): Promise<boolean> => {
  const usuario = (req as any).user;
  if (!usuario || !Number.isInteger(empresaId) || empresaId <= 0) return false;
  if (usuario.tipo_usuario === 'super_admin') return true;
  const acceso = await query(
    'SELECT 1 FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ? AND activo = 1 LIMIT 1',
    [usuario.id, empresaId]
  );
  return acceso.length > 0;
};

const cuentaDeEmpresa = async (cuentaId: number, empresaId: number) => {
  const cuentas = await query(
    'SELECT * FROM cuentas_abiertas WHERE id = ? AND empresa_id = ? LIMIT 1',
    [cuentaId, empresaId]
  );
  return cuentas.length > 0 ? cuentas[0] : null;
};

/**
 * GET /api/comandas/mesas
 * Mesas configuradas y las cuentas abiertas asociadas.
 */
export const listarMesas = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    if (!(await validarEmpresa(req, empresaId))) {
      return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    }

    const mesas = await query(
      `SELECT id, numero_mesa, zona, capacidad, estado
       FROM mesas_configuracion
       WHERE empresa_id = ? AND estado <> 'inactiva'
       ORDER BY zona, numero_mesa`,
      [empresaId]
    );

    const cuentas = await query(
      `SELECT ca.id, ca.numero_cuenta, ca.tipo_identificacion, ca.mesa_numero,
              ca.cliente_nombre, ca.total, ca.cuenta_solicitada, ca.fecha_apertura,
              ca.mesero_id, CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) AS mesero_nombre,
              (SELECT COUNT(*) FROM cuenta_abierta_detalle d WHERE d.cuenta_abierta_id = ca.id) AS items,
              (SELECT COUNT(*) FROM comandas c
                 INNER JOIN comanda_items ci ON ci.comanda_id = c.id
               WHERE c.cuenta_abierta_id = ca.id AND ci.estado = 'listo') AS items_listos,
              (SELECT COUNT(*) FROM cuenta_abierta_detalle d
               WHERE d.cuenta_abierta_id = ca.id
                 AND NOT EXISTS (SELECT 1 FROM comanda_items ci WHERE ci.cuenta_detalle_id = d.id)) AS items_sin_enviar
       FROM cuentas_abiertas ca
       LEFT JOIN usuarios u ON u.id = ca.mesero_id
       WHERE ca.empresa_id = ? AND ca.estado = 'abierta'
       ORDER BY ca.fecha_apertura DESC`,
      [empresaId]
    );

    return successResponse(res, 'Mesas y cuentas activas', { mesas, cuentas });
  } catch (error: any) {
    logger.error('Error al listar mesas:', error);
    return errorResponse(res, 'Error al listar mesas', error);
  }
};

/**
 * POST /api/comandas
 * Envía a cocina los items de la cuenta que aún no se han enviado.
 */
export const crearComanda = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    const usuario = (req as any).user;
    if (!(await validarEmpresa(req, empresaId))) {
      return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    }

    const cuentaId = Number(req.body.cuenta_abierta_id);
    const cuenta = await cuentaDeEmpresa(cuentaId, empresaId);
    if (!cuenta) return errorResponse(res, 'Cuenta no encontrada', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);
    if (cuenta.estado !== 'abierta') {
      return errorResponse(res, 'La cuenta ya está cerrada', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    const resultado = await withTransaction(async (txQuery) => {
      // Solo se envía lo que todavía no tiene comanda.
      const pendientes = await txQuery(
        `SELECT d.id, d.producto_id, d.producto_nombre, d.cantidad, d.notas,
                COALESCE(c.estacion, 'cocina') AS estacion
         FROM cuenta_abierta_detalle d
         INNER JOIN productos p ON p.id = d.producto_id
         LEFT JOIN categorias c ON c.id = p.categoria_id
         WHERE d.cuenta_abierta_id = ?
           AND NOT EXISTS (SELECT 1 FROM comanda_items ci WHERE ci.cuenta_detalle_id = d.id)`,
        [cuentaId]
      );

      if (pendientes.length === 0) throw new Error('No hay productos nuevos para enviar a cocina');

      const ultimo = await txQuery(
        'SELECT COALESCE(MAX(numero_comanda), 0) AS ultimo FROM comandas WHERE empresa_id = ? FOR UPDATE',
        [empresaId]
      );
      const numeroComanda = Number(ultimo[0].ultimo) + 1;

      const comanda = await txQuery(
        `INSERT INTO comandas (empresa_id, cuenta_abierta_id, numero_comanda, mesero_id, observaciones)
         VALUES (?, ?, ?, ?, ?)`,
        [empresaId, cuentaId, numeroComanda, usuario.id, req.body.observaciones || null]
      );

      for (const item of pendientes) {
        await txQuery(
          `INSERT INTO comanda_items
            (comanda_id, cuenta_detalle_id, producto_id, producto_nombre, cantidad, observaciones, estacion, inventario_descontado)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [comanda.insertId, item.id, item.producto_id, item.producto_nombre, item.cantidad, item.notas, item.estacion]
        );
      }

      if (!cuenta.mesero_id) {
        await txQuery('UPDATE cuentas_abiertas SET mesero_id = ? WHERE id = ?', [usuario.id, cuentaId]);
      }

      return { comanda_id: comanda.insertId, numero_comanda: numeroComanda, items: pendientes.length };
    });

    logger.info(`Comanda ${resultado.numero_comanda} enviada a cocina (cuenta ${cuentaId})`);
    return successResponse(res, 'Comanda enviada a cocina', resultado, CONSTANTS.HTTP_STATUS.CREATED);
  } catch (error: any) {
    logger.error('Error al crear comanda:', error);
    return errorResponse(res, error?.message || 'Error al enviar la comanda', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
  }
};

/**
 * GET /api/comandas/mis-comandas
 */
export const misComandas = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    const usuario = (req as any).user;
    if (!(await validarEmpresa(req, empresaId))) {
      return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    }

    const items = await query(
      `SELECT ci.id, ci.producto_nombre, ci.cantidad, ci.observaciones, ci.estado, ci.estacion,
              ci.fecha_listo, c.numero_comanda, c.cuenta_abierta_id,
              ca.mesa_numero, ca.cliente_nombre, ca.numero_cuenta
       FROM comanda_items ci
       INNER JOIN comandas c ON c.id = ci.comanda_id
       INNER JOIN cuentas_abiertas ca ON ca.id = c.cuenta_abierta_id
       WHERE c.empresa_id = ? AND c.mesero_id = ?
         AND ci.estado IN ('pendiente','en_preparacion','listo')
       ORDER BY FIELD(ci.estado,'listo','en_preparacion','pendiente'), c.numero_comanda DESC`,
      [empresaId, usuario.id]
    );

    return successResponse(res, 'Comandas del mesero', items);
  } catch (error: any) {
    logger.error('Error al obtener comandas del mesero:', error);
    return errorResponse(res, 'Error al obtener comandas', error);
  }
};

/**
 * GET /api/comandas/tablero
 */
export const tableroCocina = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    if (!(await validarEmpresa(req, empresaId))) {
      return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    }

    const estacion = String(req.query.estacion || '').trim();
    const params: any[] = [empresaId];
    let filtroEstacion = '';
    if (estacion && estacion !== 'todas') {
      filtroEstacion = ' AND ci.estacion = ?';
      params.push(estacion);
    }

    const items = await query(
      `SELECT ci.id, ci.producto_nombre, ci.cantidad, ci.observaciones, ci.estado, ci.estacion,
              ci.fecha_inicio_preparacion, ci.created_at,
              TIMESTAMPDIFF(MINUTE, ci.created_at, NOW()) AS minutos_espera,
              c.numero_comanda, c.fecha_envio,
              ca.mesa_numero, ca.cliente_nombre, ca.numero_cuenta,
              CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) AS mesero_nombre
       FROM comanda_items ci
       INNER JOIN comandas c ON c.id = ci.comanda_id
       INNER JOIN cuentas_abiertas ca ON ca.id = c.cuenta_abierta_id
       LEFT JOIN usuarios u ON u.id = c.mesero_id
       WHERE c.empresa_id = ? AND ci.estado IN ('pendiente','en_preparacion','listo')${filtroEstacion}
       ORDER BY ci.created_at ASC`,
      params
    );

    const resumen = {
      pendientes: items.filter((i: any) => i.estado === 'pendiente').length,
      en_preparacion: items.filter((i: any) => i.estado === 'en_preparacion').length,
      listos: items.filter((i: any) => i.estado === 'listo').length
    };

    return successResponse(res, 'Tablero de cocina', { resumen, items });
  } catch (error: any) {
    logger.error('Error al obtener tablero de cocina:', error);
    return errorResponse(res, 'Error al obtener el tablero', error);
  }
};

/**
 * PUT /api/comandas/items/:id/estado
 */
export const cambiarEstadoItem = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    const usuario = (req as any).user;
    if (!(await validarEmpresa(req, empresaId))) {
      return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    }

    const estado = String(req.body.estado || '');
    const permitidos = ['en_preparacion', 'listo', 'entregado', 'cancelado'];
    if (!permitidos.includes(estado)) {
      return errorResponse(res, 'Estado no válido', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    const motivo = String(req.body.motivo || '').trim();
    if (estado === 'cancelado' && !motivo) {
      return errorResponse(res, 'La cancelación requiere un motivo', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    const items = await query(
      `SELECT ci.id, ci.estado
       FROM comanda_items ci
       INNER JOIN comandas c ON c.id = ci.comanda_id
       WHERE ci.id = ? AND c.empresa_id = ? LIMIT 1`,
      [req.params.id, empresaId]
    );
    if (items.length === 0) return errorResponse(res, 'Producto de comanda no encontrado', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);
    if (['entregado', 'cancelado'].includes(items[0].estado)) {
      return errorResponse(res, 'El producto ya fue entregado o cancelado', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    const campoFecha =
      estado === 'en_preparacion' ? 'fecha_inicio_preparacion' :
      estado === 'listo' ? 'fecha_listo' :
      estado === 'entregado' ? 'fecha_entrega' : null;

    await query(
      `UPDATE comanda_items
       SET estado = ?, usuario_estado_id = ?, motivo_cancelacion = ?
           ${campoFecha ? `, ${campoFecha} = NOW()` : ''}
       WHERE id = ?`,
      [estado, usuario.id, estado === 'cancelado' ? motivo : null, req.params.id]
    );

    return successResponse(res, 'Estado actualizado', { id: Number(req.params.id), estado });
  } catch (error: any) {
    logger.error('Error al cambiar estado de comanda:', error);
    return errorResponse(res, error?.message || 'Error al cambiar el estado', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
  }
};

/**
 * GET /api/comandas/cuenta/:cuentaId/resumen
 * Detalle, total y propina sugerida para informar al cliente en la mesa.
 */
export const resumenCuenta = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    if (!(await validarEmpresa(req, empresaId))) {
      return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    }

    const cuenta = await cuentaDeEmpresa(Number(req.params.cuentaId), empresaId);
    if (!cuenta) return errorResponse(res, 'Cuenta no encontrada', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);

    const items = await query(
      `SELECT id, producto_nombre, cantidad, precio_unitario, total, notas
       FROM cuenta_abierta_detalle
       WHERE cuenta_abierta_id = ?
       ORDER BY fecha_agregado`,
      [cuenta.id]
    );

    const [empresa] = await query('SELECT propina_sugerida_porcentaje FROM empresas WHERE id = ?', [empresaId]);
    const sugerido = Number(empresa?.propina_sugerida_porcentaje) || 0;

    const totalConsumo = Number(cuenta.total) || 0;
    const porcentajeAplicado = Number(cuenta.propina_habilitada) ? Number(cuenta.propina_porcentaje) : sugerido;
    const propinaValor = Number(cuenta.propina_habilitada)
      ? Number(cuenta.propina_valor)
      : Math.round((Number(cuenta.subtotal) || 0) * sugerido) / 100;

    return successResponse(res, 'Resumen de la cuenta', {
      cuenta: {
        id: cuenta.id,
        numero_cuenta: cuenta.numero_cuenta,
        mesa_numero: cuenta.mesa_numero,
        cliente_nombre: cuenta.cliente_nombre,
        cuenta_solicitada: !!cuenta.cuenta_solicitada
      },
      items,
      subtotal: Number(cuenta.subtotal) || 0,
      impuestos: Number(cuenta.total_impuestos) || 0,
      total_consumo: totalConsumo,
      propina: {
        aceptada: !!Number(cuenta.propina_habilitada),
        porcentaje: porcentajeAplicado,
        valor: propinaValor,
        sugerida_porcentaje: sugerido,
        // La propina es voluntaria: el cliente puede aceptarla, cambiarla o rechazarla.
        voluntaria: true
      },
      total_a_pagar: totalConsumo + (Number(cuenta.propina_habilitada) ? Number(cuenta.propina_valor) : 0)
    });
  } catch (error: any) {
    logger.error('Error al obtener resumen de cuenta:', error);
    return errorResponse(res, 'Error al obtener el resumen', error);
  }
};

/**
 * POST /api/comandas/cuenta/:cuentaId/propina
 * Registra la decisión del cliente tomada en la mesa.
 */
export const registrarPropina = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    const usuario = (req as any).user;
    if (!(await validarEmpresa(req, empresaId))) {
      return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    }

    const cuenta = await cuentaDeEmpresa(Number(req.params.cuentaId), empresaId);
    if (!cuenta) return errorResponse(res, 'Cuenta no encontrada', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);
    if (cuenta.estado !== 'abierta') {
      return errorResponse(res, 'La cuenta ya está cerrada', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    const acepta = req.body.acepta === true || req.body.acepta === 1;
    const base = Number(cuenta.subtotal) || 0;
    let porcentaje = 0;
    let valor = 0;

    if (acepta) {
      if (req.body.valor !== undefined && req.body.valor !== null && req.body.valor !== '') {
        valor = Number(req.body.valor);
        if (!Number.isFinite(valor) || valor < 0) {
          return errorResponse(res, 'El valor de la propina no es válido', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
        }
        porcentaje = base > 0 ? Math.round((valor / base) * 10000) / 100 : 0;
      } else {
        porcentaje = Number(req.body.porcentaje);
        if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
          return errorResponse(res, 'El porcentaje de propina no es válido', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
        }
        valor = Math.round(base * porcentaje) / 100;
      }
    }

    await query(
      `UPDATE cuentas_abiertas
       SET propina_habilitada = ?, propina_porcentaje = ?, propina_valor = ?,
           propina_confirmada_por = ?, fecha_propina = NOW()
       WHERE id = ?`,
      [acepta ? 1 : 0, porcentaje, valor, usuario.id, cuenta.id]
    );

    return successResponse(res, acepta ? 'Propina registrada' : 'El cliente no acepta propina', {
      acepta,
      porcentaje,
      valor,
      total_a_pagar: (Number(cuenta.total) || 0) + valor
    });
  } catch (error: any) {
    logger.error('Error al registrar propina:', error);
    return errorResponse(res, error?.message || 'Error al registrar la propina', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
  }
};

/**
 * POST /api/comandas/cuenta/:cuentaId/solicitar
 * Avisa a caja que la mesa pidió la cuenta.
 */
export const solicitarCuentaMesa = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = getEmpresaId(req);
    if (!(await validarEmpresa(req, empresaId))) {
      return errorResponse(res, 'No tienes acceso a esta empresa', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    }

    const cuenta = await cuentaDeEmpresa(Number(req.params.cuentaId), empresaId);
    if (!cuenta) return errorResponse(res, 'Cuenta no encontrada', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);

    await query(
      `UPDATE cuentas_abiertas
       SET cuenta_solicitada = TRUE, fecha_cuenta_solicitada = NOW()
       WHERE id = ? AND estado = 'abierta'`,
      [cuenta.id]
    );

    logger.info(`Mesa ${cuenta.mesa_numero || cuenta.numero_cuenta} solicitó la cuenta`);
    return successResponse(res, 'Se avisó a caja que la mesa pidió la cuenta', { cuenta_id: cuenta.id });
  } catch (error: any) {
    logger.error('Error al solicitar la cuenta:', error);
    return errorResponse(res, 'Error al solicitar la cuenta', error);
  }
};
