-- =============================================
-- TRIGGERS: Sincronización automática de nivel_privilegio
-- Fecha: 2026-03-12
-- Prerequisito: log_bin_trust_function_creators = 1 en RDS Parameter Group
-- =============================================

-- IMPORTANTE: Antes de ejecutar este archivo, asegúrate de que:
-- 1. El Parameter Group de RDS tenga log_bin_trust_function_creators = 1
-- 2. La instancia RDS se haya reiniciado después del cambio
-- 3. Los campos nivel y nivel_privilegio ya existan

-- Eliminar triggers si existen (para ser idempotente)
DROP TRIGGER IF EXISTS `update_usuario_nivel_after_insert`;
DROP TRIGGER IF EXISTS `update_usuario_nivel_after_delete`;
DROP TRIGGER IF EXISTS `update_usuario_nivel_after_update_rol`;

DELIMITER $$

-- =============================================
-- Trigger 1: Actualizar nivel cuando se asigna un rol a un usuario
-- =============================================
CREATE DEFINER=`admin`@`%` TRIGGER `update_usuario_nivel_after_insert`
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

-- =============================================
-- Trigger 2: Actualizar nivel cuando se elimina un rol de un usuario
-- =============================================
CREATE DEFINER=`admin`@`%` TRIGGER `update_usuario_nivel_after_delete`
AFTER DELETE ON `usuario_rol`
FOR EACH ROW
BEGIN
  DECLARE max_nivel INT;
  
  -- Obtener el nivel más alto de los roles restantes del usuario
  SELECT MAX(r.nivel) INTO max_nivel
  FROM usuario_rol ur
  INNER JOIN roles r ON ur.rol_id = r.id
  WHERE ur.usuario_id = OLD.usuario_id;
  
  -- Actualizar el nivel del usuario (NULL si no tiene más roles)
  UPDATE `usuarios`
  SET `nivel_privilegio` = max_nivel
  WHERE `id` = OLD.usuario_id;
END$$

-- =============================================
-- Trigger 3: Actualizar niveles de usuarios cuando cambia el nivel de un rol
-- =============================================
CREATE DEFINER=`admin`@`%` TRIGGER `update_usuario_nivel_after_update_rol`
AFTER UPDATE ON `roles`
FOR EACH ROW
BEGIN
  -- Solo si cambió el nivel
  IF OLD.nivel != NEW.nivel THEN
    -- Actualizar todos los usuarios que tienen este rol
    UPDATE `usuarios` u
    SET `nivel_privilegio` = (
      SELECT MAX(r.nivel)
      FROM usuario_rol ur
      INNER JOIN roles r ON ur.rol_id = r.id
      WHERE ur.usuario_id = u.id
    )
    WHERE u.id IN (
      SELECT usuario_id 
      FROM usuario_rol 
      WHERE rol_id = NEW.id
    );
  END IF;
END$$

DELIMITER ;

-- =============================================
-- Verificación de triggers
-- =============================================

SELECT 
  TRIGGER_NAME,
  EVENT_MANIPULATION,
  EVENT_OBJECT_TABLE,
  ACTION_TIMING,
  DEFINER
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE()
  AND TRIGGER_NAME LIKE 'update_usuario_nivel%'
ORDER BY TRIGGER_NAME;

SELECT '✅ Triggers creados exitosamente' AS Estado;
