import { Request, Response } from 'express';
import pool from '../../shared/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const obtenerEmpresaId = (req: Request): number | null => {
  const usuario = (req as any).user;
  const valor = req.query.empresa_id || req.body.empresa_id || usuario?.empresa_id;
  const empresaId = Number(valor);
  return Number.isInteger(empresaId) && empresaId > 0 ? empresaId : null;
};

const validarEmpresa = async (req: Request, empresaId: number): Promise<boolean> => {
  const usuario = (req as any).user;
  if (usuario?.tipo_usuario === 'super_admin') return true;
  const [empresas] = await pool.query<RowDataPacket[]>(
    'SELECT empresa_id FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ? AND activo = 1 LIMIT 1',
    [usuario.id, empresaId]
  );
  return empresas.length > 0;
};

export const getCajas = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = obtenerEmpresaId(req);
    const bodegaId = req.query.bodega_id ? Number(req.query.bodega_id) : null;
    if (!empresaId || !(await validarEmpresa(req, empresaId))) {
      return res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    }

    const params: any[] = [empresaId];
    let filtroBodega = '';
    if (bodegaId) {
      filtroBodega = ' AND c.bodega_id = ?';
      params.push(bodegaId);
    }
    const [cajas] = await pool.query<RowDataPacket[]>(`
      SELECT c.id, c.empresa_id, c.bodega_id, b.nombre AS bodega_nombre,
             c.codigo, c.nombre, c.tipo, c.activo, c.responsable_id,
             COUNT(CASE WHEN uc.activo = 1 THEN uc.usuario_id END) AS usuarios_asignados
      FROM cajas c
      INNER JOIN bodegas b ON b.id = c.bodega_id AND b.empresa_id = c.empresa_id
      LEFT JOIN usuario_caja uc ON uc.caja_id = c.id
      WHERE c.empresa_id = ?${filtroBodega}
      GROUP BY c.id
      ORDER BY b.nombre, c.id`, params);

    return res.json({ success: true, data: cajas });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Error al obtener cajas', error: error.message });
  }
};

export const createCaja = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = obtenerEmpresaId(req);
    const { bodega_id, codigo, nombre, tipo = 'secundaria', responsable_id = null } = req.body;
    if (!empresaId || !(await validarEmpresa(req, empresaId))) {
      return res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    }
    if (!bodega_id || !codigo || !nombre) {
      return res.status(400).json({ success: false, message: 'bodega_id, codigo y nombre son obligatorios' });
    }

    const [bodegas] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM bodegas WHERE id = ? AND empresa_id = ? LIMIT 1', [bodega_id, empresaId]
    );
    if (bodegas.length === 0) {
      return res.status(400).json({ success: false, message: 'La tienda no pertenece a la empresa' });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO cajas (empresa_id, bodega_id, codigo, nombre, tipo, responsable_id, activo)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [empresaId, bodega_id, codigo, nombre, tipo, responsable_id]
    );
    return res.status(201).json({ success: true, message: 'Caja creada exitosamente', data: { id: result.insertId } });
  } catch (error: any) {
    const status = error.code === 'ER_DUP_ENTRY' ? 409 : 500;
    return res.status(status).json({ success: false, message: status === 409 ? 'El código de caja ya existe en esta empresa' : 'Error al crear caja', error: error.message });
  }
};

export const updateCaja = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = obtenerEmpresaId(req);
    const { id } = req.params;
    const { nombre, tipo, responsable_id, activo } = req.body;
    if (!empresaId || !(await validarEmpresa(req, empresaId))) {
      return res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    }
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE cajas SET nombre = COALESCE(?, nombre), tipo = COALESCE(?, tipo),
       responsable_id = ?, activo = COALESCE(?, activo)
       WHERE id = ? AND empresa_id = ?`,
      [nombre ?? null, tipo ?? null, responsable_id ?? null, activo === undefined ? null : (activo ? 1 : 0), id, empresaId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Caja no encontrada' });
    return res.json({ success: true, message: 'Caja actualizada exitosamente' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Error al actualizar caja', error: error.message });
  }
};

export const asignarUsuario = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = obtenerEmpresaId(req);
    const { id: cajaId } = req.params;
    const { usuario_id } = req.body;
    if (!empresaId || !(await validarEmpresa(req, empresaId))) {
      return res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    }
    const [validacion] = await pool.query<RowDataPacket[]>(
      `SELECT c.id FROM cajas c INNER JOIN usuario_empresa ue ON ue.empresa_id = c.empresa_id
       WHERE c.id = ? AND c.empresa_id = ? AND ue.usuario_id = ? AND ue.activo = 1 LIMIT 1`,
      [cajaId, empresaId, usuario_id]
    );
    if (validacion.length === 0) return res.status(400).json({ success: false, message: 'La caja o el usuario no pertenecen a la empresa' });
    await pool.query(
      `INSERT INTO usuario_caja (usuario_id, caja_id, activo) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE activo = 1`, [usuario_id, cajaId]
    );
    return res.json({ success: true, message: 'Usuario asignado a la caja' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Error al asignar usuario a caja', error: error.message });
  }
};

export const desasignarUsuario = async (req: Request, res: Response): Promise<Response> => {
  try {
    const empresaId = obtenerEmpresaId(req);
    if (!empresaId || !(await validarEmpresa(req, empresaId))) {
      return res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
    }
    await pool.query(
      `UPDATE usuario_caja uc INNER JOIN cajas c ON c.id = uc.caja_id
       SET uc.activo = 0 WHERE uc.usuario_id = ? AND uc.caja_id = ? AND c.empresa_id = ?`,
      [req.params.usuarioId, req.params.id, empresaId]
    );
    return res.json({ success: true, message: 'Usuario retirado de la caja' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Error al retirar usuario de caja', error: error.message });
  }
};