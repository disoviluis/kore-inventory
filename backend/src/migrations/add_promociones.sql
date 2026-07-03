-- ==========================================================
-- MIGRACIÓN: Módulo de Promociones de Productos
-- Ejecutar en RDS: mysql -u admin -p kore_inventory < add_promociones.sql
-- ==========================================================

-- 1. Agregar columnas de promoción a la tabla productos
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS en_promocion TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_promocion DECIMAL(15,2) NULL,
  ADD COLUMN IF NOT EXISTS promocion_inicio DATE NULL,
  ADD COLUMN IF NOT EXISTS promocion_fin DATE NULL;

-- 2. Índice para consultas de productos en promoción activa
CREATE INDEX IF NOT EXISTS idx_productos_promocion ON productos (en_promocion, promocion_inicio, promocion_fin);

-- 3. Tabla histórica de promociones (auditoría completa)
CREATE TABLE IF NOT EXISTS productos_promociones (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  producto_id  INT NOT NULL,
  empresa_id   INT NOT NULL,
  precio_original    DECIMAL(15,2) NOT NULL,
  precio_promocion   DECIMAL(15,2) NOT NULL,
  descuento_pct      DECIMAL(5,2) GENERATED ALWAYS AS (
                       ROUND(((precio_original - precio_promocion) / precio_original) * 100, 2)
                     ) STORED,
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NULL,
  activa       TINYINT(1) NOT NULL DEFAULT 1,
  notas        VARCHAR(500) NULL,
  creado_por   INT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pp_producto (producto_id),
  INDEX idx_pp_empresa  (empresa_id),
  INDEX idx_pp_activa   (activa, fecha_inicio, fecha_fin),
  CONSTRAINT fk_pp_producto FOREIGN KEY (producto_id)
    REFERENCES productos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 'Migración add_promociones completada correctamente.' AS resultado;
