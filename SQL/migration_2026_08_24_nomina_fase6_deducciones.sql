-- Nomina Fase 6: deducciones legales y descuentos recurrentes
-- Compatible con AWS RDS: no usa triggers ni eventos.

CREATE TABLE IF NOT EXISTS configuracion_nomina (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  salud_empleado_pct DECIMAL(7,4) NOT NULL DEFAULT 4.0000,
  pension_empleado_pct DECIMAL(7,4) NOT NULL DEFAULT 4.0000,
  retencion_fuente_activa TINYINT(1) NOT NULL DEFAULT 0,
  auxilio_transporte_valor DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_config_nomina_empresa (empresa_id),
  CONSTRAINT fk_config_nomina_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prestamos_empleados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  empleado_id INT NOT NULL,
  tipo ENUM('prestamo','anticipo') NOT NULL DEFAULT 'prestamo',
  descripcion VARCHAR(255) NOT NULL,
  valor_original DECIMAL(15,2) NOT NULL,
  saldo_pendiente DECIMAL(15,2) NOT NULL,
  cuota_periodica DECIMAL(15,2) NOT NULL,
  estado ENUM('activo','pagado','anulado') NOT NULL DEFAULT 'activo',
  fecha_inicio DATE NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_prestamo_empresa_empleado (empresa_id, empleado_id, estado),
  CONSTRAINT fk_prestamo_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_prestamo_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
  CONSTRAINT fk_prestamo_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO configuracion_nomina (empresa_id)
SELECT id FROM empresas
WHERE NOT EXISTS (SELECT 1 FROM configuracion_nomina c WHERE c.empresa_id = empresas.id);

INSERT INTO conceptos_nomina (empresa_id, codigo, nombre, tipo, naturaleza)
SELECT NULL, 'SALUD_EMPLEADO', 'Salud empleado', 'deduccion', 'retencion'
WHERE NOT EXISTS (SELECT 1 FROM conceptos_nomina WHERE empresa_id IS NULL AND codigo = 'SALUD_EMPLEADO');
INSERT INTO conceptos_nomina (empresa_id, codigo, nombre, tipo, naturaleza)
SELECT NULL, 'PENSION_EMPLEADO', 'Pension empleado', 'deduccion', 'retencion'
WHERE NOT EXISTS (SELECT 1 FROM conceptos_nomina WHERE empresa_id IS NULL AND codigo = 'PENSION_EMPLEADO');
INSERT INTO conceptos_nomina (empresa_id, codigo, nombre, tipo, naturaleza)
SELECT NULL, 'RETENCION_FUENTE', 'Retencion en la fuente', 'deduccion', 'retencion'
WHERE NOT EXISTS (SELECT 1 FROM conceptos_nomina WHERE empresa_id IS NULL AND codigo = 'RETENCION_FUENTE');
INSERT INTO conceptos_nomina (empresa_id, codigo, nombre, tipo, naturaleza)
SELECT NULL, 'PRESTAMO_CUOTA', 'Cuota de prestamo o anticipo', 'deduccion', 'descuento'
WHERE NOT EXISTS (SELECT 1 FROM conceptos_nomina WHERE empresa_id IS NULL AND codigo = 'PRESTAMO_CUOTA');
