-- =====================================================
-- MIGRACIÓN: Mejoras en Productos y Ventas
-- Fecha: 2026-02-12
-- Descripción: 
--   1. Agregar campo para IVA incluido en precio
--   2. Agregar campo para permitir ventas sin stock
--   3. Agregar campos para ventas contra pedido
-- =====================================================

USE kore_inventory;

-- =====================================================
-- 1. TABLA PRODUCTOS
-- =====================================================

-- Agregar campo para indicar si el precio incluye IVA
ALTER TABLE productos 
ADD COLUMN iva_incluido_en_precio BOOLEAN DEFAULT FALSE 
COMMENT 'Indica si el precio ya incluye el IVA calculado' 
AFTER porcentaje_iva;

-- Agregar campo para permitir ventas sin stock
ALTER TABLE productos 
ADD COLUMN permite_venta_sin_stock BOOLEAN DEFAULT FALSE 
COMMENT 'Permite realizar ventas aunque no haya stock disponible'
AFTER ubicacion_almacen;

-- =====================================================
-- 2. TABLA VENTA_DETALLE
-- =====================================================

-- Agregar campo para tipo de venta
ALTER TABLE venta_detalle
ADD COLUMN tipo_venta ENUM('normal', 'contra_pedido') DEFAULT 'normal'
COMMENT 'Tipo de venta: normal (con stock) o contra pedido (sin stock)'
AFTER descuento;

-- Agregar campo para estado de entrega
ALTER TABLE venta_detalle
ADD COLUMN estado_entrega ENUM('entregado', 'pendiente', 'en_transito') DEFAULT 'entregado'
COMMENT 'Estado de entrega del producto'
AFTER tipo_venta;

-- Agregar campo para fecha estimada de entrega
ALTER TABLE venta_detalle
ADD COLUMN fecha_entrega_estimada DATE NULL
COMMENT 'Fecha estimada de entrega para ventas contra pedido'
AFTER estado_entrega;

-- Agregar campo para notas de entrega
ALTER TABLE venta_detalle
ADD COLUMN notas_entrega TEXT NULL
COMMENT 'Notas adicionales sobre la entrega del producto'
AFTER fecha_entrega_estimada;

-- =====================================================
-- 3. CREAR ÍNDICES PARA MEJORAR RENDIMIENTO
-- =====================================================

-- Índice para productos que permiten venta sin stock
CREATE INDEX idx_permite_venta_sin_stock 
ON productos(permite_venta_sin_stock, estado);

-- Índice para búsqueda de ventas contra pedido pendientes
CREATE INDEX idx_venta_detalle_estado_entrega 
ON venta_detalle(estado_entrega, tipo_venta);

-- =====================================================
-- 4. ACTUALIZAR PRODUCTOS EXISTENTES (OPCIONAL)
-- =====================================================

-- Por defecto, los productos de tipo 'servicio' no manejan inventario
-- y pueden venderse sin stock
UPDATE productos 
SET permite_venta_sin_stock = TRUE 
WHERE tipo = 'servicio' OR maneja_inventario = FALSE;

-- =====================================================
-- 5. AUDITORÍA
-- =====================================================

INSERT INTO auditoria_logs (
    usuario_id, 
    accion, 
    tabla, 
    descripcion, 
    created_at
) VALUES (
    NULL,
    'migracion',
    'productos',
    'Migración: Agregados campos iva_incluido_en_precio y permite_venta_sin_stock',
    NOW()
);

INSERT INTO auditoria_logs (
    usuario_id, 
    accion, 
    tabla, 
    descripcion, 
    created_at
) VALUES (
    NULL,
    'migracion',
    'venta_detalle',
    'Migración: Agregados campos tipo_venta, estado_entrega, fecha_entrega_estimada y notas_entrega',
    NOW()
);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar que las columnas se agregaron correctamente
SELECT 
    'productos' as tabla,
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'kore_inventory' 
    AND TABLE_NAME = 'productos'
    AND COLUMN_NAME IN ('iva_incluido_en_precio', 'permite_venta_sin_stock')

UNION ALL

SELECT 
    'venta_detalle' as tabla,
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'kore_inventory' 
    AND TABLE_NAME = 'venta_detalle'
    AND COLUMN_NAME IN ('tipo_venta', 'estado_entrega', 'fecha_entrega_estimada', 'notas_entrega');

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
