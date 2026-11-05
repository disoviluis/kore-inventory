(function () {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  const cookie = name => document.cookie.split('; ').find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) || '';
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const publicPages = ['', 'index.html', 'login.html', 'activar-cuenta.html', 'solicitar-acceso.html', 'empresa-publica.html',
    'documentos-legales.html', 'cookies.html', 'erp-inventarios.html', 'licencia-vencida.html', 'manual-contabilidad.html',
    'solicitudes-datos.html'];
  // Continuous display screens are kept open without interaction; only the 8h absolute limit applies.
  const idleExemptPages = ['cocina.html', 'comandas.html', 'mensajeros-dashboard.html'];
  const isPublicPage = publicPages.includes(page);
  const IDLE_MS = 30 * 60 * 1000;
  const WARNING_MS = 60 * 1000;
  const HEARTBEAT_MS = 4 * 60 * 1000;
  const ACTIVITY_KEY = 'kore_ultima_actividad';
  const LOGOUT_KEY = 'kore_cierre_sesion';
  const sessionKeys = ['token', 'usuario', 'empresaActiva', 'modulosPermitidos', 'permisosUsuario'];
  let endingSession = false;

  const clearLocalSession = () => {
    for (const storage of [localStorage, sessionStorage]) {
      for (const key of sessionKeys) storage.removeItem(key);
    }
    localStorage.removeItem(ACTIVITY_KEY);
  };
  const goToLogin = reason => {
    if (endingSession) return;
    endingSession = true;
    clearLocalSession();
    location.href = `/login.html?motivo=${encodeURIComponent(reason)}`;
  };

  window.fetch = async function (input, options = {}) {
    const target = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    if (target.origin !== location.origin || !target.pathname.startsWith('/api/')) return nativeFetch(input, options);
    const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
    headers.delete('Authorization');
    const method = String(options.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const csrf = cookie('kore_csrf');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrf) headers.set('X-CSRF-Token', decodeURIComponent(csrf));
    const response = await nativeFetch(input, { ...options, headers, credentials: 'same-origin' });
    if (response.status === 401 && !isPublicPage && !target.pathname.startsWith('/api/auth/login')) {
      goToLogin('expirada');
    }
    if (response.status === 428 || response.status === 403) {
      const data = await response.clone().json().catch(() => ({}));
      if (data.codigo === 'SEGURIDAD_PENDIENTE' && !location.pathname.endsWith('/seguridad-cuenta.html')) {
        location.href = '/seguridad-cuenta.html';
      } else if (data.codigo === 'LICENCIA_INACTIVA_PAGO_PENDIENTE' && !['/suscripcion.html', '/licencia-vencida.html'].includes(location.pathname)) {
        location.href = `/suscripcion.html?empresa_id=${encodeURIComponent(data.data?.empresa_id || '')}`;
      }
    }
    return response;
  };
  for (const storage of [localStorage, sessionStorage]) {
    const oldToken = storage.getItem('token');
    if (oldToken && oldToken !== 'cookie') {
      storage.removeItem('token');
      storage.removeItem('usuario');
    }
  }
  if (cookie('kore_csrf')) localStorage.setItem('token', 'cookie');
  document.addEventListener('click', async event => {
    const logout = event.target.closest?.('[data-logout], #btnLogout, [onclick*="cerrarSesion"], [onclick*="logout"]');
    if (!logout) return;
    event.preventDefault(); event.stopImmediatePropagation();
    try {
      const response = await window.fetch('/api/auth/logout', { method: 'POST', keepalive: true });
      if (!response.ok && response.status !== 401) throw new Error('No se pudo cerrar la sesion');
      clearLocalSession();
      location.href = '/login.html';
    } catch (error) { window.alert(error.message); }
  }, true);

  const hasSession = () => localStorage.getItem('token') === 'cookie';
  if (page === 'login.html') {
    localStorage.removeItem(ACTIVITY_KEY);
    localStorage.removeItem(LOGOUT_KEY);
  }
  if (isPublicPage || idleExemptPages.includes(page) || !hasSession()) return;

  let lastActivity = Date.now();
  let lastStored = 0;
  let lastHeartbeat = Date.now();
  let warning = null;
  const latestActivity = () => Math.max(lastActivity, Number(localStorage.getItem(ACTIVITY_KEY)) || 0);
  const recordActivity = () => {
    if (endingSession) return;
    lastActivity = Date.now();
    if (lastActivity - lastStored > 5000) {
      lastStored = lastActivity;
      localStorage.setItem(ACTIVITY_KEY, String(lastActivity));
    }
    if (warning) hideWarning();
  };

  const endForInactivity = async () => {
    if (endingSession) return;
    localStorage.setItem(LOGOUT_KEY, String(Date.now()));
    try { await nativeFetch('/api/auth/logout', { method: 'POST', keepalive: true, credentials: 'same-origin',
      headers: { 'X-CSRF-Token': decodeURIComponent(cookie('kore_csrf')) } }); } catch (_) { /* the server idle limit still applies */ }
    goToLogin('inactividad');
  };

  const showWarning = () => {
    if (warning) return;
    warning = document.createElement('div');
    warning.setAttribute('role', 'alertdialog');
    warning.setAttribute('aria-live', 'assertive');
    warning.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.55);font-family:inherit';
    warning.innerHTML = `<div style="background:#fff;color:#1f2937;max-width:420px;width:calc(100% - 32px);border-radius:12px;padding:24px;box-shadow:0 20px 45px rgba(0,0,0,.25);text-align:center">
      <h5 style="margin:0 0 8px;font-weight:600">Su sesion esta por cerrarse</h5>
      <p style="margin:0 0 16px">Por inactividad, la sesion se cerrara en <strong data-idle-countdown>60</strong> segundos.</p>
      <button type="button" data-idle-continue style="background:#0d6efd;color:#fff;border:0;border-radius:8px;padding:10px 18px;cursor:pointer;margin:0 4px">Seguir conectado</button>
      <button type="button" data-idle-logout style="background:#e5e7eb;color:#111827;border:0;border-radius:8px;padding:10px 18px;cursor:pointer;margin:0 4px">Cerrar sesion</button>
    </div>`;
    warning.querySelector('[data-idle-continue]').addEventListener('click', () => { recordActivity(); heartbeat(true); });
    warning.querySelector('[data-idle-logout]').addEventListener('click', endForInactivity);
    document.body.appendChild(warning);
  };
  const hideWarning = () => { warning?.remove(); warning = null; };

  const heartbeat = async force => {
    if (endingSession || (!force && Date.now() - lastHeartbeat < HEARTBEAT_MS)) return;
    lastHeartbeat = Date.now();
    try { await window.fetch('/api/auth/verify', { method: 'GET', cache: 'no-store' }); } catch (_) { /* network errors keep the local timer authoritative */ }
  };

  const check = () => {
    if (endingSession) return;
    if (!hasSession()) { goToLogin('expirada'); return; }
    const idle = Date.now() - latestActivity();
    if (idle >= IDLE_MS) { endForInactivity(); return; }
    if (idle >= IDLE_MS - WARNING_MS) {
      showWarning();
      const counter = warning?.querySelector('[data-idle-countdown]');
      if (counter) counter.textContent = String(Math.max(0, Math.ceil((IDLE_MS - idle) / 1000)));
      return;
    }
    hideWarning();
    // Keep the server session alive only while the user is actually interacting.
    if (Date.now() - lastActivity < HEARTBEAT_MS) heartbeat(false);
  };

  for (const type of ['mousedown', 'keydown', 'touchstart', 'wheel', 'scroll', 'mousemove']) {
    window.addEventListener(type, () => {
      // While the warning is open, only deliberate input (click, key, touch) keeps the session.
      if (warning && !['mousedown', 'keydown', 'touchstart'].includes(type)) return;
      recordActivity();
    }, { passive: true, capture: true });
  }
  window.addEventListener('storage', event => {
    if (event.key === LOGOUT_KEY && event.newValue) goToLogin('inactividad');
    if (event.key === ACTIVITY_KEY && warning && Number(event.newValue) > Date.now() - IDLE_MS + WARNING_MS) hideWarning();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  const previous = Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
  if (previous && Date.now() - previous >= IDLE_MS) { endForInactivity(); return; }
  localStorage.setItem(ACTIVITY_KEY, String(lastActivity));
  setInterval(check, 1000);
})();