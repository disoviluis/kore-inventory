import { Router, Request, Response, NextFunction } from 'express';
import * as evidenciasController from './evidencias.controller';
import { requireActivosPermission, resolveActivosEmpresa } from '../activos/activos.security';

const router = Router();
router.use(resolveActivosEmpresa);

const permissionByType: Record<string, { module: string; view: string; write: string }> = {
  activo: { module: 'activos', view: 'view', write: 'edit' },
  mantenimiento: { module: 'mantenimientos', view: 'view', write: 'edit' },
  repuesto: { module: 'repuestos', view: 'view', write: 'edit' },
  inventario: { module: 'inventarios_fisicos', view: 'view_results', write: 'edit' },
  sesion_conteo: { module: 'inventarios_fisicos', view: 'count', write: 'count' },
  ajuste: { module: 'ajustes_inventario', view: 'view', write: 'create' }
};

const requireEvidencePermission = (write: boolean) => (req: Request, res: Response, next: NextFunction): void => {
  const permission = permissionByType[req.params.tipo];
  if (!permission) {
    res.status(404).json({ success: false, message: 'Tipo de evidencia no soportado' });
    return;
  }
  requireActivosPermission(permission.module, write ? permission.write : permission.view)(req, res, next);
};

router.get('/:tipo/:id', requireEvidencePermission(false), evidenciasController.listEvidence);
router.post('/:tipo/:id/upload-url', requireEvidencePermission(true), evidenciasController.createEvidenceUploadUrl);
router.post('/:tipo/:id/confirmar', requireEvidencePermission(true), evidenciasController.finalizeEvidenceUpload);

export default router;