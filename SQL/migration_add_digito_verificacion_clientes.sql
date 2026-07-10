-- =============================================
-- MIGRACIÓN: Agregar Dígito de Verificación a Clientes
-- Fecha: 2026-07-10
-- Descripción: Agrega campo para dígito de verificación del NIT
--              Requerido para clientes colombianos (empresas con NIT)
-- =============================================

USE kore_inventory;

-- Verificar si el campo ya existe
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.columns
WHERE table_schema = 'kore_inventory'
  AND table_name = 'clientes'
  AND column_name = 'digito_verificacion';

-- Agregar campo solo si no existe
SET @query = IF(@col_exists = 0,
  'ALTER TABLE clientes
   ADD COLUMN digito_verificacion VARCHAR(1) NULL
   COMMENT ''Dígito de verificación del NIT (Colombia)''
   AFTER numero_documento',
  'SELECT ''Campo digito_verificacion ya existe en clientes'' AS Mensaje');

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migración completada exitosamente' AS Resultado;
