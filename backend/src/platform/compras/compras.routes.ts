/**
 * =============================================
 * KORE INVENTORY - COMPRAS ROUTES
 * Rutas para gestión de compras
 * =============================================
 */

import { Router } from 'express';
import * as comprasController from './compras.controller';

const router = Router();

// Obtener resumen de compras
router.get('/resumen', comprasController.getResumen);

// Obtener listado de compras
router.get('/', comprasController.getCompras);

// Obtener detalle de una compra
router.get('/:id', comprasController.getCompra);

// Crear nueva compra
router.post('/', comprasController.crearCompra);

// Recibir compra y actualizar inventario
router.post('/:id/recibir', comprasController.recibirCompra);

// Anular compra
router.put('/:id/anular', comprasController.anularCompra);

export default router;
