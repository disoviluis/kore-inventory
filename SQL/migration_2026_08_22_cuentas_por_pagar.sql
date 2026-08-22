-- Modulo Finanzas - Cuentas por Pagar
-- Ejecutar sobre kore_inventory despues de realizar un backup.

CREATE TABLE IF NOT EXISTS cuentas_por_pagar (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  proveedor_id INT NOT NULL,
  compra_id INT NOT NULL,
  numero_documento VARCHAR(50) NOT NULL,
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  valor_original DECIMAL(15,2) NOT NULL,
  valor_pagado DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  saldo_pendiente DECIMAL(15,2) NOT NULL,
  estado ENUM('vigente','vencida','pagada','anulada') NOT NULL DEFAULT 'vigente',
  notas TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_cxp_compra (compra_id),
  KEY idx_cxp_empresa_estado (empresa_id, estado),
  KEY idx_cxp_proveedor (proveedor_id),
  KEY idx_cxp_vencimiento (fecha_vencimiento),
  CONSTRAINT fk_cxp_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_cxp_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cxp_compra FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comprobantes_egreso (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  proveedor_id INT NOT NULL,
  numero_comprobante VARCHAR(50) NOT NULL,
  fecha_pago DATE NOT NULL,
  valor_total DECIMAL(15,2) NOT NULL,
  metodo_pago ENUM('efectivo','transferencia','cheque','tarjeta_debito','tarjeta_credito','nequi','daviplata','otro') NOT NULL,
  referencia VARCHAR(100) NULL,
  observaciones TEXT NULL,
  usuario_id INT NOT NULL,
  anulado TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_egreso_numero (empresa_id, numero_comprobante),
  KEY idx_egreso_proveedor (proveedor_id),
  KEY idx_egreso_fecha (fecha_pago),
  CONSTRAINT fk_egreso_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_egreso_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE RESTRICT,
  CONSTRAINT fk_egreso_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comprobantes_egreso_detalle (
  id INT AUTO_INCREMENT PRIMARY KEY,
  comprobante_egreso_id INT NOT NULL,
  cuenta_por_pagar_id INT NOT NULL,
  valor_aplicado DECIMAL(15,2) NOT NULL,
  saldo_anterior DECIMAL(15,2) NOT NULL,
  saldo_nuevo DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_egreso_detalle_comprobante (comprobante_egreso_id),
  KEY idx_egreso_detalle_cxp (cuenta_por_pagar_id),
  CONSTRAINT fk_egreso_detalle_comprobante FOREIGN KEY (comprobante_egreso_id) REFERENCES comprobantes_egreso(id) ON DELETE RESTRICT,
  CONSTRAINT fk_egreso_detalle_cxp FOREIGN KEY (cuenta_por_pagar_id) REFERENCES cuentas_por_pagar(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$
DROP TRIGGER IF EXISTS after_compra_insert_crear_cxp$$
CREATE TRIGGER after_compra_insert_crear_cxp
AFTER INSERT ON compras
FOR EACH ROW
BEGIN
  IF NEW.tipo_compra = 'credito' THEN
    INSERT INTO cuentas_por_pagar (
      empresa_id, proveedor_id, compra_id, numero_documento, fecha_emision,
      fecha_vencimiento, valor_original, saldo_pendiente, estado
    )
    SELECT NEW.empresa_id, NEW.proveedor_id, NEW.id, NEW.numero_compra, NEW.fecha_compra,
      DATE_ADD(NEW.fecha_compra, INTERVAL COALESCE(NULLIF(p.dias_credito, 0), 30) DAY),
      NEW.total, NEW.total,
      CASE WHEN DATE_ADD(NEW.fecha_compra, INTERVAL COALESCE(NULLIF(p.dias_credito, 0), 30) DAY) < CURDATE()
        THEN 'vencida' ELSE 'vigente' END
    FROM proveedores p
    WHERE p.id = NEW.proveedor_id AND p.empresa_id = NEW.empresa_id;
  END IF;
END$$

DROP TRIGGER IF EXISTS after_compra_update_estado_cxp$$
CREATE TRIGGER after_compra_update_estado_cxp
AFTER UPDATE ON compras
FOR EACH ROW
BEGIN
  IF NEW.estado = 'anulada' AND OLD.estado <> 'anulada' THEN
    UPDATE cuentas_por_pagar SET estado = 'anulada' WHERE compra_id = NEW.id;
  END IF;
END$$

DROP EVENT IF EXISTS actualizar_vencimientos_cxp$$
CREATE EVENT actualizar_vencimientos_cxp
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_DATE + INTERVAL 1 DAY
DO
  UPDATE cuentas_por_pagar
  SET estado = CASE WHEN fecha_vencimiento < CURDATE() THEN 'vencida' ELSE 'vigente' END
  WHERE estado IN ('vigente', 'vencida')$$
DELIMITER ;

INSERT INTO cuentas_por_pagar (
  empresa_id, proveedor_id, compra_id, numero_documento, fecha_emision,
  fecha_vencimiento, valor_original, saldo_pendiente, estado
)
SELECT c.empresa_id, c.proveedor_id, c.id, c.numero_compra, c.fecha_compra,
  DATE_ADD(c.fecha_compra, INTERVAL COALESCE(NULLIF(p.dias_credito, 0), 30) DAY),
  c.total, c.total,
  CASE WHEN c.estado = 'anulada' THEN 'anulada'
    WHEN DATE_ADD(c.fecha_compra, INTERVAL COALESCE(NULLIF(p.dias_credito, 0), 30) DAY) < CURDATE() THEN 'vencida'
    ELSE 'vigente' END
FROM compras c
INNER JOIN proveedores p ON p.id = c.proveedor_id AND p.empresa_id = c.empresa_id
WHERE c.tipo_compra = 'credito'
  AND NOT EXISTS (SELECT 1 FROM cuentas_por_pagar cxp WHERE cxp.compra_id = c.id);

INSERT INTO modulos
  (nombre, nombre_mostrar, descripcion, icono, nivel, categoria, orden, ruta, activo, requiere_licencia)
SELECT 'cuentas_por_pagar', 'Cuentas por Pagar', 'Gestion de obligaciones y pagos a proveedores',
  'bi-credit-card', 'tenant', 'finanzas', 17, '/cuentas-por-pagar', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM modulos WHERE nombre = 'cuentas_por_pagar');

SET @modulo_cxp_id = (SELECT id FROM modulos WHERE nombre = 'cuentas_por_pagar' LIMIT 1);

INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT @modulo_cxp_id, a.id, CONCAT('FINANZAS.CXP.', UPPER(a.nombre)),
  CONCAT(a.nombre_mostrar, ' cuentas por pagar'), 1
FROM acciones a
WHERE a.nombre IN ('view', 'create', 'export', 'print')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p
    WHERE p.codigo = CONCAT('FINANZAS.CXP.', UPPER(a.nombre))
  );

UPDATE modulos
SET nombre_mostrar = 'Cuentas por Pagar', descripcion = 'Gestion de obligaciones y pagos a proveedores',
  icono = 'bi-credit-card', nivel = 'tenant', categoria = 'finanzas', orden = 17,
  ruta = '/cuentas-por-pagar', activo = 1
WHERE nombre = 'cuentas_por_pagar';