/**
 * =================================
 * KORE INVENTORY - FINANZAS ROUTES
 * Rutas para el módulo de Finanzas
 * =================================
 */

import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/auth.middleware';

// Importar controladores de Cuentas por Cobrar
import {
  getCuentasPorCobrar,
  getCuentaPorCobrarById,
  getCxCByCliente,
  getResumenCartera,
  getReporteEdades
} from './cuentas-por-cobrar.controller';

// Importar controladores de Recibos de Caja
import {
  crearReciboCaja,
  getRecibosCaja,
  getReciboCajaById,
  anularReciboCaja
} from './recibos-caja.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * =================================
 * RUTAS DE CUENTAS POR COBRAR (CxC)
 * =================================
 */

// Obtener todas las cuentas por cobrar
router.get('/cuentas-por-cobrar', getCuentasPorCobrar);

// Obtener resumen de cartera para dashboard
router.get('/cuentas-por-cobrar/dashboard/resumen', getResumenCartera);

// Obtener reporte de edades de cartera (Aging Report)
router.get('/cuentas-por-cobrar/reportes/edades', getReporteEdades);

// Obtener cuentas por cobrar de un cliente específico
router.get('/cuentas-por-cobrar/cliente/:clienteId', getCxCByCliente);

// Obtener detalle de una cuenta por cobrar
router.get('/cuentas-por-cobrar/:id', getCuentaPorCobrarById);

/**
 * =================================
 * RUTAS DE RECIBOS DE CAJA
 * =================================
 */

// Crear recibo de caja (aplicar pago)
router.post('/recibos-caja', crearReciboCaja);

// Obtener todos los recibos de caja
router.get('/recibos-caja', getRecibosCaja);

// Obtener detalle de un recibo de caja
router.get('/recibos-caja/:id', getReciboCajaById);

// Anular un recibo de caja
router.delete('/recibos-caja/:id', anularReciboCaja);

export default router;
