# 🎯 ANÁLISIS DE BRECHAS: KORE vs SIIGO

**Objetivo:** Identificar qué funcionalidades faltan en KORE Inventory para estar al nivel profesional de SIIGO en facturación.

**Fecha:** 2026-02-19

---

## ✅ LO QUE YA TENEMOS

### Base de Datos
- ✅ Tabla `empresas` con datos básicos
- ✅ Tabla `clientes` con información comercial
- ✅ Tabla `productos` con inventario
- ✅ Tabla `ventas` y `venta_detalle` para facturación
- ✅ Tabla `impuestos` para IVA
- ✅ Tabla `configuracion_factura` (38 campos de personalización)

### Backend
- ✅ API CRUD de empresas
- ✅ API CRUD de clientes
- ✅ API CRUD de productos
- ✅ API de ventas con cálculos
- ✅ API de configuración de facturación
- ✅ Autenticación JWT
- ✅ Multi-tenancy (empresa_id)

### Frontend
- ✅ Dashboard con métricas
- ✅ Gestión de clientes
- ✅ Gestión de productos
- ✅ Punto de venta (POS)
- ✅ Historial de ventas
- ✅ Configuración de empresa
- ✅ Configuración visual de facturas

---

## ❌ LO QUE NOS FALTA (Gap Analysis)

### 🟥 CRÍTICO - Nivel 1 (Sin esto no hay factura profesional)

#### 1. **CAMPOS DE EMPRESA FALTANTES**
```sql
-- EVEREST SA necesita estos campos:
ALTER TABLE empresas ADD COLUMN sitio_web VARCHAR(200) NULL;
ALTER TABLE empresas ADD COLUMN descripcion TEXT NULL;
ALTER TABLE empresas ADD COLUMN slogan VARCHAR(200) NULL;
ALTER TABLE empresas ADD COLUMN regimen_fiscal ENUM('simplificado', 'común', 'especial') DEFAULT 'simplificado';
ALTER TABLE empresas ADD COLUMN gran_contribuyente BOOLEAN DEFAULT FALSE;
ALTER TABLE empresas ADD COLUMN autoretenedor BOOLEAN DEFAULT FALSE;
ALTER TABLE empresas ADD COLUMN agente_retenedor_iva BOOLEAN DEFAULT FALSE;
ALTER TABLE empresas ADD COLUMN agente_retenedor_ica BOOLEAN DEFAULT FALSE;

-- RESOLUCIÓN DIAN (Facturación Electrónica)
ALTER TABLE empresas ADD COLUMN resolucion_dian VARCHAR(50) NULL;
ALTER TABLE empresas ADD COLUMN fecha_resolucion_desde DATE NULL;
ALTER TABLE empresas ADD COLUMN fecha_resolucion_hasta DATE NULL;
ALTER TABLE empresas ADD COLUMN prefijo_factura VARCHAR(10) DEFAULT 'FAC';
ALTER TABLE empresas ADD COLUMN rango_factura_desde INT NULL;
ALTER TABLE empresas ADD COLUMN rango_factura_hasta INT NULL;
ALTER TABLE empresas ADD COLUMN numeracion_actual INT DEFAULT 1;
ALTER TABLE empresas ADD COLUMN software_id VARCHAR(50) NULL COMMENT 'ID Software DIAN';
ALTER TABLE empresas ADD COLUMN pin_software VARCHAR(20) NULL COMMENT 'PIN Software DIAN';
ALTER TABLE empresas ADD COLUMN ambiente ENUM('pruebas', 'produccion') DEFAULT 'pruebas';
```

**Impacto:** Sin estos campos, la factura no cumple con normas DIAN.

---

#### 2. **CAMPOS DE CLIENTE FALTANTES**
```sql
-- Información fiscal completa
ALTER TABLE clientes ADD COLUMN razon_social VARCHAR(200) NULL;
ALTER TABLE clientes ADD COLUMN tipo_documento ENUM('cedula', 'nit', 'pasaporte', 'cedula_extranjeria', 'rut') DEFAULT 'cedula';
ALTER TABLE clientes ADD COLUMN digito_verificacion CHAR(1) NULL;
ALTER TABLE clientes ADD COLUMN tipo_persona ENUM('natural', 'juridica') DEFAULT 'natural';
ALTER TABLE clientes ADD COLUMN regimen_tributario ENUM('simplificado', 'común', 'especial') DEFAULT 'simplificado';
ALTER TABLE clientes ADD COLUMN responsabilidad_fiscal VARCHAR(200) NULL COMMENT 'Ej: Gran Contribuyente, IVA, etc';
ALTER TABLE clientes ADD COLUMN actividad_economica VARCHAR(200) NULL COMMENT 'Código CIIU';

-- Ubicación detallada
ALTER TABLE clientes ADD COLUMN departamento VARCHAR(100) NULL;
ALTER TABLE clientes ADD COLUMN codigo_postal VARCHAR(10) NULL;

-- Contacto comercial
ALTER TABLE clientes ADD COLUMN contacto_nombre VARCHAR(100) NULL;
ALTER TABLE clientes ADD COLUMN contacto_cargo VARCHAR(100) NULL;
ALTER TABLE clientes ADD COLUMN celular VARCHAR(20) NULL;

-- Condiciones comerciales (ya existen dias_credito y limite_credito)
ALTER TABLE clientes ADD COLUMN descuento_habitual DECIMAL(5,2) DEFAULT 0 COMMENT 'Porcentaje';
```

**Impacto:** Sin tipo_documento y digito_verificacion no se puede generar CUFE válido.

---

#### 3. **CAMPOS DE PRODUCTO FALTANTES**
```sql
-- Para factura electrónica DIAN
ALTER TABLE productos ADD COLUMN unidad_medida VARCHAR(10) DEFAULT 'UND';
ALTER TABLE productos ADD COLUMN codigo_unspsc VARCHAR(20) NULL COMMENT 'Clasificador de productos DIAN';
ALTER TABLE productos ADD COLUMN marca VARCHAR(100) NULL;
ALTER TABLE productos ADD COLUMN modelo VARCHAR(100) NULL;
```

**Impacto:** unidad_medida es obligatoria en factura electrónica.

---

#### 4. **CAMPOS DE VENTA FALTANTES**
```sql
-- Información comercial
ALTER TABLE ventas ADD COLUMN fecha_vencimiento DATE NULL COMMENT 'Para créditos';
ALTER TABLE ventas ADD COLUMN forma_pago ENUM('contado', 'credito') DEFAULT 'contado';
ALTER TABLE ventas ADD COLUMN metodo_pago ENUM('efectivo', 'tarjeta_credito', 'tarjeta_debito', 'transferencia', 'cheque', 'otro') DEFAULT 'efectivo';
ALTER TABLE ventas ADD COLUMN observaciones TEXT NULL;

-- Cálculos y retenciones
ALTER TABLE ventas ADD COLUMN descuento_global DECIMAL(10,2) DEFAULT 0;
ALTER TABLE ventas ADD COLUMN descuento_porcentaje DECIMAL(5,2) DEFAULT 0;
ALTER TABLE ventas ADD COLUMN retencion_iva DECIMAL(10,2) DEFAULT 0;
ALTER TABLE ventas ADD COLUMN retencion_fuente DECIMAL(10,2) DEFAULT 0;
ALTER TABLE ventas ADD COLUMN retencion_ica DECIMAL(10,2) DEFAULT 0;

-- Facturación electrónica
ALTER TABLE ventas ADD COLUMN numero_factura VARCHAR(50) NULL COMMENT 'FAC-000156';
ALTER TABLE ventas ADD COLUMN cufe VARCHAR(256) NULL COMMENT 'Código Único Factura Electrónica';
ALTER TABLE ventas ADD COLUMN qr_code TEXT NULL COMMENT 'Base64 del QR para validación';
ALTER TABLE ventas ADD COLUMN estado_dian ENUM('pendiente', 'enviado', 'aceptado', 'rechazado') DEFAULT 'pendiente';
ALTER TABLE ventas ADD COLUMN xml_factura LONGTEXT NULL COMMENT 'XML firmado enviado a DIAN';
ALTER TABLE ventas ADD COLUMN pdf_factura VARCHAR(500) NULL COMMENT 'URL del PDF generado';
```

**Impacto:** Sin numero_factura y cufe no hay factura electrónica válida.

---

#### 5. **CAMPOS DE VENTA_DETALLE FALTANTES**
```sql
-- Detalle del producto
ALTER TABLE venta_detalle ADD COLUMN unidad_medida VARCHAR(10) DEFAULT 'UND';
ALTER TABLE venta_detalle ADD COLUMN descuento_porcentaje DECIMAL(5,2) DEFAULT 0;
ALTER TABLE venta_detalle ADD COLUMN descuento_valor DECIMAL(10,2) DEFAULT 0;
ALTER TABLE venta_detalle ADD COLUMN impuesto_porcentaje DECIMAL(5,2) DEFAULT 19;
ALTER TABLE venta_detalle ADD COLUMN impuesto_valor DECIMAL(10,2) DEFAULT 0;
ALTER TABLE venta_detalle ADD COLUMN descripcion_adicional TEXT NULL COMMENT 'Detalles extras del producto';
```

**Impacto:** Para calcular correctamente base gravable y aplicar descuentos por ítem.

---

#### 6. **TABLA RETENCIONES (NO EXISTE)**
```sql
CREATE TABLE retenciones (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  codigo VARCHAR(20) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  tipo ENUM('reteiva', 'retefuente', 'reteica') NOT NULL,
  porcentaje DECIMAL(5,2) NOT NULL,
  base_minima DECIMAL(15,2) DEFAULT 0 COMMENT 'Base mínima para aplicar',
  aplica_automaticamente BOOLEAN DEFAULT FALSE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  INDEX idx_empresa (empresa_id),
  INDEX idx_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Retenciones fiscales configurables';

-- Datos iniciales Colombia
INSERT INTO retenciones (empresa_id, codigo, nombre, tipo, porcentaje, base_minima, aplica_automaticamente) VALUES
(1, 'RETEIVA15', 'Retención IVA 15%', 'reteiva', 15.00, 0, FALSE),
(1, 'RETEFUENTE25', 'Retención en la Fuente 2.5%', 'retefuente', 2.50, 100000, FALSE),
(1, 'RETEICA10', 'Retención ICA 1%', 'reteica', 1.00, 0, FALSE);
```

**Impacto:** Las retenciones son obligatorias en ventas a grandes contribuyentes.

---

### 🟧 IMPORTANTE - Nivel 2 (Mejoraría mucho la experiencia)

#### 7. **CONSECUTIVO AUTOMÁTICO DE FACTURAS**
- Backend debe generar número automáticamente: `FAC-000156`
- Validar que no exceda el rango autorizado por DIAN
- Actualizar contador en tabla empresas

#### 8. **GENERACIÓN DE CUFE**
```typescript
// Algoritmo CUFE Colombia
const generarCUFE = (venta, empresa) => {
  const datos = [
    venta.numero_factura,
    venta.fecha,
    venta.hora,
    venta.subtotal,
    '01', // Código impuesto IVA
    venta.impuesto,
    '02', // Código impuesto consumo
    '0.00',
    '03', // Código retenciones
    venta.retenciones,
    venta.total,
    empresa.nit,
    venta.cliente.documento,
    empresa.software_id,
    ambiente // 1=producción, 2=pruebas
  ];
  
  const cadena = datos.join('');
  return SHA384(cadena);
};
```

#### 9. **GENERACIÓN DE QR CODE**
```typescript
// QR debe contener:
{
  "NumFac": "FAC-000156",
  "FecFac": "2026-02-19",
  "NitFac": "900456789",
  "DocAdq": "890123456",
  "ValFac": "8794100",
  "ValIva": "1404100",
  "ValOtroIm": "0",
  "ValTotal": "8794100",
  "CUFE": "abc123..."
}
```

#### 10. **CÁLCULO INTELIGENTE DE RETENCIONES**
```typescript
// Ejemplo: Si cliente es gran contribuyente
if (cliente.responsabilidad_fiscal.includes('Gran Contribuyente')) {
  // Aplicar automáticamente retención en la fuente
  const baseRetefte = venta.subtotal;
  venta.retencion_fuente = baseRetefte * 0.025; // 2.5%
}

// Si total supera $4 UVT (aprox $176.000)
if (venta.total > 176000) {
  const baseReteiva = venta.impuesto;
  venta.retencion_iva = baseReteiva * 0.15; // 15% del IVA
}
```

#### 11. **PDF DE FACTURA PROFESIONAL**
Elementos visuales que DEBE tener:
- ✅ Logo de la empresa
- ✅ Datos completos del emisor (con resolución DIAN)
- ✅ Número de factura grande y visible
- ✅ Fechas (emisión y vencimiento)
- ✅ Datos completos del cliente
- ✅ Tabla de productos con columnas: Ítem, Código, Descripción, Cant, Unidad, Precio, Descuento, Subtotal
- ✅ Desglose de totales (Subtotal, Descuentos, Base Gravable, IVA, Retenciones, TOTAL)
- ✅ Valor en letras (SON: OCHO MILLONES...)
- ✅ Cuentas bancarias para pago
- ✅ Observaciones
- ✅ CUFE
- ✅ Código QR para validación DIAN
- ✅ Texto legal ("Esta factura es un título valor...")

#### 12. **CAMPOS EN FORMULARIO DE VENTA**
En `ventas.html` el formulario debe tener:
```html
<!-- Información del Cliente -->
<select id="clienteId" required></select>
<div id="infoCliente">
  <!-- Mostrar: NIT, Régimen, Responsabilidad Fiscal -->
</div>

<!-- Condiciones Comerciales -->
<select id="formaPago">
  <option value="contado">Contado</option>
  <option value="credito">Crédito</option>
</select>

<input type="date" id="fechaVencimiento" disabled>
<!-- Se habilita solo si forma_pago = crédito -->

<select id="metodoPago">
  <option value="efectivo">Efectivo</option>
  <option value="transferencia">Transferencia</option>
  <option value="tarjeta_credito">Tarjeta Crédito</option>
  <option value="tarjeta_debito">Tarjeta Débito</option>
</select>

<!-- Detalle de Productos -->
<table id="detalleVenta">
  <tr>
    <th>Producto</th>
    <th>Cantidad</th>
    <th>Precio Unit.</th>
    <th>Descuento %</th>
    <th>IVA %</th>
    <th>Subtotal</th>
  </tr>
</table>

<!-- Totales -->
<div id="totales">
  <div>Subtotal: <span id="subtotal"></span></div>
  <div>Descuentos: <span id="descuentos"></span></div>
  <div>Base Gravable: <span id="baseGravable"></span></div>
  <div>IVA 19%: <span id="iva"></span></div>
  <div>Retención IVA: <input type="number" id="retencionIva"></div>
  <div>Retención Fuente: <input type="number" id="retencionFuente"></div>
  <div class="fw-bold">TOTAL: <span id="total"></span></div>
</div>

<!-- Observaciones -->
<textarea id="observaciones" placeholder="Notas adicionales..."></textarea>
```

---

### 🟨 DESEABLE - Nivel 3 (Nice to have)

#### 13. **ENVÍO AUTOMÁTICO DE FACTURA POR EMAIL**
- Adjuntar PDF al correo del cliente
- Plantilla HTML profesional
- Tracking de "email abierto"

#### 14. **INTEGRACIÓN CON PASARELAS DE PAGO**
- Botón "Pagar Ahora" en la factura
- Integración con Wompi, PayU, Mercado Pago

#### 15. **RECORDATORIOS DE PAGO**
- Email automático 3 días antes del vencimiento
- Email de factura vencida

#### 16. **MULTI-MONEDA**
- Dólar, Euro, etc.
- Tasa de cambio del día

#### 17. **NOTAS CRÉDITO Y DÉBITO**
- Para anular o corregir facturas
- También generan XML y CUFE

---

## 📊 RESUMEN EJECUTIVO

### Campos Faltantes por Tabla

| Tabla | Campos Actuales | Campos Faltantes | Prioridad |
|-------|----------------|------------------|-----------|
| **empresas** | ~15 | **+17** (fiscal, resolución DIAN) | 🟥 CRÍTICO |
| **clientes** | ~10 | **+10** (fiscal, ubicación) | 🟥 CRÍTICO |
| **productos** | ~12 | **+4** (unidad, clasificación) | 🟥 CRÍTICO |
| **ventas** | ~7 | **+14** (pago, retenciones, DIAN) | 🟥 CRÍTICO |
| **venta_detalle** | ~5 | **+6** (descuentos, impuestos) | 🟥 CRÍTICO |
| **retenciones** | N/A | **Tabla completa** | 🟥 CRÍTICO |

### Funcionalidades Backend Faltantes
- ⚠️ Generación automática de número de factura
- ⚠️ Cálculo de CUFE (SHA-384)
- ⚠️ Generación de QR Code
- ⚠️ Cálculo automático de retenciones
- ⚠️ Validación de rango DIAN
- ⚠️ Endpoint para PDF de factura

### Funcionalidades Frontend Faltantes
- ⚠️ Formulario de venta completo (forma pago, retenciones)
- ⚠️ Vista previa de factura antes de guardar
- ⚠️ Botón "Descargar PDF"
- ⚠️ Botón "Enviar por Email"
- ⚠️ Mostrar CUFE y QR en historial

---

## 🎯 PLAN DE ACCIÓN RECOMENDADO

### FASE 4: Completar Campos Críticos (1-2 días)
1. Migración SQL: Agregar todos los campos faltantes
2. Actualizar backend: Incluir nuevos campos en APIs
3. Actualizar frontend: Formularios con campos completos

### FASE 5: Lógica de Facturación (2-3 días)
1. Consecutivo automático de facturas
2. Cálculo de CUFE
3. Generación de QR Code
4. Cálculo automático de retenciones
5. Endpoint para generar PDF

### FASE 6: PDF Profesional (1-2 días)
1. Plantilla de factura con todos los elementos
2. Aplicar colores y fuentes de configuracion_factura
3. Incluir logo, QR y CUFE

### FASE 7: Mejoras UX (1 día)
1. Vista previa antes de guardar
2. Descarga de PDF
3. Envío por email

---

## 💡 RECOMENDACIÓN FINAL

**Para estar al nivel de SIIGO necesitamos:**
1. ✅ **Base de datos completa** (51 campos nuevos)
2. ✅ **Lógica fiscal correcta** (retenciones, CUFE)
3. ✅ **PDF profesional** (con todos los elementos legales)

**Tiempo estimado total:** 5-7 días de desarrollo

**Prioridad inmediata:** FASE 4 (campos críticos) para poder hacer pruebas reales.
