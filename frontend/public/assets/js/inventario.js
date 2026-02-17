/**
 * =================================
 * KORE INVENTORY - INVENTARIO MODULE
 * JavaScript para módulo de inventario
 * =================================
 */

const API_URL = 'http://18.191.181.99:3000/api';
let currentEmpresa = null;
let currentUsuario = null;
let movimientos = [];
let productos = [];

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

        // Configurar visibilidad de PLATAFORMA en sidebar
        if (typeof configurarSidebarSuperAdmin === 'function') {
            configurarSidebarSuperAdmin();
        }

        // Cargar empresas del usuario
        await cargarEmpresas(usuario.id);

        // Obtener empresa activa
        currentEmpresa = JSON.parse(localStorage.getItem('empresaActiva'));
        if (!currentEmpresa) {
            mostrarAlerta('Por favor selecciona una empresa desde el dashboard', 'warning');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
            return;
        }
        
        // Guardar usuario actual
        currentUsuario = usuario;

        // Event Listeners
        document.getElementById('logoutBtn').addEventListener('click', cerrarSesion);
        document.getElementById('btnAjusteInventario').addEventListener('click', abrirModalAjuste);
        document.getElementById('btnAjusteQuick').addEventListener('click', abrirModalAjuste);
        document.getElementById('ajusteForm').addEventListener('submit', guardarAjuste);
        document.getElementById('searchMovimiento').addEventListener('input', filtrarMovimientos);
        document.getElementById('filterTipo').addEventListener('change', filtrarMovimientos);
        document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);
        
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

        // Cambiar stock display cuando se selecciona producto
        document.getElementById('ajusteProducto').addEventListener('change', actualizarStockDisplay);

        // Cargar datos iniciales
        await Promise.all([
            cargarResumen(),
            cargarMovimientos(),
            cargarAlertas(),
            cargarProductosParaAjuste()
        ]);

    } catch (error) {
        console.error('Error en inicialización:', error);
        mostrarAlerta('Error al cargar el módulo', 'danger');
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
// CARGAR EMPRESAS DEL USUARIO
// ============================================

async function cargarEmpresas(usuarioId) {
    const token = localStorage.getItem('token');
    const companySelector = document.getElementById('companySelector');
    
    if (!companySelector) return;
    
    try {
        const response = await fetch(`${API_URL}/empresas/usuario/${usuarioId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.data.length > 0) {
            // Limpiar selector
            companySelector.innerHTML = '';
            
            // Agregar opciones
            data.data.forEach(empresa => {
                const option = document.createElement('option');
                option.value = empresa.id;
                option.textContent = empresa.nombre;
                companySelector.appendChild(option);
            });
            
            // Seleccionar la primera empresa o la guardada
            const empresaGuardada = localStorage.getItem('empresaActiva');
            if (empresaGuardada) {
                const empresaObj = JSON.parse(empresaGuardada);
                companySelector.value = empresaObj.id;
            } else {
                companySelector.value = data.data[0].id;
                localStorage.setItem('empresaActiva', JSON.stringify(data.data[0]));
            }
            
            // Event listener para cambio de empresa
            companySelector.addEventListener('change', async (e) => {
                const empresaId = e.target.value;
                const empresaSeleccionada = data.data.find(emp => emp.id == empresaId);
                localStorage.setItem('empresaActiva', JSON.stringify(empresaSeleccionada));
                // Recargar datos del módulo
                await Promise.all([
                    cargarResumen(),
                    cargarMovimientos(),
                    cargarAlertas(),
                    cargarProductosParaAjuste()
                ]);
            });
            
        } else {
            companySelector.innerHTML = '<option value="">Sin empresas asignadas</option>';
        }
        
    } catch (error) {
        console.error('Error al cargar empresas:', error);
        companySelector.innerHTML = '<option value="">Error al cargar empresas</option>';
    }
}

// ============================================
// CARGAR DATOS
// ============================================

async function cargarResumen() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/inventario/resumen?empresaId=${currentEmpresa.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        
        if (data.success) {
            document.getElementById('statTotalProductos').textContent = data.data.total_productos;
            document.getElementById('statStockBajo').textContent = data.data.productos_alerta;
            document.getElementById('statValorTotal').textContent = formatearMoneda(data.data.valor_inventario);
            document.getElementById('alertasBadge').textContent = data.data.productos_alerta;
        }
    } catch (error) {
        console.error('Error al cargar resumen:', error);
    }
}

async function cargarMovimientos() {
    try {
        const token = localStorage.getItem('token');
        const tipo = document.getElementById('filterTipo').value;
        
        let url = `${API_URL}/inventario?empresaId=${currentEmpresa.id}`;
        if (tipo) url += `&tipo=${tipo}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        
        if (data.success) {
            movimientos = data.data;
            renderizarMovimientos(movimientos);
        }
    } catch (error) {
        console.error('Error al cargar movimientos:', error);
        mostrarAlerta('Error al cargar movimientos', 'danger');
    }
}

async function cargarAlertas() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/inventario/alertas?empresaId=${currentEmpresa.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        
        if (data.success) {
            renderizarAlertas(data.data);
        }
    } catch (error) {
        console.error('Error al cargar alertas:', error);
    }
}

async function cargarProductosParaAjuste() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/productos?empresaId=${currentEmpresa.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        
        if (data.success) {
            productos = data.data.filter(p => p.estado === 'activo');
            const select = document.getElementById('ajusteProducto');
            select.innerHTML = '<option value="">Seleccione un producto...</option>';
            
            productos.forEach(producto => {
                const option = document.createElement('option');
                option.value = producto.id;
                option.textContent = `${producto.nombre} - ${producto.sku}`;
                option.dataset.stock = producto.stock_actual;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
}

// ============================================
// RENDERIZAR DATOS
// ============================================

function renderizarMovimientos(movs) {
    const tbody = document.getElementById('movimientosTableBody');
    const empty = document.getElementById('emptyStateMovimientos');
    
    if (movs.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = movs.map(mov => `
        <tr>
            <td>${formatearFecha(mov.fecha)}</td>
            <td>${mov.producto_nombre}</td>
            <td><code>${mov.sku}</code></td>
            <td><span class="badge bg-${getTipoBadge(mov.tipo_movimiento)}">${mov.tipo_movimiento}</span></td>
            <td><strong>${mov.cantidad}</strong></td>
            <td>${mov.stock_anterior}</td>
            <td>${mov.stock_nuevo}</td>
            <td>${mov.motivo || '-'}</td>
            <td>${mov.usuario_nombre || '-'} ${mov.usuario_apellido || ''}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="verHistorial(${mov.producto_id}, '${mov.producto_nombre}')" title="Ver historial">
                    <i class="bi bi-clock-history"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function renderizarAlertas(alertas) {
    const tbody = document.getElementById('alertasTableBody');
    const empty = document.getElementById('emptyStateAlertas');
    
    if (alertas.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = alertas.map(producto => {
        const faltante = producto.stock_minimo - producto.stock_actual;
        return `
            <tr>
                <td><strong>${producto.nombre}</strong></td>
                <td><code>${producto.sku}</code></td>
                <td><span class="badge bg-danger">${producto.stock_actual}</span></td>
                <td>${producto.stock_minimo}</td>
                <td class="text-danger"><strong>${faltante}</strong></td>
                <td>${producto.ubicacion_almacen || 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="ajusteRapido(${producto.id})" title="Ajuste rápido">
                        <i class="bi bi-plus-circle me-1"></i>Ajustar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// MODALES Y FORMULARIOS
// ============================================

function abrirModalAjuste() {
    document.getElementById('ajusteForm').reset();
    document.getElementById('stockActualDisplay').textContent = '-';
    const modal = new bootstrap.Modal(document.getElementById('ajusteModal'));
    modal.show();
}

function actualizarStockDisplay() {
    const select = document.getElementById('ajusteProducto');
    const stockDisplay = document.getElementById('stockActualDisplay');
    
    if (select.value) {
        const option = select.options[select.selectedIndex];
        stockDisplay.textContent = option.dataset.stock;
    } else {
        stockDisplay.textContent = '-';
    }
}

function ajusteRapido(productoId) {
    const producto = productos.find(p => p.id === productoId);
    if (!producto) return;

    document.getElementById('ajusteProducto').value = productoId;
    actualizarStockDisplay();
    document.getElementById('ajusteTipo').value = 'incremento';
    document.getElementById('ajusteMotivo').value = 'inventario_fisico';
    
    abrirModalAjuste();
}

async function guardarAjuste(e) {
    e.preventDefault();

    const productoId = parseInt(document.getElementById('ajusteProducto').value);
    const tipo = document.getElementById('ajusteTipo').value;
    const cantidad = parseInt(document.getElementById('ajusteCantidad').value);
    const motivo = document.getElementById('ajusteMotivo').value;
    const notas = document.getElementById('ajusteNotas').value;

    if (!productoId || !cantidad || !motivo) {
        mostrarAlerta('Complete todos los campos requeridos', 'warning');
        return;
    }

    const cantidadFinal = tipo === 'incremento' ? cantidad : -cantidad;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/inventario/ajuste`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                producto_id: productoId,
                cantidad: cantidadFinal,
                motivo: motivo,
                notas: notas,
                usuario_id: currentUsuario.id
            })
        });

        const data = await response.json();

        if (data.success) {
            mostrarAlerta('Ajuste registrado exitosamente', 'success');
            bootstrap.Modal.getInstance(document.getElementById('ajusteModal')).hide();
            
            // Recargar datos
            await Promise.all([
                cargarResumen(),
                cargarMovimientos(),
                cargarAlertas()
            ]);
        } else {
            mostrarAlerta(data.message || 'Error al registrar ajuste', 'danger');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al registrar ajuste', 'danger');
    }
}

async function verHistorial(productoId, productoNombre) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/inventario/producto/${productoId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('historialProductoNombre').textContent = `Producto: ${productoNombre}`;
            
            const tbody = document.getElementById('historialTableBody');
            tbody.innerHTML = data.data.map(mov => `
                <tr>
                    <td>${formatearFecha(mov.fecha)}</td>
                    <td><span class="badge bg-${getTipoBadge(mov.tipo_movimiento)}">${mov.tipo_movimiento}</span></td>
                    <td><strong>${mov.cantidad}</strong></td>
                    <td>${mov.stock_anterior} → ${mov.stock_nuevo}</td>
                    <td>${mov.motivo || '-'}</td>
                    <td>${mov.usuario_nombre || '-'}</td>
                </tr>
            `).join('');

            const modal = new bootstrap.Modal(document.getElementById('historialModal'));
            modal.show();
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al cargar historial', 'danger');
    }
}

// ============================================
// FILTROS Y BÚSQUEDA
// ============================================

function filtrarMovimientos() {
    const searchTerm = document.getElementById('searchMovimiento').value.toLowerCase();
    const tipoFilter = document.getElementById('filterTipo').value;

    let filtered = movimientos;

    if (searchTerm) {
        filtered = filtered.filter(mov => 
            mov.producto_nombre.toLowerCase().includes(searchTerm) ||
            mov.sku.toLowerCase().includes(searchTerm)
        );
    }

    if (tipoFilter) {
        filtered = filtered.filter(mov => mov.tipo_movimiento === tipoFilter);
    }

    renderizarMovimientos(filtered);
}

function limpiarFiltros() {
    document.getElementById('searchMovimiento').value = '';
    document.getElementById('filterTipo').value = '';
    document.getElementById('filterFechaInicio').value = '';
    document.getElementById('filterFechaFin').value = '';
    renderizarMovimientos(movimientos);
}

// ============================================
// UTILIDADES
// ============================================

function formatearFecha(fecha) {
    return new Date(fecha).toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(valor);
}

function getTipoBadge(tipo) {
    const badges = {
        'entrada': 'success',
        'salida': 'danger',
        'ajuste': 'warning',
        'devolucion': 'info'
    };
    return badges[tipo] || 'secondary';
}

function mostrarAlerta(mensaje, tipo = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tipo} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    alertDiv.innerHTML = `
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = 'login.html';
}
