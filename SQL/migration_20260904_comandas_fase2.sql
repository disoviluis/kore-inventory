-- Comandas Fase 2: decisión de propina tomada en la mesa
-- El mesero pregunta al cliente y el cajero cobra exactamente lo informado.

SET @existe := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cuentas_abiertas' AND COLUMN_NAME = 'propina_habilitada');
SET @sql := IF(@existe = 0,
  'ALTER TABLE cuentas_abiertas
     ADD COLUMN propina_habilitada TINYINT(1) NOT NULL DEFAULT 0,
     ADD COLUMN propina_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0.00,
     ADD COLUMN propina_valor DECIMAL(15,2) NOT NULL DEFAULT 0.00,
     ADD COLUMN propina_confirmada_por INT NULL,
     ADD COLUMN fecha_propina DATETIME NULL',
  'SELECT "cuentas_abiertas ya tiene los campos de propina" AS mensaje');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Porcentaje sugerido por empresa para que mesero y cajero usen el mismo valor
SET @existe := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'empresas' AND COLUMN_NAME = 'propina_sugerida_porcentaje');
SET @sql := IF(@existe = 0,
  'ALTER TABLE empresas ADD COLUMN propina_sugerida_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 10.00',
  'SELECT "empresas.propina_sugerida_porcentaje ya existe" AS mensaje');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
