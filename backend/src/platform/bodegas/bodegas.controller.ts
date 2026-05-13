/**
 * =================================
 * KORE INVENTORY - BODEGAS CONTROLLER
 * Gestión de Bodegas/Almacenes/Sucursales
 * =================================
 */

import { Request, Response } from 'express';
import pool from '../../shared/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ============================================
// TIPOS
// ============================================

interface Bodega extends RowDataPacket {
  id: number;
  empresa_id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo: 'bodega' | 'sucursal' | 'local' | 'almacen' | 'tienda';
  direccion: string | null;
  ciudad: string | null;
  departamento: string | null;
  telefono: string | null;
  email: string | null;
  responsable_id: number | null;
  es_principal: boolean;
  permite_ventas: boolean;
  estado: 'activa' | 'inactiva' | 'en_mantenimiento';
  created_at: Date;
  updated_at: Date;
}

// ============================================
// OBTENER BODEGAS DE LA EMPRESA
// ============================================

export const getBodegas = async (req: Request, res: Response): Promise<void> => {
  try {
    const { empresa_id } = req.query;
    const usuario = (req as any).user;

    if (!usuario) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      return;
    }

    let empresaIdFinal: number;

    // super_admin puede especificar empresa_id, admin_empresa usa la suya
    if (usuario.tipo_usuario === 'super_admin' && empresa_id) {
      empresaIdFinal = parseInt(empresa_id as string);
    } else {
      empresaIdFinal = usuario.empresa_id;
    }

    if (!empresaIdFinal) {
      res.status(400).json({
        success: false,
        message: 'ID de empresa requerido'
      });
      return;
    }

    const [bodegas] = await pool.execute<Bodega[]>(
      `SELECT 
        b.*,
        u.nombre as responsable_nombre,
        u.email as responsable_email
      FROM bodegas b
      LEFT JOIN usuarios u ON b.responsable_id = u.id
      WHERE b.empresa_id = ?
      ORDER BY b.es_principal DESC, b.nombre ASC`,
      [empresaIdFinal]
    );

    res.json({
      success: true,
      data: bodegas
    });
  } catch (error: any) {
    console.error('Error al obtener bodegas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener bodegas',
      error: error.message
    });
  }
};

// ============================================
// OBTENER BODEGA POR ID
// ============================================

export const getBodegaById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const usuario = (req as any).user;

    const [bodegas] = await pool.execute<Bodega[]>(
      `SELECT 
        b.*,
        u.nombre as responsable_nombre,
        u.email as responsable_email,
        e.nombre as empresa_nombre
      FROM bodegas b
      LEFT JOIN usuarios u ON b.responsable_id = u.id
      INNER JOIN empresas e ON b.empresa_id = e.id
      WHERE b.id = ?`,
      [id]
    );

    if (bodegas.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Bodega no encontrada'
      });
      return;
    }

    const bodega = bodegas[0];

    // Verificar permisos
    if (usuario.tipo_usuario !== 'super_admin' && bodega.empresa_id !== usuario.empresa_id) {
      res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver esta bodega'
      });
      return;
    }

    res.json({
      success: true,
      data: bodega
    });
  } catch (error: any) {
    console.error('Error al obtener bodega:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener bodega',
      error: error.message
    });
  }
};

// ============================================
// CREAR BODEGA
// ============================================

export const createBodega = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const usuario = (req as any).user;
    const {
      empresa_id,
      codigo,
      nombre,
      descripcion,
      tipo = 'bodega',
      direccion,
      ciudad,
      departamento,
      telefono,
      email,
      responsable_id,
      es_principal = false,
      permite_ventas = true
    } = req.body;

    // Validaciones básicas
    if (!nombre || !codigo) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: 'Nombre y código son obligatorios'
      });
      return;
    }

    // Determinar empresa_id
    const empresaIdFinal = usuario.tipo_usuario === 'super_admin' && empresa_id
      ? empresa_id
      : usuario.empresa_id;

    if (!empresaIdFinal) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: 'ID de empresa requerido'
      });
      return;
    }

    // Verificar que el código no exista para esta empresa
    const [codigoExistente] = await connection.execute<RowDataPacket[]>(
      'SELECT id FROM bodegas WHERE empresa_id = ? AND codigo = ?',
      [empresaIdFinal, codigo]
    );

    if (codigoExistente.length > 0) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: 'El código de bodega ya existe para esta empresa'
      });
      return;
    }

    // Si se marca como principal, desmarcar otras
    if (es_principal) {
      await connection.execute(
        'UPDATE bodegas SET es_principal = 0 WHERE empresa_id = ?',
        [empresaIdFinal]
      );
    }

    // Crear bodega
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO bodegas (
        empresa_id,
        codigo,
        nombre,
        descripcion,
        tipo,
        direccion,
        ciudad,
        departamento,
        telefono,
        email,
        responsable_id,
        es_principal,
        permite_ventas,
        estado,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activa', ?)`,
      [
        empresaIdFinal,
        codigo,
        nombre,
        descripcion || null,
        tipo,
        direccion || null,
        ciudad || null,
        departamento || null,
        telefono || null,
        email || null,
        responsable_id || null,
        es_principal ? 1 : 0,
        permite_ventas ? 1 : 0,
        usuario.id
      ]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Bodega creada exitosamente',
      data: {
        id: result.insertId,
        codigo,
        nombre
      }
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error al crear bodega:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear bodega',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ============================================
// ACTUALIZAR BODEGA
// ============================================

export const updateBodega = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const usuario = (req as any).user;
    const {
      codigo,
      nombre,
      descripcion,
      tipo,
      direccion,
      ciudad,
      departamento,
      telefono,
      email,
      responsable_id,
      es_principal,
      permite_ventas,
      estado
    } = req.body;

    // Verificar que existe
    const [bodegas] = await connection.execute<Bodega[]>(
      'SELECT * FROM bodegas WHERE id = ?',
      [id]
    );

    if (bodegas.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: 'Bodega no encontrada'
      });
      return;
    }

    const bodega = bodegas[0];

    // Verificar permisos
    if (usuario.tipo_usuario !== 'super_admin' && bodega.empresa_id !== usuario.empresa_id) {
      await connection.rollback();
      res.status(403).json({
        success: false,
        message: 'No tienes permiso para actualizar esta bodega'
      });
      return;
    }

    // Si se marca como principal, desmarcar otras
    if (es_principal && !bodega.es_principal) {
      await connection.execute(
        'UPDATE bodegas SET es_principal = 0 WHERE empresa_id = ?',
        [bodega.empresa_id]
      );
    }

    // Actualizar
    await connection.execute(
      `UPDATE bodegas SET
        codigo = ?,
        nombre = ?,
        descripcion = ?,
        tipo = ?,
        direccion = ?,
        ciudad = ?,
        departamento = ?,
        telefono = ?,
        email = ?,
        responsable_id = ?,
        es_principal = ?,
        permite_ventas = ?,
        estado = ?
      WHERE id = ?`,
      [
        codigo || bodega.codigo,
        nombre || bodega.nombre,
        descripcion !== undefined ? descripcion : bodega.descripcion,
        tipo || bodega.tipo,
        direccion !== undefined ? direccion : bodega.direccion,
        ciudad !== undefined ? ciudad : bodega.ciudad,
        departamento !== undefined ? departamento : bodega.departamento,
        telefono !== undefined ? telefono : bodega.telefono,
        email !== undefined ? email : bodega.email,
        responsable_id !== undefined ? responsable_id : bodega.responsable_id,
        es_principal !== undefined ? (es_principal ? 1 : 0) : bodega.es_principal,
        permite_ventas !== undefined ? (permite_ventas ? 1 : 0) : bodega.permite_ventas,
        estado || bodega.estado,
        id
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: 'Bodega actualizada exitosamente'
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error al actualizar bodega:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar bodega',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ============================================
// ELIMINAR BODEGA
// ============================================

export const deleteBodega = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const usuario = (req as any).user;

    // Verificar que existe
    const [bodegas] = await connection.execute<Bodega[]>(
      'SELECT * FROM bodegas WHERE id = ?',
      [id]
    );

    if (bodegas.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: 'Bodega no encontrada'
      });
      return;
    }

    const bodega = bodegas[0];

    // Verificar permisos
    if (usuario.tipo_usuario !== 'super_admin' && bodega.empresa_id !== usuario.empresa_id) {
      await connection.rollback();
      res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar esta bodega'
      });
      return;
    }

    // No permitir eliminar bodega principal
    if (bodega.es_principal) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: 'No se puede eliminar la bodega principal'
      });
      return;
    }

    // Verificar si tiene stock
    const [stock] = await connection.execute<RowDataPacket[]>(
      'SELECT SUM(stock_actual) as total FROM productos_bodegas WHERE bodega_id = ?',
      [id]
    );

    if (stock[0].total > 0) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: 'No se puede eliminar una bodega con stock. Traslade los productos primero.'
      });
      return;
    }

    // Eliminar
    await connection.execute('DELETE FROM bodegas WHERE id = ?', [id]);

    await connection.commit();

    res.json({
      success: true,
      message: 'Bodega eliminada exitosamente'
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error al eliminar bodega:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar bodega',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ============================================
// OBTENER STOCK POR BODEGA
// ============================================

export const getStockPorBodega = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bodega_id } = req.params;
    const usuario = (req as any).user;

    // Verificar permisos
    const [bodegas] = await pool.execute<Bodega[]>(
      'SELECT * FROM bodegas WHERE id = ?',
      [bodega_id]
    );

    if (bodegas.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Bodega no encontrada'
      });
      return;
    }

    if (usuario.tipo_usuario !== 'super_admin' && bodegas[0].empresa_id !== usuario.empresa_id) {
      res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver el stock de esta bodega'
      });
      return;
    }

    const [stock] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM vista_stock_por_bodega
       WHERE bodega_id = ?
       ORDER BY producto_nombre ASC`,
      [bodega_id]
    );

    res.json({
      success: true,
      data: stock
    });
  } catch (error: any) {
    console.error('Error al obtener stock por bodega:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener stock por bodega',
      error: error.message
    });
  }
};
