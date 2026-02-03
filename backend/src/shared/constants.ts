/**
 * =================================
 * KORE INVENTORY - SHARED CONSTANTS
 * Constantes globales del sistema
 * =================================
 */

export const CONSTANTS = {
  // Tipos de usuario
  USER_TYPES: {
    SUPER_ADMIN: 'super_admin',
    ADMIN_EMPRESA: 'admin_empresa',
    USUARIO: 'usuario',
    SOPORTE: 'soporte'
  },

  // Estados
  STATUS: {
    ACTIVE: 1,
    INACTIVE: 0
  },

  // Códigos de respuesta
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500
  },

  // Mensajes
  MESSAGES: {
    SUCCESS: 'Operación exitosa',
    ERROR: 'Error en el servidor',
    UNAUTHORIZED: 'No autorizado',
    FORBIDDEN: 'Acceso denegado',
    NOT_FOUND: 'Recurso no encontrado',
    VALIDATION_ERROR: 'Error de validación',
    LOGIN_SUCCESS: 'Inicio de sesión exitoso',
    LOGIN_FAILED: 'Credenciales inválidas',
    ACCOUNT_LOCKED: 'Cuenta bloqueada por múltiples intentos fallidos',
    TOKEN_EXPIRED: 'Token expirado',
    TOKEN_INVALID: 'Token inválido'
  },

  // Configuración de seguridad
  SECURITY: {
    MAX_LOGIN_ATTEMPTS: 5,
    LOCK_TIME_MINUTES: 15,
    BCRYPT_ROUNDS: 10
  }
};

export default CONSTANTS;
