-- Bancos Fase 1: cuentas y movimientos bancarios
-- Compatible con AWS RDS: no usa triggers ni eventos.

CREATE TABLE IF NOT EXISTS cuentas_bancarias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  banco VARCHAR(100) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  tipo_cuenta ENUM('ahorros','corriente','cartera','otro') NOT NULL DEFAULT 'corriente',
  numero_cuenta VARCHAR(80) NOT NULL,
  titular VARCHAR(150) NULL,
  saldo_inicial DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  saldo_actual DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_cuenta_empresa_numero (empresa_id, numero_cuenta),
  KEY idx_cuenta_empresa_activo (empresa_id, activo),
  CONSTRAINT fk_cuenta_bancaria_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS movimientos_bancarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  cuenta_bancaria_id INT NOT NULL,
  tipo ENUM('deposito','retiro','transferencia','nota_debito','nota_credito','otro') NOT NULL,
  origen ENUM('venta','recibo_caja','pago_proveedor','nomina','gasto','ajuste','otro') NOT NULL DEFAULT 'otro',
  fecha_movimiento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  referencia VARCHAR(100) NULL,
  descripcion VARCHAR(255) NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  saldo_anterior DECIMAL(15,2) NOT NULL,
  saldo_nuevo DECIMAL(15,2) NOT NULL,
  conciliado TINYINT(1) NOT NULL DEFAULT 0,
  fecha_conciliacion DATETIME NULL,
  conciliado_por INT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_movimiento_empresa_cuenta_fecha (empresa_id, cuenta_bancaria_id, fecha_movimiento),
  KEY idx_movimiento_conciliado (cuenta_bancaria_id, conciliado),
  CONSTRAINT fk_movimiento_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_movimiento_cuenta FOREIGN KEY (cuenta_bancaria_id) REFERENCES cuentas_bancarias(id) ON DELETE RESTRICT,
  CONSTRAINT fk_movimiento_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_movimiento_conciliado_por FOREIGN KEY (conciliado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @bancos_id := (SELECT id FROM modulos WHERE nombre = 'bancos' LIMIT 1);
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT @bancos_id, a.id, CONCAT('FINANZAS.BANCOS.', UPPER(a.nombre)), CONCAT(a.nombre_mostrar, ' bancos'), 1
FROM acciones a
WHERE a.nombre IN ('view','create','edit','delete','approve','export','print')
  AND NOT EXISTS (SELECT 1 FROM permisos p WHERE p.modulo_id = @bancos_id AND p.accion_id = a.id);
