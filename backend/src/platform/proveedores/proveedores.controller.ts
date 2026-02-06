/**
 * =================================
 * KORE INVENTORY - PROVEEDORES CONTROLLER
 * Controlador de proveedores
 * =================================
 */

import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import logger from '../../shared/logger';

/**
 * Obtener todos los proveedores de una empresa
 * GET /api/proveedores?empresaId=X
 */
export const getProveedores = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId, search, estado } = req.query;

    if (!empresaId) {
      return errorResponse(res, 'ID de empresa es requerido', null, 400);
    }

    let sql = `
      SELECT 
        id, empresa_id, tipo_documento, numero_documento, razon_social, nombre_comercial,
        nombre_contacto, telefono, celular, email, sitio_web, direccion, ciudad, pais,
        codigo_postal, terminos_pago, dias_credito, limite_credito, productos_suministra,
        banco, tipo_cuenta, numero_cuenta, observaciones, estado, created_at, updated_at
      FROM proveedores
      WHERE empresa_id = ?
    `;

    const params: any[] = [empresaId];

    // Filtro por búsqueda
    if (search) {
      sql += ` AND (razon_social LIKE ? OR nombre_comercial LIKE ? OR numero_documento LIKE ? OR email LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    // Filtro por estado
    if (estado !== undefined) {
      sql += ` AND estado = ?`;
      params.push(Number(estado));
    }

    sql += ` ORDER BY razon_social ASC`;

    const proveedores = await query(sql, params);

    return successResponse(res, 'Proveedores obtenidos exitosamente', proveedores);

  } catch (error: any) {
    logger.error('Error al obtener proveedores:', error);
    return errorResponse(res, 'Error al obtener proveedores', error.message);
  }
};

/**
 * Obtener un proveedor por ID
 * GET /api/proveedores/:id
 */
export const getProveedorById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { empresaId } = req.query;

    if (!empresaId) {
      return errorResponse(res, 'ID de empresa es requerido', null, 400);
    }

    const sql = `SELECT * FROM proveedores WHERE id = ? AND empresa_id = ?`;
    const proveedores: any = await query(sql, [id, empresaId]);

    if (proveedores.length === 0) {
      return errorResponse(res, 'Proveedor no encontrado', null, 404);
    }

    return successResponse(res, 'Proveedor obtenido exitosamente', proveedores[0]);

  } catch (error: any) {
    logger.error('Error al obtener proveedor:', error);
    return errorResponse(res, 'Error al obtener proveedor', error.message);
  }
};

/**
 * Crear un nuevo proveedor
 * POST /api/proveedores
 */
export const createProveedor = async (req: Request, res: Response): Promise<Response> => {
  try {
    const proveedorData = req.body;

    // Validaciones básicas
    if (!proveedorData.empresa_id || !proveedorData.numero_documento || !proveedorData.razon_social) {
      return errorResponse(res, 'Empresa ID, número de documento y razón social son requeridos', null, 400);
    }

    // Verificar duplicado de documento
    const checkSql = `SELECT id FROM proveedores WHERE empresa_id = ? AND numero_documento = ?`;
    const existing: any = await query(checkSql, [proveedorData.empresa_id, proveedorData.numero_documento]);

    if (existing.length > 0) {
      return errorResponse(res, 'Ya existe un proveedor con este número de documento', null, 400);
    }

    const sql = `
      INSERT INTO proveedores (
        empresa_id, tipo_documento, numero_documento, razon_social, nombre_comercial,
        nombre_contacto, telefono, celular, email, sitio_web, direccion, ciudad, pais,
        codigo_postal, terminos_pago, dias_credito, limite_credito, productos_suministra,
        banco, tipo_cuenta, numero_cuenta, observaciones, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      proveedorData.empresa_id,
      proveedorData.tipo_documento || 'NIT',
      proveedorData.numero_documento,
      proveedorData.razon_social,
      proveedorData.nombre_comercial || null,
      proveedorData.nombre_contacto || null,
      proveedorData.telefono || null,
      proveedorData.celular || null,
      proveedorData.email || null,
      proveedorData.sitio_web || null,
      proveedorData.direccion || null,
      proveedorData.ciudad || null,
      proveedorData.pais || 'Colombia',
      proveedorData.codigo_postal || null,
      proveedorData.terminos_pago || null,
      proveedorData.dias_credito || 0,
      proveedorData.limite_credito || 0.00,
      proveedorData.productos_suministra || null,
      proveedorData.banco || null,
      proveedorData.tipo_cuenta || null,
      proveedorData.numero_cuenta || null,
      proveedorData.observaciones || null,
      proveedorData.estado !== undefined ? proveedorData.estado : 1
    ];

    const result: any = await query(sql, params);

    return successResponse(res, 'Proveedor creado exitosamente', {
      id: result.insertId,
      ...proveedorData
    }, 201);

  } catch (error: any) {
    logger.error('Error al crear proveedor:', error);
    return errorResponse(res, 'Error al crear proveedor', error.message);
  }
};

/**
 * Actualizar un proveedor
 * PUT /api/proveedores/:id
 */
export const updateProveedor = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!updateData.empresa_id) {
      return errorResponse(res, 'ID de empresa es requerido', null, 400);
    }

    // Verificar que el proveedor existe y pertenece a la empresa
    const checkSql = `SELECT id FROM proveedores WHERE id = ? AND empresa_id = ?`;
    const existing: any = await query(checkSql, [id, updateData.empresa_id]);

    if (existing.length === 0) {
      return errorResponse(res, 'Proveedor no encontrado', null, 404);
    }

    // Si se actualiza el documento, verificar que no exista otro con el mismo
    if (updateData.numero_documento) {
      const dupSql = `SELECT id FROM proveedores WHERE empresa_id = ? AND numero_documento = ? AND id != ?`;
      const duplicate: any = await query(dupSql, [updateData.empresa_id, updateData.numero_documento, id]);

      if (duplicate.length > 0) {
        return errorResponse(res, 'Ya existe otro proveedor con este número de documento', null, 400);
      }
    }

    // Construir UPDATE dinámico
    const fields: string[] = [];
    const values: any[] = [];

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'id' && key !== 'empresa_id') {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });

    if (fields.length === 0) {
      return errorResponse(res, 'No hay datos para actualizar', null, 400);
    }

    values.push(id, updateData.empresa_id);

    const sql = `UPDATE proveedores SET ${fields.join(', ')} WHERE id = ? AND empresa_id = ?`;
    await query(sql, values);

    return successResponse(res, 'Proveedor actualizado exitosamente', {
      id: Number(id),
      ...updateData
    });

  } catch (error: any) {
    logger.error('Error al actualizar proveedor:', error);
    return errorResponse(res, 'Error al actualizar proveedor', error.message);
  }
};

/**
 * Eliminar (desactivar) un proveedor
 * DELETE /api/proveedores/:id
 */
export const deleteProveedor = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { empresaId } = req.query;

    if (!empresaId) {
      return errorResponse(res, 'ID de empresa es requerido', null, 400);
    }

    // Verificar que existe
    const checkSql = `SELECT id FROM proveedores WHERE id = ? AND empresa_id = ?`;
    const existing: any = await query(checkSql, [id, empresaId]);

    if (existing.length === 0) {
      return errorResponse(res, 'Proveedor no encontrado', null, 404);
    }

    // Soft delete (cambiar estado a inactivo)
    const sql = `UPDATE proveedores SET estado = 0 WHERE id = ? AND empresa_id = ?`;
    await query(sql, [id, empresaId]);

    return successResponse(res, 'Proveedor eliminado exitosamente', { id: Number(id) });

  } catch (error: any) {
    logger.error('Error al eliminar proveedor:', error);
    return errorResponse(res, 'Error al eliminar proveedor', error.message);
  }
};

/**
 * Activar un proveedor
 * PUT /api/proveedores/:id/activar
 */
export const activateProveedor = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { empresaId } = req.query;

    if (!empresaId) {
      return errorResponse(res, 'ID de empresa es requerido', null, 400);
    }

    const sql = `UPDATE proveedores SET estado = 1 WHERE id = ? AND empresa_id = ?`;
    const result: any = await query(sql, [id, empresaId]);

    if (result.affectedRows === 0) {
      return errorResponse(res, 'Proveedor no encontrado', null, 404);
    }

    return successResponse(res, 'Proveedor activado exitosamente', { id: Number(id) });

  } catch (error: any) {
    logger.error('Error al activar proveedor:', error);
    return errorResponse(res, 'Error al activar proveedor', error.message);
  }
};
