-- =====================================================
-- MIGRACIÓN: Agregar campos de plantilla de factura
-- Fecha: 2026-02-20
-- Descripción: Agrega plantilla_id y mostrar_badges a configuracion_factura
-- =====================================================

USE kore_inventory;

-- Agregar campo plantilla_id (1-5)
ALTER TABLE configuracion_factura 
ADD COLUMN plantilla_id INT NOT NULL DEFAULT 1 
COMMENT '1=Clásica, 2=Moderna, 3=Minimalista, 4=Corporativa, 5=SIIGO' 
AFTER empresa_id;

-- Agregar campo mostrar_badges (mostrar badges como Gran Contribuyente)
ALTER TABLE configuracion_factura 
ADD COLUMN mostrar_badges TINYINT(1) DEFAULT 1 
COMMENT 'Mostrar badges como Gran Contribuyente, Régimen, etc.' 
AFTER mostrar_cufe;

-- Verificar cambios
SELECT 
    'Migración completada exitosamente' as status,
    COUNT(*) as registros_actualizados
FROM configuracion_factura;

-- Mostrar estructura actualizada
DESCRIBE configuracion_factura;
