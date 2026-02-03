/**
 * =================================
 * KORE INVENTORY - ERROR HANDLER MIDDLEWARE
 * Middleware global de manejo de errores
 * =================================
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../../shared/logger';
import { CONSTANTS } from '../../shared/constants';

interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
}

/**
 * Middleware global de manejo de errores
 */
export const errorHandler = (
  err: ErrorWithStatus,
  req: Request,
  res: Response,
  next: NextFunction
): Response => {
  const statusCode = err.status || err.statusCode || CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = err.message || CONSTANTS.MESSAGES.ERROR;

  logger.error(`Error ${statusCode}: ${message}`, {
    url: req.url,
    method: req.method,
    error: err.stack
  });

  return res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? {
      stack: err.stack,
      details: err
    } : undefined
  });
};

/**
 * Middleware para rutas no encontradas
 */
export const notFoundHandler = (
  req: Request,
  res: Response
): Response => {
  logger.warning(`Ruta no encontrada: ${req.method} ${req.url}`);
  
  return res.status(CONSTANTS.HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: 'Ruta no encontrada',
    path: req.url
  });
};
