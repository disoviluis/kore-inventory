-- =====================================================
-- SCRIPT: CREAR PERMISOS FALTANTES PARA TODOS LOS MÓDULOS
-- Fecha: 2026-05-28
-- Descripción: Genera permisos completos para matriz de roles
-- =====================================================

USE kore_inventory;

-- =====================================================
-- 1. PERMISOS PARA MÓDULO: EMPRESAS (id=1)
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT 1, a.id, CONCAT('empresas.', a.nombre), CONCAT(a.nombre_mostrar, ' empresas'), 1
FROM acciones a
WHERE a.nombre IN ('view', 'create', 'edit', 'delete', 'export')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = 1 AND p.accion_id = a.id
  );

-- =====================================================
-- 2. PERMISOS PARA MÓDULO: PLANES (id=2)
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT 2, a.id, CONCAT('planes.', a.nombre), CONCAT(a.nombre_mostrar, ' planes'), 1
FROM acciones a
WHERE a.nombre IN ('view', 'create', 'edit', 'delete')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = 2 AND p.accion_id = a.id
  );

-- =====================================================
-- 3. PERMISOS PARA MÓDULO: LICENCIAS (id=3)
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT 3, a.id, CONCAT('licencias.', a.nombre), CONCAT(a.nombre_mostrar, ' licencias'), 1
FROM acciones a
WHERE a.nombre IN ('view', 'create', 'edit', 'delete', 'approve')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = 3 AND p.accion_id = a.id
  );

-- =====================================================
-- 4. PERMISOS PARA MÓDULO: USUARIOS (id=5)
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT 5, a.id, CONCAT('usuarios.', a.nombre), CONCAT(a.nombre_mostrar, ' usuarios'), 1
FROM acciones a
WHERE a.nombre IN ('view', 'create', 'edit', 'delete', 'export', 'import')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = 5 AND p.accion_id = a.id
  );

-- =====================================================
-- 5. PERMISOS PARA MÓDULO: ROLES (id=6)
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT 6, a.id, CONCAT('roles.', a.nombre), CONCAT(a.nombre_mostrar, ' roles y permisos'), 1
FROM acciones a
WHERE a.nombre IN ('view', 'create', 'edit', 'delete')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = 6 AND p.accion_id = a.id
  );

-- =====================================================
-- 6. PERMISOS ADICIONALES PARA MÓDULO: POS (id=7)
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT 7, a.id, CONCAT('pos.', a.nombre), CONCAT(a.nombre_mostrar, ' punto de venta'), 1
FROM acciones a
WHERE a.nombre IN ('edit', 'delete', 'print')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = 7 AND p.accion_id = a.id
  );

-- =====================================================
-- 7. PERMISOS PARA MÓDULO: CLIENTES (id=9) ⭐⭐⭐
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT 9, a.id, CONCAT('clientes.', a.nombre), CONCAT(a.nombre_mostrar, ' clientes'), 1
FROM acciones a
WHERE a.nombre IN ('view', 'create', 'edit', 'delete', 'export', 'import')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = 9 AND p.accion_id = a.id
  );

-- =====================================================
-- 8. PERMISOS ADICIONALES PARA MÓDULO: INVENTARIO (id=11)
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT 11, a.id, CONCAT('inventario.', a.nombre), CONCAT(a.nombre_mostrar, ' inventario'), 1
FROM acciones a
WHERE a.nombre IN ('create', 'delete', 'export', 'import', 'print')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = 11 AND p.accion_id = a.id
  );

-- =====================================================
-- 9. PERMISOS PARA MÓDULO: COMPRAS (id=12) ⭐⭐⭐
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT 12, a.id, CONCAT('compras.', a.nombre), CONCAT(a.nombre_mostrar, ' compras'), 1
FROM acciones a
WHERE a.nombre IN ('view', 'create', 'edit', 'delete', 'approve', 'export', 'print')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = 12 AND p.accion_id = a.id
  );

-- =====================================================
-- 10. PERMISOS PARA MÓDULO: PROVEEDORES (id=13) ⭐⭐⭐
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT 13, a.id, CONCAT('proveedores.', a.nombre), CONCAT(a.nombre_mostrar, ' proveedores'), 1
FROM acciones a
WHERE a.nombre IN ('view', 'create', 'edit', 'delete', 'export', 'import')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = 13 AND p.accion_id = a.id
  );

-- =====================================================
-- 11. PERMISOS PARA MÓDULO: CAJA (id=14)
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT 14, a.id, CONCAT('caja.', a.nombre), CONCAT(a.nombre_mostrar, ' movimientos de caja'), 1
FROM acciones a
WHERE a.nombre IN ('view', 'create', 'edit', 'delete', 'approve', 'print')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = 14 AND p.accion_id = a.id
  );

-- =====================================================
-- 12. PERMISOS PARA MÓDULO: BANCOS (id=15)
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT 15, a.id, CONCAT('bancos.', a.nombre), CONCAT(a.nombre_mostrar, ' cuentas bancarias'), 1
FROM acciones a
WHERE a.nombre IN ('view', 'create', 'edit', 'delete', 'export', 'print')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = 15 AND p.accion_id = a.id
  );

-- =====================================================
-- 13. PERMISOS PARA MÓDULO: CONTABILIDAD (id=16)
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT 16, a.id, CONCAT('contabilidad.', a.nombre), CONCAT(a.nombre_mostrar, ' contabilidad'), 1
FROM acciones a
WHERE a.nombre IN ('view', 'create', 'edit', 'delete', 'approve', 'export', 'print')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = 16 AND p.accion_id = a.id
  );

-- =====================================================
-- 14. PERMISOS PARA MÓDULO: REPORTES (id=17)
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT 17, a.id, CONCAT('reportes.', a.nombre), CONCAT(a.nombre_mostrar, ' reportes'), 1
FROM acciones a
WHERE a.nombre IN ('view', 'export', 'print')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = 17 AND p.accion_id = a.id
  );

-- =====================================================
-- 15. PERMISOS PARA MÓDULO: BODEGAS (si existe)
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT m.id, a.id, CONCAT('bodegas.', a.nombre), CONCAT(a.nombre_mostrar, ' bodegas'), 1
FROM modulos m
CROSS JOIN acciones a
WHERE m.nombre = 'bodegas'
  AND a.nombre IN ('view', 'create', 'edit', 'delete')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = m.id AND p.accion_id = a.id
  );

-- =====================================================
-- 16. PERMISOS PARA MÓDULO: TRASLADOS (si existe)
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT m.id, a.id, CONCAT('traslados.', a.nombre), CONCAT(a.nombre_mostrar, ' traslados'), 1
FROM modulos m
CROSS JOIN acciones a
WHERE m.nombre = 'traslados'
  AND a.nombre IN ('view', 'create', 'edit', 'delete', 'approve', 'export', 'print')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = m.id AND p.accion_id = a.id
  );

-- =====================================================
-- 17. PERMISOS PARA MÓDULO: MENSAJEROS (si existe)
-- =====================================================
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT m.id, a.id, CONCAT('mensajeros.', a.nombre), CONCAT(a.nombre_mostrar, ' control mensajeros'), 1
FROM modulos m
CROSS JOIN acciones a
WHERE m.nombre = 'mensajeros'
  AND a.nombre IN ('view')
  AND NOT EXISTS (
    SELECT 1 FROM permisos p WHERE p.modulo_id = m.id AND p.accion_id = a.id
  );

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================
SELECT '========================================' as '';
SELECT '   RESUMEN DE PERMISOS CREADOS' as '';
SELECT '========================================' as '';

SELECT 
  m.id,
  m.nombre as modulo,
  m.nombre_mostrar,
  COUNT(p.id) as total_permisos,
  GROUP_CONCAT(a.nombre_mostrar ORDER BY a.id SEPARATOR ', ') as acciones_disponibles
FROM modulos m
LEFT JOIN permisos p ON m.id = p.modulo_id
LEFT JOIN acciones a ON p.accion_id = a.id
WHERE m.activo = 1
GROUP BY m.id, m.nombre, m.nombre_mostrar
ORDER BY m.id;

SELECT '========================================' as '';
SELECT CONCAT('✅ TOTAL DE PERMISOS EN EL SISTEMA: ', COUNT(*)) as resultado
FROM permisos
WHERE activo = 1;
SELECT '========================================' as '';
