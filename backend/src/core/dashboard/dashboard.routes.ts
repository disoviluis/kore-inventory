/**
 * =================================
 * KORE INVENTORY - DASHBOARD ROUTES
 * Rutas de dashboard
 * =================================
 */

import { Router } from 'express';
import * as dashboardController from './dashboard.controller';

const router = Router();

// Obtener estadísticas del dashboard
router.get('/stats', dashboardController.getStats);

// Obtener actividad reciente
router.get('/actividad', dashboardController.getActividad);

export default router;
