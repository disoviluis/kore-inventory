-- Script simple para crear traslado de prueba
USE kore_inventory;

-- Crear producto si no existe
INSERT IGNORE INTO productos (
    empresa_id, nombre, sku, precio_minorista, tipo, estado
) VALUES (
    18, 'Producto Prueba Mensajero', 'PROD-MENS-001', 10000.00, 'producto', 'activo'
);

-- Obtener ID del producto
SET @producto_id = (SELECT id FROM productos WHERE empresa_id = 18 AND sku = 'PROD-MENS-001' LIMIT 1);

-- Obtener bodegas
SET @bodega_origen = (SELECT id FROM bodegas WHERE empresa_id = 18 LIMIT 1);
SET @bodega_destino = (SELECT id FROM bodegas WHERE empresa_id = 18 LIMIT 1 OFFSET 1);
SET @bodega_destino = IFNULL(@bodega_destino, @bodega_origen);

-- Asegurar stock en bodega origen
INSERT INTO productos_bodegas (bodega_id, producto_id, stock_actual)
VALUES (@bodega_origen, @producto_id, 50)
ON DUPLICATE KEY UPDATE stock_actual = GREATEST(stock_actual, 50);

-- Generar número de traslado
SET @numero = CONCAT('TRS-2025-', LPAD(FLOOR(RAND() * 9999) + 1, 4, '0'));

-- Crear traslado
INSERT INTO traslados (
    empresa_id, numero_traslado, bodega_origen_id, bodega_destino_id,
    estado, motivo, mensajero_id,
    destinatario_nombre, destinatario_documento, destinatario_telefono, destinatario_cargo
) VALUES (
    18, @numero, @bodega_origen, @bodega_destino,
    'en_transito', 'Prueba mensajero', 5,
    'Carlos Pérez', '1234567890', '+57 300 111 2222', 'Jefe Almacén'
);

SET @traslado_id = LAST_INSERT_ID();

-- Agregar detalle
INSERT INTO traslados_detalle (
    traslado_id, producto_id, cantidad_solicitada, cantidad_enviada
) VALUES (
    @traslado_id, @producto_id, 10, 10
);

-- Mostrar resultado
SELECT 
    @traslado_id as traslado_id,
    @numero as numero_traslado,
    'en_transito' as estado,
    'http://18.191.181.99/mensajeros-dashboard.html' as url_prueba,
    'mensajero.prueba@kore.com' as email,
    'Password123' as password;
