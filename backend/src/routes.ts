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
import { verificarEmpresaActiva } from './core/middleware/licencia.middleware';
import { authMiddleware } from './core/middleware/auth.middleware';

const router = Router();

// ============================================
// RUTAS PÚBLICAS (Sin autenticación)
// ============================================
router.use('/public', publicRoutes);

// ============================================
// RUTAS DE AUTENTICACIÓN
// ============================================
router.use('/auth', authRoutes);

// ============================================
// RUTAS DE DASHBOARD
// ============================================
router.use('/dashboard', dashboardRoutes);

// ============================================
// RUTAS DE SUPER ADMIN
// ============================================
router.use('/super-admin', superAdminRoutes);

// ============================================
// RUTAS DE PLATAFORMA (Super Admin)
// ============================================
router.use('/empresas', empresasRoutes);
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
router.use('/compras', authMiddleware, verificarEmpresaActiva, comprasRoutes);
router.use('/impuestos', authMiddleware, verificarEmpresaActiva, impuestosRoutes);
router.use('/facturacion', facturacionRoutes); // Middlewares aplicados dentro del módulo
router.use('/bodegas', authMiddleware, verificarEmpresaActiva, bodegasRoutes);
router.use('/traslados', authMiddleware, verificarEmpresaActiva, trasladosRoutes);
router.use('/finanzas', authMiddleware, verificarEmpresaActiva, finanzasRoutes);
router.use('/cuentas-abiertas', cuentasAbiertasRoutes); // Middlewares aplicados dentro del módulo

export default router;
