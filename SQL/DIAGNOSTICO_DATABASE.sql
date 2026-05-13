/**
 * =====================================================
 * KORE INVENTORY - DIAGNÓSTICO DE BASE DE DATOS
 * =====================================================
 * 
 * PROPÓSITO:
 * Queries útiles para diagnosticar el estado actual de
 * la base de datos antes y después del reset.
 * 
 * CUÁNDO USAR:
 * - ANTES del reset: Para ver qué datos existen
 * - DESPUÉS del reset: Para verificar que quedó limpio
 * - Durante operación: Para monitorear el sistema
 * =====================================================
 */

-- =====================================================
-- RESUMEN GENERAL DEL SISTEMA
-- =====================================================

SELECT '
=====================================================
RESUMEN GENERAL DEL SISTEMA
=====================================================
' as '';

-- Contar registros en todas las tablas principales
SELECT 'USUARIOS' as Tabla, COUNT(*) as Total FROM usuarios
UNION ALL
SELECT 'EMPRESAS', COUNT(*) FROM empresas
UNION ALL
SELECT 'PRODUCTOS', COUNT(*) FROM productos
UNION ALL
SELECT 'CATEGORIAS', COUNT(*) FROM categorias
UNION ALL
SELECT 'CLIENTES', COUNT(*) FROM clientes
UNION ALL
SELECT 'PROVEEDORES', COUNT(*) FROM proveedores WHERE 1=1
UNION ALL
SELECT 'VENTAS', COUNT(*) FROM ventas
UNION ALL
SELECT 'COMPRAS', COUNT(*) FROM compras WHERE 1=1
UNION ALL
SELECT 'ROLES', COUNT(*) FROM roles
UNION ALL
SELECT 'LICENCIAS', COUNT(*) FROM licencias;

-- =====================================================
-- DETALLE DE USUARIOS
-- =====================================================

SELECT '
=====================================================
DETALLE DE USUARIOS
=====================================================
' as '';

SELECT 
    u.id,
    u.nombre,
    u.apellido,
    u.email,
    u.tipo_usuario,
    u.empresa_id_default,
    e.nombre as empresa_default,
    u.activo,
    u.created_at,
    u.ultimo_login
FROM usuarios u
LEFT JOIN empresas e ON u.empresa_id_default = e.id
ORDER BY u.id;

-- Ver relaciones usuario-empresa
SELECT '
RELACIONES USUARIO-EMPRESA:
' as '';

SELECT 
    ue.id,
    u.email as usuario_email,
    e.nombre as empresa_nombre,
    ue.activo,
    ue.created_at
FROM usuario_empresa ue
INNER JOIN usuarios u ON ue.usuario_id = u.id
INNER JOIN empresas e ON ue.empresa_id = e.id
ORDER BY ue.usuario_id, ue.empresa_id;

-- =====================================================
-- DETALLE DE EMPRESAS
-- =====================================================

SELECT '
=====================================================
DETALLE DE EMPRESAS
=====================================================
' as '';

SELECT 
    e.id,
    e.nombre,
    e.nit,
    e.digito_verificacion,
    e.regimen,
    e.activo,
    e.created_at,
    COUNT(DISTINCT ue.usuario_id) as usuarios_count,
    COUNT(DISTINCT p.id) as productos_count,
    COUNT(DISTINCT c.id) as clientes_count
FROM empresas e
LEFT JOIN usuario_empresa ue ON e.id = ue.empresa_id AND ue.activo = 1
LEFT JOIN productos p ON e.id = p.empresa_id
LEFT JOIN clientes c ON e.id = c.empresa_id
GROUP BY e.id
ORDER BY e.created_at DESC;

-- =====================================================
-- DETALLE DE ROLES
-- =====================================================

SELECT '
=====================================================
DETALLE DE ROLES
=====================================================
' as '';

SELECT 
    r.id,
    r.nombre,
    r.tipo,
    r.nivel,
    r.empresa_id,
    e.nombre as empresa_nombre,
    r.activo,
    COUNT(DISTINCT ur.usuario_id) as usuarios_asignados
FROM roles r
LEFT JOIN empresas e ON r.empresa_id = e.id
LEFT JOIN usuario_rol ur ON r.id = ur.rol_id
GROUP BY r.id
ORDER BY r.tipo, r.nivel DESC, r.nombre;

-- =====================================================
-- PRODUCTOS POR EMPRESA
-- =====================================================

SELECT '
=====================================================
PRODUCTOS POR EMPRESA
=====================================================
' as '';

SELECT 
    e.id as empresa_id,
    e.nombre as empresa,
    COUNT(p.id) as total_productos,
    SUM(CASE WHEN p.activo = 1 THEN 1 ELSE 0 END) as productos_activos,
    SUM(CASE WHEN p.activo = 0 THEN 1 ELSE 0 END) as productos_inactivos,
    SUM(p.stock) as stock_total,
    SUM(p.stock * p.precio_venta) as valor_inventario
FROM empresas e
LEFT JOIN productos p ON e.id = p.empresa_id
GROUP BY e.id
ORDER BY total_productos DESC;

-- =====================================================
-- VENTAS POR EMPRESA
-- =====================================================

SELECT '
=====================================================
VENTAS POR EMPRESA (ÚLTIMOS 30 DÍAS)
=====================================================
' as '';

SELECT 
    e.id as empresa_id,
    e.nombre as empresa,
    COUNT(v.id) as total_ventas,
    SUM(v.total) as total_facturado,
    MIN(v.created_at) as primera_venta,
    MAX(v.created_at) as ultima_venta
FROM empresas e
LEFT JOIN ventas v ON e.id = v.empresa_id 
    AND v.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY e.id
ORDER BY total_facturado DESC;

-- =====================================================
-- CLIENTES POR EMPRESA
-- =====================================================

SELECT '
=====================================================
CLIENTES POR EMPRESA
=====================================================
' as '';

SELECT 
    e.id as empresa_id,
    e.nombre as empresa,
    COUNT(c.id) as total_clientes,
    SUM(CASE WHEN c.activo = 1 THEN 1 ELSE 0 END) as clientes_activos,
    SUM(CASE WHEN c.activo = 0 THEN 1 ELSE 0 END) as clientes_inactivos
FROM empresas e
LEFT JOIN clientes c ON e.id = c.empresa_id
GROUP BY e.id
ORDER BY total_clientes DESC;

-- =====================================================
-- PROVEEDORES POR EMPRESA
-- =====================================================

SELECT '
=====================================================
PROVEEDORES POR EMPRESA
=====================================================
' as '';

SELECT 
    e.id as empresa_id,
    e.nombre as empresa,
    COUNT(pr.id) as total_proveedores,
    SUM(CASE WHEN pr.activo = 1 THEN 1 ELSE 0 END) as proveedores_activos
FROM empresas e
LEFT JOIN proveedores pr ON e.id = pr.empresa_id
WHERE pr.id IS NOT NULL OR e.id IS NOT NULL
GROUP BY e.id
ORDER BY total_proveedores DESC;

-- =====================================================
-- AUDITORÍA RECIENTE
-- =====================================================

SELECT '
=====================================================
AUDITORÍA RECIENTE (ÚLTIMAS 50 ACCIONES)
=====================================================
' as '';

SELECT 
    al.created_at,
    u.email as usuario,
    al.modulo,
    al.accion,
    al.descripcion,
    al.ip
FROM auditoria_logs al
LEFT JOIN usuarios u ON al.usuario_id = u.id
ORDER BY al.created_at DESC
LIMIT 50;

-- =====================================================
-- VERIFICACIÓN DE INTEGRIDAD
-- =====================================================

SELECT '
=====================================================
VERIFICACIÓN DE INTEGRIDAD
=====================================================
' as '';

-- Usuarios sin empresa_id_default
SELECT 
    'Usuarios sin empresa_id_default' as Problema,
    COUNT(*) as Cantidad
FROM usuarios
WHERE empresa_id_default IS NULL
AND tipo_usuario != 'super_admin';

-- Usuarios con empresa_id_default que no existe
SELECT 
    'Usuarios con empresa_id_default inválido' as Problema,
    COUNT(*) as Cantidad
FROM usuarios u
LEFT JOIN empresas e ON u.empresa_id_default = e.id
WHERE u.empresa_id_default IS NOT NULL
AND e.id IS NULL;

-- Usuarios sin relación en usuario_empresa
SELECT 
    'Usuarios sin relación usuario_empresa' as Problema,
    COUNT(*) as Cantidad
FROM usuarios u
LEFT JOIN usuario_empresa ue ON u.id = ue.usuario_id AND ue.activo = 1
WHERE ue.id IS NULL
AND u.tipo_usuario != 'super_admin';

-- Productos sin categoría
SELECT 
    'Productos sin categoría' as Problema,
    COUNT(*) as Cantidad
FROM productos
WHERE categoria_id IS NULL;

-- Roles personalizados sin empresa
SELECT 
    'Roles personalizados sin empresa' as Problema,
    COUNT(*) as Cantidad
FROM roles
WHERE tipo = 'personalizado'
AND empresa_id IS NULL;

-- Ventas sin detalles
SELECT 
    'Ventas sin detalles' as Problema,
    COUNT(DISTINCT v.id) as Cantidad
FROM ventas v
LEFT JOIN venta_detalle vd ON v.id = vd.venta_id
WHERE vd.id IS NULL;

-- =====================================================
-- CONFIGURACIÓN DE FACTURACIÓN
-- =====================================================

SELECT '
=====================================================
CONFIGURACIÓN DE FACTURACIÓN POR EMPRESA
=====================================================
' as '';

SELECT 
    e.id as empresa_id,
    e.nombre as empresa,
    cf.prefijo_factura,
    cf.numero_inicial,
    cf.numero_final,
    cf.numero_actual,
    cf.resolucion_numero,
    cf.resolucion_fecha_desde,
    cf.resolucion_fecha_hasta,
    DATEDIFF(cf.resolucion_fecha_hasta, NOW()) as dias_hasta_vencimiento,
    CASE 
        WHEN cf.id IS NULL THEN '❌ Sin configurar'
        WHEN cf.resolucion_fecha_hasta < NOW() THEN '⚠️ Resolución vencida'
        WHEN DATEDIFF(cf.resolucion_fecha_hasta, NOW()) < 30 THEN '⚠️ Próxima a vencer'
        ELSE '✅ Activa'
    END as estado_resolucion
FROM empresas e
LEFT JOIN configuracion_factura cf ON e.id = cf.empresa_id
ORDER BY e.id;

-- =====================================================
-- LICENCIAS ACTIVAS
-- =====================================================

SELECT '
=====================================================
LICENCIAS ACTIVAS
=====================================================
' as '';

SELECT 
    l.id,
    e.nombre as empresa,
    p.nombre as plan,
    l.fecha_inicio,
    l.fecha_fin,
    DATEDIFF(l.fecha_fin, NOW()) as dias_restantes,
    l.activo,
    CASE 
        WHEN l.activo = 0 THEN '❌ Inactiva'
        WHEN l.fecha_fin < NOW() THEN '⚠️ Vencida'
        WHEN DATEDIFF(l.fecha_fin, NOW()) < 30 THEN '⚠️ Próxima a vencer'
        ELSE '✅ Activa'
    END as estado
FROM licencias l
INNER JOIN empresas e ON l.empresa_id = e.id
INNER JOIN planes p ON l.plan_id = p.id
ORDER BY l.fecha_fin ASC;

-- =====================================================
-- RESUMEN PARA VERIFICACIÓN POST-RESET
-- =====================================================

SELECT '
=====================================================
CHECKLIST VERIFICACIÓN POST-RESET
=====================================================
' as '';

SELECT 
    'Total Usuarios' as Item,
    COUNT(*) as Valor,
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ OK (Solo super_admin)'
        ELSE '❌ ERROR'
    END as Estado
FROM usuarios
UNION ALL
SELECT 
    'Total Empresas',
    COUNT(*),
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK (Sin empresas)'
        ELSE '⚠️ INFO (Empresas creadas)'
    END
FROM empresas
UNION ALL
SELECT 
    'Total Productos',
    COUNT(*),
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK (Sin productos)'
        ELSE '⚠️ INFO (Productos creados)'
    END
FROM productos
UNION ALL
SELECT 
    'Total Ventas',
    COUNT(*),
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK (Sin ventas)'
        ELSE '❌ ERROR (Hay ventas de prueba)'
    END
FROM ventas
UNION ALL
SELECT 
    'Roles de Sistema',
    COUNT(*),
    CASE 
        WHEN COUNT(*) >= 2 THEN '✅ OK'
        ELSE '❌ ERROR (Faltan roles)'
    END
FROM roles
WHERE tipo = 'sistema'
UNION ALL
SELECT 
    'Roles Personalizados',
    COUNT(*),
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ OK (Sin roles personalizados)'
        ELSE '⚠️ INFO (Roles creados)'
    END
FROM roles
WHERE tipo = 'personalizado';

-- =====================================================
-- FIN DEL DIAGNÓSTICO
-- =====================================================

SELECT '
=====================================================
DIAGNÓSTICO COMPLETADO
=====================================================
Fecha: NOW()
Sistema: Kore Inventory
Base de Datos: kore_inventory
=====================================================
' as '';
