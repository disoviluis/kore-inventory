-- ============================================================================
-- Agregar campo fecha_resolucion (fecha de emisión de la resolución)
-- ============================================================================

USE kore_inventory;

-- Agregar campo para la fecha de emisión de la resolución DIAN
ALTER TABLE empresas ADD COLUMN fecha_resolucion DATE NULL AFTER resolucion_dian;

-- Actualizar empresa con datos de resolución DIAN
UPDATE empresas 
SET 
  resolucion_dian = '18764000045892',
  fecha_resolucion = '2024-03-15',
  fecha_resolucion_desde = '2024-03-15',
  fecha_resolucion_hasta = '2026-03-15',
  prefijo_factura = 'FAC',
  rango_factura_desde = 1,
  rango_factura_hasta = 100000,
  numeracion_actual = 156
WHERE id = 1;

SELECT 'Campo fecha_resolucion agregado y datos actualizados' AS resultado;
