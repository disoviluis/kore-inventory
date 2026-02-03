/**
 * =================================
 * KORE INVENTORY - EMPRESAS CONTROLLER
 * Controlador de empresas
 * =================================
 */

import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

/**
 * Obtener todas las empresas
 * GET /api/empresas
 */
export const getEmpresas = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresas = await query(
      `SELECT 
        id, 
        nombre, 
        razon_social, 
        nit, 
        email, 
        telefono,
        ciudad,
        pais,
        logo_url,
        estado,
        DATE_FORMAT(creado_en, '%Y-%m-%d') as fecha_creacion
      FROM empresas 
      WHERE estado != 'cancelada'
      ORDER BY nombre ASC`
    );

    logger.info(`Empresas obtenidas: ${empresas.length}`);
    
    return successResponse(
      res,
      'Empresas obtenidas exitosamente',
      empresas,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener empresas:', error);
    return errorResponse(
      res,
      'Error al obtener empresas',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Obtener empresa por ID
 * GET /api/empresas/:id
 */
export const getEmpresaById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const empresas = await query(
      `SELECT 
        id, 
        nombre, 
        razon_social, 
        nit, 
        email, 
        telefono,
        direccion,
        ciudad,
        pais,
        logo_url,
        color_primario,
        plan_id,
        moneda,
        zona_horaria,
        idioma,
        estado,
        DATE_FORMAT(creado_en, '%Y-%m-%d') as fecha_creacion
      FROM empresas 
      WHERE id = ?
      LIMIT 1`,
      [id]
    );

    if (empresas.length === 0) {
      return errorResponse(
        res,
        'Empresa no encontrada',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    return successResponse(
      res,
      'Empresa obtenida exitosamente',
      empresas[0],
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener empresa:', error);
    return errorResponse(
      res,
      'Error al obtener empresa',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Obtener empresas del usuario
 * GET /api/empresas/usuario/:userId
 */
export const getEmpresasByUsuario = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;

    // Primero verificar si el usuario es super_admin
    const usuarios = await query(
      'SELECT tipo_usuario FROM usuarios WHERE id = ? LIMIT 1',
      [userId]
    );

    if (usuarios.length === 0) {
      return errorResponse(
        res,
        'Usuario no encontrado',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    const usuario = usuarios[0];
    let empresas;

    // Si es super_admin, devolver todas las empresas activas
    if (usuario.tipo_usuario === 'super_admin') {
      empresas = await query(
        `SELECT 
          id, 
          nombre, 
          razon_social, 
          nit, 
          email,
          logo_url,
          estado
        FROM empresas
        WHERE estado = 'activa'
        ORDER BY nombre ASC`
      );
    } else {
      // Para usuarios normales, obtener solo sus empresas asignadas
      empresas = await query(
        `SELECT 
          e.id, 
          e.nombre, 
          e.razon_social, 
          e.nit, 
          e.email,
          e.logo_url,
          e.estado
        FROM empresas e
        INNER JOIN usuario_empresa ue ON e.id = ue.empresa_id
        WHERE ue.usuario_id = ? 
          AND e.estado = 'activa'
          AND ue.activo = 1
        ORDER BY e.nombre ASC`,
        [userId]
      );
    }

    return successResponse(
      res,
      'Empresas del usuario obtenidas exitosamente',
      empresas,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener empresas del usuario:', error);
    return errorResponse(
      res,
      'Error al obtener empresas del usuario',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};
