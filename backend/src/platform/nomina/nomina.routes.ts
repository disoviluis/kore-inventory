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
  listarUsuariosDisponibles,
  listarPeriodos,
  crearPeriodo,
  calcularPeriodo,
  listarLiquidaciones
  ,listarMetas,
    crearMeta,
    listarConceptos,
    listarNovedades,
    crearNovedad,
    aprobarNovedad,
    listarPrestamos,
    crearPrestamo,
    anularPrestamo,
    obtenerConfiguracionNomina,
    actualizarConfiguracionNomina,
    aprobarPeriodo,
    pagarLiquidacion
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
router.get('/periodos', requirePermission('nomina_periodos', 'view'), listarPeriodos);
router.post('/periodos', requirePermission('nomina_periodos', 'create'), crearPeriodo);
router.post('/periodos/:periodoId/calcular', requirePermission('nomina_periodos', 'approve'), calcularPeriodo);
router.post('/periodos/:periodoId/aprobar', requirePermission('nomina_periodos', 'approve'), aprobarPeriodo);
router.get('/periodos/:periodoId/liquidaciones', requirePermission('nomina_periodos', 'view'), listarLiquidaciones);
router.post('/liquidaciones/:liquidacionId/pagar', requirePermission('nomina_periodos', 'approve'), pagarLiquidacion);
router.get('/metas', requirePermission('nomina_metas', 'view'), listarMetas);
router.post('/metas', requirePermission('nomina_metas', 'create'), crearMeta);
router.get('/conceptos', requirePermission('nomina_novedades', 'view'), listarConceptos);
router.get('/novedades', requirePermission('nomina_novedades', 'view'), listarNovedades);
router.post('/novedades', requirePermission('nomina_novedades', 'create'), crearNovedad);
router.post('/novedades/:novedadId/aprobar', requirePermission('nomina_novedades', 'approve'), aprobarNovedad);
router.get('/prestamos', requirePermission('nomina_empleados', 'view'), listarPrestamos);
router.post('/prestamos', requirePermission('nomina_empleados', 'create'), crearPrestamo);
router.post('/prestamos/:prestamoId/anular', requirePermission('nomina_empleados', 'edit'), anularPrestamo);
router.get('/configuracion', requirePermission('nomina_periodos', 'view'), obtenerConfiguracionNomina);
router.put('/configuracion', requirePermission('nomina_periodos', 'edit'), actualizarConfiguracionNomina);

export default router;
