-- Comandas Fase 1: estructura para toma de pedidos y tablero de cocina

-- Mesero responsable de la cuenta (para propinas y control de mesas)
SET @existe := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cuentas_abiertas' AND COLUMN_NAME = 'mesero_id');
SET @sql := IF(@existe = 0,
  'ALTER TABLE cuentas_abiertas ADD COLUMN mesero_id INT NULL AFTER usuario_apertura,
   ADD CONSTRAINT fk_cuenta_mesero FOREIGN KEY (mesero_id) REFERENCES usuarios(id) ON DELETE SET NULL',
  'SELECT "cuentas_abiertas.mesero_id ya existe" AS mensaje');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @existe := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ventas' AND COLUMN_NAME = 'mesero_id');
SET @sql := IF(@existe = 0,
  'ALTER TABLE ventas ADD COLUMN mesero_id INT NULL,
   ADD CONSTRAINT fk_venta_mesero FOREIGN KEY (mesero_id) REFERENCES usuarios(id) ON DELETE SET NULL',
  'SELECT "ventas.mesero_id ya existe" AS mensaje');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Estación de despacho: separa la pantalla de cocina de la de bar
SET @existe := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categorias' AND COLUMN_NAME = 'estacion');
SET @sql := IF(@existe = 0,
  'ALTER TABLE categorias ADD COLUMN estacion ENUM("cocina","bar","postres","otro") NOT NULL DEFAULT "cocina"',
  'SELECT "categorias.estacion ya existe" AS mensaje');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Cada envío a cocina genera una comanda con consecutivo por empresa
CREATE TABLE IF NOT EXISTS comandas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  cuenta_abierta_id INT NOT NULL,
  numero_comanda INT NOT NULL,
  mesero_id INT NOT NULL,
  estado ENUM('pendiente','en_preparacion','lista','entregada','cancelada') NOT NULL DEFAULT 'pendiente',
  observaciones VARCHAR(500) NULL,
  fecha_envio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_lista DATETIME NULL,
  fecha_entrega DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_comanda_empresa (empresa_id, numero_comanda),
  KEY idx_comanda_cuenta (cuenta_abierta_id),
  KEY idx_comanda_estado (empresa_id, estado),
  KEY idx_comanda_mesero (mesero_id, estado),
  CONSTRAINT fk_comanda_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_comanda_cuenta FOREIGN KEY (cuenta_abierta_id) REFERENCES cuentas_abiertas(id) ON DELETE CASCADE,
  CONSTRAINT fk_comanda_mesero FOREIGN KEY (mesero_id) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- El estado se controla por producto: la sopa puede estar lista y el fuerte no
CREATE TABLE IF NOT EXISTS comanda_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  comanda_id INT NOT NULL,
  cuenta_detalle_id INT NULL,
  producto_id INT NOT NULL,
  producto_nombre VARCHAR(255) NOT NULL,
  cantidad DECIMAL(15,3) NOT NULL DEFAULT 1.000,
  observaciones VARCHAR(500) NULL,
  estacion ENUM('cocina','bar','postres','otro') NOT NULL DEFAULT 'cocina',
  estado ENUM('pendiente','en_preparacion','listo','entregado','cancelado') NOT NULL DEFAULT 'pendiente',
  motivo_cancelacion VARCHAR(255) NULL,
  usuario_estado_id INT NULL,
  inventario_descontado TINYINT(1) NOT NULL DEFAULT 0,
  fecha_inicio_preparacion DATETIME NULL,
  fecha_listo DATETIME NULL,
  fecha_entrega DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_item_comanda (comanda_id),
  KEY idx_item_estado (estacion, estado),
  KEY idx_item_detalle (cuenta_detalle_id),
  CONSTRAINT fk_comanda_item_comanda FOREIGN KEY (comanda_id) REFERENCES comandas(id) ON DELETE CASCADE,
  CONSTRAINT fk_comanda_item_detalle FOREIGN KEY (cuenta_detalle_id) REFERENCES cuenta_abierta_detalle(id) ON DELETE SET NULL,
  CONSTRAINT fk_comanda_item_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT,
  CONSTRAINT fk_comanda_item_usuario FOREIGN KEY (usuario_estado_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registro de los módulos para el control de permisos
INSERT INTO modulos (nombre, nombre_mostrar, descripcion, icono, nivel, categoria, orden, ruta, activo, requiere_licencia)
SELECT 'comandas', 'Comandas', 'Toma de pedidos para meseros', 'bi-journal-text', 'tenant', 'operaciones', 18, '/comandas', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM modulos WHERE nombre = 'comandas');

INSERT INTO modulos (nombre, nombre_mostrar, descripcion, icono, nivel, categoria, orden, ruta, activo, requiere_licencia)
SELECT 'cocina', 'Tablero de Cocina', 'Tablero de preparacion de pedidos', 'bi-fire', 'tenant', 'operaciones', 19, '/cocina', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM modulos WHERE nombre = 'cocina');

-- Las cuentas existentes conservan como mesero a quien las abrió
UPDATE cuentas_abiertas SET mesero_id = usuario_apertura WHERE mesero_id IS NULL;
