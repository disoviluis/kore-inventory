-- =============================================================
-- Validacion funcional Fases 6 y 8 - Empresa 32
-- =============================================================
-- Ejecutar solamente en AWS/RDS.
-- Requisitos:
--   - migration_20260907_contabilidad_fase8_cierres.sql ejecutada.
--   - migration_20260907_contabilidad_fase6_finanzas.sql ejecutada.
--   - migration_20260907_contabilidad_fase5_compras_inventario.sql ejecutada.
--
-- Flujo:
--   1. Encuentra la compra recibida pendiente de empresa 32.
--   2. Abre el periodo correspondiente a la fecha de compra.
--   3. Contabiliza la compra.
--   4. Cierra el periodo.
--   5. Reabre el periodo con motivo auditado.
--
-- No se ejecuta localmente.
-- =============================================================

USE kore_inventory;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_validar_fase6_fase8_empresa32$$
CREATE PROCEDURE sp_validar_fase6_fase8_empresa32()
BEGIN
  DECLARE v_compra_id INT DEFAULT NULL;
  DECLARE v_empresa_id INT DEFAULT NULL;
  DECLARE v_fecha_compra DATE DEFAULT NULL;
  DECLARE v_estado_compra VARCHAR(20) DEFAULT NULL;
  DECLARE v_anio SMALLINT DEFAULT NULL;
  DECLARE v_mes TINYINT DEFAULT NULL;
  DECLARE v_periodo_id INT DEFAULT NULL;
  DECLARE v_estado_periodo VARCHAR(20) DEFAULT NULL;
  DECLARE v_comprobante_id BIGINT DEFAULT NULL;
  DECLARE v_total_debito DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_total_credito DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_movimientos INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SELECT c.id, c.empresa_id, c.fecha_compra, c.estado
    INTO v_compra_id, v_empresa_id, v_fecha_compra, v_estado_compra
  FROM compras c
  LEFT JOIN comprobantes_contables cc
    ON cc.empresa_id = c.empresa_id
   AND cc.origen_tipo = 'compra'
   AND cc.origen_id = c.id
  WHERE c.empresa_id = 32
    AND c.estado = 'recibida'
    AND cc.id IS NULL
  ORDER BY c.fecha_compra, c.id
  LIMIT 1;

  IF v_compra_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No existe una compra recibida pendiente para la empresa 32.';
  END IF;

  IF v_estado_compra <> 'recibida' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La compra seleccionada no esta recibida.';
  END IF;

  SET v_anio = YEAR(v_fecha_compra);
  SET v_mes = MONTH(v_fecha_compra);

  SELECT id, estado
    INTO v_periodo_id, v_estado_periodo
  FROM periodos_contables
  WHERE empresa_id = v_empresa_id
    AND anio = v_anio
    AND mes = v_mes;

  IF v_periodo_id IS NULL THEN
    CALL sp_abrir_periodo_contable(v_empresa_id, v_anio, v_mes, NULL);
    SELECT id, estado
      INTO v_periodo_id, v_estado_periodo
    FROM periodos_contables
    WHERE empresa_id = v_empresa_id
      AND anio = v_anio
      AND mes = v_mes;
  ELSEIF v_estado_periodo = 'cerrado' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El periodo de la compra ya esta cerrado; no se modifica automaticamente.';
  END IF;

  CALL sp_contabilizar_compra(v_compra_id);

  SELECT cc.id
    INTO v_comprobante_id
  FROM comprobantes_contables cc
  WHERE cc.empresa_id = v_empresa_id
    AND cc.origen_tipo = 'compra'
    AND cc.origen_id = v_compra_id;

  SELECT COALESCE(SUM(m.debito), 0.00),
         COALESCE(SUM(m.credito), 0.00),
         COUNT(m.id)
    INTO v_total_debito, v_total_credito, v_movimientos
  FROM movimientos_contables m
  WHERE m.comprobante_id = v_comprobante_id;

  IF v_movimientos < 2 OR v_total_debito <> v_total_credito THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La compra contabilizada no quedo balanceada.';
  END IF;

  CALL sp_cerrar_periodo_contable(
    v_periodo_id,
    NULL,
    'Validacion funcional de cierre Fase 8 para empresa 32'
  );

  CALL sp_reabrir_periodo_contable(
    v_periodo_id,
    NULL,
    'Validacion funcional de reapertura Fase 8 para empresa 32'
  );

  SELECT
    'fase6_fase8' AS prueba,
    v_empresa_id AS empresa_id,
    v_compra_id AS compra_id,
    v_periodo_id AS periodo_id,
    v_comprobante_id AS comprobante_id,
    v_movimientos AS movimientos_compra,
    v_total_debito AS total_debito,
    v_total_credito AS total_credito,
    'BALANCEADO' AS estado_compra,
    'REABIERTO' AS estado_periodo_final,
    CASE
      WHEN v_total_debito = v_total_credito THEN 'OK'
      ELSE 'REVISAR'
    END AS resultado_final;
END$$

DELIMITER ;

CALL sp_validar_fase6_fase8_empresa32();
DROP PROCEDURE IF EXISTS sp_validar_fase6_fase8_empresa32;

-- Verificacion final persistente.
SELECT
  p.empresa_id,
  p.anio,
  p.mes,
  p.estado AS estado_periodo,
  a.id AS reapertura_auditoria_id,
  a.motivo,
  cc.id AS comprobante_compra_id,
  cc.estado AS estado_comprobante,
  COALESCE(SUM(m.debito), 0.00) AS total_debito,
  COALESCE(SUM(m.credito), 0.00) AS total_credito,
  CASE
    WHEN cc.estado = 'confirmado'
     AND COALESCE(SUM(m.debito), 0.00) = COALESCE(SUM(m.credito), 0.00)
     AND p.estado = 'reabierto'
    THEN 'OK'
    ELSE 'REVISAR'
  END AS validacion_final
FROM periodos_contables p
LEFT JOIN auditoria_reaperturas_contables a ON a.periodo_id = p.id
LEFT JOIN comprobantes_contables cc
  ON cc.empresa_id = p.empresa_id
 AND cc.origen_tipo = 'compra'
 AND cc.origen_id = (
   SELECT c.id
   FROM compras c
   WHERE c.empresa_id = p.empresa_id
     AND c.estado = 'recibida'
   ORDER BY c.id DESC
   LIMIT 1
 )
LEFT JOIN movimientos_contables m ON m.comprobante_id = cc.id
WHERE p.empresa_id = 32
GROUP BY p.id, p.empresa_id, p.anio, p.mes, p.estado,
         a.id, a.motivo, cc.id, cc.estado
ORDER BY p.id DESC
LIMIT 1;
