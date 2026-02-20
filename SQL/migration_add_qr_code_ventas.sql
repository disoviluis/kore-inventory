-- ============================================
-- Migración: Agregar columna qr_code a tabla ventas
-- Fecha: 2026-02-20
-- Descripción: Agregar columna para almacenar QR code de facturas electrónicas
-- ============================================

-- Agregar columna qr_code después de cufe
ALTER TABLE ventas 
ADD COLUMN qr_code TEXT NULL 
COMMENT 'QR Code en formato base64 para factura electrónica' 
AFTER cufe;

-- Verificar estructura actualizada
SELECT 'Migración completada: columna qr_code agregada exitosamente' as status;
