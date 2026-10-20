import { createHash } from 'crypto';
import { query, withTransaction } from '../../shared/database';

export type DeletionType = 'restablecimiento_pruebas' | 'terminacion';
type Query = (sql: string, params?: any[]) => Promise<any>;

export const deletionModules = {
  ventas_pos: { label: 'Ventas y POS', tables: ['comandas', 'cuentas_abiertas', 'ventas', 'turnos_caja', 'cajas'] },
  inventario: { label: 'Inventario y traslados', tables: ['inventarios_ajustes_detalle', 'inventarios_conteo_lineas', 'inventarios_eventos', 'inventarios_resultados_rondas', 'inventarios_resultados', 'inventarios_rondas', 'inventarios_sesiones_productos', 'inventarios_sesiones_integrantes', 'inventarios_sesiones', 'inventarios_stock_snapshot', 'inventarios_fisicos_bodegas', 'inventarios_ajustes', 'inventarios_fisicos', 'inventarios_bodega_bloqueos', 'ordenes_produccion', 'repuestos_unidades_eventos', 'repuestos_unidades', 'traslados', 'producto_insumos', 'repuestos_catalogo', 'repuestos_compatibilidad', 'productos_promociones', 'productos', 'empleados_bodegas', 'usuarios_bodegas', 'bodegas', 'categorias'] },
  compras_terceros: { label: 'Compras y terceros', tables: ['clientes', 'compras', 'notas_credito_cliente', 'proveedores'] },
  activos_mantenimiento: { label: 'Activos y mantenimiento', tables: ['activos_archivos', 'activos_asignaciones', 'activos_atributos_valores', 'activos_eventos', 'repuestos_unidades_eventos', 'repuestos_unidades', 'activos', 'activos_atributos_def', 'activos_consecutivos', 'mantenimiento_ordenes', 'activos_categorias', 'activos_tipos', 'mantenimiento_consecutivos', 'mantenimiento_tipos'] },
  finanzas: { label: 'Finanzas, cartera y bancos', tables: ['comprobantes_egreso', 'conciliaciones_bancarias', 'cuentas_abiertas', 'cuentas_bancarias', 'cuentas_por_cobrar', 'cuentas_por_pagar', 'gastos', 'movimientos_bancarios', 'recibos_caja', 'recordatorios_cobranza'] },
  contabilidad: { label: 'Contabilidad e impuestos', tables: ['auditoria_reaperturas_contables', 'comprobantes_contables', 'configuracion_contable', 'empresa_perfil_contable', 'estado_parametrizacion_contable', 'impuestos', 'periodos_contables', 'plan_cuentas', 'retenciones'] },
  nomina: { label: 'Nómina', tables: ['conceptos_nomina', 'configuracion_nomina', 'empleados', 'empleados_bodegas', 'empleados_contratos', 'liquidaciones_nomina', 'metas_nomina', 'novedades_nomina', 'periodos_nomina', 'prestamos_empleados'] },
  configuracion: { label: 'Configuración y reportes', tables: ['configuracion_factura', 'empresa_configuracion', 'mesas_configuracion', 'reportes_guardados'] }
} as const;

export type DeletionModule = keyof typeof deletionModules;
const protectedForTermination: DeletionModule[] = ['ventas_pos', 'inventario', 'compras_terceros', 'finanzas', 'contabilidad', 'nomina'];
const deletionOrder: DeletionModule[] = ['finanzas', 'contabilidad', 'nomina', 'ventas_pos', 'compras_terceros', 'activos_mantenimiento', 'inventario', 'configuracion'];

const childDeletes: Array<{ module: DeletionModule; sql: string }> = [
  { module: 'ventas_pos', sql: 'DELETE ci FROM comanda_items ci JOIN comandas c ON c.id = ci.comanda_id WHERE c.empresa_id = ?' },
  { module: 'ventas_pos', sql: 'DELETE vd FROM venta_detalle vd JOIN ventas v ON v.id = vd.venta_id WHERE v.empresa_id = ?' },
  { module: 'ventas_pos', sql: 'DELETE vi FROM venta_impuestos vi JOIN ventas v ON v.id = vi.venta_id WHERE v.empresa_id = ?' },
  { module: 'ventas_pos', sql: 'DELETE vp FROM venta_pagos vp JOIN ventas v ON v.id = vp.venta_id WHERE v.empresa_id = ?' },
  { module: 'ventas_pos', sql: 'DELETE cad FROM cuenta_abierta_detalle cad JOIN cuentas_abiertas ca ON ca.id = cad.cuenta_abierta_id WHERE ca.empresa_id = ?' },
  { module: 'ventas_pos', sql: 'DELETE uc FROM usuario_caja uc JOIN cajas c ON c.id = uc.caja_id WHERE c.empresa_id = ?' },
  { module: 'ventas_pos', sql: 'DELETE gc FROM gastos_caja gc JOIN turnos_caja tc ON tc.id = gc.turno_id WHERE tc.empresa_id = ?' },
  { module: 'ventas_pos', sql: 'DELETE tt FROM turnos_caja_totales tt JOIN turnos_caja tc ON tc.id = tt.turno_id WHERE tc.empresa_id = ?' },
  { module: 'finanzas', sql: 'DELETE red FROM recibos_caja_detalle red JOIN recibos_caja rc ON rc.id = red.recibo_caja_id WHERE rc.empresa_id = ?' },
  { module: 'finanzas', sql: 'DELETE ced FROM comprobantes_egreso_detalle ced JOIN comprobantes_egreso ce ON ce.id = ced.comprobante_egreso_id WHERE ce.empresa_id = ?' },
  { module: 'contabilidad', sql: 'DELETE mc FROM movimientos_contables mc JOIN comprobantes_contables cc ON cc.id = mc.comprobante_id WHERE cc.empresa_id = ?' },
  { module: 'nomina', sql: 'DELETE lnd FROM liquidaciones_nomina_detalle lnd JOIN liquidaciones_nomina ln ON ln.id = lnd.liquidacion_id WHERE ln.empresa_id = ?' },
  { module: 'inventario', sql: 'DELETE pd FROM productos_bodegas pd JOIN productos p ON p.id = pd.producto_id WHERE p.empresa_id = ?' },
  { module: 'inventario', sql: 'DELETE im FROM inventario_movimientos im JOIN productos p ON p.id = im.producto_id WHERE p.empresa_id = ?' },
  { module: 'inventario', sql: 'DELETE td FROM traslados_detalle td JOIN traslados t ON t.id = td.traslado_id WHERE t.empresa_id = ?' },
  { module: 'inventario', sql: 'DELETE opc FROM ordenes_produccion_consumos opc JOIN ordenes_produccion op ON op.id = opc.orden_produccion_id WHERE op.empresa_id = ?' },
  { module: 'activos_mantenimiento', sql: 'DELETE mor FROM mantenimiento_ordenes_repuestos mor JOIN mantenimiento_ordenes mo ON mo.id = mor.mantenimiento_id WHERE mo.empresa_id = ?' }
];

export function validateDeletionScope(type: DeletionType, modules: unknown, syntheticConfirmed: unknown): DeletionModule[] {
  if (!Array.isArray(modules) || modules.length === 0 || modules.length > Object.keys(deletionModules).length) {
    throw Object.assign(new Error('Seleccione al menos un módulo válido'), { status: 400 });
  }
  const selected = [...new Set(modules)];
  if (selected.some(module => typeof module !== 'string' || !Object.prototype.hasOwnProperty.call(deletionModules, module))) {
    throw Object.assign(new Error('La solicitud contiene módulos no válidos'), { status: 400 });
  }
  if (type === 'restablecimiento_pruebas' && syntheticConfirmed !== true) {
    throw Object.assign(new Error('Confirme que todos los datos seleccionados son sintéticos/de prueba'), { status: 400 });
  }
  if (type === 'terminacion' && selected.some(module => protectedForTermination.includes(module as DeletionModule))) {
    throw Object.assign(new Error('La baja conserva ventas, compras, finanzas, contabilidad e información de nómina'), { status: 400 });
  }
  return selected as DeletionModule[];
}

export async function assertCompanyDataAdmin(tx: Query, user: any, companyId: number) {
  const companies = await tx('SELECT id FROM empresas WHERE id = ? FOR UPDATE', [companyId]);
  if (!companies.length) throw Object.assign(new Error('Empresa no encontrada'), { status: 404 });
  if (user.tipo_usuario === 'super_admin') return;
  const membership = await tx('SELECT empresa_id FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ? AND activo = 1', [user.id, companyId]);
  if (!membership.length) throw Object.assign(new Error('No tiene acceso a esta empresa'), { status: 403 });
  if (user.tipo_usuario === 'admin_empresa') return;
  const roles = await tx(`SELECT r.id FROM usuario_rol ur JOIN roles r ON r.id = ur.rol_id
    WHERE ur.usuario_id = ? AND ur.empresa_id = ? AND r.es_admin = 1 AND r.activo = 1`, [user.id, companyId]);
  if (!roles.length) throw Object.assign(new Error('Solo un administrador de la empresa puede gestionar esta solicitud'), { status: 403 });
}

export async function addDeletionEvent(tx: Query, requestId: number, actorId: number | null, event: string, data: unknown = null) {
  await tx('INSERT INTO solicitudes_borrado_datos_eventos (solicitud_id, actor_id, evento, datos) VALUES (?, ?, ?, ?)',
    [requestId, actorId, event, data === null ? null : JSON.stringify(data)]);
}

export async function eraseCompanyModules(tx: Query, companyId: number, modules: DeletionModule[]) {
  const selected = new Set(modules);
  const counts: Record<string, number> = {};
  for (const { module, sql } of childDeletes) {
    if (!selected.has(module)) continue;
    const result = await tx(sql, [companyId]);
    counts[`${module}:dependencias`] = (counts[`${module}:dependencias`] || 0) + Number(result.affectedRows || 0);
  }
  const deletedTables = new Set<string>();
  for (const module of deletionOrder.filter(item => selected.has(item))) {
    for (const table of deletionModules[module].tables) {
      if (deletedTables.has(table)) continue;
      const result = await tx(`DELETE FROM \`${table}\` WHERE empresa_id = ?`, [companyId]);
      counts[table] = Number(result.affectedRows || 0);
      deletedTables.add(table);
    }
  }
  return counts;
}

export function makeDeletionCertificate(data: Record<string, unknown>) {
  const certificate = {
    tipo: 'constancia_operativa_de_supresion', version: 1, emitido_at: new Date().toISOString(),
    aviso_respaldos: 'Esta constancia cubre los registros eliminados de la base operativa. No certifica la expiración de respaldos de infraestructura ni la eliminación de archivos externos; estos pueden permanecer según la rotación del proveedor.',
    ...data
  };
  const canonical = JSON.stringify(certificate);
  return { certificate, sha256: createHash('sha256').update(canonical).digest('hex') };
}

export async function executeDeletionTransaction(requestId: number, executorId: number, backupReference: string) {
  return withTransaction(async tx => {
    const requests = await tx('SELECT * FROM solicitudes_borrado_datos WHERE id = ? FOR UPDATE', [requestId]);
    const request = requests[0];
    if (!request) throw Object.assign(new Error('Solicitud no encontrada'), { status: 404 });
    if (request.estado === 'completada' && request.certificado) return { certificado: request.certificado, repetida: true };
    if (request.estado !== 'aprobada' || !request.revisada_por || !request.aprobada_empresa_por) {
      throw Object.assign(new Error('Se requieren aprobación de empresa y revisión de Super Admin'), { status: 409 });
    }
    if (!backupReference || backupReference.length > 255) throw Object.assign(new Error('Registre la referencia del respaldo previo'), { status: 400 });
    const rawModules = typeof request.modulos === 'string' ? JSON.parse(request.modulos) : request.modulos;
    const modules = validateDeletionScope(request.tipo, rawModules, Number(request.confirmo_datos_sinteticos) === 1);
    const companies = await tx('SELECT id, nombre, estado FROM empresas WHERE id = ? FOR UPDATE', [request.empresa_id]);
    if (!companies.length) throw new Error('Empresa no encontrada');
    const result = await eraseCompanyModules(tx, Number(request.empresa_id), modules);
    if (request.tipo === 'terminacion') {
      await tx("UPDATE empresas SET estado = 'cancelada', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [request.empresa_id]);
      await tx("UPDATE licencias SET estado = 'cancelada', updated_at = CURRENT_TIMESTAMP WHERE empresa_id = ? AND estado = 'activa'", [request.empresa_id]);
    }
    const retained = request.tipo === 'terminacion'
      ? ['ventas y POS', 'compras y terceros', 'finanzas, cartera y bancos', 'contabilidad e impuestos', 'nómina', 'auditoría', 'empresa, administradores, usuarios y licencias']
      : ['empresa, administradores, usuarios, licencias, aceptaciones legales y auditoría del borrado'];
    const backupNotice = 'Esta constancia cubre los registros eliminados de la base operativa. No certifica la expiración de respaldos de infraestructura ni la eliminación de archivos externos; estos pueden permanecer según la rotación del proveedor.';
    const { certificate, sha256 } = makeDeletionCertificate({
      solicitud_id: requestId, empresa_id: Number(request.empresa_id), empresa: companies[0].nombre,
      tipo: request.tipo, modulos_eliminados: modules.map(module => deletionModules[module].label),
      registros_eliminados_por_tabla: result, datos_conservados: retained, aviso_respaldos: backupNotice,
      respaldo_referencia: backupReference,
      solicitada_por: Number(request.solicitada_por), aprobada_por_empresa: Number(request.aprobada_empresa_por),
      ejecutada_por: executorId
    });
    await tx(`UPDATE solicitudes_borrado_datos SET estado = 'completada', ejecutada_por = ?, ejecutada_at = UTC_TIMESTAMP(),
      respaldo_referencia = ?, resultado = ?, certificado = ?, certificado_sha256 = ?, error_codigo = NULL WHERE id = ?`,
    [executorId, backupReference, JSON.stringify(result), JSON.stringify(certificate), sha256, requestId]);
    await addDeletionEvent(tx, requestId, executorId, 'supresion_completada', { sha256, modules, respaldo_referencia: backupReference });
    return { certificado: certificate, repetida: false };
  });
}

export async function listCompanyDataAdmins(companyId: number) {
  return query(`SELECT DISTINCT u.id, u.email FROM usuarios u JOIN usuarios_seguridad s ON s.usuario_id = u.id
    JOIN usuario_empresa ue ON ue.usuario_id = u.id AND ue.empresa_id = ? AND ue.activo = 1
    WHERE u.activo = 1 AND s.estado = 'verificado' AND (u.tipo_usuario = 'admin_empresa' OR EXISTS (
      SELECT 1 FROM usuario_rol ur JOIN roles r ON r.id = ur.rol_id
      WHERE ur.usuario_id = u.id AND ur.empresa_id = ue.empresa_id AND r.es_admin = 1 AND r.activo = 1))`, [companyId]);
}

export async function listPlatformDataAdmins() {
  return query("SELECT email FROM usuarios WHERE tipo_usuario = 'super_admin' AND activo = 1 AND email IS NOT NULL AND email <> ''");
}