import { Router } from 'express';
import * as activosController from './activos.controller';
import { resolveActivosEmpresa, requireActivosPermission } from './activos.security';

const router = Router();

router.use(resolveActivosEmpresa);

router.get('/referencias', requireActivosPermission('activos', 'view'), activosController.getAssetReferences);
router.get('/categorias', requireActivosPermission('activos_config', 'view'), activosController.listCategories);
router.post('/categorias', requireActivosPermission('activos_config', 'create'), activosController.createCategory);
router.put('/categorias/:id', requireActivosPermission('activos_config', 'edit'), activosController.updateCategory);

router.get('/tipos', requireActivosPermission('activos_config', 'view'), activosController.listTypes);
router.post('/tipos', requireActivosPermission('activos_config', 'create'), activosController.createType);
router.put('/tipos/:id', requireActivosPermission('activos_config', 'edit'), activosController.updateType);
router.get('/tipos/:tipoId/atributos', requireActivosPermission('activos_config', 'view'), activosController.listTypeAttributes);
router.post('/tipos/:tipoId/atributos', requireActivosPermission('activos_config', 'create'), activosController.createTypeAttribute);
router.put('/tipos/:tipoId/atributos/:id', requireActivosPermission('activos_config', 'edit'), activosController.updateTypeAttribute);

router.get('/', requireActivosPermission('activos', 'view'), activosController.listAssets);
router.get('/export', requireActivosPermission('activos', 'export'), activosController.listAssets);
router.post('/', requireActivosPermission('activos', 'create'), activosController.createAsset);
router.get('/:id/historial', requireActivosPermission('activos', 'view'), activosController.getAssetHistory);
router.post('/:id/asignaciones', requireActivosPermission('activos', 'assign'), activosController.assignAsset);
router.post('/:id/baja', requireActivosPermission('activos', 'retire'), activosController.retireAsset);
router.post('/:id/imagen/upload-url', requireActivosPermission('activos', 'edit'), activosController.getAssetImageUploadUrl);
router.get('/:id', requireActivosPermission('activos', 'view'), activosController.getAsset);
router.put('/:id', requireActivosPermission('activos', 'edit'), activosController.updateAsset);

export default router;
