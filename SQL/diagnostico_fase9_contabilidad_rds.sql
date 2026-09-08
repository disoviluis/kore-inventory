-- =============================================================
-- Fase 9 - Diagnostico y conciliacion previa
-- =============================================================
-- Solo lectura: no modifica datos ni crea asientos.
-- Ejecutar en AWS/RDS despues de validar las Fases 1 a 8.
-- =============================================================

USE kore_inventory;

-- 1. Resumen operativo por empresa.
SELECT
  e.id AS empresa_id,
  e.nombre,
  (SELECT COUNT(*) FROM ventas v WHERE v.empresa_id = e.id) AS ventas,
  (SELECT COALESCE(SUM(v.total), 0.00) FROM ventas v WHERE v.empresa_id = e.id AND v.estado NOT IN ('anulada', 'cancelada')) AS total_ventas,
  (SELECT COUNT(*) FROM compras c WHERE c.empresa_id = e.id) AS compras,
  (SELECT COALESCE(SUM(c.total), 0.00) FROM compras c WHERE c.empresa_id = e.id AND c.estado <> 'anulada') AS total_compras,
  (SELECT COUNT(*) FROM productos p WHERE p.empresa_id = e.id) AS productos,
  (SELECT COUNT(*) FROM clientes cl WHERE cl.empresa_id = e.id) AS clientes,
  (SELECT COUNT(*) FROM proveedores pr WHERE pr.empresa_id = e.id) AS proveedores
FROM empresas e
WHERE e.id IN (29, 31, 32)
ORDER BY e.id;

-- 2. Cobertura contable de ventas y compras.
SELECT
  e.id AS empresa_id,
  e.nombre,
  (SELECT COUNT(*) FROM ventas v WHERE v.empresa_id = e.id AND v.estado NOT IN ('anulada', 'cancelada')) AS ventas_operativas,
  (SELECT COUNT(*) FROM comprobantes_contables cc WHERE cc.empresa_id = e.id AND cc.origen_tipo = 'venta') AS ventas_contabilizadas,
  (SELECT COUNT(*) FROM compras c WHERE c.empresa_id = e.id AND c.estado <> 'anulada') AS compras_operativas,
  (SELECT COUNT(*) FROM comprobantes_contables cc WHERE cc.empresa_id = e.id AND cc.origen_tipo = 'compra') AS compras_contabilizadas,
  CASE
    WHEN (SELECT COUNT(*) FROM ventas v WHERE v.empresa_id = e.id AND v.estado NOT IN ('anulada', 'cancelada'))
       = (SELECT COUNT(*) FROM comprobantes_contables cc WHERE cc.empresa_id = e.id AND cc.origen_tipo = 'venta')
    THEN 'VENTAS_CONCILIADAS'
    ELSE 'REVISAR_VENTAS'
  END AS estado_ventas,
  CASE
    WHEN (SELECT COUNT(*) FROM compras c WHERE c.empresa_id = e.id AND c.estado <> 'anulada')
       = (SELECT COUNT(*) FROM comprobantes_contables cc WHERE cc.empresa_id = e.id AND cc.origen_tipo = 'compra')
    THEN 'COMPRAS_CONCILIADAS'
    ELSE 'PENDIENTE_CONTABILIZAR_COMPRAS'
  END AS estado_compras
FROM empresas e
WHERE e.id IN (29, 31, 32)
ORDER BY e.id;

-- 3. Comprobantes por origen y estado.
SELECT
  empresa_id,
  origen_tipo,
  estado,
  COUNT(*) AS cantidad,
  COALESCE(SUM(m.total_debito), 0.00) AS total_debito,
  COALESCE(SUM(m.total_credito), 0.00) AS total_credito
FROM comprobantes_contables c
LEFT JOIN (
  SELECT comprobante_id, SUM(debito) AS total_debito, SUM(credito) AS total_credito
  FROM movimientos_contables
  GROUP BY comprobante_id
) m ON m.comprobante_id = c.id
GROUP BY empresa_id, origen_tipo, estado
ORDER BY empresa_id, origen_tipo, estado;

-- 4. Compras de credito pendientes de cuenta por pagar.
SELECT
  c.empresa_id,
  COUNT(*) AS compras_credito,
  COALESCE(SUM(c.total), 0.00) AS valor_compras_credito,
  SUM(CASE WHEN cxp.id IS NULL THEN 1 ELSE 0 END) AS sin_cuenta_por_pagar
FROM compras c
LEFT JOIN cuentas_por_pagar cxp ON cxp.compra_id = c.id
WHERE c.tipo_compra = 'credito'
  AND c.estado <> 'anulada'
GROUP BY c.empresa_id
ORDER BY c.empresa_id;

-- 5. Ventas a credito pendientes de cuenta por cobrar.
SELECT
  v.empresa_id,
  COUNT(*) AS ventas_credito,
  COALESCE(SUM(v.total), 0.00) AS valor_ventas_credito,
  SUM(CASE WHEN cxc.id IS NULL THEN 1 ELSE 0 END) AS sin_cuenta_por_cobrar
FROM ventas v
LEFT JOIN cuentas_por_cobrar cxc ON cxc.venta_id = v.id
WHERE v.forma_pago = 'credito'
  AND v.estado NOT IN ('anulada', 'cancelada')
GROUP BY v.empresa_id
ORDER BY v.empresa_id;

-- 6. Campos antiguos de cuentas en productos que requieren mapeo.
SELECT
  p.empresa_id,
  COUNT(*) AS productos,
  SUM(CASE WHEN NULLIF(TRIM(p.cuenta_ingreso), '') IS NOT NULL THEN 1 ELSE 0 END) AS con_cuenta_ingreso_texto,
  SUM(CASE WHEN NULLIF(TRIM(p.cuenta_costo), '') IS NOT NULL THEN 1 ELSE 0 END) AS con_cuenta_costo_texto,
  SUM(CASE WHEN NULLIF(TRIM(p.cuenta_inventario), '') IS NOT NULL THEN 1 ELSE 0 END) AS con_cuenta_inventario_texto,
  SUM(CASE WHEN NULLIF(TRIM(p.cuenta_gasto), '') IS NOT NULL THEN 1 ELSE 0 END) AS con_cuenta_gasto_texto
FROM productos p
WHERE p.empresa_id IN (29, 31, 32)
GROUP BY p.empresa_id
ORDER BY p.empresa_id;

-- 7. Diferencias de partida doble y duplicados por origen.
SELECT
  c.empresa_id,
  c.origen_tipo,
  c.origen_id,
  COUNT(*) AS comprobantes_mismo_origen
FROM comprobantes_contables c
WHERE c.origen_tipo IS NOT NULL
GROUP BY c.empresa_id, c.origen_tipo, c.origen_id
HAVING COUNT(*) > 1
ORDER BY c.empresa_id, c.origen_tipo, c.origen_id;

-- 8. Resultado final del diagnostico: no recomienda migrar si hay diferencias.
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM comprobantes_contables c
      LEFT JOIN movimientos_contables m ON m.comprobante_id = c.id
      WHERE c.estado = 'confirmado'
      GROUP BY c.id
      HAVING COUNT(m.id) < 2 OR SUM(m.debito) <> SUM(m.credito)
    ) THEN 'REVISAR_COMPROBANTES'
    WHEN EXISTS (
      SELECT 1
      FROM comprobantes_contables c
      WHERE c.origen_tipo IS NOT NULL
      GROUP BY c.empresa_id, c.origen_tipo, c.origen_id
      HAVING COUNT(*) > 1
    ) THEN 'REVISAR_DUPLICADOS'
    ELSE 'DIAGNOSTICO_ESTRUCTURAL_OK'
  END AS estado_diagnostico,
  'PENDIENTE_APROBACION_CONTADOR' AS siguiente_paso;

-- =============================================================
-- RESUMEN FINAL CONSOLIDADO
-- =============================================================
-- Estas consultas se dejan al final para revisar todo el diagnostico
-- en un solo bloque de resultados.

SELECT '01_ESTADO_GENERAL' AS bloque,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM comprobantes_contables c
      LEFT JOIN movimientos_contables m ON m.comprobante_id = c.id
      WHERE c.estado = 'confirmado'
      GROUP BY c.id
      HAVING COUNT(m.id) < 2 OR COALESCE(SUM(m.debito), 0.00) <> COALESCE(SUM(m.credito), 0.00)
    ) THEN 'REVISAR_COMPROBANTES'
    WHEN EXISTS (
      SELECT 1
      FROM comprobantes_contables c
      WHERE c.origen_tipo IS NOT NULL
      GROUP BY c.empresa_id, c.origen_tipo, c.origen_id
      HAVING COUNT(*) > 1
    ) THEN 'REVISAR_DUPLICADOS'
    ELSE 'DIAGNOSTICO_ESTRUCTURAL_OK'
  END AS estado,
  'PENDIENTE_APROBACION_CONTADOR' AS siguiente_paso;

SELECT '02_FASES' AS bloque, fase, estado, detalle
FROM (
  SELECT 'fase1' AS fase,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'catalogo_puc_base')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'plan_cuentas') THEN 'OK' ELSE 'REVISAR' END AS estado,
    'catalogo_puc_base y plan_cuentas' AS detalle
  UNION ALL SELECT 'fase2',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'configuracion_contable')
       AND (SELECT COUNT(*) FROM configuracion_contable WHERE empresa_id IN (29, 31, 32)) = 3 THEN 'OK' ELSE 'REVISAR' END,
    CONCAT('empresas_configuradas=', COALESCE((SELECT COUNT(*) FROM configuracion_contable WHERE empresa_id IN (29, 31, 32)), 0))
  UNION ALL SELECT 'fase3',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'comprobantes_contables')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'movimientos_contables') THEN 'OK' ELSE 'REVISAR' END,
    CONCAT('comprobantes=', (SELECT COUNT(*) FROM comprobantes_contables), ', movimientos=', (SELECT COUNT(*) FROM movimientos_contables))
  UNION ALL SELECT 'fase4',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_venta') THEN 'OK' ELSE 'REVISAR' END,
    CONCAT('ventas_contabilizadas=', (SELECT COUNT(*) FROM comprobantes_contables WHERE origen_tipo = 'venta' AND estado = 'confirmado'))
  UNION ALL SELECT 'fase5',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_compra') THEN 'OK' ELSE 'REVISAR' END,
    'sp_contabilizar_compra'
  UNION ALL SELECT 'fase5a',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'ordenes_produccion')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'ordenes_produccion_consumos') THEN 'OK' ELSE 'REVISAR' END,
    'ordenes_produccion y ordenes_produccion_consumos'
  UNION ALL SELECT 'fase6',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_recibo_caja')
       AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_egreso')
       AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_gasto') THEN 'OK' ELSE 'REVISAR' END,
    'recibos, egresos y gastos'
  UNION ALL SELECT 'fase7',
    CASE WHEN (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name IN ('sp_libro_diario_contable', 'sp_mayor_cuenta_contable', 'sp_balance_comprobacion_contable', 'sp_estado_resultados_contable', 'sp_balance_general_contable')) = 5 THEN 'OK' ELSE 'REVISAR' END,
    '5 procedimientos de reportes'
  UNION ALL SELECT 'fase8',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'periodos_contables')
       AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_exigir_periodo_abierto') THEN 'OK' ELSE 'REVISAR' END,
    'periodos_contables y guard de periodo'
) fases
ORDER BY FIELD(fase, 'fase1', 'fase2', 'fase3', 'fase4', 'fase5', 'fase5a', 'fase6', 'fase7', 'fase8');

SELECT '03_EMPRESAS_PLAN' AS bloque,
  e.id AS empresa_id, e.nombre, COUNT(pc.id) AS cuentas_plan,
  CASE WHEN COUNT(pc.id) > 0 THEN 'OK' ELSE 'REVISAR' END AS estado_plan
FROM empresas e
LEFT JOIN plan_cuentas pc ON pc.empresa_id = e.id
WHERE e.id IN (29, 31, 32)
GROUP BY e.id, e.nombre
ORDER BY e.id;

SELECT '04_COBERTURA_OPERATIVA' AS bloque,
  e.id AS empresa_id, e.nombre,
  (SELECT COUNT(*) FROM ventas v WHERE v.empresa_id = e.id AND v.estado NOT IN ('anulada', 'cancelada')) AS ventas,
  (SELECT COUNT(*) FROM comprobantes_contables c WHERE c.empresa_id = e.id AND c.origen_tipo = 'venta' AND c.estado = 'confirmado') AS ventas_contabilizadas,
  (SELECT COUNT(*) FROM compras c WHERE c.empresa_id = e.id AND c.estado <> 'anulada') AS compras,
  (SELECT COUNT(*) FROM comprobantes_contables c WHERE c.empresa_id = e.id AND c.origen_tipo = 'compra' AND c.estado = 'confirmado') AS compras_contabilizadas
FROM empresas e
WHERE e.id IN (29, 31, 32)
ORDER BY e.id;

SELECT '05_CARTERA' AS bloque, 'CUENTAS_POR_PAGAR' AS tipo,
  e.id AS empresa_id, COUNT(cxp.id) AS documentos, COALESCE(SUM(cxp.saldo_pendiente), 0.00) AS saldo
FROM empresas e
LEFT JOIN cuentas_por_pagar cxp
  ON cxp.empresa_id = e.id AND cxp.estado NOT IN ('pagada', 'anulada')
WHERE e.id IN (29, 31, 32)
GROUP BY e.id
UNION ALL
SELECT '05_CARTERA', 'CUENTAS_POR_COBRAR',
  e.id, COUNT(cxc.id), COALESCE(SUM(cxc.saldo_pendiente), 0.00)
FROM empresas e
LEFT JOIN cuentas_por_cobrar cxc
  ON cxc.empresa_id = e.id AND cxc.estado NOT IN ('pagada', 'anulada')
WHERE e.id IN (29, 31, 32)
GROUP BY e.id
ORDER BY empresa_id, tipo;

SELECT '05B_CARTERA_ESTADO' AS bloque,
  CASE WHEN EXISTS (SELECT 1 FROM cuentas_por_pagar WHERE estado NOT IN ('pagada', 'anulada'))
    THEN 'CON_SALDOS_PENDIENTES' ELSE 'SIN_SALDOS_PENDIENTES' END AS cuentas_por_pagar,
  CASE WHEN EXISTS (SELECT 1 FROM cuentas_por_cobrar WHERE estado NOT IN ('pagada', 'anulada'))
    THEN 'CON_SALDOS_PENDIENTES' ELSE 'SIN_SALDOS_PENDIENTES' END AS cuentas_por_cobrar;

/*
SELECT '05_CARTERA_ANTERIOR' AS bloque, 'CUENTAS_POR_PAGAR' AS tipo,
  empresa_id, COUNT(*) AS documentos, COALESCE(SUM(saldo_pendiente), 0.00) AS saldo
FROM cuentas_por_pagar
WHERE estado NOT IN ('pagada', 'anulada')
GROUP BY empresa_id
UNION ALL
SELECT '05_CARTERA', 'CUENTAS_POR_COBRAR',
  empresa_id, COUNT(*), COALESCE(SUM(saldo_pendiente), 0.00)
FROM cuentas_por_cobrar
WHERE estado NOT IN ('pagada', 'anulada')
GROUP BY empresa_id
ORDER BY empresa_id, tipo;
*/

SELECT '06_MAPEOS_ANTIGUOS' AS bloque,
  p.empresa_id,
  COUNT(*) AS productos,
  SUM(NULLIF(TRIM(p.cuenta_ingreso), '') IS NOT NULL) AS cuenta_ingreso_texto,
  SUM(NULLIF(TRIM(p.cuenta_costo), '') IS NOT NULL) AS cuenta_costo_texto,
  SUM(NULLIF(TRIM(p.cuenta_inventario), '') IS NOT NULL) AS cuenta_inventario_texto,
  SUM(NULLIF(TRIM(p.cuenta_gasto), '') IS NOT NULL) AS cuenta_gasto_texto
FROM productos p
WHERE p.empresa_id IN (29, 31, 32)
GROUP BY p.empresa_id
ORDER BY p.empresa_id;

SELECT '07_COMPROBANTES_REVISAR' AS bloque,
  c.empresa_id, c.id AS comprobante_id, c.numero, c.origen_tipo, c.origen_id,
  COUNT(m.id) AS movimientos,
  COALESCE(SUM(m.debito), 0.00) AS total_debito,
  COALESCE(SUM(m.credito), 0.00) AS total_credito
FROM comprobantes_contables c
LEFT JOIN movimientos_contables m ON m.comprobante_id = c.id
WHERE c.estado = 'confirmado'
GROUP BY c.empresa_id, c.id, c.numero, c.origen_tipo, c.origen_id
HAVING COUNT(m.id) < 2 OR COALESCE(SUM(m.debito), 0.00) <> COALESCE(SUM(m.credito), 0.00)
ORDER BY c.empresa_id, c.id;

SELECT '07B_COMPROBANTES_ESTADO' AS bloque,
  CASE WHEN EXISTS (
    SELECT 1
    FROM comprobantes_contables c
    LEFT JOIN movimientos_contables m ON m.comprobante_id = c.id
    WHERE c.estado = 'confirmado'
    GROUP BY c.id
    HAVING COUNT(m.id) < 2 OR COALESCE(SUM(m.debito), 0.00) <> COALESCE(SUM(m.credito), 0.00)
  ) THEN 'HAY_COMPROBANTES_REVISAR' ELSE 'SIN_COMPROBANTES_REVISAR' END AS estado;

SELECT '08_DUPLICADOS_ORIGEN' AS bloque,
  empresa_id, origen_tipo, origen_id, COUNT(*) AS comprobantes_mismo_origen
FROM comprobantes_contables
WHERE origen_tipo IS NOT NULL
GROUP BY empresa_id, origen_tipo, origen_id
HAVING COUNT(*) > 1
ORDER BY empresa_id, origen_tipo, origen_id;

SELECT '08B_DUPLICADOS_ESTADO' AS bloque,
  CASE WHEN EXISTS (
    SELECT 1 FROM comprobantes_contables
    WHERE origen_tipo IS NOT NULL
    GROUP BY empresa_id, origen_tipo, origen_id
    HAVING COUNT(*) > 1
  ) THEN 'HAY_DUPLICADOS' ELSE 'SIN_DUPLICADOS' END AS estado;

SELECT '09_PERIODOS' AS bloque,
  e.id AS empresa_id, COUNT(pc.id) AS periodos,
  COALESCE(SUM(pc.estado = 'abierto'), 0) AS abiertos,
  COALESCE(SUM(pc.estado = 'reabierto'), 0) AS reabiertos,
  COALESCE(SUM(pc.estado = 'cerrado'), 0) AS cerrados
FROM empresas e
LEFT JOIN periodos_contables pc ON pc.empresa_id = e.id
WHERE e.id IN (29, 31, 32)
GROUP BY e.id
ORDER BY e.id;

SELECT '09B_PERIODOS_ESTADO' AS bloque,
  CASE WHEN EXISTS (SELECT 1 FROM periodos_contables)
    THEN 'PERIODOS_REGISTRADOS' ELSE 'SIN_PERIODOS_REGISTRADOS' END AS estado;
