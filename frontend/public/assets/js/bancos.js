const API_BANCOS = '/api';
let empresaBancos = null;
let cuentasBancos = [];
const tokenBancos = localStorage.getItem('token');
const modalCuenta = new bootstrap.Modal(document.getElementById('modalCuenta'));
const modalMovimiento = new bootstrap.Modal(document.getElementById('modalMovimiento'));

const escBanco = value => String(value || '').replace(/[&<>\'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));
const moneyBanco = value => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0));

async function apiBanco(path, options = {}) {
  const response = await fetch(`${API_BANCOS}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${tokenBancos}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || 'Error en la solicitud');
  return data;
}

function alertaBanco(message, type = 'success') {
  document.getElementById('alerta').innerHTML = `<div class="alert alert-${type} alert-dismissible fade show">${escBanco(message)}<button class="btn-close" data-bs-dismiss="alert"></button></div>`;
}

async function contextoBanco() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const empresas = (await apiBanco(`/empresas/usuario/${usuario.id}`)).data || [];
  const guardada = localStorage.getItem('empresaActiva');
  empresaBancos = empresas.find(item => String(item.id) === String(guardada)) || empresas[0];
  if (!empresaBancos) throw new Error('No tienes una empresa asignada');
  localStorage.setItem('empresaActiva', String(empresaBancos.id));
  const selector = document.getElementById('companySelector');
  selector.innerHTML = empresas.map(item => `<option value="${item.id}">${escBanco(item.nombre)}</option>`).join('');
  selector.value = String(empresaBancos.id);
  selector.addEventListener('change', async event => {
    empresaBancos = empresas.find(item => String(item.id) === event.target.value);
    localStorage.setItem('empresaActiva', String(empresaBancos.id));
    await cargarBanco();
  });
  document.getElementById('userName').textContent = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim();
  document.getElementById('userRole').textContent = usuario.tipo_usuario || 'Usuario';
}

async function cargarBanco() {
  const [cuentas, movimientos] = await Promise.all([
    apiBanco(`/finanzas/bancos/cuentas?empresa_id=${empresaBancos.id}`),
    apiBanco(`/finanzas/bancos/movimientos?empresa_id=${empresaBancos.id}`)
  ]);
  cuentasBancos = cuentas.data || [];
  document.getElementById('resumenCuentas').innerHTML = cuentasBancos.map(cuenta => `<div class="col-md-4"><div class="card shadow-sm border-0 h-100"><div class="card-body"><small class="text-muted">${escBanco(cuenta.banco)} · ${escBanco(cuenta.tipo_cuenta)}</small><h5>${escBanco(cuenta.nombre)}</h5><div class="fs-4 fw-bold text-primary">${moneyBanco(cuenta.saldo_actual)}</div><small class="text-muted">${escBanco(cuenta.numero_cuenta)}</small></div></div></div>`).join('') || '<div class="col-12"><div class="alert alert-info">Crea la primera cuenta bancaria</div></div>';
  document.getElementById('cuentaMovimiento').innerHTML = cuentasBancos.filter(item => item.activo).map(item => `<option value="${item.id}">${escBanco(item.banco)} - ${escBanco(item.nombre)}</option>`).join('');
  document.getElementById('movimientosBody').innerHTML = (movimientos.data || []).map(item => {
    const salida = ['retiro', 'nota_debito'].includes(item.tipo);
    return `<tr><td>${new Date(item.fecha_movimiento).toLocaleString('es-CO')}</td><td>${escBanco(item.banco)}<br><small>${escBanco(item.cuenta_nombre)}</small></td><td>${escBanco(item.tipo)}</td><td>${escBanco(item.origen)}</td><td>${escBanco(item.descripcion)}</td><td class="text-end ${salida ? 'text-danger' : 'text-success'}">${salida ? '-' : '+'}${moneyBanco(item.valor)}</td><td class="text-end">${moneyBanco(item.saldo_nuevo)}</td><td>${item.conciliado ? '<span class="badge bg-success">Conciliado</span>' : '<span class="badge bg-warning text-dark">Pendiente</span>'}</td><td>${item.conciliado ? '' : `<button class="btn btn-sm btn-outline-success" data-conciliar="${item.id}" title="Conciliar"><i class="bi bi-check2-circle"></i></button>`}</td></tr>`;
  }).join('') || '<tr><td colspan="9" class="text-center text-muted py-5">No hay movimientos registrados</td></tr>';
  document.querySelectorAll('[data-conciliar]').forEach(button => button.addEventListener('click', () => conciliar(button.dataset.conciliar)));
}

async function conciliar(id) {
  try { await apiBanco(`/finanzas/bancos/movimientos/${id}/conciliar?empresa_id=${empresaBancos.id}`, { method: 'POST' }); alertaBanco('Movimiento conciliado'); await cargarBanco(); }
  catch (error) { alertaBanco(error.message, 'danger'); }
}

document.getElementById('btnCuenta').addEventListener('click', () => { document.getElementById('formCuenta').reset(); modalCuenta.show(); });
document.getElementById('formCuenta').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await apiBanco('/finanzas/bancos/cuentas', { method: 'POST', body: JSON.stringify({ empresa_id: empresaBancos.id, banco: document.getElementById('banco').value, nombre: document.getElementById('nombreCuenta').value, tipo_cuenta: document.getElementById('tipoCuenta').value, numero_cuenta: document.getElementById('numeroCuenta').value, titular: document.getElementById('titular').value, saldo_inicial: Number(document.getElementById('saldoInicial').value) }) });
    modalCuenta.hide(); alertaBanco('Cuenta bancaria creada'); await cargarBanco();
  } catch (error) { alertaBanco(error.message, 'danger'); }
});
document.getElementById('btnMovimiento').addEventListener('click', () => { if (!cuentasBancos.length) { alertaBanco('Crea primero una cuenta bancaria', 'warning'); return; } document.getElementById('formMovimiento').reset(); modalMovimiento.show(); });
document.getElementById('formMovimiento').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await apiBanco('/finanzas/bancos/movimientos', { method: 'POST', body: JSON.stringify({ empresa_id: empresaBancos.id, cuenta_bancaria_id: Number(document.getElementById('cuentaMovimiento').value), tipo: document.getElementById('tipoMovimiento').value, origen: document.getElementById('origenMovimiento').value, valor: Number(document.getElementById('valorMovimiento').value), descripcion: document.getElementById('descripcionMovimiento').value, referencia: document.getElementById('referenciaMovimiento').value }) });
    modalMovimiento.hide(); alertaBanco('Movimiento registrado'); await cargarBanco();
  } catch (error) { alertaBanco(error.message, 'danger'); }
});

(async function iniciarBancos() {
  if (!tokenBancos) { window.location.href = 'login.html'; return; }
  try { await contextoBanco(); await cargarBanco(); }
  catch (error) { alertaBanco(error.message, 'danger'); }
})();
