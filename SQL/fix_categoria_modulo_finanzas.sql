-- ============================================
-- FIX: CATEGORÍA DEL MÓDULO FINANZAS
-- ============================================
-- Fecha: 2026-05-29
-- Descripción: Actualizar la categoría del módulo Finanzas de 'operaciones' a 'finanzas'
--             para que aparezca correctamente agrupado en el configurador de permisos
--
-- PROBLEMA: 
-- El módulo 'fi nananzas' (ID 21) estaba con categoría 'operaciones' lo que hacía que
-- apareciera en la sección incorrecta del configurador de roles y permisos.
--
-- SOLUCIÓN:
-- Cambiar la categoría a 'finanzas' para que se agrupe con otros módulos financieros
-- (Caja, Bancos, Contabilidad) en la matriz de permisos.
-- ============================================

USE kore_inventory;

-- Actualizar categoría del módulo Finanzas
UPDATE modulos 
SET categoria = 'finanzas',
    orden = 16  -- Colocar antes de Caja (orden 17) para que aparezca primero
WHERE id = 21 
  AND nombre = 'finanzas';

-- Verificar el cambio
SELECT 
    id,
    nombre,
    nombre_mostrar,
    nivel,
    categoria,
    orden,
    activo
FROM modulos
WHERE id = 21;

-- Verificar todos los módulos en categoría 'finanzas'
SELECT 
    id,
    nombre,
    nombre_mostrar,
    categoria,
    orden
FROM modulos
WHERE categoria = 'finanzas'
  AND activo = 1
ORDER BY orden, id;

-- ============================================
-- NOTA: Después de esta actualización, el módulo Finanzas aparecerá
-- correctamente en la sección "FINANZAS" del configurador de permisos,
-- junto con sus submódulos (Cuentas por Cobrar, Recibos de Caja, etc.)
-- ============================================
