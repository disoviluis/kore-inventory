(async function () {
  'use strict';
  const page = document.body.dataset.accessPage;
  const status = document.getElementById('accessStatus');
  let documents = [];
  function message(text, error = false) {
    status.className = `alert ${error ? 'alert-danger' : 'alert-success'}`;
    status.textContent = text;
  }
  async function api(path, body) {
    const response = await fetch(`/api/${path}`, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'No se pudo completar la operacion');
    return data.data;
  }
  function legalChecks(accepted = []) {
    const container = document.getElementById('legalChecks');
    container.replaceChildren();
    for (const documentData of documents) {
      const row = document.createElement('div'); row.className = 'form-check mb-2';
      const input = document.createElement('input'); input.type = 'checkbox'; input.className = 'form-check-input';
      input.id = `legal-${documentData.id}`; input.required = true; input.checked = accepted.includes(documentData.id);
      const label = document.createElement('label'); label.className = 'form-check-label'; label.htmlFor = input.id;
      label.append('Acepto ');
      const link = document.createElement('a'); link.href = `documentos-legales.html?tipo=${encodeURIComponent(documentData.tipo)}`;
      link.target = '_blank'; link.rel = 'noopener'; link.textContent = `${documentData.titulo} (${documentData.version})`;
      label.append(link); row.append(input, label); container.append(row);
    }
    if (documents.length < 2) { message('Los documentos legales aun no estan publicados. Contacte al administrador.', true); }
  }
  const acceptance = () => documents.filter(documentData => document.getElementById(`legal-${documentData.id}`)?.checked)
    .map(documentData => ({ id: documentData.id, hash: documentData.hash }));
  function bindForm(id, callback) {
    document.getElementById(id)?.addEventListener('submit', async event => {
      event.preventDefault(); const button = event.currentTarget.querySelector('button[type=submit], button:not([type])');
      button.disabled = true;
      try { await callback(); } catch (error) { message(error.message, true); }
      finally { button.disabled = false; }
    });
  }
  try {
    if (page === 'activation') {
      const token = location.hash.slice(1); history.replaceState(null, '', location.pathname);
      if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Abra el enlace completo de su correo de invitacion.');
      const info = await api('auth/invitacion', { token });
      document.getElementById('accountEmail').textContent = info.email;
      documents = await api('public/documentos-legales'); legalChecks();
      document.getElementById('activationForm').classList.remove('d-none');
      document.getElementById('resendCode').addEventListener('click', async event => {
        event.currentTarget.disabled = true;
        try { await api('auth/reenviar-codigo', { token }); message('Se envio otro codigo.'); }
        catch (error) { message(error.message, true); }
        finally { document.getElementById('resendCode').disabled = false; }
      });
      bindForm('activationForm', async () => {
        const password = document.getElementById('newPassword').value;
        if (password !== document.getElementById('confirmPassword').value) throw new Error('Las contrasenas no coinciden');
        if (new TextEncoder().encode(password).length > 72) throw new Error('La contrasena supera 72 bytes');
        await api('auth/confirmar-cuenta', { token, codigo: document.getElementById('accessCode').value.trim(), password,
          codigo_mfa: document.getElementById('activationMfa').value.trim(), aceptaciones: acceptance() });
        document.getElementById('activationForm').classList.add('d-none');
        message('Cuenta confirmada. Puede iniciar sesion con su correo verificado.');
        const link = document.createElement('a'); link.href = 'login.html'; link.textContent = 'Iniciar sesion'; status.after(link);
      });
    } else if (page === 'security') {
      const data = await api('auth/seguridad'); documents = data.documentos;
      document.getElementById('accountEmail').textContent = `${data.usuario.email} | ${data.usuario.estado_verificacion}`;
      legalChecks(data.aceptados);
      document.getElementById('mfaState').textContent = data.usuario.mfa_activo ? 'Autenticador activo' : 'Autenticador pendiente';
      document.getElementById('prepareMfaForm').classList.toggle('d-none', Boolean(data.usuario.mfa_activo));
      document.getElementById('resetMfaForm').classList.toggle('d-none', !data.usuario.mfa_activo);
      if (data.usuario.requiere_seguridad) document.getElementById('securityContinue').classList.add('d-none');
      bindForm('acceptLegalForm', async () => { await api('auth/aceptar-documentos', { aceptaciones: acceptance() }); location.reload(); });
      bindForm('prepareMfaForm', async () => {
        const data = await api('auth/mfa/preparar', { password: document.getElementById('mfaPassword').value });
        document.getElementById('mfaPassword').value = '';
        document.getElementById('mfaQr').src = data.qr; document.getElementById('mfaManualSecret').textContent = data.secret;
        document.getElementById('confirmMfaForm').classList.remove('d-none');
      });
      bindForm('confirmMfaForm', async () => {
        const data = await api('auth/mfa/confirmar', { codigo: document.getElementById('mfaCode').value });
        localStorage.removeItem('token');
        document.getElementById('confirmMfaForm').classList.add('d-none');
        document.getElementById('mfaManualSecret').textContent = '';
        document.getElementById('mfaQr').removeAttribute('src');
        document.getElementById('mfaBackupCodes').textContent = data.codigos_respaldo.join('\n');
        document.getElementById('mfaBackup').classList.remove('d-none');
        document.getElementById('downloadMfaBackup').onclick = () => {
          const url = URL.createObjectURL(new Blob([data.codigos_respaldo.join('\n')], { type: 'text/plain' }));
          const link = document.createElement('a'); link.href = url; link.download = 'kore-codigos-respaldo.txt'; link.click(); URL.revokeObjectURL(url);
        };
        message('MFA activado. Los codigos de respaldo solo se muestran en esta ocasion.');
      });
      bindForm('resetMfaForm', async () => {
        if (!confirm('Cambiar su autenticador y cerrar las sesiones actuales?')) return;
        await api('auth/mfa/reconfigurar', { password: document.getElementById('resetMfaPassword').value, codigo: document.getElementById('resetMfaCode').value });
        localStorage.removeItem('token'); location.href = 'login.html';
      });
      document.getElementById('revokeSessions').addEventListener('click', async () => {
        try { await api('auth/seguridad/revocar-sesiones', {}); localStorage.removeItem('token'); location.href = 'login.html'; }
        catch (error) { message(error.message, true); }
      });
      document.getElementById('securityLogout').addEventListener('click', async event => {
        event.preventDefault(); await api('auth/logout', {}); localStorage.removeItem('token'); location.href = 'login.html';
      });
    } else if (page === 'request') {
      documents = await api('public/documentos-legales');
      const contact = documents.find(entry => entry.tipo === 'terminos')?.operador_contacto;
      if (!contact || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) throw new Error('Las altas estan bajo aprobacion del administrador. Contacte al responsable que le proporciono acceso a su empresa.');
      const link = document.createElement('a'); link.className = 'btn btn-primary'; link.href = `mailto:${encodeURIComponent(contact)}?subject=Solicitud%20de%20acceso%20a%20Kore%20Inventory`; link.textContent = 'Contactar al administrador';
      document.getElementById('accessContact').append(link);
    } else {
      documents = await api('public/documentos-legales');
      const type = new URLSearchParams(location.search).get('tipo') || 'terminos';
      const documentData = documents.find(entry => entry.tipo === type);
      if (!documentData) {
        const draft = await fetch(`assets/legal/${type === 'privacidad' ? 'privacidad' : 'terminos'}-pruebas.txt`);
        if (!draft.ok) throw new Error('Este documento aun no ha sido publicado.');
        document.getElementById('legalDocument').textContent = await draft.text();
        message('Base informativa de pruebas. La version contractual definitiva sigue pendiente de aprobacion.', true);
        return;
      }
      document.getElementById('legalDocument').textContent = `${documentData.titulo}\nVersion: ${documentData.version}\nOperador: ${documentData.operador_nombre}\nNIT: ${documentData.operador_nit}\nContacto: ${documentData.operador_contacto}\n\n${documentData.contenido}`;
    }
  } catch (error) { message(error.message, true); }
})();