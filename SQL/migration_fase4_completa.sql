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

-- Sitio web
ALTER TABLE empresas ADD COLUMN sitio_web VARCHAR(200) NULL;

-- Descripción
ALTER TABLE empresas ADD COLUMN descripcion TEXT NULL;

-- Slogan
ALTER TABLE empresas ADD COLUMN slogan VARCHAR(200) NULL;

-- Gran contribuyente
ALTER TABLE empresas ADD COLUMN gran_contribuyente BOOLEAN DEFAULT FALSE;

-- Autoretenedor
ALTER TABLE empresas ADD COLUMN autoretenedor BOOLEAN DEFAULT FALSE;

-- Agente retenedor IVA
ALTER TABLE empresas ADD COLUMN agente_retenedor_iva BOOLEAN DEFAULT FALSE;

-- Agente retenedor ICA
ALTER TABLE empresas ADD COLUMN agente_retenedor_ica BOOLEAN DEFAULT FALSE;

-- Resolución DIAN
ALTER TABLE empresas ADD COLUMN resolucion_dian VARCHAR(50) NULL;

-- Fecha resolución desde
ALTER TABLE empresas ADD COLUMN fecha_resolucion_desde DATE NULL;

-- Fecha resolución hasta
ALTER TABLE empresas ADD COLUMN fecha_resolucion_hasta DATE NULL;

-- Prefijo factura
ALTER TABLE empresas ADD COLUMN prefijo_factura VARCHAR(10) DEFAULT 'FAC';

-- Rango factura desde
ALTER TABLE empresas ADD COLUMN rango_factura_desde INT NULL;

-- Rango factura hasta
ALTER TABLE empresas ADD COLUMN rango_factura_hasta INT NULL;

-- Numeración actual
ALTER TABLE empresas ADD COLUMN numeracion_actual INT DEFAULT 1;

-- Software ID
ALTER TABLE empresas ADD COLUMN software_id VARCHAR(50) NULL;

-- PIN Software
ALTER TABLE empresas ADD COLUMN pin_software VARCHAR(20) NULL;

-- Ambiente
ALTER TABLE empresas ADD COLUMN ambiente ENUM('pruebas', 'produccion') DEFAULT 'pruebas';

-- ============================================================================
-- 2. CLIENTES - 10 CAMPOS NUEVOS
-- ============================================================================

ALTER TABLE clientes ADD COLUMN razon_social VARCHAR(200) NULL;
ALTER TABLE clientes ADD COLUMN tipo_documento ENUM('cedula', 'nit', 'pasaporte', 'cedula_extranjeria', 'rut') DEFAULT 'cedula';
ALTER TABLE clientes ADD COLUMN digito_verificacion CHAR(1) NULL;
ALTER TABLE clientes ADD COLUMN tipo_persona ENUM('natural', 'juridica') DEFAULT 'natural';
ALTER TABLE clientes ADD COLUMN regimen_tributario ENUM('simplificado', 'común', 'especial') DEFAULT 'simplificado';
ALTER TABLE clientes ADD COLUMN responsabilidad_fiscal VARCHAR(200) NULL;
ALTER TABLE clientes ADD COLUMN actividad_economica VARCHAR(200) NULL;
ALTER TABLE clientes ADD COLUMN departamento VARCHAR(100) NULL;
ALTER TABLE clientes ADD COLUMN codigo_postal VARCHAR(10) NULL;
ALTER TABLE clientes ADD COLUMN celular VARCHAR(20) NULL;

-- ============================================================================
-- 3. PRODUCTOS - 4 CAMPOS NUEVOS
-- ============================================================================

ALTER TABLE productos ADD COLUMN unidad_medida VARCHAR(10) DEFAULT 'UND';
ALTER TABLE productos ADD COLUMN codigo_unspsc VARCHAR(20) NULL;
ALTER TABLE productos ADD COLUMN marca VARCHAR(100) NULL;
ALTER TABLE productos ADD COLUMN modelo VARCHAR(100) NULL;

-- ============================================================================
-- 4. VENTAS - 14 CAMPOS NUEVOS
-- ============================================================================

ALTER TABLE ventas ADD COLUMN fecha_vencimiento DATE NULL;
ALTER TABLE ventas ADD COLUMN forma_pago ENUM('contado', 'credito') DEFAULT 'contado';
ALTER TABLE ventas ADD COLUMN metodo_pago ENUM('efectivo', 'tarjeta_credito', 'tarjeta_debito', 'transferencia', 'cheque', 'otro') DEFAULT 'efectivo';
ALTER TABLE ventas ADD COLUMN observaciones TEXT NULL;
ALTER TABLE ventas ADD COLUMN descuento_global DECIMAL(10,2) DEFAULT 0;
ALTER TABLE ventas ADD COLUMN descuento_porcentaje DECIMAL(5,2) DEFAULT 0;
ALTER TABLE ventas ADD COLUMN retencion_iva DECIMAL(10,2) DEFAULT 0;
ALTER TABLE ventas ADD COLUMN retencion_fuente DECIMAL(10,2) DEFAULT 0;
ALTER TABLE ventas ADD COLUMN retencion_ica DECIMAL(10,2) DEFAULT 0;
ALTER TABLE ventas ADD COLUMN numero_factura VARCHAR(50) NULL;
ALTER TABLE ventas ADD COLUMN cufe VARCHAR(256) NULL;
ALTER TABLE ventas ADD COLUMN qr_code TEXT NULL;
ALTER TABLE ventas ADD COLUMN estado_dian ENUM('pendiente', 'enviado', 'aceptado', 'rechazado') DEFAULT 'pendiente';
ALTER TABLE ventas ADD COLUMN xml_factura LONGTEXT NULL;
ALTER TABLE ventas ADD COLUMN pdf_factura VARCHAR(500) NULL;

-- ============================================================================
-- 5. VENTA_DETALLE - 6 CAMPOS NUEVOS
-- ============================================================================

ALTER TABLE venta_detalle ADD COLUMN unidad_medida VARCHAR(10) DEFAULT 'UND';
ALTER TABLE venta_detalle ADD COLUMN descuento_porcentaje DECIMAL(5,2) DEFAULT 0;
ALTER TABLE venta_detalle ADD COLUMN descuento_valor DECIMAL(10,2) DEFAULT 0;
ALTER TABLE venta_detalle ADD COLUMN impuesto_porcentaje DECIMAL(5,2) DEFAULT 19;
ALTER TABLE venta_detalle ADD COLUMN impuesto_valor DECIMAL(10,2) DEFAULT 0;
ALTER TABLE venta_detalle ADD COLUMN descripcion_adicional TEXT NULL;

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
