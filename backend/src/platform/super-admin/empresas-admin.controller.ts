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
 * POST /api/super-admin/empresas/trial
 * Crea una nueva empresa con período de prueba gratuito
 * RECOMENDADO: Usar este endpoint para nuevas empresas
 */
export const createEmpresaTrial = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const {
      nombre,
      razon_social,
      tipo_documento,
      nit,
      digito_verificacion,
      representante_legal,
      tipo_sociedad,
      matricula_mercantil,
      camara_comercio,
      fecha_matricula,
      actividad_economica,
      email,
      telefono,
      direccion,
      ciudad,
      pais = 'Colombia',
      regimen_tributario,
      tipo_contribuyente,
      plan_id = 1  // Plan Básico por defecto
    } = req.body;

    // Obtener días de trial desde configuración (default: 30)
    const [config] = await connection.query<RowDataPacket[]>(
      "SELECT valor FROM sistema_configuracion WHERE clave = 'dias_trial_default' LIMIT 1"
    );
    const diasTrial = config.length > 0 ? parseInt(config[0].valor) : 30;

    // Validar plan
    const [planes] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM planes WHERE id = ? AND activo = 1',
      [plan_id]
    );

    if (planes.length === 0) {
      throw new Error('Plan no válido');
    }

    const plan = planes[0];

    // Crear empresa en modo TRIAL
    const [result] = await connection.query<ResultSetHeader>(`
      INSERT INTO empresas (
        nombre, razon_social, tipo_documento, nit, digito_verificacion,
        representante_legal, tipo_sociedad, matricula_mercantil,
        camara_comercio, fecha_matricula, actividad_economica,
        email, telefono, direccion, ciudad, pais,
        regimen_tributario, tipo_contribuyente, estado, plan_id,
        fecha_inicio_trial, fecha_fin_trial
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'trial', ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY))
    `, [
      nombre, razon_social || null, tipo_documento || 'NIT', nit, digito_verificacion || null,
      representante_legal || null, tipo_sociedad || null, matricula_mercantil || null,
      camara_comercio || null, fecha_matricula || null, actividad_economica || null,
      email, telefono, direccion, ciudad, pais,
      regimen_tributario, tipo_contribuyente,
      plan_id,
      diasTrial
    ]);

    const empresaId = result.insertId;

    // Crear licencia de TRIAL (monto = 0)
    const fechaInicio = new Date();
    const fechaFin = new Date();
    fechaFin.setDate(fechaFin.getDate() + diasTrial);

    await connection.query(`
      INSERT INTO licencias (
        empresa_id, plan_id, estado, fecha_inicio, fecha_fin,
        tipo_facturacion, auto_renovacion, monto, moneda,
        limite_usuarios, limite_productos, limite_facturas_mes
      ) VALUES (?, ?, 'activa', ?, ?, 'mensual', 0, 0.00, 'COP', ?, ?, ?)
    `, [
      empresaId,
      plan_id,
      fechaInicio,
      fechaFin,
      plan.max_usuarios_por_empresa,
      plan.max_productos,
      plan.max_facturas_mes
    ]);

    // Registrar pago de trial (monto 0)
    await connection.query(`
      INSERT INTO pagos_licencias (
        licencia_id, empresa_id, plan_id,
        monto, moneda, tipo, estado,
        periodo_inicio, periodo_fin, fecha_pago,
        descripcion
      ) SELECT 
        id, empresa_id, plan_id,
        0.00, 'COP', 'trial_inicial', 'exitoso',
        fecha_inicio, fecha_fin, NOW(),
        CONCAT('Período de prueba gratuito de ', ?, ' días')
      FROM licencias 
      WHERE empresa_id = ? 
      ORDER BY id DESC 
      LIMIT 1
    `, [diasTrial, empresaId]);

    // Registrar evento
    await connection.query(`
      INSERT INTO licencias_eventos (empresa_id, evento, descripcion, datos)
      VALUES (?, 'trial_iniciado', ?, ?)
    `, [
      empresaId, 
      `Período de prueba de ${diasTrial} días iniciado`,
      JSON.stringify({ dias_trial: diasTrial, plan: plan.nombre })
    ]);

    // Crear categorías por defecto para la nueva empresa
    const categoriasDefault = [
      ['Electrónica', 'Productos electrónicos y tecnología', 'bi-laptop', '#3B82F6'],
      ['Ropa y Accesorios', 'Vestimenta y complementos', 'bi-bag', '#8B5CF6'],
      ['Alimentos y Bebidas', 'Productos alimenticios', 'bi-cup-straw', '#10B981'],
      ['Hogar y Decoración', 'Artículos para el hogar', 'bi-house', '#F59E0B'],
      ['Salud y Belleza', 'Productos de cuidado personal', 'bi-heart-pulse', '#EC4899'],
      ['Deportes', 'Artículos deportivos y fitness', 'bi-trophy', '#EF4444'],
      ['Libros y Papelería', 'Material de oficina y lectura', 'bi-book', '#6366F1'],
      ['Juguetes', 'Juguetes y entretenimiento', 'bi-controller', '#F97316'],
      ['Herramientas', 'Herramientas y ferretería', 'bi-tools', '#64748B'],
      ['Otros', 'Productos varios sin categoría específica', 'bi-box', '#9CA3AF']
    ];

    for (const [nombre, descripcion, icono, color] of categoriasDefault) {
      await connection.query(`
        INSERT INTO categorias (empresa_id, nombre, descripcion, icono, color, activo)
        VALUES (?, ?, ?, ?, ?, 1)
      `, [empresaId, nombre, descripcion, icono, color]);
    }

    logger.info(`${categoriasDefault.length} categorías por defecto creadas para empresa ${empresaId}`);

    // Crear bodega principal por defecto
    await connection.query(`
      INSERT INTO bodegas (
        empresa_id, codigo, nombre, tipo, es_principal, permite_ventas, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [empresaId, 'BOD-PRINCIPAL', 'Bodega Principal', 'bodega', true, true, 'activa']);

    logger.info(`Bodega principal creada para empresa ${empresaId}`);

    // Auditoría
    await connection.query(`
      INSERT INTO auditoria_logs (
        usuario_id, empresa_id, accion, modulo, tabla, registro_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [req.body.usuario_id || null, empresaId, 'crear', 'super-admin', 'empresas', empresaId]);

    await connection.commit();

    logger.info(`Empresa trial creada exitosamente: ${nombre} (ID: ${empresaId}) - ${diasTrial} días`);

    res.status(201).json({
      success: true,
      message: 'Empresa creada exitosamente con período de prueba gratuito',
      data: {
        id: empresaId,
        nombre,
        estado: 'trial',
        dias_trial: diasTrial,
        fecha_fin_trial: fechaFin
      }
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al crear empresa trial:', error);
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
 * POST /api/super-admin/empresas/:id/activar-licencia
 * Activa una licencia de pago para una empresa (después del trial)
 */
export const activarLicenciaPagada = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      plan_id,
      tipo_facturacion = 'mensual', // 'mensual' o 'anual'
      auto_renovacion = true,
      monto, // Monto del pago
      metodo_pago, // 'tarjeta', 'transferencia', etc.
      referencia_pago, // ID de transacción de la pasarela
      datos_pago // JSON con datos adicionales
    } = req.body;

    // Validar empresa
    const [empresas] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM empresas WHERE id = ?',
      [id]
    );

    if (empresas.length === 0) {
      throw new Error('Empresa no encontrada');
    }

    const empresa = empresas[0];

    // Validar plan
    const [planes] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM planes WHERE id = ? AND activo = 1',
      [plan_id]
    );

    if (planes.length === 0) {
      throw new Error('Plan no válido');
    }

    const plan = planes[0];

    // Calcular monto si no se especificó
    const montoFinal = monto || (tipo_facturacion === 'anual' ? plan.precio_anual : plan.precio_mensual);

    // Calcular fechas
    const fechaInicio = new Date();
    const fechaFin = new Date();
    
    if (tipo_facturacion === 'mensual') {
      fechaFin.setMonth(fechaFin.getMonth() + 1);
    } else {
      fechaFin.setFullYear(fechaFin.getFullYear() + 1);
    }

    // Desactivar licencias anteriores (trial)
    await connection.query(`
      UPDATE licencias
      SET estado = 'cancelada', updated_at = CURRENT_TIMESTAMP
      WHERE empresa_id = ? AND estado = 'activa'
    `, [id]);

    // Crear nueva licencia PAGADA
    const [licenciaResult] = await connection.query<ResultSetHeader>(`
      INSERT INTO licencias (
        empresa_id, plan_id, estado, fecha_inicio, fecha_fin,
        tipo_facturacion, auto_renovacion, monto, moneda,
        limite_usuarios, limite_productos, limite_facturas_mes
      ) VALUES (?, ?, 'activa', ?, ?, ?, ?, ?, 'COP', ?, ?, ?)
    `, [
      id,
      plan_id,
      fechaInicio,
      fechaFin,
      tipo_facturacion,
      auto_renovacion ? 1 : 0,
      montoFinal,
      plan.max_usuarios_por_empresa,
      plan.max_productos,
      plan.max_facturas_mes
    ]);

    const licenciaId = licenciaResult.insertId;

    // Registrar pago
    await connection.query(`
      INSERT INTO pagos_licencias (
        licencia_id, empresa_id, plan_id,
        monto, moneda, tipo, metodo_pago, estado,
        referencia_pago, datos_pago,
        periodo_inicio, periodo_fin, fecha_pago,
        descripcion
      ) VALUES (?, ?, ?, ?, 'COP', ?, ?, 'exitoso', ?, ?, ?, ?, NOW(), ?)
    `, [
      licenciaId, id, plan_id,
      montoFinal,
      tipo_facturacion === 'anual' ? 'anual' : 'mensual',
      metodo_pago || 'manual',
      referencia_pago || null,
      datos_pago ? JSON.stringify(datos_pago) : null,
      fechaInicio,
      fechaFin,
      `Licencia ${tipo_facturacion} - Plan ${plan.nombre}`
    ]);

    // Actualizar estado de la empresa a ACTIVA
    await connection.query(`
      UPDATE empresas
      SET estado = 'activa', plan_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [plan_id, id]);

    // Registrar evento
    await connection.query(`
      INSERT INTO licencias_eventos (empresa_id, licencia_id, evento, descripcion, datos)
      VALUES (?, ?, 'licencia_activada', ?, ?)
    `, [
      id,
      licenciaId,
      `Licencia ${tipo_facturacion} activada - Plan ${plan.nombre}`,
      JSON.stringify({
        plan: plan.nombre,
        tipo_facturacion,
        monto: montoFinal,
        fecha_fin: fechaFin
      })
    ]);

    // Auditoría
    await connection.query(`
      INSERT INTO auditoria_logs (
        usuario_id, empresa_id, accion, modulo, tabla, registro_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [req.body.usuario_id || null, id, 'activar_licencia', 'super-admin', 'licencias', licenciaId]);

    await connection.commit();

    logger.info(`Licencia activada para empresa ${id}: ${tipo_facturacion} - ${montoFinal}`);

    res.status(201).json({
      success: true,
      message: 'Licencia activada exitosamente',
      data: {
        licencia_id: licenciaId,
        empresa_id: id,
        plan: plan.nombre,
        tipo_facturacion,
        monto: montoFinal,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        auto_renovacion
      }
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al activar licencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al activar licencia',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * POST /api/super-admin/empresas (DEPRECATED - usar createEmpresaTrial)
 * Mantener por compatibilidad
 */
export const createEmpresa = createEmpresaTrial;

/**
 * PUT /api/super-admin/empresas/:id
 * Actualiza datos de una empresa
 */
export const updateEmpresa = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      razon_social,
      tipo_documento,
      nit,
      digito_verificacion,
      representante_legal,
      tipo_sociedad,
      matricula_mercantil,
      camara_comercio,
      fecha_matricula,
      actividad_economica,
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
        razon_social = ?,
        tipo_documento = ?,
        nit = ?,
        digito_verificacion = ?,
        representante_legal = ?,
        tipo_sociedad = ?,
        matricula_mercantil = ?,
        camara_comercio = ?,
        fecha_matricula = ?,
        actividad_economica = ?,
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
      nombre, razon_social || null, tipo_documento || 'NIT', nit, digito_verificacion || null,
      representante_legal || null, tipo_sociedad || null, matricula_mercantil || null,
      camara_comercio || null, fecha_matricula || null, actividad_economica || null,
      email, telefono, direccion, ciudad, pais,
      regimen_tributario, tipo_contribuyente, estado, plan_id, id
    ]);

    // Auditoría
    await pool.query(`
      INSERT INTO auditoria_logs (
        usuario_id, empresa_id, accion, modulo, tabla, registro_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [req.body.usuario_id || null, id, 'actualizar', 'super-admin', 'empresas', id]);

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
        usuario_id, empresa_id, accion, modulo, tabla, registro_id
      ) VALUES (?, ?, 'cambiar_estado', 'super-admin', 'empresas', ?)
    `, [
      req.body.usuario_id || null,
      id,
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

    // Eliminar registros relacionados en orden por dependencias
    // 1. Eliminar impuestos de ventas
    await connection.query('DELETE vi FROM venta_impuestos vi INNER JOIN ventas v ON vi.venta_id = v.id WHERE v.empresa_id = ?', [id]);
    
    // 2. Eliminar pagos de ventas
    await connection.query('DELETE vp FROM venta_pagos vp INNER JOIN ventas v ON vp.venta_id = v.id WHERE v.empresa_id = ?', [id]);
    
    // 3. Eliminar detalles de ventas
    await connection.query('DELETE vd FROM venta_detalle vd INNER JOIN ventas v ON vd.venta_id = v.id WHERE v.empresa_id = ?', [id]);
    
    // 4. Eliminar ventas
    await connection.query('DELETE FROM ventas WHERE empresa_id = ?', [id]);
    
    // 5. Eliminar detalles de compras
    await connection.query('DELETE cd FROM compras_detalle cd INNER JOIN compras c ON cd.compra_id = c.id WHERE c.empresa_id = ?', [id]);
    
    // 6. Eliminar compras
    await connection.query('DELETE FROM compras WHERE empresa_id = ?', [id]);
    
    // 7. Eliminar detalles de traslados
    await connection.query('DELETE td FROM traslados_detalle td INNER JOIN traslados t ON td.traslado_id = t.id WHERE t.empresa_id = ?', [id]);
    
    // 8. Eliminar traslados (incluyendo mensajeros si existe la columna)
    await connection.query('DELETE FROM traslados WHERE empresa_id = ?', [id]);
    
    // 9. Eliminar productos_bodegas (inventario por bodega)
    await connection.query('DELETE pb FROM productos_bodegas pb INNER JOIN productos p ON pb.producto_id = p.id WHERE p.empresa_id = ?', [id]);
    
    // 10. Eliminar movimientos de inventario (a través de producto_id)
    await connection.query('DELETE im FROM inventario_movimientos im INNER JOIN productos p ON im.producto_id = p.id WHERE p.empresa_id = ?', [id]);
    
    // 11. Eliminar productos
    await connection.query('DELETE FROM productos WHERE empresa_id = ?', [id]);
    
    // 12. Eliminar clientes
    await connection.query('DELETE FROM clientes WHERE empresa_id = ?', [id]);
    
    // 13. Eliminar proveedores
    await connection.query('DELETE FROM proveedores WHERE empresa_id = ?', [id]);
    
    // 14. Eliminar bodegas (incluyendo mensajeros si existe relación)
    await connection.query('DELETE FROM bodegas WHERE empresa_id = ?', [id]);
    
    // 15. Eliminar categorías
    await connection.query('DELETE FROM categorias WHERE empresa_id = ?', [id]);
    
    // 16. Eliminar configuración de facturación
    await connection.query('DELETE FROM configuracion_factura WHERE empresa_id = ?', [id]);
    
    // 17. Eliminar relaciones usuario-empresa
    await connection.query('DELETE FROM usuario_empresa WHERE empresa_id = ?', [id]);
    
    // 18. Eliminar licencias
    await connection.query('DELETE FROM licencias WHERE empresa_id = ?', [id]);
    
    // 19. Eliminar logs de auditoría de esta empresa
    await connection.query('DELETE FROM auditoria_logs WHERE empresa_id = ?', [id]);
    
    // Auditoría - ANTES de eliminar la empresa
    await connection.query(`
      INSERT INTO auditoria_logs (
        usuario_id, empresa_id, accion, modulo, tabla, registro_id
      ) VALUES (?, ?, 'eliminar', 'super-admin', 'empresas', ?)
    `, [req.body.usuario_id || null, id, id]);
    
    // 20. Eliminar empresa
    await connection.query('DELETE FROM empresas WHERE id = ?', [id]);

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
