import { Request, Response } from 'express';
import { query, withTransaction } from '../../shared/database';
import { validatePlanInput, planModules } from './planes.rules';

export const getPlanModuleCatalog = async (_req: Request, res: Response) => {
  const modules = await query('SELECT nombre, nombre_mostrar FROM modulos WHERE activo = 1');
  const names = new Map(modules.map((module: any) => [module.nombre, module.nombre_mostrar]));
  return res.json({ success: true, data: planModules.map(code => ({ codigo: code,
    nombre: names.get(code) || code.replace(/_/g, ' ').replace(/^./, initial => initial.toUpperCase()) })) });
};

async function savePlan(req: Request, res: Response, updating: boolean) {
  try {
    const plan = validatePlanInput(req.body);
    const id = await withTransaction(async tx => {
      let planId = updating ? Number(req.params.id) : 0;
      if (updating) {
        if (!Number.isSafeInteger(planId) || planId <= 0) throw new Error('Plan no valido');
        const rows = await tx('SELECT * FROM planes WHERE id = ? FOR UPDATE', [planId]);
        if (!rows.length) throw Object.assign(new Error('Plan no encontrado'), { status: 404 });
        const current = rows[0];
        const contracts = await tx(`SELECT l.id FROM licencias l LEFT JOIN licencias_vigencias v ON v.licencia_id = l.id
          WHERE l.plan_id = ? AND l.estado = 'activa' AND l.monto > 0
            AND COALESCE(v.fin_at, DATE_ADD(l.fecha_fin, INTERVAL 1 DAY)) > UTC_TIMESTAMP() LIMIT 1`, [planId]);
        const fields = ['max_usuarios_por_empresa', 'max_productos', 'max_facturas_mes', 'multi_bodega', 'reportes_avanzados', 'soporte_nivel'];
        let currentModules = current.modulos_incluidos;
        if (typeof currentModules === 'string') currentModules = JSON.parse(currentModules);
        const newModules = JSON.parse(plan.modulos_incluidos);
        const sameModules = Array.isArray(currentModules) && [...currentModules].sort().join('|') === newModules.sort().join('|');
        if (contracts.length && (!sameModules || fields.some(field => String(current[field] ?? '') !== String((plan as any)[field] ?? '')))) {
          throw Object.assign(new Error('El plan tiene periodos pagados vigentes. Dupliquelo para crear nuevas condiciones sin alterar lo contratado.'), { status: 409 });
        }
        const columns = Object.keys(plan);
        await tx(`UPDATE planes SET ${columns.map(column => `${column} = ?`).join(', ')}, updated_at = UTC_TIMESTAMP() WHERE id = ?`, [...Object.values(plan), planId]);
      } else {
        const columns = Object.keys(plan);
        const result = await tx(`INSERT INTO planes (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, Object.values(plan));
        planId = result.insertId;
      }
      await tx(`INSERT INTO auditoria_logs (usuario_id, accion, tabla, registro_id, modulo)
        VALUES (?, ?, 'planes', ?, 'super-admin')`, [(req as any).user.id, updating ? 'actualizar' : 'crear', planId]);
      return planId;
    });
    return res.status(updating ? 200 : 201).json({ success: true, message: updating ? 'Plan actualizado' : 'Plan creado', data: { id } });
  } catch (error: any) {
    return res.status(error.status || (error.code ? 503 : 400)).json({ success: false,
      message: error.code ? 'No se pudo guardar el plan' : error.message || 'Plan no valido' });
  }
}

export const createValidatedPlan = (req: Request, res: Response) => savePlan(req, res, false);
export const updateValidatedPlan = (req: Request, res: Response) => savePlan(req, res, true);