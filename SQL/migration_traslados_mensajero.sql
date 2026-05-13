-- =====================================================
-- MIGRACIÓN: MÓDULO DE MENSAJERO Y FIRMA DIGITAL
-- Descripción: Agrega campos para control de entregas,
--              firma digital y datos del destinatario
-- Fecha: 2026-05-13
-- Autor: Disovi Soft
-- =====================================================

USE kore_inventory;

-- Eliminar constraints si existen
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
     WHERE CONSTRAINT_NAME = 'fk_traslados_mensajero' 
     AND TABLE_NAME = 'traslados' 
     AND TABLE_SCHEMA = DATABASE()) > 0,
    'ALTER TABLE traslados DROP FOREIGN KEY fk_traslados_mensajero',
    'SELECT "constraint fk_traslados_mensajero no existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

-- Agregar campos solo si no existen
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'traslados' 
     AND COLUMN_NAME = 'mensajero_id' 
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE traslados ADD COLUMN mensajero_id INT(11) NULL COMMENT "Usuario mensajero asignado" AFTER usuario_envia_id',
    'SELECT "columna mensajero_id ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'traslados' 
     AND COLUMN_NAME = 'destinatario_nombre' 
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE traslados ADD COLUMN destinatario_nombre VARCHAR(200) NULL COMMENT "Nombre de quien debe recibir" AFTER observaciones_recepcion',
    'SELECT "columna destinatario_nombre ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'traslados' 
     AND COLUMN_NAME = 'destinatario_documento' 
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE traslados ADD COLUMN destinatario_documento VARCHAR(50) NULL COMMENT "Documento del destinatario" AFTER destinatario_nombre',
    'SELECT "columna destinatario_documento ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'traslados' 
     AND COLUMN_NAME = 'destinatario_telefono' 
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE traslados ADD COLUMN destinatario_telefono VARCHAR(20) NULL COMMENT "Teléfono del destinatario" AFTER destinatario_documento',
    'SELECT "columna destinatario_telefono ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'traslados' 
     AND COLUMN_NAME = 'destinatario_cargo' 
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE traslados ADD COLUMN destinatario_cargo VARCHAR(100) NULL COMMENT "Cargo del destinatario" AFTER destinatario_telefono',
    'SELECT "columna destinatario_cargo ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'traslados' 
     AND COLUMN_NAME = 'firma_recepcion' 
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE traslados ADD COLUMN firma_recepcion LONGTEXT NULL COMMENT "Firma digital en base64" AFTER destinatario_cargo',
    'SELECT "columna firma_recepcion ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'traslados' 
     AND COLUMN_NAME = 'fecha_firma' 
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE traslados ADD COLUMN fecha_firma TIMESTAMP NULL COMMENT "Fecha y hora de la firma" AFTER firma_recepcion',
    'SELECT "columna fecha_firma ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'traslados' 
     AND COLUMN_NAME = 'ip_recepcion' 
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE traslados ADD COLUMN ip_recepcion VARCHAR(50) NULL COMMENT "IP desde donde se firmó" AFTER fecha_firma',
    'SELECT "columna ip_recepcion ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'traslados' 
     AND COLUMN_NAME = 'gps_latitud' 
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE traslados ADD COLUMN gps_latitud DECIMAL(10, 8) NULL COMMENT "Latitud del punto de recepción" AFTER ip_recepcion',
    'SELECT "columna gps_latitud ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'traslados' 
     AND COLUMN_NAME = 'gps_longitud' 
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE traslados ADD COLUMN gps_longitud DECIMAL(11, 8) NULL COMMENT "Longitud del punto de recepción" AFTER gps_latitud',
    'SELECT "columna gps_longitud ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'traslados' 
     AND COLUMN_NAME = 'dispositivo_recepcion' 
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE traslados ADD COLUMN dispositivo_recepcion VARCHAR(255) NULL COMMENT "Info del dispositivo usado para firmar" AFTER gps_longitud',
    'SELECT "columna dispositivo_recepcion ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

-- Agregar índices si no existen
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_NAME = 'traslados' 
     AND INDEX_NAME = 'idx_mensajero' 
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE traslados ADD INDEX idx_mensajero (mensajero_id)',
    'SELECT "índice idx_mensajero ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_NAME = 'traslados' 
     AND INDEX_NAME = 'idx_fecha_firma' 
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE traslados ADD INDEX idx_fecha_firma (fecha_firma)',
    'SELECT "índice idx_fecha_firma ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_NAME = 'traslados' 
     AND INDEX_NAME = 'idx_destinatario_doc' 
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE traslados ADD INDEX idx_destinatario_doc (destinatario_documento)',
    'SELECT "índice idx_destinatario_doc ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

-- Agregar foreign key si no existe
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
     WHERE CONSTRAINT_NAME = 'fk_traslados_mensajero' 
     AND TABLE_NAME = 'traslados' 
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE traslados ADD CONSTRAINT fk_traslados_mensajero FOREIGN KEY (mensajero_id) REFERENCES usuarios(id) ON DELETE SET NULL',
    'SELECT "constraint fk_traslados_mensajero ya existe"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

-- Auditoría
INSERT INTO auditoria_logs (
    empresa_id, accion, modulo, tabla
) VALUES (
    NULL, 
    'migration', 
    'traslados', 
    'traslados'
);

SELECT 
    '✅ Migración completada exitosamente' as status,
    'Tabla traslados actualizada con campos para módulo de mensajero' as message;

-- Verificar columnas agregadas
SHOW COLUMNS FROM traslados 
WHERE Field IN (
    'mensajero_id', 
    'destinatario_nombre', 
    'destinatario_documento',
    'firma_recepcion',
    'gps_latitud'
);
