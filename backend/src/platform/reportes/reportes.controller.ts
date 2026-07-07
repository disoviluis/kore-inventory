/**
 * =============================================
 * KORE INVENTORY - REPORTES CONTROLLER
 * Analytics & Reportes Dinámicos
 * =============================================
 */

import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import logger from '../../shared/logger';

// ─────────────────────────────────────────────
// DASHBOARD KPIs
// ─────────────────────────────────────────────
export const getDashboardKPIs = async (req: Request, res: Response) => {
    try {
        const { empresaId, fechaInicio, fechaFin } = req.query;
        if (!empresaId) return errorResponse(res, 'empresaId requerido', 400);

        const fi = fechaInicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const ff = fechaFin || new Date().toISOString().split('T')[0];

        // Ventas del período actual
        const [ventasActual]: any = await query(`
            SELECT 
                COUNT(*) as total_transacciones,
                COALESCE(SUM(total), 0) as total_ventas,
                COALESCE(SUM(ganancia_bruta), 0) as ganancia_bruta,
                COALESCE(AVG(total), 0) as ticket_promedio
            FROM ventas
            WHERE empresa_id = ? AND estado = 'completada'
            AND DATE(fecha_venta) BETWEEN ? AND ?
        `, [empresaId, fi, ff]);

        // Período anterior (misma duración)
        const dias = Math.ceil((new Date(ff as string).getTime() - new Date(fi as string).getTime()) / 86400000) + 1;
        const fiAnterior = new Date(new Date(fi as string).getTime() - dias * 86400000).toISOString().split('T')[0];
        const ffAnterior = new Date(new Date(fi as string).getTime() - 86400000).toISOString().split('T')[0];

        const [ventasAnterior]: any = await query(`
            SELECT COALESCE(SUM(total), 0) as total_ventas, COUNT(*) as total_transacciones
            FROM ventas
            WHERE empresa_id = ? AND estado = 'completada'
            AND DATE(fecha_venta) BETWEEN ? AND ?
        `, [empresaId, fiAnterior, ffAnterior]);

        // Productos con stock bajo
        const [stockBajo]: any = await query(`
            SELECT COUNT(*) as total FROM productos
            WHERE empresa_id = ? AND maneja_inventario = 1 AND activo = 1
            AND stock_actual <= COALESCE(stock_minimo, 0)
        `, [empresaId]);

        // Total clientes activos con compras en el período
        const [clientesActivos]: any = await query(`
            SELECT COUNT(DISTINCT cliente_id) as total
            FROM ventas
            WHERE empresa_id = ? AND estado = 'completada'
            AND DATE(fecha_venta) BETWEEN ? AND ?
            AND cliente_id IS NOT NULL
        `, [empresaId, fi, ff]);

        // Compras del período
        const [comprasData]: any = await query(`
            SELECT COALESCE(SUM(total), 0) as total_compras
            FROM compras
            WHERE empresa_id = ? AND estado = 'recibida'
            AND DATE(fecha_compra) BETWEEN ? AND ?
        `, [empresaId, fi, ff]);

        const ventasActualTotal = parseFloat(ventasActual.total_ventas) || 0;
        const ventasAnteriorTotal = parseFloat(ventasAnterior.total_ventas) || 0;
        const variacionVentas = ventasAnteriorTotal > 0
            ? ((ventasActualTotal - ventasAnteriorTotal) / ventasAnteriorTotal * 100).toFixed(1)
            : ventasActualTotal > 0 ? '100.0' : '0.0';

        const txActual = parseInt(ventasActual.total_transacciones) || 0;
        const txAnterior = parseInt(ventasAnterior.total_transacciones) || 0;
        const variacionTx = txAnterior > 0
            ? ((txActual - txAnterior) / txAnterior * 100).toFixed(1)
            : txActual > 0 ? '100.0' : '0.0';

        return successResponse(res, 'KPIs obtenidos', {
            periodo: { fechaInicio: fi, fechaFin: ff, dias },
            ventas: {
                total: ventasActualTotal,
                transacciones: txActual,
                ticket_promedio: parseFloat(ventasActual.ticket_promedio) || 0,
                ganancia_bruta: parseFloat(ventasActual.ganancia_bruta) || 0,
                variacion_ventas: parseFloat(variacionVentas),
                variacion_transacciones: parseFloat(variacionTx),
            },
            inventario: {
                productos_stock_bajo: parseInt(stockBajo.total) || 0,
            },
            clientes: {
                activos_periodo: parseInt(clientesActivos.total) || 0,
            },
            compras: {
                total: parseFloat(comprasData.total_compras) || 0,
            }
        });
    } catch (error: any) {
        logger.error('Error en getDashboardKPIs:', error);
        return errorResponse(res, 'Error al obtener KPIs', 500);
    }
};

// ─────────────────────────────────────────────
// VENTAS POR TIEMPO (línea de tendencia)
// ─────────────────────────────────────────────
export const getVentasPorTiempo = async (req: Request, res: Response) => {
    try {
        const { empresaId, fechaInicio, fechaFin, agrupar = 'dia' } = req.query;
        if (!empresaId) return errorResponse(res, 'empresaId requerido', 400);

        const fi = fechaInicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const ff = fechaFin || new Date().toISOString().split('T')[0];

        let dateFormat = '%Y-%m-%d';
        if (agrupar === 'semana') dateFormat = '%x-W%v';
        if (agrupar === 'mes') dateFormat = '%Y-%m';

        const datos = await query(`
            SELECT 
                DATE_FORMAT(fecha_venta, ?) as periodo,
                COUNT(*) as transacciones,
                COALESCE(SUM(total), 0) as total_ventas,
                COALESCE(SUM(ganancia_bruta), 0) as ganancia,
                COALESCE(AVG(total), 0) as ticket_promedio
            FROM ventas
            WHERE empresa_id = ? AND estado = 'completada'
            AND DATE(fecha_venta) BETWEEN ? AND ?
            GROUP BY periodo
            ORDER BY MIN(fecha_venta)
        `, [dateFormat, empresaId, fi, ff]);

        return successResponse(res, 'Ventas por tiempo', datos);
    } catch (error: any) {
        logger.error('Error en getVentasPorTiempo:', error);
        return errorResponse(res, 'Error al obtener ventas por tiempo', 500);
    }
};

// ─────────────────────────────────────────────
// TOP VENDEDORES
// ─────────────────────────────────────────────
export const getTopVendedores = async (req: Request, res: Response) => {
    try {
        const { empresaId, fechaInicio, fechaFin, limite = 10 } = req.query;
        if (!empresaId) return errorResponse(res, 'empresaId requerido', 400);

        const fi = fechaInicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const ff = fechaFin || new Date().toISOString().split('T')[0];

        const datos = await query(`
            SELECT 
                u.id,
                CONCAT(u.nombre, ' ', COALESCE(u.apellido,'')) as vendedor,
                COUNT(v.id) as transacciones,
                COALESCE(SUM(v.total), 0) as total_ventas,
                COALESCE(SUM(v.ganancia_bruta), 0) as ganancia,
                COALESCE(AVG(v.total), 0) as ticket_promedio,
                COALESCE(SUM(v.ganancia_bruta) / NULLIF(SUM(v.total), 0) * 100, 0) as margen_pct
            FROM ventas v
            JOIN usuarios u ON v.usuario_id = u.id
            WHERE v.empresa_id = ? AND v.estado = 'completada'
            AND DATE(v.fecha_venta) BETWEEN ? AND ?
            GROUP BY u.id, u.nombre, u.apellido
            ORDER BY total_ventas DESC
            LIMIT ?
        `, [empresaId, fi, ff, parseInt(limite as string)]);

        return successResponse(res, 'Top vendedores', datos);
    } catch (error: any) {
        logger.error('Error en getTopVendedores:', error);
        return errorResponse(res, 'Error al obtener top vendedores', 500);
    }
};

// ─────────────────────────────────────────────
// TOP PRODUCTOS
// ─────────────────────────────────────────────
export const getTopProductos = async (req: Request, res: Response) => {
    try {
        const { empresaId, fechaInicio, fechaFin, limite = 10, orden = 'ventas' } = req.query;
        if (!empresaId) return errorResponse(res, 'empresaId requerido', 400);

        const fi = fechaInicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const ff = fechaFin || new Date().toISOString().split('T')[0];

        const orderCol = orden === 'ganancia' ? 'ganancia DESC' : orden === 'cantidad' ? 'cantidad_vendida DESC' : 'total_ventas DESC';

        const datos = await query(`
            SELECT 
                p.id,
                p.nombre as producto,
                p.sku,
                COALESCE(c.nombre, 'Sin categoría') as categoria,
                SUM(vd.cantidad) as cantidad_vendida,
                COALESCE(SUM(vd.subtotal), 0) as total_ventas,
                COALESCE(SUM(vd.subtotal - (vd.cantidad * p.precio_compra)), 0) as ganancia,
                COALESCE(SUM(vd.subtotal - (vd.cantidad * p.precio_compra)) / NULLIF(SUM(vd.subtotal), 0) * 100, 0) as margen_pct
            FROM ventas_detalle vd
            JOIN productos p ON vd.producto_id = p.id
            JOIN ventas v ON vd.venta_id = v.id
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE v.empresa_id = ? AND v.estado = 'completada'
            AND DATE(v.fecha_venta) BETWEEN ? AND ?
            GROUP BY p.id, p.nombre, p.sku, c.nombre
            ORDER BY ${orderCol}
            LIMIT ?
        `, [empresaId, fi, ff, parseInt(limite as string)]);

        return successResponse(res, 'Top productos', datos);
    } catch (error: any) {
        logger.error('Error en getTopProductos:', error);
        return errorResponse(res, 'Error al obtener top productos', 500);
    }
};

// ─────────────────────────────────────────────
// ANÁLISIS POR BODEGA / PUNTO DE VENTA
// ─────────────────────────────────────────────
export const getAnalisisBodegas = async (req: Request, res: Response) => {
    try {
        const { empresaId, fechaInicio, fechaFin } = req.query;
        if (!empresaId) return errorResponse(res, 'empresaId requerido', 400);

        const fi = fechaInicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const ff = fechaFin || new Date().toISOString().split('T')[0];

        // Ventas por bodega/caja
        const porBodega = await query(`
            SELECT 
                COALESCE(v.caja_id, 0) as caja_id,
                COALESCE(ca.nombre, 'Sin caja') as caja_nombre,
                COUNT(v.id) as transacciones,
                COALESCE(SUM(v.total), 0) as total_ventas,
                COALESCE(SUM(v.ganancia_bruta), 0) as ganancia,
                COALESCE(AVG(v.total), 0) as ticket_promedio,
                COALESCE(SUM(v.ganancia_bruta) / NULLIF(SUM(v.total), 0) * 100, 0) as margen_pct
            FROM ventas v
            LEFT JOIN cajas ca ON v.caja_id = ca.id
            WHERE v.empresa_id = ? AND v.estado = 'completada'
            AND DATE(v.fecha_venta) BETWEEN ? AND ?
            GROUP BY v.caja_id, ca.nombre
            ORDER BY total_ventas DESC
        `, [empresaId, fi, ff]);

        // Stock por bodega
        const stockBodegas = await query(`
            SELECT 
                b.id,
                b.nombre,
                b.es_principal,
                COUNT(pb.producto_id) as total_productos,
                COALESCE(SUM(pb.stock_actual), 0) as stock_total,
                COALESCE(SUM(pb.stock_actual * p.precio_compra), 0) as valor_inventario
            FROM bodegas b
            LEFT JOIN productos_bodegas pb ON b.id = pb.bodega_id
            LEFT JOIN productos p ON pb.producto_id = p.id
            WHERE b.empresa_id = ? AND b.estado = 'activa'
            GROUP BY b.id, b.nombre, b.es_principal
            ORDER BY b.es_principal DESC, stock_total DESC
        `, [empresaId]);

        return successResponse(res, 'Análisis bodegas', { ventas_por_caja: porBodega, stock_bodegas: stockBodegas });
    } catch (error: any) {
        logger.error('Error en getAnalisisBodegas:', error);
        return errorResponse(res, 'Error al obtener análisis bodegas', 500);
    }
};

// ─────────────────────────────────────────────
// VENTAS POR CATEGORÍA
// ─────────────────────────────────────────────
export const getVentasCategorias = async (req: Request, res: Response) => {
    try {
        const { empresaId, fechaInicio, fechaFin } = req.query;
        if (!empresaId) return errorResponse(res, 'empresaId requerido', 400);

        const fi = fechaInicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const ff = fechaFin || new Date().toISOString().split('T')[0];

        const datos = await query(`
            SELECT 
                COALESCE(c.nombre, 'Sin categoría') as categoria,
                SUM(vd.cantidad) as cantidad_vendida,
                COALESCE(SUM(vd.subtotal), 0) as total_ventas,
                COALESCE(SUM(vd.subtotal - (vd.cantidad * p.precio_compra)), 0) as ganancia,
                COUNT(DISTINCT p.id) as productos_distintos
            FROM ventas_detalle vd
            JOIN productos p ON vd.producto_id = p.id
            JOIN ventas v ON vd.venta_id = v.id
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE v.empresa_id = ? AND v.estado = 'completada'
            AND DATE(v.fecha_venta) BETWEEN ? AND ?
            GROUP BY c.nombre
            ORDER BY total_ventas DESC
        `, [empresaId, fi, ff]);

        return successResponse(res, 'Ventas por categoría', datos);
    } catch (error: any) {
        logger.error('Error en getVentasCategorias:', error);
        return errorResponse(res, 'Error al obtener ventas por categoría', 500);
    }
};

// ─────────────────────────────────────────────
// INVENTARIO EN RIESGO (stock bajo + sin movimiento)
// ─────────────────────────────────────────────
export const getInventarioRiesgo = async (req: Request, res: Response) => {
    try {
        const { empresaId } = req.query;
        if (!empresaId) return errorResponse(res, 'empresaId requerido', 400);

        // Stock bajo
        const stockBajo = await query(`
            SELECT p.id, p.nombre, p.sku, p.stock_actual, p.stock_minimo,
                   COALESCE(c.nombre, 'Sin cat.') as categoria,
                   p.precio_compra,
                   (p.stock_actual * p.precio_compra) as valor_en_riesgo
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.empresa_id = ? AND p.maneja_inventario = 1 AND p.activo = 1
            AND p.stock_actual <= COALESCE(p.stock_minimo, 0)
            ORDER BY p.stock_actual ASC
            LIMIT 20
        `, [empresaId]);

        // Sin movimiento en últimos 30 días
        const sinMovimiento = await query(`
            SELECT p.id, p.nombre, p.sku, p.stock_actual,
                   COALESCE(c.nombre, 'Sin cat.') as categoria,
                   (p.stock_actual * p.precio_compra) as capital_inmovilizado,
                   MAX(im.fecha) as ultimo_movimiento
            FROM productos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN inventario_movimientos im ON p.id = im.producto_id
            WHERE p.empresa_id = ? AND p.maneja_inventario = 1 AND p.activo = 1
            AND p.stock_actual > 0
            GROUP BY p.id, p.nombre, p.sku, p.stock_actual, c.nombre, p.precio_compra
            HAVING ultimo_movimiento IS NULL OR ultimo_movimiento < DATE_SUB(NOW(), INTERVAL 30 DAY)
            ORDER BY capital_inmovilizado DESC
            LIMIT 20
        `, [empresaId]);

        return successResponse(res, 'Inventario en riesgo', { stock_bajo: stockBajo, sin_movimiento: sinMovimiento });
    } catch (error: any) {
        logger.error('Error en getInventarioRiesgo:', error);
        return errorResponse(res, 'Error al obtener inventario en riesgo', 500);
    }
};

// ─────────────────────────────────────────────
// REPORTES GUARDADOS (CRUD)
// ─────────────────────────────────────────────
export const getReportesGuardados = async (req: Request, res: Response) => {
    try {
        const { empresaId } = req.query;
        if (!empresaId) return errorResponse(res, 'empresaId requerido', 400);

        const datos = await query(`
            SELECT rg.*, CONCAT(u.nombre, ' ', COALESCE(u.apellido,'')) as creado_por
            FROM reportes_guardados rg
            JOIN usuarios u ON rg.usuario_id = u.id
            WHERE rg.empresa_id = ? AND rg.activo = 1
            ORDER BY rg.updated_at DESC
        `, [empresaId]);

        return successResponse(res, 'Reportes guardados', datos);
    } catch (error: any) {
        logger.error('Error en getReportesGuardados:', error);
        return errorResponse(res, 'Error al obtener reportes guardados', 500);
    }
};

export const crearReporteGuardado = async (req: Request, res: Response) => {
    try {
        const { empresaId, usuarioId, nombre, descripcion, tipo, configuracion, esPublico } = req.body;
        if (!empresaId || !usuarioId || !nombre || !configuracion) {
            return errorResponse(res, 'Datos requeridos: empresaId, usuarioId, nombre, configuracion', 400);
        }

        const result: any = await query(`
            INSERT INTO reportes_guardados (empresa_id, usuario_id, nombre, descripcion, tipo, configuracion, es_publico)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [empresaId, usuarioId, nombre, descripcion || null, tipo || 'personalizado',
            JSON.stringify(configuracion), esPublico ? 1 : 0]);

        return successResponse(res, 'Reporte guardado exitosamente', { id: result.insertId }, 201);
    } catch (error: any) {
        logger.error('Error en crearReporteGuardado:', error);
        return errorResponse(res, 'Error al guardar reporte', 500);
    }
};

export const eliminarReporteGuardado = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { empresaId, usuarioId } = req.body;

        const [reporte]: any = await query(
            'SELECT * FROM reportes_guardados WHERE id = ? AND empresa_id = ?',
            [id, empresaId]
        );
        if (!reporte) return errorResponse(res, 'Reporte no encontrado', 404);

        await query('UPDATE reportes_guardados SET activo = 0 WHERE id = ?', [id]);

        return successResponse(res, 'Reporte eliminado', null);
    } catch (error: any) {
        logger.error('Error en eliminarReporteGuardado:', error);
        return errorResponse(res, 'Error al eliminar reporte', 500);
    }
};
