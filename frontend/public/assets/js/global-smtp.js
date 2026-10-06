(function () {
  'use strict';
  const endpoint = '/api/super-admin/configuracion/smtp';
  let saved = null;
  let dirty = false;
  let loading = false;
  const element = id => document.getElementById(id);
  function message(text, error = false) { const alert = element('smtpAlert'); alert.className = `alert alert-${error ? 'danger' : 'success'}`; alert.textContent = text; }
  async function api(url, method = 'GET', body) {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.message || 'No se pudo completar la operacion SMTP'); return result;
  }
  function updateTestState() { element('smtpTestButton').disabled = loading || dirty || !saved?.configured || !saved?.enabled; }
  function providerDefaults() {
    if (element('smtpProvider').value === 'other') return;
    element('smtpHost').value = element('smtpProvider').value === 'gmail' ? 'smtp.gmail.com' : 'smtp.office365.com';
    element('smtpPort').value = '587'; element('smtpSecurity').value = 'starttls';
  }
  async function load() {
    if (loading) return;
    loading = true; element('smtpGlobalForm').querySelector('button[type=submit]').disabled = true; updateTestState();
    try {
      const result = await api(endpoint); saved = result.data;
      element('smtpHost').value = saved.host || 'smtp.gmail.com';
      element('smtpProvider').value = element('smtpHost').value === 'smtp.gmail.com' ? 'gmail' : element('smtpHost').value === 'smtp.office365.com' ? 'microsoft' : 'other';
      element('smtpPort').value = String(saved.port || 587); element('smtpSecurity').value = saved.security || 'starttls';
      element('smtpUser').value = saved.user || 'soportekinventory@gmail.com';
      element('smtpFromEmail').value = saved.fromEmail || 'soportekinventory@gmail.com';
      element('smtpFromName').value = saved.fromName || 'Kore Inventory';
      element('smtpEnabled').checked = saved.configured ? saved.enabled : true;
      element('smtpPassword').value = ''; element('smtpPassword').required = !saved.credentialStored;
      element('smtpPassword').placeholder = saved.credentialStored ? 'Conservar credencial guardada' : 'Credencial requerida';
      element('smtpCredentialState').textContent = saved.credentialStored ? 'Credencial guardada; no se muestra.' : 'Sin credencial guardada.';
      element('smtpTestEmail').value = saved.fromEmail || 'soportekinventory@gmail.com';
      element('smtpState').textContent = saved.configured ? `${saved.source === 'global' ? 'Configuracion global' : 'Configuracion del servidor'} | ${saved.enabled ? 'Activo' : 'Desactivado'} | Ultima prueba: ${saved.lastTestStatus || 'pendiente'}` : 'Servicio SMTP pendiente de configuracion';
      dirty = false;
    } catch (error) { saved = null; message(error.message, true); }
    finally { loading = false; element('smtpGlobalForm').querySelector('button[type=submit]').disabled = !saved; updateTestState(); }
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (!element('smtpGlobalForm')) return;
    element('smtp-global-tab').addEventListener('shown.bs.tab', () => { if (!saved && !dirty) load(); });
    element('smtpReload').onclick = () => { if (!dirty || confirm('Descartar cambios SMTP sin guardar?')) load(); };
    element('smtpGlobalForm').addEventListener('input', () => { dirty = true; updateTestState(); });
    element('smtpProvider').addEventListener('change', () => { providerDefaults(); dirty = true; updateTestState(); });
    element('smtpPort').addEventListener('change', () => { element('smtpSecurity').value = element('smtpPort').value === '465' ? 'tls' : 'starttls'; });
    element('smtpGlobalForm').addEventListener('submit', async event => {
      event.preventDefault(); const button = event.currentTarget.querySelector('button[type=submit]'); button.disabled = true;
      try {
        if (!saved) throw new Error('Recargue la configuracion antes de guardar');
        const result = await api(endpoint, 'PUT', { host: element('smtpHost').value.trim(), port: Number(element('smtpPort').value), security: element('smtpSecurity').value,
          user: element('smtpUser').value.trim(), password: element('smtpPassword').value, fromEmail: element('smtpFromEmail').value.trim(),
          fromName: element('smtpFromName').value.trim(), enabled: element('smtpEnabled').checked, version: saved.version });
        element('smtpPassword').value = ''; await load(); message(result.message);
      } catch (error) { message(error.message, true); } finally { button.disabled = false; }
    });
    element('smtpTestForm').addEventListener('submit', async event => {
      event.preventDefault();
      if (!saved?.configured || !saved.enabled || dirty) { message('Guarde los cambios y active el servicio antes de probar.', true); return; }
      element('smtpTestButton').disabled = true;
      try { const result = await api(`${endpoint}/prueba`, 'POST', { email: element('smtpTestEmail').value.trim(), version: saved.version }); await load(); message(result.message); }
      catch (error) { message(error.message, true); } finally { updateTestState(); }
    });
  });
})();