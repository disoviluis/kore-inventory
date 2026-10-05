const AJUSTES_API = '/api';
let ajustesEmpresaId = null;
let ajustesUsuario = null;
let ajustesPermisos = new Set();
let ajustesData = [];

const ajusteById = (id) => document.getElementById(id);
const ajusteEscape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const ajusteQuery = () => `empresa_id=${encodeURIComponent(ajustesEmpresaId || '')}`;
const ajustePuede = (action) => ['super_admin', 'admin_empresa'].includes(ajustesUsuario?.tipo_usuario)
  || ajustesPermisos.has(`ajustes_inventario.${action}`);

async function ajusteRequest(path, options = {}) {
  const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${AJUSTES_API}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) throw new Error(result.message || `Error HTTP ${response.status}`);
  return result.data;
}

function ajusteAlert(message, type = 'success') {
  ajusteById('adjustmentAlert').innerHTML = `<div class="alert alert-${ajusteEscape(type)} alert-dismissible fade show" role="alert">${ajusteEscape(message)}<button class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button></div>`;
}

async function loadAjustes() {
  if (!ajustesEmpresaId) return;
  ajusteById('adjustmentsBody').innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">Cargando solicitudes...</td></tr>';
  try {
    const permissions = await ajusteRequest(`/auth/permisos?${ajusteQuery()}`);
    ajustesPermisos = new Set((permissions?.permisos || []).map((permission) => `${permission.modulo}.${permission.accion}`));
    ajusteById('exportAdjustmentsButton').classList.toggle('d-none', !ajustePuede('export'));
    const rows = await ajusteRequest(`/inventarios-fisicos/ajustes?${ajusteQuery()}`);
    ajustesData = rows || [];
    renderAjustes();
  } catch (error) {
    ajusteAlert(error.message || 'No se pudieron cargar las solicitudes', 'danger');
    ajusteById('adjustmentsBody').innerHTML = `<tr><td colspan="7" class="text-center py-5 text-danger">${ajusteEscape(error.message)}</td></tr>`;
  }
}

async function exportAjustes() {
  try {
    const rows = await ajusteRequest(`/inventarios-fisicos/ajustes/export?${ajusteQuery()}`);
    const columns = [
      ['codigo', 'Código de ajuste'], ['inventario_codigo', 'Inventario'], ['estado', 'Estado'],
      ['motivo', 'Motivo'], ['lineas', 'Líneas'], ['solicitado_por', 'Solicitante'],
      ['revisado_por', 'Revisor'], ['aprobado_por', 'Aprobador'], ['aplicado_por', 'Aplicador'],
      ['solicitado_at', 'Solicitado']
    ].map(([key, label]) => ({ key, label }));
    CsvExport.download('ajustes-inventario.csv', columns, rows || []);
  } catch (error) {
    ajusteAlert(error.message || 'No se pudieron exportar los ajustes', 'danger');
  }
}

function renderAjustes() {
  ajusteById('adjustmentsBody').innerHTML = ajustesData.length ? ajustesData.map((request) => {
    const actions = [];
    actions.push(`<button class="btn btn-sm btn-outline-secondary" data-action="evidence" data-id="${request.id}" title="Evidencias privadas"><i class="bi bi-paperclip"></i></button>`);
    if (request.estado === 'requested' && ajustePuede('review')) {
      actions.push(`<button class="btn btn-sm btn-outline-primary" data-action="review" data-id="${request.id}" title="Iniciar revisión"><i class="bi bi-search"></i></button>`);
    }
    if (['requested','under_review'].includes(request.estado) && ajustePuede('review')) {
      actions.push(`<button class="btn btn-sm btn-outline-danger" data-action="reject" data-id="${request.id}" title="Rechazar"><i class="bi bi-x-lg"></i></button>`);
    }
    if (request.estado === 'under_review' && ajustePuede('approve')) {
      actions.push(`<button class="btn btn-sm btn-outline-success" data-action="approve" data-id="${request.id}" title="Autorizar"><i class="bi bi-check-lg"></i></button>`);
    }
    if (request.estado === 'approved' && ajustePuede('apply')) {
      actions.push(`<button class="btn btn-sm btn-primary" data-action="apply" data-id="${request.id}">Aplicar</button>`);
    }
    return `<tr><td class="font-monospace">${ajusteEscape(request.codigo)}</td><td>${ajusteEscape(request.inventario_codigo)}</td><td>${ajusteEscape(request.estado)}</td><td>${ajusteEscape(request.motivo)}</td><td>${Number(request.lineas)}</td><td>${ajusteEscape(request.solicitado_at ? new Date(request.solicitado_at).toLocaleString() : '—')}</td><td class="text-end text-nowrap">${actions.join(' ') || '—'}</td></tr>`;
  }).join('') : '<tr><td colspan="7" class="text-center text-muted py-4">Sin solicitudes de ajuste.</td></tr>';
}

async function handleAjusteAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const request = ajustesData.find((item) => String(item.id) === button.dataset.id);
  if (!request) return;
  const action = button.dataset.action;
  if (action === 'evidence') {
    PrivateEvidence.open('ajuste', request.id, request.codigo, ajustePuede('create'));
    return;
  }
  if (['review','approve','reject'].includes(action)) {
    const decision = action === 'review' ? 'under_review' : action === 'approve' ? 'approved' : 'rejected';
    const title = decision === 'under_review' ? 'Iniciar revisión' : decision === 'approved' ? 'Autorizar ajuste' : 'Rechazar ajuste';
    const result = await Swal.fire({ title, input: 'textarea', inputLabel: 'Observaciones', inputValidator: (value) => value?.trim() ? undefined : 'Ingresa las observaciones', showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Volver' });
    if (!result.isConfirmed) return;
    try {
      await ajusteRequest(`/inventarios-fisicos/ajustes/${request.id}/revision?${ajusteQuery()}`, {
        method: 'PATCH', body: JSON.stringify({ empresa_id: Number(ajustesEmpresaId), estado: decision, observaciones: result.value.trim() })
      });
      await loadAjustes();
    } catch (error) {
      ajusteAlert(error.message || 'No se pudo actualizar la solicitud', 'danger');
    }
    return;
  }
  const confirmation = await Swal.fire({ title: 'Aplicar ajuste aprobado', text: 'Se modificarán existencias y se registrará un movimiento.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Aplicar', cancelButtonText: 'Cancelar' });
  if (!confirmation.isConfirmed) return;
  try {
    await ajusteRequest(`/inventarios-fisicos/ajustes/${request.id}/aplicar?${ajusteQuery()}`, {
      method: 'POST', body: JSON.stringify({ empresa_id: Number(ajustesEmpresaId) })
    });
    ajusteAlert('Ajuste aplicado y movimiento registrado.');
    await loadAjustes();
  } catch (error) {
    ajusteAlert(error.message || 'No se pudo aplicar el ajuste', 'danger');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  ajustesUsuario = JSON.parse(localStorage.getItem('usuario') || 'null');
  if (!ajustesUsuario) { window.location.href = 'login.html'; return; }
  ajusteById('userName').textContent = `${ajustesUsuario.nombre || ''} ${ajustesUsuario.apellido || ''}`.trim() || 'Usuario';
  ajusteById('userRole').textContent = ajustesUsuario.tipo_usuario || 'Usuario';
  ajusteById('adjustmentsBody').addEventListener('click', handleAjusteAction);
  ajusteById('exportAdjustmentsButton').addEventListener('click', exportAjustes);
  ajusteById('logoutBtn').addEventListener('click', (event) => {
    event.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('empresaActiva');
    window.location.href = 'login.html';
  });
  window.addEventListener('empresaCambiada', (event) => {
    ajustesEmpresaId = String(event.detail.empresaId);
    loadAjustes();
  });
  ajustesEmpresaId = localStorage.getItem('empresaActiva');
  if (ajustesEmpresaId) loadAjustes();
  else setTimeout(() => {
    ajustesEmpresaId = localStorage.getItem('empresaActiva');
    if (ajustesEmpresaId) loadAjustes();
  }, 600);
});