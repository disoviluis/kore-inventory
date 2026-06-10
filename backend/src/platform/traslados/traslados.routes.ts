/**
 * ROUTES: TRASLADOS ENTRE BODEGAS
 * Endpoints para gestión de traslados y módulo de mensajero
 */

import { Router } from 'express';
import { 
  getTraslados,
  getTrasladoById,
  createTraslado,
  confirmarTraslado,
  aprobarTraslado,
  enviarTraslado,
  iniciarEntrega,
  recibirTraslado,
  cancelarTraslado,
  getMisTrasladosMensajero
} from './traslados.controller';
import { authMiddleware } from '../../core/middleware/auth.middleware';
import { requirePermission, requireModuleAccess } from '../../core/middleware/permissions.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * GET /api/traslados
 * Lista traslados con filtros
 * Query: empresa_id, estado, mensajero_id, fecha_desde, fecha_hasta
 * ⚠️ Requiere permiso: view en traslados
 */
router.get('/', requireModuleAccess('traslados'), getTraslados);

/**
 * GET /api/traslados/mensajero/mis-traslados
 * Módulo de mensajero: lista traslados asignados
 * ⚠️ Requiere permiso: view_own en traslados
 */
router.get('/mensajero/mis-traslados', requirePermission('traslados', 'view_own'), getMisTrasladosMensajero);

/**
 * GET /api/traslados/:id
 * Obtiene un traslado específico con detalle
 */
router.get('/:id', getTrasladoById);

/**
 * POST /api/traslados
 * Crea un nuevo traslado
 * Body: empresa_id, bodega_origen_id, bodega_destino_id, motivo, 
 *       destinatario_nombre, destinatario_documento, productos[]
 * ⚠️ CRÍTICO: Requiere permiso CREATE - Mensajero NO debe tener este permiso
 */
router.post('/', requirePermission('traslados', 'create'), createTraslado);

/**
 * PUT /api/traslados/:id/confirmar
 * Flujo directo: confirma y ejecuta traslado en un solo paso (borrador → recibido)
 */
router.put('/:id/confirmar', confirmarTraslado);

/**
 * PUT /api/traslados/:id/aprobar
 * Aprueba un traslado pendiente
 * Body: productos_aprobados[] (opcional)
 */
router.put('/:id/aprobar', aprobarTraslado);

/**
 * PUT /api/traslados/:id/enviar
 * Despacha un traslado (sale de bodega origen)
 * Body: mensajero_id (opcional)
 */
router.put('/:id/enviar', enviarTraslado);

/**
 * PUT /api/traslados/:id/iniciar
 * Mensajero inicia la entrega (marca que salió a entregar)
 * ⚠️ Requiere permiso: deliver en traslados
 */
router.put('/:id/iniciar', requirePermission('traslados', 'deliver'), iniciarEntrega);

/**
 * PUT /api/traslados/:id/recibir
 * Recibe un traslado con firma digital
 * Body: productos_recibidos[], firma_recepcion, gps_latitud, gps_longitud
 * ⚠️ Requiere permiso: receive en traslados
 */
router.put('/:id/recibir', requirePermission('traslados', 'receive'), recibirTraslado);

/**
 * PUT /api/traslados/:id/cancelar
 * Cancela un traslado
 * Body: motivo_cancelacion
 */
router.put('/:id/cancelar', cancelarTraslado);

export default router;
