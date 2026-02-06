/**
 * =================================
 * KORE INVENTORY - PROVEEDORES ROUTES
 * Rutas de proveedores
 * =================================
 */

import { Router } from 'express';
import {
  getProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  activateProveedor
} from './proveedores.controller';
import { authMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET /api/proveedores?empresaId=X - Obtener todos los proveedores de una empresa
router.get('/', getProveedores);

// GET /api/proveedores/:id - Obtener proveedor por ID
router.get('/:id', getProveedorById);

// POST /api/proveedores - Crear nuevo proveedor
router.post('/', createProveedor);

// PUT /api/proveedores/:id - Actualizar proveedor
router.put('/:id', updateProveedor);

// DELETE /api/proveedores/:id - Eliminar (desactivar) proveedor
router.delete('/:id', deleteProveedor);

// PUT /api/proveedores/:id/activar - Activar proveedor
router.put('/:id/activar', activateProveedor);

export default router;
