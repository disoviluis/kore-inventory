# 💰 SISTEMA DE MÚLTIPLES PRECIOS Y TRASLADOS ENTRE BODEGAS

## 📌 CARACTERÍSTICAS ADICIONALES CRÍTICAS

Este documento complementa las mejoras SIIGO con dos funcionalidades esenciales:

1. **Sistema de 3 Niveles de Precio** (Minorista, Mayorista, Distribuidor)
2. **Módulo de Traslados entre Bodegas**

---

## 💵 SISTEMA DE MÚLTIPLES PRECIOS

### 🎯 **CONCEPTO**

Los productos pueden tener diferentes precios según el tipo de cliente:

| Nivel | Descripción | Descuento Típico | Ejemplo |
|-------|-------------|------------------|---------|
| **Minorista** | Precio público (precio normal) | 0% | $100.000 |
| **Mayorista** | Cliente que compra en cantidad | 10-15% | $85.000 |
| **Distribuidor** | Revendedores autorizados | 20-30% | $70.000 |

### 📊 **ESTRUCTURA DE DATOS**

```sql
-- Campos en tabla productos
precio_compra DECIMAL(15,2)          -- Costo
precio_minorista DECIMAL(15,2)       -- Precio público (antes precio_venta)
precio_mayorista DECIMAL(15,2)       -- Precio mayorista (10% desc)
precio_distribuidor DECIMAL(15,2)    -- Precio distribuidor (20% desc)
```

### ✅ **VALIDACIONES REQUERIDAS**

```javascript
// Validar jerarquía de precios
function validarPreciosProducto(precios) {
  const { compra, minorista, mayorista, distribuidor } = precios;
  
  // 1. Precio minorista debe ser mayor al costo
  if (minorista <= compra) {
    return { valid: false, error: 'Precio minorista debe ser mayor al costo' };
  }
  
  // 2. Mayorista debe ser menor o igual a minorista
  if (mayorista && mayorista > minorista) {
    return { valid: false, error: 'Precio mayorista debe ser menor o igual al minorista' };
  }
  
  // 3. Distribuidor debe ser menor o igual a mayorista
  if (distribuidor && mayorista && distribuidor > mayorista) {
    return { valid: false, error: 'Precio distribuidor debe ser menor o igual al mayorista' };
  }
  
  // 4. Todos deben ser mayores al costo (advertencia, no error)
  if (distribuidor && distribuidor <= compra) {
    console.warn('⚠️ Precio distribuidor genera pérdida');
  }
  
  return { valid: true };
}
```

### 🎨 **INTERFAZ DE USUARIO**

#### **Formulario de Producto**

```html
<!-- Sección de Precios -->
<div class="col-12 mt-4">
    <h6 class="border-bottom pb-2">
        <i class="bi bi-cash-stack me-2"></i>Precios
    </h6>
</div>

<!-- Precio de Compra -->
<div class="col-md-6">
    <label class="form-label">Precio de Compra (Costo)</label>
    <div class="input-group">
        <span class="input-group-text">$</span>
        <input type="number" class="form-control" id="precioCompra" 
               step="0.01" min="0" required>
    </div>
    <small class="text-muted">Costo del producto</small>
</div>

<!-- Precio Minorista -->
<div class="col-md-6">
    <label class="form-label">
        Precio Minorista <span class="text-danger">*</span>
        <span class="badge bg-primary" id="margenMinorista">Margen: 0%</span>
    </label>
    <div class="input-group">
        <span class="input-group-text">$</span>
        <input type="number" class="form-control" id="precioMinorista" 
               step="0.01" min="0" required>
    </div>
    <small class="text-muted">Precio público (venta al detal)</small>
</div>

<!-- Precio Mayorista -->
<div class="col-md-6">
    <label class="form-label">
        Precio Mayorista
        <span class="badge bg-success" id="margenMayorista">Margen: 0%</span>
    </label>
    <div class="input-group">
        <span class="input-group-text">$</span>
        <input type="number" class="form-control" id="precioMayorista" 
               step="0.01" min="0">
        <button class="btn btn-outline-secondary" type="button" id="btnCalcMayorista"
                title="Calcular automático (10% descuento)">
            <i class="bi bi-calculator"></i>
        </button>
    </div>
    <small class="text-muted">Para clientes que compran en cantidad</small>
</div>

<!-- Precio Distribuidor -->
<div class="col-md-6">
    <label class="form-label">
        Precio Distribuidor
        <span class="badge bg-warning" id="margenDistribuidor">Margen: 0%</span>
    </label>
    <div class="input-group">
        <span class="input-group-text">$</span>
        <input type="number" class="form-control" id="precioDistribuidor" 
               step="0.01" min="0">
        <button class="btn btn-outline-secondary" type="button" id="btnCalcDistribuidor"
                title="Calcular automático (20% descuento)">
            <i class="bi bi-calculator"></i>
        </button>
    </div>
    <small class="text-muted">Para revendedores autorizados</small>
</div>

<!-- Tabla Resumen de Precios con IVA -->
<div class="col-12 mt-3">
    <div class="card">
        <div class="card-body">
            <h6>Resumen de Precios con IVA</h6>
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Nivel</th>
                        <th>Precio Base</th>
                        <th>IVA (19%)</th>
                        <th>Precio Final</th>
                        <th>Margen</th>
                    </tr>
                </thead>
                <tbody id="tablaResumenPrecios">
                    <!-- Se llena dinámicamente -->
                </tbody>
            </table>
        </div>
    </div>
</div>
```

#### **JavaScript para Cálculos Automáticos**

```javascript
// Calcular márgenes en tiempo real
function calcularMargenes() {
    const compra = parseFloat(document.getElementById('precioCompra').value) || 0;
    const minorista = parseFloat(document.getElementById('precioMinorista').value) || 0;
    const mayorista = parseFloat(document.getElementById('precioMayorista').value) || 0;
    const distribuidor = parseFloat(document.getElementById('precioDistribuidor').value) || 0;
    const aplicaIVA = document.getElementById('aplicaIVA').checked;
    const porcentajeIVA = parseFloat(document.getElementById('porcentajeIVA').value) || 19;
    
    // Calcular y mostrar márgenes
    if (compra > 0) {
        // Minorista
        const margenMin = ((minorista - compra) / compra) * 100;
        actualizarBadgeMargen('margenMinorista', margenMin);
        
        // Mayorista
        if (mayorista > 0) {
            const margenMay = ((mayorista - compra) / compra) * 100;
            actualizarBadgeMargen('margenMayorista', margenMay);
        }
        
        // Distribuidor
        if (distribuidor > 0) {
            const margenDist = ((distribuidor - compra) / compra) * 100;
            actualizarBadgeMargen('margenDistribuidor', margenDist);
        }
    }
    
    // Actualizar tabla resumen
    actualizarTablaResumen(compra, minorista, mayorista, distribuidor, aplicaIVA, porcentajeIVA);
}

function actualizarBadgeMargen(elementId, margen) {
    const badge = document.getElementById(elementId);
    badge.textContent = `Margen: ${margen.toFixed(2)}%`;
    badge.className = margen < 0 ? 'badge bg-danger' : 
                     margen < 20 ? 'badge bg-warning' : 
                     'badge bg-success';
}

function actualizarTablaResumen(compra, minorista, mayorista, distribuidor, aplicaIVA, porcIVA) {
    const tbody = document.getElementById('tablaResumenPrecios');
    let html = '';
    
    const precios = [
        { nivel: 'Minorista', precio: minorista },
        { nivel: 'Mayorista', precio: mayorista },
        { nivel: 'Distribuidor', precio: distribuidor }
    ];
    
    precios.forEach(item => {
        if (item.precio > 0) {
            const valorIVA = aplicaIVA ? item.precio * (porcIVA / 100) : 0;
            const precioFinal = item.precio + valorIVA;
            const margen = compra > 0 ? ((item.precio - compra) / compra) * 100 : 0;
            const badgeClass = margen < 0 ? 'danger' : margen < 20 ? 'warning' : 'success';
            
            html += `
                <tr>
                    <td><strong>${item.nivel}</strong></td>
                    <td>$${item.precio.toFixed(2)}</td>
                    <td>$${valorIVA.toFixed(2)}</td>
                    <td><strong>$${precioFinal.toFixed(2)}</strong></td>
                    <td><span class="badge bg-${badgeClass}">${margen.toFixed(1)}%</span></td>
                </tr>
            `;
        }
    });
    
    tbody.innerHTML = html;
}

// Calcular precios automáticos con descuentos
document.getElementById('btnCalcMayorista').addEventListener('click', function() {
    const minorista = parseFloat(document.getElementById('precioMinorista').value) || 0;
    if (minorista > 0) {
        const mayorista = minorista * 0.90; // 10% descuento
        document.getElementById('precioMayorista').value = mayorista.toFixed(2);
        calcularMargenes();
    }
});

document.getElementById('btnCalcDistribuidor').addEventListener('click', function() {
    const minorista = parseFloat(document.getElementById('precioMinorista').value) || 0;
    if (minorista > 0) {
        const distribuidor = minorista * 0.80; // 20% descuento
        document.getElementById('precioDistribuidor').value = distribuidor.toFixed(2);
        calcularMargenes();
    }
});

// Eventos para recalcular en tiempo real
['precioCompra', 'precioMinorista', 'precioMayorista', 'precioDistribuidor', 'aplicaIVA', 'porcentajeIVA']
    .forEach(id => {
        document.getElementById(id).addEventListener('input', calcularMargenes);
    });
```

### 🔄 **INTEGRACIÓN CON VENTAS**

```javascript
// Al seleccionar cliente en venta, determinar precio a usar
function obtenerPrecioSegunCliente(producto, cliente) {
    // Determinar tipo de cliente (esto vendría de la tabla clientes)
    const tipoCliente = cliente.tipo_cliente; // 'minorista', 'mayorista', 'distribuidor'
    
    let precioBase = 0;
    switch(tipoCliente) {
        case 'distribuidor':
            precioBase = producto.precio_distribuidor || producto.precio_mayorista || producto.precio_minorista;
            break;
        case 'mayorista':
            precioBase = producto.precio_mayorista || producto.precio_minorista;
            break;
        case 'minorista':
        default:
            precioBase = producto.precio_minorista;
    }
    
    return precioBase;
}
```

---

## 🏢 SISTEMA DE BODEGAS Y TRASLADOS

### 🎯 **CONCEPTO**

Permite gestionar múltiples ubicaciones físicas de almacenamiento y trasladar mercancía entre ellas.

### 📊 **ESTRUCTURA DE DATOS**

#### **1. Tabla BODEGAS**

```sql
bodegas
- id
- empresa_id
- codigo (único por empresa)
- nombre
- descripcion
- direccion
- ciudad
- telefono
- responsable_id (usuario)
- es_principal (boolean)
- estado (activa/inactiva)
```

#### **2. Tabla PRODUCTOS_BODEGAS** (Stock Distribuido)

```sql
productos_bodegas
- id
- producto_id
- bodega_id
- stock_actual
- stock_minimo
- stock_maximo
- ubicacion (pasillo, estante)
```

#### **3. Tabla TRASLADOS**

```sql
traslados
- id
- empresa_id
- numero_traslado
- bodega_origen_id
- bodega_destino_id
- fecha_traslado
- fecha_recepcion
- estado (pendiente/en_transito/recibido/cancelado)
- observaciones
- usuario_solicita_id
- usuario_autoriza_id
- usuario_recibe_id
```

#### **4. Tabla TRASLADOS_DETALLE**

```sql
traslados_detalle
- id
- traslado_id
- producto_id
- cantidad_solicitada
- cantidad_recibida
- observaciones
```

### 🔄 **FLUJO DE TRASLADO**

```
┌─────────────────┐
│ 1. SOLICITUD    │  Usuario crea traslado (estado: pendiente)
│ Bodega A → B    │  
└────────┬────────┘
         │
┌────────▼────────┐
│ 2. AUTORIZACIÓN │  Supervisor aprueba (estado: en_transito)
│ Reserva stock   │  
└────────┬────────┘
         │
┌────────▼────────┐
│ 3. RECEPCIÓN    │  Bodega destino confirma llegada
│ Actualiza stock │  (estado: recibido)
└────────┬────────┘
         │
┌────────▼────────┐
│ 4. MOVIMIENTOS  │  Se registran automáticamente:
│ Inventario      │  - Salida de Bodega A
│                 │  - Entrada a Bodega B
└─────────────────┘
```

### 🎨 **INTERFAZ DE USUARIO**

#### **Formulario de Traslado**

```html
<div class="modal fade" id="trasladoModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">
                    <i class="bi bi-box-arrow-right me-2"></i>
                    Nuevo Traslado entre Bodegas
                </h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <form id="trasladoForm">
                    
                    <!-- Información General -->
                    <div class="row g-3">
                        
                        <div class="col-md-4">
                            <label class="form-label">Número de Traslado</label>
                            <input type="text" class="form-control" id="numeroTraslado" 
                                   value="TRX-001" readonly>
                        </div>
                        
                        <div class="col-md-4">
                            <label class="form-label">Fecha</label>
                            <input type="date" class="form-control" id="fechaTraslado" required>
                        </div>
                        
                        <div class="col-md-4">
                            <label class="form-label">Estado</label>
                            <select class="form-select" id="estadoTraslado">
                                <option value="pendiente">Pendiente</option>
                                <option value="en_transito">En Tránsito</option>
                                <option value="recibido">Recibido</option>
                            </select>
                        </div>
                        
                        <!-- Bodegas -->
                        <div class="col-md-6">
                            <label class="form-label">
                                Bodega Origen <span class="text-danger">*</span>
                            </label>
                            <select class="form-select" id="bodegaOrigen" required>
                                <option value="">Seleccionar...</option>
                            </select>
                        </div>
                        
                        <div class="col-md-6">
                            <label class="form-label">
                                Bodega Destino <span class="text-danger">*</span>
                            </label>
                            <select class="form-select" id="bodegaDestino" required>
                                <option value="">Seleccionar...</option>
                            </select>
                        </div>
                        
                        <div class="col-12">
                            <label class="form-label">Observaciones</label>
                            <textarea class="form-control" id="observacionesTraslado" 
                                      rows="2"></textarea>
                        </div>
                        
                        <!-- Productos -->
                        <div class="col-12 mt-4">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6><i class="bi bi-box-seam me-2"></i>Productos a Trasladar</h6>
                                <button type="button" class="btn btn-sm btn-primary" 
                                        id="btnAgregarProductoTraslado">
                                    <i class="bi bi-plus-circle me-1"></i>Agregar Producto
                                </button>
                            </div>
                            
                            <div class="table-responsive">
                                <table class="table table-sm" id="tablaProductosTraslado">
                                    <thead>
                                        <tr>
                                            <th>Producto</th>
                                            <th>Stock Origen</th>
                                            <th>Cantidad</th>
                                            <th>Recibido</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <!-- Productos dinámicos -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                    </div>
                    
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                    Cancelar
                </button>
                <button type="submit" form="trasladoForm" class="btn btn-primary">
                    <i class="bi bi-save me-2"></i>Guardar Traslado
                </button>
            </div>
        </div>
    </div>
</div>
```

#### **JavaScript para Gestión de Traslados**

```javascript
// Validar que origen y destino sean diferentes
document.getElementById('bodegaDestino').addEventListener('change', function() {
    const origen = document.getElementById('bodegaOrigen').value;
    const destino = this.value;
    
    if (origen && destino && origen === destino) {
        mostrarAlerta('La bodega de destino debe ser diferente al origen', 'warning');
        this.value = '';
    }
});

// Agregar producto al traslado
document.getElementById('btnAgregarProductoTraslado').addEventListener('click', async function() {
    const bodegaOrigenId = document.getElementById('bodegaOrigen').value;
    
    if (!bodegaOrigenId) {
        mostrarAlerta('Primero selecciona la bodega de origen', 'warning');
        return;
    }
    
    // Mostrar modal de selección de producto
    const producto = await seleccionarProducto(bodegaOrigenId);
    
    if (producto) {
        agregarProductoATabla(producto);
    }
});

function agregarProductoATabla(producto) {
    const tbody = document.querySelector('#tablaProductosTraslado tbody');
    const row = document.createElement('tr');
    row.dataset.productoId = producto.id;
    
    row.innerHTML = `
        <td>${producto.nombre} <small class="text-muted">${producto.sku}</small></td>
        <td><span class="badge bg-info">${producto.stock_actual}</span></td>
        <td>
            <input type="number" class="form-control form-control-sm cantidad-traslado" 
                   min="1" max="${producto.stock_actual}" value="1" style="width: 80px;">
        </td>
        <td>
            <input type="number" class="form-control form-control-sm cantidad-recibida" 
                   min="0" style="width: 80px;" disabled>
        </td>
        <td>
            <button type="button" class="btn btn-sm btn-danger btn-eliminar-producto">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;
    
    // Validar cantidad
    const inputCantidad = row.querySelector('.cantidad-traslado');
    inputCantidad.addEventListener('input', function() {
        if (this.value > producto.stock_actual) {
            this.value = producto.stock_actual;
            mostrarAlerta('No hay suficiente stock en la bodega origen', 'warning');
        }
    });
    
    // Eliminar producto
    row.querySelector('.btn-eliminar-producto').addEventListener('click', function() {
        row.remove();
    });
    
    tbody.appendChild(row);
}

// Guardar traslado
document.getElementById('trasladoForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const productos = [];
    document.querySelectorAll('#tablaProductosTraslado tbody tr').forEach(row => {
        productos.push({
            producto_id: row.dataset.productoId,
            cantidad_solicitada: row.querySelector('.cantidad-traslado').value,
            cantidad_recibida: row.querySelector('.cantidad-recibida').value || null
        });
    });
    
    if (productos.length === 0) {
        mostrarAlerta('Debes agregar al menos un producto', 'warning');
        return;
    }
    
    const traslado = {
        numero_traslado: document.getElementById('numeroTraslado').value,
        bodega_origen_id: document.getElementById('bodegaOrigen').value,
        bodega_destino_id: document.getElementById('bodegaDestino').value,
        fecha_traslado: document.getElementById('fechaTraslado').value,
        estado: document.getElementById('estadoTraslado').value,
        observaciones: document.getElementById('observacionesTraslado').value,
        productos: productos
    };
    
    try {
        const response = await fetch(`${API_URL}/traslados`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(traslado)
        });
        
        if (response.ok) {
            mostrarAlerta('Traslado creado exitosamente', 'success');
            $('#trasladoModal').modal('hide');
            cargarTraslados();
        }
    } catch (error) {
        mostrarAlerta('Error al crear traslado', 'danger');
    }
});
```

### 📊 **REPORTES ÚTILES**

#### **1. Stock Consolidado por Producto**

```sql
SELECT 
    p.nombre,
    p.sku,
    SUM(pb.stock_actual) as stock_total,
    COUNT(pb.bodega_id) as num_bodegas,
    GROUP_CONCAT(
        CONCAT(b.nombre, ': ', pb.stock_actual) 
        SEPARATOR ' | '
    ) as distribucion
FROM productos p
INNER JOIN productos_bodegas pb ON p.id = pb.producto_id
INNER JOIN bodegas b ON pb.bodega_id = b.id
WHERE p.estado = 'activo' AND b.estado = 'activa'
GROUP BY p.id
ORDER BY stock_total DESC;
```

#### **2. Productos con Stock Bajo por Bodega**

```sql
SELECT 
    b.nombre as bodega,
    p.nombre as producto,
    pb.stock_actual,
    pb.stock_minimo,
    (pb.stock_minimo - pb.stock_actual) as faltante
FROM productos_bodegas pb
INNER JOIN productos p ON pb.producto_id = p.id
INNER JOIN bodegas b ON pb.bodega_id = b.id
WHERE pb.stock_actual <= pb.stock_minimo
  AND p.estado = 'activo'
  AND b.estado = 'activa'
ORDER BY faltante DESC;
```

#### **3. Historial de Traslados**

```sql
SELECT 
    t.numero_traslado,
    bo.nombre as origen,
    bd.nombre as destino,
    t.fecha_traslado,
    t.estado,
    COUNT(td.id) as productos,
    SUM(td.cantidad_solicitada) as unidades
FROM traslados t
INNER JOIN bodegas bo ON t.bodega_origen_id = bo.id
INNER JOIN bodegas bd ON t.bodega_destino_id = bd.id
LEFT JOIN traslados_detalle td ON t.id = td.traslado_id
WHERE t.empresa_id = ?
GROUP BY t.id
ORDER BY t.created_at DESC;
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### **FASE 1: Base de Datos** ✅
- [x] Ejecutar script de migración SQL
- [x] Crear campos de múltiples precios
- [x] Crear tablas de bodegas
- [x] Crear tablas de traslados
- [x] Crear vistas y triggers

### **FASE 2: Backend**
- [ ] Actualizar modelo de Productos (3 precios)
- [ ] Crear controlador de Bodegas
- [ ] Crear controlador de Traslados
- [ ] Validaciones de precios jerárquicos
- [ ] Validación de stock suficiente
- [ ] Endpoint: Crear bodega
- [ ] Endpoint: Crear traslado
- [ ] Endpoint: Aprobar/Recibir traslado
- [ ] Endpoint: Consultar stock por bodega

### **FASE 3: Frontend**
- [ ] Actualizar formulario de productos (3 precios)
- [ ] Calculadora de márgenes por nivel
- [ ] Tabla resumen con IVA
- [ ] Módulo de Bodegas (CRUD)
- [ ] Módulo de Traslados
- [ ] Vista de stock por bodega
- [ ] Selector de bodega en compras
- [ ] Integración con ventas (precio según cliente)

### **FASE 4: Integraciones**
- [ ] Al crear compra, actualizar stock de bodega específica
- [ ] Al crear venta, descontar de bodega
- [ ] Reportes consolidados
- [ ] Dashboard de alertas por bodega

---

## 🚨 CONSIDERACIONES IMPORTANTES

### **⚠️ Migración de Datos Existentes**

El script SQL incluye:

1. **Conversión de precio_venta → precio_minorista**
2. **Cálculo automático de precios mayorista y distribuidor**
   - Mayorista: 10% menos que minorista
   - Distribuidor: 20% menos que minorista
3. **Creación de bodega principal por empresa**
4. **Migración de stock actual a bodega principal**

### **💡 Recomendaciones**

1. **Precios**: Revisar y ajustar los precios calculados automáticamente
2. **Bodegas**: Configurar bodegas adicionales según necesidad
3. **Permisos**: Limitar quién puede aprobar traslados
4. **Auditoría**: Todos los movimientos quedan registrados
5. **Stock negativo**: Validar antes de aprobar traslados

---

## 📚 REFERENCIAS

- Script SQL: `migration_productos_mejoras_siigo.sql`
- Documento base: `PRODUCTOS_MEJORAS_SIIGO.md`
- Fecha: 2026-02-11

---

**¡Sistema listo para implementar múltiples precios y traslados entre bodegas!** 🚀
