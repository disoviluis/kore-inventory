/**
 * =================================
 * KORE INVENTORY - FACTURACIÓN ROUTES
 * Rutas de configuración de facturación
 * =================================
 */

import { Router } from 'express';
import * as facturacionController from './facturacion.controller';

const router = Router();

// ============================================
// CONFIGURACIÓN DE FACTURACIÓN
// ============================================

// Obtener configuración de facturación
router.get('/configuracion/:empresaId', facturacionController.getConfiguracionFacturacion);

// Actualizar configuración de facturación
router.put('/configuracion/:empresaId', facturacionController.updateConfiguracionFacturacion);

// ============================================
// RETENCIONES
// ============================================

// Obtener retenciones de una empresa
router.get('/retenciones/:empresaId', facturacionController.getRetenciones);

// Crear retención
router.post('/retenciones', facturacionController.createRetencion);

// Actualizar retención
router.put('/retenciones/:id', facturacionController.updateRetencion);

// Eliminar retención
router.delete('/retenciones/:id', facturacionController.deleteRetencion);

export default router;
