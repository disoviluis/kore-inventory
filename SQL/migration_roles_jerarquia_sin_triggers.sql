-- =============================================
-- MIGRACIÓN: Sistema de Jerarquías para Roles (SIN TRIGGERS)
-- Fecha: 2026-03-12
-- Descripción: Agrega niveles de privilegio
-- NOTA: Esta versión no incluye triggers por restricciones de AWS RDS
--       Los triggers se deben crear manualmente via AWS Console Parameter Group
-- =============================================

-- Verificar si existe la columna nivel en roles
SELECT COUNT(*) INTO @nivel_exists 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'roles' 
  AND COLUMN_NAME = 'nivel';

-- Solo crear si no existe
SET @sql1 = IF(@nivel_exists = 0,
  'ALTER TABLE `roles` 
   ADD COLUMN `nivel` INT NOT NULL DEFAULT 20 
   COMMENT ''Nivel de privilegio: 100=super_admin, 80=admin_empresa, 60-10=personalizados'' 
   AFTER `es_admin`',
  'SELECT "Campo nivel ya existe en roles" AS Mensaje');

PREPARE stmt1 FROM @sql1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

-- Verificar si existe el índice
SELECT COUNT(*) INTO @idx_nivel_exists 
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'roles' 
  AND INDEX_NAME = 'idx_nivel';

-- Solo crear índice si no existe
SET @sql2 = IF(@idx_nivel_exists = 0,
  'ALTER TABLE `roles` ADD INDEX `idx_nivel` (`nivel`)',
  'SELECT "Índice idx_nivel ya existe" AS Mensaje');

PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- =============================================
-- Actualizar niveles de roles existentes
-- =============================================

-- Super Admin (nivel 100)
UPDATE `roles` 
SET `nivel` = 100 
WHERE `slug` = 'super_admin' 
  AND (`nivel` IS NULL OR `nivel` != 100);

-- Admin Empresa - Roles GLOBALES (empresa_id = NULL)
UPDATE `roles` 
SET `nivel` = 80 
WHERE `slug` = 'admin_empresa' 
  AND `empresa_id` IS NULL 
  AND (`nivel` IS NULL OR `nivel` != 80);

-- Admin Empresa - Roles ESPECÍFICOS (empresa_id != NULL)
UPDATE `roles` 
SET `nivel` = 80 
WHERE `slug` = 'admin_empresa' 
  AND `empresa_id` IS NOT NULL 
  AND (`nivel` IS NULL OR `nivel` != 80);

-- Gerente
UPDATE `roles` 
SET `nivel` = 60 
WHERE `slug` = 'gerente' 
  AND (`nivel` IS NULL OR `nivel` != 60);

-- Supervisor
UPDATE `roles` 
SET `nivel` = 50 
WHERE `slug` = 'supervisor' 
  AND (`nivel` IS NULL OR `nivel` != 50);

-- Cajero
UPDATE `roles` 
SET `nivel` = 20 
WHERE `slug` = 'cajero' 
  AND (`nivel` IS NULL OR `nivel` != 20);

-- Bodeguero
UPDATE `roles` 
SET `nivel` = 20 
WHERE `slug` = 'bodeguero' 
  AND (`nivel` IS NULL OR `nivel` != 20);

-- Vendedor
UPDATE `roles` 
SET `nivel` = 20 
WHERE `slug` = 'vendedor' 
  AND (`nivel` IS NULL OR `nivel` != 20);

-- Contador
UPDATE `roles` 
SET `nivel` = 30 
WHERE `slug` = 'contador' 
  AND (`nivel` IS NULL OR `nivel` != 30);

-- Consulta (solo lectura)
UPDATE `roles` 
SET `nivel` = 10 
WHERE `slug` = 'consulta' 
  AND (`nivel` IS NULL OR `nivel` != 10);

-- Los roles personalizados sin slug específico quedan en su nivel por defecto (20)

-- =============================================
-- Campo nivel_privilegio en usuarios
-- =============================================

-- Verificar si existe la columna nivel_privilegio en usuarios
SELECT COUNT(*) INTO @nivel_priv_exists 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'usuarios' 
  AND COLUMN_NAME = 'nivel_privilegio';

-- Solo crear si no existe
SET @sql3 = IF(@nivel_priv_exists = 0,
  'ALTER TABLE `usuarios` 
   ADD COLUMN `nivel_privilegio` INT DEFAULT NULL 
   COMMENT ''Nivel más alto heredado de los roles asignados'' 
   AFTER `tipo_usuario`',
  'SELECT "Campo nivel_privilegio ya existe en usuarios" AS Mensaje');

PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- Verificar si existe el índice en usuarios
SELECT COUNT(*) INTO @idx_nivel_priv_exists 
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'usuarios' 
  AND INDEX_NAME = 'idx_nivel_privilegio';

-- Solo crear índice si no existe
SET @sql4 = IF(@idx_nivel_priv_exists = 0,
  'ALTER TABLE `usuarios` ADD INDEX `idx_nivel_privilegio` (`nivel_privilegio`)',
  'SELECT "Índice idx_nivel_privilegio ya existe" AS Mensaje');

PREPARE stmt4 FROM @sql4;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;

-- =============================================
-- Poblar nivel_privilegio para usuarios existentes
-- =============================================

UPDATE `usuarios` u
SET `nivel_privilegio` = (
  SELECT MAX(r.nivel)
  FROM usuario_rol ur
  INNER JOIN roles r ON ur.rol_id = r.id
  WHERE ur.usuario_id = u.id
)
WHERE u.id IN (SELECT DISTINCT usuario_id FROM usuario_rol);

-- =============================================
-- Verificación Final
-- =============================================

SELECT 
  '=== ROLES CON NIVELES ===' AS Tipo,
  id, 
  nombre, 
  slug, 
  tipo, 
  empresa_id, 
  nivel, 
  es_admin, 
  activo
FROM roles
ORDER BY nivel DESC, nombre ASC;

SELECT 
  '=== USUARIOS CON NIVEL PRIVILEGIO ===' AS Tipo,
  id,
  nombre,
  email,
  nivel_privilegio,
  activo
FROM usuarios
WHERE nivel_privilegio IS NOT NULL
ORDER BY nivel_privilegio DESC;

-- =============================================
-- NOTA IMPORTANTE SOBRE TRIGGERS
-- =============================================
-- Para que nivel_privilegio se mantenga sincronizado automáticamente,
-- necesitas crear 3 triggers desde AWS Console:
-- 
-- 1. En RDS Console -> Parameter Groups
-- 2. Modificar el parameter group de tu instancia
-- 3. Cambiar log_bin_trust_function_creators = 1
-- 4. Reiniciar la instancia RDS
-- 5. Luego ejecutar: SQL/migration_roles_triggers.sql
-- =============================================
