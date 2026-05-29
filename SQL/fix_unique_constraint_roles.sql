-- =====================================================================
-- FIX: Eliminar restricción UNIQUE que impide reutilizar nombres
-- de roles eliminados (soft delete)
-- =====================================================================
-- Problema: La restricción uk_empresa_nombre impide crear un rol con
-- el mismo nombre, incluso si el rol anterior tiene activo = 0
-- 
-- Solución: Eliminar la restricción UNIQUE y depender de validaciones
-- en código (ya implementadas con AND activo = 1)
-- =====================================================================

USE kore_inventory;

-- Eliminar restricción UNIQUE de empresa_id + nombre
ALTER TABLE roles DROP INDEX uk_empresa_nombre;

-- La validación de duplicados se hace en código con:
-- SELECT id FROM roles WHERE nombre = ? AND empresa_id <=> ? AND activo = 1

-- =====================================================================
-- NOTA: MySQL no soporta índices parciales como PostgreSQL
-- (no podemos hacer UNIQUE INDEX WHERE activo = 1)
-- Por eso eliminamos la restricción y usamos validación en código
-- =====================================================================
