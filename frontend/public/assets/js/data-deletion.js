(function () {
  'use strict';

  const api = '/api';
  const user = JSON.parse(localStorage.getItem('usuario') || 'null');
  const isPlatformAdmin = user?.tipo_usuario === 'super_admin';
  const moduleCatalog = {
    ventas_pos: 'Ventas y POS',
    inventario: 'Inventario y traslados',
    compras_terceros: 'Compras y terceros',
    activos_mantenimiento: 'Activos y mantenimiento',
    finanzas: 'Finanzas, cartera y bancos',
    contabilidad: 'Contabilidad e impuestos',
    nomina: 'Nomina',
    configuracion: 'Configuracion y reportes'
  };
  const protectedForTermination = new Set(['ventas_pos', 'inventario', 'compras_terceros', 'finanzas', 'contabilidad', 'nomina']);
  let companies = [];
  let requests = [];
  let modules = {};
  let currentCompanyId = '';

  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  async function request(path, options = {}) {
    const response = await fetch(`${api}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) throw new Error(result.message || 'No se pudo completar la solicitud');
    return result;
  }

  function showAlert(message, type = 'info') {
    byId('pageAlert').innerHTML = `<div class="alert alert-${type}" role="alert">${escapeHtml(message)}</div>`;
  }

  function mailFeedback(notification) {
    if (!notification) return '';
    if (Number(notification.enviados) > 0) return ` Correo enviado a ${notification.enviados} administrador(es) de la empresa.`;
    if (notification.correo_configurado) return ' La solicitud quedó registrada, pero no se pudo entregar el correo; Super Admin debe verificar la notificación.';
    return ' La solicitud quedó registrada, pero el correo de la plataforma no está configurado.';
  }

  function selectedModules() {
    return [...document.querySelectorAll('#moduleOptions input:checked')].map(input => input.value);
  }

  function renderModules() {
    const type = byId('requestType').value;
    const synthetic = type === 'restablecimiento_pruebas';
    byId('syntheticDataField').classList.toggle('d-none', !synthetic);
    byId('syntheticDataConfirmed').required = synthetic;
    byId('syntheticDataConfirmed').checked = false;
    byId('scopeWarning').textContent = synthetic
      ? 'Esta operacion elimina los registros de los modulos seleccionados; conserva la empresa, sus usuarios, licencias y auditoria. Solo debe usarse para datos de prueba.'
      : 'La terminacion conserva ventas, compras, finanzas, contabilidad y nomina. No equivale a eliminar la cuenta ni los datos sujetos a retencion.';
    byId('moduleOptions').innerHTML = Object.entries(modules).map(([key, value]) => {
      const label = typeof value === 'string' ? value : value.label;
      const disabled = !synthetic && protectedForTermination.has(key);
      return `<label class="deletion-module-option${disabled ? ' text-muted' : ''}">
        <input type="checkbox" value="${escapeHtml(key)}" ${disabled ? 'disabled' : 'checked'}>
        <span>${escapeHtml(label || moduleCatalog[key] || key)}</span>
      </label>`;
    }).join('');
  }

  async function loadCompanies() {
    const select = byId('requestCompany');
    if (isPlatformAdmin) {
      const result = await request('/super-admin/empresas?limit=500');
      companies = result.data || [];
    } else {
      if (!user?.id) throw new Error('Inicia sesion para continuar.');
      const result = await request(`/empresas/usuario/${encodeURIComponent(user.id)}`);
      companies = result.data || [];
    }
    if (!companies.length) throw new Error('No hay empresas disponibles para este usuario.');
    select.innerHTML = companies.map(company => `<option value="${escapeHtml(company.id)}">${escapeHtml(company.nombre)}</option>`).join('');
    const stored = localStorage.getItem('empresaActiva');
    const requested = new URLSearchParams(location.search).get('empresa_id');
    const preferred = companies.find(company => String(company.id) === String(requested))
      || companies.find(company => String(company.id) === String(stored));
    select.value = String(preferred?.id || companies[0].id);
    currentCompanyId = select.value;
    if (!isPlatformAdmin) select.parentElement.classList.toggle('d-none', companies.length === 1);
  }

  function parseModules(value) {
    try { return Array.isArray(value) ? value : JSON.parse(value || '[]'); }
    catch { return []; }
  }

  function statusLabel(status) {
    return ({
      pendiente_empresa: 'Pendiente de empresa',
      pendiente_super_admin: 'Pendiente de Super Admin',
      aprobada: 'Aprobada', ejecutando: 'En ejecucion', completada: 'Completada',
      rechazada: 'Rechazada', fallida: 'Fallida'
    })[status] || status;
  }

  function requestActions(item) {
    const actions = [];
    if (!isPlatformAdmin && item.origen === 'super_admin' && item.estado === 'pendiente_empresa') {
      actions.push(`<button class="btn btn-sm btn-success" data-action="aprobar-empresa" data-id="${item.id}">Aprobar</button>`);
      actions.push(`<button class="btn btn-sm btn-outline-danger" data-action="rechazar-empresa" data-id="${item.id}">Rechazar</button>`);
    }
    if (isPlatformAdmin && item.origen === 'empresa' && item.estado === 'pendiente_super_admin') {
      actions.push(`<button class="btn btn-sm btn-success" data-action="revisar-aprobar" data-id="${item.id}">Aprobar</button>`);
      actions.push(`<button class="btn btn-sm btn-outline-danger" data-action="revisar-rechazar" data-id="${item.id}">Rechazar</button>`);
    }
    if (isPlatformAdmin && item.estado === 'aprobada' && !item.revisada_por) {
      actions.push(`<button class="btn btn-sm btn-success" data-action="revisar-aprobar" data-id="${item.id}">Revisar y aprobar</button>`);
      actions.push(`<button class="btn btn-sm btn-outline-danger" data-action="revisar-rechazar" data-id="${item.id}">Rechazar</button>`);
    }
    if (isPlatformAdmin && item.estado === 'aprobada' && item.revisada_por && item.aprobada_empresa_por) {
      actions.push(`<button class="btn btn-sm btn-danger" data-action="ejecutar" data-id="${item.id}">Ejecutar</button>`);
    }
    if (item.certificado) actions.push(`<button class="btn btn-sm btn-outline-primary" data-action="certificado" data-id="${item.id}">Constancia</button>`);
    return actions.join(' ') || '<span class="text-muted">Sin acciones</span>';
  }

  function renderRequests() {
    const tbody = byId('requestsTable');
    if (!requests.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-muted">No hay solicitudes registradas.</td></tr>';
      return;
    }
    tbody.innerHTML = requests.map(item => {
      const company = companies.find(entry => String(entry.id) === String(item.empresa_id));
      const modulesList = parseModules(item.modulos).map(key => modules[key]?.label || modules[key] || moduleCatalog[key] || key);
      const companyName = item.empresa_nombre || company?.nombre || `Empresa #${item.empresa_id}`;
      return `<tr>
        <td>${escapeHtml(item.id)}</td><td>${escapeHtml(companyName)}</td>
        <td>${item.tipo === 'restablecimiento_pruebas' ? 'Restablecimiento de pruebas' : 'Terminacion'}</td>
        <td>${escapeHtml(item.created_at ? new Date(item.created_at).toLocaleString() : '-')}</td>
        <td>${escapeHtml(modulesList.join(', '))}</td>
        <td><span class="badge text-bg-${item.estado === 'completada' ? 'success' : item.estado === 'rechazada' ? 'secondary' : 'warning'}">${escapeHtml(statusLabel(item.estado))}</span></td>
        <td><div class="d-flex flex-wrap gap-1">${requestActions(item)}</div></td>
      </tr>`;
    }).join('');
  }

  async function loadRequests() {
    byId('requestsTable').innerHTML = '<tr><td colspan="7" class="text-muted">Cargando solicitudes...</td></tr>';
    const result = isPlatformAdmin
      ? await request('/super-admin/solicitudes-borrado-datos')
      : await request(`/empresas/${encodeURIComponent(currentCompanyId)}/solicitudes-borrado`);
    requests = result.data || [];
    if (result.modulos) modules = result.modulos;
    byId('requestsHeading').textContent = isPlatformAdmin ? 'Solicitudes de todas las empresas' : 'Solicitudes de la empresa';
    renderModules();
    renderRequests();
  }

  async function submitRequest(event) {
    event.preventDefault();
    const type = byId('requestType').value;
    const payload = {
      tipo: type,
      modulos: selectedModules(),
      motivo: byId('requestReason').value.trim(),
      confirmo_datos_sinteticos: type === 'restablecimiento_pruebas' && byId('syntheticDataConfirmed').checked
    };
    if (!payload.modulos.length) return showAlert('Selecciona al menos un modulo.', 'warning');
    if (isPlatformAdmin) payload.empresa_id = Number(currentCompanyId);
    byId('submitRequest').disabled = true;
    try {
      const result = isPlatformAdmin
        ? await request('/super-admin/solicitudes-borrado-datos', { method: 'POST', body: payload })
        : await request(`/empresas/${encodeURIComponent(currentCompanyId)}/solicitudes-borrado`, { method: 'POST', body: payload });
      showAlert(result.message + mailFeedback(result.data?.aviso_correo), 'success');
      byId('requestForm').reset();
      renderModules();
      await loadRequests();
    } catch (error) { showAlert(error.message, 'danger'); }
    finally { byId('submitRequest').disabled = false; }
  }

  async function handleAction(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const id = button.dataset.id;
    const item = requests.find(entry => String(entry.id) === String(id));
    if (!item) return;
    button.disabled = true;
    try {
      if (button.dataset.action === 'certificado') {
        const path = isPlatformAdmin
          ? `/super-admin/solicitudes-borrado-datos/${id}/certificado`
          : `/empresas/${encodeURIComponent(currentCompanyId)}/solicitudes-borrado/${id}/certificado`;
        const result = await request(path);
        showCertificate(result.data);
        return;
      }
      if (button.dataset.action === 'ejecutar') {
        const backup = window.prompt('Referencia del respaldo previo verificado:');
        if (!backup?.trim()) return;
        if (window.prompt('Esta accion elimina datos de forma irreversible. Escriba BORRAR para continuar:') !== 'BORRAR') return;
        await request(`/super-admin/solicitudes-borrado-datos/${id}/ejecutar`, { method: 'POST', body: { respaldo_referencia: backup.trim() } });
        showAlert('Operacion completada y constancia emitida.', 'success');
      } else if (button.dataset.action === 'aprobar-empresa' || button.dataset.action === 'rechazar-empresa') {
        const decision = button.dataset.action === 'aprobar-empresa' ? 'aprobar' : 'rechazar';
        const motivo = decision === 'rechazar' ? window.prompt('Motivo del rechazo (opcional):') || '' : '';
        await request(`/empresas/${encodeURIComponent(currentCompanyId)}/solicitudes-borrado/${id}/${decision}`, { method: 'POST', body: { motivo } });
        showAlert(decision === 'aprobar' ? 'Aprobacion registrada. Super Admin debe revisar y ejecutar por separado.' : 'Solicitud rechazada.', 'success');
      } else {
        const decision = button.dataset.action === 'revisar-aprobar' ? 'aprobar' : 'rechazar';
        const motivo = decision === 'rechazar' ? window.prompt('Motivo del rechazo (opcional):') || '' : '';
        await request(`/super-admin/solicitudes-borrado-datos/${id}/${decision}`, { method: 'POST', body: { motivo } });
        showAlert(decision === 'aprobar' ? 'Revision registrada. La ejecucion requiere una accion separada.' : 'Solicitud rechazada.', 'success');
      }
      await loadRequests();
    } catch (error) { showAlert(error.message, 'danger'); }
    finally { button.disabled = false; }
  }

  function showCertificate(data) {
    const certificate = typeof data.certificado === 'string' ? JSON.parse(data.certificado) : data.certificado;
    byId('requestPage').classList.add('d-none');
    byId('certificateContent').classList.remove('d-none');
    byId('certificateHash').textContent = `SHA-256: ${data.certificado_sha256 || ''}`;
    byId('certificateBackupNotice').textContent = certificate.aviso_respaldos || '';
    byId('certificateFields').innerHTML = Object.entries(certificate).map(([key, value]) =>
      `<div class="row border-bottom py-2"><dt class="col-sm-4">${escapeHtml(key.replaceAll('_', ' '))}</dt><dd class="col-sm-8 mb-0">${escapeHtml(Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : value)}</dd></div>`
    ).join('');
  }

  async function initialize() {
    if (!user || (!isPlatformAdmin && user.tipo_usuario !== 'admin_empresa')) {
      showAlert('Esta pagina esta disponible para Super Admin y administradores de empresa.', 'danger');
      byId('requestSection').classList.add('d-none');
      return;
    }
    if (!isPlatformAdmin && new URLSearchParams(location.search).has('solicitud_id')) {
      const companyId = new URLSearchParams(location.search).get('empresa_id');
      if (companyId) currentCompanyId = companyId;
    }
    byId('requestType').addEventListener('change', renderModules);
    byId('requestForm').addEventListener('submit', submitRequest);
    byId('requestsTable').addEventListener('click', handleAction);
    byId('refreshRequests').addEventListener('click', () => loadRequests().catch(error => showAlert(error.message, 'danger')));
    byId('requestCompany').addEventListener('change', async event => {
      currentCompanyId = event.target.value;
      if (isPlatformAdmin) return;
      localStorage.setItem('empresaActiva', currentCompanyId);
      try { await loadRequests(); } catch (error) { showAlert(error.message, 'danger'); }
    });
    byId('closeCertificate').addEventListener('click', () => {
      byId('certificateContent').classList.add('d-none');
      byId('requestPage').classList.remove('d-none');
    });
    try {
      modules = moduleCatalog;
      await loadCompanies();
      await loadRequests();
    } catch (error) { showAlert(error.message, 'danger'); }
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();