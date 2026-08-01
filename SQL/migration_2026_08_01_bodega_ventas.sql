-- ============================================================
-- MIGRACIÓN: bodega_id en ventas
-- Permite saber qué tienda/bodega/punto de venta realizó cada
-- venta, para poder filtrar el histórico y el archivo exportado.
-- Fecha: 2026-08-01
-- ============================================================

-- 1. Agregar columna bodega_id a ventas
ALTER TABLE ventas
ADD COLUMN IF NOT EXISTS bodega_id INT NULL DEFAULT NULL
AFTER vendedor_id;

-- 2. Agregar FK (no bloquea si la bodega se elimina, solo queda NULL)
ALTER TABLE ventas
ADD CONSTRAINT fk_ventas_bodega
FOREIGN KEY (bodega_id) REFERENCES bodegas(id)
ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Índice para filtrar/reportar por bodega
CREATE INDEX idx_ventas_bodega ON ventas(bodega_id);

-- 4. Backfill: para ventas históricas que tengan turno_id, tomar la bodega del turno
UPDATE ventas v
INNER JOIN turnos_caja t ON v.turno_id = t.id
SET v.bodega_id = t.bodega_id
WHERE v.bodega_id IS NULL;

-- 5. Verificar resultado
SELECT
  COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'ventas'
  AND COLUMN_NAME = 'bodega_id';
