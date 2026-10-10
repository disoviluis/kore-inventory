(async function () {
  'use strict';
  let users = [];
  const modal = new bootstrap.Modal(document.getElementById('inviteModal'));
  function alert(text, error = false) { const element = document.getElementById('adminAccessAlert'); element.className = `alert alert-${error ? 'danger' : 'success'}`; element.textContent = text; }
  async function api(path, body, method = 'POST') {
    const response = await fetch(`/api/${path}`, body === undefined ? {} : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'No se pudo completar la operacion'); return data;
  }
  function cell(row, text) { const column = document.createElement('td'); column.textContent = text; row.append(column); return column; }
  function action(parent, icon, title, callback) { const button = document.createElement('button'); button.className = 'btn btn-sm btn-outline-secondary me-1'; button.title = title; button.setAttribute('aria-label', title); button.innerHTML = `<i class="bi ${icon}"></i>`; button.onclick = async () => { button.disabled = true; try { await callback(); } catch (error) { alert(error.message, true); } finally { button.disabled = false; } }; parent.append(button); }
  async function loadRoles() {
    const selector = document.getElementById('inviteRole'); selector.replaceChildren(new Option('Sin rol adicional', ''));
    const companyId = document.getElementById('inviteCompany').value;
    if (!companyId) return;
    const data = await api(`roles?empresa_id=${companyId}`);
    for (const role of data.data || []) selector.add(new Option(role.nombre, role.id));
  }
  function openInvite(user) {
    document.getElementById('inviteUserForm').reset();
    document.getElementById('inviteUserId').value = user?.id || '';
    document.getElementById('newUserFields').classList.toggle('d-none', Boolean(user));
    document.getElementById('inviteName').required = !user;
    document.getElementById('inviteCompany').required = !user;
    document.getElementById('inviteEmail').value = user?.correo_pendiente || user?.email || '';
    document.getElementById('blockInviteField').classList.toggle('d-none', !user || user.tipo_usuario === 'super_admin');
    document.getElementById('samePersonField').classList.toggle('d-none', !user);
    document.getElementById('samePersonConfirmed').required = Boolean(user);
    document.getElementById('inviteTitle').textContent = user ? `Verificar cuenta #${user.id}` : 'Invitar usuario nuevo';
    document.getElementById('inviteResult').textContent = '';
    modal.show(); if (!user) loadRoles().catch(error => alert(error.message, true));
  }
  function renderUsers() {
    const table = document.getElementById('migrationUsers'); table.replaceChildren();
    const search = document.getElementById('migrationSearch').value.toLowerCase();
    const filtered = users.filter(user => `${user.nombre} ${user.apellido || ''} ${user.email} ${user.correo_pendiente || ''}`.toLowerCase().includes(search));
    document.getElementById('migrationCounts').textContent = `${users.length} cuentas | ${users.filter(user => user.estado === 'verificado').length} verificadas | ${users.filter(user => user.estado === 'legado').length} pendientes de migrar`;
    for (const user of filtered) {
      const row = document.createElement('tr'); cell(row, `${user.nombre} ${user.apellido || ''} (#${user.id})`); cell(row, user.email); cell(row, user.empresas || '-');
      cell(row, `${user.estado}${user.correo_pendiente ? ' | ' + user.correo_pendiente : ''}`); cell(row, user.mfa_activo ? 'Activo' : 'Pendiente'); cell(row, user.activo ? 'Habilitado' : 'Desactivado'); const actions = cell(row, '');
      if (user.activo && user.estado !== 'suspendido') action(actions, 'bi-envelope-check', 'Invitar o reenviar verificacion', () => openInvite(user));
      if (user.tipo_usuario !== 'super_admin' && user.activo) action(actions, 'bi-person-x', 'Desactivar acceso conservando historial', async () => {
        if (!confirm(`Desactivar el acceso de ${user.email} sin borrar historial?`)) return;
        const data = await api(`super-admin/usuarios/${user.id}`, {}, 'DELETE'); alert(data.message); await loadUsers();
      });
      if (!user.activo || user.estado === 'suspendido') action(actions, 'bi-person-check', 'Preparar reactivacion con verificacion', async () => {
        if (!confirm('Preparar esta cuenta para una nueva invitacion?')) return;
        const data = await api(`super-admin/usuarios/${user.id}/reactivar`, {}); alert(data.message); await loadUsers();
      });
      table.append(row);
    }
  }
  async function loadUsers() {
    const data = await api(`super-admin/accesos?empresa_id=${document.getElementById('migrationCompany').value}`);
    users = data.data; renderUsers(); if (!data.correo_configurado) alert('Correo de acceso pendiente de configuracion; no se pueden enviar invitaciones.', true);
  }
  async function loadPayments() {
    const data = await api('super-admin/solicitudes-suscripcion'); const table = document.getElementById('pendingPayments'); table.replaceChildren();
    for (const request of data.data) {
      const row = document.createElement('tr'); cell(row, `#${request.id}`); cell(row, request.empresa_nombre); cell(row, `${request.plan_nombre} | ${request.periodicidad}`);
      cell(row, Number(request.monto).toLocaleString('es-CO')); cell(row, request.estado); const actions = cell(row, '');
      if (request.estado === 'pendiente') {
        action(actions, 'bi-check-circle', 'Confirmar pago recibido', async () => {
          const reference = prompt('Referencia REAL del pago recibido (banco o comprobante):'); if (!reference) return;
          const amount = prompt('Monto recibido en COP, sin separadores:', String(request.monto)); if (amount === null) return;
          if (!confirm(`Confirma que recibio ${amount} COP y autoriza la licencia de ${request.empresa_nombre}?`)) return;
          const result = await api(`super-admin/solicitudes-suscripcion/${request.id}/aprobar`, { referencia: reference, monto_recibido: Number(amount), pago_confirmado: true }); alert(result.message); await loadPayments();
        });
        action(actions, 'bi-x-circle', 'Rechazar solicitud', async () => { const reason = prompt('Motivo del rechazo:'); if (!reason) return; await api(`super-admin/solicitudes-suscripcion/${request.id}/rechazar`, { motivo: reason }); await loadPayments(); });
      }
      table.append(row);
    }
  }
  async function loadLegalVersions() {
    const data = await api('super-admin/documentos-legales'); const container = document.getElementById('legalVersions'); container.replaceChildren();
    for (const documentData of data.data) { const text = document.createElement('p'); text.textContent = `${documentData.tipo} | ${documentData.version} | ${documentData.titulo}`; container.append(text); }
  }
  try {
    const session = await api('auth/verify');
    if (session.data.usuario.tipo_usuario !== 'super_admin') throw new Error('Este modulo esta reservado a Super Admin');
    const companies = await api('super-admin/empresas?limit=500');
    for (const company of companies.data) {
      document.getElementById('migrationCompany').add(new Option(company.nombre, company.id));
      document.getElementById('inviteCompany').add(new Option(company.nombre, company.id));
    }
    document.getElementById('migrationCompany').onchange = () => loadUsers().catch(error => alert(error.message, true));
    document.getElementById('migrationSearch').oninput = renderUsers;
    document.getElementById('newInvitationButton').onclick = () => openInvite();
    document.getElementById('inviteCompany').onchange = () => loadRoles().catch(error => alert(error.message, true));
    document.getElementById('inviteUserForm').addEventListener('submit', async event => {
      event.preventDefault(); const button = event.currentTarget.querySelector('button[type=submit]'); button.disabled = true;
      try {
        const id = document.getElementById('inviteUserId').value; const roleId = Number(document.getElementById('inviteRole').value);
        const body = { email: document.getElementById('inviteEmail').value.trim(), bloquear_hasta_verificar: document.getElementById('blockUntilVerified').checked,
          misma_persona_confirmada: document.getElementById('samePersonConfirmed').checked };
        if (!id) Object.assign(body, { nombre: document.getElementById('inviteName').value, apellido: document.getElementById('inviteLastName').value,
          empresa_id: Number(document.getElementById('inviteCompany').value), tipo_usuario: document.getElementById('inviteType').value, roles_ids: roleId ? [roleId] : [] });
        const result = await api(id ? `super-admin/usuarios/${id}/invitacion` : 'super-admin/usuarios', body);
        document.getElementById('inviteResult').textContent = result.message; await loadUsers();
      } catch (error) { document.getElementById('inviteResult').textContent = error.message; } finally { button.disabled = false; }
    });
    document.getElementById('loadPreparedLegal').addEventListener('click', async event => {
      const button = event.currentTarget; button.disabled = true;
      try {
        const type = document.getElementById('legalType').value;
        const filename = type === 'privacidad' ? 'privacidad-v2.1.2.txt' : 'terminos-v2.1.2.txt';
        const response = await fetch(`assets/legal/${filename}`);
        if (!response.ok) throw new Error('No se pudo cargar el documento preparado.');
        const paragraphs = (await response.text()).trim().split(/\r?\n\s*\r?\n/);
        document.getElementById('legalVersion').value = '2.1.2';
        document.getElementById('legalTitle').value = type === 'privacidad' ? 'Política de Tratamiento de Datos Personales de Kore Inventory' : 'Términos y condiciones del servicio Kore Inventory';
        document.getElementById('operatorName').value = 'DISOVI SOFT SERVICES';
        document.getElementById('operatorNit').value = '79648599-9';
        document.getElementById('operatorContact').value = 'soporte.disovi@kinventoryservices.com';
        document.getElementById('legalContent').value = paragraphs.slice(2).join('\n\n');
        document.getElementById('legalReviewed').checked = false;
      } catch (error) { alert(error.message, true); }
      finally { button.disabled = false; }
    });
    document.getElementById('legalPublishForm').addEventListener('submit', async event => {
      event.preventDefault(); if (!confirm('Publicar esta version inmutable y solicitar su aceptacion a las cuentas verificadas?')) return;
      const button = event.currentTarget.querySelector('button[type=submit]'); button.disabled = true;
      try {
        const result = await api('super-admin/documentos-legales', { tipo: document.getElementById('legalType').value, version: document.getElementById('legalVersion').value,
          titulo: document.getElementById('legalTitle').value, contenido: document.getElementById('legalContent').value,
          operador_nombre: document.getElementById('operatorName').value, operador_nit: document.getElementById('operatorNit').value,
          operador_contacto: document.getElementById('operatorContact').value, revision_legal_confirmada: document.getElementById('legalReviewed').checked });
        alert(result.message); await loadLegalVersions();
      } catch (error) { alert(error.message, true); } finally { button.disabled = false; }
    });
    await loadUsers(); await loadPayments(); await loadLegalVersions();
  } catch (error) { alert(error.message, true); }
})();