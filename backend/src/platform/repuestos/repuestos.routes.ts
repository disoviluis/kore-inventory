import { Router, Request, Response, NextFunction } from 'express';
import * as repuestosController from './repuestos.controller';
import { resolveActivosEmpresa, requireActivosPermission } from '../activos/activos.security';

const router = Router();

router.use(resolveActivosEmpresa);

router.get('/bodegas', requireActivosPermission('repuestos', 'view'), repuestosController.listPartWarehouses);
router.get('/referencias-transicion', requireActivosPermission('repuestos', 'view'), repuestosController.getSerializedTransitionReferences);
router.get('/export', requireActivosPermission('repuestos', 'export'), repuestosController.listSpareParts);
router.get('/tipos-compatibles', requireActivosPermission('repuestos', 'view'), repuestosController.listCompatibleAssetTypes);
router.get('/productos-disponibles', requireActivosPermission('repuestos', 'create'), repuestosController.listAvailableProducts);
router.get('/', requireActivosPermission('repuestos', 'view'), repuestosController.listSpareParts);
router.post('/', requireActivosPermission('repuestos', 'create'), repuestosController.createSparePart);
router.put('/:productoId', requireActivosPermission('repuestos', 'edit'), repuestosController.updateSparePart);
router.get('/:productoId/compatibilidad', requireActivosPermission('repuestos', 'view'), repuestosController.listCompatibility);
router.post('/:productoId/compatibilidad', requireActivosPermission('repuestos', 'edit'), repuestosController.addCompatibility);
router.get('/:productoId/unidades', requireActivosPermission('repuestos', 'view'), repuestosController.listSerializedUnits);
router.post('/:productoId/unidades', requireActivosPermission('repuestos', 'create'), repuestosController.registerSerializedUnit);
router.get('/unidades/:unidadId/historial', requireActivosPermission('repuestos', 'view'), repuestosController.getSerializedUnitHistory);
router.post('/unidades/:unidadId/transicion', (req: Request, res: Response, next: NextFunction) => {
	const state = String(req.body.estado || '');
	const action = state === 'installed' ? 'install'
		: state === 'retired' || state === 'unrepairable' ? 'retire'
			: state === 'in_repair' || state === 'quarantine' ? 'repair'
				: state === 'reserved' ? 'assign'
					: 'remove';
	return requireActivosPermission('repuestos', action)(req, res, next);
}, repuestosController.transitionSerializedUnit);

export default router;
