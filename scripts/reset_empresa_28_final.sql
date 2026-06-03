-- ============================================
-- RESET DEFINITIVO EMPRESA 28 PARA PRODUCCIÓN
-- ============================================
-- Fecha: 2026-06-03
-- Empresa: CIGARRERIA AC (ID: 28)
-- Usuario: bleidyc@multiac.com
-- ============================================

-- Este script elimina TODO:
-- - 5 ventas (FACT-000001, FACT-000002, FAC-000002, FACT-000004, FACT-000005)
-- - 18 cuentas abiertas (incluyendo 1 activa)
-- - Devuelve todo el inventario
-- - Resetea contadores a 001

START TRANSACTION;

-- ============================================
-- 1. DEVOLVER INVENTARIO DE TODAS LAS VENTAS
-- ============================================

UPDATE productos SET stock_actual = stock_actual + 3 WHERE id = 18 AND empresa_id = 28; -- Cerveza Águila Clásica (+3)
UPDATE productos SET stock_actual = stock_actual + 3 WHERE id = 19 AND empresa_id = 28; -- Aguila Light (+3)
UPDATE productos SET stock_actual = stock_actual + 7 WHERE id = 23 AND empresa_id = 28; -- Poker (+7)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 26 AND empresa_id = 28; -- Club Colombia (+1)
UPDATE productos SET stock_actual = stock_actual + 2 WHERE id = 27 AND empresa_id = 28; -- Pony malta (+2)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 32 AND empresa_id = 28; -- Amarillo litro y medio (+1)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 33 AND empresa_id = 28; -- Amarillo 1/2 (+1)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 34 AND empresa_id = 28; -- Gatorade (+1)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 35 AND empresa_id = 28; -- Amarillo 750ml (+1)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 37 AND empresa_id = 28; -- Nectar litro (+1 de cuenta activa)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 39 AND empresa_id = 28; -- Buchanas 750 (+1)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 40 AND empresa_id = 28; -- Smirnoff 750ml (+1)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 41 AND empresa_id = 28; -- Smirnoff 375ml (+1)

-- ============================================
-- 2. ELIMINAR TODAS LAS VENTAS Y RELACIONES
-- ============================================

-- Eliminar pagos
DELETE FROM venta_pagos 
WHERE venta_id IN (SELECT id FROM ventas WHERE empresa_id = 28);

-- Eliminar detalles
DELETE FROM venta_detalle 
WHERE venta_id IN (SELECT id FROM ventas WHERE empresa_id = 28);

-- Eliminar ventas
DELETE FROM ventas WHERE empresa_id = 28;

-- ============================================
-- 3. ELIMINAR TODAS LAS CUENTAS ABIERTAS
-- ============================================

-- Eliminar items de cuentas
DELETE FROM cuenta_abierta_detalle 
WHERE cuenta_abierta_id IN (SELECT id FROM cuentas_abiertas WHERE empresa_id = 28);

-- Eliminar todas las cuentas (abiertas, cerradas y canceladas)
DELETE FROM cuentas_abiertas WHERE empresa_id = 28;

-- ============================================
-- 4. LIMPIAR MOVIMIENTOS DE INVENTARIO
-- ============================================

DELETE FROM inventario_movimientos 
WHERE producto_id IN (SELECT id FROM productos WHERE empresa_id = 28)
AND (
    motivo LIKE '%cuenta abierta%' 
    OR motivo LIKE '%Cancelación de cuenta%'
    OR motivo LIKE '%Venta%'
);

-- ============================================
-- 5. VERIFICACIÓN ANTES DE COMMIT
-- ============================================

SELECT '=== VERIFICACIÓN FINAL ===' as info;

SELECT 'Ventas eliminadas' as concepto, COUNT(*) as cantidad, '(debe ser 0)' as esperado
FROM ventas WHERE empresa_id = 28
UNION ALL
SELECT 'Cuentas eliminadas' as concepto, COUNT(*) as cantidad, '(debe ser 0)' as esperado
FROM cuentas_abiertas WHERE empresa_id = 28
UNION ALL
SELECT 'Items en cuentas' as concepto, COUNT(*) as cantidad, '(debe ser 0)' as esperado
FROM cuenta_abierta_detalle cad
JOIN cuentas_abiertas ca ON cad.cuenta_abierta_id = ca.id
WHERE ca.empresa_id = 28;

SELECT '=== INVENTARIO RESTAURADO ===' as info;
SELECT id, nombre, stock_actual
FROM productos 
WHERE id IN (18, 19, 23, 26, 27, 32, 33, 34, 35, 37, 39, 40, 41)
AND empresa_id = 28
ORDER BY id;

-- ============================================
-- CONFIRMAR CAMBIOS
-- ============================================
COMMIT;

SELECT '=== ✅ RESET COMPLETADO ===' as resultado;
SELECT 'Próxima factura: FACT-000001' as estado
UNION ALL
SELECT 'Próxima cuenta: CTA-000001' as estado
UNION ALL  
SELECT 'Base de datos lista para producción' as estado;
