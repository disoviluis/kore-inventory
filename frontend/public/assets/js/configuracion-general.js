// ============================================================================
// CONFIGURACIÓN GENERAL - GESTIÓN DE CATEGORÍAS
// ============================================================================

// API Base URL
const API_URL = 'http://18.191.181.99:3000/api';

// Variables globales
let currentEmpresa = null;
let categorias = [];
let categoriasOriginal = [];
let editingCategoriaId = null;

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Configuración General cargado');
    
    // Verificar autenticación
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('❌ No hay token - redirigiendo a login');
        window.location.href = 'login.html';
        return;
    }

    // Cargar datos iniciales
    loadUserData();
    loadCompanies();
    
    // Inicializar event listeners
    initEventListeners();
});

// ============================================================================
// CARGA DE DATOS INICIALES
// ============================================================================

async function loadUserData() {
    try {
        // Obtener usuario desde localStorage (ya fue validado en login/dashboard)
        let usuario = JSON.parse(localStorage.getItem('usuario'));
        
        // Si no hay usuario en localStorage, verificar token
        if (!usuario) {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                localStorage.removeItem('token');
                localStorage.removeItem('usuario');
                window.location.href = 'login.html';
                return;
            }

            const data = await response.json();
            usuario = data.data;
            localStorage.setItem('usuario', JSON.stringify(usuario));
        }

        // Cargar información del usuario en la UI
        document.getElementById('userName').textContent = usuario.nombre;
        document.getElementById('userRole').textContent = usuario.rol?.nombre || 'Usuario';
        
        // Mostrar sección plataforma si es super_admin
        if (usuario.rol?.nombre === 'super_admin') {
            document.getElementById('plataformaSection').style.display = 'block';
        }
    } catch (error) {
        console.error('Error cargando usuario:', error);
    }
}

async function loadCompanies() {
    try {
        // Obtener usuario desde localStorage
        const usuario = JSON.parse(localStorage.getItem('usuario'));
        if (!usuario || !usuario.id) {
            console.error('No hay usuario en localStorage');
            return;
        }

        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/empresas/usuario/${usuario.id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        
        if (data.success && data.data && data.data.length > 0) {
            const selector = document.getElementById('companySelector');
            selector.innerHTML = '';
            
            data.data.forEach(empresa => {
                const option = document.createElement('option');
                option.value = empresa.id;
                option.textContent = empresa.nombre;
                selector.appendChild(option);
            });

            // Seleccionar empresa guardada o primera
            const empresaGuardada = localStorage.getItem('empresaActiva');
            if (empresaGuardada) {
                const empresaObj = JSON.parse(empresaGuardada);
                selector.value = empresaObj.id;
                currentEmpresa = empresaObj;
            } else {
                selector.value = data.data[0].id;
                currentEmpresa = data.data[0];
                localStorage.setItem('empresaActiva', JSON.stringify(currentEmpresa));
            }
            
            // Cargar categorías
            loadCategorias();
        } else {
            document.getElementById('companySelector').innerHTML = '<option value="">Sin empresas asignadas</option>';
        }
    } catch (error) {
        console.error('Error cargando empresas:', error);
        showNotification('Error al cargar empresas', 'error');
    }
}

// ============================================================================
// GESTIÓN DE CATEGORÍAS
// ============================================================================

async function loadCategorias() {
    if (!currentEmpresa) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/categorias?empresaId=${currentEmpresa.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            categorias = data.data || [];
            categoriasOriginal = [...categorias];
            console.log('✅ Categorías cargadas:', categorias.length);
            renderCategorias();
        } else {
            throw new Error('Error al cargar categorías');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al cargar categorías', 'error');
        categorias = [];
        renderCategorias();
    }
}

function renderCategorias() {
    const tbody = document.getElementById('categoriasTableBody');
    const emptyState = document.getElementById('emptyStateCategorias');
    const table = document.getElementById('tableCategorias');

    if (categorias.length === 0) {
        table.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';

    tbody.innerHTML = categorias.map(cat => `
        <tr data-id="${cat.id}">
            <td class="text-center">
                <i class="bi ${cat.icono || 'bi-box'}" style="font-size: 1.8rem; color: ${cat.color || '#9CA3AF'}"></i>
            </td>
            <td>
                <strong>${cat.nombre}</strong>
            </td>
            <td class="text-muted">
                ${cat.descripcion || '<em>Sin descripción</em>'}
            </td>
            <td>
                <span class="badge" style="background-color: ${cat.color || '#9CA3AF'}; color: white;">
                    ${cat.color || '#9CA3AF'}
                </span>
            </td>
            <td class="text-center">
                <span class="badge bg-info" title="Productos con esta categoría">
                    ${cat.productos_count || 0}
                </span>
            </td>
            <td class="text-center">
                ${cat.activo 
                    ? '<span class="badge bg-success">Activa</span>' 
                    : '<span class="badge bg-secondary">Inactiva</span>'
                }
            </td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editarCategoria(${cat.id})" title="Editar">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="eliminarCategoria(${cat.id}, '${cat.nombre}', ${cat.productos_count || 0})" title="Eliminar">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ============================================================================
// MODAL: NUEVA/EDITAR CATEGORÍA
// ============================================================================

function abrirModalNuevo() {
    editingCategoriaId = null;
    document.getElementById('categoriaModalTitle').textContent = 'Nueva Categoría';
    document.getElementById('categoriaForm').reset();
    document.getElementById('categoriaId').value = '';
    document.getElementById('categoriaActivo').checked = true;
    document.getElementById('categoriaColor').value = '#9CA3AF';
    document.getElementById('categoriaIcono').value = 'bi-box';
    updateIconPreview('bi-box');
    
    const modal = new bootstrap.Modal(document.getElementById('categoriaModal'));
    modal.show();
}

async function editarCategoria(id) {
    const categoria = categorias.find(c => c.id === id);
    if (!categoria) {
        showNotification('Categoría no encontrada', 'error');
        return;
    }

    editingCategoriaId = id;
    document.getElementById('categoriaModalTitle').textContent = 'Editar Categoría';
    document.getElementById('categoriaId').value = categoria.id;
    document.getElementById('categoriaNombre').value = categoria.nombre;
    document.getElementById('categoriaDescripcion').value = categoria.descripcion || '';
    document.getElementById('categoriaIcono').value = categoria.icono || 'bi-box';
    document.getElementById('categoriaColor').value = categoria.color || '#9CA3AF';
    document.getElementById('categoriaActivo').checked = categoria.activo;
    updateIconPreview(categoria.icono || 'bi-box');

    const modal = new bootstrap.Modal(document.getElementById('categoriaModal'));
    modal.show();
}

async function guardarCategoria(event) {
    event.preventDefault();

    const id = document.getElementById('categoriaId').value;
    const nombre = document.getElementById('categoriaNombre').value.trim();
    const descripcion = document.getElementById('categoriaDescripcion').value.trim();
    const icono = document.getElementById('categoriaIcono').value;
    const color = document.getElementById('categoriaColor').value;
    const activo = document.getElementById('categoriaActivo').checked;

    if (!nombre) {
        showNotification('El nombre es obligatorio', 'error');
        return;
    }

    // Validar duplicados
    const duplicado = categorias.find(c => 
        c.nombre.toLowerCase() === nombre.toLowerCase() && 
        c.id != id
    );
    if (duplicado) {
        showNotification('Ya existe una categoría con ese nombre', 'error');
        return;
    }

    const categoriaData = {
        empresa_id: currentEmpresa.id,
        nombre,
        descripcion,
        icono,
        color,
        activo: activo ? 1 : 0
    };

    try {
        const token = localStorage.getItem('token');
        const url = id ? `${API_URL}/categorias/${id}` : `${API_URL}/categorias`;
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(categoriaData)
        });

        if (response.ok) {
            showNotification(
                id ? 'Categoría actualizada exitosamente' : 'Categoría creada exitosamente',
                'success'
            );
            
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('categoriaModal'));
            modal.hide();
            
            // Recargar categorías
            await loadCategorias();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Error al guardar categoría');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification(error.message || 'Error al guardar categoría', 'error');
    }
}

async function eliminarCategoria(id, nombre, productosCount) {
    if (productosCount > 0) {
        showNotification(
            `No se puede eliminar. Hay ${productosCount} producto(s) asociado(s) a esta categoría.`,
            'error'
        );
        return;
    }

    if (!confirm(`¿Estás seguro de eliminar la categoría "${nombre}"?`)) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/categorias/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            showNotification('Categoría eliminada exitosamente', 'success');
            await loadCategorias();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Error al eliminar categoría');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification(error.message || 'Error al eliminar categoría', 'error');
    }
}

// ============================================================================
// FILTROS Y BÚSQUEDA
// ============================================================================

function applyFilters() {
    const searchTerm = document.getElementById('searchCategoria').value.toLowerCase();
    const estadoFilter = document.getElementById('filterEstadoCategoria').value;

    categorias = categoriasOriginal.filter(cat => {
        const matchSearch = !searchTerm || 
            cat.nombre.toLowerCase().includes(searchTerm) ||
            (cat.descripcion && cat.descripcion.toLowerCase().includes(searchTerm));
        
        const matchEstado = !estadoFilter || cat.activo == estadoFilter;

        return matchSearch && matchEstado;
    });

    renderCategorias();
}

function clearFilters() {
    document.getElementById('searchCategoria').value = '';
    document.getElementById('filterEstadoCategoria').value = '';
    categorias = [...categoriasOriginal];
    renderCategorias();
}

// ============================================================================
// UTILITIES
// ============================================================================

function updateIconPreview(iconClass) {
    const preview = document.getElementById('iconoPreview');
    preview.className = `bi ${iconClass} ms-2`;
}

function showNotification(message, type = 'info') {
    // Crear Toast
    const toastContainer = document.getElementById('toastContainer') || createToastContainer();
    
    const toastEl = document.createElement('div');
    toastEl.className = 'toast align-items-center border-0';
    toastEl.setAttribute('role', 'alert');
    
    const bgClass = {
        'success': 'bg-success',
        'error': 'bg-danger',
        'warning': 'bg-warning',
        'info': 'bg-info'
    }[type] || 'bg-info';
    
    toastEl.classList.add(bgClass, 'text-white');
    
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    toastContainer.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
    
    // Eliminar después de ocultar
    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
    return container;
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function initEventListeners() {
    // Cambio de empresa
    document.getElementById('companySelector')?.addEventListener('change', async (e) => {
        const empresaId = e.target.value;
        
        try {
            // Obtener usuario desde localStorage
            const usuario = JSON.parse(localStorage.getItem('usuario'));
            const token = localStorage.getItem('token');
            
            const response = await fetch(`${API_URL}/empresas/usuario/${usuario.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await response.json();
            
            if (data.success && data.data) {
                currentEmpresa = data.data.find(emp => emp.id == empresaId);
                localStorage.setItem('empresaActiva', JSON.stringify(currentEmpresa));
                loadCategorias();
            }
        } catch (error) {
            console.error('Error cambiando empresa:', error);
        }
    });

    // Botones nueva categoría
    document.getElementById('btnNuevaCategoria')?.addEventListener('click', abrirModalNuevo);
    document.getElementById('btnNuevaCategoriaEmpty')?.addEventListener('click', abrirModalNuevo);

    // Form submit
    document.getElementById('categoriaForm')?.addEventListener('submit', guardarCategoria);

    // Cambio de icono - preview
    document.getElementById('categoriaIcono')?.addEventListener('change', (e) => {
        updateIconPreview(e.target.value);
    });

    // Búsqueda con debounce
    let searchTimeout;
    document.getElementById('searchCategoria')?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(applyFilters, 300);
    });

    // Filtro de estado
    document.getElementById('filterEstadoCategoria')?.addEventListener('change', applyFilters);

    // Limpiar filtros
    document.getElementById('btnLimpiarFiltros')?.addEventListener('click', clearFilters);

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('selectedCompanyId');
        window.location.href = 'login.html';
    });

    // ============================================================================
    // EMPRESA TAB - Event Listeners
    // ============================================================================
    
    // Cuando se activa la pestaña Empresa, cargar sus datos
    document.getElementById('empresa-tab')?.addEventListener('shown.bs.tab', () => {
        cargarDatosEmpresa();
    });

    // Submit del formulario de empresa
    document.getElementById('empresaForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarDatosEmpresa();
    });

    // Botón cancelar
    document.getElementById('btnCancelarEmpresa')?.addEventListener('click', () => {
        cargarDatosEmpresa(); // Recargar datos originales
    });
}

// ============================================================================
// EMPRESA TAB - Funciones
// ============================================================================

async function cargarDatosEmpresa() {
    const empresaActiva = JSON.parse(localStorage.getItem('empresaActiva') || 'null');
    if (!empresaActiva || !empresaActiva.id) {
        console.error('No hay empresa activa seleccionada');
        showNotification('No hay empresa seleccionada', 'warning');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/empresas/${empresaActiva.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al cargar empresa');
        }

        const data = await response.json();
        if (data.success && data.data) {
            const empresa = data.data;
            
            // Información Básica
            document.getElementById('empresaId').value = empresa.id || '';
            document.getElementById('empresaNombre').value = empresa.nombre || '';
            document.getElementById('empresaRazonSocial').value = empresa.razon_social || '';
            document.getElementById('empresaNit').value = empresa.nit || '';
            document.getElementById('empresaEmail').value = empresa.email || '';
            document.getElementById('empresaTelefono').value = empresa.telefono || '';
            
            // Ubicación
            document.getElementById('empresaDireccion').value = empresa.direccion || '';
            document.getElementById('empresaCiudad').value = empresa.ciudad || '';
            document.getElementById('empresaPais').value = empresa.pais || 'Colombia';
            
            // Información Fiscal
            document.getElementById('empresaRegimenTributario').value = empresa.regimen_tributario || 'simplificado';
            document.getElementById('empresaTipoContribuyente').value = empresa.tipo_contribuyente || 'persona_juridica';
            document.getElementById('empresaGranContribuyente').checked = empresa.gran_contribuyente || false;
            document.getElementById('empresaAutoretenedor').checked = empresa.autoretenedor || false;
            
            // Resolución DIAN
            document.getElementById('empresaResolucionDian').value = empresa.resolucion_dian || '';
            document.getElementById('empresaFechaResolucion').value = empresa.fecha_resolucion || '';
            document.getElementById('empresaFechaResolucionDesde').value = empresa.fecha_resolucion_desde || '';
            document.getElementById('empresaFechaResolucionHasta').value = empresa.fecha_resolucion_hasta || '';
            document.getElementById('empresaPrefijoFactura').value = empresa.prefijo_factura || 'FAC';
            document.getElementById('empresaRangoFacturaDesde').value = empresa.rango_factura_desde || '';
            document.getElementById('empresaRangoFacturaHasta').value = empresa.rango_factura_hasta || '';
            document.getElementById('empresaNumeracionActual').value = empresa.numeracion_actual || 1;
            
            // Branding
            document.getElementById('empresaLogoUrl').value = empresa.logo_url || '';
            document.getElementById('empresaSitioWeb').value = empresa.sitio_web || '';
            document.getElementById('empresaSlogan').value = empresa.slogan || '';
            document.getElementById('empresaDescripcion').value = empresa.descripcion || '';
        }
    } catch (error) {
        console.error('Error al cargar datos de empresa:', error);
        showNotification(error.message || 'Error al cargar los datos de la empresa', 'danger');
    }
}

async function guardarDatosEmpresa() {
    const empresaId = document.getElementById('empresaId').value;
    
    const datosEmpresa = {
        // Información Básica
        nombre: document.getElementById('empresaNombre').value.trim(),
        razon_social: document.getElementById('empresaRazonSocial').value.trim() || null,
        nit: document.getElementById('empresaNit').value.trim(),
        email: document.getElementById('empresaEmail').value.trim(),
        telefono: document.getElementById('empresaTelefono').value.trim() || null,
        
        // Ubicación
        direccion: document.getElementById('empresaDireccion').value.trim() || null,
        ciudad: document.getElementById('empresaCiudad').value.trim() || null,
        pais: document.getElementById('empresaPais').value.trim() || 'Colombia',
        
        // Información Fiscal
        regimen_tributario: document.getElementById('empresaRegimenTributario').value,
        tipo_contribuyente: document.getElementById('empresaTipoContribuyente').value,
        gran_contribuyente: document.getElementById('empresaGranContribuyente').checked,
        autoretenedor: document.getElementById('empresaAutoretenedor').checked,
        
        // Resolución DIAN
        resolucion_dian: document.getElementById('empresaResolucionDian').value.trim() || null,
        fecha_resolucion: document.getElementById('empresaFechaResolucion').value || null,
        fecha_resolucion_desde: document.getElementById('empresaFechaResolucionDesde').value || null,
        fecha_resolucion_hasta: document.getElementById('empresaFechaResolucionHasta').value || null,
        prefijo_factura: document.getElementById('empresaPrefijoFactura').value.trim() || 'FAC',
        rango_factura_desde: parseInt(document.getElementById('empresaRangoFacturaDesde').value) || null,
        rango_factura_hasta: parseInt(document.getElementById('empresaRangoFacturaHasta').value) || null,
        numeracion_actual: parseInt(document.getElementById('empresaNumeracionActual').value) || 1,
        
        // Branding
        logo_url: document.getElementById('empresaLogoUrl').value.trim() || null,
        sitio_web: document.getElementById('empresaSitioWeb').value.trim() || null,
        slogan: document.getElementById('empresaSlogan').value.trim() || null,
        descripcion: document.getElementById('empresaDescripcion').value.trim() || null
    };

    // Validaciones
    if (!datosEmpresa.nombre) {
        showNotification('El nombre de la empresa es obligatorio', 'warning');
        return;
    }
    if (!datosEmpresa.nit) {
        showNotification('El NIT/RUT es obligatorio', 'warning');
        return;
    }
    if (!datosEmpresa.email) {
        showNotification('El email es obligatorio', 'warning');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/empresas/${empresaId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datosEmpresa)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Error al guardar empresa');
        }

        // Actualizar localStorage con el nuevo nombre
        const empresaActiva = JSON.parse(localStorage.getItem('empresaActiva'));
        empresaActiva.nombre = datosEmpresa.nombre;
        localStorage.setItem('empresaActiva', JSON.stringify(empresaActiva));

        // Actualizar selector de empresa en el sidebar
        const companySelector = document.getElementById('companySelector');
        if (companySelector) {
            const option = companySelector.querySelector(`option[value="${empresaId}"]`);
            if (option) option.textContent = datosEmpresa.nombre;
        }

        showNotification('Datos de la empresa actualizados exitosamente', 'success');
        
    } catch (error) {
        console.error('Error al guardar empresa:', error);
        showNotification(error.message || 'Error al guardar los datos', 'danger');
    }
}

// ============================================================================
// Exponer funciones globales para onclick en HTML
// ============================================================================
window.editarCategoria = editarCategoria;
window.eliminarCategoria = eliminarCategoria;
