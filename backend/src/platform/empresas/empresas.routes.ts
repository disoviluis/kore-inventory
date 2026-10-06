/**
 * =================================
 * KORE INVENTORY - EMPRESAS ROUTES
 * Rutas de empresas
 * =================================
 */

import { Router } from 'express';
import * as empresasController from './empresas.controller';
import { assertCompanyMembership } from '../../core/auth/subscription.service';

const router = Router();

// Obtener todas las empresas
router.get('/', (req, res, next) => {
	if ((req as any).user.tipo_usuario !== 'super_admin') { res.status(403).json({ success: false, message: 'Acceso reservado a Super Admin' }); return; }
	next();
}, empresasController.getEmpresas);

// Obtener empresas del usuario
router.get('/usuario/:userId', (req, res, next) => {
	if ((req as any).user.tipo_usuario !== 'super_admin' && Number(req.params.userId) !== (req as any).user.id) {
		res.status(403).json({ success: false, message: 'No tiene acceso a ese usuario' }); return;
	}
	next();
}, empresasController.getEmpresasByUsuario);
router.use('/:id', async (req, res, next) => {
	try { await assertCompanyMembership((req as any).user, Number(req.params.id)); next(); }
	catch { res.status(403).json({ success: false, message: 'No tiene acceso a esta empresa' }); }
});

// Obtener empresa por ID
router.get('/:id/contabilidad/estado', empresasController.getEstadoParametrizacionContable);
router.put('/:id/contabilidad/estado', empresasController.updateEstadoParametrizacionContable);
router.get('/:id', empresasController.getEmpresaById);

// Obtener configuración de página pública por empresa
router.get('/:id/pagina-publica', empresasController.getPaginaPublica);

// Obtener imágenes S3 de página pública
router.get('/:id/pagina-publica/imagenes-s3', empresasController.getPaginaPublicaImagenesS3);

// Generar URL presignada para subir banner S3
router.post('/:id/pagina-publica/presign-upload', empresasController.getPaginaPublicaPresignedUpload);

// Eliminar imagen S3 de página pública
router.delete('/:id/pagina-publica/imagen-s3', empresasController.deletePaginaPublicaImagenS3);

// Generar URL presignada para subir logo de empresa
router.post('/:id/logo/upload-url', empresasController.getLogoPresignedUpload);

// Actualizar configuración de página pública por empresa
router.put('/:id/pagina-publica', empresasController.updatePaginaPublica);

// Actualizar empresa
router.put('/:id', empresasController.updateEmpresa);

export default router;
