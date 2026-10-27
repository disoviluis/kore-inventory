-- Validacion manual: MATIAS FASE 2
-- Solo lectura. Ejecutar desde EC2 contra la base RDS configurada.

SELECT 'TABLAS' AS seccion;
SELECT TABLE_NAME AS tabla, TABLE_TYPE AS tipo, ENGINE AS motor
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('matias_documentos', 'matias_documento_intentos')
ORDER BY TABLE_NAME;

SELECT 'COLUMNAS MATIAS_DOCUMENTOS' AS seccion;
SELECT ORDINAL_POSITION AS posicion, COLUMN_NAME AS columna, COLUMN_TYPE AS tipo,
       IS_NULLABLE AS nullable, COLUMN_DEFAULT AS valor_default, EXTRA AS extra
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'matias_documentos'
ORDER BY ORDINAL_POSITION;

SELECT 'COLUMNAS MATIAS_DOCUMENTO_INTENTOS' AS seccion;
SELECT ORDINAL_POSITION AS posicion, COLUMN_NAME AS columna, COLUMN_TYPE AS tipo,
       IS_NULLABLE AS nullable, COLUMN_DEFAULT AS valor_default, EXTRA AS extra
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'matias_documento_intentos'
ORDER BY ORDINAL_POSITION;

SELECT 'CLAVES' AS seccion;
SELECT TABLE_NAME AS tabla, INDEX_NAME AS indice, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columnas,
       MAX(CASE WHEN NON_UNIQUE = 0 THEN 'UNICA' ELSE 'NORMAL' END) AS tipo
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('matias_documentos', 'matias_documento_intentos')
GROUP BY TABLE_NAME, INDEX_NAME
ORDER BY TABLE_NAME, INDEX_NAME;

SELECT 'LLAVES FORANEAS' AS seccion;
SELECT TABLE_NAME AS tabla, CONSTRAINT_NAME AS constraint_name,
       COLUMN_NAME AS columna, REFERENCED_TABLE_NAME AS tabla_referenciada,
       REFERENCED_COLUMN_NAME AS columna_referenciada
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('matias_documentos', 'matias_documento_intentos')
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION;

SELECT 'RESULTADO ESPERADO' AS seccion,
       (SELECT COUNT(*) FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN ('matias_documentos', 'matias_documento_intentos')) AS tablas_encontradas,
       (SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'matias_documentos'
          AND COLUMN_NAME IN ('empresa_id','venta_id','entorno','request_uuid','cufe','estado','payload_hash','request_payload')) AS columnas_documentos_criticas,
       (SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'matias_documento_intentos'
          AND COLUMN_NAME IN ('documento_id','empresa_id','numero_intento','request_hash','http_status','response_payload')) AS columnas_intentos_criticas;

SELECT 'VALIDACION A MANUAL' AS seccion,
       CASE WHEN
         (SELECT COUNT(*) FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME IN ('matias_documentos', 'matias_documento_intentos')) = 2
         AND EXISTS (SELECT 1 FROM information_schema.STATISTICS
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matias_documentos'
                       AND INDEX_NAME = 'uk_matias_documento_venta_entorno')
         AND EXISTS (SELECT 1 FROM information_schema.STATISTICS
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matias_documentos'
                       AND INDEX_NAME = 'uk_matias_documento_request_uuid')
         AND EXISTS (SELECT 1 FROM information_schema.STATISTICS
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matias_documento_intentos'
                       AND INDEX_NAME = 'uk_matias_documento_intento')
       THEN 'OK - MIGRACION FASE 2 VALIDA'
       ELSE 'FALTA VALIDAR - REVISAR RESULTADOS ANTERIORES'
       END AS resultado;
