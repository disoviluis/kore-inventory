const INVENTARIO_FISICO_API = '/api';
const inventoryStates = { draft: 'Borrador', scheduled: 'Programado', counting: 'En conteo', reconciliation: 'En conciliación', review: 'En revisión', adjustment_pending: 'Ajuste pendiente', closed: 'Cerrado', cancelled: 'Cancelado' };
let inventarioEmpresaId = null;
let inventarioUsuario = null;
let inventarioPermissions = new Set();
let inventariosData = [];
let bodegasData = [];
let productosData = [];
let inventoryMemberOptions = [];
let inventarioActual = null;
let sessionActual = null;
let modalInventario;
let modalConteo;
let modalAjuste;
let modalEventosInventario;
let inventorySearchTimer;
let solicitudesAjuste = [];
let countScanner = null;

const inventoryById = (id) => document.getElementById(id);
const inventoryEscape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const inventoryCompanyQuery = () => `empresa_id=${encodeURIComponent(inventarioEmpresaId || '')}`;

async function inventoryRequest(path, options = {}) {
  const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${INVENTARIO_FISICO_API}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    const error = new Error(result.message || `Error HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return result.data;
}

function inventoryCan(action, module = 'inventarios_fisicos') {
  return ['super_admin', 'admin_empresa'].includes(inventarioUsuario?.tipo_usuario)
    || inventarioPermissions.has(`${module}.${action}`);
}

async function loadInventoryPermissions() {
  const result = await inventoryRequest(`/auth/permisos?${inventoryCompanyQuery()}`);
  inventarioPermissions = new Set((result?.permisos || []).map((permission) => `${permission.modulo}.${permission.accion}`));
  inventoryById('newInventoryButton').classList.toggle('d-none', !inventoryCan('create'));
  inventoryById('compareInventoryButton').classList.toggle('d-none', !inventoryCan('reconcile'));
}

function inventoryAlert(message, kind = 'success') {
  inventoryById('inventoryAlert').innerHTML = `<div class="alert alert-${inventoryEscape(kind)} alert-dismissible fade show" role="alert">${inventoryEscape(message)}<button class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button></div>`;
}

function fillInventorySelect(select, options, placeholder) {
  select.innerHTML = `<option value="">${inventoryEscape(placeholder)}</option>${options.map((option) => `<option value="${inventoryEscape(option.id)}">${inventoryEscape(option.label)}</option>`).join('')}`;
}

async function loadInventoryData() {
  if (!inventarioEmpresaId) return;
  inventoryById('inventoriesTableBody').innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">Cargando inventarios...</td></tr>';
  try {
    await loadInventoryPermissions();
    inventoryById('newInventoryButton').classList.toggle('d-none', !inventoryCan('create'));
    const [inventories, references, products] = await Promise.all([
      inventoryRequest(`/inventarios-fisicos?${inventoryCompanyQuery()}`),
      inventoryRequest(`/inventarios-fisicos/referencias?${inventoryCompanyQuery()}`).catch((error) => {
        if (error.status === 403) return { bodegas: [], integrantes: [] };
        throw error;
      }),
      inventoryRequest(`/productos?empresa_id=${encodeURIComponent(inventarioEmpresaId)}`).catch(() => [])
    ]);
    inventariosData = inventories || [];
    bodegasData = references?.bodegas || [];
    inventoryMemberOptions = (references?.integrantes || []).map((user) => ({
      id: user.id, label: `${user.nombre || ''} ${user.apellido || ''}`.trim() || user.email
    }));
    fillInventorySelect(inventoryById('inventoryTeam1'), inventoryMemberOptions, 'Selecciona el equipo C1');
    fillInventorySelect(inventoryById('inventoryTeam2'), inventoryMemberOptions, 'Selecciona el equipo C2');
    productosData = products || [];
    fillInventorySelect(inventoryById('inventoryWarehouses'), bodegasData.filter((warehouse) => warehouse.estado === 'activa').map((warehouse) => ({ id: warehouse.id, label: `${warehouse.codigo} · ${warehouse.nombre}` })), 'Selecciona bodegas');
    renderInventories();
  } catch (error) {
    inventoryAlert(error.message || 'No se pudieron cargar los inventarios', 'danger');
    inventoryById('inventoriesTableBody').innerHTML = `<tr><td colspan="7" class="text-center py-5 text-danger">${inventoryEscape(error.message)}</td></tr>`;
  }
}

function renderInventories() {
  const search = inventoryById('inventorySearch').value.trim().toLocaleLowerCase();
  const state = inventoryById('inventoryStateFilter').value;
  const rows = inventariosData.filter((inventory) => {
    const text = `${inventory.codigo} ${inventory.nombre}`.toLocaleLowerCase();
    return (!state || inventory.estado === state) && (!search || text.includes(search));
  });
  inventoryById('inventoryActiveCount').textContent = inventariosData.filter((item) => !['closed','cancelled'].includes(item.estado)).length;
  inventoryById('inventoryCountingCount').textContent = inventariosData.filter((item) => item.estado === 'counting').length;
  inventoryById('inventoryReviewCount').textContent = inventariosData.filter((item) => ['review','reconciliation','adjustment_pending'].includes(item.estado)).length;
  inventoryById('inventoryClosedCount').textContent = inventariosData.filter((item) => item.estado === 'closed').length;
  if (!rows.length) {
    inventoryById('inventoriesTableBody').innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">No hay inventarios para los filtros seleccionados.</td></tr>';
    return;
  }
  inventoryById('inventoriesTableBody').innerHTML = rows.map((inventory) => {
    const percent = Number(inventory.total_bodegas) ? Math.round(Number(inventory.bodegas_cerradas) / Number(inventory.total_bodegas) * 100) : 0;
    const badge = inventory.estado === 'closed' ? 'success' : ['review','adjustment_pending'].includes(inventory.estado) ? 'warning' : 'primary';
    return `<tr><td><button class="btn btn-link p-0 fw-semibold text-decoration-none" data-action="detail" data-id="${inventory.id}">${inventoryEscape(inventory.codigo)}</button><br><small class="text-muted">${inventoryEscape(inventory.nombre)}</small></td><td>${inventory.ventana_inicio ? inventoryEscape(new Date(inventory.ventana_inicio).toLocaleString()) : 'Sin inicio'}${inventory.ventana_fin ? `<br><small>hasta ${inventoryEscape(new Date(inventory.ventana_fin).toLocaleString())}</small>` : ''}</td><td><span class="badge text-bg-${badge}">${inventoryEscape(inventoryStates[inventory.estado] || inventory.estado)}</span></td><td>${Number(inventory.total_bodegas || 0)}</td><td>${Number(inventory.max_rondas)}</td><td><div class="d-flex align-items-center gap-2"><div class="progress flex-grow-1" style="height:6px"><div class="progress-bar" style="width:${percent}%"></div></div><small>${percent}%</small></div><small class="text-muted">${Number(inventory.sesiones_completadas || 0)}/${Number(inventory.sesiones || 0)} sesiones</small></td><td class="text-end"><button class="btn btn-sm btn-outline-primary" data-action="detail" data-id="${inventory.id}" title="Abrir centro de control"><i class="bi bi-arrow-up-right-square"></i></button></td></tr>`;
  }).join('');
}

function openInventoryModal() {
  inventoryById('inventoryForm').reset();
  inventoryById('inventoryMaxRounds').value = 2;
  modalInventario.show();
}

async function saveInventory(event) {
  event.preventDefault();
  const countTeam1 = [...inventoryById('inventoryTeam1').selectedOptions].filter((option) => option.value).map((option) => Number(option.value));
  const countTeam2 = [...inventoryById('inventoryTeam2').selectedOptions].filter((option) => option.value).map((option) => Number(option.value));
  if (!countTeam1.length || !countTeam2.length) {
    inventoryAlert('Selecciona integrantes para ambas rondas.', 'danger');
    return;
  }
  if (countTeam1.some((memberId) => countTeam2.includes(memberId))) {
    inventoryAlert('C1 y C2 deben tener equipos distintos para preservar la independencia.', 'danger');
    return;
  }
  const payload = {
    empresa_id: Number(inventarioEmpresaId),
    codigo: inventoryById('inventoryCode').value.trim(),
    nombre: inventoryById('inventoryName').value.trim(),
    ventana_inicio: inventoryById('inventoryStart').value || null,
    ventana_fin: inventoryById('inventoryEnd').value || null,
    max_rondas: Number(inventoryById('inventoryMaxRounds').value),
    bodegas: [...inventoryById('inventoryWarehouses').selectedOptions].filter((option) => option.value).map((option) => Number(option.value)),
    equipos: { c1: countTeam1, c2: countTeam2 }
  };
  try {
    const created = await inventoryRequest(`/inventarios-fisicos?${inventoryCompanyQuery()}`, { method: 'POST', body: JSON.stringify(payload) });
    modalInventario.hide();
    inventoryAlert(`Inventario ${created.codigo} creado.`);
    await loadInventoryData();
    await openInventoryDetail(created.id);
  } catch (error) {
    inventoryAlert(error.message || 'No se pudo crear el inventario', 'danger');
  }
}

async function openInventoryDetail(inventoryId) {
  try {
    inventarioActual = await inventoryRequest(`/inventarios-fisicos/${inventoryId}?${inventoryCompanyQuery()}`);
    inventoryById('inventoryDetail').classList.remove('d-none');
    inventoryById('inventoryDetailTitle').textContent = `${inventarioActual.codigo} · ${inventarioActual.nombre}`;
    inventoryById('inventoryDetailMeta').textContent = `${inventoryStates[inventarioActual.estado] || inventarioActual.estado} · ${inventarioActual.max_rondas} rondas · ${inventarioActual.bodegas.length} bodegas`;
    renderWarehouseSessions();
    ensureAdjustmentControls();
    inventoryById('inventoryEventsButton').classList.toggle('d-none', !inventoryCan('view_results'));
    inventoryById('inventoryEvidenceButton').classList.toggle('d-none', !inventoryCan('view_results'));
    inventoryById('exportInventoryResultsButton').classList.toggle('d-none', !inventoryCan('export'));
    await loadInventoryResults(inventoryId);
    await loadAdjustmentRequests(inventoryId);
    inventoryById('inventoryDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    inventoryAlert(error.message || 'No se pudo cargar el inventario', 'danger');
  }
}

async function openInventoryEvents() {
  if (!inventarioActual || !inventoryCan('view_results')) return;
  inventoryById('inventoryEventsBody').innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Cargando historial...</td></tr>';
  modalEventosInventario.show();
  try {
    const rows = await inventoryRequest(`/inventarios-fisicos/${inventarioActual.id}/eventos?${inventoryCompanyQuery()}`);
    inventoryById('inventoryEventsBody').innerHTML = rows.length ? rows.map((item) => {
      const changes = [item.motivo, item.datos_anteriores ? `Antes: ${JSON.stringify(item.datos_anteriores)}` : '',
        item.datos_nuevos ? `Después: ${JSON.stringify(item.datos_nuevos)}` : ''].filter(Boolean).join('\n');
      return `<tr><td class="text-nowrap">${inventoryEscape(new Date(item.ocurrido_at).toLocaleString())}</td><td>${inventoryEscape(item.tipo_evento)}</td><td>${inventoryEscape(item.bodega_nombre || '—')}</td><td>${inventoryEscape(item.usuario_nombre || 'Sistema')}</td><td><small class="text-break">${inventoryEscape(changes || '—')}</small></td></tr>`;
    }).join('') : '<tr><td colspan="5" class="text-center text-muted py-3">Sin eventos registrados.</td></tr>';
  } catch (error) {
    inventoryById('inventoryEventsBody').innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">${inventoryEscape(error.message)}</td></tr>`;
  }
}

function ensureAdjustmentControls() {
  const resultsCard = inventoryById('inventoryResultsBody').closest('.card');
  if (!document.getElementById('reconciliationActions')) {
    resultsCard.insertAdjacentHTML('beforebegin', `<div class="d-flex flex-wrap justify-content-end gap-2 mb-3" id="reconciliationActions"><button class="btn btn-success d-none" id="approveReconciliationButton"><i class="bi bi-check2-circle me-1"></i>Aprobar conciliación</button><button class="btn btn-outline-primary d-none" id="requestAdjustmentButton"><i class="bi bi-arrow-left-right me-1"></i>Solicitar ajuste</button><button class="btn btn-dark d-none" id="closeInventoryButton"><i class="bi bi-lock me-1"></i>Cerrar inventario</button></div>`);
    inventoryById('approveReconciliationButton').addEventListener('click', approveInventoryReconciliation);
    inventoryById('requestAdjustmentButton').addEventListener('click', requestAdjustment);
    inventoryById('closeInventoryButton').addEventListener('click', closeInventory);
  }
  inventoryById('approveReconciliationButton').classList.toggle('d-none', !inventoryCan('approve'));
  inventoryById('requestAdjustmentButton').classList.toggle('d-none', !inventoryCan('create', 'ajustes_inventario'));
  inventoryById('closeInventoryButton').classList.toggle('d-none', !inventoryCan('close') || inventarioActual?.estado !== 'adjustment_pending');
  if (!document.getElementById('adjustmentRequestsCard')) {
    resultsCard.insertAdjacentHTML('afterend', `<div class="card shadow-sm mt-3" id="adjustmentRequestsCard"><div class="card-header bg-white"><h3 class="h6 mb-0">Solicitudes de ajuste</h3></div><div class="table-responsive"><table class="table table-sm mb-0"><thead class="table-light"><tr><th>Código</th><th>Estado</th><th>Motivo</th><th>Líneas</th><th class="text-end">Acciones</th></tr></thead><tbody id="adjustmentRequestsBody"></tbody></table></div></div>`);
    inventoryById('adjustmentRequestsBody').addEventListener('click', handleAdjustmentActions);
  }
}

function renderWarehouseSessions() {
  const grouped = new Map();
  for (const session of inventarioActual.rondas || []) {
    if (!grouped.has(session.inventario_bodega_id)) grouped.set(session.inventario_bodega_id, { id: session.inventario_bodega_id, bodega_id: session.bodega_id, nombre: session.bodega_nombre, sesiones: [] });
    if (session.sesion_id) grouped.get(session.inventario_bodega_id).sesiones.push(session);
  }
  inventoryById('warehouseSessions').innerHTML = [...grouped.values()].map((warehouse) => {
    const sessions = warehouse.sesiones.map((session) => {
      const canCount = inventoryCan('count');
      const previousRound = warehouse.sesiones.find((prior) => Number(prior.numero) === Number(session.numero) - 1);
      const previousClosed = Number(session.numero) === 1 || ['completed','locked'].includes(previousRound?.sesion_estado);
      const action = ['not_started','reopened'].includes(session.sesion_estado) && canCount && previousClosed
        ? `<button class="btn btn-sm btn-primary" data-action="start-session" data-id="${session.sesion_id}"><i class="bi bi-play me-1"></i>Iniciar ronda ${session.numero}</button>`
        : session.sesion_estado === 'in_progress' && canCount
          ? `<button class="btn btn-sm btn-outline-primary" data-action="continue-session" data-id="${session.sesion_id}"><i class="bi bi-upc-scan me-1"></i>Continuar ronda ${session.numero}</button>`
          : ['completed','locked'].includes(session.sesion_estado) && inventoryCan('reopen')
            ? `<button class="btn btn-sm btn-outline-warning" data-action="reopen-session" data-id="${session.sesion_id}"><i class="bi bi-arrow-counterclockwise me-1"></i>Reabrir ronda ${session.numero}</button>`
          : `<span class="badge text-bg-secondary">R${session.numero}: ${inventoryEscape(session.sesion_estado)}</span>`;
      return `<div class="d-flex justify-content-between align-items-center py-1"><span>Ronda ${session.numero}: ${inventoryEscape(session.sesion_estado)}</span>${action}</div>`;
    }).join('');
    const latestRound = Math.max(0, ...warehouse.sesiones.map((session) => Number(session.numero)));
    const sessionsClosed = warehouse.sesiones.every((session) => ['completed','locked'].includes(session.sesion_estado));
    const extraRound = inventoryCan('approve') && latestRound < Number(inventarioActual.max_rondas)
      && sessionsClosed && latestRound > 0
      ? `<button class="btn btn-sm btn-outline-warning mt-2" data-action="extra-round" data-id="${warehouse.bodega_id}">Autorizar nueva ronda</button>` : '';
    return `<div class="col-md-6 col-xl-4"><div class="card shadow-sm h-100"><div class="card-header bg-white d-flex justify-content-between align-items-center"><h3 class="h6 mb-0">${inventoryEscape(warehouse.nombre)}</h3><span class="badge text-bg-${['reconciled','closed'].includes(warehouse.sesiones[0]?.estado) ? 'success' : 'primary'}">${inventoryEscape(warehouse.sesiones[0]?.estado || 'not_started')}</span></div><div class="card-body">${sessions || '<span class="text-muted">Sin sesiones.</span>'}${extraRound}</div></div></div>`;
  }).join('');
}

async function openCountSession(sessionId) {
  try {
    sessionActual = { id: Number(sessionId) };
    await inventoryRequest(`/inventarios-fisicos/sesiones/${sessionId}/iniciar?${inventoryCompanyQuery()}`, { method: 'POST', body: JSON.stringify({ empresa_id: Number(inventarioEmpresaId) }) });
    const [products, lines, details] = await Promise.all([
      inventoryRequest(`/inventarios-fisicos/sesiones/${sessionId}/productos?${inventoryCompanyQuery()}`),
      inventoryRequest(`/inventarios-fisicos/sesiones/${sessionId}/lineas?${inventoryCompanyQuery()}`),
      inventoryRequest(`/inventarios-fisicos/${inventarioActual.id}?${inventoryCompanyQuery()}`)
    ]);
    const session = details.rondas.find((round) => Number(round.sesion_id) === Number(sessionId));
    sessionActual = { id: Number(sessionId), productos: products || [], bodega_id: session?.bodega_id, nombre: session?.bodega_nombre, ronda: session?.numero };
    inventoryById('countTitle').textContent = `${sessionActual.nombre || 'Bodega'} · Ronda ${sessionActual.ronda || ''}`;
    inventoryById('countSessionMeta').textContent = 'Captura independiente; las rondas previas y el stock teórico permanecen ocultos.';
    fillInventorySelect(inventoryById('countProduct'), sessionActual.productos.map((product) => ({ id: product.producto_id, label: `${product.sku} · ${product.producto_nombre} · ${product.unidad_medida}${Number(product.serializado) ? ' · serial' : ''}` })), 'Selecciona producto');
    updateCountProductMode();
    renderCountLines(lines || []);
    modalConteo.show();
    await loadInventoryData();
    await openInventoryDetail(inventarioActual.id);
  } catch (error) {
    inventoryAlert(error.message || 'No se pudo abrir la sesión de conteo', 'danger');
  }
}

function renderCountLines(lines) {
  inventoryById('countLinesBody').innerHTML = lines.length ? lines.map((line) => `<tr><td>${inventoryEscape(line.sku)} · ${inventoryEscape(line.producto_nombre)}${line.numero_serie ? `<br><small class="text-muted">SN: ${inventoryEscape(line.numero_serie)}</small>` : ''}</td><td>${inventoryEscape(line.ubicacion || '—')}</td><td class="text-end">${Number(line.cantidad).toFixed(3)} ${inventoryEscape(line.unidad_medida || '')}</td><td class="text-end"><button class="btn btn-sm btn-outline-danger" data-action="void-line" data-id="${line.id}" title="Anular línea"><i class="bi bi-trash"></i></button></td></tr>`).join('') : '<tr><td colspan="4" class="text-center text-muted py-3">Sin capturas todavía.</td></tr>';
}

async function captureCount(event) {
  event.preventDefault();
  const productId = Number(inventoryById('countProduct').value);
  const product = sessionActual?.productos.find((item) => Number(item.producto_id) === productId);
  const isSerialized = Number(product?.serializado) === 1;
  const quantity = isSerialized ? 1 : Number(inventoryById('countQuantity').value);
  if (!productId || !Number.isFinite(quantity) || quantity < 0) return;
  try {
    let serialUnitId = null;
    if (isSerialized) {
      const serialNumber = inventoryById('countSerialNumber').value.trim();
      if (!serialNumber) {
        inventoryAlert('Ingresa o escanea el número de serie.', 'warning');
        inventoryById('countSerialNumber').focus();
        return;
      }
      const serialUnit = await inventoryRequest(`/inventarios-fisicos/sesiones/${sessionActual.id}/seriales?${inventoryCompanyQuery()}&numero_serie=${encodeURIComponent(serialNumber)}`);
      if (Number(serialUnit.producto_id) !== productId) throw new Error('El serial no corresponde al producto seleccionado.');
      serialUnitId = serialUnit.unidad_serial_id;
    }
    await inventoryRequest(`/inventarios-fisicos/sesiones/${sessionActual.id}/lineas?${inventoryCompanyQuery()}`, {
      method: 'POST', body: JSON.stringify({
        empresa_id: Number(inventarioEmpresaId), producto_id: productId, cantidad: quantity,
        unidad_serial_id: serialUnitId,
        ubicacion: inventoryById('countLocation').value.trim() || null,
        idempotency_key: crypto.randomUUID()
      })
    });
    inventoryById('countQuantity').value = '';
    inventoryById('countSerialNumber').value = '';
    inventoryById('countLocation').value = '';
    inventoryById(Number(product.serializado) ? 'countSerialNumber' : 'countProduct').focus();
    const lines = await inventoryRequest(`/inventarios-fisicos/sesiones/${sessionActual.id}/lineas?${inventoryCompanyQuery()}`);
    renderCountLines(lines || []);
  } catch (error) {
    inventoryAlert(error.message || 'No se pudo registrar la captura', 'danger');
  }
}

function updateCountProductMode() {
  const productId = Number(inventoryById('countProduct').value);
  const product = sessionActual?.productos.find((item) => Number(item.producto_id) === productId);
  const isSerialized = Number(product?.serializado) === 1;
  const serialField = inventoryById('countSerialNumber');
  const quantityField = inventoryById('countQuantity');
  inventoryById('countSerialWrap').classList.toggle('d-none', !isSerialized);
  serialField.required = isSerialized;
  serialField.value = '';
  if (isSerialized) {
    quantityField.value = '1';
    quantityField.readOnly = true;
  } else {
    quantityField.readOnly = false;
  }
}

async function markProductNotPresent() {
  const productId = Number(inventoryById('countProduct').value);
  if (!sessionActual?.id || !productId) return;
  try {
    await inventoryRequest(`/inventarios-fisicos/sesiones/${sessionActual.id}/productos/${productId}/cobertura?${inventoryCompanyQuery()}`, {
      method: 'PUT', body: JSON.stringify({ empresa_id: Number(inventarioEmpresaId), cobertura: 'not_present' })
    });
    inventoryAlert('Producto marcado como no presente (cero unidades).', 'success');
  } catch (error) {
    inventoryAlert(error.message || 'No se pudo registrar la cobertura', 'danger');
  }
}

async function stopCountScanner() {
  if (!countScanner) return;
  try {
    if (countScanner.isScanning) await countScanner.stop();
    countScanner.clear();
  } catch (error) {
    console.warn('No se pudo detener el lector:', error);
  }
  countScanner = null;
  inventoryById('countScannerContainer').classList.add('d-none');
}

async function startCountScanner() {
  if (countScanner) {
    await stopCountScanner();
    return;
  }
  if (typeof Html5Qrcode === 'undefined') {
    inventoryAlert('El lector no está disponible. Ingresa el código manualmente.', 'warning');
    return;
  }
  const container = inventoryById('countScannerContainer');
  container.classList.remove('d-none');
  countScanner = new Html5Qrcode('countScannerContainer');
  const formats = Html5QrcodeSupportedFormats;
  try {
    await countScanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 260, height: 150 },
        formatsToSupport: [formats.QR_CODE, formats.EAN_13, formats.EAN_8, formats.UPC_A, formats.UPC_E, formats.CODE_128, formats.CODE_39, formats.ITF]
      },
      async (decodedText) => {
        const rawCode = String(decodedText).trim();
        try {
          const serialUnit = await inventoryRequest(`/inventarios-fisicos/sesiones/${sessionActual.id}/seriales?${inventoryCompanyQuery()}&numero_serie=${encodeURIComponent(rawCode)}`);
          inventoryById('countProduct').value = String(serialUnit.producto_id);
          updateCountProductMode();
          inventoryById('countSerialNumber').value = rawCode;
          inventoryById('countQuantity').value = '1';
          await stopCountScanner();
          inventoryById('countCaptureForm').requestSubmit();
          return;
        } catch (error) {
          if (error.status !== 404) {
            await stopCountScanner();
            inventoryAlert(error.message || 'No se pudo validar el número de serie.', 'warning');
            return;
          }
        }
        const code = rawCode.toLocaleLowerCase();
        const product = productosData.find((item) => [item.sku, item.codigo_barras].some((value) => String(value || '').trim().toLocaleLowerCase() === code));
        const scopedProduct = sessionActual?.productos.find((item) => Number(item.producto_id) === Number(product?.id));
        if (!product || !scopedProduct) {
          inventoryAlert('El código no pertenece al alcance de esta bodega.', 'warning');
          return;
        }
        inventoryById('countProduct').value = String(scopedProduct.producto_id);
        updateCountProductMode();
        await stopCountScanner();
        inventoryById(Number(scopedProduct.serializado) ? 'countSerialNumber' : 'countQuantity').focus();
      },
      () => {}
    );
  } catch (error) {
    await stopCountScanner();
    inventoryAlert('No se pudo abrir la cámara. Revisa permisos y conexión HTTPS, o ingresa el código manualmente.', 'warning');
  }
}

async function voidCountLine(lineId) {
  const result = await Swal.fire({ title: 'Anular línea de conteo', input: 'textarea', inputLabel: 'Motivo requerido', inputValidator: (value) => value?.trim() ? undefined : 'El motivo es obligatorio', showCancelButton: true, confirmButtonText: 'Anular línea', cancelButtonText: 'Volver' });
  if (!result.isConfirmed) return;
  try {
    await inventoryRequest(`/inventarios-fisicos/lineas/${lineId}?${inventoryCompanyQuery()}`, { method: 'DELETE', body: JSON.stringify({ empresa_id: Number(inventarioEmpresaId), motivo: result.value.trim() }) });
    renderCountLines(await inventoryRequest(`/inventarios-fisicos/sesiones/${sessionActual.id}/lineas?${inventoryCompanyQuery()}`));
  } catch (error) {
    inventoryAlert(error.message || 'No se pudo anular la línea', 'danger');
  }
}

async function closeCountSession() {
  if (!sessionActual) return;
  const result = await Swal.fire({ title: 'Finalizar conteo de bodega', text: 'Al cerrar, las líneas quedan bloqueadas.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Finalizar', cancelButtonText: 'Seguir contando' });
  if (!result.isConfirmed) return;
  try {
    await inventoryRequest(`/inventarios-fisicos/sesiones/${sessionActual.id}/cerrar?${inventoryCompanyQuery()}`, { method: 'POST', body: JSON.stringify({ empresa_id: Number(inventarioEmpresaId) }) });
    modalConteo.hide();
    await loadInventoryData();
    await openInventoryDetail(inventarioActual.id);
  } catch (error) {
    inventoryAlert(error.message || 'No se pudo cerrar el conteo', 'danger');
  }
}

async function reopenCountSession(sessionId) {
  const result = await Swal.fire({ title: 'Reabrir sesión de conteo', input: 'textarea', inputLabel: 'Motivo requerido', inputValidator: (value) => value?.trim() ? undefined : 'El motivo es obligatorio', showCancelButton: true, confirmButtonText: 'Reabrir', cancelButtonText: 'Volver' });
  if (!result.isConfirmed) return;
  try {
    await inventoryRequest(`/inventarios-fisicos/sesiones/${sessionId}/reabrir?${inventoryCompanyQuery()}`, { method: 'POST', body: JSON.stringify({ empresa_id: Number(inventarioEmpresaId), motivo: result.value.trim() }) });
    await loadInventoryData();
    await openCountSession(sessionId);
  } catch (error) {
    inventoryAlert(error.message || 'No se pudo reabrir la sesión', 'danger');
  }
}

async function closeInventory() {
  if (!inventarioActual) return;
  const result = await Swal.fire({ title: 'Cerrar inventario', input: 'textarea', inputLabel: 'Motivo / referencia de cierre', inputValidator: (value) => value?.trim() ? undefined : 'El motivo es obligatorio', showCancelButton: true, confirmButtonText: 'Cerrar definitivamente', cancelButtonText: 'Volver' });
  if (!result.isConfirmed) return;
  try {
    await inventoryRequest(`/inventarios-fisicos/${inventarioActual.id}/cerrar?${inventoryCompanyQuery()}`, { method: 'POST', body: JSON.stringify({ empresa_id: Number(inventarioEmpresaId), motivo: result.value.trim() }) });
    await loadInventoryData();
    await openInventoryDetail(inventarioActual.id);
    inventoryAlert('Inventario cerrado y resultados conservados.');
  } catch (error) {
    inventoryAlert(error.message || 'No se pudo cerrar el inventario', 'danger');
  }
}

async function loadInventoryResults(inventoryId) {
  try {
    const rows = await inventoryRequest(`/inventarios-fisicos/${inventoryId}/resultados?${inventoryCompanyQuery()}`);
    const groups = new Map();
    for (const row of rows || []) {
      const key = `${row.bodega_id}:${row.producto_id}`;
      if (!groups.has(key)) groups.set(key, { ...row, rounds: {} });
      if (row.numero_ronda) groups.get(key).rounds[row.numero_ronda] = row.cantidad_ronda;
    }
      inventoryById('inventoryResultsBody').innerHTML = groups.size ? [...groups.values()].map((row) => `<tr><td>${inventoryEscape(row.bodega_nombre)}</td><td>${inventoryEscape(row.sku)}</td><td>${inventoryEscape(row.producto_nombre)}</td><td>${Number(row.stock_sistema).toFixed(3)}</td><td>${row.rounds[1] === null || row.rounds[1] === undefined ? '—' : Number(row.rounds[1]).toFixed(3)}</td><td>${row.rounds[2] === null || row.rounds[2] === undefined ? '—' : Number(row.rounds[2]).toFixed(3)}</td><td>${Object.keys(row.rounds).filter((round) => Number(round) > 2).map((round) => `R${round}: ${Number(row.rounds[round]).toFixed(3)}`).join(' · ') || '—'}</td><td>${row.diferencia === null ? '—' : Number(row.diferencia).toFixed(3)}</td><td><span class="badge text-bg-${row.estado === 'matched' || row.estado === 'approved' ? 'success' : row.estado === 'incomplete' ? 'secondary' : 'warning'}">${inventoryEscape(row.estado)}</span>${['difference','incomplete','review'].includes(row.estado) && !(row.estado === 'review' && row.resuelto_por) && inventoryCan('review') ? `<button class="btn btn-sm btn-link" data-action="resolve-result" data-warehouse="${row.bodega_id}" data-product="${row.producto_id}" title="Resolver manualmente">Resolver</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="9" class="text-center text-muted py-4">Sin resultados de conciliación.</td></tr>';
      const canApprove = inventoryCan('approve') && groups.size > 0 && [...groups.values()].every((row) => (['matched','approved'].includes(row.estado) || (row.estado === 'review' && row.resuelto_por)) && row.cantidad_fisica !== null);
      inventoryById('approveReconciliationButton')?.classList.toggle('d-none', !canApprove);
      const canRequest = inventoryCan('create', 'ajustes_inventario') && [...groups.values()].some((row) => row.estado === 'approved' && Number(row.diferencia) !== 0);
      inventoryById('requestAdjustmentButton')?.classList.toggle('d-none', !canRequest);
  } catch (error) {
    inventoryById('inventoryResultsBody').innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">${inventoryEscape(error.message || 'Resultados disponibles para perfiles autorizados')}</td></tr>`;
  }
}

async function compareInventory() {
  if (!inventarioActual) return;
  try {
    const result = await inventoryRequest(`/inventarios-fisicos/${inventarioActual.id}/comparar?${inventoryCompanyQuery()}`, { method: 'POST', body: JSON.stringify({ empresa_id: Number(inventarioEmpresaId) }) });
    inventoryAlert(`${result.comparados} productos comparados.`);
    await loadInventoryData();
    await openInventoryDetail(inventarioActual.id);
  } catch (error) {
    inventoryAlert(error.message || 'No se pudo comparar el inventario', 'danger');
  }
}

async function exportInventoryResults() {
  if (!inventarioActual || !inventoryCan('export')) return;
  try {
    const rows = await inventoryRequest(`/inventarios-fisicos/${inventarioActual.id}/export?${inventoryCompanyQuery()}`);
    const columns = [
      ['bodega_nombre', 'Bodega'], ['sku', 'SKU'], ['producto_nombre', 'Producto'],
      ['stock_sistema', 'Stock de corte'], ['numero_ronda', 'Ronda'],
      ['cantidad_ronda', 'Cantidad de ronda'], ['cobertura', 'Cobertura'],
      ['cantidad_fisica', 'Cantidad conciliada'], ['diferencia', 'Diferencia'], ['estado', 'Estado']
    ].map(([key, label]) => ({ key, label }));
    CsvExport.download(`inventario_${inventarioActual.codigo}_resultados.csv`, columns, rows || []);
  } catch (error) {
    inventoryAlert(error.message || 'No se pudieron exportar los resultados', 'danger');
  }
}

async function resolveInventoryResult(warehouseId, productId) {
  const result = await Swal.fire({
    title: 'Resolver diferencia',
    html: '<p class="text-start small text-muted">Define la cantidad conciliada con evidencia. La decisión requiere aprobación antes de ajustar stock.</p>',
    input: 'number', inputAttributes: { min: '0', step: '0.001' },
    inputLabel: 'Cantidad física conciliada', inputValidator: (value) => Number.isFinite(Number(value)) && Number(value) >= 0 ? undefined : 'Cantidad inválida',
    showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Volver'
  });
  if (!result.isConfirmed) return;
  const reason = await Swal.fire({ title: 'Motivo de resolución', input: 'textarea', inputValidator: (value) => value?.trim() ? undefined : 'El motivo es obligatorio', showCancelButton: true, confirmButtonText: 'Registrar', cancelButtonText: 'Cancelar' });
  if (!reason.isConfirmed) return;
  try {
    await inventoryRequest(`/inventarios-fisicos/${inventarioActual.id}/resolver-diferencia?${inventoryCompanyQuery()}`, {
      method: 'POST', body: JSON.stringify({ empresa_id: Number(inventarioEmpresaId), bodega_id: warehouseId, producto_id: productId, cantidad_fisica: Number(result.value), motivo: reason.value.trim() })
    });
    await loadInventoryResults(inventarioActual.id);
  } catch (error) {
    inventoryAlert(error.message || 'No se pudo resolver la diferencia', 'danger');
  }
}

async function approveInventoryReconciliation() {
  const result = await Swal.fire({ title: 'Aprobar conciliación', input: 'textarea', inputLabel: 'Motivo / referencia de aprobación', inputValidator: (value) => value?.trim() ? undefined : 'El motivo es obligatorio', showCancelButton: true, confirmButtonText: 'Aprobar', cancelButtonText: 'Volver' });
  if (!result.isConfirmed) return;
  try {
    await inventoryRequest(`/inventarios-fisicos/${inventarioActual.id}/aprobar-conciliacion?${inventoryCompanyQuery()}`, { method: 'POST', body: JSON.stringify({ empresa_id: Number(inventarioEmpresaId), motivo: result.value.trim() }) });
    const inventoryId = inventarioActual.id;
    await loadInventoryData();
    await openInventoryDetail(inventoryId);
    inventoryAlert('Conciliación aprobada. Ya se pueden solicitar ajustes autorizables.');
  } catch (error) {
    inventoryAlert(error.message || 'No se pudo aprobar la conciliación', 'danger');
  }
}

async function loadAdjustmentRequests(inventoryId) {
  try {
    const rows = await inventoryRequest(`/inventarios-fisicos/ajustes?${inventoryCompanyQuery()}`);
    solicitudesAjuste = (rows || []).filter((item) => Number(item.inventario_id) === Number(inventoryId));
    inventoryById('adjustmentRequestsBody').innerHTML = solicitudesAjuste.length ? solicitudesAjuste.map((request) => {
      const actions = [];
      if (request.estado === 'under_review' && inventoryCan('approve', 'ajustes_inventario')) {
        actions.push(`<button class="btn btn-sm btn-outline-success" data-action="approve-adjustment" data-id="${request.id}" title="Aprobar"><i class="bi bi-check-lg"></i></button>`);
      }
      if (['requested','under_review'].includes(request.estado) && inventoryCan('review', 'ajustes_inventario')) {
        if (request.estado === 'requested') actions.push(`<button class="btn btn-sm btn-outline-primary" data-action="review-adjustment" data-id="${request.id}" title="Iniciar revisión"><i class="bi bi-search"></i></button>`);
        actions.push(`<button class="btn btn-sm btn-outline-danger" data-action="reject-adjustment" data-id="${request.id}" title="Rechazar"><i class="bi bi-x-lg"></i></button>`);
      }
      if (request.estado === 'approved' && inventoryCan('apply', 'ajustes_inventario')) actions.push(`<button class="btn btn-sm btn-primary" data-action="apply-adjustment" data-id="${request.id}">Aplicar</button>`);
      return `<tr><td class="font-monospace">${inventoryEscape(request.codigo)}</td><td>${inventoryEscape(request.estado)}</td><td>${inventoryEscape(request.motivo)}</td><td>${Number(request.lineas)}</td><td class="text-end">${actions.join(' ') || '—'}</td></tr>`;
    }).join('') : '<tr><td colspan="5" class="text-center text-muted py-3">Sin solicitudes de ajuste.</td></tr>';
  } catch (error) {
    inventoryById('adjustmentRequestsBody').innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">${inventoryEscape(error.message)}</td></tr>`;
  }
}

async function handleAdjustmentActions(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const adjustmentId = button.dataset.id;
  const action = button.dataset.action;
  if (action.startsWith('approve-') || action.startsWith('reject-') || action === 'review-adjustment') {
    const decision = action === 'approve-adjustment' ? 'approved' : action === 'review-adjustment' ? 'under_review' : 'rejected';
    const decisionTitle = decision === 'approved' ? 'Autorizar ajuste' : decision === 'under_review' ? 'Iniciar revisión' : 'Rechazar ajuste';
    const reason = await Swal.fire({ title: decisionTitle, input: 'textarea', inputLabel: 'Observaciones', inputValidator: (value) => value?.trim() ? undefined : 'Ingresa las observaciones', showCancelButton: true, confirmButtonText: 'Guardar decisión', cancelButtonText: 'Volver' });
    if (!reason.isConfirmed) return;
    try {
      await inventoryRequest(`/inventarios-fisicos/ajustes/${adjustmentId}/revision?${inventoryCompanyQuery()}`, { method: 'PATCH', body: JSON.stringify({ empresa_id: Number(inventarioEmpresaId), estado: decision, observaciones: reason.value.trim() }) });
      await loadAdjustmentRequests(inventarioActual.id);
    } catch (error) { inventoryAlert(error.message || 'No se pudo revisar el ajuste', 'danger'); }
  } else if (action === 'apply-adjustment') {
    const confirmation = await Swal.fire({ title: 'Aplicar ajuste aprobado', text: 'Se modificarán existencias y se registrará un movimiento. La operación es irreversible.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Aplicar', cancelButtonText: 'Cancelar' });
    if (!confirmation.isConfirmed) return;
    try {
      await inventoryRequest(`/inventarios-fisicos/ajustes/${adjustmentId}/aplicar?${inventoryCompanyQuery()}`, { method: 'POST', body: JSON.stringify({ empresa_id: Number(inventarioEmpresaId) }) });
      await loadAdjustmentRequests(inventarioActual.id);
      await loadInventoryResults(inventarioActual.id);
      inventoryAlert('Ajuste aplicado.');
    } catch (error) { inventoryAlert(error.message || 'No se pudo aplicar el ajuste', 'danger'); }
  }
}

async function requestAdjustment() {
  if (!inventarioActual) return;
  const result = await Swal.fire({ title: 'Solicitar ajuste', input: 'textarea', inputLabel: 'Motivo y soporte', inputValidator: (value) => value?.trim() ? undefined : 'El motivo es obligatorio', showCancelButton: true, confirmButtonText: 'Enviar a revisión', cancelButtonText: 'Volver' });
  if (!result.isConfirmed) return;
  try {
    await inventoryRequest(`/inventarios-fisicos/${inventarioActual.id}/solicitudes-ajuste?${inventoryCompanyQuery()}`, { method: 'POST', body: JSON.stringify({ empresa_id: Number(inventarioEmpresaId), motivo: result.value.trim() }) });
    inventoryAlert('Solicitud enviada a revisión. No se modificó stock automáticamente.');
    await loadInventoryData();
    await openInventoryDetail(inventarioActual.id);
  } catch (error) {
    inventoryAlert(error.message || 'No se pudo solicitar el ajuste', 'danger');
  }
}

async function openExtraRound(warehouseId) {
  const options = inventoryMemberOptions.map((member) => `<option value="${inventoryEscape(member.id)}">${inventoryEscape(member.label)}</option>`).join('');
  const result = await Swal.fire({
    title: 'Autorizar nuevo conteo',
    html: `<label class="form-label w-100 text-start" for="extraRoundTeam">Equipo independiente</label><select id="extraRoundTeam" class="form-select mb-3" multiple size="5">${options}</select><label class="form-label w-100 text-start" for="extraRoundReason">Motivo</label><textarea id="extraRoundReason" class="form-control" maxlength="255"></textarea>`,
    focusConfirm: false,
    preConfirm: () => {
      const team = [...document.getElementById('extraRoundTeam').selectedOptions].map((option) => Number(option.value));
      const reason = document.getElementById('extraRoundReason').value.trim();
      if (!team.length) return Swal.showValidationMessage('Selecciona al menos un integrante independiente.');
      if (!reason) return Swal.showValidationMessage('El motivo es obligatorio.');
      return { team, reason };
    },
    showCancelButton: true, confirmButtonText: 'Autorizar', cancelButtonText: 'Volver'
  });
  if (!result.isConfirmed) return;
  try {
    await inventoryRequest(`/inventarios-fisicos/${inventarioActual.id}/rondas-adicionales?${inventoryCompanyQuery()}`, { method: 'POST', body: JSON.stringify({ empresa_id: Number(inventarioEmpresaId), bodega_ids: [Number(warehouseId)], integrantes: result.value.team, motivo: result.value.reason }) });
    await loadInventoryData();
    await openInventoryDetail(inventarioActual.id);
  } catch (error) {
    inventoryAlert(error.message || 'No se pudo autorizar la ronda', 'danger');
  }
}

function handleInventoryActions(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'detail') openInventoryDetail(button.dataset.id);
  if (button.dataset.action === 'start-session' || button.dataset.action === 'continue-session') openCountSession(button.dataset.id);
  if (button.dataset.action === 'extra-round') openExtraRound(button.dataset.id);
  if (button.dataset.action === 'reopen-session') reopenCountSession(button.dataset.id);
  if (button.dataset.action === 'void-line') voidCountLine(button.dataset.id);
}

function setupInventoryEvents() {
  modalInventario = new bootstrap.Modal(inventoryById('inventoryModal'));
  modalConteo = new bootstrap.Modal(inventoryById('countModal'));
  modalAjuste = new bootstrap.Modal(inventoryById('adjustmentModal'));
  modalEventosInventario = new bootstrap.Modal(inventoryById('inventoryEventsModal'));
  inventoryById('inventoryForm').addEventListener('submit', saveInventory);
  inventoryById('countCaptureForm').addEventListener('submit', captureCount);
  inventoryById('countProduct').addEventListener('change', updateCountProductMode);
  inventoryById('markNotPresentButton').addEventListener('click', markProductNotPresent);
  inventoryById('countScanButton').addEventListener('click', startCountScanner);
  inventoryById('countModal').addEventListener('hidden.bs.modal', stopCountScanner);
  inventoryById('countScanButton').addEventListener('click', startCountScanner);
  inventoryById('closeCountSessionButton').addEventListener('click', closeCountSession);
  inventoryById('adjustmentForm').addEventListener('submit', async (event) => { event.preventDefault(); modalAjuste.hide(); await requestAdjustment(); });
  inventoryById('compareInventoryButton').addEventListener('click', compareInventory);
  inventoryById('exportInventoryResultsButton').addEventListener('click', exportInventoryResults);
  inventoryById('inventoryEventsButton').addEventListener('click', openInventoryEvents);
  inventoryById('inventoryEvidenceButton').addEventListener('click', () => {
    if (inventarioActual) PrivateEvidence.open('inventario', inventarioActual.id, inventarioActual.codigo, inventoryCan('edit'));
  });
  inventoryById('sessionEvidenceButton').addEventListener('click', () => {
    if (sessionActual) PrivateEvidence.open('sesion_conteo', sessionActual.id, `${sessionActual.nombre} · Ronda ${sessionActual.ronda}`, inventoryCan('count'));
  });
  inventoryById('newInventoryButton').addEventListener('click', openInventoryModal);
  inventoryById('inventoriesTableBody').addEventListener('click', handleInventoryActions);
  inventoryById('countLinesBody').addEventListener('click', handleInventoryActions);
  inventoryById('inventoryResultsBody').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="resolve-result"]');
    if (button) resolveInventoryResult(Number(button.dataset.warehouse), Number(button.dataset.product));
  });
  inventoryById('warehouseSessions').addEventListener('click', handleInventoryActions);
  inventoryById('inventoryStateFilter').addEventListener('change', renderInventories);
  inventoryById('inventorySearch').addEventListener('input', () => {
    clearTimeout(inventorySearchTimer);
    inventorySearchTimer = setTimeout(renderInventories, 150);
  });
  inventoryById('closeInventoryDetail').addEventListener('click', () => inventoryById('inventoryDetail').classList.add('d-none'));
  window.addEventListener('empresaCambiada', (event) => { inventarioEmpresaId = String(event.detail.empresaId); loadInventoryData(); });
  inventoryById('logoutBtn').addEventListener('click', (event) => {
    event.preventDefault(); localStorage.removeItem('token'); localStorage.removeItem('usuario'); localStorage.removeItem('empresaActiva'); window.location.href = 'login.html';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  inventarioUsuario = JSON.parse(localStorage.getItem('usuario') || 'null');
  if (!inventarioUsuario) { window.location.href = 'login.html'; return; }
  inventoryById('userName').textContent = `${inventarioUsuario.nombre || ''} ${inventarioUsuario.apellido || ''}`.trim() || 'Usuario';
  inventoryById('userRole').textContent = inventarioUsuario.tipo_usuario || 'Usuario';
  setupInventoryEvents();
  inventarioEmpresaId = localStorage.getItem('empresaActiva');
  if (inventarioEmpresaId) loadInventoryData();
  else setTimeout(() => { inventarioEmpresaId = localStorage.getItem('empresaActiva'); if (inventarioEmpresaId) loadInventoryData(); }, 600);
});
