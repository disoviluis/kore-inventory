-- =====================================================
-- FIX: Asignar niveles de privilegio a usuarios
-- Fecha: 2026-05-29
-- Problema: Usuarios admin sin nivel_privilegio definido (NULL)
-- =====================================================

USE kore_inventory;

-- 1. Actualizar super_admin sin nivel (deben tener 100)
UPDATE usuarios 
SET nivel_privilegio = 100 
WHERE tipo_usuario = 'super_admin' 
  AND nivel_privilegio IS NULL;

-- 2. Actualizar admin_empresa sin nivel (deben tener 95)
UPDATE usuarios 
SET nivel_privilegio = 95 
WHERE tipo_usuario = 'admin_empresa' 
  AND nivel_privilegio IS NULL;

-- 3. Actualizar usuarios normales sin nivel (deben tener 50)
UPDATE usuarios 
SET nivel_privilegio = 50 
WHERE tipo_usuario = 'usuario' 
  AND nivel_privilegio IS NULL;

-- 4. Actualizar soporte sin nivel (deben tener 80)
UPDATE usuarios 
SET nivel_privilegio = 80 
WHERE tipo_usuario = 'soporte' 
  AND nivel_privilegio IS NULL;

-- 5. Verificación
SELECT 
    tipo_usuario,
    COUNT(*) as total,
    MIN(nivel_privilegio) as nivel_minimo,
    MAX(nivel_privilegio) as nivel_maximo,
    AVG(nivel_privilegio) as nivel_promedio
FROM usuarios
WHERE activo = 1
GROUP BY tipo_usuario
ORDER BY nivel_maximo DESC;

-- 6. Usuarios sin nivel (debería estar vacío)
SELECT 
    id, 
    nombre, 
    apellido, 
    email, 
    tipo_usuario, 
    nivel_privilegio
FROM usuarios 
WHERE nivel_privilegio IS NULL
  AND activo = 1;
