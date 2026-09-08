-- =============================================================
-- Fase 6 - Recibos, egresos, gastos, bancos y propinas
-- =============================================================
-- Requisitos: Fases 1 a 5 ejecutadas y sp_exigir_periodo_abierto
-- creado por la Fase 8.
-- Ejecutar en AWS despues de backup; no requiere prueba local.
-- =============================================================

USE kore_inventory;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_contabilizar_recibo_caja$$
CREATE PROCEDURE sp_contabilizar_recibo_caja(IN p_recibo_id INT)
BEGIN
  DECLARE v_empresa_id INT DEFAULT NULL;
  DECLARE v_cliente_id INT DEFAULT NULL;
  DECLARE v_fecha DATE DEFAULT NULL;
  DECLARE v_metodo VARCHAR(30) DEFAULT NULL;
  DECLARE v_valor DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_anulado TINYINT DEFAULT 0;
  DECLARE v_comprobante_id BIGINT DEFAULT NULL;
  DECLARE v_cuenta_debito_id INT DEFAULT NULL;
  DECLARE v_cuenta_clientes_id INT DEFAULT NULL;
  DECLARE v_debito DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_credito DECIMAL(18,2) DEFAULT 0.00;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SELECT empresa_id, cliente_id, fecha_recibo, metodo_pago,
         COALESCE(valor_total, 0.00), COALESCE(anulado, 0)
    INTO v_empresa_id, v_cliente_id, v_fecha, v_metodo, v_valor, v_anulado
  FROM recibos_caja WHERE id = p_recibo_id;

  IF v_empresa_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El recibo de caja no existe.';
  END IF;
  IF v_anulado = 1 OR v_valor <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El recibo esta anulado o no tiene valor valido.';
  END IF;

  SELECT
    CASE WHEN v_metodo IN ('transferencia', 'cheque', 'tarjeta_debito', 'tarjeta_credito', 'nequi', 'daviplata')
         THEN cuenta_bancos_id ELSE cuenta_caja_id END,
    cuenta_clientes_id
    INTO v_cuenta_debito_id, v_cuenta_clientes_id
  FROM configuracion_contable WHERE empresa_id = v_empresa_id;

  IF v_cuenta_debito_id IS NULL OR v_cuenta_clientes_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Faltan cuentas de caja/bancos o clientes.';
  END IF;

  CALL sp_exigir_periodo_abierto(v_empresa_id, v_fecha);
  START TRANSACTION;

  SELECT id INTO v_comprobante_id
  FROM comprobantes_contables
  WHERE empresa_id = v_empresa_id AND numero = CONCAT('RECIBO-', p_recibo_id);

  IF v_comprobante_id IS NULL THEN
    INSERT INTO comprobantes_contables
      (empresa_id, numero, tipo, fecha, estado, origen_tipo, origen_id, descripcion)
    VALUES
      (v_empresa_id, CONCAT('RECIBO-', p_recibo_id), 'recibo_caja', v_fecha,
       'borrador', 'recibo_caja', p_recibo_id, 'Contabilizacion de recibo de caja');
    SET v_comprobante_id = LAST_INSERT_ID();

    INSERT INTO movimientos_contables
      (comprobante_id, cuenta_id, debito, credito, tercero_tipo, tercero_id, descripcion)
    VALUES
      (v_comprobante_id, v_cuenta_debito_id, v_valor, 0.00, 'cliente', v_cliente_id, 'Caja o banco recibido'),
      (v_comprobante_id, v_cuenta_clientes_id, 0.00, v_valor, 'cliente', v_cliente_id, 'Aplicacion a cartera');
  END IF;

  SELECT COALESCE(SUM(debito), 0.00), COALESCE(SUM(credito), 0.00)
    INTO v_debito, v_credito
  FROM movimientos_contables WHERE comprobante_id = v_comprobante_id;

  IF v_debito <> v_credito THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El recibo no cumple partida doble.';
  END IF;

  UPDATE comprobantes_contables SET estado = 'confirmado'
  WHERE id = v_comprobante_id AND estado = 'borrador';
  COMMIT;

  SELECT v_empresa_id AS empresa_id, p_recibo_id AS recibo_id,
         v_comprobante_id AS comprobante_id, v_debito AS total_debito,
         v_credito AS total_credito, 'BALANCEADO' AS estado_contable;
END$$

DROP PROCEDURE IF EXISTS sp_contabilizar_egreso$$
CREATE PROCEDURE sp_contabilizar_egreso(IN p_egreso_id INT)
BEGIN
  DECLARE v_empresa_id INT DEFAULT NULL;
  DECLARE v_proveedor_id INT DEFAULT NULL;
  DECLARE v_fecha DATE DEFAULT NULL;
  DECLARE v_metodo VARCHAR(30) DEFAULT NULL;
  DECLARE v_valor DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_anulado TINYINT DEFAULT 0;
  DECLARE v_comprobante_id BIGINT DEFAULT NULL;
  DECLARE v_cuenta_credito_id INT DEFAULT NULL;
  DECLARE v_cuenta_proveedores_id INT DEFAULT NULL;
  DECLARE v_debito DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_credito DECIMAL(18,2) DEFAULT 0.00;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SELECT empresa_id, proveedor_id, fecha_pago, metodo_pago,
         COALESCE(valor_total, 0.00), COALESCE(anulado, 0)
    INTO v_empresa_id, v_proveedor_id, v_fecha, v_metodo, v_valor, v_anulado
  FROM comprobantes_egreso WHERE id = p_egreso_id;

  IF v_empresa_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El comprobante de egreso no existe.';
  END IF;
  IF v_anulado = 1 OR v_valor <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El egreso esta anulado o no tiene valor valido.';
  END IF;

  SELECT
    CASE WHEN v_metodo IN ('transferencia', 'cheque', 'tarjeta_debito', 'tarjeta_credito', 'nequi', 'daviplata')
         THEN cuenta_bancos_id ELSE cuenta_caja_id END,
    cuenta_proveedores_id
    INTO v_cuenta_credito_id, v_cuenta_proveedores_id
  FROM configuracion_contable WHERE empresa_id = v_empresa_id;

  IF v_cuenta_credito_id IS NULL OR v_cuenta_proveedores_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Faltan cuentas de caja/bancos o proveedores.';
  END IF;

  CALL sp_exigir_periodo_abierto(v_empresa_id, v_fecha);
  START TRANSACTION;

  SELECT id INTO v_comprobante_id
  FROM comprobantes_contables
  WHERE empresa_id = v_empresa_id AND numero = CONCAT('EGRESO-', p_egreso_id);

  IF v_comprobante_id IS NULL THEN
    INSERT INTO comprobantes_contables
      (empresa_id, numero, tipo, fecha, estado, origen_tipo, origen_id, descripcion)
    VALUES
      (v_empresa_id, CONCAT('EGRESO-', p_egreso_id), 'egreso', v_fecha,
       'borrador', 'comprobante_egreso', p_egreso_id, 'Contabilizacion de egreso');
    SET v_comprobante_id = LAST_INSERT_ID();

    INSERT INTO movimientos_contables
      (comprobante_id, cuenta_id, debito, credito, tercero_tipo, tercero_id, descripcion)
    VALUES
      (v_comprobante_id, v_cuenta_proveedores_id, v_valor, 0.00, 'proveedor', v_proveedor_id, 'Aplicacion a cuenta por pagar'),
      (v_comprobante_id, v_cuenta_credito_id, 0.00, v_valor, 'proveedor', v_proveedor_id, 'Pago desde caja o banco');
  END IF;

  SELECT COALESCE(SUM(debito), 0.00), COALESCE(SUM(credito), 0.00)
    INTO v_debito, v_credito
  FROM movimientos_contables WHERE comprobante_id = v_comprobante_id;

  IF v_debito <> v_credito THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El egreso no cumple partida doble.';
  END IF;

  UPDATE comprobantes_contables SET estado = 'confirmado'
  WHERE id = v_comprobante_id AND estado = 'borrador';
  COMMIT;

  SELECT v_empresa_id AS empresa_id, p_egreso_id AS egreso_id,
         v_comprobante_id AS comprobante_id, v_debito AS total_debito,
         v_credito AS total_credito, 'BALANCEADO' AS estado_contable;
END$$

DROP PROCEDURE IF EXISTS sp_contabilizar_gasto$$
CREATE PROCEDURE sp_contabilizar_gasto(IN p_gasto_id INT)
BEGIN
  DECLARE v_empresa_id INT DEFAULT NULL;
  DECLARE v_fecha DATE DEFAULT NULL;
  DECLARE v_metodo VARCHAR(40) DEFAULT NULL;
  DECLARE v_valor DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_estado VARCHAR(20) DEFAULT NULL;
  DECLARE v_comprobante_id BIGINT DEFAULT NULL;
  DECLARE v_cuenta_gasto_id INT DEFAULT NULL;
  DECLARE v_cuenta_pago_id INT DEFAULT NULL;
  DECLARE v_debito DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_credito DECIMAL(18,2) DEFAULT 0.00;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SELECT empresa_id, fecha, metodo_pago, COALESCE(monto, 0.00), estado
    INTO v_empresa_id, v_fecha, v_metodo, v_valor, v_estado
  FROM gastos WHERE id = p_gasto_id;

  IF v_empresa_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El gasto no existe.';
  END IF;
  IF v_estado <> 'registrado' OR v_valor <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El gasto esta anulado o no tiene valor valido.';
  END IF;

  SELECT cuenta_gastos_generales_id,
    CASE WHEN v_metodo IN ('transferencia', 'tarjeta', 'cheque', 'nequi', 'daviplata')
         THEN cuenta_bancos_id ELSE cuenta_caja_id END
    INTO v_cuenta_gasto_id, v_cuenta_pago_id
  FROM configuracion_contable WHERE empresa_id = v_empresa_id;

  IF v_cuenta_gasto_id IS NULL OR v_cuenta_pago_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Faltan cuentas de gasto o caja/bancos.';
  END IF;

  CALL sp_exigir_periodo_abierto(v_empresa_id, v_fecha);
  START TRANSACTION;

  SELECT id INTO v_comprobante_id
  FROM comprobantes_contables
  WHERE empresa_id = v_empresa_id AND numero = CONCAT('GASTO-', p_gasto_id);

  IF v_comprobante_id IS NULL THEN
    INSERT INTO comprobantes_contables
      (empresa_id, numero, tipo, fecha, estado, origen_tipo, origen_id, descripcion)
    VALUES
      (v_empresa_id, CONCAT('GASTO-', p_gasto_id), 'gasto', v_fecha,
       'borrador', 'gasto', p_gasto_id, 'Contabilizacion de gasto');
    SET v_comprobante_id = LAST_INSERT_ID();

    INSERT INTO movimientos_contables
      (comprobante_id, cuenta_id, debito, credito, descripcion)
    VALUES
      (v_comprobante_id, v_cuenta_gasto_id, v_valor, 0.00, 'Gasto general'),
      (v_comprobante_id, v_cuenta_pago_id, 0.00, v_valor, 'Pago desde caja o banco');
  END IF;

  SELECT COALESCE(SUM(debito), 0.00), COALESCE(SUM(credito), 0.00)
    INTO v_debito, v_credito
  FROM movimientos_contables WHERE comprobante_id = v_comprobante_id;

  IF v_debito <> v_credito THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El gasto no cumple partida doble.';
  END IF;

  UPDATE comprobantes_contables SET estado = 'confirmado'
  WHERE id = v_comprobante_id AND estado = 'borrador';
  COMMIT;

  SELECT v_empresa_id AS empresa_id, p_gasto_id AS gasto_id,
         v_comprobante_id AS comprobante_id, v_debito AS total_debito,
         v_credito AS total_credito, 'BALANCEADO' AS estado_contable;
END$$

DELIMITER ;

SELECT
  'fase6' AS fase,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_recibo_caja' AND routine_type = 'PROCEDURE') THEN 'OK' ELSE 'REVISAR' END AS recibos,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_egreso' AND routine_type = 'PROCEDURE') THEN 'OK' ELSE 'REVISAR' END AS egresos,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_gasto' AND routine_type = 'PROCEDURE') THEN 'OK' ELSE 'REVISAR' END AS gastos,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_exigir_periodo_abierto' AND routine_type = 'PROCEDURE') THEN 'OK' ELSE 'REVISAR' END AS guard_periodo,
  'PENDIENTE_VALIDACION_AWS' AS estado_ejecucion;
