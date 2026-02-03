/**
 * =================================
 * KORE INVENTORY - LOGIN SCRIPT
 * JavaScript para manejo de login
 * =================================
 */

// Configuración de la API
const API_URL = 'http://localhost:3000/api';

// Referencias al DOM
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const alertContainer = document.getElementById('alertContainer');
const btnLogin = document.getElementById('btnLogin');
const btnSpinner = document.getElementById('btnSpinner');
const btnText = document.getElementById('btnText');

/**
 * Mostrar alerta
 */
function showAlert(message, type = 'danger') {
  const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
  const iconClass = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
  
  const alertHTML = `
    <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
      <i class="bi ${iconClass} me-2"></i>
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;
  
  alertContainer.innerHTML = alertHTML;
  
  // Auto-cerrar después de 5 segundos
  setTimeout(() => {
    const alert = alertContainer.querySelector('.alert');
    if (alert) {
      alert.classList.remove('show');
      setTimeout(() => alert.remove(), 150);
    }
  }, 5000);
}

/**
 * Cambiar estado del botón de login
 */
function setLoading(isLoading) {
  if (isLoading) {
    btnLogin.disabled = true;
    btnSpinner.classList.remove('d-none');
    btnText.textContent = 'Iniciando sesión...';
  } else {
    btnLogin.disabled = false;
    btnSpinner.classList.add('d-none');
    btnText.textContent = 'Iniciar Sesión';
  }
}

/**
 * Validar formulario
 */
function validateForm() {
  let isValid = true;
  
  // Limpiar validaciones previas
  loginForm.classList.remove('was-validated');
  
  // Validar email
  if (!emailInput.value.trim()) {
    emailInput.classList.add('is-invalid');
    isValid = false;
  } else {
    emailInput.classList.remove('is-invalid');
  }
  
  // Validar password
  if (!passwordInput.value) {
    passwordInput.classList.add('is-invalid');
    isValid = false;
  } else {
    passwordInput.classList.remove('is-invalid');
  }
  
  return isValid;
}

/**
 * Guardar sesión en localStorage
 */
function saveSession(token, usuario) {
  localStorage.setItem('token', token);
  localStorage.setItem('usuario', JSON.stringify(usuario));
}

/**
 * Manejar envío del formulario
 */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Validar formulario
  if (!validateForm()) {
    showAlert('Por favor complete todos los campos correctamente');
    return;
  }
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  try {
    setLoading(true);
    
    // Realizar petición al backend
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Login exitoso
      showAlert(data.message, 'success');
      
      // Guardar sesión
      saveSession(data.data.token, data.data.usuario);
      
      // Mostrar datos del usuario en consola
      console.log('Usuario autenticado:', data.data.usuario);
      
      // Redirigir al dashboard después de 1 segundo
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);
      
    } else {
      // Error de autenticación
      showAlert(data.message || 'Error al iniciar sesión');
    }
    
  } catch (error) {
    console.error('Error al conectar con el servidor:', error);
    showAlert('No se pudo conectar con el servidor. Verifique que el backend esté corriendo.');
  } finally {
    setLoading(false);
  }
});

/**
 * Limpiar validación al escribir
 */
emailInput.addEventListener('input', () => {
  emailInput.classList.remove('is-invalid');
  alertContainer.innerHTML = '';
});

passwordInput.addEventListener('input', () => {
  passwordInput.classList.remove('is-invalid');
  alertContainer.innerHTML = '';
});

/**
 * Verificar si ya hay una sesión activa
 */
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  
  if (token) {
    // Verificar si el token es válido
    verifyToken(token);
  }
});

/**
 * Verificar validez del token
 */
async function verifyToken(token) {
  try {
    const response = await fetch(`${API_URL}/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Token válido, redirigir al dashboard
      window.location.href = 'dashboard.html';
    } else {
      // Token inválido, limpiar localStorage
      localStorage.clear();
    }
  } catch (error) {
    console.error('Error al verificar token:', error);
    localStorage.clear();
  }
}

/**
 * Función para mostrar/ocultar contraseña
 */
const togglePassword = document.getElementById('togglePassword');
if (togglePassword) {
  togglePassword.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    
    const icon = togglePassword.querySelector('i');
    icon.classList.toggle('bi-eye');
    icon.classList.toggle('bi-eye-slash');
  });
}
