-- ========================================
-- MIGRACIÓN: Sistema de Impuestos Adicionales
-- Fecha: 2026-02-16
-- Descripción: Tabla para manejar impuestos configurables
-- como retención en la fuente, ICA, retención de IVA, etc.
-- ========================================

-- 1. Tabla de impuestos configurables
CREATE TABLE IF NOT EXISTS `impuestos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `empresa_id` INT NOT NULL,
  `codigo` VARCHAR(20) NOT NULL COMMENT 'Código único del impuesto (RTE_FTE, ICA, RTE_IVA)',
  `nombre` VARCHAR(100) NOT NULL COMMENT 'Nombre descriptivo del impuesto',
  `descripcion` TEXT COMMENT 'Descripción detallada',
  `tipo` ENUM('porcentaje', 'valor_fijo') DEFAULT 'porcentaje' COMMENT 'Tipo de cálculo',
  `tasa` DECIMAL(5,2) NOT NULL COMMENT 'Tasa o valor del impuesto',
  `aplica_sobre` ENUM('subtotal', 'iva', 'total') DEFAULT 'subtotal' COMMENT 'Base de cálculo',
  `afecta_total` ENUM('suma', 'resta') DEFAULT 'resta' COMMENT 'Si suma o resta al total final',
  `aplica_automaticamente` TINYINT(1) DEFAULT 0 COMMENT 'Se aplica automáticamente según tipo de cliente',
  `requiere_autorizacion` TINYINT(1) DEFAULT 0 COMMENT 'Requiere autorización especial',
  `cuenta_contable` VARCHAR(20) COMMENT 'Código de cuenta contable',
  `orden` INT DEFAULT 0 COMMENT 'Orden de aplicación',
  `activo` TINYINT(1) DEFAULT 1,
  `creado_por` INT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  UNIQUE KEY `unique_codigo_empresa` (empresa_id, codigo),
  INDEX `idx_empresa_activo` (empresa_id, activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Impuestos adicionales configurables por empresa';

-- 2. Tabla de impuestos aplicados a ventas
CREATE TABLE IF NOT EXISTS `venta_impuestos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `venta_id` INT NOT NULL,
  `impuesto_id` INT NOT NULL,
  `codigo_impuesto` VARCHAR(20) NOT NULL COMMENT 'Copia del código por historial',
  `nombre_impuesto` VARCHAR(100) NOT NULL COMMENT 'Copia del nombre por historial',
  `base_gravable` DECIMAL(15,2) NOT NULL COMMENT 'Monto sobre el que se calculó',
  `tasa` DECIMAL(5,2) NOT NULL COMMENT 'Tasa aplicada (copia por historial)',
  `valor` DECIMAL(15,2) NOT NULL COMMENT 'Valor calculado del impuesto',
  `tipo_afectacion` ENUM('suma', 'resta') DEFAULT 'suma' COMMENT 'Si suma o resta',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
  FOREIGN KEY (impuesto_id) REFERENCES impuestos(id) ON DELETE RESTRICT,
  INDEX `idx_venta` (venta_id),
  INDEX `idx_impuesto` (impuesto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Registro de impuestos aplicados en cada venta';

-- 3. Agregar campos de retención a la tabla clientes
ALTER TABLE `clientes` 
ADD COLUMN `aplica_retencion_fuente` TINYINT(1) DEFAULT 0 COMMENT 'Cliente sujeto a retención en la fuente' AFTER `tipo_cliente`,
ADD COLUMN `tasa_retencion_fuente` DECIMAL(5,2) DEFAULT 2.5 COMMENT 'Tasa de retención en la fuente',
ADD COLUMN `aplica_retencion_iva` TINYINT(1) DEFAULT 0 COMMENT 'Cliente sujeto a retención de IVA',
ADD COLUMN `tasa_retencion_iva` DECIMAL(5,2) DEFAULT 15.0 COMMENT 'Tasa de retención de IVA',
ADD COLUMN `aplica_ica` TINYINT(1) DEFAULT 0 COMMENT 'Cliente sujeto a ICA',
ADD COLUMN `tasa_ica` DECIMAL(5,2) DEFAULT 0.966 COMMENT 'Tasa de ICA';

-- 4. Modificar tabla ventas para incluir campos de impuestos adicionales
ALTER TABLE `ventas`
ADD COLUMN `impuestos_adicionales` DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Total de impuestos que suman' AFTER `impuesto`,
ADD COLUMN `retenciones` DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Total de retenciones que restan' AFTER `impuestos_adicionales`;

-- 5. Insertar impuestos predeterminados para Colombia
-- (Solo para empresas existentes, ajustar empresa_id según sea necesario)

INSERT INTO `impuestos` (
  `empresa_id`, `codigo`, `nombre`, `descripcion`, `tipo`, `tasa`, 
  `aplica_sobre`, `afecta_total`, `aplica_automaticamente`, `orden`, `activo`
) VALUES
-- Retención en la Fuente
(1, 'RTE_FTE', 'Retención en la Fuente', 'Retención en la fuente sobre compras. Art. 392 ET', 'porcentaje', 2.5, 'subtotal', 'resta', 1, 1, 1),
(2, 'RTE_FTE', 'Retención en la Fuente', 'Retención en la fuente sobre compras. Art. 392 ET', 'porcentaje', 2.5, 'subtotal', 'resta', 1, 1, 1),
(3, 'RTE_FTE', 'Retención en la Fuente', 'Retención en la fuente sobre compras. Art. 392 ET', 'porcentaje', 2.5, 'subtotal', 'resta', 1, 1, 1),
(4, 'RTE_FTE', 'Retención en la Fuente', 'Retención en la fuente sobre compras. Art. 392 ET', 'porcentaje', 2.5, 'subtotal', 'resta', 1, 1, 1),

-- Retención de IVA
(1, 'RTE_IVA', 'Retención de IVA', 'Retención del impuesto sobre las ventas. Art. 437-2 ET', 'porcentaje', 15.0, 'iva', 'resta', 1, 2, 1),
(2, 'RTE_IVA', 'Retención de IVA', 'Retención del impuesto sobre las ventas. Art. 437-2 ET', 'porcentaje', 15.0, 'iva', 'resta', 1, 2, 1),
(3, 'RTE_IVA', 'Retención de IVA', 'Retención del impuesto sobre las ventas. Art. 437-2 ET', 'porcentaje', 15.0, 'iva', 'resta', 1, 2, 1),
(4, 'RTE_IVA', 'Retención de IVA', 'Retención del impuesto sobre las ventas. Art. 437-2 ET', 'porcentaje', 15.0, 'iva', 'resta', 1, 2, 1),

-- Impuesto de Industria y Comercio
(1, 'ICA', 'Impuesto de Industria y Comercio', 'ICA según actividad económica y municipio', 'porcentaje', 0.966, 'subtotal', 'suma', 0, 3, 1),
(2, 'ICA', 'Impuesto de Industria y Comercio', 'ICA según actividad económica y municipio', 'porcentaje', 0.966, 'subtotal', 'suma', 0, 3, 1),
(3, 'ICA', 'Impuesto de Industria y Comercio', 'ICA según actividad económica y municipio', 'porcentaje', 0.966, 'subtotal', 'suma', 0, 3, 1),
(4, 'ICA', 'Impuesto de Industria y Comercio', 'ICA según actividad económica y municipio', 'porcentaje', 0.966, 'subtotal', 'suma', 0, 3, 1)

ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- ========================================
-- FIN DE MIGRACIÓN
-- ========================================
