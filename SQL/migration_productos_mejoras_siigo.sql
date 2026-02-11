-- =========================================
-- MIGRACIÓN: MEJORAS AL MÓDULO DE PRODUCTOS
-- Basado en mejores prácticas de SIIGO
-- Fecha: 2026-02-11
-- =========================================

USE kore_inventory;

-- 1. AGREGAR CAMPO TIPO (Producto vs Servicio)
ALTER TABLE productos 
ADD COLUMN tipo ENUM('producto', 'servicio') DEFAULT 'producto' 
COMMENT 'Tipo: Producto maneja inventario, Servicio no' 
AFTER empresa_id;

-- 2. AGREGAR MÚLTIPLES PRECIOS (Minorista, Mayorista, Distribuidor)
-- Renombrar precio_venta a precio_minorista
ALTER TABLE productos 
CHANGE COLUMN precio_venta precio_minorista DECIMAL(15,2) NOT NULL 
COMMENT 'Precio de venta al público (minorista)';

-- Agregar precio mayorista
ALTER TABLE productos 
ADD COLUMN precio_mayorista DECIMAL(15,2) DEFAULT NULL 
COMMENT 'Precio para clientes mayoristas' 
AFTER precio_minorista;

-- Agregar precio distribuidor
ALTER TABLE productos 
ADD COLUMN precio_distribuidor DECIMAL(15,2) DEFAULT NULL 
COMMENT 'Precio para distribuidores' 
AFTER precio_mayorista;

-- 3. AGREGAR GESTIÓN DE IMPUESTOS
ALTER TABLE productos 
ADD COLUMN aplica_iva BOOLEAN DEFAULT TRUE 
COMMENT 'Indica si el producto/servicio aplica IVA' 
AFTER precio_distribuidor;

ALTER TABLE productos 
ADD COLUMN porcentaje_iva DECIMAL(5,2) DEFAULT 19.00 
COMMENT 'Porcentaje de IVA aplicable (0, 5, 19, etc.)' 
AFTER aplica_iva;

ALTER TABLE productos 
ADD COLUMN tipo_impuesto ENUM('gravado', 'exento', 'excluido') DEFAULT 'gravado' 
COMMENT 'Clasificación tributaria del producto' 
AFTER porcentaje_iva;

-- 4. AGREGAR MANEJO DE INVENTARIO (control adicional)
ALTER TABLE productos 
ADD COLUMN maneja_inventario BOOLEAN DEFAULT TRUE 
COMMENT 'Si FALSE, no se controla stock (útil para servicios)' 
AFTER tipo;

-- 5. AGREGAR CUENTAS CONTABLES (Nivel PRO)
ALTER TABLE productos 
ADD COLUMN cuenta_ingreso VARCHAR(20) NULL 
COMMENT 'Cuenta PUC de ingresos (4xxxxx)' 
AFTER estado;

ALTER TABLE productos 
ADD COLUMN cuenta_costo VARCHAR(20) NULL 
COMMENT 'Cuenta PUC de costos (6xxxxx)' 
AFTER cuenta_ingreso;

ALTER TABLE productos 
ADD COLUMN cuenta_inventario VARCHAR(20) NULL 
COMMENT 'Cuenta PUC de inventario (1xxxxx)' 
AFTER cuenta_costo;

ALTER TABLE productos 
ADD COLUMN cuenta_gasto VARCHAR(20) NULL 
COMMENT 'Cuenta PUC de gastos para servicios (5xxxxx)' 
AFTER cuenta_inventario;

-- 6. AGREGAR HISTORIAL DE CAMBIOS
ALTER TABLE productos 
ADD COLUMN fecha_ultimo_cambio_precio TIMESTAMP NULL 
COMMENT 'Última vez que cambió el precio' 
AFTER updated_at;

ALTER TABLE productos 
ADD COLUMN modificado_por INT(11) NULL 
COMMENT 'Último usuario que modificó el producto' 
AFTER fecha_ultimo_cambio_precio;

-- 7. AGREGAR ÍNDICES PARA MEJORAR RENDIMIENTO
CREATE INDEX idx_tipo ON productos(tipo);
CREATE INDEX idx_aplica_iva ON productos(aplica_iva);
CREATE INDEX idx_maneja_inventario ON productos(maneja_inventario);
CREATE INDEX idx_tipo_impuesto ON productos(tipo_impuesto);

-- 8. AGREGAR CONSTRAINT PARA FOREIGN KEY de modificado_por
ALTER TABLE productos 
ADD CONSTRAINT fk_productos_modificado_por 
FOREIGN KEY (modificado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- 9. ACTUALIZAR DATOS EXISTENTES
-- Todos los productos existentes se marcan como 'producto' y con manejo de inventario
UPDATE productos SET 
    tipo = 'producto',
    maneja_inventario = TRUE,
    aplica_iva = TRUE,
    porcentaje_iva = 19.00,
    tipo_impuesto = 'gravado'
WHERE tipo IS NULL;

-- 10opiar precio_minorista a otros precios si están NULL (valores por defecto)
UPDATE productos SET 
    precio_mayorista = ROUND(precio_minorista * 0.90, 2),  -- 10% descuento
    precio_distribuidor = ROUND(precio_minorista * 0.80, 2) -- 20% descuento
WHERE precio_mayorista IS NULL OR precio_distribuidor IS NULL;

-- 91. CREAR VISTA PARA PRODUCTOS CON MARGEN CALCULADO Y PRECIOS
CREATE OR REPLACE VIEW vista_productos_con_margen AS
SELECT 
    p.*,
    c.nombre as categoria_nombre,
    -- Calcular margen de utilidad (minorista)
    CASE 
        WHEN p.precio_compra > 0 THEN 
            ROUND(((p.precio_minorista - p.precio_compra) / p.precio_compra) * 100, 2)
        ELSE 0 
    END as margen_minorista_porcentaje,
    -- Calcular margen mayorista
    CASE 
        WHEN p.precio_compra > 0 AND p.precio_mayorista IS NOT NULL THEN 
            ROUND(((p.precio_mayorista - p.precio_compra) / p.precio_compra) * 100, 2)
        ELSE 0 
    END as margen_mayorista_porcentaje,
    -- Calcular margen distribuidor
    CASE 
        WHEN p.precio_compra > 0 AND p.precio_distribuidor IS NOT NULL THEN 
            ROUND(((p.precio_distribuidor - p.precio_compra) / p.precio_compra) * 100, 2)
        ELSE 0 
    END as margen_distribuidor_porcentaje,
    -- Calcular utilidad bruta (minorista)
    (p.precio_minorista - p.precio_compra) as utilidad_bruta_minorista,
    -- Precios con IVA
    CASE 
        WHEN p.aplica_iva = TRUE THEN 
            ROUND(p.precio_minorista * (1 + (p.porcentaje_iva / 100)), 2)
        ELSE p.precio_minorista 
    END as precio_minorista_con_iva,
    CASE 
        WHEN p.aplica_iva = TRUE AND p.precio_mayorista IS NOT NULL THEN 
            ROUND(p.precio_mayorista * (1 + (p.porcentaje_iva / 100)), 2)
        ELSE p.precio_mayorista 
    END as precio_mayorista_con_iva,
    CASE 
        WHEN p.aplica_iva = TRUE AND p.precio_distribuidor IS NOT NULL THEN 
            ROUND(p.precio_distribuidor * (1 + (p.porcentaje_iva / 100)), 2)
        ELSE p.precio_distribuidor 
    END as precio_distribuidor_con_iva,
    2. CREAR TABLA DE HISTORIAL DE PRECIOS (MÚLTIPLES NIVELES)
CREATE TABLE IF NOT EXISTS productos_historial_precios (
    id INT(11) NOT NULL AUTO_INCREMENT,
    producto_id INT(11) NOT NULL,
    precio_compra_anterior DECIMAL(15,2) NULL,
    precio_compra_nuevo DECIMAL(15,2) NULL,
    precio_minorista_anterior DECIMAL(15,2) NULL,
    precio_minorista_nuevo DECIMAL(15,2) NULL,
    precio_mayorista_anterior DECIMAL(15,2) NULL,
    precio_mayorista_nuevo DECIMAL(15,2) NULL,
    precio_distribuidor_anterior DECIMAL(15,2) NULL,
    precio_distribuidor_nuevo DECIMAL(15,2) NULL,
    motivo VARCHAR(255) NULL COMMENT 'Razón del cambio de precio',
    usuario_id INT(11) NULL COMMENT 'Usuario que realizó el cambio',
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_producto_id (producto_id),
    KEY idx_fecha_cambio (fecha_cambio),
    CONSTRAINT fk_historial_precios_producto 
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
    CONSTRAINT fk_historial_precios_usuario 
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Historial de cambios de precios de productos (3 niveles)
        WHEN p.stock_actual = 0 THEN 'Agotado'
        WHEN p.stock_actual <= p.stock_minimo THEN 'Stock Bajo'
        WHEN p.stock_actual >= p.stock_maximo THEN 'Sobrestockeado'
    3. CREAR TRIGGER PARA REGISTRAR CAMBIOS DE PRECIO (MÚLTIPLES NIVELES)
DELIMITER $$

CREATE TRIGGER tr_productos_precio_change
BEFORE UPDATE ON productos
FOR EACH ROW
BEGIN
    -- Si cambió algún precio
    IF OLD.precio_compra != NEW.precio_compra OR 
       OLD.precio_minorista != NEW.precio_minorista OR
       OLD.precio_mayorista != NEW.precio_mayorista OR
       OLD.precio_distribuidor != NEW.precio_distribuidor THEN
        
        -- Actualizar fecha de último cambio
        SET NEW.fecha_ultimo_cambio_precio = CURRENT_TIMESTAMP;
        
        -- Insertar en historial
        INSERT INTO productos_historial_precios (
            producto_id,
            precio_compra_anterior,
            precio_compra_nuevo,
            precio_minorista_anterior,
            precio_minorista_nuevo,
            precio_mayorista_anterior,
            precio_mayorista_nuevo,
            precio_distribuidor_anterior,
            precio_distribuidor_nuevo,
            usuario_id
        ) VALUES (
            NEW.id,
            OLD.precio_compra,
            NEW.precio_compra,
            OLD.precio_minorista,
            NEW.precio_minorista,
            OLD.precio_mayorista,
            NEW.precio_mayorista,
            OLD.precio_distribuidor,
            NEW.precio_distribuidorGISTRAR CAMBIOS DE PRECIO
DELIMITER $$

CREATE TRIGGER tr_productos_precio_change
BEFORE UPDATE ON productos
FOR EACH ROW
BEGIN
    -- Si cambió el precio de compra o venta
    IF OLD.precio_compra != NEW.precio_compra OR OLD.precio_venta != NEW.precio_venta THEN
        
        -- Actualizar fecha de último cambio
        SET NEW.fecha_ultimo_cambio_precio = CURRENT_TIMESTAMP;
        
        -- Insertar en historial
        INSERT INTO productos_historial_precios (
            producto_id,
            precio_compra_anterior,
            precio_compra_nuevo,
            precio_venta_anterior,
            precio_venta_nuevo,
            usuario_id
        ) VALUES (
            NEW.id,
            OLD.precio_compra,
            NEW.precio_compra,
            OLD.precio_venta,
            NEW.precio_venta,
            NEW.modificado_por
        );
    END IF;
END$$

DELIMITER ;

-- =========================================
-- MÓDULO DE BODEGAS Y TRASLADOS
-- =========================================

-- 14. CREAR TABLA DE BODEGAS/ALMACENES
CREATE TABLE IF NOT EXISTS bodegas (
    id INT(11) NOT NULL AUTO_INCREMENT,
    empresa_id INT(11) NOT NULL COMMENT 'ID de la empresa propietaria',
    codigo VARCHAR(20) NOT NULL COMMENT 'Código único de bodega',
    nombre VARCHAR(100) NOT NULL COMMENT 'Nombre de la bodega',
    descripcion TEXT NULL COMMENT 'Descripción de la bodega',
    direccion VARCHAR(255) NULL COMMENT 'Dirección física',
    ciudad VARCHAR(100) NULL,
    telefono VARCHAR(20) NULL,
    responsable_id INT(11) NULL COMMENT 'Usuario responsable de la bodega',
    es_principal BOOLEAN DEFAULT FALSE COMMENT 'Bodega principal de la empresa',
    estado ENUM('activa', 'inactiva') DEFAULT 'activa',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_empresa_codigo (empresa_id, codigo),
    KEY idx_empresa_id (empresa_id),
    KEY idx_estado (estado),
    KEY idx_responsable (responsable_id),
    CONSTRAINT fk_bodegas_empresa 
        FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    CONSTRAINT fk_bodegas_responsable 
        FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Bodegas/Almacenes por empresa';

-- 15. CREAR TABLA DE STOCK POR BODEGA
CREATE TABLE IF NOT EXISTS productos_bodegas (
    id INT(11) NOT NULL AUTO_INCREMENT,
    producto_id INT(11) NOT NULL,
    bodega_id INT(11) NOT NULL,
    stock_actual INT(11) DEFAULT 0 COMMENT 'Stock disponible en esta bodega',
    stock_minimo INT(11) DEFAULT 0 COMMENT 'Stock mínimo en esta bodega',
    stock_maximo INT(11) DEFAULT NULL COMMENT 'Stock máximo en esta bodega',
    ubicacion VARCHAR(100) NULL COMMENT 'Ubicación específica (pasillo, estante)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_producto_bodega (producto_id, bodega_id),
    KEY idx_producto (producto_id),
    KEY idx_bodega (bodega_id),
    KEY idx_stock (stock_actual),
    CONSTRAINT fk_productos_bodegas_producto 
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
    CONSTRAINT fk_productos_bodegas_bodega 
        FOREIGN KEY (bodega_id) REFERENCES bodegas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stock de productos distribuido por bodegas';

-- 16. CREAR TABLA DE TRASLADOS ENTRE BODEGAS
CREATE TABLE IF NOT EXISTS traslados (
    id INT(11) NOT NULL AUTO_INCREMENT,
    empresa_id INT(11) NOT NULL,
    numero_traslado VARCHAR(50) NOT NULL COMMENT 'Número único de traslado',
    bodega_origen_id INT(11) NOT NULL,
    bodega_destino_id INT(11) NOT NULL,
    fecha_traslado DATE NOT NULL,
    fecha_recepcion DATE NULL COMMENT 'Fecha en que se recibió en destino',
    estado ENUM('pendiente', 'en_transito', 'recibido', 'cancelado') DEFAULT 'pendiente',
    observaciones TEXT NULL,
    usuario_solicita_id INT(11) NULL COMMENT 'Usuario que solicita el traslado',
    usuario_autoriza_id INT(11) NULL COMMENT 'Usuario que autoriza',
    usuario_recibe_id INT(11) NULL COMMENT 'Usuario que recibe en destino',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_empresa_numero (empresa_id, numero_traslado),
    KEY idx_empresa (empresa_id),
    KEY idx_bodega_origen (bodega_origen_id),
    KEY idx_bodega_destino (bodega_destino_id),
    KEY idx_estado (estado),
    KEY idx_fecha (fecha_traslado),
    CONSTRAINT fk_traslados_empresa 
        FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    CONSTRAINT fk_traslados_origen 
        FOREIGN KEY (bodega_origen_id) REFERENCES bodegas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_traslados_destino 
        FOREIGN KEY (bodega_destino_id) REFERENCES bodegas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_traslados_solicita 
        FOREIGN KEY (usuario_solicita_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_traslados_autoriza 
        FOREIGN KEY (usuario_autoriza_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_traslados_recibe 
        FOREIGN KEY (usuario_recibe_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Traslados de mercancía entre bodegas';

-- 17. CREAR TABLA DE DETALLE DE TRASLADOS
CREATE TABLE IF NOT EXISTS traslados_detalle (
    id INT(11) NOT NULL AUTO_INCREMENT,
    traslado_id INT(11) NOT NULL,
    producto_id INT(11) NOT NULL,
    cantidad_solicitada INT(11) NOT NULL,
    cantidad_recibida INT(11) NULL COMMENT 'Puede ser diferente a la solicitada',
    observaciones VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_traslado (traslado_id),
    KEY idx_producto (producto_id),
    CONSTRAINT fk_traslados_detalle_traslado 
        FOREIGN KEY (traslado_id) REFERENCES traslados(id) ON DELETE CASCADE,
    CONSTRAINT fk_traslados_detalle_producto 
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Detalle de productos en cada traslado';

-- 18. CREAR VISTA CONSOLIDADA DE STOCK POR BODEGA
CREATE OR REPLACE VIEW vista_stock_por_bodega AS
SELECT 
    pb.id,
    p.id as producto_id,
    p.nombre as producto_nombre,
    p.sku,
    b.id as bodega_id,
    b.nombre as bodega_nombre,
    b.codigo as bodega_codigo,
    pb.stock_actual,
    pb.stock_minimo,
    pb.stock_maximo,
    pb.ubicacion,
    CASE 
        WHEN pb.stock_actual = 0 THEN 'Agotado'
        WHEN pb.stock_actual <= pb.stock_minimo THEN 'Stock Bajo'
        WHEN pb.stock_maximo IS NOT NULL AND pb.stock_actual >= pb.stock_maximo THEN 'Sobrestockeado'
        ELSE 'Normal'
    END as estado_stock,
    p.precio_compra,
    (pb.stock_actual * p.precio_compra) as valor_inventario
FROM productos_bodegas pb
INNER JOIN productos p ON pb.producto_id = p.id
INNER JOIN bodegas b ON pb.bodega_id = b.id
WHERE p.estado = 'activo' AND b.estado = 'activa';

-- 19. CREAR VISTA DE TRASLADOS CON DETALLE
CREATE OR REPLACE VIEW vista_traslados_completo AS
SELECT 
    t.id as traslado_id,
    t.numero_traslado,
    t.empresa_id,
    bo.nombre as bodega_origen,
    bd.nombre as bodega_destino,
    t.fecha_traslado,
    t.fecha_recepcion,
    t.estado,
    t.observaciones,
    us.nombre as usuario_solicita,
    ua.nombre as usuario_autoriza,
    ur.nombre as usuario_recibe,
    COUNT(td.id) as total_productos,
    SUM(td.cantidad_solicitada) as total_unidades_solicitadas,
    SUM(COALESCE(td.cantidad_recibida, 0)) as total_unidades_recibidas,
    t.created_at
FROM traslados t
INNER JOIN bodegas bo ON t.bodega_origen_id = bo.id
INNER JOIN bodegas bd ON t.bodega_destino_id = bd.id
LEFT JOIN usuarios us ON t.usuario_solicita_id = us.id
LEFT JOIN usuarios ua ON t.usuario_autoriza_id = ua.id
LEFT JOIN usuarios ur ON t.usuario_recibe_id = ur.id
LEFT JOIN traslados_detalle td ON t.id = td.traslado_id
GROUP BY t.id;

-- 20. CREAR TRIGGER PARA ACTUALIZAR STOCK AL APROBAR TRASLADO
DELIMITER $$

CREATE TRIGGER tr_traslado_recibido
AFTER UPDATE ON traslados
FOR EACH ROW
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_producto_id INT;
    DECLARE v_cantidad INT;
    DECLARE cur CURSOR FOR 
        SELECT producto_id, cantidad_recibida 
        FROM traslados_detalle 
        WHERE traslado_id = NEW.id AND cantidad_recibida IS NOT NULL;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- Solo procesar si el estado cambió a 'recibido'
    IF NEW.estado = 'recibido' AND OLD.estado != 'recibido' THEN
        
        OPEN cur;
        
        read_loop: LOOP
            FETCH cur INTO v_producto_id, v_cantidad;
            IF done THEN
                LEAVE read_loop;
            END IF;
            
            -- Descontar de bodega origen
            UPDATE productos_bodegas 
            SET stock_actual = stock_actual - v_cantidad
            WHERE producto_id = v_producto_id 
              AND bodega_id = NEW.bodega_origen_id;
            
            -- Agregar a bodega destino
            INSERT INTO productos_bodegas (producto_id, bodega_id, stock_actual)
            VALUES (v_producto_id, NEW.bodega_destino_id, v_cantidad)
            ON DUPLICATE KEY UPDATE stock_actual = stock_actual + v_cantidad;
            
            -- Registrar en movimientos de inventario
            INSERT INTO inventario_movimientos (
                producto_id,
                tipo_movimiento,
                cantidad,
                tipo_documento,
                numero_documento,
                observaciones,
                usuario_id
            ) VALUES (
                v_producto_id,
                'salida',
                v_cantidad,
                'traslado',
                NEW.numero_traslado,
                CONCAT('Traslado a ', (SELECT nombre FROM bodegas WHERE id = NEW.bodega_destino_id)),
                NEW.usuario_recibe_id
            ), (
                v_producto_id,
                'entrada',
                v_cantidad,
                'traslado',
                NEW.numero_traslado,
                CONCAT('Traslado desde ', (SELECT nombre FROM bodegas WHERE id = NEW.bodega_origen_id)),
                NEW.usuario_recibe_id
            );
            
        END LOOP;
        
        CLOSE cur;
    END IF;
END$$

DELIMITER ;

-- 21. INSERTAR BODEGA PRINCIPAL POR DEFECTO PARA EMPRESAS EXISTENTES
INSERT INTO bodegas (empresa_id, codigo, nombre, es_principal, estado)
SELECT 
    id as empresa_id,
    'BOD-PRINCIPAL' as codigo,
    CONCAT('Bodega Principal - ', nombre) as nombre,
    TRUE as es_principal,
    'activa' as estado
FROM empresas
WHERE id NOT IN (SELECT DISTINCT empresa_id FROM bodegas);

-- 22. MIGRAR STOCK ACTUAL DE PRODUCTOS A BODEGA PRINCIPAL
INSERT INTO productos_bodegas (producto_id, bodega_id, stock_actual, stock_minimo, stock_maximo, ubicacion)
SELECT 
    p.id as producto_id,
    b.id as bodega_id,
    p.stock_actual,
    p.stock_minimo,
    p.stock_maximo,
    p.ubicacion_almacen
FROM productos p
INNER JOIN bodegas b ON p.empresa_id = b.empresa_id AND b.es_principal = TRUE
WHERE p.maneja_inventario = TRUE
  AND NOT EXISTS (
      SELECT 1 FROM productos_bodegas pb 
      WHERE pb.producto_id = p.id AND pb.bodega_id = b.id
  );

-- =========================================
-- COMENTARIOS Y VALIDACIONES RECOMENDADAS
-- =========================================

-- VALIDACIÓN 1: Servicios no deben manejar inventario
-- IF tipo = 'servicio' THEN maneja_inventario = FALSE

-- VALIDACIÓN 2: Precio mayorista debe ser menor que minorista
-- precio_mayorista <= precio_minorista

-- VALIDACIÓN 3: Precio distribuidor debe ser menor que mayorista
-- precio_distribuidor <= precio_mayorista

-- VALIDACIÓN 4: No permitir traslado si no hay stock suficiente en origen

-- VALIDACIÓN 5: Bodega origen y destino deben ser diferentes

-- VALIDACIÓN 6: IVA debe ser 0, 5 o 19 en Colombia

-- =========================================
-- SCRIPT DE ROLLBACK (POR SI ACASO)
-- =========================================

-- Descomenta estas líneas si necesitas revertir los cambios:

/*
-- Revertir productos
ALTER TABLE productos CHANGE COLUMN precio_minorista precio_venta DECIMAL(15,2) NOT NULL;
ALTER TABLE productos DROP COLUMN precio_mayorista;
ALTER TABLE productos DROP COLUMN precio_distribuidor;
ALTER TABLE productos DROP COLUMN tipo;
ALTER TABLE productos DROP COLUMN maneja_inventario;
ALTER TABLE productos DROP COLUMN aplica_iva;
ALTER TABLE productos DROP COLUMN porcentaje_iva;
ALTER TABLE productos DROP COLUMN tipo_impuesto;
ALTER TABLE productos DROP COLUMN cuenta_ingreso;
ALTER TABLE productos DROP COLUMN cuenta_costo;
ALTER TABLE productos DROP COLUMN cuenta_inventario;
ALTER TABLE productos DROP COLUMN cuenta_gasto;
ALTER TABLE productos DROP COLUMN fecha_ultimo_cambio_precio;
ALTER TABLE productos DROP COLUMN modificado_por;

-- Revertir vistas y triggers
DROP VIEW IF EXISTS vista_productos_con_margen;
DROP VIEW IF EXISTS vista_stock_por_bodega;
DROP VIEW IF EXISTS vista_traslados_completo;
DROP TRIGGER IF EXISTS tr_productos_precio_change;
DROP TRIGGER IF EXISTS tr_traslado_recibido;

-- Revertir tablas de traslados y bodegas
DROP TABLE IF EXISTS traslados_detalle;
DROP TABLE IF EXISTS traslados;
DROP TABLE IF EXISTS productos_bodegas;
DROP TABLE IF EXISTS bodegas;
DROP TABLE IF EXISTS productos_historial_precios;
*/

-- =========================================
-- FIN DE LA MIGRACIÓN
-- =========================================
