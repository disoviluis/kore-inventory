/**
 * =================================
 * KORE INVENTORY - AUTH MIDDLEWARE
 * Middleware de autenticación JWT
 * =================================
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';
import { getAuthSecret, protectAuthValue } from '../auth/auth.security';
import { query } from '../../shared/database';
import { sessionCookie } from '../auth/auth.sessions';
import { needsLegalAcceptance } from '../auth/legal.service';

interface JwtPayload {
  id: number;
  jti: string;
  version: number;
}

/**
 * Middleware para validar JWT
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    if ((req as any).authSessionId) { next(); return; }
    // Obtener token del header
    const authHeader = req.headers.authorization;

    const token = req.cookies?.[sessionCookie];
    if (!token) {
      logger.warning(`authMiddleware: Token no proporcionado en ${req.method} ${req.url}`);
      return errorResponse(
        res,
        CONSTANTS.MESSAGES.UNAUTHORIZED,
        'Token no proporcionado',
        CONSTANTS.HTTP_STATUS.UNAUTHORIZED
      );
    }

    logger.info(`authMiddleware: Verificando token para ${req.method} ${req.url}`);

    // Verificar token
    const decoded = jwt.verify(
      token,
      getAuthSecret(),
      { algorithms: ['HS256'], issuer: 'kore-inventory', audience: 'kore-web' }
    ) as JwtPayload;
    if (!decoded.jti || !Number.isInteger(decoded.id) || !Number.isInteger(decoded.version)) {
      return res.status(401).json({ success: false, message: 'Sesion no valida' });
    }
    const users = await query(`SELECT u.id, u.email, u.nombre, u.apellido, u.tipo_usuario,
      u.empresa_id_default AS empresa_id, u.empresa_id_default, u.bodega_id,
      s.estado AS estado_verificacion, s.mfa_secret IS NOT NULL AS mfa_activo, s.mfa_obligatorio,
      a.csrf_hash FROM usuarios u JOIN usuarios_seguridad s ON s.usuario_id = u.id
      JOIN auth_sesiones a ON a.usuario_id = u.id
      WHERE u.id = ? AND u.activo = 1 AND s.estado IN ('legado','verificado')
        AND (u.rol_id IS NULL OR EXISTS (SELECT 1 FROM roles r WHERE r.id = u.rol_id AND r.activo = 1 AND r.nivel >= u.nivel_privilegio))
        AND s.version_sesion = ? AND a.version_sesion = s.version_sesion
        AND a.id = ? AND a.revocada_at IS NULL AND a.expira_at > UTC_TIMESTAMP()`,
    [decoded.id, decoded.version, decoded.jti]);
    const user = users[0];
    if (!user) return res.status(401).json({ success: false, message: 'Sesion revocada o expirada' });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const csrf = req.get('X-CSRF-Token');
      if (!csrf || protectAuthValue(csrf) !== user.csrf_hash) {
        return res.status(403).json({ success: false, codigo: 'CSRF_INVALIDO', message: 'Solicitud no autorizada' });
      }
    }
    delete user.csrf_hash;
    const pendingLegal = user.estado_verificacion === 'verificado' && await needsLegalAcceptance(user.id);
    const pendingMfa = (user.mfa_obligatorio || user.estado_verificacion === 'verificado' && ['super_admin', 'admin_empresa'].includes(user.tipo_usuario)) && !user.mfa_activo;
    user.requiere_seguridad = pendingLegal || pendingMfa;
    if (user.requiere_seguridad && !/^\/api\/auth\/(verify|logout|seguridad|aceptar-documentos|mfa)(\/|$)/.test(req.originalUrl.split('?')[0])) {
      return res.status(428).json({ success: false, codigo: 'SEGURIDAD_PENDIENTE', message: 'Complete la configuracion de seguridad', data: { url: '/seguridad-cuenta.html' } });
    }

    // Agregar usuario al request
    (req as any).user = user;
    (req as any).usuario = user;
    (req as any).authSessionId = decoded.jti;

    next();
  } catch (error: any) {
    logger.warning(`authMiddleware: Token inválido o expirado en ${req.method} ${req.url} - ${error.message}`);

    if (error.name === 'TokenExpiredError') {
      return errorResponse(
        res,
        CONSTANTS.MESSAGES.TOKEN_EXPIRED,
        null,
        CONSTANTS.HTTP_STATUS.UNAUTHORIZED
      );
    }

    return errorResponse(
      res,
      CONSTANTS.MESSAGES.TOKEN_INVALID,
      null,
      CONSTANTS.HTTP_STATUS.UNAUTHORIZED
    );
  }
};

/**
 * Middleware para validar tipo de usuario
 */
export const requireUserType = (...allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    const user = (req as any).user;

    if (!user || !allowedTypes.includes(user.tipo_usuario)) {
      logger.warning(
        `Acceso denegado - Tipo de usuario: ${user?.tipo_usuario}`
      );
      return errorResponse(
        res,
        CONSTANTS.MESSAGES.FORBIDDEN,
        'No tiene permisos para acceder a este recurso',
        CONSTANTS.HTTP_STATUS.FORBIDDEN
      );
    }

    next();
  };
};
