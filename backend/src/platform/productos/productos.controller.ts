/**
 * =================================
 * KORE INVENTORY - PRODUCTOS CONTROLLER
 * Controlador de productos
 * =================================
 */

import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

/**
 * Obtener todos los productos de una empresa
 * GET /api/productos?empresaId=X
 */
export const getProductos = async (req: Request, res: Response): Promise<Response> => {
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

    const productos = await query(
      `SELECT 
        p.id,
        p.empresa_id,
        p.nombre,
        p.descripcion,
        p.sku,
        p.codigo_barras,
        p.categoria_id,
        c.nombre as categoria_nombre,
        p.precio_compra,
        p.precio_venta,
        p.stock_actual,
        p.stock_minimo,
        p.stock_maximo,
        p.unidad_medida,
        p.ubicacion_almacen,
        p.imagen_url,
        p.estado,
        p.created_at,
        p.updated_at
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.empresa_id = ?
      ORDER BY p.nombre ASC`,
      [empresaId]
    );

    logger.info(`Productos obtenidos para empresa ${empresaId}: ${productos.length}`);
    return successResponse(res, 'Productos obtenidos exitosamente', productos, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener productos:', error);
    return errorResponse(res, 'Error al obtener productos', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Obtener producto por ID
 * GET /api/productos/:id
 */
export const getProductoById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const productos = await query(
      `SELECT 
        p.*,
        c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.id = ?`,
      [id]
    );

    if (productos.length === 0) {
      return errorResponse(
        res,
        'Producto no encontrado',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    return successResponse(res, 'Producto obtenido exitosamente', productos[0], CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener producto:', error);
    return errorResponse(res, 'Error al obtener producto', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Crear nuevo producto
 * POST /api/productos
 */
export const createProducto = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      empresa_id,
      nombre,
      descripcion,
      sku,
      codigo_barras,
      categoria_id,
      precio_compra,
      precio_venta,
      stock_actual,
      stock_minimo,
      stock_maximo,
      unidad_medida,
      ubicacion_almacen,
      imagen_url,
      estado
    } = req.body;

    // Validaciones básicas
    if (!empresa_id || !nombre || !sku || !precio_venta) {
      return errorResponse(
        res,
        'Campos requeridos: empresa_id, nombre, sku, precio_venta',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Verificar si el SKU ya existe para esta empresa
    const skuExiste = await query(
      'SELECT id FROM productos WHERE empresa_id = ? AND sku = ?',
      [empresa_id, sku]
    );

    if (skuExiste.length > 0) {
      return errorResponse(
        res,
        'El SKU ya existe para esta empresa',
        null,
        CONSTANTS.HTTP_STATUS.CONFLICT
      );
    }

    const result = await query(
      `INSERT INTO productos (
        empresa_id,
        nombre,
        descripcion,
        sku,
        codigo_barras,
        categoria_id,
        precio_compra,
        precio_venta,
        stock_actual,
        stock_minimo,
        stock_maximo,
        unidad_medida,
        ubicacion_almacen,
        imagen_url,
        estado,
        creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresa_id,
        nombre,
        descripcion || null,
        sku,
        codigo_barras || null,
        categoria_id || null,
        precio_compra || 0,
        precio_venta,
        stock_actual || 0,
        stock_minimo || 0,
        stock_maximo || null,
        unidad_medida || 'unidad',
        ubicacion_almacen || null,
        imagen_url || null,
        estado || 'activo',
        req.body.userId || null // Asumiendo que el userId viene del middleware de auth
      ]
    );

    logger.info(`Producto creado: ${nombre} (ID: ${result.insertId})`);
    
    return successResponse(
      res,
      'Producto creado exitosamente',
      { id: result.insertId },
      CONSTANTS.HTTP_STATUS.CREATED
    );

  } catch (error) {
    logger.error('Error al crear producto:', error);
    return errorResponse(res, 'Error al crear producto', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Actualizar producto
 * PUT /api/productos/:id
 */
export const updateProducto = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const {
      nombre,
      descripcion,
      sku,
      codigo_barras,
      categoria_id,
      precio_compra,
      precio_venta,
      stock_actual,
      stock_minimo,
      stock_maximo,
      unidad_medida,
      ubicacion_almacen,
      imagen_url,
      estado
    } = req.body;

    // Verificar si el producto existe
    const productoExiste = await query('SELECT id, empresa_id FROM productos WHERE id = ?', [id]);
    
    if (productoExiste.length === 0) {
      return errorResponse(
        res,
        'Producto no encontrado',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    // Verificar si el SKU ya existe para otro producto de la misma empresa
    if (sku) {
      const skuExiste = await query(
        'SELECT id FROM productos WHERE empresa_id = ? AND sku = ? AND id != ?',
        [productoExiste[0].empresa_id, sku, id]
      );

      if (skuExiste.length > 0) {
        return errorResponse(
          res,
          'El SKU ya existe para otro producto de esta empresa',
          null,
          CONSTANTS.HTTP_STATUS.CONFLICT
        );
      }
    }

    // Construir el UPDATE dinámicamente solo con los campos que vienen en el body
    const updates: string[] = [];
    const values: any[] = [];

    if (nombre !== undefined) {
      updates.push('nombre = ?');
      values.push(nombre);
    }
    if (descripcion !== undefined) {
      updates.push('descripcion = ?');
      values.push(descripcion);
    }
    if (sku !== undefined) {
      updates.push('sku = ?');
      values.push(sku);
    }
    if (codigo_barras !== undefined) {
      updates.push('codigo_barras = ?');
      values.push(codigo_barras);
    }
    if (categoria_id !== undefined) {
      updates.push('categoria_id = ?');
      values.push(categoria_id);
    }
    if (precio_compra !== undefined) {
      updates.push('precio_compra = ?');
      values.push(precio_compra);
    }
    if (precio_venta !== undefined) {
      updates.push('precio_venta = ?');
      values.push(precio_venta);
    }
    if (stock_actual !== undefined) {
      updates.push('stock_actual = ?');
      values.push(stock_actual);
    }
    if (stock_minimo !== undefined) {
      updates.push('stock_minimo = ?');
      values.push(stock_minimo);
    }
    if (stock_maximo !== undefined) {
      updates.push('stock_maximo = ?');
      values.push(stock_maximo);
    }
    if (unidad_medida !== undefined) {
      updates.push('unidad_medida = ?');
      values.push(unidad_medida);
    }
    if (ubicacion_almacen !== undefined) {
      updates.push('ubicacion_almacen = ?');
      values.push(ubicacion_almacen);
    }
    if (imagen_url !== undefined) {
      updates.push('imagen_url = ?');
      values.push(imagen_url);
    }
    if (estado !== undefined) {
      updates.push('estado = ?');
      values.push(estado);
    }

    // Si no hay nada que actualizar
    if (updates.length === 0) {
      return errorResponse(
        res,
        'No se proporcionaron campos para actualizar',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await query(
      `UPDATE productos SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    logger.info(`Producto actualizado: ${id}`);
    
    return successResponse(
      res,
      'Producto actualizado exitosamente',
      { id },
      CONSTANTS.HTTP_STATUS.OK
    );

  } catch (error) {
    logger.error('Error al actualizar producto:', error);
    return errorResponse(res, 'Error al actualizar producto', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Eliminar producto
 * DELETE /api/productos/:id
 */
export const deleteProducto = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // Verificar si el producto existe
    const productoExiste = await query('SELECT id FROM productos WHERE id = ?', [id]);
    
    if (productoExiste.length === 0) {
      return errorResponse(
        res,
        'Producto no encontrado',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    // Eliminar el producto (soft delete cambiando estado a inactivo es mejor práctica)
    await query(
      `UPDATE productos SET estado = 'inactivo', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );

    logger.info(`Producto eliminado (inactivado): ${id}`);
    
    return successResponse(
      res,
      'Producto eliminado exitosamente',
      { id },
      CONSTANTS.HTTP_STATUS.OK
    );

  } catch (error) {
    logger.error('Error al eliminar producto:', error);
    return errorResponse(res, 'Error al eliminar producto', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};
