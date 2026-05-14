/**
 * TRASLADOS MODULE
 * Gestión completa de traslados entre bodegas
 */

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : 'http://18.191.181.99/api';
let currentEmpresaId = null;
let allTraslados = [];
let allBodegas = [];
let productosDisponibles = [];
let productosSeleccionados = [];
let trasladoEditando = null;

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const empresaActiva = localStorage.getItem('empresa_activa');
    
    if (!usuario) {
        window.location.href = 'login.html';
        return;
    }

    currentEmpresaId = usuario.tipo_usuario === 'super_admin' 
        ? empresaActiva 
        : usuario.empresa_id_default;

    if (!currentEmpresaId) {
        Swal.fire({
            icon: 'warning',
            title: 'Empresa no seleccionada',
            text: 'Por favor selecciona una empresa primero'
        });
        return;
    }

    // Initialize
    loadUserInfo();
    await loadBodegas();
    await loadTraslados();
    initializeEventListeners();
});

// ==========================================
// LOAD DATA
// ==========================================

function loadUserInfo() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (usuario) {
        document.getElementById('userName').textContent = usuario.nombre;
        document.getElementById('userRole').textContent = usuario.tipo_usuario.replace('_', ' ').toUpperCase();
    }
}

async function loadBodegas() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/bodegas?empresa_id=${currentEmpresaId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        
        if (result.success) {
            allBodegas = result.data;
            populateBodegasSelects();
            populateBodegaFilter();
        }
    } catch (error) {
        console.error('Error loading bodegas:', error);
    }
}

async function loadTraslados() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/traslados?empresa_id=${currentEmpresaId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        
        if (result.success) {
            allTraslados = result.data;
            updateStats();
            renderTraslados();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error loading traslados:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar los traslados: ' + error.message,
            toast: true,
            position: 'top-end',
            timer: 3000,
            showConfirmButton: false
        });
    }
}

function populateBodegasSelects() {
    const selectOrigen = document.getElementById('bodegaOrigen');
    const selectDestino = document.getElementById('bodegaDestino');
    
    const options = allBodegas.map(b => 
        `<option value="${b.id}">${b.nombre} - ${b.tipo}</option>`
    ).join('');
    
    selectOrigen.innerHTML = '<option value="">Seleccionar bodega...</option>' + options;
    selectDestino.innerHTML = '<option value="">Seleccionar bodega...</option>' + options;
}

function populateBodegaFilter() {
    const select = document.getElementById('filterBodega');
    
    const options = allBodegas.map(b => 
        `<option value="${b.id}">${b.nombre}</option>`
    ).join('');
    
    select.innerHTML = '<option value="">Todas las bodegas</option>' + options;
}

// ==========================================
// STATS
// ==========================================

function updateStats() {
    const total = allTraslados.length;
    const pendientes = allTraslados.filter(t => 
        t.estado === 'borrador' || t.estado === 'pendiente_aprobacion' || t.estado === 'aprobado'
    ).length;
    const enTransito = allTraslados.filter(t => t.estado === 'en_transito').length;
    const completados = allTraslados.filter(t => 
        t.estado === 'recibido' || t.estado === 'parcialmente_recibido'
    ).length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statPendientes').textContent = pendientes;
    document.getElementById('statEnTransito').textContent = enTransito;
    document.getElementById('statCompletados').textContent = completados;
}

// ==========================================
// RENDER
// ==========================================

function renderTraslados() {
    const tbody = document.getElementById('trasladosTableBody');
    let traslados = [...allTraslados];

    // Aplicar filtros
    const searchTerm = document.getElementById('searchTraslado').value.toLowerCase();
    const estadoFilter = document.getElementById('filterEstado').value;
    const bodegaFilter = document.getElementById('filterBodega').value;
    const fechaFilter = document.getElementById('filterFecha').value;

    if (searchTerm) {
        traslados = traslados.filter(t => 
            t.numero_traslado.toLowerCase().includes(searchTerm)
        );
    }

    if (estadoFilter) {
        traslados = traslados.filter(t => t.estado === estadoFilter);
    }

    if (bodegaFilter) {
        traslados = traslados.filter(t => 
            t.bodega_origen_id === parseInt(bodegaFilter) || 
            t.bodega_destino_id === parseInt(bodegaFilter)
        );
    }

    if (fechaFilter) {
        traslados = traslados.filter(t => {
            const fecha = new Date(t.fecha_solicitud).toISOString().split('T')[0];
            return fecha === fechaFilter;
        });
    }

    if (traslados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5">
                    <i class="bi bi-inbox fs-1 text-muted"></i>
                    <p class="mt-2 text-muted">No se encontraron traslados</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = traslados.map(t => `
        <tr>
            <td>
                <span class="badge bg-secondary">${t.numero_traslado}</span>
            </td>
            <td>
                <div><strong>${t.bodega_origen_nombre}</strong></div>
                <div class="text-muted small"><i class="bi bi-arrow-down"></i></div>
                <div><strong>${t.bodega_destino_nombre}</strong></div>
            </td>
            <td class="text-center">
                <span class="badge bg-info">${t.total_productos || 0}</span>
                ${t.total_unidades ? `<br><small class="text-muted">${t.total_unidades} uds</small>` : ''}
            </td>
            <td>
                <span class="badge bg-${getEstadoColor(t.estado)}">
                    ${getEstadoTexto(t.estado)}
                </span>
            </td>
            <td>
                <small>${formatFecha(t.fecha_solicitud)}</small>
            </td>
            <td>
                <small>${t.usuario_solicita_nombre || '-'}</small>
            </td>
            <td class="text-center">
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-primary" onclick="verDetalle(${t.id})" title="Ver detalle">
                        <i class="bi bi-eye"></i>
                    </button>
                    ${getAccionesBotones(t)}
                </div>
            </td>
        </tr>
    `).join('');
}

function getAccionesBotones(traslado) {
    let botones = '';

    // Editar (solo en borrador)
    if (traslado.estado === 'borrador') {
        botones += `
            <button class="btn btn-outline-warning" onclick="editarTraslado(${traslado.id})" title="Editar">
                <i class="bi bi-pencil"></i>
            </button>
        `;
    }

    // Aprobar (solo en pendiente_aprobacion)
    if (traslado.estado === 'pendiente_aprobacion') {
        botones += `
            <button class="btn btn-outline-success" onclick="aprobarTraslado(${traslado.id})" title="Aprobar">
                <i class="bi bi-check-circle"></i>
            </button>
        `;
    }

    // Enviar (solo en aprobado)
    if (traslado.estado === 'aprobado') {
        botones += `
            <button class="btn btn-outline-info" onclick="enviarTraslado(${traslado.id})" title="Enviar">
                <i class="bi bi-truck"></i>
            </button>
        `;
    }

    // Cancelar (excepto recibido y cancelado)
    if (!['recibido', 'parcialmente_recibido', 'cancelado'].includes(traslado.estado)) {
        botones += `
            <button class="btn btn-outline-danger" onclick="cancelarTraslado(${traslado.id})" title="Cancelar">
                <i class="bi bi-x-circle"></i>
            </button>
        `;
    }

    return botones;
}

// ==========================================
// NUEVO TRASLADO
// ==========================================

function nuevoTraslado() {
    trasladoEditando = null;
    productosSeleccionados = [];
    
    document.getElementById('modalTrasladoTitle').textContent = 'Nuevo Traslado';
    document.getElementById('trasladoForm').reset();
    document.getElementById('trasladoId').value = '';
    
    renderProductosSeleccionados();
    
    // Deshabilitar búsqueda de productos hasta seleccionar bodega origen
    document.getElementById('searchProducto').disabled = true;
    document.getElementById('btnBuscarProducto').disabled = true;
    
    const modal = new bootstrap.Modal(document.getElementById('modalTraslado'));
    modal.show();
}

// ==========================================
// PRODUCTOS
// ==========================================

async function onBodegaOrigenChange() {
    const bodegaId = document.getElementById('bodegaOrigen').value;
    
    if (!bodegaId) {
        document.getElementById('searchProducto').disabled = true;
        document.getElementById('btnBuscarProducto').disabled = true;
        productosDisponibles = [];
        return;
    }

    // Habilitar búsqueda
    document.getElementById('searchProducto').disabled = false;
    document.getElementById('btnBuscarProducto').disabled = false;

    // Cargar productos de esa bodega
    await loadProductosBodega(bodegaId);
}

async function loadProductosBodega(bodegaId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/bodegas/${bodegaId}/stock`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        
        if (result.success) {
            // Filtrar solo productos con stock disponible
            productosDisponibles = result.data.filter(p => p.stock_disponible > 0);
        }
    } catch (error) {
        console.error('Error loading productos:', error);
    }
}

function abrirModalProductos() {
    const bodegaId = document.getElementById('bodegaOrigen').value;
    
    if (!bodegaId) {
        Swal.fire({
            icon: 'warning',
            title: 'Bodega no seleccionada',
            text: 'Primero selecciona la bodega origen'
        });
        return;
    }

    renderListaProductos();
    
    const modal = new bootstrap.Modal(document.getElementById('modalProductos'));
    modal.show();
}

function renderListaProductos() {
    const container = document.getElementById('listaProductosModal');
    const searchTerm = document.getElementById('searchProductoModal').value.toLowerCase();
    
    let productos = productosDisponibles;
    
    if (searchTerm) {
        productos = productos.filter(p => 
            p.nombre.toLowerCase().includes(searchTerm) ||
            p.codigo?.toLowerCase().includes(searchTerm)
        );
    }

    if (productos.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4">
                <i class="bi bi-inbox fs-3 text-muted"></i>
                <p class="text-muted mt-2">No hay productos disponibles</p>
            </div>
        `;
        return;
    }

    container.innerHTML = productos.map(p => {
        const yaAgregado = productosSeleccionados.find(ps => ps.producto_id === p.producto_id);
        
        return `
            <div class="card mb-2">
                <div class="card-body py-2">
                    <div class="row align-items-center">
                        <div class="col-md-6">
                            <strong>${p.nombre}</strong><br>
                            <small class="text-muted">Código: ${p.codigo || 'N/A'}</small>
                        </div>
                        <div class="col-md-3 text-center">
                            <small class="text-muted">Disponible</small><br>
                            <span class="badge bg-success">${p.stock_disponible}</span>
                        </div>
                        <div class="col-md-3 text-end">
                            ${yaAgregado 
                                ? `<span class="badge bg-secondary">Agregado</span>`
                                : `<button class="btn btn-sm btn-primary" onclick="agregarProducto(${p.producto_id}, '${p.nombre.replace(/'/g, "\\'")}', ${p.stock_disponible})">
                                    <i class="bi bi-plus-circle"></i> Agregar
                                </button>`
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function agregarProducto(productoId, productoNombre, stockDisponible) {
    // Verificar si ya existe
    if (productosSeleccionados.find(p => p.producto_id === productoId)) {
        return;
    }

    Swal.fire({
        title: 'Cantidad a trasladar',
        html: `
            <div class="text-start">
                <p><strong>Producto:</strong> ${productoNombre}</p>
                <p><strong>Stock disponible:</strong> ${stockDisponible}</p>
                <label class="form-label mt-3">Cantidad:</label>
                <input type="number" id="swal-cantidad" class="form-control" min="1" max="${stockDisponible}" value="1">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Agregar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const cantidad = parseInt(document.getElementById('swal-cantidad').value);
            
            if (!cantidad || cantidad < 1) {
                Swal.showValidationMessage('Ingresa una cantidad válida');
                return false;
            }
            
            if (cantidad > stockDisponible) {
                Swal.showValidationMessage(`Cantidad máxima: ${stockDisponible}`);
                return false;
            }
            
            return cantidad;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            productosSeleccionados.push({
                producto_id: productoId,
                producto_nombre: productoNombre,
                cantidad_solicitada: result.value,
                stock_disponible: stockDisponible
            });
            
            renderProductosSeleccionados();
            renderListaProductos(); // Actualizar lista
            
            // Cerrar modal de productos
            bootstrap.Modal.getInstance(document.getElementById('modalProductos')).hide();
        }
    });
}

function renderProductosSeleccionados() {
    const container = document.getElementById('productosSeleccionados');
    
    if (productosSeleccionados.length === 0) {
        container.innerHTML = `
            <p class="text-muted text-center mb-0">
                <i class="bi bi-inbox fs-3"></i><br>
                No hay productos agregados
            </p>
        `;
        return;
    }

    container.innerHTML = productosSeleccionados.map((p, index) => `
        <div class="producto-item rounded p-3 mb-2">
            <div class="row align-items-center">
                <div class="col-md-5">
                    <strong>${p.producto_nombre}</strong><br>
                    <small class="text-muted">Disponible: ${p.stock_disponible}</small>
                </div>
                <div class="col-md-3">
                    <label class="form-label small mb-1">Cantidad</label>
                    <input type="number" class="form-control form-control-sm" 
                           value="${p.cantidad_solicitada}" 
                           min="1" max="${p.stock_disponible}"
                           onchange="updateCantidad(${index}, this.value)">
                </div>
                <div class="col-md-2 text-center">
                    <small class="text-muted">Solicitar</small><br>
                    <strong class="text-primary">${p.cantidad_solicitada}</strong>
                </div>
                <div class="col-md-2 text-end">
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminarProducto(${index})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function updateCantidad(index, nuevaCantidad) {
    const cantidad = parseInt(nuevaCantidad);
    const producto = productosSeleccionados[index];
    
    if (cantidad < 1 || cantidad > producto.stock_disponible) {
        renderProductosSeleccionados(); // Restaurar valor original
        return;
    }
    
    productosSeleccionados[index].cantidad_solicitada = cantidad;
}

function eliminarProducto(index) {
    productosSeleccionados.splice(index, 1);
    renderProductosSeleccionados();
}

// ==========================================
// GUARDAR TRASLADO
// ==========================================

async function guardarTraslado() {
    const bodegaOrigenId = parseInt(document.getElementById('bodegaOrigen').value);
    const bodegaDestinoId = parseInt(document.getElementById('bodegaDestino').value);
    const observaciones = document.getElementById('observaciones').value;

    // Validaciones
    if (!bodegaOrigenId) {
        Swal.fire('Error', 'Selecciona la bodega origen', 'error');
        return;
    }

    if (!bodegaDestinoId) {
        Swal.fire('Error', 'Selecciona la bodega destino', 'error');
        return;
    }

    if (bodegaOrigenId === bodegaDestinoId) {
        Swal.fire('Error', 'La bodega origen y destino deben ser diferentes', 'error');
        return;
    }

    if (productosSeleccionados.length === 0) {
        Swal.fire('Error', 'Agrega al menos un producto', 'error');
        return;
    }

    const traslado = {
        empresa_id: currentEmpresaId,
        bodega_origen_id: bodegaOrigenId,
        bodega_destino_id: bodegaDestinoId,
        observaciones: observaciones || null,
        destinatario_nombre: document.getElementById('destinatarioNombre').value || null,
        destinatario_documento: document.getElementById('destinatarioDocumento').value || null,
        destinatario_telefono: document.getElementById('destinatarioTelefono').value || null,
        destinatario_cargo: document.getElementById('destinatarioCargo').value || null,
        detalle: productosSeleccionados.map(p => ({
            producto_id: p.producto_id,
            cantidad_solicitada: p.cantidad_solicitada
        }))
    };

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/traslados`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(traslado)
        });

        const result = await response.json();

        if (result.success) {
            Swal.fire({
                icon: 'success',
                title: 'Traslado Creado',
                text: `Número: ${result.data.numero_traslado}`,
                timer: 2000
            });

            bootstrap.Modal.getInstance(document.getElementById('modalTraslado')).hide();
            await loadTraslados();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo crear el traslado: ' + error.message
        });
    }
}

// ==========================================
// ACCIONES
// ==========================================

async function verDetalle(trasladoId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/traslados/${trasladoId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            const t = result.data;
            
            document.getElementById('detalleNumero').textContent = t.numero_traslado;
            document.getElementById('modalDetalleContent').innerHTML = `
                <div class="row g-3">
                    <div class="col-md-6">
                        <h6 class="text-primary border-bottom pb-2">Información General</h6>
                        <table class="table table-sm">
                            <tr><th width="120">Estado:</th><td><span class="badge bg-${getEstadoColor(t.estado)}">${getEstadoTexto(t.estado)}</span></td></tr>
                            <tr><th>Creado:</th><td>${formatFecha(t.fecha_solicitud)}</td></tr>
                            ${t.fecha_aprobacion ? `<tr><th>Aprobado:</th><td>${formatFecha(t.fecha_aprobacion)}</td></tr>` : ''}
                            ${t.fecha_envio ? `<tr><th>Enviado:</th><td>${formatFecha(t.fecha_envio)}</td></tr>` : ''}
                            ${t.fecha_recepcion ? `<tr><th>Recibido:</th><td>${formatFecha(t.fecha_recepcion)}</td></tr>` : ''}
                            <tr><th>Solicitante:</th><td>${t.usuario_solicita_nombre}</td></tr>
                            ${t.usuario_aprueba_nombre ? `<tr><th>Aprobó:</th><td>${t.usuario_aprueba_nombre}</td></tr>` : ''}
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6 class="text-primary border-bottom pb-2">Ruta</h6>
                        <div class="border rounded p-3 bg-light">
                            <div class="mb-2">
                                <strong>Origen:</strong><br>
                                ${t.bodega_origen_nombre}
                            </div>
                            <div class="text-center my-2">
                                <i class="bi bi-arrow-down fs-3 text-primary"></i>
                            </div>
                            <div>
                                <strong>Destino:</strong><br>
                                ${t.bodega_destino_nombre}
                            </div>
                        </div>
                        ${t.destinatario_nombre ? `
                            <div class="mt-3">
                                <h6 class="border-bottom pb-2">Destinatario</h6>
                                <small>
                                    <strong>${t.destinatario_nombre}</strong><br>
                                    ${t.destinatario_cargo || ''}<br>
                                    ${t.destinatario_telefono || ''}
                                </small>
                            </div>
                        ` : ''}
                    </div>
                    <div class="col-12">
                        <h6 class="text-primary border-bottom pb-2">Productos (${t.detalle.length})</h6>
                        <div class="table-responsive">
                            <table class="table table-sm table-bordered">
                                <thead class="table-light">
                                    <tr>
                                        <th>Producto</th>
                                        <th width="100" class="text-center">Solicitado</th>
                                        <th width="100" class="text-center">Aprobado</th>
                                        <th width="100" class="text-center">Recibido</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${t.detalle.map(item => `
                                        <tr>
                                            <td>${item.producto_nombre}</td>
                                            <td class="text-center">${item.cantidad_solicitada}</td>
                                            <td class="text-center">${item.cantidad_aprobada || '-'}</td>
                                            <td class="text-center">${item.cantidad_recibida || '-'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    ${t.observaciones ? `
                        <div class="col-12">
                            <h6 class="border-bottom pb-2">Observaciones</h6>
                            <p class="text-muted">${t.observaciones}</p>
                        </div>
                    ` : ''}
                </div>
            `;

            const modal = new bootstrap.Modal(document.getElementById('modalDetalle'));
            modal.show();
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire('Error', 'No se pudo cargar el detalle', 'error');
    }
}

async function aprobarTraslado(trasladoId) {
    const result = await Swal.fire({
        title: '¿Aprobar traslado?',
        text: 'Puedes ajustar las cantidades aprobadas',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Aprobar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/traslados/${trasladoId}/aprobar`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            const result = await response.json();

            if (result.success) {
                Swal.fire('Aprobado', 'El traslado ha sido aprobado', 'success');
                await loadTraslados();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
}

async function enviarTraslado(trasladoId) {
    // Cargar usuarios (mensajeros)
    const token = localStorage.getItem('token');
    const usersResponse = await fetch(`${API_URL}/usuarios?empresa_id=${currentEmpresaId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const usersResult = await usersResponse.json();
    const usuarios = usersResult.success ? usersResult.data.filter(u => u.activo) : [];

    const { value: formValues } = await Swal.fire({
        title: 'Enviar Traslado',
        html: `
            <div class="text-start">
                <div class="mb-3">
                    <label class="form-label">Mensajero *</label>
                    <select id="swal-mensajero" class="form-select">
                        <option value="">Seleccionar...</option>
                        ${usuarios.map(u => `<option value="${u.id}">${u.nombre} ${u.apellido || ''}</option>`).join('')}
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">Observaciones</label>
                    <textarea id="swal-obs" class="form-control" rows="2"></textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Enviar',
        preConfirm: () => {
            const mensajeroId = document.getElementById('swal-mensajero').value;
            if (!mensajeroId) {
                Swal.showValidationMessage('Selecciona un mensajero');
                return false;
            }
            return {
                mensajero_id: parseInt(mensajeroId),
                observaciones: document.getElementById('swal-obs').value || null
            };
        }
    });

    if (formValues) {
        try {
            const response = await fetch(`${API_URL}/traslados/${trasladoId}/enviar`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formValues)
            });

            const result = await response.json();

            if (result.success) {
                Swal.fire('Enviado', 'El traslado está en tránsito', 'success');
                await loadTraslados();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
}

async function cancelarTraslado(trasladoId) {
    const { value: motivo } = await Swal.fire({
        title: '¿Cancelar traslado?',
        input: 'textarea',
        inputLabel: 'Motivo de cancelación',
        inputPlaceholder: 'Escribe el motivo...',
        showCancelButton: true,
        confirmButtonText: 'Cancelar Traslado',
        cancelButtonText: 'Volver',
        confirmButtonColor: '#dc3545'
    });

    if (motivo) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/traslados/${trasladoId}/cancelar`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ motivo_cancelacion: motivo })
            });

            const result = await response.json();

            if (result.success) {
                Swal.fire('Cancelado', 'El traslado ha sido cancelado', 'info');
                await loadTraslados();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
}

// ==========================================
// HELPERS
// ==========================================

function getEstadoColor(estado) {
    const colors = {
        'borrador': 'secondary',
        'pendiente_aprobacion': 'info',
        'aprobado': 'primary',
        'en_transito': 'warning',
        'parcialmente_recibido': 'warning',
        'recibido': 'success',
        'cancelado': 'danger'
    };
    return colors[estado] || 'secondary';
}

function getEstadoTexto(estado) {
    const textos = {
        'borrador': 'Borrador',
        'pendiente_aprobacion': 'Pendiente',
        'aprobado': 'Aprobado',
        'en_transito': 'En Tránsito',
        'parcialmente_recibido': 'Parcial',
        'recibido': 'Recibido',
        'cancelado': 'Cancelado'
    };
    return textos[estado] || estado;
}

function formatFecha(fecha) {
    if (!fecha) return '-';
    const date = new Date(fecha);
    return date.toLocaleString('es-CO', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function initializeEventListeners() {
    // Nuevo traslado
    document.getElementById('btnNuevoTraslado').addEventListener('click', nuevoTraslado);

    // Guardar traslado
    document.getElementById('btnGuardarTraslado').addEventListener('click', guardarTraslado);

    // Filtros
    document.getElementById('searchTraslado').addEventListener('input', renderTraslados);
    document.getElementById('filterEstado').addEventListener('change', renderTraslados);
    document.getElementById('filterBodega').addEventListener('change', renderTraslados);
    document.getElementById('filterFecha').addEventListener('change', renderTraslados);

    // Bodega origen change
    document.getElementById('bodegaOrigen').addEventListener('change', onBodegaOrigenChange);

    // Buscar productos
    document.getElementById('btnBuscarProducto').addEventListener('click', abrirModalProductos);
    
    // Search en modal productos
    const searchProductoModal = document.getElementById('searchProductoModal');
    if (searchProductoModal) {
        searchProductoModal.addEventListener('input', renderListaProductos);
    }

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    // Sidebar mobile
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const closeSidebar = document.getElementById('closeSidebar');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.add('active');
            overlay.classList.add('active');
        });
    }

    if (closeSidebar) {
        closeSidebar.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
}
