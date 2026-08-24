const API_CAJA = typeof API_URL !== 'undefined' ? API_URL : '/api';
let empresaActual = null;
let turnoActual = null;
const dinero = valor => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor || 0));
const fecha = valor => valor ? new Date(valor).toLocaleString('es-CO') : '-';
async function cargarEmpresaActiva() {
	const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
	if (!usuario.id) throw new Error('Sesión de usuario no válida');
	document.getElementById('userName').textContent = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || 'Usuario';
	document.getElementById('userRole').textContent = usuario.tipo_usuario || 'Usuario';
	const result = await api(`/empresas/usuario/${usuario.id}`);
	const empresas = result.data || [];
	if (!empresas.length) throw new Error('No tienes empresas asignadas. Contacta al administrador.');
	const guardada = localStorage.getItem('empresaActiva');
	empresaActual = empresas.find(item => String(item.id) === String(guardada)) || empresas[0];
	localStorage.setItem('empresaActiva', String(empresaActual.id));
	const selector = document.getElementById('empresaSelector');
	selector.innerHTML = empresas.map(item => `<option value="${item.id}">${item.nombre}</option>`).join('');
	selector.value = String(empresaActual.id);
	selector.addEventListener('change', async event => {
		empresaActual = empresas.find(item => String(item.id) === event.target.value);
		localStorage.setItem('empresaActiva', String(empresaActual.id));
		await cargarDatos();
	});
}
async function cargarDatos() { await cargarBodegas(); await cargarTurno(); await cargarHistorial(); }
function activarEnlaceBancos() {
	document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
		if (link.textContent.trim().startsWith('Bancos')) {
			link.classList.remove('disabled');
			link.href = 'bancos.html';
			link.querySelector('.badge')?.remove();
		}
	});
}
async function api(path, options = {}) { const token = localStorage.getItem('token'); const response = await fetch(`${API_CAJA}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) } }); const body = await response.json().catch(() => ({})); if (!response.ok || body.success === false) throw new Error(body.message || 'No fue posible completar la operación'); return body; }
function aviso(mensaje, tipo = 'success') { document.getElementById('alerta').innerHTML = `<div class="alert alert-${tipo} alert-dismissible fade show">${mensaje}<button class="btn-close" data-bs-dismiss="alert"></button></div>`; }
async function cargarBodegas() { const result = await api(`/bodegas?empresa_id=${empresaActual.id}`); const bodegas = result.data || []; document.getElementById('bodegaId').innerHTML = bodegas.map(b => `<option value="${b.id}">${b.nombre}</option>`).join('') || '<option value="">No hay tiendas disponibles</option>'; }
async function cargarTurno() { const result = await api(`/ventas/turno/actual?empresaId=${empresaActual.id}`); turnoActual = result.data; document.getElementById('sinTurno').classList.toggle('d-none', Boolean(turnoActual)); document.getElementById('turnoActivo').classList.toggle('d-none', !turnoActual); if (turnoActual) { document.getElementById('tiendaActual').textContent = turnoActual.bodega_nombre || '-'; document.getElementById('cajaActual').textContent = turnoActual.caja_nombre || 'Caja principal'; document.getElementById('baseActual').textContent = dinero(turnoActual.base_inicial); await cargarResumen(); } }
async function cargarResumen() { const result = await api(`/ventas/turno/${turnoActual.id}/resumen`); const data = result.data; document.getElementById('ventasActual').textContent = dinero(data.total_ventas); document.getElementById('gastosActual').textContent = dinero(data.total_gastos); document.getElementById('efectivoActual').textContent = dinero(data.efectivo_a_entregar); document.getElementById('ventasPorMetodo').innerHTML = (data.ventas_por_metodo || []).map(v => `<tr><td>${v.metodo_pago}</td><td>${v.cantidad}</td><td class="text-end">${dinero(v.total)}</td></tr>`).join('') || '<tr><td colspan="3" class="text-muted">Sin ventas todavía</td></tr>'; document.getElementById('listaGastos').innerHTML = (data.gastos || []).map(g => `<div class="list-group-item px-0 d-flex justify-content-between"><span>${g.descripcion}<small class="d-block text-muted">${fecha(g.fecha_registro)}</small></span><strong class="text-danger">-${dinero(g.monto)}</strong></div>`).join('') || '<p class="text-muted mb-0">Sin gastos registrados</p>'; }
async function cargarHistorial() { const result = await api(`/ventas/turnos/historial?empresaId=${empresaActual.id}`); document.getElementById('historial').innerHTML = (result.data || []).map(t => `<tr><td>${fecha(t.fecha_cierre)}</td><td>${t.bodega_nombre || '-'}</td><td>${t.caja_nombre || 'Caja principal'}</td><td>${dinero(t.total_ventas)}</td><td class="${Number(t.diferencia) < 0 ? 'text-danger' : 'text-success'}">${dinero(t.diferencia)}</td><td><span class="badge bg-secondary">Cerrada</span></td></tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted">No hay cierres registrados</td></tr>'; }
document.getElementById('formAbrir').addEventListener('submit', async event => { event.preventDefault(); try { await api('/ventas/turno/abrir', { method: 'POST', body: JSON.stringify({ empresaId: empresaActual.id, bodegaId: Number(document.getElementById('bodegaId').value), baseInicial: Number(document.getElementById('baseInicial').value) }) }); aviso('Caja abierta correctamente'); await cargarTurno(); await cargarHistorial(); } catch (error) { aviso(error.message, 'danger'); } });
document.getElementById('formGasto').addEventListener('submit', async event => { event.preventDefault(); try { await api(`/ventas/turno/${turnoActual.id}/gastos`, { method: 'POST', body: JSON.stringify({ descripcion: document.getElementById('gastoDescripcion').value, monto: Number(document.getElementById('gastoMonto').value) }) }); bootstrap.Modal.getInstance(document.getElementById('modalGasto')).hide(); event.target.reset(); await cargarResumen(); aviso('Gasto registrado correctamente'); } catch (error) { aviso(error.message, 'danger'); } });
document.getElementById('formCierre').addEventListener('submit', async event => { event.preventDefault(); try { await api(`/ventas/turno/${turnoActual.id}/cerrar`, { method: 'POST', body: JSON.stringify({ efectivoContado: Number(document.getElementById('efectivoContado').value), notas: document.getElementById('notasCierre').value }) }); bootstrap.Modal.getInstance(document.getElementById('modalCierre')).hide(); aviso('Caja cerrada correctamente'); await cargarTurno(); await cargarHistorial(); } catch (error) { aviso(error.message, 'danger'); } });
document.getElementById('btnActualizar').addEventListener('click', () => Promise.all([cargarTurno(), cargarHistorial()]));
(async function iniciar() { try { activarEnlaceBancos(); await cargarEmpresaActiva(); await cargarDatos(); } catch (error) { aviso(error.message, 'danger'); } })();
