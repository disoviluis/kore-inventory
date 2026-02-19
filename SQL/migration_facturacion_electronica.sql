-- ============================================
-- MIGRACIÓN: FACTURACIÓN ELECTRÓNICA
-- Fecha: 2026-02-19
-- Descripción: Agregar campos para facturación profesional
--              y configuración de diseño de facturas
-- ============================================

USE kore_inventory;

-- ============================================
-- 1. TABLA EMPRESAS - Agregar campos de facturación
-- ============================================

-- Logo y branding
ALTER TABLE empresas 
ADD COLUMN logo_url VARCHAR(500) NULL COMMENT 'URL del logo de la empresa' AFTER telefono;

ALTER TABLE empresas 
ADD COLUMN slogan VARCHAR(200) NULL COMMENT 'Eslogan de la empresa' AFTER logo_url;

ALTER TABLE empresas 
ADD COLUMN sitio_web VARCHAR(200) NULL COMMENT 'Sitio web de la empresa' AFTER slogan;

ALTER TABLE empresas 
ADD COLUMN ciudad VARCHAR(100) NULL COMMENT 'Ciudad de la empresa' AFTER direccion;

-- Información tributaria
ALTER TABLE empresas 
ADD COLUMN regimen_fiscal ENUM('comun', 'simplificado') DEFAULT 'comun' COMMENT 'Régimen fiscal' AFTER nit;

ALTER TABLE empresas 
ADD COLUMN gran_contribuyente BOOLEAN DEFAULT FALSE COMMENT 'Es gran contribuyente' AFTER regimen_fiscal;

ALTER TABLE empresas 
ADD COLUMN autoretenedor BOOLEAN DEFAULT FALSE COMMENT 'Es autoretenedor' AFTER gran_contribuyente;

-- Resolución DIAN
ALTER TABLE empresas 
ADD COLUMN resolucion_dian VARCHAR(50) NULL COMMENT 'Número de resolución DIAN' AFTER autoretenedor;

ALTER TABLE empresas 
ADD COLUMN fecha_resolucion_desde DATE NULL COMMENT 'Fecha inicio vigencia resolución' AFTER resolucion_dian;

ALTER TABLE empresas 
ADD COLUMN fecha_resolucion_hasta DATE NULL COMMENT 'Fecha fin vigencia resolución' AFTER fecha_resolucion_desde;

-- Numeración de facturas
ALTER TABLE empresas 
ADD COLUMN prefijo_factura VARCHAR(10) DEFAULT 'FAC' COMMENT 'Prefijo para número de factura' AFTER fecha_resolucion_hasta;

ALTER TABLE empresas 
ADD COLUMN rango_factura_desde INT NULL COMMENT 'Número inicial del rango autorizado' AFTER prefijo_factura;

ALTER TABLE empresas 
ADD COLUMN rango_factura_hasta INT NULL COMMENT 'Número final del rango autorizado' AFTER rango_factura_desde;

ALTER TABLE empresas 
ADD COLUMN contador_factura_actual INT DEFAULT 1 COMMENT 'Contador actual de facturas' AFTER rango_factura_hasta;

-- ============================================
-- 2. TABLA CLIENTES - Agregar campos para facturación
-- ============================================

-- Información completa del cliente
ALTER TABLE clientes 
ADD COLUMN razon_social VARCHAR(200) NULL COMMENT 'Razón social (para empresas)' AFTER nombre;

ALTER TABLE clientes 
ADD COLUMN tipo_documento ENUM('CC', 'NIT', 'CE', 'PP', 'TI') DEFAULT 'CC' COMMENT 'Tipo de documento' AFTER documento;

ALTER TABLE clientes 
ADD COLUMN digito_verificacion CHAR(1) NULL COMMENT 'Dígito de verificación (para NIT)' AFTER documento;

ALTER TABLE clientes 
ADD COLUMN ciudad VARCHAR(100) NULL COMMENT 'Ciudad del cliente' AFTER direccion;

ALTER TABLE clientes 
ADD COLUMN departamento VARCHAR(100) NULL COMMENT 'Departamento del cliente' AFTER ciudad;

ALTER TABLE clientes 
ADD COLUMN responsabilidad_tributaria VARCHAR(100) NULL COMMENT 'Responsabilidad tributaria (IVA, No responsable, etc)' AFTER departamento;

-- Datos de contacto
ALTER TABLE clientes 
ADD COLUMN contacto_nombre VARCHAR(100) NULL COMMENT 'Nombre del contacto principal' AFTER email;

ALTER TABLE clientes 
ADD COLUMN contacto_cargo VARCHAR(100) NULL COMMENT 'Cargo del contacto' AFTER contacto_nombre;

-- ============================================
-- 3. TABLA VENTAS - Agregar campos de facturación
-- ============================================

ALTER TABLE ventas 
ADD COLUMN fecha_vencimiento DATE NULL COMMENT 'Fecha de vencimiento del pago' AFTER fecha_venta;

ALTER TABLE ventas 
ADD COLUMN vendedor_id INT NULL COMMENT 'ID del usuario vendedor' AFTER usuario_id;

ALTER TABLE ventas 
ADD COLUMN forma_pago ENUM('contado', 'credito') DEFAULT 'contado' COMMENT 'Forma de pago' AFTER fecha_vencimiento;

ALTER TABLE ventas 
ADD COLUMN dias_credito INT DEFAULT 0 COMMENT 'Días de crédito otorgados' AFTER forma_pago;

ALTER TABLE ventas 
ADD COLUMN observaciones TEXT NULL COMMENT 'Observaciones de la venta' AFTER dias_credito;

ALTER TABLE ventas 
ADD COLUMN cufe VARCHAR(100) NULL COMMENT 'Código Único de Factura Electrónica' AFTER observaciones;

-- Foreign key para vendedor
ALTER TABLE ventas 
ADD CONSTRAINT fk_ventas_vendedor 
FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ============================================
-- 4. TABLA PRODUCTOS - Agregar unidad de medida
-- ============================================

ALTER TABLE productos 
ADD COLUMN unidad_medida VARCHAR(10) DEFAULT 'UND' COMMENT 'Unidad de medida (UND, KG, M, L, etc)' AFTER nombre;

-- ============================================
-- 5. TABLA VENTA_DETALLE - Agregar campos adicionales
-- ============================================

ALTER TABLE venta_detalle 
ADD COLUMN unidad_medida VARCHAR(10) DEFAULT 'UND' COMMENT 'Unidad de medida del producto' AFTER cantidad;

ALTER TABLE venta_detalle 
ADD COLUMN descuento_porcentaje DECIMAL(5,2) DEFAULT 0 COMMENT 'Porcentaje de descuento aplicado' AFTER precio_unitario;

ALTER TABLE venta_detalle 
ADD COLUMN descripcion_adicional TEXT NULL COMMENT 'Descripción adicional del producto' AFTER descuento_porcentaje;

-- ============================================
-- 6. NUEVA TABLA: configuracion_factura
-- ============================================

CREATE TABLE IF NOT EXISTS configuracion_factura (
    id INT PRIMARY KEY AUTO_INCREMENT,
    empresa_id INT NOT NULL,
    
    -- Diseño y visualización
    mostrar_logo BOOLEAN DEFAULT TRUE COMMENT 'Mostrar logo en factura',
    logo_posicion ENUM('izquierda', 'centro', 'derecha') DEFAULT 'izquierda' COMMENT 'Posición del logo',
    mostrar_slogan BOOLEAN DEFAULT TRUE COMMENT 'Mostrar eslogan',
    
    -- Colores y fuente
    color_primario VARCHAR(7) DEFAULT '#007bff' COMMENT 'Color primario (hexadecimal)',
    color_secundario VARCHAR(7) DEFAULT '#6c757d' COMMENT 'Color secundario',
    fuente VARCHAR(50) DEFAULT 'Arial' COMMENT 'Fuente del documento',
    tamano_fuente INT DEFAULT 10 COMMENT 'Tamaño de fuente en puntos',
    
    -- Textos personalizados
    pie_pagina TEXT NULL COMMENT 'Texto del pie de página',
    terminos_condiciones TEXT NULL COMMENT 'Términos y condiciones',
    notas_predeterminadas TEXT NULL COMMENT 'Notas que aparecen por defecto',
    mensaje_agradecimiento VARCHAR(500) DEFAULT 'Gracias por su compra' COMMENT 'Mensaje de agradecimiento',
    
    -- Información adicional
    mostrar_qr BOOLEAN DEFAULT TRUE COMMENT 'Mostrar código QR',
    mostrar_cufe BOOLEAN DEFAULT TRUE COMMENT 'Mostrar CUFE',
    mostrar_firma BOOLEAN DEFAULT FALSE COMMENT 'Mostrar línea de firma',
    texto_firma VARCHAR(200) NULL COMMENT 'Texto para la firma',
    
    -- Cuentas bancarias (JSON)
    cuentas_bancarias JSON NULL COMMENT 'Array de cuentas bancarias [{banco, tipo, numero}]',
    
    -- Metadatos
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    UNIQUE KEY unique_empresa (empresa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración de diseño y personalización de facturas';

-- Insertar configuración por defecto para empresas existentes
INSERT INTO configuracion_factura (empresa_id, mensaje_agradecimiento)
SELECT id, 'Gracias por su compra' FROM empresas
ON DUPLICATE KEY UPDATE empresa_id = empresa_id;

-- ============================================
-- 7. NUEVA TABLA: retenciones
-- ============================================

CREATE TABLE IF NOT EXISTS retenciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    empresa_id INT NOT NULL,
    codigo VARCHAR(20) NOT NULL COMMENT 'Código de la retención',
    nombre VARCHAR(100) NOT NULL COMMENT 'Nombre de la retención',
    tipo ENUM('reteiva', 'retefuente', 'reteica') NOT NULL COMMENT 'Tipo de retención',
    porcentaje DECIMAL(5,2) NOT NULL COMMENT 'Porcentaje de retención',
    base_minima DECIMAL(15,2) DEFAULT 0 COMMENT 'Base mínima para aplicar retención',
    activo BOOLEAN DEFAULT TRUE COMMENT 'Retención activa',
    descripcion TEXT NULL COMMENT 'Descripción de la retención',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    INDEX idx_empresa_tipo (empresa_id, tipo),
    UNIQUE KEY unique_codigo_empresa (empresa_id, codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Retenciones fiscales (ReteIVA, ReteFuente, ReteICA)';

-- Insertar retenciones comunes por defecto
INSERT INTO retenciones (empresa_id, codigo, nombre, tipo, porcentaje, base_minima) 
SELECT 
    id,
    'RETEIVA',
    'Retención IVA',
    'reteiva',
    15.00,
    0
FROM empresas
UNION ALL
SELECT 
    id,
    'RETEFUENTE',
    'Retención en la Fuente',
    'retefuente',
    2.50,
    0
FROM empresas;

-- ============================================
-- 8. ÍNDICES ADICIONALES PARA MEJOR RENDIMIENTO
-- ============================================

-- Índice para búsqueda de facturas por número
CREATE INDEX idx_ventas_numero_factura ON ventas(numero_factura);

-- Índice para búsqueda de clientes por documento
CREATE INDEX idx_clientes_documento ON clientes(documento);

-- Índice para búsqueda de clientes por tipo documento
CREATE INDEX idx_clientes_tipo_doc ON clientes(tipo_documento);

-- ============================================
-- 9. VERIFICACIÓN DE DATOS
-- ============================================

-- Actualizar contador de facturas según última factura existente
UPDATE empresas e
SET contador_factura_actual = (
    SELECT COALESCE(MAX(CAST(SUBSTRING(numero_factura, LENGTH(prefijo_factura) + 2) AS UNSIGNED)), 0) + 1
    FROM ventas v
    WHERE v.empresa_id = e.id
);

-- Actualizar unidad de medida en productos existentes
UPDATE productos SET unidad_medida = 'UND' WHERE unidad_medida IS NULL;

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================

-- Mostrar resumen
SELECT 
    'Migración completada exitosamente' AS mensaje,
    COUNT(*) AS empresas_actualizadas
FROM empresas;

SELECT 
    'Configuraciones de factura creadas' AS mensaje,
    COUNT(*) AS total
FROM configuracion_factura;

SELECT 
    'Retenciones predeterminadas creadas' AS mensaje,
    COUNT(*) AS total
FROM retenciones;
