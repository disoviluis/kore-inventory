import { Request, Response, NextFunction } from 'express';
import { query } from '../../shared/database';

type Query = (sql: string, params?: any[]) => Promise<any>;

export function requestedCompany(req: Request): number | null {
  const user = (req as any).user;
  const values = [req.params?.empresa_id, req.params?.empresaId, req.query?.empresa_id, req.query?.empresaId,
    req.body?.empresa_id, req.body?.empresaId].filter(value => value !== undefined && value !== null && value !== '');
  if (values.some(value => !Number.isSafeInteger(Number(value)) || Number(value) <= 0) || new Set(values.map(Number)).size > 1) {
    throw Object.assign(new Error('Contexto de empresa no valido'), { status: 400 });
  }
  const id = values.length ? Number(values[0]) : Number(user?.empresa_id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function assertCompanyMembership(user: any, companyId: number, tx: Query = query) {
  if (user.tipo_usuario === 'super_admin') return;
  const rows = await tx('SELECT empresa_id FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ? AND activo = 1', [user.id, companyId]);
  if (!rows.length) throw Object.assign(new Error('No tiene acceso a esta empresa'), { status: 403 });
}

export async function companySubscription(companyId: number, tx: Query = query) {
  const companies = await tx(`SELECT e.id, e.nombre, e.estado, e.plan_id, s.trial_inicio_at, s.trial_fin_at, s.trial_utilizado, s.es_nueva,
    s.trial_fin_at > UTC_TIMESTAMP() AS trial_vigente FROM empresas e
    JOIN empresas_suscripcion s ON s.empresa_id = e.id WHERE e.id = ?`, [companyId]);
  if (!companies.length) throw Object.assign(new Error('Empresa no encontrada o migracion pendiente'), { status: 404 });
  const company = companies[0];
  const licenses = await tx(`SELECT l.*, p.nombre AS plan_nombre, p.modulos_incluidos,
    p.multi_bodega, p.reportes_avanzados,
    CASE WHEN JSON_VALID(l.notas) THEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(l.notas, '$.control_comercial_version')), 0) ELSE 0 END AS controles_version,
    COALESCE(v.fin_at, DATE_ADD(l.fecha_fin, INTERVAL 1 DAY)) AS fin_at
    FROM licencias l JOIN planes p ON p.id = l.plan_id
    LEFT JOIN licencias_vigencias v ON v.licencia_id = l.id
    WHERE l.empresa_id = ? AND l.estado = 'activa' AND l.monto > 0
      AND COALESCE(v.inicio_at, l.fecha_inicio) <= UTC_TIMESTAMP()
      AND COALESCE(v.fin_at, DATE_ADD(l.fecha_fin, INTERVAL 1 DAY)) > UTC_TIMESTAMP()
    ORDER BY COALESCE(v.fin_at, DATE_ADD(l.fecha_fin, INTERVAL 1 DAY)) DESC LIMIT 1`, [companyId]);
  const paid = licenses[0] || null;
  return { empresa: company, licencia: paid, vigente: !['suspendida', 'cancelada'].includes(company.estado) &&
    (Boolean(paid) || (company.estado === 'trial' && Boolean(company.trial_vigente))) };
}

const moduleByRoute: Record<string, string[]> = {
  productos: ['productos', 'inventario'], categorias: ['productos', 'inventario'], ventas: ['ventas', 'pos'],
  inventario: ['inventario'], 'inventarios-fisicos': ['inventarios_fisicos'], clientes: ['clientes'],
  compras: ['compras'], proveedores: ['proveedores'], bodegas: ['bodegas', 'inventario'], traslados: ['traslados'],
  finanzas: ['finanzas', 'cuentas_por_cobrar', 'cuentas_por_pagar', 'caja', 'bancos'],
  cajas: ['cajas', 'caja', 'pos'], 'cuentas-abiertas': ['cuentas_abiertas', 'pos'],
  comandas: ['comandas'], activos: ['activos'], mantenimientos: ['mantenimientos'],
  repuestos: ['repuestos'], contabilidad: ['contabilidad'], nomina: ['nomina', 'nomina_empleados', 'nomina_periodos'],
  reportes: ['reportes'], facturacion: ['facturacion', 'ventas', 'pos'], impuestos: ['impuestos', 'ventas', 'pos']
};

export function moduleIncluded(serialized: unknown, route: string, legacy = false): boolean {
  if (serialized === null || serialized === undefined) return true;
  const modules = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
  if (!Array.isArray(modules)) return false;
  const legacyAliases: Record<string, string[]> = {
    'inventarios-fisicos': ['inventarios_fisicos', 'inventario'], traslados: ['traslados', 'inventario'],
    mantenimientos: ['mantenimientos', 'activos'], comandas: ['comandas', 'pos']
  };
  const names = legacy && legacyAliases[route] ? legacyAliases[route] : moduleByRoute[route];
  return !names || modules.includes('*') || names.some(name => modules.includes(name));
}

export const enforceSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) { res.status(401).json({ success: false, message: 'No autenticado' }); return; }
    if (user.tipo_usuario === 'super_admin') { next(); return; }
    const companyId = requestedCompany(req);
    if (!companyId) throw Object.assign(new Error('empresa_id requerido'), { status: 400 });
    await assertCompanyMembership(user, companyId);
    const subscription = await companySubscription(companyId);
    if (!subscription.vigente) {
      res.status(403).json({ success: false, codigo: 'LICENCIA_INACTIVA_PAGO_PENDIENTE',
        message: 'La empresa no tiene una suscripcion vigente. Seleccione un plan o contacte al administrador.',
        data: { empresa_id: companyId, url_renovacion: `/suscripcion.html?empresa_id=${companyId}`, estado: subscription.empresa.estado } });
      return;
    }
    const route = req.originalUrl.split('/')[2];
    if (subscription.licencia && !moduleIncluded(subscription.licencia.modulos_incluidos, route, Number(subscription.licencia.controles_version) < 2)) {
      res.status(403).json({ success: false, codigo: 'MODULO_NO_INCLUIDO', message: 'El modulo no esta incluido en el plan contratado' }); return;
    }
    const deniedFeature = planFeatureDenied(subscription.licencia, route, req.originalUrl);
    if (deniedFeature) { res.status(403).json({ success: false, codigo: 'CARACTERISTICA_NO_INCLUIDA', message: deniedFeature }); return; }
    (req as any).licenciaInfo = subscription;
    next();
  } catch (error: any) {
    res.status(error.status || 503).json({ success: false, message: error.status ? error.message : 'No se pudo verificar la suscripcion' });
  }
};

export function addCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export async function assertPlanQuota(tx: Query, companyId: number, resource: 'productos' | 'facturas') {
  const companies = await tx(`SELECT p.max_productos, p.max_facturas_mes FROM empresas e
    JOIN planes p ON p.id = e.plan_id WHERE e.id = ? FOR UPDATE`, [companyId]);
  if (!companies.length) throw Object.assign(new Error('Plan no disponible'), { status: 403 });
  const limit = resource === 'productos' ? companies[0].max_productos : companies[0].max_facturas_mes;
  if (limit === null || limit === undefined) return;
  let count;
  if (resource === 'productos') {
    count = await tx("SELECT COUNT(*) AS total FROM productos WHERE empresa_id = ? AND estado = 'activo'", [companyId]);
  } else {
    const clock = await tx('SELECT UTC_TIMESTAMP() AS ahora');
    const colombia = new Date(new Date(clock[0].ahora).getTime() - 5 * 3600000);
    const start = new Date(Date.UTC(colombia.getUTCFullYear(), colombia.getUTCMonth(), 1));
    const end = addCalendarMonths(start, 1);
    count = await tx('SELECT COUNT(*) AS total FROM ventas WHERE empresa_id = ? AND fecha_venta >= ? AND fecha_venta < ?', [companyId, start, end]);
  }
  if (Number(count[0].total) >= Number(limit)) throw Object.assign(new Error(`Se alcanzo el limite de ${resource} del plan contratado`), { status: 403 });
}

export function planFeatureDenied(license: any, route: string, url: string): string | null {
  if (!license) return null;
  if (license.controles_version !== undefined && Number(license.controles_version) < 2) return null;
  if (route === 'traslados' && !Number(license.multi_bodega)) return 'Los traslados requieren multi-bodega en el plan';
  if (route === 'finanzas' && /\/finanzas\/reportes\/(estado-resultados|flujo-caja)(?:[/?]|$)/.test(url) && !Number(license.reportes_avanzados)) {
    return 'Los reportes financieros avanzados no estan incluidos en el plan';
  }
  if (route === 'comandas' && /\/comandas\/tablero(?:[/?]|$)/.test(url)) {
    const modules = typeof license.modulos_incluidos === 'string' ? JSON.parse(license.modulos_incluidos) : license.modulos_incluidos;
    if (Array.isArray(modules) && !modules.includes('cocina') && !modules.includes('*')) return 'El tablero de cocina no esta incluido en el plan';
  }
  return null;
}

export async function assertWarehousePlan(tx: Query, companyId: number) {
  const companies = await tx('SELECT id FROM empresas WHERE id = ? FOR UPDATE', [companyId]);
  if (!companies.length) throw Object.assign(new Error('Empresa no encontrada'), { status: 404 });
  const subscription = await companySubscription(companyId, tx);
  if (!subscription.licencia || Number(subscription.licencia.multi_bodega) ||
    (subscription.licencia.controles_version !== undefined && Number(subscription.licencia.controles_version) < 2)) return;
  const warehouses = await tx("SELECT COUNT(*) AS total FROM bodegas WHERE empresa_id = ? AND estado = 'activa'", [companyId]);
  if (Number(warehouses[0].total) >= 1) throw Object.assign(new Error('El plan permite una sola bodega activa; contrate multi-bodega para agregar otra'), { status: 403 });
}