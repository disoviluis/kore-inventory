-- ===================================================
-- SCRIPT PARA ELIMINAR EMPRESA PRUEBA1 
-- Empresa ID: 18 - PRUEBA1
-- Versión ULTRA MINIMAL - Solo tablas core
-- ===================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Eliminar detalles de traslados
DELETE td FROM traslados_detalle td
INNER JOIN traslados t ON td.traslado_id = t.id
WHERE t.empresa_id = 18;

-- 2. Eliminar traslados
DELETE FROM traslados WHERE empresa_id = 18;

-- 3. Eliminar productos
DELETE FROM productos WHERE empresa_id = 18;

-- 4. Eliminar bodegas
DELETE FROM bodegas WHERE empresa_id = 18;

-- 5. Eliminar clientes (si existe)
DELETE FROM clientes WHERE empresa_id = 18;

-- 6. Eliminar proveedores (si existe)
DELETE FROM proveedores WHERE empresa_id = 18;

-- 7. Eliminar permisos de roles personalizados
DELETE rp FROM rol_permiso rp
INNER JOIN roles r ON rp.rol_id = r.id
WHERE r.empresa_id = 18;

-- 8. Eliminar asignaciones de roles
DELETE ur FROM usuario_rol ur
INNER JOIN roles r ON ur.rol_id = r.id
WHERE r.empresa_id = 18;

-- 9. Eliminar roles personalizados
DELETE FROM roles WHERE empresa_id = 18;

-- 10. Eliminar relación usuario-empresa
DELETE FROM usuario_empresa WHERE empresa_id = 18;

-- 11. Eliminar categorías
DELETE FROM categorias WHERE empresa_id = 18;

-- 12. FINALMENTE: Eliminar la empresa
DELETE FROM empresas WHERE id = 18;

SET FOREIGN_KEY_CHECKS = 1;

-- Verificar
SELECT '=== ELIMINACIÓN COMPLETADA ===' as info;
SELECT 'Empresa PRUEBA1 (debe ser 0):' as verificacion, COUNT(*) as total FROM empresas WHERE id = 18;
