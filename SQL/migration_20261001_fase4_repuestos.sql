-- Fase 4: metadatos de repuestos vinculados al catalogo existente de productos.
-- Destino: MySQL 8.4.8 / kore_inventory en AWS RDS.
-- Ejecutar manualmente despues de migration_20261001_fase2_activos_inventarios.sql.
-- No modifica productos, productos_bodegas ni sus cantidades.
-- Las cantidades y movimientos siguen perteneciendo al modulo de inventario existente.

SELECT DATABASE() AS esquema_destino, VERSION() AS version_mysql;

CREATE TABLE IF NOT EXISTS repuestos_catalogo (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  producto_id INT NOT NULL,
  numero_parte VARCHAR(120) NULL,
  marca_fabricante VARCHAR(100) NULL,
  serializado TINYINT(1) NOT NULL DEFAULT 0,
  estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  creado_por INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_repuesto_producto (producto_id),
  UNIQUE KEY uk_repuesto_empresa_numero_parte (empresa_id, numero_parte),
  KEY idx_repuesto_empresa_estado (empresa_id, estado, serializado),
  CONSTRAINT fk_repuesto_catalogo_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_repuesto_catalogo_producto FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT fk_repuesto_catalogo_creador FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verificacion: debe aparecer una unica ficha por producto y empresa.
SHOW CREATE TABLE repuestos_catalogo;
