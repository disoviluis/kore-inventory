-- ============================================
-- MIGRACIÓN: Agregar columna dias_credito
-- Fecha: 2026-02-04
-- Descripción: Agrega días de crédito a clientes
-- ============================================

USE kore_inventory;

-- Agregar columna dias_credito a la tabla clientes
ALTER TABLE clientes 
ADD COLUMN dias_credito INT DEFAULT 0 COMMENT 'Días de crédito permitidos' 
AFTER limite_credito;

-- Verificar que la columna se agregó correctamente
DESCRIBE clientes;
