/**
 * =================================
 * KORE INVENTORY - BODEGAS ROUTES
 * Rutas para gestión de bodegas
 * =================================
 */

import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/auth.middleware';
import * as bodegasController from './bodegas.controller';

const router = Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

/**
 * @route   GET /api/bodegas
 * @desc    Obtener todas las bodegas de una empresa
 * @access  Private (admin_empresa, super_admin)
 * @query   empresa_id (opcional para super_admin)
 */
router.get('/', bodegasController.getBodegas);

/**
 * @route   GET /api/bodegas/:id
 * @desc    Obtener una bodega por ID
 * @access  Private
 */
router.get('/:id', bodegasController.getBodegaById);

/**
 * @route   POST /api/bodegas
 * @desc    Crear nueva bodega
 * @access  Private (admin_empresa, super_admin)
 * @body    { codigo, nombre, descripcion?, tipo?, direccion?, ciudad?, ... }
 */
router.post('/', bodegasController.createBodega);

/**
 * @route   PUT /api/bodegas/:id
 * @desc    Actualizar bodega
 * @access  Private (admin_empresa, super_admin)
 */
router.put('/:id', bodegasController.updateBodega);

/**
 * @route   DELETE /api/bodegas/:id
 * @desc    Eliminar bodega (solo si no tiene stock)
 * @access  Private (admin_empresa, super_admin)
 */
router.delete('/:id', bodegasController.deleteBodega);

/**
 * @route   GET /api/bodegas/:bodega_id/stock
 * @desc    Obtener stock de productos en una bodega específica
 * @access  Private
 */
router.get('/:bodega_id/stock', bodegasController.getStockPorBodega);

export default router;
