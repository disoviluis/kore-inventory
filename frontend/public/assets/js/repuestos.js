const REPUESTOS_API = '/api';
const repuestosStateLabels = {
  available: 'Disponible', reserved: 'Reservado', installed: 'Instalado',
  in_repair: 'En reparación', quarantine: 'Cuarentena',
  unrepairable: 'No reparable', retired: 'Dado de baja'
};

let repuestosEmpresaId = null;
let repuestosUsuario = null;
let repuestosData = [];
let productosDisponibles = [];
let bodegasRepuestos = [];
let repuestosTransitionReferences = { activos: [], ordenes: [], bodegas: [] };
let tiposCompatibles = [];
let permisosRepuestos = new Set();
let partModal;
let serialModal;
let compatibilityModal;
let repuestosSearchTimer;

const repuestosById = (id) => document.getElementById(id);
const repuestosEscape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

function puedeRepuesto(action) {
  return ['super_admin', 'admin_empresa'].includes(repuestosUsuario?.tipo_usuario)
    || permisosRepuestos.has(`repuestos.${action}`);
}

async function repuestosRequest(path, options = {}) {
  const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${REPUESTOS_API}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    const error = new Error(result.message || `Error HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return result.data;
}

function repuestosAlert(message, type = 'success') {
  repuestosById('alertContainer').innerHTML = `<div class="alert alert-${repuestosEscape(type)} alert-dismissible fade show" role="alert">${repuestosEscape(message)}<button class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button></div>`;
}

function updateRepuestosUser() {
  repuestosUsuario = JSON.parse(localStorage.getItem('usuario') || 'null');
  if (!repuestosUsuario) return false;
  repuestosById('userName').textContent = `${repuestosUsuario.nombre || ''} ${repuestosUsuario.apellido || ''}`.trim() || 'Usuario';
  const labels = { super_admin: 'Super Administrador', admin_empresa: 'Administrador', usuario: 'Usuario', soporte: 'Soporte' };
  repuestosById('userRole').textContent = labels[repuestosUsuario.tipo_usuario] || repuestosUsuario.tipo_usuario;
  return true;
}

async function loadRepuestosPermissions() {
  const result = await repuestosRequest(`/auth/permisos?empresa_id=${encodeURIComponent(repuestosEmpresaId)}`);
  permisosRepuestos = new Set((result?.permisos || []).map((permission) => `${permission.modulo}.${permission.accion}`));
  repuestosById('newPartButton').classList.toggle('d-none', !puedeRepuesto('create'));
  repuestosById('exportPartsButton').classList.toggle('d-none', !puedeRepuesto('export'));
  repuestosById('serialForm').querySelector('button[type="submit"]').classList.toggle('d-none', !puedeRepuesto('create'));
}

async function loadRepuestos() {
  if (!repuestosEmpresaId) return;
  repuestosById('partsTableBody').innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">Cargando repuestos...</td></tr>';
  try {
    await loadRepuestosPermissions();
    const [parts, warehouses, types, transitionReferences] = await Promise.all([
      repuestosRequest(`/repuestos?empresa_id=${encodeURIComponent(repuestosEmpresaId)}`),
      puedeRepuesto('create') ? repuestosRequest(`/repuestos/bodegas?empresa_id=${encodeURIComponent(repuestosEmpresaId)}`).catch(() => []) : Promise.resolve([]),
      repuestosRequest(`/repuestos/tipos-compatibles?empresa_id=${encodeURIComponent(repuestosEmpresaId)}`).catch(() => []),
      repuestosRequest(`/repuestos/referencias-transicion?empresa_id=${encodeURIComponent(repuestosEmpresaId)}`).catch(() => ({ activos: [], ordenes: [], bodegas: [] }))
    ]);
    repuestosData = parts || [];
    bodegasRepuestos = warehouses || [];
    tiposCompatibles = types || [];
    repuestosTransitionReferences = transitionReferences || repuestosTransitionReferences;
    renderRepuestos();
  } catch (error) {
    repuestosAlert(error.message || 'No se pudieron cargar los repuestos', 'danger');
    repuestosById('partsTableBody').innerHTML = '<tr><td colspan="7" class="text-center py-5 text-danger">No se pudieron cargar los repuestos.</td></tr>';
    if (error.status === 401) window.location.href = 'login.html';
  }
}

function renderRepuestos() {
  const search = repuestosById('partSearch').value.trim().toLocaleLowerCase();
  const state = repuestosById('partStateFilter').value;
  const parts = repuestosData.filter((part) => {
    const text = [part.nombre, part.sku, part.codigo_barras, part.numero_parte, part.marca_fabricante].join(' ').toLocaleLowerCase();
    return (!search || text.includes(search)) && (!state || part.repuesto_estado === state);
  });
  if (!parts.length) {
    repuestosById('partsTableBody').innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">${repuestosData.length ? 'No hay repuestos que coincidan.' : 'Todavía no hay productos registrados como repuestos.'}</td></tr>`;
    return;
  }
  repuestosById('partsTableBody').innerHTML = parts.map((part) => {
    const image = part.imagen_url
      ? `<img class="part-photo" src="${repuestosEscape(part.imagen_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : '<span class="part-photo-empty"><i class="bi bi-tools"></i></span>';
    return `<tr>
      <td><div class="d-flex align-items-center gap-2">${image}<div><div class="fw-semibold">${repuestosEscape(part.nombre)}</div><small class="text-muted">${repuestosEscape(part.marca_fabricante || part.categoria_nombre || '')}</small></div></div></td>
      <td><span class="font-monospace">${repuestosEscape(part.sku)}</span><br><small class="text-muted">${repuestosEscape(part.codigo_barras || 'Sin código')}</small></td>
      <td>${repuestosEscape(part.numero_parte || '—')}</td>
      <td>${Number(part.stock_total || 0).toFixed(3)} ${repuestosEscape(part.unidad_medida || '')}</td>
      <td>${Number(part.serializado) ? `<button class="btn btn-sm btn-link p-0" data-action="serials" data-id="${part.producto_id}">${Number(part.unidades_serializadas || 0)} unidades</button>` : 'No'}</td>
      <td><span class="badge text-bg-${part.repuesto_estado === 'activo' ? 'success' : 'secondary'}">${part.repuesto_estado === 'activo' ? 'Activo' : 'Inactivo'}</span></td>
      <td class="text-end text-nowrap">
        ${puedeRepuesto('edit') ? `<button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${part.producto_id}" title="Editar ficha"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-secondary" data-action="compatibility" data-id="${part.producto_id}" title="Compatibilidad"><i class="bi bi-diagram-3"></i></button>` : ''}
        ${Number(part.serializado) && puedeRepuesto('view') ? `<button class="btn btn-sm btn-outline-secondary" data-action="serials" data-id="${part.producto_id}" title="Unidades serializadas"><i class="bi bi-upc-scan"></i></button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

async function exportSpareParts() {
  try {
    const params = new URLSearchParams({ empresa_id: repuestosEmpresaId });
    const search = repuestosById('partSearch').value.trim();
    const state = repuestosById('partStateFilter').value;
    if (search) params.set('buscar', search);
    if (state) params.set('estado', state);
    const rows = await repuestosRequest(`/repuestos/export?${params}`);
    const columns = [
      ['sku', 'SKU'], ['nombre', 'Nombre'], ['codigo_barras', 'Código de barras'],
      ['numero_parte', 'Número de parte'], ['marca_fabricante', 'Fabricante'],
      ['serializado', 'Control serial'], ['repuesto_estado', 'Estado'],
      ['stock_total', 'Stock'], ['unidades_serializadas', 'Unidades serializadas']
    ].map(([key, label]) => ({ key, label }));
    CsvExport.download('repuestos.csv', columns, rows || []);
  } catch (error) {
    repuestosAlert(error.message || 'No se pudo exportar repuestos', 'danger');
  }
}

function fillSelect(select, options, placeholder, selectedValue = '') {
  select.innerHTML = `<option value="">${repuestosEscape(placeholder)}</option>${options.map((option) => `<option value="${repuestosEscape(option.id)}" ${String(option.id) === String(selectedValue) ? 'selected' : ''}>${repuestosEscape(option.label)}</option>`).join('')}`;
}

async function openNewPart() {
  repuestosById('partForm').reset();
  repuestosById('partProductId').value = '';
  repuestosById('partProductPicker').classList.remove('d-none');
  repuestosById('partProductSelect').disabled = false;
  repuestosById('partStateWrap').classList.add('d-none');
  repuestosById('partModalTitle').textContent = 'Agregar producto como repuesto';
  try {
    productosDisponibles = await repuestosRequest(`/repuestos/productos-disponibles?empresa_id=${encodeURIComponent(repuestosEmpresaId)}`);
    fillSelect(repuestosById('partProductSelect'), productosDisponibles.map((product) => ({
      id: product.id, label: `${product.sku} · ${product.nombre} · Stock ${Number(product.stock_actual || 0).toFixed(3)}`
    })), 'Seleccione producto inventariable');
    partModal.show();
  } catch (error) {
    repuestosAlert(error.message || 'No se pudieron cargar productos inventariables', 'danger');
  }
}

function openEditPart(part) {
  repuestosById('partForm').reset();
  repuestosById('partProductId').value = part.producto_id;
  repuestosById('partProductPicker').classList.add('d-none');
  repuestosById('partProductSelect').disabled = true;
  repuestosById('partNumber').value = part.numero_parte || '';
  repuestosById('partManufacturer').value = part.marca_fabricante || '';
  repuestosById('partSerialized').checked = Number(part.serializado) === 1;
  repuestosById('partState').value = part.repuesto_estado;
  repuestosById('partState').value = part.repuesto_estado;
  repuestosById('partStateWrap').classList.remove('d-none');
  repuestosById('partModalTitle').textContent = `${part.sku} · ${part.nombre}`;
  partModal.show();
}

async function savePart(event) {
  event.preventDefault();
  const productId = repuestosById('partProductId').value || repuestosById('partProductSelect').value;
  const editing = Boolean(repuestosById('partProductId').value) && repuestosById('partProductPicker').classList.contains('d-none');
  const payload = {
    empresa_id: Number(repuestosEmpresaId),
    producto_id: Number(productId),
    numero_parte: repuestosById('partNumber').value.trim() || null,
    marca_fabricante: repuestosById('partManufacturer').value.trim() || null,
    serializado: repuestosById('partSerialized').checked,
    ...(editing ? { estado: repuestosById('partState').value } : {})
  };
  try {
    await repuestosRequest(editing ? `/repuestos/${productId}?empresa_id=${encodeURIComponent(repuestosEmpresaId)}` : `/repuestos?empresa_id=${encodeURIComponent(repuestosEmpresaId)}`, {
      method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload)
    });
    partModal.hide();
    await loadRepuestos();
    repuestosAlert(editing ? 'Ficha de repuesto actualizada.' : 'Producto agregado al catálogo de repuestos. El stock no fue modificado.');
  } catch (error) {
    repuestosAlert(error.message || 'No se pudo guardar el repuesto', 'danger');
  }
}

function openSerialModal(part) {
  repuestosById('serialPartName').textContent = `${part.sku} · ${part.nombre}`;
  repuestosById('serialProductId').value = part.producto_id;
  repuestosById('serialNumber').value = '';
  repuestosById('serialLot').value = '';
  fillSelect(repuestosById('serialWarehouse'), bodegasRepuestos.map((warehouse) => ({ id: warehouse.id, label: `${warehouse.codigo} · ${warehouse.nombre}` })), 'Seleccione bodega');
  loadSerialUnits(part.producto_id);
  serialModal.show();
}

async function loadSerialUnits(productId) {
  try {
    const units = await repuestosRequest(`/repuestos/${productId}/unidades?empresa_id=${encodeURIComponent(repuestosEmpresaId)}`);
    repuestosById('serialTableBody').innerHTML = units.length ? units.map((unit) => `<tr><td class="font-monospace">${repuestosEscape(unit.numero_serie)}</td><td>${repuestosEscape(unit.lote || '—')}</td><td>${repuestosEscape(repuestosStateLabels[unit.estado] || unit.estado)}</td><td>${repuestosEscape(unit.activo_codigo ? `${unit.activo_codigo} · ${unit.activo_nombre}` : '—')}</td><td>${repuestosEscape(unit.bodega_nombre || '—')}</td><td>${repuestosEscape(unit.recibido_at ? new Date(unit.recibido_at).toLocaleDateString() : '—')}</td><td>${['install','remove','repair','retire','assign'].some(puedeRepuesto) ? `<button class="btn btn-sm btn-outline-primary" data-action="serial-transition" data-id="${unit.id}" data-state="${unit.estado}" data-asset-id="${unit.activo_actual_id || ''}" title="Cambiar estado"><i class="bi bi-arrow-left-right"></i></button>` : ''}<button class="btn btn-sm btn-outline-secondary" data-action="serial-history" data-id="${unit.id}" title="Trazabilidad"><i class="bi bi-clock-history"></i></button><button class="btn btn-sm btn-outline-secondary" data-action="evidence" data-product-id="${unit.producto_id}" title="Evidencias privadas"><i class="bi bi-paperclip"></i></button></td></tr>`).join('') : '<tr><td colspan="7" class="text-center text-muted py-4">No hay unidades serializadas registradas.</td></tr>';
  } catch (error) {
    repuestosById('serialTableBody').innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">${repuestosEscape(error.message)}</td></tr>`;
  }
}

async function registerSerialUnit(event) {
  event.preventDefault();
  const productId = repuestosById('serialProductId').value;
  try {
    await repuestosRequest(`/repuestos/${productId}/unidades?empresa_id=${encodeURIComponent(repuestosEmpresaId)}`, {
      method: 'POST',
      body: JSON.stringify({
        empresa_id: Number(repuestosEmpresaId),
        numero_serie: repuestosById('serialNumber').value.trim(),
        lote: repuestosById('serialLot').value.trim() || null,
        bodega_id: Number(repuestosById('serialWarehouse').value)
      })
    });
    repuestosById('serialNumber').value = '';
    repuestosById('serialLot').value = '';
    await loadSerialUnits(productId);
    await loadRepuestos();
    repuestosAlert('Unidad serializada asociada al stock existente; no se creó ni modificó stock.');
  } catch (error) {
    repuestosAlert(error.message || 'No se pudo registrar el serial', 'danger');
  }
}

async function openCompatibility(part) {
  repuestosById('compatibilityProductId').value = part.producto_id;
  fillSelect(repuestosById('compatibleAssetType'), tiposCompatibles.map((type) => ({ id: type.id, label: `${type.categoria_nombre} · ${type.nombre}` })), 'Seleccione tipo de activo');
  repuestosById('compatibilityNotes').value = '';
  await loadCompatibility(part.producto_id);
  compatibilityModal.show();
}

async function loadCompatibility(productId) {
  try {
    const compatibility = await repuestosRequest(`/repuestos/${productId}/compatibilidad?empresa_id=${encodeURIComponent(repuestosEmpresaId)}`);
    repuestosById('compatibilityList').innerHTML = compatibility.length ? compatibility.map((item) => `<li class="list-group-item d-flex justify-content-between"><span>${repuestosEscape(item.categoria_nombre)} · ${repuestosEscape(item.tipo_nombre)}${item.notas ? `<br><small class="text-muted">${repuestosEscape(item.notas)}</small>` : ''}</span></li>`).join('') : '<li class="list-group-item text-muted">Sin compatibilidades.</li>';
  } catch (error) {
    repuestosById('compatibilityList').innerHTML = `<li class="list-group-item text-danger">${repuestosEscape(error.message)}</li>`;
  }
}

async function addCompatibility(event) {
  event.preventDefault();
  const productId = repuestosById('compatibilityProductId').value;
  try {
    await repuestosRequest(`/repuestos/${productId}/compatibilidad?empresa_id=${encodeURIComponent(repuestosEmpresaId)}`, {
      method: 'POST', body: JSON.stringify({
        empresa_id: Number(repuestosEmpresaId),
        activo_tipo_id: Number(repuestosById('compatibleAssetType').value),
        notas: repuestosById('compatibilityNotes').value.trim() || null
      })
    });
    repuestosById('compatibilityNotes').value = '';
    await loadCompatibility(productId);
  } catch (error) {
    repuestosAlert(error.message || 'No se pudo agregar la compatibilidad', 'danger');
  }
}

async function showSerialHistory(unitId) {
  try {
    const history = await repuestosRequest(`/repuestos/unidades/${unitId}/historial?empresa_id=${encodeURIComponent(repuestosEmpresaId)}`);
    const lines = history.map((event) => `${new Date(event.ocurrido_at).toLocaleString()} · ${event.tipo_evento} · ${event.estado_anterior || '—'} → ${event.estado_nuevo || '—'} · ${event.usuario_nombre || 'Sistema'}`).join('\n');
    await Swal.fire({ title: 'Trazabilidad de unidad', text: lines || 'Sin eventos.', icon: 'info' });
  } catch (error) {
    repuestosAlert(error.message || 'No se pudo cargar la trazabilidad', 'danger');
  }
}

async function chooseSerialReference(title, options) {
  if (!options.length) {
    repuestosAlert('No hay opciones válidas para esta transición.', 'warning');
    return null;
  }
  const result = await Swal.fire({
    title, input: 'select',
    inputOptions: Object.fromEntries(options.map((option) => [option.id, option.label])),
    inputPlaceholder: 'Selecciona una opción', showCancelButton: true,
    confirmButtonText: 'Continuar', cancelButtonText: 'Volver'
  });
  return result.isConfirmed ? Number(result.value) : null;
}

async function transitionSerialUnit(unitId, currentState, currentAssetId) {
  const transitions = {
    available: ['reserved','in_repair','quarantine','installed','retired'],
    reserved: ['available','in_repair','quarantine','installed','retired'],
    installed: ['available','in_repair','quarantine','retired'],
    in_repair: ['available','quarantine','unrepairable','retired'],
    quarantine: ['available','in_repair','unrepairable','retired'],
    unrepairable: ['retired'], retired: []
  };
  const choices = transitions[currentState] || [];
  if (!choices.length) return;
  const selected = await Swal.fire({
    title: 'Nuevo estado de la unidad', input: 'select',
    inputOptions: Object.fromEntries(choices.map((state) => [state, repuestosStateLabels[state] || state])),
    inputPlaceholder: 'Selecciona un estado', showCancelButton: true,
    confirmButtonText: 'Continuar', cancelButtonText: 'Volver'
  });
  if (!selected.isConfirmed) return;
  const state = selected.value;
  const payload = { estado: state };
  let assetId = currentState === 'installed' ? Number(currentAssetId) : null;
  if (state === 'installed') {
    assetId = await chooseSerialReference('Activo de destino', repuestosTransitionReferences.activos.map((asset) => ({
      id: asset.id, label: `${asset.codigo} · ${asset.nombre}`
    })));
    if (!assetId) return;
    payload.activo_id = assetId;
  }
  if (state === 'installed' || currentState === 'installed') {
    const orders = repuestosTransitionReferences.ordenes.filter((order) => Number(order.activo_id) === assetId).map((order) => ({
      id: order.id, label: `${order.codigo} · ${order.activo_codigo} ${order.activo_nombre}`
    }));
    const maintenanceId = await chooseSerialReference('Orden de mantenimiento activa', orders);
    if (!maintenanceId) return;
    payload.mantenimiento_id = maintenanceId;
  }
  if (state !== 'installed' && state !== 'retired') {
    const warehouseId = await chooseSerialReference('Bodega de ubicación', repuestosTransitionReferences.bodegas.map((warehouse) => ({
      id: warehouse.id, label: `${warehouse.codigo} · ${warehouse.nombre}`
    })));
    if (!warehouseId) return;
    payload.bodega_id = warehouseId;
  }
  const reason = await Swal.fire({ title: 'Motivo de transición', input: 'textarea', inputValidator: (value) => value?.trim() ? undefined : 'El motivo es obligatorio', showCancelButton: true, confirmButtonText: 'Registrar', cancelButtonText: 'Volver' });
  if (!reason.isConfirmed) return;
  payload.motivo = reason.value.trim();
  try {
    await repuestosRequest(`/repuestos/unidades/${unitId}/transicion?empresa_id=${encodeURIComponent(repuestosEmpresaId)}`, { method: 'POST', body: JSON.stringify(payload) });
    await loadSerialUnits(repuestosById('serialProductId').value);
    await loadRepuestos();
    repuestosAlert('Transición serial registrada en el historial y el ledger.');
  } catch (error) {
    repuestosAlert(error.message || 'No se pudo cambiar el estado', 'danger');
  }
}

function handlePartActions(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const part = repuestosData.find((item) => String(item.producto_id) === button.dataset.id);
  if (button.dataset.action === 'edit' && part) openEditPart(part);
  if (button.dataset.action === 'compatibility' && part) openCompatibility(part);
  if (button.dataset.action === 'serials' && part) openSerialModal(part);
  if (button.dataset.action === 'serial-history') showSerialHistory(button.dataset.id);
  if (button.dataset.action === 'serial-transition') transitionSerialUnit(button.dataset.id, button.dataset.state, button.dataset.assetId);
  if (button.dataset.action === 'evidence') PrivateEvidence.open('repuesto', button.dataset.productId, `Repuesto ${button.dataset.productId}`, puedeRepuesto('edit'));
}

function bindRepuestosEvents() {
  repuestosById('partForm').addEventListener('submit', savePart);
  repuestosById('serialForm').addEventListener('submit', registerSerialUnit);
  repuestosById('compatibilityForm').addEventListener('submit', addCompatibility);
  repuestosById('newPartButton').addEventListener('click', openNewPart);
  repuestosById('exportPartsButton').addEventListener('click', exportSpareParts);
  repuestosById('partsTableBody').addEventListener('click', handlePartActions);
  repuestosById('serialTableBody').addEventListener('click', handlePartActions);
  repuestosById('partSearch').addEventListener('input', () => {
    clearTimeout(repuestosSearchTimer);
    repuestosSearchTimer = setTimeout(renderRepuestos, 150);
  });
  repuestosById('partStateFilter').addEventListener('change', renderRepuestos);
  window.addEventListener('empresaCambiada', (event) => {
    repuestosEmpresaId = String(event.detail.empresaId);
    loadRepuestos();
  });
  repuestosById('logoutBtn').addEventListener('click', (event) => {
    event.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('empresaActiva');
    window.location.href = 'login.html';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  repuestosUsuario = JSON.parse(localStorage.getItem('usuario') || 'null');
  if (!repuestosUsuario) {
    window.location.href = 'login.html';
    return;
  }
  repuestosById('userName').textContent = `${repuestosUsuario.nombre || ''} ${repuestosUsuario.apellido || ''}`.trim() || 'Usuario';
  const labels = { super_admin: 'Super Administrador', admin_empresa: 'Administrador', usuario: 'Usuario', soporte: 'Soporte' };
  repuestosById('userRole').textContent = labels[repuestosUsuario.tipo_usuario] || repuestosUsuario.tipo_usuario;
  partModal = new bootstrap.Modal(repuestosById('partModal'));
  serialModal = new bootstrap.Modal(repuestosById('serialModal'));
  compatibilityModal = new bootstrap.Modal(repuestosById('compatibilityModal'));
  bindRepuestosEvents();
  repuestosEmpresaId = localStorage.getItem('empresaActiva');
  if (repuestosEmpresaId) loadRepuestos();
  else setTimeout(() => {
    repuestosEmpresaId = localStorage.getItem('empresaActiva');
    if (repuestosEmpresaId) loadRepuestos();
  }, 600);
});
