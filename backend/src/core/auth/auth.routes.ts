/**
 * =================================
 * KORE INVENTORY - AUTH ROUTES
 * Rutas de autenticación
 * =================================
 */

import { Router } from 'express';
import { verifyToken } from './auth.controller';
import { secureLogin, sessionLogout } from './auth.login';
import { authIpLimit, authAccountLimit } from './auth.limits';
import { getModulosPermitidos, getPermisosUsuario } from './permisos.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { authPublicUrl } from './auth.mail';
import { accessChallengeInfo, completeAccessChallenge, resendAccessCode, requestPasswordRecovery } from './auth.onboarding';
import { getAccountSecurity, acceptAccountDocuments, setupAccountMfa, confirmAccountMfa, revokeAccountSessions, resetAccountMfa } from './auth.account';

const router = Router();
router.use((req, res, next) => {
	const origin = req.get('Origin');
	const developmentOrigin = process.env.NODE_ENV !== 'production' ? `${req.protocol}://${req.get('host')}` : null;
	if (origin && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin !== authPublicUrl() && origin !== developmentOrigin) {
		res.status(403).json({ success: false, message: 'Origen no autorizado' }); return;
	}
	next();
});
router.post('/invitacion', authIpLimit, authAccountLimit, accessChallengeInfo);
router.post('/confirmar-cuenta', authIpLimit, authAccountLimit, completeAccessChallenge);
router.post('/reenviar-codigo', authIpLimit, authAccountLimit, resendAccessCode);
router.post('/recuperar-password', authIpLimit, authAccountLimit, requestPasswordRecovery);
router.get('/seguridad', authMiddleware, getAccountSecurity);
router.post('/aceptar-documentos', authMiddleware, acceptAccountDocuments);
router.post('/mfa/preparar', authMiddleware, authIpLimit, setupAccountMfa);
router.post('/mfa/confirmar', authMiddleware, authIpLimit, confirmAccountMfa);
router.post('/mfa/reconfigurar', authMiddleware, authIpLimit, resetAccountMfa);
router.post('/seguridad/revocar-sesiones', authMiddleware, revokeAccountSessions);

/**
 * @route   POST /api/auth/login
 * @desc    Login de usuario
 * @access  Public
 */
router.post('/login', authIpLimit, authAccountLimit, secureLogin);

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
router.post('/logout', authMiddleware, sessionLogout);

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
