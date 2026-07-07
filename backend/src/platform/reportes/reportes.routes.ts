import { Router } from 'express';
import * as reportesController from './reportes.controller';

const router = Router();

// KPIs del dashboard analítico
router.get('/kpis', reportesController.getDashboardKPIs);

// Ventas por tiempo (línea de tendencia)
router.get('/ventas-tiempo', reportesController.getVentasPorTiempo);

// Top vendedores
router.get('/top-vendedores', reportesController.getTopVendedores);

// Top / bottom productos
router.get('/top-productos', reportesController.getTopProductos);

// Análisis por bodega / caja
router.get('/bodegas', reportesController.getAnalisisBodegas);

// Ventas por categoría
router.get('/categorias', reportesController.getVentasCategorias);

// Inventario en riesgo (stock bajo + sin movimiento)
router.get('/inventario-riesgo', reportesController.getInventarioRiesgo);

// Reportes guardados
router.get('/guardados', reportesController.getReportesGuardados);
router.post('/guardados', reportesController.crearReporteGuardado);
router.delete('/guardados/:id', reportesController.eliminarReporteGuardado);

export default router;
