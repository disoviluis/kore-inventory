/**
 * =================================
 * KORE INVENTORY - FACTURACIÓN ROUTES
 * Rutas de configuración de facturación
 * =================================
 */

import { Router } from 'express';
import * as facturacionController from './facturacion.controller';
import { authMiddleware } from '../../core/middleware/auth.middleware';
import { verificarEmpresaActiva } from '../../core/middleware/licencia.middleware';

const router = Router();

// ============================================
// CONFIGURACIÓN DE FACTURACIÓN
// ============================================

// Obtener configuración de facturación
router.get('/configuracion/:empresaId', authMiddleware, verificarEmpresaActiva, facturacionController.getConfiguracionFacturacion);

// Actualizar configuración de facturación
router.put('/configuracion/:empresaId', authMiddleware, verificarEmpresaActiva, facturacionController.updateConfiguracionFacturacion);

// ============================================
// RETENCIONES
// ============================================

// Obtener retenciones de una empresa
router.get('/retenciones/:empresaId', authMiddleware, verificarEmpresaActiva, facturacionController.getRetenciones);

// Crear retención
router.post('/retenciones', authMiddleware, verificarEmpresaActiva, facturacionController.createRetencion);

// Actualizar retención
router.put('/retenciones/:id', authMiddleware, verificarEmpresaActiva, facturacionController.updateRetencion);

// Eliminar retención
router.delete('/retenciones/:id', authMiddleware, verificarEmpresaActiva, facturacionController.deleteRetencion);

export default router;
