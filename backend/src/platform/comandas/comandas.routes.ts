import { Router } from 'express';
import { authMiddleware } from '../../core/middleware/auth.middleware';
import { verificarEmpresaActiva } from '../../core/middleware/licencia.middleware';
import {
  listarMesas,
  crearComanda,
  misComandas,
  tableroCocina,
  cambiarEstadoItem,
  resumenCuenta,
  registrarPropina,
  solicitarCuentaMesa
} from './comandas.controller';

const router = Router();

router.use(authMiddleware);

router.get('/mesas', listarMesas);
router.get('/mis-comandas', misComandas);
router.get('/tablero', tableroCocina);

router.post('/', verificarEmpresaActiva, crearComanda);
router.put('/items/:id/estado', verificarEmpresaActiva, cambiarEstadoItem);

router.get('/cuenta/:cuentaId/resumen', resumenCuenta);
router.post('/cuenta/:cuentaId/propina', verificarEmpresaActiva, registrarPropina);
router.post('/cuenta/:cuentaId/solicitar', verificarEmpresaActiva, solicitarCuentaMesa);

export default router;
