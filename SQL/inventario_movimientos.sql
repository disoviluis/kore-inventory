-- Tabla de movimientos de inventario
CREATE TABLE IF NOT EXISTS `inventario_movimientos` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'ID único del movimiento',
  `producto_id` int(11) NOT NULL COMMENT 'ID del producto',
  `tipo_movimiento` enum('entrada','salida','ajuste','devolucion') NOT NULL COMMENT 'Tipo de movimiento',
  `cantidad` int(11) NOT NULL COMMENT 'Cantidad del movimiento',
  `stock_anterior` int(11) NOT NULL COMMENT 'Stock antes del movimiento',
  `stock_nuevo` int(11) NOT NULL COMMENT 'Stock después del movimiento',
  `motivo` varchar(100) DEFAULT NULL COMMENT 'Motivo del movimiento',
  `referencia_tipo` enum('venta','compra','ajuste','devolucion','produccion') DEFAULT NULL COMMENT 'Tipo de referencia',
  `referencia_id` int(11) DEFAULT NULL COMMENT 'ID de la referencia',
  `usuario_id` int(11) DEFAULT NULL COMMENT 'ID del usuario que realizó el movimiento',
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha del movimiento',
  `notas` text DEFAULT NULL COMMENT 'Notas adicionales',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
  PRIMARY KEY (`id`),
  KEY `idx_producto` (`producto_id`),
  KEY `idx_tipo` (`tipo_movimiento`),
  KEY `idx_fecha` (`fecha`),
  KEY `idx_referencia` (`referencia_tipo`, `referencia_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Movimientos de inventario';
