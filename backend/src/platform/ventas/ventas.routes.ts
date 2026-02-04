/**
 * =================================
 * KORE INVENTORY - VENTAS ROUTES
 * Rutas para ventas y punto de venta
 * =================================
 */

import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/auth.middleware';
import {
  buscarCliente,
  buscarProducto,
  getVentas,
  getVentaById,
  createVenta,
  anularVenta
} from './ventas.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * @route   GET /api/ventas/buscar-cliente
 * @desc    Buscar clientes para la venta
 * @access  Private
 */
router.get('/buscar-cliente', buscarCliente);

/**
 * @route   GET /api/ventas/buscar-producto
 * @desc    Buscar productos para agregar a la venta
 * @access  Private
 */
router.get('/buscar-producto', buscarProducto);

/**
 * @route   GET /api/ventas
 * @desc    Obtener todas las ventas de una empresa
 * @access  Private
 */
router.get('/', getVentas);

/**
 * @route   GET /api/ventas/:id
 * @desc    Obtener detalle de una venta
 * @access  Private
 */
router.get('/:id', getVentaById);

/**
 * @route   POST /api/ventas
 * @desc    Crear una nueva venta
 * @access  Private
 */
router.post('/', createVenta);

/**
 * @route   PUT /api/ventas/:id/anular
 * @desc    Anular una venta
 * @access  Private
 */
router.put('/:id/anular', anularVenta);

export default router;
