/**
 * =================================
 * KORE INVENTORY - RESPONSE HELPERS
 * Funciones auxiliares para respuestas HTTP
 * =================================
 */

import { Response } from 'express';
import { CONSTANTS } from './constants';

interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

/**
 * Respuesta exitosa
 */
export const successResponse = (
  res: Response,
  message: string = CONSTANTS.MESSAGES.SUCCESS,
  data: any = null,
  statusCode: number = CONSTANTS.HTTP_STATUS.OK
): Response => {
  const response: ApiResponse = {
    success: true,
    message,
    data
  };
  return res.status(statusCode).json(response);
};

/**
 * Respuesta de error
 */
export const errorResponse = (
  res: Response,
  message: string = CONSTANTS.MESSAGES.ERROR,
  error: any = null,
  statusCode: number = CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
): Response => {
  const response: ApiResponse = {
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error : undefined
  };
  return res.status(statusCode).json(response);
};

/**
 * Respuesta de validación
 */
export const validationErrorResponse = (
  res: Response,
  errors: any
): Response => {
  return res.status(CONSTANTS.HTTP_STATUS.BAD_REQUEST).json({
    success: false,
    message: CONSTANTS.MESSAGES.VALIDATION_ERROR,
    errors
  });
};
