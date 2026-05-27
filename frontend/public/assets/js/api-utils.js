/**
 * ========================================
 * KORE INVENTORY - API UTILS
 * Utilidades para manejo de llamadas API
 * ========================================
 */

/**
 * Realiza una petición fetch con manejo automático de errores de licencia
 * @param {string} url - URL de la API
 * @param {object} options - Opciones de fetch
 * @returns {Promise<any>} - Respuesta de la API
 */
async function apiFetch(url, options = {}) {
  try {
    // Agregar token automáticamente si existe
    const token = sessionStorage.getItem('token');
    if (token && !options.headers) {
      options.headers = {};
    }
    if (token && options.headers) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, options);
    
    // Verificar si la licencia está vencida
    if (response.status === 403) {
      const data = await response.json();
      
      // Códigos de error de licencia
      const licenseErrorCodes = [
        'LICENCIA_VENCIDA',
        'LICENCIA_SUSPENDIDA',
        'EMPRESA_SUSPENDIDA',
        'SIN_LICENCIA'
      ];
      
      if (data.code && licenseErrorCodes.includes(data.code)) {
        // Guardar mensaje de error para mostrarlo en la página de licencia vencida
        sessionStorage.setItem('license_error', JSON.stringify(data));
        
        // Redirigir a la página de licencia vencida
        window.location.href = '/licencia-vencida.html';
        
        // Lanzar error para detener ejecución
        throw new Error('Licencia vencida');
      }
    }

    // Si es 401, redirigir a login
    if (response.status === 401) {
      sessionStorage.clear();
      window.location.href = '/login.html';
      throw new Error('Sesión expirada');
    }

    return response;
  } catch (error) {
    console.error('Error en apiFetch:', error);
    throw error;
  }
}

/**
 * Wrapper para GET con manejo de licencia
 */
async function apiGet(url, options = {}) {
  const response = await apiFetch(url, {
    ...options,
    method: 'GET'
  });
  return response.json();
}

/**
 * Wrapper para POST con manejo de licencia
 */
async function apiPost(url, data, options = {}) {
  const response = await apiFetch(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: JSON.stringify(data)
  });
  return response.json();
}

/**
 * Wrapper para PUT con manejo de licencia
 */
async function apiPut(url, data, options = {}) {
  const response = await apiFetch(url, {
    ...options,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: JSON.stringify(data)
  });
  return response.json();
}

/**
 * Wrapper para DELETE con manejo de licencia
 */
async function apiDelete(url, options = {}) {
  const response = await apiFetch(url, {
    ...options,
    method: 'DELETE'
  });
  return response.json();
}

/**
 * Verificar estado de licencia al cargar página
 */
function checkLicenseOnLoad() {
  const licenseError = sessionStorage.getItem('license_error');
  
  // Si hay error de licencia guardado y no estamos en la página de licencia vencida
  if (licenseError && !window.location.pathname.includes('licencia-vencida.html')) {
    const error = JSON.parse(licenseError);
    
    // Mostrar alerta
    console.warn('Error de licencia detectado:', error);
    
    // Redirigir si es necesario
    if (!window.location.pathname.includes('login.html')) {
      window.location.href = '/licencia-vencida.html';
    }
  }
}

// Ejecutar verificación al cargar la página
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkLicenseOnLoad);
} else {
  checkLicenseOnLoad();
}
