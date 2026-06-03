-- ========================================
-- MIGRACIÓN: Sistema de Niveles de Facturación
-- ========================================
-- Fecha: 3 de Junio 2026
-- Propósito: Soportar 3 niveles de facturación según normativa DIAN
--   1. Documento Equivalente (tiquete)
--   2. Factura POS
--   3. Factura Electrónica
-- ========================================

USE kore_inventory;

-- ========================================
-- PASO 1: Agregar campo nivel_facturacion
-- ========================================

ALTER TABLE empresas 
ADD COLUMN IF NOT EXISTS nivel_facturacion ENUM(
  'documento_equivalente',
  'factura_pos', 
  'factura_electronica'
) DEFAULT 'documento_equivalente' 
COMMENT 'Nivel de facturación según DIAN'
AFTER regimen_tributario;

SELECT 'Campo nivel_facturacion agregado correctamente' AS status;

-- ========================================
-- PASO 2: Migrar empresas existentes
-- ========================================

-- Empresas con resolución DIAN válida → factura_pos
UPDATE empresas 
SET nivel_facturacion = 'factura_pos'
WHERE resolucion_dian IS NOT NULL 
  AND resolucion_dian != 'Pendiente'
  AND resolucion_dian != ''
  AND rango_factura_desde IS NOT NULL
  AND rango_factura_hasta IS NOT NULL;

SELECT 'Empresas migradas a factura_pos' AS status, COUNT(*) AS cantidad
FROM empresas WHERE nivel_facturacion = 'factura_pos';

-- Empresas grandes contribuyentes → factura_electronica
UPDATE empresas 
SET nivel_facturacion = 'factura_electronica'
WHERE gran_contribuyente = 1 OR autoretenedor = 1;

SELECT 'Empresas migradas a factura_electronica' AS status, COUNT(*) AS cantidad
FROM empresas WHERE nivel_facturacion = 'factura_electronica';

-- Las demás permanecen en documento_equivalente (default)
SELECT 'Empresas en documento_equivalente' AS status, COUNT(*) AS cantidad
FROM empresas WHERE nivel_facturacion = 'documento_equivalente';

-- ========================================
-- PASO 3: Agregar campos facturación electrónica
-- ========================================

-- Responsabilidades fiscales (códigos DIAN)
ALTER TABLE empresas 
ADD COLUMN IF NOT EXISTS responsabilidades_fiscales JSON DEFAULT NULL
COMMENT 'Códigos DIAN: ["O-13 Gran Contribuyente","O-15 Autorretenedor","R-99-PN Responsable IVA"]'
AFTER gran_contribuyente;

-- Actividad económica CIIU
ALTER TABLE empresas 
ADD COLUMN IF NOT EXISTS actividad_economica VARCHAR(200) DEFAULT NULL
COMMENT 'Código CIIU + descripción (ej: 4711 - Comercio al por menor)'
AFTER responsabilidades_fiscales;

-- Credenciales DIAN para facturación electrónica
ALTER TABLE empresas 
ADD COLUMN IF NOT EXISTS clave_tecnica VARCHAR(100) DEFAULT NULL
COMMENT 'Clave técnica provista por DIAN'
AFTER resolucion_dian;

ALTER TABLE empresas 
ADD COLUMN IF NOT EXISTS software_id VARCHAR(100) DEFAULT NULL
COMMENT 'ID del software autorizado por DIAN'
AFTER clave_tecnica;

ALTER TABLE empresas 
ADD COLUMN IF NOT EXISTS pin_software VARCHAR(100) DEFAULT NULL
COMMENT 'PIN del software para firma digital'
AFTER software_id;

ALTER TABLE empresas 
ADD COLUMN IF NOT EXISTS ambiente_dian ENUM('habilitacion', 'produccion') DEFAULT 'habilitacion'
COMMENT 'Ambiente DIAN: habilitacion (pruebas) o produccion'
AFTER pin_software;

SELECT 'Campos de facturación electrónica agregados' AS status;

-- ========================================
-- PASO 4: Agregar campos a tabla ventas
-- ========================================

-- CUFE (Código Único Factura Electrónica)
ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS cufe VARCHAR(255) DEFAULT NULL
COMMENT 'Código Único Factura Electrónica (solo para factura electrónica)'
AFTER numero_factura;

-- XML firmado (para auditoría)
ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS xml_factura TEXT DEFAULT NULL
COMMENT 'XML firmado enviado a DIAN (solo factura electrónica)'
AFTER cufe;

-- Estado de validación DIAN
ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS estado_dian ENUM('pendiente', 'aceptada', 'rechazada', 'no_aplica') DEFAULT 'no_aplica'
COMMENT 'Estado de validación DIAN (solo factura electrónica)'
AFTER xml_factura;

-- Fecha de respuesta DIAN
ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS fecha_validacion_dian DATETIME DEFAULT NULL
COMMENT 'Fecha y hora de validación por DIAN'
AFTER estado_dian;

SELECT 'Campos agregados a tabla ventas' AS status;

-- ========================================
-- PASO 5: Inicializar responsabilidades fiscales
-- ========================================

-- Grandes contribuyentes
UPDATE empresas 
SET responsabilidades_fiscales = JSON_ARRAY('O-13')
WHERE gran_contribuyente = 1 
  AND responsabilidades_fiscales IS NULL;

-- Autorretenedores
UPDATE empresas 
SET responsabilidades_fiscales = JSON_ARRAY('O-15')
WHERE autoretenedor = 1 
  AND responsabilidades_fiscales IS NULL
  AND gran_contribuyente = 0;

-- Grandes contribuyentes Y autorretenedores
UPDATE empresas 
SET responsabilidades_fiscales = JSON_ARRAY('O-13', 'O-15')
WHERE gran_contribuyente = 1 
  AND autoretenedor = 1;

SELECT 'Responsabilidades fiscales inicializadas' AS status;

-- ========================================
-- PASO 6: Validar migración
-- ========================================

SELECT 
  '=== RESUMEN MIGRACIÓN ===' AS '';

SELECT 
  nivel_facturacion,
  COUNT(*) AS cantidad_empresas
FROM empresas
GROUP BY nivel_facturacion;

SELECT 
  '=== EMPRESAS SIN DÍGITO VERIFICACIÓN ===' AS '';

SELECT 
  id,
  nombre,
  nit,
  digito_verificacion
FROM empresas
WHERE digito_verificacion IS NULL;

SELECT 
  '=== EMPRESAS NIVEL FACTURA POS (revisar resolución) ===' AS '';

SELECT 
  id,
  nombre,
  nit,
  digito_verificacion,
  resolucion_dian,
  fecha_resolucion,
  rango_factura_desde,
  rango_factura_hasta
FROM empresas
WHERE nivel_facturacion = 'factura_pos';

SELECT 
  '=== EMPRESAS NIVEL FACTURA ELECTRÓNICA (revisar credenciales DIAN) ===' AS '';

SELECT 
  id,
  nombre,
  nit,
  digito_verificacion,
  clave_tecnica,
  software_id,
  ambiente_dian
FROM empresas
WHERE nivel_facturacion = 'factura_electronica';

-- ========================================
-- PASO 7: (OPCIONAL) Calcular DV faltantes
-- ========================================
-- NOTA: Este paso requiere implementación de función calcular_dv()
-- Por ahora, se debe hacer manualmente o con script externo

-- Ejemplo para empresa 28 (ya calculado):
-- UPDATE empresas SET digito_verificacion = '8' WHERE id = 28 AND nit = '1016085506';

SELECT 
  '=== ACCIÓN REQUERIDA: Calcular DV faltantes ===' AS '';

SELECT 
  CONCAT(
    'UPDATE empresas SET digito_verificacion = ''[CALCULAR]'' WHERE id = ',
    id,
    ' AND nit = ''',
    nit,
    ''';'
  ) AS query_pendiente
FROM empresas
WHERE digito_verificacion IS NULL;

-- ========================================
-- FUNCIONES AUXILIARES
-- ========================================

-- Función para calcular dígito de verificación (algoritmo módulo 11 DIAN)
DELIMITER $$

DROP FUNCTION IF EXISTS calcular_dv_nit$$

CREATE FUNCTION calcular_dv_nit(nit VARCHAR(20))
RETURNS CHAR(1)
DETERMINISTIC
BEGIN
  DECLARE i INT DEFAULT 1;
  DECLARE suma INT DEFAULT 0;
  DECLARE digito CHAR(1);
  DECLARE factor INT;
  DECLARE nit_numerico VARCHAR(20);
  DECLARE longitud INT;
  
  -- Limpiar NIT (solo números)
  SET nit_numerico = REGEXP_REPLACE(nit, '[^0-9]', '');
  SET longitud = LENGTH(nit_numerico);
  
  -- Array de factores según posición (de derecha a izquierda)
  -- Posiciones: 1->3, 2->7, 3->13, 4->17, 5->19, 6->23, 7->29, 8->37, 9->41, 10->43, 11->47, 12->53, 13->59, 14->67, 15->71
  
  WHILE i <= longitud DO
    SET factor = CASE (longitud - i + 1)
      WHEN 1 THEN 3
      WHEN 2 THEN 7
      WHEN 3 THEN 13
      WHEN 4 THEN 17
      WHEN 5 THEN 19
      WHEN 6 THEN 23
      WHEN 7 THEN 29
      WHEN 8 THEN 37
      WHEN 9 THEN 41
      WHEN 10 THEN 43
      WHEN 11 THEN 47
      WHEN 12 THEN 53
      WHEN 13 THEN 59
      WHEN 14 THEN 67
      WHEN 15 THEN 71
      ELSE 3
    END;
    
    SET suma = suma + (CAST(SUBSTRING(nit_numerico, i, 1) AS UNSIGNED) * factor);
    SET i = i + 1;
  END WHILE;
  
  -- Calcular módulo 11
  SET digito = MOD(suma, 11);
  
  -- Aplicar regla DIAN
  IF digito > 1 THEN
    SET digito = 11 - digito;
  END IF;
  
  RETURN CAST(digito AS CHAR);
END$$

DELIMITER ;

SELECT 'Función calcular_dv_nit() creada correctamente' AS status;

-- ========================================
-- PASO 8: Aplicar cálculo automático de DV
-- ========================================

UPDATE empresas 
SET digito_verificacion = calcular_dv_nit(nit)
WHERE digito_verificacion IS NULL 
  AND nit IS NOT NULL
  AND nit != '';

SELECT 
  'Dígitos de verificación calculados automáticamente' AS status,
  COUNT(*) AS cantidad
FROM empresas 
WHERE digito_verificacion IS NOT NULL;

-- ========================================
-- VERIFICACIÓN FINAL
-- ========================================

SELECT 
  id,
  nombre,
  CONCAT(nit, '-', digito_verificacion) AS nit_completo,
  nivel_facturacion,
  regimen_tributario,
  CASE 
    WHEN nivel_facturacion = 'documento_equivalente' THEN '✓ Configuración mínima'
    WHEN nivel_facturacion = 'factura_pos' AND resolucion_dian IS NOT NULL THEN '✓ Configuración completa'
    WHEN nivel_facturacion = 'factura_pos' AND resolucion_dian IS NULL THEN '⚠ Falta resolución DIAN'
    WHEN nivel_facturacion = 'factura_electronica' AND clave_tecnica IS NOT NULL THEN '✓ Configuración completa'
    WHEN nivel_facturacion = 'factura_electronica' AND clave_tecnica IS NULL THEN '⚠ Faltan credenciales DIAN'
  END AS estado_configuracion
FROM empresas
ORDER BY id;

-- ========================================
-- COMMIT (solo si todo salió bien)
-- ========================================

-- Revisar resultados antes de ejecutar:
-- COMMIT;

SELECT 
  CONCAT(
    '========================================\n',
    'MIGRACIÓN COMPLETADA EXITOSAMENTE\n',
    '========================================\n',
    'Revisar resultados antes de ejecutar COMMIT\n',
    '========================================'
  ) AS mensaje_final;
