/**
 * =================================
 * KORE INVENTORY - DASHBOARD SCRIPT
 * JavaScript para dashboard principal
 * =================================
 */

const API_URL = 'http://18.191.181.99:3000/api';

/**
 * Verificar autenticación al cargar
 */
document.addEventListener('DOMContentLoaded', () => {
  verificarAutenticacion();
});

/**
 * Verificar si el usuario está autenticado
 */
async function verificarAutenticacion() {
  const token = localStorage.getItem('token');
  const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
  
  if (!token || !usuario) {
    // No hay sesión, redirigir al login
    window.location.href = 'login.html';
    return;
  }
  
  // Verificar token con el backend
  try {
    const response = await fetch(`${API_URL}/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (!data.success) {
      // Token inválido
      cerrarSesion();
      return;
    }
    
    // Cargar datos del usuario en el dashboard
    cargarDatosUsuario(usuario);
    
  } catch (error) {
    console.error('Error al verificar autenticación:', error);
    cerrarSesion();
  }
}

/**
 * Cargar datos del usuario en el dashboard
 */
function cargarDatosUsuario(usuario) {
  // Actualizar nombre del usuario
  const nombreUsuario = document.getElementById('nombreUsuario');
  if (nombreUsuario) {
    nombreUsuario.textContent = `${usuario.nombre} ${usuario.apellido || ''}`.trim();
  }
  
  // Actualizar email
  const emailUsuario = document.getElementById('emailUsuario');
  if (emailUsuario) {
    emailUsuario.textContent = usuario.email;
  }
  
  // Actualizar tipo de usuario
  const tipoUsuario = document.getElementById('tipoUsuario');
  if (tipoUsuario) {
    const tipos = {
      'super_admin': 'Super Administrador',
      'admin_empresa': 'Administrador',
      'usuario': 'Usuario',
      'soporte': 'Soporte'
    };
    tipoUsuario.textContent = tipos[usuario.tipo_usuario] || usuario.tipo_usuario;
  }
  
  console.log('Dashboard cargado para:', usuario);
  
  // Cargar empresas del usuario
  cargarEmpresas(usuario.id);
}

/**
 * Cargar empresas del usuario
 */
async function cargarEmpresas(usuarioId) {
  const token = localStorage.getItem('token');
  const companySelector = document.getElementById('companySelector');
  
  if (!companySelector) return;
  
  try {
    const response = await fetch(`${API_URL}/empresas/usuario/${usuarioId}`, {
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
      const empresaGuardada = localStorage.getItem('empresaActiva');
      if (empresaGuardada) {
        const empresaObj = JSON.parse(empresaGuardada);
        companySelector.value = empresaObj.id;
      } else {
        companySelector.value = data.data[0].id;
        localStorage.setItem('empresaActiva', JSON.stringify(data.data[0]));
      }
      
      // Cargar estadísticas de la empresa seleccionada
      cargarEstadisticas(companySelector.value);
      
      // Event listener para cambio de empresa
      companySelector.addEventListener('change', (e) => {
        const empresaId = e.target.value;
        const empresaSeleccionada = data.data.find(emp => emp.id == empresaId);
        localStorage.setItem('empresaActiva', JSON.stringify(empresaSeleccionada));
        cargarEstadisticas(empresaId);
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
 * Cargar estadísticas del dashboard
 */
async function cargarEstadisticas(empresaId) {
  const token = localStorage.getItem('token');
  
  try {
    const response = await fetch(`${API_URL}/dashboard/stats?empresaId=${empresaId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      actualizarCards(data.data);
      actualizarVentasMensuales(data.data.ventasMensuales);
      actualizarTopProductos(data.data.topProductos);
      actualizarUltimasVentas(data.data.ultimasVentas);
    }
    
  } catch (error) {
    console.error('Error al cargar estadísticas:', error);
  }
}

/**
 * Actualizar cards de estadísticas
 */
function actualizarCards(stats) {
  // Buscar elementos en el DOM y actualizar
  const elementos = document.querySelectorAll('[data-stat]');
  
  elementos.forEach(elemento => {
    const statType = elemento.getAttribute('data-stat');
    
    switch(statType) {
      case 'ventas':
        elemento.textContent = `$${stats.ventasDelMes.total.toLocaleString()}`;
        break;
      case 'facturas':
        elemento.textContent = stats.facturasEmitidas.total;
        break;
      case 'productos':
        elemento.textContent = stats.productosEnStock.total;
        break;
      case 'clientes':
        elemento.textContent = stats.clientesActivos.total;
        break;
    }
  });
}

/**
 * Actualizar gráfico de ventas mensuales
 */
function actualizarVentasMensuales(ventas) {
  console.log('Ventas mensuales:', ventas);
  // TODO: Implementar gráfico con Chart.js
}

/**
 * Actualizar top productos
 */
function actualizarTopProductos(productos) {
  console.log('Top productos:', productos);
  // TODO: Implementar tabla de productos
}

/**
 * Actualizar últimas ventas
 */
function actualizarUltimasVentas(ventas) {
  console.log('Últimas ventas:', ventas);
  // TODO: Implementar tabla de ventas
}

/**
 * Cerrar sesión
 */
function cerrarSesion() {
  const token = localStorage.getItem('token');
  
  // Llamar al endpoint de logout (opcional, JWT es stateless)
  if (token) {
    fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).catch(err => console.error('Error en logout:', err));
  }
  
  // Limpiar localStorage
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  
  // Redirigir al login
  window.location.href = 'login.html';
}

// Event listener para botón de cerrar sesión
const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
  btnLogout.addEventListener('click', (e) => {
    e.preventDefault();
    cerrarSesion();
  });
}

// Event listeners para todos los botones de logout
document.querySelectorAll('[data-logout]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    cerrarSesion();
  });
});
