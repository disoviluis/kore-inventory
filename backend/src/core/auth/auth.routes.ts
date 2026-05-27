/**
 * =================================
 * KORE INVENTORY - AUTH ROUTES
 * Rutas de autenticación
 * =================================
 */

import { Router } from 'express';
import { login, verifyToken, logout } from './auth.controller';
import { getModulosPermitidos, getPermisosUsuario } from './permisos.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login de usuario
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   GET /api/auth/verify
 * @desc    Verificar token JWT
 * @access  Private
 */
router.get('/verify', authMiddleware, verifyToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout de usuario
 * @access  Private
 */
router.post('/logout', authMiddleware, logout);

/**
 * @route   GET /api/auth/permisos/modulos
 * @desc    Obtener módulos permitidos para el usuario actual
 * @access  Private
 */
router.get('/permisos/modulos', authMiddleware, getModulosPermitidos);

/**
 * @route   GET /api/auth/permisos
 * @desc    Obtener permisos detallados del usuario actual
 * @access  Private
 */
router.get('/permisos', authMiddleware, getPermisosUsuario);

export default router;
