-- Nomina email SMTP / comprobantes por correo
-- Compatible con AWS RDS: sin triggers ni eventos.

SET @smtp_host_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configuracion_nomina' AND COLUMN_NAME = 'smtp_host');
SET @sql_smtp_host := IF(@smtp_host_exists = 0, 'ALTER TABLE configuracion_nomina ADD COLUMN smtp_host VARCHAR(255) NULL AFTER auxilio_transporte_valor', 'SELECT 1');
PREPARE stmt_smtp_host FROM @sql_smtp_host;
EXECUTE stmt_smtp_host;
DEALLOCATE PREPARE stmt_smtp_host;

SET @smtp_port_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configuracion_nomina' AND COLUMN_NAME = 'smtp_port');
SET @sql_smtp_port := IF(@smtp_port_exists = 0, 'ALTER TABLE configuracion_nomina ADD COLUMN smtp_port INT NULL DEFAULT 587 AFTER smtp_host', 'SELECT 1');
PREPARE stmt_smtp_port FROM @sql_smtp_port;
EXECUTE stmt_smtp_port;
DEALLOCATE PREPARE stmt_smtp_port;

SET @smtp_secure_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configuracion_nomina' AND COLUMN_NAME = 'smtp_secure');
SET @sql_smtp_secure := IF(@smtp_secure_exists = 0, 'ALTER TABLE configuracion_nomina ADD COLUMN smtp_secure TINYINT(1) NOT NULL DEFAULT 1 AFTER smtp_port', 'SELECT 1');
PREPARE stmt_smtp_secure FROM @sql_smtp_secure;
EXECUTE stmt_smtp_secure;
DEALLOCATE PREPARE stmt_smtp_secure;

SET @smtp_user_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configuracion_nomina' AND COLUMN_NAME = 'smtp_user');
SET @sql_smtp_user := IF(@smtp_user_exists = 0, 'ALTER TABLE configuracion_nomina ADD COLUMN smtp_user VARCHAR(255) NULL AFTER smtp_secure', 'SELECT 1');
PREPARE stmt_smtp_user FROM @sql_smtp_user;
EXECUTE stmt_smtp_user;
DEALLOCATE PREPARE stmt_smtp_user;

SET @smtp_pass_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configuracion_nomina' AND COLUMN_NAME = 'smtp_pass');
SET @sql_smtp_pass := IF(@smtp_pass_exists = 0, 'ALTER TABLE configuracion_nomina ADD COLUMN smtp_pass VARCHAR(255) NULL AFTER smtp_user', 'SELECT 1');
PREPARE stmt_smtp_pass FROM @sql_smtp_pass;
EXECUTE stmt_smtp_pass;
DEALLOCATE PREPARE stmt_smtp_pass;

SET @smtp_from_name_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configuracion_nomina' AND COLUMN_NAME = 'smtp_from_name');
SET @sql_smtp_from_name := IF(@smtp_from_name_exists = 0, 'ALTER TABLE configuracion_nomina ADD COLUMN smtp_from_name VARCHAR(150) NULL AFTER smtp_pass', 'SELECT 1');
PREPARE stmt_smtp_from_name FROM @sql_smtp_from_name;
EXECUTE stmt_smtp_from_name;
DEALLOCATE PREPARE stmt_smtp_from_name;

SET @smtp_from_email_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configuracion_nomina' AND COLUMN_NAME = 'smtp_from_email');
SET @sql_smtp_from_email := IF(@smtp_from_email_exists = 0, 'ALTER TABLE configuracion_nomina ADD COLUMN smtp_from_email VARCHAR(150) NULL AFTER smtp_from_name', 'SELECT 1');
PREPARE stmt_smtp_from_email FROM @sql_smtp_from_email;
EXECUTE stmt_smtp_from_email;
DEALLOCATE PREPARE stmt_smtp_from_email;

SET @smtp_activar_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configuracion_nomina' AND COLUMN_NAME = 'smtp_activar');
SET @sql_smtp_activar := IF(@smtp_activar_exists = 0, 'ALTER TABLE configuracion_nomina ADD COLUMN smtp_activar TINYINT(1) NOT NULL DEFAULT 0 AFTER smtp_from_email', 'SELECT 1');
PREPARE stmt_smtp_activar FROM @sql_smtp_activar;
EXECUTE stmt_smtp_activar;
DEALLOCATE PREPARE stmt_smtp_activar;

UPDATE configuracion_nomina
SET smtp_port = 587,
    smtp_secure = 1,
    smtp_activar = 0
WHERE smtp_host IS NULL AND smtp_port IS NULL;
