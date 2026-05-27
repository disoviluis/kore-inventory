-- =====================================================
-- SCRIPT: CREAR ROL "MENSAJERO"
-- Descripción: Crea el rol de mensajero con permisos
--              específicos para gestión de entregas
-- Fecha: Mayo 14, 2026
-- Autor: Disovi Soft
-- =====================================================

USE kore_inventory;

-- =====================================================
-- PASO 1: CREAR MÓDULO "MENSAJEROS" (si no existe)
-- =====================================================

-- Verificar si ya existe
SET @modulo_mensajeros_existe = (
  SELECT COUNT(*) 
  FROM modulos 
  WHERE nombre = 'mensajeros'
);

-- Insertar si no existe
SET @sql = IF(
  @modulo_mensajeros_existe = 0,
  "INSERT INTO modulos (nombre, nombre_mostrar, icono, descripcion, categoria, nivel, orden, activo)
   VALUES ('mensajeros', 'Control Mensajeros', 'bi-truck', 'Dashboard de control y supervisión de entregas', 'logistica', 'tenant', 14, 1)",
  "SELECT 'Módulo mensajeros ya existe' as message"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

-- Obtener ID del módulo
SET @modulo_mensajeros_id = (SELECT id FROM modulos WHERE nombre = 'mensajeros' LIMIT 1);

SELECT CONCAT('✅ Módulo mensajeros ID: ', IFNULL(@modulo_mensajeros_id, 'ERROR')) as resultado;

-- =====================================================
-- PASO 2: CREAR ACCIONES ESPECIALES (si no existen)
-- =====================================================

-- Acción: view_own (ver solo recursos propios)
SET @accion_view_own_existe = (
  SELECT COUNT(*) 
  FROM acciones 
  WHERE nombre = 'view_own'
);

SET @sql = IF(
  @accion_view_own_existe = 0,
  "INSERT INTO acciones (nombre, nombre_mostrar, descripcion, activo)
   VALUES ('view_own', 'Ver Propios', 'Ver solo recursos asignados al usuario', 1)",
  "SELECT 'Acción view_own ya existe' as message"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

-- Acción: receive (recibir/firmar entregas)
SET @accion_receive_existe = (
  SELECT COUNT(*) 
  FROM acciones 
  WHERE nombre = 'receive'
);

SET @sql = IF(
  @accion_receive_existe = 0,
  "INSERT INTO acciones (nombre, nombre_mostrar, descripcion, activo)
   VALUES ('receive', 'Recibir', 'Recibir traslados y capturar firma digital', 1)",
  "SELECT 'Acción receive ya existe' as message"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

-- Obtener IDs de acciones
SET @accion_view = (SELECT id FROM acciones WHERE nombre = 'view' LIMIT 1);
SET @accion_view_own = (SELECT id FROM acciones WHERE nombre = 'view_own' LIMIT 1);
SET @accion_receive = (SELECT id FROM acciones WHERE nombre = 'receive' LIMIT 1);

SELECT 
  CONCAT('✅ Acción view ID: ', IFNULL(@accion_view, 'ERROR')) as accion_view,
  CONCAT('✅ Acción view_own ID: ', IFNULL(@accion_view_own, 'ERROR')) as accion_view_own,
  CONCAT('✅ Acción receive ID: ', IFNULL(@accion_receive, 'ERROR')) as accion_receive;

-- =====================================================
-- PASO 3: CREAR PERMISOS PARA MÓDULO TRASLADOS
-- =====================================================

-- Obtener ID del módulo traslados
SET @modulo_traslados_id = (SELECT id FROM modulos WHERE nombre = 'traslados' LIMIT 1);

-- Permiso: traslados.view_own
SET @permiso_view_own_existe = (
  SELECT COUNT(*) 
  FROM permisos 
  WHERE codigo = 'traslados.view_own'
);

SET @sql = IF(
  @permiso_view_own_existe = 0,
  CONCAT(
    "INSERT INTO permisos (codigo, modulo_id, accion_id, descripcion, activo) 
     VALUES ('traslados.view_own', ", @modulo_traslados_id, ", ", @accion_view_own, ", 'Ver solo traslados asignados a mí', 1)"
  ),
  "SELECT 'Permiso traslados.view_own ya existe' as message"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

-- Permiso: traslados.receive
SET @permiso_receive_existe = (
  SELECT COUNT(*) 
  FROM permisos 
  WHERE codigo = 'traslados.receive'
);

SET @sql = IF(
  @permiso_receive_existe = 0,
  CONCAT(
    "INSERT INTO permisos (codigo, modulo_id, accion_id, descripcion, activo) 
     VALUES ('traslados.receive', ", @modulo_traslados_id, ", ", @accion_receive, ", 'Recibir traslados y firmar entrega', 1)"
  ),
  "SELECT 'Permiso traslados.receive ya existe' as message"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

-- Obtener IDs de permisos
SET @permiso_traslados_view_own = (SELECT id FROM permisos WHERE codigo = 'traslados.view_own' LIMIT 1);
SET @permiso_traslados_receive = (SELECT id FROM permisos WHERE codigo = 'traslados.receive' LIMIT 1);

SELECT 
  CONCAT('✅ Permiso traslados.view_own ID: ', IFNULL(@permiso_traslados_view_own, 'ERROR')) as permiso1,
  CONCAT('✅ Permiso traslados.receive ID: ', IFNULL(@permiso_traslados_receive, 'ERROR')) as permiso2;

-- =====================================================
-- PASO 4: CREAR PERMISOS PARA MÓDULO MENSAJEROS
-- =====================================================

-- Permiso: mensajeros.view (ver dashboard)
SET @permiso_mensajeros_view_existe = (
  SELECT COUNT(*) 
  FROM permisos 
  WHERE codigo = 'mensajeros.view'
);

SET @sql = IF(
  @permiso_mensajeros_view_existe = 0,
  CONCAT(
    "INSERT INTO permisos (codigo, modulo_id, accion_id, descripcion, activo) 
     VALUES ('mensajeros.view', ", @modulo_mensajeros_id, ", ", @accion_view, ", 'Acceso al dashboard de mensajeros', 1)"
  ),
  "SELECT 'Permiso mensajeros.view ya existe' as message"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

SET @permiso_mensajeros_view = (SELECT id FROM permisos WHERE codigo = 'mensajeros.view' LIMIT 1);

SELECT CONCAT('✅ Permiso mensajeros.view ID: ', IFNULL(@permiso_mensajeros_view, 'ERROR')) as resultado;

-- =====================================================
-- PASO 5: CREAR PERMISOS ADICIONALES (Bodegas y Productos)
-- =====================================================

-- Obtener IDs de módulos
SET @modulo_bodegas_id = (SELECT id FROM modulos WHERE nombre = 'bodegas' LIMIT 1);
SET @modulo_productos_id = (SELECT id FROM modulos WHERE nombre = 'productos' LIMIT 1);

-- Ya deberían existir estos permisos, pero los obtenemos por si acaso
SET @permiso_bodegas_view = (SELECT id FROM permisos WHERE codigo = 'bodegas.view' LIMIT 1);
SET @permiso_productos_view = (SELECT id FROM permisos WHERE codigo = 'productos.view' LIMIT 1);

-- Si no existen, crearlos
SET @sql = IF(
  @permiso_bodegas_view IS NULL,
  CONCAT(
    "INSERT INTO permisos (codigo, modulo_id, accion_id, descripcion, activo) 
     VALUES ('bodegas.view', ", @modulo_bodegas_id, ", ", @accion_view, ", 'Ver bodegas', 1)"
  ),
  "SELECT 'Permiso bodegas.view ya existe' as message"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

SET @sql = IF(
  @permiso_productos_view IS NULL,
  CONCAT(
    "INSERT INTO permisos (codigo, modulo_id, accion_id, descripcion, activo) 
     VALUES ('productos.view', ", @modulo_productos_id, ", ", @accion_view, ", 'Ver productos', 1)"
  ),
  "SELECT 'Permiso productos.view ya existe' as message"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

-- Actualizar variables
SET @permiso_bodegas_view = (SELECT id FROM permisos WHERE codigo = 'bodegas.view' LIMIT 1);
SET @permiso_productos_view = (SELECT id FROM permisos WHERE codigo = 'productos.view' LIMIT 1);

SELECT 
  CONCAT('✅ Permiso bodegas.view ID: ', IFNULL(@permiso_bodegas_view, 'ERROR')) as permiso1,
  CONCAT('✅ Permiso productos.view ID: ', IFNULL(@permiso_productos_view, 'ERROR')) as permiso2;

-- =====================================================
-- PASO 6: CREAR ROL "MENSAJERO" (Plantilla de Sistema)
-- =====================================================

-- Verificar si el rol ya existe
SET @rol_mensajero_existe = (
  SELECT COUNT(*) 
  FROM roles 
  WHERE slug = 'mensajero' 
    AND empresa_id IS NULL
);

SET @sql = IF(
  @rol_mensajero_existe = 0,
  "INSERT INTO roles (empresa_id, nombre, slug, descripcion, nivel, tipo, activo, created_at)
   VALUES (
     NULL,
     'Mensajero',
     'mensajero',
     'Encargado de entregas y traslados entre bodegas. Puede ver sus traslados asignados y registrar firma digital al entregar.',
     30,
     'sistema',
     1,
     NOW()
   )",
  "SELECT 'Rol mensajero ya existe' as message"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DROP PREPARE stmt;

-- Obtener ID del rol
SET @rol_mensajero_id = (
  SELECT id 
  FROM roles 
  WHERE slug = 'mensajero' 
    AND empresa_id IS NULL 
  LIMIT 1
);

SELECT CONCAT('✅ Rol Mensajero ID: ', IFNULL(@rol_mensajero_id, 'ERROR')) as resultado;

-- =====================================================
-- PASO 7: ASIGNAR PERMISOS AL ROL MENSAJERO
-- =====================================================

-- Eliminar permisos existentes del rol (por si se ejecuta varias veces)
DELETE FROM rol_permiso WHERE rol_id = @rol_mensajero_id;

-- Asignar permisos específicos
INSERT INTO rol_permiso (rol_id, permiso_id)
VALUES
  -- Dashboard de mensajeros
  (@rol_mensajero_id, @permiso_mensajeros_view),
  
  -- Traslados (ver solo los suyos y recibir)
  (@rol_mensajero_id, @permiso_traslados_view_own),
  (@rol_mensajero_id, @permiso_traslados_receive),
  
  -- Bodegas (solo ver)
  (@rol_mensajero_id, @permiso_bodegas_view),
  
  -- Productos (solo ver)
  (@rol_mensajero_id, @permiso_productos_view);

SELECT CONCAT('✅ Se asignaron ', ROW_COUNT(), ' permisos al rol Mensajero') as resultado;

-- =====================================================
-- PASO 8: VERIFICACIÓN FINAL
-- =====================================================

SELECT 
  '=========================================' as separador,
  '✅ RESUMEN DE CREACIÓN DE ROL MENSAJERO' as titulo,
  '=========================================' as separador2;

-- Datos del rol
SELECT 
  r.id,
  r.nombre,
  r.slug,
  r.descripcion,
  r.nivel,
  r.tipo,
  CASE WHEN r.activo = 1 THEN '✅ Activo' ELSE '❌ Inactivo' END as estado,
  COUNT(rp.permiso_id) as total_permisos
FROM roles r
LEFT JOIN rol_permiso rp ON r.id = rp.rol_id
WHERE r.slug = 'mensajero' 
  AND r.empresa_id IS NULL
GROUP BY r.id;

-- Permisos asignados
SELECT 
  '=========================================' as separador,
  'PERMISOS ASIGNADOS AL ROL MENSAJERO:' as titulo,
  '=========================================' as separador2;

SELECT 
  p.id,
  p.codigo,
  m.nombre_mostrar as modulo,
  a.nombre_mostrar as accion,
  p.descripcion
FROM rol_permiso rp
INNER JOIN permisos p ON rp.permiso_id = p.id
INNER JOIN modulos m ON p.modulo_id = m.id
INNER JOIN acciones a ON p.accion_id = a.id
WHERE rp.rol_id = @rol_mensajero_id
ORDER BY m.orden, p.codigo;

-- =====================================================
-- PASO 9: SCRIPT DE ASIGNACIÓN A USUARIOS (EJEMPLO)
-- =====================================================

SELECT 
  '=========================================' as separador,
  'PARA ASIGNAR ROL A UN USUARIO:' as titulo,
  '=========================================' as separador2;

SELECT 
  CONCAT(
    'INSERT INTO usuario_rol (usuario_id, rol_id, empresa_id, created_by, created_at) ',
    'VALUES (',
    '  [ID_USUARIO],  -- ID del usuario que será mensajero',
    CHAR(10),
    '  ', @rol_mensajero_id, ',         -- Rol Mensajero',
    CHAR(10),
    '  [ID_EMPRESA],  -- ID de la empresa',
    CHAR(10),
    '  [ID_ADMIN],    -- ID del admin que asigna',
    CHAR(10),
    '  NOW()',
    CHAR(10),
    ');'
  ) as ejemplo_asignacion;

-- También agregar a usuario_empresa si no existe
SELECT 
  CONCAT(
    'INSERT INTO usuario_empresa (usuario_id, empresa_id, activo, created_at) ',
    'VALUES ([ID_USUARIO], [ID_EMPRESA], 1, NOW()) ',
    'ON DUPLICATE KEY UPDATE activo = 1;'
  ) as ejemplo_empresa;

-- =====================================================
-- PASO 10: CREAR ROL EN EMPRESA ESPECÍFICA (OPCIONAL)
-- =====================================================

SELECT 
  '=========================================' as separador,
  'PARA CREAR ROL EN EMPRESA ESPECÍFICA:' as titulo,
  '(El admin_empresa debe hacerlo desde UI)' as subtitulo,
  '=========================================' as separador2;

SELECT 
  CONCAT(
    '-- Copiar el rol sistema a la empresa',
    CHAR(10), CHAR(10),
    'INSERT INTO roles (empresa_id, nombre, slug, descripcion, nivel, tipo, activo, created_by, created_at)',
    CHAR(10),
    'SELECT ',
    CHAR(10),
    '  [ID_EMPRESA],  -- ID de la empresa',
    CHAR(10),
    '  r.nombre,',
    CHAR(10),
    '  r.slug,',
    CHAR(10),
    '  r.descripcion,',
    CHAR(10),
    '  r.nivel,',
    CHAR(10),
    '  ''empresa'',   -- tipo cambia a empresa',
    CHAR(10),
    '  r.activo,',
    CHAR(10),
    '  [ID_ADMIN],    -- ID del admin que crea',
    CHAR(10),
    '  NOW()',
    CHAR(10),
    'FROM roles r',
    CHAR(10),
    'WHERE r.slug = ''mensajero'' AND r.empresa_id IS NULL;',
    CHAR(10), CHAR(10),
    'SET @nuevo_rol_id = LAST_INSERT_ID();',
    CHAR(10), CHAR(10),
    '-- Copiar permisos del rol sistema',
    CHAR(10),
    'INSERT INTO rol_permiso (rol_id, permiso_id)',
    CHAR(10),
    'SELECT @nuevo_rol_id, rp.permiso_id',
    CHAR(10),
    'FROM rol_permiso rp',
    CHAR(10),
    'WHERE rp.rol_id = ', @rol_mensajero_id, ';'
  ) as script_copiar_rol;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================

SELECT 
  '=========================================' as separador,
  '✅ ROL MENSAJERO CREADO EXITOSAMENTE' as titulo,
  '=========================================' as separador2;

SELECT 
  CONCAT('Total de permisos asignados: ', COUNT(*)) as resumen
FROM rol_permiso 
WHERE rol_id = @rol_mensajero_id;

SELECT 
  '⚠️ IMPORTANTE:' as alerta,
  'Ahora debes:' as paso1,
  '1. Asignar el rol a usuarios específicos (INSERT INTO usuario_rol)' as paso2,
  '2. Modificar backend para usar roles en lugar de tipo_usuario' as paso3,
  '3. Compilar y desplegar backend actualizado' as paso4,
  '4. Probar con usuario de prueba' as paso5;
