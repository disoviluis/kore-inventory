# Guía: Tipos de Facturación en Colombia según DIAN

**Fecha**: 3 de Junio 2026  
**Sistema**: Kore Inventory  
**Propósito**: Soportar todos los tipos de contribuyentes (persona natural → gran empresa)

---

## 📚 Marco Legal DIAN

### Normativa Aplicable
- **Resolución 000042 de 2020**: Facturación electrónica obligatoria
- **Decreto 1625 de 2016**: Régimen Simple de Tributación
- **Estatuto Tributario Art. 555**: Obligación de facturar
- **Resolución 000165 de 2023**: Documentos equivalentes POS

---

## 🔢 Dígito de Verificación - Aclaración Importante

### ¿Las personas naturales tienen DV?

**SÍ, TODAS las personas tienen dígito de verificación.**

**Explicación**:
1. Cuando una persona natural se inscribe en el RUT para actividad comercial
2. La DIAN toma su número de cédula como NIT
3. Calcula el dígito de verificación con el algoritmo módulo 11
4. El resultado es: **NIT-DV** (ejemplo: 1016085506-8)

**Casos especiales**:
- **Cédula de ciudadanía**: Usa el número directamente
- **Cédula de extranjería**: Usa el número directamente
- **Pasaporte**: DIAN asigna un NIT especial

**Conclusión**: ✅ El campo `digito_verificacion` debe ser **OBLIGATORIO** para todos

---

## 📊 Tipos de Documentos Fiscales en Colombia

### 1. Documento Equivalente (Tiquete de Caja)

**¿Quién lo usa?**
- Personas naturales en Régimen Simple
- Pequeños comercios (ingresos < 3.500 UVT/año ≈ $140 millones)
- Negocios que no están obligados a facturar electrónicamente

**Requisitos Mínimos**:
```javascript
{
  nit: '1016085506',
  digito_verificacion: '8',          // ✅ OBLIGATORIO
  nombre_comercial: 'CIGARRERIA AC',
  direccion: 'CRA 1, Funza',
  telefono: '318 3906457',
  tipo_regimen: 'simple'
}
```

**NO requiere**:
- ❌ Resolución DIAN
- ❌ Rango de numeración autorizada
- ❌ CUFE
- ❌ Firma digital

**Información que debe llevar el tiquete**:
- Nombre o razón social
- NIT-DV
- Dirección y teléfono
- Fecha y hora de expedición
- Descripción de productos/servicios
- Valor total
- Forma de pago
- Texto: "Régimen Simple de Tributación"

---

### 2. Factura POS (Punto de Venta)

**¿Quién lo usa?**
- Comerciantes responsables del IVA
- Régimen Común con ventas masivas al consumidor final
- Restaurantes, tiendas, farmacias, estaciones de servicio

**Requisitos**:
```javascript
{
  // Todo lo de documento equivalente +
  resolucion_dian: '18760000001234',
  fecha_resolucion: '2024-01-15',
  vigencia_resolucion_desde: '2024-01-15',
  vigencia_resolucion_hasta: '2026-01-15',
  prefijo_factura: 'POS',            // Opcional
  rango_factura_desde: 1,
  rango_factura_hasta: 5000,
  contador_actual: 1
}
```

**Características**:
- ✅ Requiere resolución DIAN
- ✅ Rango de numeración consecutiva
- ❌ NO requiere CUFE (diferencia con factura electrónica)
- ❌ NO requiere envío previo a DIAN
- ✅ Se reporta mensualmente a DIAN

**Texto obligatorio en factura**:
```
"Factura POS No. POS-0001
Resolución DIAN No. 18760000001234 del 15/01/2024
Rango autorizado del POS-1 al POS-5000
Vigencia: 15/01/2024 al 15/01/2026"
```

---

### 3. Factura Electrónica de Venta

**¿Quién lo usa?**
- Grandes contribuyentes (OBLIGATORIO)
- Personas jurídicas con ingresos > cierto umbral
- Empresas que facturan a otras empresas (B2B)

**Requisitos Completos**:
```javascript
{
  // Todo lo anterior +
  razon_social: 'CIGARRERIA AC S.A.S',
  tipo_persona: 'juridica',
  tipo_regimen: 'comun',
  
  // Código de actividad económica CIIU
  actividad_economica: '4711 - Comercio al por menor',
  
  // Responsabilidades fiscales (códigos DIAN)
  responsabilidades_fiscales: [
    'O-13', // Gran contribuyente
    'O-15', // Autorretenedor
    'R-99-PN' // Responsable de IVA
  ],
  
  // Datos de facturación electrónica
  resolucion_dian: '18760000001234',
  fecha_resolucion: '2024-01-15',
  prefijo_factura: 'FECV',
  rango_desde: 1,
  rango_hasta: 100000,
  clave_tecnica: 'XXX',              // Provista por DIAN
  software_id: 'XXX',                // Provisto por DIAN
  pin_software: 'XXX',
  
  // Se genera automáticamente por venta
  cufe: true,                        // Código Único Factura Electrónica
  qr_code: true,
  firma_digital: true,
  
  // Campos adicionales legales
  email_facturacion: 'facturacion@cigarreriaac.com',
  ambiente_dian: 'produccion' // o 'habilitacion' para pruebas
}
```

**Proceso de facturación electrónica**:
1. Generar XML con estructura DIAN
2. Firmar digitalmente con certificado
3. Calcular CUFE
4. Enviar a DIAN en tiempo real
5. Recibir confirmación (o rechazo)
6. Generar representación gráfica (PDF)
7. Enviar al cliente (email obligatorio)

---

## 🎯 Estrategia de Implementación

### Propuesta: Sistema de 3 Niveles

```sql
-- Agregar campo nuevo a tabla empresas
ALTER TABLE empresas 
ADD COLUMN nivel_facturacion ENUM(
  'documento_equivalente',
  'factura_pos', 
  'factura_electronica'
) DEFAULT 'documento_equivalente' AFTER regimen_tributario;

-- Agregar campo para responsabilidades fiscales
ALTER TABLE empresas 
ADD COLUMN responsabilidades_fiscales JSON DEFAULT NULL
COMMENT 'Códigos DIAN: O-13, O-15, R-99-PN, etc.'
AFTER gran_contribuyente;

-- Agregar campos para facturación electrónica
ALTER TABLE empresas 
ADD COLUMN clave_tecnica VARCHAR(100) DEFAULT NULL,
ADD COLUMN software_id VARCHAR(100) DEFAULT NULL,
ADD COLUMN pin_software VARCHAR(100) DEFAULT NULL,
ADD COLUMN ambiente_dian ENUM('habilitacion', 'produccion') DEFAULT 'habilitacion'
AFTER resolucion_dian;
```

### Validación por Nivel

```javascript
// backend/src/utils/validacionFacturacion.ts

export const requerimientosPorNivel = {
  documento_equivalente: {
    campos_obligatorios: [
      'nit',
      'digito_verificacion',  // ✅ Siempre obligatorio
      'nombre',
      'direccion',
      'telefono'
    ],
    campos_opcionales: ['email', 'logo_url', 'slogan'],
    campos_no_requeridos: [
      'resolucion_dian',
      'rango_factura_desde',
      'rango_factura_hasta',
      'cufe',
      'firma_digital'
    ],
    texto_footer: 'Documento Equivalente - Régimen Simple de Tributación'
  },
  
  factura_pos: {
    campos_obligatorios: [
      'nit',
      'digito_verificacion',
      'nombre',
      'direccion',
      'telefono',
      'email',
      'resolucion_dian',
      'fecha_resolucion',
      'rango_factura_desde',
      'rango_factura_hasta'
    ],
    campos_opcionales: [
      'prefijo_factura',
      'logo_url',
      'slogan'
    ],
    campos_no_requeridos: ['cufe', 'firma_digital'],
    texto_footer_adicional: `
      Resolución DIAN No. {resolucion} del {fecha}
      Rango autorizado del {prefijo}{desde} al {prefijo}{hasta}
    `
  },
  
  factura_electronica: {
    campos_obligatorios: [
      'nit',
      'digito_verificacion',
      'razon_social',
      'direccion',
      'telefono',
      'email',
      'resolucion_dian',
      'fecha_resolucion',
      'rango_factura_desde',
      'rango_factura_hasta',
      'clave_tecnica',
      'software_id',
      'pin_software'
    ],
    requiere_cufe: true,
    requiere_firma_digital: true,
    requiere_envio_dian: true,
    texto_footer_adicional: `
      Factura Electrónica de Venta
      Resolución DIAN No. {resolucion} del {fecha}
      CUFE: {cufe}
    `
  }
};

// Función de validación
export function validarConfiguracionFacturacion(empresa: any): {
  valido: boolean;
  nivel: string;
  errores: string[];
  advertencias: string[];
  puede_facturar: boolean;
} {
  const nivel = empresa.nivel_facturacion || 'documento_equivalente';
  const config = requerimientosPorNivel[nivel];
  const errores: string[] = [];
  const advertencias: string[] = [];
  
  // Validar campos obligatorios
  config.campos_obligatorios.forEach(campo => {
    if (!empresa[campo]) {
      errores.push(`Campo obligatorio faltante: ${campo}`);
    }
  });
  
  // Validar dígito de verificación (SIEMPRE)
  if (empresa.nit && !empresa.digito_verificacion) {
    errores.push('Falta el dígito de verificación del NIT');
  }
  
  // Validar coherencia de DV
  if (empresa.nit && empresa.digito_verificacion) {
    const dvCalculado = calcularDigitoVerificacion(empresa.nit);
    if (dvCalculado !== empresa.digito_verificacion) {
      errores.push(`Dígito de verificación incorrecto. Debería ser: ${dvCalculado}`);
    }
  }
  
  // Advertencias para campos opcionales
  config.campos_opcionales?.forEach(campo => {
    if (!empresa[campo]) {
      advertencias.push(`Se recomienda completar: ${campo}`);
    }
  });
  
  // Validación específica por nivel
  if (nivel === 'factura_pos' || nivel === 'factura_electronica') {
    // Validar rango de facturación
    if (empresa.rango_factura_desde >= empresa.rango_factura_hasta) {
      errores.push('El rango de facturación es inválido');
    }
    
    // Validar vigencia de resolución
    if (empresa.fecha_resolucion_hasta) {
      const hoy = new Date();
      const vigencia = new Date(empresa.fecha_resolucion_hasta);
      if (vigencia < hoy) {
        errores.push('La resolución DIAN está vencida');
      } else {
        const diasRestantes = Math.floor((vigencia - hoy) / (1000 * 60 * 60 * 24));
        if (diasRestantes < 30) {
          advertencias.push(`La resolución vence en ${diasRestantes} días`);
        }
      }
    }
  }
  
  if (nivel === 'factura_electronica') {
    if (!empresa.clave_tecnica || !empresa.software_id) {
      errores.push('Faltan credenciales de facturación electrónica DIAN');
    }
  }
  
  return {
    valido: errores.length === 0,
    nivel,
    errores,
    advertencias,
    puede_facturar: errores.length === 0
  };
}
```

---

## 🎨 Plantillas de Impresión por Nivel

### Template: Documento Equivalente

```javascript
function generarDocumentoEquivalente(venta, empresa, config) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: ${config.fuente || 'Arial'}; font-size: 10pt; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .nit { font-weight: bold; }
        .regimen { font-size: 8pt; font-style: italic; }
        .footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 8pt; }
      </style>
    </head>
    <body>
      <div class="header">
        ${empresa.logo_url ? `<img src="${empresa.logo_url}" style="max-width: 150px;">` : ''}
        <h2>${empresa.nombre}</h2>
        <p class="nit">NIT: ${empresa.nit}-${empresa.digito_verificacion}</p>
        <p>${empresa.direccion} - ${empresa.ciudad}</p>
        <p>Tel: ${empresa.telefono}${empresa.email ? ` - ${empresa.email}` : ''}</p>
        <p class="regimen">Régimen Simple de Tributación</p>
      </div>
      
      <div class="documento-info">
        <p><strong>Documento No:</strong> ${venta.id}</p>
        <p><strong>Fecha:</strong> ${new Date(venta.fecha_venta).toLocaleString('es-CO')}</p>
        ${venta.cliente_nombre ? `<p><strong>Cliente:</strong> ${venta.cliente_nombre}</p>` : ''}
      </div>
      
      <table style="width: 100%; margin-top: 20px;">
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th align="left">Producto</th>
            <th align="center">Cant.</th>
            <th align="right">Precio</th>
            <th align="right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${venta.detalles.map(d => `
            <tr>
              <td>${d.producto_nombre}</td>
              <td align="center">${d.cantidad}</td>
              <td align="right">$${d.precio_unitario.toLocaleString('es-CO')}</td>
              <td align="right">$${d.subtotal.toLocaleString('es-CO')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div style="margin-top: 20px; text-align: right;">
        <p><strong>TOTAL: $${venta.total.toLocaleString('es-CO')}</strong></p>
      </div>
      
      <div class="footer">
        <p style="text-align: center;">${config.mensaje_agradecimiento || 'Gracias por su compra'}</p>
        <p style="text-align: center; font-size: 7pt;">
          Documento Equivalente - No válido como factura<br>
          ${empresa.slogan || ''}
        </p>
      </div>
    </body>
    </html>
  `;
}
```

### Template: Factura POS

```javascript
function generarFacturaPOS(venta, empresa, config) {
  return `
    <!-- Similar al documento equivalente pero agregando: -->
    
    <div class="resolucion-dian" style="font-size: 8pt; text-align: center; margin: 15px 0; padding: 10px; background: #f0f0f0;">
      <strong>Factura POS No. ${empresa.prefijo_factura || 'POS'}-${venta.numero_factura}</strong><br>
      Resolución DIAN No. ${empresa.resolucion_dian}<br>
      del ${new Date(empresa.fecha_resolucion).toLocaleDateString('es-CO')}<br>
      Rango autorizado: ${empresa.prefijo_factura || 'POS'}-${empresa.rango_factura_desde} 
      al ${empresa.prefijo_factura || 'POS'}-${empresa.rango_factura_hasta}<br>
      ${empresa.vigencia_resolucion_hasta ? 
        `Vigencia hasta: ${new Date(empresa.vigencia_resolucion_hasta).toLocaleDateString('es-CO')}` 
        : ''}
    </div>
  `;
}
```

### Template: Factura Electrónica

```javascript
function generarFacturaElectronica(venta, empresa, config) {
  // Generar CUFE
  const cufe = generarCUFE(venta, empresa);
  const qrData = generarQRData(cufe, venta);
  
  return `
    <!-- Todo lo de factura POS +  -->
    
    <div class="cufe-section" style="margin: 20px 0; padding: 15px; background: #f9f9f9; border: 1px solid #ddd;">
      <p style="font-size: 7pt; word-break: break-all;">
        <strong>CUFE:</strong><br>
        ${cufe}
      </p>
      <div style="text-align: center; margin-top: 10px;">
        <img src="${generarQRCode(qrData)}" alt="QR Code" style="width: 100px; height: 100px;">
        <p style="font-size: 7pt;">Escanea para validar en DIAN</p>
      </div>
    </div>
    
    <div class="validacion-dian" style="text-align: center; font-size: 7pt; color: #666;">
      Factura Electrónica de Venta<br>
      Validada y autorizada por la DIAN<br>
      ${new Date().toISOString()}
    </div>
  `;
}
```

---

## 🚀 Plan de Migración

### Fase 1: Actualizar Base de Datos (INMEDIATO)

```sql
-- Archivo: scripts/migracion_niveles_facturacion.sql

-- 1. Agregar nuevo campo nivel_facturacion
ALTER TABLE empresas 
ADD COLUMN nivel_facturacion ENUM(
  'documento_equivalente',
  'factura_pos', 
  'factura_electronica'
) DEFAULT 'documento_equivalente' 
AFTER regimen_tributario;

-- 2. Migrar empresas existentes según datos actuales
-- Si tiene resolución DIAN → factura_pos (mínimo)
UPDATE empresas 
SET nivel_facturacion = 'factura_pos'
WHERE resolucion_dian IS NOT NULL 
  AND resolucion_dian != 'Pendiente'
  AND rango_factura_desde IS NOT NULL;

-- Si es gran contribuyente → factura_electronica
UPDATE empresas 
SET nivel_facturacion = 'factura_electronica'
WHERE gran_contribuyente = 1 OR autoretenedor = 1;

-- 3. IMPORTANTE: Todas las empresas necesitan DV
-- Calcular y actualizar DV faltantes (ejemplo: empresa 28 ya tiene '8')
-- Este script debe ejecutarse para cada empresa sin DV:
UPDATE empresas 
SET digito_verificacion = calcular_dv(nit)  -- Función a crear
WHERE digito_verificacion IS NULL;

-- 4. Agregar campos facturación electrónica
ALTER TABLE empresas 
ADD COLUMN responsabilidades_fiscales JSON DEFAULT NULL
  COMMENT 'Códigos DIAN: ["O-13","O-15","R-99-PN"]'
  AFTER gran_contribuyente,
ADD COLUMN actividad_economica VARCHAR(200) DEFAULT NULL
  COMMENT 'Código CIIU + descripción'
  AFTER responsabilidades_fiscales,
ADD COLUMN clave_tecnica VARCHAR(100) DEFAULT NULL
  AFTER resolucion_dian,
ADD COLUMN software_id VARCHAR(100) DEFAULT NULL
  AFTER clave_tecnica,
ADD COLUMN pin_software VARCHAR(100) DEFAULT NULL
  AFTER software_id,
ADD COLUMN ambiente_dian ENUM('habilitacion', 'produccion') DEFAULT 'habilitacion'
  AFTER pin_software;

-- 5. Actualizar tabla ventas para guardar CUFE (si aplica)
ALTER TABLE ventas 
ADD COLUMN cufe VARCHAR(255) DEFAULT NULL
  COMMENT 'Código Único Factura Electrónica'
  AFTER numero_factura,
ADD COLUMN xml_factura TEXT DEFAULT NULL
  COMMENT 'XML firmado enviado a DIAN'
  AFTER cufe,
ADD COLUMN estado_dian ENUM('pendiente', 'aceptada', 'rechazada') DEFAULT NULL
  AFTER xml_factura;
```

### Fase 2: Actualizar Backend (HOY - MAÑANA)

**Archivos a crear/modificar**:

1. `backend/src/utils/validacionFacturacion.ts` (código arriba)
2. `backend/src/utils/calcularDigitoVerificacion.ts` (ya existe, verificar)
3. `backend/src/utils/generarCUFE.ts` (nuevo, para factura electrónica)

**Modificar controlador**:

```typescript
// backend/src/platform/ventas/ventas.controller.ts

async crearVenta(req, res) {
  // ... código existente ...
  
  // NUEVO: Validar configuración antes de permitir venta
  const validacion = validarConfiguracionFacturacion(empresa);
  
  if (!validacion.puede_facturar) {
    return res.status(400).json({
      error: 'Configuración de facturación incompleta',
      nivel: validacion.nivel,
      errores: validacion.errores,
      advertencias: validacion.advertencias,
      mensaje: 'Debe completar la configuración de facturación en el módulo de Configuración > Empresa'
    });
  }
  
  // Si hay advertencias, permitir pero informar
  if (validacion.advertencias.length > 0) {
    console.warn('Advertencias configuración:', validacion.advertencias);
  }
  
  // ... continuar con creación de venta ...
}
```

### Fase 3: Actualizar Frontend (2-3 DÍAS)

**Modificar ventas.js**:

```javascript
// frontend/public/assets/js/ventas.js

async function imprimirFactura() {
  // NUEVO: Validar antes de imprimir
  const validacion = await fetch(`${API_URL}/empresas/${currentEmpresa.id}/validar-facturacion`)
    .then(r => r.json());
  
  if (!validacion.puede_facturar) {
    Swal.fire({
      icon: 'warning',
      title: 'Configuración Incompleta',
      html: `
        <p>Para imprimir facturas debe completar:</p>
        <ul style="text-align: left;">
          ${validacion.errores.map(e => `<li>${e}</li>`).join('')}
        </ul>
        <p class="mt-3">Nivel actual: <strong>${validacion.nivel}</strong></p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Ir a Configuración',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = '/configuracion-empresa.html';
      }
    });
    return;
  }
  
  // Si tiene advertencias, mostrar pero permitir continuar
  if (validacion.advertencias.length > 0) {
    const resultado = await Swal.fire({
      icon: 'info',
      title: 'Recomendaciones',
      html: `
        <p>Advertencias (opcional):</p>
        <ul style="text-align: left;">
          ${validacion.advertencias.map(a => `<li>${a}</li>`).join('')}
        </ul>
      `,
      showCancelButton: true,
      confirmButtonText: 'Continuar de todos modos',
      cancelButtonText: 'Cancelar'
    });
    
    if (!resultado.isConfirmed) return;
  }
  
  // Continuar con impresión según nivel
  const nivel = currentEmpresa.nivel_facturacion || 'documento_equivalente';
  
  switch(nivel) {
    case 'documento_equivalente':
      imprimirDocumentoEquivalente();
      break;
    case 'factura_pos':
      imprimirFacturaPOS();
      break;
    case 'factura_electronica':
      await imprimirFacturaElectronica(); // Async porque envía a DIAN
      break;
  }
}
```

**Nueva página de configuración**:

`frontend/public/configuracion-empresa.html`:
- Formulario para editar datos de empresa
- Selector de nivel de facturación
- Campos condicionales según nivel
- Indicador visual de qué campos faltan
- Botón "Calcular DV" automático

### Fase 4: Documentación y Capacitación

1. **Manual de usuario**:
   - ¿Qué nivel necesito según mi negocio?
   - ¿Cómo tramitar resolución DIAN?
   - ¿Cómo subir de nivel (equivalente → POS → electrónica)?

2. **FAQ**:
   - ¿Soy persona natural, tengo DV? → SÍ
   - ¿Puedo facturar sin resolución DIAN? → SÍ, con documento equivalente
   - ¿Cuándo debo pasar a factura electrónica? → Según ingresos y tipo de cliente

---

## ✅ Checklist de Implementación

### Inmediato (Hoy)
- [ ] Ejecutar script de migración SQL
- [ ] Crear función `calcular_dv()` en DB o backend
- [ ] Actualizar DV de empresa 28 (ya hecho: '8')
- [ ] Verificar que funcione impresión con documento equivalente

### Corto Plazo (Esta Semana)
- [ ] Implementar validación por niveles en backend
- [ ] Actualizar endpoint `/facturacion/configuracion/:id` para incluir nivel
- [ ] Modificar `imprimirFactura()` con validación previa
- [ ] Crear template "Documento Equivalente"
- [ ] Crear template "Factura POS"

### Mediano Plazo (Próximas 2 Semanas)
- [ ] Crear página configuración-empresa.html
- [ ] Implementar selector de nivel de facturación
- [ ] Crear wizard: "¿Qué nivel necesito?"
- [ ] Implementar generación de CUFE (para futuro)
- [ ] Documentación completa

### Largo Plazo (1-2 Meses)
- [ ] Integración con API DIAN (factura electrónica)
- [ ] Sistema de firma digital
- [ ] Envío automático a DIAN
- [ ] Generación de XML según estándar DIAN
- [ ] Sistema de alertas (resolución por vencer, rango agotándose)

---

## 📞 Contacto DIAN

**Para tramitar resolución de facturación**:
- Web: https://www.dian.gov.co
- Línea: 057 (601) 307 8064
- Agendamiento citas: https://www.dian.gov.co/atencionciudadano

**Proveedores Tecnológicos Autorizados** (para factura electrónica):
- Consultar listado actualizado en portal DIAN
- Recomendados: Siigo, Alegra, World Office, etc.

---

## 📝 Notas Finales

### Respuesta a tu pregunta:

**"¿Si el negocio es de una persona natural que utiliza el número de cédula como NIT, cómo se maneja el DV?"**

**R/**: Igual que cualquier otra empresa. La DIAN calcula el DV del número de cédula cuando la persona se inscribe en el RUT. Por ejemplo:
- Cédula: 1016085506
- NIT: 1016085506
- DV: 8 (calculado con algoritmo módulo 11)
- **Formato completo**: 1016085506-8

El campo `digito_verificacion` debe ser **OBLIGATORIO** para TODAS las empresas.

---

### Recomendación Final:

✅ **Implementa el sistema de 3 niveles propuesto**:
1. Permite a pequeños negocios empezar con "Documento Equivalente" (mínima configuración)
2. Facilita upgrade a "Factura POS" cuando tramiten resolución DIAN
3. Soporta "Factura Electrónica" para grandes empresas

✅ **Siempre solicita NIT-DV**: Es obligatorio por ley para todos

✅ **Valida según nivel**: No exijas resolución DIAN a quien no la necesita

✅ **Educa al usuario**: Muestra mensajes claros sobre qué nivel corresponde a su negocio

---

**Fecha de creación**: 3 de Junio 2026  
**Última actualización**: 3 de Junio 2026  
**Autor**: Sistema Kore Inventory  
**Revisión normativa**: Basada en Resoluciones DIAN vigentes 2026
