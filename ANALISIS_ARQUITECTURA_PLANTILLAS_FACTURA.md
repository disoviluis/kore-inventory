# 🎨 ANÁLISIS DE ARQUITECTURA - SISTEMA DE PLANTILLAS DE FACTURA

**Fecha:** 2026-02-20  
**Solicitado por:** Usuario  
**Objetivo:** Implementar sistema de plantillas profesionales y personalizables para facturas, similar a SIIGO

---

## 📋 1. MÓDULOS SIMILARES EXISTENTES

### 1.1. Módulo de Configuración de Facturación (EXISTENTE)

**Ubicación:**
```
frontend/public/configuracion-facturacion.html
frontend/public/assets/js/configuracion-facturacion.js
backend/src/platform/facturacion/facturacion.controller.ts
SQL: configuracion_factura (tabla)
```

**Funcionalidades actuales:**
- ✅ Selección de colores (primario, secundario)
- ✅ Selección de fuente (Arial, Helvetica, Times, Courier, Georgia, Verdana)
- ✅ Tamaño de fuente (8pt - 16pt)
- ✅ Posición del logo (izquierda, centro, derecha)
- ✅ Mostrar/ocultar elementos (logo, slogan, QR, CUFE, firma)
- ✅ Textos personalizados (pie de página, términos, notas)
- ✅ Cuentas bancarias (JSON array)
- ✅ Mensaje de agradecimiento

**Limitaciones identificadas:**
- ❌ Solo permite personalizar colores y textos
- ❌ NO permite cambiar estructura/layout de la factura
- ❌ NO permite agregar campos personalizados
- ❌ NO permite mover elementos de posición
- ❌ NO tiene preview en tiempo real
- ❌ NO tiene múltiples plantillas predefinidas

---

### 1.2. Módulo de Configuración General de Empresa

**Ubicación:**
```
frontend/public/configuracion-general.html
frontend/public/assets/js/configuracion-general.js
backend/src/platform/empresas/empresas.controller.ts
SQL: empresas (tabla)
```

**Patrón de diseño:**
- Formulario con tabs/secciones (Datos Básicos, Fiscal, DIAN, Branding)
- Guardado mediante PUT `/api/empresas/:id`
- Validaciones en frontend y backend
- localStorage para mantener empresa activa

---

### 1.3. Generación de Factura (ACTUAL)

**Ubicación:**
```
frontend/public/assets/js/ventas.js
- Función: mostrarFactura() - Modal HTML
- Función: descargarPDF() - jsPDF generación
- Función: generarHTMLImpresion() - Impresión térmica/carta
```

**Estructura actual:**
```javascript
// HARDCODED - No usa plantillas dinámicas
const html = `
  <div class="factura">
    <header>${logo} ${nombre} ${nit}</header>
    <section>${cliente}</section>
    <table>${productos}</table>
    <footer>${totales}</footer>
  </div>
`;
```

---

## 🔍 2. PATRONES Y ESTRUCTURA ACTUAL

### 2.1. Patrón de Base de Datos

**Tabla de configuración:**
```sql
CREATE TABLE configuracion_factura (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL UNIQUE,
  
  -- Campos de personalización
  color_primario VARCHAR(7),
  fuente VARCHAR(50),
  mostrar_logo BOOLEAN,
  cuentas_bancarias JSON,
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);
```

**Patrón:** 1 tabla = 1 configuración global por empresa

---

### 2.2. Patrón de Frontend

**Estructura de carpetas:**
```
frontend/public/
├── configuracion-facturacion.html    ← Página de configuración
├── assets/
│   └── js/
│       └── configuracion-facturacion.js  ← Lógica de negocio
```

**Patrón:** 1 HTML + 1 JS por módulo

---

### 2.3. Patrón de Backend

**Controller:**
```typescript
// backend/src/platform/facturacion/facturacion.controller.ts
export const getConfiguracion = async (req, res) => { ... }
export const updateConfiguracion = async (req, res) => { ... }
```

**Rutas:**
```typescript
// backend/src/platform/facturacion/facturacion.routes.ts
router.get('/configuracion/:empresaId', getConfiguracion);
router.put('/configuracion/:empresaId', updateConfiguracion);
```

**Patrón:** Controller + Routes + Database

---

## 📊 3. DIFERENCIAS ENTRE MÓDULOS

### Configuración General vs Configuración Facturación

| Aspecto | Configuración General | Configuración Facturación |
|---------|---------------------|------------------------|
| Tabla | `empresas` | `configuracion_factura` |
| Alcance | Datos de la empresa | Diseño de factura |
| Complejidad | 35+ campos simples | 15 campos + JSON |
| Relación | 1:1 (empresa existe siempre) | 1:0..1 (opcional) |
| UI | Formulario largo con tabs | Formulario corto por secciones |

---

## 🎯 4. PROPUESTA DE IMPLEMENTACIÓN CONSISTENTE

### 4.1. Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────┐
│                    SISTEMA DE PLANTILLAS                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. PLANTILLAS PREDEFINIDAS (Templates)                      │
│     - Clásica (actual)                                       │
│     - Moderna                                                │
│     - Minimalista                                            │
│     - Corporativa                                            │
│     - SIIGO Style                                            │
│                                                               │
│  2. EDITOR VISUAL (Drag & Drop)                              │
│     - Mover elementos                                        │
│     - Agregar imágenes (certificaciones)                     │
│     - Cambiar tamaños                                        │
│     - Preview en tiempo real                                 │
│                                                               │
│  3. CONFIGURACIÓN AVANZADA                                   │
│     - Colores, fuentes (EXISTENTE)                           │
│     - Espaciado, márgenes                                    │
│     - Campos personalizados                                  │
│     - Lógica condicional (mostrar si...)                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

### 4.2. Estructura de Base de Datos

**Opción A: Tabla de Plantillas (RECOMENDADA)**

```sql
-- Plantillas predefinidas del sistema
CREATE TABLE plantillas_factura (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,          -- "Clásica", "Moderna", etc.
  descripcion TEXT,
  preview_url VARCHAR(500),              -- Imagen de preview
  estructura JSON NOT NULL,              -- Layout completo
  es_sistema BOOLEAN DEFAULT TRUE,       -- Plantilla del sistema o custom
  es_premium BOOLEAN DEFAULT FALSE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Configuración de plantilla por empresa
CREATE TABLE empresa_plantilla (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  plantilla_id INT NOT NULL,
  
  -- Personalización sobre la plantilla base
  estructura_custom JSON NULL,           -- Override de la plantilla
  elementos_adicionales JSON NULL,       -- Imágenes, certificaciones
  
  -- Mantener campos existentes de configuracion_factura
  color_primario VARCHAR(7) DEFAULT '#007bff',
  color_secundario VARCHAR(7) DEFAULT '#6c757d',
  fuente VARCHAR(50) DEFAULT 'Arial',
  tamano_fuente INT DEFAULT 10,
  cuentas_bancarias JSON NULL,
  
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (plantilla_id) REFERENCES plantillas_factura(id),
  UNIQUE KEY unique_empresa_activa (empresa_id, activo)
);
```

**Estructura JSON de plantilla:**
```json
{
  "version": "1.0",
  "layout": "vertical",
  "sections": [
    {
      "id": "header",
      "type": "encabezado",
      "elements": [
        {"type": "logo", "position": "left", "width": "150px", "height": "80px"},
        {"type": "empresa_info", "position": "center", "fields": ["nombre", "nit", "direccion"]},
        {"type": "badges", "position": "right", "visible": ["gran_contribuyente", "regimen"]}
      ]
    },
    {
      "id": "invoice_info",
      "type": "datos_factura",
      "layout": "two-columns",
      "left": ["numero_factura", "fecha_emision", "fecha_vencimiento"],
      "right": ["cliente_info"]
    },
    {
      "id": "products",
      "type": "tabla_productos",
      "columns": ["#", "descripcion", "cantidad", "precio_unitario", "iva", "total"],
      "show_header": true,
      "zebra_stripes": false
    },
    {
      "id": "totals",
      "type": "totales",
      "position": "right",
      "fields": ["subtotal", "iva", "retenciones", "total"]
    },
    {
      "id": "footer",
      "type": "pie_pagina",
      "elements": [
        {"type": "qr_code", "position": "left"},
        {"type": "cufe", "position": "center"},
        {"type": "cuentas_bancarias", "position": "right"},
        {"type": "texto_legal", "content": "auto"}
      ]
    }
  ],
  "custom_images": [
    {
      "id": "certificacion_iso",
      "url": "https://...",
      "position": "footer",
      "width": "100px",
      "height": "100px"
    }
  ]
}
```

---

**Opción B: Extender configuracion_factura (MÁS SIMPLE)**

```sql
ALTER TABLE configuracion_factura ADD COLUMN plantilla_seleccionada VARCHAR(50) DEFAULT 'clasica';
ALTER TABLE configuracion_factura ADD COLUMN estructura_custom JSON NULL;
ALTER TABLE configuracion_factura ADD COLUMN imagenes_adicionales JSON NULL;
```

**Pros:** Menos cambios en código existente  
**Contras:** Menos escalable, mezcla conceptos

---

### 4.3. Frontend Propuesto

**Opción A: Módulo Independiente (RECOMENDADA)**

```
frontend/public/
├── configuracion-plantillas.html       ← NUEVA PÁGINA
├── assets/
│   └── js/
│       ├── configuracion-plantillas.js ← NUEVO
│       └── plantilla-editor.js         ← NUEVO (Drag & Drop)
```

**Ventajas:**
- Separación de responsabilidades
- Más profesional
- Permite editor visual complejo

---

**Opción B: Pestaña en Configuración General**

Agregar tab "Plantilla de Factura" en `configuracion-general.html`

**Ventajas:**
- Todo en un solo lugar
- Menos navegación

**Desventajas:**
- Página muy pesada
- Dificulta editor visual

---

### 4.4. Backend Propuesto

**Nuevos Endpoints:**

```typescript
// backend/src/platform/plantillas/plantillas.controller.ts

// Listar plantillas disponibles
GET /api/plantillas
Response: [
  {id: 1, nombre: "Clásica", preview_url: "...", es_premium: false},
  {id: 2, nombre: "Moderna", preview_url: "...", es_premium: false},
  {id: 3, nombre: "Corporativa Premium", preview_url: "...", es_premium: true}
]

// Obtener estructura de una plantilla
GET /api/plantillas/:id
Response: {id: 1, nombre: "Clásica", estructura: {...}}

// Obtener plantilla activa de empresa
GET /api/plantillas/empresa/:empresaId
Response: {
  plantilla: {id: 1, nombre: "Clásica"},
  personalizacion: {color_primario: "#007bff", ...},
  estructura_custom: {...}
}

// Actualizar plantilla de empresa
PUT /api/plantillas/empresa/:empresaId
Body: {
  plantilla_id: 2,
  color_primario: "#FF6B35",
  estructura_custom: {...},
  imagenes_adicionales: [...]
}

// Preview de plantilla (generar HTML temporal)
POST /api/plantillas/preview
Body: {plantilla_id: 2, datos_prueba: {...}}
Response: {html: "<div>...</div>"}
```

---

### 4.5. Flujo de Usuario

```
┌─────────────────────────────────────────────────────────────┐
│ OPCIÓN 1: Desde Configuración General                       │
│                                                               │
│ 1. Ir a: Configuración General                              │
│ 2. Nueva sección: "Plantilla de Factura"                    │
│ 3. Botón: "Configurar Plantilla"                            │
│    └─> Abre modal o página configuracion-plantillas.html    │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│ OPCIÓN 2: Módulo Independiente (RECOMENDADA)                │
│                                                               │
│ 1. Nuevo ítem en menú: "Plantilla de Factura"               │
│ 2. Página: configuracion-plantillas.html                    │
│ 3. Secciones:                                                │
│    a) Seleccionar Plantilla Base                            │
│    b) Personalizar Colores/Fuentes                          │
│    c) Editor Visual (mover elementos)                       │
│    d) Agregar Imágenes/Certificaciones                      │
│    e) Preview en Tiempo Real                                │
│    f) Guardar                                                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 5. PLANTILLAS PROFESIONALES BASADAS EN SIIGO

### 5.1. Plantilla "Clásica" (Actual - Mejorada)

**Características:**
- Encabezado centrado con logo
- Información en columnas
- Tabla de productos tradicional
- Totales a la derecha
- QR y CUFE en pie de página

**Ideal para:** Negocios tradicionales, B2B

---

### 5.2. Plantilla "Moderna"

**Características:**
- Encabezado con logo grande a la izquierda
- Colores llamativos
- Tabla con fondo alternado (zebra)
- Iconos para badges
- QR más visible

**Ideal para:** Empresas tech, startups

---

### 5.3. Plantilla "Minimalista"

**Características:**
- Encabezado simple sin bordes
- Solo blanco y negro + 1 color de acento
- Tabla sin bordes (solo líneas horizontales)
- Espaciado amplio
- QR pequeño en esquina

**Ideal para:** Servicios profesionales, consultorías

---

### 5.4. Plantilla "Corporativa"

**Características:**
- Header con franja de color
- Logo en esquina
- Secciones claramente delimitadas
- Tipografía serif formal
- Espacio para múltiples firmas

**Ideal para:** Grandes empresas, sector financiero

---

### 5.5. Plantilla "SIIGO Style"

**Características:**
- Layout en bloques con bordes redondeados
- Colores pastel
- Iconos para cada sección
- Resumen visual con gráficos
- Footer con redes sociales

**Ideal para:** Retail, ventas al público

---

## 🛠️ 6. HERRAMIENTAS Y LIBRERÍAS

### 6.1. Editor Visual (Drag & Drop)

**Opciones:**
1. **GrapesJS** - Editor HTML drag & drop
   - Pros: Open source, muy completo
   - Contras: Pesado (500KB+)

2. **unlayer** - Email editor (adaptable)
   - Pros: Ligero, fácil
   - Contras: Pensado para emails

3. **Custom Grid System** - Bootstrap Grid + Sortable.js
   - Pros: Ligero, control total
   - Contras: Más trabajo de desarrollo

**RECOMENDACIÓN:** Empezar con sistema simple (plantillas predefinidas) y después agregar drag & drop

---

### 6.2. Generación de PDF

**Actual:** jsPDF  
**Alternativa:** pdfmake (más flexible con layouts)

---

### 6.3. Preview en Tiempo Real

```javascript
// Iframe con factura de prueba
function actualizarPreview(config) {
  const iframe = document.getElementById('preview');
  const plantillaHTML = generarFactura(config, datosPrueba);
  iframe.srcdoc = plantillaHTML;
}
```

---

## 📝 7. PLAN DE IMPLEMENTACIÓN

### FASE 1: Fundación (1-2 días)
- [ ] Crear tabla `plantillas_factura`
- [ ] Crear tabla `empresa_plantilla`
- [ ] Insertar 3 plantillas base (Clásica, Moderna, Minimalista)
- [ ] Migrar datos de `configuracion_factura` existente

### FASE 2: Backend (1 día)
- [ ] Controller: `plantillas.controller.ts`
- [ ] Routes: `plantillas.routes.ts`
- [ ] Endpoints: GET, PUT plantillas

### FASE 3: Frontend Básico (2 días)
- [ ] Página: `configuracion-plantillas.html`
- [ ] JS: `configuracion-plantillas.js`
- [ ] Galería de plantillas con preview
- [ ] Selector de plantilla
- [ ] Personalización de colores/fuentes (usar código existente)
- [ ] Preview en tiempo real

### FASE 4: Generador de Facturas (1 día)
- [ ] Refactor `ventas.js` para usar plantillas dinámicas
- [ ] Función: `generarFacturaDesde Plantilla(plantilla, ventaData)`
- [ ] Actualizar `descargarPDF()` para usar plantilla

### FASE 5: Editor Visual (Opcional - 3-4 días)
- [ ] Drag & drop de elementos
- [ ] Upload de imágenes (certificaciones)
- [ ] Guardar estructura custom

### FASE 6: Plantillas Avanzadas (Opcional - 2 días)
- [ ] Plantilla Corporativa
- [ ] Plantilla SIIGO Style
- [ ] Sistema de plantillas premium

---

## ✅ 8. RECOMENDACIONES FINALES

### Enfoque Recomendado: **Incremental**

1. **Empezar simple:** 3 plantillas predefinidas sin editor visual
2. **Migrar sin romper:** Mantener sistema actual funcionando
3. **Agregar valor rápido:** Preview en tiempo real desde día 1
4. **Evolucionar:** Agregar editor visual después si se requiere

### Ubicación Recomendada: **Módulo Independiente**

- Nueva página: `configuracion-plantillas.html`
- Acceso desde: Menú principal "Plantilla de Factura"
- Link en: Configuración General (botón "Personalizar Factura")

### Formatos de Impresión Soportados

El sistema actualmente soporta **3 formatos de impresión**:

| Formato | Tamaño | Uso Ideal | Estado |
|---------|--------|-----------|--------|
| **Carta** | Letter 8.5" x 11" | Facturas completas, archivo | ✅ Implementado |
| **Media Carta** | Half Letter 5.5" x 8.5" | Facturas compactas, ahorro de papel | ✅ Implementado |
| **Tirilla Térmica** | POS 58mm/80mm | Punto de venta, tickets rápidos | ✅ Implementado |

**Características por formato:**

**Carta (Letter):**
- Tamaño estándar para impresoras de oficina
- Incluye todos los elementos: logo, badges, CUFE, QR
- Tabla completa con todos los campos
- Ideal para: B2B, archivo contable, auditorías

**Media Carta (Half Letter):**
- Tamaño compacto (mitad de carta)
- Ahorro de papel del 50%
- Mantiene todos los elementos pero más comprimidos
- Fuentes más pequeñas (8pt en lugar de 10pt)
- QR más pequeño (50px en lugar de 80px)
- Ideal para: B2C, ventas minoristas, ventas rápidas

**Tirilla Térmica (POS):**
- Impresoras térmicas de punto de venta
- 58mm o 80mm de ancho
- Diseño minimalista: solo información esencial
- Sin colores (blanco y negro)
- Ideal para: Retail, restaurantes, tiendas

**Consideraciones para el Sistema de Plantillas:**

1. Las plantillas deben ser **responsive** y adaptarse a los 3 formatos
2. El editor visual debe permitir **previsualizar en los 3 formatos**
3. Algunos elementos pueden ocultarse automáticamente en tirilla (ej: logo grande, badges)
4. La estructura JSON debe especificar comportamiento por formato:

```json
{
  "sections": [
    {
      "id": "header",
      "elements": [
        {
          "type": "logo",
          "visible_in": ["carta", "media-carta"],
          "size_carta": "150x80",
          "size_media_carta": "100x60"
        }
      ]
    }
  ]
}
```

### Problema del Logo en Impresión

**Causa probable:** 
- Logo no se carga en `generarHTMLImpresion()` porque usa URL externa
- CORS o timeout en carga de imagen

**Solución:**
```javascript
// Convertir logo a base64 antes de imprimir
const logoBase64 = await imagenABase64(currentEmpresa.logo_url);
// Usar en HTML: <img src="data:image/png;base64,${logoBase64}">
```

---

## 🎯 DECISIONES TOMADAS

### ✅ 1. Ubicación: Nueva pestaña en Configuración General (APROBADO)

**Decisión:** Implementar como **nueva pestaña "Plantilla de Factura"** en el módulo de Configuración General existente.

**Ubicación final:**
```
Configuración General (configuracion-general.html)
├── 📦 Categorías
├── 💵 Impuestos
├── 🏢 Empresa
└── 🎨 Plantilla de Factura ← IMPLEMENTADO
```

**Justificación:**
- ✅ **Consistencia:** Los usuarios esperan configuraciones en un solo lugar
- ✅ **Descubribilidad:** Fácil de encontrar junto a configuración de Empresa
- ✅ **Contexto:** Relacionado con datos empresariales y facturación
- ✅ **Usabilidad:** Evita dispersar configuraciones en múltiples páginas

**Estado:** ✅ **IMPLEMENTADO**

### 🔧 2. Implementación Inicial (Versión 1.0)

**Enfoque:** Incremental - Empezar simple y evolucionar

**FASE 1:** Plantillas Predefinidas (IMPLEMENTADO)
- ✅ 3 plantillas base: Clásica, Moderna, Minimalista
- ✅ Selector visual con previews (placeholders)
- ✅ Personalización de colores y fuentes
- ✅ Switches para mostrar/ocultar elementos (logo, QR, CUFE, badges)
- ✅ Guardado en tabla `configuracion_factura` existente
- ⏳ Preview en tiempo real (próximamente)

**FASE 2:** Editor Visual (Futuro)
- 🔴 Drag & drop de elementos
- 🔴 Upload de imágenes personalizadas
- 🔴 Estructura JSON personalizada

**FASE 3:** Plantillas Premium (Futuro)
- 🔴 Plantilla Corporativa
- 🔴 Plantilla SIIGO Style
- 🔴 Sistema de plantillas marketplace

---

## 🎯 DECISIONES PENDIENTES (Actualizadas)

### ~~1. ¿Módulo independiente o integrado?~~
✅ **RESUELTO:** Nueva pestaña en Configuración General

### ~~2. ¿Editor visual desde el inicio?~~
✅ **RESUELTO:** Empezar con plantillas predefinidas, agregar editor después

### 3. Base de Datos: ¿Extender o crear tabla nueva?
   - Recomendación: Dejar preparado pero activar después

---

**¿Procedo con la implementación según este análisis?**
