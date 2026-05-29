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

// ============================================
// FUNCIONES PARA EMPRESAS - DÍGITO VERIFICACIÓN Y RUES
// ============================================

/**
 * Mostrar/ocultar campo dígito de verificación según tipo de documento
 */
function toggleDigitoVerificacionEmpresa() {
    const tipoDoc = document.getElementById('empresaTipoDocumento')?.value;
    const dvContainer = document.getElementById('empresaDigitoVerificacionContainer');
    const numeroDocContainer = document.getElementById('empresaNumeroDocumentoContainer');
    
    if (!tipoDoc || !dvContainer || !numeroDocContainer) return;
    
    if (tipoDoc === 'NIT') {
        dvContainer.style.display = 'block';
        numeroDocContainer.classList.remove('col-md-8');
        numeroDocContainer.classList.add('col-md-6');
        
        // Auto-calcular si ya hay un número
        autoCalcularDigitoVerificacionEmpresa();
    } else {
        dvContainer.style.display = 'none';
        numeroDocContainer.classList.remove('col-md-6');
        numeroDocContainer.classList.add('col-md-8');
        const dvInput = document.getElementById('empresaDigitoVerificacion');
        if (dvInput) dvInput.value = '';
    }
}

/**
 * Auto-calcula el dígito de verificación cuando el tipo es NIT
 */
function autoCalcularDigitoVerificacionEmpresa() {
    const tipoDoc = document.getElementById('empresaTipoDocumento')?.value;
    if (tipoDoc !== 'NIT') return;
    
    const nitInput = document.getElementById('empresaNit');
    const dvInput = document.getElementById('empresaDigitoVerificacion');
    
    if (!nitInput || !dvInput) return;
    
    const nit = nitInput.value.trim();
    if (!nit || nit.length < 6) {
        dvInput.value = '';
        return;
    }
    
    // Calcular DV
    const dv = calcularDigitoVerificacionDIAN(nit);
    dvInput.value = dv;
}

/**
 * Calcula el dígito de verificación según el algoritmo DIAN
 * @param {string} nit - Número de identificación tributaria sin DV
 * @returns {string} Dígito de verificación (0-9)
 * @see https://www.dian.gov.co - Algoritmo oficial DIAN Colombia
 */
function calcularDigitoVerificacionDIAN(nit) {
    // Eliminar caracteres no numéricos
    const nitLimpio = nit.replace(/\D/g, '');
    
    if (!nitLimpio || nitLimpio.length === 0) return '';
    
    // Pesos para cada posición según DIAN
    // Se aplican de DERECHA a IZQUIERDA sobre el NIT
    const pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
    
    let suma = 0;
    let pesoIndex = 0;
    
    // Multiplicar cada dígito por su peso (de derecha a izquierda del NIT)
    for (let i = nitLimpio.length - 1; i >= 0; i--) {
        if (pesoIndex >= pesos.length) break;
        suma += parseInt(nitLimpio[i]) * pesos[pesoIndex];
        pesoIndex++;
    }
    
    // Obtener el residuo de dividir la suma entre 11
    const residuo = suma % 11;
    
    // Si el residuo es 0 o 1, el DV es 0, de lo contrario DV = 11 - residuo
    if (residuo === 0 || residuo === 1) {
        return '0';
    } else {
        return String(11 - residuo);
    }
}

/**
 * Consulta información empresarial desde RUES
 * Similar a la función en proveedores.js pero adaptada para empresas
 */
async function consultarRUESEmpresa() {
    try {
        const tipoDoc = document.getElementById('empresaTipoDocumento')?.value;
        const numeroDoc = document.getElementById('empresaNit')?.value?.trim();
        const dv = document.getElementById('empresaDigitoVerificacion')?.value?.trim();
        
        // Validar que sea NIT
        if (tipoDoc !== 'NIT') {
            mostrarError('La consulta RUES solo está disponible para NIT');
            return;
        }
        
        if (!numeroDoc) {
            mostrarError('Por favor ingrese el número de NIT');
            return;
        }
        
        // Mostrar spinner
        const btnRUES = document.getElementById('btnConsultarRUESEmpresa');
        const spinner = document.getElementById('spinnerRUESEmpresa');
        if (btnRUES) btnRUES.disabled = true;
        if (spinner) spinner.classList.remove('d-none');
        
        // Construir NIT completo
        const nitCompleto = dv ? `${numeroDoc}-${dv}` : numeroDoc;
        
        // NOTA: Esta es una implementación simulada
        // En producción, aquí iría la llamada a la API RUES real
        // Por ejemplo: const response = await fetch(`${API_URL}/rues/consultar?nit=${nitCompleto}`);
        
        // Simulación con timeout para demostrar funcionalidad
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Datos simulados (en producción vendrían de la API)
        const datosRUES = {
            razon_social: `EMPRESA DEMO ${numeroDoc} S.A.S`,
            representante_legal: 'Juan Pérez Gómez',
            tipo_sociedad: 'SAS',
            matricula_mercantil: `${Math.floor(Math.random() * 1000000)}`,
            camara_comercio: 'Bogotá',
            fecha_matricula: '2020-01-15',
            actividad_economica: '4711 - Comercio al por menor',
            direccion: 'Calle 100 # 10-20',
            ciudad: 'Bogotá',
            telefono: '6011234567'
        };
        
        // Autocompletar campos
        if (datosRUES.razon_social) {
            const razonSocial = document.getElementById('empresaRazonSocial');
            if (razonSocial && !razonSocial.value) razonSocial.value = datosRUES.razon_social;
            
            const nombre = document.getElementById('empresaNombre');
            if (nombre && !nombre.value) nombre.value = datosRUES.razon_social;
        }
        
        if (datosRUES.representante_legal) {
            const repLegal = document.getElementById('empresaRepresentanteLegal');
            if (repLegal) repLegal.value = datosRUES.representante_legal;
        }
        
        if (datosRUES.tipo_sociedad) {
            const tipoSoc = document.getElementById('empresaTipoSociedad');
            if (tipoSoc) tipoSoc.value = datosRUES.tipo_sociedad;
        }
        
        if (datosRUES.matricula_mercantil) {
            const matricula = document.getElementById('empresaMatriculaMercantil');
            if (matricula) matricula.value = datosRUES.matricula_mercantil;
        }
        
        if (datosRUES.camara_comercio) {
            const camara = document.getElementById('empresaCamaraComercio');
            if (camara) camara.value = datosRUES.camara_comercio;
        }
        
        if (datosRUES.fecha_matricula) {
            const fecha = document.getElementById('empresaFechaMatricula');
            if (fecha) fecha.value = datosRUES.fecha_matricula;
        }
        
        if (datosRUES.actividad_economica) {
            const actividad = document.getElementById('empresaActividadEconomica');
            if (actividad) actividad.value = datosRUES.actividad_economica;
        }
        
        if (datosRUES.direccion) {
            const direccion = document.getElementById('empresaDireccion');
            if (direccion && !direccion.value) direccion.value = datosRUES.direccion;
        }
        
        if (datosRUES.ciudad) {
            const ciudad = document.getElementById('empresaCiudad');
            if (ciudad && !ciudad.value) ciudad.value = datosRUES.ciudad;
        }
        
        if (datosRUES.telefono) {
            const telefono = document.getElementById('empresaTelefono');
            if (telefono && !telefono.value) telefono.value = datosRUES.telefono;
        }
        
        mostrarExito('Datos autocompletados desde RUES (simulado)');
        
    } catch (error) {
        console.error('Error en consulta RUES:', error);
        mostrarError('Error al consultar RUES: ' + error.message);
    } finally {
        // Ocultar spinner
        const btnRUES = document.getElementById('btnConsultarRUESEmpresa');
        const spinner = document.getElementById('spinnerRUESEmpresa');
        if (btnRUES) btnRUES.disabled = false;
        if (spinner) spinner.classList.add('d-none');
    }
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
  
  // La configuración de PLATAFORMA ahora se maneja en sidebar-navigation.js
  
  console.log('Dashboard cargado para:', usuario);
  
  // Cargar empresas del usuario
  cargarEmpresas(usuario.id);
}

/**
 * Cargar empresas del usuario
 */
async function cargarEmpresas(usuarioId) {
  const token = localStorage.getItem('token');
  const usuario = JSON.parse(localStorage.getItem('usuario'));
  const companySelector = document.getElementById('companySelector');
  const companyText = document.getElementById('companyText');
  const companyNameText = document.getElementById('companyNameText');
  
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
      // Determinar si mostrar selector o texto según tipo de usuario y cantidad de empresas
      const esUsuarioRegular = usuario.tipo_usuario === 'usuario';
      const esSuperAdmin = usuario.tipo_usuario === 'super_admin';
      const tieneSoloUnaEmpresa = data.data.length === 1;
      
      // Super Admin no usa selector de empresa en navbar (trabaja desde módulos PLATAFORMA)
      if (esSuperAdmin) {
        const companySelectorContainer = document.querySelector('.company-selector');
        if (companySelectorContainer) {
          companySelectorContainer.style.display = 'none';
        }
        // Establecer primera empresa por defecto para módulos que la necesiten
        localStorage.setItem('empresaActiva', JSON.stringify(data.data[0]));
        return;
      }
      
      if (esUsuarioRegular || tieneSoloUnaEmpresa) {
        // Usuario Regular o Admin con 1 sola empresa: mostrar solo texto
        companySelector.style.display = 'none';
        if (companyText) companyText.style.display = 'block';
        if (companyNameText) companyNameText.textContent = data.data[0].nombre;
        
        // Establecer empresa activa (solo ID)
        localStorage.setItem('empresaActiva', data.data[0].id);
        
        // Cargar estadísticas
        cargarEstadisticas(data.data[0].id);
        verificarConfiguracionFacturacion();
      } else {
        // Admin Empresa con múltiples empresas: mostrar selector
        companySelector.style.display = 'block';
        if (companyText) companyText.style.display = 'none';
        
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
        const empresaGuardadaId = localStorage.getItem('empresaActiva');
        
        if (empresaGuardadaId) {
          // Verificar que la empresa guardada existe en la lista
          const empresaExiste = data.data.find(emp => emp.id == empresaGuardadaId);
          if (empresaExiste) {
            companySelector.value = empresaGuardadaId;
            empresaSeleccionadaId = empresaGuardadaId;
          } else {
            // Si no existe, usar la primera empresa
            companySelector.value = data.data[0].id;
            empresaSeleccionadaId = data.data[0].id;
            localStorage.setItem('empresaActiva', data.data[0].id);
          }
        } else {
          // No hay empresa guardada, usar la primera
          companySelector.value = data.data[0].id;
          empresaSeleccionadaId = data.data[0].id;
          localStorage.setItem('empresaActiva', data.data[0].id);
        }
        
        // Cargar estadísticas de la empresa seleccionada
        if (empresaSeleccionadaId) {
          cargarEstadisticas(empresaSeleccionadaId);
          
          // Verificar configuración de facturación después de cargar empresa
          verificarConfiguracionFacturacion();
        }
        
        // Event listener para cambio de empresa
        companySelector.addEventListener('change', (e) => {
          const empresaId = e.target.value;
          const empresaSeleccionada = data.data.find(emp => emp.id == empresaId);
          console.log('🔄 Cambio de empresa detectado:', empresaSeleccionada);
          localStorage.setItem('empresaActiva', empresaId);
          cargarEstadisticas(empresaId);
          verificarConfiguracionFacturacion();
          
          // Recargar el contenido del módulo activo
          const moduloActivo = document.querySelector('.module-content:not([style*="display: none"])');
          if (moduloActivo) {
            const moduloId = moduloActivo.id;
            console.log('🔄 Recargando módulo activo:', moduloId);
            
            // Recargar según el módulo activo
            if (moduloId === 'usuariosModule' && typeof cargarUsuariosEmpresa === 'function') {
              cargarUsuariosEmpresa();
            } else if (moduloId === 'rolesModule' && typeof cargarRoles === 'function') {
              cargarRoles();
            } else if (moduloId === 'impuestosModule' && typeof cargarImpuestos === 'function') {
              cargarImpuestos();
            }
          }
        });
      }
      
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
  // Validar que empresaId existe
  if (!empresaId) {
    console.error('No se puede cargar estadísticas sin empresaId');
    return;
  }
  
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
      case 'usuarios-admin':
        // Cargar módulo Super Admin - Usuarios (todos los usuarios)
        cargarUsuarios();
        break;
      case 'planes':
        // Cargar módulo Super Admin - Planes y Licencias
        cargarPlanes();
        break;
      case 'impuestos':
        // Cargar módulo de Impuestos
        cargarImpuestos();
        break;
      case 'roles':
        // Cargar módulo de Roles y Permisos
        cargarRoles();
        break;
      case 'usuarios':
        // Cargar módulo de Usuarios de Empresa (admin_empresa)
        console.log('🔄 Cambiando a módulo de usuarios...');
        cargarUsuariosEmpresa();
        break;
      case 'productos':
        if (typeof cargarProductos === 'function') {
          cargarProductos();
        }
        break;
      case 'configuracion-global':
        // Cargar módulo Super Admin - Configuración Global (Roles Globales)
        if (typeof cargarRolesGlobales === 'function') {
          cargarRolesGlobales();
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
    'usuarios-admin': 'Gestión de Usuarios',
    'usuarios': 'Gestión de Usuarios',
    'planes': 'Planes y Licencias',
    'roles': 'Roles y Permisos',
    'impuestos': 'Configuración de Impuestos',
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
  
  // Event listeners para empresas - Dígito Verificación y RUES
  const empresaTipoDoc = document.getElementById('empresaTipoDocumento');
  if (empresaTipoDoc) {
    empresaTipoDoc.addEventListener('change', toggleDigitoVerificacionEmpresa);
  }
  
  const empresaNitInput = document.getElementById('empresaNit');
  if (empresaNitInput) {
    empresaNitInput.addEventListener('blur', autoCalcularDigitoVerificacionEmpresa);
    empresaNitInput.addEventListener('input', autoCalcularDigitoVerificacionEmpresa);
  }
  
  const btnConsultarRUESEmpresa = document.getElementById('btnConsultarRUESEmpresa');
  if (btnConsultarRUESEmpresa) {
    btnConsultarRUESEmpresa.addEventListener('click', consultarRUESEmpresa);
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
  
  // Event listeners para filtros de impuestos
  const searchImpuestos = document.getElementById('searchImpuestos');
  if (searchImpuestos) {
    searchImpuestos.addEventListener('input', filtrarImpuestos);
  }
  
  const filterImpuestoTipo = document.getElementById('filterImpuestoTipo');
  if (filterImpuestoTipo) {
    filterImpuestoTipo.addEventListener('change', filtrarImpuestos);
  }
  
  const filterImpuestoActivo = document.getElementById('filterImpuestoActivo');
  if (filterImpuestoActivo) {
    filterImpuestoActivo.addEventListener('change', filtrarImpuestos);
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
  
  // Construir NIT completo con DV si aplica
  const tipoDoc = document.getElementById('empresaTipoDocumento').value;
  const numeroDoc = document.getElementById('empresaNit').value;
  const dv = document.getElementById('empresaDigitoVerificacion').value;
  const nitCompleto = (tipoDoc === 'NIT' && dv) ? `${numeroDoc}-${dv}` : numeroDoc;
  
  const empresa = {
    nombre: document.getElementById('empresaNombre').value,
    razon_social: document.getElementById('empresaRazonSocial').value,
    tipo_documento: tipoDoc,
    nit: nitCompleto,
    digito_verificacion: tipoDoc === 'NIT' ? dv : null,
    email: document.getElementById('empresaEmail').value,
    telefono: document.getElementById('empresaTelefono').value,
    tipo_contribuyente: document.getElementById('empresaTipoContribuyente').value,
    direccion: document.getElementById('empresaDireccion').value,
    ciudad: document.getElementById('empresaCiudad').value,
    pais: document.getElementById('empresaPais').value,
    plan_id: parseInt(document.getElementById('empresaPlan').value),
    estado: document.getElementById('empresaEstado').value,
    regimen_tributario: document.getElementById('empresaRegimenTributario').value,
    // Campos RUES
    representante_legal: document.getElementById('empresaRepresentanteLegal').value || null,
    tipo_sociedad: document.getElementById('empresaTipoSociedad').value || null,
    matricula_mercantil: document.getElementById('empresaMatriculaMercantil').value || null,
    camara_comercio: document.getElementById('empresaCamaraComercio').value || null,
    fecha_matricula: document.getElementById('empresaFechaMatricula').value || null,
    actividad_economica: document.getElementById('empresaActividadEconomica').value || null
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
  const tbody = document.getElementById('usuariosAdminTableBody');
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
    
    // Configurar tipo de documento por defecto (NIT) y mostrar DV
    const tipoDocSelect = document.getElementById('empresaTipoDocumento');
    if (tipoDocSelect) {
      tipoDocSelect.value = 'NIT';
      toggleDigitoVerificacionEmpresa();
    }
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
    
    // Tipo documento y NIT
    document.getElementById('empresaTipoDocumento').value = empresa.tipo_documento || 'NIT';
    
    // Separar NIT y DV si viene con guión
    const nitCompleto = empresa.nit || '';
    let numeroDoc = nitCompleto;
    let dv = '';
    
    if (nitCompleto.includes('-')) {
      const partes = nitCompleto.split('-');
      numeroDoc = partes[0];
      dv = partes[1] || '';
    } else if (empresa.digito_verificacion) {
      dv = empresa.digito_verificacion;
    }
    
    document.getElementById('empresaNit').value = numeroDoc;
    document.getElementById('empresaDigitoVerificacion').value = dv;
    toggleDigitoVerificacionEmpresa(); // Mostrar/ocultar DV según tipo
    
    document.getElementById('empresaEmail').value = empresa.email;
    document.getElementById('empresaTelefono').value = empresa.telefono || '';
    document.getElementById('empresaTipoContribuyente').value = empresa.tipo_contribuyente;
    document.getElementById('empresaDireccion').value = empresa.direccion || '';
    document.getElementById('empresaCiudad').value = empresa.ciudad || '';
    document.getElementById('empresaPais').value = empresa.pais;
    document.getElementById('empresaPlan').value = empresa.plan_id;
    document.getElementById('empresaEstado').value = empresa.estado;
    document.getElementById('empresaRegimenTributario').value = empresa.regimen_tributario;
    
    // Campos RUES
    document.getElementById('empresaRepresentanteLegal').value = empresa.representante_legal || '';
    document.getElementById('empresaTipoSociedad').value = empresa.tipo_sociedad || '';
    document.getElementById('empresaMatriculaMercantil').value = empresa.matricula_mercantil || '';
    document.getElementById('empresaCamaraComercio').value = empresa.camara_comercio || '';
    document.getElementById('empresaFechaMatricula').value = empresa.fecha_matricula || '';
    document.getElementById('empresaActividadEconomica').value = empresa.actividad_economica || '';
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
    // Cargar checkboxes de empresas vacíos (ninguna seleccionada)
    cargarEmpresasCheckboxes([]);
  }
  
  modal.show();
}

async function cargarEmpresasCheckboxes(empresasAsignadas = []) {
  try {
    const response = await fetch(`${API_URL}/super-admin/empresas`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Error al cargar empresas');
    const data = await response.json();
    
    const container = document.getElementById('empresasCheckboxContainer');
    
    const empresasActivas = data.data.filter(e => e.estado === 'activa' || e.estado === 'trial');
    
    if (empresasActivas.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-3"><i class="bi bi-building"></i> No hay empresas disponibles</div>';
      return;
    }
    
    container.innerHTML = empresasActivas.map(empresa => {
      const isChecked = empresasAsignadas.includes(empresa.id);
      return `
        <div class="form-check mb-2">
          <input class="form-check-input" type="checkbox" value="${empresa.id}" 
                 id="empresa_${empresa.id}" ${isChecked ? 'checked' : ''}>
          <label class="form-check-label" for="empresa_${empresa.id}">
            <strong>${empresa.nombre}</strong>
            <span class="badge bg-${empresa.estado === 'trial' ? 'warning' : 'success'} ms-2">
              ${empresa.estado === 'trial' ? 'Trial' : 'Activa'}
            </span>
          </label>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error al cargar empresas:', error);
    const container = document.getElementById('empresasCheckboxContainer');
    container.innerHTML = '<div class="text-danger"><i class="bi bi-exclamation-triangle"></i> Error al cargar empresas</div>';
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
    
    // Obtener IDs de empresas asignadas
    const empresasAsignadas = (usuario.empresas || []).map(e => e.id);
    
    document.getElementById('usuarioId').value = usuario.id;
    document.getElementById('usuarioNombre').value = usuario.nombre;
    document.getElementById('usuarioApellido').value = usuario.apellido || '';
    document.getElementById('usuarioEmail').value = usuario.email;
    document.getElementById('usuarioTelefono').value = usuario.telefono || '';
    document.getElementById('usuarioTipo').value = usuario.tipo_usuario;
    document.getElementById('usuarioActivo').value = usuario.activo ? '1' : '0';
    
    // Cargar checkboxes con empresas asignadas
    await cargarEmpresasCheckboxes(empresasAsignadas);
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
  
  // Obtener empresas seleccionadas
  const checkboxes = document.querySelectorAll('#empresasCheckboxContainer input[type="checkbox"]:checked');
  const empresasSeleccionadas = Array.from(checkboxes).map(cb => parseInt(cb.value));
  
  const usuario = {
    nombre: document.getElementById('usuarioNombre').value,
    apellido: document.getElementById('usuarioApellido').value,
    email: document.getElementById('usuarioEmail').value,
    telefono: document.getElementById('usuarioTelefono').value,
    tipo_usuario: document.getElementById('usuarioTipo').value,
    activo: parseInt(document.getElementById('usuarioActivo').value)
  };
  
  // Solo incluir password si se proporcionó
  if (password) {
    usuario.password = password;
  }
  
  try {
    // 1. Crear o actualizar usuario
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
    
    const userData = await response.json();
    const usuarioId = id || userData.data?.id;
    
    // 2. Gestionar empresas asignadas (si hay empresas seleccionadas)
    if (usuarioId && empresasSeleccionadas.length > 0) {
      // Obtener empresas actuales si es edición
      let empresasActuales = [];
      if (id) {
        const userResponse = await fetch(`${API_URL}/super-admin/usuarios/${id}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (userResponse.ok) {
          const userData = await userResponse.json();
          empresasActuales = (userData.data.empresas || []).map(e => e.id);
        }
      }
      
      // Desasignar empresas que fueron desmarcadas
      const empresasADesasignar = empresasActuales.filter(empId => !empresasSeleccionadas.includes(empId));
      for (const empresaId of empresasADesasignar) {
        await fetch(`${API_URL}/super-admin/usuarios/${usuarioId}/empresas/${empresaId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
      }
      
      // Asignar nuevas empresas
      const empresasAAsignar = empresasSeleccionadas.filter(empId => !empresasActuales.includes(empId));
      for (const empresaId of empresasAAsignar) {
        await fetch(`${API_URL}/super-admin/usuarios/${usuarioId}/empresas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ empresa_id: empresaId })
        });
      }
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
    max_empresas: 1, // Valor por defecto
    max_usuarios_por_empresa: document.getElementById('planMaxUsuarios').value 
      ? parseInt(document.getElementById('planMaxUsuarios').value) 
      : null,
    max_productos: document.getElementById('planMaxProductos').value 
      ? parseInt(document.getElementById('planMaxProductos').value) 
      : null,
    max_facturas_mes: document.getElementById('planMaxFacturas').value 
      ? parseInt(document.getElementById('planMaxFacturas').value) 
      : null,
    modulos_incluidos: modulosIncluidos,
    soporte_nivel: document.getElementById('planSoporteNivel').value,
    api_access: 0, // Valores por defecto para campos booleanos
    white_label: 0,
    reportes_avanzados: 0,
    multi_bodega: 0,
    activo: parseInt(document.getElementById('planActivo').value)
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

// ========================================
// FUNCIONES PARA IMPUESTOS
// ========================================

async function cargarImpuestos() {
  try {
    const empresaId = localStorage.getItem('empresaActiva');
    
    if (!empresaId) {
      mostrarError('No hay empresa seleccionada');
      console.error('No hay empresaId para cargar impuestos. empresaActiva:', empresaId);
      return;
    }

    console.log('Cargando impuestos para empresa:', empresaId);
    const response = await fetch(`${API_URL}/impuestos?empresaId=${empresaId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error response:', response.status, errorData);
      throw new Error(`Error ${response.status}: ${errorData.message || 'Error al cargar impuestos'}`);
    }
    
    const data = await response.json();
    renderizarTablaImpuestos(data.data);
  } catch (error) {
    console.error('Error completo:', error);
    mostrarError('Error al cargar impuestos: ' + error.message);
  }
}

function renderizarTablaImpuestos(impuestos) {
  const tbody = document.getElementById('impuestosTableBody');
  if (!tbody) return;

  if (!impuestos || impuestos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4">
          <i class="bi bi-calculator display-4 d-block mb-3 text-muted opacity-25"></i>
          <p class="text-muted">No hay impuestos configurados</p>
          <button class="btn btn-sm btn-primary" onclick="abrirModalImpuesto()">
            <i class="bi bi-plus-circle me-2"></i>Crear Primer Impuesto
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = impuestos.map(imp => `
    <tr>
      <td><code>${imp.codigo}</code></td>
      <td>${imp.nombre}</td>
      <td>${imp.tipo === 'porcentaje' ? imp.tasa + '%' : '$' + parseFloat(imp.tasa).toLocaleString()}</td>
      <td>
        <span class="badge bg-info">
          ${imp.aplica_sobre === 'subtotal' ? 'Subtotal' : 
            imp.aplica_sobre === 'iva' ? 'IVA' : 'Total'}
        </span>
      </td>
      <td>
        <span class="badge bg-${imp.afecta_total === 'resta' ? 'warning' : 'success'}">
          ${imp.afecta_total === 'resta' ? 'Resta' : 'Suma'}
        </span>
      </td>
      <td>
        ${imp.aplica_automaticamente ? 
          '<i class="bi bi-check-circle-fill text-success" title="Automático"></i>' : 
          '<i class="bi bi-x-circle text-muted" title="Manual"></i>'}
      </td>
      <td>
        <span class="badge bg-${imp.activo ? 'success' : 'secondary'}">
          ${imp.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="verDetalleImpuesto(${imp.id})" title="Ver detalle">
          <i class="bi bi-eye"></i>
        </button>
        <button class="btn btn-sm btn-warning" onclick="editarImpuesto(${imp.id})" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="eliminarImpuesto(${imp.id}, '${imp.nombre}')" title="Eliminar">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function abrirModalImpuesto(impuestoId = null) {
  const modal = new bootstrap.Modal(document.getElementById('impuestoModal'));
  const title = document.getElementById('impuestoModalTitle');
  
  // Listener para cambiar símbolo según tipo
  document.getElementById('impuestoTipo').addEventListener('change', function() {
    document.getElementById('tasaSymbol').textContent = this.value === 'porcentaje' ? '%' : '$';
  });
  
  if (impuestoId) {
    title.textContent = 'Editar Impuesto';
    cargarDatosImpuesto(impuestoId);
  } else {
    title.textContent = 'Nuevo Impuesto';
    document.getElementById('impuestoForm').reset();
    document.getElementById('impuestoId').value = '';
    document.getElementById('impuestoActivo').value = '1';
    document.getElementById('impuestoTipo').value = 'porcentaje';
    document.getElementById('tasaSymbol').textContent = '%';
  }
  
  modal.show();
}

async function cargarDatosImpuesto(id) {
  try {
    const response = await fetch(`${API_URL}/impuestos/${id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Error al cargar impuesto');
    const data = await response.json();
    const imp = data.data;
    
    document.getElementById('impuestoId').value = imp.id;
    document.getElementById('impuestoCodigo').value = imp.codigo;
    document.getElementById('impuestoNombre').value = imp.nombre;
    document.getElementById('impuestoDescripcion').value = imp.descripcion || '';
    document.getElementById('impuestoTipo').value = imp.tipo;
    document.getElementById('impuestoTasa').value = imp.tasa;
    document.getElementById('impuestoOrden').value = imp.orden || 0;
    document.getElementById('impuestoAplicaSobre').value = imp.aplica_sobre;
    document.getElementById('impuestoAfectaTotal').value = imp.afecta_total;
    document.getElementById('impuestoAutomatico').checked = imp.aplica_automaticamente;
    document.getElementById('impuestoRequiereAuth').checked = imp.requiere_autorizacion;
    document.getElementById('impuestoCuentaContable').value = imp.cuenta_contable || '';
    document.getElementById('impuestoActivo').value = imp.activo ? '1' : '0';
    document.getElementById('tasaSymbol').textContent = imp.tipo === 'porcentaje' ? '%' : '$';
    
    // Deshabilitar código en edición
    document.getElementById('impuestoCodigo').setAttribute('readonly', 'readonly');
  } catch (error) {
    console.error('Error:', error);
    mostrarError('Error al cargar datos del impuesto');
  }
}

// Event listener para formulario de impuesto
document.addEventListener('DOMContentLoaded', () => {
  const impuestoForm = document.getElementById('impuestoForm');
  if (impuestoForm) {
    impuestoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await guardarImpuesto();
    });
  }
});

async function guardarImpuesto() {
  const id = document.getElementById('impuestoId').value;
  const empresaId = localStorage.getItem('empresa_activa') || currentEmpresa?.id;
  
  const impuesto = {
    empresa_id: parseInt(empresaId),
    codigo: document.getElementById('impuestoCodigo').value.toUpperCase(),
    nombre: document.getElementById('impuestoNombre').value,
    descripcion: document.getElementById('impuestoDescripcion').value,
    tipo: document.getElementById('impuestoTipo').value,
    tasa: parseFloat(document.getElementById('impuestoTasa').value),
    orden: parseInt(document.getElementById('impuestoOrden').value) || 0,
    aplica_sobre: document.getElementById('impuestoAplicaSobre').value,
    afecta_total: document.getElementById('impuestoAfectaTotal').value,
    aplica_automaticamente: document.getElementById('impuestoAutomatico').checked ? 1 : 0,
    requiere_autorizacion: document.getElementById('impuestoRequiereAuth').checked ? 1 : 0,
    cuenta_contable: document.getElementById('impuestoCuentaContable').value || null,
    activo: parseInt(document.getElementById('impuestoActivo').value)
  };
  
  try {
    const url = id 
      ? `${API_URL}/impuestos/${id}`
      : `${API_URL}/impuestos`;
    
    const response = await fetch(url, {
      method: id ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(impuesto)
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Error al guardar impuesto');
    }
    
    mostrarExito(id ? 'Impuesto actualizado exitosamente' : 'Impuesto creado exitosamente');
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('impuestoModal'));
    modal.hide();
    cargarImpuestos();
    
    // Habilitar código de nuevo para próximas creaciones
    document.getElementById('impuestoCodigo').removeAttribute('readonly');
  } catch (error) {
    console.error('Error:', error);
    mostrarError(error.message || 'Error al guardar impuesto');
  }
}

async function verDetalleImpuesto(id) {
  try {
    const response = await fetch(`${API_URL}/impuestos/${id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) throw new Error('Error al cargar impuesto');
    const data = await response.json();
    const imp = data.data;
    
    const modalHtml = `
      <div class="modal fade" id="detalleImpuestoModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Detalle del Impuesto</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <strong>Código:</strong><br><code>${imp.codigo}</code>
                </div>
                <div class="col-md-6">
                  <strong>Nombre:</strong><br>${imp.nombre}
                </div>
                <div class="col-md-12">
                  <strong>Descripción:</strong><br>${imp.descripcion || 'Sin descripción'}
                </div>
                <div class="col-md-4">
                  <strong>Tipo:</strong><br>${imp.tipo === 'porcentaje' ? 'Porcentaje' : 'Valor Fijo'}
                </div>
                <div class="col-md-4">
                  <strong>Tasa:</strong><br>${imp.tipo === 'porcentaje' ? imp.tasa + '%' : '$' + parseFloat(imp.tasa).toLocaleString()}
                </div>
                <div class="col-md-4">
                  <strong>Orden:</strong><br>${imp.orden}
                </div>
                <div class="col-md-6">
                  <strong>Aplica Sobre:</strong><br>
                  ${imp.aplica_sobre === 'subtotal' ? 'Subtotal' : 
                    imp.aplica_sobre === 'iva' ? 'IVA' : 'Total'}
                </div>
                <div class="col-md-6">
                  <strong>Efecto:</strong><br>
                  <span class="badge bg-${imp.afecta_total === 'resta' ? 'warning' : 'success'}">
                    ${imp.afecta_total === 'resta' ? 'Resta del Total' : 'Suma al Total'}
                  </span>
                </div>
                <div class="col-md-6">
                  <strong>Aplicación Automática:</strong><br>
                  ${imp.aplica_automaticamente ? 
                    '<span class="badge bg-success">Sí</span>' : 
                    '<span class="badge bg-secondary">No</span>'}
                </div>
                <div class="col-md-6">
                  <strong>Requiere Autorización:</strong><br>
                  ${imp.requiere_autorizacion ? 
                    '<span class="badge bg-warning">Sí</span>' : 
                    '<span class="badge bg-secondary">No</span>'}
                </div>
                <div class="col-md-6">
                  <strong>Cuenta Contable:</strong><br>${imp.cuenta_contable || 'No configurada'}
                </div>
                <div class="col-md-6">
                  <strong>Estado:</strong><br>
                  <span class="badge bg-${imp.activo ? 'success' : 'secondary'}">
                    ${imp.activo ? 'Activo' : 'Inactivo'}
                  </span>
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
    
    const oldModal = document.getElementById('detalleImpuestoModal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('detalleImpuestoModal'));
    modal.show();
    
    document.getElementById('detalleImpuestoModal').addEventListener('hidden.bs.modal', function() {
      this.remove();
    });
  } catch (error) {
    console.error('Error:', error);
    mostrarError('Error al cargar detalle del impuesto');
  }
}

function editarImpuesto(id) {
  abrirModalImpuesto(id);
}

async function eliminarImpuesto(id, nombre) {
  if (!confirm(`¿Está seguro de eliminar el impuesto "${nombre}"?\n\nSolo se puede eliminar si no tiene ventas asociadas.`)) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/impuestos/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Error al eliminar impuesto');
    }
    
    mostrarExito('Impuesto eliminado exitosamente');
    cargarImpuestos();
  } catch (error) {
    console.error('Error:', error);
    mostrarError(error.message || 'Error al eliminar impuesto');
  }
}

// Funciones de filtrado para impuestos
function filtrarImpuestos() {
  const searchText = document.getElementById('searchImpuestos')?.value.toLowerCase() || '';
  const tipoFilter = document.getElementById('filterImpuestoTipo')?.value || '';
  const activoFilter = document.getElementById('filterImpuestoActivo')?.value || '';
  
  const rows = document.querySelectorAll('#impuestosTableBody tr');
  
  rows.forEach(row => {
    const codigo = row.cells[0]?.textContent.toLowerCase() || '';
    const nombre = row.cells[1]?.textContent.toLowerCase() || '';
    const tipo = row.cells[2]?.textContent || '';
    const activo = row.cells[6]?.textContent || '';
    
    // Filtro de búsqueda
    const matchSearch = !searchText || codigo.includes(searchText) || nombre.includes(searchText);
    
    // Filtro de tipo
    const matchTipo = !tipoFilter || 
      (tipoFilter === 'porcentaje' && tipo.includes('%')) ||
      (tipoFilter === 'valor_fijo' && tipo.includes('$'));
    
    // Filtro de estado activo
    const matchActivo = !activoFilter || 
      (activoFilter === '1' && activo.includes('Activo')) ||
      (activoFilter === '0' && activo.includes('Inactivo'));
    
    // Mostrar/ocultar fila según filtros
    row.style.display = (matchSearch && matchTipo && matchActivo) ? '' : 'none';
  });
}

// ============================================
// MÓDULO: ROLES Y PERMISOS
// ============================================

let modulosAccionesData = null; // Cache de módulos y acciones
let permisosSeleccionados = []; // IDs de permisos seleccionados

/**
 * Cargar lista de roles
 */
async function cargarRoles() {
  try {
    const empresaActivaId = localStorage.getItem('empresaActiva');
    const mostrarSistema = document.getElementById('mostrarRolesSistema')?.checked || false;
    
    let url = `${API_URL}/roles`;
    if (empresaActivaId) {
      url += `?empresa_id=${empresaActivaId}`;
    }
    
    console.log('🔄 Cargando roles desde:', url);
    console.log('📋 Mostrar roles de sistema:', mostrarSistema);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) throw new Error('Error al cargar roles');
    
    const data = await response.json();
    let roles = data.data || [];
    
    console.log('✅ Roles recibidos del API:', roles.length);
    console.log('📊 Tipos de roles:', roles.map(r => `${r.nombre} (${r.tipo})`));
    
    // Filtrar roles de sistema si no está activado el checkbox
    if (!mostrarSistema) {
      const rolesAntes = roles.length;
      roles = roles.filter(r => r.tipo !== 'sistema');
      console.log(`🔍 Filtrado: ${rolesAntes} roles → ${roles.length} roles (ocultados ${rolesAntes - roles.length} de sistema)`);
    }
    
    const tbody = document.getElementById('rolesTableBody');
    
    if (roles.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4">
            <i class="bi bi-inbox fs-1 text-muted"></i>
            <p class="text-muted mt-2 mb-0">No hay roles configurados</p>
            ${!mostrarSistema ? '<small class="text-muted">Activa "Mostrar roles de sistema" para ver roles predefinidos</small>' : ''}
          </td>
        </tr>
      `;
      return;
    }
    
    tbody.innerHTML = roles.map(rol => `
      <tr>
        <td>
          <i class="bi ${rol.es_admin ? 'bi-shield-fill-check text-danger' : 'bi-shield-check text-primary'}" 
             title="${rol.es_admin ? 'Rol Administrador' : 'Rol Regular'}"></i>
        </td>
        <td>
          <strong>${rol.nombre}</strong>
          ${rol.empresa_nombre ? `<br><small class="text-muted">${rol.empresa_nombre}</small>` : 
            '<br><small class="badge bg-info">Global</small>'}
        </td>
        <td>${rol.descripcion || '<span class="text-muted">Sin descripción</span>'}</td>
        <td>
          <span class="badge bg-${rol.tipo === 'sistema' ? 'secondary' : 'primary'}">
            ${rol.tipo === 'sistema' ? 'Sistema' : 'Personalizado'}
          </span>
        </td>
        <td class="text-center">
          <span class="badge bg-info">${rol.usuarios_count || 0}</span>
        </td>
        <td>
          <span class="badge bg-${rol.activo ? 'success' : 'secondary'}">
            ${rol.activo ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" onclick="verDetalleRol(${rol.id})" title="Ver detalle">
            <i class="bi bi-eye"></i>
          </button>
          ${rol.tipo !== 'sistema' ? `
            <button class="btn btn-sm btn-outline-warning" onclick="editarRol(${rol.id})" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="eliminarRol(${rol.id}, '${rol.nombre.replace(/'/g, "\\'")}', ${rol.usuarios_count})" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          ` : '<small class="text-muted">No editable</small>'}
        </td>
      </tr>
    `).join('');
    
  } catch (error) {
    console.error('Error al cargar roles:', error);
    document.getElementById('rolesTableBody').innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-danger py-4">
          <i class="bi bi-exclamation-triangle fs-1"></i>
          <p class="mt-2 mb-0">${error.message}</p>
        </td>
      </tr>
    `;
  }
}

/**
 * Abrir modal para crear/editar rol
 */
async function abrirModalRol(rolId = null) {
  const modal = new bootstrap.Modal(document.getElementById('rolModal'));
  const form = document.getElementById('rolForm');
  form.reset();
  permisosSeleccionados = [];
  
  document.getElementById('rolModalTitle').textContent = rolId ? 'Editar Rol' : 'Crear Rol';
  document.getElementById('rolId').value = rolId || '';
  
  // Cargar módulos y acciones si no están en cache
  if (!modulosAccionesData) {
    await cargarModulosAcciones();
  }
  
  // Si es edición, cargar datos del rol
  if (rolId) {
    try {
      const response = await fetch(`${API_URL}/roles/${rolId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Error al cargar rol');
      
      const data = await response.json();
      const rol = data.data;
      
      // Llenar formulario
      document.getElementById('rolNombre').value = rol.nombre;
      document.getElementById('rolDescripcion').value = rol.descripcion || '';
      document.getElementById('rolActivo').value = rol.activo ? '1' : '0';
      
      // Marcar permisos asignados
      permisosSeleccionados = rol.permisos.map(p => p.permiso_id);
      
      // Renderizar matriz con permisos marcados
      renderizarMatrizPermisos();
      
    } catch (error) {
      console.error('Error:', error);
      mostrarError('Error al cargar datos del rol');
      return;
    }
  } else {
    // Renderizar matriz vacía para nuevo rol
    renderizarMatrizPermisos();
  }
  
  modal.show();
}

/**
 * Cargar módulos y acciones disponibles
 */
async function cargarModulosAcciones() {
  const container = document.getElementById('permisosContainer');
  container.innerHTML = `
    <div class="text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="text-muted mt-2">Cargando permisos...</p>
    </div>
  `;
  
  try {
    const response = await fetch(`${API_URL}/roles/modulos-acciones`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) throw new Error('Error al cargar módulos y acciones');
    
    const data = await response.json();
    modulosAccionesData = data.data;
    
    renderizarMatrizPermisos();
    
  } catch (error) {
    console.error('Error:', error);
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle me-2"></i>
        ${error.message}
      </div>
    `;
  }
}

/**
 * Renderizar matriz de permisos (checkboxes por módulo y acción)
 */
function renderizarMatrizPermisos() {
  if (!modulosAccionesData) return;
  
  const { modulos, acciones, permisos } = modulosAccionesData;
  
  // Agrupar módulos por categoría
  const categorias = {};
  modulos.forEach(modulo => {
    const cat = modulo.categoria || 'Sin Categoría';
    if (!categorias[cat]) categorias[cat] = [];
    categorias[cat].push(modulo);
  });
  
  // Crear mapa de permisos por modulo_id y accion_id
  const permisoMap = {};
  permisos.forEach(p => {
    const key = `${p.modulo_id}_${p.accion_id}`;
    permisoMap[key] = p.id;
  });
  
  let html = '';
  
  Object.entries(categorias).forEach(([categoria, mods]) => {
    html += `
      <div class="card mb-3">
        <div class="card-header bg-light">
          <h6 class="mb-0 text-uppercase">
            <i class="bi bi-folder me-2"></i>${categoria}
          </h6>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive" style="max-height: 500px; overflow-x: auto; position: relative;">
            <table class="table table-sm table-hover mb-0" style="min-width: 1200px;">
              <thead class="table-light" style="position: sticky; top: 0; z-index: 10;">
                <tr>
                  <th class="sticky-col" style="width: 200px; position: sticky; left: 0; z-index: 11; background: #f8f9fa; box-shadow: 2px 0 5px rgba(0,0,0,0.1);">Módulo</th>
                  ${acciones.map(a => `
                    <th class="text-center" style="width: 80px; white-space: nowrap;" title="${a.descripcion}">
                      ${a.nombre_mostrar}
                    </th>
                  `).join('')}
                  <th class="text-center" style="width: 100px;">
                    <button type="button" class="btn btn-sm btn-outline-secondary" 
                            onclick="toggleCategoriaCompleta('${categoria}')">
                      <i class="bi bi-check-all"></i>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
    `;
    
    mods.forEach(modulo => {
      html += `
        <tr data-modulo-id="${modulo.id}">
          <td class="sticky-col" style="position: sticky; left: 0; background: white; z-index: 5; box-shadow: 2px 0 5px rgba(0,0,0,0.05);">
            <i class="bi ${modulo.icono} me-2 text-primary"></i>
            <strong>${modulo.nombre_mostrar}</strong>
            ${modulo.nivel === 'platform' ? '<span class="badge bg-warning ms-2">Plataforma</span>' : ''}
          </td>
      `;
      
      acciones.forEach(accion => {
        const permisoKey = `${modulo.id}_${accion.id}`;
        const permisoId = permisoMap[permisoKey];
        
        if (permisoId) {
          const isChecked = permisosSeleccionados.includes(permisoId);
          html += `
            <td class="text-center align-middle">
              <input type="checkbox" class="form-check-input permiso-check" 
                     data-permiso-id="${permisoId}"
                     data-modulo-id="${modulo.id}"
                     data-accion-id="${accion.id}"
                     ${isChecked ? 'checked' : ''}
                     onchange="togglePermiso(this)">
            </td>
          `;
        } else {
          html += `<td class="text-center text-muted"><small>N/A</small></td>`;
        }
      });
      
      html += `
          <td class="text-center align-middle">
            <button type="button" class="btn btn-sm btn-outline-primary" 
                    onclick="toggleModuloCompleto(${modulo.id})">
              <i class="bi bi-check-all"></i>
            </button>
          </td>
        </tr>
      `;
    });
    
    html += `
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  });
  
  document.getElementById('permisosContainer').innerHTML = html;
}

/**
 * Toggle individual de permiso
 */
function togglePermiso(checkbox) {
  const permisoId = parseInt(checkbox.dataset.permisoId);
  
  if (checkbox.checked) {
    if (!permisosSeleccionados.includes(permisoId)) {
      permisosSeleccionados.push(permisoId);
    }
  } else {
    permisosSeleccionados = permisosSeleccionados.filter(id => id !== permisoId);
  }
  
  console.log('Permisos seleccionados:', permisosSeleccionados.length);
}

/**
 * Seleccionar/Deseleccionar todos los permisos de un módulo
 */
function toggleModuloCompleto(moduloId) {
  const checkboxes = document.querySelectorAll(`input[data-modulo-id="${moduloId}"]`);
  const todosChecked = Array.from(checkboxes).every(cb => cb.checked);
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = !todosChecked;
    togglePermiso(checkbox);
  });
}

/**
 * Seleccionar/Deseleccionar todos los permisos de una categoría
 */
function toggleCategoriaCompleta(categoria) {
  const card = Array.from(document.querySelectorAll('.card-header h6'))
    .find(h => h.textContent.includes(categoria))
    ?.closest('.card');
  
  if (!card) return;
  
  const checkboxes = card.querySelectorAll('.permiso-check');
  const todosChecked = Array.from(checkboxes).every(cb => cb.checked);
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = !todosChecked;
    togglePermiso(checkbox);
  });
}

/**
 * Seleccionar o limpiar TODOS los permisos
 */
function seleccionarTodosPermisos(seleccionar) {
  const checkboxes = document.querySelectorAll('.permiso-check');
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = seleccionar;
    togglePermiso(checkbox);
  });
}

/**
 * Guardar rol (crear o actualizar)
 */
document.getElementById('rolForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const rolId = document.getElementById('rolId').value;
  const nombre = document.getElementById('rolNombre').value.trim();
  const descripcion = document.getElementById('rolDescripcion').value.trim();
  const activo = document.getElementById('rolActivo').value === '1';
  const empresaActivaId = localStorage.getItem('empresaActiva');
  
  if (!nombre) {
    mostrarError('El nombre del rol es obligatorio');
    return;
  }

  // Validar que el usuario tenga una empresa activa seleccionada
  if (!empresaActivaId) {
    mostrarError('Debes seleccionar una empresa para crear roles. Por favor, selecciona una empresa del menú superior.');
    console.error('❌ No hay empresa activa:', empresaActivaId);
    return;
  }
  
  if (permisosSeleccionados.length === 0) {
    if (!confirm('No has seleccionado ningún permiso. ¿Deseas continuar?')) {
      return;
    }
  }

  console.log('📋 Creando rol para empresa:', empresaActivaId);
  
  const datosRol = {
    nombre,
    descripcion: descripcion || null,
    activo,
    empresa_id: empresaActivaId,
    permisos_ids: permisosSeleccionados
  };
  
  try {
    const url = rolId ? `${API_URL}/roles/${rolId}` : `${API_URL}/roles`;
    const method = rolId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(datosRol)
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Error al guardar rol');
    }
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('rolModal'));
    modal.hide();
    
    mostrarExito(rolId ? 'Rol actualizado exitosamente' : 'Rol creado exitosamente');
    cargarRoles();
    
  } catch (error) {
    console.error('Error:', error);
    mostrarError(error.message);
  }
});

/**
 * Ver detalle de un rol
 */
async function verDetalleRol(rolId) {
  try {
    const response = await fetch(`${API_URL}/roles/${rolId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) throw new Error('Error al cargar rol');
    
    const data = await response.json();
    const rol = data.data;
    
    // Agrupar permisos por módulo
    const permisosPorModulo = {};
    rol.permisos.forEach(p => {
      if (!permisosPorModulo[p.modulo_nombre]) {
        permisosPorModulo[p.modulo_nombre] = {
          nombre_mostrar: p.modulo_mostrar,
          acciones: []
        };
      }
      permisosPorModulo[p.modulo_nombre].acciones.push(p.accion_mostrar);
    });
    
    let permisosHtml = '';
    Object.entries(permisosPorModulo).forEach(([modulo, data]) => {
      permisosHtml += `
        <div class="mb-3">
          <strong class="text-primary">${data.nombre_mostrar}</strong><br>
          ${data.acciones.map(a => `<span class="badge bg-secondary me-1">${a}</span>`).join('')}
        </div>
      `;
    });
    
    const modalHtml = `
      <div class="modal fade" id="detalleRolModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-shield-check me-2"></i>Detalle del Rol
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-8">
                  <strong>Nombre:</strong><br>
                  <h5>${rol.nombre}</h5>
                  ${rol.empresa_nombre ? `<small class="text-muted">Empresa: ${rol.empresa_nombre}</small>` : 
                    '<span class="badge bg-info">Rol Global</span>'}
                </div>
                <div class="col-md-4 text-end">
                  <span class="badge bg-${rol.tipo === 'sistema' ? 'secondary' : 'primary'} fs-6">
                    ${rol.tipo === 'sistema' ? 'Sistema' : 'Personalizado'}
                  </span><br>
                  <span class="badge bg-${rol.activo ? 'success' : 'secondary'} fs-6 mt-2">
                    ${rol.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div class="col-12">
                  <strong>Descripción:</strong><br>
                  ${rol.descripcion || '<span class="text-muted">Sin descripción</span>'}
                </div>
                <div class="col-12 mt-4">
                  <h6 class="border-bottom pb-2">Permisos Asignados (${rol.permisos.length})</h6>
                  ${rol.permisos.length > 0 ? permisosHtml : '<p class="text-muted">No tiene permisos asignados</p>'}
                </div>
              </div>
            </div>
            <div class="modal-footer">
              ${rol.tipo !== 'sistema' ? `
                <button type="button" class="btn btn-warning" onclick="editarRol(${rol.id}); bootstrap.Modal.getInstance(document.getElementById('detalleRolModal')).hide();">
                  <i class="bi bi-pencil me-2"></i>Editar
                </button>
              ` : ''}
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    const oldModal = document.getElementById('detalleRolModal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('detalleRolModal'));
    modal.show();
    
    document.getElementById('detalleRolModal').addEventListener('hidden.bs.modal', function() {
      this.remove();
    });
    
  } catch (error) {
    console.error('Error:', error);
    mostrarError('Error al cargar detalle del rol');
  }
}

/**
 * Editar rol
 */
function editarRol(rolId) {
  abrirModalRol(rolId);
}

/**
 * Eliminar rol
 */
async function eliminarRol(rolId, nombre, usuariosCount) {
  if (usuariosCount > 0) {
    alert(`No se puede eliminar el rol "${nombre}" porque tiene ${usuariosCount} usuario(s) asignado(s).\n\nPrimero debes reasignar esos usuarios a otro rol.`);
    return;
  }
  
  if (!confirm(`¿Estás seguro de eliminar el rol "${nombre}"?\n\nEsta acción no se puede deshacer.`)) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/roles/${rolId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Error al eliminar rol');
    }
    
    mostrarExito('Rol eliminado exitosamente');
    cargarRoles();
    
  } catch (error) {
    console.error('Error:', error);
    mostrarError(error.message);
  }
}

// ============================================
// MÓDULO: USUARIOS DE EMPRESA
// ============================================

let rolesDisponiblesEmpresa = []; // Cache de roles para checkboxes

/**
 * Cargar lista de usuarios de la empresa
 */
async function cargarUsuariosEmpresa() {
  console.log('🔍 Iniciando carga de usuarios de empresa...');
  
  try {
    const empresaActivaId = localStorage.getItem('empresaActiva');
    console.log('📦 Empresa activa (localStorage):', empresaActivaId);
    
    // Verificar que el dropdown también tenga la misma empresa seleccionada
    const companySelector = document.getElementById('companySelector');
    if (companySelector) {
      console.log('🔍 Empresa en dropdown:', {
        value: companySelector.value,
        texto: companySelector.options[companySelector.selectedIndex]?.text
      });
    }
    
    const tbody = document.getElementById('usuariosEmpresaTableBody');
    
    if (!empresaActivaId) {
      console.warn('⚠️ No hay empresa activa seleccionada');
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4">
            <i class="bi bi-exclamation-triangle fs-1 text-warning"></i>
            <p class="text-muted mt-2 mb-0">No hay empresa activa seleccionada</p>
            <small class="text-muted">Por favor, selecciona una empresa en el selector superior</small>
          </td>
        </tr>
      `;
      return;
    }
    
    const url = `${API_URL}/usuarios?empresa_id=${empresaActivaId}`;
    console.log('🌐 Llamando a API:', url);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    console.log('📡 Respuesta recibida, status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error en respuesta:', errorText);
      throw new Error(`Error al cargar usuarios (${response.status})`);
    }
    
    const data = await response.json();
    console.log('✅ Datos recibidos:', data);
    
    const usuarios = data.data || [];
    
    console.log(`📊 Total usuarios encontrados: ${usuarios.length}`);
    
    if (usuarios.length === 0) {
      console.log('ℹ️ No hay usuarios para mostrar');
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4">
            <i class="bi bi-people fs-1 text-muted"></i>
            <p class="text-muted mt-2 mb-0">No hay usuarios registrados</p>
            <small class="text-muted">Crea el primer usuario de tu empresa</small>
          </td>
        </tr>
      `;
      return;
    }
    
    console.log('🎨 Renderizando usuarios en tabla...');
    tbody.innerHTML = usuarios.map(usuario => {
      const nombreCompleto = `${usuario.nombre} ${usuario.apellido || ''}`.trim();
      const ultimoLogin = usuario.ultimo_login 
        ? new Date(usuario.ultimo_login).toLocaleDateString() 
        : 'Nunca';
      
      const rolesHtml = usuario.roles_nombres && typeof usuario.roles_nombres === 'string'
        ? usuario.roles_nombres.split(',').map(r => `<span class="badge bg-primary me-1">${r.trim()}</span>`).join('')
        : '<span class="text-muted">Sin roles</span>';
      
      return `
        <tr>
          <td>
            <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" 
                 style="width: 35px; height: 35px;">
              ${nombreCompleto.charAt(0).toUpperCase()}
            </div>
          </td>
          <td>
            <strong>${nombreCompleto}</strong>
            ${usuario.email_verificado ? '<i class="bi bi-patch-check-fill text-success ms-1" title="Email verificado"></i>' : ''}
          </td>
          <td>${usuario.email}</td>
          <td>${usuario.telefono || '<span class="text-muted">-</span>'}</td>
          <td>${rolesHtml}</td>
          <td>${ultimoLogin}</td>
          <td>
            <span class="badge bg-${usuario.activo ? 'success' : 'secondary'}">
              ${usuario.activo ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" onclick="verDetalleUsuarioEmpresa(${usuario.id})" title="Ver detalle">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-warning" onclick="editarUsuarioEmpresa(${usuario.id})" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            ${usuario.tipo_usuario === 'usuario' ? `
              <button class="btn btn-sm btn-outline-danger" onclick="desactivarUsuarioEmpresa(${usuario.id}, '${nombreCompleto.replace(/'/g, "\\'")}', ${usuario.activo})" title="Desactivar">
                <i class="bi bi-toggle-off"></i>
              </button>
            ` : '<small class="text-muted">Admin</small>'}
          </td>
        </tr>
      `;
    }).join('');
    
    console.log('✅ Usuarios cargados correctamente en la tabla');
    
  } catch (error) {
    console.error('❌ Error al cargar usuarios:', error);
    const tbody = document.getElementById('usuariosEmpresaTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-danger py-4">
            <i class="bi bi-exclamation-triangle fs-1"></i>
            <p class="mt-2 mb-0">Error: ${error.message}</p>
            <small class="text-muted">Revisa la consola para más detalles</small>
          </td>
        </tr>
      `;
    }
  }
}

/**
 * Cargar roles disponibles para checkboxes
 */
async function cargarRolesParaUsuario() {
  try {
    const empresaActivaId = localStorage.getItem('empresaActiva');
    const usuarioActual = JSON.parse(localStorage.getItem('usuario') || '{}');
    
    console.log('🔐 Cargando roles para asignación...');
    console.log('👤 Usuario actual:', usuarioActual.tipo_usuario);
    
    const response = await fetch(`${API_URL}/roles?empresa_id=${empresaActivaId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) throw new Error('Error al cargar roles');
    
    const data = await response.json();
    rolesDisponiblesEmpresa = data.data || [];
    
    console.log('📋 Roles disponibles:', rolesDisponiblesEmpresa);
    
    // Renderizar checkboxes
    const container = document.getElementById('rolesCheckboxContainer');
    
    if (rolesDisponiblesEmpresa.length === 0) {
      container.innerHTML = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle me-2"></i>
          No hay roles configurados. Primero debes crear roles en el módulo "Roles y Permisos".
        </div>
      `;
      return;
    }
    
    // Filtrar roles según tipo de usuario
    const rolesFiltrados = rolesDisponiblesEmpresa.filter(rol => {
      // Super admin puede asignar cualquier rol
      if (usuarioActual.tipo_usuario === 'super_admin') {
        return true;
      }
      
      // Admin empresa NO puede asignar roles de sistema (nivel >= 80)
      if (rol.tipo === 'sistema' || rol.nivel >= 80) {
        console.warn(`⚠️ Rol "${rol.nombre}" filtrado (tipo: ${rol.tipo}, nivel: ${rol.nivel})`);
        return false;
      }
      
      return true;
    });
    
    console.log('✅ Roles disponibles para asignación:', rolesFiltrados.length);
    
    if (rolesFiltrados.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          <strong>No hay roles disponibles para asignar.</strong><br>
          <small>Como administrador de empresa, puedes crear roles personalizados en el módulo "Roles y Permisos".</small>
        </div>
      `;
      return;
    }
    
    container.innerHTML = rolesFiltrados.map(rol => `
      <div class="form-check mb-2">
        <input class="form-check-input rol-checkbox" type="checkbox" value="${rol.id}" id="rol_${rol.id}">
        <label class="form-check-label" for="rol_${rol.id}">
          <strong>${rol.nombre}</strong>
          ${rol.descripcion ? `<br><small class="text-muted">${rol.descripcion}</small>` : ''}
          <span class="badge bg-${rol.tipo === 'sistema' ? 'secondary' : 'primary'} ms-2">
            ${rol.tipo === 'sistema' ? 'Sistema' : 'Personalizado'}
          </span>
          <span class="badge bg-info ms-1">Nivel ${rol.nivel}</span>
        </label>
      </div>
    `).join('');
    
  } catch (error) {
    console.error('❌ Error al cargar roles:', error);
    document.getElementById('rolesCheckboxContainer').innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle me-2"></i>
        ${error.message}
      </div>
    `;
  }
}

/**
 * Abrir modal para crear/editar usuario
 */
async function abrirModalUsuarioEmpresa(usuarioId = null) {
  const modal = new bootstrap.Modal(document.getElementById('usuarioEmpresaModal'));
  const form = document.getElementById('usuarioEmpresaForm');
  form.reset();
  
  document.getElementById('usuarioEmpresaModalTitle').textContent = usuarioId ? 'Editar Usuario' : 'Crear Usuario';
  document.getElementById('usuarioEmpresaId').value = usuarioId || '';
  
  // Contraseña requerida solo al crear
  const passwordRequired = document.getElementById('passwordRequiredEmpresa');
  const passwordConfirmRequired = document.getElementById('passwordConfirmRequiredEmpresa');
  const passwordField = document.getElementById('usuarioEmpresaPassword');
  const passwordConfirmField = document.getElementById('usuarioEmpresaPasswordConfirm');
  
  if (usuarioId) {
    passwordRequired.style.display = 'none';
    passwordConfirmRequired.style.display = 'none';
    passwordField.removeAttribute('required');
    passwordConfirmField.removeAttribute('required');
  } else {
    passwordRequired.style.display = 'inline';
    passwordConfirmRequired.style.display = 'inline';
    passwordField.setAttribute('required', 'required');
    passwordConfirmField.setAttribute('required', 'required');
  }
  
  // Cargar roles disponibles
  await cargarRolesParaUsuario();
  
  // Si es edición, cargar datos del usuario
  if (usuarioId) {
    try {
      const empresaActivaId = localStorage.getItem('empresaActiva');
      if (!empresaActivaId) {
        mostrarError('No hay empresa seleccionada');
        return;
      }

      const response = await fetch(`${API_URL}/usuarios/${usuarioId}?empresa_id=${empresaActivaId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Error al cargar usuario');
      
      const data = await response.json();
      const usuario = data.data;
      
      // Llenar formulario
      document.getElementById('usuarioEmpresaNombre').value = usuario.nombre;
      document.getElementById('usuarioEmpresaApellido').value = usuario.apellido || '';
      document.getElementById('usuarioEmpresaEmail').value = usuario.email;
      document.getElementById('usuarioEmpresaTelefono').value = usuario.telefono || '';
      document.getElementById('usuarioEmpresaActivo').value = usuario.activo ? '1' : '0';
      
      // Marcar roles asignados
      if (usuario.roles && usuario.roles.length > 0) {
        usuario.roles.forEach(rol => {
          const checkbox = document.getElementById(`rol_${rol.rol_id}`);
          if (checkbox) checkbox.checked = true;
        });
      }
      
    } catch (error) {
      console.error('Error:', error);
      mostrarError('Error al cargar datos del usuario');
      return;
    }
  }
  
  modal.show();
}

/**
 * Guardar usuario (crear o actualizar)
 */
document.getElementById('usuarioEmpresaForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const usuarioId = document.getElementById('usuarioEmpresaId').value;
  const nombre = document.getElementById('usuarioEmpresaNombre').value.trim();
  const apellido = document.getElementById('usuarioEmpresaApellido').value.trim();
  const email = document.getElementById('usuarioEmpresaEmail').value.trim();
  const telefono = document.getElementById('usuarioEmpresaTelefono').value.trim();
  const password = document.getElementById('usuarioEmpresaPassword').value;
  const passwordConfirm = document.getElementById('usuarioEmpresaPasswordConfirm').value;
  const activo = document.getElementById('usuarioEmpresaActivo').value === '1';
  
  // Obtener roles seleccionados
  const rolesSeleccionados = Array.from(document.querySelectorAll('.rol-checkbox:checked'))
    .map(cb => parseInt(cb.value));
  
  // Validaciones
  if (!nombre || !email) {
    mostrarError('Nombre y email son obligatorios');
    return;
  }
  
  if (!usuarioId) {
    if (!password || password.length < 6) {
      mostrarError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    if (password !== passwordConfirm) {
      mostrarError('Las contraseñas no coinciden');
      return;
    }
  } else {
    if (password && password !== passwordConfirm) {
      mostrarError('Las contraseñas no coinciden');
      return;
    }
  }
  
  const empresaActivaId = localStorage.getItem('empresaActiva');
  
  if (!empresaActivaId) {
    mostrarError('No hay empresa activa seleccionada. Por favor, selecciona una empresa del menú superior.');
    return;
  }
  
  const datosUsuario = {
    nombre,
    apellido: apellido || null,
    email,
    telefono: telefono || null,
    activo,
    empresa_id: empresaActivaId,
    roles_ids: rolesSeleccionados
  };
  
  if (password && password.trim()) {
    datosUsuario.password = password;
  }
  
  try {
    const url = usuarioId ? `${API_URL}/usuarios/${usuarioId}` : `${API_URL}/usuarios`;
    const method = usuarioId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(datosUsuario)
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Error al guardar usuario');
    }
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('usuarioEmpresaModal'));
    modal.hide();
    
    mostrarExito(usuarioId ? 'Usuario actualizado exitosamente' : 'Usuario creado exitosamente');
    cargarUsuariosEmpresa();
    
  } catch (error) {
    console.error('Error:', error);
    mostrarError(error.message);
  }
});

/**
 * Ver detalle de usuario
 */
async function verDetalleUsuarioEmpresa(usuarioId) {
  try {
    const response = await fetch(`${API_URL}/usuarios/${usuarioId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) throw new Error('Error al cargar usuario');
    
    const data = await response.json();
    const usuario = data.data;
    
    const nombreCompleto = `${usuario.nombre} ${usuario.apellido || ''}`.trim();
    
    let rolesHtml = '';
    if (usuario.roles && usuario.roles.length > 0) {
      rolesHtml = usuario.roles.map(r => `
        <div class="mb-2">
          <span class="badge bg-primary">${r.rol_nombre}</span>
          <small class="text-muted ms-2">en ${r.empresa_nombre}</small>
        </div>
      `).join('');
    } else {
      rolesHtml = '<p class="text-muted">No tiene roles asignados</p>';
    }
    
    const modalHtml = `
      <div class="modal fade" id="detalleUsuarioModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-person-circle me-2"></i>Detalle del Usuario
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-8">
                  <strong>Nombre Completo:</strong><br>
                  <h5>${nombreCompleto}</h5>
                </div>
                <div class="col-md-4 text-end">
                  <span class="badge bg-${usuario.activo ? 'success' : 'secondary'} fs-6">
                    ${usuario.activo ? 'Activo' : 'Inactivo'}
                  </span>
                  ${usuario.email_verificado ? '<br><span class="badge bg-info fs-6 mt-2">Email Verificado</span>' : ''}
                </div>
                <div class="col-md-6">
                  <strong>Email:</strong><br>${usuario.email}
                </div>
                <div class="col-md-6">
                  <strong>Teléfono:</strong><br>${usuario.telefono || '<span class="text-muted">No registrado</span>'}
                </div>
                <div class="col-md-6">
                  <strong>Tipo de Usuario:</strong><br>
                  <span class="badge bg-secondary">${usuario.tipo_usuario}</span>
                </div>
                <div class="col-md-6">
                  <strong>Último Acceso:</strong><br>
                  ${usuario.ultimo_login ? new Date(usuario.ultimo_login).toLocaleString() : '<span class="text-muted">Nunca</span>'}
                </div>
                <div class="col-12 mt-4">
                  <h6 class="border-bottom pb-2">Roles Asignados</h6>
                  ${rolesHtml}
                </div>
                <div class="col-md-6">
                  <strong>Creado:</strong><br>
                  <small class="text-muted">${new Date(usuario.created_at).toLocaleString()}</small>
                </div>
                <div class="col-md-6">
                  <strong>Actualizado:</strong><br>
                  <small class="text-muted">${new Date(usuario.updated_at).toLocaleString()}</small>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              ${usuario.tipo_usuario !== 'admin_empresa' ? `
                <button type="button" class="btn btn-warning" onclick="editarUsuarioEmpresa(${usuario.id}); bootstrap.Modal.getInstance(document.getElementById('detalleUsuarioModal')).hide();">
                  <i class="bi bi-pencil me-2"></i>Editar
                </button>
              ` : ''}
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
    mostrarError('Error al cargar detalle del usuario');
  }
}

/**
 * Editar usuario
 */
function editarUsuarioEmpresa(usuarioId) {
  abrirModalUsuarioEmpresa(usuarioId);
}

/**
 * Desactivar usuario
 */
async function desactivarUsuarioEmpresa(usuarioId, nombre, activo) {
  if (!confirm(`⚠️ ¿Estás seguro de ELIMINAR PERMANENTEMENTE al usuario "${nombre}"?\n\nEsta acción NO se puede deshacer y se eliminarán:\n• Todos sus roles asignados\n• Su acceso a la empresa\n• Todos sus datos de usuario`)) {
    return;
  }
  
  try {
    const empresaActivaId = localStorage.getItem('empresaActiva');
    
    if (!empresaActivaId) {
      mostrarError('No hay empresa activa seleccionada');
      return;
    }
    
    const response = await fetch(`${API_URL}/usuarios/${usuarioId}?empresa_id=${empresaActivaId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Error al eliminar usuario');
    }
    
    mostrarExito('✅ Usuario eliminado permanentemente');
    cargarUsuariosEmpresa();
    
  } catch (error) {
    console.error('Error:', error);
    mostrarError(error.message);
  }
}

/**
 * Filtrar usuarios
 */
function filtrarUsuarios() {
  const searchText = document.getElementById('searchUsuarios')?.value.toLowerCase() || '';
  const activoFilter = document.getElementById('filterUsuarioActivo')?.value || '';
  
  // Buscar tabla en el módulo activo (puede ser Admin o Empresa)
  const rows = document.querySelectorAll('#usuariosEmpresaTableBody tr, #usuariosAdminTableBody tr');
  
  rows.forEach(row => {
    const nombre = row.cells[1]?.textContent.toLowerCase() || '';
    const email = row.cells[2]?.textContent.toLowerCase() || '';
    const estado = row.cells[6]?.textContent || '';
    
    const matchSearch = !searchText || nombre.includes(searchText) || email.includes(searchText);
    const matchActivo = !activoFilter || 
      (activoFilter === '1' && estado.includes('Activo')) ||
      (activoFilter === '0' && estado.includes('Inactivo'));
    
    row.style.display = (matchSearch && matchActivo) ? '' : 'none';
  });
}

// Event listener para búsqueda en tiempo real
document.getElementById('searchUsuarios')?.addEventListener('input', filtrarUsuarios);

/**
 * Limpiar filtros
 */
function limpiarFiltrosUsuarios() {
  document.getElementById('searchUsuarios').value = '';
  document.getElementById('filterUsuarioActivo').value = '';
  filtrarUsuarios();
}

/**
 * =====================================================
 * VERIFICACIÓN DE CONFIGURACIÓN DE FACTURACIÓN
 * =====================================================
 */

/**
 * Verificar si la empresa tiene configuración de facturación completa
 */
async function verificarConfiguracionFacturacion() {
  const token = localStorage.getItem('token');
  const empresaActivaId = localStorage.getItem('empresaActiva');
  
  if (!empresaActivaId) {
    return; // No hay empresa seleccionada
  }
  
  const alertElement = document.getElementById('alertConfiguracionPendiente');
  if (!alertElement) return;
  
  try {
    const response = await fetch(`${API_URL}/facturacion/configuracion/${empresaActivaId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Si es 404, significa que no hay configuración creada aún
    if (response.status === 404) {
      mostrarAlertaConfiguracion({
        color_primario: false,
        color_secundario: false,
        fuente: false,
        cuentas_bancarias: false,
        mensaje_agradecimiento: false
      });
      return;
    }
    
    const result = await response.json();
    
    if (!result.success || !result.data) {
      // No hay configuración, mostrar alerta
      mostrarAlertaConfiguracion({
        color_primario: false,
        color_secundario: false,
        fuente: false,
        cuentas_bancarias: false,
        mensaje_agradecimiento: false
      });
      return;
    }
    
    // Verificar qué configuraciones faltan
    const config = result.data;
    const configuracionesFaltantes = {
      color_primario: !config.color_primario,
      color_secundario: !config.color_secundario,
      fuente: !config.fuente,
      cuentas_bancarias: !config.cuentas_bancarias || 
                         (typeof config.cuentas_bancarias === 'string' && 
                          JSON.parse(config.cuentas_bancarias || '[]').length === 0),
      mensaje_agradecimiento: !config.mensaje_agradecimiento
    };
    
    // Verificar si faltan configuraciones importantes
    const algunaFaltante = Object.values(configuracionesFaltantes).some(falta => falta);
    
    if (algunaFaltante) {
      mostrarAlertaConfiguracion(configuracionesFaltantes);
    } else {
      // Todo configurado, ocultar alerta
      alertElement.style.display = 'none';
    }
    
  } catch (error) {
    console.error('Error verificando configuración:', error);
    // No mostrar alerta si hay error
  }
}

/**
 * Mostrar alerta de configuración pendiente con detalles
 */
function mostrarAlertaConfiguracion(faltantes) {
  const alertElement = document.getElementById('alertConfiguracionPendiente');
  const listaElement = document.getElementById('listaConfiguracionesPendientes');
  
  if (!alertElement || !listaElement) return;
  
  const mensajes = {
    color_primario: '🎨 Colores corporativos (primario y secundario)',
    fuente: '📝 Fuente y tamaño para las facturas',
    cuentas_bancarias: '🏦 Cuentas bancarias para mostrar en facturas',
    mensaje_agradecimiento: '💬 Mensaje de agradecimiento personalizado'
  };
  
  // Construir lista de configuraciones pendientes
  const items = [];
  
  if (faltantes.color_primario || faltantes.color_secundario) {
    items.push(mensajes.color_primario);
  }
  if (faltantes.fuente) {
    items.push(mensajes.fuente);
  }
  if (faltantes.cuentas_bancarias) {
    items.push(mensajes.cuentas_bancarias);
  }
  if (faltantes.mensaje_agradecimiento) {
    items.push(mensajes.mensaje_agradecimiento);
  }
  
  // Si no hay items, ocultar alerta
  if (items.length === 0) {
    alertElement.style.display = 'none';
    return;
  }
  
  // Mostrar lista de pendientes
  listaElement.innerHTML = items.map(item => `<li>${item}</li>`).join('');
  
  // Obtener empresa activa para el alertKey (ahora solo es el ID)
  const empresaActivaId = localStorage.getItem('empresaActiva');
  if (!empresaActivaId) {
    alertElement.style.display = 'none';
    return;
  }
  
  // Guardar en localStorage que se mostró (para no molestar mucho)
  const alertKey = `alertFacturacion_${empresaActivaId}`;
  const lastShown = localStorage.getItem(alertKey);
  const now = new Date().getTime();
  
  // Si ya se mostró hace menos de 24 horas, no mostrar
  if (lastShown && (now - parseInt(lastShown)) < 24 * 60 * 60 * 1000) {
    alertElement.style.display = 'none';
    return;
  }
  
  // Mostrar alerta
  alertElement.style.display = 'block';
  
  // Guardar timestamp de cuando se mostró
  localStorage.setItem(alertKey, now.toString());
  
  // Event listener para el botón de "Recordar Después"
  const btnRecordar = alertElement.querySelector('[data-bs-dismiss="alert"]');
  if (btnRecordar) {
    btnRecordar.addEventListener('click', () => {
      localStorage.setItem(alertKey, now.toString());
    });
  }
}
// ==========================================
// GESTIÓN DE ROLES GLOBALES (SUPER ADMIN)
// ==========================================

let permisosGlobalesSeleccionados = [];
let modulosAccionesDataGlobal = null;

/**
 * Cargar Roles Globales
 */
async function cargarRolesGlobales() {
  try {
    console.log('🔄 Cargando roles globales...');
    
    const response = await fetch(`${API_URL}/super-admin/roles-globales`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('No tienes permisos para gestionar roles globales (Solo Super Admin)');
      }
      throw new Error('Error al cargar roles globales');
    }
    
    const data = await response.json();
    const roles = data.data || [];
    
    console.log('✅ Roles globales recibidos:', roles.length);
    
    const tbody = document.getElementById('rolesGlobalesTableBody');
    
    if (roles.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-5">
            <i class="bi bi-inbox fs-1 text-muted"></i>
            <p class="text-muted mt-3 mb-0">No hay roles globales configurados</p>
            <small class="text-muted">Crea el primer rol global para comenzar</small>
          </td>
        </tr>
      `;
      return;
    }
    
    tbody.innerHTML = roles.map(rol => {
      // Badge de nivel con color según rango
      let nivelBadge = '';
      if (rol.nivel >= 95) {
        nivelBadge = `<span class="badge bg-danger">${rol.nivel}</span>`;
      } else if (rol.nivel >= 90) {
        nivelBadge = `<span class="badge bg-warning">${rol.nivel}</span>`;
      } else {
        nivelBadge = `<span class="badge bg-info">${rol.nivel}</span>`;
      }
      
      return `
        <tr>
          <td class="text-center">
            <i class="bi bi-shield-fill-check text-primary fs-5"></i>
          </td>
          <td>
            <strong>${rol.nombre}</strong>
          </td>
          <td>
            <span class="text-muted">${rol.descripcion || 'Sin descripción'}</span>
          </td>
          <td class="text-center">
            ${nivelBadge}
          </td>
          <td class="text-center">
            <span class="badge bg-secondary" title="Empresas que usan este rol">
              ${rol.empresas_usando || 0}
            </span>
          </td>
          <td>
            <span class="badge bg-${rol.activo ? 'success' : 'secondary'}">
              ${rol.activo ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" 
                    onclick="verDetalleRolGlobal(${rol.id})" 
                    title="Ver permisos">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-warning" 
                    onclick="editarRolGlobal(${rol.id})" 
                    title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" 
                    onclick="eliminarRolGlobal(${rol.id}, '${rol.nombre.replace(/'/g, "\\'")}', ${rol.empresas_usando || 0})" 
                    title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error al cargar roles globales:', error);
    const tbody = document.getElementById('rolesGlobalesTableBody');
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-danger py-5">
          <i class="bi bi-exclamation-triangle fs-1"></i>
          <p class="mt-3 mb-0">${error.message}</p>
        </td>
      </tr>
    `;
  }
}

/**
 * Abrir modal para crear/editar rol global
 */
async function abrirModalRolGlobal(rolId = null) {
  const modal = new bootstrap.Modal(document.getElementById('rolGlobalModal'));
  const form = document.getElementById('rolGlobalForm');
  form.reset();
  permisosGlobalesSeleccionados = [];
  
  document.getElementById('rolGlobalModalTitle').innerHTML = rolId 
    ? '<i class="bi bi-shield-fill-check me-2"></i>Editar Rol Global' 
    : '<i class="bi bi-shield-fill-check me-2"></i>Crear Rol Global';
  document.getElementById('rolGlobalId').value = rolId || '';
  
  // Cargar módulos y acciones si no están en cache
  if (!modulosAccionesDataGlobal) {
    await cargarModulosAccionesGlobal();
  }
  
  // Si es edición, cargar datos del rol
  if (rolId) {
    try {
      const response = await fetch(`${API_URL}/super-admin/roles-globales/${rolId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Error al cargar rol global');
      
      const data = await response.json();
      const rol = data.data;
      
      console.log('🔍 DEBUG - Rol cargado:', rol);
      console.log('🔍 DEBUG - Permisos del rol:', rol.permisos);
      
      // Llenar formulario
      document.getElementById('rolGlobalNombre').value = rol.nombre;
      document.getElementById('rolGlobalDescripcion').value = rol.descripcion || '';
      document.getElementById('rolGlobalNivel').value = rol.nivel;
      document.getElementById('rolGlobalActivo').value = rol.activo ? '1' : '0';
      
      // Marcar permisos asignados
      permisosGlobalesSeleccionados = rol.permisos.map(p => p.permiso_id);
      
      console.log('🔍 DEBUG - permisosGlobalesSeleccionados:', permisosGlobalesSeleccionados);
      console.log('🔍 DEBUG - Cantidad de permisos:', permisosGlobalesSeleccionados.length);
      
      // Renderizar matriz con permisos marcados
      renderizarMatrizPermisosGlobales();
      
    } catch (error) {
      console.error('Error:', error);
      mostrarAlertaConfigGlobal('Error al cargar datos del rol global', 'danger');
      return;
    }
  } else {
    // Renderizar matriz vacía para nuevo rol
    renderizarMatrizPermisosGlobales();
  }
  
  // Manejar submit del formulario
  form.onsubmit = async (e) => {
    e.preventDefault();
    await guardarRolGlobal();
  };
  
  modal.show();
}

/**
 * Cargar módulos y acciones para roles globales
 */
async function cargarModulosAccionesGlobal() {
  const container = document.getElementById('permisosGlobalesContainer');
  container.innerHTML = `
    <div class="text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="text-muted mt-2">Cargando permisos...</p>
    </div>
  `;
  
  try {
    const response = await fetch(`${API_URL}/roles/modulos-acciones`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) throw new Error('Error al cargar módulos');
    
    const data = await response.json();
    modulosAccionesDataGlobal = data.data;
    
    console.log('✅ Módulos y acciones cargados:', modulosAccionesDataGlobal);
    
    // NO renderizar aquí - se renderizará después de cargar los permisos del rol
    // renderizarMatrizPermisosGlobales();  <-- REMOVIDO
    
  } catch (error) {
    console.error('Error:', error);
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle me-2"></i>
        Error al cargar permisos: ${error.message}
      </div>
    `;
  }
}

/**
 * Renderizar matriz de permisos para roles globales
 */
function renderizarMatrizPermisosGlobales() {
  const container = document.getElementById('permisosGlobalesContainer');
  
  if (!modulosAccionesDataGlobal) {
    container.innerHTML = `
      <div class="alert alert-warning">
        <i class="bi bi-exclamation-triangle me-2"></i>
        No se encontraron permisos disponibles
      </div>
    `;
    return;
  }
  
  const { modulos, acciones, permisos } = modulosAccionesDataGlobal;
  
  if (!modulos || modulos.length === 0) {
    container.innerHTML = `
      <div class="alert alert-warning">
        <i class="bi bi-exclamation-triangle me-2"></i>
        No se encontraron módulos disponibles
      </div>
    `;
    return;
  }
  
  // Agrupar módulos por categoría
  const categorias = {};
  modulos.forEach(modulo => {
    const cat = modulo.categoria || 'Sin Categoría';
    if (!categorias[cat]) categorias[cat] = [];
    categorias[cat].push(modulo);
  });
  
  // Crear mapa de permisos por modulo_id y accion_id
  const permisoMap = {};
  permisos.forEach(p => {
    const key = `${p.modulo_id}_${p.accion_id}`;
    permisoMap[key] = p.id;
  });
  
  console.log('🔍 DEBUG renderizarMatrizPermisosGlobales - permisoMap:', permisoMap);
  console.log('🔍 DEBUG renderizarMatrizPermisosGlobales - permisosGlobalesSeleccionados:', permisosGlobalesSeleccionados);
  
  // Identificar qué acciones SÍ tienen permisos definidos (para filtrar columnas vacías)
  const accionesConPermisos = new Set();
  permisos.forEach(p => accionesConPermisos.add(p.accion_id));
  
  // Filtrar solo acciones que tienen al menos un permiso definido
  const accionesFiltradas = acciones.filter(acc => accionesConPermisos.has(acc.id));
  
  let html = '';
  
  Object.entries(categorias).forEach(([categoria, mods]) => {
    html += `
      <div class="card mb-2 shadow-sm">
        <div class="card-header bg-light py-2">
          <div class="d-flex justify-content-between align-items-center">
            <h6 class="mb-0 text-uppercase fw-bold">
              <i class="bi bi-folder me-2 text-primary"></i>${categoria}
            </h6>
            <small class="text-muted">${mods.length} módulo(s)</small>
          </div>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive" style="max-height: 350px; overflow-y: auto; overflow-x: auto; position: relative;">
            <table class="table table-sm table-hover mb-0" style="min-width: 100%; font-size: 0.875rem;">
              <thead class="table-light" style="position: sticky; top: 0; z-index: 10;">
                <tr>
                  <th class="sticky-col" style="width: 280px; position: sticky; left: 0; z-index: 11; background: #f8f9fa; box-shadow: 2px 0 5px rgba(0,0,0,0.1);">
                    <i class="bi bi-puzzle me-2"></i>Módulo
                  </th>
                  ${accionesFiltradas.map(acc => `
                    <th class="text-center align-middle" style="min-width: 85px; white-space: nowrap; padding: 0.5rem 0.25rem;">
                      <div class="d-flex flex-column align-items-center">
                        <i class="bi ${acc.icono || 'bi-circle'} mb-1"></i>
                        <small class="fw-semibold">${acc.nombre_mostrar}</small>
                      </div>
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                ${mods.map(modulo => `
                  <tr class="align-middle">
                    <td class="sticky-col" style="position: sticky; left: 0; background: white; z-index: 5; box-shadow: 2px 0 5px rgba(0,0,0,0.05); padding: 0.5rem;">
                      <div class="d-flex align-items-start">
                        <i class="bi ${modulo.icono || 'bi-circle'} me-2 mt-1 text-primary"></i>
                        <div class="flex-grow-1">
                          <strong class="d-block">${modulo.nombre_mostrar}</strong>
                          ${modulo.descripcion ? `<small class="text-muted d-block" style="font-size: 0.75rem;">${modulo.descripcion}</small>` : ''}
                        </div>
                      </div>
                    </td>
                    ${accionesFiltradas.map(accion => {
                      const key = `${modulo.id}_${accion.id}`;
                      const permisoId = permisoMap[key];
                      
                      if (!permisoId) {
                        return `<td class="text-center bg-light" style="padding: 0.5rem 0.25rem;"><small class="text-muted">-</small></td>`;
                      }
                      
                      const isChecked = permisosGlobalesSeleccionados.includes(permisoId);
                      
                      // DEBUG: Log para el primer permiso encontrado
                      if (permisosGlobalesSeleccionados.length > 0 && permisoId === 135) {
                        console.log('🔍 DEBUG Checkbox - permisoId:', permisoId, 'isChecked:', isChecked, 'array:', permisosGlobalesSeleccionados);
                      }
                      
                      return `
                        <td class="text-center" style="padding: 0.5rem 0.25rem;">
                          <div class="form-check d-flex justify-content-center align-items-center m-0">
                            <input type="checkbox" 
                                   class="form-check-input permiso-checkbox-global" 
                                   data-permiso-id="${permisoId}"
                                   ${isChecked ? 'checked' : ''}
                                   style="cursor: pointer; width: 1.25em; height: 1.25em;"
                                   onchange="togglePermisoGlobal(${permisoId})"
                                   title="${modulo.nombre_mostrar} - ${accion.nombre_mostrar}">
                          </div>
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  
  // Actualizar contador de permisos al renderizar
  actualizarContadorPermisosGlobales();
}

/**
 * Toggle permiso global
 */
function togglePermisoGlobal(permisoId) {
  const index = permisosGlobalesSeleccionados.indexOf(permisoId);
  if (index > -1) {
    permisosGlobalesSeleccionados.splice(index, 1);
  } else {
    permisosGlobalesSeleccionados.push(permisoId);
  }
  actualizarContadorPermisosGlobales();
  console.log('Permisos globales seleccionados:', permisosGlobalesSeleccionados);
}

/**
 * Actualizar contador de permisos seleccionados
 */
function actualizarContadorPermisosGlobales() {
  const countElement = document.getElementById('permisosSeleccionadosCount');
  if (countElement) {
    countElement.textContent = permisosGlobalesSeleccionados.length;
    
    // Cambiar color según cantidad
    const contadorElement = document.getElementById('contadorPermisos');
    if (contadorElement) {
      if (permisosGlobalesSeleccionados.length === 0) {
        contadorElement.innerHTML = `
          <i class="bi bi-exclamation-circle text-warning me-1"></i>
          <span id="permisosSeleccionadosCount">0</span> permisos seleccionados
        `;
      } else {
        contadorElement.innerHTML = `
          <i class="bi bi-check-circle-fill text-success me-1"></i>
          <span id="permisosSeleccionadosCount">${permisosGlobalesSeleccionados.length}</span> permisos seleccionados
        `;
      }
    }
  }
}

/**
 * Seleccionar/deseleccionar todos los permisos globales
 */
function seleccionarTodosPermisosGlobales(seleccionar) {
  const checkboxes = document.querySelectorAll('.permiso-checkbox-global');
  permisosGlobalesSeleccionados = [];
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = seleccionar;
    if (seleccionar) {
      const permisoId = parseInt(checkbox.dataset.permisoId);
      permisosGlobalesSeleccionados.push(permisoId);
    }
  });
  
  actualizarContadorPermisosGlobales();
  console.log('Permisos globales:', seleccionar ? 'Todos seleccionados' : 'Todos deseleccionados');
}

/**
 * Guardar rol global
 */
async function guardarRolGlobal() {
  const rolId = document.getElementById('rolGlobalId').value;
  const nombre = document.getElementById('rolGlobalNombre').value.trim();
  const descripcion = document.getElementById('rolGlobalDescripcion').value.trim();
  const nivel = parseInt(document.getElementById('rolGlobalNivel').value);
  const activo = document.getElementById('rolGlobalActivo').value === '1';
  
  // Validaciones
  if (!nombre) {
    mostrarAlertaConfigGlobal('El nombre del rol es requerido', 'warning');
    return;
  }
  
  if (!nivel || nivel < 80 || nivel > 99) {
    mostrarAlertaConfigGlobal('Debes seleccionar un nivel válido (80-99)', 'warning');
    return;
  }
  
  if (permisosGlobalesSeleccionados.length === 0) {
    const confirmar = confirm('No has seleccionado ningún permiso. ¿Deseas continuar?');
    if (!confirmar) return;
  }
  
  try {
    const url = rolId 
      ? `${API_URL}/super-admin/roles-globales/${rolId}`
      : `${API_URL}/super-admin/roles-globales`;
    
    const method = rolId ? 'PUT' : 'POST';
    
    const payload = {
      nombre,
      descripcion,
      nivel,
      activo,
      permisos: permisosGlobalesSeleccionados
    };
    
    console.log('📤 Guardando rol global:', payload);
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Error al guardar rol global');
    }
    
    console.log('✅ Rol global guardado exitosamente');
    
    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('rolGlobalModal'));
    modal.hide();
    
    // Mostrar mensaje de éxito
    mostrarAlertaConfigGlobal(
      rolId ? 'Rol global actualizado exitosamente' : 'Rol global creado exitosamente',
      'success'
    );
    
    // Recargar tabla
    cargarRolesGlobales();
    
  } catch (error) {
    console.error('Error al guardar rol global:', error);
    mostrarAlertaConfigGlobal(error.message, 'danger');
  }
}

/**
 * Ver detalle de rol global
 */
async function verDetalleRolGlobal(rolId) {
  try {
    const response = await fetch(`${API_URL}/super-admin/roles-globales/${rolId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) throw new Error('Error al cargar rol global');
    
    const data = await response.json();
    const rol = data.data;
    
    // Mostrar modal con información
    const permisosHtml = rol.permisos.length > 0
      ? rol.permisos.map(p => `
          <li class="list-group-item">
            <i class="bi bi-check-circle text-success me-2"></i>
            <strong>${p.modulo_nombre}</strong> - ${p.accion_nombre}
          </li>
        `).join('')
      : '<li class="list-group-item text-muted">Sin permisos asignados</li>';
    
    const htmlContent = `
      <div class="modal fade" id="modalDetalleRolGlobal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">
                <i class="bi bi-shield-fill-check me-2"></i>
                Detalle: ${rol.nombre}
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row mb-3">
                <div class="col-md-6">
                  <strong>Nivel de Privilegio:</strong><br>
                  <span class="badge bg-info fs-6">${rol.nivel}</span>
                </div>
                <div class="col-md-6">
                  <strong>Estado:</strong><br>
                  <span class="badge bg-${rol.activo ? 'success' : 'secondary'} fs-6">
                    ${rol.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              <div class="mb-3">
                <strong>Descripción:</strong><br>
                <p class="text-muted">${rol.descripcion || 'Sin descripción'}</p>
              </div>
              <div>
                <strong>Permisos Asignados (${rol.permisos.length}):</strong>
                <ul class="list-group mt-2" style="max-height: 400px; overflow-y: auto;">
                  ${permisosHtml}
                </ul>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
              <button type="button" class="btn btn-warning" onclick="editarRolGlobal(${rol.id})" data-bs-dismiss="modal">
                <i class="bi bi-pencil me-2"></i>Editar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Remover modal anterior si existe
    const oldModal = document.getElementById('modalDetalleRolGlobal');
    if (oldModal) oldModal.remove();
    
    // Agregar nuevo modal
    document.body.insertAdjacentHTML('beforeend', htmlContent);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalDetalleRolGlobal'));
    modal.show();
    
  } catch (error) {
    console.error('Error:', error);
    mostrarAlertaConfigGlobal('Error al cargar detalle del rol global', 'danger');
  }
}

/**
 * Editar rol global (abre modal con datos)
 */
function editarRolGlobal(rolId) {
  abrirModalRolGlobal(rolId);
}

/**
 * Eliminar rol global
 */
async function eliminarRolGlobal(rolId, nombre, empresasUsando) {
  const mensaje = empresasUsando > 0
    ? `El rol "${nombre}" está siendo usado por ${empresasUsando} empresa(s).\n\n¿Estás seguro de eliminarlo? Esto podría afectar a los usuarios que lo tienen asignado.`
    : `¿Estás seguro de eliminar el rol global "${nombre}"?`;
  
  if (!confirm(mensaje)) return;
  
  try {
    const response = await fetch(`${API_URL}/super-admin/roles-globales/${rolId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Error al eliminar rol global');
    }
    
    console.log('✅ Rol global eliminado exitosamente');
    
    mostrarAlertaConfigGlobal('Rol global eliminado exitosamente', 'success');
    cargarRolesGlobales();
    
  } catch (error) {
    console.error('Error al eliminar rol global:', error);
    mostrarAlertaConfigGlobal(error.message, 'danger');
  }
}

/**
 * Mostrar alerta en configuración global
 */
function mostrarAlertaConfigGlobal(mensaje, tipo = 'info') {
  const container = document.getElementById('alertContainerConfigGlobal');
  if (!container) {
    alert(mensaje);
    return;
  }
  
  const alertHtml = `
    <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
      <i class="bi bi-${tipo === 'danger' ? 'exclamation-triangle' : tipo === 'success' ? 'check-circle' : 'info-circle'} me-2"></i>
      ${mensaje}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;
  
  container.innerHTML = alertHtml;
  
  // Auto-cerrar después de 5 segundos
  setTimeout(() => {
    container.innerHTML = '';
  }, 5000);
}