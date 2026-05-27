-- ================================================================
-- FIX: Corregir licencias con estado vacío
-- ================================================================
-- Problema: Las licencias de prueba se creaban con estado 'trial'
-- pero el campo ENUM solo acepta: 'activa','vencida','cancelada','suspendida'
-- Por eso quedaban con estado vacío ('')
-- ================================================================

-- Ver licencias afectadas (estado vacío)
SELECT 
    l.id,
    e.nombre as empresa,
    l.estado,
    l.fecha_inicio,
    l.fecha_fin,
    DATEDIFF(l.fecha_fin, CURDATE()) as dias_restantes
FROM licencias l
INNER JOIN empresas e ON l.empresa_id = e.id
WHERE l.estado = '' OR l.estado IS NULL;

-- Actualizar licencias con estado vacío a 'activa'
UPDATE licencias 
SET estado = 'activa' 
WHERE estado = '' OR estado IS NULL;

-- Verificar que se corrigieron
SELECT 
    l.id,
    e.nombre as empresa,
    l.estado,
    l.fecha_inicio,
    l.fecha_fin,
    DATEDIFF(l.fecha_fin, CURDATE()) as dias_restantes
FROM licencias l
INNER JOIN empresas e ON l.empresa_id = e.id
WHERE l.empresa_id IN (19, 20);
