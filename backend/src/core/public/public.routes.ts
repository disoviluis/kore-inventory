import { Router } from 'express';
import * as publicController from './public.controller';

const router = Router();

/**
 * ========================================
 * RUTAS PÚBLICAS (SIN AUTENTICACIÓN)
 * Para landing page y acceso público
 * ========================================
 */

// GET /api/public/planes - Obtener planes activos
router.get('/planes', publicController.getPlanesPublicos);

// GET /api/public/info - Información del sistema
router.get('/info', publicController.getInfoPublica);

// GET /api/public/empresa/:slug - Obtener página pública de una empresa por slug
router.get('/empresa/:slug', publicController.getEmpresaPublica);

export default router;
