/**
 * =================================
 * KORE INVENTORY - EMPRESAS ROUTES
 * Rutas de empresas
 * =================================
 */

import { Router } from 'express';
import * as empresasController from './empresas.controller';

const router = Router();

// Obtener todas las empresas
router.get('/', empresasController.getEmpresas);

// Obtener empresas del usuario
router.get('/usuario/:userId', empresasController.getEmpresasByUsuario);

// Obtener empresa por ID
router.get('/:id', empresasController.getEmpresaById);

export default router;
