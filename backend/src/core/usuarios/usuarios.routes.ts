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
import { requireUserType } from '../middleware/auth.middleware';
import { createInvitedUser, deactivateAccessUser } from '../auth/auth.admin';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Rutas principales
router.get('/', getUsuariosEmpresa); // Lista de usuarios de la empresa
router.get('/:id', getUsuarioById); // Detalle de usuario
router.post('/', createInvitedUser);
router.put('/:id', requireUserType('super_admin'), updateUsuario);
router.delete('/:id', deactivateAccessUser);

export default router;
