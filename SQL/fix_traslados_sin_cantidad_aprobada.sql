-- ================================================
-- FIX: Traslados sin cantidad_aprobada
-- ================================================
-- Problema: Algunos traslados tienen cantidad_aprobada = NULL
-- lo que impide que se puedan recibir correctamente
-- 
-- Solución: Copiar cantidad_solicitada a cantidad_aprobada
--           para traslados en_transito sin aprobación
-- ================================================

-- Ver traslados afectados
SELECT 
    t.id, 
    t.numero_traslado, 
    t.estado,
    td.producto_id,
    td.cantidad_solicitada,
    td.cantidad_aprobada,
    td.cantidad_enviada
FROM traslados t
INNER JOIN traslados_detalle td ON t.id = td.traslado_id
WHERE td.cantidad_aprobada IS NULL
  AND t.estado = 'en_transito';

-- Actualizar cantidad_aprobada = cantidad_solicitada
-- para traslados que están en_transito pero sin aprobación
UPDATE traslados_detalle td
INNER JOIN traslados t ON td.traslado_id = t.id
SET td.cantidad_aprobada = td.cantidad_solicitada
WHERE td.cantidad_aprobada IS NULL
  AND t.estado = 'en_transito';

-- Verificar corrección
SELECT 
    t.id, 
    t.numero_traslado, 
    t.estado,
    td.producto_id,
    td.cantidad_solicitada,
    td.cantidad_aprobada,
    td.cantidad_enviada,
    td.cantidad_recibida
FROM traslados t
INNER JOIN traslados_detalle td ON t.id = td.traslado_id
WHERE t.id IN (3,4,6);
