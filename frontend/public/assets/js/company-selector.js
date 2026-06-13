/**
 * ========================================
 * COMPANY SELECTOR - COMMON SCRIPT
 * ========================================
 * Maneja el selector de empresa en todas las páginas
 */

/**
 * Cargar empresas del usuario
 */
async function cargarEmpresas(usuarioId) {
  const token = localStorage.getItem('token');
  const companySelector = document.getElementById('companySelector');
  
  if (!companySelector) return;
  
  // Construir API_URL dinámicamente
  const apiUrl = '/api';
  
  try {
    const response = await fetch(`${apiUrl}/empresas/usuario/${usuarioId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success && data.data.length > 0) {
      // Limpiar selector
      companySelector.innerHTML = '';
      
      // Agregar opciones
      data.data.forEach(empresa => {
        const option = document.createElement('option');
        option.value = empresa.id;
        option.textContent = empresa.nombre;
        companySelector.appendChild(option);
      });
      
      // Seleccionar la primera empresa o la guardada
      let empresaSeleccionadaId;
      const empresaGuardada = localStorage.getItem('empresaActiva');
      
      if (empresaGuardada) {
        // Verificar que la empresa guardada existe en la lista
        const empresaExiste = data.data.find(emp => emp.id == empresaGuardada);
        if (empresaExiste) {
          companySelector.value = empresaGuardada;
          empresaSeleccionadaId = empresaGuardada;
        } else {
          // Si no existe, usar la primera empresa
          companySelector.value = data.data[0].id;
          empresaSeleccionadaId = data.data[0].id;
          localStorage.setItem('empresaActiva', empresaSeleccionadaId);
        }
      } else {
        // No hay empresa guardada, usar la primera
        companySelector.value = data.data[0].id;
        empresaSeleccionadaId = data.data[0].id;
        localStorage.setItem('empresaActiva', empresaSeleccionadaId);
      }
      
      // Event listener para cambio de empresa
      companySelector.addEventListener('change', (e) => {
        const empresaId = e.target.value;
        console.log('🔄 Cambio de empresa detectado:', empresaId);
        localStorage.setItem('empresaActiva', empresaId);
        
        // Disparar evento personalizado para que cada página maneje el cambio
        const eventoEmpresaCambiada = new CustomEvent('empresaCambiada', {
          detail: { empresaId: empresaId }
        });
        window.dispatchEvent(eventoEmpresaCambiada);
      });
      
    } else {
      companySelector.innerHTML = '<option value="">Sin empresas asignadas</option>';
    }
    
  } catch (error) {
    console.error('Error al cargar empresas:', error);
    companySelector.innerHTML = '<option value="">Error al cargar empresas</option>';
  }
}

/**
 * Inicializar selector de empresa
 */
function inicializarSelectorEmpresa() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  
  if (!usuario || !usuario.id) {
    console.warn('⚠️ No hay usuario logueado');
    return;
  }
  
  console.log('🏢 Inicializando selector de empresa para usuario:', usuario.id);
  cargarEmpresas(usuario.id);
}

/**
 * Auto-inicializar cuando el DOM esté listo
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('🏢 Company Selector inicializado');
  inicializarSelectorEmpresa();
});
