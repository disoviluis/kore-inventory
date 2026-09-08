-- Prueba de Fase 3 para empresa 32 (manufactura)
-- Crea un comprobante de prueba idempotente:
--   Debito: cuenta de inventario
--   Credito: cuenta de proveedores
-- No modifica comprobantes existentes con otro numero.

USE kore_inventory;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_prueba_fase3_empresa32$$
CREATE PROCEDURE sp_prueba_fase3_empresa32()
BEGIN
  DECLARE v_empresa_id INT DEFAULT 32;
  DECLARE v_numero VARCHAR(50) DEFAULT 'PRUEBA-FASE3-32-001';
  DECLARE v_comprobante_id BIGINT DEFAULT NULL;
  DECLARE v_cuenta_inventario_id INT DEFAULT NULL;
  DECLARE v_cuenta_proveedores_id INT DEFAULT NULL;
  DECLARE v_total_debito DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_total_credito DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_total_movimientos INT DEFAULT 0;

  SELECT cuenta_inventario_id, cuenta_proveedores_id
    INTO v_cuenta_inventario_id, v_cuenta_proveedores_id
  FROM configuracion_contable
  WHERE empresa_id = v_empresa_id;

  IF v_cuenta_inventario_id IS NULL OR v_cuenta_proveedores_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La empresa 32 no tiene cuentas de inventario y/o proveedores configuradas.';
  END IF;

  START TRANSACTION;

  INSERT INTO comprobantes_contables (
    empresa_id,
    numero,
    tipo,
    fecha,
    estado,
    origen_tipo,
    descripcion
  )
  SELECT
    v_empresa_id,
    v_numero,
    'inventario',
    CURRENT_DATE,
    'borrador',
    'prueba_fase3',
    'Prueba de partida doble para empresa 32'
  WHERE NOT EXISTS (
    SELECT 1
    FROM comprobantes_contables
    WHERE empresa_id = v_empresa_id
      AND numero = v_numero
  );

  SELECT id
    INTO v_comprobante_id
  FROM comprobantes_contables
  WHERE empresa_id = v_empresa_id
    AND numero = v_numero;

  INSERT INTO movimientos_contables (
    comprobante_id,
    cuenta_id,
    debito,
    credito,
    descripcion
  )
  SELECT v_comprobante_id, v_cuenta_inventario_id, 100000.00, 0.00,
         'Inventario de prueba'
  WHERE NOT EXISTS (
    SELECT 1
    FROM movimientos_contables
    WHERE comprobante_id = v_comprobante_id
  );

  INSERT INTO movimientos_contables (
    comprobante_id,
    cuenta_id,
    debito,
    credito,
    descripcion
  )
  SELECT v_comprobante_id, v_cuenta_proveedores_id, 0.00, 100000.00,
         'Contrapartida proveedor de prueba'
  WHERE NOT EXISTS (
    SELECT 1
    FROM movimientos_contables
    WHERE comprobante_id = v_comprobante_id
      AND cuenta_id = v_cuenta_proveedores_id
  );

  SELECT
    COALESCE(SUM(debito), 0.00),
    COALESCE(SUM(credito), 0.00),
    COUNT(*)
    INTO v_total_debito, v_total_credito, v_total_movimientos
  FROM movimientos_contables
  WHERE comprobante_id = v_comprobante_id;

  IF v_total_movimientos < 2 OR v_total_debito <> v_total_credito THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La prueba de empresa 32 no quedo balanceada; se revirtieron los cambios.';
  END IF;

  UPDATE comprobantes_contables
  SET estado = 'confirmado'
  WHERE id = v_comprobante_id;

  COMMIT;

  SELECT
    'empresa_32' AS prueba,
    v_comprobante_id AS comprobante_id,
    v_numero AS numero,
    v_total_movimientos AS movimientos,
    v_total_debito AS total_debito,
    v_total_credito AS total_credito,
    'BALANCEADO' AS resultado;
END$$

DELIMITER ;

CALL sp_prueba_fase3_empresa32();
DROP PROCEDURE IF EXISTS sp_prueba_fase3_empresa32;

-- Validacion final del comprobante de prueba.
SELECT
  c.empresa_id,
  c.id AS comprobante_id,
  c.numero,
  c.estado,
  COUNT(m.id) AS movimientos,
  COALESCE(SUM(m.debito), 0.00) AS total_debito,
  COALESCE(SUM(m.credito), 0.00) AS total_credito,
  CASE
    WHEN COUNT(m.id) >= 2
      AND COALESCE(SUM(m.debito), 0.00) = COALESCE(SUM(m.credito), 0.00)
    THEN 'BALANCEADO'
    ELSE 'REVISAR'
  END AS estado_prueba
FROM comprobantes_contables c
LEFT JOIN movimientos_contables m ON m.comprobante_id = c.id
WHERE c.empresa_id = 32
  AND c.numero = 'PRUEBA-FASE3-32-001'
GROUP BY c.empresa_id, c.id, c.numero, c.estado;
