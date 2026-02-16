/**
 * ========================================
 * SUPER ADMIN - GESTIÓN DE EMPRESAS
 * ========================================
 */

// Reutilizar API_URL del dashboard.js
// const API_URL ya está definido en dashboard.js
let currentUserSuperAdmin = null;
let empresasSuperAdmin = [];
let planesSuperAdmin = [];

// ========================================
// INICIALIZACIÓN (llamada desde dashboard.js)
// ========================================

/**
 * Cargar dashboard de Super Admin
 * Llamada desde dashboard.js cuando se activa el módulo
 */
function cargarDashboardSuperAdmin() {
    const token = localStorage.getItem('token');
    const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
    
    if (!usuario || usuario.tipo_usuario !== 'super_admin') {
        mostrarAlertaSuperAdmin('No tienes permisos para acceder a esta sección', 'danger');
        return;
    }
    
    currentUserSuperAdmin = usuario;
    
    // Cargar métricas del dashboard
    fetch(`${API_URL}/super-admin/dashboard`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            actualizarMetricasSuperAdmin(data.data);
        }
    })
    .catch(error => {
        console.error('Error al cargar dashboard Super Admin:', error);
    });
    
    // Inicializar event listeners solo una vez
    inicializarEventListenersSuperAdmin();
}

/**
 * Cargar listado de empresas
 * Llamada desde dashboard.js cuando se activa el módulo
 */
function cargarEmpresasSuperAdmin() {
    const token = localStorage.getItem('token');
    const searchEmpresas = document.getElementById('searchEmpresas');
    const filterEstado = document.getElementById('filterEstado');
    const filterPlan = document.getElementById('filterPlan');
    
    const search = searchEmpresas ? searchEmpresas.value : '';
    const estado = filterEstado ? filterEstado.value : '';
    const planId = filterPlan ? filterPlan.value : '';
    
    let url = `${API_URL}/super-admin/empresas?limit=100`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (estado) url += `&estado=${estado}`;
    if (planId) url += `&plan_id=${planId}`;
    
    fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            empresasSuperAdmin = data.data;
            renderizarTablaEmpresasSuperAdmin(empresasSuperAdmin);
        }
    })
    .catch(error => {
        console.error('Error al cargar empresas:', error);
        mostrarAlertaSuperAdmin('Error al cargar empresas', 'danger');
    });
}

/**
 * Inicializar event listeners (solo una vez)
 */
let eventListenersInicializados = false;
function inicializarEventListenersSuperAdmin() {
    if (eventListenersInicializados) return;
    eventListenersInicializados = true;
    
    // Búsqueda
    const searchEmpresas = document.getElementById('searchEmpresas');
    if (searchEmpresas) {
        searchEmpresas.addEventListener('input', debounce(() => cargarEmpresasSuperAdmin(), 500));
    }
    
    // Filtros
    const filterEstado = document.getElementById('filterEstado');
    const filterPlan = document.getElementById('filterPlan');
    if (filterEstado) filterEstado.addEventListener('change', cargarEmpresasSuperAdmin);
    if (filterPlan) filterPlan.addEventListener('change', cargarEmpresasSuperAdmin);
}

// ========================================
// MÉTRICAS
// ========================================
function actualizarMetricasSuperAdmin(metricas) {
    // Métricas principales
    if (document.getElementById('metricEmpresasActivas')) {
        document.getElementById('metricEmpresasActivas').textContent = metricas.empresas?.activas || 0;
    }
    if (document.getElementById('metricUsuariosActivos')) {
        document.getElementById('metricUsuariosActivos').textContent = metricas.usuarios?.activos || 0;
    }
    if (document.getElementById('metricMRR')) {
        document.getElementById('metricMRR').textContent = `$${formatearNumero(metricas.ingresos?.mrr || 0)}`;
    }
    if (document.getElementById('metricLicenciasPorVencer')) {
        document.getElementById('metricLicenciasPorVencer').textContent = metricas.licencias?.por_vencer || 0;
    }
    
    // Estado de empresas
    if (document.getElementById('empresasActivas')) {
        document.getElementById('empresasActivas').textContent = metricas.empresas?.activas || 0;
    }
    if (document.getElementById('empresasTrial')) {
        document.getElementById('empresasTrial').textContent = metricas.empresas?.en_trial || 0;
    }
    if (document.getElementById('empresasSuspendidas')) {
        document.getElementById('empresasSuspendidas').textContent = metricas.empresas?.suspendidas || 0;
    }
    if (document.getElementById('empresasCanceladas')) {
        document.getElementById('empresasCanceladas').textContent = metricas.empresas?.canceladas || 0;
    }
}

// ========================================
// CRUD EMPRESAS - RENDERIZADO
// ========================================
function renderizarTablaEmpresasSuperAdmin(empresas) {
    const tbody = document.getElementById('tablaEmpresas');
    
    if (!tbody) return;
    
    if (empresas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    No se encontraron empresas
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = empresas.map(emp => `
        <tr>
            <td>
                <div class="fw-bold">${emp.nombre}</div>
                <small class="text-muted">NIT: ${emp.nit}</small><br>
                <small class="text-muted">${emp.email}</small>
            </td>
            <td>
                <span class="badge bg-${getPlanColor(emp.plan_nombre)}">
                    ${emp.plan_nombre || 'Sin plan'}
                </span>
            </td>
            <td>
                <span class="badge bg-${getEstadoColor(emp.estado)}">
                    ${getEstadoTexto(emp.estado)}
                </span>
            </td>
            <td>${emp.total_usuarios || 0}</td>
            <td>${emp.total_productos || 0}</td>
            <td>
                <small>${formatearFecha(emp.created_at)}</small>
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="verEmpresa(${emp.id})" title="Ver">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-info" onclick="editarEmpresa(${emp.id})" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-${emp.estado === 'activa' || emp.estado === 'activo' ? 'warning' : 'success'}" 
                            onclick="cambiarEstadoEmpresa(${emp.id}, '${emp.estado === 'activa' || emp.estado === 'activo' ? 'suspendida' : 'activa'}')"
                            title="${emp.estado === 'activa' || emp.estado === 'activo' ? 'Suspender' : 'Activar'}">
                        <i class="bi bi-${emp.estado === 'activa' || emp.estado === 'activo' ? 'pause' : 'play'}-circle"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ========================================
// MODAL NUEVA/EDITAR EMPRESA
// ========================================
function abrirModalCrearEmpresa() {
    document.getElementById('empresaModalTitle').textContent = 'Nueva Empresa';
    document.getElementById('empresaId').value = '';
    document.getElementById('empresaForm').reset();
    
    const modal = new bootstrap.Modal(document.getElementById('empresaModal'));
    modal.show();
}

async function verEmpresa(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/super-admin/empresas/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error al cargar empresa');
        
        const data = await response.json();
        const empresa = data.data;
        
        // Crear modal con detalles
        const modalHtml = `
            <div class="modal fade" id="modalDetalleEmpresa" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Detalles de Empresa</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="fw-bold">Nombre:</label>
                                    <p>${empresa.nombre}</p>
                                </div>
                                <div class="col-md-6">
                                    <label class="fw-bold">NIT:</label>
                                    <p>${empresa.nit || 'N/A'}</p>
                                </div>
                                <div class="col-md-6">
                                    <label class="fw-bold">Email:</label>
                                    <p>${empresa.email}</p>
                                </div>
                                <div class="col-md-6">
                                    <label class="fw-bold">Teléfono:</label>
                                    <p>${empresa.telefono || 'N/A'}</p>
                                </div>
                                <div class="col-md-12">
                                    <label class="fw-bold">Dirección:</label>
                                    <p>${empresa.direccion || 'N/A'}, ${empresa.ciudad || 'N/A'}, ${empresa.pais || 'N/A'}</p>
                                </div>
                                <div class="col-md-6">
                                    <label class="fw-bold">Plan:</label>
                                    <p><span class="badge bg-${getPlanColor(empresa.plan_nombre)}">${empresa.plan_nombre || 'Sin plan'}</span></p>
                                </div>
                                <div class="col-md-6">
                                    <label class="fw-bold">Estado:</label>
                                    <p><span class="badge bg-${getEstadoColor(empresa.estado)}">${getEstadoTexto(empresa.estado)}</span></p>
                                </div>
                                <div class="col-md-4">
                                    <label class="fw-bold">Usuarios:</label>
                                    <p>${empresa.usuarios?.length || 0}</p>
                                </div>
                                <div class="col-md-4">
                                    <label class="fw-bold">Licencia:</label>
                                    <p>${empresa.licencia_estado || 'N/A'}</p>
                                </div>
                                <div class="col-md-4">
                                    <label class="fw-bold">Días restantes:</label>
                                    <p>${empresa.dias_restantes !== null ? empresa.dias_restantes : 'N/A'} días</p>
                                </div>
                                ${empresa.usuarios && empresa.usuarios.length > 0 ? `
                                <div class="col-12 mt-3">
                                    <label class="fw-bold">Usuarios asignados:</label>
                                    <ul class="list-group">
                                        ${empresa.usuarios.map(u => `
                                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                                ${u.nombre} ${u.apellido} (${u.email})
                                                <span class="badge bg-${u.activo ? 'success' : 'secondary'}">${u.activo ? 'Activo' : 'Inactivo'}</span>
                                            </li>
                                        `).join('')}
                                    </ul>
                                </div>
                                ` : ''}
                                <div class="col-12">
                                    <label class="fw-bold">Fecha de registro:</label>
                                    <p>${formatearFecha(empresa.created_at)}</p>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                            <button type="button" class="btn btn-primary" onclick="editarEmpresa(${id})" data-bs-dismiss="modal">Editar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remover modal anterior si existe
        const oldModal = document.getElementById('modalDetalleEmpresa');
        if (oldModal) oldModal.remove();
        
        // Agregar modal al body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('modalDetalleEmpresa'));
        modal.show();
        
    } catch (error) {
        console.error('Error:', error);
        mostrarAlertaSuperAdmin('Error al cargar detalles de la empresa', 'danger');
    }
}

async function editarEmpresa(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/super-admin/empresas/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error al cargar empresa');
        
        const data = await response.json();
        const empresa = data.data;
        
        document.getElementById('empresaModalTitle').textContent = 'Editar Empresa';
        document.getElementById('empresaId').value = empresa.id;
        document.getElementById('empresaNombre').value = empresa.nombre;
        document.getElementById('empresaRazonSocial').value = empresa.razon_social || '';
        document.getElementById('empresaNit').value = empresa.nit || '';
        document.getElementById('empresaTipoContribuyente').value = empresa.tipo_contribuyente || 'persona_juridica';
        document.getElementById('empresaEmail').value = empresa.email;
        document.getElementById('empresaTelefono').value = empresa.telefono || '';
        document.getElementById('empresaDireccion').value = empresa.direccion || '';
        document.getElementById('empresaCiudad').value = empresa.ciudad || '';
        document.getElementById('empresaPais').value = empresa.pais || 'Colombia';
        document.getElementById('empresaPlan').value = empresa.plan_id || '';
        document.getElementById('empresaEstado').value = empresa.estado || 'trial';
        document.getElementById('empresaFechaInicioTrial').value = empresa.fecha_inicio_trial || '';
        document.getElementById('empresaFechaFinTrial').value = empresa.fecha_fin_trial || '';
        document.getElementById('empresaRegimenTributario').value = empresa.regimen_tributario || 'simplificado';
        document.getElementById('empresaMoneda').value = empresa.moneda || 'COP';
        document.getElementById('empresaZonaHoraria').value = empresa.zona_horaria || 'America/Bogota';
        
        const modal = new bootstrap.Modal(document.getElementById('empresaModal'));
        modal.show();
    } catch (error) {
        console.error('Error:', error);
        mostrarAlertaSuperAdmin('Error al cargar datos de la empresa', 'danger');
    }
}

async function guardarEmpresa() {
    try {
        const empresaId = document.getElementById('empresaId').value;
        const esEdicion = empresaId !== '';
        
        const empresaData = {
            nombre: document.getElementById('empresaNombre').value.trim(),
            razon_social: document.getElementById('empresaRazonSocial').value.trim() || null,
            nit: document.getElementById('empresaNit').value.trim() || null,
            tipo_contribuyente: document.getElementById('empresaTipoContribuyente').value,
            email: document.getElementById('empresaEmail').value.trim(),
            telefono: document.getElementById('empresaTelefono').value.trim() || null,
            direccion: document.getElementById('empresaDireccion').value.trim() || null,
            ciudad: document.getElementById('empresaCiudad').value.trim() || null,
            pais: document.getElementById('empresaPais').value,
            plan_id: parseInt(document.getElementById('empresaPlan').value) || null,
            estado: document.getElementById('empresaEstado').value || 'trial',
            fecha_inicio_trial: document.getElementById('empresaFechaInicioTrial').value || null,
            fecha_fin_trial: document.getElementById('empresaFechaFinTrial').value || null,
            regimen_tributario: document.getElementById('empresaRegimenTributario').value,
            moneda: document.getElementById('empresaMoneda').value,
            zona_horaria: document.getElementById('empresaZonaHoraria').value,
            idioma: 'es'
        };
        
        // Validaciones
        if (!empresaData.nombre || !empresaData.email) {
            mostrarAlertaSuperAdmin('Por favor completa todos los campos obligatorios', 'warning');
            return;
        }
        
        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(empresaData.email)) {
            mostrarAlertaSuperAdmin('Por favor ingresa un email válido', 'warning');
            return;
        }
        
        const token = localStorage.getItem('token');
        const url = esEdicion 
            ? `${API_URL}/super-admin/empresas/${empresaId}`
            : `${API_URL}/super-admin/empresas`;
        
        const response = await fetch(url, {
            method: esEdicion ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(empresaData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al guardar empresa');
        }
        
        const data = await response.json();
        
        mostrarAlertaSuperAdmin(
            esEdicion ? 'Empresa actualizada exitosamente' : 'Empresa creada exitosamente',
            'success'
        );
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('empresaModal'));
        modal.hide();
        
        cargarEmpresasSuperAdmin();
        cargarDashboardSuperAdmin();
    } catch (error) {
        console.error('Error:', error);
        mostrarAlertaSuperAdmin(error.message || 'Error al guardar empresa', 'danger');
    }
}

async function cambiarEstadoEmpresa(id, nuevoEstado) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/super-admin/empresas/${id}/estado`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ estado: nuevoEstado })
        });
        
        if (!response.ok) throw new Error('Error al cambiar estado');
        
        mostrarAlertaSuperAdmin('Estado actualizado exitosamente', 'success');
        cargarEmpresasSuperAdmin();
        cargarDashboardSuperAdmin();
    } catch (error) {
        console.error('Error:', error);
        mostrarAlertaSuperAdmin('Error al cambiar estado de la empresa', 'danger');
    }
}

function confirmarEliminarEmpresa(id) {
    if (confirm('¿Estás seguro de eliminar esta empresa? Esta acción no se puede deshacer.')) {
        eliminarEmpresa(id);
    }
}

async function eliminarEmpresa(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/super-admin/empresas/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error al eliminar empresa');
        
        mostrarAlertaSuperAdmin('Empresa eliminada exitosamente', 'success');
        cargarEmpresasSuperAdmin();
        cargarDashboardSuperAdmin();
    } catch (error) {
        console.error('Error:', error);
        mostrarAlertaSuperAdmin('Error al eliminar empresa', 'danger');
    }
}

// ========================================
// UTILIDADES
// ========================================
function getPlanColor(plan) {
    const colores = {
        'Básico': 'info',
        'Profesional': 'primary',
        'Enterprise': 'success'
    };
    return colores[plan] || 'secondary';
}

function getEstadoColor(estado) {
    const colores = {
        'activo': 'success',
        'activa': 'success',
        'inactivo': 'secondary',
        'suspendido': 'warning',
        'suspendida': 'warning',
        'trial': 'info',
        'cancelada': 'danger'
    };
    return colores[estado] || 'secondary';
}

function getEstadoTexto(estado) {
    const textos = {
        'activo': 'Activo',
        'activa': 'Activo',
        'inactivo': 'Inactivo',
        'suspendido': 'Suspendido',
        'suspendida': 'Suspendido',
        'trial': 'Trial',
        'cancelada': 'Cancelado'
    };
    return textos[estado] || estado;
}

function formatearNumero(numero) {
    return new Intl.NumberFormat('es-CO').format(numero);
}

function formatearFecha(fecha) {
    if (!fecha) return '-';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-CO', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function mostrarAlertaSuperAdmin(mensaje, tipo = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${tipo} alert-dismissible fade show`;
    alert.innerHTML = `
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    alertContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
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
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = 'login.html';
}
