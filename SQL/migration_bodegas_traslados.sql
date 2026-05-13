/**
 * =====================================================
 * MIGRACIÓN: SISTEMA DE BODEGAS Y TRASLADOS
 * =====================================================
 * 
 * PROPÓSITO:
 * Implementar sistema multi-bodega para gestión de inventario
 * distribuido en múltiples ubicaciones físicas (almacenes, sucursales, locales).
 * 
 * IMPLEMENTA:
 * - Gestión de múltiples bodegas/almacenes por empresa
 * - Stock independiente por bodega
 * - Traslados de mercancía entre bodegas
 * - Workflow de aprobación de traslados
 * - Consultas de disponibilidad multi-bodega
 * - Trazabilidad completa de movimientos
 * 
 * FECHA: 2026-05-13
 * =====================================================
 */

SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- 1. TABLA: BODEGAS/ALMACENES/SUCURSALES
-- =====================================================

CREATE TABLE IF NOT EXISTS bodegas (
    id INT(11) NOT NULL AUTO_INCREMENT,
    empresa_id INT(11) NOT NULL COMMENT 'Empresa propietaria',
    codigo VARCHAR(20) NOT NULL COMMENT 'Código único (ej: BOD-001, SUC-CTR)',
    nombre VARCHAR(100) NOT NULL COMMENT 'Nombre descriptivo',
    descripcion TEXT NULL COMMENT 'Descripción detallada',
    tipo ENUM('bodega', 'sucursal', 'local', 'almacen', 'tienda') DEFAULT 'bodega' COMMENT 'Tipo de ubicación',
    
    -- Ubicación física
    direccion VARCHAR(255) NULL,
    ciudad VARCHAR(100) NULL,
    departamento VARCHAR(100) NULL,
    telefono VARCHAR(20) NULL,
    email VARCHAR(100) NULL,
    
    -- Gestión
    responsable_id INT(11) NULL COMMENT 'Usuario responsable',
    es_principal BOOLEAN DEFAULT FALSE COMMENT 'Bodega principal de la empresa',
    permite_ventas BOOLEAN DEFAULT TRUE COMMENT 'Puede hacer ventas directas',
    
    -- Estado
    estado ENUM('activa', 'inactiva', 'en_mantenimiento') DEFAULT 'activa',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT(11) NULL COMMENT 'Usuario que la creó',
    
    PRIMARY KEY (id),
    UNIQUE KEY uk_empresa_codigo (empresa_id, codigo),
    KEY idx_empresa_id (empresa_id),
    KEY idx_estado (estado),
    KEY idx_tipo (tipo),
    KEY idx_responsable (responsable_id),
    KEY idx_es_principal (empresa_id, es_principal),
    
    CONSTRAINT fk_bodegas_empresa 
        FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    CONSTRAINT fk_bodegas_responsable 
        FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_bodegas_created_by 
        FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
        
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Bodegas, almacenes, sucursales y puntos de venta por empresa';

-- =====================================================
-- 2. TABLA: STOCK POR BODEGA
-- =====================================================

CREATE TABLE IF NOT EXISTS productos_bodegas (
    id INT(11) NOT NULL AUTO_INCREMENT,
    producto_id INT(11) NOT NULL,
    bodega_id INT(11) NOT NULL,
    
    -- Stock
    stock_actual INT(11) DEFAULT 0 COMMENT 'Stock disponible en esta bodega',
    stock_reservado INT(11) DEFAULT 0 COMMENT 'Stock reservado en pedidos',
    stock_disponible INT(11) GENERATED ALWAYS AS (stock_actual - stock_reservado) VIRTUAL,
    stock_minimo INT(11) DEFAULT 0 COMMENT 'Alerta de stock mínimo',
    stock_maximo INT(11) DEFAULT NULL COMMENT 'Stock máximo recomendado',
    
    -- Ubicación física dentro de la bodega
    ubicacion VARCHAR(100) NULL COMMENT 'Pasillo, estante, rack (ej: P3-E5-N2)',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    UNIQUE KEY uk_producto_bodega (producto_id, bodega_id),
    KEY idx_producto (producto_id),
    KEY idx_bodega (bodega_id),
    KEY idx_stock (stock_actual),
    KEY idx_stock_bajo (bodega_id, stock_actual, stock_minimo),
    
    CONSTRAINT fk_productos_bodegas_producto 
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
    CONSTRAINT fk_productos_bodegas_bodega 
        FOREIGN KEY (bodega_id) REFERENCES bodegas(id) ON DELETE CASCADE
        
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stock de productos distribuido por bodegas';

-- =====================================================
-- 3. TABLA: TRASLADOS ENTRE BODEGAS
-- =====================================================

CREATE TABLE IF NOT EXISTS traslados (
    id INT(11) NOT NULL AUTO_INCREMENT,
    empresa_id INT(11) NOT NULL,
    
    -- Identificación
    numero_traslado VARCHAR(50) NOT NULL COMMENT 'Número único (ej: TRS-2026-001)',
    
    -- Origen y destino
    bodega_origen_id INT(11) NOT NULL,
    bodega_destino_id INT(11) NOT NULL,
    
    -- Fechas
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_aprobacion TIMESTAMP NULL,
    fecha_envio TIMESTAMP NULL COMMENT 'Fecha de salida de origen',
    fecha_recepcion TIMESTAMP NULL COMMENT 'Fecha de llegada a destino',
    
    -- Estado del traslado
    estado ENUM(
        'borrador',
        'pendiente_aprobacion',
        'aprobado',
        'en_transito',
        'parcialmente_recibido',
        'recibido',
        'cancelado'
    ) DEFAULT 'borrador',
    
    -- Workflow
    usuario_solicita_id INT(11) NULL COMMENT 'Usuario que solicita',
    usuario_aprueba_id INT(11) NULL COMMENT 'Usuario que aprueba',
    usuario_envia_id INT(11) NULL COMMENT 'Usuario que despacha',
    usuario_recibe_id INT(11) NULL COMMENT 'Usuario que recibe',
    
    -- Observaciones
    motivo TEXT NULL COMMENT 'Motivo del traslado',
    observaciones TEXT NULL COMMENT 'Observaciones generales',
    observaciones_recepcion TEXT NULL COMMENT 'Observaciones al recibir',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    UNIQUE KEY uk_empresa_numero (empresa_id, numero_traslado),
    KEY idx_empresa (empresa_id),
    KEY idx_bodega_origen (bodega_origen_id),
    KEY idx_bodega_destino (bodega_destino_id),
    KEY idx_estado (estado),
    KEY idx_fecha_solicitud (fecha_solicitud),
    KEY idx_usuario_solicita (usuario_solicita_id),
    
    CONSTRAINT fk_traslados_empresa 
        FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    CONSTRAINT fk_traslados_origen 
        FOREIGN KEY (bodega_origen_id) REFERENCES bodegas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_traslados_destino 
        FOREIGN KEY (bodega_destino_id) REFERENCES bodegas(id) ON DELETE RESTRICT,
    CONSTRAINT fk_traslados_solicita 
        FOREIGN KEY (usuario_solicita_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_traslados_aprueba 
        FOREIGN KEY (usuario_aprueba_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_traslados_envia 
        FOREIGN KEY (usuario_envia_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_traslados_recibe 
        FOREIGN KEY (usuario_recibe_id) REFERENCES usuarios(id) ON DELETE SET NULL,
        
    CONSTRAINT chk_traslados_bodegas_diferentes 
        CHECK (bodega_origen_id != bodega_destino_id)
        
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Traslados de mercancía entre bodegas';

-- =====================================================
-- 4. TABLA: DETALLE DE TRASLADOS
-- =====================================================

CREATE TABLE IF NOT EXISTS traslados_detalle (
    id INT(11) NOT NULL AUTO_INCREMENT,
    traslado_id INT(11) NOT NULL,
    producto_id INT(11) NOT NULL,
    
    -- Cantidades
    cantidad_solicitada INT(11) NOT NULL COMMENT 'Cantidad solicitada inicialmente',
    cantidad_aprobada INT(11) NULL COMMENT 'Cantidad aprobada (puede ser menor)',
    cantidad_enviada INT(11) NULL COMMENT 'Cantidad realmente enviada',
    cantidad_recibida INT(11) NULL COMMENT 'Cantidad recibida (puede diferir)',
    
    -- Diferencias/Mermas
    cantidad_diferencia INT(11) GENERATED ALWAYS AS (
        COALESCE(cantidad_enviada, 0) - COALESCE(cantidad_recibida, 0)
    ) VIRTUAL COMMENT 'Diferencia entre enviado y recibido',
    
    -- Observaciones por producto
    observaciones VARCHAR(255) NULL,
    motivo_diferencia TEXT NULL COMMENT 'Explicación de diferencias',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    UNIQUE KEY uk_traslado_producto (traslado_id, producto_id),
    KEY idx_traslado (traslado_id),
    KEY idx_producto (producto_id),
    
    CONSTRAINT fk_traslados_detalle_traslado 
        FOREIGN KEY (traslado_id) REFERENCES traslados(id) ON DELETE CASCADE,
    CONSTRAINT fk_traslados_detalle_producto 
        FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT,
        
    CONSTRAINT chk_cantidad_solicitada_positiva 
        CHECK (cantidad_solicitada > 0)
        
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Detalle de productos en cada traslado';

-- =====================================================
-- 5. VISTAS ÚTILES
-- =====================================================

-- Vista: Stock consolidado por bodega
CREATE OR REPLACE VIEW vista_stock_por_bodega AS
SELECT 
    pb.id,
    e.id as empresa_id,
    e.nombre as empresa_nombre,
    p.id as producto_id,
    p.nombre as producto_nombre,
    p.sku,
    p.codigo_barras,
    b.id as bodega_id,
    b.nombre as bodega_nombre,
    b.codigo as bodega_codigo,
    b.tipo as bodega_tipo,
    pb.stock_actual,
    pb.stock_reservado,
    pb.stock_disponible,
    pb.stock_minimo,
    pb.stock_maximo,
    pb.ubicacion,
    CASE 
        WHEN pb.stock_actual = 0 THEN 'Agotado'
        WHEN pb.stock_disponible <= 0 THEN 'Sin Disponible'
        WHEN pb.stock_actual <= pb.stock_minimo THEN 'Stock Bajo'
        WHEN pb.stock_maximo IS NOT NULL AND pb.stock_actual >= pb.stock_maximo THEN 'Sobrestockeado'
        ELSE 'Normal'
    END as estado_stock,
    p.precio_compra,
    p.precio_venta,
    (pb.stock_actual * p.precio_compra) as valor_inventario,
    b.estado as bodega_estado,
    b.permite_ventas
FROM productos_bodegas pb
INNER JOIN productos p ON pb.producto_id = p.id
INNER JOIN bodegas b ON pb.bodega_id = b.id
INNER JOIN empresas e ON b.empresa_id = e.id
WHERE p.estado = 'activo' AND b.estado = 'activa';

-- Vista: Disponibilidad total de producto (todas las bodegas)
CREATE OR REPLACE VIEW vista_disponibilidad_producto AS
SELECT 
    p.id as producto_id,
    p.empresa_id,
    p.nombre as producto_nombre,
    p.sku,
    COUNT(DISTINCT pb.bodega_id) as total_bodegas,
    SUM(pb.stock_actual) as stock_total,
    SUM(pb.stock_reservado) as stock_reservado_total,
    SUM(pb.stock_disponible) as stock_disponible_total,
    MAX(pb.stock_actual) as stock_maximo_bodega,
    MIN(pb.stock_actual) as stock_minimo_bodega,
    GROUP_CONCAT(
        CONCAT(b.nombre, ': ', pb.stock_disponible) 
        ORDER BY pb.stock_disponible DESC 
        SEPARATOR ' | '
    ) as distribucion_stock
FROM productos p
LEFT JOIN productos_bodegas pb ON p.id = pb.producto_id
LEFT JOIN bodegas b ON pb.bodega_id = b.id AND b.estado = 'activa'
WHERE p.estado = 'activo'
GROUP BY p.id, p.empresa_id, p.nombre, p.sku;

-- Vista: Traslados completos con totales
CREATE OR REPLACE VIEW vista_traslados_completo AS
SELECT 
    t.id as traslado_id,
    t.empresa_id,
    e.nombre as empresa_nombre,
    t.numero_traslado,
    t.estado,
    bo.id as bodega_origen_id,
    bo.nombre as bodega_origen,
    bo.codigo as bodega_origen_codigo,
    bd.id as bodega_destino_id,
    bd.nombre as bodega_destino,
    bd.codigo as bodega_destino_codigo,
    t.fecha_solicitud,
    t.fecha_aprobacion,
    t.fecha_envio,
    t.fecha_recepcion,
    t.motivo,
    us.nombre as usuario_solicita,
    ua.nombre as usuario_aprueba,
    ue.nombre as usuario_envia,
    ur.nombre as usuario_recibe,
    COUNT(td.id) as total_productos,
    SUM(td.cantidad_solicitada) as total_solicitado,
    SUM(COALESCE(td.cantidad_aprobada, 0)) as total_aprobado,
    SUM(COALESCE(td.cantidad_enviada, 0)) as total_enviado,
    SUM(COALESCE(td.cantidad_recibida, 0)) as total_recibido,
    SUM(COALESCE(td.cantidad_diferencia, 0)) as total_diferencia,
    t.created_at
FROM traslados t
INNER JOIN empresas e ON t.empresa_id = e.id
INNER JOIN bodegas bo ON t.bodega_origen_id = bo.id
INNER JOIN bodegas bd ON t.bodega_destino_id = bd.id
LEFT JOIN usuarios us ON t.usuario_solicita_id = us.id
LEFT JOIN usuarios ua ON t.usuario_aprueba_id = ua.id
LEFT JOIN usuarios ue ON t.usuario_envia_id = ue.id
LEFT JOIN usuarios ur ON t.usuario_recibe_id = ur.id
LEFT JOIN traslados_detalle td ON t.id = td.traslado_id
GROUP BY 
    t.id, t.empresa_id, e.nombre, t.numero_traslado, t.estado,
    bo.id, bo.nombre, bo.codigo, bd.id, bd.nombre, bd.codigo,
    t.fecha_solicitud, t.fecha_aprobacion, t.fecha_envio, t.fecha_recepcion,
    t.motivo, us.nombre, ua.nombre, ue.nombre, ur.nombre, t.created_at;

-- =====================================================
-- 6. TRIGGER: Crear bodega principal al crear empresa
-- =====================================================

DELIMITER $$

DROP TRIGGER IF EXISTS after_empresa_create_bodega_principal$$

CREATE TRIGGER after_empresa_create_bodega_principal
AFTER INSERT ON empresas
FOR EACH ROW
BEGIN
    -- Crear bodega principal automáticamente
    INSERT INTO bodegas (
        empresa_id,
        codigo,
        nombre,
        descripcion,
        tipo,
        es_principal,
        permite_ventas,
        estado,
        created_at
    ) VALUES (
        NEW.id,
        'BOD-PRINCIPAL',
        'Bodega Principal',
        'Bodega principal creada automáticamente',
        'bodega',
        TRUE,
        TRUE,
        'activa',
        NOW()
    );
END$$

DELIMITER ;

-- =====================================================
-- 7. ÍNDICES ADICIONALES PARA PERFORMANCE
-- =====================================================

-- Índice para búsquedas rápidas de productos con stock bajo
CREATE INDEX idx_stock_bajo_por_bodega 
ON productos_bodegas (bodega_id, stock_actual, stock_minimo)
WHERE stock_actual <= stock_minimo;

-- Índice para traslados pendientes
CREATE INDEX idx_traslados_pendientes 
ON traslados (empresa_id, estado, fecha_solicitud)
WHERE estado IN ('pendiente_aprobacion', 'aprobado', 'en_transito');

-- =====================================================
-- 8. REGISTRAR MIGRACIÓN
-- =====================================================

INSERT INTO auditoria_logs (
    usuario_id,
    modulo,
    accion,
    ip,
    user_agent
) VALUES (
    1,
    'MIGRACIONES',
    'BODEGAS_TRASLADOS_CREATED',
    'SCRIPT',
    'SQL_MIGRATION'
);

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- 9. VERIFICACIÓN
-- =====================================================

SELECT '
=====================================================
✅ MIGRACIÓN COMPLETADA: SISTEMA DE BODEGAS
=====================================================

Tablas creadas:
- bodegas
- productos_bodegas
- traslados
- traslados_detalle

Vistas creadas:
- vista_stock_por_bodega
- vista_disponibilidad_producto
- vista_traslados_completo

Triggers creados:
- after_empresa_create_bodega_principal

Próximos pasos:
1. Crear backends (controllers + routes)
2. Crear frontend (UI de gestión)
3. Probar flujo completo

=====================================================
' as RESULTADO;

-- Verificar tablas creadas
SHOW TABLES LIKE '%bodega%';
SHOW TABLES LIKE '%traslado%';
