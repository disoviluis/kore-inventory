/**
 * =================================
 * KORE INVENTORY - PRODUCTOS MODULE
 * Módulo de gestión de productos
 * =================================
 */

const API_URL = 'http://18.191.181.99:3000/api';
let currentEmpresa = null;
let productos = [];
let categorias = [];

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    // Verificar autenticación
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        // Obtener usuario desde localStorage (ya fue validado en login/dashboard)
        let usuario = JSON.parse(localStorage.getItem('usuario'));
        
        // Si no hay usuario en localStorage, verificar token
        if (!usuario) {
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
        cargarInfoUsuario(usuario);

        // Obtener empresa activa
        currentEmpresa = JSON.parse(localStorage.getItem('empresaActiva'));
        if (!currentEmpresa) {
            mostrarAlerta('Por favor selecciona una empresa desde el dashboard', 'warning');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
            return;
        }

        // Actualizar UI con empresa activa
        document.getElementById('empresaActiva').textContent = currentEmpresa.nombre;

        // Cargar datos iniciales
        await Promise.all([
            cargarCategorias(),
            cargarProductos()
        ]);

        // Inicializar event listeners
        initEventListeners();

    } catch (error) {
        console.error('Error de inicialización:', error);
        mostrarAlerta('Error al inicializar el módulo', 'danger');
    }
});

// ============================================
// CARGAR INFORMACIÓN DEL USUARIO
// ============================================

function cargarInfoUsuario(usuario) {
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    
    if (userName) {
        const nombre = usuario.nombre || '';
        const apellido = usuario.apellido || '';
        userName.textContent = `${nombre} ${apellido}`.trim() || 'Usuario';
    }
    
    if (userRole) {
        userRole.textContent = getTipoUsuarioTexto(usuario.tipo_usuario);
    }
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

// ============================================
// CARGAR CATEGORÍAS
// ============================================

async function cargarCategorias() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/categorias?empresaId=${currentEmpresa.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error al cargar categorías');

        const data = await response.json();
        categorias = data.data || [];

        // Llenar select de categorías
        const selectCategoria = document.getElementById('filterCategoria');
        const selectCategoriaModal = document.getElementById('productoCategoria');
        
        categorias.forEach(cat => {
            const option = `<option value="${cat.id}">${cat.nombre}</option>`;
            selectCategoria.insertAdjacentHTML('beforeend', option);
            selectCategoriaModal.insertAdjacentHTML('beforeend', option);
        });

    } catch (error) {
        console.error('Error al cargar categorías:', error);
    }
}

// ============================================
// CARGAR PRODUCTOS
// ============================================

async function cargarProductos() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/productos?empresaId=${currentEmpresa.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error al cargar productos');

        const data = await response.json();
        productos = data.data || [];

        renderizarProductos(productos);

    } catch (error) {
        console.error('Error al cargar productos:', error);
        mostrarAlerta('Error al cargar productos', 'danger');
    }
}

// ============================================
// RENDERIZAR TABLA DE PRODUCTOS
// ============================================

function renderizarProductos(items) {
    const tbody = document.getElementById('productosTableBody');
    const emptyState = document.getElementById('emptyState');
    const productosTable = document.getElementById('productosTable');
    
    if (!items || items.length === 0) {
        // Ocultar tabla y mostrar empty state
        if (productosTable) productosTable.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        tbody.innerHTML = '';
        return;
    }
    
    // Mostrar tabla y ocultar empty state
    if (productosTable) productosTable.style.display = 'table';
    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = items.map((prod, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>
                <div class="d-flex align-items-center">
                    ${prod.imagen_url ? 
                        `<img src="${prod.imagen_url}" alt="${prod.nombre}" class="rounded me-2" style="width: 40px; height: 40px; object-fit: cover;">` : 
                        `<div class="bg-light rounded me-2 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;"><i class="bi bi-box text-muted"></i></div>`
                    }
                    <span>${prod.nombre}</span>
                </div>
            </td>
            <td>${prod.sku}</td>
            <td>${prod.categoria_nombre || '-'}</td>
            <td class="text-end">$${Number(prod.precio_compra || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td class="text-end">$${Number(prod.precio_venta).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td class="text-center">
                <span class="badge ${getStockBadgeClass(prod.stock_actual, prod.stock_minimo)}">
                    ${prod.stock_actual}
                </span>
            </td>
            <td class="text-center">
                <span class="badge ${prod.estado === 'activo' ? 'bg-success' : 'bg-secondary'}">
                    ${prod.estado === 'activo' ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editarProducto(${prod.id})" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="eliminarProducto(${prod.id})" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getStockBadgeClass(actual, minimo) {
    if (actual === 0) return 'bg-danger';
    if (actual <= minimo) return 'bg-warning text-dark';
    return 'bg-success';
}

// ============================================
// EVENT LISTENERS
// ============================================

function initEventListeners() {
    // Botón nuevo producto
    document.getElementById('btnNuevoProducto').addEventListener('click', abrirModalNuevo);
    
    // Botón nuevo producto quick (si existe)
    const btnQuick = document.getElementById('btnNuevoProductoQuick');
    if (btnQuick) {
        btnQuick.addEventListener('click', (e) => {
            e.preventDefault();
            abrirModalNuevo();
        });
    }
    
    // Botón nuevo producto empty state (si existe)
    const btnEmpty = document.getElementById('btnNuevoProductoEmpty');
    if (btnEmpty) {
        btnEmpty.addEventListener('click', (e) => {
            e.preventDefault();
            abrirModalNuevo();
        });
    }

    // Formulario producto
    document.getElementById('productoForm').addEventListener('submit', guardarProducto);

    // Búsqueda y filtros
    document.getElementById('searchInput').addEventListener('input', filtrarProductos);
    document.getElementById('filterCategoria').addEventListener('change', filtrarProductos);
    document.getElementById('filterEstado').addEventListener('change', filtrarProductos);
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);

    // Cerrar sesión
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        cerrarSesion();
    });

    // Sidebar toggle
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
}

// ============================================
// MODAL PRODUCTO
// ============================================

function abrirModalNuevo() {
    document.getElementById('productoModalTitle').textContent = 'Nuevo Producto';
    document.getElementById('productoForm').reset();
    document.getElementById('productoId').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('productoModal'));
    modal.show();
}

async function editarProducto(id) {
    try {
        const producto = productos.find(p => p.id === id);
        if (!producto) {
            mostrarAlerta('Producto no encontrado', 'danger');
            return;
        }

        document.getElementById('productoModalTitle').textContent = 'Editar Producto';
        document.getElementById('productoId').value = producto.id;
        document.getElementById('productoNombre').value = producto.nombre;
        document.getElementById('productoSku').value = producto.sku;
        document.getElementById('productoDescripcion').value = producto.descripcion || '';
        document.getElementById('productoCategoria').value = producto.categoria_id || '';
        document.getElementById('productoCodigoBarras').value = producto.codigo_barras || '';
        document.getElementById('productoPrecioCompra').value = producto.precio_compra;
        document.getElementById('productoPrecioVenta').value = producto.precio_venta;
        document.getElementById('productoStockActual').value = producto.stock_actual;
        document.getElementById('productoStockMinimo').value = producto.stock_minimo;
        document.getElementById('productoStockMaximo').value = producto.stock_maximo || '';
        document.getElementById('productoUnidadMedida').value = producto.unidad_medida || 'unidad';
        document.getElementById('productoUbicacion').value = producto.ubicacion_almacen || '';
        document.getElementById('productoEstado').value = producto.estado;

        const modal = new bootstrap.Modal(document.getElementById('productoModal'));
        modal.show();

    } catch (error) {
        console.error('Error al editar producto:', error);
        mostrarAlerta('Error al cargar datos del producto', 'danger');
    }
}

// ============================================
// GUARDAR PRODUCTO
// ============================================

async function guardarProducto(e) {
    e.preventDefault();

    const productoId = document.getElementById('productoId').value;
    const token = localStorage.getItem('token');

    const productoData = {
        empresa_id: currentEmpresa.id,
        nombre: document.getElementById('productoNombre').value,
        sku: document.getElementById('productoSku').value,
        descripcion: document.getElementById('productoDescripcion').value,
        categoria_id: document.getElementById('productoCategoria').value || null,
        codigo_barras: document.getElementById('productoCodigoBarras').value,
        precio_compra: parseFloat(document.getElementById('productoPrecioCompra').value) || 0,
        precio_venta: parseFloat(document.getElementById('productoPrecioVenta').value),
        stock_actual: parseInt(document.getElementById('productoStockActual').value) || 0,
        stock_minimo: parseInt(document.getElementById('productoStockMinimo').value) || 0,
        stock_maximo: parseInt(document.getElementById('productoStockMaximo').value) || null,
        unidad_medida: document.getElementById('productoUnidadMedida').value,
        ubicacion_almacen: document.getElementById('productoUbicacion').value,
        estado: document.getElementById('productoEstado').value
    };

    try {
        const url = productoId ? 
            `${API_URL}/productos/${productoId}` : 
            `${API_URL}/productos`;
        
        const method = productoId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(productoData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al guardar producto');
        }

        mostrarAlerta(
            productoId ? 'Producto actualizado exitosamente' : 'Producto creado exitosamente',
            'success'
        );

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('productoModal'));
        modal.hide();

        // Recargar productos
        await cargarProductos();

    } catch (error) {
        console.error('Error al guardar producto:', error);
        mostrarAlerta(error.message || 'Error al guardar producto', 'danger');
    }
}

// ============================================
// ELIMINAR PRODUCTO
// ============================================

async function eliminarProducto(id) {
    if (!confirm('¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/productos/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al eliminar producto');
        }

        mostrarAlerta('Producto eliminado exitosamente', 'success');
        await cargarProductos();

    } catch (error) {
        console.error('Error al eliminar producto:', error);
        mostrarAlerta(error.message || 'Error al eliminar producto', 'danger');
    }
}

// ============================================
// FILTROS Y BÚSQUEDA
// ============================================

function filtrarProductos() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoriaId = document.getElementById('filterCategoria').value;
    const estado = document.getElementById('filterEstado').value;

    let productosFiltrados = productos.filter(prod => {
        const matchSearch = !searchTerm || 
            prod.nombre.toLowerCase().includes(searchTerm) ||
            prod.sku.toLowerCase().includes(searchTerm) ||
            (prod.codigo_barras && prod.codigo_barras.toLowerCase().includes(searchTerm));

        const matchCategoria = !categoriaId || prod.categoria_id == categoriaId;
        const matchEstado = !estado || prod.estado === estado;

        return matchSearch && matchCategoria && matchEstado;
    });

    renderizarProductos(productosFiltrados);
}

function limpiarFiltros() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterCategoria').value = '';
    document.getElementById('filterEstado').value = '';
    renderizarProductos(productos);
}

// ============================================
// CERRAR SESIÓN
// ============================================

function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('empresaActiva');
    window.location.href = 'login.html';
}

// ============================================
// UTILIDADES
// ============================================

function mostrarAlerta(mensaje, tipo = 'info') {
    // Crear elemento de alerta
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tipo} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(alertDiv);

    // Auto-cerrar después de 5 segundos
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}
