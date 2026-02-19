-- ============================================================================
-- MIGRACIÓN COMPLETA: FACTURACIÓN ELECTRÓNICA PROFESIONAL DIAN
-- Fecha: 2026-02-19
-- Versión: 2.0 - COMPLETA
-- Total: 51 campos + tabla retenciones
-- ============================================================================

USE kore_inventory;

-- ============================================================================
-- 1. EMPRESAS - 17 CAMPOS NUEVOS
-- ============================================================================

ALTER TABLE empresas 
ADD COLUMN IF NOT EXISTS sitio_web VARCHAR(200) NULL,
ADD COLUMN IF NOT EXISTS descripcion TEXT NULL,
ADD COLUMN IF NOT EXISTS slogan VARCHAR(200) NULL,
ADD COLUMN IF NOT EXISTS gran_contribuyente BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS autoretenedor BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS agente_retenedor_iva BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS agente_retenedor_ica BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS resolucion_dian VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS fecha_resolucion_desde DATE NULL,
ADD COLUMN IF NOT EXISTS fecha_resolucion_hasta DATE NULL,
ADD COLUMN IF NOT EXISTS prefijo_factura VARCHAR(10) DEFAULT 'FAC',
ADD COLUMN IF NOT EXISTS rango_factura_desde INT NULL,
ADD COLUMN IF NOT EXISTS rango_factura_hasta INT NULL,
ADD COLUMN IF NOT EXISTS numeracion_actual INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS software_id VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS pin_software VARCHAR(20) NULL,
ADD COLUMN IF NOT EXISTS ambiente ENUM('pruebas', 'produccion') DEFAULT 'pruebas';

-- ============================================================================
-- 2. CLIENTES - 10 CAMPOS NUEVOS
-- ============================================================================

ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS razon_social VARCHAR(200) NULL,
ADD COLUMN IF NOT EXISTS tipo_documento ENUM('cedula', 'nit', 'pasaporte', 'cedula_extranjeria', 'rut') DEFAULT 'cedula',
ADD COLUMN IF NOT EXISTS digito_verificacion CHAR(1) NULL,
ADD COLUMN IF NOT EXISTS tipo_persona ENUM('natural', 'juridica') DEFAULT 'natural',
ADD COLUMN IF NOT EXISTS regimen_tributario ENUM('simplificado', 'común', 'especial') DEFAULT 'simplificado',
ADD COLUMN IF NOT EXISTS responsabilidad_fiscal VARCHAR(200) NULL,
ADD COLUMN IF NOT EXISTS actividad_economica VARCHAR(200) NULL,
ADD COLUMN IF NOT EXISTS departamento VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS codigo_postal VARCHAR(10) NULL,
ADD COLUMN IF NOT EXISTS celular VARCHAR(20) NULL;

-- ============================================================================
-- 3. PRODUCTOS - 4 CAMPOS NUEVOS
-- ============================================================================

ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS unidad_medida VARCHAR(10) DEFAULT 'UND',
ADD COLUMN IF NOT EXISTS codigo_unspsc VARCHAR(20) NULL,
ADD COLUMN IF NOT EXISTS marca VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS modelo VARCHAR(100) NULL;

-- ============================================================================
-- 4. VENTAS - 14 CAMPOS NUEVOS
-- ============================================================================

ALTER TABLE ventas 
ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE NULL,
ADD COLUMN IF NOT EXISTS forma_pago ENUM('contado', 'credito') DEFAULT 'contado',
ADD COLUMN IF NOT EXISTS metodo_pago ENUM('efectivo', 'tarjeta_credito', 'tarjeta_debito', 'transferencia', 'cheque', 'otro') DEFAULT 'efectivo',
ADD COLUMN IF NOT EXISTS observaciones TEXT NULL,
ADD COLUMN IF NOT EXISTS descuento_global DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS retencion_iva DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS retencion_fuente DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS retencion_ica DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS numero_factura VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS cufe VARCHAR(256) NULL,
ADD COLUMN IF NOT EXISTS qr_code TEXT NULL,
ADD COLUMN IF NOT EXISTS estado_dian ENUM('pendiente', 'enviado', 'aceptado', 'rechazado') DEFAULT 'pendiente',
ADD COLUMN IF NOT EXISTS xml_factura LONGTEXT NULL,
ADD COLUMN IF NOT EXISTS pdf_factura VARCHAR(500) NULL;

-- ============================================================================
-- 5. VENTA_DETALLE - 6 CAMPOS NUEVOS
-- ============================================================================

ALTER TABLE venta_detalle 
ADD COLUMN IF NOT EXISTS unidad_medida VARCHAR(10) DEFAULT 'UND',
ADD COLUMN IF NOT EXISTS descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS descuento_valor DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS impuesto_porcentaje DECIMAL(5,2) DEFAULT 19,
ADD COLUMN IF NOT EXISTS impuesto_valor DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS descripcion_adicional TEXT NULL;

-- ============================================================================
-- 6. TABLA RETENCIONES - NUEVA
-- ============================================================================

CREATE TABLE IF NOT EXISTS retenciones (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  codigo VARCHAR(20) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  tipo ENUM('reteiva', 'retefuente', 'reteica') NOT NULL,
  porcentaje DECIMAL(5,2) NOT NULL,
  base_minima DECIMAL(15,2) DEFAULT 0,
  aplica_automaticamente BOOLEAN DEFAULT FALSE,
  activo BOOLEAN DEFAULT TRUE,
  descripcion TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  INDEX idx_retenciones_empresa (empresa_id),
  INDEX idx_retenciones_tipo (tipo),
  UNIQUE KEY uk_empresa_codigo (empresa_id, codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 7. DATOS INICIALES RETENCIONES
-- ============================================================================

INSERT IGNORE INTO retenciones (empresa_id, codigo, nombre, tipo, porcentaje, base_minima, descripcion)
SELECT id, 'RETEIVA15', 'Retención IVA 15%', 'reteiva', 15.00, 0, 'Retención del 15% sobre el IVA' FROM empresas;

INSERT IGNORE INTO retenciones (empresa_id, codigo, nombre, tipo, porcentaje, base_minima, descripcion)
SELECT id, 'RETEFUENTE25', 'Retención Fuente 2.5%', 'retefuente', 2.50, 100000, 'Retención del 2.5% sobre compras >$100.000' FROM empresas;

INSERT IGNORE INTO retenciones (empresa_id, codigo, nombre, tipo, porcentaje, base_minima, descripcion)
SELECT id, 'RETEFUENTE35', 'Retención Fuente 3.5%', 'retefuente', 3.50, 100000, 'Retención del 3.5% para servicios >$100.000' FROM empresas;

INSERT IGNORE INTO retenciones (empresa_id, codigo, nombre, tipo, porcentaje, base_minima, descripcion)
SELECT id, 'RETEICA10', 'Retención ICA 1%', 'reteica', 1.00, 0, 'Retención ICA del 1%' FROM empresas;

-- ============================================================================
-- 8. ACTUALIZAR EVEREST SA CON DATOS COMPLETOS
-- ============================================================================

UPDATE empresas SET 
  nombre = 'EVEREST SA',
  razon_social = 'EVEREST SOCIEDAD ANÓNIMA',
  nit = '900456789-3',
  email = 'ventas@everestsa.com.co',
  telefono = '(601) 742 8900',
  direccion = 'Carrera 7 No. 71-21 Torre B Piso 12',
  ciudad = 'Bogotá D.C.',
  sitio_web = 'https://www.everestsa.com.co',
  descripcion = 'Soluciones empresariales de alta calidad',
  slogan = 'Soluciones que elevan tu negocio',
  regimen_tributario = 'común',
  gran_contribuyente = TRUE,
  autoretenedor = TRUE,
  agente_retenedor_iva = TRUE,
  resolucion_dian = '18764000045892',
  fecha_resolucion_desde = '2024-03-15',
  fecha_resolucion_hasta = '2026-03-15',
  prefijo_factura = 'FAC',
  rango_factura_desde = 1,
  rango_factura_hasta = 100000,
  numeracion_actual = 156,
  ambiente = 'pruebas'
WHERE id = 1;

-- ============================================================================
-- ✅ MIGRACIÓN COMPLETADA
-- ============================================================================
