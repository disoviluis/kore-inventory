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
  anularVenta,
  abrirTurno,
  getTurnoActual,
  getResumenTurno,
  cerrarTurno,
  registrarGasto,
  getGastosTurno
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

// =====================================================
// RUTAS DE TURNOS DE CAJA
// =====================================================

/**
 * @route   POST /api/ventas/turno/abrir
 * @desc    Abrir turno de caja
 * @access  Private
 */
router.post('/turno/abrir', abrirTurno);

/**
 * @route   GET /api/ventas/turno/actual
 * @desc    Obtener turno actual del usuario
 * @access  Private
 */
router.get('/turno/actual', getTurnoActual);

/**
 * @route   GET /api/ventas/turno/:turnoId/resumen
 * @desc    Obtener resumen del turno para cierre
 * @access  Private
 */
router.get('/turno/:turnoId/resumen', getResumenTurno);

/**
 * @route   POST /api/ventas/turno/:turnoId/cerrar
 * @desc    Cerrar turno de caja
 * @access  Private
 */
router.post('/turno/:turnoId/cerrar', cerrarTurno);

/**
 * @route   POST /api/ventas/turno/:turnoId/gastos
 * @desc    Registrar gasto en el turno
 * @access  Private
 */
router.post('/turno/:turnoId/gastos', registrarGasto);

/**
 * @route   GET /api/ventas/turno/:turnoId/gastos
 * @desc    Obtener gastos del turno
 * @access  Private
 */
router.get('/turno/:turnoId/gastos', getGastosTurno);

export default router;
