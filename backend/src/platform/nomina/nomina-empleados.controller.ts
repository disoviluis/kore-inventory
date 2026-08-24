import { Request, Response } from 'express';
import pool from '../../shared/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const obtenerEmpresaId = (req: Request): number => Number(req.query.empresa_id || req.body.empresa_id);

async function validarEmpresa(req: Request, empresaId: number): Promise<boolean> {
  const usuario = (req as any).user;
  if (!usuario || !Number.isInteger(empresaId) || empresaId <= 0) return false;
  if (usuario.tipo_usuario === 'super_admin') return true;
  const [empresas] = await pool.execute<RowDataPacket[]>(
    'SELECT empresa_id FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ? AND activo = 1 LIMIT 1',
    [usuario.id, empresaId]
  );
  return empresas.length > 0;
}

export const listarEmpleados = async (req: Request, res: Response): Promise<void> => {
  const empresaId = obtenerEmpresaId(req);
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }

  try {
    const [empleados] = await pool.execute<RowDataPacket[]>(
      `SELECT e.*, u.id AS usuario_id, u.email AS usuario_email, u.activo AS usuario_activo,
              GROUP_CONCAT(DISTINCT b.nombre ORDER BY b.nombre SEPARATOR ', ') AS tiendas
       FROM empleados e
       LEFT JOIN usuarios u ON u.empleado_id = e.id
       LEFT JOIN empleados_bodegas eb ON eb.empleado_id = e.id AND eb.activo = 1
       LEFT JOIN bodegas b ON b.id = eb.bodega_id
       WHERE e.empresa_id = ?
       GROUP BY e.id
       ORDER BY e.apellidos, e.nombres`,
      [empresaId]
    );
    res.json({ success: true, data: empleados });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error al obtener empleados', error: error.message });
  }
};

export const obtenerEmpleado = async (req: Request, res: Response): Promise<void> => {
  const empresaId = Number(req.query.empresa_id);
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }

  try {
    const [empleados] = await pool.execute<RowDataPacket[]>(
      `SELECT e.*, u.id AS usuario_id, u.email AS usuario_email, u.activo AS usuario_activo
       FROM empleados e LEFT JOIN usuarios u ON u.empleado_id = e.id
       WHERE e.id = ? AND e.empresa_id = ?`,
      [req.params.id, empresaId]
    );
    if (!empleados.length) {
      res.status(404).json({ success: false, message: 'Empleado no encontrado' });
      return;
    }
    const [tiendas] = await pool.execute<RowDataPacket[]>(
      `SELECT eb.*, b.nombre, b.tipo FROM empleados_bodegas eb
       INNER JOIN bodegas b ON b.id = eb.bodega_id
       WHERE eb.empleado_id = ? AND eb.empresa_id = ? ORDER BY b.nombre`,
      [req.params.id, empresaId]
    );
    const [contratos] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM empleados_contratos WHERE empleado_id = ? AND empresa_id = ? ORDER BY fecha_inicio DESC, id DESC',
      [req.params.id, empresaId]
    );
    res.json({ success: true, data: { ...empleados[0], tiendas, contratos } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error al obtener empleado', error: error.message });
  }
};

export const crearEmpleado = async (req: Request, res: Response): Promise<void> => {
  const empresaId = obtenerEmpresaId(req);
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  const {
    tipo_documento = 'CC', numero_documento, nombres, apellidos, email, telefono, cargo,
    fecha_ingreso, salario_base = 0, periodicidad_pago = 'mensual', tipo_vinculacion = 'contrato_indefinido',
    porcentaje_comision = 0, auxilio_transporte = false, observaciones, bodega_ids = [], fecha_fin_contrato
  } = req.body;
  if (!numero_documento || !nombres || !apellidos || !fecha_ingreso) {
    res.status(400).json({ success: false, message: 'Documento, nombres, apellidos y fecha de ingreso son obligatorios' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [resultado] = await connection.execute<ResultSetHeader>(
      `INSERT INTO empleados
       (empresa_id, tipo_documento, numero_documento, nombres, apellidos, email, telefono, cargo,
        fecha_ingreso, salario_base, periodicidad_pago, tipo_vinculacion, porcentaje_comision,
        auxilio_transporte, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, tipo_documento, numero_documento, nombres, apellidos, email || null, telefono || null,
        cargo || null, fecha_ingreso, salario_base, periodicidad_pago, tipo_vinculacion,
        porcentaje_comision, auxilio_transporte ? 1 : 0, observaciones || null]
    );
    const empleadoId = resultado.insertId;
    await connection.execute(
      `INSERT INTO empleados_contratos
       (empleado_id, empresa_id, tipo_contrato, cargo, salario_base, porcentaje_comision, fecha_inicio, fecha_fin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [empleadoId, empresaId, tipo_vinculacion.replace('contrato_', ''), cargo || null, salario_base, porcentaje_comision, fecha_ingreso, fecha_fin_contrato || null]
    );
    if (Array.isArray(bodega_ids)) {
      for (const bodegaId of bodega_ids) {
        await connection.execute(
          `INSERT INTO empleados_bodegas (empleado_id, empresa_id, bodega_id, es_principal, fecha_inicio)
           SELECT ?, ?, b.id, ?, ? FROM bodegas b WHERE b.id = ? AND b.empresa_id = ?`,
          [empleadoId, empresaId, bodegaId === bodega_ids[0] ? 1 : 0, fecha_ingreso, bodegaId, empresaId]
        );
      }
    }
    await connection.commit();
    res.status(201).json({ success: true, message: 'Empleado creado exitosamente', data: { id: empleadoId } });
  } catch (error: any) {
    await connection.rollback();
    const duplicate = error.code === 'ER_DUP_ENTRY';
    res.status(duplicate ? 400 : 500).json({ success: false, message: duplicate ? 'El documento ya está registrado en esta empresa' : 'Error al crear empleado', error: error.message });
  } finally {
    connection.release();
  }
};

export const actualizarEmpleado = async (req: Request, res: Response): Promise<void> => {
  const empresaId = obtenerEmpresaId(req);
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  const campos = ['nombres', 'apellidos', 'email', 'telefono', 'cargo', 'fecha_ingreso', 'fecha_retiro', 'estado', 'salario_base', 'periodicidad_pago', 'tipo_vinculacion', 'porcentaje_comision', 'auxilio_transporte', 'observaciones'];
  const updates: string[] = [];
  const valores: any[] = [];
  for (const campo of campos) {
    if (req.body[campo] !== undefined) {
      updates.push(`${campo} = ?`);
      valores.push(req.body[campo] === '' ? null : req.body[campo]);
    }
  }
  if (!updates.length) {
    res.status(400).json({ success: false, message: 'No hay cambios para guardar' });
    return;
  }
  try {
    valores.push(req.params.id, empresaId);
    const [resultado] = await pool.execute<ResultSetHeader>(`UPDATE empleados SET ${updates.join(', ')} WHERE id = ? AND empresa_id = ?`, valores);
    if (!resultado.affectedRows) {
      res.status(404).json({ success: false, message: 'Empleado no encontrado' });
      return;
    }
    res.json({ success: true, message: 'Empleado actualizado exitosamente' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error al actualizar empleado', error: error.message });
  }
};

export const vincularUsuario = async (req: Request, res: Response): Promise<void> => {
  const empresaId = obtenerEmpresaId(req);
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  const { usuario_id } = req.body;
  if (!usuario_id) {
    res.status(400).json({ success: false, message: 'El usuario_id es obligatorio' });
    return;
  }
  try {
    const [empleados] = await pool.execute<RowDataPacket[]>('SELECT id FROM empleados WHERE id = ? AND empresa_id = ?', [req.params.id, empresaId]);
    const [usuarios] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id FROM usuarios u INNER JOIN usuario_empresa ue ON ue.usuario_id = u.id
       WHERE u.id = ? AND ue.empresa_id = ? AND ue.activo = 1`, [usuario_id, empresaId]
    );
    const [vinculados] = await pool.execute<RowDataPacket[]>('SELECT id FROM usuarios WHERE empleado_id = ? AND id <> ?', [req.params.id, usuario_id]);
    if (!empleados.length || !usuarios.length) {
      res.status(404).json({ success: false, message: 'Empleado o usuario no pertenece a la empresa' });
      return;
    }
    if (vinculados.length) {
      res.status(400).json({ success: false, message: 'El empleado ya tiene otra cuenta vinculada' });
      return;
    }
    const [ocupado] = await pool.execute<RowDataPacket[]>('SELECT id FROM usuarios WHERE empleado_id = ? AND id <> ?', [req.params.id, usuario_id]);
    if (ocupado.length) {
      res.status(400).json({ success: false, message: 'El empleado ya tiene una cuenta vinculada' });
      return;
    }
    await pool.execute('UPDATE usuarios SET empleado_id = ? WHERE id = ?', [req.params.id, usuario_id]);
    res.json({ success: true, message: 'Usuario vinculado al empleado exitosamente' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error al vincular usuario', error: error.message });
  }
};

export const desvincularUsuario = async (req: Request, res: Response): Promise<void> => {
  const empresaId = obtenerEmpresaId(req);
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  try {
    const [resultado] = await pool.execute<ResultSetHeader>(
      `UPDATE usuarios u INNER JOIN empleados e ON e.id = u.empleado_id
       SET u.empleado_id = NULL WHERE u.empleado_id = ? AND e.empresa_id = ?`,
      [req.params.id, empresaId]
    );
    res.json({ success: true, message: resultado.affectedRows ? 'Usuario desvinculado' : 'No había usuario vinculado' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error al desvincular usuario', error: error.message });
  }
};

export const listarUsuariosDisponibles = async (req: Request, res: Response): Promise<void> => {
  const empresaId = Number(req.query.empresa_id);
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  try {
    const [usuarios] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.nombre, u.apellido, u.email FROM usuarios u
       INNER JOIN usuario_empresa ue ON ue.usuario_id = u.id AND ue.empresa_id = ? AND ue.activo = 1
       WHERE u.activo = 1 AND u.tipo_usuario <> 'super_admin' AND u.empleado_id IS NULL
       ORDER BY u.nombre, u.apellido`, [empresaId]
    );
    res.json({ success: true, data: usuarios });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error al obtener usuarios disponibles', error: error.message });
  }
};

export const listarPeriodos = async (req: Request, res: Response): Promise<void> => {
  const empresaId = Number(req.query.empresa_id);
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  try {
    const [periodos] = await pool.execute<RowDataPacket[]>(
      `SELECT p.*, COUNT(l.id) AS liquidaciones
       FROM periodos_nomina p
       LEFT JOIN liquidaciones_nomina l ON l.periodo_id = p.id
       WHERE p.empresa_id = ? GROUP BY p.id ORDER BY p.fecha_inicio DESC`,
      [empresaId]
    );
    res.json({ success: true, data: periodos });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error al obtener periodos', error: error.message });
  }
};

export const crearPeriodo = async (req: Request, res: Response): Promise<void> => {
  const empresaId = obtenerEmpresaId(req);
  const usuario = (req as any).user;
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  const { nombre, fecha_inicio, fecha_fin, fecha_pago, periodicidad = 'mensual' } = req.body;
  if (!nombre || !fecha_inicio || !fecha_fin || fecha_inicio > fecha_fin) {
    res.status(400).json({ success: false, message: 'Nombre y fechas válidas son obligatorios' });
    return;
  }
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO periodos_nomina (empresa_id, nombre, fecha_inicio, fecha_fin, fecha_pago, periodicidad, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, nombre, fecha_inicio, fecha_fin, fecha_pago || null, periodicidad, usuario.id]
    );
    res.status(201).json({ success: true, message: 'Periodo creado exitosamente', data: { id: result.insertId } });
  } catch (error: any) {
    const duplicate = error.code === 'ER_DUP_ENTRY';
    res.status(duplicate ? 400 : 500).json({ success: false, message: duplicate ? 'Ya existe un periodo con esas fechas' : 'Error al crear periodo', error: error.message });
  }
};

export const calcularPeriodo = async (req: Request, res: Response): Promise<void> => {
  const empresaId = obtenerEmpresaId(req);
  const usuario = (req as any).user;
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [periodos] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM periodos_nomina WHERE id = ? AND empresa_id = ? FOR UPDATE',
      [req.params.periodoId, empresaId]
    );
    if (!periodos.length) throw new Error('Periodo no encontrado');
    if (['aprobado', 'pagado', 'cerrado'].includes(periodos[0].estado)) throw new Error('El periodo ya no se puede recalcular');
    const periodo = periodos[0];
    const [empleados] = await connection.execute<RowDataPacket[]>(
      `SELECT e.*, COALESCE(c.salario_base, e.salario_base) AS salario_vigente,
              COALESCE(c.porcentaje_comision, e.porcentaje_comision) AS comision_vigente
       FROM empleados e LEFT JOIN empleados_contratos c ON c.empleado_id = e.id AND c.estado = 'activo'
       WHERE e.empresa_id = ? AND e.estado = 'activo' GROUP BY e.id`, [empresaId]
    );
    await connection.execute('DELETE FROM liquidaciones_nomina_detalle WHERE liquidacion_id IN (SELECT id FROM liquidaciones_nomina WHERE periodo_id = ?)', [periodo.id]);
    await connection.execute('DELETE FROM liquidaciones_nomina WHERE periodo_id = ?', [periodo.id]);
    for (const empleado of empleados) {
      const [ventas] = await connection.execute<RowDataPacket[]>(
        `SELECT COALESCE(SUM(v.total), 0) AS total
         FROM ventas v INNER JOIN usuarios u ON u.id = v.vendedor_id AND u.empleado_id = ?
         WHERE v.empresa_id = ? AND DATE(v.fecha_venta) BETWEEN ? AND ? AND v.estado <> 'anulada'`,
        [empleado.id, empresaId, periodo.fecha_inicio, periodo.fecha_fin]
      );
      const base = Number(empleado.salario_vigente || 0) * (periodo.periodicidad === 'quincenal' ? 0.5 : periodo.periodicidad === 'semanal' ? 0.25 : 1);
      const ventasComisionables = Number(ventas[0]?.total || 0);
      const porcentaje = Number(empleado.comision_vigente || 0);
      const comision = Math.round(ventasComisionables * porcentaje) / 100;
      const [metas] = await connection.execute<RowDataPacket[]>(
        `SELECT meta_valor, bono_tipo, bono_valor, porcentaje_minimo
         FROM metas_nomina
         WHERE empleado_id = ? AND periodo_id = ? AND tipo = 'ventas' AND estado = 'activa'
         LIMIT 1`,
        [empleado.id, periodo.id]
      );
      let bonoMeta = 0;
      if (metas.length && Number(metas[0].meta_valor) > 0) {
        const cumplimiento = ventasComisionables / Number(metas[0].meta_valor) * 100;
        if (cumplimiento >= Number(metas[0].porcentaje_minimo || 100)) {
          bonoMeta = metas[0].bono_tipo === 'porcentaje'
            ? Math.round(base * Number(metas[0].bono_valor)) / 100
            : Number(metas[0].bono_valor || 0);
        }
      }
      const [novedades] = await connection.execute<RowDataPacket[]>(
        `SELECT n.id, n.cantidad, n.valor, n.descripcion, c.id AS concepto_id,
                c.codigo, c.nombre, c.tipo
         FROM novedades_nomina n
         INNER JOIN conceptos_nomina c ON c.id = n.concepto_id
         WHERE n.empleado_id = ? AND n.empresa_id = ?
           AND (n.periodo_id = ? OR n.periodo_id IS NULL)
           AND n.fecha BETWEEN ? AND ?
           AND n.estado IN ('aprobada', 'aplicada')`,
        [empleado.id, empresaId, periodo.id, periodo.fecha_inicio, periodo.fecha_fin]
      );
      const novedadesDevengadas = novedades.filter(novedad => novedad.tipo === 'devengado');
      const novedadesDeducciones = novedades.filter(novedad => novedad.tipo === 'deduccion');
      const totalNovedadesDevengadas = novedadesDevengadas.reduce((total, novedad) => total + Number(novedad.valor || 0), 0);
      const totalDeducciones = novedadesDeducciones.reduce((total, novedad) => total + Number(novedad.valor || 0), 0);
      const totalDevengado = base + comision + bonoMeta + totalNovedadesDevengadas;
      const netoPagar = totalDevengado - totalDeducciones;
      const [liquidacion] = await connection.execute<ResultSetHeader>(
        `INSERT INTO liquidaciones_nomina
         (empresa_id, periodo_id, empleado_id, salario_base, total_devengado, total_deducciones, neto_pagar,
          ventas_comisionables, porcentaje_comision, calculated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        [empresaId, periodo.id, empleado.id, base, totalDevengado, totalDeducciones, netoPagar, ventasComisionables, porcentaje, usuario.id]
      );
      const detalle = [
        [liquidacion.insertId, null, 'SALARIO_BASE', 'Salario base', 'devengado', 1, base, 0, base, 'contrato'],
        [liquidacion.insertId, null, 'COMISION_VENTAS', 'Comision por ventas', 'devengado', ventasComisionables, ventasComisionables, porcentaje, comision, 'ventas'],
        ...(bonoMeta > 0 ? [[liquidacion.insertId, null, 'BONO_META', 'Bono por cumplimiento de meta', 'devengado', 1, ventasComisionables, 0, bonoMeta, 'meta']] : []),
        ...novedades.map(novedad => [
          liquidacion.insertId, novedad.concepto_id, novedad.codigo, novedad.nombre,
          novedad.tipo, novedad.cantidad, novedad.valor, 0, novedad.valor, 'novedad'
        ])
      ];
      await connection.query(
        `INSERT INTO liquidaciones_nomina_detalle
         (liquidacion_id, concepto_id, codigo, nombre, tipo, cantidad, base, tasa, valor, origen) VALUES ?`,
        [detalle]
      );
    }
    await connection.execute("UPDATE periodos_nomina SET estado = 'calculado' WHERE id = ?", [periodo.id]);
    await connection.commit();
    res.json({ success: true, message: 'Periodo calculado exitosamente', data: { empleados: empleados.length } });
  } catch (error: any) {
    await connection.rollback();
    res.status(error.message === 'Periodo no encontrado' ? 404 : 400).json({ success: false, message: error.message || 'Error al calcular periodo' });
  } finally {
    connection.release();
  }
};

export const listarLiquidaciones = async (req: Request, res: Response): Promise<void> => {
  const empresaId = Number(req.query.empresa_id);
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  try {
    const [liquidaciones] = await pool.execute<RowDataPacket[]>(
      `SELECT l.*, e.nombres, e.apellidos, e.numero_documento
       FROM liquidaciones_nomina l INNER JOIN empleados e ON e.id = l.empleado_id
       WHERE l.empresa_id = ? AND l.periodo_id = ? ORDER BY e.apellidos, e.nombres`,
      [empresaId, req.params.periodoId]
    );
    res.json({ success: true, data: liquidaciones });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error al obtener liquidaciones', error: error.message });
  }
};

export const listarMetas = async (req: Request, res: Response): Promise<void> => {
  const empresaId = Number(req.query.empresa_id);
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  try {
    const [metas] = await pool.execute<RowDataPacket[]>(
      `SELECT m.*, e.nombres, e.apellidos, p.nombre AS periodo_nombre
       FROM metas_nomina m
       INNER JOIN empleados e ON e.id = m.empleado_id
       INNER JOIN periodos_nomina p ON p.id = m.periodo_id
       WHERE m.empresa_id = ? ORDER BY p.fecha_inicio DESC, e.apellidos, e.nombres`,
      [empresaId]
    );
    res.json({ success: true, data: metas });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error al obtener metas', error: error.message });
  }
};

export const crearMeta = async (req: Request, res: Response): Promise<void> => {
  const empresaId = obtenerEmpresaId(req);
  const usuario = (req as any).user;
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  const { empleado_id, periodo_id, tipo = 'ventas', meta_valor, bono_tipo = 'valor', bono_valor = 0, porcentaje_minimo = 100 } = req.body;
  if (!empleado_id || !periodo_id || !Number(meta_valor) || Number(meta_valor) <= 0) {
    res.status(400).json({ success: false, message: 'Empleado, periodo y meta válida son obligatorios' });
    return;
  }
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO metas_nomina (empresa_id, empleado_id, periodo_id, tipo, meta_valor, bono_tipo, bono_valor, porcentaje_minimo, created_by)
       SELECT ?, e.id, p.id, ?, ?, ?, ?, ?, ?
       FROM empleados e INNER JOIN periodos_nomina p ON p.id = ? AND p.empresa_id = ?
       WHERE e.id = ? AND e.empresa_id = ?`,
      [empresaId, tipo, meta_valor, bono_tipo, bono_valor, porcentaje_minimo, usuario.id, periodo_id, empresaId, empleado_id, empresaId]
    );
    if (!result.affectedRows) {
      res.status(400).json({ success: false, message: 'Empleado o periodo no pertenece a la empresa' });
      return;
    }
    res.status(201).json({ success: true, message: 'Meta creada exitosamente', data: { id: result.insertId } });
  } catch (error: any) {
    const duplicate = error.code === 'ER_DUP_ENTRY';
    res.status(duplicate ? 400 : 500).json({ success: false, message: duplicate ? 'Ya existe una meta de este tipo para el empleado y periodo' : 'Error al crear meta', error: error.message });
  }
};

export const listarConceptos = async (req: Request, res: Response): Promise<void> => {
  const empresaId = Number(req.query.empresa_id);
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  try {
    const [conceptos] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM conceptos_nomina WHERE activo = 1 AND (empresa_id = ? OR empresa_id IS NULL)
       ORDER BY empresa_id IS NULL DESC, nombre`, [empresaId]
    );
    res.json({ success: true, data: conceptos });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error al obtener conceptos', error: error.message });
  }
};

export const listarNovedades = async (req: Request, res: Response): Promise<void> => {
  const empresaId = Number(req.query.empresa_id);
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  try {
    const [novedades] = await pool.execute<RowDataPacket[]>(
      `SELECT n.*, e.nombres, e.apellidos, c.nombre AS concepto_nombre, c.tipo AS concepto_tipo,
              p.nombre AS periodo_nombre
       FROM novedades_nomina n INNER JOIN empleados e ON e.id = n.empleado_id
       INNER JOIN conceptos_nomina c ON c.id = n.concepto_id
       LEFT JOIN periodos_nomina p ON p.id = n.periodo_id
       WHERE n.empresa_id = ? ORDER BY n.fecha DESC, n.id DESC`, [empresaId]
    );
    res.json({ success: true, data: novedades });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error al obtener novedades', error: error.message });
  }
};

export const aprobarPeriodo = async (req: Request, res: Response): Promise<void> => {
  const empresaId = Number(req.query.empresa_id || req.body.empresa_id);
  const usuario = (req as any).user;
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  try {
    const [resultado] = await pool.execute<ResultSetHeader>(
      `UPDATE periodos_nomina SET estado = 'aprobado', approved_by = ?, approved_at = CURRENT_TIMESTAMP
       WHERE id = ? AND empresa_id = ? AND estado = 'calculado'`,
      [usuario.id, req.params.periodoId, empresaId]
    );
    if (!resultado.affectedRows) {
      res.status(400).json({ success: false, message: 'El periodo no está calculado o ya fue aprobado' });
      return;
    }
    await pool.execute(
      `UPDATE liquidaciones_nomina SET estado = 'aprobada', approved_by = ?, approved_at = CURRENT_TIMESTAMP
       WHERE periodo_id = ? AND empresa_id = ? AND estado = 'calculada'`,
      [usuario.id, req.params.periodoId, empresaId]
    );
    res.json({ success: true, message: 'Periodo aprobado exitosamente' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error al aprobar periodo', error: error.message });
  }
};

export const pagarLiquidacion = async (req: Request, res: Response): Promise<void> => {
  const empresaId = Number(req.query.empresa_id || req.body.empresa_id);
  const usuario = (req as any).user;
  const { cuenta_bancaria_id, referencia_pago } = req.body;
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  if (!cuenta_bancaria_id) {
    res.status(400).json({ success: false, message: 'Selecciona una cuenta bancaria para pagar la liquidación' });
    return;
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [liquidaciones] = await connection.execute<RowDataPacket[]>(
      `SELECT l.*, e.nombres, e.apellidos FROM liquidaciones_nomina l
       INNER JOIN empleados e ON e.id = l.empleado_id
       WHERE l.id = ? AND l.empresa_id = ? AND l.estado = 'aprobada' FOR UPDATE`,
      [req.params.liquidacionId, empresaId]
    );
    if (!liquidaciones.length) throw new Error('La liquidación no existe o no está aprobada');
    const liquidacion = liquidaciones[0];
    const [cuentas] = await connection.execute<RowDataPacket[]>(
      'SELECT id, saldo_actual FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? AND activo = 1 FOR UPDATE',
      [cuenta_bancaria_id, empresaId]
    );
    if (!cuentas.length) throw new Error('La cuenta bancaria no existe o está inactiva');
    const saldoAnterior = Number(cuentas[0].saldo_actual);
    const saldoNuevo = saldoAnterior - Number(liquidacion.neto_pagar);
    if (saldoNuevo < 0) throw new Error('El pago dejaría la cuenta bancaria en saldo negativo');
    const referencia = referencia_pago || `NOM-${liquidacion.id}`;
    await connection.execute(
      `INSERT INTO movimientos_bancarios
       (empresa_id, cuenta_bancaria_id, tipo, origen, referencia, descripcion, valor, saldo_anterior, saldo_nuevo, created_by)
       VALUES (?, ?, 'retiro', 'nomina', ?, ?, ?, ?, ?, ?)`,
      [empresaId, cuenta_bancaria_id, referencia, `Pago nómina ${liquidacion.nombres} ${liquidacion.apellidos}`, liquidacion.neto_pagar, saldoAnterior, saldoNuevo, usuario.id]
    );
    await connection.execute('UPDATE cuentas_bancarias SET saldo_actual = ? WHERE id = ? AND empresa_id = ?', [saldoNuevo, cuenta_bancaria_id, empresaId]);
    await connection.execute(
      `UPDATE liquidaciones_nomina SET estado = 'pagada', cuenta_bancaria_id = ?, referencia_pago = ?, paid_at = CURRENT_TIMESTAMP
       WHERE id = ? AND empresa_id = ?`,
      [cuenta_bancaria_id, referencia, liquidacion.id, empresaId]
    );
    await connection.commit();
    res.json({ success: true, message: 'Liquidación pagada exitosamente', data: { saldo_nuevo: saldoNuevo, referencia } });
  } catch (error: any) {
    await connection.rollback();
    res.status(400).json({ success: false, message: error.message || 'Error al pagar liquidación' });
  } finally {
    connection.release();
  }
};

export const crearNovedad = async (req: Request, res: Response): Promise<void> => {
  const empresaId = obtenerEmpresaId(req);
  const usuario = (req as any).user;
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  const { empleado_id, periodo_id, concepto_id, fecha, cantidad = 1, valor = 0, descripcion } = req.body;
  if (!empleado_id || !concepto_id || !fecha || Number(valor) <= 0) {
    res.status(400).json({ success: false, message: 'Empleado, concepto, fecha y valor positivo son obligatorios' });
    return;
  }
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO novedades_nomina (empresa_id, empleado_id, periodo_id, concepto_id, fecha, cantidad, valor, descripcion, created_by)
       SELECT ?, e.id, ?, c.id, ?, ?, ?, ?, ?
       FROM empleados e INNER JOIN conceptos_nomina c ON c.id = ? AND (c.empresa_id = ? OR c.empresa_id IS NULL)
       WHERE e.id = ? AND e.empresa_id = ?`,
      [empresaId, periodo_id || null, fecha, cantidad, valor, descripcion || null, usuario.id, concepto_id, empresaId, empleado_id, empresaId]
    );
    if (!result.affectedRows) {
      res.status(400).json({ success: false, message: 'Empleado o concepto no pertenece a la empresa' });
      return;
    }
    res.status(201).json({ success: true, message: 'Novedad registrada exitosamente', data: { id: result.insertId } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error al registrar novedad', error: error.message });
  }
};

export const aprobarNovedad = async (req: Request, res: Response): Promise<void> => {
  const empresaId = Number(req.query.empresa_id || req.body.empresa_id);
  const usuario = (req as any).user;
  if (!(await validarEmpresa(req, empresaId))) {
    res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    return;
  }
  try {
    const [resultado] = await pool.execute<ResultSetHeader>(
      `UPDATE novedades_nomina SET estado = 'aprobada', approved_by = ?
       WHERE id = ? AND empresa_id = ? AND estado = 'borrador'`,
      [usuario.id, req.params.novedadId, empresaId]
    );
    if (!resultado.affectedRows) {
      res.status(400).json({ success: false, message: 'La novedad no existe o ya fue procesada' });
      return;
    }
    res.json({ success: true, message: 'Novedad aprobada exitosamente' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error al aprobar novedad', error: error.message });
  }
};
