/**
 * ================================================
 * FIX: Relación Usuario-Empresa para Brayan
 * ================================================
 * 
 * PROBLEMA IDENTIFICADO:
 * - Usuario Brayan (ID 7) obtiene 403 al intentar editar usuarios
 * - El token JWT contiene empresa_id desde usuarios.empresa_id_default
 * - El endpoint getUsuarioById valida contra usuario_empresa
 * - Si no hay coincidencia, devuelve 403 Forbidden
 * 
 * SOLUCIÓN:
 * 1. Verificar empresa actual de Brayan
 * 2. Asegurar que exista registro en usuario_empresa
 * 3. Actualizar empresa_id_default si es necesario
 * ================================================
 */

-- ============================================
-- 1. DIAGNÓSTICO: Ver estado actual de Brayan
-- ============================================

SELECT 
    '=== DATOS DEL USUARIO BRAYAN ===' as Seccion;

-- Datos básicos del usuario
SELECT 
    id,
    nombre,
    apellido,
    email,
    tipo_usuario,
    empresa_id_default,
    activo,
    created_at
FROM usuarios
WHERE id = 7 OR email LIKE '%brayan%';

-- Empresas asociadas en usuario_empresa
SELECT 
    '=== EMPRESAS ASOCIADAS (usuario_empresa) ===' as Seccion;

SELECT 
    ue.id,
    ue.usuario_id,
    ue.empresa_id,
    e.nombre as empresa_nombre,
    ue.activo,
    ue.created_at
FROM usuario_empresa ue
INNER JOIN empresas e ON ue.empresa_id = e.id
WHERE ue.usuario_id = 7;

-- Verificar empresa Everest
SELECT 
    '=== DATOS EMPRESA EVEREST ===' as Seccion;

SELECT 
    id,
    nombre,
    nit,
    activo
FROM empresas
WHERE nombre LIKE '%EVEREST%' OR nombre LIKE '%Everest%';

-- Roles asignados
SELECT 
    '=== ROLES ASIGNADOS ===' as Seccion;

SELECT 
    ur.usuario_id,
    ur.rol_id,
    r.nombre as rol_nombre,
    r.tipo as rol_tipo,
    r.nivel as rol_nivel,
    ur.empresa_id,
    e.nombre as empresa_nombre
FROM usuario_rol ur
INNER JOIN roles r ON ur.rol_id = r.id
INNER JOIN empresas e ON ur.empresa_id = e.id
WHERE ur.usuario_id = 7;

-- ============================================
-- 2. CORRECCIÓN: Asegurar relación correcta
-- ============================================

-- NOTA: Ajustar el empresa_id según el resultado del diagnóstico
-- Si Everest tiene id diferente de 6, cambiar en las siguientes queries

-- Insertar relación usuario_empresa si no existe
INSERT INTO usuario_empresa (usuario_id, empresa_id, activo, created_at)
SELECT 7, e.id, 1, NOW()
FROM empresas e
WHERE e.nombre LIKE '%EVEREST%'
AND NOT EXISTS (
    SELECT 1 
    FROM usuario_empresa ue2 
    WHERE ue2.usuario_id = 7 
    AND ue2.empresa_id = e.id
)
LIMIT 1;

-- Actualizar empresa_id_default del usuario
UPDATE usuarios u
SET empresa_id_default = (
    SELECT id 
    FROM empresas 
    WHERE nombre LIKE '%EVEREST%'
    LIMIT 1
)
WHERE u.id = 7
AND (
    u.empresa_id_default IS NULL 
    OR u.empresa_id_default != (
        SELECT id 
        FROM empresas 
        WHERE nombre LIKE '%EVEREST%'
        LIMIT 1
    )
);

-- ============================================
-- 3. VERIFICACIÓN: Confirmar corrección
-- ============================================

SELECT 
    '=== VERIFICACIÓN POST-CORRECCIÓN ===' as Seccion;

SELECT 
    u.id,
    u.nombre,
    u.email,
    u.tipo_usuario,
    u.empresa_id_default,
    e.nombre as empresa_default_nombre,
    GROUP_CONCAT(DISTINCT e2.nombre) as empresas_asociadas
FROM usuarios u
LEFT JOIN empresas e ON u.empresa_id_default = e.id
LEFT JOIN usuario_empresa ue ON u.id = ue.usuario_id AND ue.activo = 1
LEFT JOIN empresas e2 ON ue.empresa_id = e2.id
WHERE u.id = 7
GROUP BY u.id;

-- Verificar que la consulta de getUsuarioById funcionará
SELECT 
    '=== TEST: ¿Funcionará getUsuarioById? ===' as Seccion;

SELECT 
    u.id as usuario_id,
    u.nombre,
    u.empresa_id_default as empresa_en_token,
    GROUP_CONCAT(DISTINCT ue.empresa_id) as empresas_ids,
    CASE 
        WHEN FIND_IN_SET(u.empresa_id_default, GROUP_CONCAT(DISTINCT ue.empresa_id)) > 0 
        THEN 'OK'
        ELSE 'FALLA - empresa_id_default no está en usuario_empresa'
    END as validacion
FROM usuarios u
LEFT JOIN usuario_empresa ue ON u.id = ue.usuario_id AND ue.activo = 1
WHERE u.id = 7
GROUP BY u.id;

-- ============================================
-- 4. CORRECCIÓN ALTERNATIVA (Si hay múltiples empresas)
-- ============================================

-- Si el usuario está asociado a múltiples empresas y empresa_id_default
-- no coincide con ninguna, asignar la primera empresa activa

-- UPDATE usuarios u
-- SET empresa_id_default = (
--     SELECT ue.empresa_id
--     FROM usuario_empresa ue
--     WHERE ue.usuario_id = u.id
--     AND ue.activo = 1
--     ORDER BY ue.created_at ASC
--     LIMIT 1
-- )
-- WHERE u.id = 7;

/**
 * ================================================
 * INSTRUCCIONES DE USO:
 * ================================================
 * 
 * 1. Ejecutar primero las queries de DIAGNÓSTICO
 * 2. Verificar:
 *    - ¿Brayan tiene empresa_id_default?
 *    - ¿Existe registro en usuario_empresa para Everest?
 *    - ¿Cuál es el ID de la empresa Everest?
 * 
 * 3. Ejecutar las queries de CORRECCIÓN
 *    (las queries ya buscan automáticamente el ID de Everest)
 * 
 * 4. Ejecutar las queries de VERIFICACIÓN
 *    - Debe mostrar "OK" en la columna validacion
 * 
 * 5. El usuario debe cerrar sesión y volver a hacer login
 *    para obtener un nuevo token JWT con el empresa_id correcto
 * 
 * ================================================
 */
