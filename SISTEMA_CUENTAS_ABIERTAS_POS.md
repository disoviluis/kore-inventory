# 🍺 SISTEMA DE CUENTAS ABIERTAS / MESAS - PUNTO DE VENTA

## 📋 ANÁLISIS DEL PROBLEMA

### Contexto
En Colombia es muy común que en:
- **Tiendas de barrio** que venden licores
- **Bares y discotecas**
- **Restaurantes**
- **Cafeterías**

Los clientes consuman productos "a cuenta" y paguen al final, similar a un sistema de mesas en restaurantes.

### Flujo Actual (Venta Directa)
```
1. Seleccionar productos
2. Agregar a carrito
3. Calcular total
4. Cobrar inmediatamente
5. Guardar venta
6. Descontar inventario
```

### Flujo Necesario (Cuenta Abierta)
```
1. Abrir cuenta/mesa para un cliente
2. Ir agregando productos (rondas de cerveza, etc.)
3. Cada producto descuenta del inventario al agregarlo
4. Se va acumulando el total
5. Al final, cliente pide "la cuenta"
6. Se totaliza todo lo consumido
7. Se realiza el pago
8. Se cierra la cuenta/mesa
```

---

## 🌍 APLICACIONES EXISTENTES QUE MANEJAN ESTE CASO

### 1. **Toast POS** (Restaurantes - USA)
- Sistema de mesas con estados (disponible, ocupada, cuenta abierta)
- Permite agregar items a la orden en cualquier momento
- Múltiples meseros pueden agregar a la misma mesa
- Split checks (dividir cuenta)
- **Concepto clave:** "Orden abierta" vs "Orden cerrada"

### 2. **Rappi/iFood Restaurantes** (LATAM)
- Pedidos pendientes vs pedidos completados
- Sistema de comandas abiertas
- Tracking de cada item agregado

### 3. **Siigo Nube POS + Mesas** (Colombia)
- Módulo específico para restaurantes
- Grid visual de mesas
- Cuentas por mesa
- Transfer de items entre mesas
- **Punto importante:** Usan el mismo POS base + módulo adicional

### 4. **Aloha POS** (Restaurantes)
- Gestión de mesas y zonas
- "Open Tab" para bares (cuenta abierta por nombre)
- Cada item se registra con timestamp
- Control de inventario en tiempo real

### 5. **Foodics** (Medio Oriente)
- Modo "Quick Sale" (venta rápida) vs "Dine-In" (comer en local)
- Cuentas abiertas con tabs
- Notificaciones a cocina/barra al agregar items

---

## 💡 PROPUESTAS DE SOLUCIÓN

### ✅ **OPCIÓN 1: MODO DUAL EN EL MISMO POS (RECOMENDADA)**

#### Concepto
Agregar un **botón de alternancia** en el POS para cambiar entre:
- **Modo Venta Directa** (actual) → Flujo normal
- **Modo Cuentas Abiertas** → Sistema de mesas/tabs

#### Ventajas
✅ Mantiene el flujo actual intacto  
✅ Experiencia familiar para usuarios existentes  
✅ Un solo sistema, más fácil de mantener  
✅ Usuarios pueden elegir según necesidad  
✅ No requiere navegación a otra página  

#### Desventajas
❌ UI puede volverse más cargada  
❌ Requiere más lógica condicional en frontend  

---

### ⚠️ **OPCIÓN 2: MÓDULO SEPARADO "POS MESAS"**

#### Concepto
Crear `ventas-mesas.html` como página independiente

#### Ventajas
✅ Separación total de responsabilidades  
✅ UI dedicada para gestión de mesas  
✅ No afecta en absoluto el POS actual  

#### Desventajas
❌ Duplicación de código  
❌ Mantenimiento de dos sistemas  
❌ Usuarios tienen que navegar entre páginas  

---

### 🎯 **OPCIÓN 3: HÍBRIDO (MEJOR DE AMBOS MUNDOS)**

#### Concepto
- Mantener POS actual como está
- Agregar botón **"Abrir Cuenta"** en lugar de "Guardar Venta"
- Al abrir cuenta, la venta pasa a un estado "pendiente"
- Panel lateral muestra "Cuentas Abiertas"
- Hacer clic en cuenta abierta carga productos y permite seguir agregando
- Botón "Cerrar Cuenta" para cobrar y finalizar

#### Ventajas
✅ Mínimos cambios visuales  
✅ Flujo natural para ambos casos  
✅ Reutiliza toda la lógica existente  
✅ Fácil de entender para usuarios  

---

## 🏗️ ARQUITECTURA RECOMENDADA (OPCIÓN 3 - HÍBRIDO)

### Base de Datos

#### Nueva Tabla: `cuentas_abiertas`
```sql
CREATE TABLE cuentas_abiertas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    numero_cuenta VARCHAR(20) NOT NULL, -- CTA-001, CTA-002, etc.
    
    -- IDENTIFICACIÓN
    tipo_identificacion ENUM('mesa', 'cliente', 'tab_nombre') DEFAULT 'cliente',
    mesa_numero VARCHAR(20) NULL, -- Mesa 1, Mesa 2, Barra, etc.
    cliente_id INT NULL,
    cliente_nombre VARCHAR(255) NULL, -- Para tabs sin cliente registrado
    
    -- TOTALES
    subtotal DECIMAL(10,2) DEFAULT 0,
    total_impuestos DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    
    -- ESTADO
    estado ENUM('abierta', 'cerrada', 'cancelada') DEFAULT 'abierta',
    cuenta_solicitada BOOLEAN DEFAULT FALSE, -- TRUE cuando cliente pide "la cuenta" (totalizar)
    fecha_cuenta_solicitada TIMESTAMP NULL, -- Cuándo pidió la cuenta
    
    -- AUDITORÍA
    usuario_apertura INT NOT NULL,
    fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_cierre INT NULL,
    fecha_cierre TIMESTAMP NULL,
    
    -- NOTAS
    notas TEXT NULL,
    
    -- RELACIÓN CON VENTA FINAL
    venta_id INT NULL, -- ID de la venta cuando se cierra
    
    FOREIGN KEY (empresa_id) REFERENCES empresas(id),
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (usuario_apertura) REFERENCES usuarios(id),
    FOREIGN KEY (usuario_cierre) REFERENCES usuarios(id),
    FOREIGN KEY (venta_id) REFERENCES ventas(id),
    
    INDEX idx_empresa_estado (empresa_id, estado),
    INDEX idx_numero_cuenta (numero_cuenta),
    INDEX idx_mesa (mesa_numero)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### Nueva Tabla: `cuenta_abierta_detalle`
```sql
CREATE TABLE cuenta_abierta_detalle (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cuenta_abierta_id INT NOT NULL,
    producto_id INT NOT NULL,
    
    -- DETALLES DEL PRODUCTO
    producto_nombre VARCHAR(255) NOT NULL,
    producto_sku VARCHAR(100),
    
    -- CANTIDAD Y PRECIOS
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    
    -- IMPUESTOS
    iva_porcentaje DECIMAL(5,2) DEFAULT 0,
    iva_valor DECIMAL(10,2) DEFAULT 0,
    impoconsumo_porcentaje DECIMAL(5,2) DEFAULT 0,
    impoconsumo_valor DECIMAL(10,2) DEFAULT 0,
    
    -- TOTAL
    total DECIMAL(10,2) NOT NULL,
    
    -- AUDITORÍA
    usuario_id INT NOT NULL, -- Quién agregó este item
    fecha_agregado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- NOTAS
    notas VARCHAR(500) NULL, -- Ej: "Sin hielo", "Fría"
    
    FOREIGN KEY (cuenta_abierta_id) REFERENCES cuentas_abiertas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### Nueva Tabla: `mesas_configuracion` (Opcional - Fase 2)
```sql
CREATE TABLE mesas_configuracion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    numero_mesa VARCHAR(20) NOT NULL, -- Mesa 1, Mesa 2, Barra 1, etc.
    zona VARCHAR(100) NULL, -- Terraza, Interior, VIP, etc.
    capacidad INT DEFAULT 4,
    estado ENUM('disponible', 'ocupada', 'reservada', 'inactiva') DEFAULT 'disponible',
    posicion_x INT NULL, -- Para mapa visual
    posicion_y INT NULL,
    
    FOREIGN KEY (empresa_id) REFERENCES empresas(id),
    UNIQUE KEY uk_empresa_mesa (empresa_id, numero_mesa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### Backend - Endpoints Nuevos

#### `POST /api/cuentas-abiertas`
**Abrir una cuenta**
```json
{
  "empresa_id": 1,
  "tipo_identificacion": "cliente", // o "mesa" o "tab_nombre"
  "mesa_numero": null,
  "cliente_id": 123,
  "cliente_nombre": "Juan Pérez",
  "notas": "Mesa 5"
}

// Response
{
  "success": true,
  "cuenta_id": 45,
  "numero_cuenta": "CTA-0045"
}
```

#### `GET /api/cuentas-abiertas/:empresa_id`
**Listar cuentas abiertas**
```json
{
  "success": true,
  "data": [
    {
      "id": 45,
      "numero_cuenta": "CTA-0045",
      "mesa_numero": null,
      "cliente_nombre": "Juan Pérez",
      "total": 45000,
      "fecha_apertura": "2026-06-01T15:30:00",
      "items_count": 5
    }
  ]
}
```

#### `POST /api/cuentas-abiertas/:id/items`
**Agregar items a cuenta abierta**
```json
{
  "producto_id": 234,
  "cantidad": 2,
  "precio_unitario": 3500,
  "notas": "Bien fría"
}
```

#### `GET /api/cuentas-abiertas/:id/detalle`
**Ver detalle de cuenta**
```json
{
  "success": true,
  "data": {
    "cuenta": { /* info cuenta */ },
    "items": [
      {
        "producto_nombre": "Cerveza Corona",
        "cantidad": 3,
        "precio_unitario": 3500,
        "total": 10500,
        "fecha_agregado": "2026-06-01T15:35:00"
      }
    ],
    "totales": {
      "subtotal": 45000,
      "iva": 8000,
      "total": 53000
    }
  }
}
```

#### `POST /api/cuentas-abiertas/:id/solicitar-cuenta`
**Marcar que el cliente pidió la cuenta (para estadísticas)**
```json
// Request: vacío (solo marca el timestamp)

// Response
{
  "success": true,
  "message": "Cuenta solicitada marcada"
}
```

**NOTA:** Este endpoint solo actualiza `cuenta_solicitada = TRUE` y `fecha_cuenta_solicitada = NOW()`.
La cuenta sigue ABIERTA y se pueden agregar más items.

#### `POST /api/cuentas-abiertas/:id/cerrar`
**Cerrar cuenta y convertir en venta**
```json
{
  "metodo_pago": "efectivo",
  "monto_recibido": 60000,
  "notas": "Cliente satisfecho"
}

// Response
{
  "success": true,
  "venta_id": 789,
  "numero_factura": "FACT-0789"
}
```

#### `DELETE /api/cuentas-abiertas/:id/items/:item_id`
**Eliminar item de cuenta** (si se equivocaron)

---

### Frontend - Cambios en `ventas.html` y `ventas.js`

#### 1. Nueva sección en HTML: Panel de Cuentas Abiertas

```html
<!-- Panel Lateral: Cuentas Abiertas -->
<div class="offcanvas offcanvas-end" tabindex="-1" id="cuentasAbiertasPanel">
    <div class="offcanvas-header bg-warning text-dark">
        <h5 class="offcanvas-title">
            <i class="bi bi-receipt-cutoff me-2"></i>Cuentas Abiertas
        </h5>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
    </div>
    <div class="offcanvas-body p-0">
        <div id="listaCuentasAbiertas" class="list-group list-group-flush">
            <!-- Se generará dinámicamente -->
        </div>
    </div>
</div>

<!-- Modal: Ver Total de Cuenta -->
<div class="modal fade" id="modalVerTotal" tabindex="-1">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header bg-info text-white">
                <h5 class="modal-title">
                    <i class="bi bi-calculator me-2"></i>Resumen de Cuenta
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" id="modalVerTotalContent">
                <!-- Contenido generado dinámicamente -->
            </div>
        </div>
    </div>
</div>
```

#### 2. Botón en navbar para ver cuentas abiertas

```html
<!-- En la navbar existente, después del botón "Últimas Ventas" -->
<button class="btn btn-outline-warning btn-sm" 
        data-bs-toggle="offcanvas" 
        data-bs-target="#cuentasAbiertasPanel"
        id="btnCuentasAbiertas">
    <i class="bi bi-receipt-cutoff me-1"></i>
    Cuentas Abiertas
    <span class="badge bg-warning text-dark" id="badgeCuentasAbiertas">0</span>
</button>
```

#### 3. Modificar sección de botones de guardado

```html
<!-- Reemplazar el botón actual "Guardar Venta" con múltiples opciones -->
<div class="d-grid gap-2">
    <!-- VENTA DIRECTA (MODO ACTUAL) -->
    <button class="btn btn-success btn-lg" id="btnGuardarVentaDirecta" disabled>
        <i class="bi bi-check-circle me-2"></i>Cobrar y Guardar Venta
    </button>
    
    <!-- NUEVA OPCIÓN: ABRIR CUENTA -->
    <button class="btn btn-warning btn-lg" id="btnAbrirCuenta" disabled>
        <i class="bi bi-receipt-cutoff me-2"></i>Abrir Cuenta
    </button>
    
    <!-- Si hay una cuenta abierta cargada: Mostrar estos botones -->
    <div id="botonesEdicionCuenta" class="d-none">
        <!-- VER TOTAL (No cierra, solo muestra resumen) -->
        <button class="btn btn-info btn-lg" id="btnVerTotal">
            <i class="bi bi-calculator me-2"></i>Ver Total
        </button>
        
        <!-- CERRAR Y COBRAR (Cierra definitivamente) -->
        <button class="btn btn-primary btn-lg" id="btnCerrarCuenta">
            <i class="bi bi-cash-stack me-2"></i>Cerrar Cuenta y Cobrar
        </button>
        
        <!-- AGREGAR MÁS ITEMS -->
        <button class="btn btn-outline-success" id="btnAgregarMasItems">
            <i class="bi bi-plus-circle me-2"></i>Seguir Agregando Productos
        </button>
    </div>
    
    <button class="btn btn-outline-secondary" id="btnLimpiarVenta">
        <i class="bi bi-trash me-2"></i>Limpiar Todo
    </button>
</div>
```

#### 4. Variables globales en `ventas.js`

```javascript
// Agregar a las variables existentes
let cuentasAbiertas = []; // Lista de cuentas abiertas
let cuentaActual = null; // Cuenta abierta cargada actualmente
let modoEdicionCuenta = false; // true si estamos editando una cuenta abierta
```

#### 5. Funciones principales

```javascript
// ============================================
// CUENTAS ABIERTAS
// ============================================

/**
 * Cargar cuentas abiertas de la empresa
 */
async function cargarCuentasAbiertas() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/cuentas-abiertas/${currentEmpresa.id}?estado=abierta`, 
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );
        
        const data = await response.json();
        if (data.success) {
            cuentasAbiertas = data.data;
            renderizarCuentasAbiertas();
            actualizarBadgeCuentasAbiertas();
        }
    } catch (error) {
        console.error('Error cargando cuentas abiertas:', error);
    }
}

/**
 * Renderizar lista de cuentas abiertas
 */
function renderizarCuentasAbiertas() {
    const container = document.getElementById('listaCuentasAbiertas');
    
    if (cuentasAbiertas.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-receipt-cutoff display-4"></i>
                <p class="mt-2">No hay cuentas abiertas</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = cuentasAbiertas.map(cuenta => `
        <div class="list-group-item list-group-item-action cursor-pointer" 
             onclick="cargarCuentaAbierta(${cuenta.id})">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <h6 class="mb-1 fw-bold">${cuenta.numero_cuenta}</h6>
                    <p class="mb-1 small text-muted">
                        ${cuenta.mesa_numero || cuenta.cliente_nombre || 'Sin identificar'}
                    </p>
                    <small class="text-muted">
                        ${cuenta.items_count} items • 
                        ${formatearNumero(cuenta.total)}
                    </small>
                </div>
                <div class="text-end">
                    <small class="text-muted">
                        ${formatearFechaHora(cuenta.fecha_apertura)}
                    </small>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Actualizar badge de cuentas abiertas
 */
function actualizarBadgeCuentasAbiertas() {
    const badge = document.getElementById('badgeCuentasAbiertas');
    badge.textContent = cuentasAbiertas.length;
    
    if (cuentasAbiertas.length > 0) {
        badge.classList.remove('d-none');
    } else {
        badge.classList.add('d-none');
    }
}

/**
 * Abrir una nueva cuenta
 */
async function abrirNuevaCuenta() {
    if (productosVenta.length === 0) {
        alert('Debes agregar al menos un producto para abrir una cuenta');
        return;
    }
    
    // Confirmar
    const confirmar = confirm(
        '¿Abrir cuenta con estos productos?\n\n' +
        `${productosVenta.length} items\n` +
        `Total: ${formatearNumero(totalVentaActual)}`
    );
    
    if (!confirmar) return;
    
    try {
        const token = localStorage.getItem('token');
        
        // 1. Crear cuenta abierta
        const cuentaResponse = await fetch(`${API_URL}/cuentas-abiertas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                empresa_id: currentEmpresa.id,
                tipo_identificacion: clienteSeleccionado ? 'cliente' : 'tab_nombre',
                cliente_id: clienteSeleccionado?.id || null,
                cliente_nombre: clienteSeleccionado?.nombre || 'Cliente General',
                notas: document.getElementById('notasVenta').value
            })
        });
        
        const cuentaData = await cuentaResponse.json();
        if (!cuentaData.success) throw new Error(cuentaData.message);
        
        const cuentaId = cuentaData.cuenta_id;
        
        // 2. Agregar items a la cuenta
        for (const producto of productosVenta) {
            await fetch(`${API_URL}/cuentas-abiertas/${cuentaId}/items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    producto_id: producto.producto_id,
                    cantidad: producto.cantidad,
                    precio_unitario: producto.precio_unitario,
                    notas: producto.notas || null
                })
            });
        }
        
        // 3. Mostrar confirmación
        alert(`✅ Cuenta ${cuentaData.numero_cuenta} abierta exitosamente`);
        
        // 4. Limpiar y recargar
        limpiarVentaSinConfirmar();
        await cargarCuentasAbiertas();
        
    } catch (error) {
        console.error('Error abriendo cuenta:', error);
        alert('Error al abrir cuenta: ' + error.message);
    }
}

/**
 * Cargar una cuenta abierta para editarla
 */
async function cargarCuentaAbierta(cuentaId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/cuentas-abiertas/${cuentaId}/detalle`,
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );
        
        const data = await response.json();
        if (!data.success) throw new Error(data.message);
        
        // Cargar datos de la cuenta
        cuentaActual = data.data.cuenta;
        modoEdicionCuenta = true;
        
        // Cargar cliente si existe
        if (cuentaActual.cliente_id) {
            clienteSeleccionado = {
                id: cuentaActual.cliente_id,
                nombre: cuentaActual.cliente_nombre,
                documento: cuentaActual.cliente_documento
            };
            mostrarClienteSeleccionado();
        }
        
        // Cargar productos
        productosVenta = data.data.items.map(item => ({
            id: item.id,
            producto_id: item.producto_id,
            nombre: item.producto_nombre,
            sku: item.producto_sku,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            subtotal: item.subtotal,
            iva_porcentaje: item.iva_porcentaje,
            iva_valor: item.iva_valor,
            total: item.total
        }));
        
        // Renderizar y mostrar botones apropiados
        renderizarProductos();
        calcularTotales();
        mostrarModoEdicionCuenta();
        
        // Cerrar offcanvas
        const offcanvas = bootstrap.Offcanvas.getInstance(
            document.getElementById('cuentasAbiertasPanel')
        );
        offcanvas?.hide();
        
    } catch (error) {
        console.error('Error cargando cuenta:', error);
        alert('Error al cargar cuenta: ' + error.message);
    }
}

/**
 * Mostrar modo edición de cuenta
 */
function mostrarModoEdicionCuenta() {
    document.getElementById('btnGuardarVentaDirecta').classList.add('d-none');
    document.getElementById('btnAbrirCuenta').classList.add('d-none');
    document.getElementById('btnCerrarCuenta').classList.remove('d-none');
    
    // Mostrar banner de edición
    const banner = document.createElement('div');
    banner.id = 'bannerEdicionCuenta';
    banner.className = 'alert alert-warning mb-3';
    banner.innerHTML = `
        <i class="bi bi-receipt-cutoff me-2"></i>
        <strong>Editando:</strong> ${cuentaActual.numero_cuenta} - 
        ${cuentaActual.cliente_nombre}
        <button class="btn btn-sm btn-outline-warning ms-2" onclick="cancelarEdicionCuenta()">
            <i class="bi bi-x"></i> Cancelar
        </button>
    `;
    
    const container = document.querySelector('.page-content .container-fluid');
    container.insertBefore(banner, container.firstChild);
}

/**
 * Cancelar edición de cuenta
 */
function cancelarEdicionCuenta() {
    cuentaActual = null;
    modoEdicionCuenta = false;
    limpiarVentaSinConfirmar();
    document.getElementById('bannerEdicionCuenta')?.remove();
    document.getElementById('btnGuardarVentaDirecta').classList.remove('d-none');
    document.getElementById('btnAbrirCuenta').classList.remove('d-none');
    document.getElementById('btnCerrarCuenta').classList.add('d-none');
}

/**
 * Ver total de cuenta (sin cerrar)
 * El cliente pide "la cuenta" pero aún puede seguir agregando productos
 */
async function verTotalCuenta() {
    if (!cuentaActual) return;
    
    try {
        const token = localStorage.getItem('token');
        
        // Marcar que el cliente pidió la cuenta
        await fetch(
            `${API_URL}/cuentas-abiertas/${cuentaActual.id}/solicitar-cuenta`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        // Mostrar modal con resumen detallado
        const modalHtml = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                <strong>La cuenta sigue abierta.</strong> 
                Puedes seguir agregando productos si el cliente lo desea.
            </div>
            
            <h4>Cuenta: ${cuentaActual.numero_cuenta}</h4>
            <h5>Cliente: ${cuentaActual.cliente_nombre}</h5>
            
            <table class="table table-sm mt-3">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cant.</th>
                        <th>Precio</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${productosVenta.map(p => `
                        <tr>
                            <td>${p.nombre}</td>
                            <td>${p.cantidad}</td>
                            <td>$${formatearNumero(p.precio_unitario)}</td>
                            <td>$${formatearNumero(p.total)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="table-active">
                        <th colspan="3">TOTAL A PAGAR:</th>
                        <th class="text-primary fs-4">$${formatearNumero(totalVentaActual)}</th>
                    </tr>
                </tfoot>
            </table>
            
            <div class="d-grid gap-2 mt-3">
                <button class="btn btn-success btn-lg" onclick="cerrarCuentaYCobrar()">
                    <i class="bi bi-cash-stack me-2"></i>Cliente Acepta - Procesar Pago
                </button>
                <button class="btn btn-outline-primary" data-bs-dismiss="modal">
                    <i class="bi bi-plus-circle me-2"></i>Cliente Quiere Más - Seguir Agregando
                </button>
            </div>
        `;
        
        // Mostrar en modal
        document.getElementById('modalVerTotalContent').innerHTML = modalHtml;
        const modal = new bootstrap.Modal(document.getElementById('modalVerTotal'));
        modal.show();
        
    } catch (error) {
        console.error('Error al ver total:', error);
    }
}

/**
 * Cerrar cuenta y convertir en venta
 */
async function cerrarCuentaYCobrar() {
    if (!cuentaActual) return;
    
    // Aquí se abre modal de pagos igual que venta normal
    // Al confirmar pago:
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/cuentas-abiertas/${cuentaActual.id}/cerrar`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    metodo_pago: 'efectivo', // o el que seleccionen
                    monto_recibido: totalVentaActual,
                    notas: document.getElementById('notasVenta').value
                })
            }
        );
        
        const data = await response.json();
        if (!data.success) throw new Error(data.message);
        
        alert(`✅ Cuenta cerrada. Factura: ${data.numero_factura}`);
        
        // Limpiar y recargar
        cancelarEdicionCuenta();
        await cargarCuentasAbiertas();
        
    } catch (error) {
        console.error('Error cerrando cuenta:', error);
        alert('Error al cerrar cuenta: ' + error.message);
    }
}

// Inicializar al cargar página
document.addEventListener('DOMContentLoaded', async () => {
    await inicializarPOS(); // Función existente
    await cargarCuentasAbiertas(); // Nueva función
    
    // Event listeners
    document.getElementById('btnAbrirCuenta')?.addEventListener('click', abrirNuevaCuenta);
    document.getElementById('btnVerTotal')?.addEventListener('click', verTotalCuenta);
    document.getElementById('btnCerrarCuenta')?.addEventListener('click', cerrarCuentaYCobrar);
    
    // Recargar cuentas cada 30 segundos
    setInterval(cargarCuentasAbiertas, 30000);
});
```

---

## 🎨 INTERFAZ DE USUARIO - WIREFRAME

### Vista 1: Venta Normal (Sin cuenta abierta)
```
┌─────────────────────────────────────────────────────────────────┐
│ PUNTO DE VENTA                                                  │
│ [Últimas Ventas] [Cuentas Abiertas (3)] [Turno] [Cancelar]    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────┬──────────────────────────────────────┐
│ CLIENTE                  │ RESUMEN                              │
│ [Juan Pérez             ]│ Subtotal:      $45,000              │
│                          │ IVA:           $ 8,550              │
│ PRODUCTOS EN LA VENTA    │ Total:         $53,550              │
│ ┌────────────────────┐   │                                      │
│ │ Cerveza Corona     │   │ [Cobrar y Guardar Venta]  ← Normal  │
│ │ x3  $3,500  $10,500│   │ [Abrir Cuenta]            ← Nuevo   │
│ │ [−] [3] [+] [🗑️]   │   │ [Limpiar Todo]                      │
│ └────────────────────┘   │                                      │
│ ┌────────────────────┐   │                                      │
│ │ Aguardiente        │   │                                      │
│ │ x2  $15,000 $30,000│   │                                      │
│ │ [−] [2] [+] [🗑️]   │   │                                      │
│ └────────────────────┘   │                                      │
└──────────────────────────┴──────────────────────────────────────┘
```

### Vista 2: Editando Cuenta Abierta
```
┌─────────────────────────────────────────────────────────────────┐
│ PUNTO DE VENTA                                                  │
│ [Últimas Ventas] [Cuentas Abiertas (3)] [Turno] [Cancelar]    │
└─────────────────────────────────────────────────────────────────┘
│ ⚠️ Editando: CTA-0047 - Pedro López          [❌ Cancelar]     │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────┬──────────────────────────────────────┐
│ CLIENTE                  │ RESUMEN                              │
│ [Pedro López            ]│ Subtotal:      $24,500              │
│                          │ IVA:           $ 4,655              │
│ PRODUCTOS EN LA CUENTA   │ Total:         $29,155              │
│ ┌────────────────────┐   │                                      │
│ │ Cerveza Corona     │   │ 🔵 [Ver Total]         ← Solo muestra│
│ │ x7  $3,500  $24,500│   │ 🟢 [Cerrar y Cobrar]   ← Finaliza   │
│ │ [−] [7] [+] [🗑️]   │   │ [Seguir Agregando]                  │
│ └────────────────────┘   │ [Cancelar Cuenta]                   │
│                          │                                      │
│ [Buscar productos...]    │                                      │
│                          │                                      │
└──────────────────────────┴──────────────────────────────────────┘
```

### Panel Lateral: Cuentas Abiertas
```
┌────────────────────────────────┐
│ 🏷️ Cuentas Abiertas           │
├────────────────────────────────┤
│ CTA-0045 ⏰ [Pidió cuenta]    │
│ Juan Pérez                     │
│ 5 items • $53,500              │
│ 15:30                          │
├────────────────────────────────┤
│ CTA-0046                       │
│ Mesa 3                         │
│ 8 items • $127,000             │
│ 16:05                          │
├────────────────────────────────┤
│ CTA-0047 ⭐ [Activa]          │
│ Pedro López                    │
│ 7 items • $29,155              │
│ 17:20                          │
└────────────────────────────────┘
```

---

## 📊 FLUJO DE TRABAJO COMPLETO

### Escenario: Tienda de Barrio con Licores

#### **Caso 1: Venta Directa (Flujo Actual)**
```
1. Cliente: "Dame una Cerveza Corona"
2. Cajero: Busca producto → Agrega al carrito
3. Total: $3,500
4. Cliente paga inmediatamente
5. [Cobrar y Guardar Venta]
6. Se imprime factura
7. Se descuenta inventario
```

#### **Caso 2: Cuenta Abierta (Nuevo Flujo)**
```
1. Cliente: "Abre una cuenta a mi nombre: Pedro López"
2. Cajero: 
   - Busca/crea cliente "Pedro López"
   - Agrega Cerveza Corona x2
   - Click [Abrir Cuenta]
   - Sistema crea CTA-0047
   - Descuenta inventario (2 cervezas)

3. [30 minutos después]
   Cliente: "Dame otras 3 cervezas más"
4. Cajero:
   - Click en panel "Cuentas Abiertas"
   - Selecciona CTA-0047
   - Agrega Cerveza Corona x3
   - Descuenta inventario (3 cervezas más)
   - Sistema actualiza total: $17,500

5. [1 hora después]
   Cliente: "Dame la cuenta"
6. Cajero:
   - Click en CTA-0047
   - Click [Ver Total]
   - Muestra total: $17,500 (5 cervezas)
   - ⚠️ Cuenta SIGUE ABIERTA
   
7. Cliente: "Espera, dame 2 cervezas más"
8. Cajero:
   - Agrega 2 Cerveza Corona
   - Nuevo total: $24,500 (7 cervezas)
   - Descuenta inventario (2 más)
   
9. Cliente: "Ahora sí, aquí está" (entrega dinero)
10. Cajero:
    - Click [Cerrar Cuenta y Cobrar]
    - Procesa pago
    - Genera venta FACT-0789
    - ✅ Cuenta CERRADA (ya no se puede modificar)
    - Se imprime factura
```

---

## 🔧 INVENTARIO Y STOCK

### ⚠️ **DECISIÓN CRÍTICA: ¿Cuándo descontar stock?**

#### **OPCIÓN A: Descontar al agregar a cuenta (RECOMENDADA)**
```
Momento: Al abrir cuenta o agregar items
Ventaja: Stock real, evita vender productos que ya están "comprometidos"
Desventaja: Si cliente no paga, hay que reversar
```

#### **OPCIÓN B: Descontar al cerrar cuenta**
```
Momento: Solo cuando se cobra y cierra la cuenta
Ventaja: Stock solo se descuenta con pago confirmado
Desventaja: Puede vender más de lo disponible si hay varias cuentas abiertas
```

### 💡 **RECOMENDACIÓN**
Usar **OPCIÓN A** con posibilidad de reversar:
- Al agregar producto a cuenta → Descuenta stock
- Al eliminar item de cuenta → Suma stock
- Al cerrar cuenta → No hace nada (ya estaba descontado)
- Al cancelar cuenta → Reversa todo el stock

Esto asegura que el inventario refleja productos "comprometidos".

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### **FASE 1: Base de Datos (1 día)**
- [ ] Crear tabla `cuentas_abiertas`
- [ ] Crear tabla `cuenta_abierta_detalle`
- [ ] Migración en producción

### **FASE 2: Backend (2-3 días)**
- [ ] Controller: `cuentas-abiertas.controller.ts`
- [ ] Endpoints:
  - [ ] POST `/api/cuentas-abiertas` (abrir)
  - [ ] GET `/api/cuentas-abiertas/:empresa_id` (listar)
  - [ ] GET `/api/cuentas-abiertas/:id/detalle` (detalle)
  - [ ] POST `/api/cuentas-abiertas/:id/items` (agregar item)
  - [ ] DELETE `/api/cuentas-abiertas/:id/items/:item_id` (eliminar item)
  - [ ] POST `/api/cuentas-abiertas/:id/solicitar-cuenta` (marcar que pidió la cuenta)
  - [ ] POST `/api/cuentas-abiertas/:id/cerrar` (cerrar y convertir en venta)
  - [ ] DELETE `/api/cuentas-abiertas/:id` (cancelar cuenta)
- [ ] Lógica de manejo de inventario
- [ ] Pruebas con Postman

### **FASE 3: Frontend (3-4 días)**
- [ ] HTML: Panel de cuentas abiertas (offcanvas)
- [ ] HTML: Modal "Ver Total"
- [ ] HTML: Botones de control (Ver Total, Cerrar y Cobrar, etc.)
- [ ] JavaScript: Funciones de cuentas abiertas
- [ ] JavaScript: Función `verTotalCuenta()` 
- [ ] JavaScript: Función `cerrarCuentaYCobrar()`
- [ ] JavaScript: Integración con flujo existente
- [ ] CSS: Estilos y badges
- [ ] Testing de flujos

### **FASE 4: Testing y Ajustes (2 días)**
- [ ] Pruebas de integración
- [ ] Casos extremos (cancelar, reversar, etc.)
- [ ] Optimización de rendimiento
- [ ] Documentación

### **FASE 5 (OPCIONAL): Mejoras Avanzadas**
- [ ] Módulo de configuración de mesas
- [ ] Mapa visual de mesas
- [ ] Transfer de items entre cuentas
- [ ] Split de cuentas (dividir entre varios)
- [ ] Propinas sugeridas
- [ ] Reportes de cuentas por mesero

---

## 📱 MEJORAS FUTURAS

### 1. **Mapa Visual de Mesas**
Layout de mesas con colores:
- Verde: Disponible
- Amarillo: Cuenta abierta
- Rojo: Reservada

### 2. **Notificaciones en Tiempo Real**
WebSockets para que múltiples dispositivos vean actualizaciones:
- "Mesa 3 agregó items"
- "CTA-0045 fue cerrada"

### 3. **Control por Mesero/Vendedor**
Cada cuenta asignada a un vendedor específico con comisiones.

### 4. **Comandas a Cocina/Barra**
Items nuevos se envían automáticamente a:
- Cocina: Comida
- Barra: Bebidas

### 5. **Tiempo de Cuenta Abierta**
Alertas si una cuenta lleva más de X tiempo abierta:
- "⏰ CTA-0045 lleva 3 horas abierta"

---

## ❓ PREGUNTAS FRECUENTES

### ⭐ ¿Cliente pide la cuenta pero luego quiere agregar más productos?
**Caso común:** Cliente pide "la cuenta", ve el total, y dice "dame otras 3 cervezas más".

**✅ SOLUCIÓN: DIFERENCIA CLAVE entre "PEDIR LA CUENTA" y "CERRAR LA CUENTA"**

#### 🔵 PEDIR LA CUENTA (Ver Total)
```
- Cliente: "Dame la cuenta"
- Cajero: Click en la cuenta abierta
- Sistema muestra total: $53,500
- ⚠️ Cuenta SIGUE ABIERTA
- Cliente puede seguir agregando productos
```

#### 🟢 CERRAR LA CUENTA (Cobrar)
```
- Cliente: "Aquí está el pago" (entrega dinero)
- Cajero: Click [Cerrar Cuenta y Cobrar]
- Procesa pago
- ✅ Cuenta se CIERRA definitivamente
- Ya NO se pueden agregar más productos
```

#### 📊 Flujo Real:
```
15:30 → Abre cuenta: Juan López
15:35 → Agrega 2 cervezas ($7,000)
16:00 → Agrega 3 cervezas más ($10,500)
16:30 → Cliente: "Dame la cuenta"
       → Cajero muestra total: $17,500
       → Cuenta SIGUE ABIERTA ✅
16:32 → Cliente: "Dame 2 más"
       → Cajero agrega 2 cervezas ($7,000)
       → Nuevo total: $24,500
16:35 → Cliente paga
       → Cajero: [Cerrar Cuenta y Cobrar]
       → Cuenta CERRADA ❌ (ya no se puede modificar)
```

**IMPLEMENTACIÓN EN UI:**
- Botón **"Ver Total"** → Solo muestra resumen, cuenta sigue abierta
- Botón **"Cerrar Cuenta y Cobrar"** → Procesa pago y cierra definitivamente
- Mientras esté abierta, siempre se pueden agregar/quitar productos

---

### ¿Qué pasa si el cliente se va sin pagar?
- Opción 1: Cancelar cuenta (reversa inventario)
- Opción 2: Convertir en "Cuenta por Cobrar" (deuda)
- Opción 3: Marcar cuenta como "Perdida" (ajuste de inventario)

### ¿Puedo transferir items entre cuentas?
En Fase 1 no, pero se puede implementar después.

### ¿Qué pasa si hay varios cajeros?
Recargar panel cada 30 segundos asegura ver cuentas actualizadas.

### ¿Puedo cambiar el precio de un item en cuenta abierta?
Sí, usando el mismo sistema de edición de precio del POS actual.

### ¿Se pueden aplicar descuentos?
Sí, usando el sistema de descuentos existente del POS.

---

## � DIAGRAMA DE ESTADOS: CUENTA ABIERTA

```
┌─────────────────────────────────────────────────────────────────┐
│                     CICLO DE VIDA DE UNA CUENTA                   │
└─────────────────────────────────────────────────────────────────┘

1. ABRIR CUENTA
   ↓
   estado: 'abierta'
   cuenta_solicitada: FALSE
   ✅ Puede agregar productos
   ✅ Puede eliminar productos
   ✅ Puede ver total
   ✅ Puede cerrar y cobrar
   
2. PEDIR LA CUENTA (Opcional)
   ↓
   estado: 'abierta'
   cuenta_solicitada: TRUE ← Solo marca timestamp
   ✅ Puede SEGUIR agregando productos
   ✅ Puede SEGUIR eliminando productos
   ✅ Puede ver total de nuevo
   ✅ Puede cerrar y cobrar
   ⚠️ CUENTA SIGUE COMPLETAMENTE ABIERTA
   
3. CERRAR Y COBRAR
   ↓
   estado: 'cerrada'
   venta_id: 789 ← Genera venta real
   ❌ YA NO se pueden agregar productos
   ❌ YA NO se pueden eliminar productos
   ✅ Se puede ver factura generada

ALTERNATIVA: CANCELAR CUENTA
   ↓
   estado: 'cancelada'
   ↩️ Reversa inventario
   ❌ No genera venta
```

### 🔑 **REGLA DE ORO:**
> **"PEDIR LA CUENTA" ≠ "CERRAR LA CUENTA"**
> 
> - **Pedir la cuenta** = Ver cuánto debe (sigue abierta)
> - **Cerrar la cuenta** = Cobrar y finalizar (definitivo)

---

## �📌 CONCLUSIÓN Y RECOMENDACIÓN FINAL

### ✅ **MI RECOMENDACIÓN**

Implementar **OPCIÓN 3 (HÍBRIDO)** porque:

1. **Mantiene flujo actual intacto** → Clientes existentes no se confunden
2. **Agrega funcionalidad sin complejidad** → Solo nuevos botones
3. **Reutiliza todo el código existente** → Menos desarrollo
4. **Fácil de entender** → Flujo natural
5. **Escalable** → Se puede mejorar después

### 🎯 **PRÓXIMOS PASOS**

1. **Validar con usuario(s) final(es):**
   - Mostrar mockup/wireframe
   - Confirmar flujo de trabajo
   - Ajustar según feedback

2. **Comenzar con Fase 1:**
   - Crear tablas de base de datos
   - Testear estructura

3. **Desarrollo iterativo:**
   - Backend → Frontend → Testing
   - Desplegar en ambiente de pruebas primero
   - Recoger feedback antes de producción

---

## 📞 SOPORTE

Cualquier duda sobre la implementación, no dudes en preguntar.

**Fecha de análisis:** 1 de Junio 2026  
**Versión del documento:** 1.1  
**Última actualización:** 1 de Junio 2026

---

## 📝 REGISTRO DE CAMBIOS

### v1.1 - 1 de Junio 2026
- ✅ Agregada distinción clara entre "Pedir la Cuenta" vs "Cerrar la Cuenta"
- ✅ Agregado campo `cuenta_solicitada` y `fecha_cuenta_solicitada` en BD
- ✅ Agregado botón "Ver Total" en UI
- ✅ Agregado modal de resumen de cuenta
- ✅ Agregado endpoint `/api/cuentas-abiertas/:id/solicitar-cuenta`
- ✅ Agregada función JavaScript `verTotalCuenta()`
- ✅ Actualizado wireframe con vistas detalladas
- ✅ Agregado diagrama de estados del ciclo de vida
- ✅ Agregada FAQ sobre agregar productos después de totalizar

### v1.0 - 1 de Junio 2026
- Análisis inicial del sistema de cuentas abiertas
- Arquitectura de base de datos
- Endpoints del backend
- Propuesta de frontend
- Plan de implementación
