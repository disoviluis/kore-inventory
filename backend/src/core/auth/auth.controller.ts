/**
 * =================================
 * KORE INVENTORY - AUTH CONTROLLER
 * Controlador de autenticación
 * =================================
 */

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

interface LoginRequest {
  email: string;
  password: string;
}

interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  tipo_usuario: string;
  empresa_id_default: number | null;
  activo: number;
  intentos_fallidos: number;
  bloqueado_hasta: Date | null;
}

/**
 * Login de usuario
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password }: LoginRequest = req.body;

    // Validar datos requeridos
    if (!email || !password) {
      return errorResponse(
        res,
        'Email y contraseña son requeridos',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Buscar usuario por email
    const usuarios: Usuario[] = await query(
      'SELECT * FROM usuarios WHERE email = ? LIMIT 1',
      [email]
    );

    if (usuarios.length === 0) {
      logger.warning(`Intento de login fallido - Email no existe: ${email}`);
      return errorResponse(
        res,
        CONSTANTS.MESSAGES.LOGIN_FAILED,
        null,
        CONSTANTS.HTTP_STATUS.UNAUTHORIZED
      );
    }

    const usuario = usuarios[0];

    // Verificar si la cuenta está activa
    if (usuario.activo !== 1) {
      logger.warning(`Intento de login - Cuenta inactiva: ${email}`);
      return errorResponse(
        res,
        'Cuenta inactiva. Contacte al administrador',
        null,
        CONSTANTS.HTTP_STATUS.FORBIDDEN
      );
    }

    // Verificar si la cuenta está bloqueada
    if (usuario.bloqueado_hasta) {
      const bloqueadoHasta = new Date(usuario.bloqueado_hasta);
      const ahora = new Date();

      if (bloqueadoHasta > ahora) {
        const minutosRestantes = Math.ceil(
          (bloqueadoHasta.getTime() - ahora.getTime()) / (1000 * 60)
        );
        logger.warning(`Intento de login - Cuenta bloqueada: ${email}`);
        return errorResponse(
          res,
          `${CONSTANTS.MESSAGES.ACCOUNT_LOCKED}. Intente nuevamente en ${minutosRestantes} minutos`,
          null,
          CONSTANTS.HTTP_STATUS.FORBIDDEN
        );
      } else {
        // Desbloquear cuenta si ya pasó el tiempo
        await query(
          'UPDATE usuarios SET bloqueado_hasta = NULL, intentos_fallidos = 0 WHERE id = ?',
          [usuario.id]
        );
      }
    }

    // Verificar contraseña
    const passwordValido = await bcrypt.compare(password, usuario.password);

    if (!passwordValido) {
      // Incrementar intentos fallidos
      const intentos = usuario.intentos_fallidos + 1;
      const maxIntentos = CONSTANTS.SECURITY.MAX_LOGIN_ATTEMPTS;

      if (intentos >= maxIntentos) {
        // Bloquear cuenta
        const lockTime = CONSTANTS.SECURITY.LOCK_TIME_MINUTES;
        const bloqueadoHasta = new Date();
        bloqueadoHasta.setMinutes(bloqueadoHasta.getMinutes() + lockTime);

        await query(
          'UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?',
          [intentos, bloqueadoHasta, usuario.id]
        );

        logger.warning(`Cuenta bloqueada por múltiples intentos: ${email}`);
        return errorResponse(
          res,
          `${CONSTANTS.MESSAGES.ACCOUNT_LOCKED}. Intente nuevamente en ${lockTime} minutos`,
          null,
          CONSTANTS.HTTP_STATUS.FORBIDDEN
        );
      } else {
        // Solo incrementar intentos
        await query(
          'UPDATE usuarios SET intentos_fallidos = ? WHERE id = ?',
          [intentos, usuario.id]
        );

        logger.warning(
          `Intento de login fallido (${intentos}/${maxIntentos}): ${email}`
        );
        return errorResponse(
          res,
          `${CONSTANTS.MESSAGES.LOGIN_FAILED}. Intentos restantes: ${maxIntentos - intentos}`,
          null,
          CONSTANTS.HTTP_STATUS.UNAUTHORIZED
        );
      }
    }

    // ✅ Login exitoso - Resetear intentos fallidos
    await query(
      'UPDATE usuarios SET intentos_fallidos = 0, ultimo_login = NOW(), ultimo_ip = ? WHERE id = ?',
      [req.ip, usuario.id]
    );

    // Generar JWT
    const jwtSecret: string = process.env.JWT_SECRET || 'secret_key_default';
    const jwtExpiresIn: string = process.env.JWT_EXPIRES_IN || '24h';
    
    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        tipo_usuario: usuario.tipo_usuario,
        empresa_id: usuario.empresa_id_default
      },
      jwtSecret as jwt.Secret,
      { expiresIn: jwtExpiresIn } as jwt.SignOptions
    );

    // Datos del usuario (sin password)
    const usuarioData = {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      tipo_usuario: usuario.tipo_usuario,
      empresa_id_default: usuario.empresa_id_default
    };

    logger.success(`Login exitoso: ${email} (${usuario.tipo_usuario})`);

    return successResponse(
      res,
      CONSTANTS.MESSAGES.LOGIN_SUCCESS,
      {
        token,
        usuario: usuarioData
      }
    );
  } catch (error) {
    logger.error('Error en login:', error);
    return errorResponse(res, CONSTANTS.MESSAGES.ERROR, error);
  }
};

/**
 * Verificar token
 * GET /api/auth/verify
 */
export const verifyToken = async (req: Request, res: Response): Promise<Response> => {
  try {
    // El middleware auth ya validó el token
    // Aquí solo retornamos los datos del usuario
    const user = (req as any).user;

    return successResponse(res, 'Token válido', { usuario: user });
  } catch (error) {
    logger.error('Error al verificar token:', error);
    return errorResponse(res, CONSTANTS.MESSAGES.ERROR, error);
  }
};

/**
 * Logout
 * POST /api/auth/logout
 */
export const logout = async (_req: Request, res: Response): Promise<Response> => {
  try {
    // En JWT no hay sesiones del lado del servidor
    // El logout se maneja en el frontend eliminando el token
    logger.info('Logout exitoso');
    return successResponse(res, 'Sesión cerrada exitosamente');
  } catch (error) {
    logger.error('Error en logout:', error);
    return errorResponse(res, CONSTANTS.MESSAGES.ERROR, error);
  }
};
