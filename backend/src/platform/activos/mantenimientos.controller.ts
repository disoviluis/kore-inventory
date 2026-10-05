import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
import { assertBodegasDisponibles } from '../../shared/inventario-bloqueos';

const tenantId = (req: Request): number => Number((req as any).activosEmpresaId);
const actorId = (req: Request): number => Number((req as any).user?.id);
const safeId = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};
const cleanText = (value: unknown, max: number): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
};
const failure = (res: Response, status: number, message: string): Response =>
  res.status(status).json({ success: false, message });

export const listMaintenance = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const state = cleanText(req.query.estado, 30);
  const assetId = req.query.activo_id ? safeId(req.query.activo_id) : null;
  const search = cleanText(req.query.buscar, 100);
  const resultLimit = req.path.endsWith('/export') ? 10000 : 1000;
  if ((req.query.activo_id && !assetId) || (state && !['draft','scheduled','in_progress','waiting_parts','completed','cancelled'].includes(state))) {
    return failure(res, 400, 'Filtro invalido');
  }
  try {
    const rows = await query(
      `SELECT mo.id, mo.codigo, mo.empresa_id, mo.activo_id, mo.tipo_id,
              mo.estado, mo.prioridad, mo.programada_at, mo.iniciada_at, mo.cerrada_at,
              mo.diagnostico, mo.trabajo_realizado, mo.costo_mano_obra, mo.costo_externo,
              a.codigo AS activo_codigo, a.nombre AS activo_nombre, t.nombre AS tipo_nombre,
              CONCAT_WS(' ', tecnico.nombre, tecnico.apellido) AS tecnico_nombre,
              CONCAT_WS(' ', creador.nombre, creador.apellido) AS creador_nombre
       FROM mantenimiento_ordenes mo
       INNER JOIN activos a ON a.id = mo.activo_id AND a.empresa_id = mo.empresa_id
       INNER JOIN mantenimiento_tipos t ON t.id = mo.tipo_id AND t.empresa_id = mo.empresa_id
       LEFT JOIN usuarios tecnico ON tecnico.id = mo.tecnico_id
       LEFT JOIN usuarios creador ON creador.id = mo.created_by
       WHERE mo.empresa_id = ?
         AND (? IS NULL OR mo.estado = ?)
         AND (? IS NULL OR mo.activo_id = ?)
         AND (? IS NULL OR mo.codigo LIKE CONCAT('%', ?, '%') OR a.codigo LIKE CONCAT('%', ?, '%') OR a.nombre LIKE CONCAT('%', ?, '%'))
      ORDER BY COALESCE(mo.programada_at, mo.created_at) DESC, mo.id DESC LIMIT ${resultLimit}`,
      [companyId, state, state, assetId, assetId, search, search, search, search]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al listar mantenimientos:', error);
    return failure(res, 500, 'No se pudieron cargar las órdenes');
  }
};

export const getMaintenanceReferences = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  try {
    const [assets, types, users, warehouses, spareParts] = await Promise.all([
      query(`SELECT id, codigo, nombre, tipo_id FROM activos WHERE empresa_id = ? AND estado <> 'retired' ORDER BY nombre`, [companyId]),
      query(`SELECT id, codigo, nombre FROM mantenimiento_tipos WHERE empresa_id = ? AND estado = 'activo' ORDER BY nombre`, [companyId]),
      query(`SELECT DISTINCT u.id, u.nombre, u.apellido, u.email FROM usuarios u
        LEFT JOIN usuario_empresa ue ON ue.usuario_id = u.id AND ue.empresa_id = ?
        WHERE u.activo = 1 AND ((ue.id IS NOT NULL AND ue.activo = 1) OR (ue.id IS NULL AND u.empresa_id_default = ?))
        ORDER BY u.nombre, u.apellido`, [companyId, companyId]),
      query(`SELECT id, codigo, nombre FROM bodegas WHERE empresa_id = ? AND estado = 'activa' ORDER BY nombre`, [companyId])
      ,query(`SELECT p.id AS producto_id, p.sku, p.nombre, p.unidad_medida,
                    rc.serializado AS controla_seriales, pb.bodega_id, pb.stock_actual, pb.stock_reservado,
                     b.nombre AS bodega_nombre
              FROM repuestos_catalogo rc
              INNER JOIN productos p ON p.id = rc.producto_id AND p.empresa_id = rc.empresa_id
              INNER JOIN productos_bodegas pb ON pb.producto_id = p.id
              INNER JOIN bodegas b ON b.id = pb.bodega_id AND b.empresa_id = rc.empresa_id
              WHERE rc.empresa_id = ? AND rc.estado = 'activo' AND p.estado = 'activo'
              ORDER BY p.nombre, b.nombre`, [companyId])
    ]);
    return res.json({ success: true, data: { activos: assets, tipos: types, tecnicos: users, bodegas: warehouses, repuestos: spareParts } });
  } catch (error) {
    console.error('Error al cargar referencias de mantenimiento:', error);
    return failure(res, 500, 'No se pudieron cargar las referencias');
  }
};

export const listMaintenanceTypes = async (req: Request, res: Response): Promise<Response> => {
  try {
    const rows = await query(
      `SELECT id, codigo, nombre, estado
       FROM mantenimiento_tipos WHERE empresa_id = ? ORDER BY estado = 'activo' DESC, nombre`,
      [tenantId(req)]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al listar tipos de mantenimiento:', error);
    return failure(res, 500, 'No se pudieron cargar los tipos');
  }
};

export const createMaintenanceType = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const code = cleanText(req.body.codigo, 40)?.toLowerCase() || null;
  const name = cleanText(req.body.nombre, 100);
  if (!code || !/^[a-z0-9_-]+$/.test(code) || !name) return failure(res, 400, 'Codigo y nombre de tipo son requeridos');
  try {
    const result = await query(
      `INSERT INTO mantenimiento_tipos (empresa_id, codigo, nombre)
       VALUES (?, ?, ?)`,
      [companyId, code, name]
    );
    return res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return failure(res, 409, 'Ya existe un tipo con ese codigo');
    console.error('Error al crear tipo de mantenimiento:', error);
    return failure(res, 500, 'No se pudo crear el tipo');
  }
};

export const createMaintenance = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const assetId = safeId(req.body.activo_id);
  const typeId = safeId(req.body.tipo_id);
  const technicianId = req.body.tecnico_id ? safeId(req.body.tecnico_id) : null;
  const priority = req.body.prioridad || 'normal';
  if (!assetId || !typeId || (req.body.tecnico_id && !technicianId)
      || !['baja','normal','alta','critica'].includes(priority)) return failure(res, 400, 'Activo, tipo o prioridad invalidos');
  const laborCost = req.body.costo_mano_obra === undefined ? 0 : Number(req.body.costo_mano_obra);
  const externalCost = req.body.costo_externo === undefined ? 0 : Number(req.body.costo_externo);
  if (!Number.isFinite(laborCost) || laborCost < 0 || !Number.isFinite(externalCost) || externalCost < 0
      || Math.round(laborCost * 100) / 100 !== laborCost || Math.round(externalCost * 100) / 100 !== externalCost) {
    return failure(res, 400, 'Costos invalidos');
  }

  try {
    const created = await withTransaction(async (txQuery) => {
      const assets = await txQuery('SELECT id, codigo, tipo_id FROM activos WHERE id = ? AND empresa_id = ? AND estado <> \'retired\' FOR UPDATE', [assetId, companyId]);
      if (!assets.length) throw Object.assign(new Error('Activo no valido para esta empresa'), { status: 400 });
      const types = await txQuery('SELECT id FROM mantenimiento_tipos WHERE id = ? AND empresa_id = ? AND estado = \'activo\' LIMIT 1', [typeId, companyId]);
      if (!types.length) throw Object.assign(new Error('Tipo de mantenimiento no valido'), { status: 400 });
      if (technicianId) {
        const technicians = await txQuery(
          `SELECT u.id FROM usuarios u LEFT JOIN usuario_empresa ue ON ue.usuario_id = u.id AND ue.empresa_id = ?
           WHERE u.id = ? AND u.activo = 1 AND ((ue.id IS NOT NULL AND ue.activo = 1) OR (ue.id IS NULL AND u.empresa_id_default = ?)) LIMIT 1`,
          [companyId, technicianId, companyId]
        );
        if (!technicians.length) throw Object.assign(new Error('Tecnico no pertenece a esta empresa'), { status: 400 });
      }

      await txQuery(`INSERT INTO mantenimiento_consecutivos (empresa_id, prefijo, siguiente)
        VALUES (?, 'MT', 1) ON DUPLICATE KEY UPDATE empresa_id = VALUES(empresa_id)`, [companyId]);
      const counters = await txQuery('SELECT prefijo, siguiente FROM mantenimiento_consecutivos WHERE empresa_id = ? FOR UPDATE', [companyId]);
      const code = `${counters[0].prefijo}${String(counters[0].siguiente).padStart(6, '0')}`;
      await txQuery('UPDATE mantenimiento_consecutivos SET siguiente = siguiente + 1 WHERE empresa_id = ?', [companyId]);
      const inserted = await txQuery(
        `INSERT INTO mantenimiento_ordenes
          (empresa_id, codigo, activo_id, tipo_id, estado, prioridad, solicitada_por, tecnico_id,
           programada_at, diagnostico, trabajo_realizado, costo_mano_obra, costo_externo, observaciones, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [companyId, code, assetId, typeId, req.body.programada_at ? 'scheduled' : 'draft', priority,
          actorId(req), technicianId, req.body.programada_at || null, cleanText(req.body.diagnostico, 8000),
          cleanText(req.body.trabajo_realizado, 8000), laborCost, externalCost,
          cleanText(req.body.observaciones, 8000), actorId(req)]
      );
      await txQuery(
        `INSERT INTO activos_eventos
          (empresa_id, activo_id, tipo_evento, referencia_tipo, referencia_id,
           datos_nuevos, usuario_id, ocurrido_at)
         VALUES (?, ?, 'maintenance_created', 'mantenimiento', ?, ?, ?, NOW())`,
        [companyId, assetId, inserted.insertId, JSON.stringify({ codigo: code, tipo_id: typeId }), actorId(req)]
      );
      return { id: inserted.insertId, codigo: code };
    });
    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return failure(res, 409, 'Codigo de mantenimiento duplicado');
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al crear mantenimiento:', error);
    return failure(res, 500, 'No se pudo crear la orden');
  }
};

export const updateMaintenance = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const orderId = safeId(req.params.id);
  if (!orderId) return failure(res, 400, 'Orden invalida');
  try {
    const result = await withTransaction(async (txQuery) => {
      const rows = await txQuery('SELECT * FROM mantenimiento_ordenes WHERE id = ? AND empresa_id = ? FOR UPDATE', [orderId, companyId]);
      if (!rows.length) throw Object.assign(new Error('Orden no encontrada'), { status: 404 });
      const current = rows[0];
      if (!['draft','scheduled'].includes(current.estado)) throw Object.assign(new Error('Solo se editan ordenes en borrador o programadas'), { status: 409 });
      const newAssetId = req.body.activo_id === undefined ? Number(current.activo_id) : safeId(req.body.activo_id);
      const newTypeId = req.body.tipo_id === undefined ? Number(current.tipo_id) : safeId(req.body.tipo_id);
      if (!newAssetId || !newTypeId) throw Object.assign(new Error('Activo o tipo invalido'), { status: 400 });
      const assets = await txQuery('SELECT id FROM activos WHERE id = ? AND empresa_id = ? AND estado <> \'retired\' LIMIT 1', [newAssetId, companyId]);
      const types = await txQuery('SELECT id FROM mantenimiento_tipos WHERE id = ? AND empresa_id = ? LIMIT 1', [newTypeId, companyId]);
      if (!assets.length || !types.length) throw Object.assign(new Error('Activo o tipo no pertenecen a esta empresa'), { status: 400 });
      const prior = {
        activo_id: current.activo_id, tipo_id: current.tipo_id, estado: current.estado,
        tecnico_id: current.tecnico_id, programada_at: current.programada_at,
        prioridad: current.prioridad, diagnostico: current.diagnostico,
        trabajo_realizado: current.trabajo_realizado, costo_mano_obra: current.costo_mano_obra,
        costo_externo: current.costo_externo, observaciones: current.observaciones
      };
      const nextTechnicianId = req.body.tecnico_id === undefined
        ? current.tecnico_id : req.body.tecnico_id ? safeId(req.body.tecnico_id) : null;
      if (req.body.tecnico_id && !nextTechnicianId) throw Object.assign(new Error('Tecnico invalido'), { status: 400 });
      if (nextTechnicianId) {
        const technicians = await txQuery(
          `SELECT u.id FROM usuarios u LEFT JOIN usuario_empresa ue ON ue.usuario_id = u.id AND ue.empresa_id = ?
           WHERE u.id = ? AND u.activo = 1
             AND ((ue.id IS NOT NULL AND ue.activo = 1) OR (ue.id IS NULL AND u.empresa_id_default = ?)) LIMIT 1`,
          [companyId, nextTechnicianId, companyId]
        );
        if (!technicians.length) throw Object.assign(new Error('Tecnico no pertenece a esta empresa'), { status: 400 });
      }
      const next = {
        activo_id: newAssetId,
        tipo_id: newTypeId,
        tecnico_id: nextTechnicianId,
        programada_at: req.body.programada_at === undefined ? current.programada_at : req.body.programada_at || null,
        prioridad: req.body.prioridad === undefined ? current.prioridad : req.body.prioridad,
        diagnostico: req.body.diagnostico === undefined ? current.diagnostico : cleanText(req.body.diagnostico, 8000),
        trabajo_realizado: req.body.trabajo_realizado === undefined ? current.trabajo_realizado : cleanText(req.body.trabajo_realizado, 8000),
        costo_mano_obra: req.body.costo_mano_obra === undefined ? current.costo_mano_obra : Number(req.body.costo_mano_obra),
        costo_externo: req.body.costo_externo === undefined ? current.costo_externo : Number(req.body.costo_externo),
        observaciones: req.body.observaciones === undefined ? current.observaciones : cleanText(req.body.observaciones, 8000)
      };
      if (!['baja','normal','alta','critica'].includes(next.prioridad)
          || !Number.isFinite(Number(next.costo_mano_obra)) || Number(next.costo_mano_obra) < 0
          || !Number.isFinite(Number(next.costo_externo)) || Number(next.costo_externo) < 0) {
        throw Object.assign(new Error('Prioridad o costo invalido'), { status: 400 });
      }
      if (Math.round(Number(next.costo_mano_obra) * 100) / 100 !== Number(next.costo_mano_obra)
          || Math.round(Number(next.costo_externo) * 100) / 100 !== Number(next.costo_externo)) {
        throw Object.assign(new Error('Los costos admiten maximo dos decimales'), { status: 400 });
      }
      await txQuery(
        `UPDATE mantenimiento_ordenes SET activo_id = ?, tipo_id = ?, tecnico_id = ?, programada_at = ?,
          prioridad = ?, diagnostico = ?, trabajo_realizado = ?, costo_mano_obra = ?, costo_externo = ?,
          observaciones = ?, estado = ?, updated_at = NOW()
         WHERE id = ? AND empresa_id = ?`,
        [next.activo_id, next.tipo_id, next.tecnico_id, next.programada_at, next.prioridad, next.diagnostico,
          next.trabajo_realizado, next.costo_mano_obra, next.costo_externo, next.observaciones,
          next.programada_at ? 'scheduled' : 'draft', orderId, companyId]
      );
      if (Number(current.activo_id) !== next.activo_id) {
        await txQuery(
          `INSERT INTO activos_eventos
            (empresa_id, activo_id, tipo_evento, referencia_tipo, referencia_id,
             datos_anteriores, datos_nuevos, usuario_id, ocurrido_at)
           VALUES (?, ?, 'maintenance_reassigned', 'mantenimiento', ?, ?, ?, ?, NOW())`,
          [companyId, current.activo_id, orderId, JSON.stringify(prior), JSON.stringify(next), actorId(req)]
        );
      }
      await txQuery(
        `INSERT INTO activos_eventos
          (empresa_id, activo_id, tipo_evento, referencia_tipo, referencia_id,
           datos_anteriores, datos_nuevos, usuario_id, ocurrido_at)
         VALUES (?, ?, 'maintenance_updated', 'mantenimiento', ?, ?, ?, ?, NOW())`,
        [companyId, next.activo_id, orderId, JSON.stringify(prior), JSON.stringify(next), actorId(req)]
      );
      return { id: orderId };
    });
    return res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al actualizar orden de mantenimiento:', error);
    return failure(res, 500, 'No se pudo actualizar la orden');
  }
};

export const changeMaintenanceState = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const orderId = safeId(req.params.id);
  const targetState = cleanText(req.body.estado, 30);
  const reason = cleanText(req.body.motivo, 255);
  if (!orderId || !targetState) return failure(res, 400, 'Orden y estado requeridos');
  try {
    const result = await withTransaction(async (txQuery) => {
      const rows = await txQuery('SELECT * FROM mantenimiento_ordenes WHERE id = ? AND empresa_id = ? FOR UPDATE', [orderId, companyId]);
      if (!rows.length) throw Object.assign(new Error('Orden no encontrada'), { status: 404 });
      const order = rows[0];
      const transitions: Record<string, string[]> = {
        draft: ['scheduled','cancelled'],
        scheduled: ['in_progress','cancelled'],
        in_progress: ['waiting_parts','completed','cancelled'],
        waiting_parts: ['in_progress','cancelled'],
        completed: [], cancelled: []
      };
      if (!(transitions[order.estado] || []).includes(targetState)) throw Object.assign(new Error('Transicion de mantenimiento no permitida'), { status: 409 });
      if (targetState === 'cancelled' && !reason) throw Object.assign(new Error('Motivo de cancelacion requerido'), { status: 400 });
      if (targetState === 'completed' && !cleanText(order.trabajo_realizado, 8000) && !cleanText(req.body.trabajo_realizado, 8000)) {
        throw Object.assign(new Error('Registra el trabajo realizado antes de cerrar'), { status: 400 });
      }
      await txQuery(
        `UPDATE mantenimiento_ordenes SET estado = ?,
          iniciada_at = IF(? = 'in_progress' AND iniciada_at IS NULL, NOW(), iniciada_at),
          cerrada_at = IF(? IN ('completed','cancelled'), NOW(), cerrada_at),
          trabajo_realizado = COALESCE(?, trabajo_realizado), observaciones = COALESCE(?, observaciones),
          updated_at = NOW()
         WHERE id = ? AND empresa_id = ?`,
        [targetState, targetState, targetState, cleanText(req.body.trabajo_realizado, 8000),
          cleanText(req.body.observaciones, 8000), orderId, companyId]
      );
      await txQuery(
        `INSERT INTO activos_eventos
          (empresa_id, activo_id, tipo_evento, referencia_tipo, referencia_id,
           motivo, datos_anteriores, datos_nuevos, usuario_id, ocurrido_at)
         VALUES (?, ?, 'maintenance_state_changed', 'mantenimiento', ?, ?, ?, ?, ?, NOW())`,
        [companyId, order.activo_id, orderId, reason,
          JSON.stringify({ estado: order.estado, trabajo_realizado: order.trabajo_realizado, observaciones: order.observaciones }),
          JSON.stringify({ estado: targetState, trabajo_realizado: cleanText(req.body.trabajo_realizado, 8000) ?? order.trabajo_realizado,
            observaciones: cleanText(req.body.observaciones, 8000) ?? order.observaciones }), actorId(req)]
      );
      return { id: orderId, estado: targetState };
    });
    return res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al cambiar estado de mantenimiento:', error);
    return failure(res, 500, 'No se pudo actualizar el estado de la orden');
  }
};

export const listMaintenanceParts = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const orderId = safeId(req.params.id);
  if (!orderId) return failure(res, 400, 'Orden invalida');
  try {
    const rows = await query(
      `SELECT d.id, d.producto_id, d.unidad_serial_id, d.bodega_id, d.operacion,
              d.cantidad, d.movimiento_id, d.motivo_retiro, d.observaciones, d.ocurrido_at,
              p.sku, p.nombre AS producto_nombre, p.unidad_medida,
              u.numero_serie, b.nombre AS bodega_nombre
       FROM mantenimiento_ordenes_repuestos d
       INNER JOIN mantenimiento_ordenes mo ON mo.id = d.mantenimiento_id AND mo.empresa_id = d.empresa_id
      INNER JOIN productos p ON p.id = d.producto_id AND p.empresa_id = d.empresa_id
       LEFT JOIN repuestos_unidades u ON u.id = d.unidad_serial_id AND u.empresa_id = d.empresa_id
       LEFT JOIN bodegas b ON b.id = d.bodega_id AND b.empresa_id = d.empresa_id
       WHERE d.empresa_id = ? AND d.mantenimiento_id = ? ORDER BY d.ocurrido_at DESC, d.id DESC`,
      [companyId, orderId]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al listar repuestos de mantenimiento:', error);
    return failure(res, 500, 'No se pudieron cargar los repuestos usados');
  }
};

export const addMaintenancePart = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const orderId = safeId(req.params.id);
  const productId = safeId(req.body.producto_id);
  const warehouseId = safeId(req.body.bodega_id);
  const quantity = Number(req.body.cantidad);
  const operation = req.body.operacion;
  if (!orderId || !productId || !warehouseId || !Number.isFinite(quantity) || quantity <= 0
      || Math.round(quantity * 1000) / 1000 !== quantity
      || !['consumido','retirado','devuelto'].includes(operation)
      || (operation === 'retirado' && !cleanText(req.body.motivo_retiro, 255))) {
    return failure(res, 400, 'Orden, producto, bodega, cantidad y tipo de movimiento son requeridos');
  }

  try {
    const result = await withTransaction(async (txQuery) => {
      const orders = await txQuery(
        `SELECT mo.id, mo.activo_id, a.tipo_id, mo.estado
         FROM mantenimiento_ordenes mo INNER JOIN activos a ON a.id = mo.activo_id AND a.empresa_id = mo.empresa_id
         WHERE mo.id = ? AND mo.empresa_id = ? FOR UPDATE`,
        [orderId, companyId]
      );
      if (!orders.length) throw Object.assign(new Error('Orden no encontrada'), { status: 404 });
      if (!['in_progress','waiting_parts'].includes(orders[0].estado)) throw Object.assign(new Error('La orden no esta en ejecucion'), { status: 409 });
      const products = await txQuery(
        `SELECT p.id, p.stock_actual, p.maneja_inventario, rc.serializado AS controla_seriales
         FROM productos p INNER JOIN repuestos_catalogo rc ON rc.producto_id = p.id AND rc.empresa_id = p.empresa_id
         WHERE p.id = ? AND p.empresa_id = ? AND p.estado = 'activo'
           AND p.tipo = 'producto' AND p.maneja_inventario = 1 AND rc.estado = 'activo' FOR UPDATE`,
        [productId, companyId]
      );
      if (!products.length) throw Object.assign(new Error('Producto no configurado como repuesto'), { status: 400 });
      if (Number(products[0].controla_seriales) === 1) throw Object.assign(new Error('Repuesto serializado: registra la transicion de la unidad serial'), { status: 409 });
      const compatible = await txQuery(
        `SELECT id FROM repuestos_compatibilidad WHERE empresa_id = ? AND producto_id = ? AND activo_tipo_id = ? LIMIT 1`,
        [companyId, productId, orders[0].tipo_id]
      );
      if (!compatible.length) throw Object.assign(new Error('El repuesto no es compatible con el activo'), { status: 409 });
      const warehouses = await txQuery(`SELECT id FROM bodegas WHERE id = ? AND empresa_id = ? AND estado = 'activa' LIMIT 1`, [warehouseId, companyId]);
      if (!warehouses.length) throw Object.assign(new Error('Bodega no valida para esta empresa'), { status: 400 });
      await assertBodegasDisponibles(txQuery, [warehouseId]);
      const stockRows = await txQuery(
        `SELECT stock_actual, stock_reservado FROM productos_bodegas
         WHERE producto_id = ? AND bodega_id = ? FOR UPDATE`,
        [productId, warehouseId]
      );
      if (!stockRows.length) throw Object.assign(new Error('No hay stock del repuesto en esta bodega'), { status: 409 });

      const stockBefore = Number(stockRows[0].stock_actual);
      const reserved = Number(stockRows[0].stock_reservado);
      const delta = operation === 'consumido' ? -quantity : quantity;
      if (delta < 0 && stockBefore - reserved < quantity) throw Object.assign(new Error('Stock disponible insuficiente'), { status: 409 });
      const stockAfter = stockBefore + delta;
      await txQuery(
        'UPDATE productos_bodegas SET stock_actual = ? WHERE producto_id = ? AND bodega_id = ?',
        [stockAfter, productId, warehouseId]
      );
      const stockTotal = await txQuery(
        `SELECT COALESCE(SUM(pb.stock_actual), 0) AS total
         FROM productos_bodegas pb INNER JOIN bodegas b ON b.id = pb.bodega_id AND b.empresa_id = ?
         WHERE pb.producto_id = ?`,
        [companyId, productId]
      );
      await txQuery('UPDATE productos SET stock_actual = ?, updated_at = NOW() WHERE id = ? AND empresa_id = ?', [stockTotal[0].total, productId, companyId]);
      const movement = await txQuery(
        `INSERT INTO inventario_movimientos
          (producto_id, bodega_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
           motivo, referencia_tipo, referencia_id, usuario_id, fecha, notas)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'mantenimiento', ?, ?, NOW(), ?)`,
        [productId, warehouseId, delta > 0 ? 'entrada' : 'salida', Math.abs(delta), stockBefore,
          stockAfter, `mantenimiento_${operation}`, orderId, actorId(req), cleanText(req.body.observaciones, 1000)]
      );
      const detail = await txQuery(
        `INSERT INTO mantenimiento_ordenes_repuestos
          (empresa_id, mantenimiento_id, producto_id, unidad_serial_id, bodega_id, operacion,
           cantidad, movimiento_id, motivo_retiro, observaciones, usuario_id, ocurrido_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [companyId, orderId, productId, warehouseId, operation, quantity, movement.insertId,
          cleanText(req.body.motivo_retiro, 255), cleanText(req.body.observaciones, 4000), actorId(req)]
      );
      await txQuery(
        `INSERT INTO activos_eventos
          (empresa_id, activo_id, tipo_evento, referencia_tipo, referencia_id,
           datos_nuevos, usuario_id, ocurrido_at)
         VALUES (?, ?, 'spare_part_moved', 'mantenimiento', ?, ?, ?, NOW())`,
        [companyId, orders[0].activo_id, orderId, JSON.stringify({ producto_id: productId, cantidad: quantity, operacion: operation }), actorId(req)]
      );
      return { id: detail.insertId, movimiento_id: movement.insertId };
    });
    return res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al registrar repuesto de mantenimiento:', error);
    return failure(res, 500, 'No se pudo registrar el repuesto');
  }
};
