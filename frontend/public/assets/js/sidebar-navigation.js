/**
 * ========================================
 * SIDEBAR NAVIGATION - COMMON SCRIPT
 * ========================================
 * Maneja la navegación del sidebar en todas las páginas
 * Incluye soporte para módulos de PLATAFORMA (Super Admin)
 */

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
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔧 Sidebar Navigation inicializado');
  
  // Configurar visibilidad de PLATAFORMA
  configurarSidebarSuperAdmin();
  
  // Configurar visibilidad de ADMINISTRACIÓN
  configurarSidebarAdministracion();
  
  // Si estamos en dashboard.html y hay un hash, activar ese módulo
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
});
