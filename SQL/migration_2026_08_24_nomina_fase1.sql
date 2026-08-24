-- Nomina Fase 1: empleados, contratos, tiendas y vinculo opcional con Usuarios
-- Compatible con AWS RDS: no usa triggers ni eventos.

CREATE TABLE IF NOT EXISTS empleados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  tipo_documento VARCHAR(10) NOT NULL DEFAULT 'CC',
  numero_documento VARCHAR(30) NOT NULL,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  email VARCHAR(150) NULL,
  telefono VARCHAR(30) NULL,
  cargo VARCHAR(100) NULL,
  fecha_ingreso DATE NOT NULL,
  fecha_retiro DATE NULL,
  estado ENUM('activo','retirado','suspendido') NOT NULL DEFAULT 'activo',
  salario_base DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  periodicidad_pago ENUM('mensual','quincenal','semanal') NOT NULL DEFAULT 'mensual',
  tipo_vinculacion ENUM('contrato_indefinido','contrato_fijo','prestacion_servicios','aprendiz','otro') NOT NULL DEFAULT 'contrato_indefinido',
  porcentaje_comision DECIMAL(7,4) NOT NULL DEFAULT 0.0000,
  auxilio_transporte TINYINT(1) NOT NULL DEFAULT 0,
  observaciones TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_empleado_empresa_documento (empresa_id, tipo_documento, numero_documento),
  KEY idx_empleado_empresa_estado (empresa_id, estado),
  CONSTRAINT fk_empleado_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS empleados_bodegas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empleado_id INT NOT NULL,
  empresa_id INT NOT NULL,
  bodega_id INT NOT NULL,
  es_principal TINYINT(1) NOT NULL DEFAULT 0,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_empleado_bodega (empleado_id, bodega_id),
  KEY idx_empleado_bodega_empresa (empresa_id, bodega_id),
  CONSTRAINT fk_empleado_bodega_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
  CONSTRAINT fk_empleado_bodega_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_empleado_bodega_bodega FOREIGN KEY (bodega_id) REFERENCES bodegas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS empleados_contratos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empleado_id INT NOT NULL,
  empresa_id INT NOT NULL,
  tipo_contrato ENUM('indefinido','fijo','prestacion_servicios','aprendiz','otro') NOT NULL DEFAULT 'indefinido',
  cargo VARCHAR(100) NULL,
  salario_base DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  porcentaje_comision DECIMAL(7,4) NOT NULL DEFAULT 0.0000,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NULL,
  estado ENUM('borrador','activo','finalizado','anulado') NOT NULL DEFAULT 'activo',
  observaciones TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_contrato_empleado_estado (empleado_id, estado),
  CONSTRAINT fk_contrato_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
  CONSTRAINT fk_contrato_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @empleado_id_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'empleado_id'
);
SET @sql_empleado_id := IF(@empleado_id_exists = 0,
  'ALTER TABLE usuarios ADD COLUMN empleado_id INT NULL',
  'SELECT 1');
PREPARE stmt_empleado_id FROM @sql_empleado_id;
EXECUTE stmt_empleado_id;
DEALLOCATE PREPARE stmt_empleado_id;

SET @empleado_id_idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios' AND INDEX_NAME = 'idx_usuarios_empleado'
);
SET @sql_empleado_id_idx := IF(@empleado_id_idx_exists = 0,
  'ALTER TABLE usuarios ADD INDEX idx_usuarios_empleado (empleado_id)',
  'SELECT 1');
PREPARE stmt_empleado_id_idx FROM @sql_empleado_id_idx;
EXECUTE stmt_empleado_id_idx;
DEALLOCATE PREPARE stmt_empleado_id_idx;

INSERT INTO modulos (nombre, nombre_mostrar, descripcion, icono, nivel, categoria, orden, ruta, activo, requiere_licencia)
SELECT 'nomina', 'Nomina', 'Gestion laboral y liquidacion de empleados', 'bi-people', 'tenant', 'nomina', 30, '/nomina', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM modulos WHERE nombre = 'nomina');

INSERT INTO modulos (nombre, nombre_mostrar, descripcion, icono, nivel, categoria, orden, ruta, activo, requiere_licencia)
SELECT 'nomina_empleados', 'Empleados', 'Datos laborales, contratos y asignaciones', 'bi-person-badge', 'tenant', 'nomina', 31, '/nomina-empleados', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM modulos WHERE nombre = 'nomina_empleados');

INSERT INTO modulos (nombre, nombre_mostrar, descripcion, icono, nivel, categoria, orden, ruta, activo, requiere_licencia)
SELECT 'nomina_contratos', 'Contratos', 'Historial de contratos laborales', 'bi-file-earmark-text', 'tenant', 'nomina', 32, '/nomina-contratos', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM modulos WHERE nombre = 'nomina_contratos');

SET @nomina_empleados_id := (SELECT id FROM modulos WHERE nombre = 'nomina_empleados' LIMIT 1);
SET @nomina_contratos_id := (SELECT id FROM modulos WHERE nombre = 'nomina_contratos' LIMIT 1);

INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT @nomina_empleados_id, a.id, CONCAT('NOMINA.EMPLEADOS.', UPPER(a.nombre)), CONCAT(a.nombre_mostrar, ' empleados'), 1
FROM acciones a
WHERE a.nombre IN ('view','create','edit','delete')
  AND NOT EXISTS (SELECT 1 FROM permisos p WHERE p.modulo_id = @nomina_empleados_id AND p.accion_id = a.id);

INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT @nomina_contratos_id, a.id, CONCAT('NOMINA.CONTRATOS.', UPPER(a.nombre)), CONCAT(a.nombre_mostrar, ' contratos'), 1
FROM acciones a
WHERE a.nombre IN ('view','create','edit','delete')
  AND NOT EXISTS (SELECT 1 FROM permisos p WHERE p.modulo_id = @nomina_contratos_id AND p.accion_id = a.id);
