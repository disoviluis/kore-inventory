-- =====================================================
-- MIGRACIÓN: SISTEMA DE PAGOS MÚLTIPLES
-- Permite registrar múltiples métodos de pago en una venta
-- Fecha: 2026-02-16
-- =====================================================

USE kore_inventory;

-- 1. Crear tabla venta_pagos
CREATE TABLE IF NOT EXISTS `venta_pagos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `venta_id` INT NOT NULL COMMENT 'ID de la venta',
  `metodo_pago` ENUM(
    'efectivo', 
    'tarjeta_debito', 
    'tarjeta_credito', 
    'transferencia', 
    'cheque', 
    'nequi',
    'daviplata',
    'otro'
  ) NOT NULL COMMENT 'Método de pago utilizado',
  `monto` DECIMAL(15,2) NOT NULL COMMENT 'Monto pagado con este método',
  `referencia` VARCHAR(100) DEFAULT NULL COMMENT 'Número de transacción, cheque, etc.',
  `banco` VARCHAR(100) DEFAULT NULL COMMENT 'Banco emisor para tarjetas/cheques',
  `notas` TEXT DEFAULT NULL COMMENT 'Observaciones adicionales',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (`venta_id`) REFERENCES `ventas`(`id`) ON DELETE CASCADE,
  
  INDEX `idx_venta_id` (`venta_id`),
  INDEX `idx_metodo_pago` (`metodo_pago`),
  INDEX `idx_fecha` (`created_at`)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Registro de métodos de pago en cada venta - Soporta pagos múltiples';

-- 2. Modificar tabla ventas para soportar pagos mixtos
ALTER TABLE `ventas` 
MODIFY COLUMN `metodo_pago` VARCHAR(50) 
COMMENT 'Método principal o "mixto" si hay múltiples pagos';

-- 3. Agregar índices para reportes de caja
ALTER TABLE `venta_pagos` 
ADD INDEX `idx_metodo_fecha` (`metodo_pago`, `created_at`);

-- 4. Agregar constraint para validar montos positivos
ALTER TABLE `venta_pagos` 
ADD CONSTRAINT `chk_monto_positivo` CHECK (`monto` > 0);

-- =====================================================
-- QUERIES ÚTILES PARA REPORTES
-- =====================================================

-- Ver pagos de una venta específica
-- SELECT * FROM venta_pagos WHERE venta_id = ?;

-- Resumen de ventas por método de pago (hoy)
-- SELECT 
--   metodo_pago,
--   COUNT(*) as cantidad_transacciones,
--   SUM(monto) as total_recaudado
-- FROM venta_pagos
-- WHERE DATE(created_at) = CURDATE()
-- GROUP BY metodo_pago;

-- Ventas con pagos múltiples
-- SELECT 
--   v.id,
--   v.numero_factura,
--   v.total,
--   COUNT(vp.id) as cantidad_metodos,
--   GROUP_CONCAT(CONCAT(vp.metodo_pago, ': $', vp.monto) SEPARATOR ', ') as detalle_pagos
-- FROM ventas v
-- INNER JOIN venta_pagos vp ON v.id = vp.venta_id
-- GROUP BY v.id
-- HAVING cantidad_metodos > 1;

-- =====================================================
-- DATOS DE EJEMPLO (Opcional - comentado)
-- =====================================================

-- Ejemplo de venta con pago único
-- INSERT INTO venta_pagos (venta_id, metodo_pago, monto) 
-- VALUES (1, 'efectivo', 150000.00);

-- Ejemplo de venta con pagos múltiples
-- INSERT INTO venta_pagos (venta_id, metodo_pago, monto, referencia, banco) VALUES
-- (2, 'efectivo', 80000.00, NULL, NULL),
-- (2, 'tarjeta_debito', 50000.00, 'TRX-123456', 'Bancolombia'),
-- (2, 'transferencia', 20000.00, 'TRF-789012', 'Davivienda');

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
