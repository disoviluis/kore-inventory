/**
 * ROUTES: TRASLADOS ENTRE BODEGAS
 * Endpoints para gestión de traslados y módulo de mensajero
 */

import { Router } from 'express';
import { 
  getTraslados,
  getTrasladoById,
  createTraslado,
  aprobarTraslado,
  enviarTraslado,
  recibirTraslado,
  cancelarTraslado,
  getMisTrasladosMensajero
} from './traslados.controller';
import { authenticateToken } from '../../core/auth/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * GET /api/traslados
 * Lista traslados con filtros
 * Query: empresa_id, estado, mensajero_id, fecha_desde, fecha_hasta
 */
router.get('/', getTraslados);

/**
 * GET /api/traslados/mensajero/mis-traslados
 * Módulo de mensajero: lista traslados asignados
 */
router.get('/mensajero/mis-traslados', getMisTrasladosMensajero);

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
 */
router.post('/', createTraslado);

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
 * PUT /api/traslados/:id/recibir
 * Recibe un traslado con firma digital
 * Body: productos_recibidos[], firma_recepcion, gps_latitud, gps_longitud
 */
router.put('/:id/recibir', recibirTraslado);

/**
 * PUT /api/traslados/:id/cancelar
 * Cancela un traslado
 * Body: motivo_cancelacion
 */
router.put('/:id/cancelar', cancelarTraslado);

export default router;
