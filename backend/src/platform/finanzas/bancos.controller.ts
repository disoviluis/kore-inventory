import { Request, Response } from 'express';
import pool from '../../shared/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const empresaIdDesde = (req: Request): number => Number(req.query.empresa_id || req.body.empresa_id);
async function accesoEmpresa(req: Request, empresaId: number): Promise<boolean> {
  const usuario = (req as any).user;
  if (!usuario || !empresaId) return false;
  if (usuario.tipo_usuario === 'super_admin') return true;
  const [filas] = await pool.execute<RowDataPacket[]>(
    'SELECT 1 FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ? AND activo = 1 LIMIT 1',
    [usuario.id, empresaId]
  );
  return filas.length > 0;
}

export const listarCuentasBancarias = async (req: Request, res: Response): Promise<void> => {
  const empresaId = empresaIdDesde(req);
  if (!(await accesoEmpresa(req, empresaId))) { res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' }); return; }
  try {
    const [cuentas] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM cuentas_bancarias WHERE empresa_id = ? ORDER BY activo DESC, banco, nombre', [empresaId]
    );
    res.json({ success: true, data: cuentas });
  } catch (error: any) { res.status(500).json({ success: false, message: 'Error al obtener cuentas bancarias', error: error.message }); }
};

export const crearCuentaBancaria = async (req: Request, res: Response): Promise<void> => {
  const empresaId = empresaIdDesde(req);
  if (!(await accesoEmpresa(req, empresaId))) { res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' }); return; }
  const { banco, nombre, tipo_cuenta = 'corriente', numero_cuenta, titular, saldo_inicial = 0 } = req.body;
  if (!banco || !nombre || !numero_cuenta || Number(saldo_inicial) < 0) { res.status(400).json({ success: false, message: 'Banco, nombre, número de cuenta y saldo válido son obligatorios' }); return; }
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO cuentas_bancarias (empresa_id, banco, nombre, tipo_cuenta, numero_cuenta, titular, saldo_inicial, saldo_actual)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [empresaId, banco, nombre, tipo_cuenta, numero_cuenta, titular || null, saldo_inicial, saldo_inicial]
    );
    res.status(201).json({ success: true, message: 'Cuenta bancaria creada exitosamente', data: { id: result.insertId } });
  } catch (error: any) { res.status(error.code === 'ER_DUP_ENTRY' ? 400 : 500).json({ success: false, message: error.code === 'ER_DUP_ENTRY' ? 'El número de cuenta ya está registrado' : 'Error al crear cuenta bancaria', error: error.message }); }
};

export const listarMovimientos = async (req: Request, res: Response): Promise<void> => {
  const empresaId = empresaIdDesde(req);
  if (!(await accesoEmpresa(req, empresaId))) { res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' }); return; }
  try {
    const [movimientos] = await pool.execute<RowDataPacket[]>(
      `SELECT m.*, c.banco, c.nombre AS cuenta_nombre, u.nombre AS creado_por_nombre
       FROM movimientos_bancarios m INNER JOIN cuentas_bancarias c ON c.id = m.cuenta_bancaria_id
       LEFT JOIN usuarios u ON u.id = m.created_by
       WHERE m.empresa_id = ? ORDER BY m.fecha_movimiento DESC, m.id DESC LIMIT 500`, [empresaId]
    );
    res.json({ success: true, data: movimientos });
  } catch (error: any) { res.status(500).json({ success: false, message: 'Error al obtener movimientos bancarios', error: error.message }); }
};

export const crearMovimiento = async (req: Request, res: Response): Promise<void> => {
  const empresaId = empresaIdDesde(req);
  const usuario = (req as any).user;
  if (!(await accesoEmpresa(req, empresaId))) { res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' }); return; }
  const { cuenta_bancaria_id, tipo, origen = 'otro', fecha_movimiento, referencia, descripcion, valor } = req.body;
  if (!cuenta_bancaria_id || !tipo || !descripcion || Number(valor) <= 0) { res.status(400).json({ success: false, message: 'Cuenta, tipo, descripción y valor positivo son obligatorios' }); return; }
  const entradas = ['deposito', 'nota_credito'].includes(tipo);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [cuentas] = await connection.execute<RowDataPacket[]>(
      'SELECT id, saldo_actual FROM cuentas_bancarias WHERE id = ? AND empresa_id = ? AND activo = 1 FOR UPDATE', [cuenta_bancaria_id, empresaId]
    );
    if (!cuentas.length) throw new Error('Cuenta bancaria no encontrada o inactiva');
    const saldoAnterior = Number(cuentas[0].saldo_actual);
    const saldoNuevo = saldoAnterior + (entradas ? Number(valor) : -Number(valor));
    if (saldoNuevo < 0) throw new Error('El movimiento dejaría el saldo bancario en negativo');
    await connection.execute(
      `INSERT INTO movimientos_bancarios (empresa_id, cuenta_bancaria_id, tipo, origen, fecha_movimiento, referencia, descripcion, valor, saldo_anterior, saldo_nuevo, created_by)
       VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?)`,
      [empresaId, cuenta_bancaria_id, tipo, origen, fecha_movimiento || null, referencia || null, descripcion, valor, saldoAnterior, saldoNuevo, usuario.id]
    );
    await connection.execute('UPDATE cuentas_bancarias SET saldo_actual = ? WHERE id = ? AND empresa_id = ?', [saldoNuevo, cuenta_bancaria_id, empresaId]);
    await connection.commit();
    res.status(201).json({ success: true, message: 'Movimiento bancario registrado', data: { saldo_anterior: saldoAnterior, saldo_nuevo: saldoNuevo } });
  } catch (error: any) {
    await connection.rollback();
    res.status(error.message.includes('negativo') || error.message.includes('no encontrada') ? 400 : 500).json({ success: false, message: error.message || 'Error al registrar movimiento' });
  } finally { connection.release(); }
};

export const conciliarMovimiento = async (req: Request, res: Response): Promise<void> => {
  const empresaId = empresaIdDesde(req);
  const usuario = (req as any).user;
  if (!(await accesoEmpresa(req, empresaId))) { res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' }); return; }
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE movimientos_bancarios SET conciliado = 1, fecha_conciliacion = CURRENT_TIMESTAMP, conciliado_por = ?
       WHERE id = ? AND empresa_id = ? AND conciliado = 0`, [usuario.id, req.params.id, empresaId]
    );
    if (!result.affectedRows) { res.status(404).json({ success: false, message: 'Movimiento no encontrado o ya conciliado' }); return; }
    res.json({ success: true, message: 'Movimiento conciliado' });
  } catch (error: any) { res.status(500).json({ success: false, message: 'Error al conciliar movimiento', error: error.message }); }
};
