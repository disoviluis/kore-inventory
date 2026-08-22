-- Modulo Finanzas - Caja por tienda y sesiones por empleado
-- Compatible con AWS RDS: no usa triggers ni eventos.

CREATE TABLE IF NOT EXISTS cajas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  bodega_id INT NOT NULL,
  codigo VARCHAR(30) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  tipo ENUM('principal','secundaria','pos') NOT NULL DEFAULT 'principal',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  responsable_id INT NULL,
  monto_maximo DECIMAL(15,2) NULL,
  requiere_cuadre TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_caja_empresa_codigo (empresa_id, codigo),
  KEY idx_caja_empresa_bodega (empresa_id, bodega_id),
  KEY idx_caja_activa (empresa_id, activo),
  CONSTRAINT fk_caja_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_caja_bodega FOREIGN KEY (bodega_id) REFERENCES bodegas(id) ON DELETE CASCADE,
  CONSTRAINT fk_caja_responsable FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @exists_caja_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'turnos_caja' AND COLUMN_NAME = 'caja_id'
);
SET @sql_caja_id := IF(@exists_caja_id = 0,
  'ALTER TABLE turnos_caja ADD COLUMN caja_id INT NULL AFTER bodega_id',
  'SELECT 1');
PREPARE stmt_caja_id FROM @sql_caja_id;
EXECUTE stmt_caja_id;
DEALLOCATE PREPARE stmt_caja_id;

INSERT INTO cajas (empresa_id, bodega_id, codigo, nombre, tipo)
SELECT b.empresa_id, b.id, CONCAT('CAJA-', LPAD(b.id, 4, '0')), CONCAT('Caja principal - ', b.nombre), 'principal'
FROM bodegas b
WHERE NOT EXISTS (
  SELECT 1 FROM cajas c WHERE c.empresa_id = b.empresa_id AND c.bodega_id = b.id
);

UPDATE turnos_caja t
INNER JOIN cajas c ON c.empresa_id = t.empresa_id AND c.bodega_id = t.bodega_id
SET t.caja_id = c.id
WHERE t.caja_id IS NULL;

SET @exists_caja_idx := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'turnos_caja' AND INDEX_NAME = 'idx_turno_caja'
);
SET @sql_caja_idx := IF(@exists_caja_idx = 0,
  'ALTER TABLE turnos_caja ADD INDEX idx_turno_caja (caja_id, estado)',
  'SELECT 1');
PREPARE stmt_caja_idx FROM @sql_caja_idx;
EXECUTE stmt_caja_idx;
DEALLOCATE PREPARE stmt_caja_idx;

INSERT INTO modulos
  (nombre, nombre_mostrar, descripcion, icono, nivel, categoria, orden, ruta, activo, requiere_licencia)
SELECT 'caja', 'Caja', 'Apertura, movimientos y cierre de cajas por tienda',
  'bi-cash-stack', 'tenant', 'finanzas', 18, '/caja', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM modulos WHERE nombre = 'caja');

SET @modulo_caja_id := (SELECT id FROM modulos WHERE nombre = 'caja' LIMIT 1);

INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT @modulo_caja_id, a.id, CONCAT('FINANZAS.CAJA.', UPPER(a.nombre)),
  CONCAT(a.nombre_mostrar, ' caja'), 1
FROM acciones a
WHERE a.nombre IN ('view', 'create', 'update', 'export', 'print')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p
    WHERE p.codigo = CONCAT('FINANZAS.CAJA.', UPPER(a.nombre))
  );
