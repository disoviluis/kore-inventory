/**
 * =================================
 * KORE INVENTORY - INVENTARIO ROUTES
 * Rutas de inventario
 * =================================
 */

import { Router } from 'express';
import * as inventarioController from './inventario.controller';

const router = Router();

// Obtener resumen de inventario
router.get('/resumen', inventarioController.getResumen);

// Obtener alertas de stock bajo
router.get('/alertas', inventarioController.getAlertas);

// Obtener movimientos de inventario
router.get('/', inventarioController.getMovimientos);

// Obtener historial de un producto
router.get('/producto/:id', inventarioController.getHistorialProducto);

// Registrar ajuste de inventario
router.post('/ajuste', inventarioController.registrarAjuste);

export default router;
