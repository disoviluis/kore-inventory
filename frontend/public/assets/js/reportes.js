/**
 * KORE INVENTORY - Módulo de Reportes & Analytics
 * Dashboard analítico dinámico con insights automáticos
 */

const API_URL = '/api';
let currentEmpresa = null;
let currentUsuario = null;
let charts = {};

// Filtros actuales
let filtros = {
    fechaInicio: '',
    fechaFin: '',
    agrupar: 'dia'
};

// ─── INICIALIZACIÓN ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = 'login.html'; return; }

    try {
        let usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
        if (!usuario) {
            const r = await fetch(`${API_URL}/auth/verify`, { headers: { 'Authorization': `Bearer ${token}` } });
            const d = await r.json();
            if (!d.success) { window.location.href = 'login.html'; return; }
            usuario = d.data;
            localStorage.setItem('usuario', JSON.stringify(usuario));
        }
        currentUsuario = usuario;

        // Empresa activa
        const empresaActivaId = localStorage.getItem('empresaActiva');
        if (empresaActivaId) {
            const re = await fetch(`${API_URL}/empresas/${empresaActivaId}`, { headers: { 'Authorization': `Bearer ${token}` } });
            const de = await re.json();
            if (de.success) currentEmpresa = de.data;
        }
        if (!currentEmpresa) {
            const re2 = await fetch(`${API_URL}/usuarios/${usuario.id}/empresa-activa`, { headers: { 'Authorization': `Bearer ${token}` } });
            const de2 = await re2.json();
            if (de2.success) currentEmpresa = de2.data;
        }

        if (!currentEmpresa?.id) {
            document.getElementById('mainContent').innerHTML = '<div class="alert alert-warning m-4">No hay empresa configurada.</div>';
            return;
        }

        inicializarFiltros();
        initEventListeners();
        await cargarTodo();

    } catch (err) {
        console.error('Error inicialización reportes:', err);
    }
});

function inicializarFiltros() {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    filtros.fechaInicio = primerDiaMes.toISOString().split('T')[0];
    filtros.fechaFin = hoy.toISOString().split('T')[0];

    document.getElementById('fechaInicio').value = filtros.fechaInicio;
    document.getElementById('fechaFin').value = filtros.fechaFin;
    document.getElementById('selectAgrupar').value = filtros.agrupar;
}

function initEventListeners() {
    document.getElementById('btnAplicarFiltros').addEventListener('click', async () => {
        filtros.fechaInicio = document.getElementById('fechaInicio').value;
        filtros.fechaFin = document.getElementById('fechaFin').value;
        filtros.agrupar = document.getElementById('selectAgrupar').value;
        await cargarTodo();
    });

    document.getElementById('btnHoy').addEventListener('click', () => setRapido('hoy'));
    document.getElementById('btnSemana').addEventListener('click', () => setRapido('semana'));
    document.getElementById('btnMes').addEventListener('click', () => setRapido('mes'));
    document.getElementById('btnAno').addEventListener('click', () => setRapido('ano'));

    document.getElementById('ordenProductos').addEventListener('change', cargarTopProductos);
    document.getElementById('btnGuardarReporte').addEventListener('click', guardarReporteActual);
    document.getElementById('btnExportarReporte').addEventListener('click', exportarReporte);

    // Sidebar
    const toggleBtn = document.getElementById('toggleSidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.toggle('active');
            document.getElementById('sidebarOverlay')?.classList.toggle('active');
        });
    }
    document.getElementById('closeSidebar')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.remove('active');
        document.getElementById('sidebarOverlay')?.classList.remove('active');
    });
    document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.remove('active');
        document.getElementById('sidebarOverlay')?.classList.remove('active');
    });
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.clear(); window.location.href = 'login.html';
    });
}

function setRapido(periodo) {
    const hoy = new Date();
    let fi, ff;
    if (periodo === 'hoy') {
        fi = ff = hoy.toISOString().split('T')[0];
        filtros.agrupar = 'dia';
    } else if (periodo === 'semana') {
        const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - hoy.getDay() + 1);
        fi = lunes.toISOString().split('T')[0];
        ff = hoy.toISOString().split('T')[0];
        filtros.agrupar = 'dia';
    } else if (periodo === 'mes') {
        fi = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
        ff = hoy.toISOString().split('T')[0];
        filtros.agrupar = 'dia';
    } else if (periodo === 'ano') {
        fi = `${hoy.getFullYear()}-01-01`;
        ff = hoy.toISOString().split('T')[0];
        filtros.agrupar = 'mes';
    }
    filtros.fechaInicio = fi;
    filtros.fechaFin = ff;
    document.getElementById('fechaInicio').value = fi;
    document.getElementById('fechaFin').value = ff;
    document.getElementById('selectAgrupar').value = filtros.agrupar;
    cargarTodo();
}

// ─── CARGA PRINCIPAL ─────────────────────────────────────────────────────────
async function cargarTodo() {
    mostrarLoading(true);
    try {
        await Promise.all([
            cargarKPIs(),
            cargarVentasTiempo(),
            cargarTopVendedores(),
            cargarTopProductos(),
            cargarCategorias(),
            cargarBodegas(),
            cargarInventarioRiesgo(),
            cargarReportesGuardados()
        ]);
    } catch (e) {
        console.error(e);
    }
    mostrarLoading(false);
}

function mostrarLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────
async function cargarKPIs() {
    const data = await apiGet(`/reportes/kpis?empresaId=${currentEmpresa.id}&fechaInicio=${filtros.fechaInicio}&fechaFin=${filtros.fechaFin}`);
    if (!data) return;

    const v = data.ventas;
    setKPI('kpiVentas', formatMoney(v.total), v.variacion_ventas, '%');
    setKPI('kpiTransacciones', v.transacciones, v.variacion_transacciones, '%');
    setKPI('kpiTicket', formatMoney(v.ticket_promedio), null, '');
    setKPI('kpiGanancia', formatMoney(v.ganancia_bruta), v.total > 0 ? (v.ganancia_bruta / v.total * 100).toFixed(1) : 0, '%');
    setKPI('kpiStockBajo', data.inventario.productos_stock_bajo, null, '');
    setKPI('kpiClientes', data.clientes.activos_periodo, null, '');

    // Insights IA
    generarInsights(data);
}

function setKPI(id, valor, variacion, suffix) {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelector('.kpi-valor').textContent = valor;
    const varEl = el.querySelector('.kpi-variacion');
    if (varEl && variacion !== null) {
        const v = parseFloat(variacion);
        varEl.className = `kpi-variacion ${v >= 0 ? 'text-success' : 'text-danger'}`;
        varEl.innerHTML = `<i class="bi bi-arrow-${v >= 0 ? 'up' : 'down'}-short"></i> ${Math.abs(v)}${suffix} vs período anterior`;
    }
}

// ─── VENTAS POR TIEMPO ────────────────────────────────────────────────────────
async function cargarVentasTiempo() {
    const data = await apiGet(`/reportes/ventas-tiempo?empresaId=${currentEmpresa.id}&fechaInicio=${filtros.fechaInicio}&fechaFin=${filtros.fechaFin}&agrupar=${filtros.agrupar}`);
    if (!data) return;

    const labels = data.map(d => d.periodo);
    const ventas = data.map(d => parseFloat(d.total_ventas));
    const ganancias = data.map(d => parseFloat(d.ganancia));

    renderChart('chartVentasTiempo', 'line', labels, [
        { label: 'Ventas', data: ventas, borderColor: '#0d6efd', backgroundColor: 'rgba(13,110,253,0.1)', fill: true, tension: 0.4 },
        { label: 'Ganancia', data: ganancias, borderColor: '#198754', backgroundColor: 'rgba(25,135,84,0.1)', fill: true, tension: 0.4 }
    ], { prefix: '$' });
}

// ─── TOP VENDEDORES ───────────────────────────────────────────────────────────
async function cargarTopVendedores() {
    const data = await apiGet(`/reportes/top-vendedores?empresaId=${currentEmpresa.id}&fechaInicio=${filtros.fechaInicio}&fechaFin=${filtros.fechaFin}&limite=8`);
    if (!data?.length) { document.getElementById('tablaVendedores').innerHTML = '<tr><td colspan="5" class="text-center text-muted">Sin datos en el período</td></tr>'; return; }

    const labels = data.map(d => d.vendedor.trim());
    const ventas = data.map(d => parseFloat(d.total_ventas));
    const ganancias = data.map(d => parseFloat(d.ganancia));

    renderChart('chartVendedores', 'bar', labels, [
        { label: 'Ventas', data: ventas, backgroundColor: 'rgba(13,110,253,0.7)' },
        { label: 'Ganancia', data: ganancias, backgroundColor: 'rgba(25,135,84,0.7)' }
    ], { horizontal: true, prefix: '$' });

    document.getElementById('tablaVendedores').innerHTML = data.map((v, i) => `
        <tr>
            <td><span class="badge ${i === 0 ? 'bg-warning text-dark' : i === 1 ? 'bg-secondary' : 'bg-light text-dark'}">#${i + 1}</span></td>
            <td>${v.vendedor.trim()}</td>
            <td class="text-center">${v.transacciones}</td>
            <td class="text-end fw-semibold">${formatMoney(v.total_ventas)}</td>
            <td class="text-end">
                <span class="text-success">${formatMoney(v.ganancia)}</span>
                <small class="text-muted d-block">${parseFloat(v.margen_pct).toFixed(1)}% margen</small>
            </td>
        </tr>
    `).join('');
}

// ─── TOP PRODUCTOS ────────────────────────────────────────────────────────────
async function cargarTopProductos() {
    const orden = document.getElementById('ordenProductos')?.value || 'ventas';
    const data = await apiGet(`/reportes/top-productos?empresaId=${currentEmpresa.id}&fechaInicio=${filtros.fechaInicio}&fechaFin=${filtros.fechaFin}&limite=10&orden=${orden}`);
    if (!data?.length) { document.getElementById('tablaProductos').innerHTML = '<tr><td colspan="5" class="text-center text-muted">Sin datos en el período</td></tr>'; return; }

    const labels = data.map(d => d.producto.length > 25 ? d.producto.substring(0, 23) + '…' : d.producto);
    renderChart('chartProductos', 'bar', labels, [
        { label: 'Ventas', data: data.map(d => parseFloat(d.total_ventas)), backgroundColor: 'rgba(255,153,0,0.75)' }
    ], { prefix: '$' });

    document.getElementById('tablaProductos').innerHTML = data.map((p, i) => `
        <tr>
            <td><small class="text-muted">#${i + 1}</small></td>
            <td>
                <div class="fw-semibold">${p.producto}</div>
                <small class="text-muted">${p.sku || ''} · ${p.categoria}</small>
            </td>
            <td class="text-center">${p.cantidad_vendida}</td>
            <td class="text-end">${formatMoney(p.total_ventas)}</td>
            <td class="text-end">
                <span class="text-success">${formatMoney(p.ganancia)}</span>
                <small class="d-block text-muted">${parseFloat(p.margen_pct).toFixed(1)}%</small>
            </td>
        </tr>
    `).join('');
}

// ─── CATEGORÍAS ───────────────────────────────────────────────────────────────
async function cargarCategorias() {
    const data = await apiGet(`/reportes/categorias?empresaId=${currentEmpresa.id}&fechaInicio=${filtros.fechaInicio}&fechaFin=${filtros.fechaFin}`);
    if (!data?.length) return;

    const labels = data.map(d => d.categoria);
    const ventas = data.map(d => parseFloat(d.total_ventas));
    const colors = ['#0d6efd','#198754','#ffc107','#dc3545','#6f42c1','#0dcaf0','#fd7e14','#20c997'];

    renderChart('chartCategorias', 'doughnut', labels, [
        { data: ventas, backgroundColor: colors.slice(0, labels.length), borderWidth: 2 }
    ], { prefix: '$', legend: true });
}

// ─── BODEGAS ──────────────────────────────────────────────────────────────────
async function cargarBodegas() {
    const data = await apiGet(`/reportes/bodegas?empresaId=${currentEmpresa.id}&fechaInicio=${filtros.fechaInicio}&fechaFin=${filtros.fechaFin}`);
    if (!data) return;

    const { ventas_por_caja, stock_bodegas } = data;

    if (ventas_por_caja?.length) {
        const labels = ventas_por_caja.map(d => d.caja_nombre);
        renderChart('chartCajas', 'bar', labels, [
            { label: 'Ventas', data: ventas_por_caja.map(d => parseFloat(d.total_ventas)), backgroundColor: 'rgba(13,110,253,0.7)' },
            { label: 'Ganancia', data: ventas_por_caja.map(d => parseFloat(d.ganancia)), backgroundColor: 'rgba(25,135,84,0.7)' }
        ], { prefix: '$' });

        // Insight: caja con más ventas vs más ganancia
        const masSales = [...ventas_por_caja].sort((a, b) => b.total_ventas - a.total_ventas)[0];
        const masGanancia = [...ventas_por_caja].sort((a, b) => b.ganancia - a.ganancia)[0];
        const insightCajas = document.getElementById('insightCajas');
        if (insightCajas && masSales && masGanancia) {
            if (masSales.caja_id !== masGanancia.caja_id) {
                insightCajas.innerHTML = `<i class="bi bi-lightbulb text-warning me-1"></i> <strong>${masSales.caja_nombre}</strong> tuvo más ventas (${formatMoney(masSales.total_ventas)}), pero <strong>${masGanancia.caja_nombre}</strong> generó más ganancia (${formatMoney(masGanancia.ganancia)}, ${parseFloat(masGanancia.margen_pct).toFixed(1)}% margen). Evalúa la mezcla de productos.`;
            } else {
                insightCajas.innerHTML = `<i class="bi bi-check-circle text-success me-1"></i> <strong>${masSales.caja_nombre}</strong> lidera tanto en ventas como en ganancia.`;
            }
        }
    }

    if (stock_bodegas?.length) {
        document.getElementById('tablaStockBodegas').innerHTML = stock_bodegas.map(b => `
            <tr>
                <td>${b.nombre} ${b.es_principal ? '<span class="badge bg-primary ms-1">Principal</span>' : ''}</td>
                <td class="text-center">${b.total_productos}</td>
                <td class="text-center">${b.stock_total}</td>
                <td class="text-end fw-semibold">${formatMoney(b.valor_inventario)}</td>
            </tr>
        `).join('');
    }
}

// ─── INVENTARIO EN RIESGO ─────────────────────────────────────────────────────
async function cargarInventarioRiesgo() {
    const data = await apiGet(`/reportes/inventario-riesgo?empresaId=${currentEmpresa.id}`);
    if (!data) return;

    const { stock_bajo, sin_movimiento } = data;

    document.getElementById('tablaStockBajo').innerHTML = stock_bajo?.length
        ? stock_bajo.map(p => `
            <tr class="${p.stock_actual <= 0 ? 'table-danger' : 'table-warning'}">
                <td>${p.nombre}<br><small class="text-muted">${p.sku || ''} · ${p.categoria}</small></td>
                <td class="text-center fw-bold">${p.stock_actual}</td>
                <td class="text-center">${p.stock_minimo || 0}</td>
                <td class="text-end">${formatMoney(p.valor_en_riesgo)}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="4" class="text-center text-success"><i class="bi bi-check-circle me-1"></i>Inventario saludable</td></tr>';

    document.getElementById('tablaSinMovimiento').innerHTML = sin_movimiento?.length
        ? sin_movimiento.map(p => `
            <tr>
                <td>${p.nombre}<br><small class="text-muted">${p.sku || ''} · ${p.categoria}</small></td>
                <td class="text-center">${p.stock_actual}</td>
                <td class="text-end">${formatMoney(p.capital_inmovilizado)}</td>
                <td class="text-center"><small class="text-muted">${p.ultimo_movimiento ? new Date(p.ultimo_movimiento).toLocaleDateString('es-CO') : 'Nunca'}</small></td>
            </tr>
        `).join('')
        : '<tr><td colspan="4" class="text-center text-muted">Sin productos estancados</td></tr>';
}

// ─── REPORTES GUARDADOS ───────────────────────────────────────────────────────
async function cargarReportesGuardados() {
    const data = await apiGet(`/reportes/guardados?empresaId=${currentEmpresa.id}`);
    const cont = document.getElementById('listaReportesGuardados');
    if (!cont) return;

    if (!data?.length) {
        cont.innerHTML = '<p class="text-muted small">Aún no hay reportes guardados.</p>';
        return;
    }
    cont.innerHTML = data.map(r => `
        <div class="d-flex align-items-center justify-content-between mb-2 p-2 border rounded">
            <div>
                <div class="fw-semibold small">${r.nombre}</div>
                <small class="text-muted">${r.tipo} · ${r.creado_por}</small>
            </div>
            <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-primary" onclick="cargarReporteGuardado(${r.id})" title="Cargar">
                    <i class="bi bi-play-fill"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="eliminarReporte(${r.id})" title="Eliminar">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

async function guardarReporteActual() {
    const nombre = prompt('Nombre del reporte:');
    if (!nombre) return;
    const token = localStorage.getItem('token');
    const r = await fetch(`${API_URL}/reportes/guardados`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            empresaId: currentEmpresa.id,
            usuarioId: currentUsuario.id,
            nombre,
            tipo: 'personalizado',
            configuracion: { filtros, timestamp: new Date().toISOString() }
        })
    });
    const d = await r.json();
    if (d.success) { alert('Reporte guardado exitosamente'); cargarReportesGuardados(); }
    else alert('Error al guardar: ' + d.message);
}

async function eliminarReporte(id) {
    if (!confirm('¿Eliminar este reporte guardado?')) return;
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/reportes/guardados/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId: currentEmpresa.id, usuarioId: currentUsuario.id })
    });
    cargarReportesGuardados();
}

function cargarReporteGuardado(id) {
    alert('Funcionalidad de cargar configuración guardada — próximamente con más opciones de filtro.');
}

// ─── INSIGHTS AUTOMÁTICOS ─────────────────────────────────────────────────────
function generarInsights(kpis) {
    const insights = [];
    const v = kpis.ventas;

    if (v.variacion_ventas > 10) {
        insights.push({ tipo: 'success', icono: 'bi-graph-up-arrow', texto: `Las ventas subieron <strong>${v.variacion_ventas}%</strong> comparado con el período anterior. Excelente desempeño.` });
    } else if (v.variacion_ventas < -10) {
        insights.push({ tipo: 'danger', icono: 'bi-graph-down-arrow', texto: `Las ventas bajaron <strong>${Math.abs(v.variacion_ventas)}%</strong>. Revisa qué productos o canales están afectados.` });
    } else {
        insights.push({ tipo: 'info', icono: 'bi-bar-chart', texto: `Las ventas se mantienen estables (variación ${v.variacion_ventas}% vs período anterior).` });
    }

    const margen = v.total > 0 ? (v.ganancia_bruta / v.total * 100) : 0;
    if (margen < 15) {
        insights.push({ tipo: 'warning', icono: 'bi-exclamation-triangle', texto: `El margen bruto es <strong>${margen.toFixed(1)}%</strong>. Considera revisar precios de compra o precios de venta.` });
    } else if (margen > 40) {
        insights.push({ tipo: 'success', icono: 'bi-star', texto: `Margen bruto del <strong>${margen.toFixed(1)}%</strong>. Muy buen control de costos.` });
    }

    if (kpis.inventario.productos_stock_bajo > 0) {
        insights.push({ tipo: 'warning', icono: 'bi-box-seam', texto: `Tienes <strong>${kpis.inventario.productos_stock_bajo} producto(s)</strong> con stock bajo o agotado. Planifica reabastecimiento.` });
    }

    if (v.ticket_promedio > 0) {
        insights.push({ tipo: 'info', icono: 'bi-receipt', texto: `Ticket promedio de <strong>${formatMoney(v.ticket_promedio)}</strong> por transacción (${v.transacciones} ventas en el período).` });
    }

    document.getElementById('insightsContainer').innerHTML = insights.map(i => `
        <div class="alert alert-${i.tipo} d-flex align-items-start gap-2 py-2 mb-2">
            <i class="bi ${i.icono} fs-5 flex-shrink-0 mt-1"></i>
            <div class="small">${i.texto}</div>
        </div>
    `).join('') || '<p class="text-muted small">Cargando análisis...</p>';
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
function exportarReporte() {
    const rows = [['Reporte Kore Inventory', '', '', ''],
        [`Empresa: ${currentEmpresa.nombre}`, '', '', ''],
        [`Período: ${filtros.fechaInicio} a ${filtros.fechaFin}`, '', '', ''],
        ['', '', '', ''],
        ['KPIs del período', '', '', ''],
    ];

    const tabla = document.getElementById('tablaVendedores');
    if (tabla) {
        rows.push(['VENDEDORES', 'Transacciones', 'Ventas', 'Ganancia']);
        tabla.querySelectorAll('tr').forEach(tr => {
            rows.push([...tr.querySelectorAll('td')].map(td => td.innerText.trim()));
        });
    }

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${currentEmpresa.nombre}_${filtros.fechaInicio}_${filtros.fechaFin}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
async function apiGet(path) {
    const token = localStorage.getItem('token');
    try {
        const r = await fetch(`${API_URL}${path}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const d = await r.json();
        return d.success ? d.data : null;
    } catch (e) {
        console.error('API error:', path, e);
        return null;
    }
}

function formatMoney(val) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val || 0);
}

function renderChart(canvasId, type, labels, datasets, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (charts[canvasId]) { charts[canvasId].destroy(); }

    const config = {
        type,
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: opts.horizontal ? 'y' : 'x',
            plugins: {
                legend: { display: !!opts.legend || datasets.length > 1 },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const val = ctx.raw;
                            return ` ${ctx.dataset.label || ''}: ${opts.prefix === '$' ? formatMoney(val) : val}`;
                        }
                    }
                }
            },
            scales: type === 'doughnut' ? {} : {
                x: { grid: { display: !opts.horizontal } },
                y: {
                    grid: { display: true },
                    ticks: opts.prefix === '$' ? {
                        callback: val => new Intl.NumberFormat('es-CO', { notation: 'compact', currency: 'COP' }).format(val)
                    } : {}
                }
            }
        }
    };

    charts[canvasId] = new Chart(canvas.getContext('2d'), config);
}
