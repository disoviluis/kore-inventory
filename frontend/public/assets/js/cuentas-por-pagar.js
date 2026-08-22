const API_URL = '/api';
const token = localStorage.getItem('token');
let currentEmpresa = null;
let currentUsuario = null;
let cuentasPorPagar = [];
let proveedores = [];
let agingChart = null;
let modalDetalle = null;
let modalPago = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        currentUsuario = JSON.parse(localStorage.getItem('usuario'));
        if (!currentUsuario) {
            const response = await apiFetch('/auth/verify');
            currentUsuario = response.data;
            localStorage.setItem('usuario', JSON.stringify(currentUsuario));
        }

        cargarInfoUsuario();
        await cargarEmpresas();
        if (!currentEmpresa) throw new Error('No hay una empresa activa disponible');

        modalDetalle = new bootstrap.Modal(document.getElementById('modalDetalle'));
        modalPago = new bootstrap.Modal(document.getElementById('modalPago'));
        configurarEventos();
        await recargarModulo();
        if (typeof inicializarPermisos === 'function') await inicializarPermisos();
    } catch (error) {
        console.error('Error al iniciar Cuentas por Pagar:', error);
        mostrarAlerta(error.message || 'No fue posible cargar el módulo', 'danger');
    }
});

async function apiFetch(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || 'Error en la solicitud');
    return result;
}

function cargarInfoUsuario() {
    document.getElementById('userName').textContent = `${currentUsuario.nombre || ''} ${currentUsuario.apellido || ''}`.trim() || 'Usuario';
    const roles = { super_admin: 'Super Administrador', admin_empresa: 'Administrador', usuario: 'Usuario', soporte: 'Soporte' };
    document.getElementById('userRole').textContent = roles[currentUsuario.tipo_usuario] || currentUsuario.tipo_usuario;
}

async function cargarEmpresas() {
    const result = await apiFetch(`/empresas/usuario/${currentUsuario.id}`);
    const empresas = result.data || [];
    if (empresas.length === 0) return;

    const selector = document.getElementById('companySelector');
    const texto = document.getElementById('companyText');
    const empresaGuardada = localStorage.getItem('empresaActiva');
    currentEmpresa = empresas.find(empresa => String(empresa.id) === empresaGuardada) || empresas[0];
    localStorage.setItem('empresaActiva', String(currentEmpresa.id));

    if (currentUsuario.tipo_usuario === 'usuario' || empresas.length === 1) {
        texto.style.display = 'block';
        document.getElementById('companyNameText').textContent = currentEmpresa.nombre;
        return;
    }

    selector.innerHTML = empresas.map(empresa => `<option value="${empresa.id}">${escapeHtml(empresa.nombre)}</option>`).join('');
    selector.value = currentEmpresa.id;
    selector.style.display = 'block';
    selector.addEventListener('change', async () => {
        currentEmpresa = empresas.find(empresa => String(empresa.id) === selector.value);
        localStorage.setItem('empresaActiva', selector.value);
        localStorage.removeItem('permisosDetallados');
        await recargarModulo();
        if (typeof inicializarPermisos === 'function') await inicializarPermisos();
    });
}

async function recargarModulo() {
    await Promise.all([cargarResumen(), cargarCuentas(), cargarProveedores()]);
}

async function cargarResumen() {
    const result = await apiFetch(`/finanzas/cuentas-por-pagar/dashboard/resumen?empresaId=${currentEmpresa.id}`);
    const totales = result.data.totales || {};
    document.getElementById('totalPorPagar').textContent = formatearMoneda(totales.total_por_pagar);
    document.getElementById('saldoVigente').textContent = formatearMoneda(totales.saldo_vigente);
    document.getElementById('saldoVencido').textContent = formatearMoneda(totales.saldo_vencido);
    document.getElementById('cuentasVigentes').textContent = Number(totales.cuentas_vigentes || 0);
    document.getElementById('cuentasVencidas').textContent = Number(totales.cuentas_vencidas || 0);
    document.getElementById('cuentasPendientes').textContent = Number(totales.cuentas_vigentes || 0) + Number(totales.cuentas_vencidas || 0);
    renderizarGrafico(result.data.rangos || []);
}

async function cargarCuentas() {
    const params = new URLSearchParams({ empresaId: currentEmpresa.id });
    const filtros = {
        estado: document.getElementById('filterEstado').value,
        proveedorId: document.getElementById('filterProveedor').value,
        fechaDesde: document.getElementById('filterFechaDesde').value,
        fechaHasta: document.getElementById('filterFechaHasta').value
    };
    Object.entries(filtros).forEach(([clave, valor]) => { if (valor) params.set(clave, valor); });
    const result = await apiFetch(`/finanzas/cuentas-por-pagar?${params}`);
    cuentasPorPagar = result.data || [];
    renderizarTabla();
    const proxima = cuentasPorPagar
        .filter(cuenta => cuenta.estado === 'vigente')
        .sort((a, b) => String(a.fecha_vencimiento).localeCompare(String(b.fecha_vencimiento)))[0];
    document.getElementById('proximoVencimiento').textContent = proxima ? formatearFecha(proxima.fecha_vencimiento) : '-';
}

async function cargarProveedores() {
    const result = await apiFetch(`/proveedores?empresaId=${currentEmpresa.id}`);
    proveedores = result.data || [];
    const opciones = proveedores.map(proveedor => `<option value="${proveedor.id}">${escapeHtml(proveedor.razon_social || proveedor.nombre_comercial || 'Proveedor')}</option>`).join('');
    const filtro = document.getElementById('filterProveedor');
    const pago = document.getElementById('pagoProveedor');
    const filtroActual = filtro.value;
    filtro.innerHTML = `<option value="">Todos los proveedores</option>${opciones}`;
    filtro.value = filtroActual;
    pago.innerHTML = `<option value="">Seleccionar proveedor...</option>${opciones}`;
}

function renderizarTabla() {
    document.getElementById('totalRegistros').textContent = `${cuentasPorPagar.length} registros`;
    const tbody = document.getElementById('tablaCxPBody');
    if (cuentasPorPagar.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-5 text-muted"><i class="bi bi-inbox fs-1 d-block mb-2"></i>No hay cuentas por pagar para estos filtros</td></tr>';
        return;
    }
    tbody.innerHTML = cuentasPorPagar.map(cuenta => `<tr>
        <td><strong>${escapeHtml(cuenta.numero_compra)}</strong><br><small class="text-muted">${escapeHtml(cuenta.numero_documento)}</small></td>
        <td><strong>${escapeHtml(cuenta.proveedor_nombre)}</strong><br><small class="text-muted">${escapeHtml(cuenta.proveedor_documento || '')}</small></td>
        <td>${formatearFecha(cuenta.fecha_emision)}</td><td>${formatearFecha(cuenta.fecha_vencimiento)}</td>
        <td class="text-end">${formatearMoneda(cuenta.valor_original)}</td><td class="text-end fw-bold ${Number(cuenta.saldo_pendiente) > 0 ? 'text-danger' : 'text-success'}">${formatearMoneda(cuenta.saldo_pendiente)}</td>
        <td class="text-center">${cuenta.estado === 'vencida' ? Number(cuenta.dias_vencimiento || 0) : '-'}</td>
        <td class="text-center">${badgeEstado(cuenta.estado)}</td>
        <td class="text-center"><button class="btn btn-sm btn-outline-primary" onclick="verDetalle(${cuenta.id})" title="Ver detalle"><i class="bi bi-eye"></i></button>${['vigente', 'vencida'].includes(cuenta.estado) ? ` <button class="btn btn-sm btn-outline-success" onclick="abrirPago(${cuenta.proveedor_id}, ${cuenta.id})" title="Registrar pago" data-permiso-modulo="cuentas_por_pagar" data-permiso-accion="create"><i class="bi bi-cash-coin"></i></button>` : ''}</td>
    </tr>`).join('');
    if (typeof aplicarPermisosUI === 'function') aplicarPermisosUI();
}

function renderizarGrafico(rangos) {
    const orden = ['al_dia', '1-30', '31-60', '61-90', 'mas_90'];
    const valores = orden.map(rango => Number(rangos.find(item => item.rango_vencimiento === rango)?.total || 0));
    if (agingChart) agingChart.destroy();
    agingChart = new Chart(document.getElementById('agingChart'), {
        type: 'bar',
        data: { labels: ['Al día', '1-30 días', '31-60 días', '61-90 días', 'Más de 90'], datasets: [{ label: 'Saldo', data: valores, backgroundColor: ['#198754', '#ffc107', '#fd7e14', '#dc3545', '#842029'] }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: valor => formatearMoneda(valor) } } } }
    });
}

async function verDetalle(id) {
    try {
        const result = await apiFetch(`/finanzas/cuentas-por-pagar/${id}?empresaId=${currentEmpresa.id}`);
        const cuenta = result.data;
        const pagos = cuenta.pagos || [];
        document.getElementById('detalleContent').innerHTML = `<div class="row g-3">
            <div class="col-md-6"><small class="text-muted">Proveedor</small><div class="fw-bold">${escapeHtml(cuenta.proveedor_nombre)}</div><div>${escapeHtml(cuenta.proveedor_documento || '')}</div></div>
            <div class="col-md-6"><small class="text-muted">Compra</small><div class="fw-bold">${escapeHtml(cuenta.numero_compra)}</div><div>Vence: ${formatearFecha(cuenta.fecha_vencimiento)}</div></div>
            <div class="col-md-4"><small class="text-muted">Valor original</small><div class="fs-5">${formatearMoneda(cuenta.valor_original)}</div></div>
            <div class="col-md-4"><small class="text-muted">Valor pagado</small><div class="fs-5 text-success">${formatearMoneda(cuenta.valor_pagado)}</div></div>
            <div class="col-md-4"><small class="text-muted">Saldo pendiente</small><div class="fs-5 text-danger fw-bold">${formatearMoneda(cuenta.saldo_pendiente)}</div></div>
            <div class="col-12"><hr><h6>Historial de pagos</h6>${pagos.length ? `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Comprobante</th><th>Fecha</th><th>Método</th><th>Referencia</th><th class="text-end">Valor</th></tr></thead><tbody>${pagos.map(pago => `<tr><td>${escapeHtml(pago.numero_comprobante)}</td><td>${formatearFecha(pago.fecha_pago)}</td><td>${escapeHtml(pago.metodo_pago)}</td><td>${escapeHtml(pago.referencia || '-')}</td><td class="text-end">${formatearMoneda(pago.valor_aplicado)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="text-muted">Aún no se han aplicado pagos.</p>'}</div>
        </div>`;
        modalDetalle.show();
    } catch (error) { mostrarAlerta(error.message, 'danger'); }
}

async function abrirPago(proveedorId = '', cuentaId = '') {
    document.getElementById('formPago').reset();
    document.getElementById('pagoProveedor').value = proveedorId;
    actualizarResumenPago();
    modalPago.show();
    if (proveedorId) await cargarPendientesProveedor(proveedorId, cuentaId);
}

async function cargarPendientesProveedor(proveedorId, cuentaPreseleccionada = '') {
    const tbody = document.getElementById('cuentasPendientesBody');
    if (!proveedorId) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Seleccione un proveedor</td></tr>';
        actualizarResumenPago();
        return;
    }
    try {
        const result = await apiFetch(`/finanzas/cuentas-por-pagar/proveedor/${proveedorId}?empresaId=${currentEmpresa.id}`);
        const cuentas = result.data || [];
        tbody.innerHTML = cuentas.length ? cuentas.map(cuenta => {
            const checked = Number(cuenta.id) === Number(cuentaPreseleccionada) ? 'checked' : '';
            return `<tr><td><input type="checkbox" class="form-check-input cuenta-check" data-id="${cuenta.id}" ${checked}></td><td>${escapeHtml(cuenta.numero_compra)}</td><td>${formatearFecha(cuenta.fecha_vencimiento)}</td><td class="text-end">${formatearMoneda(cuenta.saldo_pendiente)}</td><td><input type="number" class="form-control form-control-sm valor-pago" data-id="${cuenta.id}" min="0.01" max="${Number(cuenta.saldo_pendiente)}" step="0.01" value="${checked ? Number(cuenta.saldo_pendiente) : ''}" ${checked ? '' : 'disabled'}></td></tr>`;
        }).join('') : '<tr><td colspan="5" class="text-center text-muted">El proveedor no tiene cuentas pendientes</td></tr>';
        document.querySelectorAll('.cuenta-check').forEach(check => check.addEventListener('change', manejarSeleccionCuenta));
        document.querySelectorAll('.valor-pago').forEach(input => input.addEventListener('input', actualizarResumenPago));
        actualizarResumenPago();
    } catch (error) { mostrarAlerta(error.message, 'danger'); }
}

function manejarSeleccionCuenta(event) {
    const input = document.querySelector(`.valor-pago[data-id="${event.target.dataset.id}"]`);
    input.disabled = !event.target.checked;
    input.value = event.target.checked ? input.max : '';
    actualizarResumenPago();
}

function actualizarResumenPago() {
    const seleccionadas = [...document.querySelectorAll('.cuenta-check:checked')];
    const total = seleccionadas.reduce((suma, check) => suma + Number(document.querySelector(`.valor-pago[data-id="${check.dataset.id}"]`).value || 0), 0);
    document.getElementById('pagoCantidad').textContent = seleccionadas.length;
    document.getElementById('pagoTotal').textContent = formatearMoneda(total);
}

async function guardarPago() {
    const proveedorId = Number(document.getElementById('pagoProveedor').value);
    const detallePagos = [...document.querySelectorAll('.cuenta-check:checked')].map(check => ({
        cuenta_por_pagar_id: Number(check.dataset.id),
        valor_aplicado: Number(document.querySelector(`.valor-pago[data-id="${check.dataset.id}"]`).value)
    }));
    if (!proveedorId || detallePagos.length === 0 || detallePagos.some(detalle => detalle.valor_aplicado <= 0)) {
        mostrarAlerta('Selecciona al menos una cuenta e ingresa un valor válido', 'warning');
        return;
    }
    const boton = document.getElementById('btnGuardarPago');
    boton.disabled = true;
    try {
        const result = await apiFetch('/finanzas/comprobantes-egreso', {
            method: 'POST',
            body: JSON.stringify({ empresaId: currentEmpresa.id, proveedorId, metodo_pago: document.getElementById('pagoMetodo').value, referencia: document.getElementById('pagoReferencia').value.trim(), observaciones: document.getElementById('pagoObservaciones').value.trim(), detallePagos })
        });
        modalPago.hide();
        mostrarAlerta(`Pago registrado: ${result.data.numero_comprobante}`, 'success');
        await Promise.all([cargarResumen(), cargarCuentas()]);
    } catch (error) { mostrarAlerta(error.message, 'danger'); }
    finally { boton.disabled = false; }
}

function exportarCuentas() {
    const encabezados = ['Compra', 'Proveedor', 'Documento', 'Emisión', 'Vencimiento', 'Valor original', 'Saldo', 'Estado'];
    const filas = cuentasPorPagar.map(cuenta => [cuenta.numero_compra, cuenta.proveedor_nombre, cuenta.proveedor_documento || '', cuenta.fecha_emision, cuenta.fecha_vencimiento, cuenta.valor_original, cuenta.saldo_pendiente, cuenta.estado]);
    const csv = [encabezados, ...filas].map(fila => fila.map(valor => `"${String(valor ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    enlace.download = `cuentas-por-pagar-${currentEmpresa.id}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
}

function configurarEventos() {
    ['filterEstado', 'filterProveedor', 'filterFechaDesde', 'filterFechaHasta'].forEach(id => document.getElementById(id).addEventListener('change', cargarCuentas));
    document.getElementById('btnLimpiar').addEventListener('click', () => { ['filterEstado', 'filterProveedor', 'filterFechaDesde', 'filterFechaHasta'].forEach(id => { document.getElementById(id).value = ''; }); cargarCuentas(); });
    document.getElementById('btnRegistrarPago').addEventListener('click', () => abrirPago());
    document.getElementById('btnExportar').addEventListener('click', exportarCuentas);
    document.getElementById('pagoProveedor').addEventListener('change', event => cargarPendientesProveedor(event.target.value));
    document.getElementById('checkTodas').addEventListener('change', event => { document.querySelectorAll('.cuenta-check').forEach(check => { check.checked = event.target.checked; check.dispatchEvent(new Event('change')); }); });
    document.getElementById('btnGuardarPago').addEventListener('click', guardarPago);
    document.getElementById('logoutBtn').addEventListener('click', event => { event.preventDefault(); localStorage.clear(); window.location.href = 'login.html'; });
    document.getElementById('toggleSidebar').addEventListener('click', () => { document.getElementById('sidebar').classList.toggle('active'); document.getElementById('sidebarOverlay').classList.toggle('active'); });
    ['closeSidebar', 'sidebarOverlay'].forEach(id => document.getElementById(id).addEventListener('click', () => { document.getElementById('sidebar').classList.remove('active'); document.getElementById('sidebarOverlay').classList.remove('active'); }));
}

function badgeEstado(estado) {
    const clases = { vigente: 'success', vencida: 'danger', pagada: 'primary', anulada: 'secondary' };
    return `<span class="badge bg-${clases[estado] || 'secondary'}">${escapeHtml(estado || '-')}</span>`;
}

function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor || 0));
}

function formatearFecha(fecha) {
    if (!fecha) return '-';
    return new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(fecha));
}

function escapeHtml(valor) {
    const div = document.createElement('div');
    div.textContent = String(valor ?? '');
    return div.innerHTML;
}

function mostrarAlerta(mensaje, tipo) {
    const alerta = document.createElement('div');
    alerta.className = `alert alert-${tipo} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    alerta.style.zIndex = '2000';
    alerta.innerHTML = `${escapeHtml(mensaje)}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    document.body.appendChild(alerta);
    setTimeout(() => alerta.remove(), 5000);
}