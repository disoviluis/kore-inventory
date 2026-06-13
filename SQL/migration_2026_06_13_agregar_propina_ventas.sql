-- ========================================
-- MIGRACIÓN: Agregar funcionalidad de propinas a ventas
-- Fecha: 2026-06-13
-- Descripción: Permite registrar propinas en las ventas
-- La propina NO forma parte de la base gravable del IVA
-- ========================================

USE kore_inventory;

-- Agregar campos de propina a la tabla ventas
ALTER TABLE ventas 
ADD COLUMN propina_habilitada BOOLEAN DEFAULT FALSE COMMENT 'Indica si el cliente aceptó pagar propina',
ADD COLUMN propina_porcentaje DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Porcentaje de propina (ej: 5.00 para 5%)',
ADD COLUMN propina_valor DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Valor calculado de la propina en pesos',
ADD COLUMN propina_base DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Base sobre la que se calcula la propina (subtotal sin descuento)';

-- Crear índice para búsquedas
ALTER TABLE ventas
ADD INDEX idx_propina_habilitada (propina_habilitada, empresa_id, fecha_venta);

-- ========================================
-- DATOS DE PRUEBA (OPCIONAL - Comentar si no deseas datos de prueba)
-- ========================================

-- Actualizar una venta existente con propina (solo para pruebas)
-- UPDATE ventas 
-- SET 
--     propina_habilitada = TRUE,
--     propina_porcentaje = 5.00,
--     propina_base = subtotal,
--     propina_valor = subtotal * 0.05,
--     total = total + (subtotal * 0.05)
-- WHERE id = 1 AND empresa_id = 1;

-- ========================================
-- VERIFICACIÓN
-- ========================================

-- Verificar que los campos se agregaron correctamente
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT, 
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'kore_inventory' 
  AND TABLE_NAME = 'ventas'
  AND COLUMN_NAME LIKE 'propina%';

-- Mostrar estructura actualizada de la tabla
DESCRIBE ventas;

-- ========================================
-- ROLLBACK (En caso de necesitar revertir)
-- ========================================

-- Para revertir esta migración, ejecutar:
-- ALTER TABLE ventas 
-- DROP COLUMN propina_habilitada,
-- DROP COLUMN propina_porcentaje,
-- DROP COLUMN propina_valor,
-- DROP COLUMN propina_base,
-- DROP INDEX idx_propina_habilitada;

-- ========================================
-- NOTAS IMPORTANTES
-- ========================================

/*
1. La propina se calcula sobre el NETO (subtotal sin descuento)
2. La propina NO afecta la base gravable del IVA
3. El cálculo es:
   - Base propina = subtotal (antes de descuentos)
   - Valor propina = base_propina * (porcentaje / 100)
   - Total final = (subtotal - descuento) + IVA + impuestos_adicionales + propina

4. Ejemplo:
   Consumos (neto):       $95,238.10
   Descuento:             $0.00
   Base para IVA:         $95,238.10
   IVA 5%:                $4,761.90
   Total factura:         $100,000.00
   Propina sugerida 5%:   $4,761.90  (sobre el neto de $95,238.10)
   TOTAL A PAGAR:         $104,761.90

5. La propina es voluntaria y debe ser aceptada por el cliente mediante checkbox
*/
