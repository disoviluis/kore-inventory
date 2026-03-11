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
    const btnCalcMinimo = document.getElementById('btnCalcMinimo');
    const btnCalcMaximo = document.getElementById('btnCalcMaximo');
    
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

    if (btnCalcMinimo) {
        btnCalcMinimo.addEventListener('click', () => {
            const costo = parseFloat(precioCompra.value) || 0;
            if (costo > 0) {
                const precioMinimoInput = document.getElementById('productoPrecioMinimo');
                precioMinimoInput.value = (costo * 1.05).toFixed(2); // Costo + 5%
            }
        });
    }

    if (btnCalcMaximo) {
        btnCalcMaximo.addEventListener('click', () => {
            const minorista = parseFloat(precioMinorista.value) || 0;
            if (minorista > 0) {
                const precioMaximoInput = document.getElementById('productoPrecioMaximo');
                precioMaximoInput.value = (minorista * 1.5).toFixed(2); // Minorista + 50%
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
    
    // Exportar e Importar
    document.getElementById('btnExportar').addEventListener('click', exportarProductos);
    document.getElementById('btnImportar').addEventListener('click', abrirModalImportar);
    document.getElementById('btnDescargarPlantilla').addEventListener('click', descargarPlantilla);
    document.getElementById('btnSeleccionarArchivo').addEventListener('click', () => {
        document.getElementById('archivoExcel').click();
    });
    document.getElementById('archivoExcel').addEventListener('change', procesarArchivoExcel);
    document.getElementById('btnConfirmarImportacion').addEventListener('click', confirmarImportacion);
    
    // Preview de imagen
    const imagenUrlInput = document.getElementById('productoImagenUrl');
    if (imagenUrlInput) {
        imagenUrlInput.addEventListener('input', actualizarPreviewImagen);
        imagenUrlInput.addEventListener('blur', actualizarPreviewImagen);
    }

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
    
    // Limpiar preview de imagen
    const previewImg = document.getElementById('imagenPreviewImg');
    const previewPlaceholder = document.getElementById('imagenPreviewPlaceholder');
    if (previewImg) previewImg.style.display = 'none';
    if (previewPlaceholder) {
        previewPlaceholder.style.display = 'block';
        previewPlaceholder.innerHTML = `
            <i class="bi bi-image text-muted" style="font-size: 2rem;"></i>
            <p class="text-muted small mb-0">Vista previa</p>
        `;
    }
    
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
        document.getElementById('productoImagenUrl').value = producto.imagen_url || '';
        
        // Actualizar preview de imagen
        actualizarPreviewImagen();
        
        // Tipo y configuración
        document.getElementById('productoTipo').value = producto.tipo || 'producto';
        document.getElementById('productoManejaInventario').value = producto.maneja_inventario || '1';
        
        // Precios
        document.getElementById('productoPrecioCompra').value = producto.precio_compra;
        document.getElementById('productoPrecioMinorista').value = producto.precio_minorista || producto.precio_venta; // Compatibilidad
        document.getElementById('productoPrecioMayorista').value = producto.precio_mayorista || '';
        document.getElementById('productoPrecioDistribuidor').value = producto.precio_distribuidor || '';
        document.getElementById('productoPrecioMinimo').value = producto.precio_minimo || '';
        document.getElementById('productoPrecioMaximo').value = producto.precio_maximo || '';
        
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
        imagen_url: document.getElementById('productoImagenUrl').value || null,
        
        // Tipo y configuración
        tipo: document.getElementById('productoTipo').value,
        maneja_inventario: document.getElementById('productoManejaInventario').value === '1' ? 1 : 0,
        
        // Precios
        precio_compra: parseFloat(document.getElementById('productoPrecioCompra').value) || 0,
        precio_minorista: parseFloat(document.getElementById('productoPrecioMinorista').value) || 0,
        precio_mayorista: parseFloat(document.getElementById('productoPrecioMayorista').value) || null,
        precio_distribuidor: parseFloat(document.getElementById('productoPrecioDistribuidor').value) || null,
        precio_minimo: parseFloat(document.getElementById('productoPrecioMinimo').value) || null,
        precio_maximo: parseFloat(document.getElementById('productoPrecioMaximo').value) || null,
        
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

/**
 * Actualizar preview de imagen del producto
 */
function actualizarPreviewImagen() {
    const urlInput = document.getElementById('productoImagenUrl');
    const previewImg = document.getElementById('imagenPreviewImg');
    const previewPlaceholder = document.getElementById('imagenPreviewPlaceholder');
    
    if (!urlInput || !previewImg || !previewPlaceholder) return;
    
    const url = urlInput.value.trim();
    
    if (url) {
        // Validar que sea una URL válida
        try {
            new URL(url);
            previewImg.src = url;
            previewImg.style.display = 'block';
            previewPlaceholder.style.display = 'none';
            
            // Manejar error de carga
            previewImg.onerror = function() {
                previewImg.style.display = 'none';
                previewPlaceholder.style.display = 'block';
                previewPlaceholder.innerHTML = `
                    <i class="bi bi-exclamation-triangle text-warning" style="font-size: 2rem;"></i>
                    <p class="text-warning small mb-0">Error al cargar</p>
                `;
            };
        } catch (e) {
            previewImg.style.display = 'none';
            previewPlaceholder.style.display = 'block';
        }
    } else {
        previewImg.style.display = 'none';
        previewPlaceholder.style.display = 'block';
        previewPlaceholder.innerHTML = `
            <i class="bi bi-image text-muted" style="font-size: 2rem;"></i>
            <p class="text-muted small mb-0">Vista previa</p>
        `;
    }
}

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

// ============================================
// EXPORTAR PRODUCTOS A EXCEL
// ============================================

function exportarProductos() {
    if (!productos || productos.length === 0) {
        mostrarAlerta('No hay productos para exportar', 'warning');
        return;
    }

    try {
        // Preparar datos para exportar
        const datosExportar = productos.map(p => ({
            'ID': p.id,
            'Tipo': p.tipo,
            'Maneja Inventario': p.maneja_inventario ? 'Sí' : 'No',
            'Nombre': p.nombre,
            'Descripción': p.descripcion || '',
            'SKU': p.sku,
            'Código de Barras': p.codigo_barras || '',
            'Categoría': p.categoria_nombre || 'Sin categoría',
            'Precio Compra': p.precio_compra,
            'Precio Minorista': p.precio_minorista,
            'Precio Mayorista': p.precio_mayorista || '',
            'Precio Distribuidor': p.precio_distribuidor || '',
            'Precio Mínimo': p.precio_minimo || '',
            'Precio Máximo': p.precio_maximo || '',
            'Aplica IVA': p.aplica_iva ? 'Sí' : 'No',
            'Porcentaje IVA': p.porcentaje_iva || 0,
            'Tipo Impuesto': p.tipo_impuesto,
            'IVA Incluido': p.iva_incluido_en_precio ? 'Sí' : 'No',
            'Stock Actual': p.stock_actual,
            'Stock Mínimo': p.stock_minimo,
            'Stock Máximo': p.stock_maximo || '',
            'Unidad Medida': p.unidad_medida,
            'Ubicación Almacén': p.ubicacion_almacen || '',
            'Permite Venta Sin Stock': p.permite_venta_sin_stock ? 'Sí' : 'No',
            'Imagen URL': p.imagen_url || '',
            'Estado': p.estado,
            'Cuenta Ingreso': p.cuenta_ingreso || '',
            'Cuenta Costo': p.cuenta_costo || '',
            'Cuenta Inventario': p.cuenta_inventario || '',
            'Cuenta Gasto': p.cuenta_gasto || '',
            'Margen Minorista (%)': p.margen_minorista || 0,
            'Margen Mayorista (%)': p.margen_mayorista || 0,
            'Margen Distribuidor (%)': p.margen_distribuidor || 0
        }));

        // Crear libro de Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(datosExportar);

        // Ajustar ancho de columnas
        const colWidths = [
            { wch: 6 },   // ID
            { wch: 10 },  // Tipo
            { wch: 18 },  // Maneja Inventario
            { wch: 30 },  // Nombre
            { wch: 40 },  // Descripción
            { wch: 15 },  // SKU
            { wch: 18 },  // Código Barras
            { wch: 20 },  // Categoría
            { wch: 15 },  // Precio Compra
            { wch: 15 },  // Precio Minorista
            { wch: 15 },  // Precio Mayorista
            { wch: 18 },  // Precio Distribuidor
            { wch: 15 },  // Precio Mínimo
            { wch: 15 },  // Precio Máximo
            { wch: 12 },  // Aplica IVA
            { wch: 15 },  // Porcentaje IVA
            { wch: 15 },  // Tipo Impuesto
            { wch: 13 },  // IVA Incluido
            { wch: 12 },  // Stock Actual
            { wch: 12 },  // Stock Mínimo
            { wch: 12 }   // Stock Máximo
        ];
        ws['!cols'] = colWidths;

        // Agregar hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Productos');

        // Descargar archivo
        const nombreEmpresa = currentEmpresa.nombre.replace(/[^a-zA-Z0-9]/g, '_');
        const fecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `productos_${nombreEmpresa}_${fecha}.xlsx`);

        mostrarAlerta(`${productos.length} productos exportados exitosamente`, 'success');

    } catch (error) {
        console.error('Error al exportar productos:', error);
        mostrarAlerta('Error al exportar productos a Excel', 'danger');
    }
}

// ============================================
// DESCARGAR PLANTILLA DE IMPORTACIÓN
// ============================================

function descargarPlantilla() {
    try {
        // Datos de ejemplo para la plantilla
        const plantillaData = [
            {
                'Nombre': 'Producto de Ejemplo',
                'SKU': 'PROD-001',
                'Descripción': 'Descripción detallada del producto',
                'Tipo': 'producto',
                'Maneja Inventario': 'Sí',
                'Código de Barras': '7890123456789',
                'Categoría': 'Nombre de categoría existente',
                'Precio Compra': 1000,
                'Precio Minorista': 1500,
                'Precio Mayorista': 1300,
                'Precio Distribuidor': 1200,
                'Precio Mínimo': 1050,
                'Precio Máximo': 2000,
                'Aplica IVA': 'Sí',
                'Porcentaje IVA': 19,
                'Tipo Impuesto': 'gravado',
                'IVA Incluido': 'No',
                'Stock Actual': 100,
                'Stock Mínimo': 10,
                'Stock Máximo': 500,
                'Unidad Medida': 'unidad',
                'Ubicación Almacén': 'Estante A1',
                'Permite Venta Sin Stock': 'No',
                'Imagen URL': 'https://ejemplo.com/imagen.jpg',
                'Estado': 'activo'
            }
        ];

        // Crear hoja de datos
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(plantillaData);

        // Ajustar ancho de columnas
        const colWidths = [
            { wch: 30 },  // Nombre
            { wch: 15 },  // SKU
            { wch: 40 },  // Descripción
            { wch: 10 },  // Tipo
            { wch: 18 },  // Maneja Inventario
            { wch: 18 },  // Código Barras
            { wch: 25 },  // Categoría
            { wch: 15 },  // Precios...
        ];
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, 'Productos');

        // Crear hoja de instrucciones
        const instrucciones = [
            { 'Columna': 'Nombre', 'Requerido': 'SÍ', 'Descripción': 'Nombre del producto (máximo 200 caracteres)' },
            { 'Columna': 'SKU', 'Requerido': 'SÍ', 'Descripción': 'Código SKU único (máximo 100 caracteres)' },
            { 'Columna': 'Descripción', 'Requerido': 'NO', 'Descripción': 'Descripción detallada del producto' },
            { 'Columna': 'Tipo', 'Requerido': 'NO', 'Descripción': 'producto o servicio (por defecto: producto)' },
            { 'Columna': 'Maneja Inventario', 'Requerido': 'NO', 'Descripción': 'Sí o No (por defecto: Sí)' },
            { 'Columna': 'Código de Barras', 'Requerido': 'NO', 'Descripción': 'Código de barras del producto' },
            { 'Columna': 'Categoría', 'Requerido': 'NO', 'Descripción': 'Nombre exacto de categoría existente' },
            { 'Columna': 'Precio Compra', 'Requerido': 'NO', 'Descripción': 'Costo del producto (por defecto: 0)' },
            { 'Columna': 'Precio Minorista', 'Requerido': 'SÍ', 'Descripción': 'Precio de venta al público' },
            { 'Columna': 'Precio Mayorista', 'Requerido': 'NO', 'Descripción': 'Precio para mayoristas' },
            { 'Columna': 'Precio Distribuidor', 'Requerido': 'NO', 'Descripción': 'Precio para distribuidores' },
            { 'Columna': 'Precio Mínimo', 'Requerido': 'NO', 'Descripción': 'Precio mínimo de venta' },
            { 'Columna': 'Precio Máximo', 'Requerido': 'NO', 'Descripción': 'Precio máximo sugerido' },
            { 'Columna': 'Aplica IVA', 'Requerido': 'NO', 'Descripción': 'Sí o No (por defecto: Sí)' },
            { 'Columna': 'Porcentaje IVA', 'Requerido': 'NO', 'Descripción': '0, 5 o 19 (por defecto: 19)' },
            { 'Columna': 'Tipo Impuesto', 'Requerido': 'NO', 'Descripción': 'gravado, exento o excluido (por defecto: gravado)' },
            { 'Columna': 'IVA Incluido', 'Requerido': 'NO', 'Descripción': 'Sí o No (por defecto: No)' },
            { 'Columna': 'Stock Actual', 'Requerido': 'NO', 'Descripción': 'Cantidad actual en inventario (por defecto: 0)' },
            { 'Columna': 'Stock Mínimo', 'Requerido': 'NO', 'Descripción': 'Stock mínimo de alerta (por defecto: 0)' },
            { 'Columna': 'Stock Máximo', 'Requerido': 'NO', 'Descripción': 'Stock máximo permitido' },
            { 'Columna': 'Unidad Medida', 'Requerido': 'NO', 'Descripción': 'unidad, kg, litro, etc. (por defecto: unidad)' },
            { 'Columna': 'Ubicación Almacén', 'Requerido': 'NO', 'Descripción': 'Ubicación física en almacén' },
            { 'Columna': 'Permite Venta Sin Stock', 'Requerido': 'NO', 'Descripción': 'Sí o No (por defecto: No)' },
            { 'Columna': 'Imagen URL', 'Requerido': 'NO', 'Descripción': 'URL de la imagen del producto' },
            { 'Columna': 'Estado', 'Requerido': 'NO', 'Descripción': 'activo o inactivo (por defecto: activo)' }
        ];

        const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);
        wsInstrucciones['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 60 }];
        XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');

        // Descargar archivo
        const nombreEmpresa = currentEmpresa.nombre.replace(/[^a-zA-Z0-9]/g, '_');
        XLSX.writeFile(wb, `plantilla_importacion_productos_${nombreEmpresa}.xlsx`);

        mostrarAlerta('Plantilla descargada exitosamente', 'success');

    } catch (error) {
        console.error('Error al descargar plantilla:', error);
        mostrarAlerta('Error al generar plantilla', 'danger');
    }
}

// ============================================
// ABRIR MODAL DE IMPORTACIÓN
// ============================================

function abrirModalImportar() {
    // Resetear modal
    document.getElementById('archivoExcel').value = '';
    document.getElementById('archivoSeleccionado').style.display = 'none';
    document.getElementById('resultadoValidacion').style.display = 'none';
    document.getElementById('btnConfirmarImportacion').disabled = true;
    
    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('importarModal'));
    modal.show();
}

// ============================================
// PROCESAR ARCHIVO EXCEL
// ============================================

let productosImportar = [];

async function procesarArchivoExcel(e) {
    const file = e.target.files[0];
    
    if (!file) return;

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
        mostrarAlerta('El archivo es muy grande. Máximo 5MB permitido', 'danger');
        e.target.value = '';
        return;
    }

    // Mostrar nombre del archivo
    document.getElementById('nombreArchivoSeleccionado').textContent = file.name;
    document.getElementById('archivoSeleccionado').style.display = 'block';

    try {
        // Leer archivo
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        
        // Obtener primera hoja
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convertir a JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
            mostrarAlerta('El archivo está vacío', 'warning');
            return;
        }

        // Validar productos
        await validarProductosImportados(jsonData);

    } catch (error) {
        console.error('Error al procesar archivo:', error);
        mostrarAlerta('Error al leer el archivo Excel', 'danger');
        e.target.value = '';
    }
}

// ============================================
// VALIDAR PRODUCTOS IMPORTADOS
// ============================================

async function validarProductosImportados(datos) {
    const resultados = {
        validos: [],
        advertencias: [],
        errores: []
    };

    // Crear mapa de categorías por nombre
    const categoriasMap = {};
    categorias.forEach(cat => {
        categoriasMap[cat.nombre.toLowerCase().trim()] = cat.id;
    });

    // Validar cada producto
    for (let i = 0; i < datos.length; i++) {
        const fila = datos[i];
        const numeroFila = i + 2; // +2 porque Excel empieza en 1 y tiene header
        const erroresFila = [];
        const advertenciasFila = [];

        // Validaciones obligatorias
        if (!fila['Nombre'] || fila['Nombre'].toString().trim() === '') {
            erroresFila.push('Nombre es obligatorio');
        }
        if (!fila['SKU'] || fila['SKU'].toString().trim() === '') {
            erroresFila.push('SKU es obligatorio');
        }
        if (!fila['Precio Minorista'] || parseFloat(fila['Precio Minorista']) <= 0) {
            erroresFila.push('Precio Minorista es obligatorio y debe ser mayor a 0');
        }

        // Validar tipo
        const tipo = (fila['Tipo'] || 'producto').toLowerCase();
        if (!['producto', 'servicio'].includes(tipo)) {
            erroresFila.push('Tipo debe ser "producto" o "servicio"');
        }

        // Validar tipo de impuesto
        const tipoImpuesto = (fila['Tipo Impuesto'] || 'gravado').toLowerCase();
        if (!['gravado', 'exento', 'excluido'].includes(tipoImpuesto)) {
            erroresFila.push('Tipo Impuesto debe ser "gravado", "exento" o "excluido"');
        }

        // Validar estado
        const estado = (fila['Estado'] || 'activo').toLowerCase();
        if (!['activo', 'inactivo'].includes(estado)) {
            erroresFila.push('Estado debe ser "activo" o "inactivo"');
        }

        // Validar categoría (si existe)
        let categoriaId = null;
        if (fila['Categoría'] && fila['Categoría'].toString().trim() !== '') {
            const categoriaNombre = fila['Categoría'].toLowerCase().trim();
            categoriaId = categoriasMap[categoriaNombre];
            if (!categoriaId) {
                advertenciasFila.push(`Categoría "${fila['Categoría']}" no existe. Se creará sin categoría`);
            }
        }

        // Preparar objeto producto
        const producto = {
            nombre: fila['Nombre']?.toString().trim(),
            sku: fila['SKU']?.toString().trim(),
            descripcion: fila['Descripción']?.toString().trim() || null,
            tipo: tipo,
            maneja_inventario: convertirBoolean(fila['Maneja Inventario'], true),
            codigo_barras: fila['Código de Barras']?.toString().trim() || null,
            categoria_id: categoriaId,
            precio_compra: parseFloat(fila['Precio Compra']) || 0,
            precio_minorista: parseFloat(fila['Precio Minorista']) || 0,
            precio_mayorista: parseFloat(fila['Precio Mayorista']) || null,
            precio_distribuidor: parseFloat(fila['Precio Distribuidor']) || null,
            precio_minimo: parseFloat(fila['Precio Mínimo']) || null,
            precio_maximo: parseFloat(fila['Precio Máximo']) || null,
            aplica_iva: convertirBoolean(fila['Aplica IVA'], true),
            porcentaje_iva: parseFloat(fila['Porcentaje IVA']) || 19,
            tipo_impuesto: tipoImpuesto,
            iva_incluido_en_precio: convertirBoolean(fila['IVA Incluido'], false),
            stock_actual: parseInt(fila['Stock Actual']) || 0,
            stock_minimo: parseInt(fila['Stock Mínimo']) || 0,
            stock_maximo: parseInt(fila['Stock Máximo']) || null,
            unidad_medida: fila['Unidad Medida']?.toString().trim() || 'unidad',
            ubicacion_almacen: fila['Ubicación Almacén']?.toString().trim() || null,
            permite_venta_sin_stock: convertirBoolean(fila['Permite Venta Sin Stock'], false),
            imagen_url: fila['Imagen URL']?.toString().trim() || null,
            estado: estado,
            empresa_id: currentEmpresa.id
        };

        // Clasificar resultado
        if (erroresFila.length > 0) {
            resultados.errores.push({
                fila: numeroFila,
                producto: producto,
                errores: erroresFila
            });
        } else if (advertenciasFila.length > 0) {
            resultados.advertencias.push({
                fila: numeroFila,
                producto: producto,
                advertencias: advertenciasFila
            });
        } else {
            resultados.validos.push({
                fila: numeroFila,
                producto: producto
            });
        }
    }

    // Guardar productos para importar
    productosImportar = [...resultados.validos, ...resultados.advertencias];

    // Mostrar resultados
    mostrarResultadosValidacion(resultados);
}

// ============================================
// MOSTRAR RESULTADOS DE VALIDACIÓN
// ============================================

function mostrarResultadosValidacion(resultados) {
    document.getElementById('productosValidos').textContent = resultados.validos.length;
    document.getElementById('productosAdvertencias').textContent = resultados.advertencias.length;
    document.getElementById('productosErrores').textContent = resultados.errores.length;

    // Mostrar errores si existen
    const listaErrores = document.getElementById('listaErrores');
    const listaErroresDetalle = document.getElementById('listaErroresDetalle');
    
    if (resultados.errores.length > 0) {
        listaErrores.style.display = 'block';
        let htmlErrores = '<ul class="mb-0">';
        resultados.errores.forEach(error => {
            htmlErrores += `<li><strong>Fila ${error.fila} (${error.producto.nombre || 'Sin nombre'}):</strong> ${error.errores.join(', ')}</li>`;
        });
        htmlErrores += '</ul>';
        listaErroresDetalle.innerHTML = htmlErrores;
    } else {
        listaErrores.style.display = 'none';
    }

    // Habilitar/deshabilitar botón de importar
    const btnConfirmar = document.getElementById('btnConfirmarImportacion');
    if (productosImportar.length > 0 && resultados.errores.length === 0) {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = `<i class="bi bi-check-circle me-2"></i>Importar ${productosImportar.length} Productos`;
    } else {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '<i class="bi bi-x-circle me-2"></i>Corrige los errores para importar';
    }

    // Mostrar resultados
    document.getElementById('resultadoValidacion').style.display = 'block';
}

// ============================================
// CONFIRMAR IMPORTACIÓN
// ============================================

async function confirmarImportacion() {
    if (productosImportar.length === 0) {
        mostrarAlerta('No hay productos válidos para importar', 'warning');
        return;
    }

    const btnConfirmar = document.getElementById('btnConfirmarImportacion');
    const textoOriginal = btnConfirmar.innerHTML;
    
    try {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Importando...';

        const token = localStorage.getItem('token');
        let exitosos = 0;
        let fallidos = 0;
        const erroresImportacion = [];

        // Importar productos uno por uno
        for (const item of productosImportar) {
            try {
                const response = await fetch(`${API_URL}/productos`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(item.producto)
                });

                if (response.ok) {
                    exitosos++;
                } else {
                    const error = await response.json();
                    fallidos++;
                    erroresImportacion.push({
                        fila: item.fila,
                        nombre: item.producto.nombre,
                        error: error.message || 'Error desconocido'
                    });
                }
            } catch (error) {
                fallidos++;
                erroresImportacion.push({
                    fila: item.fila,
                    nombre: item.producto.nombre,
                    error: error.message
                });
            }
        }

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('importarModal'));
        modal.hide();

        // Mostrar resumen
        if (exitosos > 0) {
            mostrarAlerta(
                `Importación completada: ${exitosos} productos importados${fallidos > 0 ? `, ${fallidos} fallidos` : ''}`,
                fallidos > 0 ? 'warning' : 'success'
            );
        } else {
            mostrarAlerta('No se pudo importar ningún producto', 'danger');
        }

        // Mostrar errores si existen
        if (erroresImportacion.length > 0) {
            console.error('Errores de importación:', erroresImportacion);
        }

        // Recargar productos
        await cargarProductos();

    } catch (error) {
        console.error('Error en importación:', error);
        mostrarAlerta('Error al importar productos', 'danger');
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = textoOriginal;
    }
}

// ============================================
// UTILIDAD: CONVERTIR TEXTO A BOOLEAN
// ============================================

function convertirBoolean(valor, porDefecto) {
    if (valor === undefined || valor === null || valor === '') {
        return porDefecto ? 1 : 0;
    }
    
    const valorStr = valor.toString().toLowerCase().trim();
    
    if (['si', 'sí', 'yes', 'true', '1'].includes(valorStr)) {
        return 1;
    } else if (['no', 'false', '0'].includes(valorStr)) {
        return 0;
    }
    
    return porDefecto ? 1 : 0;
}
