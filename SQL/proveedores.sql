-- =============================================
-- Tabla: proveedores
-- Descripción: Gestión de proveedores del inventario
-- Fecha: 2026-02-05
-- =============================================

CREATE TABLE IF NOT EXISTS `proveedores` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `tipo_documento` VARCHAR(20) NOT NULL DEFAULT 'NIT',
  `numero_documento` VARCHAR(50) NOT NULL,
  `razon_social` VARCHAR(200) NOT NULL,
  `nombre_comercial` VARCHAR(200) NULL,
  `nombre_contacto` VARCHAR(200) NULL,
  `telefono` VARCHAR(50) NULL,
  `celular` VARCHAR(50) NULL,
  `email` VARCHAR(100) NULL,
  `sitio_web` VARCHAR(200) NULL,
  `direccion` TEXT NULL,
  `ciudad` VARCHAR(100) NULL,
  `pais` VARCHAR(100) DEFAULT 'Colombia',
  `codigo_postal` VARCHAR(20) NULL,
  `terminos_pago` VARCHAR(100) NULL COMMENT 'Contado, 15 días, 30 días, etc',
  `dias_credito` INT DEFAULT 0,
  `limite_credito` DECIMAL(15,2) DEFAULT 0.00,
  `productos_suministra` TEXT NULL COMMENT 'Categorías o productos principales',
  `banco` VARCHAR(100) NULL,
  `tipo_cuenta` VARCHAR(50) NULL,
  `numero_cuenta` VARCHAR(100) NULL,
  `observaciones` TEXT NULL,
  `estado` TINYINT(1) DEFAULT 1 COMMENT '1=activo, 0=inactivo',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_empresa` (`empresa_id`),
  KEY `idx_documento` (`numero_documento`),
  KEY `idx_razon_social` (`razon_social`),
  KEY `idx_estado` (`estado`),
  CONSTRAINT `proveedores_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índices adicionales para búsquedas
CREATE INDEX idx_proveedores_busqueda ON proveedores(razon_social, numero_documento, nombre_comercial);
CREATE INDEX idx_proveedores_empresa_estado ON proveedores(empresa_id, estado);

-- =============================================
-- Datos de ejemplo
-- =============================================

-- Nota: Los siguientes INSERT son opcionales y se deben ajustar según empresa_id real
-- INSERT INTO `proveedores` 
-- (`empresa_id`, `tipo_documento`, `numero_documento`, `razon_social`, `nombre_comercial`, `nombre_contacto`, `telefono`, `email`, `direccion`, `ciudad`, `terminos_pago`, `dias_credito`, `estado`)
-- VALUES
-- (1, 'NIT', '900123456-1', 'DISTRIBUIDORA TEXTIL S.A.S', 'TexDistribuciones', 'María López', '601-2345678', 'ventas@texdistribuciones.com', 'Calle 45 #12-34', 'Bogotá', '30 días', 30, 1),
-- (1, 'NIT', '890234567-2', 'IMPORTADORA DE CALZADO LTDA', 'CalzaImport', 'Juan Pérez', '602-3456789', 'contacto@calzaimport.com', 'Carrera 20 #30-40', 'Medellín', '15 días', 15, 1);
