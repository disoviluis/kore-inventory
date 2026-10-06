/**
 * =================================
 * KORE INVENTORY - MAIN ROUTES
 * Registro central de todas las rutas
 * =================================
 */

import { Router } from 'express';
import authRoutes from './core/auth/auth.routes';
import publicRoutes from './core/public/public.routes';
import empresasRoutes from './platform/empresas/empresas.routes';
import dashboardRoutes from './core/dashboard/dashboard.routes';
import productosRoutes from './platform/productos/productos.routes';
import categoriasRoutes from './platform/categorias/categorias.routes';
import clientesRoutes from './platform/clientes/clientes.routes';
import ventasRoutes from './platform/ventas/ventas.routes';
import proveedoresRoutes from './platform/proveedores/proveedores.routes';
import inventarioRoutes from './platform/inventario/inventario.routes';
import inventariosFisicosRoutes from './platform/inventario/inventarios-fisicos.routes';
import comprasRoutes from './platform/compras/compras.routes';
import superAdminRoutes from './platform/super-admin/super-admin.routes';
import impuestosRoutes from './platform/impuestos/impuestos.routes';
import rolesRoutes from './core/roles/roles.routes';
import usuariosRoutes from './core/usuarios/usuarios.routes';
import facturacionRoutes from './platform/facturacion/facturacion.routes';
import bodegasRoutes from './platform/bodegas/bodegas.routes';
import trasladosRoutes from './platform/traslados/traslados.routes';
import finanzasRoutes from './platform/finanzas/finanzas.routes';
import cuentasAbiertasRoutes from './platform/cuentas-abiertas/cuentas-abiertas.routes';
import cajasRoutes from './platform/cajas/cajas.routes';
import reportesRoutes from './platform/reportes/reportes.routes';
import comandasRoutes from './platform/comandas/comandas.routes';
import nominaRoutes from './platform/nomina/nomina.routes';
import contabilidadRoutes from './platform/contabilidad/contabilidad.routes';
import activosRoutes from './platform/activos/activos.routes';
import mantenimientosRoutes from './platform/activos/mantenimientos.routes';
import repuestosRoutes from './platform/repuestos/repuestos.routes';
import evidenciasRoutes from './platform/archivos/evidencias.routes';
import { verificarEmpresaActiva } from './core/middleware/licencia.middleware';
import { authMiddleware } from './core/middleware/auth.middleware';
import { getSubscription, requestSubscription, cancelSubscriptionRequest } from './core/auth/subscription.controller';

const router = Router();

// ============================================
// RUTAS PÚBLICAS (Sin autenticación)
// ============================================
router.use('/public', publicRoutes);

// ============================================
// RUTAS DE AUTENTICACIÓN
// ============================================
router.use('/auth', authRoutes);
router.get('/suscripciones/:empresaId', authMiddleware, getSubscription);
router.post('/suscripciones/:empresaId/solicitudes', authMiddleware, requestSubscription);
router.post('/suscripciones/:empresaId/solicitudes/:id/cancelar', authMiddleware, cancelSubscriptionRequest);

// ============================================
// RUTAS DE DASHBOARD
// ============================================
router.use('/dashboard', authMiddleware, verificarEmpresaActiva, dashboardRoutes);

// ============================================
// RUTAS DE SUPER ADMIN
// ============================================
router.use('/super-admin', superAdminRoutes);

// ============================================
// RUTAS DE PLATAFORMA (Super Admin)
// ============================================
router.use('/empresas', authMiddleware, empresasRoutes);
// router.use('/platform/planes', planesRoutes);
// router.use('/platform/licencias', licenciasRoutes);

// ============================================
// RUTAS CORE (Seguridad)
// ============================================
router.use('/usuarios', usuariosRoutes);
router.use('/roles', rolesRoutes);
// router.use('/permisos', permisosRoutes);

// ============================================
// RUTAS TENANT (Por empresa)
// Requieren autenticación Y licencia activa para funcionar
// Orden: authMiddleware → verificarEmpresaActiva → routes
// ============================================
router.use('/productos', authMiddleware, verificarEmpresaActiva, productosRoutes);
router.use('/categorias', authMiddleware, verificarEmpresaActiva, categoriasRoutes);
router.use('/clientes', authMiddleware, verificarEmpresaActiva, clientesRoutes);
router.use('/ventas', authMiddleware, verificarEmpresaActiva, ventasRoutes);
router.use('/proveedores', authMiddleware, verificarEmpresaActiva, proveedoresRoutes);
router.use('/inventario', authMiddleware, verificarEmpresaActiva, inventarioRoutes);
router.use('/inventarios-fisicos', authMiddleware, verificarEmpresaActiva, inventariosFisicosRoutes);
router.use('/compras', authMiddleware, verificarEmpresaActiva, comprasRoutes);
router.use('/impuestos', authMiddleware, verificarEmpresaActiva, impuestosRoutes);
router.use('/facturacion', facturacionRoutes); // Middlewares aplicados dentro del módulo
router.use('/bodegas', authMiddleware, verificarEmpresaActiva, bodegasRoutes);
router.use('/traslados', authMiddleware, verificarEmpresaActiva, trasladosRoutes);
router.use('/finanzas', authMiddleware, verificarEmpresaActiva, finanzasRoutes);
router.use('/nomina', authMiddleware, verificarEmpresaActiva, nominaRoutes);
router.use('/contabilidad', authMiddleware, verificarEmpresaActiva, contabilidadRoutes);
router.use('/activos', authMiddleware, verificarEmpresaActiva, activosRoutes);
router.use('/mantenimientos', authMiddleware, verificarEmpresaActiva, mantenimientosRoutes);
router.use('/repuestos', authMiddleware, verificarEmpresaActiva, repuestosRoutes);
router.use('/evidencias', authMiddleware, verificarEmpresaActiva, evidenciasRoutes);
router.use('/cuentas-abiertas', cuentasAbiertasRoutes); // Middlewares aplicados dentro del módulo
router.use('/cajas', cajasRoutes);
router.use('/reportes', authMiddleware, verificarEmpresaActiva, reportesRoutes);
router.use('/comandas', authMiddleware, verificarEmpresaActiva, comandasRoutes);

export default router;
