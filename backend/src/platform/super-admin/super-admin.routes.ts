import { Router } from 'express';
import { authMiddleware, requireUserType } from '../../core/middleware/auth.middleware';
import * as superAdminController from './super-admin.controller';
import * as empresasAdminController from './empresas-admin.controller';
import * as usuariosAdminController from './usuarios-admin.controller';
import * as planesAdminController from './planes-admin.controller';
import * as rolesGlobalesController from './roles-globales.controller';
import * as licenciasAdminController from './licencias-admin.controller';
import { getAccessMigration, inviteExistingUser, createInvitedUser, deactivateAccessUser, reactivateAccessUser } from '../../core/auth/auth.admin';
import { getLegalAdministration, publishLegalDocument } from '../../core/auth/auth.account';
import { listSubscriptionRequests, approveSubscriptionRequest, rejectSubscriptionRequest, requirePaymentWorkflow } from '../../core/auth/subscription.controller';
import { rateLimit } from 'express-rate-limit';
import { getGlobalSmtp, saveGlobalSmtp, testGlobalSmtp } from '../../core/auth/auth.smtp.controller';
import { createValidatedPlan, updateValidatedPlan, getPlanModuleCatalog } from './planes-save.controller';

const router = Router();

/**
 * ========================================
 * RUTAS: MÓDULO SUPER ADMIN
 * ========================================
 * Todas estas rutas están protegidas con authMiddleware
 * que verifica el token JWT y tipo_usuario = 'super_admin'
 */

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);
router.use(requireUserType('super_admin'));
router.get('/configuracion/smtp', getGlobalSmtp);
router.put('/configuracion/smtp', saveGlobalSmtp);
router.post('/configuracion/smtp/prueba', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5,
	standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, message: 'Limite de pruebas alcanzado. Intente mas tarde.' } }), testGlobalSmtp);
router.get('/accesos', getAccessMigration);
router.post('/usuarios/:id/invitacion', inviteExistingUser);
router.post('/usuarios/:id/reactivar', reactivateAccessUser);
router.get('/documentos-legales', getLegalAdministration);
router.post('/documentos-legales', publishLegalDocument);
router.get('/solicitudes-suscripcion', listSubscriptionRequests);
router.post('/solicitudes-suscripcion/:id/aprobar', approveSubscriptionRequest);
router.post('/solicitudes-suscripcion/:id/rechazar', rejectSubscriptionRequest);

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
router.post('/empresas/:id/activar-licencia', requirePaymentWorkflow);
router.delete('/empresas/:id', empresasAdminController.deleteEmpresa);

// ========================================
// GESTIÓN DE USUARIOS
// ========================================
router.get('/usuarios', usuariosAdminController.getUsuarios);
router.get('/usuarios/:id', usuariosAdminController.getUsuarioById);
router.post('/usuarios', createInvitedUser);
router.put('/usuarios/:id', usuariosAdminController.updateUsuario);
router.put('/usuarios/:id/password', usuariosAdminController.cambiarPasswordUsuario);
router.post('/usuarios/:id/empresas', usuariosAdminController.asignarUsuarioEmpresa);
router.delete('/usuarios/:id/empresas/:empresaId', usuariosAdminController.desasignarUsuarioEmpresa);
router.delete('/usuarios/:id', deactivateAccessUser);

// ========================================
// GESTIÓN DE PLANES
// ========================================
router.get('/planes', planesAdminController.getPlanes);
router.get('/planes/catalogo-modulos', getPlanModuleCatalog);
router.get('/planes/:id', planesAdminController.getPlanById);
router.post('/planes', createValidatedPlan);
router.put('/planes/:id', updateValidatedPlan);
router.delete('/planes/:id', planesAdminController.deletePlan);

// ========================================
// GESTIÓN DE LICENCIAS
// ========================================
router.get('/licencias', planesAdminController.getLicencias);
router.post('/licencias/procesar-notificaciones', licenciasAdminController.procesarNotificaciones);
router.post('/licencias/procesar-renovaciones', requirePaymentWorkflow);
router.get('/licencias/estado', licenciasAdminController.getEstadoLicencias);
router.get('/licencias/:id/historial', licenciasAdminController.getHistorialLicencia);
router.get('/licencias/:id', planesAdminController.getLicenciaById);
router.post('/licencias', requirePaymentWorkflow);
router.put('/licencias/:id', requirePaymentWorkflow);
router.delete('/licencias/:id', requirePaymentWorkflow);

// ========================================
// GESTIÓN DE ROLES GLOBALES
// ========================================
router.get('/roles-globales', rolesGlobalesController.getRolesGlobales);
router.get('/roles-globales/:id', rolesGlobalesController.getRolGlobalById);
router.post('/roles-globales', rolesGlobalesController.createRolGlobal);
router.put('/roles-globales/:id', rolesGlobalesController.updateRolGlobal);
router.delete('/roles-globales/:id', rolesGlobalesController.deleteRolGlobal);

export default router;
