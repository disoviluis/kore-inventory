/**
 * MENSAJEROS DASHBOARD MODULE
 * Dashboard de control y supervisión de mensajeros y traslados
 */

const API_URL = 'http://18.191.181.99:3000/api';
let currentEmpresaId = null;
let allTraslados = [];
let mensajeros = {};

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
    await loadData();
    initializeEventListeners();
    
    // Auto-refresh every 60 seconds
    setInterval(loadData, 60000);
});

// ==========================================
// LOAD DATA
// ==========================================

async function loadUserInfo() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (usuario) {
        document.getElementById('userName').textContent = usuario.nombre;
        document.getElementById('userRole').textContent = usuario.tipo_usuario.replace('_', ' ').toUpperCase();
    }
}

async function loadData() {
    try {
        const token = localStorage.getItem('token');
        
        // Load all traslados
        const response = await fetch(`${API_URL}/traslados?empresa_id=${currentEmpresaId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        
        if (result.success) {
            allTraslados = result.data;
            processMensajeros();
            updateStats();
            renderMensajeros();
            renderEstadosTables();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error loading data:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar los datos: ' + error.message,
            toast: true,
            position: 'top-end',
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false
        });
    }
}

// ==========================================
// PROCESS DATA
// ==========================================

function processMensajeros() {
    mensajeros = {};
    
    allTraslados.forEach(traslado => {
        if (traslado.mensajero_id && traslado.mensajero_nombre) {
            if (!mensajeros[traslado.mensajero_id]) {
                mensajeros[traslado.mensajero_id] = {
                    id: traslado.mensajero_id,
                    nombre: traslado.mensajero_nombre,
                    email: traslado.mensajero_email,
                    telefono: traslado.mensajero_telefono,
                    traslados: [],
                    stats: {
                        en_transito: 0,
                        recibidos: 0,
                        total_productos: 0
                    }
                };
            }
            
            mensajeros[traslado.mensajero_id].traslados.push(traslado);
            
            if (traslado.estado === 'en_transito') {
                mensajeros[traslado.mensajero_id].stats.en_transito++;
            } else if (traslado.estado === 'recibido' || traslado.estado === 'parcialmente_recibido') {
                mensajeros[traslado.mensajero_id].stats.recibidos++;
            }
            
            mensajeros[traslado.mensajero_id].stats.total_productos += parseInt(traslado.total_productos || 0);
        }
    });
}

function updateStats() {
    const totalMensajeros = Object.keys(mensajeros).length;
    const enTransito = allTraslados.filter(t => t.estado === 'en_transito').length;
    const aprobados = allTraslados.filter(t => t.estado === 'aprobado').length;
    
    // Recibidos hoy
    const hoy = new Date().toISOString().split('T')[0];
    const recibidosHoy = allTraslados.filter(t => {
        if (!t.fecha_recepcion) return false;
        const fechaRecepcion = new Date(t.fecha_recepcion).toISOString().split('T')[0];
        return fechaRecepcion === hoy && (t.estado === 'recibido' || t.estado === 'parcialmente_recibido');
    }).length;

    document.getElementById('statTotalMensajeros').textContent = totalMensajeros;
    document.getElementById('statEnTransito').textContent = enTransito;
    document.getElementById('statEntregadosHoy').textContent = recibidosHoy;
    document.getElementById('statPendientes').textContent = aprobados;
}

// ==========================================
// RENDER - Por Mensajero
// ==========================================

function renderMensajeros() {
    const container = document.getElementById('mensajerosContainer');
    const mensajerosArray = Object.values(mensajeros);
    
    if (mensajerosArray.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="text-center py-5">
                    <i class="bi bi-person-x fs-1 text-muted"></i>
                    <h5 class="mt-3 text-muted">No hay mensajeros asignados</h5>
                    <p class="text-muted">Los mensajeros aparecerán aquí cuando se les asignen traslados</p>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = mensajerosArray.map(mensajero => `
        <div class="col-md-6 col-xl-4">
            <div class="card shadow-sm mensajero-card h-100">
                <div class="card-header bg-primary bg-opacity-10">
                    <div class="d-flex align-items-center">
                        <div class="avatar-icon bg-primary text-white me-3">
                            <i class="bi bi-person fs-4"></i>
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="mb-0 fw-bold">${mensajero.nombre}</h6>
                            <small class="text-muted">
                                <i class="bi bi-envelope me-1"></i>${mensajero.email || 'Sin email'}
                            </small>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <!-- Stats -->
                    <div class="row g-2 mb-3">
                        <div class="col-4 text-center">
                            <div class="border rounded p-2">
                                <div class="fs-4 fw-bold text-warning">${mensajero.stats.en_transito}</div>
                                <small class="text-muted">En ruta</small>
                            </div>
                        </div>
                        <div class="col-4 text-center">
                            <div class="border rounded p-2">
                                <div class="fs-4 fw-bold text-success">${mensajero.stats.recibidos}</div>
                                <small class="text-muted">Entregados</small>
                            </div>
                        </div>
                        <div class="col-4 text-center">
                            <div class="border rounded p-2">
                                <div class="fs-4 fw-bold text-info">${mensajero.stats.total_productos}</div>
                                <small class="text-muted">Productos</small>
                            </div>
                        </div>
                    </div>

                    <!-- Traslados List -->
                    <div class="traslado-timeline">
                        ${mensajero.traslados.slice(0, 5).map(traslado => `
                            <div class="timeline-item">
                                <div class="timeline-dot bg-white border-${getEstadoColor(traslado.estado)}"></div>
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <span class="badge bg-secondary">${traslado.numero_traslado}</span>
                                        <span class="badge bg-${getEstadoColor(traslado.estado)} ms-1 status-badge">
                                            ${getEstadoTexto(traslado.estado)}
                                        </span>
                                    </div>
                                    <small class="text-muted">${formatFecha(traslado.fecha_envio)}</small>
                                </div>
                                <div class="small">
                                    <i class="bi bi-arrow-right text-muted me-1"></i>
                                    <strong>${traslado.bodega_destino_nombre}</strong>
                                </div>
                                <div class="small text-muted">
                                    ${traslado.destinatario_nombre || 'Sin destinatario'}
                                </div>
                            </div>
                        `).join('')}
                        
                        ${mensajero.traslados.length > 5 ? `
                            <div class="text-center mt-2">
                                <small class="text-muted">+ ${mensajero.traslados.length - 5} más</small>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="card-footer bg-transparent">
                    <button class="btn btn-sm btn-outline-primary w-100" onclick="verDetallesMensajero(${mensajero.id}, '${mensajero.nombre}')">
                        <i class="bi bi-eye me-2"></i>Ver Todos los Traslados
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// ==========================================
// RENDER - Por Estado
// ==========================================

function renderEstadosTables() {
    // En Tránsito
    const enTransito = allTraslados.filter(t => t.estado === 'en_transito');
    renderTable('tableEnTransito', 'badgeEnTransito', enTransito, true);

    // Aprobados
    const aprobados = allTraslados.filter(t => t.estado === 'aprobado');
    renderTableAprobados('tableAprobados', 'badgeAprobados', aprobados);

    // Recibidos hoy
    const hoy = new Date().toISOString().split('T')[0];
    const recibidosHoy = allTraslados.filter(t => {
        if (!t.fecha_recepcion) return false;
        const fechaRecepcion = new Date(t.fecha_recepcion).toISOString().split('T')[0];
        return fechaRecepcion === hoy && (t.estado === 'recibido' || t.estado === 'parcialmente_recibido');
    });
    renderTableRecibidos('tableRecibidos', 'badgeRecibidos', recibidosHoy);
}

function renderTable(tableId, badgeId, traslados, showMensajero = false) {
    const tbody = document.getElementById(tableId);
    const badge = document.getElementById(badgeId);
    
    badge.textContent = traslados.length;

    if (traslados.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="${showMensajero ? 7 : 6}" class="text-center text-muted py-4">
                <i class="bi bi-inbox fs-3"></i>
                <p class="mt-2">No hay traslados en este estado</p>
            </td></tr>
        `;
        return;
    }

    tbody.innerHTML = traslados.map(t => `
        <tr>
            <td><span class="badge bg-secondary">${t.numero_traslado}</span></td>
            ${showMensajero ? `
                <td>
                    ${t.mensajero_nombre || '<span class="text-muted">Sin asignar</span>'}
                    ${t.mensajero_telefono ? `<br><small class="text-muted"><i class="bi bi-phone me-1"></i>${t.mensajero_telefono}</small>` : ''}
                </td>
            ` : ''}
            <td>
                <div><strong>${t.bodega_origen_nombre}</strong></div>
                <div class="text-muted"><i class="bi bi-arrow-down"></i></div>
                <div><strong>${t.bodega_destino_nombre}</strong></div>
            </td>
            <td>
                <div>${t.destinatario_nombre || '-'}</div>
                ${t.destinatario_telefono ? `<small class="text-muted">${t.destinatario_telefono}</small>` : ''}
            </td>
            <td class="text-center">
                <span class="badge bg-info">${t.total_productos || 0}</span><br>
                <small class="text-muted">${t.total_unidades || 0} uds</small>
            </td>
            <td>
                <small>${formatFecha(t.fecha_envio)}</small>
            </td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary" onclick="verDetalleTraslado(${t.id})">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function renderTableAprobados(tableId, badgeId, traslados) {
    const tbody = document.getElementById(tableId);
    const badge = document.getElementById(badgeId);
    
    badge.textContent = traslados.length;

    if (traslados.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6" class="text-center text-muted py-4">
                <i class="bi bi-inbox fs-3"></i>
                <p class="mt-2">No hay traslados aprobados pendientes de envío</p>
            </td></tr>
        `;
        return;
    }

    tbody.innerHTML = traslados.map(t => `
        <tr>
            <td><span class="badge bg-secondary">${t.numero_traslado}</span></td>
            <td>
                <div><strong>${t.bodega_origen_nombre}</strong></div>
                <div class="text-muted"><i class="bi bi-arrow-down"></i></div>
                <div><strong>${t.bodega_destino_nombre}</strong></div>
            </td>
            <td>
                <div>${t.destinatario_nombre || '-'}</div>
                ${t.destinatario_telefono ? `<small class="text-muted">${t.destinatario_telefono}</small>` : ''}
            </td>
            <td class="text-center">
                <span class="badge bg-info">${t.total_productos || 0}</span><br>
                <small class="text-muted">${t.total_unidades || 0} uds</small>
            </td>
            <td>
                <small>${formatFecha(t.fecha_aprobacion)}</small>
            </td>
            <td class="text-center">
                <button class="btn btn-sm btn-primary" onclick="enviarTraslado(${t.id})">
                    <i class="bi bi-truck me-1"></i>Enviar
                </button>
            </td>
        </tr>
    `).join('');
}

function renderTableRecibidos(tableId, badgeId, traslados) {
    const tbody = document.getElementById(tableId);
    const badge = document.getElementById(badgeId);
    
    badge.textContent = traslados.length;

    if (traslados.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6" class="text-center text-muted py-4">
                <i class="bi bi-inbox fs-3"></i>
                <p class="mt-2">No hay traslados recibidos hoy</p>
            </td></tr>
        `;
        return;
    }

    tbody.innerHTML = traslados.map(t => `
        <tr>
            <td><span class="badge bg-secondary">${t.numero_traslado}</span></td>
            <td>
                ${t.mensajero_nombre || '<span class="text-muted">Sin mensajero</span>'}
            </td>
            <td>
                <div><strong>${t.bodega_origen_nombre}</strong></div>
                <div class="text-muted"><i class="bi bi-arrow-down"></i></div>
                <div><strong>${t.bodega_destino_nombre}</strong></div>
            </td>
            <td>
                <div>${t.destinatario_nombre || '-'}</div>
            </td>
            <td>
                <small>${formatFecha(t.fecha_recepcion)}</small>
            </td>
            <td class="text-center">
                ${t.firma_recepcion ? `
                    <button class="btn btn-sm btn-success" onclick="verFirma(${t.id})">
                        <i class="bi bi-pen"></i> Ver
                    </button>
                ` : '<span class="text-muted">Sin firma</span>'}
            </td>
        </tr>
    `).join('');
}

// ==========================================
// ACTIONS
// ==========================================

async function verDetalleTraslado(trasladoId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/traslados/${trasladoId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            const traslado = result.data;
            
            document.getElementById('detalleNumero').textContent = traslado.numero_traslado;
            document.getElementById('modalDetalleContent').innerHTML = `
                <div class="row g-3">
                    <div class="col-md-6">
                        <h6 class="text-muted mb-2">Información General</h6>
                        <table class="table table-sm">
                            <tr><th>Estado:</th><td><span class="badge bg-${getEstadoColor(traslado.estado)}">${getEstadoTexto(traslado.estado)}</span></td></tr>
                            <tr><th>Solicitud:</th><td>${formatFecha(traslado.fecha_solicitud)}</td></tr>
                            ${traslado.fecha_envio ? `<tr><th>Enviado:</th><td>${formatFecha(traslado.fecha_envio)}</td></tr>` : ''}
                            ${traslado.fecha_recepcion ? `<tr><th>Recibido:</th><td>${formatFecha(traslado.fecha_recepcion)}</td></tr>` : ''}
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6 class="text-muted mb-2">Destinatario</h6>
                        <table class="table table-sm">
                            <tr><th>Nombre:</th><td>${traslado.destinatario_nombre || '-'}</td></tr>
                            <tr><th>Documento:</th><td>${traslado.destinatario_documento || '-'}</td></tr>
                            <tr><th>Teléfono:</th><td>${traslado.destinatario_telefono || '-'}</td></tr>
                            <tr><th>Cargo:</th><td>${traslado.destinatario_cargo || '-'}</td></tr>
                        </table>
                    </div>
                    <div class="col-12">
                        <h6 class="text-muted mb-2">Ruta</h6>
                        <div class="border rounded p-3 bg-light">
                            <div class="row">
                                <div class="col-md-5">
                                    <strong>Origen:</strong> ${traslado.bodega_origen_nombre}<br>
                                    <small class="text-muted">${traslado.bodega_origen_direccion || ''}</small>
                                </div>
                                <div class="col-md-2 text-center">
                                    <i class="bi bi-arrow-right fs-3 text-primary"></i>
                                </div>
                                <div class="col-md-5">
                                    <strong>Destino:</strong> ${traslado.bodega_destino_nombre}<br>
                                    <small class="text-muted">${traslado.bodega_destino_direccion || ''}</small>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-12">
                        <h6 class="text-muted mb-2">Productos (${traslado.detalle.length})</h6>
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
                                    ${traslado.detalle.map(item => `
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
                </div>
            `;

            const modal = new bootstrap.Modal(document.getElementById('modalDetalleTraslado'));
            modal.show();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el detalle: ' + error.message
        });
    }
}

async function verFirma(trasladoId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/traslados/${trasladoId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success && result.data.firma_recepcion) {
            const traslado = result.data;
            
            document.getElementById('firmaImagen').src = traslado.firma_recepcion;
            document.getElementById('firmaInfo').innerHTML = `
                <div class="text-start">
                    <p class="mb-1"><strong>Firmado por:</strong> ${traslado.destinatario_nombre}</p>
                    <p class="mb-1"><strong>Fecha:</strong> ${formatFecha(traslado.fecha_firma)}</p>
                    ${traslado.gps_latitud ? `<p class="mb-1"><strong>GPS:</strong> ${traslado.gps_latitud}, ${traslado.gps_longitud}</p>` : ''}
                    ${traslado.ip_recepcion ? `<p class="mb-1"><strong>IP:</strong> ${traslado.ip_recepcion}</p>` : ''}
                </div>
            `;

            const modal = new bootstrap.Modal(document.getElementById('modalFirma'));
            modal.show();
        } else {
            throw new Error('No hay firma disponible');
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la firma: ' + error.message
        });
    }
}

async function enviarTraslado(trasladoId) {
    try {
        const token = localStorage.getItem('token');
        
        // Cargar lista de usuarios (mensajeros)
        const usersResponse = await fetch(`${API_URL}/usuarios?empresa_id=${currentEmpresaId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const usersResult = await usersResponse.json();
        
        if (!usersResult.success) {
            throw new Error('No se pudieron cargar los mensajeros');
        }

        // Filtrar solo usuarios activos
        const usuariosActivos = usersResult.data.filter(u => u.activo);
        
        const { value: formValues } = await Swal.fire({
            title: 'Enviar Traslado',
            html: `
                <div class="text-start">
                    <div class="mb-3">
                        <label class="form-label">Seleccionar Mensajero *</label>
                        <select id="swal-mensajero" class="form-select">
                            <option value="">-- Seleccionar --</option>
                            ${usuariosActivos.map(u => `
                                <option value="${u.id}">${u.nombre} ${u.apellido} - ${u.email}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Observaciones</label>
                        <textarea id="swal-observaciones" class="form-control" rows="3" placeholder="Observaciones del envío"></textarea>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Enviar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const mensajeroId = document.getElementById('swal-mensajero').value;
                const observaciones = document.getElementById('swal-observaciones').value;
                
                if (!mensajeroId) {
                    Swal.showValidationMessage('Debe seleccionar un mensajero');
                    return false;
                }
                
                return { mensajeroId, observaciones };
            }
        });

        if (formValues) {
            const response = await fetch(`${API_URL}/traslados/${trasladoId}/enviar`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mensajero_id: parseInt(formValues.mensajeroId),
                    observaciones: formValues.observaciones || null
                })
            });

            const result = await response.json();

            if (result.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Traslado Enviado',
                    text: 'El traslado ha sido asignado al mensajero',
                    timer: 2000
                });
                await loadData();
            } else {
                throw new Error(result.message);
            }
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo enviar el traslado: ' + error.message
        });
    }
}

function verDetallesMensajero(mensajeroId, mensajeroNombre) {
    const traslados = mensajeros[mensajeroId].traslados;
    
    Swal.fire({
        title: `Traslados de ${mensajeroNombre}`,
        html: `
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Número</th>
                            <th>Destino</th>
                            <th>Estado</th>
                            <th>Fecha</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${traslados.map(t => `
                            <tr>
                                <td>${t.numero_traslado}</td>
                                <td>${t.bodega_destino_nombre}</td>
                                <td><span class="badge bg-${getEstadoColor(t.estado)}">${getEstadoTexto(t.estado)}</span></td>
                                <td>${formatFecha(t.fecha_envio)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `,
        width: '800px',
        showCloseButton: true
    });
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
    // Refresh button
    document.getElementById('btnRefresh').addEventListener('click', () => {
        loadData();
        Swal.fire({
            icon: 'success',
            title: 'Actualizado',
            toast: true,
            position: 'top-end',
            timer: 1500,
            timerProgressBar: true,
            showConfirmButton: false
        });
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });
}
