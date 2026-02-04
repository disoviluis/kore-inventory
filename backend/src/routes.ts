/**
 * =================================
 * KORE INVENTORY - MAIN ROUTES
 * Registro central de todas las rutas
 * =================================
 */

import { Router } from 'express';
import authRoutes from './core/auth/auth.routes';
import empresasRoutes from './platform/empresas/empresas.routes';
import dashboardRoutes from './core/dashboard/dashboard.routes';
import productosRoutes from './platform/productos/productos.routes';
import categoriasRoutes from './platform/categorias/categorias.routes';
import clientesRoutes from './platform/clientes/clientes.routes';
import ventasRoutes from './platform/ventas/ventas.routes';

const router = Router();

// ============================================
// RUTAS DE AUTENTICACIÓN
// ============================================
router.use('/auth', authRoutes);

// ============================================
// RUTAS DE DASHBOARD
// ============================================
router.use('/dashboard', dashboardRoutes);

// ============================================
// RUTAS DE PLATAFORMA (Super Admin)
// ============================================
router.use('/empresas', empresasRoutes);
// router.use('/platform/planes', planesRoutes);
// router.use('/platform/licencias', licenciasRoutes);

// ============================================
// RUTAS CORE (Seguridad)
// ============================================
// router.use('/usuarios', usuariosRoutes);
// router.use('/roles', rolesRoutes);
// router.use('/permisos', permisosRoutes);

// ============================================
// RUTAS TENANT (Por empresa)
// ============================================
router.use('/productos', productosRoutes);
router.use('/categorias', categoriasRoutes);
router.use('/clientes', clientesRoutes);
router.use('/ventas', ventasRoutes);
// router.use('/inventario', inventarioRoutes);

export default router;
