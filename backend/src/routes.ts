/**
 * =================================
 * KORE INVENTORY - MAIN ROUTES
 * Registro central de todas las rutas
 * =================================
 */

import { Router } from 'express';
import authRoutes from './core/auth/auth.routes';

const router = Router();

// ============================================
// RUTAS DE AUTENTICACIÓN
// ============================================
router.use('/auth', authRoutes);

// ============================================
// RUTAS DE PLATAFORMA (Super Admin)
// ============================================
// router.use('/platform/empresas', empresasRoutes);
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
// router.use('/productos', productosRoutes);
// router.use('/inventario', inventarioRoutes);
// router.use('/ventas', ventasRoutes);

export default router;
