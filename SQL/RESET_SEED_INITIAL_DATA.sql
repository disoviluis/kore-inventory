/**
 * =====================================================
 * KORE INVENTORY - DATOS SEMILLA INICIALES (OPCIONAL)
 * =====================================================
 * 
 * PROPÓSITO:
 * Crear datos base mínimos después del reset para facilitar
 * el inicio de operaciones con datos reales.
 * 
 * CUÁNDO USAR:
 * Ejecutar DESPUÉS de RESET_DATABASE_CLEAN_START.sql
 * 
 * QUÉ CONTIENE:
 * - Impuestos estándar de Colombia (IVA 19%, 5%, 0%)
 * - Permisos base del sistema (si no existen)
 * - Verificación de roles de sistema
 * 
 * NOTA: Este script es OPCIONAL. Puedes crear estos
 * datos manualmente desde la interfaz según necesites.
 * =====================================================
 */

-- =====================================================
-- VERIFICAR ROLES DE SISTEMA
-- =====================================================

SELECT '=== VERIFICANDO ROLES DE SISTEMA ===' as Estado;

-- Asegurar que existen los roles de sistema
INSERT INTO roles (nombre, descripcion, tipo, nivel, activo, created_at)
SELECT * FROM (
    SELECT 'Super Admin', 'Acceso total al sistema', 'sistema', 100, 1, NOW()
) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM roles WHERE nombre = 'Super Admin' AND tipo = 'sistema'
) LIMIT 1;

INSERT INTO roles (nombre, descripcion, tipo, nivel, activo, created_at)
SELECT * FROM (
    SELECT 'Admin Empresa', 'Administrador de empresa', 'sistema', 80, 1, NOW()
) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM roles WHERE nombre = 'Admin Empresa' AND tipo = 'sistema'
) LIMIT 1;

SELECT 
    id,
    nombre,
    tipo,
    nivel,
    activo
FROM roles
WHERE tipo = 'sistema'
ORDER BY nivel DESC;

-- =====================================================
-- IMPUESTOS ESTÁNDAR DE COLOMBIA (OPCIONAL)
-- =====================================================

SELECT '=== CREANDO IMPUESTOS BASE DE COLOMBIA ===' as Estado;

-- Estos serán impuestos a nivel de sistema que cada empresa puede usar
-- Si prefieres que cada empresa cree los suyos, omite esta sección

INSERT INTO impuestos (codigo, nombre, porcentaje, descripcion, activo, created_at)
VALUES
    ('IVA_19', 'IVA 19%', 19.00, 'Impuesto al Valor Agregado del 19%', 1, NOW()),
    ('IVA_5', 'IVA 5%', 5.00, 'Impuesto al Valor Agregado del 5%', 1, NOW()),
    ('IVA_0', 'IVA 0%', 0.00, 'Exento de IVA', 1, NOW())
ON DUPLICATE KEY UPDATE 
    nombre = VALUES(nombre),
    porcentaje = VALUES(porcentaje);

SELECT 
    id,
    codigo,
    nombre,
    porcentaje,
    activo
FROM impuestos
ORDER BY porcentaje DESC;

-- =====================================================
-- VERIFICAR MÓDULOS DEL SISTEMA
-- =====================================================

SELECT '=== VERIFICANDO MÓDULOS DEL SISTEMA ===' as Estado;

SELECT 
    id,
    nombre,
    slug,
    icono,
    activo
FROM modulos
ORDER BY orden ASC;

-- =====================================================
-- VERIFICAR PLANES DISPONIBLES
-- =====================================================

SELECT '=== VERIFICANDO PLANES DISPONIBLES ===' as Estado;

SELECT 
    id,
    nombre,
    descripcion,
    precio_mensual,
    activo
FROM planes
ORDER BY precio_mensual ASC;

-- =====================================================
-- VERIFICAR PERMISOS BASE
-- =====================================================

SELECT '=== VERIFICANDO PERMISOS DEL SISTEMA ===' as Estado;

SELECT 
    COUNT(*) as total_permisos
FROM permisos;

-- Si no hay permisos, se muestran los módulos para crear permisos manualmente
SELECT 
    m.id as modulo_id,
    m.nombre as modulo_nombre,
    CONCAT('Crear permisos para: ', m.nombre) as sugerencia
FROM modulos m
WHERE m.activo = 1
ORDER BY m.orden ASC;

-- =====================================================
-- ESTADÍSTICAS FINALES
-- =====================================================

SELECT '
=====================================================
✅ DATOS SEMILLA CREADOS
=====================================================

Resumen del Sistema:

USUARIOS:
' as '';

SELECT 
    tipo_usuario,
    COUNT(*) as cantidad
FROM usuarios
GROUP BY tipo_usuario;

SELECT '
ROLES:
' as '';

SELECT 
    tipo,
    COUNT(*) as cantidad
FROM roles
GROUP BY tipo;

SELECT '
IMPUESTOS:
' as '';

SELECT 
    codigo,
    nombre,
    porcentaje
FROM impuestos
ORDER BY porcentaje DESC;

SELECT '
=====================================================
SISTEMA LISTO PARA COMENZAR
=====================================================

Próximos pasos:

1. LOGIN COMO SUPER ADMIN:
   Email: admin@kore.com
   Password: admin
   
2. CAMBIAR CONTRASEÑA del super admin

3. CREAR PRIMERA EMPRESA:
   - Ve al módulo "Super Admin"
   - Crea la empresa con datos REALES
   - Asigna un plan
   - Configura módulos activos

4. CREAR ADMIN DE LA EMPRESA:
   - En el módulo "Usuarios"
   - Crear usuario con rol "Admin Empresa"
   - Asignar a la empresa creada

5. LOGIN COMO ADMIN EMPRESA:
   - Configurar facturación electrónica
   - Crear roles personalizados
   - Crear categorías
   - Crear productos
   - Crear usuarios operativos

6. COMENZAR OPERACIONES REALES

=====================================================
' as INSTRUCCIONES;
