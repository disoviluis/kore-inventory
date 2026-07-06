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
import { listS3Objects, createS3PresignedUploadUrl, getS3BucketName, getS3PublicUrl, deleteS3Object } from '../../shared/s3';

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
        DATE_FORMAT(created_at, '%Y-%m-%d') as fecha_creacion
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
        tipo_documento,
        digito_verificacion,
        email, 
        telefono,
        representante_legal,
        tipo_sociedad,
        matricula_mercantil,
        camara_comercio,
        fecha_matricula,
        actividad_economica,
        direccion,
        ciudad,
        pais,
        logo_url,
        sitio_web,
        descripcion,
        slogan,
        color_primario,
        plan_id,
        moneda,
        zona_horaria,
        idioma,
        regimen_tributario,
        tipo_contribuyente,
        gran_contribuyente,
        autoretenedor,
        agente_retenedor_iva,
        agente_retenedor_ica,
        resolucion_dian,
        fecha_resolucion,
        fecha_resolucion_desde,
        fecha_resolucion_hasta,
        prefijo_factura,
        rango_factura_desde,
        rango_factura_hasta,
        numeracion_actual,
        software_id,
        pin_software,
        ambiente,
        estado,
        DATE_FORMAT(created_at, '%Y-%m-%d') as fecha_creacion
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

    // Si es super_admin, devolver todas las empresas activas y en trial
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
        WHERE estado IN ('activa', 'trial')
        ORDER BY nombre ASC`
      );
    } else {
      // Para usuarios normales, obtener solo sus empresas asignadas (activas y trial)
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
          AND e.estado IN ('activa', 'trial')
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

export const getPaginaPublicaImagenesS3 = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const prefix = `empresa/${id}/pagina-publica/`;
    const contents = await listS3Objects(prefix);

    const images = contents
      .filter(item => item.Key)
      .map(item => ({
        key: item.Key,
        url: getS3PublicUrl(item.Key!)
      }));

    return successResponse(
      res,
      'Imágenes S3 obtenidas exitosamente',
      images,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener imágenes S3:', error);
    return errorResponse(
      res,
      'Error al obtener imágenes S3',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

export const getPaginaPublicaPresignedUpload = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      return errorResponse(
        res,
        'filename y contentType son obligatorios',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const key = `empresa/${id}/pagina-publica/${Date.now()}-${filename}`;
    const uploadUrl = await createS3PresignedUploadUrl(key, contentType);
    const publicUrl = getS3PublicUrl(key);

    return successResponse(
      res,
      'URL presignada generada correctamente',
      { uploadUrl, publicUrl },
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al generar URL presignada para S3:', error);
    return errorResponse(
      res,
      'Error al generar URL presignada para S3',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

export const deletePaginaPublicaImagenS3 = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { key } = req.body;

    if (!key || typeof key !== 'string') {
      return errorResponse(res, 'key es obligatorio', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    // Validar que la key pertenece a esta empresa (seguridad)
    const expectedPrefix = `empresa/${id}/pagina-publica/`;
    if (!key.startsWith(expectedPrefix)) {
      return errorResponse(res, 'No autorizado para borrar este archivo', null, CONSTANTS.HTTP_STATUS.FORBIDDEN);
    }

    await deleteS3Object(key);

    return successResponse(res, 'Imagen eliminada correctamente', null, CONSTANTS.HTTP_STATUS.OK);
  } catch (error) {
    logger.error('Error al eliminar imagen S3:', error);
    return errorResponse(res, 'Error al eliminar imagen S3', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Genera URL presignada S3 para subir logo de empresa
 * POST /api/empresas/:id/logo/upload-url
 */
export const getLogoPresignedUpload = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      return errorResponse(
        res,
        'filename y contentType son obligatorios',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const ext = filename.split('.').pop() || 'jpg';
    const key = `empresa/${id}/logo/logo_${Date.now()}.${ext}`;
    const uploadUrl = await createS3PresignedUploadUrl(key, contentType);
    const publicUrl = getS3PublicUrl(key);

    return successResponse(
      res,
      'URL presignada para logo generada correctamente',
      { uploadUrl, publicUrl },
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al generar URL presignada para logo:', error);
    return errorResponse(
      res,
      'Error al generar URL presignada para logo',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Actualizar empresa
 * PUT /api/empresas/:id
 */
export const updateEmpresa = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const {
      nombre, razon_social, nit, tipo_documento, digito_verificacion,
      representante_legal, tipo_sociedad, matricula_mercantil,
      camara_comercio, fecha_matricula, actividad_economica,
      email, telefono, direccion, ciudad, pais,
      logo_url, sitio_web, descripcion, slogan, regimen_tributario,
      tipo_contribuyente, gran_contribuyente, autoretenedor,
      agente_retenedor_iva, agente_retenedor_ica, resolucion_dian,
      fecha_resolucion, fecha_resolucion_desde, fecha_resolucion_hasta, 
      prefijo_factura, rango_factura_desde, rango_factura_hasta, numeracion_actual,
      software_id, pin_software, ambiente
    } = req.body;

    if (!nombre || !nit || !email) {
      return errorResponse(res, 'Nombre, NIT y email son obligatorios', null, CONSTANTS.HTTP_STATUS.BAD_REQUEST);
    }

    const empresaExiste = await query('SELECT id FROM empresas WHERE id = ? LIMIT 1', [id]);
    if (empresaExiste.length === 0) {
      return errorResponse(res, 'Empresa no encontrada', null, CONSTANTS.HTTP_STATUS.NOT_FOUND);
    }

    await query(
      `UPDATE empresas SET 
        nombre = ?, razon_social = ?, nit = ?, tipo_documento = ?, digito_verificacion = ?,
        representante_legal = ?, tipo_sociedad = ?, matricula_mercantil = ?,
        camara_comercio = ?, fecha_matricula = ?, actividad_economica = ?,
        email = ?, telefono = ?, direccion = ?,
        ciudad = ?, pais = ?, logo_url = ?, sitio_web = ?, descripcion = ?, slogan = ?,
        regimen_tributario = ?, tipo_contribuyente = ?, gran_contribuyente = ?, autoretenedor = ?,
        agente_retenedor_iva = ?, agente_retenedor_ica = ?, resolucion_dian = ?,
        fecha_resolucion = ?, fecha_resolucion_desde = ?, fecha_resolucion_hasta = ?, 
        prefijo_factura = ?, rango_factura_desde = ?, rango_factura_hasta = ?, numeracion_actual = ?,
        software_id = ?, pin_software = ?, ambiente = ?, updated_at = NOW()
      WHERE id = ?`,
      [
        nombre, razon_social || null, nit, tipo_documento || 'NIT', digito_verificacion || null,
        representante_legal || null, tipo_sociedad || null, matricula_mercantil || null,
        camara_comercio || null, fecha_matricula || null, actividad_economica || null,
        email, telefono || null, direccion || null,
        ciudad || null, pais || 'Colombia', logo_url || null, sitio_web || null,
        descripcion || null, slogan || null, regimen_tributario || 'simplificado',
        tipo_contribuyente || 'persona_juridica', gran_contribuyente || false, autoretenedor || false,
        agente_retenedor_iva || false, agente_retenedor_ica || false, resolucion_dian || null,
        fecha_resolucion || null, fecha_resolucion_desde || null, fecha_resolucion_hasta || null, 
        prefijo_factura || 'FAC', rango_factura_desde || null, rango_factura_hasta || null, 
        numeracion_actual || 1, software_id || null, pin_software || null, ambiente || 'pruebas', id
      ]
    );

    logger.info(`Empresa ${id} actualizada: ${nombre}`);
    return successResponse(res, 'Empresa actualizada exitosamente', { id, nombre }, CONSTANTS.HTTP_STATUS.OK);
  } catch (error) {
    logger.error('Error al actualizar empresa:', error);
    return errorResponse(res, 'Error al actualizar empresa', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

export const getPaginaPublica = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const records = await query(
      `SELECT valor FROM empresa_configuracion WHERE empresa_id = ? AND clave = 'pagina_publica' LIMIT 1`,
      [id]
    );

    if (records.length === 0) {
      return successResponse(
        res,
        'Configuración de página pública obtenida exitosamente',
        {},
        CONSTANTS.HTTP_STATUS.OK
      );
    }

    let config = {};
    const rawValor = records[0].valor;

    if (rawValor) {
      try {
        config = JSON.parse(rawValor);
      } catch (parseError) {
        logger.info(
          `JSON inválido en empresa_configuracion.valor para empresa ${id}: ${parseError}`
        );
        config = {};
      }
    }

    return successResponse(
      res,
      'Configuración de página pública obtenida exitosamente',
      config,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al obtener configuración de página pública:', error);
    return errorResponse(
      res,
      'Error al obtener la configuración de página pública',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

export const updatePaginaPublica = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const config = req.body || {};
    const valor = JSON.stringify(config);

    const existing = await query(
      `SELECT id FROM empresa_configuracion WHERE empresa_id = ? AND clave = 'pagina_publica' LIMIT 1`,
      [id]
    );

    if (existing.length === 0) {
      await query(
        `INSERT INTO empresa_configuracion (empresa_id, clave, valor, tipo, categoria, descripcion)
         VALUES (?, 'pagina_publica', ?, 'json', 'publica', 'Configuración de página pública')`,
        [id, valor]
      );
    } else {
      await query(
        `UPDATE empresa_configuracion SET valor = ?, tipo = 'json', categoria = 'publica', descripcion = 'Configuración de página pública', updated_at = CURRENT_TIMESTAMP
         WHERE empresa_id = ? AND clave = 'pagina_publica'`,
        [valor, id]
      );
    }

    logger.info(`Página pública actualizada para empresa ${id}`);

    return successResponse(
      res,
      'Configuración de página pública actualizada exitosamente',
      null,
      CONSTANTS.HTTP_STATUS.OK
    );
  } catch (error) {
    logger.error('Error al actualizar página pública:', error);
    return errorResponse(
      res,
      'Error al guardar la configuración de página pública',
      error,
      CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};
