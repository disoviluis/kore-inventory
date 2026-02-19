# 📄 ANÁLISIS: FACTURA ELECTRÓNICA PROFESIONAL

**Basado en:** SIIGO + Estándares DIAN Colombia  
**Objetivo:** Identificar todos los datos de una factura y dónde parametrizarlos

---

## 🧾 ESTRUCTURA DE UNA FACTURA REAL

### 1️⃣ **ENCABEZADO DE LA FACTURA**

#### A. Información de la Empresa (Emisor)
```
┌─────────────────────────────────────────────────────────┐
│ [LOGO EMPRESA]          EMPRESA XYZ S.A.S.             │
│                         NIT: 900.123.456-7              │
│                         Régimen Común                   │
│                         Gran Contribuyente              │
│                         Autoretenedor                   │
│                         Resolución DIAN 18764000001234  │
│                         Del 2024-01-15 al 2025-01-15    │
│                         Rango: FAC-000001 a FAC-050000  │
│                                                          │
│ Dirección: Calle 123 #45-67, Bogotá D.C.               │
│ Teléfono: (601) 123-4567                                │
│ Email: ventas@empresa.com                               │
│ www.empresa.com                                         │
└─────────────────────────────────────────────────────────┘
```

**¿Dónde parametrizar?**
- ✅ **Módulo:** `empresas` (tabla existente)
- ✅ **Nuevos campos necesarios:**
  ```sql
  ALTER TABLE empresas ADD COLUMN logo_url VARCHAR(500) NULL;
  ALTER TABLE empresas ADD COLUMN regimen_fiscal ENUM('comun', 'simplificado') DEFAULT 'comun';
  ALTER TABLE empresas ADD COLUMN gran_contribuyente BOOLEAN DEFAULT FALSE;
  ALTER TABLE empresas ADD COLUMN autoretenedor BOOLEAN DEFAULT FALSE;
  ALTER TABLE empresas ADD COLUMN resolucion_dian VARCHAR(50) NULL;
  ALTER TABLE empresas ADD COLUMN fecha_resolucion_desde DATE NULL;
  ALTER TABLE empresas ADD COLUMN fecha_resolucion_hasta DATE NULL;
  ALTER TABLE empresas ADD COLUMN prefijo_factura VARCHAR(10) DEFAULT 'FAC';
  ALTER TABLE empresas ADD COLUMN rango_factura_desde INT NULL;
  ALTER TABLE empresas ADD COLUMN rango_factura_hasta INT NULL;
  ALTER TABLE empresas ADD COLUMN contador_factura_actual INT DEFAULT 1;
  ALTER TABLE empresas ADD COLUMN ciudad VARCHAR(100) NULL;
  ALTER TABLE empresas ADD COLUMN sitio_web VARCHAR(200) NULL;
  ALTER TABLE empresas ADD COLUMN slogan VARCHAR(200) NULL;
  ```

---

#### B. Información del Documento
```
┌─────────────────────────────────────────────────────────┐
│            FACTURA DE VENTA ELECTRÓNICA                 │
│                 FAC-000123                               │
│                                                          │
│ Fecha de Emisión: 2026-02-19                            │
│ Fecha de Vencimiento: 2026-03-21 (30 días)             │
│ Vendedor: Juan Pérez                                    │
│ Medio de Pago: Efectivo / Crédito                       │
│ Forma de Pago: Contado / 30 días                        │
└─────────────────────────────────────────────────────────┘
```

**¿Dónde parametrizar?**
- ✅ **Tabla:** `ventas` (ya existe)
- ✅ **Campos nuevos necesarios:**
  ```sql
  ALTER TABLE ventas ADD COLUMN fecha_vencimiento DATE NULL;
  ALTER TABLE ventas ADD COLUMN vendedor_id INT NULL;
  ALTER TABLE ventas ADD COLUMN forma_pago ENUM('contado', 'credito') DEFAULT 'contado';
  ALTER TABLE ventas ADD COLUMN dias_credito INT DEFAULT 0;
  ALTER TABLE ventas ADD COLUMN observaciones TEXT NULL;
  ```

---

#### C. Información del Cliente (Adquiriente)
```
┌─────────────────────────────────────────────────────────┐
│ CLIENTE:                                                 │
│ Nombre/Razón Social: DISTRIBUIDORA ABC LTDA            │
│ NIT/CC: 800.456.789-2                                   │
│ Dirección: Carrera 50 #20-30, Medellín                 │
│ Teléfono: (604) 555-1234                                │
│ Email: compras@distribuidoraabc.com                     │
│ Ciudad: Medellín, Antioquia                             │
│ Responsabilidad Tributaria: IVA                         │
└─────────────────────────────────────────────────────────┘
```

**¿Dónde parametrizar?**
- ✅ **Módulo:** `clientes` (tabla existente)
- ✅ **Campos nuevos necesarios:**
  ```sql
  ALTER TABLE clientes ADD COLUMN razon_social VARCHAR(200) NULL;
  ALTER TABLE clientes ADD COLUMN tipo_documento ENUM('CC', 'NIT', 'CE', 'PP') DEFAULT 'CC';
  ALTER TABLE clientes ADD COLUMN digito_verificacion CHAR(1) NULL;
  ALTER TABLE clientes ADD COLUMN ciudad VARCHAR(100) NULL;
  ALTER TABLE clientes ADD COLUMN departamento VARCHAR(100) NULL;
  ALTER TABLE clientes ADD COLUMN responsabilidad_tributaria VARCHAR(100) NULL;
  ALTER TABLE clientes ADD COLUMN contacto_nombre VARCHAR(100) NULL;
  ALTER TABLE clientes ADD COLUMN contacto_cargo VARCHAR(100) NULL;
  ```

---

### 2️⃣ **CUERPO DE LA FACTURA (DETALLE)**

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ITEM │ CÓDIGO  │ DESCRIPCIÓN              │ CANT │ UNIDAD │ VR. UNIT │ DCTO │ SUBTOTAL │
├──────┼─────────┼──────────────────────────┼──────┼────────┼──────────┼──────┼──────────┤
│  1   │ 1613MT  │ Chaqueta Negra Talla M   │  2   │  UND   │ 120.000  │  0%  │ 240.000  │
│  2   │ 2298MT  │ Camisa Beige Talla L     │  1   │  UND   │  65.000  │  5%  │  61.750  │
│  3   │ SRV-001 │ Servicio Mantenimiento   │  1   │  SRV   │ 180.000  │  0%  │ 180.000  │
└──────┴─────────┴──────────────────────────┴──────┴────────┴──────────┴──────┴──────────┘
```

**¿Dónde parametrizar?**
- ✅ **Tabla:** `venta_detalle` (ya existe)
- ✅ **Campos adicionales:**
  ```sql
  ALTER TABLE venta_detalle ADD COLUMN unidad_medida VARCHAR(10) DEFAULT 'UND';
  ALTER TABLE venta_detalle ADD COLUMN descuento_porcentaje DECIMAL(5,2) DEFAULT 0;
  ALTER TABLE venta_detalle ADD COLUMN descripcion_adicional TEXT NULL;
  ```

- ✅ **Tabla productos:** Agregar campo de unidad de medida
  ```sql
  ALTER TABLE productos ADD COLUMN unidad_medida VARCHAR(10) DEFAULT 'UND';
  ```

---

### 3️⃣ **PIE DE FACTURA (TOTALES)**

```
┌────────────────────────────────────────────────────┐
│                                   SUBTOTAL: $481.750│
│                          Descuento (2%):  $  9.635│
│                          Base Gravable:   $472.115│
│                          IVA (19%):       $ 89.702│
│                          Retención IVA:   $  4.485│
│                          Retención Fuente:$  9.442│
│                          ─────────────────────────│
│                          TOTAL A PAGAR:   $547.890│
│                                                    │
│ Forma de Pago: Crédito 30 días                    │
│ Vence: 2026-03-21                                 │
└────────────────────────────────────────────────────┘
```

**¿Dónde parametrizar?**
- ✅ **Tabla:** `impuestos` (ya existe)
- ✅ **Campos nuevos para retenciones:**
  ```sql
  CREATE TABLE IF NOT EXISTS retenciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    empresa_id INT NOT NULL,
    codigo VARCHAR(20) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    tipo ENUM('reteiva', 'retefuente', 'reteica') NOT NULL,
    porcentaje DECIMAL(5,2) NOT NULL,
    base_minima DECIMAL(15,2) DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
  );
  ```

---

### 4️⃣ **NOTAS Y PIE DE PÁGINA**

```
┌────────────────────────────────────────────────────────────────────┐
│ OBSERVACIONES:                                                     │
│ - Producto con garantía de 90 días                                │
│ - Incluye envío nacional sin costo adicional                      │
│                                                                    │
│ CONDICIONES COMERCIALES:                                           │
│ - Crédito sujeto a aprobación                                     │
│ - Los pagos después del vencimiento generan interés del 2% mensual│
│                                                                    │
│ INFORMACIÓN BANCARIA:                                              │
│ Banco Davivienda - Cuenta Corriente: 123456789                   │
│ Bancolombia - Cuenta Ahorros: 987654321                          │
│                                                                    │
│ CUFE (Código Único Factura Electrónica):                          │
│ a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6             │
│                                                                    │
│ Esta factura es un título valor y presta mérito ejecutivo.        │
│ Generada por: KORE Inventory ERP v1.0                            │
└────────────────────────────────────────────────────────────────────┘
```

**¿Dónde parametrizar?**
- ✅ **Nueva tabla:** `configuracion_factura`
  ```sql
  CREATE TABLE IF NOT EXISTS configuracion_factura (
    id INT PRIMARY KEY AUTO_INCREMENT,
    empresa_id INT NOT NULL,
    mostrar_logo BOOLEAN DEFAULT TRUE,
    logo_posicion ENUM('izquierda', 'centro', 'derecha') DEFAULT 'izquierda',
    mostrar_slogan BOOLEAN DEFAULT TRUE,
    pie_pagina TEXT NULL,
    terminos_condiciones TEXT NULL,
    notas_predeterminadas TEXT NULL,
    mostrar_qr BOOLEAN DEFAULT TRUE,
    mostrar_cufe BOOLEAN DEFAULT TRUE,
    color_primario VARCHAR(7) DEFAULT '#007bff',
    color_secundario VARCHAR(7) DEFAULT '#6c757d',
    fuente VARCHAR(50) DEFAULT 'Arial',
    tamano_fuente INT DEFAULT 10,
    mostrar_firma BOOLEAN DEFAULT FALSE,
    texto_firma VARCHAR(200) NULL,
    cuentas_bancarias JSON NULL,
    mensaje_agradecimiento VARCHAR(500) DEFAULT 'Gracias por su compra',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id),
    UNIQUE KEY (empresa_id)
  );
  ```

---

## 🎨 MÓDULO DE CONFIGURACIÓN (NUEVO)

### **Pantalla: Configuración General → Facturación**

```
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ CONFIGURACIÓN DE FACTURACIÓN                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📋 DATOS DE LA EMPRESA                                     │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Logo:          [Subir Logo] [Vista Previa]        │    │
│  │ Slogan:        [_________________________________] │    │
│  │ Sitio Web:     [_________________________________] │    │
│  │ Régimen:       [▼ Común / Simplificado]           │    │
│  │ ☑ Gran Contribuyente  ☑ Autoretenedor            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  📄 NUMERACIÓN DE FACTURAS                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Prefijo:       [FAC-______]                        │    │
│  │ Resolución:    [________________]                  │    │
│  │ Vigencia:      [____/__/____] a [____/__/____]    │    │
│  │ Rango:         Desde [______] Hasta [______]      │    │
│  │ Contador:      [______] (actual)                   │    │
│  │ ☑ Generar número automático                       │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  🎨 DISEÑO DE FACTURA                                       │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Color Primario:     [🎨 #007bff]                  │    │
│  │ Color Secundario:   [🎨 #6c757d]                  │    │
│  │ Fuente:             [▼ Arial]                      │    │
│  │ Tamaño:             [▼ 10pt]                       │    │
│  │ Posición Logo:      [▼ Izquierda]                 │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  💰 CUENTAS BANCARIAS (Para mostrar en factura)            │
│  ┌────────────────────────────────────────────────────┐    │
│  │ [+ Agregar Cuenta]                                 │    │
│  │                                                     │    │
│  │ 🏦 Bancolombia - Ahorros: 123456789               │    │
│  │ 🏦 Davivienda - Corriente: 987654321              │    │
│  │                                                     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  📝 TEXTOS Y NOTAS                                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Notas Predeterminadas:                             │    │
│  │ [_____________________________________________]    │    │
│  │ [_____________________________________________]    │    │
│  │                                                     │    │
│  │ Términos y Condiciones:                            │    │
│  │ [_____________________________________________]    │    │
│  │ [_____________________________________________]    │    │
│  │                                                     │    │
│  │ Mensaje de Agradecimiento:                         │    │
│  │ [_____________________________________________]    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ☑ Mostrar CUFE        ☑ Mostrar Código QR                 │
│  ☑ Mostrar firma       Texto: [_______________]            │
│                                                              │
│  [Vista Previa]  [Guardar Configuración]                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 RESUMEN: MÓDULOS Y CAMPOS

### **Tabla: empresas** (existente - agregar campos)
- `logo_url`, `regimen_fiscal`, `gran_contribuyente`, `autoretenedor`
- `resolucion_dian`, `fecha_resolucion_desde`, `fecha_resolucion_hasta`
- `prefijo_factura`, `rango_factura_desde`, `rango_factura_hasta`
- `contador_factura_actual`, `ciudad`, `sitio_web`, `slogan`

### **Tabla: clientes** (existente - agregar campos)
- `razon_social`, `tipo_documento`, `digito_verificacion`
- `ciudad`, `departamento`, `responsabilidad_tributaria`
- `contacto_nombre`, `contacto_cargo`

### **Tabla: ventas** (existente - agregar campos)
- `fecha_vencimiento`, `vendedor_id`, `forma_pago`, `dias_credito`
- `observaciones`, `cufe`

### **Tabla: productos** (existente - agregar)
- `unidad_medida`

### **Tabla: venta_detalle** (existente - agregar)
- `unidad_medida`, `descuento_porcentaje`, `descripcion_adicional`

### **NUEVA Tabla: configuracion_factura**
- Todos los campos de diseño y personalización

### **NUEVA Tabla: retenciones**
- Para manejar ReteIVA, ReteFuente, ReteICA

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### **Fase 1: Base de Datos** ✅
1. Crear migration con todos los ALTER TABLE
2. Crear tablas nuevas: `configuracion_factura`, `retenciones`
3. Insertar datos por defecto

### **Fase 2: Backend** ⏳
1. Crear controlador `configuracion-factura.controller.ts`
2. Actualizar `empresas.controller.ts` con nuevos campos
3. Actualizar `clientes.controller.ts` con nuevos campos
4. Crear endpoints para retenciones

### **Fase 3: Frontend** ⏳
1. Crear página `configuracion-facturacion.html`
2. Actualizar formulario de empresas
3. Actualizar formulario de clientes
4. Crear componente de subida de logo

### **Fase 4: Generación de PDF** ⏳
1. Instalar librería PDF (jsPDF o similar)
2. Crear template HTML de factura
3. Implementar lógica de generación
4. Agregar botón "Descargar PDF" en ventas

---

## 💡 MEJORAS SUGERIDAS

1. **QR Code**: Incluir QR con enlace para consultar factura online
2. **Firma Digital**: Soporte para firma electrónica DIAN
3. **Múltiples Templates**: Permitir varios diseños de factura
4. **Previsualización en Tiempo Real**: Ver cómo queda la factura mientras configuras
5. **Facturación Electrónica DIAN**: Integración futura con webservice DIAN
6. **Multi-idioma**: Facturas en inglés/español
7. **Cotizaciones**: Reutilizar diseño para cotizaciones
8. **Remisiones**: Documento de entrega sin valores

---

## ✅ ¿ESTÁ CLARO EL PLAN?

Si estás de acuerdo, empezamos por:
1. ✅ Crear la migration SQL con todos los campos
2. ✅ Crear la tabla configuracion_factura
3. ✅ Actualizar los controladores del backend
4. ✅ Crear la pantalla de configuración en frontend

**¿Procedo con la Fase 1 (Base de Datos)?**
