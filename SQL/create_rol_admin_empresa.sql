-- =============================================
-- SCRIPT: Crear Rol "Administrador de Empresa" (Sistema)
-- Fecha: 2026-05-12
-- Descripción: Crea el rol de sistema para Administradores de Empresa
--              Este rol es GLOBAL (empresa_id = NULL) y se puede asignar
--              a usuarios que administrarán una empresa específica
-- =============================================

USE kore_inventory;

-- =============================================
-- PASO 1: Verificar si el rol ya existe
-- =============================================
SELECT 'Verificando si el rol Admin Empresa ya existe...' AS Paso;

SELECT COUNT(*) AS 'Roles Admin Empresa Existentes'
FROM roles 
WHERE slug = 'admin_empresa' AND empresa_id IS NULL;

-- =============================================
-- PASO 2: Crear el rol Admin Empresa (si no existe)
-- =============================================

INSERT IGNORE INTO roles (
  empresa_id,
  nombre,
  slug,
  descripcion,
  tipo,
  nivel,
  es_admin,
  activo,
  created_at,
  updated_at
) VALUES (
  NULL,                                    -- empresa_id: NULL = rol global de sistema
  'Administrador de Empresa',              -- nombre
  'admin_empresa',                         -- slug
  'Administrador con control total sobre su empresa. Puede gestionar usuarios, roles, productos, ventas, configuraciones y todos los módulos de su empresa.',  -- descripcion
  'sistema',                               -- tipo: sistema (no editable)
  80,                                      -- nivel: 80 (inferior a super_admin=100, superior a roles personalizados)
  1,                                       -- es_admin: 1 (tiene privilegios administrativos)
  1,                                       -- activo: 1
  NOW(),                                   -- created_at
  NOW()                                    -- updated_at
);

-- Obtener el ID del rol recién creado
SET @rol_admin_empresa_id = LAST_INSERT_ID();

SELECT @rol_admin_empresa_id AS 'ID del Rol Admin Empresa Creado';

-- =============================================
-- PASO 3: Asignar TODOS los permisos al rol Admin Empresa
-- =============================================

SELECT 'Asignando permisos al rol Admin Empresa...' AS Paso;

-- El Admin Empresa debe tener acceso a TODOS los módulos de su empresa
-- excepto los módulos exclusivos de Super Admin (PLATAFORMA)

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id, created_at)
SELECT 
  @rol_admin_empresa_id,
  p.id,
  NOW()
FROM permisos p
INNER JOIN modulos m ON p.modulo_id = m.id
WHERE m.categoria NOT IN ('plataforma', 'super-admin')  -- Excluir módulos de super admin
  OR m.categoria IS NULL;  -- Incluir módulos sin categoría

-- Contar permisos asignados
SELECT COUNT(*) AS 'Total Permisos Asignados'
FROM rol_permiso
WHERE rol_id = @rol_admin_empresa_id;

-- =============================================
-- PASO 4: Verificar resultado
-- =============================================

SELECT 'Verificación del rol creado:' AS Resultado;

SELECT 
  r.id,
  r.nombre,
  r.slug,
  r.tipo,
  r.nivel,
  r.es_admin,
  r.empresa_id,
  r.activo,
  COUNT(rp.permiso_id) AS total_permisos
FROM roles r
LEFT JOIN rol_permiso rp ON r.id = rp.rol_id
WHERE r.slug = 'admin_empresa'
  AND r.empresa_id IS NULL
GROUP BY r.id;

-- =============================================
-- PASO 5: Mostrar los permisos asignados
-- =============================================

SELECT 'Permisos asignados al rol Admin Empresa:' AS Detalle;

SELECT 
  m.nombre AS modulo,
  a.nombre AS accion,
  p.slug AS permiso_slug
FROM rol_permiso rp
INNER JOIN permisos p ON rp.permiso_id = p.id
INNER JOIN modulos m ON p.modulo_id = m.id
INNER JOIN acciones a ON p.accion_id = a.id
WHERE rp.rol_id = @rol_admin_empresa_id
ORDER BY m.nombre, a.nombre;

-- =============================================
-- ✅ COMPLETADO
-- =============================================

SELECT '✅ Rol Admin Empresa creado exitosamente' AS Estado;
SELECT 'Ahora puedes asignar este rol a usuarios cuando crees empresas' AS Nota;

