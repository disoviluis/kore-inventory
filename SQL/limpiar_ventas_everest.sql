-- ============================================
-- Script: Limpiar ventas de EVEREST SA (empresa_id = 6)
-- Fecha: 2026-02-20
-- Descripción: Eliminar todas las ventas y resetear numeración a 1
-- ADVERTENCIA: Este script eliminará TODAS las ventas de EVEREST
-- ============================================

-- Mostrar información antes de eliminar
SELECT 
    'ANTES DE ELIMINAR' as accion,
    COUNT(*) as total_ventas,
    MIN(id) as primera_venta,
    MAX(id) as ultima_venta,
    SUM(total) as total_vendido
FROM ventas 
WHERE empresa_id = 6;

-- 1. Eliminar detalles de ventas (por foreign key)
DELETE FROM venta_detalle 
WHERE venta_id IN (SELECT id FROM ventas WHERE empresa_id = 6);

-- 2. Eliminar pagos de ventas (si existe la tabla)
DELETE FROM venta_pagos 
WHERE venta_id IN (SELECT id FROM ventas WHERE empresa_id = 6);

-- 3. Eliminar impuestos de ventas (si existe la tabla)
DELETE FROM venta_impuestos 
WHERE venta_id IN (SELECT id FROM ventas WHERE empresa_id = 6);

-- 4. Eliminar ventas
DELETE FROM ventas 
WHERE empresa_id = 6;

-- 5. Resetear contador de numeración en empresa
UPDATE empresas 
SET numeracion_actual = 0 
WHERE id = 6;

-- Mostrar resumen final
SELECT 
    'DESPUÉS DE ELIMINAR' as accion,
    COUNT(*) as total_ventas,
    (SELECT numeracion_actual FROM empresas WHERE id = 6) as numeracion_actual
FROM ventas 
WHERE empresa_id = 6;

SELECT 'Ventas de EVEREST eliminadas exitosamente. Próxima factura será: FV-000001' as resultado;
