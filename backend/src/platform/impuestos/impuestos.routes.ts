/**
 * =================================
 * KORE INVENTORY - IMPUESTOS ROUTES
 * Rutas de impuestos adicionales
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
import { authMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * @route   GET /api/impuestos
 * @desc    Obtener todos los impuestos de una empresa
 * @access  Private
 */
router.get('/', getImpuestos);

/**
 * @route   GET /api/impuestos/activos
 * @desc    Obtener impuestos activos para POS
 * @access  Private
 */
router.get('/activos', getImpuestosActivos);

/**
 * @route   GET /api/impuestos/:id
 * @desc    Obtener impuesto por ID
 * @access  Private
 */
router.get('/:id', getImpuestoById);

/**
 * @route   POST /api/impuestos
 * @desc    Crear nuevo impuesto
 * @access  Private (Admin)
 */
router.post('/', createImpuesto);

/**
 * @route   PUT /api/impuestos/:id
 * @desc    Actualizar impuesto
 * @access  Private (Admin)
 */
router.put('/:id', updateImpuesto);

/**
 * @route   DELETE /api/impuestos/:id
 * @desc    Eliminar impuesto
 * @access  Private (Admin)
 */
router.delete('/:id', deleteImpuesto);

export default router;
