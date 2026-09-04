import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

const validarAccesoProducto = async (req: Request, productoId: number) => {
  const usuario = (req as any).user;
  const productos = await query('SELECT id, empresa_id FROM productos WHERE id = ? LIMIT 1', [productoId]);
  if (productos.length === 0) return null;
  if (usuario?.tipo_usuario === 'super_admin') return productos[0];
  const acceso = await query(
    'SELECT 1 FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ? AND activo = 1 LIMIT 1',
    [usuario.id, productos[0].empresa_id]
  );
  return acceso.length > 0 ? productos[0] : null;
};

/**
 * GET /api/productos/:id/insumos
 */
export const getInsumos = async (req: Request, res: Response): Promise<Response> => {
  try {
    const productoId = Number(req.params.id);
    const producto = await validarAccesoProducto(req, productoId);
    if (!producto) return errorResponse(res, 'Producto no encontrado o sin acceso', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);

    const insumos = await query(
      `SELECT pi.id, pi.insumo_id, pi.cantidad, pi.notas,
              p.nombre AS insumo_nombre, p.sku AS insumo_sku,
              p.unidad_medida, p.precio_compra,
              (pi.cantidad * COALESCE(p.precio_compra, 0)) AS costo_linea
       FROM producto_insumos pi
       INNER JOIN productos p ON p.id = pi.insumo_id
       WHERE pi.producto_id = ?
       ORDER BY p.nombre`,
      [productoId]
    );

    const costoTotal = insumos.reduce((suma: number, fila: any) => suma + Number(fila.costo_linea), 0);
    return successResponse(res, 'Insumos del producto', { insumos, costo_total: Math.round(costoTotal * 100) / 100 });
  } catch (error: any) {
    logger.error('Error al obtener insumos:', error);
    return errorResponse(res, 'Error al obtener los insumos', error);
  }
};

/**
 * PUT /api/productos/:id/insumos
 * Reemplaza la composición completa del producto.
 */
export const guardarInsumos = async (req: Request, res: Response): Promise<Response> => {
  try {
    const productoId = Number(req.params.id);
    const producto = await validarAccesoProducto(req, productoId);
    if (!producto) return errorResponse(res, 'Producto no encontrado o sin acceso', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);

    const { insumos } = req.body;
    if (!Array.isArray(insumos)) return errorResponse(res, 'La lista de insumos es obligatoria', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);

    const ids = insumos.map((fila: any) => Number(fila.insumo_id));
    if (ids.some((id: number) => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
      return errorResponse(res, 'La composición contiene insumos inválidos o repetidos', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }
    if (ids.includes(productoId)) {
      return errorResponse(res, 'Un producto no puede ser insumo de sí mismo', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    await withTransaction(async (txQuery) => {
      await txQuery('DELETE FROM producto_insumos WHERE producto_id = ?', [productoId]);

      for (const fila of insumos) {
        const cantidad = Number(fila.cantidad);
        if (!Number.isFinite(cantidad) || cantidad <= 0) throw new Error('Cada insumo debe tener una cantidad mayor a cero');

        const insumo = await txQuery(
          'SELECT id FROM productos WHERE id = ? AND empresa_id = ? LIMIT 1',
          [fila.insumo_id, producto.empresa_id]
        );
        if (insumo.length === 0) throw new Error('Un insumo no pertenece a la empresa del producto');

        // Evita una composición circular de un nivel.
        const circular = await txQuery(
          'SELECT 1 FROM producto_insumos WHERE producto_id = ? AND insumo_id = ? LIMIT 1',
          [fila.insumo_id, productoId]
        );
        if (circular.length > 0) throw new Error('La composición genera un ciclo entre productos');

        await txQuery(
          'INSERT INTO producto_insumos (empresa_id, producto_id, insumo_id, cantidad, notas) VALUES (?, ?, ?, ?, ?)',
          [producto.empresa_id, productoId, fila.insumo_id, cantidad, fila.notas || null]
        );
      }
    });

    return successResponse(res, 'Composición guardada exitosamente', { producto_id: productoId, total: insumos.length });
  } catch (error: any) {
    logger.error('Error al guardar insumos:', error);
    return errorResponse(res, error?.message || 'Error al guardar la composición', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
  }
};
