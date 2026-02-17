/**
 * ========================================
 * SIDEBAR NAVIGATION - COMMON SCRIPT
 * ========================================
 * Maneja la navegación del sidebar en todas las páginas
 * Incluye soporte para módulos de PLATAFORMA (Super Admin)
 */

/**
 * Mostrar/ocultar elementos de super admin en el sidebar
 */
function configurarSidebarSuperAdmin() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  
  if (usuario.tipo_usuario === 'super_admin') {
    console.log('👑 Usuario Super Admin detectado - Mostrando opciones de PLATAFORMA');
    
    // Ocultar la sección colapsable vieja (con enlaces disabled)
    const plataformaSection = document.getElementById('plataformaSection');
    if (plataformaSection) {
      plataformaSection.style.display = 'none';
    }
    
    // Mostrar los enlaces directos nuevos (con data-module)
    const superAdminElements = document.querySelectorAll('.super-admin-only');
    superAdminElements.forEach(element => {
      element.style.display = 'block';
    });
  } else {
    console.log('👤 Usuario regular - Ocultando opciones de PLATAFORMA');
    
    // Ocultar sección colapsable
    const plataformaSection = document.getElementById('plataformaSection');
    if (plataformaSection) {
      plataformaSection.style.display = 'none';
    }
    
    // Ocultar enlaces super admin
    const superAdminElements = document.querySelectorAll('.super-admin-only');
    superAdminElements.forEach(element => {
      element.style.display = 'none';
    });
  }
}

/**
 * Configurar navegación por data-module en el sidebar
 * Esto permite que los enlaces de PLATAFORMA funcionen desde cualquier página
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔧 Sidebar Navigation inicializado');
  
  // Configurar visibilidad de elementos super admin
  configurarSidebarSuperAdmin();
  
  // Configurar navegación por data-module (para módulos de PLATAFORMA)
  const navLinks = document.querySelectorAll('[data-module]');
  console.log(`📋 Enlaces con data-module encontrados: ${navLinks.length}`);
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const moduleName = link.getAttribute('data-module');
      console.log(`🔄 Navegando a módulo: ${moduleName}`);
      
      // Redirigir al dashboard con el módulo como hash
      window.location.href = `dashboard.html#${moduleName}`;
    });
  });
  
  // Si estamos en dashboard.html y hay un hash, activar ese módulo
  if (window.location.pathname.includes('dashboard.html') && window.location.hash) {
    const moduleName = window.location.hash.substring(1); // Remover el #
    console.log(`🎯 Activando módulo desde hash: ${moduleName}`);
    
    // Esperar a que dashboard.js esté cargado
    setTimeout(() => {
      if (typeof cambiarModulo === 'function') {
        cambiarModulo(moduleName);
        
        // Marcar el link como activo
        navLinks.forEach(link => {
          if (link.getAttribute('data-module') === moduleName) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    }, 100);
  }
});
