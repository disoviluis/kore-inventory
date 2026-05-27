-- ================================================================
-- SCRIPT DE VERIFICACIÓN DIARIA DE LICENCIAS
-- ================================================================
-- Este script debe ejecutarse diariamente mediante cron job
-- Ejecutar: mysql -h HOST -u USER -pPASSWORD kore_inventory < verificacion_diaria_licencias.sql
-- Cron: 0 1 * * * (cada día a la 1:00 AM)
-- ================================================================

USE kore_inventory;

-- ================================================================
-- 1. MARCAR LICENCIAS VENCIDAS
-- ================================================================

UPDATE licencias 
SET 
  estado = 'vencida',
  updated_at = CURRENT_TIMESTAMP
WHERE fecha_fin < CURDATE() 
  AND estado = 'activa'
  AND en_periodo_gracia = FALSE;

-- Registrar evento
INSERT INTO licencias_eventos (empresa_id, licencia_id, evento, descripcion, datos)
SELECT 
  l.empresa_id,
  l.id,
  'licencia_vencida',
  CONCAT('Licencia vencida el ', l.fecha_fin),
  JSON_OBJECT(
    'fecha_fin', l.fecha_fin,
    'dias_vencida', DATEDIFF(CURDATE(), l.fecha_fin)
  )
FROM licencias l
WHERE l.estado = 'vencida'
  AND DATE(l.updated_at) = CURDATE();

-- ================================================================
-- 2. SUSPENDER EMPRESAS CON LICENCIA VENCIDA
-- ================================================================

UPDATE empresas e
INNER JOIN licencias l ON e.id = l.empresa_id
SET 
  e.estado = 'suspendida',
  e.updated_at = CURRENT_TIMESTAMP
WHERE l.estado = 'vencida' 
  AND e.estado IN ('activa', 'trial');

-- Registrar evento
INSERT INTO licencias_eventos (empresa_id, licencia_id, evento, descripcion)
SELECT 
  e.id,
  l.id,
  'empresa_suspendida',
  'Empresa suspendida por licencia vencida'
FROM empresas e
INNER JOIN licencias l ON e.id = l.empresa_id
WHERE e.estado = 'suspendida'
  AND l.estado = 'vencida'
  AND DATE(e.updated_at) = CURDATE();

-- ================================================================
-- 3. FINALIZAR PERÍODO DE GRACIA
-- ================================================================

-- Suspender empresas que terminaron período de gracia sin pagar
UPDATE licencias l
INNER JOIN empresas e ON l.empresa_id = e.id
SET 
  l.estado = 'vencida',
  l.en_periodo_gracia = FALSE,
  e.estado = 'suspendida'
WHERE l.en_periodo_gracia = TRUE
  AND DATEDIFF(CURDATE(), l.fecha_fin) > 
    (SELECT CAST(valor AS UNSIGNED) FROM sistema_configuracion WHERE clave = 'dias_periodo_gracia' LIMIT 1);

-- ================================================================
-- 4. ENVIAR NOTIFICACIONES DE PRÓXIMO VENCIMIENTO
-- ================================================================

-- Seleccionar licencias que vencen en X días (configurado en sistema_configuracion)
SELECT 
  e.id as empresa_id,
  e.nombre as empresa_nombre,
  e.email,
  u.nombre as usuario_nombre,
  u.email as usuario_email,
  l.id as licencia_id,
  l.fecha_fin,
  DATEDIFF(l.fecha_fin, CURDATE()) as dias_restantes,
  p.nombre as plan_nombre,
  l.monto,
  l.tipo_facturacion,
  'RECORDATORIO_VENCIMIENTO' as tipo_notificacion
FROM licencias l
INNER JOIN empresas e ON l.empresa_id = e.id
INNER JOIN planes p ON l.plan_id = p.id
LEFT JOIN usuario_empresa ue ON e.id = ue.empresa_id AND ue.activo = 1
LEFT JOIN usuarios u ON ue.usuario_id = u.id AND u.tipo_usuario IN ('admin_empresa', 'super_admin')
WHERE l.estado = 'activa'
  AND DATEDIFF(l.fecha_fin, CURDATE()) IN (
    SELECT CAST(valor AS UNSIGNED) FROM sistema_configuracion WHERE clave = 'dias_aviso_vencimiento'
  )
INTO OUTFILE '/tmp/notificaciones_vencimiento.json'
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n';

-- ================================================================
-- 5. PROCESAR RENOVACIONES AUTOMÁTICAS
-- ================================================================

-- Seleccionar licencias para renovar hoy
SELECT 
  e.id as empresa_id,
  e.nombre as empresa_nombre,
  e.email as empresa_email,
  l.id as licencia_id,
  l.plan_id,
  l.monto,
  l.tipo_facturacion,
  l.auto_renovacion,
  p.nombre as plan_nombre,
  'RENOVACION_AUTOMATICA' as tipo_accion
FROM licencias l
INNER JOIN empresas e ON l.empresa_id = e.id
INNER JOIN planes p ON l.plan_id = p.id
WHERE l.estado = 'activa'
  AND l.auto_renovacion = TRUE
  AND l.fecha_fin = CURDATE()
  AND l.intentos_cobro_fallidos < (
    SELECT CAST(valor AS UNSIGNED) FROM sistema_configuracion WHERE clave = 'max_intentos_cobro' LIMIT 1
  )
INTO OUTFILE '/tmp/renovaciones_pendientes.json'
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n';

-- ================================================================
-- 6. MARCAR TRIALS VENCIDOS
-- ================================================================

-- Convertir empresas con trial vencido a suspendidas
UPDATE empresas e
LEFT JOIN licencias l ON e.id = l.empresa_id AND l.estado = 'activa'
SET 
  e.estado = 'suspendida',
  e.updated_at = CURRENT_TIMESTAMP
WHERE e.estado = 'trial'
  AND e.fecha_fin_trial < CURDATE()
  AND (l.id IS NULL OR l.estado != 'activa');

-- Registrar evento
INSERT INTO licencias_eventos (empresa_id, evento, descripcion, datos)
SELECT 
  e.id,
  'trial_vencido',
  CONCAT('Período de prueba vencido el ', e.fecha_fin_trial),
  JSON_OBJECT(
    'fecha_fin_trial', e.fecha_fin_trial,
    'dias_vencido', DATEDIFF(CURDATE(), e.fecha_fin_trial)
  )
FROM empresas e
WHERE e.estado = 'suspendida'
  AND e.fecha_fin_trial < CURDATE()
  AND DATE(e.updated_at) = CURDATE();

-- ================================================================
-- 7. REPORTE DIARIO
-- ================================================================

-- Reporte de actividad del día
SELECT 
  'RESUMEN_DIARIO' as tipo,
  CURDATE() as fecha,
  (SELECT COUNT(*) FROM licencias WHERE estado = 'vencida' AND DATE(updated_at) = CURDATE()) as licencias_vencidas_hoy,
  (SELECT COUNT(*) FROM empresas WHERE estado = 'suspendida' AND DATE(updated_at) = CURDATE()) as empresas_suspendidas_hoy,
  (SELECT COUNT(*) FROM licencias WHERE estado = 'activa' AND DATEDIFF(fecha_fin, CURDATE()) <= 7) as licencias_por_vencer_7dias,
  (SELECT COUNT(*) FROM licencias WHERE estado = 'activa' AND fecha_fin = CURDATE()) as renovaciones_pendientes_hoy,
  (SELECT COUNT(*) FROM empresas WHERE estado = 'trial') as empresas_en_trial,
  (SELECT COUNT(*) FROM licencias WHERE estado = 'activa') as licencias_activas_total;

-- ================================================================
-- 8. LIMPIAR ARCHIVOS TEMPORALES (llamar desde script bash)
-- ================================================================
-- rm -f /tmp/notificaciones_vencimiento.json
-- rm -f /tmp/renovaciones_pendientes.json

-- ================================================================
-- FIN DEL SCRIPT
-- ================================================================
