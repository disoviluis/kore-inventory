-- ===================================================
-- SCRIPT PARA ELIMINAR EMPRESA PRUEBA1 Y TODOS SUS DATOS
-- Empresa ID: 18 - PRUEBA1
-- Versión MINIMAL - Sin JOINs complejos
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

-- 5. Eliminar clientes
DELETE FROM clientes WHERE empresa_id = 18;

-- 6. Eliminar proveedores
DELETE FROM proveedores WHERE empresa_id = 18;

-- 7. Eliminar permisos de roles personalizados
DELETE rp FROM rol_permiso rp
INNER JOIN roles r ON rp.rol_id = r.id
WHERE r.empresa_id = 18;

-- 8. Eliminar asignaciones de roles de usuarios de esta empresa
DELETE ur FROM usuario_rol ur
INNER JOIN roles r ON ur.rol_id = r.id
WHERE r.empresa_id = 18;

-- 9. Eliminar roles personalizados
DELETE FROM roles WHERE empresa_id = 18;

-- 10. Eliminar relación usuario-empresa
DELETE FROM usuario_empresa WHERE empresa_id = 18;

-- 11. Eliminar logs de auditoría
DELETE FROM auditoria_logs WHERE empresa_id = 18;

-- 12. Eliminar configuración de facturación
DELETE FROM facturacion_config WHERE empresa_id = 18;

-- 13. Eliminar resoluciones de facturación
DELETE FROM resoluciones_facturacion WHERE empresa_id = 18;

-- 14. Eliminar impuestos personalizados
DELETE FROM impuestos WHERE empresa_id = 18;

-- 15. Eliminar categorías personalizadas
DELETE FROM categorias WHERE empresa_id = 18;

-- 16. FINALMENTE: Eliminar la empresa
DELETE FROM empresas WHERE id = 18;

SET FOREIGN_KEY_CHECKS = 1;

-- Verificar eliminación
SELECT '=== ELIMINACIÓN COMPLETADA ===' as info;
SELECT 'Empresa PRUEBA1 (debe ser 0):' as verificacion, COUNT(*) as total FROM empresas WHERE id = 18;
SELECT 'Total de empresas restantes:' as verificacion, COUNT(*) as total FROM empresas;
