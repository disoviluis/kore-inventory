/**
 * =================================
 * KORE INVENTORY - DASHBOARD SCRIPT
 * JavaScript para dashboard principal
 * =================================
 */

const API_URL = 'http://18.191.181.99:3000/api';

/**
 * Mostrar mensaje de error
 */
function mostrarError(mensaje) {
  console.error(mensaje);
  alert(mensaje);
}

/**
 * Mostrar mensaje de éxito
 */
function mostrarExito(mensaje) {
  console.log(mensaje);
  alert(mensaje);
}

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
  
  // Mostrar sección PLATAFORMA solo para super_admin
  const plataformaSection = document.getElementById('plataformaSection');
  if (plataformaSection && usuario.tipo_usuario === 'super_admin') {
    plataformaSection.style.display = 'block';
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
    // Cargar estadísticas y actividad en paralelo
    const [statsResponse, actividadResponse] = await Promise.all([
      fetch(`${API_URL}/dashboard/stats?empresaId=${empresaId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }),
      fetch(`${API_URL}/dashboard/actividad?empresaId=${empresaId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
    ]);
    
    const statsData = await statsResponse.json();
    const actividadData = await actividadResponse.json();
    
    if (statsData.success) {
      actualizarCards(statsData.data);
      actualizarVentasMensuales(statsData.data.ventasMensuales);
      actualizarTopProductos(statsData.data.topProductos);
      actualizarUltimasVentas(statsData.data.ultimasVentas);
    }
    
    if (actividadData.success) {
      actualizarActividadReciente(actividadData.data);
    }
    
  } catch (error) {
    console.error('Error al cargar estadísticas:', error);
  }
}

/**
 * Actualizar cards de estadísticas
 */
function actualizarCards(stats) {
  console.log('📊 Actualizando estadísticas del dashboard:', stats);
  
  // Función auxiliar para actualizar porcentaje con color
  const actualizarPorcentaje = (elementId, porcentaje) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // Si el porcentaje es 100% o más, significa que el mes anterior fue 0
    // En ese caso, mejor mostrar "Nuevo" en lugar del porcentaje
    if (porcentaje >= 100 && elementId !== 'productosTrend' && elementId !== 'clientesTrend') {
      element.className = 'stat-trend text-primary';
      element.innerHTML = '<i class="bi bi-star-fill"></i> Nuevo';
      return;
    }
    
    const esPositivo = porcentaje > 0;
    const esNegativo = porcentaje < 0;
    const icono = esPositivo ? 'bi-arrow-up' : esNegativo ? 'bi-arrow-down' : 'bi-dash';
    const color = esPositivo ? 'text-success' : esNegativo ? 'text-danger' : 'text-muted';
    
    element.className = `stat-trend ${color}`;
    element.innerHTML = `<i class="bi ${icono}"></i> ${Math.abs(porcentaje)}%`;
  };
  
  // Ventas del mes
  const ventasElement = document.querySelector('[data-stat="ventas"]');
  if (ventasElement && stats.ventasDelMes) {
    const total = Number(stats.ventasDelMes.total) || 0;
    ventasElement.textContent = `$${total.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    actualizarPorcentaje('ventasTrend', stats.ventasDelMes.porcentaje || 0);
  }
  
  // Facturas emitidas
  const facturasElement = document.querySelector('[data-stat="facturas"]');
  if (facturasElement && stats.facturasEmitidas) {
    facturasElement.textContent = Number(stats.facturasEmitidas.total) || 0;
    actualizarPorcentaje('facturasTrend', stats.facturasEmitidas.porcentaje || 0);
  }
  
  // Productos en stock
  const productosElement = document.querySelector('[data-stat="productos"]');
  if (productosElement && stats.productosEnStock) {
    productosElement.textContent = Number(stats.productosEnStock.total) || 0;
    actualizarPorcentaje('productosTrend', stats.productosEnStock.porcentaje || 0);
  }
  
  // Clientes activos
  const clientesElement = document.querySelector('[data-stat="clientes"]');
  if (clientesElement && stats.clientesActivos) {
    clientesElement.textContent = Number(stats.clientesActivos.total) || 0;
    actualizarPorcentaje('clientesTrend', stats.clientesActivos.porcentaje || 0);
  }
  
  console.log('✅ Cards actualizados correctamente');
}

/**
 * Actualizar gráfico de ventas mensuales
 */
let ventasChart = null; // Variable global para el gráfico

function actualizarVentasMensuales(ventas) {
  console.log('📈 Ventas mensuales:', ventas);
  
  const canvas = document.getElementById('salesChart');
  if (!canvas) return;
  
  // Destruir gráfico anterior si existe
  if (ventasChart) {
    ventasChart.destroy();
  }
  
  if (!ventas || ventas.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    ctx.fillText('No hay datos de ventas aún', canvas.width / 2, canvas.height / 2);
    return;
  }
  
  // Preparar datos para el gráfico
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const labels = ventas.map(v => {
    const [year, month] = v.mes.split('-');
    return `${meses[parseInt(month) - 1]} ${year}`;
  });
  const data = ventas.map(v => Number(v.total) || 0);
  
  // Crear el gráfico
  ventasChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Ventas',
        data: data,
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13, 110, 253, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Ventas: $${context.parsed.y.toLocaleString('es-CO')}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '$' + value.toLocaleString('es-CO');
            }
          }
        }
      }
    }
  });
  
  console.log('✅ Gráfico de ventas mensuales actualizado');
}

/**
 * Actualizar actividad reciente
 */
function actualizarActividadReciente(actividades) {
  console.log('📋 Actividad reciente:', actividades);
  
  const container = document.getElementById('actividadRecienteContainer');
  if (!container) return;
  
  if (!actividades || actividades.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-clock-history display-4 d-block mb-3 opacity-25"></i>
        <p class="mb-0">Sin actividad reciente</p>
        <small>Las actividades aparecerán aquí</small>
      </div>
    `;
    return;
  }
  
  const html = actividades.map(actividad => {
    const fecha = new Date(actividad.fecha);
    const ahora = new Date();
    const diff = ahora - fecha;
    const minutos = Math.floor(diff / 60000);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);
    
    let tiempoTexto;
    if (minutos < 1) tiempoTexto = 'Ahora';
    else if (minutos < 60) tiempoTexto = `Hace ${minutos}m`;
    else if (horas < 24) tiempoTexto = `Hace ${horas}h`;
    else tiempoTexto = `Hace ${dias}d`;
    
    let icono, color;
    switch(actividad.tipo) {
      case 'venta':
        icono = 'bi-cart-check';
        color = 'text-success';
        break;
      case 'producto':
        icono = 'bi-box-seam';
        color = 'text-primary';
        break;
      case 'cliente':
        icono = 'bi-person-plus';
        color = 'text-info';
        break;
      default:
        icono = 'bi-circle-fill';
        color = 'text-secondary';
    }
    
    return `
      <div class="d-flex align-items-start mb-3 pb-3 border-bottom">
        <div class="flex-shrink-0">
          <div class="avatar-sm bg-light rounded-circle d-flex align-items-center justify-content-center">
            <i class="bi ${icono} ${color}"></i>
          </div>
        </div>
        <div class="flex-grow-1 ms-3">
          <p class="mb-1 small">${actividad.descripcion}</p>
          <small class="text-muted">${tiempoTexto}</small>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html;
  console.log('✅ Actividad reciente actualizada');
}

/**
 * Actualizar top productos
 */
function actualizarTopProductos(productos) {
  console.log('🏆 Top productos:', productos);
  
  const container = document.getElementById('topProductosContainer');
  if (!container) return;
  
  if (!productos || productos.length === 0) {
    container.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-box-seam display-4 d-block mb-3 opacity-25"></i>
        <p class="mb-0">No hay productos vendidos aún</p>
        <small>Los productos más vendidos aparecerán aquí</small>
      </div>
    `;
    return;
  }
  
  const html = productos.map((producto, index) => {
    const totalVendido = Number(producto.total_vendido) || 0;
    const totalIngresos = Number(producto.total_ingresos) || 0;
    
    return `
      <div class="d-flex align-items-center mb-3 pb-3 border-bottom">
        <div class="flex-shrink-0">
          <div class="avatar-sm bg-light rounded d-flex align-items-center justify-content-center">
            <span class="fw-bold text-primary">${index + 1}</span>
          </div>
        </div>
        <div class="flex-grow-1 ms-3">
          <h6 class="mb-1">${producto.nombre}</h6>
          <small class="text-muted">${producto.sku || 'Sin SKU'}</small>
        </div>
        <div class="text-end">
          <div class="fw-bold">${totalVendido} und</div>
          <small class="text-success">$${totalIngresos.toLocaleString('es-CO')}</small>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html;
  console.log('✅ Top productos actualizados');
}

/**
 * Actualizar últimas ventas
 */
function actualizarUltimasVentas(ventas) {
  console.log('🛒 Últimas ventas:', ventas);
  
  const tbody = document.querySelector('.table tbody');
  if (!tbody) return;
  
  if (!ventas || ventas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5 text-muted">
          <i class="bi bi-receipt display-4 d-block mb-3 opacity-25"></i>
          <p class="mb-0">No hay ventas registradas aún</p>
          <small>Las ventas aparecerán aquí una vez que se registren</small>
        </td>
      </tr>
    `;
    return;
  }
  
  const html = ventas.map(venta => {
    const fecha = new Date(venta.fecha_venta);
    const fechaFormateada = fecha.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const total = Number(venta.total) || 0;
    const estadoBadge = venta.estado === 'pagada' 
      ? '<span class="badge bg-success">Pagada</span>'
      : venta.estado === 'pendiente'
      ? '<span class="badge bg-warning">Pendiente</span>'
      : '<span class="badge bg-danger">Anulada</span>';
    
    return `
      <tr>
        <td><strong>${venta.numero_factura || 'N/A'}</strong></td>
        <td>
          ${venta.cliente_nombre || 'N/A'}
          ${venta.cliente_documento ? `<br><small class="text-muted">${venta.cliente_documento}</small>` : ''}
        </td>
        <td><small>${fechaFormateada}</small></td>
        <td><strong>$${total.toLocaleString('es-CO')}</strong></td>
        <td>${estadoBadge}</td>
        <td>
          <a href="ventas-historial.html" class="btn btn-sm btn-outline-primary" title="Ver detalle">
            <i class="bi bi-eye"></i>
          </a>
        </td>
      </tr>
    `;
  }).join('');
  
  tbody.innerHTML = html;
  console.log('✅ Últimas ventas actualizadas');
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

// ============================================
// SIDEBAR TOGGLE (MOBILE)
// ============================================

// Toggle sidebar para todas las resoluciones (móvil y PC)
const toggleSidebar = document.getElementById('toggleSidebar');
if (toggleSidebar) {
  toggleSidebar.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const mainContent = document.querySelector('.main-content');
    
    if (window.innerWidth >= 992) {
      // En desktop: colapsar sidebar
      if (sidebar) sidebar.classList.toggle('collapsed');
      if (mainContent) mainContent.classList.toggle('expanded');
    } else {
      // En móvil: mostrar con overlay
      if (sidebar) sidebar.classList.toggle('active');
      if (overlay) overlay.classList.toggle('active');
    }
  });
}

// Cerrar sidebar (solo móvil)
const closeSidebar = document.getElementById('closeSidebar');
if (closeSidebar) {
  closeSidebar.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  });
}

// Cerrar sidebar al hacer click en el overlay (solo móvil)
const sidebarOverlay = document.getElementById('sidebarOverlay');
if (sidebarOverlay) {
  sidebarOverlay.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
  });
}

// Manejar redimensionamiento de ventana
window.addEventListener('resize', () => {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const mainContent = document.querySelector('.main-content');
  
  if (window.innerWidth >= 992) {
    // Limpiar clases de móvil
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  } else {
    // Limpiar clases de desktop
    if (sidebar) sidebar.classList.remove('collapsed');
    if (mainContent) mainContent.classList.remove('expanded');
  }
});

// ============================================
// NAVIGATION - MODULE SWITCHING
// ============================================

/**
 * Cambiar entre módulos del dashboard
 */
function cambiarModulo(nombreModulo) {
  // Ocultar todos los módulos
  const modulos = document.querySelectorAll('.module-content');
  modulos.forEach(modulo => {
    modulo.style.display = 'none';
  });
  
  // Mostrar el módulo seleccionado
  const moduloActivo = document.getElementById(`${nombreModulo}Module`);
  if (moduloActivo) {
    moduloActivo.style.display = 'block';
    
    // Inicializar el módulo según corresponda
    switch(nombreModulo) {
      case 'dashboard':
        // Ya se carga automáticamente
        break;
      case 'empresas':
        // Cargar módulo Super Admin - Empresas
        cargarEmpresasSuperAdmin();
        break;
      case 'usuarios':
        // Cargar módulo Super Admin - Usuarios
        cargarUsuarios();
        break;
      case 'planes':
        // Cargar módulo Super Admin - Planes y Licencias
        cargarPlanes();
        break;
      case 'productos':
        if (typeof cargarProductos === 'function') {
          cargarProductos();
        }
        break;
      // Agregar más módulos según se implementen
    }
    
    // Actualizar breadcrumb si existe
    actualizarBreadcrumb(nombreModulo);
  }
  
  // Cerrar sidebar en móvil al cambiar de módulo
  if (window.innerWidth < 992) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  }
}

/**
 * Actualizar breadcrumb
 */
function actualizarBreadcrumb(nombreModulo) {
  const breadcrumb = document.querySelector('.breadcrumb');
  if (!breadcrumb) return;
  
  const nombreModulos = {
    'dashboard': 'Dashboard',
    'empresas': 'Gestión de Empresas',
    'productos': 'Productos',
    'inventario': 'Inventario',
    'ventas': 'Ventas',
    'compras': 'Compras',
    'clientes': 'Clientes',
    'proveedores': 'Proveedores'
  };
  
  breadcrumb.innerHTML = `
    <li class="breadcrumb-item"><a href="#" onclick="cambiarModulo('dashboard')">Inicio</a></li>
    <li class="breadcrumb-item active">${nombreModulos[nombreModulo] || nombreModulo}</li>
  `;
}

/**
 * Event listeners para navegación por data-module
 */
document.addEventListener('DOMContentLoaded', () => {
  // Configurar navegación por data-module
  const navLinks = document.querySelectorAll('[data-module]');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const moduleName = link.getAttribute('data-module');
      
      // Remover clase active de todos los links
      navLinks.forEach(l => l.classList.remove('active'));
      
      // Agregar clase active al link seleccionado
      link.classList.add('active');
      
      // Cambiar módulo
      cambiarModulo(moduleName);
    });
  });
  
  // Módulo inicial: dashboard
  cambiarModulo('dashboard');
  
  // Event listener para formulario de empresa
  const empresaForm = document.getElementById('empresaForm');
  if (empresaForm) {
    empresaForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await guardarEmpresa();
    });
  }
  
  // Event listener para formulario de usuario
  const usuarioForm = document.getElementById('usuarioForm');
  if (usuarioForm) {
    usuarioForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await guardarUsuario();
    });
  }
  
  // Event listener para formulario de plan
  const planForm = document.getElementById('planForm');
  if (planForm) {
    planForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await guardarPlan();
    });
  }
});

/**
 * ========================================
 * FUNCIONES SUPER ADMIN
 * ========================================
 */

// Guardar empresa (crear o actualizar)
async function guardarEmpresa() {
  const id = document.getElementById('empresaId').value;
  const empresa = {
    nombre: document.getElementById('empresaNombre').value,
    razon_social: document.getElementById('empresaRazonSocial').value,
    nit: document.getElementById('empresaNit').value,
    email: document.getElementById('empresaEmail').value,
    telefono: document.getElementById('empresaTelefono').value,
    tipo_contribuyente: document.getElementById('empresaTipoContribuyente').value,
    direccion: document.getElementById('empresaDireccion').value,
    ciudad: document.getElementById('empresaCiudad').value,
    pais: document.getElementById('empresaPais').value,
    plan_id: parseInt(document.getElementById('empresaPlan').value),
    estado: document.getElementById('empresaEstado').value,
    regimen_tributario: document.getElementById('empresaRegimenTributario').value
  };
  
  try {
    const url = id 
      ? `${API_URL}/super-admin/empresas/${id}`
      : `${API_URL}/super-admin/empresas`;
    
    const response = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(empresa)
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Error al guardar empresa');
    }
    
    mostrarExito(id ? 'Empresa actualizada exitosamente' : 'Empresa creada exitosamente');
    
    // Cerrar modal y recargar lista
    const modal = bootstrap.Modal.getInstance(document.getElementById('empresaModal'));
    modal.hide();
    cargarEmpresasSuperAdmin();
  } catch (error) {
    console.error('Error:', error);
    mostrarError(error.message || 'Error al guardar empresa');
  }
}

// Cargar empresas para Super Admin
async function cargarEmpresasSuperAdmin() {
  try {
    // Cargar métricas del dashboard
    await cargarMetricasSuperAdmin();
    
    // Cargar lista de empresas
    const response = await fetch(`${API_URL}/super-admin/empresas`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) throw new Error('Error al cargar empresas');
    
    const data = await response.json();
    renderizarTablaEmpresas(data.data || []);
  } catch (error) {
    console.error('Error:', error);
    mostrarError('Error al cargar empresas');
  }
}

// Cargar métricas del dashboard Super Admin
async function cargarMetricasSuperAdmin() {
  try {
    const response = await fetch(`${API_URL}/super-admin/dashboard`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) throw new Error('Error al cargar métricas');
    
    const data = await response.json();
    const metrics = data.data;
    
    // Actualizar tarjetas superiores
    if (document.getElementById('metricEmpresasActivas')) {
      document.getElementById('metricEmpresasActivas').textContent = metrics.empresas.activas || 0;
    }
    if (document.getElementById('metricUsuariosActivos')) {
      document.getElementById('metricUsuariosActivos').textContent = metrics.usuarios.activos || 0;
    }
    if (document.getElementById('metricMRR')) {
      document.getElementById('metricMRR').textContent = `$${(metrics.ingresos.mrr || 0).toLocaleString()}`;
    }
    if (document.getElementById('metricLicenciasPorVencer')) {
      document.getElementById('metricLicenciasPorVencer').textContent = metrics.licencias.por_vencer || 0;
    }
    
    // Actualizar estado de empresas
    if (document.getElementById('empresasActivas')) {
      document.getElementById('empresasActivas').textContent = metrics.empresas.activas || 0;
    }
    if (document.getElementById('empresasTrial')) {
      document.getElementById('empresasTrial').textContent = metrics.empresas.en_trial || 0;
    }
    if (document.getElementById('empresasSuspendidas')) {
      document.getElementById('empresasSuspendidas').textContent = metrics.empresas.suspendidas || 0;
    }
    if (document.getElementById('empresasCanceladas')) {
      document.getElementById('empresasCanceladas').textContent = metrics.empresas.canceladas || 0;
    }
  } catch (error) {
    console.error('Error al cargar métricas:', error);
  }
}

// Renderizar tabla de empresas
function renderizarTablaEmpresas(empresas) {
  const tbody = document.getElementById('empresasTableBody');
  if (!tbody) return;

  if (!empresas || empresas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay empresas registradas</td></tr>';
    return;
  }

  tbody.innerHTML = empresas.map(empresa => {
    const estadoBadge = {
      'activa': 'success',
      'trial': 'info',
      'suspendida': 'warning',
      'cancelada': 'danger'
    }[empresa.estado] || 'secondary';

    const estadoTexto = {
      'activa': 'Activa',
      'trial': 'Trial',
      'suspendida': 'Suspendida',
      'cancelada': 'Cancelada'
    }[empresa.estado] || empresa.estado;

    return `
      <tr>
        <td>
          <div class="fw-bold">${empresa.nombre || ''}</div>
          <small class="text-muted">${empresa.nit || 'Sin NIT'}</small>
        </td>
        <td>${empresa.plan_nombre || 'Sin plan'}</td>
        <td>
          <span class="badge bg-${estadoBadge}">
            ${estadoTexto}
          </span>
        </td>
        <td>${empresa.usuarios_activos || 0}</td>
        <td>${empresa.total_productos || 0}</td>
        <td>${new Date(empresa.created_at).toLocaleDateString()}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="verDetalleEmpresa(${empresa.id})" title="Ver detalle">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-sm btn-warning" onclick="editarEmpresa(${empresa.id})" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="eliminarEmpresa(${empresa.id}, '${empresa.nombre}')" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Cargar usuarios para Super Admin
async function cargarUsuarios() {
  try {
    // Cargar métricas del dashboard
    await cargarMetricasUsuarios();
    
    // Cargar lista de usuarios
    const response = await fetch(`${API_URL}/super-admin/usuarios`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) throw new Error('Error al cargar usuarios');
    
    const data = await response.json();
    renderizarTablaUsuarios(data.data || []);
  } catch (error) {
    console.error('Error:', error);
    mostrarError('Error al cargar usuarios');
  }
}

// Cargar métricas de usuarios
async function cargarMetricasUsuarios() {
  try {
    const response = await fetch(`${API_URL}/super-admin/dashboard`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) throw new Error('Error al cargar métricas');
    
    const data = await response.json();
    const metrics = data.data;
    
    // Actualizar tarjetas de métricas del módulo de usuarios
    if (document.getElementById('usuariosModuleTotal')) {
      document.getElementById('usuariosModuleTotal').textContent = metrics.usuarios.total || 0;
    }
    if (document.getElementById('usuariosModuleActivos')) {
      document.getElementById('usuariosModuleActivos').textContent = metrics.usuarios.activos || 0;
    }
    if (document.getElementById('usuariosModuleAdminEmpresas')) {
      document.getElementById('usuariosModuleAdminEmpresas').textContent = metrics.usuarios.admin_empresas || 0;
    }
    if (document.getElementById('usuariosModuleNuevosMes')) {
      document.getElementById('usuariosModuleNuevosMes').textContent = metrics.usuarios.nuevos_mes || 0;
    }
  } catch (error) {
    console.error('Error al cargar métricas de usuarios:', error);
  }
}

// Renderizar tabla de usuarios
function renderizarTablaUsuarios(usuarios) {
  const tbody = document.getElementById('usuariosTableBody');
  if (!tbody) return;

  if (!usuarios || usuarios.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay usuarios registrados</td></tr>';
    return;
  }

  tbody.innerHTML = usuarios.map(usuario => {
    const tipoUsuario = {
      'super_admin': 'Super Admin',
      'admin_empresa': 'Admin Empresa',
      'usuario': 'Usuario',
      'soporte': 'Soporte'
    }[usuario.tipo_usuario] || usuario.tipo_usuario;

    const ultimoLogin = usuario.ultimo_login 
      ? new Date(usuario.ultimo_login).toLocaleDateString() 
      : 'Nunca';

    return `
      <tr>
        <td>
          <div class="fw-bold">${usuario.nombre || ''} ${usuario.apellido || ''}</div>
        </td>
        <td>${usuario.email || ''}</td>
        <td>
          <span class="badge bg-primary">${tipoUsuario}</span>
        </td>
        <td>
          <small>${usuario.empresas || 'Sin asignar'}</small>
        </td>
        <td>
          <span class="badge bg-${usuario.activo ? 'success' : 'danger'}">
            ${usuario.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td>${ultimoLogin}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="verDetalleUsuario(${usuario.id})" title="Ver detalle">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-sm btn-warning" onclick="editarUsuario(${usuario.id})" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="eliminarUsuario(${usuario.id}, '${usuario.email}')" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Cargar planes para Super Admin
async function cargarPlanes() {
  try {
    const [planesResponse, licenciasResponse] = await Promise.all([
      fetch(`${API_URL}/super-admin/planes`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      }),
      fetch(`${API_URL}/super-admin/licencias`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
    ]);

    if (!planesResponse.ok) throw new Error('Error al cargar planes');
    if (!licenciasResponse.ok) throw new Error('Error al cargar licencias');
    
    const planesData = await planesResponse.json();
    const licenciasData = await licenciasResponse.json();
    
    renderizarTablaPlanes(planesData.data || []);
    renderizarTablaLicencias(licenciasData.data || []);
  } catch (error) {
    console.error('Error:', error);
    mostrarError('Error al cargar planes y licencias');
  }
}

// Renderizar tabla de planes
function renderizarTablaPlanes(planes) {
  const tbody = document.getElementById('planesTableBody');
  if (!tbody) return;

  if (!planes || planes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay planes registrados</td></tr>';
    return;
  }

  tbody.innerHTML = planes.map(plan => `
    <tr>
      <td>${plan.id}</td>
      <td>${plan.nombre || ''}</td>
      <td>$${parseFloat(plan.precio_mensual || 0).toLocaleString()}</td>
      <td>${plan.max_usuarios_por_empresa || 'Ilimitado'}</td>
      <td>
        <span class="badge bg-${plan.activo ? 'success' : 'danger'}">
          ${plan.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="verDetallePlan(${plan.id})">
          <i class="bi bi-eye"></i>
        </button>
        <button class="btn btn-sm btn-warning" onclick="editarPlan(${plan.id})">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="eliminarPlan(${plan.id}, '${plan.nombre}')">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// Renderizar tabla de licencias
function renderizarTablaLicencias(licencias) {
  const tbody = document.getElementById('licenciasTableBody');
  if (!tbody) return;

  if (!licencias || licencias.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay licencias registradas</td></tr>';
    return;
  }

  tbody.innerHTML = licencias.map(licencia => {
    const diasRestantes = licencia.dias_restantes || 0;
    let estadoBadge = 'success';
    if (diasRestantes < 0) estadoBadge = 'danger';
    else if (diasRestantes <= 15) estadoBadge = 'warning';

    return `
      <tr>
        <td>${licencia.id}</td>
        <td>${licencia.empresa_nombre || ''}</td>
        <td>${licencia.plan_nombre || ''}</td>
        <td>${new Date(licencia.fecha_inicio).toLocaleDateString()}</td>
        <td>${new Date(licencia.fecha_fin).toLocaleDateString()}</td>
        <td>
          <span class="badge bg-${estadoBadge}">
            ${diasRestantes < 0 ? 'Vencida' : diasRestantes === 0 ? 'Vence hoy' : `${diasRestantes} días`}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// Placeholders para funciones de detalle/edición (implementar más tarde)
// ========================================
// FUNCIONES PARA EMPRESAS (SUPER ADMIN)
// ========================================

async function verDetalleEmpresa(id) {
  try {
    const response = await fetch(`${API_URL}/super-admin/empresas/${id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Error al cargar empresa');
    const data = await response.json();
    const empresa = data.data;
    
    // Mostrar modal con detalles
    const modalHtml = `
      <div class="modal fade" id="detalleEmpresaModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Detalle de Empresa</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <strong>Nombre:</strong><br>${empresa.nombre}
                </div>
                <div class="col-md-6">
                  <strong>NIT:</strong><br>${empresa.nit || 'N/A'}
                </div>
                <div class="col-md-6">
                  <strong>Email:</strong><br>${empresa.email}
                </div>
                <div class="col-md-6">
                  <strong>Teléfono:</strong><br>${empresa.telefono || 'N/A'}
                </div>
                <div class="col-md-12">
                  <strong>Dirección:</strong><br>${empresa.direccion || 'N/A'}
                </div>
                <div class="col-md-6">
                  <strong>Ciudad:</strong><br>${empresa.ciudad || 'N/A'}
                </div>
                <div class="col-md-6">
                  <strong>País:</strong><br>${empresa.pais}
                </div>
                <div class="col-md-6">
                  <strong>Plan:</strong><br>${empresa.plan_nombre}
                </div>
                <div class="col-md-6">
                  <strong>Estado:</strong><br>
                  <span class="badge bg-${empresa.estado === 'activa' ? 'success' : 'warning'}">${empresa.estado}</span>
                </div>
                <div class="col-md-12">
                  <strong>Fecha de Registro:</strong><br>${new Date(empresa.created_at).toLocaleString()}
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Remover modal anterior si existe
    const oldModal = document.getElementById('detalleEmpresaModal');
    if (oldModal) oldModal.remove();
    
    // Agregar y mostrar nuevo modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('detalleEmpresaModal'));
    modal.show();
    
    // Limpiar al cerrar
    document.getElementById('detalleEmpresaModal').addEventListener('hidden.bs.modal', function() {
      this.remove();
    });
  } catch (error) {
    console.error('Error:', error);
    mostrarError('Error al cargar detalle de empresa');
  }
}

function editarEmpresa(id) {
  // Abrir modal de empresa para edición
  abrirModalEmpresa(id);
}

async function eliminarEmpresa(id, nombre) {
  if (!confirm(`¿Está seguro de eliminar la empresa "${nombre}"?\n\nEsta acción no se puede deshacer.`)) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/super-admin/empresas/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Error al eliminar empresa');
    
    mostrarExito('Empresa eliminada exitosamente');
    cargarEmpresasSuperAdmin(); // Recargar lista
  } catch (error) {
    console.error('Error:', error);
    mostrarError('Error al eliminar empresa');
  }
}

function abrirModalEmpresa(empresaId = null) {
  const modal = new bootstrap.Modal(document.getElementById('empresaModal'));
  const title = document.getElementById('empresaModalTitle');
  
  // Cargar planes disponibles
  cargarPlanesSelect();
  
  if (empresaId) {
    title.textContent = 'Editar Empresa';
    // Cargar datos de la empresa
    cargarDatosEmpresa(empresaId);
  } else {
    title.textContent = 'Nueva Empresa';
    document.getElementById('empresaForm').reset();
    document.getElementById('empresaId').value = '';
  }
  
  modal.show();
}

async function cargarPlanesSelect() {
  try {
    const response = await fetch(`${API_URL}/super-admin/planes`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Error al cargar planes');
    const data = await response.json();
    
    const select = document.getElementById('empresaPlan');
    select.innerHTML = '<option value="">Seleccionar plan...</option>';
    
    data.data.forEach(plan => {
      if (plan.activo) {
        const option = document.createElement('option');
        option.value = plan.id;
        option.textContent = `${plan.nombre} - $${parseFloat(plan.precio_mensual).toLocaleString()}/mes`;
        select.appendChild(option);
      }
    });
  } catch (error) {
    console.error('Error al cargar planes:', error);
  }
}

async function cargarDatosEmpresa(id) {
  try {
    const response = await fetch(`${API_URL}/super-admin/empresas/${id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Error al cargar empresa');
    const data = await response.json();
    const empresa = data.data;
    
    // Llenar formulario
    document.getElementById('empresaId').value = empresa.id;
    document.getElementById('empresaNombre').value = empresa.nombre;
    document.getElementById('empresaRazonSocial').value = empresa.razon_social || '';
    document.getElementById('empresaNit').value = empresa.nit || '';
    document.getElementById('empresaEmail').value = empresa.email;
    document.getElementById('empresaTelefono').value = empresa.telefono || '';
    document.getElementById('empresaTipoContribuyente').value = empresa.tipo_contribuyente;
    document.getElementById('empresaDireccion').value = empresa.direccion || '';
    document.getElementById('empresaCiudad').value = empresa.ciudad || '';
    document.getElementById('empresaPais').value = empresa.pais;
    document.getElementById('empresaPlan').value = empresa.plan_id;
    document.getElementById('empresaEstado').value = empresa.estado;
    document.getElementById('empresaRegimenTributario').value = empresa.regimen_tributario;
  } catch (error) {
    console.error('Error:', error);
    mostrarError('Error al cargar datos de empresa');
  }
}

// ========================================
// FUNCIONES PARA USUARIOS (SUPER ADMIN)
// ========================================

async function verDetalleUsuario(id) {
  try {
    const response = await fetch(`${API_URL}/super-admin/usuarios/${id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Error al cargar usuario');
    const data = await response.json();
    const usuario = data.data;
    
    const modalHtml = `
      <div class="modal fade" id="detalleUsuarioModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Detalle de Usuario</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <strong>Nombre:</strong><br>${usuario.nombre} ${usuario.apellido || ''}
                </div>
                <div class="col-md-6">
                  <strong>Email:</strong><br>${usuario.email}
                </div>
                <div class="col-md-6">
                  <strong>Teléfono:</strong><br>${usuario.telefono || 'N/A'}
                </div>
                <div class="col-md-6">
                  <strong>Tipo de Usuario:</strong><br>
                  <span class="badge bg-primary">${usuario.tipo_usuario}</span>
                </div>
                <div class="col-md-6">
                  <strong>Estado:</strong><br>
                  <span class="badge bg-${usuario.activo ? 'success' : 'danger'}">
                    ${usuario.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div class="col-md-6">
                  <strong>Último Login:</strong><br>${usuario.ultimo_login ? new Date(usuario.ultimo_login).toLocaleString() : 'Nunca'}
                </div>
                <div class="col-md-12">
                  <strong>Empresas Asignadas:</strong><br>${usuario.empresas || 'Sin asignar'}
                </div>
                <div class="col-md-12">
                  <strong>Fecha de Registro:</strong><br>${new Date(usuario.created_at).toLocaleString()}
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    const oldModal = document.getElementById('detalleUsuarioModal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('detalleUsuarioModal'));
    modal.show();
    
    document.getElementById('detalleUsuarioModal').addEventListener('hidden.bs.modal', function() {
      this.remove();
    });
  } catch (error) {
    console.error('Error:', error);
    mostrarError('Error al cargar detalle de usuario');
  }
}

function editarUsuario(id) {
  abrirModalUsuario(id);
}

async function eliminarUsuario(id, email) {
  if (!confirm(`¿Está seguro de eliminar el usuario "${email}"?\n\nEsta acción no se puede deshacer.`)) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/super-admin/usuarios/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Error al eliminar usuario');
    
    mostrarExito('Usuario eliminado exitosamente');
    cargarUsuarios(); // Recargar lista
  } catch (error) {
    console.error('Error:', error);
    mostrarError('Error al eliminar usuario');
  }
}

// ========================================
// FUNCIONES PARA PLANES (SUPER ADMIN)
// ========================================

async function verDetallePlan(id) {
  try {
    const response = await fetch(`${API_URL}/super-admin/planes/${id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Error al cargar plan');
    const data = await response.json();
    const plan = data.data;
    
    const modalHtml = `
      <div class="modal fade" id="detallePlanModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Detalle del Plan</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-12">
                  <h5>${plan.nombre}</h5>
                  <p class="text-muted">${plan.descripcion || 'Sin descripción'}</p>
                </div>
                <div class="col-md-6">
                  <strong>Precio Mensual:</strong><br>$${parseFloat(plan.precio_mensual).toLocaleString()}
                </div>
                <div class="col-md-6">
                  <strong>Precio Anual:</strong><br>$${plan.precio_anual ? parseFloat(plan.precio_anual).toLocaleString() : 'N/A'}
                </div>
                <div class="col-md-6">
                  <strong>Máx. Usuarios por Empresa:</strong><br>${plan.max_usuarios_por_empresa || 'Ilimitado'}
                </div>
                <div class="col-md-6">
                  <strong>Máx. Productos:</strong><br>${plan.max_productos || 'Ilimitado'}
                </div>
                <div class="col-md-6">
                  <strong>Máx. Facturas/Mes:</strong><br>${plan.max_facturas_mes || 'Ilimitado'}
                </div>
                <div class="col-md-6">
                  <strong>Soporte:</strong><br>${plan.soporte_nivel}
                </div>
                <div class="col-md-6">
                  <strong>Estado:</strong><br>
                  <span class="badge bg-${plan.activo ? 'success' : 'danger'}">
                    ${plan.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div class="col-md-6">
                  <strong>Empresas usando este plan:</strong><br>${plan.empresas_activas || 0}
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    const oldModal = document.getElementById('detallePlanModal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('detallePlanModal'));
    modal.show();
    
    document.getElementById('detallePlanModal').addEventListener('hidden.bs.modal', function() {
      this.remove();
    });
  } catch (error) {
    console.error('Error:', error);
    mostrarError('Error al cargar detalle del plan');
  }
}

function editarPlan(id) {
  abrirModalPlan(id);
}

async function eliminarPlan(id, nombre) {
  if (!confirm(`¿Está seguro de eliminar el plan "${nombre}"?\n\nSolo se puede eliminar si no tiene empresas asociadas.`)) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/super-admin/planes/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Error al eliminar plan');
    }
    
    mostrarExito('Plan eliminado exitosamente');
    cargarPlanes(); // Recargar lista
  } catch (error) {
    console.error('Error:', error);
    mostrarError(error.message || 'Error al eliminar plan');
  }
}

// Abrir modal de usuario (crear o editar)
function abrirModalUsuario(usuarioId = null) {
  const modal = new bootstrap.Modal(document.getElementById('usuarioModal'));
  const title = document.getElementById('usuarioModalTitle');
  const passwordRequired = document.querySelectorAll('#passwordRequired, #passwordConfirmRequired');
  
  // Cargar empresas disponibles
  cargarEmpresasSelect();
  
  if (usuarioId) {
    title.textContent = 'Editar Usuario';
    // En modo edición, la contraseña es opcional
    passwordRequired.forEach(el => el.style.display = 'none');
    document.getElementById('usuarioPassword').removeAttribute('required');
    document.getElementById('usuarioPasswordConfirm').removeAttribute('required');
    cargarDatosUsuarioAdmin(usuarioId);
  } else {
    title.textContent = 'Nuevo Usuario';
    // En modo creación, la contraseña es requerida
    passwordRequired.forEach(el => el.style.display = 'inline');
    document.getElementById('usuarioPassword').setAttribute('required', 'required');
    document.getElementById('usuarioPasswordConfirm').setAttribute('required', 'required');
    document.getElementById('usuarioForm').reset();
    document.getElementById('usuarioId').value = '';
  }
  
  modal.show();
}

async function cargarEmpresasSelect() {
  try {
    const response = await fetch(`${API_URL}/super-admin/empresas`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Error al cargar empresas');
    const data = await response.json();
    
    const select = document.getElementById('usuarioEmpresaDefault');
    select.innerHTML = '<option value="">Sin empresa asignada</option>';
    
    data.data.forEach(empresa => {
      if (empresa.estado === 'activa') {
        const option = document.createElement('option');
        option.value = empresa.id;
        option.textContent = empresa.nombre;
        select.appendChild(option);
      }
    });
  } catch (error) {
    console.error('Error al cargar empresas:', error);
  }
}

async function cargarDatosUsuarioAdmin(id) {
  try {
    const response = await fetch(`${API_URL}/super-admin/usuarios/${id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Error al cargar usuario');
    const data = await response.json();
    const usuario = data.data;
    
    document.getElementById('usuarioId').value = usuario.id;
    document.getElementById('usuarioNombre').value = usuario.nombre;
    document.getElementById('usuarioApellido').value = usuario.apellido || '';
    document.getElementById('usuarioEmail').value = usuario.email;
    document.getElementById('usuarioTelefono').value = usuario.telefono || '';
    document.getElementById('usuarioTipo').value = usuario.tipo_usuario;
    document.getElementById('usuarioActivo').value = usuario.activo ? '1' : '0';
    document.getElementById('usuarioEmpresaDefault').value = usuario.empresa_id_default || '';
  } catch (error) {
    console.error('Error:', error);
    mostrarError('Error al cargar datos de usuario');
  }
}

// Nota: cargarDatosUsuario (sin Admin) se usa en verificarAutenticacion para el usuario logueado

async function guardarUsuario() {
  const id = document.getElementById('usuarioId').value;
  const password = document.getElementById('usuarioPassword').value;
  const passwordConfirm = document.getElementById('usuarioPasswordConfirm').value;
  
  // Validar contraseñas si se proporcionaron
  if (password || passwordConfirm) {
    if (password !== passwordConfirm) {
      mostrarError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      mostrarError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
  }
  
  // Si es creación nueva, la contraseña es requerida
  if (!id && !password) {
    mostrarError('La contraseña es requerida para nuevos usuarios');
    return;
  }
  
  const usuario = {
    nombre: document.getElementById('usuarioNombre').value,
    apellido: document.getElementById('usuarioApellido').value,
    email: document.getElementById('usuarioEmail').value,
    telefono: document.getElementById('usuarioTelefono').value,
    tipo_usuario: document.getElementById('usuarioTipo').value,
    activo: parseInt(document.getElementById('usuarioActivo').value),
    empresa_id_default: document.getElementById('usuarioEmpresaDefault').value || null
  };
  
  // Solo incluir password si se proporcionó
  if (password) {
    usuario.password = password;
  }
  
  try {
    const url = id 
      ? `${API_URL}/super-admin/usuarios/${id}`
      : `${API_URL}/super-admin/usuarios`;
    
    const response = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(usuario)
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Error al guardar usuario');
    }
    
    mostrarExito(id ? 'Usuario actualizado exitosamente' : 'Usuario creado exitosamente');
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('usuarioModal'));
    modal.hide();
    cargarUsuarios();
  } catch (error) {
    console.error('Error:', error);
    mostrarError(error.message || 'Error al guardar usuario');
  }
}

// Abrir modal de plan (crear o editar)
function abrirModalPlan(planId = null) {
  const modal = new bootstrap.Modal(document.getElementById('planModal'));
  const title = document.getElementById('planModalTitle');
  
  if (planId) {
    title.textContent = 'Editar Plan';
    cargarDatosPlan(planId);
  } else {
    title.textContent = 'Nuevo Plan';
    document.getElementById('planForm').reset();
    document.getElementById('planId').value = '';
    // Valores por defecto
    document.getElementById('planActivo').value = '1';
    document.getElementById('planSoporteNivel').value = 'basico';
    document.getElementById('planDuracionTrial').value = '30';
    document.getElementById('planModulosIncluidos').value = '["inventario", "ventas", "compras", "clientes"]';
  }
  
  modal.show();
}

async function cargarDatosPlan(id) {
  try {
    const response = await fetch(`${API_URL}/super-admin/planes/${id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Error al cargar plan');
    const data = await response.json();
    const plan = data.data;
    
    document.getElementById('planId').value = plan.id;
    document.getElementById('planNombre').value = plan.nombre;
    document.getElementById('planDescripcion').value = plan.descripcion || '';
    document.getElementById('planPrecioMensual').value = plan.precio_mensual;
    document.getElementById('planPrecioAnual').value = plan.precio_anual || '';
    document.getElementById('planMaxUsuarios').value = plan.max_usuarios_por_empresa || '';
    document.getElementById('planMaxProductos').value = plan.max_productos || '';
    document.getElementById('planMaxFacturas').value = plan.max_facturas_mes || '';
    document.getElementById('planSoporteNivel').value = plan.soporte_nivel || 'basico';
    document.getElementById('planDuracionTrial').value = plan.duracion_trial_dias || 30;
    document.getElementById('planActivo').value = plan.activo ? '1' : '0';
    
    // Módulos incluidos
    if (plan.modulos_incluidos) {
      document.getElementById('planModulosIncluidos').value = 
        typeof plan.modulos_incluidos === 'string' 
          ? plan.modulos_incluidos 
          : JSON.stringify(plan.modulos_incluidos);
    }
  } catch (error) {
    console.error('Error:', error);
    mostrarError('Error al cargar datos del plan');
  }
}

async function guardarPlan() {
  const id = document.getElementById('planId').value;
  
  // Validar JSON de módulos
  const modulosText = document.getElementById('planModulosIncluidos').value;
  let modulosIncluidos = null;
  if (modulosText) {
    try {
      modulosIncluidos = JSON.parse(modulosText);
    } catch (e) {
      mostrarError('El formato de Módulos Incluidos debe ser un JSON válido');
      return;
    }
  }
  
  const plan = {
    nombre: document.getElementById('planNombre').value,
    descripcion: document.getElementById('planDescripcion').value,
    precio_mensual: parseFloat(document.getElementById('planPrecioMensual').value),
    precio_anual: document.getElementById('planPrecioAnual').value 
      ? parseFloat(document.getElementById('planPrecioAnual').value) 
      : null,
    max_usuarios_por_empresa: document.getElementById('planMaxUsuarios').value 
      ? parseInt(document.getElementById('planMaxUsuarios').value) 
      : null,
    max_productos: document.getElementById('planMaxProductos').value 
      ? parseInt(document.getElementById('planMaxProductos').value) 
      : null,
    max_facturas_mes: document.getElementById('planMaxFacturas').value 
      ? parseInt(document.getElementById('planMaxFacturas').value) 
      : null,
    soporte_nivel: document.getElementById('planSoporteNivel').value,
    duracion_trial_dias: parseInt(document.getElementById('planDuracionTrial').value),
    activo: parseInt(document.getElementById('planActivo').value),
    modulos_incluidos: modulosIncluidos
  };
  
  try {
    const url = id 
      ? `${API_URL}/super-admin/planes/${id}`
      : `${API_URL}/super-admin/planes`;
    
    const response = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(plan)
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Error al guardar plan');
    }
    
    mostrarExito(id ? 'Plan actualizado exitosamente' : 'Plan creado exitosamente');
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('planModal'));
    modal.hide();
    cargarPlanes();
  } catch (error) {
    console.error('Error:', error);
    mostrarError(error.message || 'Error al guardar plan');
  }
}
