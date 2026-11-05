import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/auth.middleware';
import { verificarEmpresaActiva } from '../../core/middleware/licencia.middleware';
import {
  getMatiasConnection,
  saveMatiasConnection,
  probeMatiasConnection,
  revokeMatiasConnection,
  setMatiasService,
  emitMatiasSandboxInvoice,
  previewMatiasSandboxInvoice,
  getMatiasVentaDocument
} from './matias.controller';

const router = Router();

router.get('/:empresaId', authMiddleware, verificarEmpresaActiva, getMatiasConnection);
router.put('/:empresaId', authMiddleware, verificarEmpresaActiva, saveMatiasConnection);
router.post('/:empresaId/probar', authMiddleware, verificarEmpresaActiva, probeMatiasConnection);
router.post('/:empresaId/revocar', authMiddleware, verificarEmpresaActiva, revokeMatiasConnection);
router.put('/:empresaId/servicios/:codigo', authMiddleware, verificarEmpresaActiva, setMatiasService);
router.post('/:empresaId/ventas/:ventaId/emitir-sandbox', authMiddleware, verificarEmpresaActiva, emitMatiasSandboxInvoice);
router.post('/:empresaId/ventas/:ventaId/previsualizar-sandbox', authMiddleware, verificarEmpresaActiva, previewMatiasSandboxInvoice);
router.get('/:empresaId/ventas/:ventaId/documento', authMiddleware, verificarEmpresaActiva, getMatiasVentaDocument);

export default router;
