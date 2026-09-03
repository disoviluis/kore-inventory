-- Fase 3: cierres de conciliación bancaria
CREATE TABLE IF NOT EXISTS conciliaciones_bancarias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  cuenta_bancaria_id INT NOT NULL,
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE NOT NULL,
  saldo_libros DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  saldo_extracto DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  diferencia DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  movimientos_conciliados INT NOT NULL DEFAULT 0,
  observaciones TEXT NULL,
  usuario_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_conciliacion_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_conciliacion_cuenta FOREIGN KEY (cuenta_bancaria_id) REFERENCES cuentas_bancarias(id) ON DELETE RESTRICT,
  CONSTRAINT fk_conciliacion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  KEY idx_conciliacion_cuenta_periodo (cuenta_bancaria_id, fecha_desde, fecha_hasta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
