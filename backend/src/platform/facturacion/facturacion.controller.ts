/**
 * =================================
 * KORE INVENTORY - FACTURACIÓN CONTROLLER
 * Controlador de configuración de facturación
 * =================================
 */

import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

/**
 * Obtener configuración de facturación por empresa
 * GET /api/facturacion/configuracion/:empresaId
 */
export const getConfiguracionFacturacion = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId } = req.params;

    const configuracion = await query(
      `SELECT * FROM configuracion_factura WHERE empresa_id = ?`,
      [empresaId]
    );

    if (configuracion.length === 0) {
      return errorResponse(
        res,
        'Configuración de facturación no encontrada',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    logger.info(`Configuración de facturación obtenida para empresa: ${empresaId}`);
    
    return successResponse(
      res,
      'Configuración obtenida exitosamente',
      configuracion[0],
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener configuración:', error);
    return errorResponse(
      res,
      'Error al obtener configuración de facturación',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Actualizar configuración de facturación
 * PUT /api/facturacion/configuracion/:empresaId
 */
export const updateConfiguracionFacturacion = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId } = req.params;
    
    // Obtener valores del body y convertir undefined a null
    const mostrar_logo = req.body.mostrar_logo ?? null;
    const logo_posicion = req.body.logo_posicion ?? null;
    const mostrar_slogan = req.body.mostrar_slogan ?? null;
    const color_primario = req.body.color_primario ?? null;
    const color_secundario = req.body.color_secundario ?? null;
    const fuente = req.body.fuente ?? null;
    const tamano_fuente = req.body.tamano_fuente ?? null;
    const pie_pagina = req.body.pie_pagina ?? null;
    const terminos_condiciones = req.body.terminos_condiciones ?? null;
    const notas_predeterminadas = req.body.notas_predeterminadas ?? null;
    const mensaje_agradecimiento = req.body.mensaje_agradecimiento ?? null;
    const mostrar_qr = req.body.mostrar_qr ?? null;
    const mostrar_cufe = req.body.mostrar_cufe ?? null;
    const mostrar_firma = req.body.mostrar_firma ?? null;
    const texto_firma = req.body.texto_firma ?? null;
    const cuentas_bancarias = req.body.cuentas_bancarias ? JSON.stringify(req.body.cuentas_bancarias) : null;

    // Verificar si existe la configuración
    const existe = await query(
      `SELECT id FROM configuracion_factura WHERE empresa_id = ?`,
      [empresaId]
    );

    if (existe.length === 0) {
      // Crear nueva configuración
      await query(
        `INSERT INTO configuracion_factura (
          empresa_id, mostrar_logo, logo_posicion, mostrar_slogan,
          color_primario, color_secundario, fuente, tamano_fuente,
          pie_pagina, terminos_condiciones, notas_predeterminadas,
          mensaje_agradecimiento, mostrar_qr, mostrar_cufe,
          mostrar_firma, texto_firma, cuentas_bancarias
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empresaId, mostrar_logo, logo_posicion, mostrar_slogan,
          color_primario, color_secundario, fuente, tamano_fuente,
          pie_pagina, terminos_condiciones, notas_predeterminadas,
          mensaje_agradecimiento, mostrar_qr, mostrar_cufe,
          mostrar_firma, texto_firma, cuentas_bancarias
        ]
      );
    } else {
      // Actualizar configuración existente
      await query(
        `UPDATE configuracion_factura SET
          mostrar_logo = ?,
          logo_posicion = ?,
          mostrar_slogan = ?,
          color_primario = ?,
          color_secundario = ?,
          fuente = ?,
          tamano_fuente = ?,
          pie_pagina = ?,
          terminos_condiciones = ?,
          notas_predeterminadas = ?,
          mensaje_agradecimiento = ?,
          mostrar_qr = ?,
          mostrar_cufe = ?,
          mostrar_firma = ?,
          texto_firma = ?,
          cuentas_bancarias = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE empresa_id = ?`,
        [
          mostrar_logo, logo_posicion, mostrar_slogan,
          color_primario, color_secundario, fuente, tamano_fuente,
          pie_pagina, terminos_condiciones, notas_predeterminadas,
          mensaje_agradecimiento, mostrar_qr, mostrar_cufe,
          mostrar_firma, texto_firma, cuentas_bancarias,
          empresaId
        ]
      );
    }

    logger.info(`Configuración de facturación actualizada para empresa: ${empresaId}`);
    
    return successResponse(
      res,
      'Configuración actualizada exitosamente',
      null,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al actualizar configuración:', error);
    return errorResponse(
      res,
      'Error al actualizar configuración de facturación',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Obtener retenciones de una empresa
 * GET /api/facturacion/retenciones/:empresaId
 */
export const getRetenciones = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId } = req.params;
    const { tipo } = req.query;

    let sql = `SELECT * FROM retenciones WHERE empresa_id = ?`;
    const params: any[] = [empresaId];

    if (tipo) {
      sql += ` AND tipo = ?`;
      params.push(tipo);
    }

    sql += ` ORDER BY tipo, nombre`;

    const retenciones = await query(sql, params);

    logger.info(`Retenciones obtenidas para empresa: ${empresaId}`);
    
    return successResponse(
      res,
      'Retenciones obtenidas exitosamente',
      retenciones,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener retenciones:', error);
    return errorResponse(
      res,
      'Error al obtener retenciones',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Crear retención
 * POST /api/facturacion/retenciones
 */
export const createRetencion = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      empresa_id,
      codigo,
      nombre,
      tipo,
      porcentaje,
      base_minima,
      descripcion,
      activo
    } = req.body;

    // Validar campos requeridos
    if (!empresa_id || !codigo || !nombre || !tipo || porcentaje === undefined) {
      return errorResponse(
        res,
        'Campos requeridos: empresa_id, codigo, nombre, tipo, porcentaje',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const result = await query(
      `INSERT INTO retenciones (
        empresa_id, codigo, nombre, tipo, porcentaje,
        base_minima, descripcion, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [empresa_id, codigo, nombre, tipo, porcentaje, base_minima || 0, descripcion, activo ?? true]
    );

    logger.info(`Retención creada: ${nombre} (ID: ${result.insertId})`);
    
    return successResponse(
      res,
      'Retención creada exitosamente',
      { id: result.insertId },
      CONSTANTS.HTTP_STATUS.CREATED
    );
  } catch (error: any) {
    logger.error('Error al crear retención:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return errorResponse(
        res,
        'Ya existe una retención con ese código para esta empresa',
        error,
        CONSTANTS.HTTP_STATUS.CONFLICT
      );
    }
    
    return errorResponse(
      res,
      'Error al crear retención',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Actualizar retención
 * PUT /api/facturacion/retenciones/:id
 */
export const updateRetencion = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    // Convertir undefined a null
    const codigo = req.body.codigo ?? null;
    const nombre = req.body.nombre ?? null;
    const tipo = req.body.tipo ?? null;
    const porcentaje = req.body.porcentaje ?? null;
    const base_minima = req.body.base_minima ?? null;
    const descripcion = req.body.descripcion ?? null;
    const activo = req.body.activo ?? null;

    await query(
      `UPDATE retenciones SET
        codigo = ?,
        nombre = ?,
        tipo = ?,
        porcentaje = ?,
        base_minima = ?,
        descripcion = ?,
        activo = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [codigo, nombre, tipo, porcentaje, base_minima, descripcion, activo, id]
    );

    logger.info(`Retención actualizada: ${id}`);
    
    return successResponse(
      res,
      'Retención actualizada exitosamente',
      null,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al actualizar retención:', error);
    return errorResponse(
      res,
      'Error al actualizar retención',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Eliminar retención
 * DELETE /api/facturacion/retenciones/:id
 */
export const deleteRetencion = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    await query(`DELETE FROM retenciones WHERE id = ?`, [id]);

    logger.info(`Retención eliminada: ${id}`);
    
    return successResponse(
      res,
      'Retención eliminada exitosamente',
      null,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al eliminar retención:', error);
    return errorResponse(
      res,
      'Error al eliminar retención',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};
