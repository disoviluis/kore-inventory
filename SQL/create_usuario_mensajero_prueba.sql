-- =====================================================
-- SCRIPT: CREAR USUARIO MENSAJERO DE PRUEBA
-- Descripción: Crea un usuario de prueba con rol mensajero
-- Fecha: Mayo 14, 2026
-- =====================================================

USE kore_inventory;

-- Verificar si el usuario ya existe
SET @usuario_exists = (
  SELECT COUNT(*) FROM usuarios WHERE email = 'mensajero.prueba@kore.com'
);

-- Insertar usuario si no existe
SET @sql = IF(
  @usuario_exists = 0,
  "INSERT INTO usuarios (
    nombre, apellido, email, password, telefono, activo, tipo_usuario, created_at
  ) VALUES (
    'Juan',
    'Mensajero',
    'mensajero.prueba@kore.com',
    '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', -- password: Password123
    '+57 300 999 8888',
    1,
    'usuario',
    NOW()
  )",
  "SELECT 'Usuario mensajero.prueba@kore.com ya existe' as message"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

-- Obtener ID del usuario creado
SET @usuario_id = (SELECT id FROM usuarios WHERE email = 'mensajero.prueba@kore.com' LIMIT 1);
SET @empresa_id = 18; -- PRUEBA1
SET @rol_mensajero_id = 15; -- Rol Mensajero (del script anterior)

SELECT CONCAT('✅ Usuario ID: ', IFNULL(@usuario_id, 'ERROR')) as usuario_creado;

-- Asignar usuario a la empresa (usuario_empresa)
SET @sql = IF(
  (SELECT COUNT(*) FROM usuario_empresa WHERE usuario_id = @usuario_id AND empresa_id = @empresa_id) = 0,
  CONCAT("INSERT INTO usuario_empresa (usuario_id, empresa_id, activo, created_at) VALUES (", @usuario_id, ", ", @empresa_id, ", 1, NOW())"),
  "SELECT 'Usuario ya asignado a empresa' as message"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

SELECT CONCAT('✅ Usuario asignado a empresa ', @empresa_id) as resultado;

-- Asignar rol de mensajero (usuario_rol)
SET @sql = IF(
  (SELECT COUNT(*) FROM usuario_rol WHERE usuario_id = @usuario_id AND rol_id = @rol_mensajero_id AND empresa_id = @empresa_id) = 0,
  CONCAT("INSERT INTO usuario_rol (usuario_id, rol_id, empresa_id, created_by, created_at) VALUES (", @usuario_id, ", ", @rol_mensajero_id, ", ", @empresa_id, ", 1, NOW())"),
  "SELECT 'Usuario ya tiene rol mensajero' as message"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

SELECT CONCAT('✅ Rol mensajero asignado al usuario') as resultado;

-- Verificación final
SELECT 
  '=========================================' as separador,
  '✅ USUARIO MENSAJERO DE PRUEBA CREADO' as titulo,
  '=========================================' as separador2;

SELECT 
  u.id,
  u.nombre,
  u.apellido,
  u.email,
  u.telefono,
  u.tipo_usuario,
  CASE WHEN u.activo = 1 THEN '✅ Activo' ELSE '❌ Inactivo' END as estado
FROM usuarios u
WHERE u.id = @usuario_id;

SELECT 
  '=========================================' as separador,
  'EMPRESAS ASIGNADAS:' as titulo,
  '=========================================' as separador2;

SELECT 
  e.id,
  e.nombre as empresa,
  CASE WHEN ue.activo = 1 THEN '✅ Activo' ELSE '❌ Inactivo' END as estado
FROM usuario_empresa ue
INNER JOIN empresas e ON ue.empresa_id = e.id
WHERE ue.usuario_id = @usuario_id;

SELECT 
  '=========================================' as separador,
  'ROLES ASIGNADOS:' as titulo,
  '=========================================' as separador2;

SELECT 
  r.id,
  r.nombre as rol,
  r.slug,
  e.nombre as empresa
FROM usuario_rol ur
INNER JOIN roles r ON ur.rol_id = r.id
INNER JOIN empresas e ON ur.empresa_id = e.id
WHERE ur.usuario_id = @usuario_id;

SELECT 
  '=========================================' as separador,
  '⚠️ CREDENCIALES DE ACCESO:' as titulo,
  '=========================================' as separador2;

SELECT 
  'mensajero.prueba@kore.com' as email,
  'Password123' as password,
  'Usar estas credenciales para iniciar sesión' as instrucciones;

SELECT 
  'http://18.191.181.99/mensajeros-dashboard.html' as url_acceso;
