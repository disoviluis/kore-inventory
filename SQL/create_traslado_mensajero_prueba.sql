-- ========================================
-- SCRIPT: Crear traslado de prueba para mensajero
-- Database: kore_inventory
-- Purpose: Crear un traslado en estado 'en_transito' asignado al mensajero de prueba
-- ========================================

USE kore_inventory;

-- Obtener IDs de bodegas de PRUEBA1
SET @bodega_origen = (SELECT id FROM bodegas WHERE empresa_id = 18 AND es_principal = 1 LIMIT 1);
SET @bodega_destino = (SELECT id FROM bodegas WHERE empresa_id = 18 AND es_principal = 0 LIMIT 1);

-- Si solo tiene una bodega, usar la misma
SET @bodega_destino = IFNULL(@bodega_destino, @bodega_origen);

-- Generar número de traslado
SET @siguiente_numero = (
    SELECT IFNULL(MAX(CAST(SUBSTRING_INDEX(numero_traslado, '-', -1) AS UNSIGNED)), 0) + 1 
    FROM traslados 
    WHERE empresa_id = 18
);

SET @numero_traslado = CONCAT('TRS-', YEAR(NOW()), '-', LPAD(@siguiente_numero, 4, '0'));

-- Crear traslado
INSERT INTO traslados (
    empresa_id,
    numero_traslado,
    bodega_origen_id,
    bodega_destino_id,
    estado,
    motivo,
    usuario_solicita_id,
    usuario_aprueba_id,
    usuario_envia_id,
    mensajero_id,
    destinatario_nombre,
    destinatario_documento,
    destinatario_telefono,
    destinatario_cargo,
    fecha_solicitud,
    fecha_aprobacion,
    fecha_envio,
    created_at,
    updated_at
) VALUES (
    18,                                   -- empresa_id (PRUEBA1)
    @numero_traslado,                     -- numero_traslado (TRS-2025-0001)
    @bodega_origen,                       -- bodega_origen_id
    @bodega_destino,                      -- bodega_destino_id
    'en_transito',                        -- estado (lista para iniciar)
    'Traslado de prueba para mensajero',  -- motivo
    1,                                    -- usuario_solicita_id
    1,                                    -- usuario_aprueba_id
    1,                                    -- usuario_envia_id
    5,                                    -- mensajero_id (Juan Mensajero)
    'Carlos Pérez',                       -- destinatario_nombre
    '1234567890',                         -- destinatario_documento
    '+57 300 111 2222',                   -- destinatario_telefono
    'Jefe de Almacén',                    -- destinatario_cargo
    NOW(),                                -- fecha_solicitud
    NOW(),                                -- fecha_aprobacion
    NOW(),                                -- fecha_envio
    NOW(),                                -- created_at
    NOW()                                 -- updated_at
);

-- Obtener ID del traslado creado
SET @traslado_id = LAST_INSERT_ID();

-- Obtener un producto de la bodega origen o cualquier producto de la empresa
SET @producto_id = COALESCE(
    (SELECT producto_id FROM productos_bodegas WHERE bodega_id = @bodega_origen AND stock_actual > 0 LIMIT 1),
    (SELECT id FROM productos WHERE empresa_id = 18 LIMIT 1)
);

-- Asegurar stock en bodega origen si no existe
INSERT INTO productos_bodegas (bodega_id, producto_id, stock_actual, stock_reservado, created_at, updated_at)
VALUES (@bodega_origen, @producto_id, 20, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE 
    stock_actual = GREATEST(stock_actual, 20),
    updated_at = NOW();

-- Agregar detalle del traslado
INSERT INTO traslados_detalle (
    traslado_id,
    producto_id,
    cantidad_solicitada,
    cantidad_enviada,
    cantidad_recibida,
    precio_unitario,
    created_at,
    updated_at
) VALUES (
    @traslado_id,
    @producto_id,
    10,       -- cantidad_solicitada
    10,       -- cantidad_enviada
    0,        -- cantidad_recibida (pendiente)
    10000.00, -- precio_unitario
    NOW(),
    NOW()
);

-- ========================================
-- RESULTADOS DE VERIFICACIÓN
-- ========================================

SELECT '✅ Traslado creado exitosamente' as resultado;

SELECT 
    @traslado_id as traslado_id,
    @numero_traslado as numero_traslado,
    'en_transito' as estado,
    '5 (Juan Mensajero)' as mensajero_id;

SELECT 
    'Detalles del traslado:' as seccion,
    t.id,
    t.numero_traslado,
    t.estado,
    CONCAT(bo.nombre, ' → ', bd.nombre) as ruta,
    t.destinatario_nombre,
    t.destinatario_telefono,
    t.destinatario_cargo,
    CONCAT(m.nombre, ' ', m.apellido) as mensajero,
    (SELECT COUNT(*) FROM traslados_detalle WHERE traslado_id = t.id) as productos_count
FROM traslados t
LEFT JOIN bodegas bo ON t.bodega_origen_id = bo.id
LEFT JOIN bodegas bd ON t.bodega_destino_id = bd.id
LEFT JOIN usuarios m ON t.mensajero_id = m.id
WHERE t.id = @traslado_id;

SELECT 
    'Productos del traslado:' as seccion,
    p.sku,
    p.nombre,
    td.cantidad_solicitada,
    td.cantidad_enviada,
    td.cantidad_recibida,
    td.precio_unitario
FROM traslados_detalle td
INNER JOIN productos p ON td.producto_id = p.id
WHERE td.traslado_id = @traslado_id;

SELECT 
    'Stock en bodega origen:' as seccion,
    b.nombre as bodega,
    p.sku,
    p.nombre,
    pb.stock_actual,
    pb.stock_reservado,
    pb.stock_disponible
FROM productos_bodegas pb
INNER JOIN productos p ON pb.producto_id = p.id
INNER JOIN bodegas b ON pb.bodega_id = b.id
WHERE pb.bodega_id = @bodega_origen
AND pb.producto_id = @producto_id;

-- Instrucciones para prueba
SELECT 
    'Ahora puedes probar el flujo completo:' as instrucciones,
    'http://18.191.181.99/mensajeros-dashboard.html' as url_login,
    'mensajero.prueba@kore.com' as email,
    'Password123' as password,
    @numero_traslado as traslado_numero,
    'Pendientes → Iniciar Ruta → Recibir → Firmar' as flujo;
