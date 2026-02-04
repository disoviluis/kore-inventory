/**
 * =================================
 * KORE INVENTORY - PRODUCTOS ROUTES
 * Rutas de productos
 * =================================
 */

import { Router } from 'express';
import {
  getProductos,
  getProductoById,
  createProducto,
  updateProducto,
  deleteProducto
} from './productos.controller';
import { authMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET /api/productos?empresaId=X - Obtener todos los productos de una empresa
router.get('/', getProductos);

// GET /api/productos/:id - Obtener producto por ID
router.get('/:id', getProductoById);

// POST /api/productos - Crear nuevo producto
router.post('/', createProducto);

// PUT /api/productos/:id - Actualizar producto
router.put('/:id', updateProducto);

// DELETE /api/productos/:id - Eliminar producto (soft delete)
router.delete('/:id', deleteProducto);

export default router;
