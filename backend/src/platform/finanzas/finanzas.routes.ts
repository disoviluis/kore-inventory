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
import {
  crearComprobanteEgreso,
  getCuentaPorPagarById,
  getCuentasPorPagar,
  getCuentasPorProveedor,
  getResumenCuentasPorPagar
} from './cuentas-por-pagar.controller';
import { requirePermission } from '../../core/middleware/permissions.middleware';
import {
  listarCuentasBancarias,
  crearCuentaBancaria,
  listarMovimientos,
  crearMovimiento,
  conciliarMovimiento
} from './bancos.controller';

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

/**
 * =================================
 * RUTAS DE CUENTAS POR PAGAR (CxP)
 * =================================
 */
router.get('/cuentas-por-pagar', requirePermission('cuentas_por_pagar', 'view'), getCuentasPorPagar);
router.get('/cuentas-por-pagar/dashboard/resumen', requirePermission('cuentas_por_pagar', 'view'), getResumenCuentasPorPagar);
router.get('/cuentas-por-pagar/proveedor/:proveedorId', requirePermission('cuentas_por_pagar', 'view'), getCuentasPorProveedor);
router.get('/cuentas-por-pagar/:id', requirePermission('cuentas_por_pagar', 'view'), getCuentaPorPagarById);
router.post('/comprobantes-egreso', requirePermission('cuentas_por_pagar', 'create'), crearComprobanteEgreso);

router.get('/bancos/cuentas', requirePermission('bancos', 'view'), listarCuentasBancarias);
router.post('/bancos/cuentas', requirePermission('bancos', 'create'), crearCuentaBancaria);
router.get('/bancos/movimientos', requirePermission('bancos', 'view'), listarMovimientos);
router.post('/bancos/movimientos', requirePermission('bancos', 'create'), crearMovimiento);
router.post('/bancos/movimientos/:id/conciliar', requirePermission('bancos', 'approve'), conciliarMovimiento);

export default router;
