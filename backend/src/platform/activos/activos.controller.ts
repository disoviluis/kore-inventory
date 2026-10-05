import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool, { withTransaction } from '../../shared/database';
import { createS3PresignedUploadUrl, getS3PublicUrl } from '../../shared/s3';

const tenantId = (req: Request): number => Number((req as any).activosEmpresaId);
const actorId = (req: Request): number => Number((req as any).user?.id);

const sendError = (res: Response, status: number, message: string): Response =>
  res.status(status).json({ success: false, message });

const cleanText = (value: unknown, maxLength: number): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
};

const normalizeImageUrl = (value: unknown): string | null | false => {
  const text = cleanText(value, 1000);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    return ['http:', 'https:'].includes(parsed.protocol) ? text : false;
  } catch {
    return false;
  }
};

const parseOptionalId = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : NaN;
};

const createAssetEvent = async (
  txQuery: (sql: string, params?: any[]) => Promise<any>,
  data: {
    companyId: number;
    assetId: number;
    eventType: string;
    actorId: number;
    reason?: string | null;
    before?: unknown;
    after?: unknown;
  }
): Promise<void> => {
  await txQuery(
    `INSERT INTO activos_eventos
      (empresa_id, activo_id, tipo_evento, motivo, datos_anteriores, datos_nuevos, usuario_id, ocurrido_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      data.companyId,
      data.assetId,
      data.eventType,
      data.reason || null,
      data.before === undefined ? null : JSON.stringify(data.before),
      data.after === undefined ? null : JSON.stringify(data.after),
      data.actorId
    ]
  );
};

const validateCategoryAndType = async (
  txQuery: (sql: string, params?: any[]) => Promise<any>,
  companyId: number,
  categoryId: number,
  typeId: number
): Promise<boolean> => {
  const rows = await txQuery(
    `SELECT t.id
     FROM activos_tipos t
     INNER JOIN activos_categorias c ON c.id = t.categoria_id AND c.empresa_id = t.empresa_id
     WHERE t.id = ? AND t.empresa_id = ? AND t.categoria_id = ?
       AND t.estado = 'activo' AND c.estado = 'activa'
     LIMIT 1`,
    [typeId, companyId, categoryId]
  );
  return rows.length > 0;
};

const validateWarehouse = async (
  txQuery: (sql: string, params?: any[]) => Promise<any>,
  companyId: number,
  warehouseId: number | null
): Promise<boolean> => {
  if (warehouseId === null) return true;
  const rows = await txQuery(
    'SELECT id FROM bodegas WHERE id = ? AND empresa_id = ? LIMIT 1',
    [warehouseId, companyId]
  );
  return rows.length > 0;
};

const validateUser = async (
  txQuery: (sql: string, params?: any[]) => Promise<any>,
  companyId: number,
  userId: number | null
): Promise<boolean> => {
  if (userId === null) return true;
  const rows = await txQuery(
    `SELECT u.id
     FROM usuarios u
     LEFT JOIN usuario_empresa ue ON ue.usuario_id = u.id AND ue.empresa_id = ?
     WHERE u.id = ? AND u.activo = 1
       AND ((ue.id IS NOT NULL AND ue.activo = 1)
         OR (ue.id IS NULL AND u.empresa_id_default = ?))
     LIMIT 1`,
    [companyId, userId, companyId]
  );
  return rows.length > 0;
};

const persistAssetAttributes = async (
  txQuery: (sql: string, params?: any[]) => Promise<any>,
  companyId: number,
  assetId: number,
  typeId: number,
  attributes: any[],
  userId: number
): Promise<void> => {
  const definitions = await txQuery(
    `SELECT id, clave, tipo_dato, requerido, opciones_json
     FROM activos_atributos_def
     WHERE empresa_id = ? AND tipo_id = ? AND estado = 'activo'
     FOR UPDATE`,
    [companyId, typeId]
  );
  const definitionMap = new Map<number, any>(definitions.map((definition: any) => [Number(definition.id), definition]));
  const submittedMap = new Map<number, any>();
  for (const attribute of attributes) {
    const definitionId = Number(attribute?.atributo_id);
    const definition = definitionMap.get(definitionId);
    if (!definition || submittedMap.has(definitionId)) {
      throw Object.assign(new Error('Atributo no valido o repetido para el tipo'), { status: 400 });
    }
    submittedMap.set(definitionId, attribute.valor);
  }
  for (const definition of definitions) {
    if (Number(definition.requerido) === 1) {
      const rawValue = submittedMap.get(Number(definition.id));
      if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
        throw Object.assign(new Error(`Falta el atributo requerido: ${definition.clave}`), { status: 400 });
      }
    }
  }

  const changes: Array<{ clave: string; anterior: unknown; nuevo: unknown }> = [];
  for (const [definitionId, rawValue] of submittedMap) {
    const definition = definitionMap.get(definitionId);
    const previousRows = await txQuery(
      `SELECT valor_texto, valor_numero, valor_booleano, valor_fecha
       FROM activos_atributos_valores
       WHERE empresa_id = ? AND activo_id = ? AND atributo_id = ?
       LIMIT 1 FOR UPDATE`,
      [companyId, assetId, definitionId]
    );
    const previous = previousRows[0];
    const oldValue = previous
      ? previous.valor_texto ?? previous.valor_numero ?? previous.valor_booleano ?? previous.valor_fecha ?? null
      : null;
    const value = rawValue === undefined || rawValue === null || rawValue === '' ? null : rawValue;
    let textValue: string | null = null;
    let numberValue: number | null = null;
    let booleanValue: number | null = null;
    let dateValue: string | null = null;

    if (value !== null) {
      if (definition.tipo_dato === 'numero') {
        numberValue = Number(value);
        if (!Number.isFinite(numberValue)) throw Object.assign(new Error(`Valor numerico invalido: ${definition.clave}`), { status: 400 });
      } else if (definition.tipo_dato === 'booleano') {
        if (![true, false, 1, 0, '1', '0', 'true', 'false'].includes(value)) {
          throw Object.assign(new Error(`Valor booleano invalido: ${definition.clave}`), { status: 400 });
        }
        booleanValue = [true, 1, '1', 'true'].includes(value) ? 1 : 0;
      } else if (definition.tipo_dato === 'fecha') {
        dateValue = String(value);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) throw Object.assign(new Error(`Fecha invalida: ${definition.clave}`), { status: 400 });
      } else {
        textValue = String(value).slice(0, 4000);
        if (definition.tipo_dato === 'opcion') {
          const options = Array.isArray(definition.opciones_json)
            ? definition.opciones_json
            : JSON.parse(String(definition.opciones_json || '[]'));
          if (!options.includes(textValue)) throw Object.assign(new Error(`Opcion invalida: ${definition.clave}`), { status: 400 });
        }
      }
    }

    const newValue = textValue ?? numberValue ?? booleanValue ?? dateValue ?? null;
    changes.push({ clave: definition.clave, anterior: oldValue, nuevo: newValue });

    await txQuery(
      `INSERT INTO activos_atributos_valores
        (empresa_id, activo_id, atributo_id, valor_texto, valor_numero, valor_booleano, valor_fecha, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE valor_texto = VALUES(valor_texto), valor_numero = VALUES(valor_numero),
         valor_booleano = VALUES(valor_booleano), valor_fecha = VALUES(valor_fecha),
         updated_by = VALUES(updated_by), updated_at = NOW()`,
      [companyId, assetId, definitionId, textValue, numberValue, booleanValue, dateValue, userId]
    );
  }

  if (changes.length > 0) {
    await txQuery(
      `INSERT INTO activos_eventos
        (empresa_id, activo_id, tipo_evento, motivo, datos_anteriores, datos_nuevos, usuario_id, ocurrido_at)
       VALUES (?, ?, 'attributes_updated', 'Actualizacion de caracteristicas', ?, ?, ?, NOW())`,
      [companyId, assetId, JSON.stringify(changes.map((change) => ({ clave: change.clave, valor: change.anterior }))),
        JSON.stringify(changes.map((change) => ({ clave: change.clave, valor: change.nuevo }))), userId]
    );
  }
};

export const listCategories = async (req: Request, res: Response): Promise<Response> => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, nombre, descripcion, estado, created_at, updated_at
       FROM activos_categorias
       WHERE empresa_id = ?
       ORDER BY estado = 'activa' DESC, nombre`,
      [tenantId(req)]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al listar categorias de activos:', error);
    return sendError(res, 500, 'No se pudieron cargar las categorias de activos');
  }
};

export const getAssetReferences = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  try {
    const [warehouses, users, providers] = await Promise.all([
      pool.execute<RowDataPacket[]>(
        `SELECT id, codigo, nombre, estado
         FROM bodegas
         WHERE empresa_id = ? AND estado = 'activa'
         ORDER BY es_principal DESC, nombre`,
        [companyId]
      ),
      pool.execute<RowDataPacket[]>(
        `SELECT DISTINCT u.id, u.nombre, u.apellido, u.email, u.activo
         FROM usuarios u
         LEFT JOIN usuario_empresa ue ON ue.usuario_id = u.id AND ue.empresa_id = ?
         WHERE u.activo = 1
           AND ((ue.id IS NOT NULL AND ue.activo = 1)
             OR (ue.id IS NULL AND u.empresa_id_default = ?))
         ORDER BY u.nombre, u.apellido`,
        [companyId, companyId]
      ),
      pool.execute<RowDataPacket[]>(
        `SELECT id, razon_social AS nombre
         FROM proveedores
         WHERE empresa_id = ?
         ORDER BY razon_social`,
        [companyId]
      )
    ]);
    return res.json({
      success: true,
      data: { bodegas: warehouses[0], usuarios: users[0], proveedores: providers[0] }
    });
  } catch (error) {
    console.error('Error al cargar referencias de activos:', error);
    return sendError(res, 500, 'No se pudieron cargar responsables y bodegas');
  }
};

export const createCategory = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const name = cleanText(req.body.nombre, 100);
  if (!name) return sendError(res, 400, 'El nombre de la categoria es requerido');

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO activos_categorias (empresa_id, nombre, descripcion, created_by)
       VALUES (?, ?, ?, ?)`,
      [companyId, name, cleanText(req.body.descripcion, 4000), actorId(req)]
    );
    return res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return sendError(res, 409, 'Ya existe una categoria con ese nombre');
    console.error('Error al crear categoria de activos:', error);
    return sendError(res, 500, 'No se pudo crear la categoria');
  }
};

export const updateCategory = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const categoryId = Number(req.params.id);
  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) return sendError(res, 400, 'Categoria invalida');

  const name = req.body.nombre === undefined ? undefined : cleanText(req.body.nombre, 100);
  if (name === null) return sendError(res, 400, 'El nombre no puede quedar vacio');
  const status = req.body.estado;
  if (status !== undefined && !['activa', 'inactiva'].includes(status)) {
    return sendError(res, 400, 'Estado de categoria invalido');
  }

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE activos_categorias
       SET nombre = COALESCE(?, nombre),
           descripcion = COALESCE(?, descripcion),
           estado = COALESCE(?, estado),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND empresa_id = ?`,
      [name ?? null, req.body.descripcion === undefined ? null : cleanText(req.body.descripcion, 4000), status ?? null, categoryId, companyId]
    );
    if (result.affectedRows === 0) return sendError(res, 404, 'Categoria no encontrada');
    return res.json({ success: true, data: { id: categoryId } });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return sendError(res, 409, 'Ya existe una categoria con ese nombre');
    console.error('Error al actualizar categoria de activos:', error);
    return sendError(res, 500, 'No se pudo actualizar la categoria');
  }
};

export const listTypes = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const categoryId = parseOptionalId(req.query.categoria_id);
  if (Number.isNaN(categoryId)) return sendError(res, 400, 'Categoria invalida');

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT t.id, t.categoria_id, t.nombre, t.descripcion, t.estado,
              c.nombre AS categoria_nombre, t.created_at, t.updated_at
       FROM activos_tipos t
       INNER JOIN activos_categorias c ON c.id = t.categoria_id AND c.empresa_id = t.empresa_id
       WHERE t.empresa_id = ? AND (? IS NULL OR t.categoria_id = ?)
       ORDER BY t.estado = 'activo' DESC, c.nombre, t.nombre`,
      [companyId, categoryId, categoryId]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al listar tipos de activos:', error);
    return sendError(res, 500, 'No se pudieron cargar los tipos de activos');
  }
};

export const createType = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const categoryId = Number(req.body.categoria_id);
  const name = cleanText(req.body.nombre, 100);
  if (!Number.isSafeInteger(categoryId) || categoryId <= 0 || !name) {
    return sendError(res, 400, 'Categoria y nombre del tipo son requeridos');
  }

  try {
    const categories = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM activos_categorias
       WHERE id = ? AND empresa_id = ? AND estado = 'activa' LIMIT 1`,
      [categoryId, companyId]
    );
    if (categories[0].length === 0) return sendError(res, 400, 'Categoria no valida para esta empresa');

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO activos_tipos (empresa_id, categoria_id, nombre, descripcion, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [companyId, categoryId, name, cleanText(req.body.descripcion, 4000), actorId(req)]
    );
    return res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return sendError(res, 409, 'Ya existe ese tipo dentro de la categoria');
    console.error('Error al crear tipo de activo:', error);
    return sendError(res, 500, 'No se pudo crear el tipo de activo');
  }
};

export const updateType = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const typeId = Number(req.params.id);
  if (!Number.isSafeInteger(typeId) || typeId <= 0) return sendError(res, 400, 'Tipo invalido');

  const name = req.body.nombre === undefined ? undefined : cleanText(req.body.nombre, 100);
  if (name === null) return sendError(res, 400, 'El nombre no puede quedar vacio');
  const status = req.body.estado;
  if (status !== undefined && !['activo', 'inactivo'].includes(status)) {
    return sendError(res, 400, 'Estado de tipo invalido');
  }

  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE activos_tipos
       SET nombre = COALESCE(?, nombre),
           descripcion = COALESCE(?, descripcion),
           estado = COALESCE(?, estado),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND empresa_id = ?`,
      [name ?? null, req.body.descripcion === undefined ? null : cleanText(req.body.descripcion, 4000), status ?? null, typeId, companyId]
    );
    if (result.affectedRows === 0) return sendError(res, 404, 'Tipo no encontrado');
    return res.json({ success: true, data: { id: typeId } });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return sendError(res, 409, 'Ya existe ese tipo dentro de la categoria');
    console.error('Error al actualizar tipo de activo:', error);
    return sendError(res, 500, 'No se pudo actualizar el tipo de activo');
  }
};

export const listTypeAttributes = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const typeId = Number(req.params.tipoId);
  if (!Number.isSafeInteger(typeId) || typeId <= 0) return sendError(res, 400, 'Tipo invalido');

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT d.id, d.tipo_id, d.clave, d.etiqueta, d.tipo_dato, d.unidad,
              d.requerido, d.opciones_json, d.orden, d.estado
       FROM activos_atributos_def d
       INNER JOIN activos_tipos t ON t.id = d.tipo_id AND t.empresa_id = d.empresa_id
       WHERE d.tipo_id = ? AND d.empresa_id = ?
       ORDER BY d.orden, d.etiqueta`,
      [typeId, companyId]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al listar atributos de tipo de activo:', error);
    return sendError(res, 500, 'No se pudieron cargar los atributos');
  }
};

export const createTypeAttribute = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const typeId = Number(req.params.tipoId);
  const key = cleanText(req.body.clave, 80)?.toLowerCase() || null;
  const label = cleanText(req.body.etiqueta, 120);
  const dataType = req.body.tipo_dato;
  const allowedTypes = ['texto', 'numero', 'booleano', 'fecha', 'opcion'];
  const order = req.body.orden === undefined ? 0 : Number(req.body.orden);
  const required = req.body.requerido === true || Number(req.body.requerido) === 1 ? 1 : 0;
  let options: string[] | null = null;

  if (!Number.isSafeInteger(typeId) || typeId <= 0 || !key || !/^[a-z][a-z0-9_]*$/.test(key)
      || !label || !allowedTypes.includes(dataType) || !Number.isSafeInteger(order) || order < 0 || order > 32767) {
    return sendError(res, 400, 'Definicion de atributo invalida');
  }
  if (dataType === 'opcion') {
    options = Array.isArray(req.body.opciones)
      ? req.body.opciones.map((option: unknown) => String(option).trim()).filter(Boolean)
      : [];
    if (!options.length || options.length > 50 || options.some((option) => option.length > 100)
        || new Set(options).size !== options.length) {
      return sendError(res, 400, 'Las opciones deben ser una lista unica de 1 a 50 valores');
    }
  }

  try {
    const types = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM activos_tipos WHERE id = ? AND empresa_id = ? LIMIT 1',
      [typeId, companyId]
    );
    if (types[0].length === 0) return sendError(res, 404, 'Tipo de activo no encontrado');

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO activos_atributos_def
        (empresa_id, tipo_id, clave, etiqueta, tipo_dato, unidad, requerido, opciones_json, orden)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, typeId, key, label, dataType, cleanText(req.body.unidad, 30), required,
        options ? JSON.stringify(options) : null, order]
    );
    return res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return sendError(res, 409, 'Ya existe una clave igual para este tipo');
    console.error('Error al crear atributo de activo:', error);
    return sendError(res, 500, 'No se pudo crear el atributo');
  }
};

export const updateTypeAttribute = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const typeId = Number(req.params.tipoId);
  const attributeId = Number(req.params.id);
  if (!Number.isSafeInteger(typeId) || typeId <= 0 || !Number.isSafeInteger(attributeId) || attributeId <= 0) {
    return sendError(res, 400, 'Atributo invalido');
  }
  const label = req.body.etiqueta === undefined ? undefined : cleanText(req.body.etiqueta, 120);
  const dataType = req.body.tipo_dato;
  const allowedTypes = ['texto', 'numero', 'booleano', 'fecha', 'opcion'];
  const order = req.body.orden === undefined ? undefined : Number(req.body.orden);
  const required = req.body.requerido === undefined
    ? undefined : req.body.requerido === true || Number(req.body.requerido) === 1 ? 1 : 0;
  const state = req.body.estado;
  if (label === null || (dataType !== undefined && !allowedTypes.includes(dataType))
      || (order !== undefined && (!Number.isSafeInteger(order) || order < 0 || order > 32767))
      || (state !== undefined && !['activo', 'inactivo'].includes(state))) {
    return sendError(res, 400, 'Definicion de atributo invalida');
  }

  try {
    const [currentRows] = await pool.execute<RowDataPacket[]>(
      `SELECT d.tipo_dato, d.opciones_json FROM activos_atributos_def d
       INNER JOIN activos_tipos t ON t.id = d.tipo_id AND t.empresa_id = d.empresa_id
       WHERE d.id = ? AND d.tipo_id = ? AND d.empresa_id = ? LIMIT 1`,
      [attributeId, typeId, companyId]
    );
    if (currentRows.length === 0) return sendError(res, 404, 'Atributo no encontrado');
    if (dataType !== undefined && dataType !== currentRows[0].tipo_dato) {
      const values = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM activos_atributos_valores WHERE atributo_id = ? LIMIT 1',
        [attributeId]
      );
      if (values[0].length > 0) return sendError(res, 409, 'No se puede cambiar el tipo de un atributo que ya tiene valores');
    }

    let optionsJson: string | null | undefined;
    const effectiveType = dataType || currentRows[0].tipo_dato;
    if (effectiveType === 'opcion') {
      if (req.body.opciones !== undefined) {
        const options = Array.isArray(req.body.opciones)
          ? req.body.opciones.map((option: unknown) => String(option).trim()).filter(Boolean)
          : [];
        if (!options.length || options.length > 50 || options.some((option: string) => option.length > 100)
            || new Set(options).size !== options.length) {
          return sendError(res, 400, 'Las opciones deben ser una lista unica de 1 a 50 valores');
        }
        optionsJson = JSON.stringify(options);
      } else if (currentRows[0].tipo_dato !== 'opcion' || !currentRows[0].opciones_json) {
        return sendError(res, 400, 'Debes definir opciones para este atributo');
      }
    } else if (effectiveType !== 'opcion') {
      optionsJson = null;
    }

    await pool.execute(
      `UPDATE activos_atributos_def SET
        etiqueta = COALESCE(?, etiqueta),
        tipo_dato = COALESCE(?, tipo_dato),
        unidad = COALESCE(?, unidad),
        requerido = COALESCE(?, requerido),
        opciones_json = CASE WHEN ? = 1 THEN ? ELSE opciones_json END,
        orden = COALESCE(?, orden),
        estado = COALESCE(?, estado),
        updated_at = NOW()
       WHERE id = ? AND tipo_id = ? AND empresa_id = ?`,
      [label ?? null, dataType ?? null,
        req.body.unidad === undefined ? null : cleanText(req.body.unidad, 30),
        required ?? null, optionsJson !== undefined ? 1 : 0, optionsJson ?? null, order ?? null, state ?? null,
        attributeId, typeId, companyId]
    );
    return res.json({ success: true, data: { id: attributeId } });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return sendError(res, 409, 'Ya existe una clave igual para este tipo');
    console.error('Error al actualizar atributo de activo:', error);
    return sendError(res, 500, 'No se pudo actualizar el atributo');
  }
};

export const listAssets = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const search = cleanText(req.query.buscar, 100);
  const state = cleanText(req.query.estado, 30);
  const categoryId = parseOptionalId(req.query.categoria_id);
  const typeId = parseOptionalId(req.query.tipo_id);
  const warehouseId = parseOptionalId(req.query.bodega_id);
  const resultLimit = req.path.endsWith('/export') ? 10000 : 500;

  if ([categoryId, typeId, warehouseId].some(Number.isNaN)) return sendError(res, 400, 'Filtro numerico invalido');
  if (state && !['active', 'in_maintenance', 'out_of_service', 'retired', 'lost'].includes(state)) {
    return sendError(res, 400, 'Estado de activo invalido');
  }

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.id, a.empresa_id, a.codigo, a.codigo_interno, a.nombre, a.estado,
              a.marca, a.modelo, a.numero_serie, a.fecha_adquisicion, a.valor_adquisicion,
              a.bodega_id, b.nombre AS bodega_nombre, a.ubicacion,
              a.responsable_id, CONCAT_WS(' ', u.nombre, u.apellido) AS responsable_nombre,
              a.imagen_url, c.id AS categoria_id, c.nombre AS categoria_nombre,
              t.id AS tipo_id, t.nombre AS tipo_nombre, a.created_at, a.updated_at
       FROM activos a
       INNER JOIN activos_categorias c ON c.id = a.categoria_id AND c.empresa_id = a.empresa_id
       INNER JOIN activos_tipos t ON t.id = a.tipo_id AND t.empresa_id = a.empresa_id
       LEFT JOIN bodegas b ON b.id = a.bodega_id AND b.empresa_id = a.empresa_id
       LEFT JOIN usuarios u ON u.id = a.responsable_id
       WHERE a.empresa_id = ?
         AND (? IS NULL OR a.estado = ?)
         AND (? IS NULL OR a.categoria_id = ?)
         AND (? IS NULL OR a.tipo_id = ?)
         AND (? IS NULL OR a.bodega_id = ?)
         AND (? IS NULL OR a.codigo LIKE CONCAT('%', ?, '%') OR a.nombre LIKE CONCAT('%', ?, '%')
              OR a.numero_serie LIKE CONCAT('%', ?, '%') OR a.codigo_interno LIKE CONCAT('%', ?, '%'))
       ORDER BY a.updated_at DESC, a.id DESC
      LIMIT ${resultLimit}`,
      [companyId, state, state, categoryId, categoryId, typeId, typeId,
        warehouseId, warehouseId, search, search, search, search, search]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al listar activos:', error);
    return sendError(res, 500, 'No se pudieron cargar los activos');
  }
};

export const getAsset = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const assetId = Number(req.params.id);
  if (!Number.isSafeInteger(assetId) || assetId <= 0) return sendError(res, 400, 'Activo invalido');

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT a.*, c.nombre AS categoria_nombre, t.nombre AS tipo_nombre,
              b.nombre AS bodega_nombre, CONCAT_WS(' ', u.nombre, u.apellido) AS responsable_nombre
       FROM activos a
       INNER JOIN activos_categorias c ON c.id = a.categoria_id AND c.empresa_id = a.empresa_id
       INNER JOIN activos_tipos t ON t.id = a.tipo_id AND t.empresa_id = a.empresa_id
       LEFT JOIN bodegas b ON b.id = a.bodega_id AND b.empresa_id = a.empresa_id
       LEFT JOIN usuarios u ON u.id = a.responsable_id
       WHERE a.id = ? AND a.empresa_id = ?
       LIMIT 1`,
      [assetId, companyId]
    );
    if (rows.length === 0) return sendError(res, 404, 'Activo no encontrado');

    const [attributes] = await pool.execute<RowDataPacket[]>(
      `SELECT d.id, d.clave, d.etiqueta, d.tipo_dato, d.unidad, d.requerido, d.opciones_json,
              v.valor_texto, v.valor_numero, v.valor_booleano, v.valor_fecha
       FROM activos_atributos_def d
       LEFT JOIN activos_atributos_valores v
         ON v.atributo_id = d.id AND v.activo_id = ? AND v.empresa_id = d.empresa_id
       WHERE d.empresa_id = ? AND d.tipo_id = ? AND d.estado = 'activo'
       ORDER BY d.orden, d.etiqueta`,
      [assetId, companyId, rows[0].tipo_id]
    );
    return res.json({ success: true, data: { ...rows[0], atributos: attributes } });
  } catch (error) {
    console.error('Error al consultar activo:', error);
    return sendError(res, 500, 'No se pudo cargar el activo');
  }
};

export const createAsset = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const categoryId = Number(req.body.categoria_id);
  const typeId = Number(req.body.tipo_id);
  const name = cleanText(req.body.nombre, 200);
  const warehouseId = parseOptionalId(req.body.bodega_id);
  const responsibleId = parseOptionalId(req.body.responsable_id);
  const providerId = parseOptionalId(req.body.proveedor_id);
  const attributes = Array.isArray(req.body.atributos) ? req.body.atributos : [];
  const imageUrl = normalizeImageUrl(req.body.imagen_url);

  if (!Number.isSafeInteger(categoryId) || categoryId <= 0
      || !Number.isSafeInteger(typeId) || typeId <= 0 || !name) {
    return sendError(res, 400, 'Categoria, tipo y nombre son requeridos');
  }
  if ([warehouseId, responsibleId, providerId].some(Number.isNaN)) {
    return sendError(res, 400, 'Referencia de bodega, responsable o proveedor invalida');
  }
  if (imageUrl === false) return sendError(res, 400, 'La URL de imagen debe usar HTTP o HTTPS');
  const acquisitionValue = req.body.valor_adquisicion === undefined || req.body.valor_adquisicion === ''
    ? null : Number(req.body.valor_adquisicion);
  if (acquisitionValue !== null && (!Number.isFinite(acquisitionValue) || acquisitionValue < 0)) {
    return sendError(res, 400, 'Valor de adquisicion invalido');
  }
  const allowedAttributes = attributes.every((attribute: any) =>
    Number.isSafeInteger(Number(attribute?.atributo_id)) && Number(attribute.atributo_id) > 0
  );
  if (!allowedAttributes) return sendError(res, 400, 'Atributos de activo invalidos');

  try {
    const created = await withTransaction(async (txQuery) => {
      if (!(await validateCategoryAndType(txQuery, companyId, categoryId, typeId))) {
        throw Object.assign(new Error('Categoria o tipo no valido para esta empresa'), { status: 400 });
      }
      if (!(await validateWarehouse(txQuery, companyId, warehouseId))) {
        throw Object.assign(new Error('Bodega no valida para esta empresa'), { status: 400 });
      }
      if (!(await validateUser(txQuery, companyId, responsibleId))) {
        throw Object.assign(new Error('Responsable no valido para esta empresa'), { status: 400 });
      }
      if (providerId !== null) {
        const providers = await txQuery(
          'SELECT id FROM proveedores WHERE id = ? AND empresa_id = ? LIMIT 1',
          [providerId, companyId]
        );
        if (providers.length === 0) throw Object.assign(new Error('Proveedor no valido para esta empresa'), { status: 400 });
      }

      await txQuery(
        `INSERT INTO activos_consecutivos (empresa_id, prefijo, siguiente)
         VALUES (?, 'KI', 1)
         ON DUPLICATE KEY UPDATE empresa_id = VALUES(empresa_id)`,
        [companyId]
      );
      const counters = await txQuery(
        'SELECT prefijo, siguiente FROM activos_consecutivos WHERE empresa_id = ? FOR UPDATE',
        [companyId]
      );
      const counter = counters[0];
      const code = `${counter.prefijo}${String(counter.siguiente).padStart(6, '0')}`;
      await txQuery(
        'UPDATE activos_consecutivos SET siguiente = siguiente + 1 WHERE empresa_id = ?',
        [companyId]
      );

      const [result] = await txQuery(
        `INSERT INTO activos (
          empresa_id, codigo, codigo_interno, categoria_id, tipo_id, nombre, descripcion,
          marca, modelo, numero_serie, referencia, fecha_adquisicion, fecha_puesta_servicio,
          valor_adquisicion, proveedor_id, documento_compra, bodega_id, ubicacion,
          responsable_id, imagen_url, observaciones, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId, code, cleanText(req.body.codigo_interno, 80), categoryId, typeId, name,
          cleanText(req.body.descripcion, 4000), cleanText(req.body.marca, 100),
          cleanText(req.body.modelo, 100), cleanText(req.body.numero_serie, 120),
          cleanText(req.body.referencia, 120), req.body.fecha_adquisicion || null,
          req.body.fecha_puesta_servicio || null, acquisitionValue, providerId,
          cleanText(req.body.documento_compra, 120), warehouseId,
          cleanText(req.body.ubicacion, 160), responsibleId,
          imageUrl, cleanText(req.body.observaciones, 4000), actorId(req)
        ]
      );
      const assetId = Number(result.insertId);
      if (imageUrl) {
        await txQuery(
          `INSERT INTO activos_archivos
            (empresa_id, entidad_tipo, entidad_id, origen, url, nivel_acceso, creado_por)
           VALUES (?, 'activo', ?, 'url', ?, 'publico', ?)`,
          [companyId, assetId, imageUrl, actorId(req)]
        );
      }
      await persistAssetAttributes(txQuery, companyId, assetId, typeId, attributes, actorId(req));

      if (warehouseId !== null || responsibleId !== null || req.body.ubicacion) {
        await txQuery(
          `INSERT INTO activos_asignaciones
            (empresa_id, activo_id, usuario_id, bodega_id, ubicacion, asignado_por, motivo)
           VALUES (?, ?, ?, ?, ?, ?, 'Registro inicial')`,
          [companyId, assetId, responsibleId, warehouseId, cleanText(req.body.ubicacion, 160), actorId(req)]
        );
      }

      await createAssetEvent(txQuery, {
        companyId,
        assetId,
        eventType: 'created',
        actorId: actorId(req),
        after: { codigo: code, nombre: name, categoria_id: categoryId, tipo_id: typeId }
      });
      return { id: assetId, codigo: code };
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return sendError(res, 409, 'Codigo o codigo interno ya existente');
    if (error.status === 400) return sendError(res, 400, error.message);
    console.error('Error al crear activo:', error);
    return sendError(res, 500, 'No se pudo crear el activo');
  }
};

export const updateAsset = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const assetId = Number(req.params.id);
  if (!Number.isSafeInteger(assetId) || assetId <= 0) return sendError(res, 400, 'Activo invalido');
  const imageKey = cleanText(req.body.imagen_key, 700);
  if (imageKey && (!imageKey.startsWith(`empresa/${companyId}/activos/${assetId}/`) || imageKey.includes('..') || imageKey.includes('\\'))) {
    return sendError(res, 400, 'La referencia S3 no corresponde a este activo');
  }
  const imageMime = cleanText(req.body.imagen_mime, 120);
  const imageSize = req.body.imagen_size === undefined ? null : Number(req.body.imagen_size);
  if (imageSize !== null && (!Number.isSafeInteger(imageSize) || imageSize < 0)) return sendError(res, 400, 'Tamano de imagen invalido');

  try {
    const asset = await withTransaction(async (txQuery) => {
      const rows = await txQuery(
        'SELECT * FROM activos WHERE id = ? AND empresa_id = ? FOR UPDATE',
        [assetId, companyId]
      );
      if (rows.length === 0) throw Object.assign(new Error('Activo no encontrado'), { status: 404 });
      const current = rows[0];
      if (current.estado === 'retired') throw Object.assign(new Error('Un activo dado de baja no se puede editar'), { status: 409 });

      const categoryId = req.body.categoria_id === undefined ? Number(current.categoria_id) : Number(req.body.categoria_id);
      const typeId = req.body.tipo_id === undefined ? Number(current.tipo_id) : Number(req.body.tipo_id);
      if (!(await validateCategoryAndType(txQuery, companyId, categoryId, typeId))) {
        throw Object.assign(new Error('Categoria o tipo no valido para esta empresa'), { status: 400 });
      }

      const warehouseId = req.body.bodega_id === undefined ? current.bodega_id : parseOptionalId(req.body.bodega_id);
      const responsibleId = req.body.responsable_id === undefined ? current.responsable_id : parseOptionalId(req.body.responsable_id);
      if (Number.isNaN(warehouseId) || !(await validateWarehouse(txQuery, companyId, warehouseId))) {
        throw Object.assign(new Error('Bodega no valida para esta empresa'), { status: 400 });
      }
      if (Number.isNaN(responsibleId) || !(await validateUser(txQuery, companyId, responsibleId))) {
        throw Object.assign(new Error('Responsable no valido para esta empresa'), { status: 400 });
      }

      const allowedStates = ['active', 'in_maintenance', 'out_of_service', 'lost'];
      const newState = req.body.estado === undefined ? current.estado : req.body.estado;
      if (!allowedStates.includes(newState)) throw Object.assign(new Error('Estado de activo invalido'), { status: 400 });
      const fields: Record<string, any> = {
        categoria_id: categoryId,
        tipo_id: typeId,
        nombre: req.body.nombre === undefined ? current.nombre : cleanText(req.body.nombre, 200),
        descripcion: req.body.descripcion === undefined ? current.descripcion : cleanText(req.body.descripcion, 4000),
        marca: req.body.marca === undefined ? current.marca : cleanText(req.body.marca, 100),
        modelo: req.body.modelo === undefined ? current.modelo : cleanText(req.body.modelo, 100),
        numero_serie: req.body.numero_serie === undefined ? current.numero_serie : cleanText(req.body.numero_serie, 120),
        referencia: req.body.referencia === undefined ? current.referencia : cleanText(req.body.referencia, 120),
        estado: newState,
        fecha_adquisicion: req.body.fecha_adquisicion === undefined ? current.fecha_adquisicion : req.body.fecha_adquisicion || null,
        fecha_puesta_servicio: req.body.fecha_puesta_servicio === undefined ? current.fecha_puesta_servicio : req.body.fecha_puesta_servicio || null,
        valor_adquisicion: req.body.valor_adquisicion === undefined ? current.valor_adquisicion : req.body.valor_adquisicion === '' ? null : Number(req.body.valor_adquisicion),
        proveedor_id: req.body.proveedor_id === undefined ? current.proveedor_id : parseOptionalId(req.body.proveedor_id),
        documento_compra: req.body.documento_compra === undefined ? current.documento_compra : cleanText(req.body.documento_compra, 120),
        bodega_id: warehouseId,
        ubicacion: req.body.ubicacion === undefined ? current.ubicacion : cleanText(req.body.ubicacion, 160),
        responsable_id: responsibleId,
        imagen_url: imageKey
          ? getS3PublicUrl(imageKey)
          : req.body.imagen_url === undefined ? current.imagen_url : normalizeImageUrl(req.body.imagen_url),
        observaciones: req.body.observaciones === undefined ? current.observaciones : cleanText(req.body.observaciones, 4000)
      };
      if (!fields.nombre) throw Object.assign(new Error('El nombre es requerido'), { status: 400 });
      if (fields.imagen_url === false) throw Object.assign(new Error('La URL de imagen debe usar HTTP o HTTPS'), { status: 400 });
      if (fields.valor_adquisicion !== null && (!Number.isFinite(Number(fields.valor_adquisicion)) || Number(fields.valor_adquisicion) < 0)) {
        throw Object.assign(new Error('Valor de adquisicion invalido'), { status: 400 });
      }
      if (fields.proveedor_id !== null) {
        const providers = await txQuery('SELECT id FROM proveedores WHERE id = ? AND empresa_id = ? LIMIT 1', [fields.proveedor_id, companyId]);
        if (providers.length === 0) throw Object.assign(new Error('Proveedor no valido para esta empresa'), { status: 400 });
      }
      if (typeId !== Number(current.tipo_id)) {
        const existingValues = await txQuery(
          'SELECT id FROM activos_atributos_valores WHERE empresa_id = ? AND activo_id = ? LIMIT 1',
          [companyId, assetId]
        );
        if (existingValues.length > 0) {
          throw Object.assign(new Error('No se puede cambiar el tipo mientras el activo tenga atributos registrados'), { status: 409 });
        }
        if (!Array.isArray(req.body.atributos)) {
          throw Object.assign(new Error('Debes enviar los atributos requeridos para el nuevo tipo'), { status: 400 });
        }
      }
      if (req.body.atributos !== undefined || typeId !== Number(current.tipo_id)) {
        if (!Array.isArray(req.body.atributos)) throw Object.assign(new Error('La lista de atributos no es valida'), { status: 400 });
        await persistAssetAttributes(txQuery, companyId, assetId, typeId, req.body.atributos, actorId(req));
      }

      const before = Object.fromEntries(Object.keys(fields).map((field) => [field, current[field]]));
      await txQuery(
        `UPDATE activos SET
          categoria_id = ?, tipo_id = ?, nombre = ?, descripcion = ?, marca = ?, modelo = ?,
          numero_serie = ?, referencia = ?, estado = ?, fecha_adquisicion = ?,
          fecha_puesta_servicio = ?, valor_adquisicion = ?, proveedor_id = ?,
          documento_compra = ?, bodega_id = ?, ubicacion = ?, responsable_id = ?,
          imagen_url = ?, observaciones = ?, updated_at = NOW()
         WHERE id = ? AND empresa_id = ?`,
        [...Object.values(fields), assetId, companyId]
      );
      if (fields.imagen_url !== current.imagen_url && fields.imagen_url) {
        await txQuery(
          `INSERT INTO activos_archivos
            (empresa_id, entidad_tipo, entidad_id, origen, url, s3_key, nivel_acceso,
             nombre_archivo, mime_type, tamano_bytes, creado_por)
           VALUES (?, 'activo', ?, ?, ?, ?, 'publico', ?, ?, ?, ?)`,
          [companyId, assetId, imageKey ? 's3_upload' : 'url', fields.imagen_url, imageKey,
            cleanText(req.body.imagen_nombre, 255), imageMime, imageSize, actorId(req)]
        );
      }
      if (current.bodega_id !== warehouseId || current.responsable_id !== responsibleId || current.ubicacion !== fields.ubicacion) {
        await txQuery(
          `UPDATE activos_asignaciones
           SET fecha_devolucion = NOW()
           WHERE empresa_id = ? AND activo_id = ? AND fecha_devolucion IS NULL`,
          [companyId, assetId]
        );
        if (warehouseId !== null || responsibleId !== null || fields.ubicacion) {
          await txQuery(
            `INSERT INTO activos_asignaciones
              (empresa_id, activo_id, usuario_id, bodega_id, ubicacion, asignado_por, motivo)
             VALUES (?, ?, ?, ?, ?, ?, 'Actualizacion de asignacion')`,
            [companyId, assetId, responsibleId, warehouseId, fields.ubicacion, actorId(req)]
          );
        }
      }
      await createAssetEvent(txQuery, {
        companyId,
        assetId,
        eventType: current.estado === fields.estado ? 'updated' : 'status_changed',
        actorId: actorId(req),
        before,
        after: fields
      });
      return { id: assetId };
    });
    return res.json({ success: true, data: asset });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') return sendError(res, 409, 'Codigo interno o numero de serie ya existente');
    if (error.status) return sendError(res, error.status, error.message);
    console.error('Error al actualizar activo:', error);
    return sendError(res, 500, 'No se pudo actualizar el activo');
  }
};

export const assignAsset = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const assetId = Number(req.params.id);
  const userId = parseOptionalId(req.body.responsable_id);
  const warehouseId = parseOptionalId(req.body.bodega_id);
  const location = cleanText(req.body.ubicacion, 160);
  const reason = cleanText(req.body.motivo, 255);
  if (!Number.isSafeInteger(assetId) || assetId <= 0 || Number.isNaN(userId) || Number.isNaN(warehouseId)) {
    return sendError(res, 400, 'Asignacion invalida');
  }

  try {
    await withTransaction(async (txQuery) => {
      const assets = await txQuery('SELECT id, estado FROM activos WHERE id = ? AND empresa_id = ? FOR UPDATE', [assetId, companyId]);
      if (assets.length === 0) throw Object.assign(new Error('Activo no encontrado'), { status: 404 });
      if (assets[0].estado === 'retired') throw Object.assign(new Error('No se puede asignar un activo dado de baja'), { status: 409 });
      if (!(await validateUser(txQuery, companyId, userId))) throw Object.assign(new Error('Responsable no valido para esta empresa'), { status: 400 });
      if (!(await validateWarehouse(txQuery, companyId, warehouseId))) throw Object.assign(new Error('Bodega no valida para esta empresa'), { status: 400 });
      await txQuery(
        'UPDATE activos_asignaciones SET fecha_devolucion = NOW() WHERE empresa_id = ? AND activo_id = ? AND fecha_devolucion IS NULL',
        [companyId, assetId]
      );
      await txQuery(
        `UPDATE activos SET responsable_id = ?, bodega_id = ?, ubicacion = ?, updated_at = NOW()
         WHERE id = ? AND empresa_id = ?`,
        [userId, warehouseId, location, assetId, companyId]
      );
      await txQuery(
        `INSERT INTO activos_asignaciones
          (empresa_id, activo_id, usuario_id, bodega_id, ubicacion, asignado_por, motivo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [companyId, assetId, userId, warehouseId, location, actorId(req), reason]
      );
      await createAssetEvent(txQuery, {
        companyId, assetId, eventType: 'assigned', actorId: actorId(req), reason,
        after: { responsable_id: userId, bodega_id: warehouseId, ubicacion: location }
      });
    });
    return res.json({ success: true, data: { id: assetId } });
  } catch (error: any) {
    if (error.status) return sendError(res, error.status, error.message);
    console.error('Error al asignar activo:', error);
    return sendError(res, 500, 'No se pudo asignar el activo');
  }
};

export const retireAsset = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const assetId = Number(req.params.id);
  const reason = cleanText(req.body.motivo, 255);
  if (!Number.isSafeInteger(assetId) || assetId <= 0 || !reason) return sendError(res, 400, 'Activo y motivo de baja son requeridos');

  try {
    await withTransaction(async (txQuery) => {
      const rows = await txQuery('SELECT * FROM activos WHERE id = ? AND empresa_id = ? FOR UPDATE', [assetId, companyId]);
      if (rows.length === 0) throw Object.assign(new Error('Activo no encontrado'), { status: 404 });
      if (rows[0].estado === 'retired') throw Object.assign(new Error('El activo ya esta dado de baja'), { status: 409 });
      await txQuery(
        `UPDATE activos SET estado = 'retired', updated_at = NOW()
         WHERE id = ? AND empresa_id = ?`,
        [assetId, companyId]
      );
      await txQuery(
        `UPDATE activos_asignaciones
         SET fecha_devolucion = NOW(), motivo = COALESCE(motivo, ?)
         WHERE empresa_id = ? AND activo_id = ? AND fecha_devolucion IS NULL`,
        [reason, companyId, assetId]
      );
      await createAssetEvent(txQuery, {
        companyId, assetId, eventType: 'retired', actorId: actorId(req), reason,
        before: { estado: rows[0].estado }, after: { estado: 'retired' }
      });
    });
    return res.json({ success: true, data: { id: assetId, estado: 'retired' } });
  } catch (error: any) {
    if (error.status) return sendError(res, error.status, error.message);
    console.error('Error al dar de baja activo:', error);
    return sendError(res, 500, 'No se pudo dar de baja el activo');
  }
};

export const getAssetHistory = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const assetId = Number(req.params.id);
  if (!Number.isSafeInteger(assetId) || assetId <= 0) return sendError(res, 400, 'Activo invalido');

  try {
    const assets = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM activos WHERE id = ? AND empresa_id = ? LIMIT 1',
      [assetId, companyId]
    );
    if (assets[0].length === 0) return sendError(res, 404, 'Activo no encontrado');

    const [events] = await pool.execute<RowDataPacket[]>(
      `SELECT e.id, e.tipo_evento, e.referencia_tipo, e.referencia_id, e.motivo,
              e.datos_anteriores, e.datos_nuevos, e.ocurrido_at,
              e.usuario_id, u.nombre AS usuario_nombre, u.apellido AS usuario_apellido
       FROM activos_eventos e
       LEFT JOIN usuarios u ON u.id = e.usuario_id
       WHERE e.empresa_id = ? AND e.activo_id = ?
       ORDER BY e.ocurrido_at DESC, e.id DESC
       LIMIT 250`,
      [companyId, assetId]
    );
    const [assignments] = await pool.execute<RowDataPacket[]>(
      `SELECT x.id, x.usuario_id, CONCAT_WS(' ', u.nombre, u.apellido) AS usuario_nombre,
              x.bodega_id, b.nombre AS bodega_nombre, x.ubicacion, x.fecha_asignacion,
              x.fecha_devolucion, x.motivo, x.asignado_por
       FROM activos_asignaciones x
       LEFT JOIN usuarios u ON u.id = x.usuario_id
       LEFT JOIN bodegas b ON b.id = x.bodega_id AND b.empresa_id = x.empresa_id
       WHERE x.empresa_id = ? AND x.activo_id = ?
       ORDER BY x.fecha_asignacion DESC, x.id DESC
       LIMIT 250`,
      [companyId, assetId]
    );
    return res.json({ success: true, data: { eventos: events, asignaciones: assignments } });
  } catch (error) {
    console.error('Error al consultar historial de activo:', error);
    return sendError(res, 500, 'No se pudo cargar el historial');
  }
};

export const getAssetImageUploadUrl = async (req: Request, res: Response): Promise<Response> => {
  const companyId = tenantId(req);
  const assetId = Number(req.params.id);
  const filename = cleanText(req.body.filename, 180);
  const contentType = cleanText(req.body.content_type, 80);
  if (!Number.isSafeInteger(assetId) || assetId <= 0 || !filename || !contentType) {
    return sendError(res, 400, 'Activo, nombre de archivo y tipo MIME son requeridos');
  }

  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  const extension = extensions[contentType];
  if (!extension) return sendError(res, 400, 'Tipo de imagen no permitido');

  try {
    const [assets] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM activos WHERE id = ? AND empresa_id = ? LIMIT 1',
      [assetId, companyId]
    );
    if (assets.length === 0) return sendError(res, 404, 'Activo no encontrado');

    const key = `empresa/${companyId}/activos/${assetId}/${randomUUID()}.${extension}`;
    const uploadUrl = await createS3PresignedUploadUrl(key, contentType);
    return res.json({
      success: true,
      data: { upload_url: uploadUrl, public_url: getS3PublicUrl(key), key }
    });
  } catch (error: any) {
    console.error('Error al generar URL S3 para imagen de activo:', error);
    return sendError(res, 500, error.message?.includes('AWS_S3_BUCKET')
      ? 'S3 no esta configurado en el servidor'
      : 'No se pudo preparar la subida de imagen');
  }
};
