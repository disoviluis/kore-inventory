/**
 * ========================================
 * PERMISSIONS UTILITIES
 * ========================================
 * Sistema de verificación de permisos granulares
 * Permite verificar si el usuario tiene acceso a módulos y acciones específicas
 */

/**
 * Cargar permisos detallados del usuario (módulo + acción)
 * @returns {Promise<Array>} Lista de permisos con formato { modulo, accion, codigo }
 */
async function cargarPermisosDetallados() {
  try {
    const token = localStorage.getItem('token');
    const empresaActiva = JSON.parse(localStorage.getItem('empresaActiva') || '{}');
    
    if (!token) {
      console.warn('⚠️ No hay token - No se pueden cargar permisos');
      return null;
    }
    
    const url = empresaActiva.id 
      ? `${API_URL}/auth/permisos?empresa_id=${empresaActiva.id}`
      : `${API_URL}/auth/permisos`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.error('❌ Error al cargar permisos:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
      console.log('✅ Permisos detallados cargados:', data.data.permisos.length, 'permisos');
      
      // Guardar en localStorage
      localStorage.setItem('permisosDetallados', JSON.stringify(data.data.permisos));
      
      return data.data.permisos;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error al cargar permisos detallados:', error);
    return null;
  }
}

/**
 * Obtener permisos detallados (desde localStorage o API)
 * @returns {Promise<Array>}
 */
async function getPermisosDetallados() {
  // Intentar obtener desde localStorage
  const cached = localStorage.getItem('permisosDetallados');
  
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.warn('⚠️ Error al parsear permisos en cache, recargando...');
    }
  }
  
  // Si no hay cache, cargar desde API
  return await cargarPermisosDetallados();
}

/**
 * Verificar si el usuario tiene un permiso específico
 * @param {string} modulo - Nombre del módulo (ej: 'traslados', 'productos', 'ventas')
 * @param {string} accion - Nombre de la acción (ej: 'create', 'edit', 'delete', 'view')
 * @returns {Promise<boolean>}
 */
async function tienePermiso(modulo, accion) {
  // Super admin siempre tiene todos los permisos
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  if (usuario.tipo_usuario === 'super_admin') {
    return true;
  }
  
  // Admin empresa tiene todos los permisos excepto plataforma
  if (usuario.tipo_usuario === 'admin_empresa') {
    return true; // TODO: Agregar filtro de módulos de plataforma si es necesario
  }
  
  // Para otros usuarios, verificar permisos
  const permisos = await getPermisosDetallados();
  
  if (!permisos || permisos.length === 0) {
    console.warn('⚠️ No se encontraron permisos para el usuario');
    return false;
  }
  
  // Buscar permiso específico
  const tieneAcceso = permisos.some(p => 
    p.modulo === modulo && p.accion === accion
  );
  
  if (!tieneAcceso) {
    console.log(`🚫 Permiso denegado: ${modulo}.${accion}`);
  }
  
  return tieneAcceso;
}

/**
 * Verificar si el usuario tiene al menos una acción en un módulo
 * @param {string} modulo - Nombre del módulo
 * @returns {Promise<boolean>}
 */
async function tienePermisoModulo(modulo) {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  if (usuario.tipo_usuario === 'super_admin' || usuario.tipo_usuario === 'admin_empresa') {
    return true;
  }
  
  const permisos = await getPermisosDetallados();
  if (!permisos || permisos.length === 0) {
    return false;
  }
  
  return permisos.some(p => p.modulo === modulo);
}

/**
 * Obtener todas las acciones permitidas para un módulo
 * @param {string} modulo - Nombre del módulo
 * @returns {Promise<Array<string>>} Lista de acciones (ej: ['view', 'create', 'edit'])
 */
async function getAccionesPermitidas(modulo) {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  
  if (usuario.tipo_usuario === 'super_admin' || usuario.tipo_usuario === 'admin_empresa') {
    // Retornar todas las acciones posibles
    return ['view', 'create', 'edit', 'delete', 'approve', 'export', 'import', 'print'];
  }
  
  const permisos = await getPermisosDetallados();
  if (!permisos || permisos.length === 0) {
    return [];
  }
  
  return permisos
    .filter(p => p.modulo === modulo)
    .map(p => p.accion);
}

/**
 * Ocultar botones/elementos según permisos
 * Uso: <button data-permiso-modulo="traslados" data-permiso-accion="create">...</button>
 */
async function aplicarPermisosUI() {
  console.log('🔐 Aplicando permisos a la interfaz...');
  
  // Buscar todos los elementos con atributos de permisos
  const elementosConPermisos = document.querySelectorAll('[data-permiso-modulo][data-permiso-accion]');
  
  for (const elemento of elementosConPermisos) {
    const modulo = elemento.getAttribute('data-permiso-modulo');
    const accion = elemento.getAttribute('data-permiso-accion');
    
    const tieneAcceso = await tienePermiso(modulo, accion);
    
    if (!tieneAcceso) {
      console.log(`🚫 Ocultando elemento: ${modulo}.${accion}`);
      elemento.style.display = 'none';
      elemento.disabled = true;
    } else {
      console.log(`✅ Mostrando elemento: ${modulo}.${accion}`);
      elemento.style.display = '';
      elemento.disabled = false;
    }
  }
  
  console.log('✅ Permisos aplicados a', elementosConPermisos.length, 'elementos');
}

/**
 * Verificar permisos al cargar la página
 * Llamar en DOMContentLoaded después de cargar sidebar
 */
async function inicializarPermisos() {
  console.log('🔐 Inicializando sistema de permisos...');
  
  // Cargar permisos detallados
  await cargarPermisosDetallados();
  
  // Aplicar permisos a elementos de la UI
  await aplicarPermisosUI();
  
  console.log('✅ Sistema de permisos inicializado');
}

// ==========================================
// HELPERS PARA MENSAJES DE ERROR
// ==========================================

/**
 * Mostrar mensaje de error cuando usuario no tiene permisos
 * @param {string} accion - Nombre de la acción que se intentó realizar
 */
function mostrarErrorPermiso(accion = 'realizar esta acción') {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      icon: 'error',
      title: 'Acceso Denegado',
      text: `No tienes permisos para ${accion}`,
      confirmButtonColor: '#d33'
    });
  } else {
    alert(`No tienes permisos para ${accion}`);
  }
}

/**
 * Ejecutar función solo si tiene permiso
 * @param {string} modulo - Nombre del módulo
 * @param {string} accion - Nombre de la acción
 * @param {Function} callback - Función a ejecutar si tiene permiso
 * @param {string} mensajeError - Mensaje de error personalizado
 */
async function ejecutarConPermiso(modulo, accion, callback, mensajeError = null) {
  const tieneAcceso = await tienePermiso(modulo, accion);
  
  if (!tieneAcceso) {
    mostrarErrorPermiso(mensajeError || `${accion} en ${modulo}`);
    return false;
  }
  
  // Ejecutar callback
  if (typeof callback === 'function') {
    return await callback();
  }
  
  return true;
}

// ==========================================
// EXPORTAR FUNCIONES (si se usa como módulo)
// ==========================================

// Si se usa en navegador, exponer globalmente
if (typeof window !== 'undefined') {
  window.PermisosUtils = {
    cargarPermisosDetallados,
    getPermisosDetallados,
    tienePermiso,
    tienePermisoModulo,
    getAccionesPermitidas,
    aplicarPermisosUI,
    inicializarPermisos,
    mostrarErrorPermiso,
    ejecutarConPermiso
  };
}
