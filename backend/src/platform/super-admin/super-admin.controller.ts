import { Request, Response } from 'express';
import pool from '../../shared/database';
import logger from '../../shared/logger';
import { RowDataPacket } from 'mysql2';

/**
 * ========================================
 * MÓDULO: SUPER ADMIN - DASHBOARD Y MÉTRICAS
 * ========================================
 * Funciones para administración global del sistema SaaS
 * Solo accesible por usuarios con tipo_usuario = 'super_admin'
 */

interface DashboardMetrics {
  empresas: {
    total: number;
    activas: number;
    en_trial: number;
    suspendidas: number;
    canceladas: number;
    nuevas_mes: number;
  };
  usuarios: {
    total: number;
    activos: number;
    super_admins: number;
    admin_empresas: number;
    usuarios_normales: number;
    nuevos_mes: number;
  };
  licencias: {
    total: number;
    activas: number;
    por_vencer: number; // Próximos 15 días
    vencidas: number;
    renovaciones_pendientes: number;
  };
  ingresos: {
    mes_actual: number;
    mes_anterior: number;
    proyeccion_anual: number;
    mrr: number; // Monthly Recurring Revenue
  };
  planes: {
    basico: number;
    profesional: number;
    enterprise: number;
  };
}

interface Empresa extends RowDataPacket {
  empresa_id: number;
  empresa_nombre: string;
  nit: string;
  email: string;
  empresa_estado: string;
  plan_nombre: string;
  precio_mensual: number;
  licencia_estado: string;
  fecha_inicio: Date;
  fecha_fin: Date;
  dias_restantes: number;
  usuarios_activos: number;
  productos_creados: number;
  empresa_creada: Date;
}

/**
 * GET /api/super-admin/dashboard
 * Obtiene métricas generales del sistema
 */
export const getDashboardMetrics = async (req: Request, res: Response) => {
  try {
    logger.info('Obteniendo métricas del dashboard Super Admin');

    const metrics: DashboardMetrics = {
      empresas: {
        total: 0,
        activas: 0,
        en_trial: 0,
        suspendidas: 0,
        canceladas: 0,
        nuevas_mes: 0
      },
      usuarios: {
        total: 0,
        activos: 0,
        super_admins: 0,
        admin_empresas: 0,
        usuarios_normales: 0,
        nuevos_mes: 0
      },
      licencias: {
        total: 0,
        activas: 0,
        por_vencer: 0,
        vencidas: 0,
        renovaciones_pendientes: 0
      },
      ingresos: {
        mes_actual: 0,
        mes_anterior: 0,
        proyeccion_anual: 0,
        mrr: 0
      },
      planes: {
        basico: 0,
        profesional: 0,
        enterprise: 0
      }
    };

    // Métricas de Empresas
    const [empresasData] = await pool.query<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN estado = 'activa' THEN 1 ELSE 0 END) as activas,
        SUM(CASE WHEN estado = 'trial' THEN 1 ELSE 0 END) as en_trial,
        SUM(CASE WHEN estado = 'suspendida' THEN 1 ELSE 0 END) as suspendidas,
        SUM(CASE WHEN estado = 'cancelada' THEN 1 ELSE 0 END) as canceladas,
        SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) THEN 1 ELSE 0 END) as nuevas_mes
      FROM empresas
    `);
    if (empresasData.length > 0) {
      metrics.empresas = empresasData[0] as any;
    }

    // Métricas de Usuarios
    const [usuariosData] = await pool.query<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN activo = 1 THEN 1 ELSE 0 END) as activos,
        SUM(CASE WHEN tipo_usuario = 'super_admin' THEN 1 ELSE 0 END) as super_admins,
        SUM(CASE WHEN tipo_usuario = 'admin_empresa' THEN 1 ELSE 0 END) as admin_empresas,
        SUM(CASE WHEN tipo_usuario = 'usuario' THEN 1 ELSE 0 END) as usuarios_normales,
        SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) THEN 1 ELSE 0 END) as nuevos_mes
      FROM usuarios
    `);
    if (usuariosData.length > 0) {
      metrics.usuarios = usuariosData[0] as any;
    }

    // Métricas de Licencias
    const [licenciasData] = await pool.query<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN estado = 'activa' THEN 1 ELSE 0 END) as activas,
        SUM(CASE WHEN estado = 'activa' AND DATEDIFF(fecha_fin, CURDATE()) <= 15 AND DATEDIFF(fecha_fin, CURDATE()) > 0 THEN 1 ELSE 0 END) as por_vencer,
        SUM(CASE WHEN estado = 'vencida' THEN 1 ELSE 0 END) as vencidas,
        SUM(CASE WHEN estado = 'activa' AND auto_renovacion = 0 AND DATEDIFF(fecha_fin, CURDATE()) <= 30 THEN 1 ELSE 0 END) as renovaciones_pendientes
      FROM licencias
    `);
    if (licenciasData.length > 0) {
      metrics.licencias = licenciasData[0] as any;
    }

    // Métricas de Ingresos (basado en licencias activas)
    const [ingresosData] = await pool.query<RowDataPacket[]>(`
      SELECT 
        SUM(CASE 
          WHEN l.tipo_facturacion = 'mensual' THEN p.precio_mensual
          WHEN l.tipo_facturacion = 'anual' THEN p.precio_anual / 12
          ELSE 0
        END) as mrr,
        SUM(CASE 
          WHEN MONTH(l.created_at) = MONTH(CURDATE()) AND YEAR(l.created_at) = YEAR(CURDATE()) THEN
            CASE 
              WHEN l.tipo_facturacion = 'mensual' THEN p.precio_mensual
              WHEN l.tipo_facturacion = 'anual' THEN p.precio_anual
              ELSE 0
            END
          ELSE 0
        END) as mes_actual,
        SUM(CASE 
          WHEN MONTH(l.created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) 
          AND YEAR(l.created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) THEN
            CASE 
              WHEN l.tipo_facturacion = 'mensual' THEN p.precio_mensual
              WHEN l.tipo_facturacion = 'anual' THEN p.precio_anual
              ELSE 0
            END
          ELSE 0
        END) as mes_anterior
      FROM licencias l
      INNER JOIN planes p ON l.plan_id = p.id
      WHERE l.estado = 'activa'
    `);
    if (ingresosData.length > 0) {
      metrics.ingresos.mrr = ingresosData[0].mrr || 0;
      metrics.ingresos.mes_actual = ingresosData[0].mes_actual || 0;
      metrics.ingresos.mes_anterior = ingresosData[0].mes_anterior || 0;
      metrics.ingresos.proyeccion_anual = metrics.ingresos.mrr * 12;
    }

    // Métricas de Planes
    const [planesData] = await pool.query<RowDataPacket[]>(`
      SELECT 
        p.nombre,
        COUNT(*) as cantidad
      FROM empresas e
      INNER JOIN planes p ON e.plan_id = p.id
      WHERE e.estado IN ('activa', 'trial')
      GROUP BY p.id, p.nombre
    `);
    planesData.forEach((row: any) => {
      const planName = row.nombre.toLowerCase();
      if (planName.includes('básico') || planName.includes('basico')) {
        metrics.planes.basico = row.cantidad;
      } else if (planName.includes('profesional')) {
        metrics.planes.profesional = row.cantidad;
      } else if (planName.includes('enterprise')) {
        metrics.planes.enterprise = row.cantidad;
      }
    });

    res.json({
      success: true,
      data: metrics
    });

  } catch (error: any) {
    logger.error('Error al obtener métricas del dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener métricas del dashboard',
      error: error.message
    });
  }
};

/**
 * GET /api/super-admin/empresas-resumen
 * Obtiene lista de empresas con información resumida
 */
export const getEmpresasResumen = async (req: Request, res: Response) => {
  try {
    logger.info('Obteniendo resumen de empresas');

    const { estado, plan_id, limit = 50, offset = 0 } = req.query;

    let whereConditions: string[] = [];
    let params: any[] = [];

    if (estado) {
      whereConditions.push('empresa_estado = ?');
      params.push(estado);
    }

    if (plan_id) {
      whereConditions.push('e.plan_id = ?');
      params.push(plan_id);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const query = `
      SELECT * FROM vista_empresas_licencias
      ${whereClause}
      ORDER BY empresa_creada DESC
      LIMIT ? OFFSET ?
    `;

    params.push(Number(limit), Number(offset));

    const [empresas] = await pool.query<Empresa[]>(query, params);

    // Contar total para paginación
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM vista_empresas_licencias
      ${whereClause}
    `;
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
        offset: Number(offset),
        hasMore: (Number(offset) + empresas.length) < countResult[0].total
      }
    });

  } catch (error: any) {
    logger.error('Error al obtener resumen de empresas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resumen de empresas',
      error: error.message
    });
  }
};

/**
 * GET /api/super-admin/actividad-reciente
 * Obtiene actividad reciente del sistema
 */
export const getActividadReciente = async (req: Request, res: Response) => {
  try {
    logger.info('Obteniendo actividad reciente del sistema');

    const { limit = 20 } = req.query;

    const [actividades] = await pool.query<RowDataPacket[]>(`
      SELECT 
        a.id,
        a.accion,
        a.tabla,
        a.registro_id,
        a.descripcion,
        a.created_at,
        u.nombre as usuario_nombre,
        u.apellido as usuario_apellido,
        u.tipo_usuario,
        e.nombre as empresa_nombre
      FROM auditoria_logs a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      LEFT JOIN empresas e ON a.empresa_id = e.id
      WHERE a.tabla IN ('empresas', 'usuarios', 'licencias', 'planes')
      ORDER BY a.created_at DESC
      LIMIT ?
    `, [Number(limit)]);

    res.json({
      success: true,
      data: actividades
    });

  } catch (error: any) {
    logger.error('Error al obtener actividad reciente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener actividad reciente',
      error: error.message
    });
  }
};
