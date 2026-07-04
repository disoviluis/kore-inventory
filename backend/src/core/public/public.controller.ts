import { Request, Response } from 'express';
import pool from '../../shared/database';
import logger from '../../shared/logger';
import { RowDataPacket } from 'mysql2';

/**
 * ========================================
 * MÓDULO: API PÚBLICA
 * Endpoints sin autenticación para landing page
 * ========================================
 */

/**
 * Obtener planes activos (solo datos públicos)
 * Endpoint público - NO requiere autenticación
 */
export const getPlanesPublicos = async (req: Request, res: Response): Promise<void> => {
  try {
    const [planes] = await pool.query<RowDataPacket[]>(
      `SELECT 
        id,
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
        destacado
      FROM planes
      WHERE activo = 1
      ORDER BY precio_mensual ASC`
    );

    res.json({
      success: true,
      data: planes
    });
  } catch (error) {
    logger.error('Error al obtener planes públicos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener planes'
    });
  }
};

/**
 * Obtener información básica del sistema
 * Endpoint público para landing page
 */
export const getInfoPublica = async (req: Request, res: Response): Promise<void> => {
  try {
    // Estadísticas generales públicas (sin datos sensibles)
    const [stats] = await pool.query<RowDataPacket[]>(
      `SELECT 
        COUNT(DISTINCT e.id) as total_empresas_activas,
        COUNT(DISTINCT p.id) as total_planes_disponibles
      FROM empresas e
      CROSS JOIN planes p
      WHERE e.estado = 'activa' AND p.activo = 1`
    );

    res.json({
      success: true,
      data: {
        version: '2.0.0',
        nombre_sistema: 'KORE Inventory',
        estadisticas: stats[0]
      }
    });
  } catch (error) {
    logger.error('Error al obtener info pública:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información'
    });
  }
};

export const getEmpresaPublica = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { slug } = req.params;

    const [empresas] = await pool.query<RowDataPacket[]>(
      `SELECT 
        e.id,
        e.nombre,
        e.logo_url,
        e.sitio_web,
        e.descripcion,
        e.slogan,
        e.email,
        e.telefono,
        e.direccion,
        e.ciudad,
        e.pais,
        ec.valor as pagina_valor
      FROM empresas e
      INNER JOIN empresa_configuracion ec ON ec.empresa_id = e.id AND ec.clave = 'pagina_publica'
      WHERE e.estado = 'activa'
        AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(ec.valor, '$.pagina_slug'))) = ?
      LIMIT 1`,
      [slug]
    );

    if (empresas.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Empresa pública no encontrada'
      });
    }

    const empresa = empresas[0];
    const paginaConfig = empresa.pagina_valor ? JSON.parse(empresa.pagina_valor) : null;

    if (!paginaConfig || !paginaConfig.pagina_publica_activa) {
      return res.status(404).json({
        success: false,
        message: 'Página pública no habilitada para esta empresa'
      });
    }

    const productos: any[] = [];
    if (paginaConfig.pagina_mostrar_productos) {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, nombre, descripcion, precio_venta, imagen_url, estado,
                en_promocion, precio_promocion, promocion_inicio, promocion_fin,
                CASE
                  WHEN en_promocion = 1
                    AND precio_promocion IS NOT NULL
                    AND (promocion_inicio IS NULL OR promocion_inicio <= NOW())
                    AND (promocion_fin IS NULL OR promocion_fin >= NOW())
                  THEN 1 ELSE 0
                END AS en_promocion_activa
         FROM productos
         WHERE empresa_id = ? AND estado = 'activo'
         ORDER BY en_promocion_activa DESC, nombre ASC
         LIMIT 50`,
        [empresa.id]
      );
      productos.push(...rows);
    }

    return res.json({
      success: true,
      data: {
        empresa: {
          id: empresa.id,
          nombre: empresa.nombre,
          logo_url: empresa.logo_url,
          sitio_web: empresa.sitio_web,
          descripcion: empresa.descripcion,
          slogan: empresa.slogan,
          email: empresa.email,
          telefono: empresa.telefono,
          direccion: empresa.direccion,
          ciudad: empresa.ciudad,
          pais: empresa.pais
        },
        pagina: paginaConfig,
        productos
      }
    });
  } catch (error) {
    logger.error('Error al obtener página pública:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener datos de la empresa pública'
    });
  }
};
