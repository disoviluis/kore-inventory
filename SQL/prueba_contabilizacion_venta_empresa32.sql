-- Prueba de Fase 4 para empresa 32.
-- No usar ID_DE_LA_VENTA literalmente: este script crea la venta de prueba
-- y obtiene su ID automaticamente.

USE kore_inventory;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_prueba_venta_fase4_empresa32$$
CREATE PROCEDURE sp_prueba_venta_fase4_empresa32()
BEGIN
  DECLARE v_empresa_id INT DEFAULT 32;
  DECLARE v_cliente_id INT DEFAULT NULL;
  DECLARE v_producto_id INT DEFAULT NULL;
  DECLARE v_venta_id INT DEFAULT NULL;
  DECLARE v_precio DECIMAL(15,2) DEFAULT 0.00;
  DECLARE v_costo DECIMAL(15,2) DEFAULT 0.00;
  DECLARE v_numero_factura VARCHAR(50);

  SELECT id
    INTO v_cliente_id
  FROM clientes
  WHERE empresa_id = v_empresa_id
  ORDER BY id
  LIMIT 1;

  SELECT id, precio_venta, COALESCE(precio_compra, 0.00)
    INTO v_producto_id, v_precio, v_costo
  FROM productos
  WHERE empresa_id = v_empresa_id
    AND estado = 'activo'
  ORDER BY id
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No existe un cliente para la empresa 32.';
  END IF;

  IF v_producto_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No existe un producto activo para la empresa 32.';
  END IF;

  SET v_numero_factura = CONCAT('PRUEBA-F4-32-', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'));

  START TRANSACTION;

  INSERT INTO ventas (
    empresa_id,
    numero_factura,
    cliente_id,
    fecha_venta,
    subtotal,
    descuento,
    impuesto,
    total,
    estado,
    metodo_pago,
    notas
  ) VALUES (
    v_empresa_id,
    v_numero_factura,
    v_cliente_id,
    NOW(),
    v_precio,
    0.00,
    0.00,
    v_precio,
    'pagada',
    'efectivo',
    'Prueba controlada de contabilizacion Fase 4'
  );

  SET v_venta_id = LAST_INSERT_ID();

  INSERT INTO venta_detalle (
    venta_id,
    producto_id,
    cantidad,
    precio_unitario,
    descuento,
    subtotal
  ) VALUES (
    v_venta_id,
    v_producto_id,
    1,
    v_precio,
    0.00,
    v_precio
  );

  COMMIT;

  SELECT
    v_empresa_id AS empresa_id,
    v_venta_id AS venta_id,
    v_numero_factura AS numero_factura,
    v_cliente_id AS cliente_id,
    v_producto_id AS producto_id,
    v_precio AS total_venta,
    v_costo AS costo_estimado;

  CALL sp_contabilizar_venta(v_venta_id);
END$$

DELIMITER ;

CALL sp_prueba_venta_fase4_empresa32();
DROP PROCEDURE IF EXISTS sp_prueba_venta_fase4_empresa32;

-- Validacion final del asiento generado.
SELECT
  COALESCE(MAX(c.empresa_id), 32) AS empresa_id,
  MAX(c.id) AS comprobante_id,
  MAX(c.numero) AS numero,
  MAX(c.estado) AS estado,
  COUNT(m.id) AS movimientos,
  COALESCE(SUM(m.debito), 0.00) AS total_debito,
  COALESCE(SUM(m.credito), 0.00) AS total_credito,
  CASE
    WHEN MAX(c.id) IS NULL
    THEN 'SIN_VENTA_CONTABILIZADA'
    WHEN COUNT(m.id) >= 2
      AND COALESCE(SUM(m.debito), 0.00) = COALESCE(SUM(m.credito), 0.00)
    THEN 'BALANCEADO'
    ELSE 'REVISAR'
  END AS estado_contable
FROM comprobantes_contables c
LEFT JOIN movimientos_contables m ON m.comprobante_id = c.id
WHERE c.empresa_id = 32
  AND c.origen_tipo = 'venta'
ORDER BY c.id DESC
LIMIT 1;
