-- ===================================================
-- VERIFICAR DATOS DE EMPRESA PRUEBA1 (ID: 18)
-- Antes de eliminar, ver qué contiene
-- ===================================================

-- Información de la empresa
SELECT 'EMPRESA' as tabla, COUNT(*) as registros FROM empresas WHERE id = 18
UNION ALL
SELECT 'USUARIOS', COUNT(*) FROM usuarios WHERE empresa_id = 18
UNION ALL
SELECT 'USUARIO_EMPRESA', COUNT(*) FROM usuario_empresa WHERE empresa_id = 18
UNION ALL
SELECT 'USUARIO_ROL', COUNT(*) FROM usuario_rol ur INNER JOIN usuarios u ON ur.usuario_id = u.id WHERE u.empresa_id = 18
UNION ALL
SELECT 'BODEGAS', COUNT(*) FROM bodegas WHERE empresa_id = 18
UNION ALL
SELECT 'PRODUCTOS', COUNT(*) FROM productos WHERE empresa_id = 18
UNION ALL
SELECT 'TRASLADOS', COUNT(*) FROM traslados WHERE empresa_id = 18
UNION ALL
SELECT 'TRASLADOS_DETALLE', COUNT(*) FROM traslados_detalle td INNER JOIN traslados t ON td.traslado_id = t.id WHERE t.empresa_id = 18
UNION ALL
SELECT 'CLIENTES', COUNT(*) FROM clientes WHERE empresa_id = 18
UNION ALL
SELECT 'PROVEEDORES', COUNT(*) FROM proveedores WHERE empresa_id = 18
UNION ALL
SELECT 'VENTAS', COUNT(*) FROM ventas WHERE empresa_id = 18
UNION ALL
SELECT 'COMPRAS', COUNT(*) FROM compras WHERE empresa_id = 18
UNION ALL
SELECT 'ROLES_PERSONALIZADOS', COUNT(*) FROM roles WHERE empresa_id = 18
UNION ALL
SELECT 'AUDITORIA_LOGS', COUNT(*) FROM auditoria_logs WHERE empresa_id = 18
ORDER BY tabla;
