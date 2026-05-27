-- ================================================
-- Agregar productos a traslados del mensajero
-- ================================================
-- Problema: Traslados 1-5 no tienen productos
-- Solución: Agregar el producto 16 a cada traslado
-- ================================================

-- Ver traslados sin productos
SELECT 
    t.id, 
    t.numero_traslado, 
    t.estado,
    COUNT(td.id) as productos
FROM traslados t
LEFT JOIN traslados_detalle td ON t.id = td.traslado_id
WHERE t.mensajero_id = 5
GROUP BY t.id
HAVING productos = 0;

-- Agregar producto 16 a cada traslado sin productos
INSERT INTO traslados_detalle (traslado_id, producto_id, cantidad_solicitada, cantidad_aprobada, cantidad_enviada)
VALUES
(1, 16, 15, 15, 15),
(2, 16, 20, 20, 20),
(3, 16, 10, 10, 10),
(4, 16, 25, 25, 25),
(5, 16, 12, 12, 12);

-- Verificar que se agregaron correctamente
SELECT 
    t.id, 
    t.numero_traslado, 
    t.estado,
    COUNT(td.id) as productos,
    SUM(td.cantidad_aprobada) as total_unidades
FROM traslados t
LEFT JOIN traslados_detalle td ON t.id = td.traslado_id
WHERE t.mensajero_id = 5
GROUP BY t.id
ORDER BY t.id DESC;
