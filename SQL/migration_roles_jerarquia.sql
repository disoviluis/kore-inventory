-- =============================================
-- MIGRACIÓN: Sistema de Jerarquías para Roles
-- Fecha: 2026-03-12
-- Autor: Sistema KORE Inventory
-- Descripción: Agrega niveles de privilegio a roles y usuarios
--              para implementar jerarquías de seguridad
-- =============================================
-- IMPORTANTE: Hacer BACKUP antes de ejecutar
-- mysqldump -u root -p kore_inventory > backup_antes_jerarquia_$(date +%Y%m%d).sql
-- =============================================

USE kore_inventory;

-- =============================================
-- PASO 1: Agregar campo 'nivel' a tabla roles
-- =============================================

-- Verificar si el campo ya existe (evitar error si se ejecuta dos veces)
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.columns
WHERE table_schema = 'kore_inventory'
  AND table_name = 'roles'
  AND column_name = 'nivel';

-- Agregar campo solo si no existe
SET @query = IF(@col_exists = 0,
  'ALTER TABLE `roles` 
   ADD COLUMN `nivel` INT NOT NULL DEFAULT 20 
   COMMENT ''Nivel de privilegio: 100=super_admin, 80=admin_empresa, 60-10=personalizados'' 
   AFTER `es_admin`',
  'SELECT ''Campo nivel ya existe en roles'' AS Mensaje');

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar índice para búsquedas por nivel
SET @index_exists = 0;
SELECT COUNT(*) INTO @index_exists
FROM information_schema.statistics
WHERE table_schema = 'kore_inventory'
  AND table_name = 'roles'
  AND index_name = 'idx_nivel';

SET @query = IF(@index_exists = 0,
  'ALTER TABLE `roles` ADD INDEX `idx_nivel` (`nivel`)',
  'SELECT ''Índice idx_nivel ya existe'' AS Mensaje');

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- PASO 2: Actualizar roles existentes con niveles
-- =============================================

-- Actualizar rol: Super Administrador (nivel 100)
UPDATE `roles` 
SET `nivel` = 100 
WHERE `slug` = 'super_admin' 
  AND `empresa_id` IS NULL;

-- Actualizar rol: Administrador Empresa (nivel 80)
UPDATE `roles` 
SET `nivel` = 80 
WHERE `slug` = 'admin_empresa' 
  OR (`tipo` = 'sistema' AND `es_admin` = 1 AND `empresa_id` IS NOT NULL);

-- Actualizar rol: Gerente (nivel 60)
UPDATE `roles` 
SET `nivel` = 60 
WHERE `slug` = 'gerente';

-- Actualizar rol: Supervisor (nivel 50)
UPDATE `roles` 
SET `nivel` = 50 
WHERE `slug` = 'supervisor';

-- Actualizar rol: Contador/Analista (nivel 40)
UPDATE `roles` 
SET `nivel` = 40 
WHERE `slug` IN ('contador', 'analista', 'asistente_contable');

-- Actualizar rol: Cajero, Bodeguero, Vendedor (nivel 20)
UPDATE `roles` 
SET `nivel` = 20 
WHERE `slug` IN ('cajero', 'bodeguero', 'vendedor', 'auxiliar');

-- Actualizar rol: Consulta/Solo lectura (nivel 10)
UPDATE `roles` 
SET `nivel` = 10 
WHERE `slug` IN ('consulta', 'lectura', 'viewer');

-- Roles personalizados sin slug específico quedan en 20 (default)
UPDATE `roles` 
SET `nivel` = 20 
WHERE `tipo` = 'personalizado' 
  AND `nivel` = 20;

-- =============================================
-- PASO 3: Agregar campo 'nivel_privilegio' a tabla usuarios
-- =============================================

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists
FROM information_schema.columns
WHERE table_schema = 'kore_inventory'
  AND table_name = 'usuarios'
  AND column_name = 'nivel_privilegio';

SET @query = IF(@col_exists = 0,
  'ALTER TABLE `usuarios` 
   ADD COLUMN `nivel_privilegio` INT DEFAULT NULL 
   COMMENT ''Nivel más alto heredado de los roles asignados'' 
   AFTER `tipo_usuario`',
  'SELECT ''Campo nivel_privilegio ya existe en usuarios'' AS Mensaje');

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar índice para búsquedas por nivel de usuario
SET @index_exists = 0;
SELECT COUNT(*) INTO @index_exists
FROM information_schema.statistics
WHERE table_schema = 'kore_inventory'
  AND table_name = 'usuarios'
  AND index_name = 'idx_nivel_privilegio';

SET @query = IF(@index_exists = 0,
  'ALTER TABLE `usuarios` ADD INDEX `idx_nivel_privilegio` (`nivel_privilegio`)',
  'SELECT ''Índice idx_nivel_privilegio ya existe'' AS Mensaje');

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- PASO 4: Poblar nivel_privilegio para usuarios existentes
-- =============================================

-- Actualizar nivel_privilegio con el nivel más alto de sus roles
UPDATE `usuarios` u
SET `nivel_privilegio` = (
  SELECT MAX(r.nivel)
  FROM usuario_rol ur
  INNER JOIN roles r ON ur.rol_id = r.id
  WHERE ur.usuario_id = u.id
)
WHERE u.id IN (SELECT DISTINCT usuario_id FROM usuario_rol);

-- Usuarios sin roles asignados quedan en NULL (se actualizará cuando se asigne rol)

-- =============================================
-- PASO 5: Crear triggers para mantener nivel_privilegio sincronizado
-- =============================================

-- Eliminar triggers si ya existen (para poder recrearlos)
DROP TRIGGER IF EXISTS `update_usuario_nivel_after_insert`;
DROP TRIGGER IF EXISTS `update_usuario_nivel_after_delete`;
DROP TRIGGER IF EXISTS `update_usuario_nivel_after_update_rol`;

DELIMITER $$

-- Trigger 1: Actualizar nivel cuando se asigna un rol a un usuario
CREATE TRIGGER `update_usuario_nivel_after_insert`
AFTER INSERT ON `usuario_rol`
FOR EACH ROW
BEGIN
  DECLARE max_nivel INT;
  
  -- Obtener el nivel más alto de todos los roles del usuario
  SELECT MAX(r.nivel) INTO max_nivel
  FROM usuario_rol ur
  INNER JOIN roles r ON ur.rol_id = r.id
  WHERE ur.usuario_id = NEW.usuario_id;
  
  -- Actualizar el nivel del usuario
  UPDATE `usuarios`
  SET `nivel_privilegio` = max_nivel
  WHERE `id` = NEW.usuario_id;
END$$

-- Trigger 2: Actualizar nivel cuando se desasigna un rol de un usuario
CREATE TRIGGER `update_usuario_nivel_after_delete`
AFTER DELETE ON `usuario_rol`
FOR EACH ROW
BEGIN
  DECLARE max_nivel INT;
  
  -- Obtener el nivel más alto de los roles restantes del usuario
  SELECT MAX(r.nivel) INTO max_nivel
  FROM usuario_rol ur
  INNER JOIN roles r ON ur.rol_id = r.id
  WHERE ur.usuario_id = OLD.usuario_id;
  
  -- Actualizar el nivel del usuario (puede ser NULL si ya no tiene roles)
  UPDATE `usuarios`
  SET `nivel_privilegio` = max_nivel
  WHERE `id` = OLD.usuario_id;
END$$

-- Trigger 3: Actualizar nivel de usuarios cuando se modifica el nivel de un rol
CREATE TRIGGER `update_usuario_nivel_after_update_rol`
AFTER UPDATE ON `roles`
FOR EACH ROW
BEGIN
  -- Solo actualizar si cambió el nivel del rol
  IF NEW.nivel != OLD.nivel THEN
    -- Actualizar todos los usuarios que tienen este rol
    UPDATE `usuarios` u
    SET `nivel_privilegio` = (
      SELECT MAX(r.nivel)
      FROM usuario_rol ur
      INNER JOIN roles r ON ur.rol_id = r.id
      WHERE ur.usuario_id = u.id
    )
    WHERE u.id IN (
      SELECT usuario_id FROM usuario_rol WHERE rol_id = NEW.id
    );
  END IF;
END$$

DELIMITER ;

-- =============================================
-- PASO 6: Verificación de la migración
-- =============================================

-- Mostrar roles con sus niveles
SELECT 
  id,
  nombre,
  slug,
  tipo,
  empresa_id,
  nivel,
  es_admin,
  activo,
  CASE 
    WHEN nivel = 100 THEN '🔴 Super Admin'
    WHEN nivel = 80 THEN '🟠 Admin Empresa'
    WHEN nivel >= 60 THEN '🟡 Gerencia'
    WHEN nivel >= 40 THEN '🟢 Analista/Contador'
    WHEN nivel >= 20 THEN '🔵 Operativo'
    ELSE '⚪ Consulta'
  END AS categoria
FROM roles
ORDER BY nivel DESC, nombre ASC;

-- Mostrar usuarios con sus niveles de privilegio
SELECT 
  u.id,
  u.nombre,
  u.email,
  u.tipo_usuario,
  u.nivel_privilegio,
  GROUP_CONCAT(r.nombre SEPARATOR ', ') AS roles_asignados
FROM usuarios u
LEFT JOIN usuario_rol ur ON u.id = ur.usuario_id
LEFT JOIN roles r ON ur.rol_id = r.id
GROUP BY u.id, u.nombre, u.email, u.tipo_usuario, u.nivel_privilegio
ORDER BY u.nivel_privilegio DESC;

-- Mostrar resumen de triggers creados
SHOW TRIGGERS WHERE `Table` IN ('usuario_rol', 'roles');

-- =============================================
-- MENSAJE FINAL
-- =============================================

SELECT '✅ MIGRACIÓN COMPLETADA EXITOSAMENTE' AS Estado,
       'Se agregó campo nivel a roles' AS Cambio1,
       'Se agregó campo nivel_privilegio a usuarios' AS Cambio2,
       'Se crearon 3 triggers para mantener sincronización' AS Cambio3,
       'Verificar las tablas anteriores con los resultados' AS Siguiente;

-- =============================================
-- NOTAS IMPORTANTES
-- =============================================
-- 1. Esta migración es IDEMPOTENTE (se puede ejecutar múltiples veces sin error)
-- 2. Si ya existen los campos, muestra mensaje y continúa
-- 3. Los triggers se recrean siempre para tener la última versión
-- 4. Los niveles actualizados son:
--    - Super Admin: 100
--    - Admin Empresa: 80
--    - Gerente: 60
--    - Supervisor: 50
--    - Contador/Analista: 40
--    - Cajero/Bodeguero/Vendedor: 20
--    - Consulta: 10
-- 5. Usuarios heredan el nivel MÁS ALTO de sus roles
-- 6. Los triggers mantienen el nivel_privilegio actualizado automáticamente
-- =============================================

