/**
 * ========================================
 * SUPER ADMIN - GESTIÓN DE EMPRESAS
 * ========================================
 */

const API_URL = 'http://localhost:3000/api';
let currentUser = null;
let empresas = [];
let planes = [];

// ========================================
// INICIALIZACIÓN
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacion();
    inicializarEventListeners();
    cargarDashboard();
    cargarEmpresas();
});

function verificarAutenticacion() {
    const token = localStorage.getItem('token');
    const usuario = localStorage.getItem('usuario');
    
    if (!token || !usuario) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = JSON.parse(usuario);
    
    if (currentUser.tipo_usuario !== 'super_admin') {
        mostrarAlerta('No tienes permisos para acceder a esta sección', 'danger');
        setTimeout(() => window.location.href = 'dashboard.html', 2000);
        return;
    }
    
    document.getElementById('nombreUsuario').textContent = currentUser.nombre;
}

function inicializarEventListeners() {
    // Búsqueda
    const searchEmpresas = document.getElementById('searchEmpresas');
    if (searchEmpresas) {
        searchEmpresas.addEventListener('input', debounce(() => cargarEmpresas(), 500));
    }
    
    // Filtros
    const filterEstado = document.getElementById('filterEstado');
    const filterPlan = document.getElementById('filterPlan');
    if (filterEstado) filterEstado.addEventListener('change', cargarEmpresas);
    if (filterPlan) filterPlan.addEventListener('change', cargarEmpresas);
}

// ========================================
// DASHBOARD
// ========================================
async function cargarDashboard() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/super-admin/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error al cargar dashboard');
        
        const data = await response.json();
        mostrarMetricas(data.data);
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al cargar métricas del dashboard', 'danger');
    }
}

function mostrarMetricas(metricas) {
    // Métricas principales
    if (document.getElementById('metricEmpresasActivas')) {
        document.getElementById('metricEmpresasActivas').textContent = metricas.empresas_activas || 0;
    }
    if (document.getElementById('metricUsuariosActivos')) {
        document.getElementById('metricUsuariosActivos').textContent = metricas.total_usuarios || 0;
    }
    if (document.getElementById('metricMRR')) {
        document.getElementById('metricMRR').textContent = `$${formatearNumero(metricas.mrr || 0)}`;
    }
    if (document.getElementById('metricLicenciasPorVencer')) {
        document.getElementById('metricLicenciasPorVencer').textContent = metricas.licencias_por_vencer || 0;
    }
    
    // Estado de empresas
    if (document.getElementById('empresasActivas')) {
        document.getElementById('empresasActivas').textContent = metricas.empresas_activas || 0;
    }
    if (document.getElementById('empresasTrial')) {
        document.getElementById('empresasTrial').textContent = metricas.empresas_trial || 0;
    }
    if (document.getElementById('empresasSuspendidas')) {
        document.getElementById('empresasSuspendidas').textContent = metricas.empresas_suspendidas || 0;
    }
    if (document.getElementById('empresasCanceladas')) {
        document.getElementById('empresasCanceladas').textContent = metricas.empresas_canceladas || 0;
    }
}

// ========================================
// CRUD EMPRESAS
// ========================================
async function cargarEmpresas() {
    try {
        const token = localStorage.getItem('token');
        const buscar = document.getElementById('searchEmpresas')?.value || '';
        const estado = document.getElementById('filterEstado')?.value || '';
        const planId = document.getElementById('filterPlan')?.value || '';
        
        let url = `${API_URL}/super-admin/empresas?limit=100`;
        if (buscar) url += `&search=${encodeURIComponent(buscar)}`;
        if (estado) url += `&estado=${estado}`;
        if (planId) url += `&plan_id=${planId}`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error al cargar empresas');
        
        const data = await response.json();
        empresas = data.data;
        renderizarTablaEmpresas(empresas);
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al cargar empresas', 'danger');
    }
}

function renderizarTablaEmpresas(empresas) {
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
                    <button class="btn btn-outline-${emp.estado === 'activo' ? 'warning' : 'success'}" 
                            onclick="cambiarEstadoEmpresa(${emp.id}, '${emp.estado === 'activo' ? 'inactivo' : 'activo'}')"
                            title="${emp.estado === 'activo' ? 'Suspender' : 'Activar'}">
                        <i class="bi bi-${emp.estado === 'activo' ? 'pause' : 'play'}-circle"></i>
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
    document.getElementById('tituloModalEmpresa').textContent = 'Nueva Empresa';
    document.getElementById('empresaId').value = '';
    document.getElementById('formEmpresa').reset();
    
    const modal = new bootstrap.Modal(document.getElementById('modalEmpresa'));
    modal.show();
}

function verEmpresa(id) {
    // Redirigir a página de detalles o mostrar modal con información completa
    window.location.href = `empresa-detalle.html?id=${id}`;
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
        
        document.getElementById('tituloModalEmpresa').textContent = 'Editar Empresa';
        document.getElementById('empresaId').value = empresa.id;
        document.getElementById('empresaNombre').value = empresa.nombre;
        document.getElementById('empresaNit').value = empresa.nit;
        document.getElementById('empresaEmail').value = empresa.email;
        document.getElementById('empresaTelefono').value = empresa.telefono || '';
        document.getElementById('empresaDireccion').value = empresa.direccion || '';
        document.getElementById('empresaCiudad').value = empresa.ciudad || '';
        document.getElementById('empresaPais').value = empresa.pais || 'Colombia';
        document.getElementById('empresaPlan').value = empresa.plan_id || '';
        
        const modal = new bootstrap.Modal(document.getElementById('modalEmpresa'));
        modal.show();
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al cargar datos de la empresa', 'danger');
    }
}

async function guardarEmpresa() {
    try {
        const empresaId = document.getElementById('empresaId').value;
        const esEdicion = empresaId !== '';
        
        const empresaData = {
            nombre: document.getElementById('empresaNombre').value.trim(),
            nit: document.getElementById('empresaNit').value.trim(),
            email: document.getElementById('empresaEmail').value.trim(),
            telefono: document.getElementById('empresaTelefono').value.trim(),
            direccion: document.getElementById('empresaDireccion').value.trim(),
            ciudad: document.getElementById('empresaCiudad').value.trim(),
            pais: document.getElementById('empresaPais').value,
            regimen_tributario: document.getElementById('empresaRegimen').value,
            tipo_contribuyente: document.getElementById('empresaTipoContribuyente').value,
            plan_id: parseInt(document.getElementById('empresaPlan').value) || null,
            dias_trial: parseInt(document.getElementById('empresaDiasTrial').value) || 0,
            tipo_facturacion: document.getElementById('empresaTipoFacturacion').value,
            auto_renovacion: document.getElementById('empresaAutoRenovacion').checked
        };
        
        // Validaciones
        if (!empresaData.nombre || !empresaData.nit || !empresaData.email) {
            mostrarAlerta('Por favor completa todos los campos obligatorios', 'warning');
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
        
        mostrarAlerta(
            esEdicion ? 'Empresa actualizada exitosamente' : 'Empresa creada exitosamente',
            'success'
        );
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalEmpresa'));
        modal.hide();
        
        cargarEmpresas();
        cargarDashboard();
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta(error.message || 'Error al guardar empresa', 'danger');
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
        
        mostrarAlerta('Estado actualizado exitosamente', 'success');
        cargarEmpresas();
        cargarDashboard();
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al cambiar estado de la empresa', 'danger');
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
        
        mostrarAlerta('Empresa eliminada exitosamente', 'success');
        cargarEmpresas();
        cargarDashboard();
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al eliminar empresa', 'danger');
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
        'inactivo': 'secondary',
        'suspendido': 'warning',
        'trial': 'info'
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

function mostrarAlerta(mensaje, tipo = 'info') {
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
