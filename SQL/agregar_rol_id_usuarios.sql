-- Migración: Agregar columna rol_id a tabla usuarios
-- Fecha: 2025-01-XX
-- Propósito: Reemplazar sistema tipo_usuario enum con roles globales dinámicos

USE kore_inventory;

-- 1. Agregar columna rol_id (nullable inicialmente para migración)
ALTER TABLE usuarios 
ADD COLUMN rol_id INT(11) NULL AFTER tipo_usuario,
ADD INDEX idx_usuarios_rol_id (rol_id);

-- 2. Agregar clave foránea
ALTER TABLE usuarios
ADD CONSTRAINT fk_usuarios_rol_id 
FOREIGN KEY (rol_id) REFERENCES roles(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- 3. Crear roles globales necesarios si no existen
-- Rol para Administrador de Empresa (nivel 80)
INSERT INTO roles (nombre, descripcion, nivel, empresa_id, activo)
SELECT 'Administrador de Empresa', 'Administrador con acceso completo a una empresa', 80, NULL, 1
WHERE NOT EXISTS (
    SELECT 1 FROM roles WHERE nombre = 'Administrador de Empresa' AND empresa_id IS NULL
);

-- Obtener ID del rol recién creado
SET @admin_empresa_rol_id = (SELECT id FROM roles WHERE nombre = 'Administrador de Empresa' AND empresa_id IS NULL);

-- 4. Migrar datos existentes de tipo_usuario a rol_id
-- Mapear usuarios existentes a roles globales correspondientes

-- Super Admin → Rol "Super Administrador" (id=1)
UPDATE usuarios 
SET rol_id = 1 
WHERE tipo_usuario = 'super_admin' AND rol_id IS NULL;

-- Admin Empresa → Rol "Administrador de Empresa" (recién creado)
UPDATE usuarios 
SET rol_id = @admin_empresa_rol_id 
WHERE tipo_usuario = 'admin_empresa' AND rol_id IS NULL;

-- Usuario Regular → Mantener NULL por ahora (estos usuarios tienen roles por empresa)
-- Los usuarios regulares no necesitan rol global

-- Verificar migración
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
