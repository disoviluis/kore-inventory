-- ============================================================
-- MIGRACIÓN: bodega_id en usuarios
-- Permite asignar un cajero/vendedor a una bodega específica
-- Fecha: 2026-06-08
-- ============================================================

-- 1. Agregar columna bodega_id a usuarios
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS bodega_id INT NULL DEFAULT NULL 
AFTER empresa_id_default;

-- 2. Agregar FK (solo si la columna se creó)
ALTER TABLE usuarios
ADD CONSTRAINT fk_usuarios_bodega
FOREIGN KEY (bodega_id) REFERENCES bodegas(id)
ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Verificar resultado
SELECT 
  COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'usuarios'
  AND COLUMN_NAME = 'bodega_id';
