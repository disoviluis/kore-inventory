/**
 * =================================
 * KORE INVENTORY - IMPUESTOS ROUTES
 * Rutas para gestión de impuestos
 * =================================
 */

import { Router } from 'express';
import {
  getImpuestos,
  getImpuestosActivos,
  getImpuestoById,
  createImpuesto,
  updateImpuesto,
  deleteImpuesto
} from './impuestos.controller';
import { authenticateToken } from '../../core/middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas
router.get('/', getImpuestos);
router.get('/activos', getImpuestosActivos);
router.get('/:id', getImpuestoById);
router.post('/', createImpuesto);
router.put('/:id', updateImpuesto);
router.delete('/:id', deleteImpuesto);

export default router;
