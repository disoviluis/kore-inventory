# Cambios Implementados en Frontend - Módulo de Productos

## Resumen
Se implementó completamente el sistema de **precios múltiples (3 niveles)** y **gestión de IVA** en el módulo de productos del frontend.

---

## Archivos Modificados

### 1. frontend/public/productos.html

#### Cambios Principales:

**Modal de Producto - Sección de Tipo:**
- Agregado selector `productoTipo` (producto/servicio)
- Campo oculto `productoManejaInventario` que cambia automáticamente según el tipo

**Modal de Producto - Sección de Precios:**
- Renombrado `productoPrecioVenta` → `productoPrecioMinorista`
- Agregados nuevos campos:
  - `productoPrecioMayorista` con botón calculadora (-10%)
  - `productoPrecioDistribuidor` con botón calculadora (-20%)
- Cada precio muestra un badge dinámico con el margen calculado:
  - `margenMinorista` (badge azul)
  - `margenMayorista` (badge verde)
  - `margenDistribuidor` (badge amarillo)
- Alerta de validación: `alertJerarquiaPrecios` (muestra si precios no cumplen jerarquía)

**Modal de Producto - Sección de IVA:**
- Checkbox `productoAplicaIVA` (activado por defecto)
- Select `productoPorcentajeIVA` con opciones: 0%, 5%, 19%
- Select `productoTipoImpuesto` (gravado, exento, excluido)

**Modal de Producto - Tabla Resumen:**
- Tabla dinámica `tablaResumenPrecios` que muestra:
  - Precio Base
  - IVA calculado
  - Precio Final (Base + IVA)
  - Margen % (colorizado según rango)
- Se actualiza en tiempo real cuando cambian precios o configuración de IVA

**Modal de Producto - Sección de Inventario:**
- Sección `seccionInventario` que se oculta automáticamente cuando tipo = "servicio"

**Campos Opcionales Agregados (futuro):**
- `productoCuentaIngreso`, `productoCuentaCosto`, `productoCuentaInventario`, `productoCuentaGasto`
- Preparados para integración contable

---

### 2. frontend/public/assets/js/productos.js

#### Funciones Nuevas:

**`calcularMargenes()`**
- Calcula margen de cada nivel de precio: `(precioVenta - precioCompra) / precioCompra * 100`
- Actualiza badges con colores:
  - Rojo: < 10%
  - Amarillo: 10-20%
  - Info: 20-30%
  - Verde: > 30%
- Llama a `validarJerarquiaPrecios()` y `updateTablaResumenPrecios()`

**`actualizarBadgeMargen(elementId, margen)`**
- Actualiza visualmente cada badge de margen con color dinámico
- Formato: "XX.X%"

**`validarJerarquiaPrecios(minorista, mayorista, distribuidor)`**
- Valida que: `distribuidor < mayorista < minorista`
- Muestra alerta visual si no se cumple la jerarquía
- Oculta alerta si precios son válidos

**`updateTablaResumenPrecios()`**
- Calcula IVA por cada nivel de precio
- Calcula precio final (base + IVA)
- Calcula margen % y lo coloriza
- Formato de moneda: `$XX,XXX.XX` (estilo colombiano)
- Muestra solo precios ingresados (oculta filas con valor 0)

**`getMargenBadgeClass(margen)`**
- Función auxiliar para clasificar márgenes por color
- Retorna clases Bootstrap según rangos

#### Funciones Modificadas:

**`initEventListeners()`**
- Agregados event listeners para:
  - Inputs de precios (compra, minorista, mayorista, distribuidor) → `calcularMargenes()`
  - Botones calculadora (`btnCalcMayorista`, `btnCalcDistribuidor`) → Cálculo automático de descuentos
  - Checkbox y select de IVA → `updateTablaResumenPrecios()`
  - Select `productoTipo` → Mostrar/ocultar sección inventario

**`abrirModalNuevo()`**
- Inicializa valores por defecto:
  - `tipo = "producto"`
  - `manejaInventario = true`
  - `aplicaIVA = true`
  - `porcentajeIVA = 19%`
  - `tipoImpuesto = "IVA"`
- Limpia badges de margen
- Limpia alertas de validación
- Muestra sección de inventario por defecto

**`editarProducto(id)`**
- Carga todos los nuevos campos desde el objeto producto:
  - `tipo`, `maneja_inventario`
  - `precio_minorista`, `precio_mayorista`, `precio_distribuidor`
  - `aplica_iva`, `porcentaje_iva`, `tipo_impuesto`
  - Cuentas contables (si existen)
- Compatibilidad con datos viejos: `precio_minorista || precio_venta`
- Oculta sección inventario si tipo = "servicio"
- Llama a `calcularMargenes()` para actualizar interfaz

**`guardarProducto(e)`**
- Valida jerarquía de precios antes de enviar
- Construye objeto con todos los nuevos campos:
  - `tipo`, `maneja_inventario`
  - `precio_minorista`, `precio_mayorista`, `precio_distribuidor`
  - `aplica_iva`, `porcentaje_iva`, `tipo_impuesto`
  - Cuentas contables (opcionales)
- Conversión correcta de tipos de datos:
  - `maneja_inventario`: string → number (0/1)
  - `aplica_iva`: boolean → number (0/1)
  - Precios vacíos → null
  - IVA null si no aplica

**`renderizarProductos(items)`**
- Muestra badges visuales por producto:
  - Badge "Producto" (azul) o "Servicio" (info)
  - Badge "IVA" (verde) si aplica, con porcentaje en tooltip
  - Badge de margen % (colorizado)
- Columna de precios mejorada:
  - Precio minorista destacado (azul, bold)
  - Debajo: precio mayorista (pequeño, gris)
  - Debajo: precio distribuidor (pequeño, gris)
  - Formato monetario colombiano
- Stock muestra "N/A" para servicios
- Compatibilidad: usa `precio_minorista || precio_venta`

---

## Comportamiento del Sistema

### Cálculo Automático de Precios
1. Usuario ingresa precio minorista: **$10,000**
2. Click en botón "Calcular Mayorista" (-10%):
   - Se auto-completa: **$9,000**
3. Click en botón "Calcular Distribuidor" (-20%):
   - Se auto-completa: **$8,000**

### Validación en Tiempo Real
- Mientras el usuario escribe precios, se valida:
  - ❌ Si distribuidor ≥ mayorista → Alerta roja
  - ❌ Si mayorista ≥ minorista → Alerta roja
  - ✅ Si jerarquía correcta → Alerta oculta

### Cálculo de Márgenes
- Ejemplo con `precioCompra = $5,000`:
  - Margen minorista: `(10000-5000)/5000 = 100%` → Badge verde
  - Margen mayorista: `(9000-5000)/5000 = 80%` → Badge verde
  - Margen distribuidor: `(8000-5000)/5000 = 60%` → Badge verde

### Cálculo de IVA
- Si IVA activado al 19%:
  - Minorista: $10,000 + $1,900 = **$11,900**
  - Mayorista: $9,000 + $1,710 = **$10,710**
  - Distribuidor: $8,000 + $1,520 = **$9,520**

### Productos vs Servicios
- **Producto seleccionado:**
  - Sección inventario visible
  - `maneja_inventario = 1`
  - Stock se muestra en tabla
  
- **Servicio seleccionado:**
  - Sección inventario oculta
  - `maneja_inventario = 0`
  - Stock muestra "N/A" en tabla

---

## Compatibilidad con Datos Existentes

El código mantiene compatibilidad con productos creados antes de la migración:

```javascript
// Al editar un producto viejo
precio_minorista: producto.precio_minorista || producto.precio_venta

// Al renderizar
const precioVenta = prod.precio_minorista || prod.precio_venta || 0;
```

Esto permite que:
- Productos viejos con solo `precio_venta` sigan funcionando
- Productos nuevos usen `precio_minorista` correctamente

---

## Estilos y UX

### Badges de Margen (colorización automática)
- **Rojo** (< 10%): Margen muy bajo, revisar costos
- **Amarillo** (10-20%): Margen aceptable
- **Info** (20-30%): Margen bueno
- **Verde** (> 30%): Margen excelente

### Tabla Resumen
- Solo muestra precios ingresados (oculta filas con $0)
- Formato monetario colombiano ($XX,XXX.XX)
- Márgenes colorizados para análisis rápido
- Se actualiza en tiempo real mientras se editan campos

### Validaciones Visuales
- Alerta amarilla con ícono de advertencia para jerarquía inválida
- Desaparece automáticamente cuando se corrige el error
- Previene guardar si validación falla

---

## Próximos Pasos Sugeridos

1. **Probar funcionalidad completa:**
   - Crear producto nuevo con 3 precios
   - Crear servicio (verificar que oculta inventario)
   - Editar producto existente
   - Verificar cálculos de margen e IVA

2. **Validar en diferentes escenarios:**
   - Producto sin IVA
   - Producto con solo precio minorista
   - Producto con los 3 precios
   - Servicio simple

3. **Implementar módulos pendientes:**
   - Bodegas (gestión de almacenes)
   - Traslados (movimientos entre bodegas)

---

## Notas Técnicas

- El código JavaScript está completamente modularizado
- Todas las funciones tienen responsabilidad única (SRP)
- Event listeners centralizados en `initEventListeners()`
- Validaciones separadas de la lógica de negocio
- Sin dependencias externas (solo Bootstrap + vanilla JS)
- Compatible con todos los navegadores modernos

---

## Resumen de Campos del Formulario

| Campo | ID | Tipo | Obligatorio | Notas |
|-------|---|------|-------------|-------|
| Tipo | `productoTipo` | Select | Sí | producto/servicio |
| Precio Compra | `productoPrecioCompra` | Number | No | Costo base |
| Precio Minorista | `productoPrecioMinorista` | Number | Sí | Precio público |
| Precio Mayorista | `productoPrecioMayorista` | Number | No | 10% menos sugerido |
| Precio Distribuidor | `productoPrecioDistribuidor` | Number | No | 20% menos sugerido |
| Aplica IVA | `productoAplicaIVA` | Checkbox | - | Default: true |
| Porcentaje IVA | `productoPorcentajeIVA` | Select | - | 0%, 5%, 19% |
| Tipo Impuesto | `productoTipoImpuesto` | Select | - | gravado/exento/excluido |

---

## Fecha de Implementación
**Diciembre 2024** - Sistema de Precios Múltiples y Gestión de IVA
