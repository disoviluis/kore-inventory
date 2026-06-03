-- ============================================
-- CONFIGURACIÓN INICIAL DE FACTURACIÓN
-- ============================================
-- Fecha: 2026-06-03
-- Empresa: CIGARRERIA AC (ID: 28)
-- ============================================

-- Este script configura los datos mínimos requeridos
-- para que la impresión de facturas funcione correctamente

-- 1. CONFIGURACIÓN DE PLANTILLA DE FACTURA
INSERT INTO configuracion_factura (
    empresa_id, 
    plantilla_id,           -- 1 = Clásica
    mostrar_logo,           -- 0 = No mostrar (sin logo configurado)
    logo_posicion,
    mostrar_slogan,         -- 0 = No mostrar (sin slogan)
    color_primario,
    color_secundario,
    fuente,
    tamano_fuente,
    mensaje_agradecimiento,
    mostrar_qr,             -- 0 = No mostrar (sin facturación electrónica)
    mostrar_cufe,           -- 0 = No mostrar (sin CUFE)
    mostrar_badges,         -- 1 = Mostrar badges informativos
    mostrar_firma,          -- 0 = No mostrar firma
    pie_pagina
) VALUES (
    28,
    1,
    0,
    'centro',
    0,
    '#1E40AF',
    '#6c757d',
    'Arial',
    10,
    'Gracias por su compra',
    0,
    0,
    1,
    0,
    'CIGARRERIA AC - CRA 1, Funza - Tel: 318 3906457'
)
ON DUPLICATE KEY UPDATE
    plantilla_id = VALUES(plantilla_id),
    mostrar_logo = VALUES(mostrar_logo),
    color_primario = VALUES(color_primario);

-- 2. ACTUALIZAR DATOS DE LA EMPRESA
UPDATE empresas SET
    digito_verificacion = '8',      -- DV calculado para NIT 1016085506
    razon_social = 'CIGARRERIA AC',
    rango_factura_desde = 1,
    rango_factura_hasta = 99999,
    resolucion_dian = 'Pendiente'   -- Actualizar cuando se tramite
WHERE id = 28;

-- 3. VERIFICACIÓN
SELECT '=== CONFIGURACIÓN APLICADA ===' as resultado;

SELECT 
    'Empresa' as tipo,
    nombre,
    CONCAT(nit, '-', digito_verificacion) as nit_completo,
    telefono,
    direccion
FROM empresas 
WHERE id = 28

UNION ALL

SELECT 
    'Configuración Factura' as tipo,
    CONCAT('Plantilla ID: ', plantilla_id) as nombre,
    CONCAT('Color: ', color_primario) as nit_completo,
    CONCAT('Fuente: ', fuente) as telefono,
    pie_pagina as direccion
FROM configuracion_factura
WHERE empresa_id = 28;

-- ============================================
-- DATOS CONFIGURADOS:
-- ============================================
-- ✅ NIT completo: 1016085506-8
-- ✅ Razón social: CIGARRERIA AC
-- ✅ Rango facturas: 1 a 99,999
-- ✅ Plantilla: Clásica
-- ✅ Color: #1E40AF (azul)
-- ✅ Pie de página configurado
-- ============================================

-- ============================================
-- PENDIENTE (FUTURO):
-- ============================================
-- ⏳ Logo de la empresa (logo_url)
-- ⏳ Slogan (opcional)
-- ⏳ Resolución DIAN real (cuando se tramite)
-- ⏳ Rango de facturación electrónica
-- ⏳ CUFE y QR (facturación electrónica)
-- ============================================
