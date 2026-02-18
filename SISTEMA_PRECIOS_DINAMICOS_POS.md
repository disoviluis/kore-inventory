# 🎯 SISTEMA DE PRECIOS DINÁMICOS EN POS - IMPLEMENTACIÓN COMPLETA

**Fecha:** 18 de Febrero, 2026
**Autor:** Disovi Soft - KORE Inventory

---

## 📋 RESUMEN EJECUTIVO

Se ha implementado un sistema completo de gestión de precios dinámicos en el punto de venta (POS), inspirado en las mejores prácticas de SIIGO y otros sistemas empresariales modernos.

### ✅ Características Implementadas

1. **Precios Límite (Mínimo y Máximo)** en productos
2. **Selector de Tipo de Precio** en el POS (Minorista, Mayorista, Distribuidor, Manual)
3. **Edición Manual de Precios** con validaciones en tiempo real
4. **Alertas Visuales** cuando el precio está fuera de rango
5. **Confirmación de Seguridad** antes de vender por debajo/encima de límites

---

## 🗄️ 1. BASE DE DATOS

### Archivo: `SQL/migration_precios_min_max.sql`

**Campos agregados a la tabla `productos`:**

```sql
precio_minimo DECIMAL(10, 2) NULL     -- Precio mínimo permitido
precio_maximo DECIMAL(10, 2) NULL     -- Precio máximo sugerido
```

**Ejecución:**
```bash
# Conectarse a la base de datos
mysql -u root -p kore_inventory

# Ejecutar migración
source SQL/migration_precios_min_max.sql;
```

**Valores por defecto establecidos:**
- `precio_minimo` = `precio_compra` (costo del producto)
- `precio_maximo` = `precio_minorista × 1.5`

---

## 🎨 2. FRONTEND - MÓDULO DE PRODUCTOS

### productos.html

**Nuevos campos en el modal:**

```html
<!-- Precios Límite (Control POS) -->
<div class="col-12 mt-3">
    <h6 class="border-bottom pb-2">
        <i class="bi bi-shield-check me-2"></i>Límites de Precio (Control POS)
    </h6>
    <div class="alert alert-info alert-sm py-2">
        Estos límites se usan para validar precios manuales en el punto de venta
    </div>
</div>

<!-- Precio Mínimo -->
<div class="col-md-6">
    <label>Precio Mínimo</label>
    <div class="input-group">
        <span class="input-group-text">$</span>
        <input type="number" id="productoPrecioMinimo" step="0.01" min="0">
        <button class="btn btn-outline-secondary" id="btnCalcMinimo" 
                title="Costo + 5%">
            <i class="bi bi-calculator"></i> Costo+5%
        </button>
    </div>
    <small class="text-muted">Precio mínimo permitido (costo + margen)</small>
</div>

<!-- Precio Máximo -->
<div class="col-md-6">
    <label>Precio Máximo</label>
    <div class="input-group">
        <span class="input-group-text">$</span>
        <input type="number" id="productoPrecioMaximo" step="0.01" min="0">
        <button class="btn btn-outline-secondary" id="btnCalcMaximo" 
                title="Minorista + 50%">
            <i class="bi bi-calculator"></i> Min+50%
        </button>
    </div>
    <small class="text-muted">Evita errores de digitación</small>
</div>
```

### productos.js

**Funcionalidades agregadas:**

1. **Calculadoras automáticas:**
```javascript
// Calcular precio mínimo = Costo + 5%
btnCalcMinimo.addEventListener('click', () => {
    const costo = parseFloat(precioCompra.value) || 0;
    if (costo > 0) {
        productoPrecioMinimo.value = (costo * 1.05).toFixed(2);
    }
});

// Calcular precio máximo = Minorista + 50%
btnCalcMaximo.addEventListener('click', () => {
    const minorista = parseFloat(precioMinorista.value) || 0;
    if (minorista > 0) {
        productoPrecioMaximo.value = (minorista * 1.5).toFixed(2);
    }
});
```

2. **Guardar y cargar precios:**
```javascript
// Al guardar
precio_minimo: parseFloat(document.getElementById('productoPrecioMinimo').value) || null,
precio_maximo: parseFloat(document.getElementById('productoPrecioMaximo').value) || null,

// Al cargar
document.getElementById('productoPrecioMinimo').value = producto.precio_minimo || '';
document.getElementById('productoPrecioMaximo').value = producto.precio_maximo || '';
```

---

## 🛒 3. PUNTO DE VENTA (POS)

### ventas.js - Funcionalidades Principales

#### A. Renderizado de Productos con Selector de Precio

```javascript
function renderizarProductos() {
    // Para cada producto en la venta:
    
    // 1. Alertas visuales según el precio
    let clasePrecio = '';
    let alertaPrecio = '';
    
    if (p.precio_minimo && p.precio_unitario < p.precio_minimo) {
        clasePrecio = 'border-danger';
        alertaPrecio = '⚠️ Por debajo del mínimo';
    } else if (p.precio_maximo && p.precio_unitario > p.precio_maximo) {
        clasePrecio = 'border-warning';
        alertaPrecio = '⚠️ Por encima del máximo';
    }
    
    // 2. Selector de tipo de precio
    <select onchange="cambiarTipoPrecio(${index}, this.value)">
        <option value="${precio_minorista}">Minorista</option>
        <option value="${precio_mayorista}">Mayorista</option>
        <option value="${precio_distribuidor}">Distribuidor</option>
        <option value="manual">✏️ Manual</option>
    </select>
    
    // 3. Input para edición manual
    <input type="number" 
           value="${p.precio_unitario}"
           onchange="actualizarPrecio(${index}, this.value)">
}
```

#### B. Validación al Actualizar Precio

```javascript
function actualizarPrecio(index, valor) {
    const precio = parseFloat(valor);
    const producto = productosVenta[index];
    
    // Validar precio mínimo
    if (producto.precio_minimo && precio < producto.precio_minimo) {
        const confirma = confirm(
            `⚠️ ALERTA: El precio ($${precio}) está por debajo del mínimo ($${producto.precio_minimo}).\n\n¿Continuar?`
        );
        if (!confirma) {
            renderizarProductos();
            return;
        }
    }
    
    // Validar precio máximo
    if (producto.precio_maximo && precio > producto.precio_maximo) {
        const confirma = confirm(
            `⚠️ ALERTA: El precio ($${precio}) está por encima del máximo ($${producto.precio_maximo}).\n\n¿Continuar?`
        );
        if (!confirma) {
            renderizarProductos();
            return;
        }
    }
    
    // Actualizar precio
    producto.precio_unitario = precio;
    producto.subtotal = producto.cantidad * precio;
    
    renderizarProductos();
    calcularTotales();
}
```

#### C. Cambio de Tipo de Precio

```javascript
function cambiarTipoPrecio(index, valor) {
    const producto = productosVenta[index];
    
    if (valor === 'manual') {
        // Enfocar el input para edición manual
        setTimeout(() => {
            document.getElementById(`precioInput${index}`).focus();
        }, 100);
        return;
    }
    
    // Aplicar precio seleccionado
    const nuevoPrecio = parseFloat(valor);
    producto.precio_unitario = nuevoPrecio;
    producto.subtotal = producto.cantidad * nuevoPrecio;
    
    renderizarProductos();
    calcularTotales();
}
```

#### D. Agregar Productos con Todos los Precios

```javascript
function agregarProducto(producto) {
    const precioUnitario = parseFloat(producto.precio_minorista);
    
    productosVenta.push({
        id: producto.id,
        nombre: producto.nombre,
        sku: producto.sku,
        precio_unitario: precioUnitario,
        
        // Todos los niveles de precio
        precio_minorista: producto.precio_minorista || precioUnitario,
        precio_mayorista: producto.precio_mayorista || null,
        precio_distribuidor: producto.precio_distribuidor || null,
        
        // Límites de validación
        precio_minimo: producto.precio_minimo || null,
        precio_maximo: producto.precio_maximo || null,
        
        cantidad: 1,
        stock_disponible: producto.stock_actual,
        subtotal: precioUnitario,
        // ... otros campos
    });
    
    renderizarProductos();
    calcularTotales();
}
```

---

## ⚙️ 4. BACKEND - API

### productos.controller.ts

**Cambios realizados:**

1. **SELECT - Incluir nuevos campos:**
```typescript
p.precio_minimo,
p.precio_maximo,
```

2. **CREATE - Agregar campos en destructuring:**
```typescript
const {
    // ... otros campos
    precio_minimo,
    precio_maximo,
} = req.body;
```

3. **CREATE - INSERT con nuevos campos:**
```typescript
INSERT INTO productos (
    // ... otros campos
    precio_minimo,
    precio_maximo,
    // ...
) VALUES (?, ?, ..., ?, ?, ...)

// Parámetros
precio_minimo || null,
precio_maximo || null,
```

4. **UPDATE - Incluir en actualización dinámica:**
```typescript
if (precio_minimo !== undefined) {
    updates.push('precio_minimo = ?');
    values.push(precio_minimo);
}
if (precio_maximo !== undefined) {
    updates.push('precio_maximo = ?');
    values.push(precio_maximo);
}
```

---

## 🎨 5. INTERFAZ DE USUARIO - POS

### Diseño Visual

```
┌──────────────────────────────────────────────────────────────┐
│ PRODUCTO: Monitor LG 24" Full HD                             │
│ SKU: MON-LG-24FHD | Stock: 15                               │
├──────────────────────────────────────────────────────────────┤
│  Cantidad    │  Tipo de Precio          │  Subtotal          │
│  [−] 2 [+]   │  [Mayorista ▼]          │  $700,000         │
│              │  $ 350,000               │                    │
│              │  ⚠️ Por debajo del mínimo  │                    │
└──────────────────────────────────────────────────────────────┘
```

### Estados Visuales

| Estado | Color de Borde | Icono | Mensaje |
|--------|---------------|-------|---------|
| **Normal** | Gris | - | - |
| **< Mínimo** | 🔴 Rojo | ⚠️ | Por debajo del mínimo ($XXX) |
| **> Máximo** | 🟡 Amarillo | ⚠️ | Por encima del máximo ($XXX) |
| **Contra Pedido** | 🟠 Naranja | 🕒 | Contra Pedido |

---

## 📊 6. FLUJO DE TRABAJO

### Caso de Uso 1: Vendedor Cambia a Precio Mayorista

1. Vendedor agrega producto (precio minorista por defecto: $100,000)
2. Cliente es mayorista, vendedor selecciona "Mayorista" en el dropdown
3. Precio cambia automáticamente a $90,000
4. Se recalculan totales
5. No hay alertas (está dentro del rango permitido)

### Caso de Uso 2: Vendedor Intenta Precio por Debajo del Mínimo

1. Producto tiene:
   - Costo: $50,000
   - Precio mínimo: $52,500 (costo + 5%)
   - Precio minorista: $100,000
2. Vendedor selecciona "Manual" y digita $50,000
3. Sistema detecta que $50,000 < $52,500
4. **Alerta:** "⚠️ El precio está por debajo del mínimo permitido ($52,500). ¿Continuar?"
5. Si acepta: Se permite la venta (queda registrado en auditoría)
6. Si cancela: Vuelve al precio anterior

### Caso de Uso 3: Vendedor Aumenta Precio

1. Producto precio minorista: $100,000, precio máximo: $150,000
2. Vendedor negocia y sube el precio a $120,000
3. No hay alerta (está dentro del rango)
4. Se registra la venta con margen aumentado

---

## 🔒 7. SEGURIDAD Y AUDITORÍA

### Campos Registrados en Venta

```javascript
venta_detalle: {
    producto_id: 123,
    precio_unitario: 95000,  // Precio aplicado
    cantidad: 2,
    subtotal: 190000
}
```

### Recomendaciones Futuras

1. **Auditoría de cambios de precio:**
```sql
CREATE TABLE precio_modificaciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    venta_id INT,
    producto_id INT,
    precio_original DECIMAL(10,2),
    precio_aplicado DECIMAL(10,2),
    motivo VARCHAR(255),
    usuario_id INT,
    fecha_modificacion TIMESTAMP
);
```

2. **Permisos por rol:**
```javascript
if (usuario.rol !== 'admin' && precio < producto.precio_minimo) {
    mostrarAlerta('Requiere autorización de supervisor', 'warning');
    // Solicitar PIN de supervisor
}
```

3. **Razón del cambio:**
```javascript
if (precio !== precioOriginal) {
    const motivo = prompt('Indique la razón del cambio de precio:');
    // Guardar motivo en la base de datos
}
```

---

## 📱 8. CÓMO LO MANEJA SIIGO

### Comparación con SIIGO

| Característica | KORE Inventory | SIIGO |
|---------------|----------------|--------|
| **Múltiples precios** | ✅ 3 niveles | ✅ 5 listas personalizables |
| **Selector en POS** | ✅ Dropdown | ✅ Botones grandes |
| **Edición manual** | ✅ Con validación | ✅ Con validación |
| **Alertas visuales** | ✅ Colores de borde | ✅ Modales |
| **Precios mín/máx** | ✅ Implementado | ✅ Con límites por usuario |
| **Auditoría** | 🟡 Básica | ✅ Completa |
| **Permisos** | 🟡 Por implementar | ✅ Por rol y usuario |

---

## 🚀 9. PRUEBAS RECOMENDADAS

### Test 1: Crear Producto con Precios Límite
```
1. Ir a Productos → Nuevo Producto
2. Ingresar:
   - Costo: $50,000
   - Minorista: $100,000
   - Mayorista: $90,000
   - Distribuidor: $80,000
3. Clic en "Costo+5%" → debe calcular $52,500
4. Clic en "Min+50%" → debe calcular $150,000
5. Guardar producto
```

### Test 2: Venta Normal con Selector de Precio
```
1. Ir a POS
2. Agregar cliente
3. Agregar producto (precio minorista por defecto)
4. Cambiar selector a "Mayorista"
5. Verificar que precio cambia automáticamente
6. Completar venta
```

### Test 3: Validación de Precio Mínimo
```
1. Agregar producto al POS
2. Seleccionar "Manual"
3. Ingresar precio menor al mínimo
4. Verificar que aparece alerta
5. Confirmar o cancelar
```

### Test 4: Validación de Precio Máximo
```
1. Agregar producto al POS
2. Editar precio manualmente
3. Ingresar precio mayor al máximo
4. Verificar alerta amarilla
5. Confirmar o cancelar
```

---

## 📝 10. CHECKLIST DE IMPLEMENTACIÓN

- [✅] Crear migración SQL
- [✅] Ejecutar migración en base de datos
- [✅] Actualizar modal de productos (HTML)
- [✅] Actualizar productos.js (cargar/guardar)
- [✅] Actualizar backend productos.controller.ts (SELECT/INSERT/UPDATE)
- [✅] Modificar renderizado de productos en POS
- [✅] Implementar función cambiarTipoPrecio()
- [✅] Implementar validaciones en actualizarPrecio()
- [✅] Agregar alertas visuales (colores de borde)
- [✅] Incluir precios en agregarProducto()
- [✅] Probar flujo completo

---

## 🎓 11. CAPACITACIÓN PARA USUARIOS

### Para Administradores

**Configurar precios límite:**
1. Ingresa a "Productos"
2. Edita un producto
3. Navega a "Límites de Precio (Control POS)"
4. Define:
   - **Precio Mínimo**: Costo + margen mínimo aceptable
   - **Precio Máximo**: Precio tope (evita errores)
5. Puedes usar las calculadoras automáticas

### Para Vendedores

**Cambiar precio en una venta:**
1. Agrega el producto al carrito
2. Usa el selector "Tipo de Precio" para cambiar a Mayorista/Distribuidor
3. O selecciona "✏️ Manual" para digitar un precio personalizado
4. Si el precio está fuera de rango, aparecerá una alerta
5. Confirma o cancela según la situación

**Interpretación de alertas:**
- 🔴 **Borde rojo**: Precio por debajo del mínimo (requiere confirmación)
- 🟡 **Borde amarillo**: Precio por encima del máximo (verificar error)

---

## 🔧 12. MANTENIMIENTO

### Actualizar Precios Límite Masivamente

```sql
-- Actualizar precio mínimo = costo + 10% para todos los productos
UPDATE productos 
SET precio_minimo = precio_compra * 1.10 
WHERE precio_compra > 0;

-- Actualizar precio máximo = minorista + 50% para todos los productos
UPDATE productos 
SET precio_maximo = precio_minorista * 1.50 
WHERE precio_minorista > 0;
```

### Verificar Productos sin Límites

```sql
SELECT id, nombre, precio_compra, precio_minorista, precio_minimo, precio_maximo
FROM productos
WHERE precio_minimo IS NULL OR precio_maximo IS NULL
ORDER BY nombre;
```

---

## 📞 SOPORTE

**Desarrollado por:** Disovi Soft
**Sistema:** KORE Inventory ERP SaaS
**Versión:** 2.0.0
**Fecha:** Febrero 2026

Para soporte técnico, contactar al administrador del sistema.

---

✅ **IMPLEMENTACIÓN COMPLETA Y FUNCIONAL**
