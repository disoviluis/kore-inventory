-- ============================================
-- MIGRACIÓN FACTURACIÓN - VERSIÓN SEGURA
-- Solo agrega columnas si NO existen
-- ============================================

USE kore_inventory;

-- Verificar qué columnas ya existen en empresas
SELECT 'Verificando columnas existentes en empresas...' AS mensaje;
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'kore_inventory' AND table_name = 'empresas'
ORDER BY ordinal_position;

-- Procedimiento para agregar columnas de forma segura
DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_not_exists$$

CREATE PROCEDURE add_column_if_not_exists(
    IN p_table VARCHAR(64),
    IN p_column VARCHAR(64),
    IN p_definition TEXT
)
BEGIN
    DECLARE col_exists INT;
    
    SELECT COUNT(*) INTO col_exists
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = p_table
    AND column_name = p_column;
    
    IF col_exists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_column, ' ', p_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('✓ Columna ', p_column, ' agregada') AS resultado;
    ELSE
        SELECT CONCAT('⊗ Columna ', p_column, ' ya existe') AS resultado;
    END IF;
END$$

DELIMITER ;

-- EMPRESAS
CALL add_column_if_not_exists('empresas', 'slogan', 'VARCHAR(200) NULL COMMENT "Eslogan"');
CALL add_column_if_not_exists('empresas', 'sitio_web', 'VARCHAR(200) NULL');
CALL add_column_if_not_exists('empresas', 'ciudad', 'VARCHAR(100) NULL');
CALL add_column_if_not_exists('empresas', 'regimen_fiscal', 'ENUM("comun","simplificado") DEFAULT "comun"');
CALL add_column_if_not_exists('empresas', 'gran_contribuyente', 'BOOLEAN DEFAULT FALSE');
CALL add_column_if_not_exists('empresas', 'autoretenedor', 'BOOLEAN DEFAULT FALSE');
CALL add_column_if_not_exists('empresas', 'resolucion_dian', 'VARCHAR(50) NULL');
CALL add_column_if_not_exists('empresas', 'fecha_resolucion_desde', 'DATE NULL');
CALL add_column_if_not_exists('empresas', 'fecha_resolucion_hasta', 'DATE NULL');
CALL add_column_if_not_exists('empresas', 'prefijo_factura', 'VARCHAR(10) DEFAULT "FAC"');
CALL add_column_if_not_exists('empresas', 'rango_factura_desde', 'INT NULL');
CALL add_column_if_not_exists('empresas', 'rango_factura_hasta', 'INT NULL');
CALL add_column_if_not_exists('empresas', 'contador_factura_actual', 'INT DEFAULT 1');

-- CLIENTES
CALL add_column_if_not_exists('clientes', 'razon_social', 'VARCHAR(200) NULL');
CALL add_column_if_not_exists('clientes', 'tipo_documento', 'ENUM("CC","NIT","CE","PP","TI") DEFAULT "CC"');
CALL add_column_if_not_exists('clientes', 'digito_verificacion', 'CHAR(1) NULL');
CALL add_column_if_not_exists('clientes', 'ciudad', 'VARCHAR(100) NULL');
CALL add_column_if_not_exists('clientes', 'departamento', 'VARCHAR(100) NULL');
CALL add_column_if_not_exists('clientes', 'responsabilidad_tributaria', 'VARCHAR(100) NULL');
CALL add_column_if_not_exists('clientes', 'contacto_nombre', 'VARCHAR(100) NULL');
CALL add_column_if_not_exists('clientes', 'contacto_cargo', 'VARCHAR(100) NULL');

-- VENTAS
CALL add_column_if_not_exists('ventas', 'fecha_vencimiento', 'DATE NULL');
CALL add_column_if_not_exists('ventas', 'vendedor_id', 'INT NULL');
CALL add_column_if_not_exists('ventas', 'forma_pago', 'ENUM("contado","credito") DEFAULT "contado"');
CALL add_column_if_not_exists('ventas', 'dias_credito', 'INT DEFAULT 0');
CALL add_column_if_not_exists('ventas', 'observaciones', 'TEXT NULL');
CALL add_column_if_not_exists('ventas', 'cufe', 'VARCHAR(100) NULL');

-- PRODUCTOS
CALL add_column_if_not_exists('productos', 'unidad_medida', 'VARCHAR(10) DEFAULT "UND"');

-- VENTA_DETALLE
CALL add_column_if_not_exists('venta_detalle', 'unidad_medida', 'VARCHAR(10) DEFAULT "UND"');
CALL add_column_if_not_exists('venta_detalle', 'descuento_porcentaje', 'DECIMAL(5,2) DEFAULT 0');
CALL add_column_if_not_exists('venta_detalle', 'descripcion_adicional', 'TEXT NULL');

-- CREAR TABLA configuracion_factura
CREATE TABLE IF NOT EXISTS configuracion_factura (
    id INT PRIMARY KEY AUTO_INCREMENT,
    empresa_id INT NOT NULL,
    mostrar_logo BOOLEAN DEFAULT TRUE,
    logo_posicion ENUM('izquierda', 'centro', 'derecha') DEFAULT 'izquierda',
    mostrar_slogan BOOLEAN DEFAULT TRUE,
    color_primario VARCHAR(7) DEFAULT '#007bff',
    color_secundario VARCHAR(7) DEFAULT '#6c757d',
    fuente VARCHAR(50) DEFAULT 'Arial',
    tamano_fuente INT DEFAULT 10,
    pie_pagina TEXT NULL,
    terminos_condiciones TEXT NULL,
    notas_predeterminadas TEXT NULL,
    mensaje_agradecimiento VARCHAR(500) DEFAULT 'Gracias por su compra',
    mostrar_qr BOOLEAN DEFAULT TRUE,
    mostrar_cufe BOOLEAN DEFAULT TRUE,
    mostrar_firma BOOLEAN DEFAULT FALSE,
    texto_firma VARCHAR(200) NULL,
    cuentas_bancarias JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    UNIQUE KEY unique_empresa (empresa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CREAR TABLA retenciones
CREATE TABLE IF NOT EXISTS retenciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    empresa_id INT NOT NULL,
    codigo VARCHAR(20) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    tipo ENUM('reteiva', 'retefuente', 'reteica') NOT NULL,
    porcentaje DECIMAL(5,2) NOT NULL,
    base_minima DECIMAL(15,2) DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    descripcion TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    UNIQUE KEY unique_codigo_empresa (empresa_id, codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar configuración por defecto
INSERT IGNORE INTO configuracion_factura (empresa_id, mensaje_agradecimiento)
SELECT id, 'Gracias por su compra' FROM empresas;

-- Insertar retenciones por defecto
INSERT IGNORE INTO retenciones (empresa_id, codigo, nombre, tipo, porcentaje, base_minima) 
SELECT id, 'RETEIVA', 'Retención IVA', 'reteiva', 15.00, 0 FROM empresas;

INSERT IGNORE INTO retenciones (empresa_id, codigo, nombre, tipo, porcentaje, base_minima) 
SELECT id, 'RETEFUENTE', 'Retención en la Fuente', 'retefuente', 2.50, 0 FROM empresas;

-- Índices (crear solo si no existen)
SET @index_exists = (SELECT COUNT(*) FROM information_schema.statistics 
    WHERE table_schema = DATABASE() AND table_name = 'ventas' AND index_name = 'idx_ventas_numero_factura');
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX idx_ventas_numero_factura ON ventas(numero_factura)', 
    'SELECT "Índice idx_ventas_numero_factura ya existe" AS mensaje');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (SELECT COUNT(*) FROM information_schema.statistics 
    WHERE table_schema = DATABASE() AND table_name = 'clientes' AND index_name = 'idx_clientes_numero_documento');
SET @sql = IF(@index_exists = 0, 
    'CREATE INDEX idx_clientes_numero_documento ON clientes(numero_documento)', 
    'SELECT "Índice idx_clientes_numero_documento ya existe" AS mensaje');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Limpiar
DROP PROCEDURE IF EXISTS add_column_if_not_exists;

-- Resumen
SELECT '✓ Migración completada' AS mensaje;
SELECT COUNT(*) AS empresas FROM empresas;
SELECT COUNT(*) AS configuraciones FROM configuracion_factura;
SELECT COUNT(*) AS retenciones FROM retenciones;
