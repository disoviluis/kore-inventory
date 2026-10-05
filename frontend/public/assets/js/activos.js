const API_URL = '/api';
const assetStateLabels = {
  active: 'En operación',
  in_maintenance: 'En mantenimiento',
  out_of_service: 'Fuera de servicio',
  retired: 'Dado de baja',
  lost: 'Extraviado'
};

let activosEmpresaId = null;
let activosUsuario = null;
let activosData = [];
let categoriasActivos = [];
let tiposActivos = [];
let bodegasActivos = [];
let usuariosActivos = [];
let proveedoresActivos = [];
let atributosTipo = [];
let puedeConfigurarActivos = true;
let permisosActivos = new Set();
let assetModal;
let categoryModal;
let typeModal;
let attributeModal;
let assignmentModal;
let assetDetailModal;
let searchTimer;

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

function tokenHeaders(json = false) {
  const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...tokenHeaders(options.body !== undefined), ...(options.headers || {}) }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    const error = new Error(result.message || `Error HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return result.data;
}

function showAlert(message, type = 'success') {
  const container = byId('alertContainer');
  container.innerHTML = `<div class="alert alert-${escapeHtml(type)} alert-dismissible fade show" role="alert">${escapeHtml(message)}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button></div>`;
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showError(error, fallback) {
  const message = error?.message || fallback;
  showAlert(message, 'danger');
  if (error?.status === 401) window.location.href = 'login.html';
}

function getCompanyQuery() {
  return `empresa_id=${encodeURIComponent(activosEmpresaId || '')}`;
}

function puedeAccion(modulo, accion) {
  if (['super_admin', 'admin_empresa'].includes(activosUsuario?.tipo_usuario)) return true;
  return permisosActivos.has(`${modulo}.${accion}`);
}

async function cargarPermisosActivos() {
  permisosActivos = new Set();
  if (['super_admin', 'admin_empresa'].includes(activosUsuario?.tipo_usuario)) return;
  const result = await apiRequest(`/auth/permisos?${getCompanyQuery()}`);
  permisosActivos = new Set((result?.permisos || []).map((permission) => `${permission.modulo}.${permission.accion}`));
}

function renderUser() {
  if (!activosUsuario) return;
  byId('userName').textContent = `${activosUsuario.nombre || ''} ${activosUsuario.apellido || ''}`.trim() || 'Usuario';
  const roleLabels = { super_admin: 'Super Administrador', admin_empresa: 'Administrador', usuario: 'Usuario', soporte: 'Soporte' };
  byId('userRole').textContent = roleLabels[activosUsuario.tipo_usuario] || activosUsuario.tipo_usuario || 'Usuario';
}

function setAssetFormDisabled(disabled) {
  byId('saveAssetButton').disabled = disabled;
}

async function loadInitialData() {
  if (!activosEmpresaId) return;
  byId('assetsTableBody').innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">Cargando activos...</td></tr>';
  try {
    await cargarPermisosActivos();
    const [assets, categoryResult, typeResult, references] = await Promise.all([
      apiRequest(`/activos?${getCompanyQuery()}`),
      apiRequest(`/activos/categorias?${getCompanyQuery()}`).then((data) => ({ data, allowed: true })).catch((error) => {
        if (error.status === 403) return { data: [], allowed: false };
        throw error;
      }),
      apiRequest(`/activos/tipos?${getCompanyQuery()}`).then((data) => ({ data, allowed: true })).catch((error) => {
        if (error.status === 403) return { data: [], allowed: false };
        throw error;
      }),
      apiRequest(`/activos/referencias?${getCompanyQuery()}`)
    ]);
    activosData = assets || [];
    categoriasActivos = categoryResult.data || [];
    tiposActivos = typeResult.data || [];
    puedeConfigurarActivos = puedeAccion('activos_config', 'view') && categoryResult.allowed && typeResult.allowed;
    byId('setupTab').closest('.nav-item').classList.toggle('d-none', !puedeConfigurarActivos);
    byId('exportAssetsButton').classList.toggle('d-none', !puedeAccion('activos', 'export'));
    byId('newAssetButton').classList.toggle('d-none', !puedeAccion('activos', 'create'));
    byId('newAssetButton').disabled = !puedeAccion('activos', 'create');
    byId('newCategoryButton').classList.toggle('d-none', !puedeAccion('activos_config', 'create'));
    byId('newTypeButton').classList.toggle('d-none', !puedeAccion('activos_config', 'create'));
    byId('newAttributeButton').classList.toggle('d-none', !puedeAccion('activos_config', 'create'));
    if (!puedeConfigurarActivos && byId('setupPane').classList.contains('active')) {
      bootstrap.Tab.getOrCreateInstance(byId('assetsTab')).show();
    }
    bodegasActivos = references?.bodegas || [];
    usuariosActivos = references?.usuarios || [];
    proveedoresActivos = references?.proveedores || [];
    renderCategories();
    renderTypes();
    populateAssetSelects();
    populateAttributeTypeSelect();
    renderAssets();
  } catch (error) {
    showError(error, 'No se pudieron cargar los activos');
    byId('assetsTableBody').innerHTML = '<tr><td colspan="7" class="text-center py-5 text-danger">No se pudieron cargar los activos.</td></tr>';
  }
}

function populateSelect(select, options, placeholder, selectedValue = '') {
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${options.map((option) =>
    `<option value="${escapeHtml(option.id)}" ${String(option.id) === String(selectedValue) ? 'selected' : ''}>${escapeHtml(option.label)}</option>`
  ).join('')}`;
}

function populateAssetSelects(selectedCategoryId = '', selectedTypeId = '') {
  const activeCategories = categoriasActivos.filter((category) => category.estado === 'activa');
  const categoryOptions = activeCategories.map((category) => ({ id: category.id, label: category.nombre }));
  populateSelect(byId('assetCategoryFilter'), categoryOptions, 'Todas las categorías', byId('assetCategoryFilter').value);
  populateSelect(byId('assetCategory'), categoryOptions, 'Seleccione categoría', selectedCategoryId);
  populateSelect(byId('typeCategory'), categoryOptions, 'Seleccione categoría', selectedCategoryId);

  const matchingTypes = tiposActivos.filter((type) => type.estado === 'activo'
    && (!selectedCategoryId || String(type.categoria_id) === String(selectedCategoryId)));
  populateSelect(byId('assetType'), matchingTypes.map((type) => ({ id: type.id, label: type.nombre })), 'Seleccione tipo', selectedTypeId);

  populateSelect(byId('assetWarehouse'), bodegasActivos.filter((warehouse) => warehouse.estado === 'activa')
    .map((warehouse) => ({ id: warehouse.id, label: `${warehouse.codigo} · ${warehouse.nombre}` })), 'Sin bodega', byId('assetWarehouse').value);
  populateSelect(byId('assetResponsible'), usuariosActivos.filter((user) => Number(user.activo) !== 0)
    .map((user) => ({ id: user.id, label: `${user.nombre || ''} ${user.apellido || ''}`.trim() || user.email || `Usuario ${user.id}` })), 'Sin asignar', byId('assetResponsible').value);
  populateSelect(byId('assignmentWarehouse'), bodegasActivos.filter((warehouse) => warehouse.estado === 'activa')
    .map((warehouse) => ({ id: warehouse.id, label: `${warehouse.codigo} · ${warehouse.nombre}` })), 'Sin bodega', byId('assignmentWarehouse').value);
  populateSelect(byId('assignmentResponsible'), usuariosActivos.filter((user) => Number(user.activo) !== 0)
    .map((user) => ({ id: user.id, label: `${user.nombre || ''} ${user.apellido || ''}`.trim() || user.email || `Usuario ${user.id}` })), 'Sin asignar', byId('assignmentResponsible').value);
  populateSelect(byId('assetProvider'), proveedoresActivos
    .map((provider) => ({ id: provider.id, label: provider.nombre })), 'Sin proveedor', byId('assetProvider').value);
}

function parseOptions(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];
  try { return JSON.parse(value); } catch { return []; }
}

function populateAttributeTypeSelect(selectedTypeId = '') {
  const activeTypes = tiposActivos.filter((type) => type.estado === 'activo');
  populateSelect(byId('attributeTypeSelect'), activeTypes.map((type) => ({
    id: type.id,
    label: `${type.categoria_nombre || categoriasActivos.find((category) => Number(category.id) === Number(type.categoria_id))?.nombre || 'Categoría'} · ${type.nombre}`
  })), 'Selecciona tipo', selectedTypeId);
  const typeId = byId('attributeTypeSelect').value;
  byId('newAttributeButton').disabled = !typeId;
  if (typeId) loadTypeAttributes(typeId);
  else {
    atributosTipo = [];
    byId('attributesTableBody').innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">Selecciona un tipo.</td></tr>';
  }
}

async function loadTypeAttributes(typeId) {
  if (!typeId) return [];
  try {
    atributosTipo = await apiRequest(`/activos/tipos/${typeId}/atributos?${getCompanyQuery()}`) || [];
    renderTypeAttributes();
    return atributosTipo;
  } catch (error) {
    showError(error, 'No se pudieron cargar los atributos del tipo');
    return [];
  }
}

function renderTypeAttributes() {
  if (!atributosTipo.length) {
    byId('attributesTableBody').innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">Este tipo todavía no tiene características.</td></tr>';
    return;
  }
  byId('attributesTableBody').innerHTML = atributosTipo.map((attribute) => {
    const options = parseOptions(attribute.opciones_json);
    const attributeActions = puedeAccion('activos_config', 'edit')
      ? `<button class="btn btn-sm btn-outline-secondary" data-action="edit-attribute" data-id="${attribute.id}" title="Editar atributo"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-${attribute.estado === 'activo' ? 'warning' : 'success'}" data-action="toggle-attribute" data-id="${attribute.id}" title="${attribute.estado === 'activo' ? 'Inactivar' : 'Activar'} atributo"><i class="bi bi-${attribute.estado === 'activo' ? 'pause' : 'play'}"></i></button>`
      : '';
    return `<tr><td><span class="fw-semibold">${escapeHtml(attribute.etiqueta)}</span><br><small class="text-muted font-monospace">${escapeHtml(attribute.clave)}</small></td><td>${escapeHtml(attribute.tipo_dato)}</td><td>${escapeHtml(attribute.unidad || (options.length ? options.join(', ') : '—'))}</td><td>${Number(attribute.requerido) ? 'Sí' : 'No'}</td><td><span class="badge text-bg-${attribute.estado === 'activo' ? 'success' : 'secondary'}">${attribute.estado === 'activo' ? 'Activo' : 'Inactivo'}</span></td><td class="text-end">${attributeActions}</td></tr>`;
  }).join('');
}

function renderAssetAttributeInputs(values = []) {
  const definitions = atributosTipo.filter((attribute) => attribute.estado === 'activo');
  if (!definitions.length) {
    byId('assetDynamicAttributes').innerHTML = '';
    return;
  }
  const valuesById = new Map(values.map((attribute) => [Number(attribute.id), attribute]));
  byId('assetDynamicAttributes').innerHTML = `<hr><h3 class="h6 mb-3">Características del tipo</h3><div class="row g-3">${definitions.map((definition) => {
    const saved = valuesById.get(Number(definition.id));
    let value = saved?.valor_texto ?? saved?.valor_numero ?? '';
    if (value === '' && saved?.valor_booleano !== null && saved?.valor_booleano !== undefined) value = String(Number(saved.valor_booleano));
    if (value === '' && saved?.valor_fecha) value = String(saved.valor_fecha).slice(0, 10);
    const required = Number(definition.requerido) === 1 ? 'required' : '';
    let input;
    if (definition.tipo_dato === 'booleano') {
      input = `<select class="form-select dynamic-asset-attribute" data-attribute-id="${definition.id}" data-attribute-type="booleano" ${required}><option value="">Sin especificar</option><option value="1" ${String(value) === '1' ? 'selected' : ''}>Sí</option><option value="0" ${String(value) === '0' ? 'selected' : ''}>No</option></select>`;
    } else if (definition.tipo_dato === 'opcion') {
      input = `<select class="form-select dynamic-asset-attribute" data-attribute-id="${definition.id}" data-attribute-type="opcion" ${required}><option value="">Selecciona...</option>${parseOptions(definition.opciones_json).map((option) => `<option value="${escapeHtml(option)}" ${String(value) === String(option) ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select>`;
    } else {
      const inputType = definition.tipo_dato === 'numero' ? 'number' : definition.tipo_dato === 'fecha' ? 'date' : 'text';
      const step = inputType === 'number' ? 'step="any"' : '';
      input = `<input class="form-control dynamic-asset-attribute" type="${inputType}" data-attribute-id="${definition.id}" data-attribute-type="${definition.tipo_dato}" value="${escapeHtml(value)}" ${step} ${required}>`;
    }
    return `<div class="col-md-6"><label class="form-label">${escapeHtml(definition.etiqueta)}${required ? ' *' : ''}${definition.unidad ? ` (${escapeHtml(definition.unidad)})` : ''}</label>${input}</div>`;
  }).join('')}</div>`;
}

async function loadAssetAttributes(typeId, savedValues = []) {
  if (!typeId) {
    atributosTipo = [];
    renderAssetAttributeInputs([]);
    return;
  }
  try {
    atributosTipo = await apiRequest(`/activos/tipos/${typeId}/atributos?${getCompanyQuery()}`) || [];
    renderAssetAttributeInputs(savedValues);
  } catch (error) {
    atributosTipo = [];
    renderAssetAttributeInputs([]);
    showError(error, 'No se pudieron cargar las características del tipo');
  }
}

function updateStats() {
  byId('kpiTotal').textContent = activosData.length;
  byId('kpiMaintenance').textContent = activosData.filter((asset) => asset.estado === 'in_maintenance').length;
  byId('kpiOutOfService').textContent = activosData.filter((asset) => asset.estado === 'out_of_service').length;
  byId('kpiActive').textContent = activosData.filter((asset) => asset.estado === 'active').length;
}

function renderAssets() {
  const search = byId('assetSearch').value.trim().toLocaleLowerCase();
  const categoryId = byId('assetCategoryFilter').value;
  const state = byId('assetStateFilter').value;
  const rows = activosData.filter((asset) => {
    const text = [asset.codigo, asset.codigo_interno, asset.nombre, asset.numero_serie].join(' ').toLocaleLowerCase();
    return (!search || text.includes(search))
      && (!categoryId || String(asset.categoria_id) === categoryId)
      && (!state || asset.estado === state);
  });
  updateStats();

  if (!rows.length) {
    byId('assetsTableBody').innerHTML = `<tr><td colspan="7"><div class="empty-state d-flex flex-column align-items-center justify-content-center text-muted"><i class="bi bi-pc-display fs-2 mb-2"></i><span>${activosData.length ? 'No hay activos que coincidan con los filtros.' : 'Aún no hay activos registrados.'}</span></div></td></tr>`;
    return;
  }

  byId('assetsTableBody').innerHTML = rows.map((asset) => {
    const photo = asset.imagen_url
      ? `<img class="asset-photo" src="${escapeHtml(asset.imagen_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<span class=\'asset-photo-placeholder\'><i class=\'bi bi-image\'></i></span>'">`
      : '<span class="asset-photo-placeholder"><i class="bi bi-pc-display"></i></span>';
    const stateClass = asset.estado === 'active' ? 'success' : asset.estado === 'in_maintenance' ? 'warning' : asset.estado === 'retired' ? 'secondary' : 'danger';
    return `<tr>
      <td><div class="d-flex align-items-center gap-2">${photo}<div><div class="fw-semibold">${escapeHtml(asset.nombre)}</div><small class="text-muted">${escapeHtml(asset.marca || '')} ${escapeHtml(asset.modelo || '')}</small></div></div></td>
      <td><span class="font-monospace">${escapeHtml(asset.codigo)}</span>${asset.codigo_interno ? `<br><small class="text-muted">${escapeHtml(asset.codigo_interno)}</small>` : ''}</td>
      <td>${escapeHtml(asset.categoria_nombre || '—')}<br><small class="text-muted">${escapeHtml(asset.tipo_nombre || '—')}</small></td>
      <td><span class="badge text-bg-${stateClass}">${escapeHtml(assetStateLabels[asset.estado] || asset.estado)}</span></td>
      <td>${escapeHtml(asset.bodega_nombre || 'Sin bodega')}${asset.ubicacion ? `<br><small class="text-muted">${escapeHtml(asset.ubicacion)}</small>` : ''}</td>
      <td>${escapeHtml(asset.responsable_nombre || 'Sin asignar')}</td>
      <td class="text-end asset-actions">
        ${puedeAccion('activos', 'view') ? `<button class="btn btn-sm btn-outline-secondary" data-action="details" data-id="${asset.id}" title="Ficha e historial"><i class="bi bi-clock-history"></i></button>` : ''}
        ${puedeAccion('activos', 'view') ? `<button class="btn btn-sm btn-outline-secondary" data-action="evidence" data-id="${asset.id}" title="Evidencias privadas"><i class="bi bi-paperclip"></i></button>` : ''}
        ${asset.estado !== 'retired' && puedeAccion('activos', 'assign') ? `<button class="btn btn-sm btn-outline-info" data-action="assign" data-id="${asset.id}" title="Asignar"><i class="bi bi-person-check"></i></button>` : ''}
        ${asset.estado !== 'retired' && puedeAccion('activos', 'edit') ? `<button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${asset.id}" title="Editar"><i class="bi bi-pencil"></i></button>` : ''}
        ${asset.estado !== 'retired' && puedeAccion('activos', 'retire') ? `<button class="btn btn-sm btn-outline-danger" data-action="retire" data-id="${asset.id}" title="Dar de baja"><i class="bi bi-archive"></i></button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

async function exportAssets() {
  try {
    const params = new URLSearchParams({ empresa_id: activosEmpresaId });
    if (byId('assetSearch').value.trim()) params.set('buscar', byId('assetSearch').value.trim());
    if (byId('assetCategoryFilter').value) params.set('categoria_id', byId('assetCategoryFilter').value);
    if (byId('assetStateFilter').value) params.set('estado', byId('assetStateFilter').value);
    const rows = await apiRequest(`/activos/export?${params}`);
    const columns = [
      ['codigo', 'Código'], ['codigo_interno', 'Código interno'], ['nombre', 'Nombre'],
      ['categoria_nombre', 'Categoría'], ['tipo_nombre', 'Tipo'], ['estado', 'Estado'],
      ['marca', 'Marca'], ['modelo', 'Modelo'], ['numero_serie', 'Serie'],
      ['bodega_nombre', 'Bodega'], ['ubicacion', 'Ubicación'], ['responsable_nombre', 'Responsable'],
      ['fecha_adquisicion', 'Adquisición'], ['valor_adquisicion', 'Valor']
    ].map(([key, label]) => ({ key, label }));
    CsvExport.download('activos.csv', columns, rows || []);
  } catch (error) {
    showError(error, 'No se pudo exportar activos');
  }
}

function renderCategories() {
  if (!categoriasActivos.length) {
    byId('categoriesList').innerHTML = '<div class="list-group-item text-muted">No hay categorías configuradas.</div>';
    return;
  }
  byId('categoriesList').innerHTML = categoriasActivos.map((category) => `
    <div class="list-group-item d-flex justify-content-between align-items-center gap-2">
      <div><div class="fw-semibold">${escapeHtml(category.nombre)}</div><small class="text-muted">${escapeHtml(category.descripcion || '')}</small></div>
      <div class="d-flex align-items-center gap-2"><span class="badge text-bg-${category.estado === 'activa' ? 'success' : 'secondary'}">${category.estado === 'activa' ? 'Activa' : 'Inactiva'}</span>${puedeAccion('activos_config', 'edit') ? `<button class="btn btn-sm btn-outline-secondary" data-action="edit-category" data-id="${category.id}" title="Editar categoría"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-${category.estado === 'activa' ? 'warning' : 'success'}" data-action="toggle-category" data-id="${category.id}" title="${category.estado === 'activa' ? 'Inactivar' : 'Activar'} categoría"><i class="bi bi-${category.estado === 'activa' ? 'pause' : 'play'}"></i></button>` : ''}</div>
    </div>`).join('');
}

function renderTypes() {
  if (!tiposActivos.length) {
    byId('typesTableBody').innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No hay tipos configurados.</td></tr>';
    return;
  }
  byId('typesTableBody').innerHTML = tiposActivos.map((type) => {
    const category = categoriasActivos.find((item) => Number(item.id) === Number(type.categoria_id));
    return `<tr><td>${escapeHtml(type.nombre)}${type.descripcion ? `<br><small class="text-muted">${escapeHtml(type.descripcion)}</small>` : ''}</td><td>${escapeHtml(category?.nombre || type.categoria_nombre || '—')}</td><td><span class="badge text-bg-${type.estado === 'activo' ? 'success' : 'secondary'}">${type.estado === 'activo' ? 'Activo' : 'Inactivo'}</span></td><td class="text-end">${puedeAccion('activos_config', 'edit') ? `<button class="btn btn-sm btn-outline-secondary" data-action="edit-type" data-id="${type.id}" title="Editar tipo"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-outline-${type.estado === 'activo' ? 'warning' : 'success'}" data-action="toggle-type" data-id="${type.id}" title="${type.estado === 'activo' ? 'Inactivar' : 'Activar'} tipo"><i class="bi bi-${type.estado === 'activo' ? 'pause' : 'play'}"></i></button>` : ''}</td></tr>`;
  }).join('');
}

function resetAssetForm() {
  byId('assetForm').reset();
  byId('assetSetupNotice').classList.add('d-none');
  byId('assetId').value = '';
  byId('assetState').value = 'active';
  populateAssetSelects();
  byId('assetType').disabled = true;
  byId('assetModalTitle').textContent = 'Nuevo activo';
}

async function openNewAsset() {
  if (!puedeAccion('activos', 'create')) return;
  resetAssetForm();
  const activeCategories = categoriasActivos.filter((category) => category.estado === 'activa');
  const configured = tiposActivos.some((type) => type.estado === 'activo'
    && activeCategories.some((category) => Number(category.id) === Number(type.categoria_id)));
  byId('assetSetupNotice').classList.toggle('d-none', configured);
  byId('assetSetupButton').classList.toggle('d-none', !puedeConfigurarActivos);
  await loadAssetAttributes(byId('assetType').value);
  assetModal.show();
}

async function editAsset(asset) {
  try {
    asset = await apiRequest(`/activos/${asset.id}?${getCompanyQuery()}`);
  } catch (error) {
    showError(error, 'No se pudo cargar el activo para editarlo');
    return;
  }
  resetAssetForm();
  byId('assetId').value = asset.id;
  byId('assetName').value = asset.nombre || '';
  byId('assetInternalCode').value = asset.codigo_interno || '';
  byId('assetState').value = asset.estado === 'retired' ? 'out_of_service' : asset.estado;
  byId('assetBrand').value = asset.marca || '';
  byId('assetModel').value = asset.modelo || '';
  byId('assetSerial').value = asset.numero_serie || '';
  byId('assetWarehouse').value = asset.bodega_id || '';
  byId('assetLocation').value = asset.ubicacion || '';
  byId('assetResponsible').value = asset.responsable_id || '';
  byId('assetAcquired').value = asset.fecha_adquisicion ? String(asset.fecha_adquisicion).slice(0, 10) : '';
  byId('assetValue').value = asset.valor_adquisicion ?? '';
  byId('assetProvider').value = asset.proveedor_id || '';
  byId('assetPurchaseDocument').value = asset.documento_compra || '';
  byId('assetImageUrl').value = asset.imagen_url || '';
  byId('assetReference').value = asset.referencia || '';
  byId('assetDescription').value = asset.descripcion || '';
  byId('assetNotes').value = asset.observaciones || '';
  byId('assetCategory').value = asset.categoria_id;
  populateAssetSelects(asset.categoria_id, asset.tipo_id);
  byId('assetType').disabled = false;
  await loadAssetAttributes(asset.tipo_id, asset.atributos || []);
  byId('assetModalTitle').textContent = `Editar ${asset.codigo}`;
  assetModal.show();
}

async function uploadAssetImage(assetId, file) {
  byId('assetImageUploadStatus').textContent = 'Comprimiendo imagen...';
  const { blob, mime } = await comprimirImagen(file);
  const extension = mime === 'image/webp' ? 'webp' : 'jpg';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const compressedFile = new File([blob], `${safeName}.${extension}`, { type: mime });
  const signature = await apiRequest(`/activos/${assetId}/imagen/upload-url?${getCompanyQuery()}`, {
    method: 'POST',
    body: JSON.stringify({ filename: compressedFile.name, content_type: mime })
  });
  byId('assetImageUploadStatus').textContent = 'Subiendo foto a S3...';
  const response = await fetch(signature.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': mime },
    body: compressedFile
  });
  if (!response.ok) throw new Error('No se pudo subir la imagen a S3');
  byId('assetImageUploadStatus').textContent = 'Imagen subida.';
  return { key: signature.key, mime, size: compressedFile.size, filename: compressedFile.name };
}

async function saveAsset(event) {
  event.preventDefault();
  const assetId = byId('assetId').value;
  const payload = {
    empresa_id: Number(activosEmpresaId),
    nombre: byId('assetName').value.trim(),
    codigo_interno: byId('assetInternalCode').value.trim() || null,
    estado: byId('assetState').value,
    categoria_id: Number(byId('assetCategory').value),
    tipo_id: Number(byId('assetType').value),
    marca: byId('assetBrand').value.trim() || null,
    modelo: byId('assetModel').value.trim() || null,
    numero_serie: byId('assetSerial').value.trim() || null,
    bodega_id: byId('assetWarehouse').value || null,
    ubicacion: byId('assetLocation').value.trim() || null,
    responsable_id: byId('assetResponsible').value || null,
    fecha_adquisicion: byId('assetAcquired').value || null,
    valor_adquisicion: byId('assetValue').value || null,
    proveedor_id: byId('assetProvider').value || null,
    documento_compra: byId('assetPurchaseDocument').value.trim() || null,
    imagen_url: byId('assetImageUrl').value.trim() || null,
    referencia: byId('assetReference').value.trim() || null,
    descripcion: byId('assetDescription').value.trim() || null,
    observaciones: byId('assetNotes').value.trim() || null,
    atributos: [...document.querySelectorAll('.dynamic-asset-attribute')].map((input) => ({
      atributo_id: Number(input.dataset.attributeId),
      valor: input.value
    }))
  };
  const imageFile = byId('assetImageFile').files[0] || null;
  setAssetFormDisabled(true);
  byId('assetImageUploadStatus').textContent = imageFile
    ? 'Preparando imagen pública para S3/CloudFront...'
    : 'URL manual o carga pública en S3/CloudFront; no adjuntes evidencia sensible.';
  try {
    let savedAssetId = assetId ? Number(assetId) : null;
    if (!assetId) {
      const created = await apiRequest(`/activos?${getCompanyQuery()}`, {
        method: 'POST',
        body: JSON.stringify({ ...payload, imagen_url: imageFile ? null : payload.imagen_url })
      });
      savedAssetId = Number(created.id);
    }
    if (imageFile) {
      try {
        const uploadedImage = await uploadAssetImage(savedAssetId, imageFile);
        payload.imagen_key = uploadedImage.key;
        payload.imagen_mime = uploadedImage.mime;
        payload.imagen_size = uploadedImage.size;
        payload.imagen_nombre = uploadedImage.filename;
      } catch (uploadError) {
        if (!assetId && payload.imagen_url) {
          await apiRequest(`/activos/${savedAssetId}?${getCompanyQuery()}`, {
            method: 'PUT', body: JSON.stringify(payload)
          });
        }
        if (!assetId) {
          assetModal.hide();
          await loadInitialData();
          showAlert(`Activo guardado, pero la foto no se pudo subir: ${uploadError.message}`, 'warning');
          return;
        }
        throw uploadError;
      }
    }
    if (assetId || imageFile) {
      await apiRequest(`/activos/${savedAssetId}?${getCompanyQuery()}`, {
        method: 'PUT', body: JSON.stringify(payload)
      });
    }
    assetModal.hide();
    showAlert(assetId ? 'Activo actualizado.' : 'Activo creado.');
    await loadInitialData();
  } catch (error) {
    showError(error, 'No se pudo guardar el activo');
  } finally {
    setAssetFormDisabled(false);
  }
}

async function loadAssetDetails(assetId) {
  try {
    const asset = await apiRequest(`/activos/${assetId}?${getCompanyQuery()}`);
    const history = await apiRequest(`/activos/${assetId}/historial?${getCompanyQuery()}`);
    const photo = asset.imagen_url ? `<img src="${escapeHtml(asset.imagen_url)}" class="img-fluid rounded mb-3" style="max-height:220px" alt="${escapeHtml(asset.nombre)}" referrerpolicy="no-referrer">` : '';
    const attributes = (asset.atributos || []).map((attribute) => {
      const value = attribute.valor_texto ?? attribute.valor_numero ?? (attribute.valor_booleano === null ? null : Number(attribute.valor_booleano) === 1 ? 'Sí' : 'No') ?? (attribute.valor_fecha ? String(attribute.valor_fecha).slice(0, 10) : null);
      return value === null ? '' : `<div class="col-sm-6"><small class="text-muted">${escapeHtml(attribute.etiqueta)}</small><div>${escapeHtml(value)} ${escapeHtml(attribute.unidad || '')}</div></div>`;
    }).filter(Boolean).join('');
    const events = (history.eventos || []).map((event) => `<li class="list-group-item"><div class="d-flex justify-content-between gap-3"><strong>${escapeHtml(event.tipo_evento)}</strong><small class="text-muted text-nowrap">${escapeHtml(new Date(event.ocurrido_at).toLocaleString())}</small></div><div>${escapeHtml(event.motivo || '')}</div><small class="text-muted">${escapeHtml(`${event.usuario_nombre || ''} ${event.usuario_apellido || ''}`.trim())}</small></li>`).join('');
    const assignments = (history.asignaciones || []).map((assignment) => `<li class="list-group-item"><div class="fw-semibold">${escapeHtml(assignment.usuario_nombre || 'Sin responsable')} · ${escapeHtml(assignment.bodega_nombre || 'Sin bodega')}</div><div>${escapeHtml(assignment.ubicacion || '')}</div><small class="text-muted">${escapeHtml(new Date(assignment.fecha_asignacion).toLocaleString())}${assignment.fecha_devolucion ? ` · Hasta ${escapeHtml(new Date(assignment.fecha_devolucion).toLocaleString())}` : ' · Actual'}</small></li>`).join('');
    byId('assetDetailBody').innerHTML = `${photo}<div class="d-flex justify-content-between align-items-start gap-3 mb-3"><div><h3 class="h5 mb-1">${escapeHtml(asset.nombre)}</h3><div class="text-muted">${escapeHtml(asset.codigo)}${asset.numero_serie ? ` · Serie ${escapeHtml(asset.numero_serie)}` : ''}</div></div><span class="badge text-bg-primary">${escapeHtml(assetStateLabels[asset.estado] || asset.estado)}</span></div><div class="row g-3 mb-4"><div class="col-sm-6"><small class="text-muted">Categoría / tipo</small><div>${escapeHtml(asset.categoria_nombre)} · ${escapeHtml(asset.tipo_nombre)}</div></div><div class="col-sm-6"><small class="text-muted">Marca / modelo</small><div>${escapeHtml(`${asset.marca || ''} ${asset.modelo || ''}`.trim() || '—')}</div></div><div class="col-sm-6"><small class="text-muted">Ubicación</small><div>${escapeHtml(asset.bodega_nombre || 'Sin bodega')} · ${escapeHtml(asset.ubicacion || 'Sin detalle')}</div></div><div class="col-sm-6"><small class="text-muted">Responsable</small><div>${escapeHtml(asset.responsable_nombre || 'Sin asignar')}</div></div>${attributes}</div><h4 class="h6">Asignaciones</h4><ul class="list-group list-group-flush mb-4">${assignments || '<li class="list-group-item text-muted">Sin historial de asignaciones.</li>'}</ul><h4 class="h6">Historial</h4><ul class="list-group list-group-flush">${events || '<li class="list-group-item text-muted">Sin eventos registrados.</li>'}</ul>`;
    assetDetailModal.show();
  } catch (error) {
    showError(error, 'No se pudo cargar la ficha del activo');
  }
}

function openAssignmentForm(asset) {
  byId('assignmentForm').reset();
  byId('assignmentAssetId').value = asset.id;
  byId('assignmentResponsible').value = asset.responsable_id || '';
  byId('assignmentWarehouse').value = asset.bodega_id || '';
  byId('assignmentLocation').value = asset.ubicacion || '';
  byId('assignmentReason').value = '';
  assignmentModal.show();
}

async function saveAssignment(event) {
  event.preventDefault();
  const assetId = byId('assignmentAssetId').value;
  try {
    await apiRequest(`/activos/${assetId}/asignaciones?${getCompanyQuery()}`, {
      method: 'POST',
      body: JSON.stringify({
        empresa_id: Number(activosEmpresaId),
        responsable_id: byId('assignmentResponsible').value || null,
        bodega_id: byId('assignmentWarehouse').value || null,
        ubicacion: byId('assignmentLocation').value.trim() || null,
        motivo: byId('assignmentReason').value.trim() || null
      })
    });
    assignmentModal.hide();
    showAlert('Asignación guardada en el historial del activo.');
    await loadInitialData();
  } catch (error) {
    showError(error, 'No se pudo asignar el activo');
  }
}

async function retireAsset(asset) {
  const confirmation = await Swal.fire({
    title: `Dar de baja ${asset.codigo}`,
    input: 'textarea',
    inputLabel: 'Motivo de baja',
    inputPlaceholder: 'Describe el motivo',
    inputValidator: (value) => value?.trim() ? undefined : 'El motivo es obligatorio',
    showCancelButton: true,
    confirmButtonText: 'Confirmar baja',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#b42318'
  });
  if (!confirmation.isConfirmed) return;
  try {
    await apiRequest(`/activos/${asset.id}/baja?${getCompanyQuery()}`, {
      method: 'POST', body: JSON.stringify({ empresa_id: Number(activosEmpresaId), motivo: confirmation.value.trim() })
    });
    showAlert('Activo dado de baja; el historial se conservó.');
    await loadInitialData();
  } catch (error) {
    showError(error, 'No se pudo dar de baja el activo');
  }
}

function openCategoryForm(category = null) {
  byId('categoryForm').reset();
  byId('categoryId').value = category?.id || '';
  byId('categoryName').value = category?.nombre || '';
  byId('categoryDescription').value = category?.descripcion || '';
  byId('categoryState').value = category?.estado || 'activa';
  byId('categoryModalTitle').textContent = category ? 'Editar categoría' : 'Nueva categoría';
  categoryModal.show();
}

async function saveCategory(event) {
  event.preventDefault();
  const categoryId = byId('categoryId').value;
  const payload = {
    empresa_id: Number(activosEmpresaId),
    nombre: byId('categoryName').value.trim(),
    descripcion: byId('categoryDescription').value.trim() || null,
    estado: byId('categoryState').value
  };
  try {
    await apiRequest(categoryId ? `/activos/categorias/${categoryId}?${getCompanyQuery()}` : `/activos/categorias?${getCompanyQuery()}`, {
      method: categoryId ? 'PUT' : 'POST', body: JSON.stringify(payload)
    });
    categoryModal.hide();
    await loadInitialData();
    showAlert(categoryId ? 'Categoría actualizada.' : 'Categoría creada.');
  } catch (error) {
    showError(error, 'No se pudo guardar la categoría');
  }
}

function openTypeForm(type = null) {
  byId('typeForm').reset();
  byId('typeId').value = type?.id || '';
  populateSelect(byId('typeCategory'), categoriasActivos.filter((item) => item.estado === 'activa').map((item) => ({ id: item.id, label: item.nombre })), 'Seleccione categoría', type?.categoria_id || '');
  byId('typeCategory').disabled = Boolean(type);
  byId('typeName').value = type?.nombre || '';
  byId('typeDescription').value = type?.descripcion || '';
  byId('typeState').value = type?.estado || 'activo';
  byId('typeModalTitle').textContent = type ? 'Editar tipo' : 'Nuevo tipo';
  typeModal.show();
}

async function saveType(event) {
  event.preventDefault();
  const typeId = byId('typeId').value;
  const existing = tiposActivos.find((type) => String(type.id) === typeId);
  const payload = {
    empresa_id: Number(activosEmpresaId),
    categoria_id: Number(existing?.categoria_id || byId('typeCategory').value),
    nombre: byId('typeName').value.trim(),
    descripcion: byId('typeDescription').value.trim() || null,
    estado: byId('typeState').value
  };
  try {
    await apiRequest(typeId ? `/activos/tipos/${typeId}?${getCompanyQuery()}` : `/activos/tipos?${getCompanyQuery()}`, {
      method: typeId ? 'PUT' : 'POST', body: JSON.stringify(payload)
    });
    typeModal.hide();
    await loadInitialData();
    showAlert(typeId ? 'Tipo actualizado.' : 'Tipo creado.');
  } catch (error) {
    showError(error, 'No se pudo guardar el tipo');
  }
}

function openAttributeForm(attribute = null) {
  if (!puedeAccion('activos_config', attribute ? 'edit' : 'create')) return;
  const typeId = byId('attributeTypeSelect').value;
  if (!typeId) return;
  byId('attributeForm').reset();
  byId('attributeId').value = attribute?.id || '';
  byId('attributeKey').value = attribute?.clave || '';
  byId('attributeKey').disabled = Boolean(attribute);
  byId('attributeLabel').value = attribute?.etiqueta || '';
  byId('attributeDataType').value = attribute?.tipo_dato || 'texto';
  byId('attributeOptions').value = parseOptions(attribute?.opciones_json).join('\n');
  byId('attributeUnit').value = attribute?.unidad || '';
  byId('attributeOrder').value = attribute?.orden ?? 0;
  byId('attributeRequired').checked = Number(attribute?.requerido) === 1;
  byId('attributeState').value = attribute?.estado || 'activo';
  byId('attributeOptionsWrap').classList.toggle('d-none', byId('attributeDataType').value !== 'opcion');
  byId('attributeModalTitle').textContent = attribute ? 'Editar atributo' : 'Nuevo atributo';
  attributeModal.show();
}

async function saveTypeAttribute(event) {
  event.preventDefault();
  const typeId = byId('attributeTypeSelect').value;
  const attributeId = byId('attributeId').value;
  const dataType = byId('attributeDataType').value;
  const payload = {
    empresa_id: Number(activosEmpresaId),
    clave: byId('attributeKey').value.trim().toLowerCase(),
    etiqueta: byId('attributeLabel').value.trim(),
    tipo_dato: dataType,
    unidad: byId('attributeUnit').value.trim() || null,
    orden: Number(byId('attributeOrder').value || 0),
    requerido: byId('attributeRequired').checked ? 1 : 0,
    estado: byId('attributeState').value,
    opciones: dataType === 'opcion' ? byId('attributeOptions').value.split('\n').map((option) => option.trim()).filter(Boolean) : null
  };
  try {
    await apiRequest(attributeId
      ? `/activos/tipos/${typeId}/atributos/${attributeId}?${getCompanyQuery()}`
      : `/activos/tipos/${typeId}/atributos?${getCompanyQuery()}`, {
      method: attributeId ? 'PUT' : 'POST', body: JSON.stringify(payload)
    });
    attributeModal.hide();
    await loadTypeAttributes(typeId);
    showAlert(attributeId ? 'Atributo actualizado.' : 'Atributo creado.');
  } catch (error) {
    showError(error, 'No se pudo guardar el atributo');
  }
}

async function toggleAttribute(attribute) {
  const typeId = byId('attributeTypeSelect').value;
  const nextState = attribute.estado === 'activo' ? 'inactivo' : 'activo';
  try {
    await apiRequest(`/activos/tipos/${typeId}/atributos/${attribute.id}?${getCompanyQuery()}`, {
      method: 'PUT', body: JSON.stringify({ empresa_id: Number(activosEmpresaId), estado: nextState })
    });
    await loadTypeAttributes(typeId);
  } catch (error) {
    showError(error, 'No se pudo cambiar el estado del atributo');
  }
}

async function toggleCategory(category) {
  const nextState = category.estado === 'activa' ? 'inactiva' : 'activa';
  try {
    await apiRequest(`/activos/categorias/${category.id}?${getCompanyQuery()}`, {
      method: 'PUT', body: JSON.stringify({ empresa_id: Number(activosEmpresaId), estado: nextState })
    });
    await loadInitialData();
  } catch (error) {
    showError(error, 'No se pudo cambiar el estado de la categoría');
  }
}

async function toggleType(type) {
  const nextState = type.estado === 'activo' ? 'inactivo' : 'activo';
  try {
    await apiRequest(`/activos/tipos/${type.id}?${getCompanyQuery()}`, {
      method: 'PUT', body: JSON.stringify({ empresa_id: Number(activosEmpresaId), estado: nextState })
    });
    await loadInitialData();
  } catch (error) {
    showError(error, 'No se pudo cambiar el estado del tipo');
  }
}

function handleTableActions(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const itemId = button.dataset.id;
  const action = button.dataset.action;
  if (action === 'details') loadAssetDetails(itemId);
  if (action === 'evidence') {
    const asset = activosData.find((item) => String(item.id) === itemId);
    if (asset) PrivateEvidence.open('activo', asset.id, `${asset.codigo} · ${asset.nombre}`, puedeAccion('activos', 'edit'));
  }
  if (action === 'assign') {
    const asset = activosData.find((item) => String(item.id) === itemId);
    if (asset) openAssignmentForm(asset);
  }
  if (action === 'edit') {
    const asset = activosData.find((item) => String(item.id) === itemId);
    if (asset) editAsset(asset);
  }
  if (action === 'retire') {
    const asset = activosData.find((item) => String(item.id) === itemId);
    if (asset) retireAsset(asset);
  }
  if (action === 'edit-category') {
    const category = categoriasActivos.find((item) => String(item.id) === itemId);
    if (category) openCategoryForm(category);
  }
  if (action === 'toggle-category') {
    const category = categoriasActivos.find((item) => String(item.id) === itemId);
    if (category) toggleCategory(category);
  }
  if (action === 'edit-type') {
    const type = tiposActivos.find((item) => String(item.id) === itemId);
    if (type) openTypeForm(type);
  }
  if (action === 'toggle-type') {
    const type = tiposActivos.find((item) => String(item.id) === itemId);
    if (type) toggleType(type);
  }
  if (action === 'edit-attribute') {
    const attribute = atributosTipo.find((item) => String(item.id) === itemId);
    if (attribute) openAttributeForm(attribute);
  }
  if (action === 'toggle-attribute') {
    const attribute = atributosTipo.find((item) => String(item.id) === itemId);
    if (attribute) toggleAttribute(attribute);
  }
}

function setupEvents() {
  byId('assetForm').addEventListener('submit', saveAsset);
  byId('assetImageFile').addEventListener('change', (event) => {
    const file = event.target.files[0];
    byId('assetImageUploadStatus').textContent = file
      ? `${file.name} se comprimirá y quedará públicamente accesible al subir a S3/CloudFront.`
      : 'URL manual o carga pública en S3/CloudFront; no adjuntes evidencia sensible.';
  });
  byId('categoryForm').addEventListener('submit', saveCategory);
  byId('typeForm').addEventListener('submit', saveType);
  byId('attributeForm').addEventListener('submit', saveTypeAttribute);
  byId('assignmentForm').addEventListener('submit', saveAssignment);
  byId('newAssetButton').addEventListener('click', openNewAsset);
  byId('assetSetupButton').addEventListener('click', () => {
    if (!puedeConfigurarActivos) return;
    assetModal.hide();
    bootstrap.Tab.getOrCreateInstance(byId('setupTab')).show();
  });
  byId('exportAssetsButton').addEventListener('click', exportAssets);
  byId('newCategoryButton').addEventListener('click', () => openCategoryForm());
  byId('newTypeButton').addEventListener('click', () => openTypeForm());
  byId('assetsTableBody').addEventListener('click', handleTableActions);
  byId('categoriesList').addEventListener('click', handleTableActions);
  byId('typesTableBody').addEventListener('click', handleTableActions);
  byId('attributesTableBody').addEventListener('click', handleTableActions);
  byId('assetCategory').addEventListener('change', () => {
    byId('assetType').disabled = !byId('assetCategory').value;
    populateAssetSelects(byId('assetCategory').value);
    loadAssetAttributes(byId('assetType').value);
  });
  byId('assetType').addEventListener('change', () => loadAssetAttributes(byId('assetType').value));
  byId('attributeTypeSelect').addEventListener('change', (event) => {
    byId('newAttributeButton').disabled = !event.target.value;
    loadTypeAttributes(event.target.value);
  });
  byId('newAttributeButton').addEventListener('click', () => openAttributeForm());
  byId('attributeDataType').addEventListener('change', (event) => {
    byId('attributeOptionsWrap').classList.toggle('d-none', event.target.value !== 'opcion');
  });
  byId('assetSearch').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderAssets, 150);
  });
  byId('assetCategoryFilter').addEventListener('change', renderAssets);
  byId('assetStateFilter').addEventListener('change', renderAssets);
  window.addEventListener('empresaCambiada', (event) => {
    activosEmpresaId = String(event.detail.empresaId);
    loadInitialData();
  });
  byId('logoutBtn').addEventListener('click', (event) => {
    event.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('empresaActiva');
    window.location.href = 'login.html';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  activosUsuario = JSON.parse(localStorage.getItem('usuario') || 'null');
  if (!activosUsuario) {
    window.location.href = 'login.html';
    return;
  }
  renderUser();
  assetModal = new bootstrap.Modal(byId('assetModal'));
  categoryModal = new bootstrap.Modal(byId('categoryModal'));
  typeModal = new bootstrap.Modal(byId('typeModal'));
  attributeModal = new bootstrap.Modal(byId('attributeModal'));
  assignmentModal = new bootstrap.Modal(byId('assignmentModal'));
  assetDetailModal = new bootstrap.Modal(byId('assetDetailModal'));
  setupEvents();
  activosEmpresaId = localStorage.getItem('empresaActiva');
  if (activosEmpresaId) loadInitialData();
  else setTimeout(() => {
    activosEmpresaId = localStorage.getItem('empresaActiva');
    if (activosEmpresaId) loadInitialData();
  }, 600);
});
