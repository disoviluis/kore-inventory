-- ============================================================
-- MIGRACIÓN: Costo Promedio Ponderado (CPP) en movimientos
-- Fecha: 2026-07-07
-- Descripción: Agrega columna costo_unitario a inventario_movimientos
--              para registrar el costo al momento del movimiento.
--              Compatible con registros existentes (nullable).
-- ============================================================

ALTER TABLE inventario_movimientos
  ADD COLUMN costo_unitario DECIMAL(10,4) NULL COMMENT 'Costo unitario al momento del movimiento (CPP o precio compra)' AFTER stock_nuevo,
  ADD COLUMN precio_costo_anterior DECIMAL(10,4) NULL COMMENT 'Precio de compra anterior antes del recalculo CPP' AFTER costo_unitario;
