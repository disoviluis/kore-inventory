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
            document.getElementById('empresaFechaResolucion').value = empresa.fecha_resolucion ? empresa.fecha_resolucion.split('T')[0] : '';
            document.getElementById('empresaFechaResolucionDesde').value = empresa.fecha_resolucion_desde ? empresa.fecha_resolucion_desde.split('T')[0] : '';
            document.getElementById('empresaFechaResolucionHasta').value = empresa.fecha_resolucion_hasta ? empresa.fecha_resolucion_hasta.split('T')[0] : '';
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

        // Actualizar localStorage con TODOS los datos actualizados de la empresa
        const empresaActiva = JSON.parse(localStorage.getItem('empresaActiva'));
        Object.assign(empresaActiva, datosEmpresa);
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
// PLANTILLA DE FACTURA
// ============================================================================

let plantillaSeleccionada = 1; // Por defecto Clásica
let plantillaPreviewActual = 1;

// Datos de ejemplo para preview
const datosEjemplo = {
    empresa: {
        nombre: 'MI EMPRESA S.A.S.',
        razon_social: 'Mi Empresa Sociedad por Acciones Simplificada',
        nit: '900123456',
        direccion: 'Calle 123 #45-67, Bogotá D.C.',
        telefono: '(601) 234-5678',
        email: 'contacto@miempresa.com',
        sitio_web: 'www.miempresa.com',
        es_gran_contribuyente: true,
        regimen_tributario: 'Régimen Común'
    },
    factura: {
        numero: 'FV-001234',
        fecha: '20/02/2026 14:30',
        cufe: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6'
    },
    cliente: {
        nombre: 'JUAN CARLOS PÉREZ GONZÁLEZ',
        documento: 'CC 1234567890',
        direccion: 'Carrera 45 #67-89',
        telefono: '310 123 4567'
    },
    productos: [
        {nombre: 'Producto A', cantidad: 2, precio: 50000, iva: 9500, subtotal: 109500},
        {nombre: 'Producto B', cantidad: 1, precio: 80000, iva: 15200, subtotal: 95200},
        {nombre: 'Producto C', cantidad: 3, precio: 30000, iva: 17100, subtotal: 107100}
    ],
    totales: {
        subtotal: 250000,
        iva: 47500,
        total: 297500
    }
};

// Función para seleccionar plantilla
function seleccionarPlantilla(plantillaId) {
    plantillaSeleccionada = plantillaId;
    
    // Actualizar visuales de las cards
    document.querySelectorAll('.plantilla-card').forEach(card => {
        card.style.border = '2px solid #e0e0e0';
        const badge = card.querySelector('.badge-success');
        if (badge) badge.remove();
    });
    
    const cardSeleccionada = document.querySelector(`.plantilla-card[data-plantilla-id="${plantillaId}"]`);
    if (cardSeleccionada) {
        cardSeleccionada.style.border = '2px solid #1E40AF';
        const title = cardSeleccionada.querySelector('.card-title');
        if (!title.querySelector('.badge-success')) {
            const badge = document.createElement('span');
            badge.className = 'badge bg-success ms-auto';
            badge.textContent = 'Seleccionada';
            title.appendChild(badge);
        }
    }
    
    showNotification(`Plantilla "${getNombrePlantilla(plantillaId)}" seleccionada`, 'info');
}

// Función para previsualizar plantilla
function previsualizarPlantilla(plantillaId) {
    plantillaPreviewActual = plantillaId;
    mostrarPreviewModal(plantillaId);
}

// Función para previsualizar plantilla actual con personalizaciones
function previsualizarPlantillaActual() {
    mostrarPreviewModal(plantillaSeleccionada, true);
}

// Función para seleccionar plantilla desde el modal de preview
function seleccionarPlantillaDesdePreview() {
    seleccionarPlantilla(plantillaPreviewActual);
    const modal = bootstrap.Modal.getInstance(document.getElementById('previewModal'));
    if (modal) modal.hide();
}

// Mostrar modal de preview
function mostrarPreviewModal(plantillaId, usarPersonalizacion = false) {
    const modal = new bootstrap.Modal(document.getElementById('previewModal'));
    const nombrePlantilla = getNombrePlantilla(plantillaId);
    
    document.getElementById('previewPlantillaNombre').textContent = nombrePlantilla;
    
    // Generar preview inicial
    generarPreview('carta', plantillaId, usarPersonalizacion);
    
    // Event listeners para cambio de formato
    document.querySelectorAll('input[name="previewFormato"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            generarPreview(e.target.value, plantillaId, usarPersonalizacion);
        });
    });
    
    modal.show();
}

// Generar HTML de preview según plantilla y formato
function generarPreview(formato, plantillaId, usarPersonalizacion = false) {
    const container = document.getElementById('previewContainer');
    
    // Obtener colores personalizados si aplica
    const colorPrimario = usarPersonalizacion ? 
        document.getElementById('plantillaColorPrimario').value : '#1E40AF';
    const colorSecundario = usarPersonalizacion ? 
        document.getElementById('plantillaColorSecundario').value : '#6c757d';
    const fuente = usarPersonalizacion ? 
        document.getElementById('plantillaFuente').value : 'Arial';
    const mostrarLogo = !usarPersonalizacion || document.getElementById('plantillaMostrarLogo').checked;
    const mostrarQR = !usarPersonalizacion || document.getElementById('plantillaMostrarQR').checked;
    const mostrarBadges = !usarPersonalizacion || document.getElementById('plantillaMostrarBadges').checked;
    
    let html = '';
    
    if (formato === 'tirilla') {
        // Preview de tirilla térmica
        container.style.maxWidth = '300px';
        html = generarPreviewTirilla(plantillaId, colorPrimario);
    } else if (formato === 'media-carta') {
        // Preview de media carta
        container.style.maxWidth = '550px';
        html = generarPreviewMediaCarta(plantillaId, colorPrimario, colorSecundario, fuente, mostrarLogo, mostrarQR, mostrarBadges);
    } else {
        // Preview de carta (default)
        container.style.maxWidth = '800px';
        html = generarPreviewCarta(plantillaId, colorPrimario, colorSecundario, fuente, mostrarLogo, mostrarQR, mostrarBadges);
    }
    
    container.innerHTML = html;
}

// Generar preview formato CARTA
function generarPreviewCarta(plantillaId, colorPrimario, colorSecundario, fuente, mostrarLogo, mostrarQR, mostrarBadges) {
    const d = datosEjemplo;
    
    let html = `
        <div style="font-family: ${fuente}, sans-serif; padding: 20px; font-size: 10pt;">
    `;
    
    // PLANTILLA CLÁSICA
    if (plantillaId === 1) {
        html += `
            <!-- Encabezado Centrado -->
            <div style="text-align: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid ${colorPrimario};">
                ${mostrarLogo ? `<div style="margin-bottom: 8px;">🏢 LOGO</div>` : ''}
                <h2 style="color: ${colorPrimario}; margin: 5px 0; font-size: 16pt;">${d.empresa.nombre}</h2>
                <p style="margin: 3px 0; font-size: 9pt;">${d.empresa.razon_social}</p>
                <p style="margin: 3px 0; font-size: 9pt;">NIT: ${d.empresa.nit} | ${d.empresa.telefono}</p>
                <p style="margin: 3px 0; font-size: 9pt;">${d.empresa.direccion}</p>
                ${mostrarBadges && d.empresa.es_gran_contribuyente ? `<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 3px; font-size: 7pt;">Gran Contribuyente</span>` : ''}
            </div>
            
            <div style="text-align: center; font-size: 12pt; font-weight: bold; margin: 15px 0; padding: 10px; border: 2px solid ${colorPrimario}; background: ${colorPrimario}15;">
                FACTURA ELECTRÓNICA DE VENTA<br>${d.factura.numero}
            </div>
        `;
    }
    
    // PLANTILLA MODERNA
    else if (plantillaId === 2) {
        html += `
            <!-- Encabezado Lateral -->
            <div style="display: flex; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 3px solid ${colorPrimario};">
                ${mostrarLogo ? `<div style="font-size: 48pt; margin-right: 15px;">🏢</div>` : ''}
                <div style="flex-grow: 1;">
                    <h2 style="color: ${colorPrimario}; margin: 0; font-size: 18pt;">${d.empresa.nombre}</h2>
                    <p style="margin: 3px 0; font-size: 9pt; color: ${colorSecundario};">${d.empresa.razon_social}</p>
                    <p style="margin: 3px 0; font-size: 8pt;">NIT: ${d.empresa.nit} | ${d.empresa.telefono}</p>
                </div>
                ${mostrarBadges && d.empresa.es_gran_contribuyente ? `<div style="background: linear-gradient(135deg, ${colorPrimario}, #0ea5e9); color: white; padding: 8px 12px; border-radius: 8px; font-size: 8pt; text-align: center;"><strong>GRAN<br>CONTRIBUYENTE</strong></div>` : ''}
            </div>
            
            <div style="background: ${colorPrimario}; color: white; text-align: center; font-size: 13pt; font-weight: bold; padding: 12px; border-radius: 8px; margin: 15px 0;">
                FACTURA ELECTRÓNICA ${d.factura.numero}
            </div>
        `;
    }
    
    // PLANTILLA MINIMALISTA
    else if (plantillaId === 3) {
        html += `
            <!-- Encabezado Minimalista -->
            <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e0e0e0;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h2 style="color: ${colorPrimario}; margin: 0 0 8px 0; font-size: 20pt; font-weight: 300;">${d.empresa.nombre}</h2>
                        <p style="margin: 2px 0; font-size: 8pt; color: #999;">${d.empresa.razon_social}</p>
                        <p style="margin: 2px 0; font-size: 8pt; color: #999;">NIT: ${d.empresa.nit}</p>
                    </div>
                    ${mostrarLogo ? `<div style="width: 80px; height: 80px; border: 1px solid #e0e0e0; display: flex; align-items: center; justify-content: center; color: #ccc;">LOGO</div>` : ''}
                </div>
            </div>
            
            <div style="font-size: 11pt; font-weight: 300; margin: 20px 0; padding: 15px 0; border-top: 3px solid ${colorPrimario}; border-bottom: 1px solid ${colorPrimario};">
                <strong>FACTURA</strong> ${d.factura.numero}
            </div>
        `;
    }
    
    // Información común (cliente y fecha)
    html += `
        <div style="display: flex; gap: 15px; margin: 15px 0;">
            <div style="flex: 1; border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
                <strong style="color: ${colorPrimario};">Fecha:</strong><br>
                <span style="font-size: 9pt;">${d.factura.fecha}</span>
            </div>
            <div style="flex: 2; border: 1px solid #ddd; padding: 10px; border-radius: 5px;">
                <strong style="color: ${colorPrimario};">Cliente:</strong><br>
                <span style="font-size: 9pt;">${d.cliente.nombre}<br>${d.cliente.documento}</span>
            </div>
        </div>
        
        <!-- Tabla de productos -->
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 9pt;">
            <thead>
                <tr style="background: ${colorPrimario}15;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">#</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Descripción</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Cant.</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Precio</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    d.productos.forEach((p, i) => {
        html += `
            <tr${plantillaId === 2 && i % 2 === 1 ? ` style="background: #f9f9f9;"` : ''}>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${i + 1}</td>
                <td style="border: 1px solid #ddd; padding: 6px;">${p.nombre}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${p.cantidad}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">$${p.precio.toLocaleString('es-CO')}</td>
                <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">$${p.subtotal.toLocaleString('es-CO')}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
        
        <!-- Totales -->
        <div style="display: flex; justify-content: flex-end; margin: 15px 0;">
            <div style="width: 250px;">
                <table style="width: 100%; font-size: 9pt;">
                    <tr>
                        <td style="padding: 5px; border-bottom: 1px solid #ddd;">Subtotal:</td>
                        <td style="padding: 5px; text-align: right; border-bottom: 1px solid #ddd;">$${d.totales.subtotal.toLocaleString('es-CO')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px; border-bottom: 1px solid #ddd;">IVA (19%):</td>
                        <td style="padding: 5px; text-align: right; border-bottom: 1px solid #ddd;">$${d.totales.iva.toLocaleString('es-CO')}</td>
                    </tr>
                    <tr style="background: ${colorPrimario}; color: white; font-weight: bold; font-size: 10pt;">
                        <td style="padding: 8px;">TOTAL:</td>
                        <td style="padding: 8px; text-align: right;">$${d.totales.total.toLocaleString('es-CO')}</td>
                    </tr>
                </table>
            </div>
        </div>
        
        ${mostrarQR ? `
        <!-- QR y CUFE -->
        <div style="margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 5px; text-align: center;">
            <div style="font-size: 8pt; color: #666;">
                <strong>CUFE:</strong> ${d.factura.cufe.substring(0, 40)}...
            </div>
            <div style="margin-top: 8px;">📱 QR CODE</div>
        </div>
        ` : ''}
        
        </div>
    `;
    
    return html;
}

// Generar preview formato MEDIA CARTA (simplificado)
function generarPreviewMediaCarta(plantillaId, colorPrimario, colorSecundario, fuente, mostrarLogo, mostrarQR, mostrarBadges) {
    // Versión compacta del preview de carta
    return generarPreviewCarta(plantillaId, colorPrimario, colorSecundario, fuente, mostrarLogo, mostrarQR, mostrarBadges)
        .replace(/font-size: 10pt/g, 'font-size: 8pt')
        .replace(/font-size: 16pt/g, 'font-size: 12pt')
        .replace(/font-size: 18pt/g, 'font-size: 14pt')
        .replace(/padding: 20px/g, 'padding: 12px');
}

// Generar preview formato TIRILLA
function generarPreviewTirilla(plantillaId, colorPrimario) {
    const d = datosEjemplo;
    
    return `
        <div style="font-family: 'Courier New', monospace; padding: 8px; font-size: 8pt; background: white;">
            <div style="text-align: center; font-weight: bold; margin-bottom: 8px;">
                ${d.empresa.nombre}
            </div>
            <div style="text-align: center; font-size: 7pt; margin-bottom: 5px;">
                NIT: ${d.empresa.nit}<br>
                ${d.empresa.telefono}
            </div>
            <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            <div style="text-align: center; font-weight: bold;">
                FACTURA ${d.factura.numero}
            </div>
            <div style="text-align: center; font-size: 7pt; margin-bottom: 5px;">
                ${d.factura.fecha}
            </div>
            <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            <div style="font-size: 7pt; margin-bottom: 5px;">
                <strong>Cliente:</strong><br>
                ${d.cliente.nombre}<br>
                ${d.cliente.documento}
            </div>
            <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            
            ${d.productos.map(p => `
                <div style="margin: 5px 0;">
                    <strong>${p.nombre}</strong><br>
                    <div style="display: flex; justify-content: space-between; font-size: 7pt;">
                        <span>${p.cantidad} x $${p.precio.toLocaleString('es-CO')}</span>
                        <span>$${p.subtotal.toLocaleString('es-CO')}</span>
                    </div>
                </div>
            `).join('')}
            
            <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            <div style="display: flex; justify-content: space-between; margin: 3px 0;">
                <span>Subtotal:</span>
                <span>$${d.totales.subtotal.toLocaleString('es-CO')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 3px 0;">
                <span>IVA:</span>
                <span>$${d.totales.iva.toLocaleString('es-CO')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 3px 0; font-weight: bold; font-size: 9pt;">
                <span>TOTAL:</span>
                <span>$${d.totales.total.toLocaleString('es-CO')}</span>
            </div>
            <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            <div style="text-align: center; font-size: 7pt; margin-top: 8px;">
                ¡Gracias por su compra!
            </div>
        </div>
    `;
}

// Función para guardar configuración de plantilla
async function guardarConfiguracionPlantilla() {
    try {
        if (!currentEmpresa || !currentEmpresa.id) {
            showNotification('No hay empresa seleccionada', 'warning');
            return;
        }

        const config = {
            empresa_id: currentEmpresa.id,
            plantilla_id: plantillaSeleccionada,
            color_primario: document.getElementById('plantillaColorPrimario').value,
            color_secundario: document.getElementById('plantillaColorSecundario').value,
            fuente: document.getElementById('plantillaFuente').value,
            tamano_fuente: parseInt(document.getElementById('plantillaTamanoFuente').value),
            mostrar_logo: document.getElementById('plantillaMostrarLogo').checked,
            mostrar_qr: document.getElementById('plantillaMostrarQR').checked,
            mostrar_cufe: document.getElementById('plantillaMostrarCUFE').checked,
            mostrar_badges: document.getElementById('plantillaMostrarBadges').checked,
            logo_posicion: document.getElementById('plantillaLogoPos').value
        };

        const token = localStorage.getItem('token');
        
        // Por ahora guardar en la tabla configuracion_factura existente
        // TODO: Cuando se cree la tabla plantillas_factura, actualizar este endpoint
        const response = await fetch(`${API_URL}/facturacion/configuracion/${currentEmpresa.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(config)
        });

        const data = await response.json();
        
        if (data.success) {
            showNotification('Configuración de plantilla guardada exitosamente', 'success');
        } else {
            throw new Error(data.message || 'Error al guardar configuración');
        }
        
    } catch (error) {
        console.error('Error al guardar configuración de plantilla:', error);
        showNotification(error.message || 'Error al guardar la configuración', 'danger');
    }
}

// Función para cargar configuración existente de plantilla
async function cargarConfiguracionPlantilla() {
    try {
        if (!currentEmpresa || !currentEmpresa.id) return;

        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/facturacion/configuracion/${currentEmpresa.id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        
        if (data.success && data.data) {
            const config = data.data;
            
            // Cargar valores en los campos
            if (config.plantilla_id) {
                plantillaSeleccionada = config.plantilla_id;
                seleccionarPlantilla(config.plantilla_id);
            }
            
            if (config.color_primario) {
                document.getElementById('plantillaColorPrimario').value = config.color_primario;
            }
            if (config.color_secundario) {
                document.getElementById('plantillaColorSecundario').value = config.color_secundario;
            }
            if (config.fuente) {
                document.getElementById('plantillaFuente').value = config.fuente;
            }
            if (config.tamano_fuente) {
                document.getElementById('plantillaTamanoFuente').value = config.tamano_fuente;
            }
            
            document.getElementById('plantillaMostrarLogo').checked = config.mostrar_logo !== false;
            document.getElementById('plantillaMostrarQR').checked = config.mostrar_qr !== false;
            document.getElementById('plantillaMostrarCUFE').checked = config.mostrar_cufe !== false;
            document.getElementById('plantillaMostrarBadges').checked = config.mostrar_badges !== false;
            
            if (config.logo_posicion) {
                document.getElementById('plantillaLogoPos').value = config.logo_posicion;
            }
        }
        
    } catch (error) {
        console.error('Error al cargar configuración de plantilla:', error);
    }
}

// Helper: Obtener nombre de plantilla
function getNombrePlantilla(plantillaId) {
    const nombres = {
        1: 'Clásica',
        2: 'Moderna',
        3: 'Minimalista'
    };
    return nombres[plantillaId] || 'Desconocida';
}

// Cargar configuración cuando se cambia de empresa
const originalLoadCompany = window.loadCompany || function() {};
window.loadCompany = function(empresaId) {
    originalLoadCompany(empresaId);
    
    // Cargar configuración de plantilla si estamos en esa tab
    const plantillaTab = document.getElementById('plantilla-tab');
    if (plantillaTab && plantillaTab.classList.contains('active')) {
        setTimeout(() => cargarConfiguracionPlantilla(), 500);
    }
};

// Event listener para cargar config cuando se hace clic en la pestaña
document.addEventListener('DOMContentLoaded', () => {
    const plantillaTab = document.getElementById('plantilla-tab');
    if (plantillaTab) {
        plantillaTab.addEventListener('click', () => {
            setTimeout(() => cargarConfiguracionPlantilla(), 300);
        });
    }
});

// ============================================================================
// Exponer funciones globales para onclick en HTML
// ============================================================================
window.editarCategoria = editarCategoria;
window.eliminarCategoria = eliminarCategoria;
window.seleccionarPlantilla = seleccionarPlantilla;
window.previsualizarPlantilla = previsualizarPlantilla;
window.previsualizarPlantillaActual = previsualizarPlantillaActual;
window.guardarConfiguracionPlantilla = guardarConfiguracionPlantilla;
window.seleccionarPlantillaDesdePreview = seleccionarPlantillaDesdePreview;
