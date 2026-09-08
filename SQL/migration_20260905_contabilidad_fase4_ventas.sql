-- =============================================================
-- Fase 4 - Contabilizacion de ventas y facturacion
-- =============================================================
-- Requisitos:
-- - Fases 1, 2 y 3 ejecutadas y validadas.
-- - Las tablas ventas, venta_detalle y productos existentes.
--
-- La rutina contabiliza una venta existente sin duplicarla.
-- Para contabilizar una venta real:
--   CALL sp_contabilizar_venta(<venta_id>);
-- =============================================================

USE kore_inventory;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_contabilizar_venta$$
CREATE PROCEDURE sp_contabilizar_venta(IN p_venta_id INT)
BEGIN
  DECLARE v_empresa_id INT DEFAULT NULL;
  DECLARE v_cliente_id INT DEFAULT NULL;
  DECLARE v_vendedor_id INT DEFAULT NULL;
  DECLARE v_numero_factura VARCHAR(50) DEFAULT NULL;
  DECLARE v_fecha_venta DATETIME DEFAULT NULL;
  DECLARE v_estado_venta VARCHAR(20) DEFAULT NULL;
  DECLARE v_metodo_pago VARCHAR(20) DEFAULT NULL;
  DECLARE v_subtotal DECIMAL(15,2) DEFAULT 0.00;
  DECLARE v_descuento DECIMAL(15,2) DEFAULT 0.00;
  DECLARE v_impuesto DECIMAL(15,2) DEFAULT 0.00;
  DECLARE v_total DECIMAL(15,2) DEFAULT 0.00;
  DECLARE v_base DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_costo DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_comprobante_id BIGINT DEFAULT NULL;
  DECLARE v_numero_comprobante VARCHAR(50) DEFAULT NULL;
  DECLARE v_cuenta_pago_id INT DEFAULT NULL;
  DECLARE v_cuenta_clientes_id INT DEFAULT NULL;
  DECLARE v_cuenta_ingresos_id INT DEFAULT NULL;
  DECLARE v_cuenta_iva_id INT DEFAULT NULL;
  DECLARE v_cuenta_costo_id INT DEFAULT NULL;
  DECLARE v_cuenta_inventario_id INT DEFAULT NULL;
  DECLARE v_movimientos INT DEFAULT 0;
  DECLARE v_total_debito DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_total_credito DECIMAL(18,2) DEFAULT 0.00;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SELECT
    empresa_id,
    cliente_id,
    vendedor_id,
    numero_factura,
    fecha_venta,
    estado,
    metodo_pago,
    COALESCE(subtotal, 0.00),
    COALESCE(descuento, 0.00),
    COALESCE(impuesto, 0.00),
    COALESCE(total, 0.00)
  INTO
    v_empresa_id,
    v_cliente_id,
    v_vendedor_id,
    v_numero_factura,
    v_fecha_venta,
    v_estado_venta,
    v_metodo_pago,
    v_subtotal,
    v_descuento,
    v_impuesto,
    v_total
  FROM ventas
  WHERE id = p_venta_id;

  IF v_empresa_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La venta indicada no existe.';
  END IF;

  IF v_estado_venta IN ('cancelada', 'anulada') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No se puede contabilizar una venta cancelada o anulada.';
  END IF;

  SET v_base = v_subtotal - v_descuento;
  SET v_numero_comprobante = CONCAT('VENTA-', p_venta_id);

  SELECT
    CASE
      WHEN v_metodo_pago = 'credito' THEN cuenta_clientes_id
      WHEN v_metodo_pago = 'transferencia' THEN cuenta_bancos_id
      ELSE cuenta_caja_id
    END,
    cuenta_clientes_id,
    cuenta_ingresos_ventas_id,
    cuenta_iva_generado_id,
    cuenta_costo_ventas_id,
    cuenta_inventario_id
  INTO
    v_cuenta_pago_id,
    v_cuenta_clientes_id,
    v_cuenta_ingresos_id,
    v_cuenta_iva_id,
    v_cuenta_costo_id,
    v_cuenta_inventario_id
  FROM configuracion_contable
  WHERE empresa_id = v_empresa_id;

  IF v_cuenta_pago_id IS NULL OR v_cuenta_ingresos_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Faltan cuentas de pago o ingresos en la configuracion contable de la empresa.';
  END IF;

  SELECT COALESCE(SUM(vd.cantidad * COALESCE(p.precio_compra, 0.00)), 0.00)
    INTO v_costo
  FROM venta_detalle vd
  INNER JOIN productos p ON p.id = vd.producto_id
  WHERE vd.venta_id = p_venta_id;

  IF v_costo > 0 AND (v_cuenta_costo_id IS NULL OR v_cuenta_inventario_id IS NULL) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La venta tiene costo de inventario, pero faltan las cuentas de costo o inventario.';
  END IF;

  CALL sp_exigir_periodo_abierto(v_empresa_id, DATE(v_fecha_venta));

  START TRANSACTION;

  SELECT id
    INTO v_comprobante_id
  FROM comprobantes_contables
  WHERE empresa_id = v_empresa_id
    AND numero = v_numero_comprobante;

  IF v_comprobante_id IS NULL THEN
    INSERT INTO comprobantes_contables (
      empresa_id,
      numero,
      tipo,
      fecha,
      estado,
      origen_tipo,
      origen_id,
      descripcion,
      usuario_id
    ) VALUES (
      v_empresa_id,
      v_numero_comprobante,
      'venta',
      DATE(v_fecha_venta),
      'borrador',
      'venta',
      p_venta_id,
      CONCAT('Contabilizacion de venta ', v_numero_factura),
      v_vendedor_id
    );

    SET v_comprobante_id = LAST_INSERT_ID();

    INSERT INTO movimientos_contables
      (comprobante_id, cuenta_id, debito, credito, descripcion)
    VALUES
      (v_comprobante_id, v_cuenta_pago_id, v_total, 0.00, 'Caja, banco o cartera de la venta'),
      (v_comprobante_id, v_cuenta_ingresos_id, 0.00, v_base, 'Ingreso por venta');

    IF v_impuesto > 0 THEN
      IF v_cuenta_iva_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'La venta tiene IVA, pero falta la cuenta de IVA generado.';
      END IF;

      INSERT INTO movimientos_contables
        (comprobante_id, cuenta_id, debito, credito, descripcion)
      VALUES
        (v_comprobante_id, v_cuenta_iva_id, 0.00, v_impuesto, 'IVA generado');
    END IF;

    IF v_costo > 0 THEN
      INSERT INTO movimientos_contables
        (comprobante_id, cuenta_id, debito, credito, descripcion)
      VALUES
        (v_comprobante_id, v_cuenta_costo_id, v_costo, 0.00, 'Costo de venta'),
        (v_comprobante_id, v_cuenta_inventario_id, 0.00, v_costo, 'Salida de inventario por venta');
    END IF;
  END IF;

  SELECT
    COALESCE(SUM(debito), 0.00),
    COALESCE(SUM(credito), 0.00),
    COUNT(*)
  INTO v_total_debito, v_total_credito, v_movimientos
  FROM movimientos_contables
  WHERE comprobante_id = v_comprobante_id;

  IF v_movimientos < 2 OR v_total_debito <> v_total_credito THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El comprobante de venta no cumple partida doble.';
  END IF;

  UPDATE comprobantes_contables
  SET estado = 'confirmado'
  WHERE id = v_comprobante_id
    AND estado = 'borrador';

  COMMIT;

  SELECT
    v_empresa_id AS empresa_id,
    p_venta_id AS venta_id,
    v_comprobante_id AS comprobante_id,
    v_numero_comprobante AS numero_comprobante,
    v_movimientos AS movimientos,
    v_total_debito AS total_debito,
    v_total_credito AS total_credito,
    'BALANCEADO' AS estado_contable;
END$$

DELIMITER ;

-- Comprobacion de disponibilidad de la Fase 4.
SELECT
  'fase4' AS fase,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines
      WHERE routine_schema = DATABASE()
        AND routine_name = 'sp_contabilizar_venta'
        AND routine_type = 'PROCEDURE'
    ) THEN 'OK'
    ELSE 'REVISAR'
  END AS estado_procedimiento,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'ventas')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'venta_detalle')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'productos')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'configuracion_contable')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'comprobantes_contables')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'movimientos_contables')
    THEN 'ESTRUCTURA_LISTA'
    ELSE 'REVISAR_DEPENDENCIAS'
  END AS estado_dependencias;

-- Ejemplo de uso despues de seleccionar una venta real:
-- CALL sp_contabilizar_venta(123);
