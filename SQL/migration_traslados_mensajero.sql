-- =====================================================
-- MIGRACIÓN: MÓDULO DE MENSAJERO Y FIRMA DIGITAL
-- Descripción: Agrega campos para control de entregas,
--              firma digital y datos del destinatario
-- Fecha: 2026-05-13
-- Autor: Disovi Soft
-- =====================================================

USE kore_inventory;

-- Agregar campos para el módulo de mensajero
ALTER TABLE traslados
    ADD COLUMN mensajero_id INT(11) NULL 
        COMMENT 'Usuario mensajero asignado' AFTER usuario_envia_id,
    
    ADD COLUMN destinatario_nombre VARCHAR(200) NULL 
        COMMENT 'Nombre de quien debe recibir' AFTER observaciones_recepcion,
    ADD COLUMN destinatario_documento VARCHAR(50) NULL 
        COMMENT 'Documento del destinatario' AFTER destinatario_nombre,
    ADD COLUMN destinatario_telefono VARCHAR(20) NULL 
        COMMENT 'Teléfono del destinatario' AFTER destinatario_documento,
    ADD COLUMN destinatario_cargo VARCHAR(100) NULL 
        COMMENT 'Cargo del destinatario' AFTER destinatario_telefono,
    
    ADD COLUMN firma_recepcion LONGTEXT NULL 
        COMMENT 'Firma digital en base64' AFTER destinatario_cargo,
    ADD COLUMN fecha_firma TIMESTAMP NULL 
        COMMENT 'Fecha y hora de la firma' AFTER firma_recepcion,
    
    ADD COLUMN ip_recepcion VARCHAR(50) NULL 
        COMMENT 'IP desde donde se firmó' AFTER fecha_firma,
    ADD COLUMN gps_latitud DECIMAL(10, 8) NULL 
        COMMENT 'Latitud del punto de recepción' AFTER ip_recepcion,
    ADD COLUMN gps_longitud DECIMAL(11, 8) NULL 
        COMMENT 'Longitud del punto de recepción' AFTER gps_latitud,
    ADD COLUMN dispositivo_recepcion VARCHAR(255) NULL 
        COMMENT 'Info del dispositivo usado para firmar' AFTER gps_longitud,
    
    ADD INDEX idx_mensajero (mensajero_id),
    ADD INDEX idx_fecha_firma (fecha_firma),
    ADD INDEX idx_destinatario_doc (destinatario_documento),
    
    ADD CONSTRAINT fk_traslados_mensajero 
        FOREIGN KEY (mensajero_id) REFERENCES usuarios(id) ON DELETE SET NULL;

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
