-- Nomina Fase 2: conceptos, periodos, novedades y liquidacion automatica
-- Compatible con AWS RDS: no usa triggers ni eventos.

CREATE TABLE IF NOT EXISTS conceptos_nomina (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NULL,
  codigo VARCHAR(40) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  tipo ENUM('devengado','deduccion','aporte') NOT NULL,
  naturaleza ENUM('fijo','variable','comision','bonificacion','hora_extra','auxilio','descuento','retencion') NOT NULL DEFAULT 'variable',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_concepto_empresa_codigo (empresa_id, codigo),
  KEY idx_concepto_empresa_activo (empresa_id, activo),
  CONSTRAINT fk_concepto_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS periodos_nomina (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  fecha_pago DATE NULL,
  periodicidad ENUM('mensual','quincenal','semanal','otro') NOT NULL DEFAULT 'mensual',
  estado ENUM('abierto','calculado','aprobado','pagado','cerrado','anulado') NOT NULL DEFAULT 'abierto',
  created_by INT NOT NULL,
  approved_by INT NULL,
  approved_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_periodo_empresa_fechas (empresa_id, fecha_inicio, fecha_fin),
  KEY idx_periodo_empresa_estado (empresa_id, estado),
  CONSTRAINT fk_periodo_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_periodo_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_periodo_approved_by FOREIGN KEY (approved_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS novedades_nomina (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  empleado_id INT NOT NULL,
  periodo_id INT NULL,
  concepto_id INT NOT NULL,
  fecha DATE NOT NULL,
  cantidad DECIMAL(12,2) NOT NULL DEFAULT 1,
  valor DECIMAL(15,2) NOT NULL DEFAULT 0,
  descripcion VARCHAR(255) NULL,
  estado ENUM('borrador','aprobada','rechazada','aplicada','anulada') NOT NULL DEFAULT 'borrador',
  created_by INT NOT NULL,
  approved_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_novedad_empresa_periodo (empresa_id, periodo_id),
  KEY idx_novedad_empleado (empleado_id),
  CONSTRAINT fk_novedad_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_novedad_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
  CONSTRAINT fk_novedad_periodo FOREIGN KEY (periodo_id) REFERENCES periodos_nomina(id) ON DELETE SET NULL,
  CONSTRAINT fk_novedad_concepto FOREIGN KEY (concepto_id) REFERENCES conceptos_nomina(id) ON DELETE RESTRICT,
  CONSTRAINT fk_novedad_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_novedad_approved_by FOREIGN KEY (approved_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS liquidaciones_nomina (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  periodo_id INT NOT NULL,
  empleado_id INT NOT NULL,
  salario_base DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_devengado DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_deducciones DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_aportes DECIMAL(15,2) NOT NULL DEFAULT 0,
  neto_pagar DECIMAL(15,2) NOT NULL DEFAULT 0,
  ventas_comisionables DECIMAL(15,2) NOT NULL DEFAULT 0,
  porcentaje_comision DECIMAL(7,4) NOT NULL DEFAULT 0,
  estado ENUM('calculada','aprobada','pagada','anulada') NOT NULL DEFAULT 'calculada',
  calculated_by INT NOT NULL,
  calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by INT NULL,
  approved_at DATETIME NULL,
  UNIQUE KEY uk_liquidacion_periodo_empleado (periodo_id, empleado_id),
  KEY idx_liquidacion_empresa_periodo (empresa_id, periodo_id),
  CONSTRAINT fk_liquidacion_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_liquidacion_periodo FOREIGN KEY (periodo_id) REFERENCES periodos_nomina(id) ON DELETE CASCADE,
  CONSTRAINT fk_liquidacion_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE RESTRICT,
  CONSTRAINT fk_liquidacion_calculated_by FOREIGN KEY (calculated_by) REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_liquidacion_approved_by FOREIGN KEY (approved_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS liquidaciones_nomina_detalle (
  id INT AUTO_INCREMENT PRIMARY KEY,
  liquidacion_id INT NOT NULL,
  concepto_id INT NULL,
  codigo VARCHAR(40) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  tipo ENUM('devengado','deduccion','aporte') NOT NULL,
  cantidad DECIMAL(12,2) NOT NULL DEFAULT 1,
  base DECIMAL(15,2) NOT NULL DEFAULT 0,
  tasa DECIMAL(7,4) NOT NULL DEFAULT 0,
  valor DECIMAL(15,2) NOT NULL DEFAULT 0,
  origen VARCHAR(40) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_liquidacion_detalle (liquidacion_id),
  CONSTRAINT fk_liquidacion_detalle_liquidacion FOREIGN KEY (liquidacion_id) REFERENCES liquidaciones_nomina(id) ON DELETE CASCADE,
  CONSTRAINT fk_liquidacion_detalle_concepto FOREIGN KEY (concepto_id) REFERENCES conceptos_nomina(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO conceptos_nomina (empresa_id, codigo, nombre, tipo, naturaleza)
SELECT NULL, 'SALARIO_BASE', 'Salario base', 'devengado', 'fijo'
WHERE NOT EXISTS (SELECT 1 FROM conceptos_nomina WHERE empresa_id IS NULL AND codigo = 'SALARIO_BASE');
INSERT INTO conceptos_nomina (empresa_id, codigo, nombre, tipo, naturaleza)
SELECT NULL, 'COMISION_VENTAS', 'Comision por ventas', 'devengado', 'comision'
WHERE NOT EXISTS (SELECT 1 FROM conceptos_nomina WHERE empresa_id IS NULL AND codigo = 'COMISION_VENTAS');
INSERT INTO conceptos_nomina (empresa_id, codigo, nombre, tipo, naturaleza)
SELECT NULL, 'NOVEDAD', 'Novedad de nomina', 'devengado', 'variable'
WHERE NOT EXISTS (SELECT 1 FROM conceptos_nomina WHERE empresa_id IS NULL AND codigo = 'NOVEDAD');

INSERT INTO modulos (nombre, nombre_mostrar, descripcion, icono, nivel, categoria, orden, ruta, activo, requiere_licencia)
SELECT 'nomina_periodos', 'Periodos de Nomina', 'Periodos y liquidaciones de nomina', 'bi-calendar3', 'tenant', 'nomina', 33, '/nomina-periodos', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM modulos WHERE nombre = 'nomina_periodos');

SET @nomina_periodos_id := (SELECT id FROM modulos WHERE nombre = 'nomina_periodos' LIMIT 1);
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT @nomina_periodos_id, a.id, CONCAT('NOMINA.PERIODOS.', UPPER(a.nombre)), CONCAT(a.nombre_mostrar, ' periodos de nomina'), 1
FROM acciones a
WHERE a.nombre IN ('view','create','edit','approve')
  AND NOT EXISTS (SELECT 1 FROM permisos p WHERE p.modulo_id = @nomina_periodos_id AND p.accion_id = a.id);
