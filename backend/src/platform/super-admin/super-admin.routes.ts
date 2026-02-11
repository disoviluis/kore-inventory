import { Router } from 'express';
import * as superAdminController from './super-admin.controller';
import * as empresasAdminController from './empresas-admin.controller';
import * as usuariosAdminController from './usuarios-admin.controller';

const router = Router();

/**
 * ========================================
 * RUTAS: MÓDULO SUPER ADMIN
 * ========================================
 * Todas estas rutas deben estar protegidas con middleware
 * que verifique tipo_usuario = 'super_admin'
 */

// ========================================
// DASHBOARD Y MÉTRICAS
// ========================================
router.get('/dashboard', superAdminController.getDashboardMetrics);
router.get('/empresas-resumen', superAdminController.getEmpresasResumen);
router.get('/actividad-reciente', superAdminController.getActividadReciente);

// ========================================
// GESTIÓN DE EMPRESAS
// ========================================
router.get('/empresas', empresasAdminController.getEmpresas);
router.get('/empresas/:id', empresasAdminController.getEmpresaById);
router.post('/empresas', empresasAdminController.createEmpresa);
router.put('/empresas/:id', empresasAdminController.updateEmpresa);
router.put('/empresas/:id/estado', empresasAdminController.cambiarEstadoEmpresa);
router.delete('/empresas/:id', empresasAdminController.deleteEmpresa);

// ========================================
// GESTIÓN DE USUARIOS
// ========================================
router.get('/usuarios', usuariosAdminController.getUsuarios);
router.get('/usuarios/:id', usuariosAdminController.getUsuarioById);
router.post('/usuarios', usuariosAdminController.createUsuario);
router.put('/usuarios/:id', usuariosAdminController.updateUsuario);
router.put('/usuarios/:id/password', usuariosAdminController.cambiarPasswordUsuario);
router.post('/usuarios/:id/empresas', usuariosAdminController.asignarUsuarioEmpresa);
router.delete('/usuarios/:id/empresas/:empresaId', usuariosAdminController.desasignarUsuarioEmpresa);
router.delete('/usuarios/:id', usuariosAdminController.deleteUsuario);

export default router;
