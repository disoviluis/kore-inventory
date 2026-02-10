-- =============================================
-- TABLA: compras
-- Gestión de órdenes de compra y recepciones
-- =============================================

CREATE TABLE IF NOT EXISTS `compras` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` INT(11) NOT NULL,
  `proveedor_id` INT(11) NOT NULL,
  `numero_compra` VARCHAR(50) NOT NULL,
  `fecha_compra` DATE NOT NULL,
  `tipo_compra` ENUM('contado','credito') NOT NULL DEFAULT 'contado',
  `subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `impuestos` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `descuento` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `estado` ENUM('pendiente','recibida','parcial','anulada') NOT NULL DEFAULT 'pendiente',
  `fecha_recepcion` DATE NULL,
  `notas` TEXT NULL,
  `usuario_id` INT(11) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_numero_compra_empresa` (`numero_compra`, `empresa_id`),
  KEY `idx_empresa` (`empresa_id`),
  KEY `idx_proveedor` (`proveedor_id`),
  KEY `idx_fecha` (`fecha_compra`),
  KEY `idx_estado` (`estado`),
  KEY `idx_usuario` (`usuario_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- TABLA: compras_detalle
-- Detalle de productos en cada compra
-- =============================================

CREATE TABLE IF NOT EXISTS `compras_detalle` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `compra_id` INT(11) NOT NULL,
  `producto_id` INT(11) NOT NULL,
  `cantidad` INT(11) NOT NULL,
  `precio_unitario` DECIMAL(10,2) NOT NULL,
  `subtotal` DECIMAL(10,2) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_compra` (`compra_id`),
  KEY `idx_producto` (`producto_id`),
  CONSTRAINT `fk_compras_detalle_compra` FOREIGN KEY (`compra_id`) REFERENCES `compras` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
