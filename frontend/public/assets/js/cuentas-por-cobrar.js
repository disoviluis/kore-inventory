/**
 * =================================
 * KORE INVENTORY - CUENTAS POR COBRAR
 * Gestión de cartera y cobros a clientes
 * =================================
 */

const API_URL = 'http://18.191.181.99:3000/api';
let token = localStorage.getItem('token');
let empresaActiva = null;
let cuentasPorCobrar = [];
let clientes = [];
let agingChartInstance = null;

// ===============================================
// INICIALIZACIÓN
// ===============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Inicializando módulo de Cuentas por Cobrar...');
    
    // Verificar autenticación
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Esperar a que dashboard.js cargue la empresa activa
    await esperarEmpresaActiva();
    
    // Cargar datos iniciales
    await Promise.all([
        cargarResumenCartera(),
        cargarCuentasPorCobrar(),
        cargarClientes()
    ]);

    // Configurar event listeners
    configurarEventListeners();
});

/**
 * Esperar a que dashboard.js establezca la empresa activa
 */
function esperarEmpresaActiva() {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            const empresaIdElement = document.getElementById('companySelector');
            if (empresaIdElement && empresaIdElement.value) {
                empresaActiva = parseInt(empresaIdElement.value);
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);

        // Timeout de 10 segundos
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!empresaActiva) {
                mostrarError('No se pudo cargar la empresa activa');
            }
            resolve();
        }, 10000);
    });
}

// ===============================================
// CARGAR DATOS
// ===============================================

/**
 * Cargar resumen de cartera (dashboard)
 */
async function cargarResumenCartera() {
    try {
        const response = await fetch(`${API_URL}/finanzas/cuentas-por-cobrar/dashboard/resumen?empresaId=${empresaActiva}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Error al cargar resumen');

        const result = await response.json();
        const data = result.data;

        // Actualizar cards
        document.getElementById('totalCartera').textContent = formatearMoneda(data.totales.total_cartera || 0);
        document.getElementById('carteraVigente').textContent = formatearMoneda(data.totales.cartera_vigente || 0);
        document.getElementById('carteraVencida').textContent = formatearMoneda(data.totales.cartera_vencida || 0);
        document.getElementById('facturasPendientes').textContent = (data.totales.facturas_vigentes + data.totales.facturas_vencidas) || 0;
        document.getElementById('facturasVigentes').textContent = data.totales.facturas_vigentes || 0;
        document.getElementById('facturasVencidas').textContent = data.totales.facturas_vencidas || 0;

        // Calcular rotación promedio (simplificado)
        const diasPromedio = data.totales.total_cartera > 0 ? 30 : 0;
        document.getElementById('rotacionPromedio').textContent = diasPromedio;

        // Crear gráfico de aging
        crearGraficoAging(data.rangos);

    } catch (error) {
        console.error('Error al cargar resumen:', error);
        mostrarError('Error al cargar resumen de cartera');
    }
}

/**
 * Cargar cuentas por cobrar
 */
async function cargarCuentasPorCobrar() {
    try {
        // Construir URL con filtros
        let url = `${API_URL}/finanzas/cuentas-por-cobrar?empresaId=${empresaActiva}`;

        const estado = document.getElementById('filterEstado').value;
        const clienteId = document.getElementById('filterCliente').value;
        const fechaDesde = document.getElementById('filterFechaDesde').value;
        const fechaHasta = document.getElementById('filterFechaHasta').value;

        if (estado) url += `&estado=${estado}`;
        if (clienteId) url += `&clienteId=${clienteId}`;
        if (fechaDesde) url += `&fechaDesde=${fechaDesde}`;
        if (fechaHasta) url += `&fechaHasta=${fechaHasta}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Error al cargar cuentas por cobrar');

        const result = await response.json();
        cuentasPorCobrar = result.data || [];

        // Renderizar tabla
        renderizarTablaCxC();

    } catch (error) {
        console.error('Error al cargar cuentas:', error);
        mostrarError('Error al cargar cuentas por cobrar');
    }
}

/**
 * Cargar clientes para filtros y modales
 */
async function cargarClientes() {
    try {
        const response = await fetch(`${API_URL}/clientes?empresaId=${empresaActiva}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Error al cargar clientes');

        const result = await response.json();
        clientes = result.data || [];

        // Llenar selector de filtro
        const filterCliente = document.getElementById('filterCliente');
        filterCliente.innerHTML = '<option value="">Todos los clientes</option>';
        clientes.forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente.id;
            option.textContent = `${cliente.nombre} ${cliente.apellido || ''} - ${cliente.numero_documento}`;
            filterCliente.appendChild(option);
        });

        // Llenar selector de modal
        const modalCliente = document.getElementById('modalCliente');
        modalCliente.innerHTML = '<option value="">Seleccionar cliente...</option>';
        clientes.forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente.id;
            option.textContent = `${cliente.nombre} ${cliente.apellido || ''} - ${cliente.numero_documento}`;
            modalCliente.appendChild(option);
        });

    } catch (error) {
        console.error('Error al cargar clientes:', error);
    }
}

// ===============================================
// RENDERIZADO
// ===============================================

/**
 * Renderizar tabla de cuentas por cobrar
 */
function renderizarTablaCxC() {
    const tbody = document.getElementById('tablaCxCBody');
    const totalRegistros = document.getElementById('totalRegistros');

    totalRegistros.textContent = `${cuentasPorCobrar.length} registros`;

    if (cuentasPorCobrar.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-5 text-muted">
                    <i class="bi bi-inbox fs-1 d-block mb-3"></i>
                    No hay cuentas por cobrar para mostrar
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = cuentasPorCobrar.map(cxc => `
        <tr>
            <td>
                <strong>${cxc.numero_factura}</strong><br>
                <small class="text-muted">ID: ${cxc.venta_id}</small>
            </td>
            <td>
                <div class="fw-bold">${cxc.cliente_nombre}</div>
                <small class="text-muted">${cxc.cliente_documento}</small>
            </td>
            <td>${formatearFecha(cxc.fecha_emision)}</td>
            <td>${formatearFecha(cxc.fecha_vencimiento)}</td>
            <td class="text-end fw-bold">${formatearMoneda(cxc.valor_original)}</td>
            <td class="text-end">
                <span class="fw-bold ${cxc.saldo_pendiente > 0 ? 'text-danger' : 'text-success'}">
                    ${formatearMoneda(cxc.saldo_pendiente)}
                </span>
            </td>
            <td class="text-center">
                ${renderizarDiasVencimiento(cxc.dias_vencimiento)}
            </td>
            <td class="text-center">
                ${renderizarBadgeEstado(cxc.estado)}
            </td>
            <td class="text-center">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary btn-sm" onclick="verDetalleCxC(${cxc.id})" title="Ver Detalle">
                        <i class="bi bi-eye"></i>
                    </button>
                    ${cxc.estado !== 'pagada' && cxc.estado !== 'anulada' ? `
                        <button class="btn btn-outline-success btn-sm" onclick="aplicarPago(${cxc.id})" title="Aplicar Pago">
                            <i class="bi bi-cash-coin"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Crear gráfico de aging (edades de cartera)
 */
function crearGraficoAging(rangos) {
    const ctx = document.getElementById('agingChart');
    
    // Destruir gráfico anterior si existe
    if (agingChartInstance) {
        agingChartInstance.destroy();
    }

    // Preparar datos
    const labels = ['Al día', '1-30 días', '31-60 días', '61-90 días', '+90 días'];
    const data = [
        rangos.find(r => r.rango_vencimiento === 'al_dia')?.total || 0,
        rangos.find(r => r.rango_vencimiento === '1-30')?.total || 0,
        rangos.find(r => r.rango_vencimiento === '31-60')?.total || 0,
        rangos.find(r => r.rango_vencimiento === '61-90')?.total || 0,
        rangos.find(r => r.rango_vencimiento === 'mas_90')?.total || 0
    ];

    agingChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Saldo Pendiente',
                data: data,
                backgroundColor: [
                    'rgba(40, 167, 69, 0.7)',   // Verde - Al día
                    'rgba(255, 193, 7, 0.7)',   // Amarillo - 1-30
                    'rgba(255, 152, 0, 0.7)',   // Naranja - 31-60
                    'rgba(244, 67, 54, 0.7)',   // Rojo claro - 61-90
                    'rgba(211, 47, 47, 0.7)'    // Rojo oscuro - +90
                ],
                borderColor: [
                    'rgba(40, 167, 69, 1)',
                    'rgba(255, 193, 7, 1)',
                    'rgba(255, 152, 0, 1)',
                    'rgba(244, 67, 54, 1)',
                    'rgba(211, 47, 47, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatearMoneda(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString('es-CO');
                        }
                    }
                }
            }
        }
    });
}

// ===============================================
// MODALES
// ===============================================

/**
 * Ver detalle de cuenta por cobrar
 */
async function verDetalleCxC(id) {
    const modal = new bootstrap.Modal(document.getElementById('modalDetalleCxC'));
    const content = document.getElementById('detalleCxCContent');

    modal.show();

    try {
        const response = await fetch(`${API_URL}/finanzas/cuentas-por-cobrar/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Error al cargar detalle');

        const result = await response.json();
        const cxc = result.data;

        content.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6 class="fw-bold mb-3">Información de la Factura</h6>
                    <table class="table table-sm">
                        <tr>
                            <td class="text-muted">Número Factura:</td>
                            <td class="fw-bold">${cxc.numero_factura}</td>
                        </tr>
                        <tr>
                            <td class="text-muted">Cliente:</td>
                            <td>${cxc.cliente_nombre}<br><small>${cxc.cliente_documento}</small></td>
                        </tr>
                        <tr>
                            <td class="text-muted">Fecha Emisión:</td>
                            <td>${formatearFecha(cxc.fecha_emision)}</td>
                        </tr>
                        <tr>
                            <td class="text-muted">Fecha Vencimiento:</td>
                            <td>${formatearFecha(cxc.fecha_vencimiento)}</td>
                        </tr>
                        <tr>
                            <td class="text-muted">Días Vencimiento:</td>
                            <td>${renderizarDiasVencimiento(cxc.dias_vencimiento)}</td>
                        </tr>
                        <tr>
                            <td class="text-muted">Estado:</td>
                            <td>${renderizarBadgeEstado(cxc.estado)}</td>
                        </tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6 class="fw-bold mb-3">Valores</h6>
                    <table class="table table-sm">
                        <tr>
                            <td class="text-muted">Subtotal:</td>
                            <td class="text-end">${formatearMoneda(cxc.subtotal)}</td>
                        </tr>
                        <tr>
                            <td class="text-muted">Descuento:</td>
                            <td class="text-end">${formatearMoneda(cxc.descuento)}</td>
                        </tr>
                        <tr>
                            <td class="text-muted">Impuesto:</td>
                            <td class="text-end">${formatearMoneda(cxc.impuesto)}</td>
                        </tr>
                        <tr>
                            <td class="text-muted fw-bold">Valor Original:</td>
                            <td class="text-end fw-bold">${formatearMoneda(cxc.valor_original)}</td>
                        </tr>
                        <tr>
                            <td class="text-muted text-danger fw-bold">Saldo Pendiente:</td>
                            <td class="text-end text-danger fw-bold fs-5">${formatearMoneda(cxc.saldo_pendiente)}</td>
                        </tr>
                    </table>
                </div>
            </div>

            ${cxc.pagos && cxc.pagos.length > 0 ? `
                <hr>
                <h6 class="fw-bold mb-3">Historial de Pagos</h6>
                <div class="table-responsive">
                    <table class="table table-sm table-striped">
                        <thead>
                            <tr>
                                <th>Recibo</th>
                                <th>Fecha</th>
                                <th>Método</th>
                                <th class="text-end">Valor Aplicado</th>
                                <th>Referencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cxc.pagos.map(pago => `
                                <tr>
                                    <td>${pago.numero_recibo}</td>
                                    <td>${formatearFecha(pago.fecha_recibo)}</td>
                                    <td><span class="badge bg-secondary">${pago.metodo_pago}</span></td>
                                    <td class="text-end fw-bold text-success">${formatearMoneda(pago.valor_aplicado)}</td>
                                    <td>${pago.referencia || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}
        `;

        // Guardar ID en el botón de aplicar pago
        document.getElementById('btnAplicarPagoDesdeDetalle').setAttribute('data-cxc-id', id);

    } catch (error) {
        console.error('Error al cargar detalle:', error);
        content.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Error al cargar el detalle de la cuenta por cobrar
            </div>
        `;
    }
}

/**
 * Aplicar pago a una CxC específica
 */
async function aplicarPago(cxcId) {
    const cxc = cuentasPorCobrar.find(c => c.id === cxcId);
    if (!cxc) return;

    // Prellenar cliente
    document.getElementById('modalCliente').value = cxc.cliente_id;
    
    // Cargar facturas del cliente
    await cargarFacturasPendientesCliente(cxc.cliente_id);

    // Marcar esta factura
    const checkbox = document.querySelector(`input[data-cxc-id="${cxcId}"]`);
    if (checkbox) checkbox.checked = true;

    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('modalRecibirPago'));
    modal.show();

    calcularTotalPago();
}

/**
 * Cargar facturas pendientes de un cliente
 */
async function cargarFacturasPendientesCliente(clienteId) {
    try {
        const response = await fetch(`${API_URL}/finanzas/cuentas-por-cobrar/cliente/${clienteId}?empresaId=${empresaActiva}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Error al cargar facturas del cliente');

        const result = await response.json();
        const facturas = result.data || [];

        const tbody = document.getElementById('listaFacturasPendientes');

        if (facturas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted">
                        Este cliente no tiene facturas pendientes
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = facturas.map(factura => `
            <tr>
                <td class="text-center">
                    <input type="checkbox" class="form-check-input factura-checkbox" 
                           data-cxc-id="${factura.id}" 
                           data-saldo="${factura.saldo_pendiente}"
                           onchange="calcularTotalPago()">
                </td>
                <td>
                    <strong>${factura.numero_factura}</strong><br>
                    <small class="text-muted">${formatearFecha(factura.fecha_vencimiento)}</small>
                </td>
                <td>
                    ${formatearFecha(factura.fecha_vencimiento)}
                    ${factura.dias_vencimiento < 0 ? `<br><small class="text-danger">Vencida</small>` : ''}
                </td>
                <td class="text-end fw-bold">${formatearMoneda(factura.saldo_pendiente)}</td>
                <td>
                    <input type="number" 
                           class="form-control form-control-sm valor-pago-input" 
                           data-cxc-id="${factura.id}"
                           placeholder="0.00" 
                           step="0.01" 
                           min="0" 
                           max="${factura.saldo_pendiente}"
                           onchange="calcularTotalPago()"
                           disabled>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error al cargar facturas del cliente:', error);
        mostrarError('Error al cargar facturas del cliente');
    }
}

/**
 * Calcular total del pago
 */
function calcularTotalPago() {
    const checkboxes = document.querySelectorAll('.factura-checkbox:checked');
    let totalPagar = 0;
    let cantidadFacturas = 0;

    checkboxes.forEach(checkbox => {
        const cxcId = checkbox.getAttribute('data-cxc-id');
        const input = document.querySelector(`.valor-pago-input[data-cxc-id="${cxcId}"]`);
        const saldo = parseFloat(checkbox.getAttribute('data-saldo'));

        // Habilitar/deshabilitar input
        input.disabled = !checkbox.checked;

        // Si está checkeado y no tiene valor, usar saldo completo
        if (checkbox.checked) {
            cantidadFacturas++;
            const valorPago = parseFloat(input.value) || saldo;
            input.value = valorPago.toFixed(2);
            totalPagar += valorPago;
        }
    });

    document.getElementById('resumenCantidadFacturas').textContent = cantidadFacturas;
    document.getElementById('resumenTotalPagar').textContent = formatearMoneda(totalPagar);
    document.getElementById('resumenTotalRecibo').textContent = formatearMoneda(totalPagar);
}

/**
 * Guardar recibo de caja
 */
async function guardarRecibo() {
    const clienteId = document.getElementById('modalCliente').value;
    const metodoPago = document.getElementById('modalMetodoPago').value;
    const referencia = document.getElementById('modalReferencia').value;
    const observaciones = document.getElementById('modalObservaciones').value;

    if (!clienteId) {
        mostrarError('Debe seleccionar un cliente');
        return;
    }

    // Obtener facturas seleccionadas con valores
    const detallePagos = [];
    document.querySelectorAll('.factura-checkbox:checked').forEach(checkbox => {
        const cxcId = checkbox.getAttribute('data-cxc-id');
        const input = document.querySelector(`.valor-pago-input[data-cxc-id="${cxcId}"]`);
        const valorAplicado = parseFloat(input.value);

        if (valorAplicado > 0) {
            detallePagos.push({
                cuenta_por_cobrar_id: parseInt(cxcId),
                valor_aplicado: valorAplicado
            });
        }
    });

    if (detallePagos.length === 0) {
        mostrarError('Debe seleccionar al menos una factura y especificar el valor a pagar');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/finanzas/recibos-caja`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                empresaId: empresaActiva,
                clienteId: parseInt(clienteId),
                metodo_pago: metodoPago,
                referencia: referencia || null,
                observaciones: observaciones || null,
                detallePagos: detallePagos
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al aplicar pago');
        }

        const result = await response.json();

        mostrarExito('Pago aplicado exitosamente');

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalRecibirPago'));
        modal.hide();

        // Limpiar formulario
        document.getElementById('formRecibirPago').reset();

        // Recargar datos
        await Promise.all([
            cargarResumenCartera(),
            cargarCuentasPorCobrar()
        ]);

    } catch (error) {
        console.error('Error al guardar recibo:', error);
        mostrarError(error.message || 'Error al aplicar el pago');
    }
}

// ===============================================
// EVENT LISTENERS
// ===============================================

function configurarEventListeners() {
    // Botón recibir pago
    document.getElementById('btnRecibirPago').addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('modalRecibirPago'));
        modal.show();
    });

    // Cambio de cliente en modal
    document.getElementById('modalCliente').addEventListener('change', (e) => {
        if (e.target.value) {
            cargarFacturasPendientesCliente(e.target.value);
        }
    });

    // Check all facturas
    document.getElementById('checkAllFacturas').addEventListener('change', (e) => {
        document.querySelectorAll('.factura-checkbox').forEach(checkbox => {
            checkbox.checked = e.target.checked;
            const input = document.querySelector(`.valor-pago-input[data-cxc-id="${checkbox.getAttribute('data-cxc-id')}"]`);
            input.disabled = !e.target.checked;
        });
        calcularTotalPago();
    });

    // Guardar recibo
    document.getElementById('btnGuardarRecibo').addEventListener('click', guardarRecibo);

    // Aplicar pago desde detalle
    document.getElementById('btnAplicarPagoDesdeDetalle').addEventListener('click', () => {
        const cxcId = parseInt(this.getAttribute('data-cxc-id'));
        const modalDetalle = bootstrap.Modal.getInstance(document.getElementById('modalDetalleCxC'));
        modalDetalle.hide();
        aplicarPago(cxcId);
    });

    // Filtros
    document.getElementById('filterEstado').addEventListener('change', cargarCuentasPorCobrar);
    document.getElementById('filterCliente').addEventListener('change', cargarCuentasPorCobrar);
    document.getElementById('filterFechaDesde').addEventListener('change', cargarCuentasPorCobrar);
    document.getElementById('filterFechaHasta').addEventListener('change', cargarCuentasPorCobrar);

    // Limpiar filtros
    document.getElementById('btnLimpiarFiltros').addEventListener('click', () => {
        document.getElementById('filterEstado').value = '';
        document.getElementById('filterCliente').value = '';
        document.getElementById('filterFechaDesde').value = '';
        document.getElementById('filterFechaHasta').value = '';
        cargarCuentasPorCobrar();
    });

    // Exportar Excel
    document.getElementById('btnExportarExcel').addEventListener('click', exportarExcel);
}

// ===============================================
// UTILIDADES
// ===============================================

function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(valor || 0);
}

function formatearFecha(fecha) {
    if (!fecha) return '-';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function renderizarBadgeEstado(estado) {
    const badges = {
        'vigente': '<span class="badge bg-success">Vigente</span>',
        'vencida': '<span class="badge bg-danger">Vencida</span>',
        'pagada': '<span class="badge bg-secondary">Pagada</span>',
        'anulada': '<span class="badge bg-dark">Anulada</span>'
    };
    return badges[estado] || '<span class="badge bg-secondary">-</span>';
}

function renderizarDiasVencimiento(dias) {
    if (dias === null || dias === undefined) return '-';
    
    if (dias < 0) {
        return `<span class="badge bg-danger">${Math.abs(dias)} días vencida</span>`;
    } else if (dias === 0) {
        return `<span class="badge bg-warning">Vence hoy</span>`;
    } else {
        return `<span class="badge bg-success">${dias} días</span>`;
    }
}

function mostrarExito(mensaje) {
    // Implementar notificación de éxito (puedes usar toastr o similar)
    alert(mensaje);
}

function mostrarError(mensaje) {
    // Implementar notificación de error (puedes usar toastr o similar)
    alert(mensaje);
}

function exportarExcel() {
    // TODO: Implementar exportación a Excel
    mostrarError('Funcionalidad en desarrollo');
}
