/**
 * KORE Inventory - Vista Móvil Mensajero
 * Gestión de entregas para mensajeros
 */

// Configuración
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : 'http://18.191.181.99/api';

// Estado global
let currentUser = null;
let currentTraslado = null;
let signaturePad = null;
let capturedPhoto = null;
let currentLocation = null;
let traslados = {
    pendientes: [],
    enTransito: [],
    completadas: []
};

// ========================================
// INICIALIZACIÓN
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    await verificarAutenticacion();
    inicializarEventos();
    inicializarFirma();
    await cargarTraslados();
});

/**
 * Verificar que el usuario está autenticado y es mensajero
 */
async function verificarAutenticacion() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!data.success) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }

        currentUser = data.data.usuario;

        // Verificar que es mensajero
        if (currentUser.tipo_usuario !== 'mensajero') {
            alert('Esta vista es solo para mensajeros');
            window.location.href = 'dashboard.html';
            return;
        }

        document.getElementById('mensajeroNombre').textContent = 
            `${currentUser.nombre} ${currentUser.apellido}`;

    } catch (error) {
        console.error('Error al verificar autenticación:', error);
        window.location.href = 'login.html';
    }
}

/**
 * Inicializar eventos de la interfaz
 */
function inicializarEventos() {
    // Tabs
    document.querySelectorAll('.mobile-tab').forEach(tab => {
        tab.addEventListener('click', () => cambiarTab(tab.dataset.tab));
    });

    // Modal detalle
    document.getElementById('btnCerrarDetalle').addEventListener('click', cerrarDetalle);

    // GPS
    document.getElementById('btnCapturarGPS').addEventListener('click', capturarUbicacion);

    // Foto
    document.getElementById('btnTomarFoto').addEventListener('click', () => {
        document.getElementById('inputFoto').click();
    });

    document.getElementById('inputFoto').addEventListener('change', manejarFoto);

    // Firma
    document.getElementById('btnClearSignature').addEventListener('click', limpiarFirma);
    document.getElementById('inputRecipientName').addEventListener('input', validarFormularioCompleto);

    // Completar entrega
    document.getElementById('btnCompletarEntrega').addEventListener('click', completarEntrega);
}

/**
 * Inicializar canvas de firma digital
 */
function inicializarFirma() {
    const canvas = document.getElementById('signatureCanvas');
    signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)'
    });

    // Ajustar tamaño del canvas
    const resizeCanvas = () => {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d').scale(ratio, ratio);
        signaturePad.clear();
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Validar cuando se firma
    signaturePad.addEventListener('endStroke', validarFormularioCompleto);
}

// ========================================
// GESTIÓN DE TABS
// ========================================

function cambiarTab(tabName) {
    // Actualizar tabs activos
    document.querySelectorAll('.mobile-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Mostrar contenido correspondiente
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// ========================================
// CARGA DE TRASLADOS
// ========================================

async function cargarTraslados() {
    try {
        mostrarLoading();

        const response = await fetch(
            `${API_URL}/traslados/mensajero/mis-traslados?empresa_id=${currentUser.empresa_id}`,
            {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            }
        );

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Error al cargar traslados');
        }

        // Agrupar traslados por estado
        traslados.pendientes = data.data.filter(t => t.estado === 'pendiente');
        traslados.enTransito = data.data.filter(t => t.estado === 'en_transito');
        traslados.completadas = data.data.filter(t => t.estado === 'completado');

        // Actualizar badges
        document.getElementById('badgePendientes').textContent = traslados.pendientes.length;
        document.getElementById('badgeEnTransito').textContent = traslados.enTransito.length;
        document.getElementById('badgeCompletadas').textContent = traslados.completadas.length;

        // Renderizar listas
        renderizarTraslados('pendientes', traslados.pendientes);
        renderizarTraslados('enTransito', traslados.enTransito);
        renderizarTraslados('completadas', traslados.completadas);

    } catch (error) {
        console.error('Error al cargar traslados:', error);
        mostrarError('No se pudieron cargar las entregas');
    }
}

function mostrarLoading() {
    ['pendientes', 'enTransito', 'completadas'].forEach(tipo => {
        const lista = tipo === 'pendientes' ? 'listaPendientes' : 
                      tipo === 'enTransito' ? 'listaEnTransito' : 'listaCompletadas';
        document.getElementById(lista).innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p class="mt-2 text-muted">Cargando entregas...</p>
            </div>
        `;
    });
}

function renderizarTraslados(tipo, lista) {
    const contenedor = tipo === 'pendientes' ? 'listaPendientes' : 
                       tipo === 'enTransito' ? 'listaEnTransito' : 'listaCompletadas';
    
    const elemento = document.getElementById(contenedor);

    if (lista.length === 0) {
        elemento.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-inbox"></i>
                <h5>No hay entregas ${tipo === 'pendientes' ? 'pendientes' : tipo === 'enTransito' ? 'en tránsito' : 'completadas'}</h5>
                <p>Cuando tengas nuevas entregas aparecerán aquí</p>
            </div>
        `;
        return;
    }

    elemento.innerHTML = lista.map(traslado => `
        <div class="entrega-card ${traslado.estado === 'pendiente' ? 'pendiente' : traslado.estado === 'en_transito' ? 'en-transito' : 'completado'}">
            <div class="entrega-header">
                <div>
                    <div class="entrega-id">Traslado #${traslado.id}</div>
                    <small class="text-muted">${formatearFecha(traslado.fecha_traslado)}</small>
                </div>
                <span class="entrega-badge badge ${getBadgeClass(traslado.estado)}">
                    ${getEstadoTexto(traslado.estado)}
                </span>
            </div>

            <div class="entrega-info">
                <i class="bi bi-building"></i>
                <span><strong>Origen:</strong> ${traslado.bodega_origen_nombre}</span>
            </div>

            <div class="entrega-info">
                <i class="bi bi-geo-alt"></i>
                <span><strong>Destino:</strong> ${traslado.bodega_destino_nombre}</span>
            </div>

            <div class="entrega-info">
                <i class="bi bi-box-seam"></i>
                <span><strong>Productos:</strong> ${traslado.cantidad_productos || 0} items</span>
            </div>

            <div class="entrega-actions">
                ${traslado.estado === 'pendiente' ? `
                    <button class="btn-entrega btn-start" onclick="iniciarEntrega(${traslado.id})">
                        <i class="bi bi-play-circle me-1"></i>Iniciar
                    </button>
                ` : ''}
                <button class="btn-entrega btn-view" onclick="verDetalle(${traslado.id})">
                    <i class="bi bi-eye me-1"></i>Ver Detalle
                </button>
            </div>
        </div>
    `).join('');
}

// ========================================
// DETALLE DEL TRASLADO
// ========================================

async function verDetalle(trasladoId) {
    try {
        const response = await fetch(`${API_URL}/traslados/${trasladoId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message);
        }

        currentTraslado = data.data;
        mostrarModalDetalle();

    } catch (error) {
        console.error('Error al cargar detalle:', error);
        mostrarError('No se pudo cargar el detalle');
    }
}

function mostrarModalDetalle() {
    document.getElementById('detalleTraslado').textContent = `Traslado #${currentTraslado.id}`;
    document.getElementById('detalleOrigen').textContent = currentTraslado.bodega_origen_nombre;
    document.getElementById('detalleDestino').textContent = currentTraslado.bodega_destino_nombre;
    document.getElementById('detalleProductos').textContent = `${currentTraslado.cantidad_productos || 0} items`;
    document.getElementById('detalleObservaciones').textContent = currentTraslado.observaciones || 'Sin observaciones';

    // Mostrar secciones según el estado
    const esEnTransito = currentTraslado.estado === 'en_transito';
    document.getElementById('sectionGPS').style.display = esEnTransito ? 'block' : 'none';
    document.getElementById('sectionFoto').style.display = esEnTransito ? 'block' : 'none';
    document.getElementById('sectionFirma').style.display = esEnTransito ? 'block' : 'none';
    document.getElementById('actionButtons').style.display = esEnTransito ? 'block' : 'none';

    // Si ya está completado, mostrar datos
    if (currentTraslado.estado === 'completado') {
        if (currentTraslado.latitud_entrega && currentTraslado.longitud_entrega) {
            document.getElementById('sectionGPS').style.display = 'block';
            document.getElementById('gpsCoords').style.display = 'block';
            document.getElementById('coordsText').textContent = 
                `${currentTraslado.latitud_entrega}, ${currentTraslado.longitud_entrega}`;
        }
    }

    document.getElementById('modalDetalle').classList.add('show');
}

function cerrarDetalle() {
    document.getElementById('modalDetalle').classList.remove('show');
    currentTraslado = null;
    capturedPhoto = null;
    currentLocation = null;
    limpiarFirma();
    document.getElementById('inputRecipientName').value = '';
    document.getElementById('photoPreview').classList.remove('show');
    document.getElementById('btnCompletarEntrega').disabled = true;
}

// ========================================
// INICIAR ENTREGA
// ========================================

async function iniciarEntrega(trasladoId) {
    if (!confirm('¿Iniciar esta entrega?')) return;

    try {
        const response = await fetch(`${API_URL}/traslados/${trasladoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                estado: 'en_transito'
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message);
        }

        mostrarExito('Entrega iniciada');
        await cargarTraslados();
        cambiarTab('en-transito');

    } catch (error) {
        console.error('Error al iniciar entrega:', error);
        mostrarError('No se pudo iniciar la entrega');
    }
}

// ========================================
// GEOLOCALIZACIÓN
// ========================================

async function capturarUbicacion() {
    const btn = document.getElementById('btnCapturarGPS');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i><span>Obteniendo ubicación...</span>';

    if (!navigator.geolocation) {
        mostrarError('Tu dispositivo no soporta geolocalización');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-crosshair"></i><span>Capturar Mi Ubicación</span>';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };

            document.getElementById('gpsCoords').style.display = 'block';
            document.getElementById('coordsText').textContent = 
                `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`;

            btn.innerHTML = '<i class="bi bi-check-circle-fill"></i><span>Ubicación Capturada</span>';
            btn.classList.add('btn-success');
            btn.classList.remove('btn-primary');

            validarFormularioCompleto();
        },
        (error) => {
            console.error('Error de geolocalización:', error);
            mostrarError('No se pudo obtener tu ubicación. Verifica los permisos.');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-crosshair"></i><span>Capturar Mi Ubicación</span>';
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// ========================================
// FOTO
// ========================================

function manejarFoto(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        capturedPhoto = e.target.result;
        const preview = document.getElementById('photoPreview');
        preview.src = capturedPhoto;
        preview.classList.add('show');
        validarFormularioCompleto();
    };
    reader.readAsDataURL(file);
}

// ========================================
// FIRMA DIGITAL
// ========================================

function limpiarFirma() {
    if (signaturePad) {
        signaturePad.clear();
        validarFormularioCompleto();
    }
}

// ========================================
// COMPLETAR ENTREGA
// ========================================

function validarFormularioCompleto() {
    const tieneGPS = currentLocation !== null;
    const tieneFoto = capturedPhoto !== null;
    const tieneFirma = signaturePad && !signaturePad.isEmpty();
    const tieneNombre = document.getElementById('inputRecipientName').value.trim() !== '';

    const completo = tieneGPS && tieneFoto && tieneFirma && tieneNombre;
    document.getElementById('btnCompletarEntrega').disabled = !completo;
}

async function completarEntrega() {
    if (!confirm('¿Confirmar que la entrega está completa?')) return;

    try {
        const btn = document.getElementById('btnCompletarEntrega');
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Completando...';

        // Preparar datos
        const firmaDataURL = signaturePad.toDataURL();
        const nombreRecibe = document.getElementById('inputRecipientName').value.trim();

        const response = await fetch(`${API_URL}/traslados/${currentTraslado.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                estado: 'completado',
                latitud_entrega: currentLocation.latitude,
                longitud_entrega: currentLocation.longitude,
                firma_url: firmaDataURL,
                firma_recibido_por: nombreRecibe,
                foto_evidencia: capturedPhoto,
                fecha_completado: new Date().toISOString()
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message);
        }

        mostrarExito('¡Entrega completada exitosamente!');
        cerrarDetalle();
        await cargarTraslados();
        cambiarTab('completadas');

    } catch (error) {
        console.error('Error al completar entrega:', error);
        mostrarError('No se pudo completar la entrega');
        document.getElementById('btnCompletarEntrega').disabled = false;
        document.getElementById('btnCompletarEntrega').innerHTML = 
            '<i class="bi bi-check-circle me-2"></i>Completar Entrega';
    }
}

// ========================================
// UTILIDADES
// ========================================

function formatearFecha(fecha) {
    const date = new Date(fecha);
    const opciones = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString('es-CO', opciones);
}

function getBadgeClass(estado) {
    const clases = {
        'pendiente': 'bg-warning text-dark',
        'en_transito': 'bg-primary',
        'completado': 'bg-success',
        'cancelado': 'bg-danger'
    };
    return clases[estado] || 'bg-secondary';
}

function getEstadoTexto(estado) {
    const textos = {
        'pendiente': 'Pendiente',
        'en_transito': 'En tránsito',
        'completado': 'Completado',
        'cancelado': 'Cancelado'
    };
    return textos[estado] || estado;
}

function mostrarExito(mensaje) {
    alert('✓ ' + mensaje);
}

function mostrarError(mensaje) {
    alert('✗ ' + mensaje);
}
