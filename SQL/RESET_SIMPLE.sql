/**
 * =====================================================
 * KORE INVENTORY - RESET SIMPLE (Solo tablas existentes)
 * =====================================================
 */

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- Registrar inicio
INSERT INTO auditoria_logs (usuario_id, modulo, accion, ip, user_agent)
VALUES (1, 'SISTEMA', 'RESET_START', 'SCRIPT', 'SQL_RESET');

SELECT '=== PASO 1: Eliminando datos transaccionales ===' as Estado;

-- Ventas DELETE FROM venta_detalle WHERE 1=1;
DELETE FROM ventas WHERE 1=1;

-- Compras (si existen)
DELETE FROM compras WHERE 1=1;

SELECT '=== PASO 2: Eliminando productos ===' as Estado;

DELETE FROM productos WHERE 1=1;
DELETE FROM categorias WHERE 1=1;

SELECT '=== PASO 3: Eliminando clientes y proveedores ===' as Estado;

DELETE FROM clientes WHERE 1=1;
DELETE FROM proveedores WHERE 1=1;

SELECT '=== PASO 4: Eliminando roles personalizados ===' as Estado;

DELETE FROM usuario_rol WHERE 1=1;
DELETE FROM rol_permiso WHERE 1=1;
DELETE FROM roles WHERE tipo = 'personalizado';

SELECT '=== PASO 5: Eliminando usuarios (excepto super_admin) ===' as Estado;

DELETE FROM usuario_empresa WHERE 1=1;
DELETE FROM usuarios WHERE id != 1;
ALTER TABLE usuarios AUTO_INCREMENT = 2;

SELECT '=== PASO 6: Eliminando empresas ===' as Estado;

DELETE FROM licencias WHERE 1=1;
DELETE FROM empresas WHERE 1=1;
ALTER TABLE empresas AUTO_INCREMENT = 1;

SELECT '=== PASO 7: Limpiar logs antiguos ===' as Estado;

DELETE FROM auditoria_logs 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
AND accion NOT LIKE 'RESET%';

SELECT '=== VERIFICACIÓN ===' as Estado;

SELECT 'USUARIOS' as Tabla, COUNT(*) as Total FROM usuarios
UNION ALL
SELECT 'EMPRESAS', COUNT(*) FROM empresas
UNION ALL
SELECT 'PRODUCTOS', COUNT(*) FROM productos
UNION ALL
SELECT 'VENTAS', COUNT(*) FROM ventas
UNION ALL
SELECT 'CLIENTES', COUNT(*) FROM clientes
UNION ALL
SELECT 'ROLES (personalizado)', COUNT(*) FROM roles WHERE tipo = 'personalizado';

SELECT 
    id, nombre, email, tipo_usuario
FROM usuarios;

-- Registrar fin
INSERT INTO auditoria_logs (usuario_id, modulo, accion, ip, user_agent)
VALUES (1, 'SISTEMA', 'RESET_COMPLETE', 'SCRIPT', 'SQL_RESET');

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

SELECT '
=====================================================
✅ RESET COMPLETADO
=====================================================
- 1 usuario (Super Admin: admin@kore.com / password: admin)
- 0 empresas
- 0 productos
- 0 ventas
- 0 clientes

Próximos pasos:
1. Reiniciar backend: pm2 restart kore-backend
2. Login: admin@kore.com / admin
3. Crear primera empresa REAL
=====================================================
' as RESULTADO;
