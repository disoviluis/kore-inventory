const API_URL = '/api';
let empresaActiva = null;
let gastos = [];
const token = () => localStorage.getItem('token');
const dinero = valor => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor) || 0);

async function api(url, options = {}) {
  const response = await fetch(`${API_URL}${url}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || 'Error en la solicitud');
  return data.data;
}

async function cargarEmpresa() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const empresas = await api(`/empresas/usuario/${usuario.id}`);
  const id = Number(localStorage.getItem('empresaActiva')) || Number(empresas?.[0]?.id);
  empresaActiva = empresas.find(empresa => Number(empresa.id) === id) || empresas[0];
  if (!empresaActiva) throw new Error('No hay empresa activa');
}

function fechas() {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return { desde: document.getElementById('fechaDesde').value || inicio.toISOString().slice(0, 10), hasta: document.getElementById('fechaHasta').value || hoy.toISOString().slice(0, 10) };
}

async function cargarGastos() {
  const { desde, hasta } = fechas();
  const [lista, resumen] = await Promise.all([api(`/finanzas/gastos?empresaId=${empresaActiva.id}&fechaDesde=${desde}&fechaHasta=${hasta}`), api(`/finanzas/gastos/resumen?empresaId=${empresaActiva.id}&fechaDesde=${desde}&fechaHasta=${hasta}`)]);
  gastos = lista || [];
  document.getElementById('totalGastos').textContent = dinero(resumen.totales.total_registrado);
  document.getElementById('cantidadGastos').textContent = resumen.totales.cantidad || 0;
  document.getElementById('categoriaPrincipal').textContent = resumen.categorias?.[0]?.categoria || '-';
  document.getElementById('tablaGastos').innerHTML = gastos.length ? gastos.map(gasto => `<tr class="${gasto.estado === 'anulado' ? 'text-decoration-line-through text-muted' : ''}"><td>${gasto.fecha}</td><td>${gasto.categoria}</td><td>${gasto.descripcion}</td><td>${gasto.proveedor || '-'}</td><td>${gasto.metodo_pago}</td><td class="text-end fw-semibold">${dinero(gasto.monto)}</td><td>${gasto.usuario_nombre || '-'}</td><td>${gasto.estado === 'registrado' ? `<button class="btn btn-sm btn-outline-danger" onclick="anularGasto(${gasto.id})" title="Anular"><i class="bi bi-x-circle"></i></button>` : '<span class="badge bg-secondary">Anulado</span>'}</td></tr>`).join('') : '<tr><td colspan="8" class="text-center text-muted py-4">No hay gastos en el período</td></tr>';
}

async function guardarGasto(evento) {
  evento.preventDefault();
  const payload = { empresaId: empresaActiva.id, fecha: document.getElementById('gastoFecha').value, categoria: document.getElementById('gastoCategoria').value, descripcion: document.getElementById('gastoDescripcion').value, monto: document.getElementById('gastoMonto').value, metodo_pago: document.getElementById('gastoMetodo').value, proveedor: document.getElementById('gastoProveedor').value, observaciones: document.getElementById('gastoObservaciones').value };
  try { await api('/finanzas/gastos', { method: 'POST', body: JSON.stringify(payload) }); bootstrap.Modal.getInstance(document.getElementById('modalGasto')).hide(); evento.target.reset(); await cargarGastos(); alert('Gasto registrado correctamente'); } catch (error) { alert(error.message); }
}

async function anularGasto(id) {
  const motivo = prompt('Motivo de anulación:');
  if (!motivo) return;
  try { await api(`/finanzas/gastos/${id}/anular?empresaId=${empresaActiva.id}`, { method: 'POST', body: JSON.stringify({ motivo }) }); await cargarGastos(); } catch (error) { alert(error.message); }
}

document.addEventListener('DOMContentLoaded', async () => {
  try { await cargarEmpresa(); const { desde, hasta } = fechas(); document.getElementById('fechaDesde').value = desde; document.getElementById('fechaHasta').value = hasta; document.getElementById('btnNuevoGasto').onclick = () => { document.getElementById('gastoFecha').value = new Date().toISOString().slice(0, 10); new bootstrap.Modal(document.getElementById('modalGasto')).show(); }; document.getElementById('btnFiltrar').onclick = cargarGastos; document.getElementById('formGasto').addEventListener('submit', guardarGasto); await cargarGastos(); } catch (error) { alert(error.message); }
});
