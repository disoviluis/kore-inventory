/**
 * MENSAJEROS DASHBOARD - Dual View
 * Vista para Mensajeros (móvil) y Admin/Supervisor (desktop)
 */

const API_URL = '/api';

let currentEmpresaId = null;
let currentEmpresa = null;
let currentUsuario = null;
let misTrasladosMensajero = [];
let allTraslados = [];
let signaturePad = null;
let currentGPS = { lat: null, lng: null };
let trasladoActual = null;

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 === INICIO DE CARGA DE PÁGINA ===');
    
    currentUsuario = JSON.parse(localStorage.getItem('usuario'));
    
    if (!currentUsuario) {
        window.location.href = 'login.html';
        return;
    }

    // Obtener empresa activa (igual que otros módulos)
    const empresaActivaId = localStorage.getItem('empresaActiva');
    
    if (!empresaActivaId) {
        Swal.fire({
            icon: 'warning',
            title: 'Empresa no seleccionada',
            text: 'Por favor selecciona una empresa desde el dashboard'
        }).then(() => {
            window.location.href = 'dashboard.html';
        });
        return;
    }

    currentEmpresaId = empresaActivaId;
    console.log('📍 Empresa activa:', currentEmpresaId);

    // Cargar módulos permitidos desde la API
    await cargarModulosPermitidos();

    // Initialize
    loadUserInfo();
    await cargarEmpresas(); // Cargar selector de empresas
    await cargarDatosEmpresa(); // Cargar datos de empresa activa
    detectarTipoVista();
    
    // VERIFICAR ESTADO DESPUÉS DE detectarTipoVista()
    console.log('📺 === VERIFICACIÓN POST-DETECCIÓN ===');
    const vistaMensajero = document.getElementById('vistaMensajero');
    const vistaAdmin = document.getElementById('vistaAdmin');
    console.log('vistaMensajero display:', vistaMensajero.style.display);
    console.log('vistaAdmin display:', vistaAdmin.style.display);
    console.log('vistaMensajero offsetHeight:', vistaMensajero.offsetHeight);
    console.log('vistaAdmin offsetHeight:', vistaAdmin.offsetHeight);
    
    initializeEventListeners();
    await cargarDatos();
    
    // Auto-refresh every 30 seconds
    setInterval(cargarDatos, 30000);
    
    console.log('✅ === CARGA DE PÁGINA COMPLETADA ===');
});

// ==========================================
// CARGAR MÓDULOS PERMITIDOS
// ==========================================

async function cargarModulosPermitidos() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/auth/permisos/modulos`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
                localStorage.setItem('modulosPermitidos', JSON.stringify(data.data.modulos));
            }
        }
    } catch (error) {
        console.error('Error al cargar módulos permitidos:', error);
    }
}

// ==========================================
// DETECTAR TIPO DE VISTA
// ==========================================

function detectarTipoVista() {
    const modulosPermitidos = JSON.parse(localStorage.getItem('modulosPermitidos') || '[]');
    
    console.log('🔍 Detectando tipo de vista...');
    console.log('Módulos permitidos:', modulosPermitidos);
    
    // Módulos administrativos que indican que el usuario es supervisor/admin
    const modulosAdmin = ['usuarios', 'roles', 'empresas', 'licencias', 'auditoria', 'facturacion'];
    
    // Verificar si tiene acceso al módulo mensajeros
    const tieneAccesoMensajeros = modulosPermitidos.some(m => m.nombre === 'mensajeros');
    
    // Verificar si tiene algún módulo administrativo
    const tieneModulosAdmin = modulosPermitidos.some(m => modulosAdmin.includes(m.nombre));
    
    console.log('Tiene acceso a mensajeros:', tieneAccesoMensajeros);
    console.log('Tiene módulos admin:', tieneModulosAdmin);
    console.log('Total módulos:', modulosPermitidos.length);
    
    // Mostrar vista mensajero si:
    // 1. Tiene acceso al módulo mensajeros
    // 2. NO tiene acceso a módulos administrativos
    // Esto significa que es un mensajero de campo, no un supervisor
    const esMensajeroCampo = tieneAccesoMensajeros && !tieneModulosAdmin;
    
    if (esMensajeroCampo) {
        // Vista móvil optimizada para mensajeros de campo
        document.getElementById('vistaMensajero').style.display = 'block';
        document.getElementById('vistaAdmin').style.display = 'none';
        document.getElementById('pageTitle').textContent = 'Mis Entregas';
        console.log('✅ Mostrando vista MENSAJERO (móvil) - Usuario de campo');
        
        // Verificar que realmente se ocultó la vista admin
        const vistaAdminElement = document.getElementById('vistaAdmin');
        console.log('📋 Vista Admin después de ocultar:', vistaAdminElement.style.display);
        
        // FORZAR ocultación de vista admin con !important
        vistaAdminElement.style.setProperty('display', 'none', 'important');
        console.log('🔒 Vista Admin FORZADA a none con !important');
    } else {
        // Vista de administración/supervisor
        document.getElementById('vistaMensajero').style.display = 'none';
        document.getElementById('vistaAdmin').style.display = 'block';
        document.getElementById('pageTitle').textContent = 'Control de Mensajeros';
        console.log('✅ Mostrando vista ADMIN (supervisor) - Usuario con permisos administrativos');
        
        // Verificar que realmente se ocultó la vista mensajero  
        const vistaMensajeroElement = document.getElementById('vistaMensajero');
        console.log('📋 Vista Mensajero después de ocultar:', vistaMensajeroElement.style.display);
        
        // FORZAR ocultación de vista mensajero con !important
        vistaMensajeroElement.style.setProperty('display', 'none', 'important');
        console.log('🔒 Vista Mensajero FORZADA a none con !important');
    }
}

// ==========================================
// LOAD USER INFO
// ==========================================

function loadUserInfo() {
    if (currentUsuario) {
        const nombreCompleto = `${currentUsuario.nombre || ''} ${currentUsuario.apellido || ''}`.trim();
        document.getElementById('userName').textContent = nombreCompleto || 'Usuario';
        const roleText = getTipoUsuarioTexto(currentUsuario.tipo_usuario);
        document.getElementById('userRole').textContent = roleText;
    }
}

function getTipoUsuarioTexto(tipo) {
    const tipos = {
        'super_admin': 'Super Administrador',
        'admin_empresa': 'Administrador',
        'usuario': 'Usuario',
        'mensajero': 'Mensajero',
        'soporte': 'Soporte'
    };
    return tipos[tipo] || tipo;
}

// ==========================================
// CARGAR EMPRESAS Y DATOS DE EMPRESA
// ==========================================

async function cargarEmpresas() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/empresas`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            const empresas = data.data || [];
            const select = document.getElementById('companySelector');
            
            select.innerHTML = '<option value="">Seleccione una empresa</option>';
            
            empresas.forEach(empresa => {
                const option = document.createElement('option');
                option.value = empresa.id;
                option.textContent = empresa.nombre;
                select.appendChild(option);
            });

            // Establecer empresa activa
            const empresaActivaId = localStorage.getItem('empresaActiva');
            if (empresaActivaId) {
                select.value = empresaActivaId;
                await cargarDatosEmpresa();
            }

            // Event listener para cambio de empresa
            select.addEventListener('change', async function() {
                const empresaId = this.value;
                if (empresaId) {
                    localStorage.setItem('empresaActiva', empresaId);
                    currentEmpresaId = empresaId;
                    await cargarDatosEmpresa();
                    await cargarDatos(); // Recargar datos con la nueva empresa
                }
            });
        }
    } catch (error) {
        console.error('Error al cargar empresas:', error);
    }
}

async function cargarDatosEmpresa() {
    try {
        const empresaActivaId = localStorage.getItem('empresaActiva');
        if (!empresaActivaId) return;

        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/empresas/${empresaActivaId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentEmpresa = data.data;
            
            // Actualizar variables globales
            currentEmpresaId = empresaActivaId;
        }
    } catch (error) {
        console.error('Error al cargar datos de empresa:', error);
    }
}

// ==========================================
// CARGAR DATOS
// ==========================================

async function cargarDatos() {
    const vistaMensajero = document.getElementById('vistaMensajero');
    const vistaAdmin = document.getElementById('vistaAdmin');
    
    console.log('🔄 cargarDatos() - Vista Mensajero display:', vistaMensajero.style.display);
    console.log('🔄 cargarDatos() - Vista Admin display:', vistaAdmin.style.display);
    
    const esMensajero = vistaMensajero.style.display === 'block';
    
    console.log('🔄 Es mensajero?', esMensajero);
    
    if (esMensajero) {
        console.log('➡️ Llamando a cargarMisTrasladosMensajero()');
        await cargarMisTrasladosMensajero();
    } else {
        console.log('➡️ Llamando a cargarTodosLosTraslados() [Vista Admin]');
        await cargarTodosLosTraslados();
    }
}

// ==========================================
// VISTA MENSAJERO
// ==========================================

async function cargarMisTrasladosMensajero() {
    try {
        console.log('📡 Cargando mis traslados...');
        const token = localStorage.getItem('token');
        
        const response = await fetch(`${API_URL}/traslados/mensajero/mis-traslados`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Result completo:', result);
        
        if (result.success) {
            misTrasladosMensajero = result.data;
            console.log('✅ Traslados cargados:', misTrasladosMensajero.length, 'traslados');
            renderizarVistaMensajero();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('❌ Error al cargar mis traslados:', error);
        mostrarError('No se pudieron cargar tus traslados');
    }
}

function renderizarVistaMensajero() {
    console.log('🎨 Renderizando vista mensajero...');
    console.log('Total traslados:', misTrasladosMensajero.length);
    
    const filtroFecha = document.querySelector('input[name="filtroFecha"]:checked').value;
    
    // Filtrar por fecha
    const trasladosFiltrados = filtrarPorFecha(misTrasladosMensajero, filtroFecha);
    console.log('Traslados filtrados (' + filtroFecha + '):', trasladosFiltrados.length);
    
    // Separar por estado
    const pendientes = trasladosFiltrados.filter(t => t.estado === 'en_transito');
    const completadas = trasladosFiltrados.filter(t => t.estado === 'recibido' || t.estado === 'parcialmente_recibido');
    
    console.log('📊 Pendientes:', pendientes.length, 'Completadas:', completadas.length);
    
    // Actualizar contadores
    document.getElementById('misPendientes').textContent = pendientes.length;
    document.getElementById('misEnRuta').textContent = 0; // TODO: cuando tengamos estado "en_ruta"
    document.getElementById('misCompletadas').textContent = completadas.length;
    
    document.getElementById('badgePendientes').textContent = pendientes.length;
    document.getElementById('badgeEnRuta').textContent = 0;
    document.getElementById('badgeCompletadas').textContent = completadas.length;
    
    // Renderizar listas
    console.log('📋 Renderizando listas...');
    renderizarTarjetasMensajero('listaPendientes', pendientes, 'pendiente');
    renderizarTarjetasMensajero('listaEnRuta', [], 'enruta');
    renderizarTarjetasMensajero('listaCompletadas', completadas, 'completada');
    
    // Actualizar estadísticas
    actualizarEstadisticasMensajero(completadas);
    console.log('✅ Vista renderizada completamente');
}

function renderizarTarjetasMensajero(containerId, traslados, tipo) {
    const container = document.getElementById(containerId);
    
    if (traslados.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="bi bi-inbox fs-1 text-muted"></i>
                <p class="text-muted mt-2">Sin traslados ${tipo === 'pendiente' ? 'pendientes' : tipo === 'enruta' ? 'en ruta' : 'completados'}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = traslados.map(t => crearTarjetaTraslado(t, tipo)).join('');
}

function crearTarjetaTraslado(traslado, tipo) {
    const estadoColor = tipo === 'pendiente' ? 'danger' : tipo === 'enruta' ? 'warning' : 'success';
    const estadoIcon = tipo === 'pendiente' ? 'box-seam' : tipo === 'enruta' ? 'truck' : 'check-circle';
    
    return `
        <div class="col-12">
            <div class="card shadow-sm border-start border-4 border-${estadoColor} mensajero-card">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="mb-0">
                            <i class="bi bi-${estadoIcon} text-${estadoColor} me-2"></i>
                            ${traslado.numero_traslado}
                        </h6>
                        <span class="badge bg-${estadoColor}">${tipo.toUpperCase()}</span>
                    </div>
                    
                    <div class="small text-muted mb-2">
                        <strong>${traslado.bodega_origen_nombre}</strong> → <strong>${traslado.bodega_destino_nombre}</strong>
                    </div>
                    
                    <div class="mb-2">
                        <i class="bi bi-geo-alt text-danger me-2"></i>
                        <small>${traslado.bodega_destino_direccion}, ${traslado.bodega_destino_ciudad}</small>
                    </div>
                    
                    <div class="mb-2">
                        <i class="bi bi-person text-primary me-2"></i>
                        <small><strong>${traslado.destinatario_nombre || 'Sin destinatario'}</strong> ${traslado.destinatario_cargo ? '(' + traslado.destinatario_cargo + ')' : ''}</small>
                    </div>
                    
                    ${traslado.destinatario_telefono ? `
                        <div class="mb-2">
                            <i class="bi bi-telephone text-success me-2"></i>
                            <small><a href="tel:${traslado.destinatario_telefono}">${traslado.destinatario_telefono}</a></small>
                        </div>
                    ` : ''}
                    
                    <div class="mb-2">
                        <i class="bi bi-box text-info me-2"></i>
                        <small>${traslado.total_productos || 0} productos (${traslado.total_unidades || 0} unidades)</small>
                    </div>
                    
                    <div class="mb-3">
                        <i class="bi bi-clock text-muted me-2"></i>
                        <small>Enviado: ${formatearFecha(traslado.fecha_envio)}</small>
                    </div>
                    
                    <!-- Botones según estado -->
                    <div class="d-grid gap-2">
                        ${tipo === 'pendiente' ? `
                            <div class="btn-group">
                                <button class="btn btn-sm btn-outline-primary" onclick="verMapaTraslado(${traslado.id})">
                                    <i class="bi bi-geo-alt me-1"></i> Ver Mapa
                                </button>
                                <button class="btn btn-sm btn-success" onclick="iniciarEntrega(${traslado.id})">
                                    <i class="bi bi-play-circle me-1"></i> Iniciar Ruta
                                </button>
                            </div>
                            <button class="btn btn-sm btn-primary" onclick="abrirModalRecibir(${traslado.id})">
                                <i class="bi bi-check-circle me-1"></i> Recibir Ahora
                            </button>
                        ` : tipo === 'enruta' ? `
                            <div class="btn-group">
                                <button class="btn btn-sm btn-outline-primary" onclick="verMapaTraslado(${traslado.id})">
                                    <i class="bi bi-geo-alt me-1"></i> Ver Mapa
                                </button>
                                <button class="btn btn-sm btn-success" onclick="abrirModalRecibir(${traslado.id})">
                                    <i class="bi bi-check-circle me-1"></i> Recibir
                                </button>
                            </div>
                        ` : `
                            <button class="btn btn-sm btn-outline-info" onclick="verDetalleTraslado(${traslado.id})">
                                <i class="bi bi-eye me-1"></i> Ver Detalle
                            </button>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function actualizarEstadisticasMensajero(completadas) {
    document.getElementById('statMisEntregas').textContent = completadas.length;
    
    if (completadas.length > 0) {
        // TODO: Calcular tiempos reales cuando tengamos fecha_inicio y fecha_fin
        document.getElementById('statTiempoPromedio').textContent = '-- min';
        document.getElementById('statMasRapida').textContent = '-- min';
        document.getElementById('statEficiencia').textContent = '100%';
    }
}

// ==========================================
// FUNCIONES DE TRASLADO
// ==========================================

async function iniciarEntrega(trasladoId) {
    try {
        const confirmacion = await Swal.fire({
            title: '¿Iniciar entrega?',
            text: 'Esto marcará que has salido a entregar este traslado',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, iniciar',
            cancelButtonText: 'Cancelar'
        });
        
        if (!confirmacion.isConfirmed) return;
        
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/traslados/${trasladoId}/iniciar`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            Swal.fire({
                icon: 'success',
                title: '¡Entrega iniciada!',
                text: 'Buena suerte en tu ruta',
                timer: 2000,
                showConfirmButton: false
            });
            await cargarDatos();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Error al iniciar entrega:', error);
        mostrarError(error.message);
    }
}

async function abrirModalRecibir(trasladoId) {
    try {
        // Cargar detalle del traslado
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/traslados/${trasladoId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const result = await response.json();
        
        if (!result.success) throw new Error(result.message);
        
        trasladoActual = result.data;
        
        // Llenar modal
        document.getElementById('recibirNumero').textContent = trasladoActual.numero_traslado;
        
        // Pre-llenar datos del receptor si existen
        document.getElementById('receptorNombre').value = trasladoActual.destinatario_nombre || '';
        document.getElementById('receptorCedula').value = trasladoActual.destinatario_documento || '';
        document.getElementById('receptorTelefono').value = trasladoActual.destinatario_telefono || '';
        document.getElementById('receptorCargo').value = trasladoActual.destinatario_cargo || '';
        
        // Renderizar productos
        renderizarProductosRecibir(trasladoActual.detalle);
        
        // Inicializar canvas de firma
        inicializarCanvasFirma();
        
        // Obtener GPS
        obtenerUbicacion();
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('modalRecibirTraslado'));
        modal.show();
        
    } catch (error) {
        console.error('Error al abrir modal:', error);
        mostrarError(error.message);
    }
}

function renderizarProductosRecibir(productos) {
    const container = document.getElementById('productosRecibir');
    
    container.innerHTML = productos.map((p, index) => `
        <div class="d-flex align-items-center mb-2 p-2 border rounded">
            <input type="checkbox" class="form-check-input me-3" id="prod_${index}" checked data-producto-id="${p.producto_id}">
            <label class="form-check-label flex-grow-1" for="prod_${index}">
                <strong>${p.producto_nombre}</strong> - ${p.cantidad_aprobada} unidades
                <small class="text-muted d-block">${p.producto_referencia || ''}</small>
            </label>
            <input type="number" class="form-control form-control-sm" style="width: 80px;" 
                   value="${p.cantidad_aprobada}" max="${p.cantidad_aprobada}" min="0"
                   data-producto-id="${p.producto_id}" data-cantidad-max="${p.cantidad_aprobada}">
        </div>
    `).join('');
}

function inicializarCanvasFirma() {
    const canvas = document.getElementById('canvasFirma');
    
    if (signaturePad) {
        signaturePad.clear();
    } else {
        signaturePad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)',
            penColor: 'rgb(0, 0, 0)'
        });
    }
    
    // Botón limpiar
    document.getElementById('btnLimpiarFirma').onclick = () => {
        signaturePad.clear();
    };
}

function obtenerUbicacion() {
    const statusDiv = document.getElementById('gpsStatus');
    
    if (!navigator.geolocation) {
        statusDiv.innerHTML = '<span class="text-danger">GPS no disponible en este dispositivo</span>';
        return;
    }
    
    statusDiv.innerHTML = '<span class="text-warning">Obteniendo ubicación...</span>';
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentGPS = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            statusDiv.innerHTML = `
                <span class="text-success">
                    <i class="bi bi-check-circle me-1"></i>
                    ${currentGPS.lat.toFixed(6)}, ${currentGPS.lng.toFixed(6)}
                </span>
            `;
        },
        (error) => {
            console.error('Error al obtener GPS:', error);
            statusDiv.innerHTML = `<span class="text-warning">No se pudo obtener ubicación (continuar de todos modos)</span>`;
        }
    );
}

async function confirmarRecepcion() {
    try {
        // Validar firma
        if (signaturePad.isEmpty()) {
            mostrarError('Por favor captura la firma del receptor');
            return;
        }
        
        // Validar datos del receptor
        const nombre = document.getElementById('receptorNombre').value.trim();
        const cedula = document.getElementById('receptorCedula').value.trim();
        
        if (!nombre || !cedula) {
            mostrarError('Por favor completa el nombre y cédula del receptor');
            return;
        }
        
        // Preparar productos recibidos (solo los marcados)
        const productosInputs = document.querySelectorAll('#productosRecibir input[type="number"]');
        const productos_recibidos = Array.from(productosInputs)
            .filter(input => {
                // Verificar si el checkbox correspondiente está marcado
                const checkbox = input.closest('.d-flex').querySelector('input[type="checkbox"]');
                return checkbox && checkbox.checked;
            })
            .map(input => ({
                producto_id: parseInt(input.dataset.productoId),
                cantidad_recibida: parseInt(input.value) || 0
            }));
        
        // Validar que hay productos para recibir
        if (productos_recibidos.length === 0) {
            mostrarError('Debes marcar al menos un producto para recibir');
            return;
        }
        
        console.log('📦 Productos a recibir:', productos_recibidos);
        
        // Preparar firma
        const firma_recepcion = signaturePad.toDataURL();
        
        // Preparar datos
        const datosRecepcion = {
            productos_recibidos,
            observaciones_recepcion: document.getElementById('observaciones').value.trim(),
            firma_recepcion,
            gps_latitud: currentGPS.lat,
            gps_longitud: currentGPS.lng,
            destinatario_nombre: nombre,
            destinatario_documento: cedula,
            destinatario_telefono: document.getElementById('receptorTelefono').value.trim(),
            destinatario_cargo: document.getElementById('receptorCargo').value.trim()
        };
        
        console.log('📤 Datos completos de recepción:', datosRecepcion);
        
        // Mostrar confirmación
        const confirmacion = await Swal.fire({
            title: '¿Confirmar entrega?',
            text: 'Esta acción actualizará el stock y no se puede deshacer',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, confirmar',
            cancelButtonText: 'Cancelar'
        });
        
        if (!confirmacion.isConfirmed) return;
        
        // Enviar al backend
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/traslados/${trasladoActual.id}/recibir`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datosRecepcion)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Cerrar modal
            bootstrap.Modal.getInstance(document.getElementById('modalRecibirTraslado')).hide();
            
            // Mostrar éxito
            await Swal.fire({
                icon: 'success',
                title: '¡Entrega completada!',
                text: 'El traslado ha sido recibido exitosamente',
                timer: 2000,
                showConfirmButton: false
            });
            
            // Recargar datos
            await cargarDatos();
        } else {
            throw new Error(result.message);
        }
        
    } catch (error) {
        console.error('Error al confirmar recepción:', error);
        mostrarError(error.message);
    }
}

// ==========================================
// VISTA ADMIN (Placeholders)
// ==========================================

async function cargarTodosLosTraslados() {
    // TODO: Implementar vista admin (ya existe en el código original)
    console.log('Vista admin - TODO');
}

// ==========================================
// UTILIDADES
// ==========================================

function filtrarPorFecha(traslados, filtro) {
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    
    return traslados.filter(t => {
        const fecha = new Date(t.fecha_envio || t.created_at);
        
        switch(filtro) {
            case 'hoy':
                return fecha >= hoy;
            case 'semana':
                const inicioSemana = new Date(hoy);
                inicioSemana.setDate(hoy.getDate() - hoy.getDay());
                return fecha >= inicioSemana;
            case 'mes':
                const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
                return fecha >= inicioMes;
            default:
                return true;
        }
    });
}

function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    return formatFechaColombia(fecha);
}

function mostrarError(mensaje) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: mensaje,
        toast: true,
        position: 'top-end',
        timer: 4000,
        timerProgressBar: true,
        showConfirmButton: false
    });
}

function verMapaTraslado(trasladoId) {
    // TODO: Abrir Google Maps con la dirección de destino
    mostrarError('Función de mapa en desarrollo');
}

async function verDetalleTraslado(trasladoId) {
    // TODO: Cargar y mostrar detalle completo
    mostrarError('Función de detalle en desarrollo');
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function initializeEventListeners() {
    // Refresh
    document.getElementById('btnRefresh')?.addEventListener('click', cargarDatos);
    
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });
    
    // Filtros de fecha (solo vista mensajero)
    const filtrosFecha = document.querySelectorAll('input[name="filtroFecha"]');
    filtrosFecha.forEach(filtro => {
        filtro.addEventListener('change', renderizarVistaMensajero);
    });
    
    // Botón confirmar recepción
    document.getElementById('btnConfirmarRecepcion')?.addEventListener('click', confirmarRecepcion);
}