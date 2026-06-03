# 🔍 Análisis: Problemas de Impresión de Facturas

## 📊 **Estado Actual de la Empresa 28**

### ✅ Datos Completos:
- **Nombre**: CIGARRERIA AC
- **NIT**: 1016085506
- **Teléfono**: 318 3906457
- **Email**: bleidy@gmail.com
- **Dirección**: CRA 1, Funza
- **Régimen**: Simplificado
- **Tipo**: Persona Natural

### ⚠️ **Datos FALTANTES (NULL o vacíos):**

1. **digito_verificacion**: NULL
   - El código calcula esto dinámicamente, pero el campo en BD está vacío
   
2. **razon_social**: Solo tiene "CIGARRERIA AC" (igual que nombre)
   - Puede causar información duplicada en facturas

3. **slogan**: NULL
   - Se usa en algunas plantillas de factura

4. **logo_url**: NULL
   - No hay logo configurado
   - El código intenta mostrarlo si está configurado

5. **resolucion_dian**: NULL
   - **CRÍTICO** para facturación electrónica
   
6. **fecha_resolucion**: NULL
   - Fecha de la resolución DIAN

7. **rango_factura_desde**: NULL
   - Rango autorizado por DIAN desde

8. **rango_factura_hasta**: NULL
   - Rango autorizado por DIAN hasta

### ❌ **Configuración de Facturación:**
- **NO existe registro** en tabla `configuracion_factura` para empresa_id = 28
- El código usa valores por defecto, pero esto podría causar errores

---

## 🐛 **Posibles Errores al Imprimir:**

### 1. **Error de Dígito de Verificación**
```javascript
// En línea 2066 de ventas.js
const digitoVerificacion = calcularDigitoVerificacion(currentEmpresa.nit);
const nitCompleto = `${currentEmpresa.nit}-${digitoVerificacion}`;
```
**Problema**: Si `calcularDigitoVerificacion` no existe o falla, genera error.

### 2. **Campos NULL en la factura**
```javascript
// Intentos de acceder a propiedades NULL
${currentEmpresa.razon_social}  // Puede ser NULL
${currentEmpresa.slogan}        // NULL
${venta.cufe}                   // NULL (no hay facturación electrónica)
${venta.qr_code}                // NULL
```

### 3. **Configuración de plantilla faltante**
- El endpoint `/facturacion/configuracion/28` puede retornar 404
- El código maneja el error PERO puede haber logs de error confusos

### 4. **currentEmpresa no cargada**
```javascript
if (!currentEmpresa || !currentEmpresa.id) return;
```
Si currentEmpresa no está cargada cuando se intenta imprimir, falla silenciosamente.

---

## 💡 **Soluciones Propuestas:**

### **SOLUCIÓN 1: Crear Configuración de Facturación**
```sql
-- Crear configuración por defecto para empresa 28
INSERT INTO configuracion_factura (
    empresa_id, plantilla_id, mostrar_logo, logo_posicion,
    mostrar_slogan, color_primario, color_secundario,
    fuente, tamano_fuente, mensaje_agradecimiento,
    mostrar_qr, mostrar_cufe, mostrar_badges,
    mostrar_firma
) VALUES (
    28, 1, 0, 'centro',
    0, '#1E40AF', '#6c757d',
    'Arial', 10, 'Gracias por su compra',
    0, 0, 1,
    0
);
```

### **SOLUCIÓN 2: Actualizar Datos de Empresa**
```sql
-- Actualizar campos faltantes
UPDATE empresas SET
    razon_social = 'CIGARRERIA AC', -- O el nombre comercial correcto
    digito_verificacion = '4',      -- Calcular el DV real del NIT
    slogan = 'Tu tienda de confianza', -- Opcional
    resolucion_dian = 'En trámite',    -- O el número real si existe
    rango_factura_desde = 1,
    rango_factura_hasta = 99999
WHERE id = 28;
```

### **SOLUCIÓN 3: Validación Antes de Imprimir**
Agregar función de validación en `ventas.js`:

```javascript
function validarConfiguracionImpresion() {
    const errores = [];
    const advertencias = [];
    
    // Validar empresa
    if (!currentEmpresa) {
        errores.push('No hay empresa seleccionada');
        return { valido: false, errores, advertencias };
    }
    
    // Validar NIT
    if (!currentEmpresa.nit) {
        errores.push('La empresa no tiene NIT configurado');
    }
    
    // Validar datos básicos
    if (!currentEmpresa.nombre) {
        errores.push('La empresa no tiene nombre configurado');
    }
    
    // Advertencias para datos opcionales
    if (!currentEmpresa.razon_social) {
        advertencias.push('No hay razón social configurada');
    }
    
    if (!currentEmpresa.telefono) {
        advertencias.push('No hay teléfono configurado');
    }
    
    if (!currentEmpresa.direccion) {
        advertencias.push('No hay dirección configurada');
    }
    
    if (!currentEmpresa.logo_url) {
        advertencias.push('No hay logo configurado');
    }
    
    if (!currentEmpresa.resolucion_dian) {
        advertencias.push('No hay resolución DIAN (requerida para facturación electrónica)');
    }
    
    return {
        valido: errores.length === 0,
        errores,
        advertencias
    };
}
```

### **SOLUCIÓN 4: Alertas Antes de Imprimir**
Modificar función `imprimirFactura()`:

```javascript
function imprimirFactura() {
    if (!ultimaVentaGuardada || !ultimaVentaData) {
        mostrarAlerta('No hay factura para imprimir', 'warning');
        return;
    }
    
    // NUEVO: Validar configuración
    const validacion = validarConfiguracionImpresion();
    
    if (!validacion.valido) {
        Swal.fire({
            icon: 'error',
            title: 'Configuración Incompleta',
            html: `
                <p>No se puede imprimir la factura. Faltan los siguientes datos obligatorios:</p>
                <ul class="text-start">
                    ${validacion.errores.map(e => `<li class="text-danger">${e}</li>`).join('')}
                </ul>
                <p class="mt-3"><small>Por favor, complete estos datos en <strong>Configuración General</strong></small></p>
            `,
            confirmButtonText: 'Ir a Configuración',
            showCancelButton: true,
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = '/configuracion-general.html';
            }
        });
        return;
    }
    
    // Mostrar advertencias si las hay
    if (validacion.advertencias.length > 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Datos Opcionales Faltantes',
            html: `
                <p>La factura se imprimirá, pero faltan algunos datos recomendados:</p>
                <ul class="text-start">
                    ${validacion.advertencias.map(a => `<li class="text-warning">${a}</li>`).join('')}
                </ul>
                <p class="mt-3"><small>¿Desea continuar de todas formas?</small></p>
            `,
            confirmButtonText: 'Sí, Imprimir',
            showCancelButton: true,
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1E40AF'
        }).then((result) => {
            if (result.isConfirmed) {
                mostrarSelectorFormato();
            }
        });
    } else {
        // Todo OK, mostrar selector de formato
        mostrarSelectorFormato();
    }
}

function mostrarSelectorFormato() {
    Swal.fire({
        // ... código existente del selector de formato ...
    });
}
```

### **SOLUCIÓN 5: Manejo de Errores en Plantilla**
Modificar generación HTML para manejar NULL:

```javascript
function generarPlantillaClasicaCarta(venta, ventaData, config, fecha, nitCompleto, ...) {
    // Calcular DV de forma segura
    const dv = currentEmpresa.digito_verificacion || 
               (currentEmpresa.nit ? calcularDigitoVerificacion(currentEmpresa.nit) : '');
    const nitCompleto = currentEmpresa.nit ? `${currentEmpresa.nit}-${dv}` : 'N/A';
    
    // Usar valores por defecto para campos opcionales
    const razonSocial = currentEmpresa.razon_social || currentEmpresa.nombre;
    const telefono = currentEmpresa.telefono || '';
    const direccion = currentEmpresa.direccion || '';
    const slogan = currentEmpresa.slogan || '';
    
    return `...HTML con valores seguros...`;
}
```

---

## 📋 **Plan de Acción Recomendado:**

### **Fase 1: Configuración Básica (URGENTE)**
1. ✅ Crear registro en `configuracion_factura`
2. ✅ Completar datos básicos de empresa
3. ✅ Calcular y guardar dígito de verificación

### **Fase 2: Validaciones (IMPORTANTE)**
4. ⏳ Agregar función de validación
5. ⏳ Mostrar alertas antes de imprimir
6. ⏳ Guiar al usuario a configuración

### **Fase 3: Mejoras Futuras (OPCIONAL)**
7. ⏳ Sección de "Preparación para Producción"
8. ⏳ Checklist de configuración inicial
9. ⏳ Wizard de configuración para nuevas empresas

---

## 🧪 **Cómo Probar:**

### **Escenario 1: Sin configuración**
1. Intentar imprimir factura
2. Debería mostrar error claro con datos faltantes
3. Botón para ir a configuración

### **Escenario 2: Con configuración parcial**
1. Configurar solo datos básicos
2. Imprimir factura
3. Debería mostrar advertencias pero permitir imprimir

### **Escenario 3: Configuración completa**
1. Configurar todos los datos
2. Imprimir factura
3. Debería funcionar sin errores ni advertencias

---

## ✅ **Checklist de Configuración Mínima:**

Para que la impresión funcione correctamente:

- [ ] Nombre de empresa
- [ ] NIT con dígito de verificación
- [ ] Teléfono
- [ ] Dirección completa
- [ ] Ciudad
- [ ] Email
- [ ] Razón social (puede ser igual al nombre)
- [ ] Registro en `configuracion_factura`
- [ ] (Opcional) Logo
- [ ] (Opcional) Slogan
- [ ] (Futuro) Resolución DIAN (para facturación electrónica)

---

**Fecha**: 2026-06-03  
**Empresa**: CIGARRERIA AC (ID: 28)  
**Estado**: Requiere configuración antes de usar impresión en producción
