import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../../shared/database';
import logger from '../../shared/logger';

/**
 * POST /api/super-admin/licencias/procesar-notificaciones
 * Procesa notificaciones de licencias próximas a vencer
 * Llamado por cron diario
 */
export const procesarNotificaciones = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    // Obtener licencias que vencen en 7, 3 y 1 día
    const [licenciasPorVencer] = await connection.query<RowDataPacket[]>(`
      SELECT 
        l.id as licencia_id,
        l.empresa_id,
        e.nombre as empresa_nombre,
        e.email as empresa_email,
        l.fecha_fin,
        DATEDIFF(l.fecha_fin, CURDATE()) as dias_restantes,
        p.nombre as plan_nombre,
        l.monto,
        l.auto_renovacion
      FROM licencias l
      INNER JOIN empresas e ON l.empresa_id = e.id
      INNER JOIN planes p ON l.plan_id = p.id
      WHERE l.estado = 'activa'
        AND DATEDIFF(l.fecha_fin, CURDATE()) IN (7, 3, 1)
      ORDER BY l.fecha_fin ASC
    `);

    const notificaciones = [];

    for (const licencia of licenciasPorVencer) {
      // Registrar evento de notificación
      await connection.query(`
        INSERT INTO licencias_eventos (
          empresa_id, licencia_id, evento, descripcion, datos
        ) VALUES (?, ?, 'notificacion_vencimiento', ?, ?)
      `, [
        licencia.empresa_id,
        licencia.licencia_id,
        `Licencia vence en ${licencia.dias_restantes} día(s)`,
        JSON.stringify({
          dias_restantes: licencia.dias_restantes,
          fecha_fin: licencia.fecha_fin,
          auto_renovacion: licencia.auto_renovacion
        })
      ]);

      notificaciones.push({
        empresa_id: licencia.empresa_id,
        empresa_nombre: licencia.empresa_nombre,
        empresa_email: licencia.empresa_email,
        dias_restantes: licencia.dias_restantes,
        fecha_fin: licencia.fecha_fin,
        plan: licencia.plan_nombre,
        monto: licencia.monto,
        auto_renovacion: licencia.auto_renovacion
      });

      logger.info(`Notificación enviada: Empresa ${licencia.empresa_nombre} - ${licencia.dias_restantes} días restantes`);
    }

    // TODO: Aquí se integraría el servicio de email para enviar las notificaciones
    // await emailService.enviarNotificacionLicencia(notificaciones);

    res.json({
      success: true,
      message: `${notificaciones.length} notificaciones procesadas`,
      data: {
        total: notificaciones.length,
        notificaciones
      }
    });

  } catch (error: any) {
    logger.error('Error al procesar notificaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar notificaciones',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * POST /api/super-admin/licencias/procesar-renovaciones
 * Procesa renovaciones automáticas de licencias
 * Llamado por cron diario
 */
export const procesarRenovaciones = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    // Obtener licencias con auto-renovación que vencen HOY
    const [licenciasARenovar] = await connection.query<RowDataPacket[]>(`
      SELECT 
        l.id as licencia_id,
        l.empresa_id,
        e.nombre as empresa_nombre,
        l.plan_id,
        p.nombre as plan_nombre,
        l.tipo_facturacion,
        l.monto,
        l.fecha_fin,
        e.metodo_pago_default,
        e.datos_pago
      FROM licencias l
      INNER JOIN empresas e ON l.empresa_id = e.id
      INNER JOIN planes p ON l.plan_id = p.id
      WHERE l.estado = 'activa'
        AND l.auto_renovacion = 1
        AND DATE(l.fecha_fin) = CURDATE()
        AND e.estado = 'activa'
    `);

    const renovaciones: {
      exitosas: any[];
      fallidas: any[];
    } = {
      exitosas: [],
      fallidas: []
    };

    for (const licencia of licenciasARenovar) {
      try {
        await connection.beginTransaction();

        // TODO: Aquí se integraría la pasarela de pago para procesar el cobro
        // const pagoExitoso = await pasarelaPago.procesarCobro({
        //   monto: licencia.monto,
        //   metodo: licencia.metodo_pago_default,
        //   datos: licencia.datos_pago
        // });

        // Simulación: por ahora asumimos pago exitoso
        const pagoExitoso = true;

        if (pagoExitoso) {
          // Calcular nueva fecha de fin
          const nuevaFechaFin = new Date(licencia.fecha_fin);
          if (licencia.tipo_facturacion === 'mensual') {
            nuevaFechaFin.setMonth(nuevaFechaFin.getMonth() + 1);
          } else {
            nuevaFechaFin.setFullYear(nuevaFechaFin.getFullYear() + 1);
          }

          // Renovar licencia (actualizar fecha_fin)
          await connection.query(`
            UPDATE licencias
            SET fecha_fin = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [nuevaFechaFin, licencia.licencia_id]);

          // Registrar pago de renovación
          await connection.query(`
            INSERT INTO pagos_licencias (
              licencia_id, empresa_id, plan_id,
              monto, moneda, tipo, metodo_pago, estado,
              referencia_pago, datos_pago,
              periodo_inicio, periodo_fin, fecha_pago,
              descripcion
            ) VALUES (?, ?, ?, ?, 'COP', ?, 'auto', 'exitoso', ?, NULL, ?, ?, NOW(), ?)
          `, [
            licencia.licencia_id,
            licencia.empresa_id,
            licencia.plan_id,
            licencia.monto,
            licencia.tipo_facturacion,
            `RENOV-${Date.now()}`, // Referencia simulada
            new Date(licencia.fecha_fin),
            nuevaFechaFin,
            `Renovación automática ${licencia.tipo_facturacion} - ${licencia.plan_nombre}`
          ]);

          // Registrar evento
          await connection.query(`
            INSERT INTO licencias_eventos (
              empresa_id, licencia_id, evento, descripcion, datos
            ) VALUES (?, ?, 'renovacion_exitosa', ?, ?)
          `, [
            licencia.empresa_id,
            licencia.licencia_id,
            `Renovación automática exitosa - Plan ${licencia.plan_nombre}`,
            JSON.stringify({
              fecha_anterior: licencia.fecha_fin,
              nueva_fecha: nuevaFechaFin,
              monto: licencia.monto
            })
          ]);

          await connection.commit();

          renovaciones.exitosas.push({
            empresa_id: licencia.empresa_id,
            empresa: licencia.empresa_nombre,
            plan: licencia.plan_nombre,
            monto: licencia.monto,
            nueva_fecha_fin: nuevaFechaFin
          });

          logger.info(`Renovación exitosa: ${licencia.empresa_nombre} - ${licencia.plan_nombre}`);

        } else {
          throw new Error('Pago rechazado por pasarela');
        }

      } catch (error: any) {
        await connection.rollback();

        // Marcar licencia como vencida si el pago falló
        await connection.query(`
          UPDATE licencias
          SET estado = 'vencida', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [licencia.licencia_id]);

        // Registrar evento de fallo
        await connection.query(`
          INSERT INTO licencias_eventos (
            empresa_id, licencia_id, evento, descripcion, datos
          ) VALUES (?, ?, 'renovacion_fallida', ?, ?)
        `, [
          licencia.empresa_id,
          licencia.licencia_id,
          'Renovación automática falló - Pago rechazado',
          JSON.stringify({ error: error.message })
        ]);

        renovaciones.fallidas.push({
          empresa_id: licencia.empresa_id,
          empresa: licencia.empresa_nombre,
          plan: licencia.plan_nombre,
          error: error.message
        });

        logger.error(`Renovación fallida: ${licencia.empresa_nombre} - ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: `Renovaciones procesadas: ${renovaciones.exitosas.length} exitosas, ${renovaciones.fallidas.length} fallidas`,
      data: renovaciones
    });

  } catch (error: any) {
    logger.error('Error al procesar renovaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar renovaciones',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/super-admin/licencias/estado
 * Obtiene el estado general de licencias en el sistema
 */
export const getEstadoLicencias = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const [estadisticas] = await connection.query<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN estado = 'activa' THEN 1 ELSE 0 END) as activas,
        SUM(CASE WHEN estado = 'vencida' THEN 1 ELSE 0 END) as vencidas,
        SUM(CASE WHEN estado = 'suspendida' THEN 1 ELSE 0 END) as suspendidas,
        SUM(CASE WHEN estado = 'cancelada' THEN 1 ELSE 0 END) as canceladas,
        SUM(CASE WHEN DATEDIFF(fecha_fin, CURDATE()) <= 7 AND estado = 'activa' THEN 1 ELSE 0 END) as proximas_vencer,
        SUM(CASE WHEN auto_renovacion = 1 AND estado = 'activa' THEN 1 ELSE 0 END) as con_auto_renovacion
      FROM licencias
    `);

    res.json({
      success: true,
      data: estadisticas[0]
    });

  } catch (error: any) {
    logger.error('Error al obtener estado de licencias:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estado de licencias',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/super-admin/licencias/:id/historial
 * Obtiene el historial de pagos y eventos de una licencia
 */
export const getHistorialLicencia = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const { id } = req.params;

    // Obtener información de la licencia
    const [licencias] = await connection.query<RowDataPacket[]>(`
      SELECT 
        l.*,
        e.nombre as empresa_nombre,
        p.nombre as plan_nombre
      FROM licencias l
      INNER JOIN empresas e ON l.empresa_id = e.id
      INNER JOIN planes p ON l.plan_id = p.id
      WHERE l.id = ?
    `, [id]);

    if (licencias.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Licencia no encontrada'
      });
    }

    // Obtener historial de pagos
    const [pagos] = await connection.query<RowDataPacket[]>(`
      SELECT * FROM pagos_licencias
      WHERE licencia_id = ?
      ORDER BY fecha_pago DESC
    `, [id]);

    // Obtener historial de eventos
    const [eventos] = await connection.query<RowDataPacket[]>(`
      SELECT * FROM licencias_eventos
      WHERE licencia_id = ?
      ORDER BY fecha DESC
    `, [id]);

    res.json({
      success: true,
      data: {
        licencia: licencias[0],
        pagos,
        eventos
      }
    });

  } catch (error: any) {
    logger.error('Error al obtener historial de licencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial',
      error: error.message
    });
  } finally {
    connection.release();
  }
};
