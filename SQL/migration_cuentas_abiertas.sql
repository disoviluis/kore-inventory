-- ============================================
-- MIGRACIÓN: SISTEMA DE CUENTAS ABIERTAS POS
-- Fecha: 2026-06-01
-- Descripción: Sistema para manejar cuentas abiertas en tiendas de barrio, bares y restaurantes
-- ============================================

-- Tabla: cuentas_abiertas
-- Almacena las cuentas abiertas (tabs) de clientes
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
    cuenta_solicitada BOOLEAN DEFAULT FALSE COMMENT 'TRUE cuando cliente pide "la cuenta" (totalizar)',
    fecha_cuenta_solicitada TIMESTAMP NULL COMMENT 'Cuándo pidió la cuenta',
    
    -- AUDITORÍA
    usuario_apertura INT NOT NULL,
    fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_cierre INT NULL,
    fecha_cierre TIMESTAMP NULL,
    
    -- NOTAS
    notas TEXT NULL,
    
    -- RELACIÓN CON VENTA FINAL
    venta_id INT NULL COMMENT 'ID de la venta cuando se cierra',
    
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
    INDEX idx_cliente (cliente_id),
    
    -- UNIQUE CONSTRAINT
    UNIQUE KEY uk_empresa_numero (empresa_id, numero_cuenta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Cuentas abiertas para POS (tiendas de barrio, bares, restaurantes)';


-- Tabla: cuenta_abierta_detalle
-- Almacena los items/productos de cada cuenta abierta
CREATE TABLE IF NOT EXISTS cuenta_abierta_detalle (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cuenta_abierta_id INT NOT NULL,
    producto_id INT NOT NULL,
    
    -- DETALLES DEL PRODUCTO (snapshot al momento de agregar)
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
    usuario_id INT NOT NULL COMMENT 'Quién agregó este item',
    fecha_agregado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- NOTAS
    notas VARCHAR(500) NULL COMMENT 'Ej: "Sin hielo", "Bien fría"',
    
    -- FOREIGN KEYS
    FOREIGN KEY (cuenta_abierta_id) REFERENCES cuentas_abiertas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    
    -- INDICES
    INDEX idx_cuenta_abierta (cuenta_abierta_id),
    INDEX idx_producto (producto_id),
    INDEX idx_fecha_agregado (fecha_agregado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Detalle de items en cuentas abiertas';


-- Tabla: mesas_configuracion (OPCIONAL - Para futuras mejoras)
-- Configuración de mesas para restaurantes/bares
CREATE TABLE IF NOT EXISTS mesas_configuracion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    numero_mesa VARCHAR(20) NOT NULL COMMENT 'Mesa 1, Mesa 2, Barra 1, etc.',
    zona VARCHAR(100) NULL COMMENT 'Terraza, Interior, VIP, etc.',
    capacidad INT DEFAULT 4,
    estado ENUM('disponible', 'ocupada', 'reservada', 'inactiva') DEFAULT 'disponible',
    posicion_x INT NULL COMMENT 'Para mapa visual',
    posicion_y INT NULL COMMENT 'Para mapa visual',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- FOREIGN KEYS
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    
    -- INDICES
    INDEX idx_empresa (empresa_id),
    INDEX idx_estado (estado),
    
    -- UNIQUE CONSTRAINT
    UNIQUE KEY uk_empresa_mesa (empresa_id, numero_mesa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Configuración de mesas (Opcional - Fase 2)';


-- ============================================
-- TRIGGERS: Actualizar totales automáticamente
-- ============================================

DELIMITER $$

-- Trigger: Actualizar totales de cuenta al agregar item
CREATE TRIGGER tr_cuenta_abierta_detalle_after_insert
AFTER INSERT ON cuenta_abierta_detalle
FOR EACH ROW
BEGIN
    UPDATE cuentas_abiertas
    SET 
        subtotal = (
            SELECT COALESCE(SUM(subtotal), 0)
            FROM cuenta_abierta_detalle
            WHERE cuenta_abierta_id = NEW.cuenta_abierta_id
        ),
        total_impuestos = (
            SELECT COALESCE(SUM(iva_valor + impoconsumo_valor + otros_impuestos), 0)
            FROM cuenta_abierta_detalle
            WHERE cuenta_abierta_id = NEW.cuenta_abierta_id
        ),
        total = (
            SELECT COALESCE(SUM(total), 0)
            FROM cuenta_abierta_detalle
            WHERE cuenta_abierta_id = NEW.cuenta_abierta_id
        )
    WHERE id = NEW.cuenta_abierta_id;
END$$

-- Trigger: Actualizar totales de cuenta al actualizar item
CREATE TRIGGER tr_cuenta_abierta_detalle_after_update
AFTER UPDATE ON cuenta_abierta_detalle
FOR EACH ROW
BEGIN
    UPDATE cuentas_abiertas
    SET 
        subtotal = (
            SELECT COALESCE(SUM(subtotal), 0)
            FROM cuenta_abierta_detalle
            WHERE cuenta_abierta_id = NEW.cuenta_abierta_id
        ),
        total_impuestos = (
            SELECT COALESCE(SUM(iva_valor + impoconsumo_valor + otros_impuestos), 0)
            FROM cuenta_abierta_detalle
            WHERE cuenta_abierta_id = NEW.cuenta_abierta_id
        ),
        total = (
            SELECT COALESCE(SUM(total), 0)
            FROM cuenta_abierta_detalle
            WHERE cuenta_abierta_id = NEW.cuenta_abierta_id
        )
    WHERE id = NEW.cuenta_abierta_id;
END$$

-- Trigger: Actualizar totales de cuenta al eliminar item
CREATE TRIGGER tr_cuenta_abierta_detalle_after_delete
AFTER DELETE ON cuenta_abierta_detalle
FOR EACH ROW
BEGIN
    UPDATE cuentas_abiertas
    SET 
        subtotal = (
            SELECT COALESCE(SUM(subtotal), 0)
            FROM cuenta_abierta_detalle
            WHERE cuenta_abierta_id = OLD.cuenta_abierta_id
        ),
        total_impuestos = (
            SELECT COALESCE(SUM(iva_valor + impoconsumo_valor + otros_impuestos), 0)
            FROM cuenta_abierta_detalle
            WHERE cuenta_abierta_id = OLD.cuenta_abierta_id
        ),
        total = (
            SELECT COALESCE(SUM(total), 0)
            FROM cuenta_abierta_detalle
            WHERE cuenta_abierta_id = OLD.cuenta_abierta_id
        )
    WHERE id = OLD.cuenta_abierta_id;
END$$

DELIMITER ;


-- ============================================
-- FUNCIÓN: Generar número de cuenta automático
-- ============================================

DELIMITER $$

CREATE FUNCTION fn_generar_numero_cuenta(p_empresa_id INT)
RETURNS VARCHAR(20)
DETERMINISTIC
BEGIN
    DECLARE v_numero INT;
    DECLARE v_numero_cuenta VARCHAR(20);
    
    -- Obtener el siguiente número
    SELECT COALESCE(MAX(CAST(SUBSTRING(numero_cuenta, 5) AS UNSIGNED)), 0) + 1
    INTO v_numero
    FROM cuentas_abiertas
    WHERE empresa_id = p_empresa_id
    AND numero_cuenta LIKE 'CTA-%';
    
    -- Formatear como CTA-0001
    SET v_numero_cuenta = CONCAT('CTA-', LPAD(v_numero, 4, '0'));
    
    RETURN v_numero_cuenta;
END$$

DELIMITER ;


-- ============================================
-- DATOS DE PRUEBA (Opcional - Solo para testing)
-- ============================================

/*
-- Ejemplo: Insertar una cuenta abierta de prueba
INSERT INTO cuentas_abiertas (
    empresa_id, numero_cuenta, tipo_identificacion, cliente_nombre, usuario_apertura
) VALUES (
    1, 'CTA-0001', 'cliente', 'Juan Pérez - Prueba', 1
);

-- Ejemplo: Agregar items a la cuenta
INSERT INTO cuenta_abierta_detalle (
    cuenta_abierta_id, producto_id, producto_nombre, cantidad, precio_unitario, 
    subtotal, iva_porcentaje, iva_valor, total, usuario_id
) VALUES (
    1, 1, 'Cerveza Corona', 3, 3500.00, 10500.00, 19, 1995.00, 12495.00, 1
);
*/


-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar que las tablas se crearon correctamente
SELECT 
    'cuentas_abiertas' AS tabla,
    COUNT(*) AS registros
FROM cuentas_abiertas
UNION ALL
SELECT 
    'cuenta_abierta_detalle' AS tabla,
    COUNT(*) AS registros
FROM cuenta_abierta_detalle
UNION ALL
SELECT 
    'mesas_configuracion' AS tabla,
    COUNT(*) AS registros
FROM mesas_configuracion;

-- Ver estructura de las tablas
SHOW CREATE TABLE cuentas_abiertas;
SHOW CREATE TABLE cuenta_abierta_detalle;
SHOW CREATE TABLE mesas_configuracion;

-- ============================================
-- NOTAS DE IMPLEMENTACIÓN
-- ============================================

/*
FLUJO DE TRABAJO:

1. ABRIR CUENTA:
   - INSERT en cuentas_abiertas
   - Estado: 'abierta'
   - numero_cuenta: Usar función fn_generar_numero_cuenta()

2. AGREGAR ITEMS:
   - INSERT en cuenta_abierta_detalle
   - Trigger actualiza totales automáticamente
   - Descontar de inventario (en controller)

3. PEDIR LA CUENTA (Ver Total):
   - UPDATE cuentas_abiertas SET cuenta_solicitada = TRUE
   - Cuenta SIGUE abierta
   - Se pueden agregar más items

4. CERRAR CUENTA (Cobrar):
   - Crear venta normal en tabla ventas
   - UPDATE cuentas_abiertas SET estado = 'cerrada', venta_id = X
   - NO descontar inventario (ya se descontó al agregar)

5. CANCELAR CUENTA:
   - UPDATE cuentas_abiertas SET estado = 'cancelada'
   - Reversar inventario (en controller)
   - DELETE items si es necesario

PERMISOS RECOMENDADOS:
- Ver cuentas abiertas: Todos los usuarios de POS
- Abrir cuenta: Cajeros y superiores
- Cerrar cuenta: Cajeros y superiores
- Cancelar cuenta: Solo administradores

REPORTES ÚTILES:
- Tiempo promedio entre abrir y cerrar cuenta
- Tiempo promedio entre pedir cuenta y cerrar
- Productos más vendidos en cuentas abiertas
- Ticket promedio por cuenta
- Cuentas abiertas por hora del día
*/
