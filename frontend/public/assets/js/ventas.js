/**
 * =================================
 * KORE INVENTORY - VENTAS/POS MODULE
 * Módulo de punto de venta
 * =================================
 */

const API_URL = 'http://18.191.181.99:3000/api';
let currentEmpresa = null;
let currentUsuario = null;
let clienteSeleccionado = null;
let productosVenta = [];

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        let usuario = JSON.parse(localStorage.getItem('usuario'));
        
        if (!usuario) {
            const response = await fetch(`${API_URL}/auth/verify`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                localStorage.clear();
                window.location.href = 'login.html';
                return;
            }

            const data = await response.json();
            usuario = data.data;
            localStorage.setItem('usuario', JSON.stringify(usuario));
        }

        currentUsuario = usuario;
        cargarInfoUsuario(usuario);

        currentEmpresa = JSON.parse(localStorage.getItem('empresaActiva'));
        if (!currentEmpresa) {
            mostrarAlerta('Por favor selecciona una empresa desde el dashboard', 'warning');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
            return;
        }

        document.getElementById('empresaActiva').textContent = currentEmpresa.nombre;

        initEventListeners();
        deshabilitarSeccionProductos();

    } catch (error) {
        console.error('Error de inicialización:', error);
        mostrarAlerta('Error al inicializar el módulo', 'danger');
    }
});

function cargarInfoUsuario(usuario) {
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    
    if (userName) {
        userName.textContent = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || 'Usuario';
    }
    
    if (userRole) {
        const tipos = {
            'super_admin': 'Super Administrador',
            'admin_empresa': 'Administrador',
            'usuario': 'Usuario',
            'soporte': 'Soporte'
        };
        userRole.textContent = tipos[usuario.tipo_usuario] || usuario.tipo_usuario;
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function initEventListeners() {
    // Búsqueda de cliente por documento
    document.getElementById('btnBuscarDocumento').addEventListener('click', buscarPorDocumento);
    document.getElementById('numeroDocumento').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarPorDocumento();
    });

    // Búsqueda de cliente por nombre
    document.getElementById('buscarNombre').addEventListener('input', debounce(buscarPorNombre, 300));
    
    // Botones de cliente
    document.getElementById('btnNuevoCliente').addEventListener('click', abrirModalCliente);
    document.getElementById('btnCambiarCliente').addEventListener('click', cambiarCliente);

    // Búsqueda de productos
    document.getElementById('buscarProducto').addEventListener('input', debounce(buscarProductos, 300));

    // Formulario de cliente
    document.getElementById('clienteForm').addEventListener('submit', guardarClienteRapido);

    // Descuento
    document.getElementById('inputDescuento').addEventListener('input', calcularTotales);

    // Botones principales
    document.getElementById('btnGuardarVenta').addEventListener('click', guardarVenta);
    document.getElementById('btnLimpiarVenta').addEventListener('click', limpiarVenta);
    document.getElementById('btnCancelarVenta').addEventListener('click', limpiarVenta);

    // Sidebar
    document.getElementById('toggleSidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('active');
        document.getElementById('sidebarOverlay').classList.toggle('active');
    });

    document.getElementById('closeSidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('sidebarOverlay').classList.remove('active');
    });

    document.getElementById('sidebarOverlay').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('sidebarOverlay').classList.remove('active');
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        cerrarSesion();
    });

    // Ocultar resultados al hacer click fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#buscarNombre') && !e.target.closest('#resultadosNombre')) {
            document.getElementById('resultadosNombre').style.display = 'none';
        }
        if (!e.target.closest('#buscarProducto') && !e.target.closest('#resultadosProducto')) {
            document.getElementById('resultadosProducto').style.display = 'none';
        }
    });
}

// ============================================
// BÚSQUEDA DE CLIENTES
// ============================================

async function buscarPorDocumento() {
    const tipo = document.getElementById('tipoDocumento').value;
    const numero = document.getElementById('numeroDocumento').value.trim();

    if (!numero) {
        mostrarAlerta('Ingresa un número de documento', 'warning');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/ventas/buscar-cliente?empresaId=${currentEmpresa.id}&tipo=documento&valor=${numero}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!response.ok) throw new Error('Error al buscar cliente');

        const data = await response.json();
        const clientes = data.data;

        if (clientes.length === 0) {
            mostrarAlerta('Cliente no encontrado. Puedes registrarlo con el botón "Nuevo Cliente"', 'info');
            return;
        }

        if (clientes.length === 1) {
            seleccionarCliente(clientes[0]);
        } else {
            // Mostrar lista para seleccionar
            mostrarOpcionesClientes(clientes, 'resultadosNombre');
        }

    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al buscar cliente', 'danger');
    }
}

async function buscarPorNombre() {
    const busqueda = document.getElementById('buscarNombre').value.trim();
    
    if (busqueda.length < 2) {
        document.getElementById('resultadosNombre').style.display = 'none';
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/ventas/buscar-cliente?empresaId=${currentEmpresa.id}&tipo=nombre&valor=${busqueda}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!response.ok) throw new Error('Error al buscar cliente');

        const data = await response.json();
        mostrarOpcionesClientes(data.data, 'resultadosNombre');

    } catch (error) {
        console.error('Error:', error);
    }
}

function mostrarOpcionesClientes(clientes, containerId) {
    const container = document.getElementById(containerId);
    
    if (clientes.length === 0) {
        container.innerHTML = '<div class="p-3 text-muted">No se encontraron clientes</div>';
        container.style.display = 'block';
        return;
    }

    container.innerHTML = clientes.map(c => `
        <div class="search-result-item" onclick="seleccionarCliente(${JSON.stringify(c).replace(/"/g, '&quot;')})">
            <strong>${c.razon_social || `${c.nombre} ${c.apellido || ''}`.trim()}</strong><br>
            <small class="text-muted">${c.tipo_documento}: ${c.numero_documento}</small>
        </div>
    `).join('');
    
    container.style.display = 'block';
}

function seleccionarCliente(cliente) {
    clienteSeleccionado = cliente;
    
    // Ocultar búsqueda
    document.getElementById('busquedaCliente').style.display = 'none';
    document.getElementById('resultadosNombre').style.display = 'none';
    
    // Mostrar info del cliente
    document.getElementById('clienteNombre').textContent = 
        cliente.razon_social || `${cliente.nombre} ${cliente.apellido || ''}`.trim();
    document.getElementById('clienteDocumento').textContent = 
        `${cliente.tipo_documento}: ${cliente.numero_documento}`;
    document.getElementById('clienteEmail').textContent = cliente.email || 'Sin email';
    document.getElementById('clienteTelefono').textContent = cliente.celular || cliente.telefono || 'Sin teléfono';
    document.getElementById('clienteDireccion').textContent = 
        cliente.direccion ? `${cliente.direccion}, ${cliente.ciudad || ''}` : 'Sin dirección';
    
    document.getElementById('clienteSeleccionado').style.display = 'block';
    
    // Habilitar sección de productos
    habilitarSeccionProductos();
    
    // Focus en búsqueda de productos
    document.getElementById('buscarProducto').focus();
}

function cambiarCliente() {
    clienteSeleccionado = null;
    document.getElementById('busquedaCliente').style.display = 'block';
    document.getElementById('clienteSeleccionado').style.display = 'none';
    document.getElementById('numeroDocumento').value = '';
    document.getElementById('buscarNombre').value = '';
    deshabilitarSeccionProductos();
}

// ============================================
// BÚSQUEDA DE PRODUCTOS
// ============================================

async function buscarProductos() {
    const busqueda = document.getElementById('buscarProducto').value.trim();
    
    if (busqueda.length < 2) {
        document.getElementById('resultadosProducto').style.display = 'none';
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/ventas/buscar-producto?empresaId=${currentEmpresa.id}&busqueda=${busqueda}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!response.ok) throw new Error('Error al buscar productos');

        const data = await response.json();
        mostrarOpcionesProductos(data.data);

    } catch (error) {
        console.error('Error:', error);
    }
}

function mostrarOpcionesProductos(productos) {
    const container = document.getElementById('resultadosProducto');
    
    if (productos.length === 0) {
        container.innerHTML = '<div class="p-3 text-muted">No se encontraron productos</div>';
        container.style.display = 'block';
        return;
    }

    container.innerHTML = productos.map(p => `
        <div class="search-result-item" onclick='agregarProducto(${JSON.stringify(p).replace(/'/g, "\\'")})'">
            <div class="d-flex justify-content-between">
                <div>
                    <strong>${p.nombre}</strong><br>
                    <small class="text-muted">SKU: ${p.sku} | Stock: ${p.stock_actual}</small>
                </div>
                <div class="text-end">
                    <strong class="text-success">$${formatearNumero(p.precio_venta)}</strong>
                </div>
            </div>
        </div>
    `).join('');
    
    container.style.display = 'block';
}

function agregarProducto(producto) {
    // Verificar si ya está en la lista
    const index = productosVenta.findIndex(p => p.id === producto.id);
    
    if (index >= 0) {
        // Incrementar cantidad si hay stock
        if (productosVenta[index].cantidad < producto.stock_actual) {
            productosVenta[index].cantidad++;
            productosVenta[index].subtotal = productosVenta[index].cantidad * productosVenta[index].precio_unitario;
        } else {
            mostrarAlerta('No hay suficiente stock disponible', 'warning');
        }
    } else {
        // Agregar nuevo producto
        if (producto.stock_actual < 1) {
            mostrarAlerta('Producto sin stock disponible', 'warning');
            return;
        }

        productosVenta.push({
            id: producto.id,
            nombre: producto.nombre,
            sku: producto.sku,
            precio_unitario: producto.precio_venta,
            cantidad: 1,
            stock_disponible: producto.stock_actual,
            subtotal: producto.precio_venta
        });
    }

    // Limpiar búsqueda
    document.getElementById('buscarProducto').value = '';
    document.getElementById('resultadosProducto').style.display = 'none';

    renderizarProductos();
    calcularTotales();
}

function renderizarProductos() {
    const container = document.getElementById('listaProductos');
    const empty = document.getElementById('emptyProductos');

    if (productosVenta.length === 0) {
        empty.style.display = 'block';
        container.innerHTML = '';
        return;
    }

    empty.style.display = 'none';
    
    container.innerHTML = productosVenta.map((p, index) => `
        <div class="producto-item">
            <div class="d-flex justify-content-between align-items-center">
                <div class="flex-grow-1">
                    <strong>${p.nombre}</strong><br>
                    <small class="text-muted">SKU: ${p.sku} | Stock: ${p.stock_disponible}</small>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <div class="d-flex align-items-center">
                        <button class="btn btn-sm btn-outline-secondary btn-cantidad" onclick="cambiarCantidad(${index}, -1)">
                            <i class="bi bi-dash"></i>
                        </button>
                        <input type="number" class="form-control form-control-sm input-cantidad mx-1" 
                               value="${p.cantidad}" min="1" max="${p.stock_disponible}"
                               onchange="actualizarCantidad(${index}, this.value)">
                        <button class="btn btn-sm btn-outline-secondary btn-cantidad" onclick="cambiarCantidad(${index}, 1)">
                            <i class="bi bi-plus"></i>
                        </button>
                    </div>
                    <div class="text-end" style="min-width: 100px;">
                        <strong class="text-success">$${formatearNumero(p.subtotal)}</strong><br>
                        <small class="text-muted">@$${formatearNumero(p.precio_unitario)}</small>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminarProducto(${index})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function cambiarCantidad(index, delta) {
    const producto = productosVenta[index];
    const nuevaCantidad = producto.cantidad + delta;

    if (nuevaCantidad < 1) {
        eliminarProducto(index);
        return;
    }

    if (nuevaCantidad > producto.stock_disponible) {
        mostrarAlerta('No hay suficiente stock disponible', 'warning');
        return;
    }

    producto.cantidad = nuevaCantidad;
    producto.subtotal = producto.cantidad * producto.precio_unitario;

    renderizarProductos();
    calcularTotales();
}

function actualizarCantidad(index, valor) {
    const cantidad = parseInt(valor);
    if (isNaN(cantidad) || cantidad < 1) {
        renderizarProductos();
        return;
    }

    const producto = productosVenta[index];
    if (cantidad > producto.stock_disponible) {
        mostrarAlerta('No hay suficiente stock disponible', 'warning');
        renderizarProductos();
        return;
    }

    producto.cantidad = cantidad;
    producto.subtotal = producto.cantidad * producto.precio_unitario;

    renderizarProductos();
    calcularTotales();
}

function eliminarProducto(index) {
    productosVenta.splice(index, 1);
    renderizarProductos();
    calcularTotales();
}

// ============================================
// CÁLCULOS Y TOTALES
// ============================================

function calcularTotales() {
    const subtotal = productosVenta.reduce((sum, p) => sum + p.subtotal, 0);
    const descuento = parseFloat(document.getElementById('inputDescuento').value) || 0;
    const baseImponible = subtotal - descuento;
    const impuesto = baseImponible * 0.19; // IVA 19%
    const total = baseImponible + impuesto;

    document.getElementById('resumenSubtotal').textContent = `$${formatearNumero(subtotal)}`;
    document.getElementById('resumenImpuesto').textContent = `$${formatearNumero(impuesto)}`;
    document.getElementById('resumenTotal').textContent = `$${formatearNumero(total)}`;

    // Habilitar/deshabilitar botón de guardar
    const btnGuardar = document.getElementById('btnGuardarVenta');
    btnGuardar.disabled = !clienteSeleccionado || productosVenta.length === 0;
}

// ============================================
// GUARDAR VENTA
// ============================================

async function guardarVenta() {
    if (!clienteSeleccionado || productosVenta.length === 0) {
        mostrarAlerta('Debes seleccionar un cliente y agregar productos', 'warning');
        return;
    }

    const subtotal = productosVenta.reduce((sum, p) => sum + p.subtotal, 0);
    const descuento = parseFloat(document.getElementById('inputDescuento').value) || 0;
    const baseImponible = subtotal - descuento;
    const impuesto = baseImponible * 0.19;
    const total = baseImponible + impuesto;

    const ventaData = {
        empresa_id: currentEmpresa.id,
        cliente_id: clienteSeleccionado.id,
        vendedor_id: currentUsuario.id,
        subtotal: subtotal,
        descuento: descuento,
        impuesto: impuesto,
        total: total,
        metodo_pago: document.getElementById('metodoPago').value,
        notas: document.getElementById('notasVenta').value || null,
        productos: productosVenta.map(p => ({
            producto_id: p.id,
            cantidad: p.cantidad,
            precio_unitario: p.precio_unitario,
            descuento: 0,
            subtotal: p.subtotal
        }))
    };

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/ventas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(ventaData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al guardar venta');
        }

        const data = await response.json();
        
        mostrarAlerta(`¡Venta guardada exitosamente! Factura: ${data.data.numero_factura}`, 'success');
        
        // Limpiar todo después de 2 segundos
        setTimeout(() => {
            limpiarVenta();
        }, 2000);

    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta(error.message || 'Error al guardar venta', 'danger');
    }
}

// ============================================
// UTILIDADES
// ============================================

function limpiarVenta() {
    if (productosVenta.length > 0) {
        if (!confirm('¿Estás seguro de limpiar toda la venta?')) {
            return;
        }
    }

    clienteSeleccionado = null;
    productosVenta = [];
    
    document.getElementById('busquedaCliente').style.display = 'block';
    document.getElementById('clienteSeleccionado').style.display = 'none';
    document.getElementById('numeroDocumento').value = '';
    document.getElementById('buscarNombre').value = '';
    document.getElementById('inputDescuento').value = '0';
    document.getElementById('notasVenta').value = '';
    document.getElementById('metodoPago').value = 'efectivo';
    
    renderizarProductos();
    calcularTotales();
    deshabilitarSeccionProductos();
}

function habilitarSeccionProductos() {
    document.getElementById('seccionProductos').classList.remove('section-disabled');
}

function deshabilitarSeccionProductos() {
    document.getElementById('seccionProductos').classList.add('section-disabled');
}

function abrirModalCliente() {
    document.getElementById('clienteForm').reset();
    document.getElementById('clienteTipoDocumento').value = document.getElementById('tipoDocumento').value;
    document.getElementById('clienteNumeroDocumento').value = document.getElementById('numeroDocumento').value;
    
    const modal = new bootstrap.Modal(document.getElementById('clienteModal'));
    modal.show();
}

async function guardarClienteRapido(e) {
    e.preventDefault();

    // Validar que tenemos empresa activa
    if (!currentEmpresa || !currentEmpresa.id) {
        mostrarAlerta('No hay empresa activa seleccionada', 'warning');
        return;
    }

    // Validar campos requeridos
    const numero_documento = document.getElementById('clienteNumeroDocumento').value.trim();
    const nombre = document.getElementById('clienteNombre').value.trim();

    if (!numero_documento || !nombre) {
        mostrarAlerta('Los campos Documento y Nombre son obligatorios', 'warning');
        return;
    }

    const clienteData = {
        empresa_id: currentEmpresa.id,
        tipo_documento: document.getElementById('clienteTipoDocumento').value,
        numero_documento: numero_documento,
        nombre: nombre,
        apellido: document.getElementById('clienteApellido').value.trim() || null,
        telefono: document.getElementById('clienteTelefonoNuevo').value.trim() || null,
        email: document.getElementById('clienteEmailNuevo').value.trim() || null,
        estado: 'activo'
    };

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/clientes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(clienteData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al guardar cliente');
        }

        const data = await response.json();
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('clienteModal'));
        modal.hide();

        mostrarAlerta('Cliente creado exitosamente', 'success');

        // Buscar el cliente recién creado y seleccionarlo
        setTimeout(() => {
            buscarPorDocumento();
        }, 500);

    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta(error.message || 'Error al guardar cliente', 'danger');
    }
}

function formatearNumero(num) {
    return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = 'login.html';
}

function mostrarAlerta(mensaje, tipo = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tipo} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    alertDiv.innerHTML = `
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}
