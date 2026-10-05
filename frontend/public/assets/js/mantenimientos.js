const MANTENIMIENTO_API = '/api';
const maintenanceStateLabels = { draft: 'Borrador', scheduled: 'Programado', in_progress: 'En ejecución', waiting_parts: 'Esperando repuestos', completed: 'Completado', cancelled: 'Cancelado' };
let maintenanceCompanyId = null;
let maintenanceUser = null;
let maintenancePermissions = new Set();
let maintenanceOrders = [];
let maintenanceReferences = { activos: [], tipos: [], tecnicos: [], bodegas: [], repuestos: [] };
let maintenanceModal;
let maintenancePartsModal;
let maintenanceTimer;

const maintenanceById = (id) => document.getElementById(id);
const maintenanceEscape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const maintenanceQuery = () => `empresa_id=${encodeURIComponent(maintenanceCompanyId || '')}`;

async function maintenanceRequest(path, options = {}) {
  const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${MANTENIMIENTO_API}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    const error = new Error(result.message || `Error HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return result.data;
}

function maintenanceCan(action) {
  return ['super_admin', 'admin_empresa'].includes(maintenanceUser?.tipo_usuario)
    || maintenancePermissions.has(`mantenimientos.${action}`);
}

async function loadMaintenancePermissions() {
  const result = await maintenanceRequest(`/auth/permisos?${maintenanceQuery()}`);
  maintenancePermissions = new Set((result?.permisos || []).map((permission) => `${permission.modulo}.${permission.accion}`));
  maintenanceById('newMaintenanceButton').classList.toggle('d-none', !maintenanceCan('create'));
  maintenanceById('newMaintenanceTypeButton').classList.toggle('d-none', !maintenanceCan('create'));
  maintenanceById('exportMaintenanceButton').classList.toggle('d-none', !maintenanceCan('export'));
}

function maintenanceAlert(message, type = 'success') {
  maintenanceById('maintenanceAlert').innerHTML = `<div class="alert alert-${maintenanceEscape(type)} alert-dismissible fade show" role="alert">${maintenanceEscape(message)}<button class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button></div>`;
}

function fillMaintenanceSelect(select, options, placeholder, current = '') {
  select.innerHTML = `<option value="">${maintenanceEscape(placeholder)}</option>${options.map((option) => `<option value="${maintenanceEscape(option.id)}" ${String(option.id) === String(current) ? 'selected' : ''}>${maintenanceEscape(option.label)}</option>`).join('')}`;
}

async function loadMaintenanceData() {
  if (!maintenanceCompanyId) return;
  maintenanceById('maintenanceTableBody').innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted">Cargando órdenes...</td></tr>';
  try {
    await loadMaintenancePermissions();
    const [orders, references] = await Promise.all([
      maintenanceRequest(`/mantenimientos?${maintenanceQuery()}`),
      maintenanceRequest(`/mantenimientos/referencias?${maintenanceQuery()}`)
    ]);
    maintenanceOrders = orders || [];
    maintenanceReferences = references || maintenanceReferences;
    renderMaintenanceSelects();
    renderMaintenanceOrders();
  } catch (error) {
    maintenanceAlert(error.message || 'No se pudieron cargar las órdenes', 'danger');
    maintenanceById('maintenanceTableBody').innerHTML = `<tr><td colspan="8" class="text-center py-5 text-danger">${maintenanceEscape(error.message)}</td></tr>`;
    if (error.status === 401) window.location.href = 'login.html';
  }
}

function renderMaintenanceSelects(currentAsset = '', currentType = '', currentTech = '') {
  fillMaintenanceSelect(maintenanceById('maintenanceAsset'), (maintenanceReferences.activos || []).map((asset) => ({ id: asset.id, label: `${asset.codigo} · ${asset.nombre}` })), 'Selecciona activo', currentAsset);
  fillMaintenanceSelect(maintenanceById('maintenanceType'), (maintenanceReferences.tipos || []).map((type) => ({ id: type.id, label: type.nombre })), 'Selecciona tipo', currentType);
  fillMaintenanceSelect(maintenanceById('maintenanceTechnician'), (maintenanceReferences.tecnicos || []).map((user) => ({ id: user.id, label: `${user.nombre || ''} ${user.apellido || ''}`.trim() || user.email })), 'Sin técnico asignado', currentTech);
}

function renderMaintenanceOrders() {
  const stateFilter = maintenanceById('maintenanceState').value;
  const search = maintenanceById('maintenanceSearch').value.trim().toLocaleLowerCase();
  const rows = maintenanceOrders.filter((order) => {
    const text = [order.codigo, order.activo_codigo, order.activo_nombre].join(' ').toLocaleLowerCase();
    return (!stateFilter || order.estado === stateFilter) && (!search || text.includes(search));
  });
  maintenanceById('openCount').textContent = maintenanceOrders.filter((order) => ['draft','scheduled'].includes(order.estado)).length;
  maintenanceById('progressCount').textContent = maintenanceOrders.filter((order) => order.estado === 'in_progress').length;
  maintenanceById('partsCount').textContent = maintenanceOrders.filter((order) => order.estado === 'waiting_parts').length;
  maintenanceById('completedCount').textContent = maintenanceOrders.filter((order) => order.estado === 'completed').length;
  if (!rows.length) {
    maintenanceById('maintenanceTableBody').innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted">No hay órdenes para los filtros seleccionados.</td></tr>';
    return;
  }
  maintenanceById('maintenanceTableBody').innerHTML = rows.map((order) => {
    const badge = order.estado === 'completed' ? 'success' : order.estado === 'cancelled' ? 'secondary' : ['in_progress','waiting_parts'].includes(order.estado) ? 'warning' : 'primary';
    const actions = [];
    actions.push(`<button class="btn btn-sm btn-outline-secondary" data-action="evidence" data-id="${order.id}" title="Evidencias privadas"><i class="bi bi-paperclip"></i></button>`);
    actions.push(`<button class="btn btn-sm btn-outline-secondary" data-action="parts" data-id="${order.id}" title="Repuestos"><i class="bi bi-tools"></i></button>`);
    if (['draft','scheduled'].includes(order.estado) && maintenanceCan('edit')) actions.push(`<button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${order.id}" title="Editar"><i class="bi bi-pencil"></i></button>`);
    if (order.estado === 'scheduled' && maintenanceCan('edit')) actions.push(`<button class="btn btn-sm btn-outline-success" data-action="start" data-id="${order.id}" title="Iniciar"><i class="bi bi-play"></i></button>`);
    if (order.estado === 'in_progress' && maintenanceCan('edit')) actions.push(`<button class="btn btn-sm btn-outline-warning" data-action="waiting-parts" data-id="${order.id}" title="Esperar repuestos"><i class="bi bi-hourglass-split"></i></button>`);
    if (order.estado === 'waiting_parts' && maintenanceCan('edit')) actions.push(`<button class="btn btn-sm btn-outline-primary" data-action="resume" data-id="${order.id}" title="Reanudar"><i class="bi bi-play"></i></button>`);
    if (['in_progress','waiting_parts'].includes(order.estado) && maintenanceCan('close')) actions.push(`<button class="btn btn-sm btn-outline-success" data-action="close" data-id="${order.id}" title="Cerrar"><i class="bi bi-check-lg"></i></button>`);
    if (['draft','scheduled','in_progress','waiting_parts'].includes(order.estado) && maintenanceCan('edit')) actions.push(`<button class="btn btn-sm btn-outline-danger" data-action="cancel" data-id="${order.id}" title="Cancelar"><i class="bi bi-x-lg"></i></button>`);
    return `<tr><td><span class="font-monospace fw-semibold">${maintenanceEscape(order.codigo)}</span></td><td>${maintenanceEscape(order.activo_codigo)}<br><small class="text-muted">${maintenanceEscape(order.activo_nombre)}</small></td><td>${maintenanceEscape(order.tipo_nombre)}</td><td>${maintenanceEscape(order.prioridad)}</td><td><span class="badge text-bg-${badge}">${maintenanceEscape(maintenanceStateLabels[order.estado] || order.estado)}</span></td><td>${maintenanceEscape(order.programada_at ? new Date(order.programada_at).toLocaleString() : '—')}</td><td>${maintenanceEscape(order.tecnico_nombre || 'Sin asignar')}</td><td class="text-end text-nowrap">${actions.join(' ')}</td></tr>`;
  }).join('');
}

async function exportMaintenanceOrders() {
  try {
    const params = new URLSearchParams({ empresa_id: maintenanceCompanyId });
    const state = maintenanceById('maintenanceState').value;
    const search = maintenanceById('maintenanceSearch').value.trim();
    if (state) params.set('estado', state);
    if (search) params.set('buscar', search);
    const rows = await maintenanceRequest(`/mantenimientos/export?${params}`);
    const columns = [
      ['codigo', 'Código'], ['activo_codigo', 'Código de activo'], ['activo_nombre', 'Activo'],
      ['tipo_nombre', 'Tipo'], ['estado', 'Estado'], ['prioridad', 'Prioridad'],
      ['tecnico_nombre', 'Técnico'], ['programada_at', 'Programada'], ['iniciada_at', 'Inicio'],
      ['cerrada_at', 'Cierre'], ['diagnostico', 'Diagnóstico'], ['trabajo_realizado', 'Trabajo realizado'],
      ['costo_mano_obra', 'Mano de obra'], ['costo_externo', 'Costo externo'], ['observaciones', 'Observaciones']
    ].map(([key, label]) => ({ key, label }));
    CsvExport.download('mantenimientos.csv', columns, rows || []);
  } catch (error) {
    maintenanceAlert(error.message || 'No se pudo exportar el mantenimiento', 'danger');
  }
}

function openMaintenanceForm(order = null) {
  maintenanceById('maintenanceForm').reset();
  maintenanceById('maintenanceId').value = order?.id || '';
  maintenanceById('maintenancePriority').value = order?.prioridad || 'normal';
  renderMaintenanceSelects(order?.activo_id || '', order?.tipo_id || '', order?.tecnico_id || '');
  maintenanceById('maintenanceScheduled').value = order?.programada_at ? new Date(order.programada_at).toISOString().slice(0, 16) : '';
  maintenanceById('maintenanceLaborCost').value = order?.costo_mano_obra ?? 0;
  maintenanceById('maintenanceExternalCost').value = order?.costo_externo ?? 0;
  maintenanceById('maintenanceDiagnosis').value = order?.diagnostico || '';
  maintenanceById('maintenanceWork').value = order?.trabajo_realizado || '';
  maintenanceById('maintenanceNotes').value = order?.observaciones || '';
  maintenanceById('maintenanceAsset').disabled = Boolean(order);
  maintenanceById('maintenanceModalTitle').textContent = order ? `Editar ${order.codigo}` : 'Nueva orden de mantenimiento';
  maintenanceModal.show();
}

async function saveMaintenance(event) {
  event.preventDefault();
  const orderId = maintenanceById('maintenanceId').value;
  const payload = {
    empresa_id: Number(maintenanceCompanyId),
    activo_id: Number(maintenanceById('maintenanceAsset').value),
    tipo_id: Number(maintenanceById('maintenanceType').value),
    prioridad: maintenanceById('maintenancePriority').value,
    tecnico_id: maintenanceById('maintenanceTechnician').value || null,
    programada_at: maintenanceById('maintenanceScheduled').value || null,
    costo_mano_obra: Number(maintenanceById('maintenanceLaborCost').value || 0),
    costo_externo: Number(maintenanceById('maintenanceExternalCost').value || 0),
    diagnostico: maintenanceById('maintenanceDiagnosis').value.trim() || null,
    trabajo_realizado: maintenanceById('maintenanceWork').value.trim() || null,
    observaciones: maintenanceById('maintenanceNotes').value.trim() || null
  };
  try {
    await maintenanceRequest(orderId ? `/mantenimientos/${orderId}?${maintenanceQuery()}` : `/mantenimientos?${maintenanceQuery()}`, {
      method: orderId ? 'PUT' : 'POST', body: JSON.stringify(payload)
    });
    maintenanceModal.hide();
    maintenanceAlert(orderId ? 'Orden actualizada.' : 'Orden creada.');
    await loadMaintenanceData();
  } catch (error) {
    maintenanceAlert(error.message || 'No se pudo guardar la orden', 'danger');
  }
}

async function createMaintenanceType() {
  const code = await Swal.fire({ title: 'Código del tipo', input: 'text', inputAttributes: { maxlength: 40 }, inputValidator: (value) => /^[a-z0-9_-]+$/i.test(value?.trim() || '') ? undefined : 'Usa letras, números, guion o guion bajo', showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Volver' });
  if (!code.isConfirmed) return;
  const name = await Swal.fire({ title: 'Nombre del tipo', input: 'text', inputAttributes: { maxlength: 100 }, inputValidator: (value) => value?.trim() ? undefined : 'El nombre es obligatorio', showCancelButton: true, confirmButtonText: 'Crear tipo', cancelButtonText: 'Volver' });
  if (!name.isConfirmed) return;
  try {
    await maintenanceRequest(`/mantenimientos/tipos?${maintenanceQuery()}`, {
      method: 'POST', body: JSON.stringify({ empresa_id: Number(maintenanceCompanyId), codigo: code.value.trim().toLowerCase(), nombre: name.value.trim() })
    });
    await loadMaintenanceData();
    maintenanceAlert('Tipo de mantenimiento creado.');
  } catch (error) {
    maintenanceAlert(error.message || 'No se pudo crear el tipo', 'danger');
  }
}

async function changeMaintenanceState(order, state) {
  let reason = null;
  let work = null;
  if (state === 'waiting_parts') {
    const result = await Swal.fire({ title: `Esperando repuestos · ${order.codigo}`, input: 'textarea', inputLabel: 'Repuesto faltante o motivo', inputValidator: (value) => value?.trim() ? undefined : 'Describe el motivo', showCancelButton: true, confirmButtonText: 'Guardar estado', cancelButtonText: 'Volver' });
    if (!result.isConfirmed) return;
    reason = result.value.trim();
  }
  if (state === 'completed') {
    const result = await Swal.fire({ title: `Cerrar ${order.codigo}`, input: 'textarea', inputLabel: 'Trabajo realizado', inputValidator: (value) => value?.trim() ? undefined : 'Describe el trabajo realizado', showCancelButton: true, confirmButtonText: 'Cerrar orden', cancelButtonText: 'Volver' });
    if (!result.isConfirmed) return;
    work = result.value.trim();
  }
  if (state === 'cancelled') {
    const result = await Swal.fire({ title: `Cancelar ${order.codigo}`, input: 'textarea', inputLabel: 'Motivo', inputValidator: (value) => value?.trim() ? undefined : 'El motivo es requerido', showCancelButton: true, confirmButtonText: 'Cancelar orden', cancelButtonText: 'Volver' });
    if (!result.isConfirmed) return;
    reason = result.value.trim();
  }
  try {
    await maintenanceRequest(`/mantenimientos/${order.id}/estado?${maintenanceQuery()}`, {
      method: 'PATCH', body: JSON.stringify({ empresa_id: Number(maintenanceCompanyId), estado: state, trabajo_realizado: work, motivo: reason })
    });
    await loadMaintenanceData();
  } catch (error) {
    maintenanceAlert(error.message || 'No se pudo cambiar el estado', 'danger');
  }
}

async function openMaintenanceParts(order) {
  maintenanceById('maintenancePartOrderId').value = order.id;
  maintenanceById('maintenancePartsCaption').textContent = `${order.codigo} · ${order.activo_codigo} ${order.activo_nombre}`;
  const consumableParts = (maintenanceReferences.repuestos || []).filter((part) => Number(part.controla_seriales) !== 1);
  fillMaintenanceSelect(maintenanceById('maintenancePartProduct'), consumableParts.map((part) => ({ id: part.producto_id, label: `${part.sku} · ${part.nombre} · ${part.bodega_nombre} · disp. ${(Number(part.stock_actual) - Number(part.stock_reservado)).toFixed(3)}` })), 'Selecciona repuesto');
  fillMaintenanceSelect(maintenanceById('maintenancePartWarehouse'), maintenanceReferences.bodegas.map((warehouse) => ({ id: warehouse.id, label: `${warehouse.codigo} · ${warehouse.nombre}` })), 'Selecciona bodega');
  maintenanceById('maintenancePartForm').reset();
  maintenanceById('maintenancePartOrderId').value = order.id;
  maintenanceById('maintenancePartForm').classList.toggle('d-none', !maintenanceCan('edit') || !['in_progress','waiting_parts'].includes(order.estado));
  updateMaintenancePartReason();
  try {
    const rows = await maintenanceRequest(`/mantenimientos/${order.id}/partes?${maintenanceQuery()}`);
    maintenanceById('maintenancePartsBody').innerHTML = (rows || []).map((part) => `<tr><td>${maintenanceEscape(part.sku)} · ${maintenanceEscape(part.producto_nombre)}</td><td>${maintenanceEscape(part.operacion)}</td><td>${Number(part.cantidad).toFixed(3)} ${maintenanceEscape(part.unidad_medida || '')}</td><td>${maintenanceEscape(part.bodega_nombre || '—')}</td><td>${maintenanceEscape(new Date(part.ocurrido_at).toLocaleString())}</td></tr>`).join('') || '<tr><td colspan="5" class="text-center text-muted py-3">Sin repuestos registrados.</td></tr>';
    maintenancePartsModal.show();
  } catch (error) {
    maintenanceAlert(error.message || 'No se pudo cargar la orden', 'danger');
  }
}

async function addMaintenancePart(event) {
  event.preventDefault();
  const orderId = maintenanceById('maintenancePartOrderId').value;
  try {
    await maintenanceRequest(`/mantenimientos/${orderId}/partes?${maintenanceQuery()}`, {
      method: 'POST', body: JSON.stringify({
        empresa_id: Number(maintenanceCompanyId),
        producto_id: Number(maintenanceById('maintenancePartProduct').value),
        bodega_id: Number(maintenanceById('maintenancePartWarehouse').value),
        operacion: maintenanceById('maintenancePartOperation').value,
        cantidad: Number(maintenanceById('maintenancePartQuantity').value),
        motivo_retiro: maintenanceById('maintenancePartReason').value.trim() || null
      })
    });
    maintenanceById('maintenancePartQuantity').value = '';
    await openMaintenanceParts(maintenanceOrders.find((item) => String(item.id) === String(orderId)));
    await loadMaintenanceData();
  } catch (error) {
    maintenanceAlert(error.message || 'No se pudo registrar el repuesto', 'danger');
  }
}

function updateMaintenancePartReason() {
  const reason = maintenanceById('maintenancePartReason');
  const required = maintenanceById('maintenancePartOperation').value === 'retirado';
  reason.disabled = !required;
  reason.required = required;
}

function handleMaintenanceActions(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const order = maintenanceOrders.find((item) => String(item.id) === button.dataset.id);
  if (!order) return;
  if (button.dataset.action === 'evidence') PrivateEvidence.open('mantenimiento', order.id, `${order.codigo} · ${order.activo_codigo}`, maintenanceCan('edit'));
  if (button.dataset.action === 'edit') openMaintenanceForm(order);
  if (button.dataset.action === 'parts') openMaintenanceParts(order);
  if (button.dataset.action === 'start') changeMaintenanceState(order, 'in_progress');
  if (button.dataset.action === 'waiting-parts') changeMaintenanceState(order, 'waiting_parts');
  if (button.dataset.action === 'resume') changeMaintenanceState(order, 'in_progress');
  if (button.dataset.action === 'close') changeMaintenanceState(order, 'completed');
  if (button.dataset.action === 'cancel') changeMaintenanceState(order, 'cancelled');
}

function setupMaintenanceEvents() {
  maintenanceModal = new bootstrap.Modal(maintenanceById('maintenanceModal'));
  maintenancePartsModal = new bootstrap.Modal(maintenanceById('maintenancePartsModal'));
  maintenanceById('maintenanceForm').addEventListener('submit', saveMaintenance);
  maintenanceById('maintenancePartForm').addEventListener('submit', addMaintenancePart);
  maintenanceById('maintenancePartOperation').addEventListener('change', updateMaintenancePartReason);
  maintenanceById('maintenanceTableBody').addEventListener('click', handleMaintenanceActions);
  maintenanceById('newMaintenanceButton').addEventListener('click', () => openMaintenanceForm());
  maintenanceById('newMaintenanceTypeButton').addEventListener('click', createMaintenanceType);
  maintenanceById('exportMaintenanceButton').addEventListener('click', exportMaintenanceOrders);
  maintenanceById('maintenanceState').addEventListener('change', renderMaintenanceOrders);
  maintenanceById('maintenanceSearch').addEventListener('input', () => {
    clearTimeout(maintenanceTimer);
    maintenanceTimer = setTimeout(renderMaintenanceOrders, 150);
  });
  window.addEventListener('empresaCambiada', (event) => {
    maintenanceCompanyId = String(event.detail.empresaId);
    loadMaintenanceData();
  });
  maintenanceById('logoutBtn').addEventListener('click', (event) => {
    event.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('empresaActiva');
    window.location.href = 'login.html';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  maintenanceUser = JSON.parse(localStorage.getItem('usuario') || 'null');
  if (!maintenanceUser) { window.location.href = 'login.html'; return; }
  maintenanceById('userName').textContent = `${maintenanceUser.nombre || ''} ${maintenanceUser.apellido || ''}`.trim() || 'Usuario';
  maintenanceById('userRole').textContent = maintenanceUser.tipo_usuario || 'Usuario';
  setupMaintenanceEvents();
  maintenanceCompanyId = localStorage.getItem('empresaActiva');
  if (maintenanceCompanyId) loadMaintenanceData();
  else setTimeout(() => {
    maintenanceCompanyId = localStorage.getItem('empresaActiva');
    if (maintenanceCompanyId) loadMaintenanceData();
  }, 600);
});
