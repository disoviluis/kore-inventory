import { Router, Request, Response, NextFunction } from 'express';
import * as inventariosController from './inventarios-fisicos.controller';
import { requireActivosPermission, resolveActivosEmpresa } from '../activos/activos.security';

const router = Router();
router.use(resolveActivosEmpresa);

router.get('/', requireActivosPermission('inventarios_fisicos', 'view'), inventariosController.listInventories);
router.post('/', requireActivosPermission('inventarios_fisicos', 'create'), inventariosController.createInventory);
router.get('/referencias', requireActivosPermission('inventarios_fisicos', 'create'), inventariosController.getInventoryReferences);
router.get('/ajustes', requireActivosPermission('ajustes_inventario', 'view'), inventariosController.listAdjustments);
router.get('/ajustes/export', requireActivosPermission('ajustes_inventario', 'export'), inventariosController.listAdjustments);
router.get('/:id', requireActivosPermission('inventarios_fisicos', 'view'), inventariosController.getInventory);
router.get('/:id/eventos', requireActivosPermission('inventarios_fisicos', 'view_results'), inventariosController.listInventoryEvents);
router.get('/:id/export', requireActivosPermission('inventarios_fisicos', 'export'), inventariosController.listInventoryResults);
router.post('/sesiones/:sesionId/iniciar', requireActivosPermission('inventarios_fisicos', 'count'), inventariosController.startCountSession);
router.get('/sesiones/:sesionId/productos', requireActivosPermission('inventarios_fisicos', 'count'), inventariosController.listCountProducts);
router.get('/sesiones/:sesionId/seriales', requireActivosPermission('inventarios_fisicos', 'count'), inventariosController.getSessionSerialUnit);
router.get('/sesiones/:sesionId/lineas', requireActivosPermission('inventarios_fisicos', 'count'), inventariosController.listCountLines);
router.post('/sesiones/:sesionId/lineas', requireActivosPermission('inventarios_fisicos', 'count'), inventariosController.captureCountLine);
router.put('/sesiones/:sesionId/productos/:productoId/cobertura', requireActivosPermission('inventarios_fisicos', 'count'), inventariosController.setProductCoverage);
router.delete('/lineas/:lineaId', requireActivosPermission('inventarios_fisicos', 'count'), inventariosController.voidCountLine);
router.post('/sesiones/:sesionId/cerrar', requireActivosPermission('inventarios_fisicos', 'close'), inventariosController.closeCountSession);
router.post('/sesiones/:sesionId/reabrir', requireActivosPermission('inventarios_fisicos', 'reopen'), inventariosController.reopenCountSession);
router.post('/:id/comparar', requireActivosPermission('inventarios_fisicos', 'reconcile'), inventariosController.compareInventory);
router.get('/:id/resultados', requireActivosPermission('inventarios_fisicos', 'view_results'), inventariosController.listInventoryResults);
router.post('/:id/resolver-diferencia', requireActivosPermission('inventarios_fisicos', 'review'), inventariosController.resolveInventoryDifference);
router.post('/:id/aprobar-conciliacion', requireActivosPermission('inventarios_fisicos', 'approve'), inventariosController.approveInventoryReconciliation);
router.post('/:id/cerrar', requireActivosPermission('inventarios_fisicos', 'close'), inventariosController.closeInventory);
router.post('/:id/rondas-adicionales', requireActivosPermission('inventarios_fisicos', 'approve'), inventariosController.authorizeExtraRound);
router.post('/:id/solicitudes-ajuste', requireActivosPermission('ajustes_inventario', 'create'), inventariosController.createAdjustmentRequest);
router.patch('/ajustes/:ajusteId/revision', (req: Request, res: Response, next: NextFunction) => {
  const action = req.body.estado === 'approved' ? 'approve' : 'review';
  return requireActivosPermission('ajustes_inventario', action)(req, res, next);
}, inventariosController.reviewAdjustment);
router.post('/ajustes/:ajusteId/aplicar', (req: Request, res: Response, next: NextFunction) => {
  return requireActivosPermission('ajustes_inventario', 'apply')(req, res, next);
}, inventariosController.applyAdjustment);

export default router;
