-- Fase 5: composición de productos por insumos
-- El stock pasa a decimal para permitir tela en metros, líquidos o gramos.

ALTER TABLE productos_bodegas DROP COLUMN stock_disponible;

ALTER TABLE productos_bodegas
  MODIFY stock_actual DECIMAL(15,3) NOT NULL DEFAULT 0.000,
  MODIFY stock_reservado DECIMAL(15,3) NOT NULL DEFAULT 0.000,
  MODIFY stock_minimo DECIMAL(15,3) NULL DEFAULT 0.000,
  MODIFY stock_maximo DECIMAL(15,3) NULL DEFAULT NULL;

ALTER TABLE productos_bodegas
  ADD COLUMN stock_disponible DECIMAL(15,3)
  GENERATED ALWAYS AS (stock_actual - stock_reservado) VIRTUAL;

ALTER TABLE productos
  MODIFY stock_actual DECIMAL(15,3) NULL DEFAULT 0.000,
  MODIFY stock_minimo DECIMAL(15,3) NULL DEFAULT 0.000,
  MODIFY stock_maximo DECIMAL(15,3) NULL DEFAULT NULL;

ALTER TABLE venta_detalle
  MODIFY cantidad DECIMAL(15,3) NOT NULL;

ALTER TABLE inventario_movimientos
  MODIFY cantidad DECIMAL(15,3) NOT NULL,
  MODIFY stock_anterior DECIMAL(15,3) NOT NULL,
  MODIFY stock_nuevo DECIMAL(15,3) NOT NULL;

-- Insumos que componen un producto. Aplica a recetas de cocina,
-- manufactura o cualquier producto armado a partir de otros.
CREATE TABLE IF NOT EXISTS producto_insumos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  producto_id INT NOT NULL COMMENT 'Producto que se vende',
  insumo_id INT NOT NULL COMMENT 'Producto consumido',
  cantidad DECIMAL(15,4) NOT NULL COMMENT 'Cantidad de insumo por unidad vendida',
  notas VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_producto_insumo (producto_id, insumo_id),
  KEY idx_insumo (insumo_id),
  CONSTRAINT fk_insumo_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_insumo_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  CONSTRAINT fk_insumo_componente FOREIGN KEY (insumo_id) REFERENCES productos(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conserva el comportamiento actual: hoy la venta no valida stock, así que los
-- productos existentes quedan habilitados para venderse sin existencias.
-- El administrador puede desactivar la bandera producto por producto cuando quiera
-- que el sistema bloquee la venta por falta de stock.
UPDATE productos
SET permite_venta_sin_stock = 1
WHERE estado = 'activo'
  AND maneja_inventario = 1
  AND permite_venta_sin_stock = 0;
