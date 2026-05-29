-- Migración: Migrar datos de tipo_usuario a rol_id
-- Solo migración de datos (columna ya existe)

USE kore_inventory;

-- 1. Crear rol global para Administrador de Empresa si no existe
INSERT INTO roles (nombre, descripcion, nivel, empresa_id, activo)
SELECT 'Administrador de Empresa', 'Administrador con acceso completo a una empresa', 80, NULL, 1
WHERE NOT EXISTS (
    SELECT 1 FROM roles WHERE nombre = 'Administrador de Empresa' AND empresa_id IS NULL
);

-- Obtener ID del rol recién creado
SET @admin_empresa_rol_id = (SELECT id FROM roles WHERE nombre = 'Administrador de Empresa' AND empresa_id IS NULL LIMIT 1);

-- 2. Migrar datos existentes de tipo_usuario a rol_id

-- Super Admin → Rol "Super Administrador" (id=1)
UPDATE usuarios 
SET rol_id = 1 
WHERE tipo_usuario = 'super_admin' AND rol_id IS NULL;

-- Admin Empresa → Rol "Administrador de Empresa" (recién creado)
UPDATE usuarios 
SET rol_id = @admin_empresa_rol_id 
WHERE tipo_usuario = 'admin_empresa' AND rol_id IS NULL;

-- 3. Verificar migración
SELECT 
    tipo_usuario, 
    COUNT(*) as total, 
    SUM(CASE WHEN rol_id IS NOT NULL THEN 1 ELSE 0 END) as con_rol_id,
    SUM(CASE WHEN rol_id IS NULL THEN 1 ELSE 0 END) as sin_rol_id
FROM usuarios 
GROUP BY tipo_usuario;

-- Mostrar usuarios con sus roles asignados
SELECT 
    u.id,
    u.nombre,
    u.apellido,
    u.email,
    u.tipo_usuario,
    u.rol_id,
    r.nombre as rol_nombre,
    r.nivel as rol_nivel
FROM usuarios u
LEFT JOIN roles r ON u.rol_id = r.id
WHERE u.tipo_usuario IN ('super_admin', 'admin_empresa')
ORDER BY u.id;
