-- Fase 0: auditoria de esquema para activos, inventarios y repuestos.
-- Solo consulta INFORMATION_SCHEMA; no lee datos de negocio ni modifica la base.
-- Ejecutar conectado a la base kore_inventory en RDS y guardar las salidas.

SELECT
  DATABASE() AS esquema_actual,
  VERSION() AS version_servidor,
  CURRENT_TIMESTAMP AS fecha_consulta;

-- Inventario de tablas para contrastar migraciones desplegadas con el repositorio.
SELECT
  TABLE_NAME AS tabla,
  ENGINE AS motor,
  TABLE_ROWS AS filas_estimadas,
  CREATE_TIME AS creada
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- Columnas de los dominios existentes o potencialmente relacionados.
SELECT
  TABLE_NAME AS tabla,
  ORDINAL_POSITION AS posicion,
  COLUMN_NAME AS columna,
  COLUMN_TYPE AS tipo,
  IS_NULLABLE AS permite_null,
  COLUMN_DEFAULT AS valor_default,
  COLUMN_KEY AS clave,
  EXTRA AS extra
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    TABLE_NAME REGEXP 'empresa|producto|categoria|bodega|inventario|movimiento|usuario|rol|permiso|auditoria|imagen|archivo|activo|manten|repuesto|traslado|serie|lote'
  )
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- Relaciones foraneas de tablas relevantes (incluye el destino y las columnas).
SELECT
  k.TABLE_NAME AS tabla,
  k.COLUMN_NAME AS columna,
  k.CONSTRAINT_NAME AS restriccion,
  k.REFERENCED_TABLE_NAME AS tabla_referenciada,
  k.REFERENCED_COLUMN_NAME AS columna_referenciada
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
WHERE k.TABLE_SCHEMA = DATABASE()
  AND k.REFERENCED_TABLE_NAME IS NOT NULL
  AND (
    k.TABLE_NAME REGEXP 'empresa|producto|categoria|bodega|inventario|movimiento|usuario|rol|permiso|auditoria|imagen|archivo|activo|manten|repuesto|traslado|serie|lote'
    OR k.REFERENCED_TABLE_NAME REGEXP 'empresa|producto|categoria|bodega|inventario|movimiento|usuario|rol|permiso|auditoria|imagen|archivo|activo|manten|repuesto|traslado|serie|lote'
  )
ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION;

-- Indices unicos y no unicos en tablas potencialmente relacionadas.
SELECT
  TABLE_NAME AS tabla,
  INDEX_NAME AS indice,
  NON_UNIQUE AS no_unico,
  SEQ_IN_INDEX AS orden_columna,
  COLUMN_NAME AS columna
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME REGEXP 'empresa|producto|categoria|bodega|inventario|movimiento|usuario|rol|permiso|auditoria|imagen|archivo|activo|manten|repuesto|traslado|serie|lote'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;