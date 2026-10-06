(function () {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  const cookie = name => document.cookie.split('; ').find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) || '';
  window.fetch = async function (input, options = {}) {
    const target = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    if (target.origin !== location.origin || !target.pathname.startsWith('/api/')) return nativeFetch(input, options);
    const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
    headers.delete('Authorization');
    const method = String(options.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const csrf = cookie('kore_csrf');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrf) headers.set('X-CSRF-Token', decodeURIComponent(csrf));
    const response = await nativeFetch(input, { ...options, headers, credentials: 'same-origin' });
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
      for (const storage of [localStorage, sessionStorage]) {
        for (const key of ['token', 'usuario', 'empresaActiva', 'modulosPermitidos', 'permisosUsuario']) storage.removeItem(key);
      }
      location.href = '/login.html';
    } catch (error) { window.alert(error.message); }
  }, true);
})();