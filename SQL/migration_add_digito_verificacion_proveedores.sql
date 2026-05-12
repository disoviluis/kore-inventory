-- =============================================
-- MIGRACIÓN: Agregar Dígito de Verificación a Proveedores
-- Fecha: 2026-05-12
-- Descripción: Agrega campo para dígito de verificación del NIT
--              Requerido para proveedores colombianos
-- =============================================

USE kore_inventory;

-- =============================================
-- PASO 1: Agregar campo digito_verificacion
-- =============================================

SELECT 'Agregando campo digito_verificacion a tabla proveedores...' AS Paso;

-- Verificar si el campo ya existe
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.columns
WHERE table_schema = 'kore_inventory'
  AND table_name = 'proveedores'
  AND column_name = 'digito_verificacion';

-- Agregar campo solo si no existe
SET @query = IF(@col_exists = 0,
  'ALTER TABLE proveedores 
   ADD COLUMN digito_verificacion VARCHAR(1) NULL 
   COMMENT ''Dígito de verificación del NIT (Colombia)''
   AFTER numero_documento',
  'SELECT ''Campo digito_verificacion ya existe en proveedores'' AS Mensaje');

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- PASO 2: Verificar resultado
-- =============================================

SELECT 'Verificación del campo creado:' AS Resultado;

SELECT 
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM information_schema.columns
WHERE table_schema = 'kore_inventory'
  AND table_name = 'proveedores'
  AND column_name IN ('numero_documento', 'digito_verificacion')
ORDER BY ORDINAL_POSITION;

-- =============================================
-- ✅ COMPLETADO
-- =============================================

SELECT '✅ Campo digito_verificacion agregado exitosamente' AS Estado;
SELECT 'El campo se mostrará en el frontend solo cuando tipo_documento = NIT' AS Nota;
SELECT 'Se calculará automáticamente usando el algoritmo DIAN' AS Funcionalidad;

