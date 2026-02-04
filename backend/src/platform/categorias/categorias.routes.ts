/**
 * =================================
 * KORE INVENTORY - CATEGORÍAS ROUTES
 * Rutas de categorías
 * =================================
 */

import { Router } from 'express';
import {
  getCategorias,
  getCategoriaById,
  createCategoria,
  updateCategoria,
  deleteCategoria
} from './categorias.controller';
import { authMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET /api/categorias?empresaId=X - Obtener todas las categorías de una empresa
router.get('/', getCategorias);

// GET /api/categorias/:id - Obtener categoría por ID
router.get('/:id', getCategoriaById);

// POST /api/categorias - Crear nueva categoría
router.post('/', createCategoria);

// PUT /api/categorias/:id - Actualizar categoría
router.put('/:id', updateCategoria);

// DELETE /api/categorias/:id - Eliminar categoría (soft delete)
router.delete('/:id', deleteCategoria);

export default router;
