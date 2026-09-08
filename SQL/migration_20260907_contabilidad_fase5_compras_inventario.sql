-- =============================================================
-- Fase 5 - Contabilizacion de compras e inventario
-- =============================================================
-- Requisitos:
-- - Fases 1, 2 y 3 ejecutadas.
-- - Tablas existentes: compras, compras_detalle, proveedores, productos.
-- - Ejecutar en AWS despues de backup; no requiere prueba local.
--
-- No recrea compras ni modifica compras historicas.
-- Para contabilizar una compra recibida:
--   CALL sp_contabilizar_compra(<compra_id>);
-- =============================================================

USE kore_inventory;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_contabilizar_compra$$
CREATE PROCEDURE sp_contabilizar_compra(IN p_compra_id INT)
BEGIN
  DECLARE v_empresa_id INT DEFAULT NULL;
  DECLARE v_proveedor_id INT DEFAULT NULL;
  DECLARE v_tipo_compra VARCHAR(20) DEFAULT NULL;
  DECLARE v_estado_compra VARCHAR(20) DEFAULT NULL;
  DECLARE v_fecha_compra DATE DEFAULT NULL;
  DECLARE v_numero_compra VARCHAR(50) DEFAULT NULL;
  DECLARE v_subtotal DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_impuestos DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_descuento DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_total DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_base DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_comprobante_id BIGINT DEFAULT NULL;
  DECLARE v_numero_comprobante VARCHAR(50) DEFAULT NULL;
  DECLARE v_cuenta_contrapartida_id INT DEFAULT NULL;
  DECLARE v_cuenta_proveedores_id INT DEFAULT NULL;
  DECLARE v_cuenta_inventario_id INT DEFAULT NULL;
  DECLARE v_cuenta_iva_id INT DEFAULT NULL;
  DECLARE v_total_debito DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_total_credito DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_movimientos INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SELECT empresa_id, proveedor_id, tipo_compra, estado, fecha_compra,
         numero_compra, COALESCE(subtotal, 0.00), COALESCE(impuestos, 0.00),
         COALESCE(descuento, 0.00), COALESCE(total, 0.00)
    INTO v_empresa_id, v_proveedor_id, v_tipo_compra, v_estado_compra,
         v_fecha_compra, v_numero_compra, v_subtotal, v_impuestos,
         v_descuento, v_total
  FROM compras
  WHERE id = p_compra_id;

  IF v_empresa_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La compra indicada no existe.';
  END IF;

  IF v_estado_compra <> 'recibida' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Solo se pueden contabilizar compras recibidas.';
  END IF;

  SET v_base = v_subtotal - v_descuento;
  SET v_numero_comprobante = CONCAT('COMPRA-', p_compra_id);

  SELECT
    CASE WHEN v_tipo_compra = 'credito' THEN cuenta_proveedores_id ELSE cuenta_caja_id END,
    cuenta_proveedores_id,
    cuenta_inventario_id,
    cuenta_iva_descontable_id
    INTO v_cuenta_contrapartida_id, v_cuenta_proveedores_id,
         v_cuenta_inventario_id, v_cuenta_iva_id
  FROM configuracion_contable
  WHERE empresa_id = v_empresa_id;

  IF v_cuenta_contrapartida_id IS NULL OR v_cuenta_inventario_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Faltan cuentas de contrapartida o inventario para la compra.';
  END IF;

  IF v_impuestos > 0 AND v_cuenta_iva_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La compra tiene impuestos, pero falta la cuenta de IVA descontable.';
  END IF;

  CALL sp_exigir_periodo_abierto(v_empresa_id, v_fecha_compra);

  START TRANSACTION;

  SELECT id INTO v_comprobante_id
  FROM comprobantes_contables
  WHERE empresa_id = v_empresa_id
    AND numero = v_numero_comprobante;

  IF v_comprobante_id IS NULL THEN
    INSERT INTO comprobantes_contables (
      empresa_id, numero, tipo, fecha, estado, origen_tipo, origen_id, descripcion
    ) VALUES (
      v_empresa_id, v_numero_comprobante, 'compra', v_fecha_compra, 'borrador',
      'compra', p_compra_id, CONCAT('Contabilizacion de compra ', v_numero_compra)
    );

    SET v_comprobante_id = LAST_INSERT_ID();

    INSERT INTO movimientos_contables
      (comprobante_id, cuenta_id, debito, credito, tercero_tipo, tercero_id, descripcion)
    VALUES
      (v_comprobante_id, v_cuenta_inventario_id, v_base, 0.00, 'proveedor', v_proveedor_id, 'Compra de inventario'),
      (v_comprobante_id, v_cuenta_contrapartida_id, 0.00, v_total, 'proveedor', v_proveedor_id, 'Pago o cuenta por pagar');

    IF v_impuestos > 0 THEN
      INSERT INTO movimientos_contables
        (comprobante_id, cuenta_id, debito, credito, tercero_tipo, tercero_id, descripcion)
      VALUES
        (v_comprobante_id, v_cuenta_iva_id, v_impuestos, 0.00, 'proveedor', v_proveedor_id, 'IVA descontable');
    END IF;
  END IF;

  SELECT COALESCE(SUM(debito), 0.00), COALESCE(SUM(credito), 0.00), COUNT(*)
    INTO v_total_debito, v_total_credito, v_movimientos
  FROM movimientos_contables
  WHERE comprobante_id = v_comprobante_id;

  IF v_movimientos < 2 OR v_total_debito <> v_total_credito THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El comprobante de compra no cumple partida doble.';
  END IF;

  UPDATE comprobantes_contables
  SET estado = 'confirmado'
  WHERE id = v_comprobante_id AND estado = 'borrador';

  COMMIT;

  SELECT v_empresa_id AS empresa_id, p_compra_id AS compra_id,
         v_comprobante_id AS comprobante_id, v_numero_comprobante AS numero_comprobante,
         v_movimientos AS movimientos, v_total_debito AS total_debito,
         v_total_credito AS total_credito, 'BALANCEADO' AS estado_contable;
END$$

DELIMITER ;

SELECT
  'fase5' AS fase,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_compra' AND routine_type = 'PROCEDURE') THEN 'OK' ELSE 'REVISAR' END AS estado_procedimiento,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'compras')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'compras_detalle')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'proveedores')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'configuracion_contable')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'comprobantes_contables')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'movimientos_contables')
    THEN 'ESTRUCTURA_LISTA' ELSE 'REVISAR_DEPENDENCIAS' END AS estado_dependencias;
