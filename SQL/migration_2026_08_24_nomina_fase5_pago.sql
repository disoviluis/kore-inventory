-- Nomina Fase 5: aprobacion y pago de liquidaciones
-- Compatible con AWS RDS: no usa triggers ni eventos.

SET @pago_cuenta_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'liquidaciones_nomina' AND COLUMN_NAME = 'cuenta_bancaria_id'
);
SET @sql_pago_cuenta := IF(@pago_cuenta_exists = 0,
  'ALTER TABLE liquidaciones_nomina ADD COLUMN cuenta_bancaria_id INT NULL AFTER neto_pagar',
  'SELECT 1');
PREPARE stmt_pago_cuenta FROM @sql_pago_cuenta;
EXECUTE stmt_pago_cuenta;
DEALLOCATE PREPARE stmt_pago_cuenta;

SET @pago_ref_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'liquidaciones_nomina' AND COLUMN_NAME = 'referencia_pago'
);
SET @sql_pago_ref := IF(@pago_ref_exists = 0,
  'ALTER TABLE liquidaciones_nomina ADD COLUMN referencia_pago VARCHAR(100) NULL',
  'SELECT 1');
PREPARE stmt_pago_ref FROM @sql_pago_ref;
EXECUTE stmt_pago_ref;
DEALLOCATE PREPARE stmt_pago_ref;

SET @pago_fecha_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'liquidaciones_nomina' AND COLUMN_NAME = 'paid_at'
);
SET @sql_pago_fecha := IF(@pago_fecha_exists = 0,
  'ALTER TABLE liquidaciones_nomina ADD COLUMN paid_at DATETIME NULL',
  'SELECT 1');
PREPARE stmt_pago_fecha FROM @sql_pago_fecha;
EXECUTE stmt_pago_fecha;
DEALLOCATE PREPARE stmt_pago_fecha;
