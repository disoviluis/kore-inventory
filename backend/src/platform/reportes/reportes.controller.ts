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
                COUNT(v.id) as total_transacciones,
                COALESCE(SUM(v.total), 0) as total_ventas,
                COALESCE(SUM(vg.ganancia), 0) as ganancia_bruta,
                COALESCE(AVG(v.total), 0) as ticket_promedio
            FROM ventas v
            LEFT JOIN (
                SELECT vd.venta_id, SUM(vd.subtotal - (vd.cantidad * COALESCE(p.precio_compra, 0))) as ganancia
                FROM venta_detalle vd
                JOIN productos p ON vd.producto_id = p.id
                GROUP BY vd.venta_id
            ) vg ON v.id = vg.venta_id
            WHERE v.empresa_id = ? AND v.estado = 'pagada'
            AND DATE(v.fecha_venta) BETWEEN ? AND ?
        `, [empresaId, fi, ff]);

        // Período anterior (misma duración)
        const dias = Math.ceil((new Date(ff as string).getTime() - new Date(fi as string).getTime()) / 86400000) + 1;
        const fiAnterior = new Date(new Date(fi as string).getTime() - dias * 86400000).toISOString().split('T')[0];
        const ffAnterior = new Date(new Date(fi as string).getTime() - 86400000).toISOString().split('T')[0];

        const [ventasAnterior]: any = await query(`
            SELECT COALESCE(SUM(total), 0) as total_ventas, COUNT(*) as total_transacciones
            FROM ventas
            WHERE empresa_id = ? AND estado = 'pagada'
            AND DATE(fecha_venta) BETWEEN ? AND ?
        `, [empresaId, fiAnterior, ffAnterior]);

        // Productos con stock bajo
        const [stockBajo]: any = await query(`
            SELECT COUNT(*) as total FROM productos
            WHERE empresa_id = ? AND maneja_inventario = 1 AND estado = 'activo'
            AND stock_actual <= COALESCE(stock_minimo, 0)
        `, [empresaId]);

        // Total clientes activos con compras en el período
        const [clientesActivos]: any = await query(`
            SELECT COUNT(DISTINCT cliente_id) as total
            FROM ventas
            WHERE empresa_id = ? AND estado = 'pagada'
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
                DATE_FORMAT(v.fecha_venta, ?) as periodo,
                COUNT(v.id) as transacciones,
                COALESCE(SUM(v.total), 0) as total_ventas,
                COALESCE(SUM(vg.ganancia), 0) as ganancia,
                COALESCE(AVG(v.total), 0) as ticket_promedio
            FROM ventas v
            LEFT JOIN (
                SELECT vd.venta_id, SUM(vd.subtotal - (vd.cantidad * COALESCE(p.precio_compra, 0))) as ganancia
                FROM venta_detalle vd
                JOIN productos p ON vd.producto_id = p.id
                GROUP BY vd.venta_id
            ) vg ON v.id = vg.venta_id
            WHERE v.empresa_id = ? AND v.estado = 'pagada'
            AND DATE(v.fecha_venta) BETWEEN ? AND ?
            GROUP BY periodo
            ORDER BY MIN(v.fecha_venta)
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

        const limiteVendedores = Math.max(1, parseInt(limite as string) || 10);
        const datos = await query(`
            SELECT 
                u.id,
                CONCAT(u.nombre, ' ', COALESCE(u.apellido,'')) as vendedor,
                COUNT(v.id) as transacciones,
                COALESCE(SUM(v.total), 0) as total_ventas,
                COALESCE(SUM(vg.ganancia), 0) as ganancia,
                COALESCE(AVG(v.total), 0) as ticket_promedio,
                COALESCE(SUM(vg.ganancia) / NULLIF(SUM(v.total), 0) * 100, 0) as margen_pct
            FROM ventas v
            JOIN usuarios u ON v.vendedor_id = u.id
            LEFT JOIN (
                SELECT vd.venta_id, SUM(vd.subtotal - (vd.cantidad * COALESCE(p.precio_compra, 0))) as ganancia
                FROM venta_detalle vd
                JOIN productos p ON vd.producto_id = p.id
                GROUP BY vd.venta_id
            ) vg ON v.id = vg.venta_id
            WHERE v.empresa_id = ? AND v.estado = 'pagada'
            AND DATE(v.fecha_venta) BETWEEN ? AND ?
            GROUP BY u.id, u.nombre, u.apellido
            ORDER BY total_ventas DESC
            LIMIT ${limiteVendedores}
        `, [empresaId, fi, ff]);

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

        const limiteProductos = Math.max(1, parseInt(limite as string) || 10);
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
            FROM venta_detalle vd
            JOIN productos p ON vd.producto_id = p.id
            JOIN ventas v ON vd.venta_id = v.id
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE v.empresa_id = ? AND v.estado = 'pagada'
            AND DATE(v.fecha_venta) BETWEEN ? AND ?
            GROUP BY p.id, p.nombre, p.sku, c.nombre
            ORDER BY ${orderCol}
            LIMIT ${limiteProductos}
        `, [empresaId, fi, ff]);

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
                COALESCE(b.id, 0) as caja_id,
                COALESCE(b.nombre, 'Sin bodega') as caja_nombre,
                COUNT(v.id) as transacciones,
                COALESCE(SUM(v.total), 0) as total_ventas,
                COALESCE(SUM(vg.ganancia), 0) as ganancia,
                COALESCE(AVG(v.total), 0) as ticket_promedio,
                COALESCE(SUM(vg.ganancia) / NULLIF(SUM(v.total), 0) * 100, 0) as margen_pct
            FROM ventas v
            LEFT JOIN turnos_caja tc ON v.turno_id = tc.id
            LEFT JOIN bodegas b ON tc.bodega_id = b.id
            LEFT JOIN (
                SELECT vd.venta_id, SUM(vd.subtotal - (vd.cantidad * COALESCE(p.precio_compra, 0))) as ganancia
                FROM venta_detalle vd
                JOIN productos p ON vd.producto_id = p.id
                GROUP BY vd.venta_id
            ) vg ON v.id = vg.venta_id
            WHERE v.empresa_id = ? AND v.estado = 'pagada'
            AND DATE(v.fecha_venta) BETWEEN ? AND ?
            GROUP BY b.id, b.nombre
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
// CIERRES Y DIFERENCIAS POR TURNO
// ─────────────────────────────────────────────
export const getCierresCaja = async (req: Request, res: Response) => {
    try {
        const { empresaId, fechaInicio, fechaFin, cajaId, usuarioId, turnoId } = req.query;
        if (!empresaId) return errorResponse(res, 'empresaId requerido', 400);

        const fi = fechaInicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const ff = fechaFin || new Date().toISOString().split('T')[0];
        let sql = `
            SELECT t.id as turno_id, t.caja_id, COALESCE(c.nombre, 'Sin caja') as caja_nombre,
                   t.bodega_id, b.nombre as bodega_nombre, t.usuario_id,
                   CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) as cajero,
                   t.fecha_apertura, t.fecha_cierre, t.base_inicial, t.total_ventas,
                   t.total_gastos, t.efectivo_a_entregar, t.efectivo_contado, t.diferencia,
                   t.notas_cierre
            FROM turnos_caja t
            LEFT JOIN cajas c ON t.caja_id = c.id
            LEFT JOIN bodegas b ON t.bodega_id = b.id
            LEFT JOIN usuarios u ON t.usuario_id = u.id
            WHERE t.empresa_id = ? AND t.estado = 'cerrado'
              AND DATE(COALESCE(t.fecha_cierre, t.fecha_apertura)) BETWEEN ? AND ?
        `;
        const params: any[] = [empresaId, fi, ff];

        if (cajaId) { sql += ' AND t.caja_id = ?'; params.push(cajaId); }
        if (usuarioId) { sql += ' AND t.usuario_id = ?'; params.push(usuarioId); }
        if (turnoId) { sql += ' AND t.id = ?'; params.push(turnoId); }
        sql += ' ORDER BY t.fecha_cierre DESC';

        const cierres: any[] = await query(sql, params);
        const resumen = cierres.reduce((totales, cierre) => {
            totales.turnos += 1;
            totales.total_ventas += Number(cierre.total_ventas) || 0;
            totales.total_gastos += Number(cierre.total_gastos) || 0;
            totales.efectivo_a_entregar += Number(cierre.efectivo_a_entregar) || 0;
            totales.efectivo_contado += Number(cierre.efectivo_contado) || 0;
            totales.diferencia += Number(cierre.diferencia) || 0;
            if (cierre.diferencia !== null) {
                if (Number(cierre.diferencia) < 0) totales.faltantes += 1;
                if (Number(cierre.diferencia) > 0) totales.sobrantes += 1;
            }
            return totales;
        }, { turnos: 0, total_ventas: 0, total_gastos: 0, efectivo_a_entregar: 0, efectivo_contado: 0, diferencia: 0, faltantes: 0, sobrantes: 0 });

        return successResponse(res, 'Cierres de caja', { resumen, cierres });
    } catch (error: any) {
        logger.error('Error en getCierresCaja:', error);
        return errorResponse(res, 'Error al obtener cierres de caja', 500);
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
            FROM venta_detalle vd
            JOIN productos p ON vd.producto_id = p.id
            JOIN ventas v ON vd.venta_id = v.id
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE v.empresa_id = ? AND v.estado = 'pagada'
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
            WHERE p.empresa_id = ? AND p.maneja_inventario = 1 AND p.estado = 'activo'
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
            WHERE p.empresa_id = ? AND p.maneja_inventario = 1 AND p.estado = 'activo'
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
const validarAccesoEmpresa = async (req: Request, empresaId: number): Promise<boolean> => {
    const usuario = (req as any).user;
    if (!usuario) return false;
    if (usuario.tipo_usuario === 'super_admin') return true;
    if (Number(usuario.empresa_id) === empresaId) return true;

    const [empresas]: any = await query(
        'SELECT 1 FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ? LIMIT 1',
        [usuario.id, empresaId]
    );
    return empresas.length > 0;
};

export const getReportesGuardados = async (req: Request, res: Response) => {
    try {
        const { empresaId } = req.query;
        if (!empresaId) return errorResponse(res, 'empresaId requerido', 400);
        const empresa = Number(empresaId);
        if (!Number.isInteger(empresa) || !(await validarAccesoEmpresa(req, empresa))) {
            return errorResponse(res, 'No tiene permisos para acceder a esta empresa', 403);
        }
        const usuario = (req as any).user;

        const datos = await query(`
            SELECT rg.*, CONCAT(u.nombre, ' ', COALESCE(u.apellido,'')) as creado_por
            FROM reportes_guardados rg
            JOIN usuarios u ON rg.usuario_id = u.id
            WHERE rg.empresa_id = ? AND rg.activo = 1
              AND (rg.es_publico = 1 OR rg.usuario_id = ?)
            ORDER BY rg.updated_at DESC
        `, [empresa, usuario.id]);

        return successResponse(res, 'Reportes guardados', datos);
    } catch (error: any) {
        logger.error('Error en getReportesGuardados:', error);
        return errorResponse(res, 'Error al obtener reportes guardados', 500);
    }
};

export const crearReporteGuardado = async (req: Request, res: Response) => {
    try {
        const { empresaId, nombre, descripcion, tipo, configuracion, esPublico } = req.body;
        const usuario = (req as any).user;
        if (!empresaId || !nombre || !configuracion) {
            return errorResponse(res, 'Datos requeridos: empresaId, nombre, configuracion', 400);
        }
        const empresa = Number(empresaId);
        if (!Number.isInteger(empresa) || !(await validarAccesoEmpresa(req, empresa))) {
            return errorResponse(res, 'No tiene permisos para guardar reportes en esta empresa', 403);
        }

        const result: any = await query(`
            INSERT INTO reportes_guardados (empresa_id, usuario_id, nombre, descripcion, tipo, configuracion, es_publico)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [empresa, usuario.id, nombre, descripcion || null, tipo || 'personalizado',
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
        const usuario = (req as any).user;

        const [reporte]: any = await query(
            'SELECT id FROM reportes_guardados WHERE id = ? AND usuario_id = ? AND activo = 1',
            [id, usuario.id]
        );
        if (reporte.length === 0) return errorResponse(res, 'Reporte no encontrado', 404);

        await query('UPDATE reportes_guardados SET activo = 0 WHERE id = ? AND usuario_id = ?', [id, usuario.id]);

        return successResponse(res, 'Reporte eliminado', null);
    } catch (error: any) {
        logger.error('Error en eliminarReporteGuardado:', error);
        return errorResponse(res, 'Error al eliminar reporte', 500);
    }
};
