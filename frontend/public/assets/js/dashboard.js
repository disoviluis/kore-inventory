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
