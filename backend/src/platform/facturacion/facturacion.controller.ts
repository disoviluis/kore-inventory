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
    
    // Verificar si existe la configuración
    const existe = await query(
      `SELECT id FROM configuracion_factura WHERE empresa_id = ?`,
      [empresaId]
    );

    if (existe.length === 0) {
      // Crear nueva configuración con valores por defecto
      const {
        plantilla_id = 1,
        mostrar_logo = 1,
        logo_posicion = 'izquierda',
        mostrar_slogan = 1,
        color_primario = '#007bff',
        color_secundario = '#6c757d',
        fuente = 'Arial',
        tamano_fuente = 10,
        pie_pagina = null,
        terminos_condiciones = null,
        notas_predeterminadas = null,
        mensaje_agradecimiento = 'Gracias por su compra',
        mostrar_qr = 1,
        mostrar_cufe = 1,
        mostrar_firma = 0,
        texto_firma = null,
        cuentas_bancarias = null,
        mostrar_badges = 1
      } = req.body;

      const cuentas_json = cuentas_bancarias ? JSON.stringify(cuentas_bancarias) : null;

      await query(
        `INSERT INTO configuracion_factura (
          empresa_id, plantilla_id, mostrar_logo, logo_posicion, mostrar_slogan,
          color_primario, color_secundario, fuente, tamano_fuente,
          pie_pagina, terminos_condiciones, notas_predeterminadas,
          mensaje_agradecimiento, mostrar_qr, mostrar_cufe,
          mostrar_firma, texto_firma, cuentas_bancarias, mostrar_badges
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empresaId, plantilla_id, mostrar_logo, logo_posicion, mostrar_slogan,
          color_primario, color_secundario, fuente, tamano_fuente,
          pie_pagina, terminos_condiciones, notas_predeterminadas,
          mensaje_agradecimiento, mostrar_qr, mostrar_cufe,
          mostrar_firma, texto_firma, cuentas_json, mostrar_badges
        ]
      );
    } else {
      // Actualizar solo los campos que se enviaron
      const updates: string[] = [];
      const values: any[] = [];

      // Lista de campos permitidos y sus tipos
      const allowedFields = [
        'plantilla_id', 'mostrar_logo', 'logo_posicion', 'mostrar_slogan',
        'color_primario', 'color_secundario', 'fuente', 'tamano_fuente',
        'pie_pagina', 'terminos_condiciones', 'notas_predeterminadas',
        'mensaje_agradecimiento', 'mostrar_qr', 'mostrar_cufe',
        'mostrar_firma', 'texto_firma', 'cuentas_bancarias', 'mostrar_badges'
      ];

      // Construir UPDATE dinámico solo con campos enviados
      Object.keys(req.body).forEach((field) => {
        if (allowedFields.includes(field)) {
          updates.push(`${field} = ?`);
          // Manejar cuentas_bancarias como JSON
          if (field === 'cuentas_bancarias') {
            values.push(req.body[field] ? JSON.stringify(req.body[field]) : null);
          } else {
            values.push(req.body[field] !== undefined ? req.body[field] : null);
          }
        }
      });

      if (updates.length === 0) {
        return errorResponse(
          res,
          'No se enviaron campos para actualizar',
          null,
          CONSTANTS.HTTP_STATUS.BAD_REQUEST
        );
      }

      // Agregar updated_at
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(empresaId);

      const sql = `UPDATE configuracion_factura SET ${updates.join(', ')} WHERE empresa_id = ?`;
      await query(sql, values);
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
