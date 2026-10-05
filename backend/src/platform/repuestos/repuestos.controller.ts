import { Request, Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { withTransaction } from '../../shared/database';
import { assertBodegasDisponibles, assertEmpresaInventarioDisponible } from '../../shared/inventario-bloqueos';

const tenantId = (req: Request): number => Number((req as any).activosEmpresaId);
const actorId = (req: Request): number => Number((req as any).user?.id);

const replyError = (res: Response, status: number, message: string): Response =>
  res.status(status).json({ success: false, message });

const cleanText = (value: unknown, maxLength: number): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
};

const audit = async (
  txQuery: (sql: string, params?: any[]) => Promise<any>,
  req: Request,
  action: string,
  recordId: number,
  before: unknown,
  after: unknown
): Promise<void> => {
  await txQuery(
    `INSERT INTO auditoria_logs
      (usuario_id, empresa_id, accion, modulo, tabla, registro_id, datos_anteriores, datos_nuevos, url, metodo, created_at)
     VALUES (?, ?, ?, 'repuestos', 'repuestos_catalogo', ?, ?, ?, ?, ?, NOW())`,
    [actorId(req), tenantId(req), action, recordId,
      before === null ? null : JSON.stringify(before),
      after === null ? null : JSON.stringify(after), req.originalUrl, req.method]
  );
};

const getProductForTenant = async (
  txQuery: (sql: string, params?: any[]) => Promise<any>,
  companyId: number,
  productId: number,
  lock = false
): Promise<any | null> => {
  const rows = await txQuery(
    `SELECT id, empresa_id, tipo, maneja_inventario, nombre, sku, codigo_barras, estado, imagen_url
     FROM productos
     WHERE id = ? AND empresa_id = ? AND estado = 'activo'
     LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [productId, companyId]
  );
  return rows[0] || null;
};

export const listAvailableProducts = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const search = cleanText(req.query.buscar, 100);
  try {
    const rows = await withTransaction(async (txQuery) => txQuery(
      `SELECT p.id, p.nombre, p.sku, p.codigo_barras, p.categoria_id,
              c.nombre AS categoria_nombre, p.imagen_url, p.unidad_medida,
              p.stock_actual, p.stock_minimo, p.stock_maximo
       FROM productos p
       LEFT JOIN categorias c ON c.id = p.categoria_id AND c.empresa_id = p.empresa_id
       WHERE p.empresa_id = ? AND p.estado = 'activo'
         AND p.tipo = 'producto' AND p.maneja_inventario = 1
         AND NOT EXISTS (SELECT 1 FROM repuestos_catalogo r WHERE r.producto_id = p.id)
         AND (? IS NULL OR p.nombre LIKE CONCAT('%', ?, '%')
              OR p.sku LIKE CONCAT('%', ?, '%') OR p.codigo_barras LIKE CONCAT('%', ?, '%'))
       ORDER BY p.nombre
       LIMIT 300`,
      [companyId, search, search, search, search]
    ));
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al listar productos disponibles para repuestos:', error);
    return replyError(res, 500, 'No se pudieron cargar los productos disponibles');
  }
};

export const listSpareParts = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const search = cleanText(req.query.buscar, 100);
  const state = cleanText(req.query.estado, 20);
  const resultLimit = req.path.endsWith('/export') ? 10000 : 500;
  if (state && !['activo', 'inactivo'].includes(state)) return replyError(res, 400, 'Estado de repuesto invalido');

  try {
    const result = await withTransaction(async (txQuery) => txQuery(
      `SELECT r.id AS repuesto_id, r.empresa_id, r.producto_id, r.numero_parte,
              r.marca_fabricante, r.serializado, r.estado AS repuesto_estado,
              p.nombre, p.descripcion, p.sku, p.codigo_barras, p.categoria_id,
              c.nombre AS categoria_nombre, p.unidad_medida, p.imagen_url,
              p.stock_actual, p.stock_minimo, p.stock_maximo,
              COALESCE((
                SELECT SUM(pb.stock_actual)
                FROM productos_bodegas pb
                INNER JOIN bodegas b ON b.id = pb.bodega_id AND b.empresa_id = r.empresa_id
                WHERE pb.producto_id = p.id
              ), p.stock_actual) AS stock_total,
              (SELECT COUNT(*) FROM repuestos_unidades ru
               WHERE ru.empresa_id = r.empresa_id AND ru.producto_id = p.id
                 AND ru.estado NOT IN ('retired','unrepairable')) AS unidades_serializadas
       FROM repuestos_catalogo r
       INNER JOIN productos p ON p.id = r.producto_id AND p.empresa_id = r.empresa_id
       LEFT JOIN categorias c ON c.id = p.categoria_id AND c.empresa_id = p.empresa_id
       WHERE r.empresa_id = ?
         AND (? IS NULL OR r.estado = ?)
         AND (? IS NULL OR p.nombre LIKE CONCAT('%', ?, '%')
              OR p.sku LIKE CONCAT('%', ?, '%') OR p.codigo_barras LIKE CONCAT('%', ?, '%')
              OR r.numero_parte LIKE CONCAT('%', ?, '%'))
       ORDER BY p.nombre
      LIMIT ${resultLimit}`,
      [companyId, state, state, search, search, search, search, search]
    ));
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error al listar repuestos:', error);
    return replyError(res, 500, 'No se pudieron cargar los repuestos');
  }
};

export const createSparePart = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const productId = Number(req.body.producto_id);
  const partNumber = cleanText(req.body.numero_parte, 120);
  const manufacturer = cleanText(req.body.marca_fabricante, 100);
  const serialized = req.body.serializado === true || Number(req.body.serializado) === 1 ? 1 : 0;
  if (!Number.isSafeInteger(productId) || productId <= 0) return replyError(res, 400, 'Producto valido requerido');

  try {
    const part = await withTransaction(async (txQuery) => {
      await assertEmpresaInventarioDisponible(txQuery, companyId);
      const product = await getProductForTenant(txQuery, companyId, productId, true);
      if (!product || product.tipo !== 'producto' || Number(product.maneja_inventario) !== 1) {
        throw Object.assign(new Error('El repuesto debe ser un producto inventariable de la empresa'), { status: 400 });
      }
      const duplicate = await txQuery('SELECT id FROM repuestos_catalogo WHERE producto_id = ? LIMIT 1', [productId]);
      if (duplicate.length > 0) throw Object.assign(new Error('El producto ya esta registrado como repuesto'), { status: 409 });
      const result = await txQuery(
        `INSERT INTO repuestos_catalogo
          (empresa_id, producto_id, numero_parte, marca_fabricante, serializado, creado_por)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [companyId, productId, partNumber, manufacturer, serialized, actorId(req)]
      );
      const id = Number(result.insertId);
      await audit(txQuery, req, 'CREATE', id, null, {
        producto_id: productId, numero_parte: partNumber, marca_fabricante: manufacturer, serializado: serialized
      });
      return { id, producto_id: productId };
    });
    return res.status(201).json({ success: true, data: part });
  } catch (error: any) {
    if (error.status) return replyError(res, error.status, error.message);
    if (error.code === 'ER_DUP_ENTRY') return replyError(res, 409, 'Producto, numero de parte o perfil de repuesto duplicado');
    console.error('Error al registrar repuesto:', error);
    return replyError(res, 500, 'No se pudo registrar el repuesto');
  }
};

export const updateSparePart = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const productId = Number(req.params.productoId);
  if (!Number.isSafeInteger(productId) || productId <= 0) return replyError(res, 400, 'Producto invalido');

  const partNumber = req.body.numero_parte === undefined ? undefined : cleanText(req.body.numero_parte, 120);
  const manufacturer = req.body.marca_fabricante === undefined ? undefined : cleanText(req.body.marca_fabricante, 100);
  const state = req.body.estado;
  if (state !== undefined && !['activo', 'inactivo'].includes(state)) return replyError(res, 400, 'Estado de repuesto invalido');
  const serialized = req.body.serializado === undefined
    ? undefined : req.body.serializado === true || Number(req.body.serializado) === 1 ? 1 : 0;

  try {
    const updated = await withTransaction(async (txQuery) => {
      if (serialized !== undefined) await assertEmpresaInventarioDisponible(txQuery, companyId);
      const rows = await txQuery(
        'SELECT * FROM repuestos_catalogo WHERE producto_id = ? AND empresa_id = ? FOR UPDATE',
        [productId, companyId]
      );
      if (rows.length === 0) throw Object.assign(new Error('Repuesto no encontrado'), { status: 404 });
      const current = rows[0];
      if (serialized !== undefined && serialized !== Number(current.serializado)) {
        const units = await txQuery('SELECT id FROM repuestos_unidades WHERE empresa_id = ? AND producto_id = ? LIMIT 1', [companyId, productId]);
        if (units.length > 0) throw Object.assign(new Error('No se puede cambiar el control serial mientras existan unidades registradas'), { status: 409 });
      }
      const before = { numero_parte: current.numero_parte, marca_fabricante: current.marca_fabricante, serializado: current.serializado, estado: current.estado };
      await txQuery(
        `UPDATE repuestos_catalogo SET
          numero_parte = COALESCE(?, numero_parte),
          marca_fabricante = COALESCE(?, marca_fabricante),
          serializado = COALESCE(?, serializado),
          estado = COALESCE(?, estado),
          updated_at = NOW()
         WHERE producto_id = ? AND empresa_id = ?`,
        [partNumber ?? null, manufacturer ?? null, serialized ?? null, state ?? null, productId, companyId]
      );
      await audit(txQuery, req, 'UPDATE', Number(current.id), before, {
        numero_parte: partNumber ?? current.numero_parte,
        marca_fabricante: manufacturer ?? current.marca_fabricante,
        serializado: serialized ?? Number(current.serializado),
        estado: state ?? current.estado
      });
      return { producto_id: productId };
    });
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.status) return replyError(res, error.status, error.message);
    if (error.code === 'ER_DUP_ENTRY') return replyError(res, 409, 'Numero de parte duplicado en la empresa');
    console.error('Error al actualizar repuesto:', error);
    return replyError(res, 500, 'No se pudo actualizar el repuesto');
  }
};

export const listCompatibility = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const productId = Number(req.params.productoId);
  if (!Number.isSafeInteger(productId) || productId <= 0) return replyError(res, 400, 'Producto invalido');
  try {
    const data = await withTransaction(async (txQuery) => {
      const parts = await txQuery('SELECT id FROM repuestos_catalogo WHERE producto_id = ? AND empresa_id = ? LIMIT 1', [productId, companyId]);
      if (parts.length === 0) throw Object.assign(new Error('Repuesto no encontrado'), { status: 404 });
      return txQuery(
        `SELECT c.id, c.activo_tipo_id, t.nombre AS tipo_nombre,
                a.nombre AS categoria_nombre, c.notas
         FROM repuestos_compatibilidad c
         INNER JOIN activos_tipos t ON t.id = c.activo_tipo_id AND t.empresa_id = c.empresa_id
         INNER JOIN activos_categorias a ON a.id = t.categoria_id AND a.empresa_id = c.empresa_id
         WHERE c.empresa_id = ? AND c.producto_id = ?
         ORDER BY a.nombre, t.nombre`,
        [companyId, productId]
      );
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    if (error.status) return replyError(res, error.status, error.message);
    console.error('Error al consultar compatibilidad de repuesto:', error);
    return replyError(res, 500, 'No se pudo cargar compatibilidad');
  }
};

export const listCompatibleAssetTypes = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  try {
    const result = await withTransaction(async (txQuery) => txQuery(
      `SELECT t.id, t.categoria_id, t.nombre, c.nombre AS categoria_nombre
       FROM activos_tipos t
       INNER JOIN activos_categorias c ON c.id = t.categoria_id AND c.empresa_id = t.empresa_id
       WHERE t.empresa_id = ? AND t.estado = 'activo' AND c.estado = 'activa'
       ORDER BY c.nombre, t.nombre`,
      [companyId]
    ));
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error al listar tipos compatibles:', error);
    return replyError(res, 500, 'No se pudieron cargar los tipos de activos');
  }
};

export const listPartWarehouses = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  try {
    const rows = await withTransaction(async (txQuery) => txQuery(
      `SELECT id, codigo, nombre, estado
       FROM bodegas
       WHERE empresa_id = ? AND estado = 'activa'
       ORDER BY es_principal DESC, nombre`,
      [companyId]
    ));
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al listar bodegas de repuestos:', error);
    return replyError(res, 500, 'No se pudieron cargar las bodegas');
  }
};

export const getSerializedTransitionReferences = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  try {
    const [assets, orders, warehouses] = await Promise.all([
      withTransaction(async (txQuery) => txQuery(
        `SELECT id, codigo, nombre FROM activos
         WHERE empresa_id = ? AND estado <> 'retired' ORDER BY nombre LIMIT 500`,
        [companyId]
      )),
      withTransaction(async (txQuery) => txQuery(
        `SELECT mo.id, mo.codigo, mo.activo_id, a.codigo AS activo_codigo, a.nombre AS activo_nombre
         FROM mantenimiento_ordenes mo
         INNER JOIN activos a ON a.id = mo.activo_id AND a.empresa_id = mo.empresa_id
         WHERE mo.empresa_id = ? AND mo.estado IN ('in_progress','waiting_parts')
         ORDER BY mo.updated_at DESC LIMIT 500`,
        [companyId]
      )),
      withTransaction(async (txQuery) => txQuery(
        `SELECT id, codigo, nombre FROM bodegas
         WHERE empresa_id = ? AND estado = 'activa' ORDER BY nombre`,
        [companyId]
      ))
    ]);
    return res.json({ success: true, data: { activos: assets, ordenes: orders, bodegas: warehouses } });
  } catch (error) {
    console.error('Error al cargar referencias de transicion serial:', error);
    return replyError(res, 500, 'No se pudieron cargar las referencias');
  }
};

export const addCompatibility = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const productId = Number(req.params.productoId);
  const assetTypeId = Number(req.body.activo_tipo_id);
  const notes = cleanText(req.body.notas, 500);
  if (!Number.isSafeInteger(productId) || productId <= 0 || !Number.isSafeInteger(assetTypeId) || assetTypeId <= 0) {
    return replyError(res, 400, 'Repuesto y tipo de activo son requeridos');
  }
  try {
    const id = await withTransaction(async (txQuery) => {
      const parts = await txQuery('SELECT id FROM repuestos_catalogo WHERE producto_id = ? AND empresa_id = ? FOR UPDATE', [productId, companyId]);
      if (parts.length === 0) throw Object.assign(new Error('Repuesto no encontrado'), { status: 404 });
      const types = await txQuery('SELECT id FROM activos_tipos WHERE id = ? AND empresa_id = ? LIMIT 1', [assetTypeId, companyId]);
      if (types.length === 0) throw Object.assign(new Error('Tipo de activo no valido para esta empresa'), { status: 400 });
      const result = await txQuery(
        `INSERT INTO repuestos_compatibilidad (empresa_id, producto_id, activo_tipo_id, notas, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [companyId, productId, assetTypeId, notes, actorId(req)]
      );
      await audit(txQuery, req, 'COMPATIBILITY_CREATE', Number(result.insertId), null, { producto_id: productId, activo_tipo_id: assetTypeId });
      return Number(result.insertId);
    });
    return res.status(201).json({ success: true, data: { id } });
  } catch (error: any) {
    if (error.status) return replyError(res, error.status, error.message);
    if (error.code === 'ER_DUP_ENTRY') return replyError(res, 409, 'La compatibilidad ya existe');
    console.error('Error al crear compatibilidad de repuesto:', error);
    return replyError(res, 500, 'No se pudo crear la compatibilidad');
  }
};

export const registerSerializedUnit = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const productId = Number(req.params.productoId);
  const serial = cleanText(req.body.numero_serie, 160);
  const lot = cleanText(req.body.lote, 100);
  const warehouseId = Number(req.body.bodega_id);
  if (!Number.isSafeInteger(productId) || productId <= 0 || !serial
      || !Number.isSafeInteger(warehouseId) || warehouseId <= 0) {
    return replyError(res, 400, 'Producto, numero de serie y bodega son requeridos');
  }

  try {
    const created = await withTransaction(async (txQuery) => {
      await assertBodegasDisponibles(txQuery, [warehouseId]);
      const product = await getProductForTenant(txQuery, companyId, productId, true);
      if (!product) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
      const profiles = await txQuery(
        'SELECT id, serializado FROM repuestos_catalogo WHERE producto_id = ? AND empresa_id = ? AND estado = \'activo\' FOR UPDATE',
        [productId, companyId]
      );
      if (profiles.length === 0 || Number(profiles[0].serializado) !== 1) {
        throw Object.assign(new Error('El repuesto no tiene control serial activado'), { status: 409 });
      }
      const warehouses = await txQuery('SELECT id FROM bodegas WHERE id = ? AND empresa_id = ? AND estado = \'activa\' LIMIT 1', [warehouseId, companyId]);
      if (warehouses.length === 0) throw Object.assign(new Error('Bodega no valida para esta empresa'), { status: 400 });
      const stocks = await txQuery(
        'SELECT stock_actual FROM productos_bodegas WHERE producto_id = ? AND bodega_id = ? FOR UPDATE',
        [productId, warehouseId]
      );
      const stock = stocks.length ? Number(stocks[0].stock_actual) : 0;
      const unitCounts = await txQuery(
        `SELECT COUNT(*) AS total FROM repuestos_unidades
         WHERE empresa_id = ? AND producto_id = ? AND bodega_actual_id = ?
           AND estado IN ('available','reserved')`,
        [companyId, productId, warehouseId]
      );
      if (Number(unitCounts[0]?.total || 0) >= stock) {
        throw Object.assign(new Error('No hay una unidad de stock disponible para asociar este serial'), { status: 409 });
      }
      const result = await txQuery(
        `INSERT INTO repuestos_unidades
          (empresa_id, producto_id, numero_serie, lote, estado, bodega_actual_id, recibido_at)
         VALUES (?, ?, ?, ?, 'available', ?, NOW())`,
        [companyId, productId, serial, lot, warehouseId]
      );
      const unitId = Number(result.insertId);
      await txQuery(
        `INSERT INTO repuestos_unidades_eventos
          (empresa_id, unidad_id, tipo_evento, estado_anterior, estado_nuevo, bodega_id, usuario_id, ocurrido_at)
         VALUES (?, ?, 'registered_from_stock', NULL, 'available', ?, ?, NOW())`,
        [companyId, unitId, warehouseId, actorId(req)]
      );
      await audit(txQuery, req, 'SERIAL_REGISTER', unitId, null, { producto_id: productId, numero_serie: serial, bodega_id: warehouseId });
      return { id: unitId, producto_id: productId, numero_serie: serial, estado: 'available' };
    });
    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    if (error.status) return replyError(res, error.status, error.message);
    if (error.code === 'ER_DUP_ENTRY') return replyError(res, 409, 'Este numero de serie ya esta registrado');
    console.error('Error al registrar unidad serializada:', error);
    return replyError(res, 500, 'No se pudo registrar la unidad serializada');
  }
};

export const listSerializedUnits = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const productId = Number(req.params.productoId);
  if (!Number.isSafeInteger(productId) || productId <= 0) return replyError(res, 400, 'Producto invalido');
  try {
    const rows = await withTransaction(async (txQuery) => txQuery(
      `SELECT u.id, u.producto_id, p.nombre AS producto_nombre, p.sku,
              u.numero_serie, u.lote, u.estado, u.activo_actual_id,
              a.codigo AS activo_codigo, a.nombre AS activo_nombre,
              u.bodega_actual_id, b.nombre AS bodega_nombre, u.recibido_at, u.updated_at
       FROM repuestos_unidades u
       INNER JOIN productos p ON p.id = u.producto_id AND p.empresa_id = u.empresa_id
       LEFT JOIN activos a ON a.id = u.activo_actual_id AND a.empresa_id = u.empresa_id
       LEFT JOIN bodegas b ON b.id = u.bodega_actual_id AND b.empresa_id = u.empresa_id
       WHERE u.empresa_id = ? AND u.producto_id = ?
       ORDER BY u.numero_serie
       LIMIT 500`,
      [companyId, productId]
    ));
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al listar unidades serializadas:', error);
    return replyError(res, 500, 'No se pudieron cargar las unidades serializadas');
  }
};

export const getSerializedUnitHistory = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const unitId = Number(req.params.unidadId);
  if (!Number.isSafeInteger(unitId) || unitId <= 0) return replyError(res, 400, 'Unidad serializada invalida');
  try {
    const rows = await withTransaction(async (txQuery) => txQuery(
      `SELECT e.id, e.tipo_evento, e.estado_anterior, e.estado_nuevo, e.bodega_id,
              b.nombre AS bodega_nombre, e.activo_id, a.codigo AS activo_codigo,
              e.mantenimiento_id, e.motivo, e.ocurrido_at,
              CONCAT_WS(' ', u.nombre, u.apellido) AS usuario_nombre
       FROM repuestos_unidades_eventos e
       INNER JOIN repuestos_unidades ru ON ru.id = e.unidad_id AND ru.empresa_id = e.empresa_id
       LEFT JOIN bodegas b ON b.id = e.bodega_id AND b.empresa_id = e.empresa_id
       LEFT JOIN activos a ON a.id = e.activo_id AND a.empresa_id = e.empresa_id
       LEFT JOIN usuarios u ON u.id = e.usuario_id
       WHERE e.empresa_id = ? AND e.unidad_id = ?
       ORDER BY e.ocurrido_at DESC, e.id DESC
       LIMIT 250`,
      [companyId, unitId]
    ));
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al consultar trazabilidad serial:', error);
    return replyError(res, 500, 'No se pudo cargar la trazabilidad');
  }
};

export const transitionSerializedUnit = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const unitId = Number(req.params.unidadId);
  const targetState = cleanText(req.body.estado, 30);
  const reason = cleanText(req.body.motivo, 255);
  const requestedWarehouseId = req.body.bodega_id ? Number(req.body.bodega_id) : null;
  const requestedAssetId = req.body.activo_id ? Number(req.body.activo_id) : null;
  const maintenanceId = req.body.mantenimiento_id ? Number(req.body.mantenimiento_id) : null;
  if (!Number.isSafeInteger(unitId) || unitId <= 0 || !targetState
      || (requestedWarehouseId !== null && (!Number.isSafeInteger(requestedWarehouseId) || requestedWarehouseId <= 0))
      || (requestedAssetId !== null && (!Number.isSafeInteger(requestedAssetId) || requestedAssetId <= 0))
      || (maintenanceId !== null && (!Number.isSafeInteger(maintenanceId) || maintenanceId <= 0))) {
    return replyError(res, 400, 'Transicion de unidad serial invalida');
  }
  const transitions: Record<string, string[]> = {
    available: ['reserved','in_repair','quarantine','installed','retired'],
    reserved: ['available','in_repair','quarantine','installed','retired'],
    installed: ['available','in_repair','quarantine','retired'],
    in_repair: ['available','quarantine','unrepairable','retired'],
    quarantine: ['available','in_repair','unrepairable','retired'],
    unrepairable: ['retired'],
    retired: []
  };
  const blocked = (state: string): boolean => ['reserved','in_repair','quarantine','unrepairable'].includes(state);

  try {
    const updated = await withTransaction(async (txQuery) => {
      const units = await txQuery(
        `SELECT u.* FROM repuestos_unidades u
         INNER JOIN repuestos_catalogo rc ON rc.producto_id = u.producto_id AND rc.empresa_id = u.empresa_id
         WHERE u.id = ? AND u.empresa_id = ? AND rc.serializado = 1 FOR UPDATE`,
        [unitId, companyId]
      );
      if (!units.length) throw Object.assign(new Error('Unidad serial no encontrada'), { status: 404 });
      const current = units[0];
      if (!(transitions[current.estado] || []).includes(targetState)) {
        throw Object.assign(new Error(`Transicion no permitida: ${current.estado} -> ${targetState}`), { status: 409 });
      }
      if (!reason) throw Object.assign(new Error('El motivo de transicion es obligatorio'), { status: 400 });
      const oldAssetId = current.activo_actual_id ? Number(current.activo_actual_id) : null;
      const assetId = targetState === 'installed' ? requestedAssetId : oldAssetId;
      if (targetState === 'installed' || current.estado === 'installed') {
        if (!assetId || !maintenanceId) throw Object.assign(new Error('Instalacion o retiro requiere activo y orden de mantenimiento'), { status: 400 });
        const orders = await txQuery(
          `SELECT id FROM mantenimiento_ordenes
           WHERE id = ? AND empresa_id = ? AND activo_id = ? AND estado IN ('in_progress','waiting_parts') LIMIT 1`,
          [maintenanceId, companyId, assetId]
        );
        if (!orders.length) throw Object.assign(new Error('Orden de mantenimiento no valida'), { status: 400 });
      }
      if (targetState === 'installed') {
        const compatibility = await txQuery(
          `SELECT c.id FROM repuestos_compatibilidad c
           INNER JOIN activos a ON a.tipo_id = c.activo_tipo_id AND a.empresa_id = c.empresa_id
           WHERE c.empresa_id = ? AND c.producto_id = ? AND a.id = ? LIMIT 1`,
          [companyId, current.producto_id, assetId]
        );
        if (!compatibility.length) throw Object.assign(new Error('Repuesto no compatible con el tipo de activo'), { status: 409 });
      }

      const oldWarehouse = current.bodega_actual_id ? Number(current.bodega_actual_id) : null;
      let newWarehouse = requestedWarehouseId || oldWarehouse;
      if (targetState === 'installed') newWarehouse = null;
      if (targetState !== 'installed' && targetState !== 'retired' && !newWarehouse) {
        throw Object.assign(new Error('Bodega destino requerida'), { status: 400 });
      }
      const wasInStock = !['installed','retired'].includes(current.estado);
      const willBeInStock = !['installed','retired'].includes(targetState);
      const changes: Array<{ warehouse: number; actual: number; reserved: number }> = [];
      if (wasInStock && willBeInStock && oldWarehouse === Number(newWarehouse)) {
        changes.push({ warehouse: Number(newWarehouse), actual: 0, reserved: Number(blocked(targetState)) - Number(blocked(current.estado)) });
      } else {
        if (wasInStock && oldWarehouse) changes.push({ warehouse: oldWarehouse, actual: -1, reserved: blocked(current.estado) ? -1 : 0 });
        if (willBeInStock && newWarehouse) changes.push({ warehouse: Number(newWarehouse), actual: 1, reserved: blocked(targetState) ? 1 : 0 });
      }
      const warehouseIds = changes.map((change) => change.warehouse);
      if (warehouseIds.length) await assertBodegasDisponibles(txQuery, warehouseIds);
      for (const change of changes) {
        const warehouses = await txQuery(`SELECT id FROM bodegas WHERE id = ? AND empresa_id = ? AND estado = 'activa' LIMIT 1`, [change.warehouse, companyId]);
        if (!warehouses.length) throw Object.assign(new Error('Bodega invalida'), { status: 400 });
        const stock = await txQuery(
          `SELECT pb.stock_actual, pb.stock_reservado FROM productos_bodegas pb
           INNER JOIN productos p ON p.id = pb.producto_id AND p.empresa_id = ?
           INNER JOIN bodegas b ON b.id = pb.bodega_id AND b.empresa_id = ?
           WHERE pb.producto_id = ? AND pb.bodega_id = ? FOR UPDATE`,
          [companyId, companyId, current.producto_id, change.warehouse]
        );
        if (!stock.length) throw Object.assign(new Error('No existe stock de este repuesto en la bodega'), { status: 409 });
        const previous = Number(stock[0].stock_actual);
        const previousReserved = Number(stock[0].stock_reservado);
        const next = previous + change.actual;
        const nextReserved = previousReserved + change.reserved;
        if (next < 0 || nextReserved < 0 || nextReserved > next) throw Object.assign(new Error('La transicion deja stock inconsistente'), { status: 409 });
        await txQuery('UPDATE productos_bodegas SET stock_actual = ?, stock_reservado = ? WHERE producto_id = ? AND bodega_id = ?', [next, nextReserved, current.producto_id, change.warehouse]);
        if (change.actual !== 0) {
          const products = await txQuery(
            `SELECT p.id, COALESCE(SUM(pb.stock_actual), 0) AS total
             FROM productos p LEFT JOIN productos_bodegas pb ON pb.producto_id = p.id
             WHERE p.id = ? AND p.empresa_id = ? GROUP BY p.id FOR UPDATE`,
            [current.producto_id, companyId]
          );
          if (!products.length || Number(products[0].total) < 0) throw Object.assign(new Error('El stock global quedaria negativo'), { status: 409 });
          await txQuery('UPDATE productos SET stock_actual = ?, updated_at = NOW() WHERE id = ? AND empresa_id = ?', [products[0].total, current.producto_id, companyId]);
          await txQuery(
            `INSERT INTO inventario_movimientos
              (producto_id, bodega_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo,
               motivo, referencia_tipo, referencia_id, usuario_id, fecha, notas)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'mantenimiento', ?, ?, NOW(), ?)`,
            [current.producto_id, change.warehouse, change.actual > 0 ? 'entrada' : 'salida', Math.abs(change.actual),
              previous, next, reason, maintenanceId || unitId, actorId(req), reason]
          );
        }
      }
      await txQuery(
        `UPDATE repuestos_unidades SET estado = ?, activo_actual_id = ?, bodega_actual_id = ?, updated_at = NOW()
         WHERE id = ? AND empresa_id = ?`,
        [targetState, targetState === 'installed' ? assetId : null, willBeInStock ? newWarehouse : null, unitId, companyId]
      );
      await txQuery(
        `INSERT INTO repuestos_unidades_eventos
          (empresa_id, unidad_id, tipo_evento, estado_anterior, estado_nuevo, activo_id, mantenimiento_id,
           bodega_id, motivo, usuario_id, ocurrido_at)
         VALUES (?, ?, 'state_transition', ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [companyId, unitId, current.estado, targetState, assetId, maintenanceId,
          willBeInStock ? newWarehouse : null, reason, actorId(req)]
      );
      if (maintenanceId) {
        await txQuery(
          `INSERT INTO mantenimiento_ordenes_repuestos
            (empresa_id, mantenimiento_id, producto_id, unidad_serial_id, bodega_id, operacion,
             cantidad, motivo_retiro, usuario_id, ocurrido_at)
           VALUES (?, ?, ?, ?, ?, ?, 1.000, ?, ?, NOW())`,
          [companyId, maintenanceId, current.producto_id, unitId, newWarehouse || oldWarehouse,
            targetState === 'installed' ? 'instalado' : current.estado === 'installed' ? 'retirado' : 'devuelto', reason, actorId(req)]
        );
      }
      await audit(txQuery, req, 'SERIAL_TRANSITION', unitId,
        { estado: current.estado, activo_id: current.activo_actual_id, bodega_id: current.bodega_actual_id },
        { estado: targetState, activo_id: targetState === 'installed' ? assetId : null, bodega_id: willBeInStock ? newWarehouse : null, motivo: reason });
      return { id: unitId, estado: targetState };
    });
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.status) return replyError(res, error.status, error.message);
    console.error('Error al cambiar estado serializado:', error);
    return replyError(res, 500, 'No se pudo actualizar el estado serializado');
  }
};
