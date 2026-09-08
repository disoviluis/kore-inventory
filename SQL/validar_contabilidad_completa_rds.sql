-- =============================================================
-- Validacion integral de contabilidad en AWS/RDS
-- =============================================================
-- Solo lectura: no crea, actualiza ni elimina datos.
-- Ejecutar despues de las migraciones de Fases 1 a 8.
-- =============================================================

USE kore_inventory;

DROP TEMPORARY TABLE IF EXISTS tmp_validacion_contabilidad;
CREATE TEMPORARY TABLE tmp_validacion_contabilidad (
  fase VARCHAR(10) NOT NULL,
  estado VARCHAR(40) NOT NULL,
  detalle VARCHAR(255) NOT NULL
);

-- Fase 1: catalogo global y planes por empresa.
INSERT INTO tmp_validacion_contabilidad (fase, estado, detalle)
SELECT
  'fase1',
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'catalogo_puc_base')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'plan_cuentas')
     AND (SELECT COUNT(*) FROM plan_cuentas WHERE empresa_id IN (29, 31, 32)) > 0
    THEN 'OK'
    ELSE 'REVISAR'
  END,
  CONCAT(
    'catalogo=', IF(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'catalogo_puc_base'), 'OK', 'FALTA'),
    ', plan_cuentas=', IF(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'plan_cuentas'), 'OK', 'FALTA')
  );

-- Fase 2: configuracion contable por empresa.
INSERT INTO tmp_validacion_contabilidad (fase, estado, detalle)
SELECT
  'fase2',
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'configuracion_contable')
     AND (SELECT COUNT(*) FROM configuracion_contable WHERE empresa_id IN (29, 31, 32)) = 3
    THEN 'OK'
    ELSE 'REVISAR'
  END,
  CONCAT('empresas_configuradas=', COALESCE((SELECT COUNT(*) FROM configuracion_contable WHERE empresa_id IN (29, 31, 32)), 0));

-- Fase 3: motor contable y balance global de comprobantes.
INSERT INTO tmp_validacion_contabilidad (fase, estado, detalle)
SELECT
  'fase3',
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'comprobantes_contables')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'movimientos_contables')
     AND NOT EXISTS (
       SELECT 1
       FROM (
         SELECT c.id
         FROM comprobantes_contables c
         LEFT JOIN movimientos_contables m ON m.comprobante_id = c.id
         GROUP BY c.id
         HAVING COUNT(m.id) < 2 OR COALESCE(SUM(m.debito), 0.00) <> COALESCE(SUM(m.credito), 0.00)
       ) AS desbalanceados
     )
    THEN 'OK'
    ELSE 'REVISAR'
  END,
  CONCAT(
    'comprobantes=', COALESCE((SELECT COUNT(*) FROM comprobantes_contables), 0),
    ', movimientos=', COALESCE((SELECT COUNT(*) FROM movimientos_contables), 0),
    ', desbalanceados=', COALESCE((
      SELECT COUNT(*) FROM (
        SELECT c.id
        FROM comprobantes_contables c
        LEFT JOIN movimientos_contables m ON m.comprobante_id = c.id
        GROUP BY c.id
        HAVING COUNT(m.id) < 2 OR COALESCE(SUM(m.debito), 0.00) <> COALESCE(SUM(m.credito), 0.00)
      ) AS pendientes
    ), 0)
  );

-- Fase 4: procedimiento y evidencia de ventas contabilizadas.
INSERT INTO tmp_validacion_contabilidad (fase, estado, detalle)
SELECT
  'fase4',
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_venta' AND routine_type = 'PROCEDURE')
     AND EXISTS (SELECT 1 FROM comprobantes_contables WHERE origen_tipo = 'venta' AND estado = 'confirmado')
    THEN 'OK'
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_venta' AND routine_type = 'PROCEDURE')
    THEN 'PENDIENTE_VALIDACION_FUNCIONAL'
    ELSE 'REVISAR'
  END,
  CONCAT('ventas_contabilizadas=', COALESCE((SELECT COUNT(*) FROM comprobantes_contables WHERE origen_tipo = 'venta' AND estado = 'confirmado'), 0));

-- Fase 5: procedimiento y dependencias de compras.
INSERT INTO tmp_validacion_contabilidad (fase, estado, detalle)
SELECT
  'fase5',
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_compra' AND routine_type = 'PROCEDURE')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'compras')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'compras_detalle')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'proveedores')
    THEN 'OK'
    ELSE 'REVISAR'
  END,
  CONCAT(
    'compras=', IF(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'compras'), 'OK', 'FALTA'),
    ', proveedores=', IF(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'proveedores'), 'OK', 'FALTA')
  );

-- Fase 5A: manufactura y produccion.
INSERT INTO tmp_validacion_contabilidad (fase, estado, detalle)
SELECT
  'fase5a',
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'ordenes_produccion')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'ordenes_produccion_consumos')
     AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_produccion' AND routine_type = 'PROCEDURE')
    THEN 'OK'
    ELSE 'REVISAR'
  END,
  CONCAT(
    'ordenes=', IF(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'ordenes_produccion'), 'OK', 'FALTA'),
    ', consumos=', IF(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'ordenes_produccion_consumos'), 'OK', 'FALTA')
  );

-- Fase 6: finanzas y guard de periodo.
INSERT INTO tmp_validacion_contabilidad (fase, estado, detalle)
SELECT
  'fase6',
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_recibo_caja' AND routine_type = 'PROCEDURE')
     AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_egreso' AND routine_type = 'PROCEDURE')
     AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_gasto' AND routine_type = 'PROCEDURE')
     AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_exigir_periodo_abierto' AND routine_type = 'PROCEDURE')
    THEN 'OK'
    ELSE 'REVISAR'
  END,
  CONCAT(
    'recibos=', IF(EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_recibo_caja'), 'OK', 'FALTA'),
    ', egresos=', IF(EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_egreso'), 'OK', 'FALTA'),
    ', gastos=', IF(EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_gasto'), 'OK', 'FALTA'),
    ', guard=', IF(EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_exigir_periodo_abierto'), 'OK', 'FALTA')
  );

-- Fase 7: libros y reportes.
INSERT INTO tmp_validacion_contabilidad (fase, estado, detalle)
SELECT
  'fase7',
  CASE WHEN (
    SELECT COUNT(*) FROM information_schema.routines
    WHERE routine_schema = DATABASE()
      AND routine_type = 'PROCEDURE'
      AND routine_name IN ('sp_libro_diario_contable', 'sp_mayor_cuenta_contable', 'sp_balance_comprobacion_contable', 'sp_estado_resultados_contable', 'sp_balance_general_contable')
  ) = 5 THEN 'OK' ELSE 'REVISAR' END,
  CONCAT('procedimientos_reportes=', (
    SELECT COUNT(*) FROM information_schema.routines
    WHERE routine_schema = DATABASE()
      AND routine_type = 'PROCEDURE'
      AND routine_name IN ('sp_libro_diario_contable', 'sp_mayor_cuenta_contable', 'sp_balance_comprobacion_contable', 'sp_estado_resultados_contable', 'sp_balance_general_contable')
  ), '/5');

-- Fase 8: periodos, auditoria, cierre y guard sin depender de triggers.
INSERT INTO tmp_validacion_contabilidad (fase, estado, detalle)
SELECT
  'fase8',
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'periodos_contables')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'auditoria_reaperturas_contables')
     AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_cerrar_periodo_contable' AND routine_type = 'PROCEDURE')
     AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_exigir_periodo_abierto' AND routine_type = 'PROCEDURE')
    THEN 'OK'
    ELSE 'REVISAR'
  END,
  CONCAT(
    'periodos=', IF(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'periodos_contables'), 'OK', 'FALTA'),
    ', auditoria=', IF(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'auditoria_reaperturas_contables'), 'OK', 'FALTA'),
    ', guard=', IF(EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_exigir_periodo_abierto'), 'OK', 'FALTA')
  );

-- Resumen por fase.
SELECT fase, estado, detalle
FROM tmp_validacion_contabilidad
ORDER BY FIELD(fase, 'fase1', 'fase2', 'fase3', 'fase4', 'fase5', 'fase5a', 'fase6', 'fase7', 'fase8');

-- Resumen general.
SELECT
  COUNT(*) AS fases_evaluadas,
  SUM(estado = 'OK') AS fases_ok,
  SUM(estado = 'REVISAR') AS fases_revisar,
  SUM(estado = 'PENDIENTE_VALIDACION_FUNCIONAL') AS fases_pendientes_funcionales,
  CASE
    WHEN SUM(estado = 'REVISAR') > 0 THEN 'REVISAR'
    WHEN SUM(estado = 'PENDIENTE_VALIDACION_FUNCIONAL') > 0 THEN 'ESTRUCTURA_OK_PENDIENTE_PRUEBAS'
    ELSE 'OK'
  END AS estado_general
FROM tmp_validacion_contabilidad;

-- Empresas y planes contables.
SELECT
  e.id AS empresa_id,
  e.nombre,
  COUNT(pc.id) AS cuentas_plan,
  CASE WHEN COUNT(pc.id) > 0 THEN 'OK' ELSE 'REVISAR' END AS estado_plan
FROM empresas e
LEFT JOIN plan_cuentas pc ON pc.empresa_id = e.id
WHERE e.id IN (29, 31, 32)
GROUP BY e.id, e.nombre
ORDER BY e.id;

-- Comprobantes y partida doble por empresa.
SELECT
  c.empresa_id,
  COUNT(DISTINCT c.id) AS comprobantes_confirmados,
  COUNT(DISTINCT CASE
    WHEN COALESCE(t.total_debito, 0.00) = COALESCE(t.total_credito, 0.00)
     AND t.movimientos >= 2 THEN c.id END) AS comprobantes_balanceados,
  COUNT(DISTINCT CASE
    WHEN COALESCE(t.total_debito, 0.00) <> COALESCE(t.total_credito, 0.00)
      OR t.movimientos < 2 THEN c.id END) AS comprobantes_revisar
FROM comprobantes_contables c
LEFT JOIN (
  SELECT comprobante_id, COUNT(*) AS movimientos,
         SUM(debito) AS total_debito, SUM(credito) AS total_credito
  FROM movimientos_contables
  GROUP BY comprobante_id
) t ON t.comprobante_id = c.id
WHERE c.estado = 'confirmado'
GROUP BY c.empresa_id
ORDER BY c.empresa_id;

-- Periodos registrados.
SELECT empresa_id, COUNT(*) AS periodos,
       SUM(estado = 'abierto') AS abiertos,
       SUM(estado = 'reabierto') AS reabiertos,
       SUM(estado = 'cerrado') AS cerrados
FROM periodos_contables
GROUP BY empresa_id
ORDER BY empresa_id;
