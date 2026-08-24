import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/auth.middleware';
import { requirePermission } from '../../core/middleware/permissions.middleware';
import {
  listarEmpleados,
  obtenerEmpleado,
  crearEmpleado,
  actualizarEmpleado,
  vincularUsuario,
  desvincularUsuario,
  listarUsuariosDisponibles
} from './nomina-empleados.controller';

const router = Router();
router.use(authMiddleware);

router.get('/empleados', requirePermission('nomina_empleados', 'view'), listarEmpleados);
router.get('/empleados/usuarios-disponibles', requirePermission('nomina_empleados', 'view'), listarUsuariosDisponibles);
router.get('/empleados/:id', requirePermission('nomina_empleados', 'view'), obtenerEmpleado);
router.post('/empleados', requirePermission('nomina_empleados', 'create'), crearEmpleado);
router.put('/empleados/:id', requirePermission('nomina_empleados', 'edit'), actualizarEmpleado);
router.post('/empleados/:id/vincular-usuario', requirePermission('nomina_empleados', 'edit'), vincularUsuario);
router.delete('/empleados/:id/usuario', requirePermission('nomina_empleados', 'edit'), desvincularUsuario);

export default router;
