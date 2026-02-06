/**
 * =================================
 * KORE INVENTORY - PROVEEDORES MODULE
 * Módulo de gestión de proveedores
 * Version: 1.0.0 - 2026-02-06
 * =================================
 */

const API_URL = 'http://18.191.181.99:3000/api';
let currentEmpresa = null;
let currentUsuario = null;
let proveedoresData = [];
let proveedorModal = null;

console.log('🚀 Proveedores.js cargado - Versión 1.0.0');

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
        // Obtener usuario
        let usuario = JSON.parse(localStorage.getItem('usuario'));
        if (!usuario) {
            const responseUser = await fetch(`${API_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const userData = await responseUser.json();
            usuario = userData.data;
            localStorage.setItem('usuario', JSON.stringify(usuario));
        }
        currentUsuario = usuario;

        // Obtener empresa activa
        currentEmpresa = JSON.parse(localStorage.getItem('empresaActiva'));
        if (!currentEmpresa) {
            mostrarAlerta('Por favor selecciona una empresa desde el dashboard', 'warning');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
            return;
        }

        // Actualizar UI
        document.getElementById('userName').textContent = `${usuario.nombre} ${usuario.apellido}`;
        document.getElementById('userRole').textContent = usuario.rol || 'Usuario';
        document.getElementById('empresaActiva').textContent = currentEmpresa.nombre;

        // Inicializar modal
        proveedorModal = new bootstrap.Modal(document.getElementById('proveedorModal'));

        // Cargar proveedores
        await cargarProveedores();

        // Event listeners
        setupEventListeners();

    } catch (error) {
        console.error('Error en inicialización:', error);
        mostrarAlerta('Error al cargar la información inicial', 'error');
    }
});

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Búsqueda
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => cargarProveedores(), 500);
    });

    // Filtro estado
    document.getElementById('filterEstado').addEventListener('change', cargarProveedores);

    // Botones
    document.getElementById('btnNuevoProveedor').addEventListener('click', abrirModalNuevo);
    const btnQuick = document.getElementById('btnNuevoProveedorQuick');
    if (btnQuick) btnQuick.addEventListener('click', abrirModalNuevo);
    document.getElementById('btnGuardarProveedor').addEventListener('click', guardarProveedor);
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);
    document.getElementById('btnExportar').addEventListener('click', exportarProveedores);
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) btnLogout.addEventListener('click', cerrarSesion);
    const toggleBtn = document.getElementById('toggleSidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('active');
        });
    }
}

// ============================================
// CRUD PROVEEDORES
// ============================================

async function cargarProveedores() {
    try {
        mostrarCargando(true);

        const token = localStorage.getItem('token');
        const searchTerm = document.getElementById('searchInput').value;
        const estado = document.getElementById('filterEstado').value;

        let url = `${API_URL}/proveedores?empresaId=${currentEmpresa.id}`;
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
        if (estado !== '') url += `&estado=${estado}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error al cargar proveedores');

        const data = await response.json();
        proveedoresData = data.data;

        renderProveedores(proveedoresData);
        mostrarCargando(false);

    } catch (error) {
        console.error('Error al cargar proveedores:', error);
        mostrarAlerta('Error al cargar los proveedores', 'error');
        mostrarCargando(false);
    }
}

function renderProveedores(proveedores) {
    const tbody = document.getElementById('proveedoresTableBody');
    const emptyState = document.getElementById('emptyState');
    const tableContainer = document.getElementById('tableContainer');
    const resultCount = document.getElementById('resultCount');

    if (!proveedores || proveedores.length === 0) {
        emptyState.style.display = 'block';
        tableContainer.style.display = 'none';
        resultCount.textContent = '0';
        return;
    }

    emptyState.style.display = 'none';
    tableContainer.style.display = 'block';
    resultCount.textContent = proveedores.length;

    tbody.innerHTML = proveedores.map((proveedor, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>
                <div class="fw-bold">${proveedor.razon_social}</div>
                ${proveedor.nombre_comercial ? `<small class="text-muted">${proveedor.nombre_comercial}</small>` : ''}
            </td>
            <td>${proveedor.numero_documento}</td>
            <td>${proveedor.nombre_contacto || '-'}</td>
            <td>
                ${proveedor.telefono || proveedor.celular || '-'}
                ${proveedor.telefono && proveedor.celular ? `<br><small class="text-muted">${proveedor.celular}</small>` : ''}
            </td>
            <td>${proveedor.email || '-'}</td>
            <td>${proveedor.ciudad || '-'}</td>
            <td>
                <span class="badge ${proveedor.estado == 1 ? 'bg-success' : 'bg-secondary'}">
                    ${proveedor.estado == 1 ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td class="text-center">
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-primary" onclick="verProveedor(${proveedor.id})" title="Ver detalles">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-warning" onclick="editarProveedor(${proveedor.id})" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    ${proveedor.estado == 1 ? 
                        `<button class="btn btn-outline-danger" onclick="eliminarProveedor(${proveedor.id})" title="Desactivar">
                            <i class="bi bi-trash"></i>
                        </button>` : 
                        `<button class="btn btn-outline-success" onclick="activarProveedor(${proveedor.id})" title="Activar">
                            <i class="bi bi-check-circle"></i>
                        </button>`
                    }
                </div>
            </td>
        </tr>
    `).join('');
}

function abrirModalNuevo() {
    document.getElementById('proveedorModalLabel').innerHTML = '<i class="bi bi-truck me-2"></i>Nuevo Proveedor';
    document.getElementById('proveedorForm').reset();
    document.getElementById('proveedorId').value = '';
    document.getElementById('estado').value = '1';
    document.getElementById('pais').value = 'Colombia';
    document.getElementById('diasCredito').value = '30';
    document.getElementById('terminosPago').value = '30 días';
    proveedorModal.show();
}

async function verProveedor(id) {
    try {
        const proveedor = proveedoresData.find(p => p.id === id);
        if (!proveedor) {
            mostrarAlerta('Proveedor no encontrado', 'error');
            return;
        }

        // Llenar el formulario con los datos
        await editarProveedor(id);
        
        // Deshabilitar todos los campos para solo lectura
        const form = document.getElementById('proveedorForm');
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => input.disabled = true);
        
        // Cambiar el botón de guardar
        const btnGuardar = document.getElementById('btnGuardarProveedor');
        btnGuardar.style.display = 'none';
        
        document.getElementById('proveedorModalLabel').innerHTML = '<i class="bi bi-eye me-2"></i>Ver Proveedor';
        
        // Cuando se cierre el modal, rehabilitar campos
        const modal = document.getElementById('proveedorModal');
        modal.addEventListener('hidden.bs.modal', function handler() {
            inputs.forEach(input => input.disabled = false);
            btnGuardar.style.display = 'block';
            modal.removeEventListener('hidden.bs.modal', handler);
        });

    } catch (error) {
        console.error('Error al ver proveedor:', error);
        mostrarAlerta('Error al cargar los datos del proveedor', 'error');
    }
}

async function editarProveedor(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/proveedores/${id}?empresaId=${currentEmpresa.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error al obtener proveedor');

        const data = await response.json();
        const proveedor = data.data;

        // Llenar formulario
        document.getElementById('proveedorId').value = proveedor.id;
        document.getElementById('tipoDocumento').value = proveedor.tipo_documento;
        document.getElementById('numeroDocumento').value = proveedor.numero_documento;
        document.getElementById('razonSocial').value = proveedor.razon_social;
        document.getElementById('nombreComercial').value = proveedor.nombre_comercial || '';
        document.getElementById('nombreContacto').value = proveedor.nombre_contacto || '';
        document.getElementById('email').value = proveedor.email || '';
        document.getElementById('telefono').value = proveedor.telefono || '';
        document.getElementById('celular').value = proveedor.celular || '';
        document.getElementById('sitioWeb').value = proveedor.sitio_web || '';
        document.getElementById('direccion').value = proveedor.direccion || '';
        document.getElementById('ciudad').value = proveedor.ciudad || '';
        document.getElementById('pais').value = proveedor.pais || 'Colombia';
        document.getElementById('codigoPostal').value = proveedor.codigo_postal || '';
        document.getElementById('terminosPago').value = proveedor.terminos_pago || '';
        document.getElementById('diasCredito').value = proveedor.dias_credito || 0;
        document.getElementById('limiteCredito').value = proveedor.limite_credito || 0;
        document.getElementById('productosSuministra').value = proveedor.productos_suministra || '';
        document.getElementById('banco').value = proveedor.banco || '';
        document.getElementById('tipoCuenta').value = proveedor.tipo_cuenta || '';
        document.getElementById('numeroCuenta').value = proveedor.numero_cuenta || '';
        document.getElementById('observaciones').value = proveedor.observaciones || '';
        document.getElementById('estado').value = proveedor.estado;

        document.getElementById('proveedorModalLabel').innerHTML = '<i class="bi bi-pencil me-2"></i>Editar Proveedor';
        proveedorModal.show();

    } catch (error) {
        console.error('Error al editar proveedor:', error);
        mostrarAlerta('Error al cargar los datos del proveedor', 'error');
    }
}

async function guardarProveedor() {
    try {
        const id = document.getElementById('proveedorId').value;
        const proveedorData = {
            empresa_id: currentEmpresa.id,
            tipo_documento: document.getElementById('tipoDocumento').value,
            numero_documento: document.getElementById('numeroDocumento').value.trim(),
            razon_social: document.getElementById('razonSocial').value.trim(),
            nombre_comercial: document.getElementById('nombreComercial').value.trim() || null,
            nombre_contacto: document.getElementById('nombreContacto').value.trim() || null,
            email: document.getElementById('email').value.trim() || null,
            telefono: document.getElementById('telefono').value.trim() || null,
            celular: document.getElementById('celular').value.trim() || null,
            sitio_web: document.getElementById('sitioWeb').value.trim() || null,
            direccion: document.getElementById('direccion').value.trim() || null,
            ciudad: document.getElementById('ciudad').value.trim() || null,
            pais: document.getElementById('pais').value.trim() || 'Colombia',
            codigo_postal: document.getElementById('codigoPostal').value.trim() || null,
            terminos_pago: document.getElementById('terminosPago').value || null,
            dias_credito: parseInt(document.getElementById('diasCredito').value) || 0,
            limite_credito: parseFloat(document.getElementById('limiteCredito').value) || 0.00,
            productos_suministra: document.getElementById('productosSuministra').value.trim() || null,
            banco: document.getElementById('banco').value.trim() || null,
            tipo_cuenta: document.getElementById('tipoCuenta').value || null,
            numero_cuenta: document.getElementById('numeroCuenta').value.trim() || null,
            observaciones: document.getElementById('observaciones').value.trim() || null,
            estado: parseInt(document.getElementById('estado').value)
        };

        // Validaciones
        if (!proveedorData.numero_documento || !proveedorData.razon_social) {
            mostrarAlerta('Por favor complete los campos requeridos', 'warning');
            return;
        }

        const token = localStorage.getItem('token');
        const url = id ? `${API_URL}/proveedores/${id}` : `${API_URL}/proveedores`;
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(proveedorData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al guardar proveedor');
        }

        const data = await response.json();
        
        mostrarAlerta(id ? 'Proveedor actualizado exitosamente' : 'Proveedor creado exitosamente', 'success');
        proveedorModal.hide();
        await cargarProveedores();

    } catch (error) {
        console.error('Error al guardar proveedor:', error);
        mostrarAlerta(error.message || 'Error al guardar el proveedor', 'error');
    }
}

async function eliminarProveedor(id) {
    if (!confirm('¿Está seguro de desactivar este proveedor?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/proveedores/${id}?empresaId=${currentEmpresa.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error al eliminar proveedor');

        mostrarAlerta('Proveedor desactivado exitosamente', 'success');
        await cargarProveedores();

    } catch (error) {
        console.error('Error al eliminar proveedor:', error);
        mostrarAlerta('Error al desactivar el proveedor', 'error');
    }
}

async function activarProveedor(id) {
    if (!confirm('¿Está seguro de activar este proveedor?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/proveedores/${id}/activar?empresaId=${currentEmpresa.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error al activar proveedor');

        mostrarAlerta('Proveedor activado exitosamente', 'success');
        await cargarProveedores();

    } catch (error) {
        console.error('Error al activar proveedor:', error);
        mostrarAlerta('Error al activar el proveedor', 'error');
    }
}

// ============================================
// UTILIDADES
// ============================================

function limpiarFiltros() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterEstado').value = '1';
    cargarProveedores();
}

function exportarProveedores() {
    if (!proveedoresData || proveedoresData.length === 0) {
        mostrarAlerta('No hay datos para exportar', 'warning');
        return;
    }

    // Preparar datos para exportar
    const csvData = [
        ['ID', 'Razón Social', 'Nombre Comercial', 'Tipo Doc', 'Número Doc', 'Contacto', 'Teléfono', 'Celular', 'Email', 'Dirección', 'Ciudad', 'País', 'Términos Pago', 'Días Crédito', 'Límite Crédito', 'Estado']
    ];

    proveedoresData.forEach(p => {
        csvData.push([
            p.id,
            p.razon_social,
            p.nombre_comercial || '',
            p.tipo_documento,
            p.numero_documento,
            p.nombre_contacto || '',
            p.telefono || '',
            p.celular || '',
            p.email || '',
            p.direccion || '',
            p.ciudad || '',
            p.pais || '',
            p.terminos_pago || '',
            p.dias_credito || 0,
            p.limite_credito || 0,
            p.estado == 1 ? 'Activo' : 'Inactivo'
        ]);
    });

    // Convertir a CSV
    const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    // Descargar
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `proveedores_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    mostrarAlerta('Proveedores exportados exitosamente', 'success');
}

function mostrarCargando(show) {
    const spinner = document.getElementById('loadingSpinner');
    const tableContainer = document.getElementById('tableContainer');
    const emptyState = document.getElementById('emptyState');

    if (show) {
        spinner.style.display = 'block';
        tableContainer.style.display = 'none';
        emptyState.style.display = 'none';
    } else {
        spinner.style.display = 'none';
    }
}

function mostrarAlerta(mensaje, tipo) {
    const alertClass = {
        'success': 'alert-success',
        'error': 'alert-danger',
        'warning': 'alert-warning',
        'info': 'alert-info'
    }[tipo] || 'alert-info';

    const alertHtml = `
        <div class="alert ${alertClass} alert-dismissible fade show position-fixed top-0 end-0 m-3" role="alert" style="z-index: 9999;">
            <i class="bi bi-${tipo === 'success' ? 'check-circle' : tipo === 'error' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', alertHtml);

    setTimeout(() => {
        const alert = document.querySelector('.alert');
        if (alert) alert.remove();
    }, 3000);
}

function cerrarSesion() {
    if (confirm('¿Está seguro de cerrar sesión?')) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}
