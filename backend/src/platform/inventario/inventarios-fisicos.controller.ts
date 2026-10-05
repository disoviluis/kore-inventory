import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
import { evaluateRoundConsensus } from './reconciliation.rules';

const tenantId = (req: Request): number => Number((req as any).activosEmpresaId);
const actorId = (req: Request): number => Number((req as any).user?.id);
const idValue = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};
const textValue = (value: unknown, max: number): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
};
const failure = (res: Response, status: number, message: string): Response =>
  res.status(status).json({ success: false, message });
const event = async (tx: (sql: string, params?: any[]) => Promise<any>, data: any): Promise<void> => {
  await tx(
    `INSERT INTO inventarios_eventos
      (empresa_id, inventario_id, bodega_id, sesion_id, tipo_evento, motivo, datos_anteriores, datos_nuevos, usuario_id, ocurrido_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [data.empresa_id, data.inventario_id, data.bodega_id || null, data.sesion_id || null,
      data.tipo_evento, data.motivo || null, data.anteriores ? JSON.stringify(data.anteriores) : null,
      data.nuevos ? JSON.stringify(data.nuevos) : null, data.usuario_id]
  );
};

export const listInventories = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  try {
    const rows = await query(
      `SELECT i.id, i.codigo, i.nombre, i.estado, i.ventana_inicio, i.ventana_fin,
              i.max_rondas, i.corte_stock_at, i.created_at,
              COUNT(DISTINCT ib.id) AS total_bodegas,
              COUNT(DISTINCT CASE WHEN ib.estado IN ('reconciled','closed') THEN ib.id END) AS bodegas_cerradas,
              COUNT(DISTINCT s.id) AS sesiones,
              COUNT(DISTINCT CASE WHEN s.estado IN ('completed','locked') THEN s.id END) AS sesiones_completadas
       FROM inventarios_fisicos i
       LEFT JOIN inventarios_fisicos_bodegas ib ON ib.inventario_id = i.id AND ib.empresa_id = i.empresa_id
       LEFT JOIN inventarios_sesiones s ON s.inventario_bodega_id = ib.id AND s.empresa_id = i.empresa_id
       WHERE i.empresa_id = ?
       GROUP BY i.id
       ORDER BY i.created_at DESC, i.id DESC`,
      [companyId]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al listar inventarios fisicos:', error);
    return failure(res, 500, 'No se pudieron cargar los inventarios');
  }
};

export const getInventoryReferences = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  try {
    const [warehouses, users] = await Promise.all([
      query(`SELECT id, codigo, nombre, estado FROM bodegas WHERE empresa_id = ? AND estado = 'activa' ORDER BY nombre`, [companyId]),
      query(
        `SELECT DISTINCT u.id, u.nombre, u.apellido, u.email
         FROM usuarios u LEFT JOIN usuario_empresa ue ON ue.usuario_id = u.id AND ue.empresa_id = ?
         WHERE u.activo = 1 AND ((ue.id IS NOT NULL AND ue.activo = 1)
           OR (ue.id IS NULL AND u.empresa_id_default = ?))
         ORDER BY u.nombre, u.apellido`,
        [companyId, companyId]
      )
    ]);
    return res.json({ success: true, data: { bodegas: warehouses, integrantes: users } });
  } catch (error) {
    console.error('Error al cargar referencias de inventario:', error);
    return failure(res, 500, 'No se pudieron cargar las referencias');
  }
};

export const createInventory = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const code = textValue(req.body.codigo, 50);
  const name = textValue(req.body.nombre, 160);
  const warehouses = Array.isArray(req.body.bodegas) ? req.body.bodegas.map(idValue) : [];
  const maxRounds = Number(req.body.max_rondas || 2);
  const start = req.body.ventana_inicio || null;
  const end = req.body.ventana_fin || null;
  const team1 = Array.isArray(req.body.equipos?.c1) ? req.body.equipos.c1.map(idValue) : [];
  const team2 = Array.isArray(req.body.equipos?.c2) ? req.body.equipos.c2.map(idValue) : [];
  if (!code || !name || !warehouses.length || warehouses.some((id: number | null) => !id)
      || new Set(warehouses).size !== warehouses.length || !Number.isInteger(maxRounds) || maxRounds < 2 || maxRounds > 10) {
    return failure(res, 400, 'Codigo, nombre, bodegas unicas y maximo de rondas (2-10) son requeridos');
  }
  if (!team1.length || !team2.length || team1.some((id: number | null) => !id)
      || team2.some((id: number | null) => !id)
      || new Set([...team1, ...team2]).size !== team1.length + team2.length) {
    return failure(res, 400, 'C1 y C2 requieren equipos validos y sin integrantes compartidos');
  }
  if ((start && !Number.isFinite(new Date(start).getTime())) || (end && !Number.isFinite(new Date(end).getTime()))) {
    return failure(res, 400, 'Las fechas de la ventana no son validas');
  }
  if (start && end && new Date(start).getTime() >= new Date(end).getTime()) return failure(res, 400, 'La ventana final debe ser posterior a la inicial');

  try {
    const inventory = await withTransaction(async (tx) => {
      const warehouseRows = await tx(
        `SELECT id FROM bodegas WHERE empresa_id = ? AND estado = 'activa' AND id IN (${warehouses.map(() => '?').join(',')}) FOR UPDATE`,
        [companyId, ...warehouses]
      );
      if (warehouseRows.length !== warehouses.length) throw Object.assign(new Error('Una o mas bodegas no pertenecen a esta empresa o estan inactivas'), { status: 400 });
      const inserted = await tx(
        `INSERT INTO inventarios_fisicos
          (empresa_id, codigo, nombre, estado, ventana_inicio, ventana_fin, max_rondas, created_by)
         VALUES (?, ?, ?, 'scheduled', ?, ?, ?, ?)`,
        [companyId, code, name, start, end, maxRounds, actorId(req)]
      );
      const inventoryId = Number(inserted.insertId);
      const bodegaRows: Array<{ id: number; bodega_id: number }> = [];
      for (const warehouseId of warehouses as number[]) {
        const result = await tx(
          `INSERT INTO inventarios_fisicos_bodegas (empresa_id, inventario_id, bodega_id)
           VALUES (?, ?, ?)`,
          [companyId, inventoryId, warehouseId]
        );
        bodegaRows.push({ id: Number(result.insertId), bodega_id: warehouseId });
      }
      const rounds: Array<{ id: number; numero: number }> = [];
      for (const roundNumber of [1, 2]) {
        const responsibleId = (roundNumber === 1 ? team1[0] : team2[0]) as number;
        const round = await tx(
          `INSERT INTO inventarios_rondas
            (empresa_id, inventario_id, numero, estado, responsable_id)
           VALUES (?, ?, ?, 'not_started', ?)`,
          [companyId, inventoryId, roundNumber, responsibleId]
        );
        rounds.push({ id: Number(round.insertId), numero: roundNumber });
      }
      const sessionRows: Array<{ round_id: number; session_id: number; warehouse_id: number }> = [];
      for (const round of rounds) {
        for (const warehouse of bodegaRows) {
          const session = await tx(
            `INSERT INTO inventarios_sesiones
              (empresa_id, ronda_id, inventario_bodega_id, estado)
             VALUES (?, ?, ?, 'not_started')`,
            [companyId, round.id, warehouse.id]
          );
          sessionRows.push({ round_id: round.id, session_id: Number(session.insertId), warehouse_id: warehouse.id });
        }
      }
      for (const session of sessionRows) {
        const team = (session.round_id === rounds[0].id ? team1 : team2) as number[];
        for (const memberId of team) {
          const users = await tx(
            `SELECT u.id FROM usuarios u LEFT JOIN usuario_empresa ue ON ue.usuario_id = u.id AND ue.empresa_id = ?
             WHERE u.id = ? AND u.activo = 1
               AND ((ue.id IS NOT NULL AND ue.activo = 1) OR (ue.id IS NULL AND u.empresa_id_default = ?)) LIMIT 1`,
            [companyId, memberId, companyId]
          );
          if (!users.length) throw Object.assign(new Error('Integrante no pertenece a esta empresa'), { status: 400 });
          await tx(
            `INSERT INTO inventarios_sesiones_integrantes (empresa_id, sesion_id, usuario_id, rol, agregado_por)
             VALUES (?, ?, ?, ?, ?)`,
            [companyId, session.session_id, memberId, Number(memberId) === team[0] ? 'responsable' : 'apoyo', actorId(req)]
          );
        }
      }
      await event(tx, { empresa_id: companyId, inventario_id: inventoryId, tipo_evento: 'inventory_created',
        usuario_id: actorId(req), nuevos: { codigo: code, bodegas: warehouses, equipos: { c1: team1, c2: team2 }, max_rondas: maxRounds } });
      return { id: inventoryId, codigo: code };
    });
    return res.status(201).json({ success: true, data: inventory });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return failure(res, 409, 'Ya existe un inventario con ese codigo');
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al crear inventario fisico:', error);
    return failure(res, 500, 'No se pudo crear el inventario');
  }
};

export const getInventory = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const inventoryId = idValue(req.params.id);
  if (!inventoryId) return failure(res, 400, 'Inventario invalido');
  try {
    const inventories = await query(
      `SELECT id, empresa_id, codigo, nombre, estado, ventana_inicio, ventana_fin,
              max_rondas, corte_stock_at, created_by, closed_by, closed_at, created_at
       FROM inventarios_fisicos WHERE id = ? AND empresa_id = ? LIMIT 1`,
      [inventoryId, companyId]
    );
    if (!inventories.length) return failure(res, 404, 'Inventario no encontrado');
    const warehouses = await query(
      `SELECT ib.id, ib.bodega_id, b.codigo, b.nombre, ib.estado, ib.iniciada_at, ib.cerrada_at
       FROM inventarios_fisicos_bodegas ib
       INNER JOIN bodegas b ON b.id = ib.bodega_id AND b.empresa_id = ib.empresa_id
       WHERE ib.empresa_id = ? AND ib.inventario_id = ? ORDER BY b.nombre`,
      [companyId, inventoryId]
    );
    const rounds = await query(
      `SELECT r.id, r.numero, r.estado, r.responsable_id, r.iniciada_at, r.terminada_at,
              s.id AS sesion_id, s.inventario_bodega_id, s.estado AS sesion_estado,
              b.bodega_id, bd.nombre AS bodega_nombre
       FROM inventarios_rondas r
       LEFT JOIN inventarios_sesiones s ON s.ronda_id = r.id AND s.empresa_id = r.empresa_id
       LEFT JOIN inventarios_fisicos_bodegas b ON b.id = s.inventario_bodega_id AND b.empresa_id = s.empresa_id
       LEFT JOIN bodegas bd ON bd.id = b.bodega_id AND bd.empresa_id = b.empresa_id
       WHERE r.empresa_id = ? AND r.inventario_id = ? ORDER BY r.numero, bd.nombre`,
      [companyId, inventoryId]
    );
    return res.json({ success: true, data: { ...inventories[0], bodegas: warehouses, rondas: rounds } });
  } catch (error) {
    console.error('Error al consultar inventario:', error);
    return failure(res, 500, 'No se pudo cargar el inventario');
  }
};

export const listInventoryEvents = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const inventoryId = idValue(req.params.id);
  if (!inventoryId) return failure(res, 400, 'Inventario invalido');
  try {
    const rows = await query(
      `SELECT e.id, e.bodega_id, b.nombre AS bodega_nombre, e.sesion_id,
              e.tipo_evento, e.motivo, e.datos_anteriores, e.datos_nuevos, e.ocurrido_at,
              CONCAT_WS(' ', u.nombre, u.apellido) AS usuario_nombre
       FROM inventarios_eventos e
       LEFT JOIN bodegas b ON b.id = e.bodega_id AND b.empresa_id = e.empresa_id
       LEFT JOIN usuarios u ON u.id = e.usuario_id
       WHERE e.empresa_id = ? AND e.inventario_id = ?
       ORDER BY e.ocurrido_at DESC, e.id DESC LIMIT 250`,
      [companyId, inventoryId]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al listar eventos de inventario:', error);
    return failure(res, 500, 'No se pudo cargar el historial');
  }
};

export const startCountSession = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const sessionId = idValue(req.params.sesionId);
  if (!sessionId) return failure(res, 400, 'Sesion invalida');
  try {
    const started = await withTransaction(async (tx) => {
      const sessions = await tx(
        `SELECT s.id, s.estado, s.ronda_id, s.inventario_bodega_id, s.empresa_id,
                r.numero, r.estado AS ronda_estado, r.inventario_id,
                i.estado AS inventario_estado, i.ventana_inicio, i.ventana_fin,
                ib.bodega_id
         FROM inventarios_sesiones s
         INNER JOIN inventarios_rondas r ON r.id = s.ronda_id AND r.empresa_id = s.empresa_id
         INNER JOIN inventarios_fisicos i ON i.id = r.inventario_id AND i.empresa_id = r.empresa_id
         INNER JOIN inventarios_fisicos_bodegas ib ON ib.id = s.inventario_bodega_id AND ib.empresa_id = s.empresa_id
         WHERE s.id = ? AND s.empresa_id = ? FOR UPDATE`,
        [sessionId, companyId]
      );
      if (!sessions.length) throw Object.assign(new Error('Sesion no encontrada'), { status: 404 });
      const session = sessions[0];
      if (!['scheduled','counting','reconciliation','review'].includes(session.inventario_estado)) throw Object.assign(new Error('El inventario no esta habilitado para conteo'), { status: 409 });
      if (session.ventana_inicio && new Date(session.ventana_inicio).getTime() > Date.now()) throw Object.assign(new Error('La ventana de conteo aun no inicia'), { status: 409 });
      if (session.ventana_fin && new Date(session.ventana_fin).getTime() < Date.now()) throw Object.assign(new Error('La ventana de conteo ya termino'), { status: 409 });
      if (session.estado === 'locked' || session.estado === 'completed') throw Object.assign(new Error('Sesion cerrada'), { status: 409 });
      if (Number(session.numero) > 1) {
        const previousOpen = await tx(
          `SELECT s.id FROM inventarios_sesiones s
           INNER JOIN inventarios_rondas r ON r.id = s.ronda_id AND r.empresa_id = s.empresa_id
           WHERE s.empresa_id = ? AND s.inventario_bodega_id = ? AND r.inventario_id = ?
             AND r.numero = ? AND s.estado NOT IN ('completed','locked') LIMIT 1`,
          [companyId, session.inventario_bodega_id, session.inventario_id, Number(session.numero) - 1]
        );
        if (previousOpen.length) throw Object.assign(new Error('La ronda anterior de esta bodega debe cerrarse primero'), { status: 409 });
      }
      const members = await tx(
        `SELECT id FROM inventarios_sesiones_integrantes
         WHERE empresa_id = ? AND sesion_id = ? AND usuario_id = ? LIMIT 1`,
        [companyId, sessionId, actorId(req)]
      );
      if (!members.length) {
        throw Object.assign(new Error('No perteneces al equipo de esta sesion'), { status: 403 });
      }
      const warehouseRows = await tx(
        `SELECT id FROM bodegas WHERE id = ? AND empresa_id = ? AND estado = 'activa' FOR UPDATE`,
        [session.bodega_id, companyId]
      );
      if (!warehouseRows.length) throw Object.assign(new Error('La bodega no esta activa'), { status: 409 });
      const locks = await tx('SELECT sesion_id FROM inventarios_bodega_bloqueos WHERE bodega_id = ? AND empresa_id = ? FOR UPDATE', [session.bodega_id, companyId]);
      if (!locks.length) {
        await tx(
          `INSERT INTO inventarios_bodega_bloqueos (bodega_id, empresa_id, sesion_id, bloqueado_por)
           VALUES (?, ?, ?, ?)`,
          [session.bodega_id, companyId, sessionId, actorId(req)]
        );
      } else if (Number(locks[0].sesion_id) !== sessionId) {
        const previousLockSession = await tx(
          `SELECT inventario_bodega_id FROM inventarios_sesiones
           WHERE id = ? AND empresa_id = ? LIMIT 1`,
          [locks[0].sesion_id, companyId]
        );
        if (!previousLockSession.length || Number(previousLockSession[0].inventario_bodega_id) !== Number(session.inventario_bodega_id)) {
          throw Object.assign(new Error('La bodega ya esta bloqueada por otro inventario'), { status: 409 });
        }
        await tx(
          `UPDATE inventarios_bodega_bloqueos SET sesion_id = ?, bloqueado_por = ?, bloqueado_at = NOW()
           WHERE bodega_id = ? AND empresa_id = ?`,
          [sessionId, actorId(req), session.bodega_id, companyId]
        );
      }

      if (Number(session.numero) === 1) {
        await tx(
          `UPDATE inventarios_fisicos_bodegas SET corte_stock_at = COALESCE(corte_stock_at, NOW())
           WHERE id = ? AND empresa_id = ?`,
          [session.inventario_bodega_id, companyId]
        );
        await tx(
          `INSERT IGNORE INTO inventarios_stock_snapshot
            (empresa_id, inventario_id, bodega_id, producto_id, stock_sistema, stock_reservado, capturado_at)
           SELECT ?, ?, ?, p.id, COALESCE(pb.stock_actual, 0), COALESCE(pb.stock_reservado, 0), NOW()
           FROM productos p
           LEFT JOIN productos_bodegas pb ON pb.producto_id = p.id AND pb.bodega_id = ?
           WHERE p.empresa_id = ? AND p.estado = 'activo' AND p.tipo = 'producto' AND p.maneja_inventario = 1`,
          [companyId, session.inventario_id, session.bodega_id, session.bodega_id, companyId]
        );
        await tx('UPDATE inventarios_fisicos SET corte_stock_at = COALESCE(corte_stock_at, NOW()), estado = \'counting\' WHERE id = ? AND empresa_id = ?', [session.inventario_id, companyId]);
      }
      if (Number(session.numero) <= 2) {
        await tx(
          `INSERT IGNORE INTO inventarios_sesiones_productos (empresa_id, sesion_id, producto_id, cobertura)
           SELECT empresa_id, ?, producto_id, 'pending' FROM inventarios_stock_snapshot
           WHERE empresa_id = ? AND inventario_id = ? AND bodega_id = ?`,
          [sessionId, companyId, session.inventario_id, session.bodega_id]
        );
      }
      await tx(
        `UPDATE inventarios_sesiones SET estado = 'in_progress', iniciada_por = COALESCE(iniciada_por, ?),
          iniciada_at = COALESCE(iniciada_at, NOW()), version = version + 1
         WHERE id = ? AND empresa_id = ?`,
        [actorId(req), sessionId, companyId]
      );
      await tx(
        `UPDATE inventarios_fisicos_bodegas SET estado = 'counting', iniciada_at = COALESCE(iniciada_at, NOW())
         WHERE id = ? AND empresa_id = ?`,
        [session.inventario_bodega_id, companyId]
      );
      await tx(
        `UPDATE inventarios_rondas SET estado = 'in_progress', iniciada_at = COALESCE(iniciada_at, NOW())
         WHERE id = ? AND empresa_id = ?`,
        [session.ronda_id, companyId]
      );
      await event(tx, { empresa_id: companyId, inventario_id: session.inventario_id,
        bodega_id: session.bodega_id, sesion_id: sessionId, tipo_evento: 'count_started', usuario_id: actorId(req) });
      const totalProducts = await tx(
        'SELECT COUNT(*) AS total FROM inventarios_sesiones_productos WHERE empresa_id = ? AND sesion_id = ?',
        [companyId, sessionId]
      );
      if (Number(totalProducts[0].total) === 0) throw Object.assign(new Error('No hay productos inventariables activos para esta empresa'), { status: 409 });
      return { id: sessionId, productos: Number(totalProducts[0].total) };
    });
    return res.json({ success: true, data: started });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return failure(res, 409, 'La bodega ya tiene un conteo activo');
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al iniciar conteo:', error);
    return failure(res, 500, 'No se pudo iniciar el conteo');
  }
};

export const listCountLines = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const sessionId = idValue(req.params.sesionId);
  if (!sessionId) return failure(res, 400, 'Sesion invalida');
  try {
    const sessions = await query(
      `SELECT s.id, s.estado, s.empresa_id, s.ronda_id
       FROM inventarios_sesiones s WHERE s.id = ? AND s.empresa_id = ? LIMIT 1`,
      [sessionId, companyId]
    );
    if (!sessions.length) return failure(res, 404, 'Sesion no encontrada');
    const members = await query(
      `SELECT id FROM inventarios_sesiones_integrantes
       WHERE empresa_id = ? AND sesion_id = ? AND usuario_id = ? LIMIT 1`,
      [companyId, sessionId, actorId(req)]
    );
    const user = (req as any).user;
    const maySee = user?.tipo_usuario === 'super_admin' || user?.tipo_usuario === 'admin_empresa'
      || members.length > 0 || await (async () => {
        const permissions = await query(
          `SELECT 1 FROM usuario_rol ur
           INNER JOIN roles r ON r.id = ur.rol_id AND r.activo = 1
           INNER JOIN rol_permiso rp ON rp.rol_id = r.id
           INNER JOIN permisos p ON p.id = rp.permiso_id AND p.activo = 1
           INNER JOIN modulos m ON m.id = p.modulo_id AND m.activo = 1
           INNER JOIN acciones a ON a.id = p.accion_id AND a.activo = 1
           WHERE ur.usuario_id = ? AND ur.empresa_id = ? AND m.nombre = 'inventarios_fisicos'
             AND a.nombre IN ('view_results','reconcile') LIMIT 1`,
          [actorId(req), companyId]
        );
        return permissions.length > 0;
      })();
    if (!maySee) return failure(res, 403, 'No tienes acceso a esta sesion');
    const rows = await query(
      `SELECT l.id, l.producto_id, l.unidad_serial_id, u.numero_serie, p.sku, p.codigo_barras, p.nombre AS producto_nombre,
              p.unidad_medida, l.ubicacion, l.cantidad, l.capturado_at, l.capturado_por,
              l.anulado_at, l.motivo_anulacion
       FROM inventarios_conteo_lineas l
       INNER JOIN productos p ON p.id = l.producto_id AND p.empresa_id = l.empresa_id
       LEFT JOIN repuestos_unidades u ON u.id = l.unidad_serial_id AND u.empresa_id = l.empresa_id
       WHERE l.empresa_id = ? AND l.sesion_id = ? AND l.anulado_at IS NULL
       ORDER BY l.capturado_at DESC, l.id DESC LIMIT 1000`,
      [companyId, sessionId]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al listar lineas de conteo:', error);
    return failure(res, 500, 'No se pudieron cargar las lineas');
  }
};

export const listCountProducts = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const sessionId = idValue(req.params.sesionId);
  if (!sessionId) return failure(res, 400, 'Sesion invalida');
  try {
    const sessions = await query(
      `SELECT s.id, s.ronda_id, s.estado FROM inventarios_sesiones s
       WHERE s.id = ? AND s.empresa_id = ? LIMIT 1`,
      [sessionId, companyId]
    );
    if (!sessions.length) return failure(res, 404, 'Sesion no encontrada');
    const members = await query(
      `SELECT id FROM inventarios_sesiones_integrantes
       WHERE empresa_id = ? AND sesion_id = ? AND usuario_id = ? LIMIT 1`,
      [companyId, sessionId, actorId(req)]
    );
    if (!members.length) {
      return failure(res, 403, 'No perteneces al equipo de esta sesion');
    }
    const rows = await query(
            `SELECT sp.producto_id, p.sku, p.codigo_barras, p.nombre AS producto_nombre,
              p.unidad_medida, sp.cobertura, COALESCE(rc.serializado, 0) AS serializado
       FROM inventarios_sesiones_productos sp
       INNER JOIN productos p ON p.id = sp.producto_id AND p.empresa_id = sp.empresa_id
            LEFT JOIN repuestos_catalogo rc ON rc.producto_id = p.id AND rc.empresa_id = p.empresa_id
       WHERE sp.empresa_id = ? AND sp.sesion_id = ? AND sp.cobertura <> 'excluded'
       ORDER BY p.nombre`,
      [companyId, sessionId]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al listar productos del alcance:', error);
    return failure(res, 500, 'No se pudo cargar el alcance del conteo');
  }
};

export const getSessionSerialUnit = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const sessionId = idValue(req.params.sesionId);
  const serialNumber = textValue(req.query.numero_serie, 160);
  if (!sessionId || !serialNumber) return failure(res, 400, 'Sesion y numero de serie requeridos');
  try {
    const sessions = await query(
      `SELECT s.id, s.estado, ib.bodega_id FROM inventarios_sesiones s
       INNER JOIN inventarios_fisicos_bodegas ib ON ib.id = s.inventario_bodega_id AND ib.empresa_id = s.empresa_id
       WHERE s.id = ? AND s.empresa_id = ? LIMIT 1`,
      [sessionId, companyId]
    );
    if (!sessions.length || sessions[0].estado !== 'in_progress') return failure(res, 409, 'La sesion no esta abierta');
    const members = await query(
      `SELECT id FROM inventarios_sesiones_integrantes
       WHERE empresa_id = ? AND sesion_id = ? AND usuario_id = ? LIMIT 1`,
      [companyId, sessionId, actorId(req)]
    );
    if (!members.length) {
      return failure(res, 403, 'No perteneces al equipo de esta sesion');
    }
    const units = await query(
      `SELECT ru.id AS unidad_serial_id, ru.producto_id, p.sku, p.nombre AS producto_nombre
       FROM repuestos_unidades ru
       INNER JOIN repuestos_catalogo rc ON rc.producto_id = ru.producto_id AND rc.empresa_id = ru.empresa_id
       INNER JOIN productos p ON p.id = ru.producto_id AND p.empresa_id = ru.empresa_id
       INNER JOIN inventarios_sesiones_productos sp ON sp.producto_id = ru.producto_id AND sp.empresa_id = ru.empresa_id
       WHERE ru.empresa_id = ? AND ru.numero_serie = ? AND ru.bodega_actual_id = ?
         AND ru.estado NOT IN ('installed','retired') AND rc.serializado = 1
         AND sp.sesion_id = ? AND sp.cobertura <> 'excluded' LIMIT 2`,
      [companyId, serialNumber, sessions[0].bodega_id, sessionId]
    );
    if (units.length > 1) return failure(res, 409, 'El numero de serie es ambiguo; seleccione el producto antes de capturarlo');
    if (!units.length) return failure(res, 404, 'Unidad serial no encontrada en esta bodega');
    return res.json({ success: true, data: units[0] });
  } catch (error) {
    console.error('Error al buscar unidad serial del conteo:', error);
    return failure(res, 500, 'No se pudo consultar la unidad serial');
  }
};

export const captureCountLine = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const sessionId = idValue(req.params.sesionId);
  const productId = idValue(req.body.producto_id);
  const amount = Number(req.body.cantidad);
  const key = textValue(req.body.idempotency_key, 36);
  if (!sessionId || !productId || !Number.isFinite(amount) || amount < 0 || Math.round(amount * 1000) / 1000 !== amount
      || !key || !/^[0-9a-f-]{36}$/i.test(key)) return failure(res, 400, 'Producto, cantidad no negativa y clave idempotente validos son requeridos');

  try {
    const result = await withTransaction(async (tx) => {
      const sessions = await tx(
        `SELECT s.id, s.estado, s.version, s.empresa_id, ib.bodega_id
         FROM inventarios_sesiones s
         INNER JOIN inventarios_fisicos_bodegas ib ON ib.id = s.inventario_bodega_id AND ib.empresa_id = s.empresa_id
         WHERE s.id = ? AND s.empresa_id = ? FOR UPDATE`,
        [sessionId, companyId]
      );
      if (!sessions.length) throw Object.assign(new Error('Sesion no encontrada'), { status: 404 });
      if (sessions[0].estado !== 'in_progress') throw Object.assign(new Error('La sesion no esta abierta'), { status: 409 });
      const members = await tx(
        `SELECT id FROM inventarios_sesiones_integrantes
         WHERE empresa_id = ? AND sesion_id = ? AND usuario_id = ? LIMIT 1`,
        [companyId, sessionId, actorId(req)]
      );
      if (!members.length) {
        throw Object.assign(new Error('No perteneces al equipo de esta sesion'), { status: 403 });
      }
      const previousCapture = await tx(
        `SELECT id FROM inventarios_conteo_lineas
         WHERE empresa_id = ? AND sesion_id = ? AND idempotency_key = ? LIMIT 1`,
        [companyId, sessionId, key]
      );
      if (previousCapture.length) return { id: Number(previousCapture[0].id), duplicate: true };
      const scope = await tx(
        `SELECT sp.id FROM inventarios_sesiones_productos sp
         INNER JOIN productos p ON p.id = sp.producto_id AND p.empresa_id = sp.empresa_id
         WHERE sp.empresa_id = ? AND sp.sesion_id = ? AND sp.producto_id = ? AND sp.cobertura <> 'excluded'
         LIMIT 1`,
        [companyId, sessionId, productId]
      );
      if (!scope.length) throw Object.assign(new Error('Producto fuera del alcance de esta sesion'), { status: 400 });
      const serialId = req.body.unidad_serial_id ? idValue(req.body.unidad_serial_id) : null;
      if (req.body.unidad_serial_id && !serialId) throw Object.assign(new Error('Unidad serial invalida'), { status: 400 });
      const spareProfiles = await tx(
        `SELECT serializado FROM repuestos_catalogo WHERE empresa_id = ? AND producto_id = ? LIMIT 1`,
        [companyId, productId]
      );
      const isSerialized = spareProfiles.length > 0 && Number(spareProfiles[0].serializado) === 1;
      if (isSerialized && (!serialId || amount !== 1)) {
        throw Object.assign(new Error('Este repuesto requiere capturar cada unidad serial con cantidad 1'), { status: 400 });
      }
      if (serialId && !isSerialized) throw Object.assign(new Error('El producto no tiene control serial activo'), { status: 400 });
      if (serialId) {
        const serial = await tx(
          `SELECT id FROM repuestos_unidades
           WHERE id = ? AND empresa_id = ? AND producto_id = ? AND bodega_actual_id = ?
             AND estado NOT IN ('installed','retired') LIMIT 1 FOR UPDATE`,
          [serialId, companyId, productId, sessions[0].bodega_id]
        );
        if (!serial.length) throw Object.assign(new Error('El serial no pertenece al producto'), { status: 400 });
        const existingLine = await tx(
          `SELECT id FROM inventarios_conteo_lineas
           WHERE empresa_id = ? AND sesion_id = ? AND unidad_serial_id = ? AND anulado_at IS NULL LIMIT 1`,
          [companyId, sessionId, serialId]
        );
        if (existingLine.length) throw Object.assign(new Error('La unidad serial ya fue capturada en esta sesión'), { status: 409 });
      }
      const inserted = await tx(
        `INSERT INTO inventarios_conteo_lineas
          (empresa_id, sesion_id, producto_id, unidad_serial_id, ubicacion, cantidad,
           idempotency_key, capturado_por, capturado_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [companyId, sessionId, productId, serialId, textValue(req.body.ubicacion, 160), amount, key, actorId(req)]
      );
      await tx(
        `UPDATE inventarios_sesiones_productos
         SET cobertura = 'counted', cantidad_declarada = COALESCE(cantidad_declarada, 0) + ?,
             confirmado_por = ?, confirmado_at = NOW()
         WHERE empresa_id = ? AND sesion_id = ? AND producto_id = ?`,
        [amount, actorId(req), companyId, sessionId, productId]
      );
      const sessionInfo = await tx(
        `SELECT r.inventario_id, ib.bodega_id FROM inventarios_sesiones s
         INNER JOIN inventarios_rondas r ON r.id = s.ronda_id AND r.empresa_id = s.empresa_id
         INNER JOIN inventarios_fisicos_bodegas ib ON ib.id = s.inventario_bodega_id AND ib.empresa_id = s.empresa_id
         WHERE s.id = ? AND s.empresa_id = ? LIMIT 1`,
        [sessionId, companyId]
      );
      await event(tx, { empresa_id: companyId, inventario_id: sessionInfo[0].inventario_id,
        bodega_id: sessionInfo[0].bodega_id, sesion_id: sessionId, tipo_evento: 'count_line_added',
        usuario_id: actorId(req), nuevos: { producto_id: productId, cantidad: amount, ubicacion: req.body.ubicacion || null } });
      return { id: inserted.insertId };
    });
    return res.status(result.duplicate ? 200 : 201).json({ success: true, data: result });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return res.json({ success: true, duplicate: true, data: null });
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al capturar linea:', error);
    return failure(res, 500, 'No se pudo guardar la captura');
  }
};

export const setProductCoverage = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const sessionId = idValue(req.params.sesionId);
  const productId = idValue(req.params.productoId);
  const coverage = req.body.cobertura;
  if (!sessionId || !productId || coverage !== 'not_present') {
    return failure(res, 400, 'Cobertura invalida');
  }
  try {
    const result = await withTransaction(async (tx) => {
      const sessions = await tx('SELECT estado FROM inventarios_sesiones WHERE id = ? AND empresa_id = ? FOR UPDATE', [sessionId, companyId]);
      if (!sessions.length) throw Object.assign(new Error('Sesion no encontrada'), { status: 404 });
      if (sessions[0].estado !== 'in_progress') throw Object.assign(new Error('La sesion no esta abierta'), { status: 409 });
      const members = await tx(
        `SELECT id FROM inventarios_sesiones_integrantes
         WHERE empresa_id = ? AND sesion_id = ? AND usuario_id = ? LIMIT 1`,
        [companyId, sessionId, actorId(req)]
      );
      if (!members.length) {
        throw Object.assign(new Error('No perteneces al equipo de esta sesion'), { status: 403 });
      }
      const scopedProduct = await tx(
        `SELECT sp.id, sp.cobertura, sp.cantidad_declarada, r.inventario_id, ib.bodega_id
         FROM inventarios_sesiones_productos sp
         INNER JOIN inventarios_sesiones s ON s.id = sp.sesion_id AND s.empresa_id = sp.empresa_id
         INNER JOIN inventarios_rondas r ON r.id = s.ronda_id AND r.empresa_id = s.empresa_id
         INNER JOIN inventarios_fisicos_bodegas ib ON ib.id = s.inventario_bodega_id AND ib.empresa_id = s.empresa_id
         WHERE sp.empresa_id = ? AND sp.sesion_id = ? AND sp.producto_id = ? AND sp.cobertura <> 'excluded' LIMIT 1`,
        [companyId, sessionId, productId]
      );
      if (!scopedProduct.length) throw Object.assign(new Error('Producto fuera del alcance'), { status: 404 });
      if (coverage === 'not_present') {
        const lines = await tx(
          `SELECT id FROM inventarios_conteo_lineas
           WHERE empresa_id = ? AND sesion_id = ? AND producto_id = ? AND anulado_at IS NULL LIMIT 1`,
          [companyId, sessionId, productId]
        );
        if (lines.length) throw Object.assign(new Error('Anula primero las lineas capturadas antes de marcar no presente'), { status: 409 });
      }
      const count = 0;
      const rows = await tx(
        `UPDATE inventarios_sesiones_productos
         SET cobertura = ?, cantidad_declarada = ?, confirmado_por = ?, confirmado_at = NOW()
         WHERE empresa_id = ? AND sesion_id = ? AND producto_id = ?`,
        [coverage, count, actorId(req), companyId, sessionId, productId]
      );
      if (!rows.affectedRows) throw Object.assign(new Error('Producto fuera del alcance'), { status: 404 });
      await event(tx, { empresa_id: companyId, inventario_id: scopedProduct[0].inventario_id,
        bodega_id: scopedProduct[0].bodega_id, sesion_id: sessionId, tipo_evento: 'count_coverage_confirmed',
        usuario_id: actorId(req), anteriores: { cobertura: scopedProduct[0].cobertura, cantidad: scopedProduct[0].cantidad_declarada },
        nuevos: { producto_id: productId, cobertura: 'not_present', cantidad: count } });
      return { producto_id: productId, cobertura: coverage, cantidad: count };
    });
    return res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al actualizar cobertura:', error);
    return failure(res, 500, 'No se pudo actualizar la cobertura');
  }
};

export const voidCountLine = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const lineId = idValue(req.params.lineaId);
  const reason = textValue(req.body.motivo, 255);
  if (!lineId || !reason) return failure(res, 400, 'Linea y motivo requeridos');
  try {
    const result = await withTransaction(async (tx) => {
      const lines = await tx(
        `SELECT l.*, s.estado, r.inventario_id, ib.bodega_id
         FROM inventarios_conteo_lineas l
         INNER JOIN inventarios_sesiones s ON s.id = l.sesion_id AND s.empresa_id = l.empresa_id
         INNER JOIN inventarios_rondas r ON r.id = s.ronda_id AND r.empresa_id = s.empresa_id
         INNER JOIN inventarios_fisicos_bodegas ib ON ib.id = s.inventario_bodega_id AND ib.empresa_id = s.empresa_id
         WHERE l.id = ? AND l.empresa_id = ? FOR UPDATE`,
        [lineId, companyId]
      );
      if (!lines.length) throw Object.assign(new Error('Linea no encontrada'), { status: 404 });
      const line = lines[0];
      if (line.estado !== 'in_progress') throw Object.assign(new Error('La sesion esta cerrada'), { status: 409 });
      const members = await tx(
        `SELECT id FROM inventarios_sesiones_integrantes
         WHERE empresa_id = ? AND sesion_id = ? AND usuario_id = ? LIMIT 1`,
        [companyId, line.sesion_id, actorId(req)]
      );
      if (!members.length) {
        throw Object.assign(new Error('No perteneces al equipo de esta sesion'), { status: 403 });
      }
      if (line.anulado_at) return { id: lineId, anulada: true };
      await tx(
        `UPDATE inventarios_conteo_lineas SET anulado_por = ?, anulado_at = NOW(), motivo_anulacion = ?
         WHERE id = ? AND empresa_id = ?`,
        [actorId(req), reason, lineId, companyId]
      );
      await tx(
        `UPDATE inventarios_sesiones_productos
         SET cantidad_declarada = GREATEST(0, COALESCE(cantidad_declarada, 0) - ?),
             cobertura = IF(GREATEST(0, COALESCE(cantidad_declarada, 0) - ?) = 0, 'pending', 'counted')
         WHERE empresa_id = ? AND sesion_id = ? AND producto_id = ?`,
        [line.cantidad, line.cantidad, companyId, line.sesion_id, line.producto_id]
      );
      await event(tx, { empresa_id: companyId, inventario_id: line.inventario_id,
        bodega_id: line.bodega_id, sesion_id: line.sesion_id, tipo_evento: 'count_line_voided',
        motivo: reason, usuario_id: actorId(req), anteriores: { cantidad: line.cantidad, producto_id: line.producto_id } });
      return { id: lineId, anulada: true };
    });
    return res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al anular linea de conteo:', error);
    return failure(res, 500, 'No se pudo anular la linea');
  }
};

export const closeCountSession = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const sessionId = idValue(req.params.sesionId);
  if (!sessionId) return failure(res, 400, 'Sesion invalida');
  try {
    const closed = await withTransaction(async (tx) => {
      const sessions = await tx(
        `SELECT s.id, s.estado, s.ronda_id, s.inventario_bodega_id,
                r.inventario_id, r.numero, ib.bodega_id
         FROM inventarios_sesiones s
         INNER JOIN inventarios_rondas r ON r.id = s.ronda_id AND r.empresa_id = s.empresa_id
         INNER JOIN inventarios_fisicos_bodegas ib ON ib.id = s.inventario_bodega_id AND ib.empresa_id = s.empresa_id
         WHERE s.id = ? AND s.empresa_id = ? FOR UPDATE`,
        [sessionId, companyId]
      );
      if (!sessions.length) throw Object.assign(new Error('Sesion no encontrada'), { status: 404 });
      const session = sessions[0];
      if (session.estado !== 'in_progress') throw Object.assign(new Error('La sesion no esta abierta'), { status: 409 });
      const members = await tx(
        `SELECT id FROM inventarios_sesiones_integrantes
         WHERE empresa_id = ? AND sesion_id = ? AND usuario_id = ? LIMIT 1`,
        [companyId, sessionId, actorId(req)]
      );
      if (!members.length) {
        throw Object.assign(new Error('No perteneces al equipo de esta sesion'), { status: 403 });
      }
      const pending = await tx(
        `SELECT COUNT(*) AS total FROM inventarios_sesiones_productos
         WHERE empresa_id = ? AND sesion_id = ? AND cobertura = 'pending'`,
        [companyId, sessionId]
      );
      if (Number(pending[0].total) > 0) throw Object.assign(new Error(`Quedan ${pending[0].total} productos sin cobertura. Marca cero/ausencia de forma explicita.`), { status: 409 });
      await tx(
        `UPDATE inventarios_sesiones SET estado = 'locked', cerrada_por = ?, cerrada_at = NOW(), version = version + 1
         WHERE id = ? AND empresa_id = ?`,
        [actorId(req), sessionId, companyId]
      );
      const active = await tx(
        `SELECT COUNT(*) AS total FROM inventarios_sesiones
         WHERE empresa_id = ? AND ronda_id = ? AND estado NOT IN ('completed','locked')`,
        [companyId, session.ronda_id]
      );
      if (Number(active[0].total) === 0) {
        await tx('UPDATE inventarios_rondas SET estado = \'completed\', terminada_at = NOW() WHERE id = ? AND empresa_id = ?', [session.ronda_id, companyId]);
        await tx('UPDATE inventarios_fisicos SET estado = \'reconciliation\' WHERE id = ? AND empresa_id = ?', [session.inventario_id, companyId]);
        const remainingWarehouseSessions = await tx(
          `SELECT COUNT(*) AS total FROM inventarios_sesiones other
           WHERE other.empresa_id = ? AND other.inventario_bodega_id = ?
             AND other.estado NOT IN ('completed','locked')`,
          [companyId, session.inventario_bodega_id]
        );
        if (Number(remainingWarehouseSessions[0].total) === 0) {
          await tx('UPDATE inventarios_fisicos_bodegas SET estado = \'reconciliation\', cerrada_at = NOW() WHERE id = ? AND empresa_id = ?', [session.inventario_bodega_id, companyId]);
        }
      }
      await event(tx, { empresa_id: companyId, inventario_id: session.inventario_id,
        bodega_id: session.bodega_id, sesion_id: sessionId, tipo_evento: 'count_closed',
        usuario_id: actorId(req), nuevos: { ronda: session.numero } });
      return { id: sessionId, estado: 'locked' };
    });
    return res.json({ success: true, data: closed });
  } catch (error: any) {
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al cerrar sesion:', error);
    return failure(res, 500, 'No se pudo cerrar la sesion');
  }
};

export const reopenCountSession = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const sessionId = idValue(req.params.sesionId);
  const reason = textValue(req.body.motivo, 255);
  if (!sessionId || !reason) return failure(res, 400, 'Sesion y motivo de reapertura requeridos');
  try {
    const reopened = await withTransaction(async (tx) => {
      const rows = await tx(
        `SELECT s.id, s.estado, s.inventario_bodega_id, r.inventario_id, ib.bodega_id,
          i.estado AS inventario_estado, i.ventana_inicio, i.ventana_fin
         FROM inventarios_sesiones s
         INNER JOIN inventarios_rondas r ON r.id = s.ronda_id AND r.empresa_id = s.empresa_id
         INNER JOIN inventarios_fisicos_bodegas ib ON ib.id = s.inventario_bodega_id AND ib.empresa_id = s.empresa_id
         INNER JOIN inventarios_fisicos i ON i.id = r.inventario_id AND i.empresa_id = r.empresa_id
         WHERE s.id = ? AND s.empresa_id = ? FOR UPDATE`,
        [sessionId, companyId]
      );
      if (!rows.length) throw Object.assign(new Error('Sesion no encontrada'), { status: 404 });
      const session = rows[0];
      if (!['completed','locked'].includes(session.estado)) throw Object.assign(new Error('Solo se reabren sesiones finalizadas'), { status: 409 });
      if (['adjustment_pending','closed'].includes(session.inventario_estado)) {
        throw Object.assign(new Error('No se reabren sesiones despues de aprobar la conciliacion o cerrar el inventario'), { status: 409 });
      }
      if (session.ventana_inicio && new Date(session.ventana_inicio).getTime() > Date.now()) {
        throw Object.assign(new Error('La ventana de conteo aun no inicia'), { status: 409 });
      }
      if (session.ventana_fin && new Date(session.ventana_fin).getTime() < Date.now()) {
        throw Object.assign(new Error('La ventana de conteo ya termino'), { status: 409 });
      }
      const manualDecisions = await tx(
        `SELECT id FROM inventarios_resultados
         WHERE empresa_id = ? AND inventario_id = ? AND resuelto_por IS NOT NULL LIMIT 1`,
        [companyId, session.inventario_id]
      );
      if (manualDecisions.length) throw Object.assign(new Error('No se reabren sesiones despues de registrar resoluciones manuales'), { status: 409 });
      const warehouses = await tx(
        `SELECT id FROM bodegas WHERE id = ? AND empresa_id = ? AND estado = 'activa' FOR UPDATE`,
        [session.bodega_id, companyId]
      );
      if (!warehouses.length) throw Object.assign(new Error('La bodega no esta activa'), { status: 409 });
      await tx(
        `INSERT INTO inventarios_bodega_bloqueos (bodega_id, empresa_id, sesion_id, bloqueado_por)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE sesion_id = IF(sesion_id = VALUES(sesion_id), VALUES(sesion_id), sesion_id)`,
        [session.bodega_id, companyId, sessionId, actorId(req)]
      );
      const lock = await tx('SELECT sesion_id FROM inventarios_bodega_bloqueos WHERE bodega_id = ? AND empresa_id = ? FOR UPDATE', [session.bodega_id, companyId]);
      if (!lock.length || Number(lock[0].sesion_id) !== sessionId) throw Object.assign(new Error('La bodega esta ocupada por otro conteo'), { status: 409 });
      await tx(
        `UPDATE inventarios_sesiones SET estado = 'reopened', cerrada_por = NULL, cerrada_at = NULL, version = version + 1
         WHERE id = ? AND empresa_id = ?`,
        [sessionId, companyId]
      );
      await tx('UPDATE inventarios_fisicos SET estado = \'counting\' WHERE id = ? AND empresa_id = ?', [session.inventario_id, companyId]);
      await tx('UPDATE inventarios_fisicos_bodegas SET estado = \'counting\', cerrada_at = NULL WHERE id = ? AND empresa_id = ?', [session.inventario_bodega_id, companyId]);
      await event(tx, { empresa_id: companyId, inventario_id: session.inventario_id, bodega_id: session.bodega_id,
        sesion_id: sessionId, tipo_evento: 'count_reopened', motivo: reason, usuario_id: actorId(req),
        anteriores: { estado: session.estado }, nuevos: { estado: 'reopened' } });
      return { id: sessionId, estado: 'reopened' };
    });
    return res.json({ success: true, data: reopened });
  } catch (error: any) {
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al reabrir sesion:', error);
    return failure(res, 500, 'No se pudo reabrir la sesion');
  }
};

export const closeInventory = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const inventoryId = idValue(req.params.id);
  const reason = textValue(req.body.motivo, 1000);
  if (!inventoryId || !reason) return failure(res, 400, 'Inventario y motivo de cierre requeridos');
  try {
    const closed = await withTransaction(async (tx) => {
      const inventories = await tx('SELECT * FROM inventarios_fisicos WHERE id = ? AND empresa_id = ? FOR UPDATE', [inventoryId, companyId]);
      if (!inventories.length) throw Object.assign(new Error('Inventario no encontrado'), { status: 404 });
      if (inventories[0].estado === 'closed') throw Object.assign(new Error('El inventario ya esta cerrado'), { status: 409 });
      const openSessions = await tx(
        `SELECT id FROM inventarios_sesiones
         WHERE empresa_id = ? AND id IN (
           SELECT s.id FROM inventarios_sesiones s
           INNER JOIN inventarios_rondas r ON r.id = s.ronda_id AND r.empresa_id = s.empresa_id
           WHERE r.inventario_id = ? AND s.estado IN ('in_progress','reopened')
         ) LIMIT 1`,
        [companyId, inventoryId]
      );
      if (openSessions.length) throw Object.assign(new Error('No se puede cerrar mientras existan sesiones abiertas'), { status: 409 });
      const unresolved = await tx(
        `SELECT id FROM inventarios_resultados WHERE empresa_id = ? AND inventario_id = ?
         AND estado <> 'approved' LIMIT 1`,
        [companyId, inventoryId]
      );
      if (unresolved.length) throw Object.assign(new Error('Todos los resultados deben estar aprobados antes del cierre'), { status: 409 });
      const openWarehouses = await tx(
        `SELECT id FROM inventarios_fisicos_bodegas WHERE empresa_id = ? AND inventario_id = ?
         AND estado NOT IN ('reconciled','closed') LIMIT 1`,
        [companyId, inventoryId]
      );
      if (openWarehouses.length) throw Object.assign(new Error('Todas las bodegas deben estar conciliadas antes del cierre'), { status: 409 });
      const pendingAdjustments = await tx(
        `SELECT id FROM inventarios_ajustes WHERE empresa_id = ? AND inventario_id = ?
         AND estado IN ('requested','under_review','approved') LIMIT 1`,
        [companyId, inventoryId]
      );
      if (pendingAdjustments.length) throw Object.assign(new Error('Hay ajustes pendientes de aplicar o revisar'), { status: 409 });
      const sessions = await tx(
        `SELECT s.id, ib.bodega_id FROM inventarios_sesiones s
         INNER JOIN inventarios_rondas r ON r.id = s.ronda_id AND r.empresa_id = s.empresa_id
         INNER JOIN inventarios_fisicos_bodegas ib ON ib.id = s.inventario_bodega_id AND ib.empresa_id = s.empresa_id
         WHERE r.inventario_id = ? AND s.empresa_id = ?`,
        [inventoryId, companyId]
      );
      for (const session of sessions) {
        await tx('DELETE FROM inventarios_bodega_bloqueos WHERE bodega_id = ? AND empresa_id = ? AND sesion_id = ?', [session.bodega_id, companyId, session.id]);
      }
      await tx(
        `UPDATE inventarios_fisicos SET estado = 'closed', closed_by = ?, closed_at = NOW(), updated_at = NOW()
         WHERE id = ? AND empresa_id = ?`,
        [actorId(req), inventoryId, companyId]
      );
      await tx('UPDATE inventarios_fisicos_bodegas SET estado = \'closed\' WHERE empresa_id = ? AND inventario_id = ?', [companyId, inventoryId]);
      await event(tx, { empresa_id: companyId, inventario_id: inventoryId, tipo_evento: 'inventory_closed',
        motivo: reason, usuario_id: actorId(req), anteriores: { estado: inventories[0].estado }, nuevos: { estado: 'closed' } });
      return { id: inventoryId, estado: 'closed' };
    });
    return res.json({ success: true, data: closed });
  } catch (error: any) {
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al cerrar inventario:', error);
    return failure(res, 500, 'No se pudo cerrar el inventario');
  }
};

export const compareInventory = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const inventoryId = idValue(req.params.id);
  if (!inventoryId) return failure(res, 400, 'Inventario invalido');
  try {
    const compared = await withTransaction(async (tx) => {
      const inventories = await tx(
        'SELECT id, estado FROM inventarios_fisicos WHERE id = ? AND empresa_id = ? FOR UPDATE',
        [inventoryId, companyId]
      );
      if (!inventories.length) throw Object.assign(new Error('Inventario no encontrado'), { status: 404 });
      if (!['reconciliation','review'].includes(inventories[0].estado)) {
        throw Object.assign(new Error('El inventario aun no esta listo para conciliar o ya fue aprobado/cerrado'), { status: 409 });
      }
      const approvedResults = await tx(
        `SELECT id FROM inventarios_resultados
         WHERE empresa_id = ? AND inventario_id = ? AND estado = 'approved' LIMIT 1`,
        [companyId, inventoryId]
      );
      if (approvedResults.length) throw Object.assign(new Error('No se puede recalcular una conciliacion aprobada'), { status: 409 });
      const manuallyResolved = await tx(
        `SELECT id FROM inventarios_resultados
         WHERE empresa_id = ? AND inventario_id = ? AND resuelto_por IS NOT NULL LIMIT 1`,
        [companyId, inventoryId]
      );
      if (manuallyResolved.length) throw Object.assign(new Error('No se puede recalcular despues de una resolucion manual'), { status: 409 });
      const unfinishedSessions = await tx(
        `SELECT s.id FROM inventarios_sesiones s
         INNER JOIN inventarios_rondas r ON r.id = s.ronda_id AND r.empresa_id = s.empresa_id
         WHERE r.inventario_id = ? AND s.empresa_id = ? AND s.estado NOT IN ('completed','locked') LIMIT 1`,
        [inventoryId, companyId]
      );
      if (unfinishedSessions.length) throw Object.assign(new Error('Cierra las sesiones de conteo autorizadas antes de conciliar'), { status: 409 });
      const completedRounds = await tx(
        `SELECT id, numero FROM inventarios_rondas
         WHERE empresa_id = ? AND inventario_id = ? AND estado = 'completed' ORDER BY numero`,
        [companyId, inventoryId]
      );
      if (completedRounds.length < 2) throw Object.assign(new Error('Se requieren dos rondas completas antes de conciliar'), { status: 409 });
      const resultRows = await tx(
        `SELECT ib.bodega_id, sp.producto_id, sp.cobertura, sp.cantidad_declarada,
          snap.stock_sistema, i.max_rondas,
                p.sku, p.nombre AS producto_nombre, p.unidad_medida,
                (SELECT SUM(l.cantidad) FROM inventarios_conteo_lineas l
                 WHERE l.sesion_id = s.id AND l.producto_id = sp.producto_id AND l.anulado_at IS NULL) AS cantidad_linea,
                r.id AS ronda_id, r.numero, s.id AS sesion_id
         FROM inventarios_sesiones s
         INNER JOIN inventarios_rondas r ON r.id = s.ronda_id AND r.empresa_id = s.empresa_id
         INNER JOIN inventarios_fisicos i ON i.id = r.inventario_id AND i.empresa_id = r.empresa_id
         INNER JOIN inventarios_sesiones_productos sp ON sp.sesion_id = s.id AND sp.empresa_id = s.empresa_id
         INNER JOIN inventarios_fisicos_bodegas ib ON ib.id = s.inventario_bodega_id AND ib.empresa_id = s.empresa_id
         INNER JOIN bodegas b ON b.id = ib.bodega_id AND b.empresa_id = s.empresa_id
         INNER JOIN productos p ON p.id = sp.producto_id AND p.empresa_id = s.empresa_id
         LEFT JOIN inventarios_stock_snapshot snap ON snap.inventario_id = r.inventario_id
           AND snap.bodega_id = b.id AND snap.producto_id = sp.producto_id AND snap.empresa_id = s.empresa_id
         WHERE s.empresa_id = ? AND r.inventario_id = ?
           AND s.estado IN ('completed','locked') AND r.estado = 'completed'
         ORDER BY b.nombre, p.nombre`,
        [companyId, inventoryId]
      );
      const pairs = new Map<string, any>();
      for (const row of resultRows) {
        const key = `${row.bodega_id}:${row.producto_id}`;
        const pair = pairs.get(key) || { ...row, rounds: [] };
        const quantity = row.cobertura === 'not_present' ? 0 : row.cobertura === 'counted'
          ? Number(row.cantidad_linea ?? row.cantidad_declarada ?? 0) : null;
        pair.rounds.push({ numero: Number(row.numero), ronda_id: Number(row.ronda_id), cobertura: row.cobertura, cantidad: quantity });
        pairs.set(key, pair);
      }
      const reconciled = [];
      const resultValues: any[][] = [];
      for (const pair of pairs.values()) {
        if (pair.stock_sistema === null || pair.stock_sistema === undefined) {
          throw Object.assign(new Error('Falta el snapshot de corte para un producto'), { status: 409 });
        }
        const consensus = evaluateRoundConsensus(pair.rounds, Number(pair.max_rondas));
        const { physical, status, resolvingRoundId } = consensus;
        const stockSystem = Number(pair.stock_sistema || 0);
        resultValues.push([companyId, inventoryId, pair.bodega_id, pair.producto_id, stockSystem, physical,
          physical === null ? null : physical - stockSystem, status, resolvingRoundId]);
        reconciled.push({ bodega_id: pair.bodega_id, producto_id: pair.producto_id, estado: status });
      }
      const resultBatchSize = 250;
      for (let offset = 0; offset < resultValues.length; offset += resultBatchSize) {
        const batch = resultValues.slice(offset, offset + resultBatchSize);
        await tx(
          `INSERT INTO inventarios_resultados
            (empresa_id, inventario_id, bodega_id, producto_id, stock_sistema, cantidad_fisica, diferencia, estado, ronda_resolutiva_id)
           VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',')}
           ON DUPLICATE KEY UPDATE stock_sistema = VALUES(stock_sistema),
             cantidad_fisica = VALUES(cantidad_fisica), diferencia = VALUES(diferencia), estado = VALUES(estado),
             ronda_resolutiva_id = VALUES(ronda_resolutiva_id), resuelto_por = NULL, resuelto_at = NULL`,
          batch.flat()
        );
      }
      const resultIds = await tx(
        `SELECT id, bodega_id, producto_id FROM inventarios_resultados
         WHERE empresa_id = ? AND inventario_id = ?`,
        [companyId, inventoryId]
      );
      const resultIdByKey = new Map(resultIds.map((row: any) => [`${row.bodega_id}:${row.producto_id}`, Number(row.id)]));
      const roundIdByNumber = new Map(completedRounds.map((round: any) => [Number(round.numero), Number(round.id)]));
      const roundValues: any[][] = [];
      for (const pair of pairs.values()) {
        const resultId = resultIdByKey.get(`${pair.bodega_id}:${pair.producto_id}`);
        for (const round of pair.rounds) {
          const roundId = roundIdByNumber.get(Number(round.numero));
          if (!resultId || !roundId) throw Object.assign(new Error('No se pudo relacionar el resultado con su ronda'), { status: 500 });
          roundValues.push([companyId, resultId, roundId, round.cantidad,
            round.cantidad === null ? 'incomplete' : round.cobertura === 'not_present' ? 'not_present' : 'complete']);
        }
      }
      for (let offset = 0; offset < roundValues.length; offset += resultBatchSize) {
        const batch = roundValues.slice(offset, offset + resultBatchSize);
        await tx(
          `INSERT INTO inventarios_resultados_rondas (empresa_id, resultado_id, ronda_id, cantidad, cobertura)
           VALUES ${batch.map(() => '(?, ?, ?, ?, ?)').join(',')}
           ON DUPLICATE KEY UPDATE cantidad = VALUES(cantidad), cobertura = VALUES(cobertura)`,
          batch.flat()
        );
      }
      const byWarehouse = new Map<number, string[]>();
      for (const result of reconciled) {
        const statuses = byWarehouse.get(Number(result.bodega_id)) || [];
        statuses.push(result.estado);
        byWarehouse.set(Number(result.bodega_id), statuses);
      }
      for (const [warehouseId, statuses] of byWarehouse) {
        const warehouseState = statuses.every((status) => status === 'matched') ? 'reconciled' : 'review';
        await tx(
          `UPDATE inventarios_fisicos_bodegas SET estado = ?
           WHERE empresa_id = ? AND inventario_id = ? AND bodega_id = ?`,
          [warehouseState, companyId, inventoryId, warehouseId]
        );
      }
      await tx('UPDATE inventarios_fisicos SET estado = \'review\' WHERE id = ? AND empresa_id = ?', [inventoryId, companyId]);
      await event(tx, { empresa_id: companyId, inventario_id: inventoryId, tipo_evento: 'rounds_compared',
        usuario_id: actorId(req), nuevos: { resultados: reconciled.length } });
      return reconciled;
    });
    return res.json({ success: true, data: { comparados: compared.length, resultados: compared } });
  } catch (error: any) {
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al comparar inventario:', error);
    return failure(res, 500, 'No se pudo conciliar el inventario');
  }
};

export const listInventoryResults = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const inventoryId = idValue(req.params.id);
  if (!inventoryId) return failure(res, 400, 'Inventario invalido');
  try {
    const rows = await query(
      `SELECT r.id, r.bodega_id, b.nombre AS bodega_nombre,
              r.producto_id, p.sku, p.nombre AS producto_nombre, p.unidad_medida,
              r.stock_sistema, r.cantidad_fisica, r.diferencia, r.estado, r.resuelto_por,
              rr.ronda_id, ir.numero AS numero_ronda, rr.cantidad AS cantidad_ronda, rr.cobertura
       FROM inventarios_resultados r
       INNER JOIN inventarios_fisicos i ON i.id = r.inventario_id AND i.empresa_id = r.empresa_id
       INNER JOIN bodegas b ON b.id = r.bodega_id AND b.empresa_id = r.empresa_id
       INNER JOIN productos p ON p.id = r.producto_id AND p.empresa_id = r.empresa_id
       LEFT JOIN inventarios_resultados_rondas rr ON rr.resultado_id = r.id AND rr.empresa_id = r.empresa_id
       LEFT JOIN inventarios_rondas ir ON ir.id = rr.ronda_id AND ir.empresa_id = rr.empresa_id
       WHERE r.empresa_id = ? AND r.inventario_id = ? ORDER BY b.nombre, p.nombre, ir.numero`,
      [companyId, inventoryId]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al listar resultados de inventario:', error);
    return failure(res, 500, 'No se pudieron cargar los resultados');
  }
};

export const resolveInventoryDifference = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const inventoryId = idValue(req.params.id);
  const warehouseId = idValue(req.body.bodega_id);
  const productId = idValue(req.body.producto_id);
  const physical = Number(req.body.cantidad_fisica);
  const reason = textValue(req.body.motivo, 1000);
  if (!inventoryId || !warehouseId || !productId || !Number.isFinite(physical)
      || physical < 0 || Math.round(physical * 1000) / 1000 !== physical || !reason) {
    return failure(res, 400, 'Bodega, producto, cantidad (maximo 3 decimales) y motivo requeridos');
  }
  try {
    const result = await withTransaction(async (tx) => {
      const rows = await tx(
        `SELECT r.*, i.empresa_id FROM inventarios_resultados r
         INNER JOIN inventarios_fisicos i ON i.id = r.inventario_id AND i.empresa_id = r.empresa_id
         WHERE r.inventario_id = ? AND r.bodega_id = ? AND r.producto_id = ? AND r.empresa_id = ? FOR UPDATE`,
        [inventoryId, warehouseId, productId, companyId]
      );
      if (!rows.length) throw Object.assign(new Error('Resultado no encontrado'), { status: 404 });
      if (!['difference','review','incomplete'].includes(rows[0].estado)) throw Object.assign(new Error('Este resultado no requiere resolucion manual'), { status: 409 });
      await tx(
        `UPDATE inventarios_resultados SET cantidad_fisica = ?, diferencia = ? - stock_sistema,
          estado = 'review', resuelto_por = ?, resuelto_at = NOW()
         WHERE id = ? AND empresa_id = ?`,
        [physical, physical, actorId(req), rows[0].id, companyId]
      );
      await event(tx, { empresa_id: companyId, inventario_id: inventoryId, bodega_id: warehouseId,
        tipo_evento: 'difference_manually_resolved', motivo: reason, usuario_id: actorId(req),
        anteriores: { cantidad_fisica: rows[0].cantidad_fisica, estado: rows[0].estado },
        nuevos: { producto_id: productId, cantidad_fisica: physical } });
      return { producto_id: productId, cantidad_fisica: physical, estado: 'review' };
    });
    return res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al resolver diferencia manual:', error);
    return failure(res, 500, 'No se pudo resolver la diferencia');
  }
};

export const approveInventoryReconciliation = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const inventoryId = idValue(req.params.id);
  const reason = textValue(req.body.motivo, 1000);
  if (!inventoryId || !reason) return failure(res, 400, 'Inventario y motivo de aprobacion requeridos');
  try {
    const approved = await withTransaction(async (tx) => {
      const inventories = await tx('SELECT id FROM inventarios_fisicos WHERE id = ? AND empresa_id = ? FOR UPDATE', [inventoryId, companyId]);
      if (!inventories.length) throw Object.assign(new Error('Inventario no encontrado'), { status: 404 });
      const unresolved = await tx(
        `SELECT COUNT(*) AS total FROM inventarios_resultados
         WHERE empresa_id = ? AND inventario_id = ?
           AND (estado IN ('difference','incomplete') OR (estado = 'review' AND resuelto_por IS NULL))`,
        [companyId, inventoryId]
      );
      if (Number(unresolved[0].total) > 0) throw Object.assign(new Error('Quedan diferencias o productos incompletos por resolver'), { status: 409 });
      const unfinishedSessions = await tx(
        `SELECT s.id FROM inventarios_sesiones s
         INNER JOIN inventarios_rondas r ON r.id = s.ronda_id AND r.empresa_id = s.empresa_id
         WHERE r.inventario_id = ? AND s.empresa_id = ? AND s.estado NOT IN ('completed','locked') LIMIT 1`,
        [inventoryId, companyId]
      );
      if (unfinishedSessions.length) throw Object.assign(new Error('Hay rondas autorizadas que aun no se han contado'), { status: 409 });
      const rows = await tx(
        `UPDATE inventarios_resultados SET estado = 'approved', resuelto_por = ?, resuelto_at = NOW()
         WHERE empresa_id = ? AND inventario_id = ? AND estado IN ('matched','review') AND cantidad_fisica IS NOT NULL`,
        [actorId(req), companyId, inventoryId]
      );
      if (!rows.affectedRows) throw Object.assign(new Error('No hay resultados completos para aprobar'), { status: 409 });
      await tx(
        `UPDATE inventarios_fisicos_bodegas SET estado = 'reconciled'
         WHERE empresa_id = ? AND inventario_id = ? AND estado <> 'closed'`,
        [companyId, inventoryId]
      );
      await tx('UPDATE inventarios_fisicos SET estado = \'adjustment_pending\' WHERE id = ? AND empresa_id = ?', [inventoryId, companyId]);
      await event(tx, { empresa_id: companyId, inventario_id: inventoryId, tipo_evento: 'reconciliation_approved',
        motivo: reason, usuario_id: actorId(req), nuevos: { resultados_aprobados: rows.affectedRows } });
      return { resultados_aprobados: rows.affectedRows };
    });
    return res.json({ success: true, data: approved });
  } catch (error: any) {
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al aprobar conciliacion:', error);
    return failure(res, 500, 'No se pudo aprobar la conciliacion');
  }
};

export const listAdjustments = async (req: Request, res: Response): Promise<Response> => {
  const resultLimit = req.path.endsWith('/export') ? 10000 : 500;
  try {
    const rows = await query(
      `SELECT a.id, a.inventario_id, a.codigo, a.estado, a.motivo, a.solicitado_por,
              a.revisado_por, a.aprobado_por, a.aplicado_por, a.solicitado_at,
              i.codigo AS inventario_codigo, COUNT(d.id) AS lineas
       FROM inventarios_ajustes a
       INNER JOIN inventarios_fisicos i ON i.id = a.inventario_id AND i.empresa_id = a.empresa_id
       LEFT JOIN inventarios_ajustes_detalle d ON d.ajuste_id = a.id AND d.empresa_id = a.empresa_id
       WHERE a.empresa_id = ?
      GROUP BY a.id, a.inventario_id, a.codigo, a.estado, a.motivo, a.solicitado_por,
          a.revisado_por, a.aprobado_por, a.aplicado_por, a.solicitado_at, i.codigo
      ORDER BY a.solicitado_at DESC LIMIT ${resultLimit}`,
      [tenantId(req)]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al listar solicitudes de ajuste:', error);
    return failure(res, 500, 'No se pudieron cargar las solicitudes');
  }
};

export const authorizeExtraRound = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const inventoryId = idValue(req.params.id);
  const requestedBodegas = Array.isArray(req.body.bodega_ids) ? req.body.bodega_ids.map(idValue) : [];
  const team = Array.isArray(req.body.integrantes) ? req.body.integrantes.map(idValue) : [];
  const reason = textValue(req.body.motivo, 255);
  if (!inventoryId || !requestedBodegas.length || requestedBodegas.some((id: number | null) => !id)
      || !team.length || team.some((id: number | null) => !id)
      || new Set(team).size !== team.length || !reason) {
    return failure(res, 400, 'Inventario, bodegas, equipo independiente y motivo son requeridos');
  }
  try {
    const created = await withTransaction(async (tx) => {
      const inventories = await tx('SELECT max_rondas FROM inventarios_fisicos WHERE id = ? AND empresa_id = ? FOR UPDATE', [inventoryId, companyId]);
      if (!inventories.length) throw Object.assign(new Error('Inventario no encontrado'), { status: 404 });
      const rounds = await tx('SELECT COALESCE(MAX(numero), 0) AS maximo FROM inventarios_rondas WHERE empresa_id = ? AND inventario_id = ?', [companyId, inventoryId]);
      const nextRound = Number(rounds[0].maximo) + 1;
      if (nextRound > Number(inventories[0].max_rondas)) throw Object.assign(new Error('Se alcanzo el maximo configurado de rondas'), { status: 409 });
      const warehouses = await tx(
        `SELECT ib.id, ib.bodega_id FROM inventarios_fisicos_bodegas ib
         WHERE ib.empresa_id = ? AND ib.inventario_id = ? AND ib.bodega_id IN (${requestedBodegas.map(() => '?').join(',')})`,
        [companyId, inventoryId, ...requestedBodegas]
      );
      if (warehouses.length !== requestedBodegas.length) throw Object.assign(new Error('Una bodega no pertenece al inventario'), { status: 400 });
      for (const warehouse of warehouses) {
        const unfinished = await tx(
          `SELECT s.id FROM inventarios_sesiones s
           INNER JOIN inventarios_rondas r ON r.id = s.ronda_id AND r.empresa_id = s.empresa_id
           WHERE r.inventario_id = ? AND s.empresa_id = ? AND s.inventario_bodega_id = ?
             AND s.estado NOT IN ('completed','locked') LIMIT 1`,
          [inventoryId, companyId, warehouse.id]
        );
        if (unfinished.length) throw Object.assign(new Error('Cierra las sesiones anteriores de esta bodega antes de autorizar otra ronda'), { status: 409 });
        const differences = await tx(
          `SELECT id FROM inventarios_resultados
           WHERE empresa_id = ? AND inventario_id = ? AND bodega_id = ?
             AND (estado IN ('difference','incomplete') OR (estado = 'review' AND resuelto_por IS NULL)) LIMIT 1`,
          [companyId, inventoryId, warehouse.bodega_id]
        );
        if (!differences.length) throw Object.assign(new Error('No hay diferencias pendientes para volver a contar esta bodega'), { status: 409 });
      }
      for (const memberId of team as number[]) {
        const users = await tx(
          `SELECT u.id FROM usuarios u LEFT JOIN usuario_empresa ue ON ue.usuario_id = u.id AND ue.empresa_id = ?
           WHERE u.id = ? AND u.activo = 1
             AND ((ue.id IS NOT NULL AND ue.activo = 1) OR (ue.id IS NULL AND u.empresa_id_default = ?)) LIMIT 1`,
          [companyId, memberId, companyId]
        );
        if (!users.length) throw Object.assign(new Error('Integrante no pertenece a esta empresa'), { status: 400 });
      }
      for (const warehouse of warehouses) {
        const previousMembers = await tx(
          `SELECT si.usuario_id FROM inventarios_sesiones_integrantes si
           INNER JOIN inventarios_sesiones s ON s.id = si.sesion_id AND s.empresa_id = si.empresa_id
           INNER JOIN inventarios_fisicos_bodegas ib ON ib.id = s.inventario_bodega_id AND ib.empresa_id = s.empresa_id
           WHERE si.empresa_id = ? AND ib.inventario_id = ? AND ib.id = ?
             AND si.usuario_id IN (${team.map(() => '?').join(',')}) LIMIT 1`,
          [companyId, inventoryId, warehouse.id, ...team]
        );
        if (previousMembers.length) throw Object.assign(new Error('El equipo de la ronda adicional repite integrantes de una ronda anterior'), { status: 409 });
      }
      const round = await tx(
        `INSERT INTO inventarios_rondas (empresa_id, inventario_id, numero, estado, responsable_id, autorizada_por, autorizada_at)
         VALUES (?, ?, ?, 'authorized', ?, ?, NOW())`,
        [companyId, inventoryId, nextRound, team[0], actorId(req)]
      );
      for (const warehouse of warehouses) {
        const session = await tx(
          `INSERT INTO inventarios_sesiones (empresa_id, ronda_id, inventario_bodega_id, estado)
           VALUES (?, ?, ?, 'not_started')`,
          [companyId, round.insertId, warehouse.id]
        );
        for (const memberId of team as number[]) {
          await tx(
            `INSERT INTO inventarios_sesiones_integrantes (empresa_id, sesion_id, usuario_id, rol, agregado_por)
             VALUES (?, ?, ?, ?, ?)`,
            [companyId, session.insertId, memberId, Number(memberId) === Number(team[0]) ? 'responsable' : 'apoyo', actorId(req)]
          );
        }
        const differences = await tx(
          `SELECT resultado.producto_id FROM inventarios_resultados resultado
           WHERE resultado.empresa_id = ? AND resultado.inventario_id = ?
             AND resultado.bodega_id = ?
             AND (resultado.estado IN ('difference','incomplete') OR (resultado.estado = 'review' AND resultado.resuelto_por IS NULL))`,
          [companyId, inventoryId, warehouse.bodega_id]
        );
        if (differences.length) {
          const productIds = differences.map((difference: any) => Number(difference.producto_id));
          await tx(
            `INSERT INTO inventarios_sesiones_productos (empresa_id, sesion_id, producto_id, cobertura)
             VALUES ${productIds.map(() => '(?, ?, ?, ?)').join(',')}`,
            productIds.flatMap((productId: number) => [companyId, session.insertId, productId, 'pending'])
          );
        }
      }
      await event(tx, { empresa_id: companyId, inventario_id: inventoryId, tipo_evento: 'extra_round_authorized',
        motivo: reason, usuario_id: actorId(req), nuevos: { ronda: nextRound, bodegas: requestedBodegas } });
      return { ronda: nextRound, sesiones: warehouses.length };
    });
    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al autorizar ronda adicional:', error);
    return failure(res, 500, 'No se pudo autorizar la ronda adicional');
  }
};

export const createAdjustmentRequest = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const inventoryId = idValue(req.params.id);
  const reason = textValue(req.body.motivo, 4000);
  if (!inventoryId || !reason) return failure(res, 400, 'Inventario y motivo requeridos');
  try {
    const request = await withTransaction(async (tx) => {
      const inventories = await tx('SELECT id, estado FROM inventarios_fisicos WHERE id = ? AND empresa_id = ? FOR UPDATE', [inventoryId, companyId]);
      if (!inventories.length) throw Object.assign(new Error('Inventario no encontrado'), { status: 404 });
      if (inventories[0].estado !== 'adjustment_pending') throw Object.assign(new Error('La conciliacion debe estar aprobada y el inventario abierto para solicitar ajustes'), { status: 409 });
      const existingAdjustment = await tx(
        `SELECT id FROM inventarios_ajustes
         WHERE empresa_id = ? AND inventario_id = ? AND estado IN ('requested','under_review','approved','applied') LIMIT 1 FOR UPDATE`,
        [companyId, inventoryId]
      );
      if (existingAdjustment.length) throw Object.assign(new Error('Ya existe una solicitud activa o aplicada para este inventario'), { status: 409 });
      const results = await tx(
        `SELECT * FROM inventarios_resultados WHERE empresa_id = ? AND inventario_id = ?
         AND estado = 'approved' AND cantidad_fisica IS NOT NULL
           AND diferencia IS NOT NULL AND diferencia <> 0
         ORDER BY bodega_id, producto_id FOR UPDATE`,
        [companyId, inventoryId]
      );
      const actionable = results.filter((row: any) => row.cantidad_fisica !== null && Number(row.diferencia) !== 0);
      if (!actionable.length) throw Object.assign(new Error('No hay diferencias conciliadas para ajustar'), { status: 409 });
      const counts = await tx('SELECT COUNT(*) AS total FROM inventarios_ajustes WHERE empresa_id = ? AND inventario_id = ?', [companyId, inventoryId]);
      const code = `AJ-${inventoryId}-${Number(counts[0].total) + 1}`;
      const inserted = await tx(
        `INSERT INTO inventarios_ajustes (empresa_id, inventario_id, codigo, estado, motivo, solicitado_por)
         VALUES (?, ?, ?, 'requested', ?, ?)`,
        [companyId, inventoryId, code, reason, actorId(req)]
      );
      for (const row of actionable) {
        await tx(
          `INSERT INTO inventarios_ajustes_detalle
            (empresa_id, ajuste_id, resultado_id, producto_id, bodega_id, stock_anterior, cantidad_objetivo, diferencia)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [companyId, inserted.insertId, row.id, row.producto_id, row.bodega_id, row.stock_sistema, row.cantidad_fisica, row.diferencia]
        );
      }
      await tx('UPDATE inventarios_fisicos SET estado = \'adjustment_pending\' WHERE id = ? AND empresa_id = ?', [inventoryId, companyId]);
      await event(tx, { empresa_id: companyId, inventario_id: inventoryId, tipo_evento: 'adjustment_requested',
        motivo: reason, usuario_id: actorId(req), nuevos: { ajuste_id: inserted.insertId, codigo: code, lineas: actionable.length } });
      return { id: inserted.insertId, codigo: code, lineas: actionable.length };
    });
    return res.status(201).json({ success: true, data: request });
  } catch (error: any) {
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al solicitar ajuste:', error);
    return failure(res, 500, 'No se pudo solicitar el ajuste');
  }
};

export const reviewAdjustment = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const adjustmentId = idValue(req.params.ajusteId);
  const targetState = req.body.estado;
  const note = textValue(req.body.observaciones, 4000);
  if (!adjustmentId || !['under_review','approved','rejected'].includes(targetState) || !note) {
    return failure(res, 400, 'Solicitud, decision y observaciones requeridas');
  }
  try {
    const result = await withTransaction(async (tx) => {
      const adjustments = await tx('SELECT * FROM inventarios_ajustes WHERE id = ? AND empresa_id = ? FOR UPDATE', [adjustmentId, companyId]);
      if (!adjustments.length) throw Object.assign(new Error('Solicitud no encontrada'), { status: 404 });
      const adjustment = adjustments[0];
      if (adjustment.estado !== 'requested' && adjustment.estado !== 'under_review') throw Object.assign(new Error('La solicitud ya fue resuelta'), { status: 409 });
      if (Number(adjustment.solicitado_por) === actorId(req)) {
        throw Object.assign(new Error('El solicitante no puede revisar ni aprobar su propio ajuste'), { status: 403 });
      }
      if (targetState === 'under_review' && adjustment.estado !== 'requested') {
        throw Object.assign(new Error('La solicitud ya está en revisión'), { status: 409 });
      }
      if (targetState === 'approved') {
        if (adjustment.estado !== 'under_review' || !adjustment.revisado_por) {
          throw Object.assign(new Error('La solicitud debe ser revisada antes de autorizarse'), { status: 409 });
        }
        if (Number(adjustment.revisado_por) === actorId(req)) {
          throw Object.assign(new Error('El revisor no puede autorizar el mismo ajuste'), { status: 403 });
        }
      }
      await tx(
        `UPDATE inventarios_ajustes SET estado = ?,
          revisado_por = IF(? = 'requested', ?, revisado_por),
          revisado_at = IF(? = 'requested', NOW(), revisado_at),
          aprobado_por = IF(? = 'approved', ?, NULL),
          aprobado_at = IF(? = 'approved', NOW(), NULL),
          observaciones = ? WHERE id = ? AND empresa_id = ?`,
        [targetState, adjustment.estado, actorId(req), adjustment.estado,
          targetState, actorId(req), targetState, note, adjustmentId, companyId]
      );
      await event(tx, { empresa_id: companyId, inventario_id: adjustment.inventario_id,
        tipo_evento: `adjustment_${targetState}`, motivo: note, usuario_id: actorId(req),
        nuevos: { ajuste_id: adjustmentId, estado: targetState } });
      return { id: adjustmentId, estado: targetState };
    });
    return res.json({ success: true, data: result });
  } catch (error: any) {
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al revisar ajuste:', error);
    return failure(res, 500, 'No se pudo revisar la solicitud');
  }
};

export const applyAdjustment = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const adjustmentId = idValue(req.params.ajusteId);
  if (!adjustmentId) return failure(res, 400, 'Solicitud invalida');
  try {
    const applied = await withTransaction(async (tx) => {
      const adjustments = await tx('SELECT * FROM inventarios_ajustes WHERE id = ? AND empresa_id = ? FOR UPDATE', [adjustmentId, companyId]);
      if (!adjustments.length) throw Object.assign(new Error('Solicitud no encontrada'), { status: 404 });
      if (adjustments[0].estado !== 'approved') throw Object.assign(new Error('El ajuste no esta autorizado'), { status: 409 });
      if (Number(adjustments[0].solicitado_por) === actorId(req)
          || Number(adjustments[0].revisado_por) === actorId(req)
          || Number(adjustments[0].aprobado_por) === actorId(req)) {
        throw Object.assign(new Error('Solicitante/revisor/aprobador no puede aplicar el ajuste'), { status: 403 });
      }
      const details = await tx('SELECT * FROM inventarios_ajustes_detalle WHERE empresa_id = ? AND ajuste_id = ? FOR UPDATE', [companyId, adjustmentId]);
      if (!details.length) throw Object.assign(new Error('La solicitud no tiene lineas para aplicar'), { status: 409 });
      const inventoryWarehouses = await tx(
        `SELECT bodega_id FROM inventarios_fisicos_bodegas
         WHERE empresa_id = ? AND inventario_id = ? ORDER BY bodega_id`,
        [companyId, adjustments[0].inventario_id]
      );
      const inventoryWarehouseIds = inventoryWarehouses.map((warehouse: any) => Number(warehouse.bodega_id));
      if (!inventoryWarehouseIds.length) throw Object.assign(new Error('El inventario no tiene bodegas asociadas'), { status: 409 });
      const lockedWarehouses = await tx(
        `SELECT id FROM bodegas WHERE empresa_id = ? AND estado = 'activa'
         AND id IN (${inventoryWarehouseIds.map(() => '?').join(',')}) ORDER BY id FOR UPDATE`,
        [companyId, ...inventoryWarehouseIds]
      );
      if (lockedWarehouses.length !== inventoryWarehouseIds.length) throw Object.assign(new Error('Una bodega ya no pertenece a la empresa'), { status: 409 });
      const inventoryLocks = await tx(
        `SELECT bb.bodega_id, bb.sesion_id FROM inventarios_bodega_bloqueos bb
           INNER JOIN inventarios_sesiones s ON s.id = bb.sesion_id AND s.empresa_id = bb.empresa_id
           INNER JOIN inventarios_rondas r ON r.id = s.ronda_id AND r.empresa_id = s.empresa_id
         WHERE bb.empresa_id = ? AND r.inventario_id = ? FOR UPDATE`,
        [companyId, adjustments[0].inventario_id]
      );
      const detailWarehouseIds = [...new Set(details.map((detail: any) => Number(detail.bodega_id)))];
      for (const warehouseId of detailWarehouseIds) {
        if (!inventoryLocks.some((lock: any) => Number(lock.bodega_id) === warehouseId)) {
          throw Object.assign(new Error('Se perdio el bloqueo de bodega; solicite una nueva conciliacion'), { status: 409 });
        }
      }
      for (const lock of inventoryLocks) {
        await tx('DELETE FROM inventarios_bodega_bloqueos WHERE empresa_id = ? AND bodega_id = ? AND sesion_id = ?',
          [companyId, lock.bodega_id, lock.sesion_id]);
      }
      for (const detail of details) {
        const warehouses = await tx(`SELECT id FROM bodegas WHERE id = ? AND empresa_id = ? AND estado = 'activa' LIMIT 1`, [detail.bodega_id, companyId]);
        const products = await tx(`SELECT id FROM productos WHERE id = ? AND empresa_id = ? AND estado = 'activo' LIMIT 1`, [detail.producto_id, companyId]);
        if (!warehouses.length || !products.length) throw Object.assign(new Error('Producto o bodega no valido para aplicar ajuste'), { status: 400 });
        const stocks = await tx('SELECT stock_actual, stock_reservado FROM productos_bodegas WHERE producto_id = ? AND bodega_id = ? FOR UPDATE', [detail.producto_id, detail.bodega_id]);
        const currentStock = stocks.length ? Number(stocks[0].stock_actual) : 0;
        const reservedStock = stocks.length ? Number(stocks[0].stock_reservado) : 0;
        if (currentStock !== Number(detail.stock_anterior)) throw Object.assign(new Error('El stock cambio desde la conciliacion; requiere nueva revision'), { status: 409 });
        const target = Number(detail.cantidad_objetivo);
        const delta = target - currentStock;
        if (target < 0) throw Object.assign(new Error('Cantidad de ajuste no puede ser negativa'), { status: 400 });
        if (target < reservedStock) throw Object.assign(new Error('La cantidad objetivo no puede ser menor que el stock reservado'), { status: 409 });
        if (stocks.length) {
          await tx('UPDATE productos_bodegas SET stock_actual = ? WHERE producto_id = ? AND bodega_id = ?', [target, detail.producto_id, detail.bodega_id]);
        } else {
          await tx('INSERT INTO productos_bodegas (producto_id, bodega_id, stock_actual) VALUES (?, ?, ?)', [detail.producto_id, detail.bodega_id, target]);
        }
        const totals = await tx(`SELECT COALESCE(SUM(pb.stock_actual), 0) AS total FROM productos_bodegas pb INNER JOIN bodegas b ON b.id = pb.bodega_id AND b.empresa_id = ? WHERE pb.producto_id = ?`, [companyId, detail.producto_id]);
        await tx('UPDATE productos SET stock_actual = ?, updated_at = NOW() WHERE id = ? AND empresa_id = ?', [totals[0].total, detail.producto_id, companyId]);
        const movement = await tx(
          `INSERT INTO inventario_movimientos
            (producto_id, bodega_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
             motivo, referencia_tipo, referencia_id, usuario_id, fecha, notas)
           VALUES (?, ?, ?, ?, ?, ?, 'inventario_fisico', 'inventario_fisico', ?, ?, NOW(), ?)`,
          [detail.producto_id, detail.bodega_id, delta >= 0 ? 'entrada' : 'salida', Math.abs(delta),
            currentStock, target, adjustmentId, actorId(req), adjustments[0].motivo]
        );
        await tx('UPDATE inventarios_ajustes_detalle SET movimiento_id = ? WHERE id = ? AND empresa_id = ?', [movement.insertId, detail.id, companyId]);
      }
      await tx(`UPDATE inventarios_ajustes SET estado = 'applied', aplicado_por = ?, aplicado_at = NOW() WHERE id = ? AND empresa_id = ?`, [actorId(req), adjustmentId, companyId]);
      await event(tx, { empresa_id: companyId, inventario_id: adjustments[0].inventario_id,
        tipo_evento: 'adjustment_applied', usuario_id: actorId(req), nuevos: { ajuste_id: adjustmentId, lineas: details.length } });
      return { ajuste_id: adjustmentId, lineas: details.length };
    });
    return res.json({ success: true, data: applied });
  } catch (error: any) {
    if (error.status) return failure(res, error.status, error.message);
    console.error('Error al aplicar ajuste:', error);
    return failure(res, 500, 'No se pudo aplicar el ajuste');
  }
};
