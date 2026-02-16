import { Request, Response } from 'express';
import pool from '../../shared/database';
import logger from '../../shared/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * ========================================
 * MÓDULO: SUPER ADMIN - GESTIÓN DE PLANES Y LICENCIAS
 * ========================================
 */

/**
 * Obtener todos los planes
 */
export const getPlanes = async (req: Request, res: Response): Promise<void> => {
  try {
    const [planes] = await pool.query<RowDataPacket[]>(
      `SELECT 
        p.id,
        p.nombre,
        p.descripcion,
        p.precio_mensual,
        p.precio_anual,
        p.max_empresas,
        p.max_usuarios_por_empresa,
        p.max_productos,
        p.max_facturas_mes,
        p.modulos_incluidos,
        p.soporte_nivel,
        p.api_access,
        p.white_label,
        p.reportes_avanzados,
        p.multi_bodega,
        p.activo,
        p.destacado,
        p.created_at,
        p.updated_at,
        COUNT(DISTINCT e.id) as empresas_activas
      FROM planes p
      LEFT JOIN empresas e ON e.plan_id = p.id AND e.estado = 'activa'
      GROUP BY p.id
      ORDER BY p.precio_mensual ASC`
    );

    res.json({
      success: true,
      data: planes
    });
  } catch (error) {
    logger.error('Error al obtener planes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener planes'
    });
  }
};

/**
 * Obtener plan por ID
 */
export const getPlanById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [planes] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM planes WHERE id = ?',
      [id]
    );

    if (planes.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Plan no encontrado'
      });
      return;
    }

    res.json({
      success: true,
      data: planes[0]
    });
  } catch (error) {
    logger.error('Error al obtener plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener plan'
    });
  }
};

/**
 * Crear nuevo plan
 */
export const createPlan = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    const {
      nombre,
      descripcion,
      precio_mensual,
      precio_anual,
      max_empresas,
      max_usuarios_por_empresa,
      max_productos,
      max_facturas_mes,
      modulos_incluidos,
      soporte_nivel,
      api_access,
      white_label,
      reportes_avanzados,
      multi_bodega
    } = req.body;

    await connection.beginTransaction();

    // Insertar plan
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO planes (
        nombre, descripcion, precio_mensual, precio_anual,
        max_empresas, max_usuarios_por_empresa, max_productos, max_facturas_mes,
        modulos_incluidos, soporte_nivel, api_access, white_label,
        reportes_avanzados, multi_bodega
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        descripcion || null,
        precio_mensual,
        precio_anual || null,
        max_empresas || 1,
        max_usuarios_por_empresa || 5,
        max_productos || null,
        max_facturas_mes || null,
        modulos_incluidos ? JSON.stringify(modulos_incluidos) : null,
        soporte_nivel || 'email',
        api_access || 0,
        white_label || 0,
        reportes_avanzados || 0,
        multi_bodega || 0
      ]
    );

    const planId = result.insertId;

    // Registrar auditoría
    const usuario = (req as any).usuario;
    if (usuario && usuario.id) {
      await connection.query(
        `INSERT INTO auditoria_logs (
          usuario_id, accion, tabla_afectada, registro_id, fecha
        ) VALUES (?, ?, ?, ?, NOW())`,
        [usuario.id, 'INSERT', 'planes', planId]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Plan creado exitosamente',
      data: { id: planId }
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Error al crear plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear plan'
    });
  } finally {
    connection.release();
  }
};

/**
 * Actualizar plan
 */
export const updatePlan = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const {
      nombre,
      descripcion,
      precio_mensual,
      precio_anual,
      max_empresas,
      max_usuarios_por_empresa,
      max_productos,
      max_facturas_mes,
      modulos_incluidos,
      soporte_nivel,
      api_access,
      white_label,
      reportes_avanzados,
      multi_bodega,
      activo
    } = req.body;

    await connection.beginTransaction();

    // Actualizar plan
    await connection.query(
      `UPDATE planes SET
        nombre = ?,
        descripcion = ?,
        precio_mensual = ?,
        precio_anual = ?,
        max_empresas = ?,
        max_usuarios_por_empresa = ?,
        max_productos = ?,
        max_facturas_mes = ?,
        modulos_incluidos = ?,
        soporte_nivel = ?,
        api_access = ?,
        white_label = ?,
        reportes_avanzados = ?,
        multi_bodega = ?,
        activo = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        nombre,
        descripcion,
        precio_mensual,
        precio_anual,
        max_empresas,
        max_usuarios_por_empresa,
        max_productos,
        max_facturas_mes,
        modulos_incluidos ? JSON.stringify(modulos_incluidos) : null,
        soporte_nivel,
        api_access,
        white_label,
        reportes_avanzados,
        multi_bodega,
        activo,
        id
      ]
    );

    // Registrar auditoría
    const usuario = (req as any).usuario;
    if (usuario && usuario.id) {
      await connection.query(
        `INSERT INTO auditoria_logs (
          usuario_id, accion, tabla_afectada, registro_id, fecha
        ) VALUES (?, ?, ?, ?, NOW())`,
        [usuario.id, 'UPDATE', 'planes', id]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Plan actualizado exitosamente'
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Error al actualizar plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar plan'
    });
  } finally {
    connection.release();
  }
};

/**
 * Eliminar plan
 */
export const deletePlan = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;

    // Verificar si hay empresas usando este plan
    const [empresas] = await connection.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM empresas WHERE plan_id = ?',
      [id]
    );

    if (empresas[0].total > 0) {
      res.status(400).json({
        success: false,
        message: 'No se puede eliminar el plan porque hay empresas asociadas'
      });
      return;
    }

    await connection.beginTransaction();

    // Eliminar plan
    await connection.query('DELETE FROM planes WHERE id = ?', [id]);

    // Registrar auditoría
    const usuario = (req as any).usuario;
    if (usuario && usuario.id) {
      await connection.query(
        `INSERT INTO auditoria_logs (
          usuario_id, accion, tabla_afectada, registro_id, fecha
        ) VALUES (?, ?, ?, ?, NOW())`,
        [usuario.id, 'DELETE', 'planes', id]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Plan eliminado exitosamente'
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Error al eliminar plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar plan'
    });
  } finally {
    connection.release();
  }
};

/**
 * Obtener todas las licencias
 */
export const getLicencias = async (req: Request, res: Response): Promise<void> => {
  try {
    const [licencias] = await pool.query<RowDataPacket[]>(
      `SELECT 
        l.id,
        l.empresa_id,
        e.nombre as empresa_nombre,
        l.plan_id,
        p.nombre as plan_nombre,
        l.fecha_inicio,
        l.fecha_fin,
        l.estado,
        l.created_at,
        l.updated_at,
        DATEDIFF(l.fecha_fin, CURDATE()) as dias_restantes
      FROM licencias l
      INNER JOIN empresas e ON l.empresa_id = e.id
      INNER JOIN planes p ON l.plan_id = p.id
      ORDER BY l.fecha_fin ASC`
    );

    res.json({
      success: true,
      data: licencias
    });
  } catch (error) {
    logger.error('Error al obtener licencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener licencias'
    });
  }
};

/**
 * Obtener licencia por ID
 */
export const getLicenciaById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [licencias] = await pool.query<RowDataPacket[]>(
      `SELECT 
        l.*,
        e.nombre as empresa_nombre,
        p.nombre as plan_nombre
      FROM licencias l
      INNER JOIN empresas e ON l.empresa_id = e.id
      INNER JOIN planes p ON l.plan_id = p.id
      WHERE l.id = ?`,
      [id]
    );

    if (licencias.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Licencia no encontrada'
      });
      return;
    }

    res.json({
      success: true,
      data: licencias[0]
    });
  } catch (error) {
    logger.error('Error al obtener licencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener licencia'
    });
  }
};

/**
 * Crear nueva licencia
 */
export const createLicencia = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    const {
      empresa_id,
      plan_id,
      fecha_inicio,
      fecha_fin
    } = req.body;

    await connection.beginTransaction();

    // Insertar licencia
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO licencias (
        empresa_id, plan_id, fecha_inicio, fecha_fin, estado
      ) VALUES (?, ?, ?, ?, 'activa')`,
      [empresa_id, plan_id, fecha_inicio, fecha_fin]
    );

    const licenciaId = result.insertId;

    // Registrar auditoría
    const usuario = (req as any).usuario;
    if (usuario && usuario.id) {
      await connection.query(
        `INSERT INTO auditoria_logs (
          usuario_id, accion, tabla_afectada, registro_id, fecha
        ) VALUES (?, ?, ?, ?, NOW())`,
        [usuario.id, 'CREATE', 'licencias', licenciaId]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Licencia creada exitosamente',
      data: { id: licenciaId }
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Error al crear licencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear licencia'
    });
  } finally {
    connection.release();
  }
};

/**
 * Actualizar licencia
 */
export const updateLicencia = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin, estado } = req.body;

    await connection.beginTransaction();

    await connection.query(
      `UPDATE licencias SET
        fecha_inicio = ?,
        fecha_fin = ?,
        estado = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [fecha_inicio, fecha_fin, estado, id]
    );

    // Registrar auditoría
    const usuario = (req as any).usuario;
    if (usuario && usuario.id) {
      await connection.query(
        `INSERT INTO auditoria_logs (
          usuario_id, accion, tabla_afectada, registro_id, fecha
        ) VALUES (?, ?, ?, ?, NOW())`,
        [usuario.id, 'UPDATE', 'licencias', id]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Licencia actualizada exitosamente'
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Error al actualizar licencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar licencia'
    });
  } finally {
    connection.release();
  }
};

/**
 * Eliminar licencia
 */
export const deleteLicencia = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;

    await connection.beginTransaction();

    await connection.query('DELETE FROM licencias WHERE id = ?', [id]);

    // Registrar auditoría
    const usuario = (req as any).usuario;
    if (usuario && usuario.id) {
      await connection.query(
        `INSERT INTO auditoria_logs (
          usuario_id, accion, tabla_afectada, registro_id, fecha
        ) VALUES (?, ?, ?, ?, NOW())`,
        [usuario.id, 'DELETE', 'licencias', id]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Licencia eliminada exitosamente'
    });
  } catch (error) {
    await connection.rollback();
    logger.error('Error al eliminar licencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar licencia'
    });
  } finally {
    connection.release();
  }
};
