-- Contabiliza la venta real FACT-000002 de la empresa 32.
-- La factura debe existir previamente en ventas y tener sus detalles.

USE kore_inventory;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_contabilizar_factura_prueba_32$$
CREATE PROCEDURE sp_contabilizar_factura_prueba_32()
BEGIN
  DECLARE v_venta_id INT DEFAULT NULL;
  DECLARE v_empresa_id INT DEFAULT NULL;

  SELECT id, empresa_id
    INTO v_venta_id, v_empresa_id
  FROM ventas
  WHERE empresa_id = 32
    AND numero_factura = 'FACT-000002'
  ORDER BY id DESC
  LIMIT 1;

  IF v_venta_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No existe la factura FACT-000002 para la empresa 32.';
  END IF;

  CALL sp_contabilizar_venta(v_venta_id);

  SELECT
    c.empresa_id,
    c.id AS comprobante_id,
    c.numero,
    c.estado,
    c.origen_tipo,
    c.origen_id,
    COUNT(m.id) AS movimientos,
    COALESCE(SUM(m.debito), 0.00) AS total_debito,
    COALESCE(SUM(m.credito), 0.00) AS total_credito,
    CASE
      WHEN COUNT(m.id) >= 2
        AND COALESCE(SUM(m.debito), 0.00) = COALESCE(SUM(m.credito), 0.00)
      THEN 'BALANCEADO'
      ELSE 'REVISAR'
    END AS estado_contable
  FROM comprobantes_contables c
  LEFT JOIN movimientos_contables m ON m.comprobante_id = c.id
  WHERE c.empresa_id = 32
    AND c.origen_tipo = 'venta'
    AND c.origen_id = v_venta_id
  GROUP BY c.empresa_id, c.id, c.numero, c.estado, c.origen_tipo, c.origen_id;
END$$

DELIMITER ;

CALL sp_contabilizar_factura_prueba_32();
DROP PROCEDURE IF EXISTS sp_contabilizar_factura_prueba_32;
