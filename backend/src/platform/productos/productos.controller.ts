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
        p.tipo,
        p.maneja_inventario,
        p.nombre,
        p.descripcion,
        p.sku,
        p.codigo_barras,
        p.categoria_id,
        c.nombre as categoria_nombre,
        p.precio_compra,
        p.precio_minorista,
        p.precio_mayorista,
        p.precio_distribuidor,
        p.precio_minimo,
        p.precio_maximo,
        p.aplica_iva,
        p.porcentaje_iva,
        p.tipo_impuesto,
        p.iva_incluido_en_precio,
        p.stock_actual,
        p.stock_minimo,
        p.stock_maximo,
        p.unidad_medida,
        p.ubicacion_almacen,
        p.permite_venta_sin_stock,
        p.imagen_url,
        p.estado,
        p.cuenta_ingreso,
        p.cuenta_costo,
        p.cuenta_inventario,
        p.cuenta_gasto,
        p.created_at,
        p.updated_at,
        p.fecha_ultimo_cambio_precio,
        -- Cálculo de márgenes
        ROUND(((p.precio_minorista - p.precio_compra) / p.precio_compra) * 100, 2) as margen_minorista,
        CASE 
          WHEN p.precio_mayorista IS NOT NULL AND p.precio_compra > 0 THEN
            ROUND(((p.precio_mayorista - p.precio_compra) / p.precio_compra) * 100, 2)
          ELSE NULL
        END as margen_mayorista,
        CASE 
          WHEN p.precio_distribuidor IS NOT NULL AND p.precio_compra > 0 THEN
            ROUND(((p.precio_distribuidor - p.precio_compra) / p.precio_compra) * 100, 2)
          ELSE NULL
        END as margen_distribuidor
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
      tipo,
      maneja_inventario,
      nombre,
      descripcion,
      sku,
      codigo_barras,
      categoria_id,
      precio_compra,
      precio_minorista,
      precio_mayorista,
      precio_distribuidor,
      precio_minimo,
      precio_maximo,
      aplica_iva,
      porcentaje_iva,
      tipo_impuesto,
      stock_actual,
      stock_minimo,
      stock_maximo,
      unidad_medida,
      ubicacion_almacen,
      imagen_url,
      estado,
      cuenta_ingreso,
      cuenta_costo,
      cuenta_inventario,
      cuenta_gasto
    } = req.body;

    // Validaciones básicas
    if (!empresa_id || !nombre || !sku || !precio_minorista) {
      return errorResponse(
        res,
        'Campos requeridos: empresa_id, nombre, sku, precio_minorista',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Validación: Servicios no deben manejar inventario
    const tipoProducto = tipo || 'producto';
    const manejaInv = tipoProducto === 'servicio' ? false : (maneja_inventario !== false);

    // NOTA: Se eliminaron las validaciones de jerarquía de precios
    // El administrador tiene libertad total para establecer los precios

    // Validación: IVA válido para Colombia
    const porcIVA = porcentaje_iva !== undefined ? porcentaje_iva : 19.00;
    if (![0, 5, 19].includes(porcIVA) && porcIVA !== null) {
      logger.info(`IVA no estándar: ${porcIVA}%. Se recomienda 0%, 5% o 19%`);
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
        tipo,
        maneja_inventario,
        nombre,
        descripcion,
        sku,
        codigo_barras,
        categoria_id,
        precio_compra,
        precio_minorista,
        precio_mayorista,
        precio_distribuidor,
        precio_minimo,
        precio_maximo,
        aplica_iva,
        porcentaje_iva,
        tipo_impuesto,
        iva_incluido_en_precio,
        stock_actual,
        stock_minimo,
        stock_maximo,
        unidad_medida,
        ubicacion_almacen,
        permite_venta_sin_stock,
        imagen_url,
        estado,
        cuenta_ingreso,
        cuenta_costo,
        cuenta_inventario,
        cuenta_gasto,
        creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresa_id,
        tipoProducto,
        manejaInv,
        nombre,
        descripcion || null,
        sku,
        codigo_barras || null,
        categoria_id || null,
        precio_compra || 0,
        precio_minorista,
        precio_mayorista || null,
        precio_distribuidor || null,
        precio_minimo || null,
        precio_maximo || null,
        aplica_iva !== false,
        porcIVA,
        tipo_impuesto || 'gravado',
        req.body.iva_incluido_en_precio || false,
        manejaInv ? (stock_actual || 0) : null,
        manejaInv ? (stock_minimo || 0) : null,
        manejaInv ? (stock_maximo || null) : null,
        unidad_medida || 'unidad',
        manejaInv ? (ubicacion_almacen || null) : null,
        req.body.permite_venta_sin_stock || false,
        imagen_url || null,
        estado || 'activo',
        cuenta_ingreso || null,
        cuenta_costo || null,
        cuenta_inventario || null,
        cuenta_gasto || null,
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
      tipo,
      maneja_inventario,
      nombre,
      descripcion,
      sku,
      codigo_barras,
      categoria_id,
      precio_compra,
      precio_minorista,
      precio_mayorista,
      precio_distribuidor,
      precio_minimo,
      precio_maximo,
      aplica_iva,
      porcentaje_iva,
      tipo_impuesto,
      stock_actual,
      stock_minimo,
      stock_maximo,
      unidad_medida,
      ubicacion_almacen,
      imagen_url,
      estado,
      cuenta_ingreso,
      cuenta_costo,
      cuenta_inventario,
      cuenta_gasto
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

    // NOTA: Se eliminaron las validaciones de jerarquía de precios
    // El administrador tiene libertad total para establecer los precios

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

    if (tipo !== undefined) {
      updates.push('tipo = ?');
      values.push(tipo);
    }
    if (maneja_inventario !== undefined) {
      updates.push('maneja_inventario = ?');
      values.push(maneja_inventario);
    }
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
    if (precio_minorista !== undefined) {
      updates.push('precio_minorista = ?');
      values.push(precio_minorista);
    }
    if (precio_mayorista !== undefined) {
      updates.push('precio_mayorista = ?');
      values.push(precio_mayorista);
    }
    if (precio_distribuidor !== undefined) {
      updates.push('precio_distribuidor = ?');
      values.push(precio_distribuidor);
    }
    if (precio_minimo !== undefined) {
      updates.push('precio_minimo = ?');
      values.push(precio_minimo);
    }
    if (precio_maximo !== undefined) {
      updates.push('precio_maximo = ?');
      values.push(precio_maximo);
    }
    if (aplica_iva !== undefined) {
      updates.push('aplica_iva = ?');
      values.push(aplica_iva);
    }
    if (porcentaje_iva !== undefined) {
      updates.push('porcentaje_iva = ?');
      values.push(porcentaje_iva);
    }
    if (tipo_impuesto !== undefined) {
      updates.push('tipo_impuesto = ?');
      values.push(tipo_impuesto);
    }
    if (req.body.iva_incluido_en_precio !== undefined) {
      updates.push('iva_incluido_en_precio = ?');
      values.push(req.body.iva_incluido_en_precio);
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
    if (req.body.permite_venta_sin_stock !== undefined) {
      updates.push('permite_venta_sin_stock = ?');
      values.push(req.body.permite_venta_sin_stock);
    }
    if (imagen_url !== undefined) {
      updates.push('imagen_url = ?');
      values.push(imagen_url);
    }
    if (estado !== undefined) {
      updates.push('estado = ?');
      values.push(estado);
    }
    if (cuenta_ingreso !== undefined) {
      updates.push('cuenta_ingreso = ?');
      values.push(cuenta_ingreso);
    }
    if (cuenta_costo !== undefined) {
      updates.push('cuenta_costo = ?');
      values.push(cuenta_costo);
    }
    if (cuenta_inventario !== undefined) {
      updates.push('cuenta_inventario = ?');
      values.push(cuenta_inventario);
    }
    if (cuenta_gasto !== undefined) {
      updates.push('cuenta_gasto = ?');
      values.push(cuenta_gasto);
    }
    
    // Agregar modificado_por si viene en el body
    if (req.body.userId) {
      updates.push('modificado_por = ?');
      values.push(req.body.userId);
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
