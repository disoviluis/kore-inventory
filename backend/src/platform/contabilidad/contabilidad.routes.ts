import { Router } from 'express';
import { obtenerRequisitosEmpresa, listarPlanCuentas, crearCuenta, editarCuenta, inactivarCuenta } from './contabilidad.controller';
import { requirePermission } from '../../core/middleware/permissions.middleware';

const router = Router();

router.get('/requisitos/:empresaId', obtenerRequisitosEmpresa);
router.get('/plan-cuentas', requirePermission('contabilidad', 'view'), listarPlanCuentas);
router.post('/plan-cuentas', requirePermission('contabilidad', 'create'), crearCuenta);
router.put('/plan-cuentas/:id', requirePermission('contabilidad', 'edit'), editarCuenta);
router.patch('/plan-cuentas/:id/inactivar', requirePermission('contabilidad', 'edit'), inactivarCuenta);

export default router;