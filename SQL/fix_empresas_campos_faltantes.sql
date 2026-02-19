-- ============================================================================
-- FIX: Agregar campos faltantes en tabla empresas
-- ============================================================================

USE kore_inventory;

-- Campos que definitivamente faltan
ALTER TABLE empresas ADD COLUMN descripcion TEXT NULL;
ALTER TABLE empresas ADD COLUMN agente_retenedor_iva BOOLEAN DEFAULT FALSE;
ALTER TABLE empresas ADD COLUMN agente_retenedor_ica BOOLEAN DEFAULT FALSE;
ALTER TABLE empresas ADD COLUMN numeracion_actual INT DEFAULT 1;
ALTER TABLE empresas ADD COLUMN software_id VARCHAR(50) NULL;
ALTER TABLE empresas ADD COLUMN pin_software VARCHAR(20) NULL;
ALTER TABLE empresas ADD COLUMN ambiente ENUM('pruebas', 'produccion') DEFAULT 'pruebas';

SELECT 'Columnas agregadas exitosamente' AS resultado;
