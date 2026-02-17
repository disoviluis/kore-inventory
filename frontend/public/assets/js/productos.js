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
            companySelector.addEventListener('change', (e) => {
                const empresaId = e.target.value;
                const empresaSeleccionada = data.data.find(emp => emp.id == empresaId);
                localStorage.setItem('empresaActiva', JSON.stringify(empresaSeleccionada));
                // Recargar datos del módulo
                cargarProductos();
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
        
        // IMPORTANTE: Limpiar opciones anteriores (excepto la primera que es "Sin categoría")
        selectCategoria.innerHTML = '<option value="">Todas las categorías</option>';
        selectCategoriaModal.innerHTML = '<option value="">Sin categoría</option>';
        
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

    tbody.innerHTML = items.map((prod, index) => {
        // Determinar qué precio mostrar (prioridad: minorista > venta viejo)
        const precioVenta = prod.precio_minorista || prod.precio_venta || 0;
        const tipoBadge = prod.tipo === 'servicio' ? 
            '<span class="badge bg-info me-1">Servicio</span>' : 
            '<span class="badge bg-primary me-1">Producto</span>';
        
        // Badge de IVA
        const ivaBadge = prod.aplica_iva ? 
            `<span class="badge bg-success me-1" title="IVA ${prod.porcentaje_iva}%">IVA</span>` : '';
        
        // Calcular margen minorista
        const margenMinorista = prod.precio_compra > 0 ? 
            ((precioVenta - prod.precio_compra) / prod.precio_compra * 100) : 0;
        const margenBadge = `<span class="badge ${getMargenBadgeClass(margenMinorista)}" title="Margen">${margenMinorista.toFixed(0)}%</span>`;
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <div class="d-flex align-items-center">
                        ${prod.imagen_url ? 
                            `<img src="${prod.imagen_url}" alt="${prod.nombre}" class="rounded me-2" style="width: 40px; height: 40px; object-fit: cover;">` : 
                            `<div class="bg-light rounded me-2 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;"><i class="bi bi-box text-muted"></i></div>`
                        }
                        <div>
                            <div>${prod.nombre}</div>
                            <small class="text-muted">${tipoBadge}${ivaBadge}${margenBadge}</small>
                        </div>
                    </div>
                </td>
                <td>${prod.sku}</td>
                <td>${prod.categoria_nombre || '-'}</td>
                <td class="text-end">
                    <div>$${Number(prod.precio_compra || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                </td>
                <td class="text-end">
                    <div class="text-primary fw-bold">$${Number(precioVenta).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    ${prod.precio_mayorista ? `<small class="text-muted">May: $${Number(prod.precio_mayorista).toLocaleString('es-CO', {minimumFractionDigits: 0})}</small><br>` : ''}
                    ${prod.precio_distribuidor ? `<small class="text-muted">Dist: $${Number(prod.precio_distribuidor).toLocaleString('es-CO', {minimumFractionDigits: 0})}</small>` : ''}
                </td>
                <td class="text-center">
                    ${prod.tipo === 'servicio' ? 
                        '<span class="text-muted">N/A</span>' :
                        `<span class="badge ${getStockBadgeClass(prod.stock_actual, prod.stock_minimo)}">${prod.stock_actual}</span>`
                    }
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
        `;
    }).join('');
}

function getStockBadgeClass(actual, minimo) {
    if (actual === 0) return 'bg-danger';
    if (actual <= minimo) return 'bg-warning text-dark';
    return 'bg-success';
}

function getMargenBadgeClass(margen) {
    if (margen < 10) return 'bg-danger';
    if (margen < 20) return 'bg-warning text-dark';
    if (margen < 30) return 'bg-info';
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

    // Event listeners para cálculos de precios y márgenes
    const precioCompra = document.getElementById('productoPrecioCompra');
    const precioMinorista = document.getElementById('productoPrecioMinorista');
    const precioMayorista = document.getElementById('productoPrecioMayorista');
    const precioDistribuidor = document.getElementById('productoPrecioDistribuidor');
    
    if (precioCompra) precioCompra.addEventListener('input', calcularMargenes);
    if (precioMinorista) precioMinorista.addEventListener('input', calcularMargenes);
    if (precioMayorista) precioMayorista.addEventListener('input', calcularMargenes);
    if (precioDistribuidor) precioDistribuidor.addEventListener('input', calcularMargenes);

    // Event listeners para cambios en configuración de IVA
    const aplicaIVA = document.getElementById('productoAplicaIVA');
    const porcentajeIVA = document.getElementById('productoPorcentajeIVA');
    const ivaIncluidoSi = document.getElementById('ivaIncluidoSi');
    const ivaIncluidoNo = document.getElementById('ivaIncluidoNo');
    
    if (aplicaIVA) aplicaIVA.addEventListener('change', calcularMargenes);
    if (porcentajeIVA) porcentajeIVA.addEventListener('change', calcularMargenes);
    if (ivaIncluidoSi) ivaIncluidoSi.addEventListener('change', calcularMargenes);
    if (ivaIncluidoNo) ivaIncluidoNo.addEventListener('change', calcularMargenes);

    // Calculadoras de precios
    const btnCalcMayorista = document.getElementById('btnCalcMayorista');
    const btnCalcDistribuidor = document.getElementById('btnCalcDistribuidor');
    
    if (btnCalcMayorista) {
        btnCalcMayorista.addEventListener('click', () => {
            const minorista = parseFloat(precioMinorista.value) || 0;
            if (minorista > 0) {
                precioMayorista.value = (minorista * 0.9).toFixed(2); // 10% descuento
                calcularMargenes();
            }
        });
    }
    
    if (btnCalcDistribuidor) {
        btnCalcDistribuidor.addEventListener('click', () => {
            const minorista = parseFloat(precioMinorista.value) || 0;
            if (minorista > 0) {
                precioDistribuidor.value = (minorista * 0.8).toFixed(2); // 20% descuento
                calcularMargenes();
            }
        });
    }

    // Event listener para tipo de producto
    const productoTipo = document.getElementById('productoTipo');
    if (productoTipo) {
        productoTipo.addEventListener('change', (e) => {
            const seccionInventario = document.getElementById('seccionInventario');
            const manejaInventario = document.getElementById('productoManejaInventario');
            
            if (e.target.value === 'servicio') {
                if (seccionInventario) seccionInventario.style.display = 'none';
                if (manejaInventario) manejaInventario.value = '0';
            } else {
                if (seccionInventario) seccionInventario.style.display = 'block';
                if (manejaInventario) manejaInventario.value = '1';
            }
        });
    }

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
// CÁLCULOS DE PRECIOS Y MÁRGENES
// ============================================

function calcularMargenes() {
    const precioCompra = parseFloat(document.getElementById('productoPrecioCompra').value) || 0;
    const precioMinorista = parseFloat(document.getElementById('productoPrecioMinorista').value) || 0;
    const precioMayorista = parseFloat(document.getElementById('productoPrecioMayorista').value) || 0;
    const precioDistribuidor = parseFloat(document.getElementById('productoPrecioDistribuidor').value) || 0;

    // Calcular márgenes
    const margenMinorista = precioCompra > 0 ? ((precioMinorista - precioCompra) / precioCompra * 100) : 0;
    const margenMayorista = precioCompra > 0 ? ((precioMayorista - precioCompra) / precioCompra * 100) : 0;
    const margenDistribuidor = precioCompra > 0 ? ((precioDistribuidor - precioCompra) / precioCompra * 100) : 0;

    // Actualizar badges de margen
    actualizarBadgeMargen('margenMinorista', margenMinorista);
    actualizarBadgeMargen('margenMayorista', margenMayorista);
    actualizarBadgeMargen('margenDistribuidor', margenDistribuidor);

    // NOTA: Se eliminó la validación de jerarquía de precios
    // El administrador tiene libertad total para establecer precios

    // Actualizar tabla resumen con cálculo de IVA
    updateTablaResumenPrecios();
}

function actualizarBadgeMargen(elementId, margen) {
    const badge = document.getElementById(elementId);
    if (!badge) return;

    badge.textContent = `${margen.toFixed(1)}%`;
    
    // Colorear según el margen
    badge.className = 'badge';
    if (margen < 10) {
        badge.classList.add('bg-danger');
    } else if (margen < 20) {
        badge.classList.add('bg-warning');
    } else if (margen < 30) {
        badge.classList.add('bg-info');
    } else {
        badge.classList.add('bg-success');
    }
}

function updateTablaResumenPrecios() {
    const tbody = document.getElementById('tablaResumenPrecios');
    if (!tbody) return;

    const precioCompra = parseFloat(document.getElementById('productoPrecioCompra').value) || 0;
    const precioMinorista = parseFloat(document.getElementById('productoPrecioMinorista').value) || 0;
    const precioMayorista = parseFloat(document.getElementById('productoPrecioMayorista').value) || 0;
    const precioDistribuidor = parseFloat(document.getElementById('productoPrecioDistribuidor').value) || 0;
    
    const aplicaIVA = document.getElementById('productoAplicaIVA').checked;
    const porcentajeIVA = aplicaIVA ? (parseFloat(document.getElementById('productoPorcentajeIVA').value) || 0) : 0;
    const ivaIncluido = document.querySelector('input[name="ivaIncluido"]:checked')?.value === 'true';

    if (precioMinorista === 0 && precioMayorista === 0 && precioDistribuidor === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Ingrese los precios para ver el resumen</td></tr>';
        return;
    }

    const precios = [
        { nivel: 'Minorista', base: precioMinorista },
        { nivel: 'Mayorista', base: precioMayorista },
        { nivel: 'Distribuidor', base: precioDistribuidor }
    ];

    tbody.innerHTML = precios.map(p => {
        if (p.base === 0) return '';
        
        let precioBase, iva, total;
        
        if (ivaIncluido) {
            // Si el IVA está incluido, calculamos el precio base
            total = p.base;
            precioBase = p.base / (1 + (porcentajeIVA / 100));
            iva = total - precioBase;
        } else {
            // Si el IVA no está incluido, calculamos el total
            precioBase = p.base;
            iva = p.base * (porcentajeIVA / 100);
            total = precioBase + iva;
        }
        
        const margen = precioCompra > 0 ? ((precioBase - precioCompra) / precioCompra * 100) : 0;
        const margenClass = margen < 10 ? 'text-danger' : margen < 20 ? 'text-warning' : margen < 30 ? 'text-info' : 'text-success';
        
        return `
            <tr>
                <td>${p.nivel}</td>
                <td>$${p.base.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td>$${iva.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td><strong>$${total.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
                <td><span class="${margenClass} fw-bold">${margen.toFixed(1)}%</span></td>
            </tr>
        `;
    }).join('');
}

// ============================================
// MODAL PRODUCTO
// ============================================

function abrirModalNuevo() {
    document.getElementById('productoModalTitle').textContent = 'Nuevo Producto';
    document.getElementById('productoForm').reset();
    document.getElementById('productoId').value = '';
    
    // Valores por defecto
    document.getElementById('productoTipo').value = 'producto';
    document.getElementById('productoManejaInventario').value = '1';
    document.getElementById('productoAplicaIVA').checked = false;
    document.getElementById('productoPorcentajeIVA').value = '19';
    document.getElementById('productoTipoImpuesto').value = 'IVA';
    
    // Mostrar sección de inventario
    const seccionInventario = document.getElementById('seccionInventario');
    if (seccionInventario) seccionInventario.style.display = 'block';
    
    // Limpiar alertas
    const alertDiv = document.getElementById('alertJerarquiaPrecios');
    if (alertDiv) alertDiv.style.display = 'none';
    
    // Limpiar badges
    const badges = ['margenMinorista', 'margenMayorista', 'margenDistribuidor'];
    badges.forEach(id => {
        const badge = document.getElementById(id);
        if (badge) {
            badge.textContent = '0%';
            badge.className = 'badge bg-secondary';
        }
    });
    
    // Limpiar tabla resumen
    updateTablaResumenPrecios();
    
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
        
        // Campos básicos
        document.getElementById('productoNombre').value = producto.nombre;
        document.getElementById('productoSku').value = producto.sku;
        document.getElementById('productoDescripcion').value = producto.descripcion || '';
        document.getElementById('productoCategoria').value = producto.categoria_id || '';
        document.getElementById('productoCodigoBarras').value = producto.codigo_barras || '';
        
        // Tipo y configuración
        document.getElementById('productoTipo').value = producto.tipo || 'producto';
        document.getElementById('productoManejaInventario').value = producto.maneja_inventario || '1';
        
        // Precios
        document.getElementById('productoPrecioCompra').value = producto.precio_compra;
        document.getElementById('productoPrecioMinorista').value = producto.precio_minorista || producto.precio_venta; // Compatibilidad
        document.getElementById('productoPrecioMayorista').value = producto.precio_mayorista || '';
        document.getElementById('productoPrecioDistribuidor').value = producto.precio_distribuidor || '';
        
        // IVA
        document.getElementById('productoAplicaIVA').checked = producto.aplica_iva === 1;
        document.getElementById('productoPorcentajeIVA').value = producto.porcentaje_iva || '19';
        document.getElementById('productoTipoImpuesto').value = producto.tipo_impuesto || 'gravado';
        
        // IVA Incluido en Precio
        const ivaIncluido = producto.iva_incluido_en_precio === 1 || producto.iva_incluido_en_precio === true;
        document.getElementById(ivaIncluido ? 'ivaIncluidoSi' : 'ivaIncluidoNo').checked = true;
        
        // Inventario
        document.getElementById('productoStockActual').value = producto.stock_actual;
        document.getElementById('productoStockMinimo').value = producto.stock_minimo;
        document.getElementById('productoStockMaximo').value = producto.stock_maximo || '';
        document.getElementById('productoUnidadMedida').value = producto.unidad_medida || 'unidad';
        document.getElementById('productoUbicacion').value = producto.ubicacion_almacen || '';
        document.getElementById('productoPermiteVentaSinStock').checked = producto.permite_venta_sin_stock === 1 || producto.permite_venta_sin_stock === true;
        
        // Cuentas contables (opcionales)
        if (document.getElementById('productoCuentaIngreso')) {
            document.getElementById('productoCuentaIngreso').value = producto.cuenta_ingreso || '';
        }
        if (document.getElementById('productoCuentaCosto')) {
            document.getElementById('productoCuentaCosto').value = producto.cuenta_costo || '';
        }
        if (document.getElementById('productoCuentaInventario')) {
            document.getElementById('productoCuentaInventario').value = producto.cuenta_inventario || '';
        }
        if (document.getElementById('productoCuentaGasto')) {
            document.getElementById('productoCuentaGasto').value = producto.cuenta_gasto || '';
        }
        
        document.getElementById('productoEstado').value = producto.estado;

        // Mostrar/ocultar sección de inventario según tipo
        const seccionInventario = document.getElementById('seccionInventario');
        if (seccionInventario) {
            seccionInventario.style.display = producto.tipo === 'servicio' ? 'none' : 'block';
        }
        
        // Calcular márgenes
        calcularMargenes();

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

    // NOTA: Se eliminaron las validaciones de jerarquía de precios
    // El administrador tiene libertad total para establecer precios

    const productoData = {
        empresa_id: currentEmpresa.id,
        nombre: document.getElementById('productoNombre').value,
        sku: document.getElementById('productoSku').value,
        descripcion: document.getElementById('productoDescripcion').value,
        categoria_id: document.getElementById('productoCategoria').value || null,
        codigo_barras: document.getElementById('productoCodigoBarras').value,
        
        // Tipo y configuración
        tipo: document.getElementById('productoTipo').value,
        maneja_inventario: document.getElementById('productoManejaInventario').value === '1' ? 1 : 0,
        
        // Precios
        precio_compra: parseFloat(document.getElementById('productoPrecioCompra').value) || 0,
        precio_minorista: parseFloat(document.getElementById('productoPrecioMinorista').value) || 0,
        precio_mayorista: parseFloat(document.getElementById('productoPrecioMayorista').value) || null,
        precio_distribuidor: parseFloat(document.getElementById('productoPrecioDistribuidor').value) || null,
        
        // IVA
        aplica_iva: document.getElementById('productoAplicaIVA').checked ? 1 : 0,
        porcentaje_iva: document.getElementById('productoAplicaIVA').checked ? 
            parseFloat(document.getElementById('productoPorcentajeIVA').value) : null,
        tipo_impuesto: document.getElementById('productoAplicaIVA').checked ? 
            document.getElementById('productoTipoImpuesto').value : null,
        iva_incluido_en_precio: document.querySelector('input[name="ivaIncluido"]:checked').value === 'true',
        
        // Inventario
        stock_actual: parseInt(document.getElementById('productoStockActual').value) || 0,
        stock_minimo: parseInt(document.getElementById('productoStockMinimo').value) || 0,
        stock_maximo: parseInt(document.getElementById('productoStockMaximo').value) || null,
        unidad_medida: document.getElementById('productoUnidadMedida').value,
        ubicacion_almacen: document.getElementById('productoUbicacion').value,
        permite_venta_sin_stock: document.getElementById('productoPermiteVentaSinStock').checked,
        
        estado: document.getElementById('productoEstado').value
    };

    // Agregar cuentas contables si existen en el formulario
    if (document.getElementById('productoCuentaIngreso')) {
        productoData.cuenta_ingreso = document.getElementById('productoCuentaIngreso').value || null;
    }
    if (document.getElementById('productoCuentaCosto')) {
        productoData.cuenta_costo = document.getElementById('productoCuentaCosto').value || null;
    }
    if (document.getElementById('productoCuentaInventario')) {
        productoData.cuenta_inventario = document.getElementById('productoCuentaInventario').value || null;
    }
    if (document.getElementById('productoCuentaGasto')) {
        productoData.cuenta_gasto = document.getElementById('productoCuentaGasto').value || null;
    }

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
