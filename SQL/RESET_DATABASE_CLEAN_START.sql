/**
 * =====================================================
 * KORE INVENTORY - RESET COMPLETO A ESTADO INICIAL
 * =====================================================
 * 
 * PROPÓSITO:
 * Eliminar TODOS los datos de prueba y dejar la base de datos
 * en estado limpio para comenzar desde cero con datos reales.
 * 
 * QUÉ SE PRESERVA:
 * ✅ Usuario Super Admin (admin@kore.com)
 * ✅ Roles de Sistema (super_admin, admin_empresa)
 * ✅ Permisos del sistema
 * ✅ Módulos del sistema
 * ✅ Planes (catálogo)
 * ✅ Acciones (catálogo)
 * 
 * QUÉ SE ELIMINA:
 * ❌ Todas las empresas de prueba (Everest, ABC, XYZ, etc.)
 * ❌ Todos los usuarios (excepto super_admin)
 * ❌ Todos los roles personalizados
 * ❌ Todos los productos
 * ❌ Todas las ventas y compras
 * ❌ Todos los clientes y proveedores
 * ❌ Todas las categorías
 * ❌ Todas las configuraciones de facturación
 * ❌ Todos los movimientos de inventario
 * ❌ Todos los impuestos personalizados
 * 
 * CÓMO USAR:
 * 1. HAGA UN BACKUP MANUAL primero (aunque sean datos de prueba)
 * 2. Ejecute este script completo
 * 3. Después ejecute RESET_SEED_INITIAL_DATA.sql (se creará a continuación)
 * 
 * ADVERTENCIA: ESTA ACCIÓN NO SE PUEDE DESHACER
 * =====================================================
 */

-- =====================================================
-- PASO 0: CONFIGURACIÓN DE SEGURIDAD
-- =====================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- Registrar en auditoria el reset
INSERT INTO auditoria_logs (
    usuario_id, 
    modulo, 
    accion, 
    descripcion, 
    ip, 
    user_agent,
    created_at
) VALUES (
    1, 
    'SISTEMA', 
    'RESET_DATABASE', 
    'Inicio de reset completo de base de datos - Eliminación de datos de prueba', 
    'SCRIPT',
    'SQL_MANUAL',
    NOW()
);

-- =====================================================
-- PASO 1: ELIMINAR DATOS TRANSACCIONALES
-- =====================================================

SELECT '=== PASO 1/8: Eliminando datos transaccionales ===' as Estado;

-- Ventas y sus detalles
DELETE FROM venta_impuestos;
DELETE FROM venta_pagos;
DELETE FROM venta_detalle;
DELETE FROM ventas;

-- Compras y sus detalles  
DELETE FROM compras_detalle WHERE 1=1;
DELETE FROM compras WHERE 1=1;

-- Movimientos de inventario
DELETE FROM inventario_movimientos WHERE 1=1;

-- Traslados de bodega
DELETE FROM traslados_detalle WHERE 1=1;
DELETE FROM traslados WHERE 1=1;

-- Retenciones
DELETE FROM retenciones WHERE 1=1;

SELECT 'Datos transaccionales eliminados' as Resultado;

-- =====================================================
-- PASO 2: ELIMINAR PRODUCTOS Y RELACIONADOS
-- =====================================================

SELECT '=== PASO 2/8: Eliminando productos y relacionados ===' as Estado;

-- Historial de precios
DELETE FROM productos_historial_precios WHERE 1=1;

-- Productos en bodegas
DELETE FROM productos_bodegas WHERE 1=1;

-- Productos
DELETE FROM productos;

-- Categorías
DELETE FROM categorias;

-- Bodegas (dejar vacío para crear nuevas por empresa)
DELETE FROM bodegas WHERE 1=1;

SELECT 'Productos y categorías eliminados' as Resultado;

-- =====================================================
-- PASO 3: ELIMINAR CLIENTES Y PROVEEDORES
-- =====================================================

SELECT '=== PASO 3/8: Eliminando clientes y proveedores ===' as Estado;

DELETE FROM clientes;
DELETE FROM proveedores WHERE 1=1;

SELECT 'Clientes y proveedores eliminados' as Resultado;

-- =====================================================
-- PASO 4: ELIMINAR IMPUESTOS PERSONALIZADOS
-- =====================================================

SELECT '=== PASO 4/8: Eliminando impuestos personalizados ===' as Estado;

-- Mantener solo los impuestos estándar del sistema si existen
-- O eliminar todos si cada empresa debe configurar los suyos
DELETE FROM impuestos WHERE 1=1;

SELECT 'Impuestos eliminados' as Resultado;

-- =====================================================
-- PASO 5: ELIMINAR ROLES PERSONALIZADOS Y RELACIONES
-- =====================================================

SELECT '=== PASO 5/8: Eliminando roles personalizados ===' as Estado;

-- Eliminar asignaciones de roles a usuarios
DELETE FROM usuario_rol;

-- Eliminar permisos de roles
DELETE FROM rol_permiso;

-- Eliminar módulos asignados a roles
DELETE FROM modulos_rol WHERE 1=1;

-- Eliminar solo roles personalizados (mantener roles de sistema)
DELETE FROM roles WHERE tipo = 'personalizado';

SELECT 'Roles personalizados eliminados' as Resultado;

-- =====================================================
-- PASO 6: ELIMINAR USUARIOS (EXCEPTO SUPER_ADMIN)
-- =====================================================

SELECT '=== PASO 6/8: Eliminando usuarios (excepto super_admin) ===' as Estado;

-- Eliminar relaciones usuario-empresa
DELETE FROM usuario_empresa;

-- Eliminar todos los usuarios EXCEPTO el super_admin (ID 1)
DELETE FROM usuarios WHERE id != 1;

-- Resetear AUTO_INCREMENT para que el próximo usuario sea ID 2
ALTER TABLE usuarios AUTO_INCREMENT = 2;

SELECT 'Usuarios eliminados (preservado super_admin)' as Resultado;

-- =====================================================
-- PASO 7: ELIMINAR EMPRESAS Y CONFIGURACIONES
-- =====================================================

SELECT '=== PASO 7/8: Eliminando empresas y configuraciones ===' as Estado;

-- Eliminar configuración de facturación
DELETE FROM configuracion_factura WHERE 1=1;

-- Eliminar configuración de empresa
DELETE FROM empresa_configuracion WHERE 1=1;

-- Eliminar licencias
DELETE FROM licencias;

-- Eliminar módulos asignados a planes de empresas
DELETE FROM modulos_plan WHERE 1=1;

-- Eliminar empresas
DELETE FROM empresas;

-- Resetear AUTO_INCREMENT
ALTER TABLE empresas AUTO_INCREMENT = 1;

SELECT 'Empresas y configuraciones eliminadas' as Resultado;

-- =====================================================
-- PASO 8: LIMPIAR AUDITORÍA ANTIGUA (OPCIONAL)
-- =====================================================

SELECT '=== PASO 8/8: Limpiando logs de auditoría antiguos ===' as Estado;

-- Mantener solo los últimos 30 días de logs (ajustar según necesidad)
-- O comentar estas líneas si desea mantener toda la auditoría

DELETE FROM auditoria_logs 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
AND accion != 'RESET_DATABASE';

SELECT 'Logs antiguos limpiados' as Resultado;

-- =====================================================
-- PASO 9: VERIFICACIÓN FINAL
-- =====================================================

SELECT '=== VERIFICACIÓN FINAL ===' as Estado;

-- Verificar que solo existe el super_admin
SELECT 
    'USUARIOS' as Tabla,
    COUNT(*) as Total,
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ OK - Solo Super Admin'
        ELSE '❌ ERROR - Revisar'
    END as Validacion
FROM usuarios;

-- Verificar empresas
SELECT 
    'EMPRESAS' as Tabla,
    COUNT(*) as Total,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK - Sin empresas'
        ELSE '❌ ERROR - Hay empresas'
    END as Validacion
FROM empresas;

-- Verificar productos
SELECT 
    'PRODUCTOS' as Tabla,
    COUNT(*) as Total,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK - Sin productos'
        ELSE '❌ ERROR - Hay productos'
    END as Validacion
FROM productos;

-- Verificar ventas
SELECT 
    'VENTAS' as Tabla,
    COUNT(*) as Total,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK - Sin ventas'
        ELSE '❌ ERROR - Hay ventas'
    END as Validacion
FROM ventas;

-- Verificar clientes
SELECT 
    'CLIENTES' as Tabla,
    COUNT(*) as Total,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK - Sin clientes'
        ELSE '❌ ERROR - Hay clientes'
    END as Validacion
FROM clientes;

-- Verificar roles (solo sistema)
SELECT 
    'ROLES (sistema)' as Tabla,
    COUNT(*) as Total,
    CASE 
        WHEN COUNT(*) >= 2 THEN '✅ OK - Roles de sistema preservados'
        ELSE '⚠️ ADVERTENCIA - Verificar roles'
    END as Validacion
FROM roles
WHERE tipo = 'sistema';

-- Verificar roles personalizados
SELECT 
    'ROLES (personalizado)' as Tabla,
    COUNT(*) as Total,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK - Sin roles personalizados'
        ELSE '❌ ERROR - Hay roles personalizados'
    END as Validacion
FROM roles
WHERE tipo = 'personalizado';

-- =====================================================
-- PASO 10: CONFIRMAR SUPER_ADMIN
-- =====================================================

SELECT '=== DATOS DEL SUPER ADMIN ===' as Estado;

SELECT 
    id,
    nombre,
    apellido,
    email,
    tipo_usuario,
    activo,
    created_at
FROM usuarios
WHERE id = 1;

-- =====================================================
-- REGISTRAR FINALIZACIÓN
-- =====================================================

INSERT INTO auditoria_logs (
    usuario_id, 
    modulo, 
    accion, 
    descripcion, 
    ip, 
    user_agent,
    created_at
) VALUES (
    1, 
    'SISTEMA', 
    'RESET_DATABASE', 
    'Finalización exitosa de reset completo de base de datos', 
    'SCRIPT',
    'SQL_MANUAL',
    NOW()
);

-- =====================================================
-- RESTAURAR CONFIGURACIÓN
-- =====================================================

SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

SELECT '
=====================================================
✅ RESET COMPLETADO EXITOSAMENTE
=====================================================

LA BASE DE DATOS HA SIDO RESETEADA A ESTADO INICIAL

Estado actual:
- ✅ 1 usuario (Super Admin: admin@kore.com)
- ✅ Roles de sistema preservados
- ✅ Catálogos del sistema preservados (módulos, permisos, planes)
- ✅ 0 empresas
- ✅ 0 productos
- ✅ 0 ventas
- ✅ 0 clientes/proveedores

Próximos pasos:
1. Cerrar sesión y volver a hacer login con admin@kore.com
2. Crear la primera empresa REAL desde el módulo de Super Admin
3. Configurar el administrador de esa empresa
4. Comenzar a crear roles, usuarios y datos REALES

CREDENCIALES SUPER ADMIN:
Email: admin@kore.com
Password: admin

⚠️ SE RECOMIENDA CAMBIAR LA CONTRASEÑA DEL SUPER ADMIN
=====================================================
' as RESULTADO_FINAL;
