-- =====================================================
-- DATOS DE PRUEBA - Empresas con campos RUES
-- =====================================================
-- Este script inserta empresas de prueba con los nuevos campos RUES
--
-- Para ejecutar en AWS RDS:
-- ssh -i korekey.pem ubuntu@18.191.181.99
-- mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com -u admin -pKore2026! kore_inventory < SQL/datos_prueba_empresas_rues.sql
-- =====================================================

USE kore_inventory;

-- Limpiar datos previos de prueba (opcional)
-- DELETE FROM empresas WHERE id IN (1, 2, 3, 4, 5);

-- =====================================================
-- EMPRESA 1: Distribuidora Everest S.A.S. (KORE COFFEE)
-- =====================================================
INSERT INTO empresas (
    id,
    nombre,
    razon_social,
    tipo_documento,
    nit,
    digito_verificacion,
    email,
    telefono,
    representante_legal,
    tipo_sociedad,
    matricula_mercantil,
    camara_comercio,
    fecha_matricula,
    actividad_economica,
    direccion,
    ciudad,
    pais,
    plan_id,
    moneda,
    zona_horaria,
    idioma,
    regimen_tributario,
    tipo_contribuyente,
    gran_contribuyente,
    autoretenedor,
    agente_retenedor_iva,
    agente_retenedor_ica,
    estado,
    prefijo_factura,
    numeracion_actual,
    ambiente
) VALUES (
    6, -- Empresa Everest ya existe con ID 6 según logs
    'KORE COFFEE',
    'DISTRIBUIDORA EVEREST S.A.S.',
    'NIT',
    '900123456',
    '1',
    'contacto@distribuidoraeverest.co',
    '+57 310 555 0101',
    'Juan Carlos Rodríguez Pérez',
    'Sociedad por Acciones Simplificada',
    '01-123456-01',
    'Cámara de Comercio de Bogotá',
    '2020-03-15',
    'Comercio al por mayor de café, té, cacao y especias (CIIU 4632)',
    'Calle 100 #15-20, Edificio Centro Empresarial',
    'Bogotá D.C.',
    'Colombia',
    1,
    'COP',
    'America/Bogota',
    'es',
    'comun',
    'persona_juridica',
    0,
    0,
    0,
    0,
    'activa',
    'KORE',
    1,
    'produccion'
) ON DUPLICATE KEY UPDATE
    tipo_documento = VALUES(tipo_documento),
    digito_verificacion = VALUES(digito_verificacion),
    representante_legal = VALUES(representante_legal),
    tipo_sociedad = VALUES(tipo_sociedad),
    matricula_mercantil = VALUES(matricula_mercantil),
    camara_comercio = VALUES(camara_comercio),
    fecha_matricula = VALUES(fecha_matricula),
    actividad_economica = VALUES(actividad_economica);


-- =====================================================
-- EMPRESA 2: TechInnovate Colombia S.A.S.
-- =====================================================
INSERT INTO empresas (
    nombre,
    razon_social,
    tipo_documento,
    nit,
    digito_verificacion,
    email,
    telefono,
    representante_legal,
    tipo_sociedad,
    matricula_mercantil,
    camara_comercio,
    fecha_matricula,
    actividad_economica,
    direccion,
    ciudad,
    pais,
    plan_id,
    moneda,
    zona_horaria,
    idioma,
    regimen_tributario,
    tipo_contribuyente,
    gran_contribuyente,
    autoretenedor,
    estado,
    prefijo_factura,
    numeracion_actual,
    ambiente
) VALUES (
    'TechInnovate Colombia',
    'TECHINNOVATE COLOMBIA S.A.S.',
    'NIT',
    '900234567',
    '8',
    'info@techinnovate.co',
    '+57 320 555 0202',
    'María Fernanda Gómez Silva',
    'Sociedad por Acciones Simplificada',
    '01-234567-02',
    'Cámara de Comercio de Medellín',
    '2021-06-22',
    'Desarrollo de software y consultoría informática (CIIU 6201)',
    'Carrera 43A #1-50, Oficina 401',
    'Medellín',
    'Colombia',
    1,
    'COP',
    'America/Bogota',
    'es',
    'comun',
    'persona_juridica',
    0,
    0,
    'activa',
    'TECH',
    1,
    'produccion'
);


-- =====================================================
-- EMPRESA 3: Comercializadora ABC Ltda.
-- =====================================================
INSERT INTO empresas (
    nombre,
    razon_social,
    tipo_documento,
    nit,
    digito_verificacion,
    email,
    telefono,
    representante_legal,
    tipo_sociedad,
    matricula_mercantil,
    camara_comercio,
    fecha_matricula,
    actividad_economica,
    direccion,
    ciudad,
    pais,
    plan_id,
    moneda,
    zona_horaria,
    idioma,
    regimen_tributario,
    tipo_contribuyente,
    gran_contribuyente,
    autoretenedor,
    agente_retenedor_iva,
    estado,
    prefijo_factura,
    numeracion_actual,
    ambiente
) VALUES (
    'Comercializadora ABC',
    'COMERCIALIZADORA ABC LIMITADA',
    'NIT',
    '800345678',
    '2',
    'ventas@comercializadoraabc.com',
    '+57 315 555 0303',
    'Pedro Antonio Martínez López',
    'Sociedad Limitada',
    '01-345678-03',
    'Cámara de Comercio de Cali',
    '2018-09-10',
    'Comercio al por mayor de productos alimenticios (CIIU 4631)',
    'Avenida 6N #28-50',
    'Cali',
    'Colombia',
    1,
    'COP',
    'America/Bogota',
    'es',
    'comun',
    'persona_juridica',
    1,
    1,
    1,
    'activa',
    'ABC',
    1,
    'produccion'
);


-- =====================================================
-- EMPRESA 4: Consultores XYZ S.A.
-- =====================================================
INSERT INTO empresas (
    nombre,
    razon_social,
    tipo_documento,
    nit,
    digito_verificacion,
    email,
    telefono,
    representante_legal,
    tipo_sociedad,
    matricula_mercantil,
    camara_comercio,
    fecha_matricula,
    actividad_economica,
    direccion,
    ciudad,
    pais,
    plan_id,
    moneda,
    zona_horaria,
    idioma,
    regimen_tributario,
    tipo_contribuyente,
    gran_contribuyente,
    autoretenedor,
    estado,
    prefijo_factura,
    numeracion_actual,
    ambiente
) VALUES (
    'Consultores XYZ',
    'CONSULTORES XYZ SOCIEDAD ANONIMA',
    'NIT',
    '900456789',
    '5',
    'contacto@consultoresxyz.com.co',
    '+57 318 555 0404',
    'Ana María Rodríguez Torres',
    'Sociedad Anónima',
    '01-456789-04',
    'Cámara de Comercio de Barranquilla',
    '2019-11-05',
    'Actividades de consultoría de gestión empresarial (CIIU 7020)',
    'Calle 72 #54-30, Piso 5',
    'Barranquilla',
    'Colombia',
    1,
    'COP',
    'America/Bogota',
    'es',
    'comun',
    'persona_juridica',
    0,
    0,
    'activa',
    'XYZ',
    1,
    'produccion'
);


-- =====================================================
-- EMPRESA 5: Persona Natural - Comerciante Individual
-- =====================================================
INSERT INTO empresas (
    nombre,
    razon_social,
    tipo_documento,
    nit,
    digito_verificacion,
    email,
    telefono,
    representante_legal,
    tipo_sociedad,
    matricula_mercantil,
    camara_comercio,
    fecha_matricula,
    actividad_economica,
    direccion,
    ciudad,
    pais,
    plan_id,
    moneda,
    zona_horaria,
    idioma,
    regimen_tributario,
    tipo_contribuyente,
    estado,
    prefijo_factura,
    numeracion_actual,
    ambiente
) VALUES (
    'Librería El Saber',
    'CARLOS ANDRÉS LÓPEZ GONZÁLEZ',
    'CC',
    '1234567890',
    NULL, -- DV solo para NIT
    'carlos.lopez@libreriasaber.com',
    '+57 312 555 0505',
    'Carlos Andrés López González',
    'Persona Natural',
    '01-567890-05',
    'Cámara de Comercio de Bucaramanga',
    '2022-02-14',
    'Comercio al por menor de libros, periódicos y artículos de papelería (CIIU 4761)',
    'Carrera 27 #34-15',
    'Bucaramanga',
    'Colombia',
    1,
    'COP',
    'America/Bogota',
    'es',
    'simplificado',
    'persona_natural',
    'activa',
    'LIB',
    1,
    'produccion'
);


-- =====================================================
-- VERIFICACIÓN DE DATOS INSERTADOS
-- =====================================================

SELECT 
    '=== EMPRESAS CREADAS EXITOSAMENTE ===' as mensaje;

SELECT 
    id,
    nombre,
    CONCAT(nit, IFNULL(CONCAT('-', digito_verificacion), '')) as nit_completo,
    tipo_documento,
    representante_legal,
    tipo_sociedad,
    ciudad
FROM empresas
ORDER BY id DESC
LIMIT 10;

SELECT 
    '=== ESTADÍSTICAS ===' as mensaje;

SELECT 
    COUNT(*) as total_empresas,
    SUM(CASE WHEN tipo_documento = 'NIT' THEN 1 ELSE 0 END) as empresas_nit,
    SUM(CASE WHEN tipo_documento = 'CC' THEN 1 ELSE 0 END) as empresas_cc,
    SUM(CASE WHEN representante_legal IS NOT NULL THEN 1 ELSE 0 END) as con_representante,
    SUM(CASE WHEN digito_verificacion IS NOT NULL THEN 1 ELSE 0 END) as con_dv
FROM empresas;

-- FIN DEL SCRIPT
