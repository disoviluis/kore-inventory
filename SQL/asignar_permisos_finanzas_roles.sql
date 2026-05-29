-- =========================================
-- ASIGNACIÓN DE PERMISOS: MÓDULO FINANZAS
-- Script para habilitar Cuentas por Cobrar en roles existentes
-- Fecha: 2026-05-29
-- =========================================

USE kore_inventory;

-- =========================================
-- 1. ASIGNAR PERMISOS BÁSICOS DE FINANZAS A ROLES ADMIN EMPRESA
-- =========================================

-- Obtener IDs de roles tipo 'admin_empresa' o 'Administrador Empresa'
-- Y asignarles permisos VIEW de Finanzas para que vean el módulo en el sidebar

-- Rol ID 2: Administrador Empresa (si existe)
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 2, p.id
FROM permisos p
WHERE p.modulo_id = 21  -- Módulo Finanzas
  AND p.accion_id = 1   -- Acción VIEW
  AND NOT EXISTS (
    SELECT 1 FROM rol_permiso rp 
    WHERE rp.rol_id = 2 AND rp.permiso_id = p.id
  );

-- Rol ID 9: Administrador de Empresa (si existe)
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 9, p.id
FROM permisos p
WHERE p.modulo_id = 21  -- Módulo Finanzas
  AND p.accion_id = 1   -- Acción VIEW
  AND NOT EXISTS (
    SELECT 1 FROM rol_permiso rp 
    WHERE rp.rol_id = 9 AND rp.permiso_id = p.id
  );

-- Rol ID 11: Admin Empresa (si existe)
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 11, p.id
FROM permisos p
WHERE p.modulo_id = 21  -- Módulo Finanzas
  AND p.accion_id = 1   -- Acción VIEW
  AND NOT EXISTS (
    SELECT 1 FROM rol_permiso rp 
    WHERE rp.rol_id = 11 AND rp.permiso_id = p.id
  );

-- =========================================
-- 2. ASIGNAR TODOS LOS PERMISOS DE FINANZAS A ROLES ADMIN EMPRESA
-- =========================================

-- Para dar permisos completos (CREATE, EDIT, DELETE, EXPORT) a roles admin_empresa
-- Descomenta las siguientes líneas si quieres dar permisos completos:

/*
-- Rol ID 2
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 2, p.id
FROM permisos p
WHERE p.modulo_id = 21  -- Módulo Finanzas
  AND NOT EXISTS (
    SELECT 1 FROM rol_permiso rp 
    WHERE rp.rol_id = 2 AND rp.permiso_id = p.id
  );

-- Rol ID 9
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 9, p.id
FROM permisos p
WHERE p.modulo_id = 21  -- Módulo Finanzas
  AND NOT EXISTS (
    SELECT 1 FROM rol_permiso rp 
    WHERE rp.rol_id = 9 AND rp.permiso_id = p.id
  );

-- Rol ID 11
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 11, p.id
FROM permisos p
WHERE p.modulo_id = 21  -- Módulo Finanzas
  AND NOT EXISTS (
    SELECT 1 FROM rol_permiso rp 
    WHERE rp.rol_id = 11 AND rp.permiso_id = p.id
  );
*/

-- =========================================
-- 3. VERIFICAR PERMISOS ASIGNADOS
-- =========================================

SELECT 
    r.id as rol_id,
    r.nombre as rol_nombre,
    m.nombre_mostrar as modulo,
    a.nombre as accion,
    p.codigo as permiso
FROM rol_permiso rp
INNER JOIN roles r ON rp.rol_id = r.id
INNER JOIN permisos p ON rp.permiso_id = p.id
INNER JOIN modulos m ON p.modulo_id = m.id
INNER JOIN acciones a ON p.accion_id = a.id
WHERE m.id = 21  -- Módulo Finanzas
ORDER BY r.id, a.id;

-- =========================================
-- NOTAS IMPORTANTES:
-- =========================================

/*
CÓMO FUNCIONA EL SISTEMA DE PERMISOS:

1. SUPER ADMIN (nivel_privilegio = 100):
   - Tiene acceso a TODOS los módulos automáticamente
   - No necesita permisos explícitos en la tabla rol_permiso
   - Ve todo el sidebar completo

2. ADMIN EMPRESA (nivel_privilegio = 95):
   - Cuando el super admin crea un rol "admin_empresa", 
     debe seleccionar qué permisos darle
   - Solo verá en el sidebar los módulos para los cuales 
     tenga al menos un permiso (típicamente VIEW)

3. USUARIOS NORMALES (nivel_privilegio < 95):
   - Solo ven módulos según los permisos de su rol

4. VISIBILIDAD EN EL SIDEBAR:
   - Un módulo aparece en el sidebar si el usuario tiene 
     AL MENOS UN permiso de ese módulo
   - Si tiene permiso VIEW, puede ver el módulo pero no 
     necesariamente editar/crear/eliminar

PARA HABILITAR FINANZAS EN UN ROL NUEVO:
1. Crear el rol (desde el dashboard como super admin)
2. Asignar permisos del módulo Finanzas (ID 21)
3. El sidebar se actualiza automáticamente según los permisos
*/
