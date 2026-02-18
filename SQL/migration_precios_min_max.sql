-- ========================================
-- MIGRACIÓN: Agregar precio_minimo y precio_maximo a productos
-- Fecha: 2026-02-18
-- Descripción: Permite establecer límites de precio para validaciones en POS
-- ========================================

USE kore_inventory;

-- Agregar campos precio_minimo y precio_maximo
ALTER TABLE productos
ADD COLUMN precio_minimo DECIMAL(10, 2) NULL DEFAULT NULL COMMENT 'Precio mínimo permitido para la venta' AFTER precio_distribuidor,
ADD COLUMN precio_maximo DECIMAL(10, 2) NULL DEFAULT NULL COMMENT 'Precio máximo sugerido para la venta' AFTER precio_minimo;

-- Establecer precio_minimo como el precio de compra (costo) por defecto
-- Solo para productos existentes que tengan precio de compra
UPDATE productos 
SET precio_minimo = precio_compra 
WHERE precio_compra > 0 AND precio_minimo IS NULL;

-- Establecer precio_maximo como 1.5x el precio minorista por defecto
-- Solo para productos existentes
UPDATE productos 
SET precio_maximo = precio_minorista * 1.5 
WHERE precio_minorista > 0 AND precio_maximo IS NULL;

-- Verificar la estructura actualizada
SELECT 
    id,
    nombre,
    precio_compra,
    precio_minorista,
    precio_mayorista,
    precio_distribuidor,
    precio_minimo,
    precio_maximo
FROM productos 
LIMIT 5;

-- Comentarios útiles
-- precio_minimo: Normalmente debe ser >= precio_compra (costo)
-- precio_maximo: Límite superior para evitar errores de digitación
-- Si precio_minimo es NULL, no se aplicarán validaciones de mínimo
-- Si precio_maximo es NULL, no se aplicarán validaciones de máximo

SELECT 'Migración completada exitosamente' as status;
