/**
 * =================================
 * KORE INVENTORY - DASHBOARD SCRIPT
 * JavaScript para dashboard principal
 * =================================
 */

const API_URL = 'http://localhost:3000/api';

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
