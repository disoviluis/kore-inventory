-- ============================================
-- Migración: Agregar campos RUES a proveedores
-- Descripción: Campos adicionales para integración con RUES
--              (Registro Único Empresarial y Social)
-- Autor: Sistema Kore Inventory
-- Fecha: 2026-05-12
-- ============================================

USE kore_inventory;

-- Verificar si los campos ya existen antes de agregarlos
SET @db_name = DATABASE();

-- Campo: representante_legal
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @db_name 
    AND TABLE_NAME = 'proveedores' 
    AND COLUMN_NAME = 'representante_legal'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE proveedores ADD COLUMN representante_legal VARCHAR(200) NULL AFTER digito_verificacion',
    'SELECT "Campo representante_legal ya existe" AS mensaje'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Campo: tipo_sociedad
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @db_name 
    AND TABLE_NAME = 'proveedores' 
    AND COLUMN_NAME = 'tipo_sociedad'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE proveedores ADD COLUMN tipo_sociedad VARCHAR(50) NULL AFTER representante_legal',
    'SELECT "Campo tipo_sociedad ya existe" AS mensaje'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Campo: matricula_mercantil
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @db_name 
    AND TABLE_NAME = 'proveedores' 
    AND COLUMN_NAME = 'matricula_mercantil'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE proveedores ADD COLUMN matricula_mercantil VARCHAR(100) NULL AFTER tipo_sociedad',
    'SELECT "Campo matricula_mercantil ya existe" AS mensaje'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Campo: camara_comercio
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @db_name 
    AND TABLE_NAME = 'proveedores' 
    AND COLUMN_NAME = 'camara_comercio'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE proveedores ADD COLUMN camara_comercio VARCHAR(100) NULL AFTER matricula_mercantil',
    'SELECT "Campo camara_comercio ya existe" AS mensaje'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Campo: fecha_matricula
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @db_name 
    AND TABLE_NAME = 'proveedores' 
    AND COLUMN_NAME = 'fecha_matricula'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE proveedores ADD COLUMN fecha_matricula DATE NULL AFTER camara_comercio',
    'SELECT "Campo fecha_matricula ya existe" AS mensaje'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Campo: actividad_economica (Código CIIU)
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @db_name 
    AND TABLE_NAME = 'proveedores' 
    AND COLUMN_NAME = 'actividad_economica'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE proveedores ADD COLUMN actividad_economica VARCHAR(255) NULL AFTER fecha_matricula',
    'SELECT "Campo actividad_economica ya existe" AS mensaje'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Campo: departamento
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @db_name 
    AND TABLE_NAME = 'proveedores' 
    AND COLUMN_NAME = 'departamento'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE proveedores ADD COLUMN departamento VARCHAR(100) NULL AFTER actividad_economica',
    'SELECT "Campo departamento ya existe" AS mensaje'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificar estructura final
SELECT 'Migración completada. Verificando campos agregados...' AS status;

SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    IS_NULLABLE, 
    COLUMN_COMMENT
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = @db_name 
AND TABLE_NAME = 'proveedores'
AND COLUMN_NAME IN (
    'digito_verificacion',
    'representante_legal', 
    'tipo_sociedad', 
    'matricula_mercantil',
    'camara_comercio',
    'fecha_matricula',
    'actividad_economica',
    'departamento'
)
ORDER BY ORDINAL_POSITION;

SELECT '¡Migración ejecutada exitosamente!' AS resultado;
