-- =============================================
-- SCRIPT DE DEPLOYMENT: Módulo Proveedores
-- Ejecutar en RDS MySQL
-- =============================================

-- 1. Crear tabla proveedores
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
  `terminos_pago` VARCHAR(100) NULL,
  `dias_credito` INT DEFAULT 0,
  `limite_credito` DECIMAL(15,2) DEFAULT 0.00,
  `productos_suministra` TEXT NULL,
  `banco` VARCHAR(100) NULL,
  `tipo_cuenta` VARCHAR(50) NULL,
  `numero_cuenta` VARCHAR(100) NULL,
  `observaciones` TEXT NULL,
  `estado` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_empresa` (`empresa_id`),
  KEY `idx_documento` (`numero_documento`),
  KEY `idx_razon_social` (`razon_social`),
  KEY `idx_estado` (`estado`),
  CONSTRAINT `proveedores_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Índices adicionales
CREATE INDEX idx_proveedores_busqueda ON proveedores(razon_social, numero_documento, nombre_comercial);
CREATE INDEX idx_proveedores_empresa_estado ON proveedores(empresa_id, estado);

-- 3. Verificar creación
DESCRIBE proveedores;

-- 4. Verificar foreign key
SHOW CREATE TABLE proveedores;
