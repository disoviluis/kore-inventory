-- =====================================================
-- SISTEMA DE TURNOS DE CAJA (Apertura/Cierre)
-- =====================================================

-- Tabla principal de turnos
CREATE TABLE IF NOT EXISTS turnos_caja (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    usuario_id INT NOT NULL,
    bodega_id INT NOT NULL,
    fecha_apertura DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre DATETIME NULL,
    base_inicial DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_ventas DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_gastos DECIMAL(15,2) NOT NULL DEFAULT 0,
    efectivo_a_entregar DECIMAL(15,2) NOT NULL DEFAULT 0,
    efectivo_contado DECIMAL(15,2) NULL,
    diferencia DECIMAL(15,2) NULL,
    estado ENUM('abierto', 'cerrado') NOT NULL DEFAULT 'abierto',
    notas_cierre TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (bodega_id) REFERENCES bodegas(id) ON DELETE CASCADE,
    
    INDEX idx_empresa_estado (empresa_id, estado),
    INDEX idx_usuario_estado (usuario_id, estado),
    INDEX idx_bodega_fecha (bodega_id, fecha_apertura),
    INDEX idx_fecha_cierre (fecha_cierre)
);

-- Tabla de totales por método de pago (dinámico)
CREATE TABLE IF NOT EXISTS turnos_caja_totales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    turno_id INT NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL,
    total DECIMAL(15,2) NOT NULL DEFAULT 0,
    cantidad_transacciones INT NOT NULL DEFAULT 0,
    
    FOREIGN KEY (turno_id) REFERENCES turnos_caja(id) ON DELETE CASCADE,
    
    INDEX idx_turno_metodo (turno_id, metodo_pago)
);

-- Tabla de gastos durante el turno
CREATE TABLE IF NOT EXISTS gastos_caja (
    id INT AUTO_INCREMENT PRIMARY KEY,
    turno_id INT NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    monto DECIMAL(15,2) NOT NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usuario_id INT NOT NULL,
    
    FOREIGN KEY (turno_id) REFERENCES turnos_caja(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    
    INDEX idx_turno (turno_id),
    INDEX idx_fecha (fecha_registro)
);

-- Agregar columna turno_id a la tabla de ventas (solo si no existe)
-- Si la columna ya existe, este comando fallará pero el resto del script continuará
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'ventas' 
               AND COLUMN_NAME = 'turno_id');

SET @sqlstmt := IF(@exist = 0, 
                   'ALTER TABLE ventas ADD COLUMN turno_id INT NULL', 
                   'SELECT ''La columna turno_id ya existe en ventas'' AS mensaje');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar índice si no existe
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'ventas' 
               AND INDEX_NAME = 'idx_turno_id');

SET @sqlstmt := IF(@exist = 0, 
                   'ALTER TABLE ventas ADD INDEX idx_turno_id (turno_id)', 
                   'SELECT ''El índice idx_turno_id ya existe'' AS mensaje');
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

COMMIT;
