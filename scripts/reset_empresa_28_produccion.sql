-- ============================================
-- RESET COMPLETO EMPRESA 28 PARA PRODUCCIÓN
-- ============================================
-- Fecha: 2026-06-02 4:50 PM (Colombia)
-- Empresa: CIGARRERIA AC (ID: 28)
-- Usuario: bleidyc@multiac.com
-- ============================================

-- IMPORTANTE: Este script:
-- 1. Devuelve inventario de TODAS las ventas (3 ventas)
-- 2. Devuelve inventario de TODAS las cuentas abiertas (18 cuentas)
-- 3. Elimina TODAS las ventas y sus relaciones
-- 4. Elimina TODAS las cuentas abiertas y sus items
-- 5. Limpia movimientos de inventario
-- 6. Resetea contadores para empezar desde 001

START TRANSACTION;

-- ============================================
-- 1. DEVOLVER INVENTARIO DE PRODUCTOS VENDIDOS
-- ============================================
-- VENTAS:
-- FACT-000001: 2x Águila Clásica, 2x Pony malta, 1x Amarillo 1.5L, 1x Amarillo 1/2
-- FACT-000002: 1x Buchanas 750
-- FAC-000002: 1x Amarillo 750ml

UPDATE productos SET stock_actual = stock_actual + 2 WHERE id = 18 AND empresa_id = 28; -- Cerveza Águila Clásica (+2)
UPDATE productos SET stock_actual = stock_actual + 2 WHERE id = 27 AND empresa_id = 28; -- Pony malta (+2)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 32 AND empresa_id = 28; -- Amarillo litro y medio (+1)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 33 AND empresa_id = 28; -- Amarillo 1/2 (+1)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 39 AND empresa_id = 28; -- Buchanas 750 (+1)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 35 AND empresa_id = 28; -- Amarillo 750ml (+1)

-- ============================================
-- 2. DEVOLVER INVENTARIO DE CUENTAS ACTIVAS
-- ============================================
-- CTA-000016: 3x Aguila Light, 4x Poker, 1x Águila Clásica, 1x Smirnoff 750, 1x Smirnoff 375
-- CTA-000017: 3x Poker, 1x Club Colombia, 1x Gatorade
-- CTA-000018: 1x Nectar litro

UPDATE productos SET stock_actual = stock_actual + 3 WHERE id = 19 AND empresa_id = 28; -- Aguila Light (+3 de CTA-016)
UPDATE productos SET stock_actual = stock_actual + 7 WHERE id = 23 AND empresa_id = 28; -- Poker (+4 de CTA-016 + 3 de CTA-017)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 18 AND empresa_id = 28; -- Águila Clásica (+1 de CTA-016)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 40 AND empresa_id = 28; -- Smirnoff 750ml (+1)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 41 AND empresa_id = 28; -- Smirnoff 375ml (+1)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 26 AND empresa_id = 28; -- Club Colombia (+1)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 34 AND empresa_id = 28; -- Gatorade (+1)
UPDATE productos SET stock_actual = stock_actual + 1 WHERE id = 37 AND empresa_id = 28; -- Nectar litro (+1)

-- ============================================
-- 2. ELIMINAR VENTAS DE PRUEBA Y RELACIONES
-- ============================================

-- Eliminar pagos de TODAS las ventas
DELETE FROM venta_pagos 
WHERE venta_id IN (SELECT id FROM ventas WHERE empresa_id = 28);

-- Eliminar detalle de TODAS las ventas
DELETE FROM venta_detalle 
WHERE venta_id IN (SELECT id FROM ventas WHERE empresa_id = 28);

-- Eliminar TODAS las ventas
DELETE FROM ventas WHERE empresa_id = 28;

-- ============================================
-- 3. LIMPIAR TODAS LAS CUENTAS ABIERTAS
-- ============================================

-- Eliminar items de TODAS las cuentas (abiertas, cerradas y canceladas)
DELETE FROM cuenta_abierta_detalle 
WHERE cuenta_abierta_id IN (SELECT id FROM cuentas_abiertas WHERE empresa_id = 28);

-- Eliminar TODAS las cuentas
DELETE FROM cuentas_abiertas WHERE empresa_id = 28;

-- ============================================
-- 4. LIMPIAR MOVIMIENTOS DE INVENTARIO DE PRUEBA
-- ============================================
-- Eliminar movimientos relacionados con cuentas abiertas

DELETE FROM inventario_movimientos 
WHERE producto_id IN (SELECT id FROM productos WHERE empresa_id = 28)
AND (
    motivo LIKE '%cuenta abierta%' 
    OR motivo LIKE '%Cancelación de cuenta%'
);

-- ============================================
-- 5. RESETEAR CONTADORES
-- ============================================

-- Los contadores se manejan automáticamente:
-- - Al no haber ventas, la próxima será: FACT-000001
-- - Al no haber cuentas, la próxima será: CTA-000001

-- Verificar que NO quedan ventas
SELECT 
    'VENTAS RESTANTES' as tabla,
    COUNT(*) as total,
    'Debe ser 0' as esperado
FROM ventas 
WHERE empresa_id = 28;

-- Verificar que NO quedan cuentas abiertas
SELECT 
    'CUENTAS ABIERTAS RESTANTES' as tabla,
    COUNT(*) as total,
    'Debe ser 0' as esperado
FROM cuentas_abiertas 
WHERE empresa_id = 28;

-- ============================================
-- 6. VERIFICACIÓN FINAL
-- ============================================

SELECT '=== RESUMEN DESPUÉS DE LIMPIEZA ===' as info;

SELECT 'Ventas totales' as concepto, COUNT(*) as cantidad, '(debe ser 0)' as nota
FROM ventas WHERE empresa_id = 28
UNION ALL
SELECT 'Detalles de venta' as concepto, COUNT(*) as cantidad, '(debe ser 0)' as nota
FROM venta_detalle vd
JOIN ventas v ON vd.venta_id = v.id
WHERE v.empresa_id = 28
UNION ALL
SELECT 'Pagos de venta' as concepto, COUNT(*) as cantidad, '(debe ser 0)' as nota
FROM venta_pagos vp
JOIN ventas v ON vp.venta_id = v.id
WHERE v.empresa_id = 28
UNION ALL
SELECT 'Cuentas abiertas totales' as concepto, COUNT(*) as cantidad, '(debe ser 0)' as nota
FROM cuentas_abiertas WHERE empresa_id = 28
UNION ALL
SELECT 'Items en cuentas' as concepto, COUNT(*) as cantidad, '(debe ser 0)' as nota
FROM cuenta_abierta_detalle cad
JOIN cuentas_abiertas ca ON cad.cuenta_abierta_id = ca.id
WHERE ca.empresa_id = 28
UNION ALL
SELECT 'Movimientos de inventario' as concepto, COUNT(*) as cantidad, '(todos los de cuentas eliminados)' as nota
FROM inventario_movimientos im
JOIN productos p ON im.producto_id = p.id
WHERE p.empresa_id = 28
AND (im.motivo LIKE '%cuenta abierta%' OR im.motivo LIKE '%Cancelación%');

SELECT '=== STOCK ACTUALIZADO (después de devoluciones) ===' as info;
SELECT id, nombre, stock_actual, 
       CASE 
           WHEN id = 18 THEN '(+3 devueltos: 2 ventas + 1 cuenta)'
           WHEN id = 19 THEN '(+3 devueltos de cuenta)'
           WHEN id = 23 THEN '(+7 devueltos de cuentas)'
           WHEN id = 26 THEN '(+1 devuelto de cuenta)'
           WHEN id = 27 THEN '(+2 devueltos de ventas)'
           WHEN id = 32 THEN '(+1 devuelto de venta)'
           WHEN id = 33 THEN '(+1 devuelto de venta)'
           WHEN id = 34 THEN '(+1 devuelto de cuenta)'
           WHEN id = 35 THEN '(+1 devuelto de venta)'
           WHEN id = 37 THEN '(+1 devuelto de cuenta)'
           WHEN id = 39 THEN '(+1 devuelto de venta)'
           WHEN id = 40 THEN '(+1 devuelto de cuenta)'
           WHEN id = 41 THEN '(+1 devuelto de cuenta)'
           ELSE ''
       END as nota
FROM productos 
WHERE id IN (18, 19, 23, 26, 27, 32, 33, 34, 35, 37, 39, 40, 41)
AND empresa_id = 28
ORDER BY id;

SELECT '=== LISTO PARA PRODUCCIÓN ===' as info;
SELECT 
    'Próxima factura será: FACT-000001' as estado
UNION ALL
SELECT 'Próxima cuenta será: CTA-000001' as estado
UNION ALL
SELECT 'Inventario restaurado completamente' as estado;

-- ============================================
-- SI TODO SE VE BIEN (todos los conteos en 0):
-- EJECUTAR: COMMIT;
-- 
-- SI ALGO SALIÓ MAL:
-- EJECUTAR: ROLLBACK;
-- ============================================
