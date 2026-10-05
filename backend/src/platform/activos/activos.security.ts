import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../../shared/database';

interface UsuarioEmpresaRow extends RowDataPacket {
  id: number;
  tipo_usuario: string;
  empresa_id_default: number | null;
  membresia_id: number | null;
  membresia_activa: number | null;
}

export const resolveActivosEmpresa = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const usuario = (req as any).user;
    if (!usuario?.id) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      return;
    }

    const rawEmpresaId = req.params.empresaId
      || req.query.empresa_id
      || req.query.empresaId
      || req.body?.empresa_id
      || req.body?.empresaId;
    const empresaId = Number(rawEmpresaId);

    if (!Number.isSafeInteger(empresaId) || empresaId <= 0) {
      res.status(400).json({ success: false, message: 'empresa_id valido es requerido' });
      return;
    }

    const [empresas] = await pool.execute<UsuarioEmpresaRow[]>(
      `SELECT
        u.id,
        u.tipo_usuario,
        u.empresa_id_default,
        ue.id AS membresia_id,
        ue.activo AS membresia_activa
      FROM usuarios u
      LEFT JOIN usuario_empresa ue
        ON ue.usuario_id = u.id AND ue.empresa_id = ?
      WHERE u.id = ? AND u.activo = 1
      LIMIT 1`,
      [empresaId, usuario.id]
    );

    if (empresas.length === 0) {
      res.status(403).json({ success: false, message: 'Usuario o empresa no autorizados' });
      return;
    }

    const registro = empresas[0];
    if (registro.tipo_usuario === 'super_admin') {
      const [empresaExiste] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM empresas WHERE id = ? LIMIT 1',
        [empresaId]
      );
      if (empresaExiste.length === 0) {
        res.status(404).json({ success: false, message: 'Empresa no encontrada' });
        return;
      }
    } else {
      const tieneMembresiaActiva = registro.membresia_id !== null
        && Number(registro.membresia_activa) === 1;
      const esEmpresaPredeterminadaSinRegistro = registro.membresia_id === null
        && Number(registro.empresa_id_default) === empresaId;

      if (!tieneMembresiaActiva && !esEmpresaPredeterminadaSinRegistro) {
        res.status(403).json({ success: false, message: 'No tienes acceso a esta empresa' });
        return;
      }
    }

    (req as any).activosEmpresaId = empresaId;
    next();
  } catch (error) {
    console.error('Error al resolver empresa de activos:', error);
    res.status(500).json({ success: false, message: 'Error al validar empresa' });
  }
};

export const requireActivosPermission = (modulo: string, accion: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const usuario = (req as any).user;
      const empresaId = Number((req as any).activosEmpresaId);

      if (!usuario?.id || !Number.isSafeInteger(empresaId) || empresaId <= 0) {
        res.status(401).json({ success: false, message: 'Contexto de empresa no validado' });
        return;
      }

      if (usuario.tipo_usuario === 'super_admin' || usuario.tipo_usuario === 'admin_empresa') {
        next();
        return;
      }

      const [permisos] = await pool.execute<RowDataPacket[]>(
        `SELECT 1
        FROM usuario_rol ur
        INNER JOIN roles r ON r.id = ur.rol_id AND r.activo = 1
        INNER JOIN rol_permiso rp ON rp.rol_id = r.id
        INNER JOIN permisos p ON p.id = rp.permiso_id AND p.activo = 1
        INNER JOIN modulos m ON m.id = p.modulo_id AND m.activo = 1
        INNER JOIN acciones a ON a.id = p.accion_id AND a.activo = 1
        WHERE ur.usuario_id = ?
          AND ur.empresa_id = ?
          AND (r.empresa_id IS NULL OR r.empresa_id = ?)
          AND m.nombre = ?
          AND a.nombre = ?
        LIMIT 1`,
        [usuario.id, empresaId, empresaId, modulo, accion]
      );

      if (permisos.length === 0) {
        res.status(403).json({
          success: false,
          message: `No tienes permisos para ${accion} en ${modulo}`,
          detail: { modulo, accion, required: `${modulo}.${accion}` }
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Error al verificar permiso de activos:', error);
      res.status(500).json({ success: false, message: 'Error al verificar permisos' });
    }
  };
};
