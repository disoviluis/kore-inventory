-- Auditoria puntual para disenar la migracion de la Fase 2.
-- Solo consulta metadatos/catalogos RBAC; no lee datos de negocio ni modifica RDS.
-- Ejecutar en kore_inventory y compartir las salidas de los cuatro SELECT.

-- 1. Indices actuales que afectan la integracion de stock, movimientos y auditoria.
SELECT
  TABLE_NAME AS tabla,
  INDEX_NAME AS indice,
  NON_UNIQUE AS no_unico,
  SEQ_IN_INDEX AS orden_columna,
  COLUMN_NAME AS columna
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'productos',
    'bodegas',
    'productos_bodegas',
    'inventario_movimientos',
    'auditoria_logs'
  )
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- 2. Columnas del catalogo de modulos, acciones y permisos.
SELECT
  TABLE_NAME AS tabla,
  ORDINAL_POSITION AS posicion,
  COLUMN_NAME AS columna,
  COLUMN_TYPE AS tipo,
  IS_NULLABLE AS permite_null,
  COLUMN_DEFAULT AS valor_default,
  COLUMN_KEY AS clave
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'modulos',
    'acciones',
    'permisos',
    'roles',
    'usuario_rol',
    'rol_permiso'
  )
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- 3. Acciones y modulos configurados actualmente (catalogo pequeno).
SELECT * FROM modulos ORDER BY id;
SELECT * FROM acciones ORDER BY id;

-- 4. Permisos existentes y su modulo/accion para confirmar nomenclatura.
SELECT
  p.codigo,
  p.descripcion,
  m.nombre AS modulo,
  a.nombre AS accion,
  p.activo
FROM permisos p
INNER JOIN modulos m ON m.id = p.modulo_id
INNER JOIN acciones a ON a.id = p.accion_id
ORDER BY m.nombre, a.nombre;
