-- ===================================================
-- SCRIPT PARA ELIMINAR EMPRESA PRUEBA1 Y TODOS SUS DATOS
-- Empresa ID: 18 - PRUEBA1
-- ===================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- PASO 1: Ver qué vamos a eliminar
-- ============================================
SELECT '=== RESUMEN DE DATOS A ELIMINAR ===' as info;

SELECT 'Empresa:' as tipo, nombre, nit FROM empresas WHERE id = 18;
SELECT 'Usuarios en empresa:' as tipo, COUNT(*) as total FROM usuario_empresa WHERE empresa_id = 18;
SELECT 'Bodegas:' as tipo, COUNT(*) as total FROM bodegas WHERE empresa_id = 18;
SELECT 'Productos:' as tipo, COUNT(*) as total FROM productos WHERE empresa_id = 18;
SELECT 'Traslados:' as tipo, COUNT(*) as total FROM traslados WHERE empresa_id = 18;
SELECT 'Clientes:' as tipo, COUNT(*) as total FROM clientes WHERE empresa_id = 18;
SELECT 'Proveedores:' as tipo, COUNT(*) as total FROM proveedores WHERE empresa_id = 18;
SELECT 'Ventas:' as tipo, COUNT(*) as total FROM ventas WHERE empresa_id = 18;
SELECT 'Roles personalizados:' as tipo, COUNT(*) as total FROM roles WHERE empresa_id = 18;

-- ============================================
-- PASO 2: ELIMINAR DATOS (en orden correcto)
-- ============================================

-- 2.1 Eliminar detalles de traslados
DELETE td FROM traslados_detalle td
INNER JOIN traslados t ON td.traslado_id = t.id
WHERE t.empresa_id = 18;

-- 2.2 Eliminar traslados
DELETE FROM traslados WHERE empresa_id = 18;

-- 2.3 Eliminar detalles de ventas
DELETE vd FROM ventas_detalle vd
INNER JOIN ventas v ON vd.venta_id = v.id
WHERE v.empresa_id = 18;

-- 2.4 Eliminar pagos de ventas
DELETE vp FROM ventas_pagos vp
INNER JOIN ventas v ON vp.venta_id = v.id
WHERE v.empresa_id = 18;

-- 2.5 Eliminar ventas
DELETE FROM ventas WHERE empresa_id = 18;

-- 2.6 Eliminar detalles de compras
DELETE cd FROM compras_detalle cd
INNER JOIN compras c ON cd.compra_id = c.id
WHERE c.empresa_id = 18;

-- 2.7 Eliminar compras
DELETE FROM compras WHERE empresa_id = 18;

-- 2.8 Eliminar movimientos de inventario
DELETE im FROM inventario_movimientos im
INNER JOIN bodegas b ON im.bodega_id = b.id
WHERE b.empresa_id = 18;

-- 2.9 Eliminar productos
DELETE FROM productos WHERE empresa_id = 18;

-- 2.10 Eliminar bodegas
DELETE FROM bodegas WHERE empresa_id = 18;

-- 2.11 Eliminar clientes
DELETE FROM clientes WHERE empresa_id = 18;

-- 2.12 Eliminar proveedores
DELETE FROM proveedores WHERE empresa_id = 18;

-- 2.13 Eliminar permisos de roles personalizados
DELETE rp FROM rol_permiso rp
INNER JOIN roles r ON rp.rol_id = r.id
WHERE r.empresa_id = 18;

-- 2.14 Eliminar asignaciones de roles de usuarios de esta empresa
DELETE ur FROM usuario_rol ur
INNER JOIN roles r ON ur.rol_id = r.id
WHERE r.empresa_id = 18;

-- 2.15 Eliminar roles personalizados
DELETE FROM roles WHERE empresa_id = 18;

-- 2.16 Eliminar relación usuario-empresa
DELETE FROM usuario_empresa WHERE empresa_id = 18;

-- 2.17 Eliminar logs de auditoría
DELETE FROM auditoria_logs WHERE empresa_id = 18;

-- 2.18 Eliminar configuración de facturación
DELETE FROM facturacion_config WHERE empresa_id = 18;

-- 2.19 Eliminar resoluciones de facturación
DELETE FROM resoluciones_facturacion WHERE empresa_id = 18;

-- 2.20 Eliminar impuestos personalizados
DELETE FROM impuestos WHERE empresa_id = 18;

-- 2.21 Eliminar categorías personalizadas
DELETE FROM categorias WHERE empresa_id = 18;

-- 2.22 FINALMENTE: Eliminar la empresa
DELETE FROM empresas WHERE id = 18;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- PASO 3: Verificar eliminación
-- ============================================
SELECT '=== VERIFICACIÓN POST-ELIMINACIÓN ===' as info;
SELECT 'Empresas restantes:' as tipo, COUNT(*) as total FROM empresas;
SELECT 'Empresa PRUEBA1:' as tipo, COUNT(*) as total FROM empresas WHERE id = 18;
