/**
 * KORE INVENTORY - Historial de Ventas
 * Script para gestión del historial de ventas
 */

console.log('🚀 Ventas Historial.js cargado - Versión 1.0.0');

// ============================================
// VARIABLES GLOBALES
// ============================================

const API_URL = 'https://api.kore-inventory.xyz/api';
let currentEmpresa = null;
let currentUsuario = null;
let ventasData = [];
let ventaActual = null;
let detalleVentaModal = null;

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
            // Si no hay empresa activa y el usuario tiene empresas, usar la primera
            if (usuario.empresas && usuario.empresas.length > 0) {
                currentEmpresa = usuario.empresas[0];
                localStorage.setItem('empresaActiva', JSON.stringify(currentEmpresa));
            } else {
                mostrarAlerta('Por favor selecciona una empresa desde el dashboard', 'warning');
                setTimeout(() => window.location.href = 'dashboard.html', 2000);
                return;
            }
        }

        // Actualizar UI
        document.getElementById('userName').textContent = `${usuario.nombre} ${usuario.apellido}`;
        document.getElementById('userRole').textContent = getTipoUsuarioTexto(usuario.tipo_usuario);
        
        // Cargar empresas en el selector
        const companySelector = document.getElementById('companySelector');
        if (companySelector && usuario.empresas && usuario.empresas.length > 0) {
            companySelector.innerHTML = usuario.empresas.map(emp => 
                `<option value="${emp.id}" ${emp.id === currentEmpresa.id ? 'selected' : ''}>${emp.nombre}</option>`
            ).join('');
            
            companySelector.addEventListener('change', (e) => {
                const empresaId = parseInt(e.target.value);
                const nuevaEmpresa = usuario.empresas.find(emp => emp.id === empresaId);
                if (nuevaEmpresa) {
                    localStorage.setItem('empresaActiva', JSON.stringify(nuevaEmpresa));
                    currentEmpresa = nuevaEmpresa;
                    cargarVentas();
                }
            });
        }

        // Inicializar modal
        detalleVentaModal = new bootstrap.Modal(document.getElementById('detalleVentaModal'));

        // Cargar ventas
        await cargarVentas();

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
        searchTimeout = setTimeout(() => cargarVentas(), 500);
    });

    // Filtros
    document.getElementById('filterEstado').addEventListener('change', cargarVentas);
    document.getElementById('fechaInicio').addEventListener('change', cargarVentas);
    document.getElementById('fechaFin').addEventListener('change', cargarVentas);

    // Botones
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);
    document.getElementById('btnExportar').addEventListener('click', exportarVentas);
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) btnLogout.addEventListener('click', cerrarSesion);

    // Sidebar toggle
    const toggleBtn = document.getElementById('toggleSidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('active');
            document.getElementById('sidebarOverlay').classList.toggle('active');
        });
    }

    const closeSidebar = document.getElementById('closeSidebar');
    if (closeSidebar) {
        closeSidebar.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('sidebarOverlay').classList.remove('active');
        });
    }

    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('sidebarOverlay').classList.remove('active');
        });
    }

    // Imprimir desde modal
    document.getElementById('btnImprimirDetalle').addEventListener('click', () => {
        imprimirDetalleVenta();
    });
}

// ============================================
// CARGAR VENTAS
// ============================================

async function cargarVentas() {
    try {
        mostrarCargando(true);

        const token = localStorage.getItem('token');
        
        if (!token) {
            console.error('No hay token disponible');
            mostrarAlerta('Sesión expirada. Por favor inicia sesión nuevamente.', 'error');
            setTimeout(() => window.location.href = 'login.html', 2000);
            return;
        }

        if (!currentEmpresa || !currentEmpresa.id) {
            console.error('No hay empresa seleccionada');
            mostrarAlerta('No hay empresa seleccionada', 'error');
            mostrarCargando(false);
            return;
        }

        const searchTerm = document.getElementById('searchInput').value || '';
        const estado = document.getElementById('filterEstado').value || '';
        const fechaInicio = document.getElementById('fechaInicio').value || '';
        const fechaFin = document.getElementById('fechaFin').value || '';

        let url = `${API_URL}/ventas?empresaId=${currentEmpresa.id}`;
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
        if (estado) url += `&estado=${estado}`;
        if (fechaInicio) url += `&fechaInicio=${fechaInicio}`;
        if (fechaFin) url += `&fechaFin=${fechaFin}`;

        console.log('🌐 Cargando ventas desde:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('📡 Respuesta del servidor:', response.status, response.statusText);

        if (!response.ok) {
            if (response.status === 401) {
                mostrarAlerta('Sesión expirada. Por favor inicia sesión nuevamente.', 'error');
                setTimeout(() => window.location.href = 'login.html', 2000);
                return;
            }
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ Datos recibidos:', data);

        if (!data.success) {
            throw new Error(data.message || 'Error al obtener ventas');
        }

        ventasData = data.data?.ventas || [];
        console.log(`📊 Total de ventas cargadas: ${ventasData.length}`);
        
        renderVentas();
        actualizarEstadisticas();
        mostrarCargando(false);

    } catch (error) {
        console.error('❌ Error al cargar ventas:', error);
        
        // Mostrar mensaje más específico según el tipo de error
        let mensaje = 'Error al cargar las ventas';
        if (error.message.includes('Failed to fetch')) {
            mensaje = 'No se pudo conectar al servidor. Verifica tu conexión a internet.';
        } else if (error.message) {
            mensaje = error.message;
        }
        
        mostrarAlerta(mensaje, 'error');
        mostrarCargando(false);
        
        // Mostrar mensaje amigable en la tabla
        const tbody = document.getElementById('ventasTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-5">
                        <i class="bi bi-exclamation-triangle text-danger" style="font-size: 3rem;"></i>
                        <p class="mt-3 mb-0">${mensaje}</p>
                        <button class="btn btn-primary mt-3" onclick="cargarVentas()">
                            <i class="bi bi-arrow-clockwise"></i> Reintentar
                        </button>
                    </td>
                </tr>
            `;
        }
    }
}

// ============================================
// RENDERIZAR VENTAS
// ============================================

function renderVentas() {
    const tbody = document.getElementById('ventasTableBody');
    
    if (ventasData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <i class="bi bi-inbox" style="font-size: 3rem; color: #ccc;"></i>
                    <p class="text-muted mt-2">No se encontraron ventas</p>
                </td>
            </tr>
        `;
        document.getElementById('resultCount').textContent = '0';
        return;
    }

    const html = ventasData.map((venta, index) => {
        const estadoBadge = getEstadoBadge(venta.estado);
        const fechaFormateada = new Date(venta.fecha_venta).toLocaleString('es-CO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${venta.numero_factura}</strong></td>
                <td>${fechaFormateada}</td>
                <td>
                    ${venta.cliente_nombre}<br>
                    <small class="text-muted">${venta.cliente_documento}</small>
                </td>
                <td><strong>$${formatearNumero(venta.total)}</strong></td>
                <td><span class="badge bg-secondary">${venta.metodo_pago}</span></td>
                <td>${estadoBadge}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="verDetalleVenta(${venta.id})" title="Ver Detalle">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-info" onclick="imprimirVenta(${venta.id})" title="Imprimir">
                        <i class="bi bi-printer"></i>
                    </button>
                    ${venta.estado !== 'anulada' ? `
                        <button class="btn btn-sm btn-danger" onclick="anularVenta(${venta.id})" title="Anular">
                            <i class="bi bi-x-circle"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;
    document.getElementById('resultCount').textContent = ventasData.length;
}

// ============================================
// VER DETALLE DE VENTA
// ============================================

async function verDetalleVenta(ventaId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/ventas/${ventaId}?empresaId=${currentEmpresa.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar detalle');
        }

        const data = await response.json();
        const venta = data.data.venta;
        const detalle = data.data.detalle;

        ventaActual = venta; // Guardar venta actual
        mostrarDetalleVenta(venta, detalle);

    } catch (error) {
        console.error('Error al cargar detalle:', error);
        mostrarAlerta('Error al cargar el detalle de la venta', 'error');
    }
}

function mostrarDetalleVenta(venta, detalle) {
    const fechaFormateada = new Date(venta.fecha_venta).toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    const html = `
        <div id="facturaDetalleP rint">
            <!-- Encabezado -->
            <div class="text-center mb-4">
                <h3>${currentEmpresa.nombre}</h3>
                <p>${currentEmpresa.razon_social}</p>
                <p>NIT: ${currentEmpresa.nit}</p>
                <p>${currentEmpresa.direccion || ''}</p>
                <p>Tel: ${currentEmpresa.telefono || ''} | Email: ${currentEmpresa.email}</p>
                <hr>
                <h4>FACTURA DE VENTA</h4>
                <p><strong>${venta.numero_factura}</strong></p>
            </div>

            <!-- Info Venta -->
            <div class="row mb-4">
                <div class="col-6">
                    <strong>Cliente:</strong><br>
                    ${venta.cliente_razon_social || `${venta.cliente_nombre} ${venta.cliente_apellido || ''}`}<br>
                    ${venta.cliente_tipo_documento}: ${venta.cliente_numero_documento}<br>
                    Tel: ${venta.cliente_telefono || venta.cliente_celular || '-'}<br>
                    ${venta.cliente_direccion || ''}
                </div>
                <div class="col-6 text-end">
                    <strong>Fecha:</strong> ${fechaFormateada}<br>
                    <strong>Vendedor:</strong> ${venta.vendedor_nombre}<br>
                    <strong>Método de Pago:</strong> ${venta.metodo_pago}<br>
                    <strong>Estado:</strong> ${getEstadoBadge(venta.estado)}
                </div>
            </div>

            <!-- Productos -->
            <div class="table-responsive">
            <table class="table table-bordered">
                <thead class="table-light">
                    <tr>
                        <th>Producto</th>
                        <th>SKU</th>
                        <th class="text-center">Cantidad</th>
                        <th class="text-end">Precio Unit.</th>
                        <th class="text-end">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${detalle.map(item => `
                        <tr>
                            <td>${item.producto_nombre}</td>
                            <td><small class="text-muted">${item.producto_sku || '-'}</small></td>
                            <td class="text-center">${item.cantidad}</td>
                            <td class="text-end">$${formatearNumero(item.precio_unitario)}</td>
                            <td class="text-end">$${formatearNumero(item.subtotal)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="4" class="text-end"><strong>Subtotal:</strong></td>
                        <td class="text-end">$${formatearNumero(venta.subtotal)}</td>
                    </tr>
                    ${venta.descuento > 0 ? `
                    <tr>
                        <td colspan="4" class="text-end"><strong>Descuento:</strong></td>
                        <td class="text-end">-$${formatearNumero(venta.descuento)}</td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td colspan="4" class="text-end"><strong>IVA (19%):</strong></td>
                        <td class="text-end">$${formatearNumero(venta.impuesto)}</td>
                    </tr>
                    <tr class="table-primary">
                        <td colspan="4" class="text-end"><strong>TOTAL:</strong></td>
                        <td class="text-end"><strong>$${formatearNumero(venta.total)}</strong></td>
                    </tr>
                </tfoot>
            </table>
            </div>

            ${venta.notas ? `
                <div class="mt-3">
                    <strong>Notas:</strong><br>
                    <p class="text-muted">${venta.notas}</p>
                </div>
            ` : ''}

            <div class="text-center mt-4">
                <p class="text-muted">¡Gracias por su compra!</p>
            </div>
        </div>
    `;

    document.getElementById('detalleVentaContent').innerHTML = html;
    detalleVentaModal.show();
}

// ============================================
// IMPRIMIR VENTA
// ============================================

async function imprimirVenta(ventaId) {
    await verDetalleVenta(ventaId);
    // Esperar a que se cargue el modal
    setTimeout(() => {
        imprimirDetalleVenta();
    }, 500);
}

function imprimirDetalleVenta() {
    const facturaContent = document.getElementById('facturaDetallePrint');
    if (!facturaContent) {
        mostrarAlerta('No se encontró el contenido de la factura', 'error');
        return;
    }

    // Obtener el número de factura para el nombre del archivo
    const numeroFactura = ventaActual?.numero_factura || 'factura';
    const nombreArchivo = `Factura_${numeroFactura}`;

    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) {
        mostrarAlerta('No se pudo abrir la ventana de impresión', 'warning');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${nombreArchivo}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                @page { size: letter; margin: 1cm; }
                body { font-family: Arial, sans-serif; font-size: 12pt; padding: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 8px; }
                th { background-color: #f8f9fa; }
                .text-center { text-align: center; }
                .text-end { text-align: right; }
                .table-primary { background-color: #cfe2ff; font-weight: bold; }
                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            ${facturaContent.innerHTML}
            <script>
                // Configurar el nombre del archivo antes de imprimir
                document.title = '${nombreArchivo}';
                
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 100);
                    }, 250);
                };
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}

// ============================================
// ANULAR VENTA
// ============================================

async function anularVenta(ventaId) {
    const motivo = prompt('Ingrese el motivo de la anulación:');
    if (!motivo) return;

    if (!confirm('¿Está seguro de anular esta venta? Esta acción no se puede deshacer.')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/ventas/${ventaId}/anular`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                empresaId: currentEmpresa.id,
                motivo: motivo
            })
        });

        if (!response.ok) {
            throw new Error('Error al anular venta');
        }

        mostrarAlerta('Venta anulada exitosamente', 'success');
        await cargarVentas();

    } catch (error) {
        console.error('Error al anular venta:', error);
        mostrarAlerta('Error al anular la venta', 'error');
    }
}

// ============================================
// ESTADÍSTICAS
// ============================================

async function actualizarEstadisticas() {
    const totalVentas = ventasData.length;
    const totalIngresos = ventasData
        .filter(v => v.estado !== 'anulada')
        .reduce((sum, v) => sum + parseFloat(v.total), 0);
    const pendientes = ventasData.filter(v => v.estado === 'pendiente').length;
    const ticketPromedio = totalVentas > 0 ? totalIngresos / totalVentas : 0;

    document.getElementById('statTotalVentas').textContent = totalVentas;
    document.getElementById('statTotalIngresos').textContent = `$${formatearNumero(totalIngresos)}`;
    document.getElementById('statPendientes').textContent = pendientes;
    document.getElementById('statTicketPromedio').textContent = `$${formatearNumero(ticketPromedio)}`;
}

// ============================================
// UTILIDADES
// ============================================

function getTipoUsuarioTexto(tipo) {
    const tipos = {
        'super_admin': 'Super Administrador',
        'admin_empresa': 'Administrador',
        'usuario': 'Usuario',
        'soporte': 'Soporte'
    };
    return tipos[tipo] || tipo;
}

function getEstadoBadge(estado) {
    const badges = {
        'pagada': '<span class="badge bg-success">Pagada</span>',
        'pendiente': '<span class="badge bg-warning">Pendiente</span>',
        'cancelada': '<span class="badge bg-secondary">Cancelada</span>',
        'anulada': '<span class="badge bg-danger">Anulada</span>'
    };
    return badges[estado] || `<span class="badge bg-secondary">${estado}</span>`;
}

function limpiarFiltros() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterEstado').value = '';
    document.getElementById('fechaInicio').value = '';
    document.getElementById('fechaFin').value = '';
    cargarVentas();
}

async function exportarVentas() {
    if (ventasData.length === 0) {
        mostrarAlerta('No hay datos para exportar', 'warning');
        return;
    }

    const csv = [
        ['Nº Factura', 'Fecha', 'Cliente', 'Documento', 'Subtotal', 'Descuento', 'Impuesto', 'Total', 'Método Pago', 'Estado', 'Vendedor'],
        ...ventasData.map(v => [
            v.numero_factura,
            new Date(v.fecha_venta).toLocaleString('es-CO'),
            v.cliente_nombre,
            v.cliente_documento,
            v.subtotal,
            v.descuento,
            v.impuesto,
            v.total,
            v.metodo_pago,
            v.estado,
            v.vendedor_nombre
        ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ventas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function formatearNumero(numero) {
    return new Intl.NumberFormat('es-CO').format(numero);
}

function mostrarCargando(show) {
    const tbody = document.getElementById('ventasTableBody');
    if (show) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                </td>
            </tr>
        `;
    }
}

function mostrarAlerta(mensaje, tipo) {
    const alertClass = tipo === 'success' ? 'alert-success' : tipo === 'error' ? 'alert-danger' : 'alert-warning';
    const alerta = document.createElement('div');
    alerta.className = `alert ${alertClass} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    alerta.style.zIndex = '9999';
    alerta.innerHTML = `
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alerta);
    setTimeout(() => alerta.remove(), 5000);
}

function cerrarSesion() {
    if (confirm('¿Desea cerrar sesión?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        localStorage.removeItem('empresaActiva');
        window.location.href = 'login.html';
    }
}
