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

// Obtener configuración de página pública por empresa
router.get('/:id/pagina-publica', empresasController.getPaginaPublica);

// Obtener imágenes S3 de página pública
router.get('/:id/pagina-publica/imagenes-s3', empresasController.getPaginaPublicaImagenesS3);

// Generar URL presignada para subir banner S3
router.post('/:id/pagina-publica/presign-upload', empresasController.getPaginaPublicaPresignedUpload);

// Actualizar configuración de página pública por empresa
router.put('/:id/pagina-publica', empresasController.updatePaginaPublica);

// Actualizar empresa
router.put('/:id', empresasController.updateEmpresa);

export default router;
