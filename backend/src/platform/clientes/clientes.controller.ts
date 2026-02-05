/**
 * =================================
 * KORE INVENTORY - CLIENTES CONTROLLER
 * Controlador de clientes
 * =================================
 */

import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

/**
 * Obtener todos los clientes de una empresa
 * GET /api/clientes?empresaId=X
 */
export const getClientes = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { empresaId } = req.query;

    if (!empresaId) {
      return errorResponse(
        res,
        'ID de empresa es requerido',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const clientes = await query(
      `SELECT 
        id,
        empresa_id,
        tipo_documento,
        numero_documento,
        nombre,
        apellido,
        razon_social,
        email,
        telefono,
        celular,
        direccion,
        ciudad,
        departamento,
        codigo_postal,
        pais,
        limite_credito,
        dias_credito,
        estado,
        created_at,
        updated_at
      FROM clientes
      WHERE empresa_id = ?
      ORDER BY nombre ASC, apellido ASC`,
      [empresaId]
    );

    logger.info(`Clientes obtenidos para empresa ${empresaId}: ${clientes.length}`);
    return successResponse(res, 'Clientes obtenidos exitosamente', clientes, CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener clientes:', error);
    return errorResponse(res, 'Error al obtener clientes', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Obtener cliente por ID
 * GET /api/clientes/:id
 */
export const getClienteById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const clientes = await query(
      'SELECT * FROM clientes WHERE id = ?',
      [id]
    );

    if (clientes.length === 0) {
      return errorResponse(
        res,
        'Cliente no encontrado',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    return successResponse(res, 'Cliente obtenido exitosamente', clientes[0], CONSTANTS.HTTP_STATUS.OK);

  } catch (error) {
    logger.error('Error al obtener cliente:', error);
    return errorResponse(res, 'Error al obtener cliente', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Crear nuevo cliente
 * POST /api/clientes
 */
export const createCliente = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      empresa_id,
      tipo_documento,
      numero_documento,
      nombre,
      apellido,
      razon_social,
      email,
      telefono,
      celular,
      direccion,
      ciudad,
      departamento,
      codigo_postal,
      pais,
      limite_credito,
      dias_credito,
      estado
    } = req.body;

    // Validaciones básicas
    if (!empresa_id || !numero_documento || !nombre) {
      return errorResponse(
        res,
        'Campos requeridos: empresa_id, numero_documento, nombre',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Verificar si el documento ya existe para esta empresa
    const documentoExiste = await query(
      'SELECT id FROM clientes WHERE empresa_id = ? AND numero_documento = ?',
      [empresa_id, numero_documento]
    );

    if (documentoExiste.length > 0) {
      return errorResponse(
        res,
        'El número de documento ya existe para esta empresa',
        null,
        CONSTANTS.HTTP_STATUS.CONFLICT
      );
    }

    const result = await query(
      `INSERT INTO clientes (
        empresa_id,
        tipo_documento,
        numero_documento,
        nombre,
        apellido,
        razon_social,
        email,
        telefono,
        celular,
        direccion,
        ciudad,
        departamento,
        codigo_postal,
        pais,
        limite_credito,
        dias_credito,
        estado,
        creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresa_id,
        tipo_documento || 'CC',
        numero_documento,
        nombre,
        apellido || null,
        razon_social || null,
        email || null,
        telefono || null,
        celular || null,
        direccion || null,
        ciudad || null,
        departamento || null,
        codigo_postal || null,
        pais || 'Colombia',
        limite_credito || 0,
        dias_credito || 0,
        estado || 'activo',
        req.body.userId || null
      ]
    );

    logger.info(`Cliente creado: ${nombre} (ID: ${result.insertId})`);
    
    // Obtener el cliente recién creado con todos sus datos
    const nuevoCliente = await query(
      'SELECT * FROM clientes WHERE id = ?',
      [result.insertId]
    );
    
    return successResponse(
      res,
      'Cliente creado exitosamente',
      nuevoCliente[0],
      CONSTANTS.HTTP_STATUS.CREATED
    );

  } catch (error) {
    logger.error('Error al crear cliente:', error);
    return errorResponse(res, 'Error al crear cliente', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Actualizar cliente
 * PUT /api/clientes/:id
 */
export const updateCliente = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const {
      tipo_documento,
      numero_documento,
      nombre,
      apellido,
      razon_social,
      email,
      telefono,
      celular,
      direccion,
      ciudad,
      departamento,
      codigo_postal,
      pais,
      limite_credito,
      dias_credito,
      estado
    } = req.body;

    // Verificar si el cliente existe
    const clienteExiste = await query('SELECT id, empresa_id FROM clientes WHERE id = ?', [id]);
    
    if (clienteExiste.length === 0) {
      return errorResponse(
        res,
        'Cliente no encontrado',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    // Verificar si el documento ya existe para otro cliente de la misma empresa
    if (numero_documento) {
      const documentoExiste = await query(
        'SELECT id FROM clientes WHERE empresa_id = ? AND numero_documento = ? AND id != ?',
        [clienteExiste[0].empresa_id, numero_documento, id]
      );

      if (documentoExiste.length > 0) {
        return errorResponse(
          res,
          'El número de documento ya existe para otro cliente de esta empresa',
          null,
          CONSTANTS.HTTP_STATUS.CONFLICT
        );
      }
    }

    // Construir el UPDATE dinámicamente
    const updates: string[] = [];
    const values: any[] = [];

    if (tipo_documento !== undefined) {
      updates.push('tipo_documento = ?');
      values.push(tipo_documento);
    }
    if (numero_documento !== undefined) {
      updates.push('numero_documento = ?');
      values.push(numero_documento);
    }
    if (nombre !== undefined) {
      updates.push('nombre = ?');
      values.push(nombre);
    }
    if (apellido !== undefined) {
      updates.push('apellido = ?');
      values.push(apellido);
    }
    if (razon_social !== undefined) {
      updates.push('razon_social = ?');
      values.push(razon_social);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (telefono !== undefined) {
      updates.push('telefono = ?');
      values.push(telefono);
    }
    if (celular !== undefined) {
      updates.push('celular = ?');
      values.push(celular);
    }
    if (direccion !== undefined) {
      updates.push('direccion = ?');
      values.push(direccion);
    }
    if (ciudad !== undefined) {
      updates.push('ciudad = ?');
      values.push(ciudad);
    }
    if (departamento !== undefined) {
      updates.push('departamento = ?');
      values.push(departamento);
    }
    if (codigo_postal !== undefined) {
      updates.push('codigo_postal = ?');
      values.push(codigo_postal);
    }
    if (pais !== undefined) {
      updates.push('pais = ?');
      values.push(pais);
    }
    if (limite_credito !== undefined) {
      updates.push('limite_credito = ?');
      values.push(limite_credito);
    }
    if (dias_credito !== undefined) {
      updates.push('dias_credito = ?');
      values.push(dias_credito);
    }
    if (estado !== undefined) {
      updates.push('estado = ?');
      values.push(estado);
    }

    if (updates.length === 0) {
      return errorResponse(
        res,
        'No se proporcionaron campos para actualizar',
        null,
        CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await query(
      `UPDATE clientes SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    logger.info(`Cliente actualizado: ${id}`);
    
    return successResponse(
      res,
      'Cliente actualizado exitosamente',
      { id },
      CONSTANTS.HTTP_STATUS.OK
    );

  } catch (error) {
    logger.error('Error al actualizar cliente:', error);
    return errorResponse(res, 'Error al actualizar cliente', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Eliminar cliente
 * DELETE /api/clientes/:id
 */
export const deleteCliente = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // Verificar si el cliente existe
    const clienteExiste = await query('SELECT id FROM clientes WHERE id = ?', [id]);
    
    if (clienteExiste.length === 0) {
      return errorResponse(
        res,
        'Cliente no encontrado',
        null,
        CONSTANTS.HTTP_STATUS.NOT_FOUND
      );
    }

    // Soft delete
    await query(
      `UPDATE clientes SET estado = 'inactivo', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );

    logger.info(`Cliente eliminado (inactivado): ${id}`);
    
    return successResponse(
      res,
      'Cliente eliminado exitosamente',
      { id },
      CONSTANTS.HTTP_STATUS.OK
    );

  } catch (error) {
    logger.error('Error al eliminar cliente:', error);
    return errorResponse(res, 'Error al eliminar cliente', error, CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};
