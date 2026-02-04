/**
 * =================================
 * KORE INVENTORY - CATEGORÍAS CONTROLLER
 * Controlador de categorías
 * =================================
 */

import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

/**
 * Obtener todas las categorías de una empresa
 * GET /api/categorias?empresaId=X
 */
export const getCategorias = async (req: Request, res: Response): Promise<Response> => {
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

    const categorias = await query(
      `SELECT 
        id,
        empresa_id,
        nombre,
        descripcion,
        estado,
        created_at,
        updated_at
      FROM categorias
      WHERE empresa_id = ? AND estado = 'activa'
      ORDER BY nombre ASC`,
      [empresaId]
    );

    logger.info(`Categorías obtenidas para empresa ${empresaId}: ${categorias.length}`);
    return successResponse(res, 'Categorías obtenidas exitosamente', categorias, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener categorías:', error);
    return errorResponse(res, 'Error al obtener categorías', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Obtener categoría por ID
 * GET /api/categorias/:id
 */
export const getCategoriaById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const categorias = await query(
      'SELECT * FROM categorias WHERE id = ?',
      [id]
    );

    if (categorias.length === 0) {
      return errorResponse(
        res,
        'Categoría no encontrada',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    return successResponse(res, 'Categoría obtenida exitosamente', categorias[0], CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener categoría:', error);
    return errorResponse(res, 'Error al obtener categoría', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Crear nueva categoría
 * POST /api/categorias
 */
export const createCategoria = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresa_id, nombre, descripcion, estado } = req.body;

    // Validaciones básicas
    if (!empresa_id || !nombre) {
      return errorResponse(
        res,
        'Campos requeridos: empresa_id, nombre',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Verificar si la categoría ya existe para esta empresa
    const categoriaExiste = await query(
      'SELECT id FROM categorias WHERE empresa_id = ? AND nombre = ?',
      [empresa_id, nombre]
    );

    if (categoriaExiste.length > 0) {
      return errorResponse(
        res,
        'La categoría ya existe para esta empresa',
        null,
        CONSTANTS.HTTP_STATUS.CONFLICT
      );
    }

    const result = await query(
      `INSERT INTO categorias (
        empresa_id,
        nombre,
        descripcion,
        estado,
        creado_por
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        empresa_id,
        nombre,
        descripcion || null,
        estado || 'activa',
        req.body.userId || null
      ]
    );

    logger.info(`Categoría creada: ${nombre} (ID: ${result.insertId})`);
    
    return successResponse(
      res,
      'Categoría creada exitosamente',
      { id: result.insertId },
      CONSTANTS.HTTP_STATUS.CREATED
    );

  } catch (error) {
    logger.error('Error al crear categoría:', error);
    return errorResponse(res, 'Error al crear categoría', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Actualizar categoría
 * PUT /api/categorias/:id
 */
export const updateCategoria = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, estado } = req.body;

    // Verificar si la categoría existe
    const categoriaExiste = await query('SELECT id, empresa_id FROM categorias WHERE id = ?', [id]);
    
    if (categoriaExiste.length === 0) {
      return errorResponse(
        res,
        'Categoría no encontrada',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    // Verificar si el nombre ya existe para otra categoría de la misma empresa
    if (nombre) {
      const nombreExiste = await query(
        'SELECT id FROM categorias WHERE empresa_id = ? AND nombre = ? AND id != ?',
        [categoriaExiste[0].empresa_id, nombre, id]
      );

      if (nombreExiste.length > 0) {
        return errorResponse(
          res,
          'El nombre de categoría ya existe para otra categoría de esta empresa',
          null,
          CONSTANTS.HTTP_STATUS.CONFLICT
        );
      }
    }

    await query(
      `UPDATE categorias SET
        nombre = COALESCE(?, nombre),
        descripcion = COALESCE(?, descripcion),
        estado = COALESCE(?, estado),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [nombre, descripcion, estado, id]
    );

    logger.info(`Categoría actualizada: ${id}`);
    
    return successResponse(
      res,
      'Categoría actualizada exitosamente',
      { id },
      CONSTANTS.HTTP_STATUS.OK
    );

  } catch (error) {
    logger.error('Error al actualizar categoría:', error);
    return errorResponse(res, 'Error al actualizar categoría', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Eliminar categoría
 * DELETE /api/categorias/:id
 */
export const deleteCategoria = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // Verificar si la categoría existe
    const categoriaExiste = await query('SELECT id FROM categorias WHERE id = ?', [id]);
    
    if (categoriaExiste.length === 0) {
      return errorResponse(
        res,
        'Categoría no encontrada',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    // Verificar si hay productos usando esta categoría
    const productosConCategoria = await query(
      'SELECT COUNT(*) as total FROM productos WHERE categoria_id = ?',
      [id]
    );

    if (productosConCategoria[0].total > 0) {
      return errorResponse(
        res,
        'No se puede eliminar la categoría porque tiene productos asociados',
        null,
        CONSTANTS.HTTP_STATUS.CONFLICT
      );
    }

    // Eliminar la categoría (soft delete)
    await query(
      `UPDATE categorias SET estado = 'inactiva', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );

    logger.info(`Categoría eliminada (inactivada): ${id}`);
    
    return successResponse(
      res,
      'Categoría eliminada exitosamente',
      { id },
      CONSTANTS.HTTP_STATUS.OK
    );

  } catch (error) {
    logger.error('Error al eliminar categoría:', error);
    return errorResponse(res, 'Error al eliminar categoría', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};
