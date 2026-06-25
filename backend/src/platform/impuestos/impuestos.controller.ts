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
        i.*,
        u.nombre as creador_nombre,
        u.apellido as creador_apellido
      FROM impuestos i
      LEFT JOIN usuarios u ON i.creado_por = u.id
      WHERE i.empresa_id = ?
      ORDER BY i.orden ASC, i.nombre ASC`,
      [empresaId]
    );

    logger.info(`Impuestos obtenidos para empresa ${empresaId}: ${impuestos.length}`);
    return successResponse(res, 'Impuestos obtenidos exitosamente', impuestos);

  } catch (error) {
    logger.error('Error al obtener impuestos:', error);
    return errorResponse(res, 'Error al obtener impuestos', error);
  }
};

/**
 * Obtener impuestos activos de una empresa
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
        id, codigo, nombre, descripcion, tipo, tasa,
        aplica_sobre, afecta_total, aplica_automaticamente
      FROM impuestos
      WHERE empresa_id = ? AND activo = 1
      ORDER BY orden ASC, nombre ASC`,
      [empresaId]
    );

    return successResponse(res, 'Impuestos activos obtenidos exitosamente', impuestos);

  } catch (error) {
    logger.error('Error al obtener impuestos activos:', error);
    return errorResponse(res, 'Error al obtener impuestos activos', error);
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

    return successResponse(res, 'Impuesto obtenido exitosamente', impuestos[0]);

  } catch (error) {
    logger.error('Error al obtener impuesto:', error);
    return errorResponse(res, 'Error al obtener impuesto', error);
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
      orden,
      activo
    } = req.body;

    const usuario = (req as any).user || (req as any).usuario;
    if (!usuario || !usuario.id) {
      return errorResponse(
        res,
        'Usuario no autenticado',
        null,
        CONSTANTS.HTTP_STATUS.UNAUTHORIZED
      );
    }

    const empresaIdValue = Number(empresa_id);
    if (!Number.isFinite(empresaIdValue) || empresaIdValue <= 0) {
      return errorResponse(
        res,
        'empresa_id es requerido y debe ser un número válido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const codigoValue = String(codigo || '').trim().toUpperCase();
    if (!codigoValue) {
      return errorResponse(
        res,
        'El código del impuesto es requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const nombreValue = String(nombre || '').trim();
    if (!nombreValue) {
      return errorResponse(
        res,
        'El nombre del impuesto es requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const tasaValue = Number(tasa);
    if (Number.isNaN(tasaValue) || tasaValue < 0) {
      return errorResponse(
        res,
        'La tasa del impuesto es inválida',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const tipoValue = String(tipo || 'porcentaje').trim();
    if (!['porcentaje', 'valor_fijo'].includes(tipoValue)) {
      return errorResponse(
        res,
        'El tipo de impuesto es inválido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const aplicaSobreValue = String(aplica_sobre || 'subtotal').trim();
    if (!['subtotal', 'iva', 'total'].includes(aplicaSobreValue)) {
      return errorResponse(
        res,
        'El campo aplica_sobre es inválido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const afectaTotalValue = String(afecta_total || 'resta').trim();
    if (!['suma', 'resta'].includes(afectaTotalValue)) {
      return errorResponse(
        res,
        'El campo afecta_total es inválido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const aplicaAutomaticamenteValue = Number(aplica_automaticamente) === 1 ? 1 : 0;
    const requiereAutorizacionValue = Number(requiere_autorizacion) === 1 ? 1 : 0;
    const ordenValue = Number.isFinite(Number(orden)) ? Number(orden) : 0;
    const activoValue = Number(activo) === 1 ? 1 : 0;

    await connection.beginTransaction();

    // Validar que el código no exista para esta empresa
    const [existente] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM impuestos WHERE empresa_id = ? AND codigo = ?',
      [empresaIdValue, codigoValue]
    );

    if (existente.length > 0) {
      await connection.rollback();
      return errorResponse(
        res,
        'Ya existe un impuesto con ese código para esta empresa',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Insertar impuesto
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO impuestos (
        empresa_id, codigo, nombre, descripcion, tipo, tasa,
        aplica_sobre, afecta_total, aplica_automaticamente,
        requiere_autorizacion, cuenta_contable, orden, activo, creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaIdValue,
        codigoValue,
        nombreValue,
        descripcion || null,
        tipoValue,
        tasaValue,
        aplicaSobreValue,
        afectaTotalValue,
        aplicaAutomaticamenteValue,
        requiereAutorizacionValue,
        cuenta_contable || null,
        ordenValue,
        activoValue,
        usuario.id
      ]
    );

    // Auditoría
    await connection.query(
      `INSERT INTO auditoria_logs (
        usuario_id, accion, tabla_afectada, registro_id, fecha
      ) VALUES (?, ?, ?, ?, NOW())`,
      [usuario.id, 'CREATE', 'impuestos', result.insertId]
    );

    await connection.commit();

    logger.info(`Impuesto creado: ${nombre} (ID: ${result.insertId})`);
    return successResponse(
      res,
      'Impuesto creado exitosamente',
      { id: result.insertId },
      CONSTANTS.HTTP_STATUS.CREATED
    );

  } catch (error) {
    await connection.rollback();
    logger.error('Error al crear impuesto:', error);
    return errorResponse(res, 'Error al crear impuesto', error);
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

    const usuario = (req as any).user || (req as any).usuario;
    if (!usuario || !usuario.id) {
      return errorResponse(
        res,
        'Usuario no autenticado',
        null,
        CONSTANTS.HTTP_STATUS.UNAUTHORIZED
      );
    }

    if (!codigo || !String(codigo).trim()) {
      return errorResponse(
        res,
        'El código del impuesto es requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    if (!nombre || !String(nombre).trim()) {
      return errorResponse(
        res,
        'El nombre del impuesto es requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const tasaValue = Number(tasa);
    if (Number.isNaN(tasaValue) || tasaValue < 0) {
      return errorResponse(
        res,
        'La tasa del impuesto es inválida',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const tipoValue = String(tipo || 'porcentaje').trim();
    if (!['porcentaje', 'valor_fijo'].includes(tipoValue)) {
      return errorResponse(
        res,
        'El tipo de impuesto es inválido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const aplicaSobreValue = String(aplica_sobre || 'subtotal').trim();
    if (!['subtotal', 'iva', 'total'].includes(aplicaSobreValue)) {
      return errorResponse(
        res,
        'El campo aplica_sobre es inválido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const afectaTotalValue = String(afecta_total || 'resta').trim();
    if (!['suma', 'resta'].includes(afectaTotalValue)) {
      return errorResponse(
        res,
        'El campo afecta_total es inválido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const aplicaAutomaticamenteValue = Number(aplica_automaticamente) === 1 ? 1 : 0;
    const requiereAutorizacionValue = Number(requiere_autorizacion) === 1 ? 1 : 0;
    const ordenValue = Number.isFinite(Number(orden)) ? Number(orden) : 0;
    const activoValue = Number(activo) === 1 ? 1 : 0;

    await connection.beginTransaction();

    // Verificar que existe
    const [existe] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM impuestos WHERE id = ?',
      [id]
    );

    if (existe.length === 0) {
      await connection.rollback();
      return errorResponse(
        res,
        'Impuesto no encontrado',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    // Actualizar
    await connection.query(
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
        activo = ?,
        updated_at = NOW()
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

    // Auditoría
    await connection.query(
      `INSERT INTO auditoria_logs (
        usuario_id, accion, tabla_afectada, registro_id, fecha
      ) VALUES (?, ?, ?, ?, NOW())`,
      [usuario.id, 'UPDATE', 'impuestos', id]
    );

    await connection.commit();

    logger.info(`Impuesto actualizado: ${nombre} (ID: ${id})`);
    return successResponse(res, 'Impuesto actualizado exitosamente');

  } catch (error) {
    await connection.rollback();
    logger.error('Error al actualizar impuesto:', error);
    return errorResponse(res, 'Error al actualizar impuesto', error);
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
    const usuario = (req as any).user || (req as any).usuario;

    await connection.beginTransaction();

    // Verificar si hay ventas asociadas
    const [ventas] = await connection.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM venta_impuestos WHERE impuesto_id = ?',
      [id]
    );

    if (ventas[0].total > 0) {
      await connection.rollback();
      return errorResponse(
        res,
        `No se puede eliminar. Hay ${ventas[0].total} ventas asociadas a este impuesto`,
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Eliminar
    await connection.query('DELETE FROM impuestos WHERE id = ?', [id]);

    // Auditoría
    await connection.query(
      `INSERT INTO auditoria_logs (
        usuario_id, accion, tabla_afectada, registro_id, fecha
      ) VALUES (?, ?, ?, ?, NOW())`,
      [usuario.id, 'DELETE', 'impuestos', id]
    );

    await connection.commit();

    logger.info(`Impuesto eliminado (ID: ${id})`);
    return successResponse(res, 'Impuesto eliminado exitosamente');

  } catch (error) {
    await connection.rollback();
    logger.error('Error al eliminar impuesto:', error);
    return errorResponse(res, 'Error al eliminar impuesto', error);
  } finally {
    connection.release();
  }
};
