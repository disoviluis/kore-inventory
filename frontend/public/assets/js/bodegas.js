/**
 * BODEGAS MODULE
 * Gestión de bodegas, sucursales, almacenes y locales
 */

const API_URL = 'http://18.191.181.99:3000/api';
let currentBodegaId = null;
let allBodegas = [];
let currentEmpresaId = null;

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    
    if (!usuario) {
        window.location.href = 'login.html';
        return;
    }

    // Initialize user info
    loadUserInfo();
    initializeEventListeners();
    
    // Wait for empresaActiva to be loaded by company-selector.js
    // Then load bodegas
    setTimeout(() => {
        const empresaActiva = JSON.parse(localStorage.getItem('empresaActiva'));
        if (empresaActiva && empresaActiva.id) {
            currentEmpresaId = empresaActiva.id;
            loadBodegas();
            loadResponsables();
        }
    }, 500);
});

// Listen for empresa change event from company-selector.js
window.addEventListener('empresaCambiada', (event) => {
    console.log('🔄 Empresa cambiada en Bodegas:', event.detail.empresa);
    currentEmpresaId = event.detail.empresa.id;
    loadBodegas();
    loadResponsables();
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
            renderBodegas(allBodegas);
            updateStats(allBodegas);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error loading bodegas:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar las bodegas: ' + error.message
        });
        document.getElementById('bodegasTableBody').innerHTML = `
            <tr><td colspan="9" class="text-center text-danger py-4">
                <i class="bi bi-exclamation-triangle fs-3"></i>
                <p class="mt-2">Error al cargar bodegas</p>
            </td></tr>
        `;
    }
}

async function loadResponsables() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/usuarios?empresa_id=${currentEmpresaId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        
        if (result.success) {
            const select = document.getElementById('bodegaResponsable');
            select.innerHTML = '<option value="">Sin asignar</option>';
            result.data.forEach(usuario => {
                select.innerHTML += `<option value="${usuario.id}">${usuario.nombre} - ${usuario.email}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading responsables:', error);
    }
}

// ==========================================
// RENDER
// ==========================================

function renderBodegas(bodegas) {
    const tbody = document.getElementById('bodegasTableBody');
    
    if (bodegas.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="9" class="text-center text-muted py-5">
                <i class="bi bi-inbox fs-1"></i>
                <p class="mt-2">No hay bodegas registradas</p>
                <button class="btn btn-primary btn-sm" id="btnNuevaBodegaEmpty">
                    <i class="bi bi-plus-circle me-2"></i>Crear Primera Bodega
                </button>
            </td></tr>
        `;
        document.getElementById('btnNuevaBodegaEmpty')?.addEventListener('click', openNewBodegaModal);
        return;
    }

    tbody.innerHTML = bodegas.map(bodega => `
        <tr>
            <td><span class="badge bg-secondary">${bodega.codigo}</span></td>
            <td>
                <strong>${bodega.nombre}</strong>
                ${bodega.descripcion ? `<br><small class="text-muted">${bodega.descripcion.substring(0, 50)}...</small>` : ''}
            </td>
            <td>
                <span class="badge bg-${getTipoBadgeClass(bodega.tipo)}">
                    <i class="bi ${getTipoIcon(bodega.tipo)} me-1"></i>
                    ${bodega.tipo}
                </span>
            </td>
            <td>
                ${bodega.ciudad || '-'}
                ${bodega.departamento ? `<br><small class="text-muted">${bodega.departamento}</small>` : ''}
            </td>
            <td>
                ${bodega.responsable_nombre || '<span class="text-muted">Sin asignar</span>'}
            </td>
            <td class="text-center">
                ${bodega.es_principal ? '<i class="bi bi-star-fill text-warning fs-5" title="Bodega Principal"></i>' : '-'}
            </td>
            <td class="text-center">
                ${bodega.permite_ventas ? '<i class="bi bi-check-circle-fill text-success" title="Permite ventas"></i>' : '-'}
            </td>
            <td class="text-center">
                <span class="badge bg-${bodega.activa ? 'success' : 'secondary'}">
                    ${bodega.activa ? 'Activa' : 'Inactiva'}
                </span>
            </td>
            <td class="text-center">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="viewStock(${bodega.id}, '${bodega.nombre}')" title="Ver Stock">
                        <i class="bi bi-box-seam"></i>
                    </button>
                    <button class="btn btn-outline-warning" onclick="editBodega(${bodega.id})" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteBodega(${bodega.id}, '${bodega.nombre}')" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function updateStats(bodegas) {
    const total = bodegas.length;
    const activas = bodegas.filter(b => b.activa).length;
    const conVentas = bodegas.filter(b => b.permite_ventas).length;
    const principal = bodegas.find(b => b.es_principal);

    document.getElementById('statTotalBodegas').textContent = total;
    document.getElementById('statActivas').textContent = activas;
    document.getElementById('statConVentas').textContent = conVentas;
    document.getElementById('statPrincipal').textContent = principal ? principal.nombre : 'No definida';
}

function getTipoBadgeClass(tipo) {
    const classes = {
        'bodega': 'primary',
        'sucursal': 'info',
        'local': 'success',
        'almacen': 'warning',
        'tienda': 'danger'
    };
    return classes[tipo] || 'secondary';
}

function getTipoIcon(tipo) {
    const icons = {
        'bodega': 'bi-building',
        'sucursal': 'bi-shop',
        'local': 'bi-house',
        'almacen': 'bi-box',
        'tienda': 'bi-cart'
    };
    return icons[tipo] || 'bi-building';
}

// ==========================================
// FILTERS
// ==========================================

function applyFilters() {
    const searchTerm = document.getElementById('searchBodega').value.toLowerCase();
    const filterTipo = document.getElementById('filterTipo').value;
    const filterEstado = document.getElementById('filterEstado').value;

    let filtered = allBodegas;

    if (searchTerm) {
        filtered = filtered.filter(b => 
            b.codigo.toLowerCase().includes(searchTerm) ||
            b.nombre.toLowerCase().includes(searchTerm) ||
            (b.ciudad && b.ciudad.toLowerCase().includes(searchTerm))
        );
    }

    if (filterTipo) {
        filtered = filtered.filter(b => b.tipo === filterTipo);
    }

    if (filterEstado !== '') {
        const isActive = filterEstado === '1';
        filtered = filtered.filter(b => b.activa === isActive);
    }

    renderBodegas(filtered);
}

// ==========================================
// MODAL ACTIONS
// ==========================================

function openNewBodegaModal() {
    currentBodegaId = null;
    document.getElementById('modalBodegaTitle').innerHTML = '<i class="bi bi-plus-circle me-2"></i>Nueva Bodega';
    document.getElementById('formBodega').reset();
    document.getElementById('bodegaId').value = '';
    document.getElementById('bodegaActiva').value = '1';
    
    const modal = new bootstrap.Modal(document.getElementById('modalBodega'));
    modal.show();
}

async function editBodega(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/bodegas/${id}?empresa_id=${currentEmpresaId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();
        
        if (result.success) {
            const bodega = result.data;
            currentBodegaId = id;

            document.getElementById('modalBodegaTitle').innerHTML = '<i class="bi bi-pencil me-2"></i>Editar Bodega';
            document.getElementById('bodegaId').value = bodega.id;
            document.getElementById('bodegaCodigo').value = bodega.codigo;
            document.getElementById('bodegaNombre').value = bodega.nombre;
            document.getElementById('bodegaTipo').value = bodega.tipo;
            document.getElementById('bodegaDireccion').value = bodega.direccion || '';
            document.getElementById('bodegaCiudad').value = bodega.ciudad || '';
            document.getElementById('bodegaDepartamento').value = bodega.departamento || '';
            document.getElementById('bodegaTelefono').value = bodega.telefono || '';
            document.getElementById('bodegaEmail').value = bodega.email || '';
            document.getElementById('bodegaResponsable').value = bodega.responsable_id || '';
            document.getElementById('bodegaDescripcion').value = bodega.descripcion || '';
            document.getElementById('bodegaActiva').value = bodega.activa ? '1' : '0';
            document.getElementById('bodegaPrincipal').checked = bodega.es_principal;
            document.getElementById('bodegaPermiteVentas').checked = bodega.permite_ventas;

            const modal = new bootstrap.Modal(document.getElementById('modalBodega'));
            modal.show();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error loading bodega:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la bodega: ' + error.message
        });
    }
}

async function saveBodega() {
    try {
        const formData = {
            empresa_id: currentEmpresaId,
            codigo: document.getElementById('bodegaCodigo').value.trim(),
            nombre: document.getElementById('bodegaNombre').value.trim(),
            tipo: document.getElementById('bodegaTipo').value,
            direccion: document.getElementById('bodegaDireccion').value.trim() || null,
            ciudad: document.getElementById('bodegaCiudad').value.trim() || null,
            departamento: document.getElementById('bodegaDepartamento').value.trim() || null,
            telefono: document.getElementById('bodegaTelefono').value.trim() || null,
            email: document.getElementById('bodegaEmail').value.trim() || null,
            responsable_id: document.getElementById('bodegaResponsable').value || null,
            descripcion: document.getElementById('bodegaDescripcion').value.trim() || null,
            activa: document.getElementById('bodegaActiva').value === '1',
            es_principal: document.getElementById('bodegaPrincipal').checked,
            permite_ventas: document.getElementById('bodegaPermiteVentas').checked
        };

        // Validations
        if (!formData.codigo || !formData.nombre || !formData.tipo) {
            Swal.fire({
                icon: 'warning',
                title: 'Campos requeridos',
                text: 'Por favor completa todos los campos marcados con *'
            });
            return;
        }

        const token = localStorage.getItem('token');
        const isEdit = currentBodegaId !== null;
        const url = isEdit ? `${API_URL}/bodegas/${currentBodegaId}` : `${API_URL}/bodegas`;
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            Swal.fire({
                icon: 'success',
                title: '¡Éxito!',
                text: `Bodega ${isEdit ? 'actualizada' : 'creada'} exitosamente`,
                timer: 2000,
                showConfirmButton: false
            });

            const modal = bootstrap.Modal.getInstance(document.getElementById('modalBodega'));
            modal.hide();
            
            loadBodegas();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error saving bodega:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo guardar la bodega: ' + error.message
        });
    }
}

async function deleteBodega(id, nombre) {
    const result = await Swal.fire({
        title: '¿Estás seguro?',
        html: `Se eliminará la bodega:<br><strong>${nombre}</strong><br><br>
               <span class="text-danger">⚠️ Esta acción no se puede deshacer</span>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/bodegas/${id}?empresa_id=${currentEmpresaId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const apiResult = await response.json();

            if (apiResult.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Eliminada',
                    text: 'La bodega ha sido eliminada exitosamente',
                    timer: 2000,
                    showConfirmButton: false
                });
                loadBodegas();
            } else {
                throw new Error(apiResult.message);
            }
        } catch (error) {
            console.error('Error deleting bodega:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo eliminar la bodega: ' + error.message
            });
        }
    }
}

// ==========================================
// STOCK VIEW
// ==========================================

async function viewStock(bodegaId, bodegaNombre) {
    try {
        document.getElementById('stockBodegaNombre').textContent = bodegaNombre;
        
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/bodegas/${bodegaId}/stock?empresa_id=${currentEmpresaId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success) {
            const tbody = document.getElementById('stockTableBody');
            
            if (result.data.length === 0) {
                tbody.innerHTML = `
                    <tr><td colspan="6" class="text-center text-muted py-4">
                        <i class="bi bi-inbox fs-3"></i>
                        <p class="mt-2">No hay stock registrado en esta bodega</p>
                    </td></tr>
                `;
            } else {
                tbody.innerHTML = result.data.map(item => `
                    <tr>
                        <td><span class="badge bg-secondary">${item.producto_codigo}</span></td>
                        <td>
                            <strong>${item.producto_nombre}</strong>
                            ${item.producto_referencia ? `<br><small class="text-muted">Ref: ${item.producto_referencia}</small>` : ''}
                        </td>
                        <td class="text-center">
                            <span class="badge bg-primary">${item.stock_actual}</span>
                        </td>
                        <td class="text-center">
                            <span class="badge bg-warning">${item.stock_reservado || 0}</span>
                        </td>
                        <td class="text-center">
                            <span class="badge bg-${item.stock_disponible > 0 ? 'success' : 'danger'}">
                                ${item.stock_disponible}
                            </span>
                        </td>
                        <td>${item.ubicacion || '-'}</td>
                    </tr>
                `).join('');
            }

            const modal = new bootstrap.Modal(document.getElementById('modalStock'));
            modal.show();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error loading stock:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el stock: ' + error.message
        });
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function initializeEventListeners() {
    // Nueva bodega
    document.getElementById('btnNuevaBodega').addEventListener('click', openNewBodegaModal);
    
    // Guardar bodega
    document.getElementById('btnGuardarBodega').addEventListener('click', saveBodega);
    
    // Filters
    document.getElementById('searchBodega').addEventListener('input', applyFilters);
    document.getElementById('filterTipo').addEventListener('change', applyFilters);
    document.getElementById('filterEstado').addEventListener('change', applyFilters);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });
}

// Prevent form submission on Enter
document.getElementById('formBodega')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveBodega();
});
