/**
 * =================================
 * KORE INVENTORY - VENTAS/POS MODULE
 * Módulo de punto de venta
 * Version: 1.1.0 - 2026-02-04
 * =================================
 */

const API_URL = 'http://18.191.181.99:3000/api';
let currentEmpresa = null;
let currentUsuario = null;
let clienteSeleccionado = null;
let productosVenta = [];
let clientesEncontrados = []; // Para evitar pasar objetos por HTML
let ultimaVentaGuardada = null; // Guardar última venta para impresión
let ultimaVentaData = null; // Guardar datos de última venta para impresión

console.log('🚀 Ventas.js cargado - Versión 1.6.2 - Debug factura totales');

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

        // Cargar empresas del usuario
        await cargarEmpresas(usuario.id);

        currentEmpresa = JSON.parse(localStorage.getItem('empresaActiva'));
        if (!currentEmpresa) {
            mostrarAlerta('Por favor selecciona una empresa desde el dashboard', 'warning');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
            return;
        }

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
// CARGAR EMPRESAS DEL USUARIO
// ============================================

async function cargarEmpresas(usuarioId) {
    const token = localStorage.getItem('token');
    const companySelector = document.getElementById('companySelector');
    
    if (!companySelector) return;
    
    try {
        const response = await fetch(`${API_URL}/empresas/usuario/${usuarioId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            // Limpiar selector
            companySelector.innerHTML = '';
            
            // Agregar opciones
            data.data.forEach(empresa => {
                const option = document.createElement('option');
                option.value = empresa.id;
                option.textContent = empresa.nombre;
                companySelector.appendChild(option);
            });
            
            // Seleccionar la primera empresa o la guardada
            const empresaGuardada = localStorage.getItem('empresaActiva');
            if (empresaGuardada) {
                const empresaObj = JSON.parse(empresaGuardada);
                companySelector.value = empresaObj.id;
            } else {
                companySelector.value = data.data[0].id;
                localStorage.setItem('empresaActiva', JSON.stringify(data.data[0]));
            }
            
            // Event listener para cambio de empresa
            companySelector.addEventListener('change', (e) => {
                const empresaId = e.target.value;
                const empresaSeleccionada = data.data.find(emp => emp.id == empresaId);
                localStorage.setItem('empresaActiva', JSON.stringify(empresaSeleccionada));
                // Limpiar y recargar cuando cambie empresa
                limpiarVenta();
            });
            
        } else {
            companySelector.innerHTML = '<option value="">Sin empresas asignadas</option>';
        }
        
    } catch (error) {
        console.error('Error al cargar empresas:', error);
        companySelector.innerHTML = '<option value="">Error al cargar empresas</option>';
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

    // Botón guardar cliente (ahora es click directo, no submit)
    document.getElementById('btnGuardarClienteModal').addEventListener('click', guardarClienteRapido);

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
    clientesEncontrados = clientes; // Guardar en variable global
    
    if (clientes.length === 0) {
        container.innerHTML = '<div class="p-3 text-muted">No se encontraron clientes</div>';
        container.style.display = 'block';
        return;
    }

    container.innerHTML = clientes.map((c, index) => `
        <div class="search-result-item" onclick="seleccionarClientePorIndice(${index})">
            <strong>${c.razon_social || `${c.nombre} ${c.apellido || ''}`.trim()}</strong><br>
            <small class="text-muted">${c.tipo_documento}: ${c.numero_documento}</small>
        </div>
    `).join('');
    
    container.style.display = 'block';
}

function seleccionarClientePorIndice(index) {
    if (clientesEncontrados[index]) {
        seleccionarCliente(clientesEncontrados[index]);
    }
}

function seleccionarCliente(cliente) {
    console.log('=== seleccionarCliente called ===');
    console.log('Tipo de cliente:', typeof cliente);
    console.log('cliente recibido:', cliente);
    console.log('cliente.id:', cliente?.id, 'tipo:', typeof cliente?.id);
    
    clienteSeleccionado = cliente;
    console.log('clienteSeleccionado asignado:', clienteSeleccionado);
    console.log('clienteSeleccionado.id:', clienteSeleccionado?.id);
    
    // Ocultar búsqueda
    document.getElementById('busquedaCliente').style.display = 'none';
    document.getElementById('resultadosNombre').style.display = 'none';
    
    // Mostrar info del cliente
    document.getElementById('clienteNombreDisplay').textContent = 
        cliente.razon_social || `${cliente.nombre} ${cliente.apellido || ''}`.trim();
    document.getElementById('clienteDocumentoDisplay').textContent = 
        `${cliente.tipo_documento}: ${cliente.numero_documento}`;
    document.getElementById('clienteEmailDisplay').textContent = cliente.email || 'Sin email';
    document.getElementById('clienteTelefonoDisplay').textContent = cliente.celular || cliente.telefono || 'Sin teléfono';
    document.getElementById('clienteDireccionDisplay').textContent = 
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
            const precio = parseFloat(productosVenta[index].precio_unitario);
            productosVenta[index].subtotal = productosVenta[index].cantidad * precio;
        } else {
            mostrarAlerta('No hay suficiente stock disponible', 'warning');
        }
    } else {
        // Agregar nuevo producto
        if (producto.stock_actual < 1) {
            mostrarAlerta('Producto sin stock disponible', 'warning');
            return;
        }

        const precioUnitario = parseFloat(producto.precio_venta);
        productosVenta.push({
            id: producto.id,
            nombre: producto.nombre,
            sku: producto.sku,
            precio_unitario: precioUnitario,
            cantidad: 1,
            stock_disponible: producto.stock_actual,
            subtotal: precioUnitario
        });
    }

    // Limpiar búsqueda
    document.getElementById('buscarProducto').value = '';
    document.getElementById('resultadosProducto').style.display = 'none';

    renderizarProductos();
    calcularTotales();
}

function renderizarProductos() {
    try {
        console.log('=== renderizarProductos ===');
        console.log('productosVenta.length:', productosVenta.length);
        console.log('productosVenta:', productosVenta);
        
        const container = document.getElementById('listaProductos');

        if (productosVenta.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4" id="emptyProductos">
                    <i class="bi bi-cart display-1 opacity-25"></i>
                    <p class="mt-2">No hay productos agregados</p>
                </div>`;
            return;
        }
        
        let html = '';
        for (let index = 0; index < productosVenta.length; index++) {
            const p = productosVenta[index];
            console.log(`Generando HTML para producto ${index}:`, p);
            
            html += `
            <div class="producto-item mb-3 p-3 border rounded">
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
                                   onchange="actualizarCantidad(${index}, this.value)"
                                   style="width: 60px; text-align: center;">
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
            </div>`;
        }
        
        console.log('HTML completo generado, longitud:', html.length);
        console.log('Primeros 200 chars:', html.substring(0, 200));
        container.innerHTML = html;
        console.log('container.innerHTML actualizado, children count:', container.children.length);
    } catch (error) {
        console.error('ERROR en renderizarProductos:', error);
        console.error('Stack:', error.stack);
    }
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
    const precio = parseFloat(producto.precio_unitario);
    producto.subtotal = producto.cantidad * precio;

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
    const precio = parseFloat(producto.precio_unitario);
    producto.subtotal = producto.cantidad * precio;

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
    console.log('=== Iniciando guardarVenta ===');
    console.log('clienteSeleccionado:', clienteSeleccionado);
    console.log('productosVenta:', productosVenta);
    console.log('currentEmpresa:', currentEmpresa);
    console.log('currentUsuario:', currentUsuario);

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
        empresa_id: currentEmpresa?.id,
        cliente_id: clienteSeleccionado?.id,
        vendedor_id: currentUsuario?.id,
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

    console.log('ventaData a enviar:', ventaData);

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
        
        // Guardar nombres de productos antes de limpiar
        const productosConNombres = ventaData.productos.map(p => ({
            ...p,
            nombre: productosVenta.find(pv => pv.id === p.producto_id)?.nombre || 'Producto'
        }));
        
        // Guardar datos de venta en variables globales para la impresión
        ultimaVentaGuardada = data.data;
        ultimaVentaData = {
            ...ventaData, 
            productos: productosConNombres,
            cliente: clienteSeleccionado // Guardar cliente para impresión
        };
        
        // Limpiar formulario SIN confirmación (ya guardamos la venta)
        limpiarVentaSinConfirmar();
        
        // Mostrar factura después de limpiar
        mostrarFactura(ultimaVentaGuardada, ultimaVentaData);
        
        mostrarAlerta('Venta guardada exitosamente', 'success');

    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta(error.message || 'Error al guardar venta', 'danger');
    }
}

// ============================================
// UTILIDADES
// ============================================

// Limpiar venta CON confirmación (para botón "Limpiar Todo")
function limpiarVenta() {
    if (productosVenta.length > 0) {
        if (!confirm('¿Estás seguro de limpiar toda la venta?')) {
            return;
        }
    }
    limpiarVentaSinConfirmar();
}

// Limpiar venta SIN confirmación (después de guardar)
function limpiarVentaSinConfirmar() {
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

async function guardarClienteRapido() {
    try {
        console.log('=== Iniciando guardarClienteRapido ===');
        
        // Validar que tenemos empresa activa
        if (!currentEmpresa || !currentEmpresa.id) {
            mostrarAlerta('No hay empresa activa seleccionada', 'warning');
            return;
        }
        
        console.log('Empresa activa:', currentEmpresa);

        // Obtener elementos
        const elemNumDoc = document.getElementById('clienteNumeroDocumento');
        const elemNombre = document.getElementById('clienteNombre');
        const elemApellido = document.getElementById('clienteApellido');
        const elemTelefono = document.getElementById('clienteTelefonoNuevo');
        const elemEmail = document.getElementById('clienteEmailNuevo');
        const elemTipoDoc = document.getElementById('clienteTipoDocumento');

        console.log('Elementos encontrados:', {
            elemNumDoc: !!elemNumDoc,
            elemNombre: !!elemNombre,
            elemApellido: !!elemApellido,
            elemTelefono: !!elemTelefono,
            elemEmail: !!elemEmail,
            elemTipoDoc: !!elemTipoDoc
        });

        // Validar que existen
        if (!elemNumDoc || !elemNombre) {
            console.error('Elementos del formulario no encontrados');
            mostrarAlerta('Error: No se pudo cargar el formulario', 'danger');
            return;
        }

        // Obtener valores
        const numero_documento = (elemNumDoc.value || '').trim();
        const nombre = (elemNombre.value || '').trim();
        const apellido = (elemApellido?.value || '').trim();
        const telefono = (elemTelefono?.value || '').trim();
        const email = (elemEmail?.value || '').trim();
        const tipo_documento = elemTipoDoc?.value || 'CC';

        console.log('Valores obtenidos:', {
            tipo_documento,
            numero_documento,
            nombre,
            apellido,
            telefono,
            email
        });

        // Validar campos requeridos
        if (!numero_documento || !nombre) {
            mostrarAlerta('Los campos Documento y Nombre son obligatorios', 'warning');
            console.error('Validación fallida:', { numero_documento, nombre });
            return;
        }

        console.log('Validación exitosa, preparando datos...');

        const clienteData = {
            empresa_id: currentEmpresa.id,
            tipo_documento: tipo_documento,
            numero_documento: numero_documento,
            nombre: nombre,
            apellido: apellido || null,
            telefono: telefono || null,
            email: email || null,
            estado: 'activo'
        };

        console.log('Datos a enviar:', clienteData);

        const token = localStorage.getItem('token');
        console.log('Enviando petición al servidor...');
        
        const response = await fetch(`${API_URL}/clientes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(clienteData)
        });

        console.log('Respuesta del servidor:', response.status);

        if (!response.ok) {
            const error = await response.json();
            console.error('Error del servidor:', error);
            throw new Error(error.message || 'Error al guardar cliente');
        }

        const data = await response.json();
        console.log('Cliente guardado exitosamente:', data);
        console.log('data.data:', data.data);
        console.log('data.data.id:', data.data?.id);
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('clienteModal'));
        if (modal) {
            modal.hide();
        }

        mostrarAlerta('Cliente creado exitosamente', 'success');

        // Seleccionar el cliente recién creado directamente
        if (data.data && data.data.id) {
            console.log('Seleccionando cliente con ID:', data.data.id);
            // El backend devuelve el cliente con ID, seleccionarlo directamente
            seleccionarCliente(data.data);
            console.log('clienteSeleccionado después de seleccionar:', clienteSeleccionado);
        } else {
            console.log('data.data no tiene ID, buscando por documento');
            // Si no devuelve el objeto completo, buscar por documento
            document.getElementById('numeroDocumento').value = numero_documento;
            setTimeout(() => {
                buscarPorDocumento();
            }, 500);
        }

    } catch (error) {
        console.error('Error en guardarClienteRapido:', error);
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

// ============================================
// FACTURA
// ============================================

function mostrarFactura(venta, ventaData) {
    console.log('=== mostrarFactura DEBUG ===');
    console.log('ventaData recibido:', ventaData);
    console.log('ventaData.subtotal:', ventaData.subtotal);
    console.log('ventaData.impuesto:', ventaData.impuesto);
    console.log('ventaData.total:', ventaData.total);
    
    // Calcular totales correctamente
    const subtotal = ventaData.subtotal;
    const descuento = ventaData.descuento || 0;
    const impuesto = ventaData.impuesto;
    const total = ventaData.total;
    
    console.log('Variables extraídas - subtotal:', subtotal, 'impuesto:', impuesto, 'total:', total);
    
    // Formatear fecha
    const fecha = new Date().toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const html = `
        <div id="facturaPrint" class="p-3" style="max-width: 100%; font-size: 0.95rem;">
            <!-- Encabezado Empresa -->
            <div class="text-center mb-3">
                <h4 class="mb-2" style="font-size: 1.3rem;">${currentEmpresa.nombre}</h4>
                <p class="mb-1" style="font-size: 0.9rem;">${currentEmpresa.razon_social}</p>
                <p class="mb-1" style="font-size: 0.9rem;">NIT: ${currentEmpresa.nit}</p>
                <p class="mb-1" style="font-size: 0.85rem;">${currentEmpresa.direccion || ''}</p>
                <p class="mb-1" style="font-size: 0.85rem;">Tel: ${currentEmpresa.telefono || ''} | Email: ${currentEmpresa.email}</p>
                <hr>
                <h5 style="font-size: 1.1rem;">FACTURA DE VENTA</h5>
                <p style="font-size: 1rem;"><strong>${venta.numero_factura}</strong></p>
            </div>

            <!-- Datos Cliente y Venta -->
            <div class="row mb-3" style="font-size: 0.9rem;">
                <div class="col-12 col-md-6 mb-2">
                    <strong>Cliente:</strong><br>
                    ${ventaData.cliente.razon_social || `${ventaData.cliente.nombre} ${ventaData.cliente.apellido || ''}`}<br>
                    ${ventaData.cliente.tipo_documento}: ${ventaData.cliente.numero_documento}<br>
                    ${ventaData.cliente.telefono || ventaData.cliente.celular || ''}<br>
                    ${ventaData.cliente.direccion || ''}
                </div>
                <div class="col-12 col-md-6 text-md-end">
                    <strong>Fecha:</strong> ${fecha}<br>
                    <strong>Vendedor:</strong> ${currentUsuario.nombre} ${currentUsuario.apellido}<br>
                    <strong>Método de Pago:</strong> ${ventaData.metodo_pago}
                </div>
            </div>

            <!-- Detalle Productos -->
            <div class="table-responsive">
            <table class="table table-bordered table-sm" style="font-size: 0.85rem;">
                <thead class="table-light">
                    <tr>
                        <th style="min-width: 120px;">Producto</th>
                        <th class="text-center" style="width: 70px;">Cant.</th>
                        <th class="text-end" style="width: 90px;">P. Unit.</th>
                        <th class="text-end" style="width: 90px;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${ventaData.productos.map(p => `
                        <tr>
                            <td>${p.nombre}</td>
                            <td class="text-center">${p.cantidad}</td>
                            <td class="text-end">$${formatearNumero(p.precio_unitario)}</td>
                            <td class="text-end">$${formatearNumero(p.subtotal)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" class="text-end"><strong>Subtotal:</strong></td>
                        <td class="text-end">$${formatearNumero(subtotal)}</td>
                    </tr>
                    ${descuento > 0 ? `
                    <tr>
                        <td colspan="3" class="text-end"><strong>Descuento:</strong></td>
                        <td class="text-end">-$${formatearNumero(descuento)}</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td colspan="3" class="text-end"><strong>IVA (19%):</strong></td>
                        <td class="text-end">$${formatearNumero(impuesto)}</td>
                    </tr>
                    <tr class="table-primary">
                        <td colspan="3" class="text-end"><strong>TOTAL:</strong></td>
                        <td class="text-end"><strong>$${formatearNumero(total)}</strong></td>
                    </tr>
                </tfoot>
            </table>
            </div>

            <div class="text-center mt-3">
                <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 0;">¡Gracias por su compra!</p>
            </div>
        </div>
    `;

    document.getElementById('facturaContent').innerHTML = html;
    const modal = new bootstrap.Modal(document.getElementById('facturaModal'));
    modal.show();
}

function imprimirFactura() {
    if (!ultimaVentaGuardada || !ultimaVentaData) {
        mostrarAlerta('No hay factura para imprimir', 'warning');
        return;
    }

    // Detectar si es dispositivo móvil para usar formato térmico
    const esMovil = window.innerWidth <= 768;
    const formatoTermico = esMovil || confirm('¿Desea imprimir en formato de tirilla térmica?\n\nOK = Tirilla térmica (58mm)\nCancelar = Tamaño carta');

    const numeroFactura = ultimaVentaGuardada.numero_factura || 'factura';
    const nombreArchivo = `Factura_${numeroFactura}`;

    // Generar HTML de impresión
    const htmlImpresion = generarHTMLImpresion(formatoTermico);

    // Abrir ventana de impresión
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) {
        mostrarAlerta('No se pudo abrir la ventana de impresión. Verifica que los popups estén permitidos.', 'warning');
        return;
    }

    printWindow.document.write(htmlImpresion);
    printWindow.document.close();
}

function generarHTMLImpresion(formatoTermico = false) {
    const venta = ultimaVentaGuardada;
    const ventaData = ultimaVentaData;
    const numeroFactura = venta.numero_factura;
    
    const subtotal = ventaData.subtotal;
    const descuento = ventaData.descuento || 0;
    const impuesto = ventaData.impuesto;
    const total = ventaData.total;
    
    const fecha = new Date().toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    if (formatoTermico) {
        // FORMATO TÉRMICO (58mm o 80mm)
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Factura_${numeroFactura}</title>
    <style>
        @page {
            size: 58mm auto;
            margin: 2mm;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Courier New', monospace;
            font-size: 9pt;
            width: 58mm;
            padding: 2mm;
            background: white;
            color: black;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { 
            border-top: 1px dashed #000; 
            margin: 3mm 0;
        }
        .item {
            margin: 2mm 0;
            font-size: 8pt;
        }
        .item-name { 
            font-weight: bold;
        }
        .item-details {
            display: flex;
            justify-content: space-between;
            font-size: 8pt;
        }
        .totals {
            margin-top: 3mm;
            font-size: 9pt;
        }
        .totals-row {
            display: flex;
            justify-content: space-between;
            margin: 1mm 0;
        }
        .total-final {
            font-size: 11pt;
            font-weight: bold;
            margin-top: 2mm;
        }
        @media print {
            body { padding: 0; }
        }
    </style>
</head>
<body>
    <div class="center bold" style="font-size: 11pt;">${currentEmpresa.nombre}</div>
    <div class="center" style="font-size: 8pt;">${currentEmpresa.razon_social}</div>
    <div class="center" style="font-size: 8pt;">NIT: ${currentEmpresa.nit}</div>
    <div class="center" style="font-size: 8pt;">${currentEmpresa.telefono || ''}</div>
    
    <div class="line"></div>
    
    <div class="center bold" style="font-size: 10pt;">FACTURA DE VENTA</div>
    <div class="center bold" style="font-size: 10pt;">${numeroFactura}</div>
    <div class="center" style="font-size: 8pt;">${fecha}</div>
    
    <div class="line"></div>
    
    <div style="font-size: 8pt;">
        <div><strong>Cliente:</strong></div>
        <div>${ventaData.cliente.razon_social || `${ventaData.cliente.nombre} ${ventaData.cliente.apellido || ''}`}</div>
        <div>${ventaData.cliente.tipo_documento}: ${ventaData.cliente.numero_documento}</div>
    </div>
    
    <div class="line"></div>
    
    ${ventaData.productos.map(p => `
        <div class="item">
            <div class="item-name">${p.nombre}</div>
            <div class="item-details">
                <span>${p.cantidad} x $${formatearNumero(p.precio_unitario)}</span>
                <span>$${formatearNumero(p.subtotal)}</span>
            </div>
        </div>
    `).join('')}
    
    <div class="line"></div>
    
    <div class="totals">
        <div class="totals-row">
            <span>Subtotal:</span>
            <span>$${formatearNumero(subtotal)}</span>
        </div>
        ${descuento > 0 ? `
        <div class="totals-row">
            <span>Descuento:</span>
            <span>-$${formatearNumero(descuento)}</span>
        </div>
        ` : ''}
        <div class="totals-row">
            <span>IVA (19%):</span>
            <span>$${formatearNumero(impuesto)}</span>
        </div>
        <div class="totals-row total-final">
            <span>TOTAL:</span>
            <span>$${formatearNumero(total)}</span>
        </div>
    </div>
    
    <div class="line"></div>
    
    <div class="center" style="font-size: 8pt; margin-top: 3mm;">
        ¡Gracias por su compra!
    </div>
    <div class="center" style="font-size: 7pt;">Vendedor: ${currentUsuario.nombre} ${currentUsuario.apellido}</div>
    <div class="center" style="font-size: 7pt;">Pago: ${ventaData.metodo_pago}</div>
    
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 100);
            }, 250);
        };
    </script>
</body>
</html>
        `;
    } else {
        // FORMATO CARTA (Letter)
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Factura_${numeroFactura}</title>
    <style>
        @page {
            size: letter;
            margin: 15mm;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: Arial, sans-serif;
            font-size: 11pt;
            color: #000;
            background: white;
            padding: 10mm;
        }
        .encabezado {
            text-align: center;
            margin-bottom: 8mm;
        }
        .encabezado h2 {
            font-size: 18pt;
            margin-bottom: 2mm;
        }
        .encabezado p {
            font-size: 10pt;
            margin: 1mm 0;
        }
        .titulo-factura {
            text-align: center;
            font-size: 14pt;
            font-weight: bold;
            margin: 5mm 0;
            padding: 3mm;
            border: 2px solid #000;
        }
        .info-cliente {
            display: flex;
            justify-content: space-between;
            margin: 5mm 0;
            font-size: 10pt;
        }
        .info-cliente > div {
            flex: 1;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 5mm 0;
            font-size: 10pt;
        }
        th {
            background-color: #f0f0f0;
            border: 1px solid #000;
            padding: 3mm;
            text-align: left;
            font-weight: bold;
        }
        td {
            border: 1px solid #000;
            padding: 3mm;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .totales {
            margin-top: 5mm;
            float: right;
            width: 50%;
        }
        .totales table {
            width: 100%;
            margin: 0;
        }
        .totales td {
            border: none;
            border-bottom: 1px solid #ddd;
            padding: 2mm;
        }
        .total-final {
            font-size: 12pt;
            font-weight: bold;
            background-color: #f0f0f0;
        }
        .footer {
            clear: both;
            text-align: center;
            margin-top: 10mm;
            padding-top: 5mm;
            border-top: 1px solid #ddd;
            font-size: 9pt;
            color: #666;
        }
        @media print {
            body { padding: 0; }
        }
    </style>
</head>
<body>
    <div class="encabezado">
        <h2>${currentEmpresa.nombre}</h2>
        <p>${currentEmpresa.razon_social}</p>
        <p>NIT: ${currentEmpresa.nit}</p>
        <p>${currentEmpresa.direccion || ''}</p>
        <p>Tel: ${currentEmpresa.telefono || ''} | Email: ${currentEmpresa.email}</p>
    </div>
    
    <div class="titulo-factura">
        FACTURA DE VENTA<br>
        ${numeroFactura}
    </div>
    
    <div class="info-cliente">
        <div>
            <strong>CLIENTE:</strong><br>
            ${ventaData.cliente.razon_social || `${ventaData.cliente.nombre} ${ventaData.cliente.apellido || ''}`}<br>
            ${ventaData.cliente.tipo_documento}: ${ventaData.cliente.numero_documento}<br>
            ${ventaData.cliente.telefono || ventaData.cliente.celular || ''}<br>
            ${ventaData.cliente.direccion || ''}
        </div>
        <div class="text-right">
            <strong>FECHA:</strong> ${fecha}<br>
            <strong>VENDEDOR:</strong> ${currentUsuario.nombre} ${currentUsuario.apellido}<br>
            <strong>PAGO:</strong> ${ventaData.metodo_pago}
        </div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th style="width: 50%;">Producto</th>
                <th class="text-center" style="width: 10%;">Cant.</th>
                <th class="text-right" style="width: 20%;">Precio Unit.</th>
                <th class="text-right" style="width: 20%;">Subtotal</th>
            </tr>
        </thead>
        <tbody>
            ${ventaData.productos.map(p => `
                <tr>
                    <td>${p.nombre}</td>
                    <td class="text-center">${p.cantidad}</td>
                    <td class="text-right">$${formatearNumero(p.precio_unitario)}</td>
                    <td class="text-right">$${formatearNumero(p.subtotal)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <div class="totales">
        <table>
            <tr>
                <td><strong>Subtotal:</strong></td>
                <td class="text-right">$${formatearNumero(subtotal)}</td>
            </tr>
            ${descuento > 0 ? `
            <tr>
                <td><strong>Descuento:</strong></td>
                <td class="text-right">-$${formatearNumero(descuento)}</td>
            </tr>
            ` : ''}
            <tr>
                <td><strong>IVA (19%):</strong></td>
                <td class="text-right">$${formatearNumero(impuesto)}</td>
            </tr>
            <tr class="total-final">
                <td><strong>TOTAL:</strong></td>
                <td class="text-right"><strong>$${formatearNumero(total)}</strong></td>
            </tr>
        </table>
    </div>
    
    <div class="footer">
        <p>¡Gracias por su compra!</p>
        <p>${currentEmpresa.nombre} - ${currentEmpresa.telefono || ''}</p>
    </div>
    
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 100);
            }, 250);
        };
    </script>
</body>
</html>
        `;
    }
}
