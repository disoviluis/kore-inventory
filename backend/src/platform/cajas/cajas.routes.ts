import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/auth.middleware';
import { verificarEmpresaActiva } from '../../core/middleware/licencia.middleware';
import * as controller from './cajas.controller';

const router = Router();
router.use(authMiddleware, verificarEmpresaActiva);
router.get('/', controller.getCajas);
router.post('/', controller.createCaja);
router.put('/:id', controller.updateCaja);
router.post('/:id/usuarios', controller.asignarUsuario);
router.delete('/:id/usuarios/:usuarioId', controller.desasignarUsuario);

export default router;