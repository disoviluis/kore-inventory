export const planModules = [
  'pos', 'productos', 'inventario', 'ventas', 'clientes', 'compras', 'proveedores',
  'caja', 'bancos', 'finanzas', 'contabilidad', 'reportes', 'facturacion', 'impuestos',
  'bodegas', 'traslados', 'comandas', 'cocina', 'activos', 'mantenimientos', 'repuestos',
  'inventarios_fisicos', 'ajustes_inventario', 'nomina', 'nomina_empleados', 'nomina_periodos',
  'nomina_novedades', 'nomina_metas', 'nomina_prestamos', 'nomina_prestaciones',
  'cuentas_por_cobrar', 'cuentas_por_pagar', 'cuentas_abiertas', 'usuarios', 'roles', 'mensajeros'
] as const;

function limit(value: unknown, name: string): number | null {
  if (value === null || value === '' || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name}: use un entero positivo o sin limite`);
  return parsed;
}

function flag(value: unknown): number {
  if (value === undefined || value === false || value === 0 || value === '0') return 0;
  if (value === true || value === 1 || value === '1') return 1;
  throw new Error('Caracteristica booleana no valida');
}

export function validatePlanInput(body: any) {
  const name = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const description = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';
  if (!name || name.length > 50 || description.length > 10000) throw new Error('Nombre o descripcion del plan no valido');
  const monthly = Number(body.precio_mensual);
  const annual = body.precio_anual === null || body.precio_anual === '' || body.precio_anual === undefined ? null : Number(body.precio_anual);
  if (!Number.isFinite(monthly) || monthly <= 0 || monthly > 99999999.99 ||
    (annual !== null && (!Number.isFinite(annual) || annual <= 0 || annual > 99999999.99))) throw new Error('Precios COP no validos');
  let modules = body.modulos_incluidos;
  if (typeof modules === 'string') modules = JSON.parse(modules);
  if (!Array.isArray(modules) || !modules.length || modules.some(module => typeof module !== 'string' || !(planModules as readonly string[]).includes(module))) {
    throw new Error('Seleccione modulos validos para el plan');
  }
  const support = body.soporte_nivel || 'email';
  if (!['email', 'prioritario', '24/7'].includes(support)) throw new Error('Nivel de soporte no valido');
  if (body.max_empresas !== undefined && Number(body.max_empresas) !== 1) throw new Error('La suscripcion actual se contrata por empresa; no hay paquetes multiempresa');
  if (flag(body.api_access) || flag(body.white_label)) throw new Error('API externa y marca blanca no estan implementadas como prestaciones comerciales');
  if (modules.includes('traslados') && !flag(body.multi_bodega)) throw new Error('El modulo Traslados requiere activar multi-bodega');
  const dependencies: Record<string, string[]> = { traslados: ['inventario'], inventarios_fisicos: ['inventario'],
    mantenimientos: ['activos'], repuestos: ['inventario'], comandas: ['pos'], cocina: ['comandas'] };
  for (const [module, required] of Object.entries(dependencies)) {
    if (modules.includes(module) && required.some(dependency => !modules.includes(dependency))) throw new Error(`${module} requiere incluir ${required.join(', ')}`);
  }
  if (flag(body.reportes_avanzados) && (!modules.includes('reportes') || !modules.some((module: string) => ['finanzas', 'bancos'].includes(module)))) {
    throw new Error('Reportes avanzados requiere incluir reportes y finanzas o bancos');
  }
  return {
    nombre: name, descripcion: description || null, precio_mensual: monthly.toFixed(2), precio_anual: annual === null ? null : annual.toFixed(2),
    max_empresas: 1, max_usuarios_por_empresa: limit(body.max_usuarios_por_empresa, 'Usuarios'),
    max_productos: limit(body.max_productos, 'Productos'), max_facturas_mes: limit(body.max_facturas_mes, 'Facturas'),
    modulos_incluidos: JSON.stringify([...new Set(modules)]), soporte_nivel: support,
    api_access: 0, white_label: 0, reportes_avanzados: flag(body.reportes_avanzados), multi_bodega: flag(body.multi_bodega),
    activo: body.activo === undefined ? 1 : flag(body.activo), destacado: flag(body.destacado)
  };
}