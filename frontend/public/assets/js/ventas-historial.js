/**
 * KORE INVENTORY - Historial de Ventas
 * Script para gestión del historial de ventas
 */

console.log('🚀 Ventas Historial.js cargado - Versión 1.0.0');

// ============================================
// VARIABLES GLOBALES
// ============================================

const API_URL = '/api';
let currentEmpresa = null;
let currentUsuario = null;
let ventasData = [];
let ventaActual = null;
let detalleVentaModal = null;
let configuracionPlantilla = null;

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

        // Actualizar UI
        document.getElementById('userName').textContent = `${usuario.nombre} ${usuario.apellido}`;
        document.getElementById('userRole').textContent = getTipoUsuarioTexto(usuario.tipo_usuario);
        
        // Configurar visibilidad de PLATAFORMA en sidebar
        if (typeof configurarSidebarSuperAdmin === 'function') {
            configurarSidebarSuperAdmin();
        }
        
        // Inicializar modal
        detalleVentaModal = new bootstrap.Modal(document.getElementById('detalleVentaModal'));

        // Cargar empresas del usuario
        await cargarEmpresas(usuario.id);

        // Obtener empresa activa (después de cargar empresas)
        const empresaActivaId = localStorage.getItem('empresaActiva');
        if (!empresaActivaId) {
            mostrarAlerta('Por favor selecciona una empresa desde el dashboard', 'warning');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
            return;
        }
        
        // Si currentEmpresa no se estableció por cargarEmpresas, cargar desde API
        if (!currentEmpresa || !currentEmpresa.id) {
            await cargarDatosEmpresa(empresaActivaId);
        }

        // Cargar configuración de plantilla de facturación de la empresa activa
        await cargarConfiguracionPlantilla();

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
// CARGAR EMPRESAS
// ============================================

async function cargarEmpresas(usuarioId) {
    const token = localStorage.getItem('token');
    const companySelector = document.getElementById('companySelector');
    const empresaActivaText = document.getElementById('empresaActiva');
    
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
            const empresaGuardadaId = localStorage.getItem('empresaActiva');
            if (empresaGuardadaId) {
                const empresaExiste = data.data.find(emp => emp.id == empresaGuardadaId);
                if (empresaExiste) {
                    companySelector.value = empresaGuardadaId;
                    currentEmpresa = empresaExiste;
                } else {
                    companySelector.value = data.data[0].id;
                    currentEmpresa = data.data[0];
                    localStorage.setItem('empresaActiva', data.data[0].id.toString());
                }
            } else {
                companySelector.value = data.data[0].id;
                currentEmpresa = data.data[0];
                localStorage.setItem('empresaActiva', data.data[0].id.toString());
            }
            
            // Actualizar texto de empresa activa
            if (empresaActivaText && currentEmpresa) {
                empresaActivaText.textContent = currentEmpresa.nombre;
            }
            
            // Event listener para cambio de empresa
            companySelector.addEventListener('change', (e) => {
                const empresaId = parseInt(e.target.value);
                const empresaSeleccionada = data.data.find(emp => emp.id == empresaId);
                if (empresaSeleccionada) {
                    localStorage.setItem('empresaActiva', empresaId.toString());
                    currentEmpresa = empresaSeleccionada;
                    
                    // Actualizar texto de empresa activa
                    if (empresaActivaText) {
                        empresaActivaText.textContent = empresaSeleccionada.nombre;
                    }
                    
                    cargarVentas();
                }
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
            const empresaActivaText = document.getElementById('empresaActiva');
            if (empresaActivaText) {
                empresaActivaText.textContent = currentEmpresa.nombre;
            }
        } else {
            console.error('❌ Error al obtener datos de empresa:', data.message);
        }
    } catch (error) {
        console.error('❌ Error al cargar datos de empresa:', error);
    }
}

// ============================================
// CARGAR PLANTILLA DE FACTURA

async function cargarConfiguracionPlantilla() {
    if (!currentEmpresa || !currentEmpresa.id) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/facturacion/configuracion/${currentEmpresa.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            configuracionPlantilla = {
                plantilla_id: 1,
                color_primario: currentEmpresa.color_primario || '#1E40AF',
                color_secundario: '#6c757d',
                fuente: 'Arial',
                mostrar_logo: true,
                mostrar_qr: true,
                mostrar_cufe: true,
                mostrar_badges: true
            };
            return;
        }

        const data = await response.json();
        if (data.success && data.data) {
            configuracionPlantilla = data.data;
        } else {
            configuracionPlantilla = {
                plantilla_id: 1,
                color_primario: currentEmpresa.color_primario || '#1E40AF',
                color_secundario: '#6c757d',
                fuente: 'Arial',
                mostrar_logo: true,
                mostrar_qr: true,
                mostrar_cufe: true,
                mostrar_badges: true
            };
        }
    } catch (error) {
        console.error('Error cargando configuración de plantilla:', error);
        configuracionPlantilla = {
            plantilla_id: 1,
            color_primario: currentEmpresa.color_primario || '#1E40AF',
            color_secundario: '#6c757d',
            fuente: 'Arial',
            mostrar_logo: true,
            mostrar_qr: true,
            mostrar_cufe: true,
            mostrar_badges: true
        };
    }
}

function obtenerConfiguracionActual() {
    return facturaModel_obtenerConfiguracionActual(configuracionPlantilla, currentEmpresa);
}

function calcularDigitoVerificacion(nit) {
    const nitNumeros = (nit || '').replace(/[^0-9]/g, '');
    const vpri = [3,7,13,17,19,23,29,37,41,43,47,53,59,67,71];
    let suma = 0;
    for (let i = 0; i < nitNumeros.length && i < 15; i++) {
        suma += parseInt(nitNumeros[nitNumeros.length - 1 - i]) * vpri[i];
    }
    const residuo = suma % 11;
    return residuo > 1 ? 11 - residuo : residuo;
}

function formatearNumero(valor) {
    return Number(valor || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function generarHTMLFacturaVentaHistorial(venta, detalle) {
    const ventaData = {
        cliente: {
            razon_social: venta.cliente_razon_social || `${venta.cliente_nombre || ''} ${venta.cliente_apellido || ''}`.trim(),
            nombre: venta.cliente_nombre || '',
            apellido: venta.cliente_apellido || '',
            tipo_documento: venta.cliente_tipo_documento || '',
            numero_documento: venta.cliente_numero_documento || '',
            telefono: venta.cliente_telefono || venta.cliente_celular || ''
        },
        productos: detalle.map((item) => ({
            nombre: item.producto_nombre || item.nombre || '',
            sku: item.producto_sku || item.sku || '',
            cantidad: item.cantidad || 0,
            precio: item.precio_unitario || item.precio || item.valor_unitario || 0,
            subtotal: item.subtotal || item.total || ((item.cantidad || 0) * (item.precio_unitario || item.precio || 0))
        })),
        subtotal: venta.subtotal || 0,
        descuento: venta.descuento || 0,
        impuesto: venta.impuesto || 0,
        impuestos_adicionales: venta.impuestos_adicionales || 0,
        total: (parseFloat(venta.subtotal) || 0) - (parseFloat(venta.descuento) || 0) + (parseFloat(venta.impuesto) || 0) + (parseFloat(venta.impuestos_adicionales) || 0) + (parseFloat(venta.propina_valor) || 0),
        propina_porcentaje: venta.propina_porcentaje || 0,
        propina_valor: venta.propina_valor || 0,
        notas: venta.notas || ''
    };

    return facturaModel_generarFacturaHtmlBody(venta, ventaData, currentEmpresa, configuracionPlantilla);
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

        // El backend devuelve las ventas directamente en data.data (no data.data.ventas)
        ventasData = Array.isArray(data.data) ? data.data : [];
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

        // Determinar nombre del cliente
        let nombreCliente = venta.cliente_nombre || venta.razon_social || 'N/A';
        let detalleCliente = '';
        let mostrarDocumento = true;
        
        // Si el cliente es Mostrador y hay observaciones, extraer el nombre original
        if (venta.cliente_nombre === 'Mostrador' && venta.observaciones) {
            // Extraer el nombre descriptivo de las observaciones (ej: "edgar (CTA-000014)" -> "edgar")
            const match = venta.observaciones.match(/^(.+?)\s*\(/);
            if (match) {
                detalleCliente = match[1]; // "edgar", "Mesa 5", etc.
            }
            // No mostrar el documento del Mostrador (222222222)
            mostrarDocumento = false;
        }

        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${venta.numero_factura}</strong></td>
                <td>${fechaFormateada}</td>
                <td>
                    ${nombreCliente}<br>
                    ${detalleCliente ? `<small class="text-primary">${detalleCliente}</small><br>` : ''}
                    ${mostrarDocumento ? `<small class="text-muted">${venta.numero_documento || 'N/A'}</small>` : ''}
                </td>
                <td><strong>$${formatearNumero((parseFloat(venta.subtotal) || 0) - (parseFloat(venta.descuento) || 0) + (parseFloat(venta.impuesto) || 0) + (parseFloat(venta.impuestos_adicionales) || 0))}</strong></td>
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
        
        if (!data.success) {
            throw new Error(data.message || 'Error al obtener venta');
        }

        // El backend devuelve la venta en data.data con detalles incluidos
        const venta = data.data;
        const detalle = venta.detalles || [];

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

    const html = generarHTMLFacturaVentaHistorial(venta, detalle);
    document.getElementById('detalleVentaContent').innerHTML = html;
    detalleVentaModal.show();
}

// ============================================
// IMPRIMIR VENTA
// ============================================

/**
 * Imprimir venta usando modal profesional
 * Redirige a ventas.html con el parámetro de factura para impresión
 */
async function imprimirVenta(ventaId) {
    try {
        // Obtener el número de factura
        const venta = ventasData.find(v => v.id === ventaId);
        if (!venta) {
            mostrarAlerta('Venta no encontrada', 'error');
            return;
        }
        
        // Redirigir a ventas.html con parámetro para abrir modal de impresión
        window.location.href = `ventas.html?imprimir=${encodeURIComponent(venta.numero_factura)}`;
        
    } catch (error) {
        console.error('Error al preparar impresión:', error);
        mostrarAlerta('Error al preparar la impresión', 'error');
    }
}

function imprimirDetalleVenta() {
    if (!ventaActual) {
        mostrarAlerta('No se encontró la venta actual para imprimir', 'error');
        return;
    }

    const detalle = ventaActual.detalles || [];
    const ventaData = {
        cliente: {
            razon_social: ventaActual.cliente_razon_social || `${ventaActual.cliente_nombre || ''} ${ventaActual.cliente_apellido || ''}`.trim(),
            nombre: ventaActual.cliente_nombre || '',
            apellido: ventaActual.cliente_apellido || '',
            tipo_documento: ventaActual.cliente_tipo_documento || '',
            numero_documento: ventaActual.cliente_numero_documento || '',
            telefono: ventaActual.cliente_telefono || ventaActual.cliente_celular || ''
        },
        productos: detalle.map((item) => ({
            nombre: item.producto_nombre || item.nombre || '',
            sku: item.producto_sku || item.sku || '',
            cantidad: item.cantidad || 0,
            precio: item.precio_unitario || item.precio || item.valor_unitario || 0,
            subtotal: item.subtotal || item.total || ((item.cantidad || 0) * (item.precio_unitario || item.precio || 0))
        })),
        subtotal: ventaActual.subtotal || 0,
        descuento: ventaActual.descuento || 0,
        impuesto: ventaActual.impuesto || 0,
        impuestos_adicionales: ventaActual.impuestos_adicionales || 0,
        total: ventaActual.total || ((parseFloat(ventaActual.subtotal) || 0) - (parseFloat(ventaActual.descuento) || 0) + (parseFloat(ventaActual.impuesto) || 0) + (parseFloat(ventaActual.impuestos_adicionales) || 0) + (parseFloat(ventaActual.propina_valor) || 0)),
        propina_porcentaje: ventaActual.propina_porcentaje || 0,
        propina_valor: ventaActual.propina_valor || 0,
        notas: ventaActual.notas || ''
    };

    const htmlImpresion = facturaModel_generarFacturaHtmlPage(ventaActual, ventaData, currentEmpresa, configuracionPlantilla);
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) {
        mostrarAlerta('No se pudo abrir la ventana de impresión', 'warning');
        return;
    }

    printWindow.document.open();
    printWindow.document.write(htmlImpresion);
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
        .reduce((sum, v) => {
            // Calcular total correcto considerando todos los campos
            const total = (parseFloat(v.subtotal) || 0) - (parseFloat(v.descuento) || 0) + (parseFloat(v.impuesto) || 0) + (parseFloat(v.impuestos_adicionales) || 0) + (parseFloat(v.propina_valor) || 0);
            return sum + total;
        }, 0);
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

    try {
        // Preparar datos para exportar
        const datosExportar = ventasData.map(v => {
            const totalCorrecto = (parseFloat(v.subtotal) || 0) - (parseFloat(v.descuento) || 0) + (parseFloat(v.impuesto) || 0) + (parseFloat(v.impuestos_adicionales) || 0) + (parseFloat(v.propina_valor) || 0);
            return {
                'Nº Factura': v.numero_factura,
                'Fecha': new Date(v.fecha_venta).toLocaleString('es-CO'),
                'Cliente': v.cliente_nombre,
                'Documento': v.cliente_documento,
                'Subtotal': v.subtotal,
                'Descuento': v.descuento || 0,
                'Impuesto': v.impuesto,
                'Impuestos Adic.': v.impuestos_adicionales || 0,
                'Propina': v.propina_valor || 0,
                'Total': totalCorrecto,
                'Método Pago': v.metodo_pago,
                'Estado': v.estado,
                'Vendedor': v.vendedor_nombre
            };
        });

        // Crear libro de Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(datosExportar);

        // Ajustar ancho de columnas
        const colWidths = [
            { wch: 15 },  // Nº Factura
            { wch: 20 },  // Fecha
            { wch: 30 },  // Cliente
            { wch: 15 },  // Documento
            { wch: 12 },  // Subtotal
            { wch: 12 },  // Descuento
            { wch: 12 },  // Impuesto
            { wch: 12 },  // Total
            { wch: 15 },  // Método Pago
            { wch: 12 },  // Estado
            { wch: 25 }   // Vendedor
        ];
        ws['!cols'] = colWidths;

        // Agregar hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Ventas');

        // Descargar archivo
        const fecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `ventas_${fecha}.xlsx`);

        mostrarAlerta(`${ventasData.length} ventas exportadas exitosamente`, 'success');

    } catch (error) {
        console.error('Error al exportar ventas:', error);
        mostrarAlerta('Error al exportar ventas a Excel', 'error');
    }
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
