/**
 * CONTROLLER: TRASLADOS ENTRE BODEGAS
 * Descripción: Gestión completa de traslados de mercancía entre bodegas
 * Incluye: Módulo de mensajero, firma digital, geolocalización
 * Autor: Disovi Soft
 * Fecha: 2026-05-13
 */

import { Request, Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../shared/database';
import logger from '../../shared/logger';

/**
 * GET /api/traslados
 * Lista todos los traslados con filtros opcionales
 * Query params: empresa_id, estado, mensajero_id, fecha_desde, fecha_hasta
 */
export const getTraslados = async (req: Request, res: Response) => {
  try {
    const { 
      empresa_id, 
      estado, 
      mensajero_id, 
      fecha_desde, 
      fecha_hasta,
      bodega_origen_id,
      bodega_destino_id
    } = req.query;
    const usuario = (req as any).usuario;

    // Validar permisos
    if (usuario.tipo_usuario === 'admin_empresa' && empresa_id != usuario.empresa_id_default) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para acceder a traslados de otra empresa'
      });
    }

    // Si es mensajero, solo puede ver sus traslados asignados
    const esMensajero = usuario.tipo_usuario === 'mensajero';
    
    let query = `
      SELECT 
        t.*,
        bo.nombre as bodega_origen_nombre,
        bo.codigo as bodega_origen_codigo,
        bd.nombre as bodega_destino_nombre,
        bd.codigo as bodega_destino_codigo,
        us.nombre as usuario_solicita_nombre,
        ua.nombre as usuario_aprueba_nombre,
        ue.nombre as usuario_envia_nombre,
        ur.nombre as usuario_recibe_nombre,
        um.nombre as mensajero_nombre,
        um.email as mensajero_email,
        um.telefono as mensajero_telefono,
        (SELECT COUNT(*) FROM traslados_detalle WHERE traslado_id = t.id) as total_productos,
        (SELECT SUM(cantidad_solicitada) FROM traslados_detalle WHERE traslado_id = t.id) as total_unidades
      FROM traslados t
      LEFT JOIN bodegas bo ON t.bodega_origen_id = bo.id
      LEFT JOIN bodegas bd ON t.bodega_destino_id = bd.id
      LEFT JOIN usuarios us ON t.usuario_solicita_id = us.id
      LEFT JOIN usuarios ua ON t.usuario_aprueba_id = ua.id
      LEFT JOIN usuarios ue ON t.usuario_envia_id = ue.id
      LEFT JOIN usuarios ur ON t.usuario_recibe_id = ur.id
      LEFT JOIN usuarios um ON t.mensajero_id = um.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (empresa_id) {
      query += ' AND t.empresa_id = ?';
      params.push(empresa_id);
    }

    if (estado) {
      query += ' AND t.estado = ?';
      params.push(estado);
    }

    if (bodega_origen_id) {
      query += ' AND t.bodega_origen_id = ?';
      params.push(bodega_origen_id);
    }

    if (bodega_destino_id) {
      query += ' AND t.bodega_destino_id = ?';
      params.push(bodega_destino_id);
    }

    // Si es mensajero, filtrar solo sus traslados
    if (esMensajero) {
      query += ' AND t.mensajero_id = ?';
      params.push(usuario.id);
    } else if (mensajero_id) {
      query += ' AND t.mensajero_id = ?';
      params.push(mensajero_id);
    }

    if (fecha_desde) {
      query += ' AND DATE(t.fecha_solicitud) >= ?';
      params.push(fecha_desde);
    }

    if (fecha_hasta) {
      query += ' AND DATE(t.fecha_solicitud) <= ?';
      params.push(fecha_hasta);
    }

    query += ' ORDER BY t.fecha_solicitud DESC';

    const [traslados] = await pool.query<RowDataPacket[]>(query, params);

    res.json({
      success: true,
      data: traslados
    });

  } catch (error: any) {
    logger.error('Error al obtener traslados:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener traslados',
      error: error.message
    });
  }
};

/**
 * GET /api/traslados/:id
 * Obtiene un traslado específico con su detalle
 */
export const getTrasladoById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const usuario = (req as any).usuario;

    // Obtener traslado principal
    const [traslados] = await pool.query<RowDataPacket[]>(`
      SELECT 
        t.*,
        bo.nombre as bodega_origen_nombre,
        bo.codigo as bodega_origen_codigo,
        bo.direccion as bodega_origen_direccion,
        bo.ciudad as bodega_origen_ciudad,
        bd.nombre as bodega_destino_nombre,
        bd.codigo as bodega_destino_codigo,
        bd.direccion as bodega_destino_direccion,
        bd.ciudad as bodega_destino_ciudad,
        us.nombre as usuario_solicita_nombre,
        ua.nombre as usuario_aprueba_nombre,
        ue.nombre as usuario_envia_nombre,
        ur.nombre as usuario_recibe_nombre,
        um.nombre as mensajero_nombre,
        um.email as mensajero_email,
        um.telefono as mensajero_telefono,
        e.nombre as empresa_nombre
      FROM traslados t
      LEFT JOIN bodegas bo ON t.bodega_origen_id = bo.id
      LEFT JOIN bodegas bd ON t.bodega_destino_id = bd.id
      LEFT JOIN usuarios us ON t.usuario_solicita_id = us.id
      LEFT JOIN usuarios ua ON t.usuario_aprueba_id = ua.id
      LEFT JOIN usuarios ue ON t.usuario_envia_id = ue.id
      LEFT JOIN usuarios ur ON t.usuario_recibe_id = ur.id
      LEFT JOIN usuarios um ON t.mensajero_id = um.id
      LEFT JOIN empresas e ON t.empresa_id = e.id
      WHERE t.id = ?
    `, [id]);

    if (traslados.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Traslado no encontrado'
      });
    }

    const traslado = traslados[0];

    // Validar permisos
    const esMensajero = usuario.tipo_usuario === 'mensajero';
    if (usuario.tipo_usuario === 'admin_empresa' && traslado.empresa_id != usuario.empresa_id_default) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para ver este traslado'
      });
    }

    if (esMensajero && traslado.mensajero_id != usuario.id) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para ver este traslado'
      });
    }

    // Obtener detalle de productos
    const [detalle] = await pool.query<RowDataPacket[]>(`
      SELECT 
        td.*,
        p.codigo as producto_codigo,
        p.nombre as producto_nombre,
        p.referencia as producto_referencia,
        p.descripcion as producto_descripcion,
        p.marca,
        p.unidad_medida,
        pb_origen.stock_actual as stock_origen,
        pb_destino.stock_actual as stock_destino
      FROM traslados_detalle td
      INNER JOIN productos p ON td.producto_id = p.id
      LEFT JOIN productos_bodegas pb_origen ON td.producto_id = pb_origen.producto_id 
        AND pb_origen.bodega_id = ?
      LEFT JOIN productos_bodegas pb_destino ON td.producto_id = pb_destino.producto_id 
        AND pb_destino.bodega_id = ?
      WHERE td.traslado_id = ?
      ORDER BY td.id
    `, [traslado.bodega_origen_id, traslado.bodega_destino_id, id]);

    res.json({
      success: true,
      data: {
        ...traslado,
        detalle
      }
    });

  } catch (error: any) {
    logger.error('Error al obtener traslado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener traslado',
      error: error.message
    });
  }
};

/**
 * POST /api/traslados
 * Crea un nuevo traslado
 */
export const createTraslado = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const {
      empresa_id,
      bodega_origen_id,
      bodega_destino_id,
      motivo,
      observaciones,
      destinatario_nombre,
      destinatario_documento,
      destinatario_telefono,
      destinatario_cargo,
      productos // Array de { producto_id, cantidad_solicitada }
    } = req.body;

    const usuario = (req as any).usuario;

    // Validar permisos
    if (usuario.tipo_usuario === 'admin_empresa' && empresa_id != usuario.empresa_id_default) {
      throw new Error('No tiene permisos para crear traslados en otra empresa');
    }

    // Validar que las bodegas sean diferentes
    if (bodega_origen_id === bodega_destino_id) {
      throw new Error('La bodega origen y destino deben ser diferentes');
    }

    // Validar que las bodegas pertenezcan a la empresa
    const [bodegas] = await connection.query<RowDataPacket[]>(`
      SELECT id FROM bodegas 
      WHERE id IN (?, ?) AND empresa_id = ?
    `, [bodega_origen_id, bodega_destino_id, empresa_id]);

    if (bodegas.length !== 2) {
      throw new Error('Bodegas no válidas para esta empresa');
    }

    // Validar que haya productos
    if (!productos || productos.length === 0) {
      throw new Error('Debe incluir al menos un producto');
    }

    // Generar número de traslado
    const [lastTraslado] = await connection.query<RowDataPacket[]>(`
      SELECT numero_traslado FROM traslados 
      WHERE empresa_id = ? 
      ORDER BY id DESC LIMIT 1
    `, [empresa_id]);

    let numeroTraslado;
    if (lastTraslado.length > 0) {
      const lastNumero = lastTraslado[0].numero_traslado;
      const match = lastNumero.match(/TRS-(\d{4})-(\d+)/);
      if (match) {
        const year = new Date().getFullYear();
        const lastYear = parseInt(match[1]);
        const lastSeq = parseInt(match[2]);
        
        if (year === lastYear) {
          numeroTraslado = `TRS-${year}-${String(lastSeq + 1).padStart(3, '0')}`;
        } else {
          numeroTraslado = `TRS-${year}-001`;
        }
      }
    } else {
      const year = new Date().getFullYear();
      numeroTraslado = `TRS-${year}-001`;
    }

    // Crear traslado
    const [result] = await connection.query<ResultSetHeader>(`
      INSERT INTO traslados (
        empresa_id, numero_traslado,
        bodega_origen_id, bodega_destino_id,
        motivo, observaciones,
        destinatario_nombre, destinatario_documento,
        destinatario_telefono, destinatario_cargo,
        estado, usuario_solicita_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', ?)
    `, [
      empresa_id, numeroTraslado,
      bodega_origen_id, bodega_destino_id,
      motivo, observaciones,
      destinatario_nombre, destinatario_documento,
      destinatario_telefono, destinatario_cargo,
      usuario.id
    ]);

    const trasladoId = result.insertId;

    // Insertar detalle de productos
    for (const item of productos) {
      const { producto_id, cantidad_solicitada } = item;

      // Validar stock disponible
      const [stock] = await connection.query<RowDataPacket[]>(`
        SELECT stock_disponible FROM productos_bodegas
        WHERE producto_id = ? AND bodega_id = ?
      `, [producto_id, bodega_origen_id]);

      if (stock.length === 0 || stock[0].stock_disponible < cantidad_solicitada) {
        throw new Error(`Stock insuficiente para producto ID ${producto_id}`);
      }

      await connection.query(`
        INSERT INTO traslados_detalle (
          traslado_id, producto_id, cantidad_solicitada
        ) VALUES (?, ?, ?)
      `, [trasladoId, producto_id, cantidad_solicitada]);
    }

    // Auditoría
    await connection.query(`
      INSERT INTO auditoria_logs (
        usuario_id, empresa_id, accion, modulo, tabla, registro_id
      ) VALUES (?, ?, 'crear', 'traslados', 'traslados', ?)
    `, [usuario.id, empresa_id, trasladoId]);

    await connection.commit();

    logger.info(`Traslado creado: ${numeroTraslado} (ID: ${trasladoId})`);

    res.status(201).json({
      success: true,
      message: 'Traslado creado exitosamente',
      data: {
        id: trasladoId,
        numero_traslado: numeroTraslado
      }
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al crear traslado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear traslado',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * PUT /api/traslados/:id/aprobar
 * Aprueba un traslado pendiente
 */
export const aprobarTraslado = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { productos_aprobados } = req.body; // Opcional: ajustar cantidades
    const usuario = (req as any).usuario;

    // Obtener traslado
    const [traslados] = await connection.query<RowDataPacket[]>(`
      SELECT * FROM traslados WHERE id = ?
    `, [id]);

    if (traslados.length === 0) {
      throw new Error('Traslado no encontrado');
    }

    const traslado = traslados[0];

    if (traslado.estado !== 'pendiente_aprobacion' && traslado.estado !== 'borrador') {
      throw new Error(`No se puede aprobar un traslado en estado ${traslado.estado}`);
    }

    // Actualizar cantidades aprobadas si se enviaron
    if (productos_aprobados && productos_aprobados.length > 0) {
      for (const item of productos_aprobados) {
        await connection.query(`
          UPDATE traslados_detalle
          SET cantidad_aprobada = ?
          WHERE traslado_id = ? AND producto_id = ?
        `, [item.cantidad_aprobada, id, item.producto_id]);
      }
    } else {
      // Si no se enviaron, aprobar las cantidades solicitadas
      await connection.query(`
        UPDATE traslados_detalle
        SET cantidad_aprobada = cantidad_solicitada
        WHERE traslado_id = ?
      `, [id]);
    }

    // Actualizar estado del traslado
    await connection.query(`
      UPDATE traslados
      SET estado = 'aprobado',
          fecha_aprobacion = NOW(),
          usuario_aprueba_id = ?
      WHERE id = ?
    `, [usuario.id, id]);

    // Auditoría
    await connection.query(`
      INSERT INTO auditoria_logs (
        usuario_id, empresa_id, accion, modulo, tabla, registro_id
      ) VALUES (?, ?, 'aprobar', 'traslados', 'traslados', ?)
    `, [usuario.id, traslado.empresa_id, id]);

    await connection.commit();

    logger.info(`Traslado aprobado: ${traslado.numero_traslado}`);

    res.json({
      success: true,
      message: 'Traslado aprobado exitosamente'
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al aprobar traslado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al aprobar traslado',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * PUT /api/traslados/:id/enviar
 * Despacha un traslado (sale de bodega origen)
 */
export const enviarTraslado = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { mensajero_id } = req.body;
    const usuario = (req as any).usuario;

    // Obtener traslado
    const [traslados] = await connection.query<RowDataPacket[]>(`
      SELECT * FROM traslados WHERE id = ?
    `, [id]);

    if (traslados.length === 0) {
      throw new Error('Traslado no encontrado');
    }

    const traslado = traslados[0];

    if (traslado.estado !== 'aprobado') {
      throw new Error(`Solo se pueden enviar traslados aprobados`);
    }

    // Obtener detalle
    const [detalle] = await connection.query<RowDataPacket[]>(`
      SELECT producto_id, cantidad_aprobada
      FROM traslados_detalle
      WHERE traslado_id = ?
    `, [id]);

    // Descontar stock de bodega origen (reservar)
    for (const item of detalle) {
      await connection.query(`
        UPDATE productos_bodegas
        SET stock_reservado = stock_reservado + ?
        WHERE producto_id = ? AND bodega_id = ?
      `, [item.cantidad_aprobada, item.producto_id, traslado.bodega_origen_id]);
    }

    // Actualizar traslado
    await connection.query(`
      UPDATE traslados
      SET estado = 'en_transito',
          fecha_envio = NOW(),
          usuario_envia_id = ?,
          mensajero_id = ?
      WHERE id = ?
    `, [usuario.id, mensajero_id || null, id]);

    // Auditoría
    await connection.query(`
      INSERT INTO auditoria_logs (
        usuario_id, empresa_id, accion, modulo, tabla, registro_id
      ) VALUES (?, ?, 'enviar', 'traslados', 'traslados', ?)
    `, [usuario.id, traslado.empresa_id, id]);

    await connection.commit();

    logger.info(`Traslado enviado: ${traslado.numero_traslado}`);

    res.json({
      success: true,
      message: 'Traslado enviado exitosamente'
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al enviar traslado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar traslado',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * PUT /api/traslados/:id/recibir
 * Recibe un traslado (llega a bodega destino) con firma digital
 */
export const recibirTraslado = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { 
      productos_recibidos, // Array de { producto_id, cantidad_recibida }
      observaciones_recepcion,
      firma_recepcion,
      gps_latitud,
      gps_longitud,
      dispositivo_recepcion
    } = req.body;
    const usuario = (req as any).usuario;

    // Obtener IP del request
    const ip_recepcion = req.ip || req.connection.remoteAddress;

    // Obtener traslado
    const [traslados] = await connection.query<RowDataPacket[]>(`
      SELECT * FROM traslados WHERE id = ?
    `, [id]);

    if (traslados.length === 0) {
      throw new Error('Traslado no encontrado');
    }

    const traslado = traslados[0];

    if (traslado.estado !== 'en_transito') {
      throw new Error(`Solo se pueden recibir traslados en tránsito`);
    }

    // Validar que se reciban productos
    if (!productos_recibidos || productos_recibidos.length === 0) {
      throw new Error('Debe especificar las cantidades recibidas');
    }

    // Actualizar detalle con cantidades recibidas
    let todasRecibidas = true;
    for (const item of productos_recibidos) {
      await connection.query(`
        UPDATE traslados_detalle
        SET cantidad_recibida = ?,
            diferencia = cantidad_aprobada - ?
        WHERE traslado_id = ? AND producto_id = ?
      `, [item.cantidad_recibida, item.cantidad_recibida, id, item.producto_id]);

      // Si hay diferencia, marca como parcialmente recibido
      if (item.cantidad_recibida < item.cantidad_aprobada) {
        todasRecibidas = false;
      }
    }

    // Obtener detalle completo
    const [detalle] = await connection.query<RowDataPacket[]>(`
      SELECT producto_id, cantidad_aprobada, cantidad_recibida
      FROM traslados_detalle
      WHERE traslado_id = ?
    `, [id]);

    // Mover stock
    for (const item of detalle) {
      // Quitar de stock reservado en origen
      await connection.query(`
        UPDATE productos_bodegas
        SET stock_reservado = stock_reservado - ?,
            stock_actual = stock_actual - ?
        WHERE producto_id = ? AND bodega_id = ?
      `, [item.cantidad_aprobada, item.cantidad_recibida, item.producto_id, traslado.bodega_origen_id]);

      // Agregar a stock en destino
      const [stockDestino] = await connection.query<RowDataPacket[]>(`
        SELECT id FROM productos_bodegas
        WHERE producto_id = ? AND bodega_id = ?
      `, [item.producto_id, traslado.bodega_destino_id]);

      if (stockDestino.length > 0) {
        // Ya existe, actualizar
        await connection.query(`
          UPDATE productos_bodegas
          SET stock_actual = stock_actual + ?
          WHERE producto_id = ? AND bodega_id = ?
        `, [item.cantidad_recibida, item.producto_id, traslado.bodega_destino_id]);
      } else {
        // No existe, crear
        await connection.query(`
          INSERT INTO productos_bodegas (producto_id, bodega_id, stock_actual)
          VALUES (?, ?, ?)
        `, [item.producto_id, traslado.bodega_destino_id, item.cantidad_recibida]);
      }
    }

    // Actualizar traslado
    const nuevoEstado = todasRecibidas ? 'recibido' : 'parcialmente_recibido';
    await connection.query(`
      UPDATE traslados
      SET estado = ?,
          fecha_recepcion = NOW(),
          fecha_firma = NOW(),
          usuario_recibe_id = ?,
          observaciones_recepcion = ?,
          firma_recepcion = ?,
          ip_recepcion = ?,
          gps_latitud = ?,
          gps_longitud = ?,
          dispositivo_recepcion = ?
      WHERE id = ?
    `, [
      nuevoEstado, usuario.id, observaciones_recepcion,
      firma_recepcion, ip_recepcion, gps_latitud, gps_longitud,
      dispositivo_recepcion, id
    ]);

    // Auditoría
    await connection.query(`
      INSERT INTO auditoria_logs (
        usuario_id, empresa_id, accion, modulo, tabla, registro_id
      ) VALUES (?, ?, 'recibir', 'traslados', 'traslados', ?)
    `, [usuario.id, traslado.empresa_id, id]);

    await connection.commit();

    logger.info(`Traslado recibido: ${traslado.numero_traslado} - Estado: ${nuevoEstado}`);

    res.json({
      success: true,
      message: `Traslado ${todasRecibidas ? 'recibido' : 'parcialmente recibido'} exitosamente`,
      data: {
        estado: nuevoEstado
      }
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al recibir traslado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al recibir traslado',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * PUT /api/traslados/:id/cancelar
 * Cancela un traslado
 */
export const cancelarTraslado = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { motivo_cancelacion } = req.body;
    const usuario = (req as any).usuario;

    // Obtener traslado
    const [traslados] = await connection.query<RowDataPacket[]>(`
      SELECT * FROM traslados WHERE id = ?
    `, [id]);

    if (traslados.length === 0) {
      throw new Error('Traslado no encontrado');
    }

    const traslado = traslados[0];

    if (['recibido', 'cancelado'].includes(traslado.estado)) {
      throw new Error(`No se puede cancelar un traslado ${traslado.estado}`);
    }

    // Si está en tránsito, liberar stock reservado
    if (traslado.estado === 'en_transito') {
      const [detalle] = await connection.query<RowDataPacket[]>(`
        SELECT producto_id, cantidad_aprobada
        FROM traslados_detalle
        WHERE traslado_id = ?
      `, [id]);

      for (const item of detalle) {
        await connection.query(`
          UPDATE productos_bodegas
          SET stock_reservado = stock_reservado - ?
          WHERE producto_id = ? AND bodega_id = ?
        `, [item.cantidad_aprobada, item.producto_id, traslado.bodega_origen_id]);
      }
    }

    // Actualizar traslado
    await connection.query(`
      UPDATE traslados
      SET estado = 'cancelado',
          observaciones_recepcion = CONCAT(
            COALESCE(observaciones_recepcion, ''),
            '\nCANCELADO: ',
            ?
          )
      WHERE id = ?
    `, [motivo_cancelacion || 'Sin motivo especificado', id]);

    // Auditoría
    await connection.query(`
      INSERT INTO auditoria_logs (
        usuario_id, empresa_id, accion, modulo, tabla, registro_id
      ) VALUES (?, ?, 'cancelar', 'traslados', 'traslados', ?)
    `, [usuario.id, traslado.empresa_id, id]);

    await connection.commit();

    logger.info(`Traslado cancelado: ${traslado.numero_traslado}`);

    res.json({
      success: true,
      message: 'Traslado cancelado exitosamente'
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al cancelar traslado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar traslado',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/traslados/mensajero/mis-traslados
 * Para el módulo de mensajero: lista sus traslados asignados
 */
export const getMisTrasladosMensajero = async (req: Request, res: Response) => {
  try {
    const usuario = (req as any).usuario;
    const { estado } = req.query;

    let query = `
      SELECT 
        t.*,
        bo.nombre as bodega_origen_nombre,
        bo.direccion as bodega_origen_direccion,
        bo.ciudad as bodega_origen_ciudad,
        bo.telefono as bodega_origen_telefono,
        bd.nombre as bodega_destino_nombre,
        bd.direccion as bodega_destino_direccion,
        bd.ciudad as bodega_destino_ciudad,
        bd.telefono as bodega_destino_telefono,
        (SELECT COUNT(*) FROM traslados_detalle WHERE traslado_id = t.id) as total_productos,
        (SELECT SUM(cantidad_aprobada) FROM traslados_detalle WHERE traslado_id = t.id) as total_unidades
      FROM traslados t
      INNER JOIN bodegas bo ON t.bodega_origen_id = bo.id
      INNER JOIN bodegas bd ON t.bodega_destino_id = bd.id
      WHERE t.mensajero_id = ?
    `;

    const params: any[] = [usuario.id];

    if (estado) {
      query += ' AND t.estado = ?';
      params.push(estado);
    }

    query += ' ORDER BY t.fecha_envio DESC';

    const [traslados] = await pool.query<RowDataPacket[]>(query, params);

    res.json({
      success: true,
      data: traslados
    });

  } catch (error: any) {
    logger.error('Error al obtener traslados del mensajero:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener traslados',
      error: error.message
    });
  }
};
