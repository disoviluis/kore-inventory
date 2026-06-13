/**
 * ========================================
 * SIDEBAR NAVIGATION - COMMON SCRIPT
 * ========================================
 * Maneja la navegación del sidebar en todas las páginas
 * Filtra módulos según permisos del usuario
 */

// API URL - usar el global o fallback
const SIDEBAR_API_URL = typeof API_URL !== 'undefined' ? API_URL : '/api';

/**
 * Mapeo de enlaces del sidebar a nombres de módulos
 * Clave: href de la página o nombre del módulo
 * Valor: nombre del módulo en la tabla modulos
 */
const MODULE_MAP = {
  // OPERACIONES
  'ventas.html': 'pos',  // CORREGIDO: ventas.html es el POS, no gestión de ventas
  'ventas-historial.html': 'ventas',  // El historial sí es gestión de ventas
  'clientes.html': 'clientes',
  'inventario.html': 'inventario',
  'productos.html': 'productos',
  'proveedores.html': 'proveedores',
  'compras.html': 'compras',
  
  // LOGÍSTICA
  'bodegas.html': 'bodegas',
  'traslados.html': 'traslados',
  'mensajeros-dashboard.html': 'mensajeros',
  
  // FINANZAS
  'cuentas-por-cobrar.html': 'finanzas',
  
  // ADMINISTRACIÓN (módulos del dashboard)
  'usuarios': 'usuarios',
  'roles': 'roles',
  'impuestos': 'impuestos',
  'empresa': 'empresas',
  'facturacion': 'facturacion',
  
  // PLATAFORMA
  'empresas': 'empresas',
  'licencias': 'licencias',
  'auditoria': 'auditoria'
};

/**
 * Cargar módulos permitidos desde la API
 */
async function cargarModulosPermitidos() {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.warn('⚠️ No hay token - No se pueden cargar permisos');
      return null;
    }
    
    const response = await fetch(`${SIDEBAR_API_URL}/auth/permisos/modulos`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.error('❌ Error al cargar módulos permitidos:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
      console.log('✅ Módulos permitidos cargados:', data.data.modulos);
      
      // Guardar en localStorage
      localStorage.setItem('modulosPermitidos', JSON.stringify(data.data.modulos));
      
      return data.data.modulos;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error al cargar módulos permitidos:', error);
    return null;
  }
}

/**
 * Obtener módulos permitidos (desde localStorage o API)
 */
async function getModulosPermitidos() {
  // Intentar obtener desde localStorage primero
  const cached = localStorage.getItem('modulosPermitidos');
  
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.warn('⚠️ Error al parsear módulos en cache, recargando...');
    }
  }
  
  // Si no hay cache, cargar desde API
  return await cargarModulosPermitidos();
}

/**
 * Verificar si el usuario tiene acceso a un módulo
 */
function tienePermisoModulo(moduloNombre, modulosPermitidos) {
  if (!modulosPermitidos || modulosPermitidos.length === 0) {
    return false;
  }
  
  return modulosPermitidos.some(m => m.nombre === moduloNombre);
}

/**
 * Filtrar sidebar según módulos permitidos
 */
async function filtrarSidebarPorPermisos() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  
  // Super admin ve todo (pero aún mostrar sidebar)
  if (usuario.tipo_usuario === 'super_admin') {
    console.log('👑 Super Admin - Sin restricciones de módulos');
    
    // Mostrar sidebar inmediatamente para super admin
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (sidebarNav) {
      sidebarNav.classList.add('permissions-loaded');
    }
    
    return;
  }
  
  // Cargar módulos permitidos
  const modulosPermitidos = await getModulosPermitidos();
  
  if (!modulosPermitidos || modulosPermitidos.length === 0) {
    console.warn('⚠️ No se pudieron cargar los módulos permitidos o usuario sin permisos');
    
    // SEGURIDAD: Si no hay permisos, ocultar TODO excepto Dashboard
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
      const link = item.querySelector('a.nav-link');
      if (link && !link.classList.contains('nav-section') && link.getAttribute('href') !== 'dashboard.html') {
        item.style.display = 'none';
      }
    });
    
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (sidebarNav) {
      sidebarNav.classList.add('permissions-loaded');
      console.log('⚠️ Usuario sin permisos - Solo Dashboard visible');
    }
    
    return;
  }
  
  console.log('🔍 Filtrando sidebar según permisos...');
  
  // Obtener todos los nav-items del sidebar
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  
  navItems.forEach(item => {
    const link = item.querySelector('a.nav-link');
    
    if (!link) return;
    
    // No filtrar Dashboard ni secciones principales
    if (link.classList.contains('nav-section') || 
        link.getAttribute('href') === 'dashboard.html') {
      return;
    }
    
    // Obtener el href o el módulo desde onclick
    let moduloNombre = null;
    const href = link.getAttribute('href');
    const onclick = link.getAttribute('onclick');
    
    if (href && href !== '#') {
      // Extraer nombre de archivo del href
      const fileName = href.split('/').pop();
      moduloNombre = MODULE_MAP[fileName];
    } else if (onclick) {
      // Extraer módulo de cambiarModulo('xxx')
      const match = onclick.match(/cambiarModulo\('([^']+)'\)/);
      if (match) {
        moduloNombre = MODULE_MAP[match[1]] || match[1];
      }
    }
    
    // Si encontramos el módulo, verificar permisos
    if (moduloNombre) {
      const tienePermiso = tienePermisoModulo(moduloNombre, modulosPermitidos);
      
      if (!tienePermiso) {
        console.log(`🚫 Ocultando módulo sin permiso: ${moduloNombre}`);
        item.style.display = 'none';
      } else {
        console.log(`✅ Módulo permitido: ${moduloNombre}`);
        item.style.display = 'block';
      }
    }
  });
  
  // Ocultar secciones completas si no tienen módulos visibles
  ocultarSeccionesVacias();
  
  // ✅ Marcar sidebar como cargado (mostrar con transición)
  const sidebarNav = document.querySelector('.sidebar-nav');
  if (sidebarNav) {
    sidebarNav.classList.add('permissions-loaded');
    console.log('✅ Sidebar visible - Permisos aplicados');
  }
}

/**
 * Ocultar secciones que no tienen módulos visibles
 */
function ocultarSeccionesVacias() {
  const secciones = [
    { id: 'operacionesCollapse', parentSelector: '[href="#operacionesCollapse"]' },
    { id: 'logisticaCollapse', parentSelector: '[href="#logisticaCollapse"]' },
    { id: 'finanzasCollapse', parentSelector: '[href="#finanzasCollapse"]' },
    { id: 'reportesCollapse', parentSelector: '[href="#reportesCollapse"]' }
  ];
  
  secciones.forEach(seccion => {
    const collapse = document.getElementById(seccion.id);
    const parentLink = document.querySelector(seccion.parentSelector);
    
    if (!collapse || !parentLink) return;
    
    // Contar nav-items visibles usando getComputedStyle para verificar display
    // IMPORTANTE: Ignorar items disabled (con badge "Próximamente")
    const allItems = collapse.querySelectorAll('.nav-item');
    let itemsVisibles = 0;
    
    allItems.forEach(item => {
      const computedStyle = window.getComputedStyle(item);
      const link = item.querySelector('a.nav-link');
      
      // Contar solo si: está visible Y no está disabled
      if (computedStyle.display !== 'none' && link && !link.classList.contains('disabled')) {
        itemsVisibles++;
      }
    });
    
    if (itemsVisibles === 0) {
      console.log(`🚫 Ocultando sección vacía: ${seccion.id}`);
      parentLink.closest('.nav-item').style.display = 'none';
    } else {
      console.log(`✅ Mostrando sección con ${itemsVisibles} items: ${seccion.id}`);
      parentLink.closest('.nav-item').style.display = 'block';
    }
  });
}

/**
 * Mostrar/ocultar sección de PLATAFORMA para super admin
 */
function configurarSidebarSuperAdmin() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const plataformaSection = document.getElementById('plataformaSection');
  
  if (!plataformaSection) {
    return;
  }
  
  if (usuario.tipo_usuario === 'super_admin') {
    console.log('👑 Usuario Super Admin detectado - Mostrando PLATAFORMA');
    plataformaSection.style.display = 'block';
  } else {
    console.log('👤 Usuario regular - Ocultando PLATAFORMA');
    plataformaSection.style.display = 'none';
  }
}

/**
 * Mostrar/ocultar sección de ADMINISTRACIÓN para admin_empresa y super_admin
 */
function configurarSidebarAdministracion() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const administracionSection = document.getElementById('administracionCollapse');
  const administracionLink = document.querySelector('a[href="#administracionCollapse"]');
  
  if (!administracionSection || !administracionLink) {
    return;
  }
  
  if (usuario.tipo_usuario === 'super_admin' || usuario.tipo_usuario === 'admin_empresa') {
    console.log('🔐 Usuario con permisos de administración - Mostrando ADMINISTRACIÓN');
    administracionLink.parentElement.style.display = 'block';
  } else {
    console.log('👤 Usuario sin permisos - Ocultando ADMINISTRACIÓN');
    administracionLink.parentElement.style.display = 'none';
  }
}

/**
 * Inicializar sidebar navigation
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔧 Sidebar Navigation inicializado');
  
  // 1. Cargar módulos permitidos desde la API
  await cargarModulosPermitidos();
  
  // 2. Filtrar sidebar según permisos
  await filtrarSidebarPorPermisos();
  
  // 3. Configurar visibilidad de PLATAFORMA
  configurarSidebarSuperAdmin();
  
  // 4. Configurar visibilidad de ADMINISTRACIÓN
  configurarSidebarAdministracion();
  
  // 5. Si estamos en dashboard.html y hay un hash, activar ese módulo
  if (window.location.pathname.includes('dashboard.html') && window.location.hash) {
    const moduleName = window.location.hash.substring(1); // Remover el #
    console.log(`🎯 Activando módulo desde hash: ${moduleName}`);
    
    // Esperar a que dashboard.js esté cargado
    setTimeout(() => {
      if (typeof cambiarModulo === 'function') {
        cambiarModulo(moduleName);
      }
    }, 100);
  }

  // ============================================
  // TOGGLE SIDEBAR - FUNCIONA EN PC Y MÓVIL
  // ============================================
  initializeSidebarToggle();
});

/**
 * Inicializar toggle del sidebar para PC y móvil
 * Elimina event listeners previos para evitar duplicados
 */
function initializeSidebarToggle() {
  const toggleSidebar = document.getElementById('toggleSidebar');
  const closeSidebar = document.getElementById('closeSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  
  if (toggleSidebar) {
    // Eliminar event listeners previos clonando el botón
    const newToggleSidebar = toggleSidebar.cloneNode(true);
    toggleSidebar.parentNode.replaceChild(newToggleSidebar, toggleSidebar);
    
    // Agregar nuevo event listener
    newToggleSidebar.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      const mainContent = document.querySelector('.main-content');
      
      if (window.innerWidth >= 992) {
        // En DESKTOP (PC): colapsar sidebar para ver módulos completos
        if (sidebar) sidebar.classList.toggle('collapsed');
        if (mainContent) mainContent.classList.toggle('expanded');
      } else {
        // En MÓVIL: mostrar sidebar con overlay
        if (sidebar) sidebar.classList.toggle('active');
        if (overlay) overlay.classList.toggle('active');
      }
    });
    
    console.log('✅ Toggle sidebar inicializado (PC y móvil)');
  }

  // Cerrar sidebar en móvil
  if (closeSidebar) {
    // Eliminar listeners previos
    const newCloseSidebar = closeSidebar.cloneNode(true);
    closeSidebar.parentNode.replaceChild(newCloseSidebar, closeSidebar);
    
    newCloseSidebar.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      if (sidebar) sidebar.classList.remove('active');
      if (overlay) overlay.classList.remove('active');
    });
  }

  // Cerrar al hacer clic en el overlay (móvil)
  if (sidebarOverlay) {
    // Eliminar listeners previos
    const newSidebarOverlay = sidebarOverlay.cloneNode(true);
    sidebarOverlay.parentNode.replaceChild(newSidebarOverlay, sidebarOverlay);
    
    newSidebarOverlay.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('active');
      newSidebarOverlay.classList.remove('active');
    });
  }
}

