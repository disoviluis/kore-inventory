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
let impuestosDisponibles = [];
let impuestosSeleccionados = [];
let pagosPendientes = []; // Array de pagos múltiples
let totalVentaActual = 0; // Total de la venta actual
let todosCatalogo = []; // Todos los productos del catálogo
let categoriasCatalogo = []; // Categorías disponibles
let categoriaFiltroActual = null; // Categoría filtrada actual
let productoSeleccionadoCatalogo = null; // Producto seleccionado en el catálogo
let vistaActual = 'grid'; // Vista actual del catálogo (grid o list)
let modoRapido = false; // Modo rápido activado
let turnoActivo = null; // Turno de caja actual
let ultimasVentas = []; // Últimas ventas del día

console.log('🚀 Ventas.js cargado - Versión 2.0.0 - POS Profesional');

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
        
        // Configurar visibilidad de PLATAFORMA en sidebar
        if (typeof configurarSidebarSuperAdmin === 'function') {
            configurarSidebarSuperAdmin();
        }

        // Cargar empresas del usuario
        await cargarEmpresas(usuario.id);

        currentEmpresa = JSON.parse(localStorage.getItem('empresaActiva'));
        if (!currentEmpresa) {
            mostrarAlerta('Por favor selecciona una empresa desde el dashboard', 'warning');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
            return;
        }

        // Cargar impuestos activos de la empresa
        await cargarImpuestosActivos();
        
        // Cargar catálogo de productos
        await cargarCatalogoProductos();

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
    document.getElementById('btnPublicoGeneral').addEventListener('click', seleccionarPublicoGeneral);

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
    
    // Modo rápido
    document.getElementById('modoRapidoSwitch').addEventListener('change', toggleModoRapido);
    
    // Turno de caja
    document.getElementById('btnTurnoCaja').addEventListener('click', abrirModalTurno);
    document.getElementById('btnAbrirTurno').addEventListener('click', abrirTurno);
    document.getElementById('btnCerrarTurno').addEventListener('click', cerrarTurno);
    document.getElementById('efectivoContado').addEventListener('input', calcularDiferenciaTurno);

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
                    <strong>${p.nombre}</strong>
                    ${p.aplica_iva ? '<span class="badge bg-info text-white ms-2"><i class="bi bi-percent"></i> IVA</span>' : ''}
                    <br>
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
        // Incrementar cantidad si hay stock O si permite venta sin stock
        const productoActual = productosVenta[index];
        const permiteVentaSinStock = producto.permite_venta_sin_stock === 1 || producto.permite_venta_sin_stock === true;
        
        if (productoActual.cantidad < producto.stock_actual) {
            // Hay stock disponible, incrementar normalmente
            productosVenta[index].cantidad++;
            const precio = parseFloat(productosVenta[index].precio_unitario);
            productosVenta[index].subtotal = productosVenta[index].cantidad * precio;
        } else if (permiteVentaSinStock) {
            // No hay stock pero permite venta sin stock
            mostrarModalVentaSinStock(producto, index);
            return;
        } else {
            mostrarAlerta('No hay suficiente stock disponible y este producto no permite ventas sin stock', 'warning');
            return;
        }
    } else {
        // Agregar nuevo producto
        const permiteVentaSinStock = producto.permite_venta_sin_stock === 1 || producto.permite_venta_sin_stock === true;
        
        if (producto.stock_actual < 1) {
            if (permiteVentaSinStock) {
                // Mostrar modal para confirmar venta contra pedido
                mostrarModalVentaSinStock(producto, -1);
                return;
            } else {
                mostrarAlerta('Producto sin stock disponible. Contacte con administración para habilitar ventas sin stock.', 'warning');
                return;
            }
        }

        const precioUnitario = parseFloat(producto.precio_venta || producto.precio_minorista);
        productosVenta.push({
            id: producto.id,
            nombre: producto.nombre,
            sku: producto.sku,
            precio_unitario: precioUnitario,
            precio_minorista: producto.precio_minorista || precioUnitario,
            precio_mayorista: producto.precio_mayorista || null,
            precio_distribuidor: producto.precio_distribuidor || null,
            precio_minimo: producto.precio_minimo || null,
            precio_maximo: producto.precio_maximo || null,
            cantidad: 1,
            stock_disponible: producto.stock_actual,
            subtotal: precioUnitario,
            tipo_venta: 'normal',
            estado_entrega: 'entregado',
            aplica_iva: producto.aplica_iva || false,
            porcentaje_iva: producto.porcentaje_iva || 19,
            iva_incluido_en_precio: producto.iva_incluido_en_precio || false
        });
    }

    // Limpiar búsqueda
    document.getElementById('buscarProducto').value = '';
    document.getElementById('resultadosProducto').style.display = 'none';

    renderizarProductos();
    calcularTotales();
    reproducirSonido('add');
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
            
            // Badge para venta contra pedido
            const badgeContraPedido = p.tipo_venta === 'contra_pedido' ? 
                `<span class="badge bg-warning text-dark ms-2">
                    <i class="bi bi-clock-history"></i> Contra Pedido
                 </span>` : '';
            
            // Información de entrega si es contra pedido
            const infoEntrega = p.tipo_venta === 'contra_pedido' && p.fecha_entrega_estimada ?
                `<br><small class="text-warning">
                    <i class="bi bi-calendar-event"></i> Entrega estimada: ${formatearFecha(p.fecha_entrega_estimada)}
                 </small>` : '';
            
            // Determinar si el precio está fuera de rango (para alertas visuales)
            let clasePrecio = '';
            let alertaPrecio = '';
            if (p.precio_minimo && p.precio_unitario < p.precio_minimo) {
                clasePrecio = 'border-danger';
                alertaPrecio = `<small class="text-danger"><i class="bi bi-exclamation-triangle"></i> Por debajo del mínimo ($${formatearNumero(p.precio_minimo)})</small>`;
            } else if (p.precio_maximo && p.precio_unitario > p.precio_maximo) {
                clasePrecio = 'border-warning';
                alertaPrecio = `<small class="text-warning"><i class="bi bi-exclamation-circle"></i> Por encima del máximo ($${formatearNumero(p.precio_maximo)})</small>`;
            }
            
            // Opciones de precios disponibles
            let opcionesPrecios = '';
            if (p.precio_minorista) {
                opcionesPrecios += `<option value="${p.precio_minorista}">Minorista - $${formatearNumero(p.precio_minorista)}</option>`;
            }
            if (p.precio_mayorista) {
                opcionesPrecios += `<option value="${p.precio_mayorista}">Mayorista - $${formatearNumero(p.precio_mayorista)}</option>`;
            }
            if (p.precio_distribuidor) {
                opcionesPrecios += `<option value="${p.precio_distribuidor}">Distribuidor - $${formatearNumero(p.precio_distribuidor)}</option>`;
            }
            opcionesPrecios += `<option value="manual">✏️ Manual</option>`;
            
            html += `
            <div class="producto-item mb-3 p-3 border rounded ${p.tipo_venta === 'contra_pedido' ? 'border-warning' : ''} ${clasePrecio}">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <strong>${p.nombre}</strong>${badgeContraPedido}
                        ${p.aplica_iva ? '<span class="badge bg-info ms-2"><i class="bi bi-percent"></i> IVA ' + p.porcentaje_iva + '%</span>' : '<span class="badge bg-secondary ms-2">Sin IVA</span>'}<br>
                        <small class="text-muted">SKU: ${p.sku} | Stock: ${p.stock_disponible}</small>${infoEntrega}
                    </div>
                    <div class="d-flex align-items-start gap-2">
                        <!-- Cantidad -->
                        <div class="d-flex flex-column align-items-center">
                            <small class="text-muted mb-1">Cantidad</small>
                            <div class="d-flex align-items-center">
                                <button class="btn btn-sm btn-outline-secondary btn-cantidad" onclick="cambiarCantidad(${index}, -1)">
                                    <i class="bi bi-dash"></i>
                                </button>
                                <input type="number" class="form-control form-control-sm input-cantidad mx-1" 
                                       value="${p.cantidad}" min="1" max="${p.tipo_venta === 'contra_pedido' ? 9999 : p.stock_disponible}"
                                       onchange="actualizarCantidad(${index}, this.value)"
                                       style="width: 60px; text-align: center;">
                                <button class="btn btn-sm btn-outline-secondary btn-cantidad" onclick="cambiarCantidad(${index}, 1)">
                                    <i class="bi bi-plus"></i>
                                </button>
                            </div>
                        </div>
                        
                        <!-- Precio -->
                        <div class="d-flex flex-column" style="min-width: 180px;">
                            <small class="text-muted mb-1">Tipo de Precio</small>
                            <select class="form-select form-select-sm mb-1" onchange="cambiarTipoPrecio(${index}, this.value)" id="tipoPrecio${index}">
                                ${opcionesPrecios}
                            </select>
                            <div class="input-group input-group-sm">
                                <span class="input-group-text">$</span>
                                <input type="number" class="form-control form-control-sm" 
                                       value="${p.precio_unitario}" 
                                       min="0" step="0.01"
                                       onchange="actualizarPrecio(${index}, this.value)"
                                       onkeypress="if(event.key === 'Enter') { event.preventDefault(); actualizarPrecio(${index}, this.value); return false; }"
                                       id="precioInput${index}"
                                       style="text-align: right;">
                            </div>
                            ${alertaPrecio}
                        </div>
                        
                        <!-- Subtotal -->
                        <div class="text-end" style="min-width: 100px;">
                            <small class="text-muted">Subtotal</small><br>
                            <strong class="text-success fs-5">$${formatearNumero(p.subtotal)}</strong>
                        </div>
                        
                        <!-- Eliminar -->
                        <button class="btn btn-sm btn-outline-danger" onclick="eliminarProducto(${index})" title="Eliminar producto">
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
        
        // Establecer el valor seleccionado en los selectores de tipo de precio
        productosVenta.forEach((p, index) => {
            const selector = document.getElementById(`tipoPrecio${index}`);
            if (selector) {
                if (p.precio_unitario === p.precio_minorista) {
                    selector.value = p.precio_minorista;
                } else if (p.precio_unitario === p.precio_mayorista) {
                    selector.value = p.precio_mayorista;
                } else if (p.precio_unitario === p.precio_distribuidor) {
                    selector.value = p.precio_distribuidor;
                } else {
                    selector.value = 'manual';
                }
            }
        });
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

    // Permitir cantidades mayores al stock solo si es contra pedido
    if (producto.tipo_venta !== 'contra_pedido' && nuevaCantidad > producto.stock_disponible) {
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
    
    // Permitir cantidades mayores al stock solo si es contra pedido
    if (producto.tipo_venta !== 'contra_pedido' && cantidad > producto.stock_disponible) {
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

function actualizarPrecio(index, valor) {
    console.log('actualizarPrecio llamado:', { index, valor, valorType: typeof valor });
    
    const precio = parseFloat(valor);
    if (isNaN(precio) || precio < 0) {
        console.log('Precio inválido, renderizando productos');
        renderizarProductos();
        return;
    }

    const producto = productosVenta[index];
    console.log('Producto antes de actualizar:', { ...producto });
    
    // Validar si el precio está fuera del rango permitido
    let advertencia = false;
    if (producto.precio_minimo && precio < producto.precio_minimo) {
        advertencia = true;
        if (!confirm(`⚠️ ALERTA: El precio ingresado ($${formatearNumero(precio)}) está por debajo del precio mínimo permitido ($${formatearNumero(producto.precio_minimo)}).\n\n¿Desea continuar de todas formas?`)) {
            console.log('Usuario canceló cambio de precio por debajo del mínimo');
            renderizarProductos();
            return;
        }
    } else if (producto.precio_maximo && precio > producto.precio_maximo) {
        advertencia = true;
        if (!confirm(`⚠️ ALERTA: El precio ingresado ($${formatearNumero(precio)}) está por encima del precio máximo sugerido ($${formatearNumero(producto.precio_maximo)}).\n\n¿Desea continuar de todas formas?`)) {
            console.log('Usuario canceló cambio de precio por encima del máximo');
            renderizarProductos();
            return;
        }
    }
    
    producto.precio_unitario = precio;
    producto.subtotal = producto.cantidad * precio;
    
    console.log('Producto después de actualizar:', { ...producto });
    console.log('productosVenta completo:', productosVenta.map(p => ({ id: p.id, nombre: p.nombre, cantidad: p.cantidad, precio: p.precio_unitario, subtotal: p.subtotal })));

    renderizarProductos();
    calcularTotales();
}

// Función para cambiar el tipo de precio seleccionado
function cambiarTipoPrecio(index, valor) {
    const producto = productosVenta[index];
    
    if (valor === 'manual') {
        // Enfocar el input de precio para edición manual
        setTimeout(() => {
            const precioInput = document.getElementById(`precioInput${index}`);
            if (precioInput) {
                precioInput.focus();
                precioInput.select();
            }
        }, 100);
        return;
    }
    
    const nuevoPrecio = parseFloat(valor);
    if (isNaN(nuevoPrecio) || nuevoPrecio < 0) {
        renderizarProductos();
        return;
    }
    
    producto.precio_unitario = nuevoPrecio;
    producto.subtotal = producto.cantidad * nuevoPrecio;
    
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
    
    // Calcular IVA solo para productos gravados
    let impuesto = 0;
    productosVenta.forEach(p => {
        if (p.aplica_iva) {
            const porcentaje = (p.porcentaje_iva || 19) / 100;
            const subtotalProducto = p.subtotal * (descuento > 0 ? (1 - descuento / subtotal) : 1);
            impuesto += subtotalProducto * porcentaje;
        }
    });
    
    // Calcular impuestos adicionales
    let totalImpuestosAdicionales = 0;
    const detalleImpuestos = [];
    
    impuestosSeleccionados.forEach(impId => {
        const imp = impuestosDisponibles.find(i => i.id === impId);
        if (imp) {
            let base = 0;
            switch(imp.aplica_sobre) {
                case 'subtotal': base = baseImponible; break;
                case 'iva': base = impuesto; break;
                case 'total': base = baseImponible + impuesto; break;
            }
            
            const valor = imp.tipo === 'porcentaje' 
                ? base * (imp.tasa / 100)
                : parseFloat(imp.tasa);
            
            const valorConSigno = imp.afecta_total === 'resta' ? -valor : valor;
            totalImpuestosAdicionales += valorConSigno;
            
            detalleImpuestos.push({
                impuesto_id: imp.id,
                nombre: imp.nombre,
                base_calculo: base,
                tasa: imp.tasa,
                tipo: imp.tipo,
                valor: Math.abs(valor),
                afecta_total: imp.afecta_total
            });
        }
    });
    
    const total = baseImponible + impuesto + totalImpuestosAdicionales;
    
    // Actualizar variable global para gestión de pagos
    totalVentaActual = total;

    document.getElementById('resumenSubtotal').textContent = `$${formatearNumero(subtotal)}`;
    document.getElementById('resumenImpuesto').textContent = `$${formatearNumero(impuesto)}`;
    
    // Mostrar impuestos adicionales
    const resumenImpuestos = document.getElementById('resumenImpuestosAdicionales');
    if (detalleImpuestos.length > 0) {
        resumenImpuestos.innerHTML = detalleImpuestos.map(imp => `
            <div class="d-flex justify-content-between mb-1">
                <span class="${imp.afecta_total === 'resta' ? 'text-danger' : 'text-success'}">
                    ${imp.afecta_total === 'resta' ? '-' : '+'} ${imp.nombre}:
                </span>
                <strong>$${formatearNumero(imp.valor)}</strong>
            </div>
        `).join('');
    } else {
        resumenImpuestos.innerHTML = '';
    }
    
    document.getElementById('resumenTotal').textContent = `$${formatearNumero(total)}`;

    // Actualizar estado de pagos
    actualizarEstadoPago();
}

// ============================================
// GUARDAR VENTA
// ============================================

// ============================================
// GESTIÓN DE PAGOS MÚLTIPLES
// ============================================

function agregarPago() {
    const selectMetodo = document.getElementById('metodoPagoNuevo');
    const inputMonto = document.getElementById('montoPago');
    const inputReferencia = document.getElementById('referenciaPago');
    const inputBanco = document.getElementById('bancoPago');
    
    const metodo = selectMetodo.value;
    const monto = parseFloat(inputMonto.value);
    const referencia = inputReferencia.value.trim();
    const banco = inputBanco.value.trim();
    
    // Validaciones
    if (!metodo) {
        mostrarAlerta('Selecciona un método de pago', 'warning');
        return;
    }
    
    if (!monto || monto <= 0) {
        mostrarAlerta('Ingresa un monto válido', 'warning');
        inputMonto.focus();
        return;
    }
    
    const totalPagado = calcularTotalPagado();
    const pendiente = totalVentaActual - totalPagado;
    
    // Permitir sobrepagos (el sistema calculará el cambio automáticamente)
    
    // Agregar pago al array
    const pago = {
        id: Date.now(),
        metodo_pago: metodo,
        monto: monto,
        referencia: referencia || null,
        banco: banco || null,
        notas: null
    };
    
    pagosPendientes.push(pago);
    
    // Limpiar formulario
    inputMonto.value = '';
    inputReferencia.value = '';
    inputBanco.value = '';
    selectMetodo.selectedIndex = 0;
    
    // Actualizar UI
    renderizarPagos();
    actualizarEstadoPago();
}

function renderizarPagos() {
    const lista = document.getElementById('listaPagos');
    
    if (pagosPendientes.length === 0) {
        lista.innerHTML = '<div class="text-muted text-center py-3">No hay pagos agregados</div>';
        return;
    }
    
    const nombresMetodos = {
        'efectivo': 'Efectivo',
        'tarjeta_debito': 'Tarjeta Débito',
        'tarjeta_credito': 'Tarjeta Crédito',
        'transferencia': 'Transferencia',
        'nequi': 'Nequi',
        'daviplata': 'Daviplata',
        'cheque': 'Cheque'
    };
    
    lista.innerHTML = pagosPendientes.map(pago => `
        <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
            <div class="flex-grow-1">
                <strong>${nombresMetodos[pago.metodo_pago] || pago.metodo_pago}</strong>
                ${pago.referencia ? `<br><small class="text-muted">Ref: ${pago.referencia}</small>` : ''}
                ${pago.banco ? `<br><small class="text-muted">Banco: ${pago.banco}</small>` : ''}
            </div>
            <div class="text-end">
                <div class="fw-bold text-success">$${formatearNumero(pago.monto)}</div>
                <button class="btn btn-sm btn-outline-danger mt-1" onclick="eliminarPago(${pago.id})">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function eliminarPago(pagoId) {
    pagosPendientes = pagosPendientes.filter(p => p.id !== pagoId);
    renderizarPagos();
    actualizarEstadoPago();
}

function calcularTotalPagado() {
    return pagosPendientes.reduce((sum, p) => sum + p.monto, 0);
}

function actualizarEstadoPago() {
    const totalPagado = calcularTotalPagado();
    const pendiente = totalVentaActual - totalPagado;
    const cambio = totalPagado - totalVentaActual;
    
    console.log('=== actualizarEstadoPago ===');
    console.log('totalVentaActual:', totalVentaActual);
    console.log('totalPagado:', totalPagado);
    console.log('pendiente:', pendiente);
    console.log('cambio:', cambio);
    console.log('clienteSeleccionado:', clienteSeleccionado);
    console.log('productosVenta.length:', productosVenta.length);
    
    // Actualizar resumen de pagos
    document.getElementById('totalVentaPagos').textContent = `$${formatearNumero(totalVentaActual)}`;
    document.getElementById('totalPagado').textContent = `$${formatearNumero(totalPagado)}`;
    
    // Mostrar pendiente o cambio según corresponda
    const montoPendienteEl = document.getElementById('montoPendiente');
    if (pendiente > 0.01) {
        montoPendienteEl.textContent = `$${formatearNumero(pendiente)}`;
        montoPendienteEl.className = 'text-danger fw-bold';
    } else if (cambio > 0.01) {
        montoPendienteEl.textContent = `$${formatearNumero(cambio)} (Cambio)`;
        montoPendienteEl.className = 'text-success fw-bold';
    } else {
        montoPendienteEl.textContent = '$0';
        montoPendienteEl.className = 'text-muted';
    }
    
    // Mostrar/ocultar alerta
    const alertaPendiente = document.getElementById('alertaPendiente');
    if (pendiente > 0.01) {
        alertaPendiente.style.display = 'block';
        alertaPendiente.textContent = `Pendiente por pagar: $${formatearNumero(pendiente)}`;
        alertaPendiente.className = 'alert alert-warning';
    } else if (cambio > 0.01) {
        alertaPendiente.style.display = 'block';
        alertaPendiente.textContent = `💵 Cambio a devolver: $${formatearNumero(cambio)}`;
        alertaPendiente.className = 'alert alert-success';
    } else {
        alertaPendiente.style.display = 'none';
    }
    
    // Habilitar/deshabilitar botón de guardar
    const btnGuardar = document.getElementById('btnGuardarVenta');
    const pagoCompleto = pendiente <= 0.01; // Permitir si está pagado o sobrepagado
    const tieneCliente = !!clienteSeleccionado;
    const tieneProductos = productosVenta.length > 0;
    
    console.log('Condiciones para habilitar botón:');
    console.log('  - pagoCompleto:', pagoCompleto, '(pendiente <= 0.01)');
    console.log('  - tieneCliente:', tieneCliente);
    console.log('  - tieneProductos:', tieneProductos);
    console.log('  - btnGuardar.disabled será:', !tieneCliente || !tieneProductos || !pagoCompleto);
    
    btnGuardar.disabled = !tieneCliente || !tieneProductos || !pagoCompleto;
}

// ============================================
// GUARDAR VENTA (ACTUALIZADA)
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
    
    // Calcular IVA solo para productos gravados
    let impuesto = 0;
    productosVenta.forEach(p => {
        if (p.aplica_iva) {
            const porcentaje = (p.porcentaje_iva || 19) / 100;
            const subtotalProducto = p.subtotal * (descuento > 0 ? (1 - descuento / subtotal) : 1);
            impuesto += subtotalProducto * porcentaje;
        }
    });
    
    // Calcular impuestos adicionales
    let totalImpuestosAdicionales = 0;
    const impuestosVenta = [];
    
    impuestosSeleccionados.forEach(impId => {
        const imp = impuestosDisponibles.find(i => i.id === impId);
        if (imp) {
            let base = 0;
            switch(imp.aplica_sobre) {
                case 'subtotal': base = baseImponible; break;
                case 'iva': base = impuesto; break;
                case 'total': base = baseImponible + impuesto; break;
            }
            
            const valor = imp.tipo === 'porcentaje' 
                ? base * (imp.tasa / 100)
                : parseFloat(imp.tasa);
            
            const valorConSigno = imp.afecta_total === 'resta' ? -valor : valor;
            totalImpuestosAdicionales += valorConSigno;
            
            impuestosVenta.push({
                impuesto_id: imp.id,
                codigo: imp.codigo,
                nombre: imp.nombre,
                base_calculo: base,
                tasa: imp.tasa,
                valor: Math.abs(valor),
                afecta_total: imp.afecta_total
            });
        }
    });
    
    const total = baseImponible + impuesto + totalImpuestosAdicionales;

    const ventaData = {
        empresa_id: currentEmpresa?.id,
        cliente_id: clienteSeleccionado?.id,
        vendedor_id: currentUsuario?.id,
        subtotal: subtotal,
        descuento: descuento,
        impuesto: impuesto,
        total: total,
        notas: document.getElementById('notasVenta').value || null,
        impuestos: impuestosVenta,
        pagos: pagosPendientes,
        productos: productosVenta.map(p => ({
            producto_id: p.id,
            cantidad: p.cantidad,
            precio_unitario: p.precio_unitario,
            descuento: 0,
            subtotal: p.subtotal,
            // Campos para ventas contra pedido
            tipo_venta: p.tipo_venta || 'inmediata',
            estado_entrega: p.estado_entrega || null,
            fecha_entrega_estimada: p.fecha_entrega_estimada || null,
            notas_entrega: p.notas_entrega || null
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
        
        // Agregar nombres a los impuestos para la factura
        const impuestosConNombres = ventaData.impuestos.map(impVenta => {
            const impuesto = impuestosDisponibles.find(i => i.id === impVenta.impuesto_id);
            return {
                ...impVenta,
                nombre: impuesto ? impuesto.nombre : 'Impuesto'
            };
        });
        
        ultimaVentaData = {
            ...ventaData, 
            productos: productosConNombres,
            cliente: clienteSeleccionado, // Guardar cliente para impresión
            impuestos: impuestosConNombres // Agregar impuestos con nombres
        };
        
        // Limpiar formulario SIN confirmación (ya guardamos la venta)
        limpiarVentaSinConfirmar();
        
        // Mostrar factura después de limpiar
        mostrarFactura(ultimaVentaGuardada, ultimaVentaData);
        
        mostrarAlerta('🎉 Venta guardada exitosamente', 'success');
        reproducirSonido('success');
        
        // Recargar últimas ventas
        setTimeout(cargarUltimasVentas, 500);
        
        // Si modo rápido está activo, seleccionar público general automáticamente
        if (modoRapido) {
            setTimeout(seleccionarPublicoGeneral, 1000);
        }

    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta(error.message || 'Error al guardar venta', 'danger');
        reproducirSonido('error');
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
    pagosPendientes = [];
    totalVentaActual = 0;
    
    // Resetear impuestos a ninguno - el vendedor debe seleccionarlos manualmente
    impuestosSeleccionados = [];
    
    // Actualizar UI de impuestos
    if (impuestosDisponibles.length > 0) {
        renderizarImpuestosDisponibles();
        document.getElementById('impuestosCount').textContent = 0;
    }
    
    document.getElementById('busquedaCliente').style.display = 'block';
    document.getElementById('clienteSeleccionado').style.display = 'none';
    document.getElementById('numeroDocumento').value = '';
    document.getElementById('buscarNombre').value = '';
    document.getElementById('inputDescuento').value = '0';
    document.getElementById('notasVenta').value = '';
    
    // Limpiar campos de pago
    document.getElementById('montoPago').value = '';
    document.getElementById('referenciaPago').value = '';
    document.getElementById('bancoPago').value = '';
    document.getElementById('metodoPagoNuevo').selectedIndex = 0;
    
    renderizarProductos();
    renderizarPagos();
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
    
    // Calcular dígito de verificación del NIT
    const calcularDigitoVerificacion = (nit) => {
        const nitNumeros = nit.replace(/[^0-9]/g, '');
        const vpri = [3,7,13,17,19,23,29,37,41,43,47,53,59,67,71];
        let suma = 0;
        for (let i = 0; i < nitNumeros.length && i < 15; i++) {
            suma += parseInt(nitNumeros[nitNumeros.length - 1 - i]) * vpri[i];
        }
        const residuo = suma % 11;
        return residuo > 1 ? 11 - residuo : residuo;
    };

    const digitoVerificacion = calcularDigitoVerificacion(currentEmpresa.nit);
    const nitCompleto = `${currentEmpresa.nit}-${digitoVerificacion}`;

    // Formatear fechas de resolución
    const formatearFecha = (fecha) => {
        if (!fecha) return 'N/A';
        const d = new Date(fecha);
        return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const html = `
        <div id="facturaPrint" class="p-3" style="max-width: 100%; font-size: 0.95rem;">
            <!-- Encabezado Empresa -->
            <div class="text-center mb-3 pb-2 border-bottom">
                <h4 class="mb-2" style="font-size: 1.4rem; color: ${currentEmpresa.color_primario || '#1E40AF'};">${currentEmpresa.nombre}</h4>
                ${currentEmpresa.slogan ? `<p class="mb-1" style="font-size: 0.85rem; font-style: italic; color: #666;">${currentEmpresa.slogan}</p>` : ''}
                <p class="mb-1" style="font-size: 0.9rem;">${currentEmpresa.razon_social}</p>
                <p class="mb-1" style="font-size: 0.9rem;"><strong>NIT: ${nitCompleto}</strong></p>
                ${currentEmpresa.regimen_tributario ? `<p class="mb-1" style="font-size: 0.85rem;">Régimen ${currentEmpresa.regimen_tributario}</p>` : ''}
                ${currentEmpresa.gran_contribuyente ? `<p class="mb-1" style="font-size: 0.85rem;"><span class="badge bg-success">Gran Contribuyente</span></p>` : ''}
                <p class="mb-1" style="font-size: 0.85rem;">${currentEmpresa.direccion || ''} - ${currentEmpresa.ciudad || ''}</p>
                <p class="mb-1" style="font-size: 0.85rem;">Tel: ${currentEmpresa.telefono || ''} | Email: ${currentEmpresa.email}</p>
                ${currentEmpresa.sitio_web ? `<p class="mb-1" style="font-size: 0.85rem;">Web: ${currentEmpresa.sitio_web}</p>` : ''}
            </div>

            <!-- Título Factura -->
            <div class="text-center mb-3 p-2" style="background-color: ${currentEmpresa.color_primario || '#1E40AF'}15; border: 2px solid ${currentEmpresa.color_primario || '#1E40AF'}; border-radius: 5px;">
                <h5 class="mb-1" style="font-size: 1.2rem; color: ${currentEmpresa.color_primario || '#1E40AF'};">FACTURA DE VENTA ELECTRÓNICA</h5>
                <p class="mb-1" style="font-size: 1.1rem;"><strong>${venta.numero_factura}</strong></p>
            </div>

            <!-- Resolución DIAN -->
            ${currentEmpresa.resolucion_dian ? `
            <div class="mb-3 p-2" style="background-color: #f8f9fa; border-left: 3px solid #28a745; font-size: 0.85rem;">
                <strong>Resolución DIAN:</strong> ${currentEmpresa.resolucion_dian}<br>
                <strong>Fecha Resolución:</strong> ${formatearFecha(currentEmpresa.fecha_resolucion_desde)} al ${formatearFecha(currentEmpresa.fecha_resolucion_hasta)}<br>
                <strong>Rango Autorizado:</strong> ${currentEmpresa.prefijo_factura || 'FAC'}-${String(currentEmpresa.rango_factura_desde || 1).padStart(6, '0')} al ${currentEmpresa.prefijo_factura || 'FAC'}-${String(currentEmpresa.rango_factura_hasta || 100000).padStart(6, '0')}<br>
                <strong>Ambiente:</strong> ${currentEmpresa.ambiente === 'produccion' ? 'Producción' : 'Pruebas'}
            </div>
            ` : ''}

            <!-- Datos Cliente y Venta -->
            <div class="row mb-3" style="font-size: 0.9rem;">
                <div class="col-12 col-md-6 mb-2">
                    <div class="p-2 border rounded">
                        <strong style="color: ${currentEmpresa.color_primario || '#1E40AF'};">CLIENTE:</strong><br>
                        <strong>${ventaData.cliente.razon_social || `${ventaData.cliente.nombre} ${ventaData.cliente.apellido || ''}`}</strong><br>
                        ${ventaData.cliente.tipo_documento}: ${ventaData.cliente.numero_documento}${ventaData.cliente.digito_verificacion ? '-' + ventaData.cliente.digito_verificacion : ''}<br>
                        ${ventaData.cliente.tipo_persona ? `<small>Tipo: ${ventaData.cliente.tipo_persona === 'juridica' ? 'Persona Jurídica' : 'Persona Natural'}</small><br>` : ''}
                        ${ventaData.cliente.regimen_tributario ? `<small>Régimen: ${ventaData.cliente.regimen_tributario}</small><br>` : ''}
                        ${ventaData.cliente.direccion ? `${ventaData.cliente.direccion}<br>` : ''}
                        ${ventaData.cliente.ciudad ? `${ventaData.cliente.ciudad}${ventaData.cliente.departamento ? ' - ' + ventaData.cliente.departamento : ''}<br>` : ''}
                        ${ventaData.cliente.telefono || ventaData.cliente.celular || ''}
                    </div>
                </div>
                <div class="col-12 col-md-6">
                    <div class="p-2 border rounded">
                        <strong>Fecha Emisión:</strong> ${fecha}<br>
                        <strong>Forma de Pago:</strong> ${ventaData.forma_pago === 'credito' ? 'Crédito' : 'Contado'}<br>
                        ${ventaData.fecha_vencimiento ? `<strong>Fecha Vencimiento:</strong> ${new Date(ventaData.fecha_vencimiento).toLocaleDateString('es-CO')}<br>` : ''}
                        <strong>Método de Pago:</strong> ${ventaData.metodo_pago}<br>
                        <strong>Vendedor:</strong> ${currentUsuario.nombre} ${currentUsuario.apellido}
                    </div>
                </div>
            </div>

            <!-- Detalle Productos -->
            <div class="table-responsive">
            <table class="table table-bordered table-sm" style="font-size: 0.85rem;">
                <thead style="background-color: ${currentEmpresa.color_primario || '#1E40AF'}15;">
                    <tr>
                        <th style="min-width: 120px;">Producto / Descripción</th>
                        <th class="text-center" style="width: 50px;">Und.</th>
                        <th class="text-center" style="width: 60px;">Cant.</th>
                        <th class="text-end" style="width: 90px;">P. Unit.</th>
                        <th class="text-end" style="width: 70px;">IVA %</th>
                        <th class="text-end" style="width: 90px;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${ventaData.productos.map(p => `
                        <tr>
                            <td>
                                <strong>${p.nombre}</strong>
                                ${p.descripcion_adicional ? `<br><small class="text-muted">${p.descripcion_adicional}</small>` : ''}
                            </td>
                            <td class="text-center">${p.unidad_medida || 'UND'}</td>
                            <td class="text-center">${p.cantidad}</td>
                            <td class="text-end">$${formatearNumero(p.precio_unitario)}</td>
                            <td class="text-end">${p.impuesto_porcentaje || 19}%</td>
                            <td class="text-end">$${formatearNumero(p.subtotal)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>

            <!-- Totales -->
            <div class="row">
                <div class="col-12 col-md-6">
                    ${ventaData.observaciones ? `
                    <div class="mb-2">
                        <strong>Observaciones:</strong>
                        <p class="mb-0" style="font-size: 0.85rem; color: #666;">${ventaData.observaciones}</p>
                    </div>
                    ` : ''}
                </div>
                <div class="col-12 col-md-6">
                    <table class="table table-sm mb-0" style="font-size: 0.9rem;">
                        <tr>
                            <td class="text-end border-0"><strong>Subtotal:</strong></td>
                            <td class="text-end border-0" style="width: 120px;">$${formatearNumero(subtotal)}</td>
                        </tr>
                        ${descuento > 0 ? `
                        <tr>
                            <td class="text-end border-0"><strong>Descuento ${ventaData.descuento_porcentaje ? `(${ventaData.descuento_porcentaje}%)` : ''}:</strong></td>
                            <td class="text-end border-0 text-danger">-$${formatearNumero(descuento)}</td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td class="text-end border-0"><strong>IVA (19%):</strong></td>
                            <td class="text-end border-0">$${formatearNumero(impuesto)}</td>
                        </tr>
                        ${ventaData.retencion_fuente > 0 ? `
                        <tr>
                            <td class="text-end border-0"><strong>Retención Fuente:</strong></td>
                            <td class="text-end border-0 text-danger">-$${formatearNumero(ventaData.retencion_fuente)}</td>
                        </tr>
                        ` : ''}
                        ${ventaData.retencion_iva > 0 ? `
                        <tr>
                            <td class="text-end border-0"><strong>Retención IVA:</strong></td>
                            <td class="text-end border-0 text-danger">-$${formatearNumero(ventaData.retencion_iva)}</td>
                        </tr>
                        ` : ''}
                        ${ventaData.retencion_ica > 0 ? `
                        <tr>
                            <td class="text-end border-0"><strong>Retención ICA:</strong></td>
                            <td class="text-end border-0 text-danger">-$${formatearNumero(ventaData.retencion_ica)}</td>
                        </tr>
                        ` : ''}
                        ${ventaData.impuestos && ventaData.impuestos.length > 0 ? 
                            ventaData.impuestos.map(imp => `
                                <tr>
                                    <td class="text-end border-0">
                                        <strong class="${imp.afecta_total === 'resta' ? 'text-danger' : 'text-success'}">
                                            ${imp.afecta_total === 'resta' ? '-' : '+'} ${imp.nombre}:
                                        </strong>
                                    </td>
                                    <td class="text-end border-0 ${imp.afecta_total === 'resta' ? 'text-danger' : 'text-success'}">
                                        ${imp.afecta_total === 'resta' ? '-' : ''}$${formatearNumero(imp.valor)}
                                    </td>
                                </tr>
                            `).join('') : ''
                        }
                        <tr style="background-color: ${currentEmpresa.color_primario || '#1E40AF'}; color: white;">
                            <td class="text-end border-0"><strong style="font-size: 1.1rem;">TOTAL:</strong></td>
                            <td class="text-end border-0"><strong style="font-size: 1.1rem;">$${formatearNumero(total)}</strong></td>
                        </tr>
                    </table>
                </div>
            </div>

            <!-- CUFE y QR -->
            ${ventaData.cufe ? `
            <div class="mt-3 p-2 border rounded" style="background-color: #f8f9fa;">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <small><strong>CUFE:</strong></small><br>
                        <small style="word-break: break-all; font-family: monospace; font-size: 0.75rem;">${ventaData.cufe}</small>
                    </div>
                    ${ventaData.qr_code ? `
                    <div class="col-md-4 text-center">
                        <img src="${ventaData.qr_code}" alt="QR Code" style="width: 100px; height: 100px;">
                    </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}

            <div class="text-center mt-3 pt-2 border-top">
                <p class="text-muted mb-1" style="font-size: 0.85rem;">¡Gracias por su compra!</p>
                ${currentEmpresa.descripcion ? `<p class="text-muted mb-0" style="font-size: 0.75rem;">${currentEmpresa.descripcion}</p>` : ''}
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
    
    ${ventaData.pagos && ventaData.pagos.length > 0 ? `
    <div style="font-size: 8pt;">
        <div class="bold">FORMA DE PAGO:</div>
        ${ventaData.pagos.map(pago => {
            const nombres = {
                'efectivo': 'Efectivo',
                'tarjeta_debito': 'T. Débito',
                'tarjeta_credito': 'T. Crédito',
                'transferencia': 'Transferencia',
                'nequi': 'Nequi',
                'daviplata': 'Daviplata',
                'cheque': 'Cheque'
            };
            return `<div class="totals-row">
                <span>${nombres[pago.metodo_pago] || pago.metodo_pago}:</span>
                <span>$${formatearNumero(pago.monto)}</span>
            </div>`;
        }).join('')}
    </div>
    <div class="line"></div>
    ` : ''}
    
    <div class="center" style="font-size: 8pt; margin-top: 3mm;">
        ¡Gracias por su compra!
    </div>
    <div class="center" style="font-size: 7pt;">Vendedor: ${currentUsuario.nombre} ${currentUsuario.apellido}</div>
    
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
        const digitoVerificacion = calcularDigitoVerificacion(currentEmpresa.nit);
        const nitCompleto = `${currentEmpresa.nit}-${digitoVerificacion}`;
        
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
            font-size: 10pt;
            color: #000;
            background: white;
            padding: 8mm;
        }
        .encabezado {
            text-align: center;
            margin-bottom: 5mm;
            padding-bottom: 3mm;
            border-bottom: 2px solid #333;
        }
        .encabezado h2 {
            font-size: 16pt;
            margin-bottom: 2mm;
            color: ${currentEmpresa.color_primario || '#1E40AF'};
        }
        .encabezado .slogan {
            font-size: 9pt;
            font-style: italic;
            color: #666;
            margin-bottom: 1mm;
        }
        .encabezado p {
            font-size: 9pt;
            margin: 0.5mm 0;
        }
        .badge-success {
            background-color: #28a745;
            color: white;
            padding: 1mm 3mm;
            border-radius: 2mm;
            font-size: 8pt;
        }
        .titulo-factura {
            text-align: center;
            font-size: 13pt;
            font-weight: bold;
            margin: 4mm 0;
            padding: 3mm;
            border: 2px solid ${currentEmpresa.color_primario || '#1E40AF'};
            background-color: ${currentEmpresa.color_primario || '#1E40AF'}15;
            border-radius: 3mm;
        }
        .resolucion-dian {
            background-color: #f8f9fa;
            border-left: 3px solid #28a745;
            padding: 3mm;
            margin: 3mm 0;
            font-size: 8pt;
        }
        .info-boxes {
            display: flex;
            justify-content: space-between;
            gap: 3mm;
            margin: 4mm 0;
        }
        .info-box {
            flex: 1;
            border: 1px solid #ddd;
            padding: 3mm;
            border-radius: 2mm;
            font-size: 9pt;
        }
        .info-box strong {
            color: ${currentEmpresa.color_primario || '#1E40AF'};
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 4mm 0;
            font-size: 9pt;
        }
        th {
            background-color: ${currentEmpresa.color_primario || '#1E40AF'}15;
            border: 1px solid #ddd;
            padding: 2mm;
            text-align: left;
            font-weight: bold;
            color: #333;
        }
        td {
            border: 1px solid #ddd;
            padding: 2mm;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-danger { color: #dc3545; }
        .totales-container {
            display: flex;
            justify-content: space-between;
            margin-top: 4mm;
        }
        .observaciones {
            flex: 1;
            padding-right: 5mm;
        }
        .totales {
            width: 45%;
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
            font-size: 11pt;
            font-weight: bold;
            background-color: ${currentEmpresa.color_primario || '#1E40AF'};
            color: white;
        }
        .cufe-section {
            margin-top: 5mm;
            padding: 3mm;
            background-color: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 2mm;
            font-size: 8pt;
        }
        .footer {
            clear: both;
            text-align: center;
            margin-top: 8mm;
            padding-top: 3mm;
            border-top: 1px solid #ddd;
            font-size: 8pt;
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
        ${currentEmpresa.slogan ? `<div class="slogan">${currentEmpresa.slogan}</div>` : ''}
        <p><strong>${currentEmpresa.razon_social}</strong></p>
        <p><strong>NIT: ${nitCompleto}</strong></p>
        ${currentEmpresa.regimen_tributario ? `<p>Régimen ${currentEmpresa.regimen_tributario}</p>` : ''}
        ${currentEmpresa.gran_contribuyente ? `<p><span class="badge-success">GRAN CONTRIBUYENTE</span></p>` : ''}
        <p>${currentEmpresa.direccion || ''} - ${currentEmpresa.ciudad || ''}</p>
        <p>Tel: ${currentEmpresa.telefono || ''} | Email: ${currentEmpresa.email}</p>
        ${currentEmpresa.sitio_web ? `<p>Web: ${currentEmpresa.sitio_web}</p>` : ''}
    </div>
    
    <div class="titulo-factura">
        FACTURA DE VENTA ELECTRÓNICA<br>
        ${numeroFactura}
    </div>
    
    ${currentEmpresa.resolucion_dian ? `
    <div class="resolucion-dian">
        <strong>Resolución DIAN:</strong> ${currentEmpresa.resolucion_dian} | 
        <strong>Fecha:</strong> ${formatearFecha(currentEmpresa.fecha_resolucion_desde)} al ${formatearFecha(currentEmpresa.fecha_resolucion_hasta)}<br>
        <strong>Rango Autorizado:</strong> ${currentEmpresa.prefijo_factura || 'FAC'}-${String(currentEmpresa.rango_factura_desde || 1).padStart(6, '0')} al ${currentEmpresa.prefijo_factura || 'FAC'}-${String(currentEmpresa.rango_factura_hasta || 100000).padStart(6, '0')} | 
        <strong>Ambiente:</strong> ${currentEmpresa.ambiente === 'produccion' ? 'Producción' : 'Pruebas'}
    </div>
    ` : ''}
    
    <div class="info-boxes">
        <div class="info-box">
            <strong>INFORMACIÓN DEL CLIENTE</strong><br>
            <strong>${ventaData.cliente.razon_social || `${ventaData.cliente.nombre} ${ventaData.cliente.apellido || ''}`}</strong><br>
            ${ventaData.cliente.tipo_documento}: ${ventaData.cliente.numero_documento}${ventaData.cliente.digito_verificacion ? '-' + ventaData.cliente.digito_verificacion : ''}<br>
            ${ventaData.cliente.tipo_persona ? `Tipo: ${ventaData.cliente.tipo_persona === 'juridica' ? 'Persona Jurídica' : 'Persona Natural'}<br>` : ''}
            ${ventaData.cliente.regimen_tributario ? `Régimen: ${ventaData.cliente.regimen_tributario}<br>` : ''}
            ${ventaData.cliente.direccion ? `${ventaData.cliente.direccion}<br>` : ''}
            ${ventaData.cliente.ciudad ? `${ventaData.cliente.ciudad}${ventaData.cliente.departamento ? ' - ' + ventaData.cliente.departamento : ''}<br>` : ''}
            Tel: ${ventaData.cliente.telefono || ventaData.cliente.celular || 'N/A'}
        </div>
        <div class="info-box">
            <strong>INFORMACIÓN DE LA VENTA</strong><br>
            <strong>Fecha Emisión:</strong> ${fecha}<br>
            <strong>Forma de Pago:</strong> ${ventaData.forma_pago === 'credito' ? 'Crédito' : 'Contado'}<br>
            ${ventaData.fecha_vencimiento ? `<strong>Fecha Vencimiento:</strong> ${new Date(ventaData.fecha_vencimiento).toLocaleDateString('es-CO')}<br>` : ''}
            <strong>Método de Pago:</strong> ${ventaData.metodo_pago}<br>
            <strong>Vendedor:</strong> ${currentUsuario.nombre} ${currentUsuario.apellido}
        </div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th style="width: 40%;">Producto / Descripción</th>
                <th class="text-center" style="width: 8%;">Und.</th>
                <th class="text-center" style="width: 8%;">Cant.</th>
                <th class="text-right" style="width: 15%;">Precio Unit.</th>
                <th class="text-center" style="width: 10%;">IVA %</th>
                <th class="text-right" style="width: 19%;">Subtotal</th>
            </tr>
        </thead>
        <tbody>
            ${ventaData.productos.map(p => `
                <tr>
                    <td>
                        <strong>${p.nombre}</strong>
                        ${p.descripcion_adicional ? `<br><span style="font-size: 8pt; color: #666;">${p.descripcion_adicional}</span>` : ''}
                    </td>
                    <td class="text-center">${p.unidad_medida || 'UND'}</td>
                    <td class="text-center">${p.cantidad}</td>
                    <td class="text-right">$${formatearNumero(p.precio_unitario)}</td>
                    <td class="text-center">${p.impuesto_porcentaje || 19}%</td>
                    <td class="text-right">$${formatearNumero(p.subtotal)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <div class="totales-container">
        <div class="observaciones">
            ${ventaData.observaciones ? `
            <strong>OBSERVACIONES:</strong><br>
            <p style="font-size: 9pt; color: #666; margin-top: 2mm;">${ventaData.observaciones}</p>
            ` : ''}
        </div>
        <div class="totales">
            <table>
                <tr>
                    <td><strong>Subtotal:</strong></td>
                    <td class="text-right">$${formatearNumero(subtotal)}</td>
                </tr>
                ${descuento > 0 ? `
                <tr>
                    <td><strong>Descuento ${ventaData.descuento_porcentaje ? `(${ventaData.descuento_porcentaje}%)` : ''}:</strong></td>
                    <td class="text-right text-danger">-$${formatearNumero(descuento)}</td>
                </tr>
                ` : ''}
                <tr>
                    <td><strong>IVA (19%):</strong></td>
                    <td class="text-right">$${formatearNumero(impuesto)}</td>
                </tr>
                ${ventaData.retencion_fuente > 0 ? `
                <tr>
                    <td><strong>Retención Fuente:</strong></td>
                    <td class="text-right text-danger">-$${formatearNumero(ventaData.retencion_fuente)}</td>
                </tr>
                ` : ''}
                ${ventaData.retencion_iva > 0 ? `
                <tr>
                    <td><strong>Retención IVA:</strong></td>
                    <td class="text-right text-danger">-$${formatearNumero(ventaData.retencion_iva)}</td>
                </tr>
                ` : ''}
                ${ventaData.retencion_ica > 0 ? `
                <tr>
                    <td><strong>Retención ICA:</strong></td>
                    <td class="text-right text-danger">-$${formatearNumero(ventaData.retencion_ica)}</td>
                </tr>
                ` : ''}
                <tr class="total-final">
                    <td><strong>TOTAL:</strong></td>
                    <td class="text-right"><strong>$${formatearNumero(total)}</strong></td>
                </tr>
                ${ventaData.pagos && ventaData.pagos.length > 0 ? `
                <tr style="border-top: 2px solid #000;">
                    <td colspan="2" style="padding-top: 3mm; padding-bottom: 1mm;"><strong>FORMA DE PAGO:</strong></td>
                </tr>
                ${ventaData.pagos.map(pago => {
                    const nombres = {
                        'efectivo': 'Efectivo',
                        'tarjeta_debito': 'Tarjeta Débito',
                        'tarjeta_credito': 'Tarjeta Crédito',
                        'transferencia': 'Transferencia',
                        'nequi': 'Nequi',
                        'daviplata': 'Daviplata',
                        'cheque': 'Cheque'
                    };
                    return `<tr>
                        <td>${nombres[pago.metodo_pago] || pago.metodo_pago}${pago.referencia ? ` (Ref: ${pago.referencia})` : ''}</td>
                        <td class="text-right">$${formatearNumero(pago.monto)}</td>
                    </tr>`;
                }).join('')}
                ` : ''}
            </table>
        </div>
    </div>
    
    ${ventaData.cufe ? `
    <div class="cufe-section">
        <strong>CUFE (Código Único de Factura Electrónica):</strong><br>
        <span style="word-break: break-all; font-family: monospace;">${ventaData.cufe}</span>
    </div>
    ` : ''}
    
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

// ============================================
// FUNCIONES PARA VENTA SIN STOCK (CONTRA PEDIDO)
// ============================================

let productoSinStockActual = null;
let indexProductoSinStock = -1;

/**
 * Mostrar modal para confirmar venta sin stock
 */
function mostrarModalVentaSinStock(producto, index) {
    productoSinStockActual = producto;
    indexProductoSinStock = index;
    
    const stockDisponible = producto.stock_actual || 0;
    const cantidadActual = index >= 0 ? productosVenta[index].cantidad : 0;
    const cantidadFaltante = index >= 0 ? (cantidadActual + 1 - stockDisponible) : 1;
    
    const mensaje = `
        <strong>${producto.nombre}</strong><br>
        <small class="text-muted">SKU: ${producto.sku}</small><br><br>
        Stock disponible: <strong>${stockDisponible}</strong><br>
        Cantidad solicitada: <strong>${index >= 0 ? cantidadActual + 1 : 1}</strong><br>
        Faltante: <strong class="text-danger">${cantidadFaltante}</strong>
    `;
    
    document.getElementById('mensajeStockInsuficiente').innerHTML = mensaje;
    
    // Establecer fecha mínima como mañana
    const mañana = new Date();
    mañana.setDate(mañana.getDate() + 1);
    const fechaMin = mañana.toISOString().split('T')[0];
    document.getElementById('fechaEntregaEstimada').setAttribute('min', fechaMin);
    document.getElementById('fechaEntregaEstimada').value = fechaMin;
    
    // Limpiar notas
    document.getElementById('notasEntrega').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('modalVentaSinStock'));
    modal.show();
}

/**
 * Confirmar venta contra pedido
 */
document.getElementById('btnConfirmarContraPedido').addEventListener('click', function() {
    const fechaEntrega = document.getElementById('fechaEntregaEstimada').value;
    const notasEntrega = document.getElementById('notasEntrega').value;
    
    if (!fechaEntrega) {
        mostrarAlerta('Debe indicar una fecha estimada de entrega', 'warning');
        return;
    }
    
    const producto = productoSinStockActual;
    const precioUnitario = parseFloat(producto.precio_venta || producto.precio_minorista);
    
    if (indexProductoSinStock >= 0) {
        // Incrementar cantidad de producto existente
        productosVenta[indexProductoSinStock].cantidad++;
        productosVenta[indexProductoSinStock].subtotal = productosVenta[indexProductoSinStock].cantidad * precioUnitario;
        productosVenta[indexProductoSinStock].tipo_venta = 'contra_pedido';
        productosVenta[indexProductoSinStock].estado_entrega = 'pendiente';
        productosVenta[indexProductoSinStock].fecha_entrega_estimada = fechaEntrega;
        productosVenta[indexProductoSinStock].notas_entrega = notasEntrega;
    } else {
        // Agregar nuevo producto contra pedido
        productosVenta.push({
            id: producto.id,
            nombre: producto.nombre,
            sku: producto.sku,
            precio_unitario: precioUnitario,
            precio_minorista: producto.precio_minorista || precioUnitario,
            precio_mayorista: producto.precio_mayorista || null,
            precio_distribuidor: producto.precio_distribuidor || null,
            precio_minimo: producto.precio_minimo || null,
            precio_maximo: producto.precio_maximo || null,
            cantidad: 1,
            stock_disponible: producto.stock_actual || 0,
            subtotal: precioUnitario,
            tipo_venta: 'contra_pedido',
            estado_entrega: 'pendiente',
            fecha_entrega_estimada: fechaEntrega,
            notas_entrega: notasEntrega
        });
    }
    
    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalVentaSinStock'));
    modal.hide();
    
    // Limpiar búsqueda
    document.getElementById('buscarProducto').value = '';
    document.getElementById('resultadosProducto').style.display = 'none';
    
    // Actualizar vista
    renderizarProductos();
    calcularTotales();
    
    mostrarAlerta(`Producto agregado como venta contra pedido. Entrega estimada: ${formatearFecha(fechaEntrega)}`, 'success');
});

/**
 * Formatear fecha para mostrar
 */
function formatearFecha(fecha) {
    const date = new Date(fecha + 'T00:00:00');
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-ES', opciones);
}

// ============================================
// FUNCIONES PARA IMPUESTOS ADICIONALES
// ============================================

/**
 * Cargar impuestos activos de la empresa
 */
async function cargarImpuestosActivos() {
    try {
        const empresaId = currentEmpresa?.id;
        if (!empresaId) return;

        const response = await fetch(`${API_URL}/impuestos/activos?empresaId=${empresaId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!response.ok) throw new Error('Error al cargar impuestos');
        
        const data = await response.json();
        impuestosDisponibles = data.data || [];
        
        if (impuestosDisponibles.length > 0) {
            // Mostrar contenedor de impuestos
            document.getElementById('impuestosAdicionalesContainer').style.display = 'block';
            
            // NO cargar impuestos automáticos - el vendedor debe seleccionarlos manualmente
            impuestosSeleccionados = [];
            
            // Renderizar lista
            renderizarImpuestosDisponibles();
            
            // Actualizar contador
            document.getElementById('impuestosCount').textContent = 0;
        }
    } catch (error) {
        console.error('Error al cargar impuestos:', error);
    }
}

/**
 * Renderizar lista de impuestos disponibles
 */
function renderizarImpuestosDisponibles() {
    const lista = document.getElementById('listaImpuestosDisponibles');
    if (!lista) return;

    lista.innerHTML = impuestosDisponibles.map(imp => {
        const isSelected = impuestosSeleccionados.includes(imp.id);
        const isAutomatic = imp.aplica_automaticamente;
        const tasaTexto = imp.tipo === 'porcentaje' ? `${imp.tasa}%` : `$${formatearNumero(imp.tasa)}`;
        
        return `
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" 
                       id="impuesto_${imp.id}" 
                       value="${imp.id}"
                       ${isSelected ? 'checked' : ''}
                       onchange="toggleImpuesto(${imp.id})">
                <label class="form-check-label d-flex justify-content-between" for="impuesto_${imp.id}">
                    <span>
                        ${imp.nombre}
                        ${isAutomatic ? '<span class="badge bg-info ms-1" style="font-size: 0.65rem;">Auto</span>' : ''}
                        ${imp.afecta_total === 'resta' ? '<span class="badge bg-warning ms-1" style="font-size: 0.65rem;">Resta</span>' : ''}
                    </span>
                    <span class="text-muted">${tasaTexto}</span>
                </label>
            </div>
        `;
    }).join('');
}

/**
 * Toggle selección de impuesto
 */
function toggleImpuesto(impuestoId) {
    const index = impuestosSeleccionados.indexOf(impuestoId);
    if (index > -1) {
        impuestosSeleccionados.splice(index, 1);
    } else {
        impuestosSeleccionados.push(impuestoId);
    }
    
    // Actualizar contador
    document.getElementById('impuestosCount').textContent = impuestosSeleccionados.length;
    
    // Recalcular totales
    calcularTotales();
}

// ============================================
// CATÁLOGO DE PRODUCTOS
// ============================================

/**
 * Cargar catálogo completo de productos
 */
async function cargarCatalogoProductos() {
    if (!currentEmpresa) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/productos?empresaId=${currentEmpresa.id}&estado=activo`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!response.ok) throw new Error('Error al cargar productos');

        const data = await response.json();
        todosCatalogo = data.data || [];
        
        // Extraer categorías únicas
        categoriasCatalogo = [...new Set(todosCatalogo.map(p => p.categoria_nombre).filter(Boolean))];
        
        renderizarCategoriasFilter();
        renderizarCatalogo();

    } catch (error) {
        console.error('Error al cargar catálogo:', error);
        document.getElementById('gridProductos').innerHTML = `
            <div class="col-12 text-center text-danger py-4">
                <i class="bi bi-exclamation-triangle display-4"></i>
                <p class="mt-2">Error al cargar el catálogo</p>
            </div>
        `;
    }
}

/**
 * Renderizar filtros de categorías
 */
function renderizarCategoriasFilter() {
    const container = document.getElementById('categoriasFiltros');
    if (!container) return;
    
    const btnTodos = `
        <button class="btn btn-sm ${categoriaFiltroActual === null ? 'btn-primary' : 'btn-outline-secondary'}" 
                onclick="filtrarPorCategoria(null)">
            <i class="bi bi-star me-1"></i>Todos (${todosCatalogo.length})
        </button>
    `;
    
    const btnsCategorias = categoriasCatalogo.map(cat => {
        const count = todosCatalogo.filter(p => p.categoria_nombre === cat).length;
        return `
            <button class="btn btn-sm ${categoriaFiltroActual === cat ? 'btn-primary' : 'btn-outline-secondary'}" 
                    onclick="filtrarPorCategoria('${cat.replace(/'/g, "\\'")}')">
                ${cat} (${count})
            </button>
        `;
    }).join('');
    
    container.innerHTML = btnTodos + btnsCategorias;
}

/**
 * Filtrar productos por categoría
 */
function filtrarPorCategoria(categoria) {
    categoriaFiltroActual = categoria;
    renderizarCategoriasFilter();
    renderizarCatalogo();
}

/**
 * Cambiar vista del catálogo (grid/list)
 */
function cambiarVistaProductos(vista) {
    vistaActual = vista;
    
    // Actualizar botones
    document.querySelectorAll('#catalogoProductos .btn-group button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('button').classList.add('active');
    
    renderizarCatalogo();
}

/**
 * Renderizar catálogo de productos
 */
function renderizarCatalogo() {
    const container = document.getElementById('gridProductos');
    if (!container) return;
    
    // Filtrar productos
    let productosFiltrados = todosCatalogo;
    if (categoriaFiltroActual) {
        productosFiltrados = todosCatalogo.filter(p => p.categoria_nombre === categoriaFiltroActual);
    }
    
    if (productosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center text-muted py-4">
                <i class="bi bi-inbox display-4"></i>
                <p class="mt-2">No hay productos en esta categoría</p>
            </div>
        `;
        return;
    }
    
    if (vistaActual === 'grid') {
        renderizarCatalogoGrid(productosFiltrados, container);
    } else {
        renderizarCatalogoList(productosFiltrados, container);
    }
}

/**
 * Renderizar catálogo en vista Grid
 */
function renderizarCatalogoGrid(productos, container) {
    container.innerHTML = productos.map(p => {
        const stockClass = p.stock_actual > 10 ? 'stock-alto' : 
                          p.stock_actual > 5 ? 'stock-medio' : 
                          p.stock_actual > 0 ? 'stock-bajo' : 'stock-sin';
        
        const stockText = p.stock_actual > 0 ? p.stock_actual : 'Sin stock';
        
        return `
            <div class="col-6 col-md-4 col-lg-3">
                <div class="producto-card" 
                     onclick="seleccionarProductoCatalogo(${p.id})"
                     ondblclick="agregarProductoDesdeCatalogo(${p.id})"
                     data-producto-id="${p.id}">
                    <span class="stock-badge ${stockClass}">${stockText}</span>
                    ${p.imagen_url ? 
                        `<img src="${p.imagen_url}" class="producto-card-img mb-2" alt="${p.nombre}">` :
                        `<div class="producto-card-img-placeholder mb-2">
                            <i class="bi bi-box-seam"></i>
                         </div>`
                    }
                    <div class="mb-1">
                        <strong class="d-block text-truncate" style="font-size: 0.9rem;">${p.nombre}</strong>
                        <small class="text-muted">SKU: ${p.sku}</small>
                        ${p.aplica_iva ? '<span class="badge bg-info text-white ms-1" style="font-size: 0.65rem;">IVA</span>' : ''}
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <strong class="text-success" style="font-size: 1.1rem;">$${formatearNumero(p.precio_minorista)}</strong>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Agregar listener para tecla Enter
    agregarListenerTeclado();
}

/**
 * Renderizar catálogo en vista List
 */
function renderizarCatalogoList(productos, container) {
    container.innerHTML = `
        <div class="col-12">
            ${productos.map(p => {
                const stockClass = p.stock_actual > 10 ? 'stock-alto' : 
                                  p.stock_actual > 5 ? 'stock-medio' : 
                                  p.stock_actual > 0 ? 'stock-bajo' : 'stock-sin';
                
                const stockText = p.stock_actual > 0 ? p.stock_actual : 'Sin stock';
                
                return `
                    <div class="producto-card-list" 
                         onclick="seleccionarProductoCatalogo(${p.id})"
                         ondblclick="agregarProductoDesdeCatalogo(${p.id})"
                         data-producto-id="${p.id}">
                        ${p.imagen_url ? 
                            `<img src="${p.imagen_url}" class="rounded me-3" style="width: 60px; height: 60px; object-fit: cover;" alt="${p.nombre}">` :
                            `<div class="rounded me-3" style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white;">
                                <i class="bi bi-box-seam" style="font-size: 1.5rem;"></i>
                             </div>`
                        }
                        <div class="flex-grow-1">
                            <strong>${p.nombre}</strong>
                            ${p.aplica_iva ? '<span class="badge bg-info text-white ms-2">IVA</span>' : ''}
                            <br>
                            <small class="text-muted">SKU: ${p.sku}</small>
                        </div>
                        <div class="text-center me-3">
                            <span class="badge ${stockClass}">${stockText}</span>
                        </div>
                        <div class="text-end">
                            <strong class="text-success" style="font-size: 1.2rem;">$${formatearNumero(p.precio_minorista)}</strong>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    // Agregar listener para tecla Enter
    agregarListenerTeclado();
}

/**
 * Seleccionar producto del catálogo
 */
function seleccionarProductoCatalogo(productoId) {
    // Remover selección previa
    document.querySelectorAll('.producto-card, .producto-card-list').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Seleccionar nuevo
    const card = document.querySelector(`[data-producto-id="${productoId}"]`);
    if (card) {
        card.classList.add('selected');
        productoSeleccionadoCatalogo = productoId;
    }
}

/**
 * Agregar producto desde catálogo
 */
function agregarProductoDesdeCatalogo(productoId) {
    const producto = todosCatalogo.find(p => p.id === productoId);
    if (producto) {
        agregarProducto(producto);
    }
}

/**
 * Agregar listener para tecla Enter en catálogo
 */
function agregarListenerTeclado() {
    document.addEventListener('keydown', function(e) {
        // Ignorar si el Enter se presiona dentro de un input, textarea o select
        const elementoActivo = document.activeElement;
        const esInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(elementoActivo.tagName);
        
        if (e.key === 'Enter' && productoSeleccionadoCatalogo && !esInput) {
            agregarProductoDesdeCatalogo(productoSeleccionadoCatalogo);
        }
    });
}
// ============================================
// CLIENTE PÚBLICO GENERAL
// ============================================

/**
 * Seleccionar cliente "Público General" automáticamente
 */
async function seleccionarPublicoGeneral() {
    try {
        // Buscar o crear cliente público general
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/ventas/buscar-cliente?empresaId=${currentEmpresa.id}&tipo=documento&valor=999999999`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!response.ok) throw new Error('Error al buscar cliente');

        const data = await response.json();
        let clientePublico = data.data && data.data.length > 0 ? data.data[0] : null;

        // Si no existe, crearlo
        if (!clientePublico) {
            const createResponse = await fetch(`${API_URL}/clientes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    empresa_id: currentEmpresa.id,
                    tipo_documento: 'CC',
                    numero_documento: '999999999',
                    nombre: 'PÚBLICO',
                    apellido: 'GENERAL',
                    razon_social: 'PÚBLICO GENERAL',
                    email: 'publico@general.com',
                    tipo_cliente: 'ocasional',
                    estado: 'activo'
                })
            });

            if (!createResponse.ok) throw new Error('Error al crear cliente público');
            
            const createData = await createResponse.json();
            clientePublico = {
                id: createData.data.id,
                tipo_documento: 'CC',
                numero_documento: '999999999',
                nombre: 'PÚBLICO',
                apellido: 'GENERAL',
                razon_social: 'PÚBLICO GENERAL',
                email: 'publico@general.com'
            };
        }

        seleccionarCliente(clientePublico);
        reproducirSonido('success');
        mostrarAlerta('Cliente "Público General" seleccionado', 'success');

    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al seleccionar público general', 'danger');
    }
}

// ============================================
// CALCULADORA DE VUELTAS
// ============================================

/**
 * Actualizar estado de pago con calculadora de vueltas
 */
function actualizarEstadoPago() {
    const totalPagado = calcularTotalPagado();
    const pendiente = totalVentaActual - totalPagado;
    
    // Actualizar resumen de pagos
    document.getElementById('totalVentaPagos').textContent = `$${formatearNumero(totalVentaActual)}`;
    document.getElementById('totalPagado').textContent = `$${formatearNumero(totalPagado)}`;
    document.getElementById('montoPendiente').textContent = `$${formatearNumero(pendiente)}`;
    
    // Mostrar/ocultar calculadora de vueltas
    const calculadoraVueltas = document.getElementById('calculadoraVueltas');
    const alertaPendiente = document.getElementById('alertaPendiente');
    
    if (totalPagado > totalVentaActual) {
        // Hay vueltas
        const vueltas = totalPagado - totalVentaActual;
        calculadoraVueltas.style.display = 'block';
        alertaPendiente.style.display = 'none';
        document.getElementById('montoVueltas').textContent = `$${formatearNumero(vueltas)}`;
        reproducirSonido('vueltas');
    } else if (pendiente > 0.01) {
        // Falta por pagar
        calculadoraVueltas.style.display = 'none';
        alertaPendiente.style.display = 'block';
    } else {
        // Pagado exacto
        calculadoraVueltas.style.display = 'none';
        alertaPendiente.style.display = 'none';
    }
    
    // Habilitar/deshabilitar botón de guardar
    const btnGuardar = document.getElementById('btnGuardarVenta');
    const pagoCompleto = Math.abs(pendiente) < 0.01 || totalPagado >= totalVentaActual;
    const tieneCliente = !!clienteSeleccionado;
    const tieneProductos = productosVenta.length > 0;
    
    btnGuardar.disabled = !tieneCliente || !tieneProductos || !pagoCompleto;
}

// ============================================
// SONIDOS DE FEEDBACK
// ============================================

/**
 * Reproducir sonido de feedback
 */
function reproducirSonido(tipo) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch(tipo) {
        case 'success':
            oscillator.frequency.value = 800;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
            break;
        case 'add':
            oscillator.frequency.value = 600;
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.05);
            break;
        case 'error':
            oscillator.frequency.value = 200;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
            break;
        case 'vueltas':
            oscillator.frequency.value = 1000;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            oscillator.start();
            setTimeout(() => {
                oscillator.frequency.value = 1200;
            }, 100);
            oscillator.stop(audioContext.currentTime + 0.2);
            break;
    }
}

// ============================================
// ÚLTIMAS VENTAS
// ============================================

/**
 * Cargar últimas ventas del día
 */
async function cargarUltimasVentas() {
    if (!currentEmpresa) return;
    
    try {
        const token = localStorage.getItem('token');
        const hoy = new Date().toISOString().split('T')[0];
        
        const response = await fetch(
            `${API_URL}/ventas?empresaId=${currentEmpresa.id}&fecha_desde=${hoy}&fecha_hasta=${hoy}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!response.ok) throw new Error('Error al cargar ventas');

        const data = await response.json();
        ultimasVentas = data.data || [];
        
        renderizarUltimasVentas();

    } catch (error) {
        console.error('Error al cargar últimas ventas:', error);
    }
}

/**
 * Renderizar últimas ventas en el panel
 */
function renderizarUltimasVentas() {
    const container = document.getElementById('listaUltimasVentas');
    
    if (ultimasVentas.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-inbox display-4"></i>
                <p class="mt-2">No hay ventas hoy</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = ultimasVentas.slice(0, 10).map(venta => `
        <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <h6 class="mb-1">${venta.numero_factura}</h6>
                    <p class="mb-1 small text-muted">
                        ${venta.cliente_nombre || venta.razon_social}
                    </p>
                    <small class="text-muted">${new Date(venta.fecha_venta).toLocaleTimeString('es-CO')}</small>
                </div>
                <div class="text-end">
                    <strong class="text-success d-block">$${formatearNumero(venta.total)}</strong>
                    <button class="btn btn-sm btn-outline-primary mt-1" onclick="reimprimirFactura('${venta.numero_factura}')">
                        <i class="bi bi-printer"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Reimprimir factura
 */
async function reimprimirFactura(numeroFactura) {
    mostrarAlerta('Función de reimpresión en desarrollo', 'info');
    reproducirSonido('add');
}

// ============================================
// TURNOS DE CAJA
// ============================================

/**
 * Abrir modal de turno de caja
 */
function abrirModalTurno() {
    // Verificar si hay turno activo en localStorage
    turnoActivo = JSON.parse(localStorage.getItem('turnoActivo'));
    
    if (turnoActivo) {
        // Mostrar turno activo
        document.getElementById('turnoNuevo').style.display = 'none';
        document.getElementById('turnoAbierto').style.display = 'block';
        document.getElementById('btnAbrirTurno').style.display = 'none';
        document.getElementById('btnCerrarTurno').style.display = 'block';
        
        document.getElementById('turnoUsuario').textContent = turnoActivo.usuario;
        document.getElementById('turnoApertura').textContent = new Date(turnoActivo.apertura).toLocaleString('es-CO');
        document.getElementById('turnoBaseInicial').textContent = formatearNumero(turnoActivo.baseInicial);
        document.getElementById('resumenBaseInicial').textContent = formatearNumero(turnoActivo.baseInicial);
        
        // Calcular ventas en efectivo del turno
        calcularResumenTurno();
    } else {
        // Mostrar formulario nuevo turno
        document.getElementById('turnoNuevo').style.display = 'block';
        document.getElementById('turnoAbierto').style.display = 'none';
        document.getElementById('btnAbrirTurno').style.display = 'block';
        document.getElementById('btnCerrarTurno').style.display = 'none';
    }
    
    const modal = new bootstrap.Modal(document.getElementById('turnoCajaModal'));
    modal.show();
}

/**
 * Abrir nuevo turno
 */
function abrirTurno() {
    const baseInicial = parseFloat(document.getElementById('baseInicialTurno').value) || 0;
    const notas = document.getElementById('notasAperturaTurno').value;
    
    turnoActivo = {
        id: Date.now(),
        usuario: `${currentUsuario.nombre} ${currentUsuario.apellido}`,
        usuario_id: currentUsuario.id,
        empresa_id: currentEmpresa.id,
        apertura: new Date().toISOString(),
        baseInicial: baseInicial,
        notas: notas
    };
    
    localStorage.setItem('turnoActivo', JSON.stringify(turnoActivo));
    
    bootstrap.Modal.getInstance(document.getElementById('turnoCajaModal')).hide();
    mostrarAlerta('Turno abierto exitosamente', 'success');
    reproducirSonido('success');
}

/**
 * Calcular resumen del turno
 */
async function calcularResumenTurno() {
    if (!turnoActivo) return;
    
    // Filtrar ventas en efectivo desde la apertura
    const ventasEfectivo = ultimasVentas.filter(v => {
        const fechaVenta = new Date(v.fecha_venta);
        const fechaApertura = new Date(turnoActivo.apertura);
        return fechaVenta >= fechaApertura && v.metodo_pago === 'efectivo';
    });
    
    const totalEfectivo = ventasEfectivo.reduce((sum, v) => sum + parseFloat(v.total), 0);
    const esperado = turnoActivo.baseInicial + totalEfectivo;
    
    document.getElementById('resumenVentasEfectivo').textContent = formatearNumero(totalEfectivo);
    document.getElementById('resumenEsperado').textContent = formatearNumero(esperado);
}

/**
 * Calcular diferencia en el cierre
 */
function calcularDiferenciaTurno() {
    const efectivoContado = parseFloat(document.getElementById('efectivoContado').value) || 0;
    const esperado = turnoActivo.baseInicial + parseFloat(document.getElementById('resumenVentasEfectivo').textContent.replace(/,/g, ''));
    const diferencia = efectivoContado - esperado;
    
    const elemento = document.getElementById('resumenDiferencia');
    elemento.textContent = `$${formatearNumero(Math.abs(diferencia))}`;
    
    if (diferencia > 0) {
        elemento.className = 'text-success';
        elemento.innerHTML = `<i class="bi bi-arrow-up-circle me-1"></i>+$${formatearNumero(diferencia)} (Sobrante)`;
    } else if (diferencia < 0) {
        elemento.className = 'text-danger';
        elemento.innerHTML = `<i class="bi bi-arrow-down-circle me-1"></i>-$${formatearNumero(Math.abs(diferencia))} (Faltante)`;
    } else {
        elemento.className = 'text-primary';
        elemento.innerHTML = `<i class="bi bi-check-circle me-1"></i>$0 (Exacto)`;
    }
}

/**
 * Cerrar turno
 */
function cerrarTurno() {
    if (!confirm('¿Está seguro de cerrar el turno? Esta acción no se puede deshacer.')) {
        return;
    }
    
    const cierreTurno = {
        ...turnoActivo,
        cierre: new Date().toISOString(),
        efectivoContado: parseFloat(document.getElementById('efectivoContado').value) || 0,
        notasCierre: document.getElementById('notasCierreTurno').value
    };
    
    // Guardar en historial (por ahora en localStorage)
    const historial = JSON.parse(localStorage.getItem('historialTurnos') || '[]');
    historial.push(cierreTurno);
    localStorage.setItem('historialTurnos', JSON.stringify(historial));
    
    // Limpiar turno activo
    localStorage.removeItem('turnoActivo');
    turnoActivo = null;
    
    bootstrap.Modal.getInstance(document.getElementById('turnoCajaModal')).hide();
    mostrarAlerta('Turno cerrado exitosamente', 'success');
    reproducirSonido('success');
}

// ============================================
// MODO RÁPIDO
// ============================================

/**
 * Toggle modo rápido
 */
function toggleModoRapido(e) {
    modoRapido = e.target.checked;
    
    if (modoRapido) {
        mostrarAlerta('⚡ Modo Rápido activado - Cliente público automático', 'info');
        // En modo rápido, si no hay cliente, seleccionar público general
        if (!clienteSeleccionado) {
            seleccionarPublicoGeneral();
        }
    } else {
        mostrarAlerta('Modo Normal activado', 'info');
    }
}

// ============================================
// INICIALIZACIÓN ADICIONAL
// ============================================

// Cargar últimas ventas al iniciar
setTimeout(() => {
    cargarUltimasVentas();
    // Actualizar cada 30 segundos
    setInterval(cargarUltimasVentas, 30000);
}, 2000);