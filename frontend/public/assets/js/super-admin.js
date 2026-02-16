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
    
    // Manejar navegación por hash
    manejarNavegacionSuperAdmin();
    window.addEventListener('hashchange', manejarNavegacionSuperAdmin);
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
    
    // Event listeners para usuarios
    const searchUsuarios = document.getElementById('searchUsuarios');
    if (searchUsuarios) {
        searchUsuarios.addEventListener('input', debounce(() => cargarUsuarios(), 500));
    }
    
    const filterTipoUsuario = document.getElementById('filterTipoUsuario');
    const filterActivoUsuario = document.getElementById('filterActivoUsuario');
    if (filterTipoUsuario) filterTipoUsuario.addEventListener('change', cargarUsuarios);
    if (filterActivoUsuario) filterActivoUsuario.addEventListener('change', cargarUsuarios);
}

/**
 * Manejar navegación entre secciones
 */
function manejarNavegacionSuperAdmin() {
    const hash = window.location.hash || '#dashboard';
    
    // Ocultar todas las secciones
    const secciones = ['dashboard', 'empresas', 'usuarios', 'planes', 'actividad'];
    secciones.forEach(seccion => {
        const container = document.getElementById(`section-${seccion}-container`);
        if (container) {
            container.classList.add('d-none');
        }
    });
    
    // También manejar las métricas principales y sección empresas que no tienen -container
    const metricasPrincipales = document.querySelectorAll('.row.g-4.mb-4')[0]; // Primera fila de métricas
    if (metricasPrincipales && !hash.includes('empresas') && !hash.includes('dashboard')) {
        metricasPrincipales.classList.add('d-none');
    } else if (metricasPrincipales) {
        metricasPrincipales.classList.remove('d-none');
    }
    
    // Activar enlaces del navbar
    document.querySelectorAll('.navbar-nav .nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === hash) {
            link.classList.add('active');
        }
    });
    
    // Mostrar sección correspondiente y cargar datos
    switch(hash) {
        case '#dashboard':
            cargarDashboardSuperAdmin();
            cargarEmpresasSuperAdmin();
            break;
            
        case '#empresas':
            const metricasRow = document.querySelectorAll('.row.g-4.mb-4')[1]; // Segunda fila (estado empresas)
            if (metricasRow) metricasRow.classList.remove('d-none');
            cargarEmpresasSuperAdmin();
            break;
            
        case '#usuarios':
            const usuariosContainer = document.getElementById('section-usuarios-container');
            if (usuariosContainer) {
                usuariosContainer.classList.remove('d-none');
                cargarUsuarios();
            }
            break;
            
        case '#planes':
            const planesContainer = document.getElementById('section-planes-container');
            if (planesContainer) {
                planesContainer.classList.remove('d-none');
                cargarPlanes();
            }
            break;
            
        case '#actividad':
            // TODO: Implementar vista de actividad
            mostrarAlertaSuperAdmin('Vista de actividad en desarrollo', 'info');
            break;
    }
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

// ========================================
// GESTIÓN DE USUARIOS
// ========================================

async function cargarUsuarios() {
    try {
        const token = localStorage.getItem('token');
        const search = document.getElementById('searchUsuarios')?.value || '';
        const tipo = document.getElementById('filterTipoUsuario')?.value || '';
        const activo = document.getElementById('filterActivoUsuario')?.value || '';
        
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (tipo) params.append('tipo_usuario', tipo);
        if (activo) params.append('activo', activo);
        
        const response = await fetch(`${API_URL}/super-admin/usuarios?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error al cargar usuarios');
        
        const data = await response.json();
        renderizarTablaUsuarios(data.data);
    } catch (error) {
        console.error('Error:', error);
        mostrarAlertaSuperAdmin('Error al cargar usuarios', 'danger');
    }
}

function renderizarTablaUsuarios(usuarios) {
    const tbody = document.getElementById('tablaUsuarios');
    
    if (!tbody) return;
    
    if (usuarios.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    No se encontraron usuarios
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = usuarios.map(usr => `
        <tr>
            <td>
                <div class="fw-bold">${usr.nombre} ${usr.apellido}</div>
                <small class="text-muted">ID: ${usr.id}</small>
            </td>
            <td>${usr.email}</td>
            <td>
                <span class="badge bg-${getTipoUsuarioColor(usr.tipo_usuario)}">
                    ${getTipoUsuarioTexto(usr.tipo_usuario)}
                </span>
            </td>
            <td>
                <small>${usr.empresas || 'Sin asignar'}</small>
            </td>
            <td>
                <span class="badge bg-${usr.activo ? 'success' : 'secondary'}">
                    ${usr.activo ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>
                <small>${usr.ultimo_login ? formatearFecha(usr.ultimo_login) : 'Nunca'}</small>
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="verUsuario(${usr.id})" title="Ver">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-info" onclick="editarUsuario(${usr.id})" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="confirmarEliminarUsuario(${usr.id})" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function abrirModalCrearUsuario() {
    document.getElementById('tituloModalUsuario').textContent = 'Nuevo Usuario';
    document.getElementById('usuarioId').value = '';
    document.getElementById('formUsuario').reset();
    
    // Cargar empresas disponibles
    cargarEmpresasParaUsuario();
    
    const modal = new bootstrap.Modal(document.getElementById('modalCrearUsuario'));
    modal.show();
}

async function cargarEmpresasParaUsuario() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/super-admin/empresas?limit=1000`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error al cargar empresas');
        
        const data = await response.json();
        const select = document.getElementById('usuarioEmpresas');
        
        select.innerHTML = data.data.map(emp => 
            `<option value="${emp.id}">${emp.nombre}</option>`
        ).join('');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

async function verUsuario(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/super-admin/usuarios/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error al cargar usuario');
        
        const data = await response.json();
        const usuario = data.data;
        
        // Crear modal con detalles
        const modalHtml = `
            <div class="modal fade" id="modalDetalleUsuario" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Detalles de Usuario</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="fw-bold">Nombre:</label>
                                    <p>${usuario.nombre} ${usuario.apellido}</p>
                                </div>
                                <div class="col-md-6">
                                    <label class="fw-bold">Email:</label>
                                    <p>${usuario.email}</p>
                                </div>
                                <div class="col-md-6">
                                    <label class="fw-bold">Tipo:</label>
                                    <p><span class="badge bg-${getTipoUsuarioColor(usuario.tipo_usuario)}">${getTipoUsuarioTexto(usuario.tipo_usuario)}</span></p>
                                </div>
                                <div class="col-md-6">
                                    <label class="fw-bold">Estado:</label>
                                    <p><span class="badge bg-${usuario.activo ? 'success' : 'secondary'}">${usuario.activo ? 'Activo' : 'Inactivo'}</span></p>
                                </div>
                                ${usuario.empresas && usuario.empresas.length > 0 ? `
                                <div class="col-12 mt-3">
                                    <label class="fw-bold">Empresas asignadas:</label>
                                    <ul class="list-group">
                                        ${usuario.empresas.map(e => `
                                            <li class="list-group-item d-flex justify-content-between align-items-center">
                                                ${e.nombre}
                                                <span class="badge bg-${getEstadoColor(e.estado)}">${getEstadoTexto(e.estado)}</span>
                                            </li>
                                        `).join('')}
                                    </ul>
                                </div>
                                ` : '<div class="col-12"><p class="text-muted">Sin empresas asignadas</p></div>'}
                                <div class="col-md-6">
                                    <label class="fw-bold">Último login:</label>
                                    <p>${usuario.ultimo_login ? formatearFecha(usuario.ultimo_login) : 'Nunca'}</p>
                                </div>
                                <div class="col-md-6">
                                    <label class="fw-bold">Fecha de registro:</label>
                                    <p>${formatearFecha(usuario.created_at)}</p>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                            <button type="button" class="btn btn-primary" onclick="editarUsuario(${id})" data-bs-dismiss="modal">Editar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remover modal anterior si existe
        const oldModal = document.getElementById('modalDetalleUsuario');
        if (oldModal) oldModal.remove();
        
        // Agregar modal al body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('modalDetalleUsuario'));
        modal.show();
        
    } catch (error) {
        console.error('Error:', error);
        mostrarAlertaSuperAdmin('Error al cargar detalles del usuario', 'danger');
    }
}

async function editarUsuario(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/super-admin/usuarios/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error al cargar usuario');
        
        const data = await response.json();
        const usuario = data.data;
        
        document.getElementById('tituloModalUsuario').textContent = 'Editar Usuario';
        document.getElementById('usuarioId').value = usuario.id;
        document.getElementById('usuarioNombre').value = usuario.nombre;
        document.getElementById('usuarioApellido').value = usuario.apellido;
        document.getElementById('usuarioEmail').value = usuario.email;
        document.getElementById('usuarioTipo').value = usuario.tipo_usuario;
        document.getElementById('usuarioActivo').value = usuario.activo ? '1' : '0';
        document.getElementById('usuarioEmailVerificado').checked = usuario.email_verificado;
        
        // Contraseña no se muestra por seguridad
        document.getElementById('usuarioPassword').value = '';
        document.getElementById('usuarioPassword').removeAttribute('required');
        document.getElementById('usuarioPassword').placeholder = 'Dejar en blanco para no cambiar';
        
        await cargarEmpresasParaUsuario();
        
        // Seleccionar empresas asignadas
        if (usuario.empresas && usuario.empresas.length > 0) {
            const empresasIds = usuario.empresas.map(e => e.id.toString());
            const options = document.getElementById('usuarioEmpresas').options;
            for (let i = 0; i < options.length; i++) {
                if (empresasIds.includes(options[i].value)) {
                    options[i].selected = true;
                }
            }
        }
        
        const modal = new bootstrap.Modal(document.getElementById('modalCrearUsuario'));
        modal.show();
        
    } catch (error) {
        console.error('Error:', error);
        mostrarAlertaSuperAdmin('Error al cargar usuario', 'danger');
    }
}

async function guardarUsuario() {
    try {
        const id = document.getElementById('usuarioId').value;
        const nombre = document.getElementById('usuarioNombre').value;
        const apellido = document.getElementById('usuarioApellido').value;
        const email = document.getElementById('usuarioEmail').value;
        const password = document.getElementById('usuarioPassword').value;
        const tipo = document.getElementById('usuarioTipo').value;
        const activo = document.getElementById('usuarioActivo').value === '1';
        const emailVerificado = document.getElementById('usuarioEmailVerificado').checked;
        
        // Validaciones
        if (!nombre || !apellido || !email) {
            throw new Error('Por favor completa todos los campos requeridos');
        }
        
        if (!id && !password) {
            throw new Error('La contraseña es requerida para nuevos usuarios');
        }
        
        // Obtener empresas seleccionadas
        const empresasSelect = document.getElementById('usuarioEmpresas');
        const empresasIds = Array.from(empresasSelect.selectedOptions).map(opt => opt.value);
        
        const body = {
            nombre,
            apellido,
            email,
            tipo_usuario: tipo,
            activo,
            email_verificado: emailVerificado,
            empresas_ids: empresasIds
        };
        
        // Solo incluir password si se proporcionó
        if (password) {
            body.password = password;
        }
        
        const token = localStorage.getItem('token');
        const url = id ? `${API_URL}/super-admin/usuarios/${id}` : `${API_URL}/super-admin/usuarios`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al guardar usuario');
        }
        
        mostrarAlertaSuperAdmin(`Usuario ${id ? 'actualizado' : 'creado'} exitosamente`, 'success');
        
        // Cerrar modal
        bootstrap.Modal.getInstance(document.getElementById('modalCrearUsuario')).hide();
        
        // Recargar lista
        cargarUsuarios();
        cargarDashboardSuperAdmin();
        
    } catch (error) {
        console.error('Error:', error);
        mostrarAlertaSuperAdmin(error.message || 'Error al guardar usuario', 'danger');
    }
}

function confirmarEliminarUsuario(id) {
    if (confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
        eliminarUsuario(id);
    }
}

async function eliminarUsuario(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/super-admin/usuarios/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al eliminar usuario');
        }
        
        mostrarAlertaSuperAdmin('Usuario eliminado exitosamente', 'success');
        cargarUsuarios();
        cargarDashboardSuperAdmin();
    } catch (error) {
        console.error('Error:', error);
        mostrarAlertaSuperAdmin(error.message || 'Error al eliminar usuario', 'danger');
    }
}

function buscarUsuarios() {
    cargarUsuarios();
}

// ========================================
// GESTIÓN DE PLANES Y LICENCIAS
// ========================================

async function cargarPlanes() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/super-admin/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error al cargar planes');
        
        const data = await response.json();
        
        // Por ahora mostramos un placeholder hasta que tengamos endpoint específico
        renderizarPlanes();
        cargarLicenciasPorVencer();
        
    } catch (error) {
        console.error('Error:', error);
        mostrarAlertaSuperAdmin('Error al cargar planes', 'danger');
    }
}

function renderizarPlanes() {
    const container = document.getElementById('listaPlanes');
    
    // Planes predefinidos - Cuando tengas endpoint de planes, reemplazar con datos reales
    const planes = [
        { id: 1, nombre: 'Básico', precio_mensual: 29, empresas_activas: 0, color: 'info' },
        { id: 2, nombre: 'Profesional', precio_mensual: 79, empresas_activas: 0, color: 'primary' },
        { id: 3, nombre: 'Enterprise', precio_mensual: 199, empresas_activas: 0, color: 'success' }
    ];
    
    container.innerHTML = planes.map(plan => `
        <div class="card mb-3 border-${plan.color}">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h5 class="card-title text-${plan.color}">${plan.nombre}</h5>
                        <p class="h3 mb-0">$${plan.precio_mensual}<small class="text-muted">/mes</small></p>
                    </div>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-${plan.color}" onclick="editarPlan(${plan.id})" title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                    </div>
                </div>
                <hr>
                <div class="d-flex justify-content-between">
                    <span class="text-muted">Empresas activas:</span>
                    <strong>${plan.empresas_activas}</strong>
                </div>
            </div>
        </div>
    `).join('');
}

async function cargarLicenciasPorVencer() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/super-admin/empresas?limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error al cargar licencias');
        
        const data = await response.json();
        
        // Filtrar empresas con licencias próximas a vencer (menos de 15 días)
        const empresasConLicenciaPorVencer = data.data
            .filter(emp => emp.dias_restantes !== null && emp.dias_restantes <= 15 && emp.dias_restantes >= 0)
            .sort((a, b) => a.dias_restantes - b.dias_restantes);
        
        renderizarLicenciasPorVencer(empresasConLicenciaPorVencer);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

function renderizarLicenciasPorVencer(empresas) {
    const container = document.getElementById('listaLicenciasPorVencer');
    
    if (!container) return;
    
    if (empresas.length === 0) {
        container.innerHTML = '<p class="text-center text-muted py-4">No hay licencias próximas a vencer</p>';
        return;
    }
    
    container.innerHTML = empresas.map(emp => `
        <div class="card mb-2 border-${emp.dias_restantes <= 3 ? 'danger' : 'warning'}">
            <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${emp.nombre}</h6>
                        <small class="text-muted">${emp.plan_nombre}</small>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-${emp.dias_restantes <= 3 ? 'danger' : 'warning'}">
                            ${emp.dias_restantes} días
                        </span>
                    </div>
                </div>
                <div class="mt-2">
                    <button class="btn btn-sm btn-outline-primary" onclick="renovarLicencia(${emp.id})">
                        <i class="bi bi-arrow-clockwise me-1"></i>Renovar
                    </button>
                    <button class="btn btn-sm btn-outline-info" onclick="verEmpresa(${emp.id})">
                        <i class="bi bi-eye me-1"></i>Ver
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function abrirModalCrearPlan() {
    document.getElementById('tituloModalPlan').textContent = 'Nuevo Plan';
    document.getElementById('planId').value = '';
    document.getElementById('formPlan').reset();
    
    const modal = new bootstrap.Modal(document.getElementById('modalCrearPlan'));
    modal.show();
}

async function editarPlan(id) {
    // TODO: Implementar cuando tengamos endpoint GET /api/super-admin/planes/:id
    mostrarAlertaSuperAdmin('Función en desarrollo', 'info');
}

async function guardarPlan() {
    // TODO: Implementar cuando tengamos endpoints de planes
    mostrarAlertaSuperAdmin('Función en desarrollo - Endpoint de planes pendiente', 'info');
}

async function renovarLicencia(empresaId) {
    if (!confirm('¿Renovar la licencia de esta empresa por 1 mes adicional?')) return;
    
    try {
        // TODO: Implementar endpoint PUT /api/super-admin/licencias/:id/renovar
        mostrarAlertaSuperAdmin('Función en desarrollo', 'info');
    } catch (error) {
        console.error('Error:', error);
        mostrarAlertaSuperAdmin('Error al renovar licencia', 'danger');
    }
}

// ========================================
// UTILIDADES ADICIONALES
// ========================================

function getTipoUsuarioColor(tipo) {
    const colores = {
        'super_admin': 'danger',
        'admin_empresa': 'primary',
        'usuario': 'secondary'
    };
    return colores[tipo] || 'secondary';
}

function getTipoUsuarioTexto(tipo) {
    const textos = {
        'super_admin': 'Super Admin',
        'admin_empresa': 'Admin Empresa',
        'usuario': 'Usuario'
    };
    return textos[tipo] || tipo;
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
