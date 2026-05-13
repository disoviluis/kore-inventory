-- ============================================
-- MIGRACIÓN: Agregar campos RUES a tabla empresas
-- Fecha: 2026-05-13
-- Descripción: Agrega campos de Registro Único Empresarial
--              para mejorar la gestión de empresas
-- ============================================

USE kore_inventory;

-- ============================================
-- PASO 1: Agregar nuevos campos
-- ============================================

-- Campo tipo de documento
ALTER TABLE empresas
ADD COLUMN tipo_documento VARCHAR(20) DEFAULT 'NIT' COMMENT 'NIT, CC, CE, PASAPORTE'
AFTER razon_social;

-- Campo dígito de verificación (separado del NIT)
ALTER TABLE empresas
ADD COLUMN digito_verificacion CHAR(1) NULL COMMENT 'DV calculado según DIAN'
AFTER nit;

-- Campos de información empresarial (RUES)
ALTER TABLE empresas
ADD COLUMN representante_legal VARCHAR(255) NULL COMMENT 'Nombre del representante legal'
AFTER telefono;

ALTER TABLE empresas
ADD COLUMN tipo_sociedad VARCHAR(50) NULL COMMENT 'SAS, LTDA, SA, EU, etc.'
AFTER representante_legal;

ALTER TABLE empresas
ADD COLUMN matricula_mercantil VARCHAR(100) NULL COMMENT 'Número de matrícula mercantil'
AFTER tipo_sociedad;

ALTER TABLE empresas
ADD COLUMN camara_comercio VARCHAR(100) NULL COMMENT 'Cámara de comercio de registro'
AFTER matricula_mercantil;

ALTER TABLE empresas
ADD COLUMN fecha_matricula DATE NULL COMMENT 'Fecha de constitución'
AFTER camara_comercio;

ALTER TABLE empresas
ADD COLUMN actividad_economica TEXT NULL COMMENT 'Código CIIU y descripción'
AFTER fecha_matricula;

-- ============================================
-- PASO 2: Migrar datos existentes
-- ============================================

-- Extraer dígito de verificación de NITs existentes
-- Formato actual: "900123456-1" → NIT: "900123456", DV: "1"
UPDATE empresas
SET digito_verificacion = SUBSTRING_INDEX(nit, '-', -1),
    nit = SUBSTRING_INDEX(nit, '-', 1)
WHERE nit LIKE '%-%' AND nit IS NOT NULL;

-- ============================================
-- PASO 3: Crear índices para optimización
-- ============================================

-- Índice compuesto NIT + DV para búsquedas rápidas
CREATE INDEX idx_nit_dv ON empresas(nit, digito_verificacion);

-- Índice para tipo de sociedad (reportes)
CREATE INDEX idx_tipo_sociedad ON empresas(tipo_sociedad);

-- ============================================
-- PASO 4: Actualizar campos con valores por defecto
-- ============================================

-- Establecer tipo de documento = NIT para registros existentes
UPDATE empresas
SET tipo_documento = 'NIT'
WHERE tipo_documento IS NULL AND nit IS NOT NULL;

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Mostrar estructura actualizada
SELECT 
    'Verificación de campos agregados' AS descripcion,
    COUNT(*) AS total_empresas
FROM empresas;

-- Mostrar empresas con NIT y DV separados
SELECT 
    id,
    nombre,
    tipo_documento,
    nit,
    digito_verificacion,
    CONCAT(nit, '-', digito_verificacion) AS nit_completo
FROM empresas
WHERE nit IS NOT NULL
LIMIT 5;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

/*
CAMPOS AGREGADOS:
1. tipo_documento VARCHAR(20) - Tipo de identificación (NIT, CC, CE, PASAPORTE)
2. digito_verificacion CHAR(1) - DV calculado según algoritmo DIAN
3. representante_legal VARCHAR(255) - Nombre del representante legal
4. tipo_sociedad VARCHAR(50) - SAS, LTDA, SA, EU, Cooperativa, etc.
5. matricula_mercantil VARCHAR(100) - Número de matrícula mercantil
6. camara_comercio VARCHAR(100) - Cámara de comercio (Bogotá, Medellín, etc.)
7. fecha_matricula DATE - Fecha de constitución de la empresa
8. actividad_economica TEXT - Código CIIU y descripción de actividad

MIGRACIÓN DE DATOS:
- Los NITs existentes formato "900123456-1" se separan en:
  * nit: "900123456"
  * digito_verificacion: "1"
- Se mantiene compatibilidad backward con frontend

COMPATIBILIDAD FRONTEND:
- El frontend ya está preparado para enviar:
  * tipo_documento
  * nit (sin DV)
  * digito_verificacion (separado)
  * Todos los campos RUES

PRÓXIMOS PASOS:
1. Ejecutar esta migración en RDS
2. Actualizar backend TypeScript (DTO empresas)
3. Testing completo crear/editar empresa
4. Validar que NITs se guardan correctamente separados
*/

-- ============================================
-- ROLLBACK (solo en caso de emergencia)
-- ============================================

/*
-- ⚠️ CUIDADO: Solo ejecutar si algo sale mal
-- Esto eliminará los campos agregados

ALTER TABLE empresas DROP COLUMN tipo_documento;
ALTER TABLE empresas DROP COLUMN digito_verificacion;
ALTER TABLE empresas DROP COLUMN representante_legal;
ALTER TABLE empresas DROP COLUMN tipo_sociedad;
ALTER TABLE empresas DROP COLUMN matricula_mercantil;
ALTER TABLE empresas DROP COLUMN camara_comercio;
ALTER TABLE empresas DROP COLUMN fecha_matricula;
ALTER TABLE empresas DROP COLUMN actividad_economica;

DROP INDEX idx_nit_dv ON empresas;
DROP INDEX idx_tipo_sociedad ON empresas;

-- Restaurar NITs al formato original con DV
UPDATE empresas
SET nit = CONCAT(nit, '-', digito_verificacion)
WHERE digito_verificacion IS NOT NULL;
*/
