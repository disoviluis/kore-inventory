/**
 * =================================
 * KORE INVENTORY - USUARIOS ROUTES
 * Rutas para gestión de usuarios de empresa
 * =================================
 */

import { Router } from 'express';
import {
  getUsuariosEmpresa,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario
} from './usuarios.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Rutas principales
router.get('/', getUsuariosEmpresa); // Lista de usuarios de la empresa
router.get('/:id', getUsuarioById); // Detalle de usuario
router.post('/', createUsuario); // Crear nuevo usuario
router.put('/:id', updateUsuario); // Actualizar usuario
router.delete('/:id', deleteUsuario); // Desactivar usuario (soft delete)

export default router;
