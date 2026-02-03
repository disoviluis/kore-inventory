/**
 * =================================
 * KORE INVENTORY - AUTH ROUTES
 * Rutas de autenticación
 * =================================
 */

import { Router } from 'express';
import { login, verifyToken, logout } from './auth.controller';
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

export default router;
