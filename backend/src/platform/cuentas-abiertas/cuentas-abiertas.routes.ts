/**
 * =================================
 * KORE INVENTORY - CUENTAS ABIERTAS ROUTES
 * Rutas para manejo de cuentas abiertas en POS
 * =================================
 */

import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/auth.middleware';
import { verificarEmpresaActiva } from '../../core/middleware/licencia.middleware';
import {
  abrirCuenta,
  listarCuentasAbiertas,
  obtenerDetalleCuenta,
  agregarItemCuenta,
  eliminarItemCuenta,
  solicitarCuenta,
  cerrarCuenta,
  cancelarCuenta
} from './cuentas-abiertas.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * @route   POST /api/cuentas-abiertas
 * @desc    Abrir una nueva cuenta
 * @access  Private
 */
router.post('/', verificarEmpresaActiva, abrirCuenta);

/**
 * @route   GET /api/cuentas-abiertas/empresas/:empresaId
 * @desc    Listar cuentas abiertas de una empresa
 * @access  Private
 */
router.get('/empresas/:empresaId', listarCuentasAbiertas);

/**
 * @route   GET /api/cuentas-abiertas/:id/detalle
 * @desc    Obtener detalle completo de una cuenta
 * @access  Private
 */
router.get('/:id/detalle', obtenerDetalleCuenta);

/**
 * @route   POST /api/cuentas-abiertas/:id/items
 * @desc    Agregar item a cuenta abierta
 * @access  Private
 */
router.post('/:id/items', verificarEmpresaActiva, agregarItemCuenta);

/**
 * @route   DELETE /api/cuentas-abiertas/:id/items/:itemId
 * @desc    Eliminar item de cuenta abierta
 * @access  Private
 */
router.delete('/:id/items/:itemId', verificarEmpresaActiva, eliminarItemCuenta);

/**
 * @route   POST /api/cuentas-abiertas/:id/solicitar-cuenta
 * @desc    Marcar que el cliente pidió la cuenta (para estadísticas)
 * @access  Private
 */
router.post('/:id/solicitar-cuenta', solicitarCuenta);

/**
 * @route   POST /api/cuentas-abiertas/:id/cerrar
 * @desc    Cerrar cuenta y convertir en venta
 * @access  Private
 */
router.post('/:id/cerrar', verificarEmpresaActiva, cerrarCuenta);

/**
 * @route   DELETE /api/cuentas-abiertas/:id
 * @desc    Cancelar cuenta (reversar inventario)
 * @access  Private
 */
router.delete('/:id', verificarEmpresaActiva, cancelarCuenta);

export default router;
