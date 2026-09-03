-- Fase 2: enlazar gastos con cuentas bancarias
SET @existe := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gastos' AND COLUMN_NAME = 'cuenta_bancaria_id'
);

SET @sql := IF(@existe = 0,
  'ALTER TABLE gastos ADD COLUMN cuenta_bancaria_id INT NULL AFTER metodo_pago,
   ADD CONSTRAINT fk_gastos_cuenta_bancaria FOREIGN KEY (cuenta_bancaria_id) REFERENCES cuentas_bancarias(id) ON DELETE SET NULL',
  'SELECT "La columna cuenta_bancaria_id ya existe en gastos" AS mensaje'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
