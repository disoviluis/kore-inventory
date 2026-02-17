/**
 * KORE INVENTORY - Compras Module
 * JavaScript para módulo de compras
 */

const API_URL = 'http://18.191.181.99:3000/api';
let currentEmpresa = null;
let currentUsuario = null;
let compras = [];
let productos = [];
let proveedores = [];
let productosCompra = [];
let compraModal = null;
let detalleModal = null;
let compraActual = null;

// Inicialización
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

        await cargarEmpresas(usuario.id);

        currentEmpresa = JSON.parse(localStorage.getItem('empresaActiva'));
        if (!currentEmpresa) {
            mostrarAlerta('Por favor selecciona una empresa desde el dashboard', 'warning');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
            return;
        }

        compraModal = new bootstrap.Modal(document.getElementById('compraModal'));
        detalleModal = new bootstrap.Modal(document.getElementById('detalleModal'));

        await Promise.all([
            cargarResumen(),
            cargarCompras(),
            cargarProveedores(),
            cargarProductos()
        ]);

        initEventListeners();

    } catch (error) {
        console.error('Error en inicialización:', error);
        mostrarAlerta('Error al cargar el módulo', 'danger');
    }
});

function cargarInfoUsuario(usuario) {
    document.getElementById('userName').textContent = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim();
    document.getElementById('userRole').textContent = getTipoUsuarioTexto(usuario.tipo_usuario);
}

function getTipoUsuarioTexto(tipo) {
    const tipos = {
        'super_admin': 'Super Administrador',
        'admin_empresa': 'Administrador',
        'usuario': 'Usuario',
        'soporte': 'Soporte'
    };
    return tipos[tipo] || tipo;
}

async function cargarEmpresas(usuarioId) {
    const token = localStorage.getItem('token');
    const companySelector = document.getElementById('companySelector');
    
    try {
        const response = await fetch(`${API_URL}/empresas/usuario/${usuarioId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            companySelector.innerHTML = '';
            data.data.forEach(empresa => {
                const option = document.createElement('option');
                option.value = empresa.id;
                option.textContent = empresa.nombre;
                companySelector.appendChild(option);
            });
            
            const empresaGuardada = localStorage.getItem('empresaActiva');
            if (empresaGuardada) {
                const empresaObj = JSON.parse(empresaGuardada);
                companySelector.value = empresaObj.id;
            } else {
                companySelector.value = data.data[0].id;
                localStorage.setItem('empresaActiva', JSON.stringify(data.data[0]));
            }
            
            companySelector.addEventListener('change', async (e) => {
                const empresaId = e.target.value;
                const empresaSeleccionada = data.data.find(emp => emp.id == empresaId);
                localStorage.setItem('empresaActiva', JSON.stringify(empresaSeleccionada));
                currentEmpresa = empresaSeleccionada;
                await Promise.all([cargarResumen(), cargarCompras()]);
            });
        }
    } catch (error) {
        console.error('Error al cargar empresas:', error);
    }
}

async function cargarResumen() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/compras/resumen?empresaId=${currentEmpresa.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('totalCompras').textContent = data.data.total_compras;
            document.getElementById('comprasPendientes').textContent = data.data.compras_pendientes;
            document.getElementById('totalMes').textContent = formatearMoneda(data.data.total_mes);
        }
    } catch (error) {
        console.error('Error al cargar resumen:', error);
    }
}

async function cargarCompras() {
    try {
        const token = localStorage.getItem('token');
        const estado = document.getElementById('filterEstado').value;
        const proveedorId = document.getElementById('filterProveedor').value;
        
        let url = `${API_URL}/compras?empresaId=${currentEmpresa.id}`;
        if (estado) url += `&estado=${estado}`;
        if (proveedorId) url += `&proveedorId=${proveedorId}`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            compras = data.data;
            renderizarCompras(compras);
        }
    } catch (error) {
        console.error('Error al cargar compras:', error);
    }
}

function renderizarCompras(data) {
    const tbody = document.getElementById('comprasTable');
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No hay compras registradas</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.map(compra => `
        <tr>
            <td><strong>${compra.numero_compra}</strong></td>
            <td>${formatearFecha(compra.fecha_compra)}</td>
            <td>${compra.proveedor_nombre}</td>
            <td><span class="badge bg-${compra.tipo_compra === 'contado' ? 'success' : 'warning'}">${compra.tipo_compra}</span></td>
            <td>${formatearMoneda(compra.total)}</td>
            <td>${getEstadoBadge(compra.estado)}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary" onclick="verDetalle(${compra.id})">
                    <i class="bi bi-eye"></i>
                </button>
                ${compra.estado === 'pendiente' ? `
                    <button class="btn btn-sm btn-outline-danger" onclick="anularCompra(${compra.id})">
                        <i class="bi bi-x-circle"></i>
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

async function cargarProveedores() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/proveedores?empresaId=${currentEmpresa.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            proveedores = data.data;
            const select = document.getElementById('compraProveedor');
            const filter = document.getElementById('filterProveedor');
            
            select.innerHTML = '<option value="">Seleccione un proveedor</option>' + 
                proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
            
            filter.innerHTML = '<option value="">Todos los proveedores</option>' + 
                proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
        }
    } catch (error) {
        console.error('Error al cargar proveedores:', error);
    }
}

async function cargarProductos() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/productos?empresaId=${currentEmpresa.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            productos = data.data.filter(p => p.estado === 'activo');
            const select = document.getElementById('selectProducto');
            select.innerHTML = '<option value="">Seleccione un producto</option>' + 
                productos.map(p => `<option value="${p.id}" data-precio="${p.precio_compra || 0}">${p.nombre} (${p.codigo})</option>`).join('');
        }
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
}

function initEventListeners() {
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

    document.getElementById('logoutBtn').addEventListener('click', cerrarSesion);
    document.getElementById('btnNuevaCompra').addEventListener('click', abrirModalCompra);
    document.getElementById('searchInput').addEventListener('input', filtrarCompras);
    document.getElementById('filterEstado').addEventListener('change', cargarCompras);
    document.getElementById('filterProveedor').addEventListener('change', cargarCompras);
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);
    document.getElementById('compraForm').addEventListener('submit', guardarCompra);
    document.getElementById('btnAgregarProducto').addEventListener('click', agregarProducto);
    document.getElementById('impuestosCompra').addEventListener('input', calcularTotal);
    document.getElementById('descuentoCompra').addEventListener('input', calcularTotal);
    
    // Auto-generar número de compra
    document.getElementById('compraFecha').valueAsDate = new Date();
}

function abrirModalCompra() {
    productosCompra = [];
    document.getElementById('compraForm').reset();
    document.getElementById('compraFecha').valueAsDate = new Date();
    generarNumeroCompra();
    renderizarProductosCompra();
    compraModal.show();
}

function generarNumeroCompra() {
    const fecha = new Date();
    const numero = `C${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}${String(fecha.getHours()).padStart(2, '0')}${String(fecha.getMinutes()).padStart(2, '0')}${String(fecha.getSeconds()).padStart(2, '0')}`;
    document.getElementById('compraNumero').value = numero;
}

function agregarProducto() {
    const productoId = document.getElementById('selectProducto').value;
    const cantidad = parseInt(document.getElementById('inputCantidad').value);
    const precio = parseFloat(document.getElementById('inputPrecio').value);
    
    if (!productoId || !cantidad || !precio) {
        mostrarAlerta('Complete todos los campos del producto', 'warning');
        return;
    }
    
    const producto = productos.find(p => p.id == productoId);
    if (!producto) return;
    
    // Verificar si ya existe
    const existe = productosCompra.find(p => p.producto_id == productoId);
    if (existe) {
        existe.cantidad += cantidad;
        existe.subtotal = existe.cantidad * existe.precio_unitario;
    } else {
        productosCompra.push({
            producto_id: productoId,
            producto_nombre: producto.nombre,
            cantidad: cantidad,
            precio_unitario: precio,
            subtotal: cantidad * precio
        });
    }
    
    document.getElementById('selectProducto').value = '';
    document.getElementById('inputCantidad').value = '';
    document.getElementById('inputPrecio').value = '';
    
    renderizarProductosCompra();
    calcularTotal();
}

function eliminarProducto(index) {
    productosCompra.splice(index, 1);
    renderizarProductosCompra();
    calcularTotal();
}

function renderizarProductosCompra() {
    const tbody = document.getElementById('productosTable');
    
    if (productosCompra.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay productos agregados</td></tr>';
        return;
    }
    
    tbody.innerHTML = productosCompra.map((prod, index) => `
        <tr>
            <td>${prod.producto_nombre}</td>
            <td>${prod.cantidad}</td>
            <td>${formatearMoneda(prod.precio_unitario)}</td>
            <td>${formatearMoneda(prod.subtotal)}</td>
            <td class="text-center">
                <button type="button" class="btn btn-sm btn-danger" onclick="eliminarProducto(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function calcularTotal() {
    const subtotal = productosCompra.reduce((sum, p) => sum + p.subtotal, 0);
    const impuestos = parseFloat(document.getElementById('impuestosCompra').value) || 0;
    const descuento = parseFloat(document.getElementById('descuentoCompra').value) || 0;
    const total = subtotal + impuestos - descuento;
    
    document.getElementById('subtotalCompra').textContent = formatearMoneda(subtotal);
    document.getElementById('totalCompra').textContent = formatearMoneda(total);
}

async function guardarCompra(e) {
    e.preventDefault();
    
    if (productosCompra.length === 0) {
        mostrarAlerta('Debe agregar al menos un producto', 'warning');
        return;
    }
    
    const compraData = {
        empresaId: currentEmpresa.id,
        proveedorId: parseInt(document.getElementById('compraProveedor').value),
        numeroCompra: document.getElementById('compraNumero').value,
        fechaCompra: document.getElementById('compraFecha').value,
        tipoCompra: document.getElementById('compraTipo').value,
        productos: productosCompra,
        impuestos: parseFloat(document.getElementById('impuestosCompra').value) || 0,
        descuento: parseFloat(document.getElementById('descuentoCompra').value) || 0,
        notas: document.getElementById('compraNotas').value,
        usuarioId: currentUsuario.id
    };
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/compras`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(compraData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarAlerta('Compra creada exitosamente', 'success');
            compraModal.hide();
            await Promise.all([cargarResumen(), cargarCompras()]);
        } else {
            mostrarAlerta(data.message || 'Error al crear la compra', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al guardar la compra', 'danger');
    }
}

async function verDetalle(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/compras/${id}?empresaId=${currentEmpresa.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            compraActual = data.data;
            mostrarDetalleCompra(data.data);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al cargar el detalle', 'danger');
    }
}

function mostrarDetalleCompra(compra) {
    const content = document.getElementById('detalleContent');
    content.innerHTML = `
        <div class="row mb-3">
            <div class="col-md-6">
                <strong>Número:</strong> ${compra.numero_compra}<br>
                <strong>Fecha:</strong> ${formatearFecha(compra.fecha_compra)}<br>
                <strong>Estado:</strong> ${getEstadoBadge(compra.estado)}
            </div>
            <div class="col-md-6">
                <strong>Proveedor:</strong> ${compra.proveedor_nombre}<br>
                <strong>Tipo:</strong> ${compra.tipo_compra}<br>
                <strong>Usuario:</strong> ${compra.usuario_nombre} ${compra.usuario_apellido}
            </div>
        </div>
        
        <h6>Productos</h6>
        <table class="table table-sm">
            <thead>
                <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${compra.productos.map(p => `
                    <tr>
                        <td>${p.producto_nombre}</td>
                        <td>${p.cantidad}</td>
                        <td>${formatearMoneda(p.precio_unitario)}</td>
                        <td>${formatearMoneda(p.subtotal)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="row justify-content-end">
            <div class="col-md-4">
                <table class="table table-sm table-borderless">
                    <tr><th>Subtotal:</th><td class="text-end">${formatearMoneda(compra.subtotal)}</td></tr>
                    <tr><th>Impuestos:</th><td class="text-end">${formatearMoneda(compra.impuestos)}</td></tr>
                    <tr><th>Descuento:</th><td class="text-end">${formatearMoneda(compra.descuento)}</td></tr>
                    <tr class="table-primary"><th>TOTAL:</th><th class="text-end">${formatearMoneda(compra.total)}</th></tr>
                </table>
            </div>
        </div>
        ${compra.notas ? `<p><strong>Notas:</strong> ${compra.notas}</p>` : ''}
    `;
    
    const btnRecibir = document.getElementById('btnRecibirCompra');
    if (compra.estado === 'pendiente') {
        btnRecibir.style.display = 'inline-block';
        btnRecibir.onclick = () => recibirCompra(compra.id);
    } else {
        btnRecibir.style.display = 'none';
    }
    
    detalleModal.show();
}

async function recibirCompra(id) {
    if (!confirm('¿Confirmar recepción de esta compra? Se actualizará el inventario.')) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/compras/${id}/recibir`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                empresaId: currentEmpresa.id,
                usuarioId: currentUsuario.id,
                fechaRecepcion: new Date().toISOString().split('T')[0]
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarAlerta('Compra recibida e inventario actualizado', 'success');
            detalleModal.hide();
            await Promise.all([cargarResumen(), cargarCompras()]);
        } else {
            mostrarAlerta(data.message || 'Error al recibir la compra', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al recibir la compra', 'danger');
    }
}

async function anularCompra(id) {
    if (!confirm('¿Está seguro de anular esta compra?')) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/compras/${id}/anular`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ empresaId: currentEmpresa.id })
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarAlerta('Compra anulada exitosamente', 'success');
            await Promise.all([cargarResumen(), cargarCompras()]);
        } else {
            mostrarAlerta(data.message || 'Error al anular la compra', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al anular la compra', 'danger');
    }
}

function filtrarCompras() {
    const busqueda = document.getElementById('searchInput').value.toLowerCase();
    const filtrados = compras.filter(c => 
        c.numero_compra.toLowerCase().includes(busqueda) ||
        c.proveedor_nombre.toLowerCase().includes(busqueda)
    );
    renderizarCompras(filtrados);
}

function limpiarFiltros() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterEstado').value = '';
    document.getElementById('filterProveedor').value = '';
    cargarCompras();
}

function formatearFecha(fecha) {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-CO');
}

function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(valor || 0);
}

function getEstadoBadge(estado) {
    const badges = {
        'pendiente': '<span class="badge bg-warning">Pendiente</span>',
        'recibida': '<span class="badge bg-success">Recibida</span>',
        'parcial': '<span class="badge bg-info">Parcial</span>',
        'anulada': '<span class="badge bg-danger">Anulada</span>'
    };
    return badges[estado] || estado;
}

function mostrarAlerta(mensaje, tipo) {
    const alertaDiv = document.createElement('div');
    alertaDiv.className = `alert alert-${tipo} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    alertaDiv.style.zIndex = '9999';
    alertaDiv.innerHTML = `
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertaDiv);
    setTimeout(() => alertaDiv.remove(), 3000);
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = 'login.html';
}
