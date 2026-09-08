-- =============================================================
-- Fase 7 - Libros y reportes contables
-- =============================================================
-- Requisitos: Fases 1 a 6 ejecutadas en AWS.
-- Esta migracion crea consultas parametrizadas; no ejecuta reportes ni
-- modifica movimientos contables existentes.
-- =============================================================

USE kore_inventory;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_libro_diario_contable$$
CREATE PROCEDURE sp_libro_diario_contable(
  IN p_empresa_id INT,
  IN p_fecha_desde DATE,
  IN p_fecha_hasta DATE
)
BEGIN
  SELECT
    c.empresa_id,
    c.fecha,
    c.id AS comprobante_id,
    c.numero,
    c.tipo,
    c.estado,
    c.origen_tipo,
    c.origen_id,
    m.id AS movimiento_id,
    pc.codigo AS cuenta_codigo,
    pc.nombre AS cuenta_nombre,
    m.tercero_tipo,
    m.tercero_id,
    m.debito,
    m.credito,
    m.descripcion
  FROM comprobantes_contables c
  INNER JOIN movimientos_contables m ON m.comprobante_id = c.id
  INNER JOIN plan_cuentas pc ON pc.id = m.cuenta_id
  WHERE c.empresa_id = p_empresa_id
    AND c.estado = 'confirmado'
    AND c.fecha BETWEEN p_fecha_desde AND p_fecha_hasta
  ORDER BY c.fecha, c.id, m.id;
END$$

DROP PROCEDURE IF EXISTS sp_mayor_cuenta_contable$$
CREATE PROCEDURE sp_mayor_cuenta_contable(
  IN p_empresa_id INT,
  IN p_cuenta_id INT,
  IN p_fecha_desde DATE,
  IN p_fecha_hasta DATE
)
BEGIN
  SELECT
    c.fecha,
    c.id AS comprobante_id,
    c.numero,
    c.tipo,
    m.descripcion,
    m.debito,
    m.credito,
    SUM(m.debito - m.credito) OVER (
      ORDER BY c.fecha, c.id, m.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS saldo_movimiento
  FROM comprobantes_contables c
  INNER JOIN movimientos_contables m ON m.comprobante_id = c.id
  WHERE c.empresa_id = p_empresa_id
    AND m.cuenta_id = p_cuenta_id
    AND c.estado = 'confirmado'
    AND c.fecha BETWEEN p_fecha_desde AND p_fecha_hasta
  ORDER BY c.fecha, c.id, m.id;
END$$

DROP PROCEDURE IF EXISTS sp_balance_comprobacion_contable$$
CREATE PROCEDURE sp_balance_comprobacion_contable(
  IN p_empresa_id INT,
  IN p_fecha_desde DATE,
  IN p_fecha_hasta DATE
)
BEGIN
  SELECT
    pc.id AS cuenta_id,
    pc.codigo,
    pc.nombre,
    pc.tipo,
    pc.naturaleza,
    COALESCE(SUM(CASE WHEN c.id IS NOT NULL THEN m.debito ELSE 0.00 END), 0.00) AS total_debito,
    COALESCE(SUM(CASE WHEN c.id IS NOT NULL THEN m.credito ELSE 0.00 END), 0.00) AS total_credito,
    COALESCE(SUM(CASE WHEN c.id IS NOT NULL THEN m.debito - m.credito ELSE 0.00 END), 0.00) AS saldo,
    CASE
      WHEN COALESCE(SUM(CASE WHEN c.id IS NOT NULL THEN m.debito ELSE 0.00 END), 0.00)
        = COALESCE(SUM(CASE WHEN c.id IS NOT NULL THEN m.credito ELSE 0.00 END), 0.00)
      THEN 'SIN_MOVIMIENTO_NETO'
      ELSE 'CON_SALDO'
    END AS estado_cuenta
  FROM plan_cuentas pc
  LEFT JOIN movimientos_contables m ON m.cuenta_id = pc.id
  LEFT JOIN comprobantes_contables c
    ON c.id = m.comprobante_id
   AND c.empresa_id = p_empresa_id
   AND c.estado = 'confirmado'
   AND c.fecha BETWEEN p_fecha_desde AND p_fecha_hasta
  WHERE pc.empresa_id = p_empresa_id
  GROUP BY pc.id, pc.codigo, pc.nombre, pc.tipo, pc.naturaleza
  ORDER BY pc.codigo;
END$$

DROP PROCEDURE IF EXISTS sp_estado_resultados_contable$$
CREATE PROCEDURE sp_estado_resultados_contable(
  IN p_empresa_id INT,
  IN p_fecha_desde DATE,
  IN p_fecha_hasta DATE
)
BEGIN
  SELECT
    pc.codigo,
    pc.nombre,
    pc.tipo,
    COALESCE(SUM(
      CASE
        WHEN pc.naturaleza = 'credito' THEN m.credito - m.debito
        ELSE m.debito - m.credito
      END
    ), 0.00) AS saldo_periodo
  FROM plan_cuentas pc
  INNER JOIN movimientos_contables m ON m.cuenta_id = pc.id
  INNER JOIN comprobantes_contables c
    ON c.id = m.comprobante_id
   AND c.empresa_id = p_empresa_id
   AND c.estado = 'confirmado'
   AND c.fecha BETWEEN p_fecha_desde AND p_fecha_hasta
  WHERE pc.empresa_id = p_empresa_id
    AND pc.tipo IN ('ingreso', 'costo', 'gasto')
  GROUP BY pc.id, pc.codigo, pc.nombre, pc.tipo
  ORDER BY pc.codigo;
END$$

DROP PROCEDURE IF EXISTS sp_balance_general_contable$$
CREATE PROCEDURE sp_balance_general_contable(
  IN p_empresa_id INT,
  IN p_fecha_hasta DATE
)
BEGIN
  SELECT
    pc.codigo,
    pc.nombre,
    pc.tipo,
    pc.naturaleza,
    COALESCE(SUM(
      CASE
        WHEN pc.naturaleza = 'credito' THEN m.credito - m.debito
        ELSE m.debito - m.credito
      END
    ), 0.00) AS saldo_acumulado
  FROM plan_cuentas pc
  INNER JOIN movimientos_contables m ON m.cuenta_id = pc.id
  INNER JOIN comprobantes_contables c
    ON c.id = m.comprobante_id
   AND c.empresa_id = p_empresa_id
   AND c.estado = 'confirmado'
   AND c.fecha <= p_fecha_hasta
  WHERE pc.empresa_id = p_empresa_id
    AND pc.tipo IN ('activo', 'pasivo', 'patrimonio')
  GROUP BY pc.id, pc.codigo, pc.nombre, pc.tipo, pc.naturaleza
  ORDER BY pc.codigo;
END$$

DELIMITER ;

SELECT
  'fase7' AS fase,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_libro_diario_contable' AND routine_type = 'PROCEDURE') THEN 'OK' ELSE 'REVISAR' END AS libro_diario,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_mayor_cuenta_contable' AND routine_type = 'PROCEDURE') THEN 'OK' ELSE 'REVISAR' END AS mayor,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_balance_comprobacion_contable' AND routine_type = 'PROCEDURE') THEN 'OK' ELSE 'REVISAR' END AS balance_comprobacion,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_estado_resultados_contable' AND routine_type = 'PROCEDURE') THEN 'OK' ELSE 'REVISAR' END AS estado_resultados,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_balance_general_contable' AND routine_type = 'PROCEDURE') THEN 'OK' ELSE 'REVISAR' END AS balance_general,
  'PENDIENTE_VALIDACION_AWS' AS estado_ejecucion;
