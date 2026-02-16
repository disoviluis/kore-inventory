import { Request, Response } from 'express';
import pool from '../../shared/database';
import logger from '../../shared/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * ========================================
 * MÓDULO: SUPER ADMIN - GESTIÓN DE EMPRESAS
 * ========================================
 * CRUD completo de empresas, asignación de planes, licencias
 */

interface EmpresaDetalle extends RowDataPacket {
  id: number;
  nombre: string;
  nit: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  pais: string;
  regimen_tributario: string;
  tipo_contribuyente: string;
  estado: string;
  plan_id: number;
  plan_nombre: string;
  fecha_inicio_trial: Date;
  fecha_fin_trial: Date;
  configuracion: any;
  created_at: Date;
}

/**
 * GET /api/super-admin/empresas
 * Lista todas las empresas con filtros
 */
export const getEmpresas = async (req: Request, res: Response) => {
  try {
    const { estado, plan_id, search, limit = 50, offset = 0 } = req.query;

    let whereConditions: string[] = [];
    let params: any[] = [];

    if (estado) {
      whereConditions.push('e.estado = ?');
      params.push(estado);
    }

    if (plan_id) {
      whereConditions.push('e.plan_id = ?');
      params.push(plan_id);
    }

    if (search) {
      whereConditions.push('(e.nombre LIKE ? OR e.nit LIKE ? OR e.email LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const query = `
      SELECT 
        e.*,
        p.nombre as plan_nombre,
        p.precio_mensual,
        (SELECT COUNT(*) FROM usuario_empresa ue 
         INNER JOIN usuarios u ON ue.usuario_id = u.id 
         WHERE ue.empresa_id = e.id AND u.activo = 1) as usuarios_activos,
        (SELECT COUNT(*) FROM productos pr WHERE pr.empresa_id = e.id) as total_productos,
        (SELECT COUNT(*) FROM ventas v WHERE v.empresa_id = e.id) as total_ventas
      FROM empresas e
      LEFT JOIN planes p ON e.plan_id = p.id
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(Number(limit), Number(offset));

    const [empresas] = await pool.query<EmpresaDetalle[]>(query, params);

    // Contar total
    const countQuery = `SELECT COUNT(*) as total FROM empresas e ${whereClause}`;
    const [countResult] = await pool.query<RowDataPacket[]>(
      countQuery, 
      params.slice(0, -2)
    );

    res.json({
      success: true,
      data: empresas,
      pagination: {
        total: countResult[0].total,
        limit: Number(limit),
        offset: Number(offset)
      }
    });

  } catch (error: any) {
    logger.error('Error al obtener empresas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener empresas',
      error: error.message
    });
  }
};

/**
 * GET /api/super-admin/empresas/:id
 * Obtiene detalle completo de una empresa
 */
export const getEmpresaById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [empresas] = await pool.query<EmpresaDetalle[]>(`
      SELECT 
        e.*,
        p.nombre as plan_nombre,
        p.precio_mensual,
        p.precio_anual,
        l.id as licencia_id,
        l.estado as licencia_estado,
        l.fecha_inicio as licencia_inicio,
        l.fecha_fin as licencia_fin,
        l.tipo_facturacion,
        l.auto_renovacion,
        DATEDIFF(l.fecha_fin, CURDATE()) as dias_restantes
      FROM empresas e
      LEFT JOIN planes p ON e.plan_id = p.id
      LEFT JOIN licencias l ON e.id = l.empresa_id AND l.estado = 'activa'
      WHERE e.id = ?
    `, [id]);

    if (empresas.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Empresa no encontrada'
      });
    }

    // Obtener usuarios de la empresa
    const [usuarios] = await pool.query<RowDataPacket[]>(`
      SELECT 
        u.id,
        u.nombre,
        u.apellido,
        u.email,
        u.tipo_usuario,
        u.activo,
        u.ultimo_login,
        r.nombre as rol_nombre
      FROM usuarios u
      INNER JOIN usuario_empresa ue ON u.id = ue.usuario_id
      LEFT JOIN usuario_rol ur ON u.id = ur.usuario_id AND ur.empresa_id = ?
      LEFT JOIN roles r ON ur.rol_id = r.id
      WHERE ue.empresa_id = ?
    `, [id, id]);

    return res.json({
      success: true,
      data: {
        ...empresas[0],
        usuarios
      }
    });

  } catch (error: any) {
    logger.error('Error al obtener detalle de empresa:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener detalle de empresa',
      error: error.message
    });
  }
};

/**
 * POST /api/super-admin/empresas
 * Crea una nueva empresa con licencia
 */
export const createEmpresa = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const {
      nombre,
      nit,
      email,
      telefono,
      direccion,
      ciudad,
      pais = 'Colombia',
      regimen_tributario,
      tipo_contribuyente,
      plan_id,
      tipo_facturacion = 'mensual',
      dias_trial = 15,
      auto_renovacion = true
    } = req.body;

    // Validar plan
    const [planes] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM planes WHERE id = ? AND activo = 1',
      [plan_id]
    );

    if (planes.length === 0) {
      throw new Error('Plan no válido');
    }

    const plan = planes[0];

    // Crear empresa
    const [result] = await connection.query<ResultSetHeader>(`
      INSERT INTO empresas (
        nombre, nit, email, telefono, direccion, ciudad, pais,
        regimen_tributario, tipo_contribuyente, estado, plan_id,
        fecha_inicio_trial, fecha_fin_trial
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY))
    `, [
      nombre, nit, email, telefono, direccion, ciudad, pais,
      regimen_tributario, tipo_contribuyente,
      dias_trial > 0 ? 'trial' : 'activa',
      plan_id,
      dias_trial
    ]);

    const empresaId = result.insertId;

    // Crear licencia
    const fechaInicio = new Date();
    const fechaFin = new Date();
    
    if (dias_trial > 0) {
      fechaFin.setDate(fechaFin.getDate() + dias_trial);
    } else {
      if (tipo_facturacion === 'mensual') {
        fechaFin.setMonth(fechaFin.getMonth() + 1);
      } else {
        fechaFin.setFullYear(fechaFin.getFullYear() + 1);
      }
    }

    await connection.query(`
      INSERT INTO licencias (
        empresa_id, plan_id, estado, fecha_inicio, fecha_fin,
        tipo_facturacion, auto_renovacion,
        limite_usuarios, limite_productos, limite_facturas_mes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      empresaId,
      plan_id,
      dias_trial > 0 ? 'trial' : 'activa',
      fechaInicio,
      fechaFin,
      tipo_facturacion,
      auto_renovacion ? 1 : 0,
      plan.max_usuarios_por_empresa,
      plan.max_productos,
      plan.max_facturas_mes
    ]);

    // TODO: Crear configuraciones por defecto cuando la tabla exista
    // const configuracionesDefault = [
    //   ['moneda_simbolo', '$', 'texto', 'general', 'Símbolo de la moneda'],
    //   ['moneda_codigo', 'COP', 'texto', 'general', 'Código de moneda ISO'],
    //   ['formato_fecha', 'dd/mm/yyyy', 'texto', 'general', 'Formato de fecha'],
    //   ['requiere_autorizacion_descuentos', '1', 'boolean', 'ventas', 'Requiere autorización para descuentos'],
    //   ['maximo_descuento_sin_autorizacion', '5', 'numero', 'ventas', 'Máximo descuento sin autorización (%)'],
    //   ['permite_ventas_credito', '1', 'boolean', 'ventas', 'Permite ventas a crédito'],
    //   ['dias_credito_default', '30', 'numero', 'ventas', 'Días de crédito por defecto']
    // ];

    // for (const [clave, valor, tipo, categoria, descripcion] of configuracionesDefault) {
    //   await connection.query(`
    //     INSERT INTO empresa_configuracion (empresa_id, clave, valor, tipo, categoria, descripcion)
    //     VALUES (?, ?, ?, ?, ?, ?)
    //   `, [empresaId, clave, valor, tipo, categoria, descripcion]);
    // }

    // Auditoría
    await connection.query(`
      INSERT INTO auditoria_logs (
        usuario_id, accion, tabla, registro_id, descripcion
      ) VALUES (?, 'crear', 'empresas', ?, ?)
    `, [req.body.usuario_id || null, empresaId, `Empresa creada: ${nombre}`]);

    await connection.commit();

    logger.info(`Empresa creada exitosamente: ${nombre} (ID: ${empresaId})`);

    res.status(201).json({
      success: true,
      message: 'Empresa creada exitosamente',
      data: {
        id: empresaId,
        nombre,
        estado: dias_trial > 0 ? 'trial' : 'activa'
      }
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al crear empresa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear empresa',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * PUT /api/super-admin/empresas/:id
 * Actualiza datos de una empresa
 */
export const updateEmpresa = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      nit,
      email,
      telefono,
      direccion,
      ciudad,
      pais,
      regimen_tributario,
      tipo_contribuyente,
      estado,
      plan_id
    } = req.body;

    // Verificar si la empresa existe
    const [empresas] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM empresas WHERE id = ?',
      [id]
    );

    if (empresas.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Empresa no encontrada'
      });
    }

    // Actualizar empresa
    await pool.query(`
      UPDATE empresas SET
        nombre = ?,
        nit = ?,
        email = ?,
        telefono = ?,
        direccion = ?,
        ciudad = ?,
        pais = ?,
        regimen_tributario = ?,
        tipo_contribuyente = ?,
        estado = ?,
        plan_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      nombre, nit, email, telefono, direccion, ciudad, pais,
      regimen_tributario, tipo_contribuyente, estado, plan_id, id
    ]);

    // Auditoría
    await pool.query(`
      INSERT INTO auditoria_logs (
        usuario_id, accion, tabla, registro_id, descripcion, empresa_id
      ) VALUES (?, 'actualizar', 'empresas', ?, ?, ?)
    `, [req.body.usuario_id || null, id, `Empresa actualizada: ${nombre}`, id]);

    logger.info(`Empresa actualizada: ${nombre} (ID: ${id})`);

    return res.json({
      success: true,
      message: 'Empresa actualizada exitosamente'
    });

  } catch (error: any) {
    logger.error('Error al actualizar empresa:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar empresa',
      error: error.message
    });
  }
};

/**
 * PUT /api/super-admin/empresas/:id/estado
 * Cambia el estado de una empresa (activar, suspender, cancelar)
 */
export const cambiarEstadoEmpresa = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { estado, motivo } = req.body;

    const estadosValidos = ['trial', 'activa', 'suspendida', 'cancelada'];
    if (!estadosValidos.includes(estado)) {
      throw new Error('Estado no válido');
    }

    // Actualizar empresa
    await connection.query(
      'UPDATE empresas SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [estado, id]
    );

    // Actualizar licencia si se suspende o cancela
    if (estado === 'suspendida' || estado === 'cancelada') {
      await connection.query(
        'UPDATE licencias SET estado = ? WHERE empresa_id = ? AND estado = "activa"',
        [estado, id]
      );
    }

    // Auditoría
    await connection.query(`
      INSERT INTO auditoria_logs (
        usuario_id, accion, tabla, registro_id, descripcion, empresa_id
      ) VALUES (?, 'cambiar_estado', 'empresas', ?, ?, ?)
    `, [
      req.body.usuario_id || null,
      id,
      `Estado cambiado a ${estado}. Motivo: ${motivo || 'N/A'}`,
      id
    ]);

    await connection.commit();

    logger.info(`Estado de empresa ${id} cambiado a: ${estado}`);

    res.json({
      success: true,
      message: `Empresa ${estado === 'activa' ? 'activada' : estado === 'suspendida' ? 'suspendida' : 'cancelada'} exitosamente`
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al cambiar estado de empresa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado de empresa',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * DELETE /api/super-admin/empresas/:id
 * Elimina una empresa (solo si no tiene actividad)
 */
export const deleteEmpresa = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // Verificar si tiene actividad
    const [ventas] = await connection.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM ventas WHERE empresa_id = ?',
      [id]
    );

    if (ventas[0].total > 0) {
      throw new Error('No se puede eliminar una empresa con ventas registradas');
    }

    // Eliminar registros relacionados
    await connection.query('DELETE FROM usuario_empresa WHERE empresa_id = ?', [id]);
    await connection.query('DELETE FROM licencias WHERE empresa_id = ?', [id]);
    await connection.query('DELETE FROM empresa_configuracion WHERE empresa_id = ?', [id]);
    
    // Eliminar empresa
    await connection.query('DELETE FROM empresas WHERE id = ?', [id]);

    // Auditoría
    await connection.query(`
      INSERT INTO auditoria_logs (
        usuario_id, accion, tabla, registro_id, descripcion
      ) VALUES (?, 'eliminar', 'empresas', ?, ?)
    `, [req.body.usuario_id || null, id, `Empresa eliminada (ID: ${id})`]);

    await connection.commit();

    logger.info(`Empresa eliminada: ID ${id}`);

    res.json({
      success: true,
      message: 'Empresa eliminada exitosamente'
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al eliminar empresa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar empresa',
      error: error.message
    });
  } finally {
    connection.release();
  }
};
