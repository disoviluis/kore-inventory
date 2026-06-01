-- ============================================
-- MIGRACIÓN: SISTEMA DE CUENTAS ABIERTAS POS (Simplificada)
-- Fecha: 2026-06-01
-- Descripción: Sistema para manejar cuentas abiertas - SIN TRIGGERS
-- ============================================

-- Tabla: cuentas_abiertas
CREATE TABLE IF NOT EXISTS cuentas_abiertas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    numero_cuenta VARCHAR(20) NOT NULL,
    
    -- IDENTIFICACIÓN
    tipo_identificacion ENUM('mesa', 'cliente', 'tab_nombre') DEFAULT 'cliente',
    mesa_numero VARCHAR(20) NULL COMMENT 'Mesa 1, Mesa 2, Barra, etc.',
    cliente_id INT NULL,
    cliente_nombre VARCHAR(255) NULL COMMENT 'Para tabs sin cliente registrado',
    
    -- TOTALES
    subtotal DECIMAL(10,2) DEFAULT 0.00,
    total_impuestos DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) DEFAULT 0.00,
    
    -- ESTADO
    estado ENUM('abierta', 'cerrada', 'cancelada') DEFAULT 'abierta',
    cuenta_solicitada BOOLEAN DEFAULT FALSE COMMENT 'TRUE cuando cliente pide "la cuenta"',
    fecha_cuenta_solicitada TIMESTAMP NULL,
    
    -- AUDITORÍA
    usuario_apertura INT NOT NULL,
    fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_cierre INT NULL,
    fecha_cierre TIMESTAMP NULL,
    
    -- NOTAS
    notas TEXT NULL,
    
    -- RELACIÓN CON VENTA FINAL
    venta_id INT NULL,
    
   -- FOREIGN KEYS
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
    FOREIGN KEY (usuario_apertura) REFERENCES usuarios(id) ON DELETE RESTRICT,
    FOREIGN KEY (usuario_cierre) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE SET NULL,
    
    -- INDICES
    INDEX idx_empresa_estado (empresa_id, estado),
    INDEX idx_numero_cuenta (numero_cuenta),
    INDEX idx_mesa (mesa_numero),
    INDEX idx_fecha_apertura (fecha_apertura),
    INDEX idx_cliente (cliente_id)
   
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Tabla: cuenta_abierta_detalle
CREATE TABLE IF NOT EXISTS cuenta_abierta_detalle (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cuenta_abierta_id INT NOT NULL,
    producto_id INT NOT NULL,
    
    -- DETALLES DEL PRODUCTO
    producto_nombre VARCHAR(255) NOT NULL,
    producto_sku VARCHAR(100) NULL,
    
    -- CANTIDAD Y PRECIOS
    cantidad INT NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    
    -- IMPUESTOS
    iva_porcentaje DECIMAL(5,2) DEFAULT 0.00,
    iva_valor DECIMAL(10,2) DEFAULT 0.00,
    impoconsumo_porcentaje DECIMAL(5,2) DEFAULT 0.00,
    impoconsumo_valor DECIMAL(10,2) DEFAULT 0.00,
    otros_impuestos DECIMAL(10,2) DEFAULT 0.00,
    
    -- DESCUENTOS
    descuento_porcentaje DECIMAL(5,2) DEFAULT 0.00,
    descuento_valor DECIMAL(10,2) DEFAULT 0.00,
    
    -- TOTAL
    total DECIMAL(10,2) NOT NULL,
    
    -- AUDITORÍA
    usuario_id INT NOT NULL,
    fecha_agregado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- NOTAS
    notas VARCHAR(500) NULL,
    
    -- FOREIGN KEYS
    FOREIGN KEY (cuenta_abierta_id) REFERENCES cuentas_abiertas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    
    -- INDICES
    INDEX idx_cuenta_abierta (cuenta_abierta_id),
    INDEX idx_producto (producto_id),
    INDEX idx_fecha_agregado (fecha_agregado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Tabla: mesas_configuracion (OPCIONAL)
CREATE TABLE IF NOT EXISTS mesas_configuracion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    numero_mesa VARCHAR(20) NOT NULL,
    zona VARCHAR(100) NULL,
    capacidad INT DEFAULT 4,
    estado ENUM('disponible', 'ocupada', 'reservada', 'inactiva') DEFAULT 'disponible',
    posicion_x INT NULL,
    posicion_y INT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    INDEX idx_empresa (empresa_id),
    INDEX idx_estado (estado),
    UNIQUE KEY uk_empresa_mesa (empresa_id, numero_mesa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verificación
SELECT 'Tablas creadas exitosamente' AS status;
SELECT COUNT(*) as cuentas_abiertas FROM cuentas_abiertas;
SELECT COUNT(*) as items_detalle FROM cuenta_abierta_detalle;
SELECT COUNT(*) as mesas FROM mesas_configuracion;
