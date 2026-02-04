/**
 * =================================
 * KORE INVENTORY - CLIENTES ROUTES
 * Rutas de clientes
 * =================================
 */

import { Router } from 'express';
import {
  getClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente
} from './clientes.controller';
import { authMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET /api/clientes?empresaId=X - Obtener todos los clientes de una empresa
router.get('/', getClientes);

// GET /api/clientes/:id - Obtener cliente por ID
router.get('/:id', getClienteById);

// POST /api/clientes - Crear nuevo cliente
router.post('/', createCliente);

// PUT /api/clientes/:id - Actualizar cliente
router.put('/:id', updateCliente);

// DELETE /api/clientes/:id - Eliminar cliente (soft delete)
router.delete('/:id', deleteCliente);

export default router;
