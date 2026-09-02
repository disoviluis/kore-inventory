/**
 * =================================
 * KORE INVENTORY - INVENTARIO MODULE
 * JavaScript para módulo de inventario
 * =================================
 */

const API_URL = '/api';
let currentEmpresa = null;
let currentUsuario = null;
let movimientos = [];
let productos = [];
let ajustesExcelPendientes = [];
let bodegaInventarioId = null;
let ultimoInformeInventario = [];

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
        const empresaActivaId = localStorage.getItem('empresaActiva');
        
        if (!empresaActivaId) {
            console.error('❌ No hay empresa activa configurada');
            mostrarAlerta('No tienes empresas asignadas. Contacta al administrador.', 'warning');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
            return;
        }
        
        // Si currentEmpresa no se estableció por cargarEmpresas, cargar desde API
        if (!currentEmpresa || !currentEmpresa.id) {
            await cargarDatosEmpresa(empresaActivaId);
        }
        
        console.log(`✅ Empresa activa: ${currentEmpresa.nombre} (ID: ${currentEmpresa.id})`);
        
        // Guardar usuario actual
        currentUsuario = usuario;
        await cargarBodegasInventario();

        // Event Listeners
        document.getElementById('logoutBtn').addEventListener('click', cerrarSesion);
        document.getElementById('btnAjusteInventario').addEventListener('click', abrirModalAjuste);
        document.getElementById('btnAjusteQuick').addEventListener('click', abrirModalAjuste);
        document.getElementById('btnDescargarInventario').addEventListener('click', descargarPlantillaInventario);
        document.getElementById('btnSubirInventario').addEventListener('click', () => document.getElementById('archivoInventario').click());
        document.getElementById('btnDescargarCambios').addEventListener('click', descargarInformeInventario);
        document.getElementById('archivoInventario').addEventListener('change', procesarInventarioExcel);
        document.getElementById('btnConfirmarInventarioExcel').addEventListener('click', confirmarInventarioExcel);
        document.getElementById('selectorBodegaInventario').addEventListener('change', async (evento) => {
            bodegaInventarioId = Number(evento.target.value) || null;
            await cargarProductosParaAjuste();
        });
        document.getElementById('ajusteForm').addEventListener('submit', guardarAjuste);
        document.getElementById('searchMovimiento').addEventListener('input', filtrarMovimientos);
        document.getElementById('searchProductoInventario').addEventListener('input', filtrarProductosStock);
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
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const companySelector = document.getElementById('companySelector');
    const companyText = document.getElementById('companyText');
    const companyNameText = document.getElementById('companyNameText');
    
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
            // Determinar si mostrar selector o texto según tipo de usuario y cantidad de empresas
            const esUsuarioRegular = usuario.tipo_usuario === 'usuario';
            const tieneSoloUnaEmpresa = data.data.length === 1;
            
            if (esUsuarioRegular || tieneSoloUnaEmpresa) {
                // Usuario Regular o Admin con 1 sola empresa: mostrar solo texto
                companySelector.style.display = 'none';
                if (companyText) companyText.style.display = 'block';
                if (companyNameText) companyNameText.textContent = data.data[0].nombre;
                
                // Establecer empresa activa (solo ID en localStorage)
                localStorage.setItem('empresaActiva', data.data[0].id.toString());
                currentEmpresa = data.data[0];
            } else {
                // Admin Empresa con múltiples empresas: mostrar selector
                companySelector.style.display = 'block';
                if (companyText) companyText.style.display = 'none';
                
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
                const empresaGuardadaId = localStorage.getItem('empresaActiva');
                if (empresaGuardadaId) {
                    // Verificar que la empresa guardada existe en la lista
                    const empresaExiste = data.data.find(emp => emp.id == empresaGuardadaId);
                    if (empresaExiste) {
                        companySelector.value = empresaGuardadaId;
                        currentEmpresa = empresaExiste;
                    } else {
                        // Si no existe, usar la primera empresa
                        companySelector.value = data.data[0].id;
                        localStorage.setItem('empresaActiva', data.data[0].id.toString());
                        currentEmpresa = data.data[0];
                    }
                } else {
                    // No hay empresa guardada, usar la primera
                    companySelector.value = data.data[0].id;
                    localStorage.setItem('empresaActiva', data.data[0].id.toString());
                    currentEmpresa = data.data[0];
                }
                
                // Event listener para cambio de empresa
                companySelector.addEventListener('change', async (e) => {
                    const empresaId = e.target.value;
                    const empresaSeleccionada = data.data.find(emp => emp.id == empresaId);
                    localStorage.setItem('empresaActiva', empresaId);
                    currentEmpresa = empresaSeleccionada;
                    // Recargar datos del módulo
                    await Promise.all([
                        cargarResumen(),
                        cargarMovimientos(),
                        cargarAlertas(),
                        cargarProductosParaAjuste()
                    ]);
                });
            }
            
        } else {
            companySelector.innerHTML = '<option value="">Sin empresas asignadas</option>';
        }
        
    } catch (error) {
        console.error('Error al cargar empresas:', error);
        companySelector.innerHTML = '<option value="">Error al cargar empresas</option>';
    }
}

// ============================================
// CARGAR DATOS COMPLETOS DE EMPRESA
// ============================================

async function cargarDatosEmpresa(empresaId) {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_URL}/empresas/${empresaId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.data) {
            currentEmpresa = data.data;
            console.log('✅ Datos completos de empresa cargados:', currentEmpresa.nombre);
            
            // Actualizar el nombre de la empresa en el DOM
            const companyNameText = document.getElementById('companyNameText');
            if (companyNameText) {
                companyNameText.textContent = currentEmpresa.nombre;
            }
        } else {
            console.error('❌ Error al obtener datos de empresa:', data.message);
        }
    } catch (error) {
        console.error('❌ Error al cargar datos de empresa:', error);
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
            if (bodegaInventarioId) {
                const stockResponse = await fetch(`${API_URL}/bodegas/${bodegaInventarioId}/stock?empresa_id=${currentEmpresa.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
                const stockData = await stockResponse.json();
                const stockPorProducto = new Map((stockData.data || []).map(stock => [Number(stock.producto_id), Number(stock.stock_actual) || 0]));
                productos = productos.map(producto => ({ ...producto, stock_actual: stockPorProducto.get(Number(producto.id)) || 0 }));
            }
            const select = document.getElementById('ajusteProducto');
            select.innerHTML = '<option value="">Seleccione un producto...</option>';
            
            productos.forEach(producto => {
                const option = document.createElement('option');
                option.value = producto.id;
                option.textContent = `${producto.nombre} - ${producto.sku}`;
                option.dataset.stock = producto.stock_actual;
                select.appendChild(option);
            });

            renderizarProductosStock(productos);
        }
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
}

function obtenerBodegaInventario() {
    return bodegaInventarioId;
}

async function cargarBodegasInventario() {
    const selector = document.getElementById('selectorBodegaInventario');
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/bodegas?empresa_id=${currentEmpresa.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await response.json();
    if (!data.success || !Array.isArray(data.data)) return;
    selector.innerHTML = '<option value="">Seleccione bodega...</option>';
    data.data.filter(bodega => bodega.estado === 'activa').forEach(bodega => {
        const option = document.createElement('option');
        option.value = bodega.id;
        option.textContent = `${bodega.nombre}${bodega.es_principal ? ' (Principal)' : ''}`;
        selector.appendChild(option);
    });
    bodegaInventarioId = Number(currentUsuario.bodega_id) || Number(data.data.find(bodega => bodega.es_principal)?.id) || Number(data.data[0]?.id) || null;
    selector.value = bodegaInventarioId || '';
}

function descargarPlantillaInventario() {
    const bodegaId = obtenerBodegaInventario();
    if (!bodegaId) return mostrarAlerta('Asigna una bodega al usuario antes de descargar el inventario.', 'warning');
    const filas = productos.map(producto => ({
        'SKU': producto.sku,
        'Código de Barras': producto.codigo_barras || '',
        'Producto': producto.nombre,
        'Stock Sistema': Number(producto.stock_actual) || 0,
        'Stock Físico': Number(producto.stock_actual) || 0,
        'Observaciones': ''
    }));
    const libro = XLSX.utils.book_new();
    const hoja = XLSX.utils.json_to_sheet(filas);
    hoja['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 36 }, { wch: 16 }, { wch: 16 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(libro, hoja, 'Conteo físico');
    XLSX.writeFile(libro, `inventario_bodega_${bodegaId}.xlsx`);
}

async function procesarInventarioExcel(evento) {
    const archivo = evento.target.files[0];
    evento.target.value = '';
    if (!archivo) return;
    if (!obtenerBodegaInventario()) return mostrarAlerta('Asigna una bodega al usuario antes de cargar el inventario.', 'warning');
    try {
        const libro = XLSX.read(await archivo.arrayBuffer());
        const hoja = libro.Sheets['Conteo físico'] || libro.Sheets[libro.SheetNames[0]];
        const datos = XLSX.utils.sheet_to_json(hoja);
        const porSku = new Map(productos.map(producto => [String(producto.sku).trim().toLowerCase(), producto]));
        const vistos = new Set();
        ajustesExcelPendientes = datos.map((fila, indice) => {
            const sku = String(fila['SKU'] || '').trim();
            const producto = porSku.get(sku.toLowerCase());
            const fisico = Number(fila['Stock Físico']);
            const valido = !!producto && !vistos.has(sku.toLowerCase()) && Number.isInteger(fisico) && fisico >= 0;
            if (sku) vistos.add(sku.toLowerCase());
            return { fila: indice + 2, sku, producto, sistema: Number(producto?.stock_actual) || 0, fisico, diferencia: valido ? fisico - (Number(producto.stock_actual) || 0) : null, observaciones: fila['Observaciones'] || '', valido };
        });
        renderizarPrevisualizacionInventario();
        new bootstrap.Modal(document.getElementById('inventarioExcelModal')).show();
    } catch (error) {
        console.error('Error al leer inventario Excel:', error);
        mostrarAlerta('No se pudo leer el archivo Excel.', 'danger');
    }
}

function renderizarPrevisualizacionInventario() {
    const validos = ajustesExcelPendientes.filter(ajuste => ajuste.valido);
    const errores = ajustesExcelPendientes.length - validos.length;
    document.getElementById('inventarioExcelResumen').textContent = `${validos.length} filas válidas, ${errores} con errores. Solo se aplicarán diferencias distintas de cero.`;
    document.getElementById('inventarioExcelTabla').innerHTML = ajustesExcelPendientes.map(ajuste => `<tr><td>${ajuste.fila}</td><td>${ajuste.sku || '-'}</td><td>${ajuste.producto?.nombre || '-'}</td><td>${ajuste.valido ? ajuste.sistema : '-'}</td><td>${Number.isNaN(ajuste.fisico) ? '-' : ajuste.fisico}</td><td class="${ajuste.valido && ajuste.diferencia < 0 ? 'text-danger' : 'text-success'}">${ajuste.valido ? ajuste.diferencia : '-'}</td><td><span class="badge bg-${ajuste.valido ? 'success' : 'danger'}">${ajuste.valido ? 'Válida' : 'Error'}</span></td></tr>`).join('');
    document.getElementById('btnConfirmarInventarioExcel').disabled = validos.length === 0 || errores > 0;
}

async function confirmarInventarioExcel() {
    const ajustes = ajustesExcelPendientes.filter(ajuste => ajuste.valido && ajuste.diferencia !== 0).map(ajuste => ({ producto_id: ajuste.producto.id, cantidad: ajuste.diferencia, observaciones: ajuste.observaciones }));
    if (!ajustes.length) return mostrarAlerta('No hay diferencias para aplicar.', 'info');
    try {
        const response = await fetch(`${API_URL}/inventario/ajuste-masivo`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ bodega_id: obtenerBodegaInventario(), ajustes, notas: 'Carga de inventario físico desde Excel' }) });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'No se pudo aplicar el inventario');
        bootstrap.Modal.getInstance(document.getElementById('inventarioExcelModal')).hide();
        const cambiosConfirmados = data.data.cambios || [];
        ultimoInformeInventario = ajustesExcelPendientes.filter(ajuste => ajuste.valido && ajuste.diferencia !== 0).map(ajuste => {
            const confirmado = cambiosConfirmados.find(cambio => Number(cambio.producto_id) === Number(ajuste.producto.id));
            return {
            sku: ajuste.sku,
            producto: ajuste.producto.nombre,
            stock_anterior: confirmado?.stock_anterior ?? ajuste.sistema,
            stock_nuevo: confirmado?.stock_nuevo ?? ajuste.fisico,
            diferencia: confirmado?.diferencia ?? ajuste.diferencia,
            observaciones: ajuste.observaciones
            };
        });
        document.getElementById('btnDescargarCambios').disabled = false;
        mostrarAlerta(`${data.data.aplicados} diferencias aplicadas correctamente.`, 'success');
        descargarInformeInventario();
        await Promise.all([cargarResumen(), cargarMovimientos(), cargarAlertas(), cargarProductosParaAjuste()]);
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    }
}

function descargarInformeInventario() {
    if (!ultimoInformeInventario.length) return;
    const filas = ultimoInformeInventario.map(cambio => `<tr style="background-color:${cambio.diferencia < 0 ? '#fde2e1' : '#e2f5e9'}"><td>${cambio.sku}</td><td>${cambio.producto}</td><td>${cambio.stock_anterior}</td><td>${cambio.stock_nuevo}</td><td>${cambio.diferencia}</td><td>${cambio.observaciones || ''}</td></tr>`).join('');
    const selector = document.getElementById('selectorBodegaInventario');
    const bodega = selector?.selectedOptions[0]?.textContent || '';
    const html = `<html><head><meta charset="UTF-8"></head><body><h2>Informe de cambios de inventario</h2><p>Bodega: ${bodega}</p><table border="1"><thead><tr><th>SKU</th><th>Producto</th><th>Stock anterior</th><th>Stock nuevo</th><th>Diferencia</th><th>Observaciones</th></tr></thead><tbody>${filas}</tbody></table></body></html>`;
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel' }));
    enlace.download = `cambios_inventario_${new Date().toISOString().slice(0, 10)}.xls`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
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

function renderizarProductosStock(items) {
    const tbody = document.getElementById('productosStockTableBody');
    const empty = document.getElementById('emptyStateProductosStock');

    if (!items || items.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = items.map(producto => `
        <tr>
            <td>${producto.nombre}</td>
            <td><code>${producto.sku}</code></td>
            <td><span class="badge bg-primary">${(producto.stock_total ?? producto.stock_actual) || 0}</span></td>
            <td>${producto.stock_minimo || 0}</td>
            <td>${producto.ubicacion_almacen || '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick='verDesgloseBodegas(${producto.id}, ${JSON.stringify(producto.nombre)})' title="Ver desglose por bodega">
                    <i class="bi bi-diagram-3 me-1"></i>Ver por bodega
                </button>
            </td>
        </tr>
    `).join('');
}

function filtrarProductosStock() {
    const searchTerm = document.getElementById('searchProductoInventario').value.toLowerCase();
    const filtered = productos.filter(producto =>
        producto.nombre.toLowerCase().includes(searchTerm) ||
        producto.sku.toLowerCase().includes(searchTerm) ||
        (producto.ubicacion_almacen || '').toLowerCase().includes(searchTerm)
    );

    renderizarProductosStock(filtered);
}

async function verDesgloseBodegas(productoId, productoNombre) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/productos/${productoId}/disponibilidad-bodegas?empresa_id=${currentEmpresa.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('desgloseProductoNombre').textContent = `Producto: ${productoNombre}`;
            const tbody = document.getElementById('desgloseBodegaTableBody');
            const totalStock = data.data.reduce((sum, row) => sum + (row.stock_disponible || 0), 0);

            if (data.data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center text-muted py-4">
                            No hay bodegas registradas o no se encontró stock para este producto.
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = data.data.map(row => `
                    <tr>
                        <td>${row.bodega_nombre || 'Sin nombre'}</td>
                        <td>${row.bodega_tipo || '-'}</td>
                        <td><span class="badge bg-${row.stock_disponible > 0 ? 'success' : 'danger'}">${row.stock_disponible || 0}</span></td>
                        <td>${row.bodega_id || '-'}</td>
                    </tr>
                `).join('');
            }

            document.getElementById('desgloseTotalStock').textContent = totalStock;
            new bootstrap.Modal(document.getElementById('desgloseBodegaModal')).show();
        } else {
            throw new Error(data.message || 'No se pudo obtener el desglose por bodega');
        }
    } catch (error) {
        console.error('Error al cargar desglose por bodega:', error);
        mostrarAlerta('Error al cargar desglose por bodega', 'danger');
    }
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
                bodega_id: currentUsuario.bodega_id || null
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
    return formatFechaColombia(fecha);
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
