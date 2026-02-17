/**
 * =================================
 * KORE INVENTORY - ROLES ROUTES
 * Rutas para gestión de roles y permisos
 * =================================
 */

import { Router } from 'express';
import {
  getRoles,
  getRolById,
  getModulosAcciones,
  createRol,
  updateRol,
  deleteRol
} from './roles.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Rutas principales
router.get('/', getRoles); // Lista de roles (filtrado por empresa para admin_empresa)
router.get('/modulos-acciones', getModulosAcciones); // Matriz de permisos disponibles
router.get('/:id', getRolById); // Detalle de rol con permisos
router.post('/', createRol); // Crear nuevo rol
router.put('/:id', updateRol); // Actualizar rol y/o permisos
router.delete('/:id', deleteRol); // Eliminar rol (soft delete)

export default router;
