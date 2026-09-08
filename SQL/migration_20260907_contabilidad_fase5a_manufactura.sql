-- =============================================================
-- Fase 5A - Manufactura, composicion y productos terminados
-- =============================================================
-- Requisitos:
-- - Fase 5 ejecutada y Fase 2 configurada.
-- - La empresa debe tener modulo_produccion_activo = 1.
-- - Ejecutar en AWS despues de backup; no requiere prueba local.
--
-- Esta fase no activa produccion para todas las empresas.
-- =============================================================

USE kore_inventory;

CREATE TABLE IF NOT EXISTS ordenes_produccion (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  numero VARCHAR(50) NOT NULL,
  producto_terminado_id INT NOT NULL,
  bodega_id INT NULL,
  cantidad_planificada DECIMAL(15,3) NOT NULL,
  cantidad_producida DECIMAL(15,3) NOT NULL DEFAULT 0.000,
  costo_total DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  estado ENUM('borrador','en_proceso','terminada','anulada') NOT NULL DEFAULT 'borrador',
  fecha_inicio DATE NULL,
  fecha_terminacion DATE NULL,
  usuario_id INT NULL,
  comprobante_id BIGINT NULL,
  notas VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_produccion_empresa_numero (empresa_id, numero),
  KEY idx_produccion_empresa_estado (empresa_id, estado),
  KEY idx_produccion_producto (producto_terminado_id),
  KEY idx_produccion_bodega (bodega_id),
  CONSTRAINT fk_produccion_empresa_contable FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_produccion_producto_terminado FOREIGN KEY (producto_terminado_id) REFERENCES productos(id) ON DELETE RESTRICT,
  CONSTRAINT fk_produccion_bodega FOREIGN KEY (bodega_id) REFERENCES bodegas(id) ON DELETE SET NULL,
  CONSTRAINT fk_produccion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_produccion_comprobante FOREIGN KEY (comprobante_id) REFERENCES comprobantes_contables(id) ON DELETE SET NULL,
  CONSTRAINT chk_produccion_cantidades CHECK (cantidad_planificada > 0 AND cantidad_producida >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ordenes_produccion_consumos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  orden_produccion_id BIGINT NOT NULL,
  insumo_id INT NOT NULL,
  cantidad DECIMAL(15,4) NOT NULL,
  costo_unitario DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
  subtotal DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_produccion_consumo_orden (orden_produccion_id),
  KEY idx_produccion_consumo_insumo (insumo_id),
  CONSTRAINT fk_produccion_consumo_orden FOREIGN KEY (orden_produccion_id) REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
  CONSTRAINT fk_produccion_consumo_insumo FOREIGN KEY (insumo_id) REFERENCES productos(id) ON DELETE RESTRICT,
  CONSTRAINT chk_produccion_consumo_cantidad CHECK (cantidad > 0 AND costo_unitario >= 0 AND subtotal >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_contabilizar_produccion$$
CREATE PROCEDURE sp_contabilizar_produccion(IN p_orden_id BIGINT)
BEGIN
  DECLARE v_empresa_id INT DEFAULT NULL;
  DECLARE v_estado VARCHAR(20) DEFAULT NULL;
  DECLARE v_costo_total DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_cuenta_inventario_id INT DEFAULT NULL;
  DECLARE v_produccion_activa TINYINT DEFAULT 0;
  DECLARE v_comprobante_id BIGINT DEFAULT NULL;
  DECLARE v_numero VARCHAR(50) DEFAULT NULL;
  DECLARE v_debito DECIMAL(18,2) DEFAULT 0.00;
  DECLARE v_credito DECIMAL(18,2) DEFAULT 0.00;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SELECT empresa_id, estado, costo_total, numero
    INTO v_empresa_id, v_estado, v_costo_total, v_numero
  FROM ordenes_produccion
  WHERE id = p_orden_id;

  IF v_empresa_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La orden de produccion indicada no existe.';
  END IF;

  IF v_estado <> 'terminada' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Solo se pueden contabilizar ordenes terminadas.';
  END IF;

  SELECT modulo_produccion_activo, cuenta_inventario_id
    INTO v_produccion_activa, v_cuenta_inventario_id
  FROM configuracion_contable
  WHERE empresa_id = v_empresa_id;

  IF COALESCE(v_produccion_activa, 0) <> 1 OR v_cuenta_inventario_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La empresa no tiene produccion activa o cuenta de inventario configurada.';
  END IF;

  IF v_costo_total <= 0 THEN
    SELECT COALESCE(SUM(subtotal), 0.00)
      INTO v_costo_total
    FROM ordenes_produccion_consumos
    WHERE orden_produccion_id = p_orden_id;
  END IF;

  IF v_costo_total <= 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La orden de produccion no tiene costo contable.';
  END IF;

  CALL sp_exigir_periodo_abierto(v_empresa_id, CURRENT_DATE);

  START TRANSACTION;

  SELECT id INTO v_comprobante_id
  FROM comprobantes_contables
  WHERE empresa_id = v_empresa_id
    AND numero = CONCAT('PROD-', p_orden_id);

  IF v_comprobante_id IS NULL THEN
    INSERT INTO comprobantes_contables
      (empresa_id, numero, tipo, fecha, estado, origen_tipo, origen_id, descripcion)
    VALUES
      (v_empresa_id, CONCAT('PROD-', p_orden_id), 'inventario', CURRENT_DATE,
       'borrador', 'orden_produccion', p_orden_id,
       CONCAT('Transformacion de produccion ', v_numero));

    SET v_comprobante_id = LAST_INSERT_ID();

    INSERT INTO movimientos_contables
      (comprobante_id, cuenta_id, debito, credito, descripcion)
    VALUES
      (v_comprobante_id, v_cuenta_inventario_id, v_costo_total, 0.00, 'Entrada de producto terminado'),
      (v_comprobante_id, v_cuenta_inventario_id, 0.00, v_costo_total, 'Consumo de materias primas');
  END IF;

  SELECT COALESCE(SUM(debito), 0.00), COALESCE(SUM(credito), 0.00)
    INTO v_debito, v_credito
  FROM movimientos_contables
  WHERE comprobante_id = v_comprobante_id;

  IF v_debito <> v_credito THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El comprobante de produccion no cumple partida doble.';
  END IF;

  UPDATE comprobantes_contables
  SET estado = 'confirmado'
  WHERE id = v_comprobante_id AND estado = 'borrador';

  UPDATE ordenes_produccion
  SET comprobante_id = v_comprobante_id
  WHERE id = p_orden_id;

  COMMIT;

  SELECT v_empresa_id AS empresa_id, p_orden_id AS orden_produccion_id,
         v_comprobante_id AS comprobante_id, v_debito AS total_debito,
         v_credito AS total_credito, 'BALANCEADO' AS estado_contable;
END$$

DELIMITER ;

SELECT
  'fase5a' AS fase,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'ordenes_produccion') THEN 'OK' ELSE 'REVISAR' END AS tabla_ordenes,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'ordenes_produccion_consumos') THEN 'OK' ELSE 'REVISAR' END AS tabla_consumos,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_contabilizar_produccion' AND routine_type = 'PROCEDURE') THEN 'OK' ELSE 'REVISAR' END AS estado_procedimiento,
  'PENDIENTE_VALIDACION_AWS' AS estado_ejecucion;
