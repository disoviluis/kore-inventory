import { Router } from 'express';
import { listarPlanCuentas, crearCuenta, inactivarCuenta } from './contabilidad.controller';

const router = Router();

router.get('/plan-cuentas', listarPlanCuentas);
router.post('/plan-cuentas', crearCuenta);
router.patch('/plan-cuentas/:id/inactivar', inactivarCuenta);

export default router;