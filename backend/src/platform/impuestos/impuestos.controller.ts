/**
 * =================================
 * KORE INVENTORY - IMPUESTOS CONTROLLER
 * Controlador de impuestos adicionales
 * =================================
 */

import { Request, Response } from 'express';
import pool from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * Obtener todos los impuestos de una empresa
 * GET /api/impuestos?empresaId=X
 */
export const getImpuestos = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId } = req.query;

    if (!empresaId) {
      return errorResponse(
        res,
        'ID de empresa es requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const [impuestos] = await pool.query<RowDataPacket[]>(
      `SELECT 
        i.id,
        i.empresa_id,
        i.codigo,
        i.nombre,
        i.descripcion,
        i.tipo,
        i.tasa,
        i.aplica_sobre,
        i.afecta_total,
        i.aplica_automaticamente,
        i.requiere_autorizacion,
        i.cuenta_contable,
        i.orden,
        i.activo,
        i.created_at,
        i.updated_at
      FROM impuestos i
      WHERE i.empresa_id = ?
      ORDER BY i.orden ASC, i.nombre ASC`,
      [empresaId]
    );

    logger.info(`Impuestos obtenidos para empresa ${empresaId}: ${impuestos.length}`);
    return successResponse(res, 'Impuestos obtenidos exitosamente', impuestos, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener impuestos:', error);
    return errorResponse(res, 'Error al obtener impuestos', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Obtener impuestos activos para POS
 * GET /api/impuestos/activos?empresaId=X
 */
export const getImpuestosActivos = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId } = req.query;

    if (!empresaId) {
      return errorResponse(
        res,
        'ID de empresa es requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const [impuestos] = await pool.query<RowDataPacket[]>(
      `SELECT 
        id,
        codigo,
        nombre,
        descripcion,
        tipo,
        tasa,
        aplica_sobre,
        afecta_total,
        aplica_automaticamente
      FROM impuestos
      WHERE empresa_id = ? AND activo = 1
      ORDER BY orden ASC, nombre ASC`,
      [empresaId]
    );

    return successResponse(res, 'Impuestos activos obtenidos', impuestos, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener impuestos activos:', error);
    return errorResponse(res, 'Error al obtener impuestos activos', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Obtener impuesto por ID
 * GET /api/impuestos/:id
 */
export const getImpuestoById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const [impuestos] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM impuestos WHERE id = ?',
      [id]
    );

    if (impuestos.length === 0) {
      return errorResponse(
        res,
        'Impuesto no encontrado',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    return successResponse(res, 'Impuesto obtenido exitosamente', impuestos[0], CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener impuesto:', error);
    return errorResponse(res, 'Error al obtener impuesto', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Crear nuevo impuesto
 * POST /api/impuestos
 */
export const createImpuesto = async (req: Request, res: Response): Promise<Response> => {
  const connection = await pool.getConnection();

  try {
    const {
      empresa_id,
      codigo,
      nombre,
      descripcion,
      tipo,
      tasa,
      aplica_sobre,
      afecta_total,
      aplica_automaticamente,
      requiere_autorizacion,
      cuenta_contable,
      orden
    } = req.body;

    // Validaciones
    if (!empresa_id || !codigo || !nombre || !tasa) {
      return errorResponse(
        res,
        'Campos requeridos: empresa_id, codigo, nombre, tasa',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    await connection.beginTransaction();

    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO impuestos (
        empresa_id, codigo, nombre, descripcion, tipo, tasa,
        aplica_sobre, afecta_total, aplica_automaticamente,
        requiere_autorizacion, cuenta_contable, orden, creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresa_id,
        codigo,
        nombre,
        descripcion || null,
        tipo || 'porcentaje',
        tasa,
        aplica_sobre || 'subtotal',
        afecta_total || 'resta',
        aplica_automaticamente || 0,
        requiere_autorizacion || 0,
        cuenta_contable || null,
        orden || 0,
        (req as any).usuario?.id || null
      ]
    );

    await connection.commit();

    logger.info(`Impuesto creado: ${result.insertId}`);
    return successResponse(
      res,
      'Impuesto creado exitosamente',
      { id: result.insertId },
      CONSTANTS.HTTP_STATUS.CREATED
    );

  } catch (error: any) {
    await connection.rollback();
    
    if (error.code === 'ER_DUP_ENTRY') {
      return errorResponse(
        res,
        'Ya existe un impuesto con ese código para esta empresa',
        error,
        CONSTANTS.HTTP_STATUS.CONFLICT
      );
    }

    logger.error('Error al crear impuesto:', error);
    return errorResponse(res, 'Error al crear impuesto', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  } finally {
    connection.release();
  }
};

/**
 * Actualizar impuesto
 * PUT /api/impuestos/:id
 */
export const updateImpuesto = async (req: Request, res: Response): Promise<Response> => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const {
      codigo,
      nombre,
      descripcion,
      tipo,
      tasa,
      aplica_sobre,
      afecta_total,
      aplica_automaticamente,
      requiere_autorizacion,
      cuenta_contable,
      orden,
      activo
    } = req.body;

    await connection.beginTransaction();

    const [result] = await connection.query<ResultSetHeader>(
      `UPDATE impuestos SET
        codigo = ?,
        nombre = ?,
        descripcion = ?,
        tipo = ?,
        tasa = ?,
        aplica_sobre = ?,
        afecta_total = ?,
        aplica_automaticamente = ?,
        requiere_autorizacion = ?,
        cuenta_contable = ?,
        orden = ?,
        activo = ?
      WHERE id = ?`,
      [
        codigo,
        nombre,
        descripcion,
        tipo,
        tasa,
        aplica_sobre,
        afecta_total,
        aplica_automaticamente,
        requiere_autorizacion,
        cuenta_contable,
        orden,
        activo,
        id
      ]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return errorResponse(
        res,
        'Impuesto no encontrado',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    await connection.commit();

    logger.info(`Impuesto actualizado: ${id}`);
    return successResponse(res, 'Impuesto actualizado exitosamente', null, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    await connection.rollback();
    logger.error('Error al actualizar impuesto:', error);
    return errorResponse(res, 'Error al actualizar impuesto', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  } finally {
    connection.release();
  }
};

/**
 * Eliminar impuesto
 * DELETE /api/impuestos/:id
 */
export const deleteImpuesto = async (req: Request, res: Response): Promise<Response> => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;

    await connection.beginTransaction();

    // Verificar si el impuesto ha sido usado en ventas
    const [ventas] = await connection.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM venta_impuestos WHERE impuesto_id = ?',
      [id]
    );

    if (ventas[0].count > 0) {
      await connection.rollback();
      return errorResponse(
        res,
        'No se puede eliminar el impuesto porque ha sido usado en ventas',
        null,
        CONSTANTS.HTTP_STATUS.CONFLICT
      );
    }

    const [result] = await connection.query<ResultSetHeader>(
      'DELETE FROM impuestos WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return errorResponse(
        res,
        'Impuesto no encontrado',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    await connection.commit();

    logger.info(`Impuesto eliminado: ${id}`);
    return successResponse(res, 'Impuesto eliminado exitosamente', null, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    await connection.rollback();
    logger.error('Error al eliminar impuesto:', error);
    return errorResponse(res, 'Error al eliminar impuesto', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  } finally {
    connection.release();
  }
};
