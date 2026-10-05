import { Router, Request, Response, NextFunction } from 'express';
import * as mantenimientoController from './mantenimientos.controller';
import { requireActivosPermission, resolveActivosEmpresa } from './activos.security';

const router = Router();
router.use(resolveActivosEmpresa);

router.get('/referencias', requireActivosPermission('mantenimientos', 'view'), mantenimientoController.getMaintenanceReferences);
router.get('/tipos', requireActivosPermission('mantenimientos', 'view'), mantenimientoController.listMaintenanceTypes);
router.post('/tipos', requireActivosPermission('mantenimientos', 'create'), mantenimientoController.createMaintenanceType);
router.get('/export', requireActivosPermission('mantenimientos', 'export'), mantenimientoController.listMaintenance);
router.get('/', requireActivosPermission('mantenimientos', 'view'), mantenimientoController.listMaintenance);
router.post('/', requireActivosPermission('mantenimientos', 'create'), mantenimientoController.createMaintenance);
router.get('/:id/partes', requireActivosPermission('mantenimientos', 'view'), mantenimientoController.listMaintenanceParts);
router.post('/:id/partes', requireActivosPermission('mantenimientos', 'edit'), mantenimientoController.addMaintenancePart);
router.put('/:id', requireActivosPermission('mantenimientos', 'edit'), mantenimientoController.updateMaintenance);
router.patch('/:id/estado', (req: Request, res: Response, next: NextFunction) => {
  const permission = req.body.estado === 'completed' ? 'close' : 'edit';
  return requireActivosPermission('mantenimientos', permission)(req, res, next);
}, mantenimientoController.changeMaintenanceState);

export default router;
