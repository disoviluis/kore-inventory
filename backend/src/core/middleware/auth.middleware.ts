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

interface JwtPayload {
  id: number;
  email: string;
  tipo_usuario: string;
  empresa_id: number | null;
}

/**
 * Middleware para validar JWT
 */
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  try {
    // Obtener token del header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(
        res,
        CONSTANTS.MESSAGES.UNAUTHORIZED,
        'Token no proporcionado',
        CONSTANTS.HTTP_STATUS.UNAUTHORIZED
      );
    }

    const token = authHeader.substring(7); // Remover 'Bearer '

    // Verificar token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret_key_default'
    ) as JwtPayload;

    // Agregar usuario al request
    (req as any).user = decoded;

    next();
  } catch (error: any) {
    logger.warning('Token inválido o expirado', error.message);

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
