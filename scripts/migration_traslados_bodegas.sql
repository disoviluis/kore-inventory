-- =====================================================
-- MIGRACIÓN: Módulos y Permisos para Traslados y Bodegas
-- Fecha: 2026-05-14
-- Descripción: Integración completa del sistema de traslados
-- =====================================================

-- 1. CREAR ACCIONES ADICIONALES
-- =====================================================
INSERT INTO acciones (nombre, nombre_mostrar, descripcion, activo)
VALUES 
  ('assign', 'Asignar', 'Asignar a usuario o mensajero', 1),
  ('receive', 'Recibir', 'Recibir y completar traslado', 1)
ON DUPLICATE KEY UPDATE nombre = nombre;

-- 2. CREAR MÓDULOS
-- =====================================================
INSERT INTO modulos (nombre, nombre_mostrar, descripcion, nivel, categoria, orden, activo)
VALUES 
  ('bodegas', 'Bodegas', 'Gestión de bodegas y locales', 'tenant', 'inventario', 11, 1),
  ('traslados', 'Traslados', 'Gestión de traslados entre bodegas', 'tenant', 'inventario', 12, 1);

-- 3. CREAR PERMISOS PARA BODEGAS
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT 
  m.id,
  a.id,
  CONCAT('bodegas.', a.nombre),
  CONCAT(a.nombre_mostrar, ' bodegas'),
  1
FROM modulos m
CROSS JOIN acciones a
WHERE m.nombre = 'bodegas'
  AND a.nombre IN ('view', 'create', 'edit', 'delete');

-- 4. CREAR PERMISOS PARA TRASLADOS
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT 
  m.id,
  a.id,
  CONCAT('traslados.', a.nombre),
  CONCAT(a.nombre_mostrar, ' traslados'),
  1
FROM modulos m
CROSS JOIN acciones a
WHERE m.nombre = 'traslados'
  AND a.nombre IN ('view', 'create', 'edit', 'delete', 'approve', 'assign', 'receive');

-- 5. VERIFICACIÓN
-- =====================================================
SELECT 
  '=== MÓDULOS CREADOS ===' as resultado;

SELECT id, nombre, nombre_mostrar, nivel 
FROM modulos 
WHERE nombre IN ('bodegas', 'traslados');

SELECT 
  '=== PERMISOS BODEGAS ===' as resultado;

SELECT p.id, p.codigo, p.descripcion
FROM permisos p
JOIN modulos m ON p.modulo_id = m.id
WHERE m.nombre = 'bodegas'
ORDER BY p.codigo;

SELECT 
  '=== PERMISOS TRASLADOS ===' as resultado;

SELECT p.id, p.codigo, p.descripcion
FROM permisos p
JOIN modulos m ON p.modulo_id = m.id
WHERE m.nombre = 'traslados'
ORDER BY p.codigo;

SELECT 
  '=== RESUMEN FINAL ===' as resultado;

SELECT 
  COUNT(*) as total_modulos 
FROM modulos 
WHERE activo = 1;

SELECT 
  COUNT(*) as total_permisos 
FROM permisos 
WHERE activo = 1;
