/**
 * =================================
 * KORE INVENTORY - VENTAS/POS MODULE
 * Módulo de punto de venta
 * Version: 1.1.0 - 2026-02-04
 * =================================
 */

const API_URL = '/api';
let currentEmpresa = null;
let currentUsuario = null;
let clienteSeleccionado = null;
let productosVenta = [];
let clientesEncontrados = []; // Para evitar pasar objetos por HTML
let ultimaVentaGuardada = null; // Guardar última venta para impresión
let ultimaVentaData = null; // Guardar datos de última venta para impresión
let impuestosDisponibles = [];
let impuestosSeleccionados = [];
let pagosPendientes = []; // Array de pagos múltiples
let totalVentaActual = 0; // Total de la venta actual
let todosCatalogo = []; // Todos los productos del catálogo
let categoriasCatalogo = []; // Categorías disponibles
let categoriaFiltroActual = null; // Categoría filtrada actual
let productoSeleccionadoCatalogo = null; // Producto seleccionado en el catálogo
let vistaActual = 'grid'; // Vista actual del catálogo (grid o list)
let modoRapido = false; // Modo rápido activado
let turnoActivo = null; // Turno de caja actual
let gastosDelTurno = []; // Gastos del turno activo
let ultimasVentas = []; // Últimas ventas del día
let configuracionPlantilla = null; // Configuración de plantilla de factura
let cuentasAbiertas = []; // Lista de cuentas abiertas
let cuentaActual = null; // Cuenta abierta cargada actualmente
let modoEdicionCuenta = false; // true si estamos editando una cuenta abierta

console.log('🚀 Ventas.js cargado - Versión 2.0.0 - POS Profesional');

// ============================================
// FUNCIÓN GLOBAL: Manejar errores de autenticación
// ============================================
function handleUnauthorized(message = 'Tu sesión ha expirado') {
    console.error('🔒 Sesión expirada o token inválido');
    localStorage.clear();
    alert(message + '. Por favor inicia sesión nuevamente.');
    window.location.href = 'index.html';
}

// ============================================
// FUNCIÓN GLOBAL: Calcular Dígito de Verificación NIT (DIAN)
// ============================================
function calcularDigitoVerificacion(nit) {
    const nitNumeros = nit.replace(/[^0-9]/g, '');
    const vpri = [3,7,13,17,19,23,29,37,41,43,47,53,59,67,71];
    let suma = 0;
    for (let i = 0; i < nitNumeros.length && i < 15; i++) {
        suma += parseInt(nitNumeros[nitNumeros.length - 1 - i]) * vpri[i];
    }
    const residuo = suma % 11;
    return residuo > 1 ? 11 - residuo : residuo;
}

// ============================================
// FUNCIÓN: Cargar Configuración de Plantilla
// ============================================
async function cargarConfiguracionPlantilla() {
    if (!currentEmpresa || !currentEmpresa.id) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/facturacion/configuracion/${currentEmpresa.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Si el endpoint no existe (404), usar configuración por defecto
        if (response.status === 404) {
            console.log('ℹ️ Endpoint de configuración de plantilla no disponible, usando valores por defecto');
            configuracionPlantilla = {
                plantilla_id: 1,
                color_primario: currentEmpresa.color_primario || '#1E40AF',
                color_secundario: '#6c757d',
                fuente: 'Arial',
                mostrar_logo: true,
                mostrar_qr: true,
                mostrar_cufe: true,
                mostrar_badges: true,
                logo_posicion: 'center'
            };
            return;
        }
        
        const data = await response.json();
        console.log('📥 Respuesta del servidor:', data);
        if (data.success && data.data) {
            configuracionPlantilla = data.data;
            console.log('✅ Configuración de plantilla cargada:', configuracionPlantilla);
            console.log('📋 Plantilla ID seleccionada:', configuracionPlantilla.plantilla_id);
        } else {
            // Configuración por defecto
            configuracionPlantilla = {
                plantilla_id: 1, // Clásica por defecto
                color_primario: currentEmpresa.color_primario || '#1E40AF',
                color_secundario: '#6c757d',
                fuente: 'Arial',
                mostrar_logo: true,
                mostrar_qr: true,
                mostrar_cufe: true,
                mostrar_badges: true,
                logo_posicion: 'center'
            };
        }
    } catch (error) {
        console.error('Error cargando configuración de plantilla:', error);
        // Usar valores por defecto en caso de error
        configuracionPlantilla = {
            plantilla_id: 1,
            color_primario: currentEmpresa.color_primario || '#1E40AF',
            color_secundario: '#6c757d',
            fuente: 'Arial',
            mostrar_logo: true,
            mostrar_qr: true,
            mostrar_cufe: true,
            mostrar_badges: true,
            logo_posicion: 'center'
        };
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        let usuario = JSON.parse(localStorage.getItem('usuario'));
        
        if (!usuario) {
            const response = await fetch(`${API_URL}/auth/verify`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                localStorage.clear();
                window.location.href = 'login.html';
                return;
            }

            const data = await response.json();
            usuario = data.data;
            localStorage.setItem('usuario', JSON.stringify(usuario));
        }

        currentUsuario = usuario;
        cargarInfoUsuario(usuario);
        
        // Configurar visibilidad de PLATAFORMA en sidebar
        if (typeof configurarSidebarSuperAdmin === 'function') {
            configurarSidebarSuperAdmin();
        }

        // Cargar empresas del usuario
        await cargarEmpresas(usuario.id);

        // Obtener empresa activa
        const empresaActivaId = localStorage.getItem('empresaActiva');
        
        if (!empresaActivaId) {
            console.error('❌ No hay empresa activa configurada');
            mostrarAlerta('No tienes empresas asignadas. Contacta al administrador.', 'warning');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
            return;
        }
        
        // Si currentEmpresa no se estableció por cargarEmpresas, cargarla desde API
        if (!currentEmpresa || !currentEmpresa.id) {
            await actualizarDatosEmpresa(empresaActivaId);
        }
        
        console.log(`✅ Empresa activa: ${currentEmpresa.nombre} (ID: ${currentEmpresa.id})`);

        // Cargar datos iniciales de la empresa
        await recargarDatosEmpresa();

        initEventListeners();
        deshabilitarSeccionProductos();

        // ============================================
        // DETECTAR PARÁMETRO DE IMPRESIÓN EN URL
        // ============================================
        const urlParams = new URLSearchParams(window.location.search);
        const numeroFacturaImprimir = urlParams.get('imprimir');
        
        if (numeroFacturaImprimir) {
            console.log(`🖨️ Detectado parámetro de impresión para: ${numeroFacturaImprimir}`);
            // Esperar un momento para que se carguen todos los datos
            setTimeout(() => {
                reimprimirFactura(numeroFacturaImprimir);
                // Limpiar URL sin recargar la página
                const url = new URL(window.location);
                url.searchParams.delete('imprimir');
                window.history.replaceState({}, '', url);
            }, 1000);
        }

    } catch (error) {
        console.error('Error de inicialización:', error);
        mostrarAlerta('Error al inicializar el módulo', 'danger');
    }
});

function cargarInfoUsuario(usuario) {
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    
    if (userName) {
        userName.textContent = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || 'Usuario';
    }
    
    if (userRole) {
        const tipos = {
            'super_admin': 'Super Administrador',
            'admin_empresa': 'Administrador',
            'usuario': 'Usuario',
            'soporte': 'Soporte'
        };
        userRole.textContent = tipos[usuario.tipo_usuario] || usuario.tipo_usuario;
    }
}

// ============================================
// CARGAR EMPRESAS DEL USUARIO
// ============================================

async function cargarEmpresas(usuarioId) {
    console.log('🔍 === INICIO cargarEmpresas ===' );
    const token = localStorage.getItem('token');
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    console.log('📋 Usuario:', usuario);
    
    const companySelector = document.getElementById('companySelector');
    const companyText = document.getElementById('companyText');
    const companyNameText = document.getElementById('companyNameText');
    
    console.log('🎯 Elementos DOM:', {
        companySelector: !!companySelector,
        companyText: !!companyText,
        companyNameText: !!companyNameText
    });
    
    if (!companySelector) {
        console.error('❌ companySelector no encontrado en DOM');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/empresas/usuario/${usuarioId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        console.log('📥 Respuesta empresas:', data);
        
        if (data.success && data.data.length > 0) {
            console.log('✅ Empresas recibidas:', data.data.length);
            
            // Determinar si mostrar selector o texto según tipo de usuario y cantidad de empresas
            const esUsuarioRegular = usuario.tipo_usuario === 'usuario';
            const tieneSoloUnaEmpresa = data.data.length === 1;
            
            console.log('🔍 Decisión de UI:', {
                esUsuarioRegular,
                tieneSoloUnaEmpresa,
                cantidadEmpresas: data.data.length,
                tipoUsuario: usuario.tipo_usuario
            });
            
            if (esUsuarioRegular || tieneSoloUnaEmpresa) {
                console.log('📝 Mostrando TEXTO (una empresa)');
                // Usuario Regular o Admin con 1 sola empresa: mostrar solo texto
                companySelector.style.display = 'none';
                if (companyText) companyText.style.display = 'block';
                if (companyNameText) companyNameText.textContent = data.data[0].nombre;
                
                console.log('✅ Texto actualizado a:', data.data[0].nombre);
                
                // Establecer empresa activa (solo ID en localStorage)
                localStorage.setItem('empresaActiva', data.data[0].id.toString());
                currentEmpresa = data.data[0];
                console.log('✅ currentEmpresa establecido:', currentEmpresa);
            } else {
                console.log('📋 Mostrando SELECTOR (múltiples empresas)');
                // Admin Empresa con múltiples empresas: mostrar selector
                companySelector.style.display = 'block';
                if (companyText) companyText.style.display = 'none';
                
                console.log('✅ Selector visible, texto oculto');
                
                // Limpiar selector
                companySelector.innerHTML = '';
                
                // Agregar opciones
                data.data.forEach(empresa => {
                    const option = document.createElement('option');
                    option.value = empresa.id;
                    option.textContent = empresa.nombre;
                    companySelector.appendChild(option);
                });
                
                console.log('✅ Opciones agregadas al selector:', data.data.length);
                
                // Seleccionar la primera empresa o la guardada
                const empresaGuardadaId = localStorage.getItem('empresaActiva');
                console.log('💾 Empresa guardada en localStorage:', empresaGuardadaId);
                
                if (empresaGuardadaId) {
                    // Verificar que la empresa guardada existe en la lista
                    const empresaExiste = data.data.find(emp => emp.id == empresaGuardadaId);
                    if (empresaExiste) {
                        console.log('✅ Empresa guardada existe, seleccionándola:', empresaExiste.nombre);
                        companySelector.value = empresaGuardadaId;
                        currentEmpresa = empresaExiste;
                    } else {
                        console.log('⚠️ Empresa guardada no existe, usando primera');
                        // Si no existe, usar la primera empresa
                        companySelector.value = data.data[0].id;
                        localStorage.setItem('empresaActiva', data.data[0].id.toString());
                        currentEmpresa = data.data[0];
                    }
                } else {
                    console.log('📝 No hay empresa guardada, usando primera');
                    // No hay empresa guardada, usar la primera
                    companySelector.value = data.data[0].id;
                    localStorage.setItem('empresaActiva', data.data[0].id.toString());
                    currentEmpresa = data.data[0];
                }
                
                console.log('✅ currentEmpresa establecido:', currentEmpresa);
                
                // Event listener para cambio de empresa
                companySelector.addEventListener('change', async (e) => {
                    const empresaId = e.target.value;
                    const empresaSeleccionada = data.data.find(emp => emp.id == empresaId);
                    localStorage.setItem('empresaActiva', empresaId);
                    currentEmpresa = empresaSeleccionada;
                    
                    // Limpiar venta actual sin confirmación
                    limpiarVentaSinConfirmar();
                    
                    // Recargar todos los datos de la nueva empresa
                    await recargarDatosEmpresa();
                });
            }
            
        } else {
            console.log('⚠️ No hay empresas disponibles');
            companySelector.innerHTML = '<option value="">Sin empresas asignadas</option>';
        }
        
    } catch (error) {
        console.error('❌ Error al cargar empresas:', error);
        companySelector.innerHTML = '<option value="">Error al cargar empresas</option>';
    }
    
    console.log('🔍 === FIN cargarEmpresas ===');
}

// ============================================
// ACTUALIZAR DATOS COMPLETOS DE EMPRESA
// ============================================

async function actualizarDatosEmpresa(empresaId) {
    const token = localStorage.getItem('token');
    
    try {
        console.log(`📡 Consultando datos completos de empresa ${empresaId}...`);
        const response = await fetch(`${API_URL}/empresas/${empresaId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.data) {
            console.log('✅ Datos completos recibidos del backend:', data.data);
            currentEmpresa = data.data;
            console.log('✅ currentEmpresa actualizado en memoria');
        } else {
            console.error('❌ Error al obtener datos de empresa:', data.message);
        }
        
    } catch (error) {
        console.error('❌ Error al actualizar datos de empresa:', error);
    }
}

/**
 * Recarga todos los datos dependientes de la empresa activa
 */
async function recargarDatosEmpresa() {
    console.log('🔄 === INICIO recargarDatosEmpresa ===');
    console.log('📋 currentEmpresa:', currentEmpresa);
    
    if (!currentEmpresa || !currentEmpresa.id) {
        console.warn('⚠️ No hay empresa activa para recargar datos');
        return;
    }
    
    try {
        // Actualizar UI con el nombre de la empresa SOLO si el elemento está visible
        const companyNameText = document.getElementById('companyNameText');
        const companyText = document.getElementById('companyText');
        
        console.log('🎯 Elementos para actualizar:', {
            companyNameText: !!companyNameText,
            companyText: !!companyText,
            companyTextVisible: companyText ? companyText.style.display : 'N/A'
        });
        
        // Solo actualizar el texto si el div contenedor está visible (usuario con 1 empresa)
        if (companyNameText && companyText && companyText.style.display !== 'none') {
            console.log('✏️ Actualizando nombre de empresa en texto:', currentEmpresa.nombre);
            companyNameText.textContent = currentEmpresa.nombre;
        } else {
            console.log('ℹ️ No se actualiza companyNameText (selector activo o elemento no visible)');
        }
        
        // Recargar todos los datos dependientes de la empresa
        console.log('📡 Cargando datos de empresa...');
        await cargarConfiguracionPlantilla();
        await cargarImpuestosActivos();
        await cargarCatalogoProductos();
        
        console.log('✅ Datos de empresa recargados correctamente');
    } catch (error) {
        console.error('❌ Error al recargar datos de empresa:', error);
        mostrarAlerta('Error al cargar datos de la empresa', 'danger');
    }
    
    console.log('🔄 === FIN recargarDatosEmpresa ===');
}

// ============================================
// EVENT LISTENERS
// ============================================

function initEventListeners() {
    // Búsqueda de cliente por documento
    document.getElementById('btnBuscarDocumento').addEventListener('click', buscarPorDocumento);
    document.getElementById('numeroDocumento').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarPorDocumento();
    });

    // Búsqueda de cliente por nombre
    document.getElementById('buscarNombre').addEventListener('input', debounce(buscarPorNombre, 300));
    
    // Botones de cliente
    document.getElementById('btnNuevoCliente').addEventListener('click', abrirModalCliente);
    document.getElementById('btnCambiarCliente').addEventListener('click', cambiarCliente);
    document.getElementById('btnPublicoGeneral').addEventListener('click', seleccionarPublicoGeneral);

    // Búsqueda de productos
    document.getElementById('buscarProducto').addEventListener('input', debounce(buscarProductos, 300));

    // Botón guardar cliente (ahora es click directo, no submit)
    document.getElementById('btnGuardarClienteModal').addEventListener('click', guardarClienteRapido);

    // Descuento
    document.getElementById('inputDescuento').addEventListener('input', calcularTotales);
    
    // Propina
    document.getElementById('checkPropina').addEventListener('change', function() {
        const contenedor = document.getElementById('contenedorPropina');
        if (this.checked) {
            contenedor.style.display = 'block';
            // Establecer porcentaje sugerido del 5%
            document.getElementById('inputPropinaPorcentaje').value = '5';
        } else {
            contenedor.style.display = 'none';
            document.getElementById('inputPropinaPorcentaje').value = '0';
        }
        calcularTotales();
    });
    
    document.getElementById('inputPropinaPorcentaje').addEventListener('input', calcularTotales);

    // Botones principales
    document.getElementById('btnGuardarVenta').addEventListener('click', guardarVenta);
    document.getElementById('btnLimpiarVenta').addEventListener('click', limpiarVenta);
    document.getElementById('btnCancelarVenta').addEventListener('click', limpiarVenta);
    
    // Modo rápido
    document.getElementById('modoRapidoSwitch').addEventListener('change', toggleModoRapido);
    
    // Turno de caja
    document.getElementById('btnTurnoCaja').addEventListener('click', abrirModalTurno);
    document.getElementById('btnAbrirTurno').addEventListener('click', abrirTurno);
    document.getElementById('btnCerrarTurno').addEventListener('click', cerrarTurno);
    document.getElementById('efectivoContado').addEventListener('input', calcularDiferenciaTurno);

    // Sidebar
    document.getElementById('toggleSidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('active');
        document.getElementById('sidebarOverlay').classList.toggle('active');
    });

    document.getElementById('closeSidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('sidebarOverlay').classList.remove('active');
    });

    document.getElementById('sidebarOverlay').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('sidebarOverlay').classList.remove('active');
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        cerrarSesion();
    });

    // Ocultar resultados al hacer click fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#buscarNombre') && !e.target.closest('#resultadosNombre')) {
            document.getElementById('resultadosNombre').style.display = 'none';
        }
        if (!e.target.closest('#buscarProducto') && !e.target.closest('#resultadosProducto')) {
            document.getElementById('resultadosProducto').style.display = 'none';
        }
    });
}

// ============================================
// BÚSQUEDA DE CLIENTES
// ============================================

async function buscarPorDocumento() {
    const tipo = document.getElementById('tipoDocumento').value;
    const numero = document.getElementById('numeroDocumento').value.trim();

    if (!numero) {
        mostrarAlerta('Ingresa un número de documento', 'warning');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/ventas/buscar-cliente?empresaId=${currentEmpresa.id}&tipo=documento&valor=${numero}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!response.ok) {
            if (response.status === 401) {
                mostrarAlerta('Sesión expirada. Por favor refresca la página (F5)', 'warning');
                return;
            }
            throw new Error('Error al buscar cliente');
        }

        const data = await response.json();
        const clientes = data.data;

        if (clientes.length === 0) {
            mostrarAlerta('Cliente no encontrado. Puedes registrarlo con el botón "Nuevo Cliente"', 'info');
            return;
        }

        if (clientes.length === 1) {
            seleccionarCliente(clientes[0]);
        } else {
            // Mostrar lista para seleccionar
            mostrarOpcionesClientes(clientes, 'resultadosNombre');
        }

    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al buscar cliente', 'danger');
    }
}

async function buscarPorNombre() {
    const busqueda = document.getElementById('buscarNombre').value.trim();
    
    if (busqueda.length < 2) {
        document.getElementById('resultadosNombre').style.display = 'none';
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/ventas/buscar-cliente?empresaId=${currentEmpresa.id}&tipo=nombre&valor=${busqueda}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!response.ok) {
            if (response.status === 401) {
                mostrarAlerta('Sesión expirada. Por favor refresca la página (F5)', 'warning');
                return;
            }
            throw new Error('Error al buscar cliente');
        }

        const data = await response.json();
        mostrarOpcionesClientes(data.data, 'resultadosNombre');

    } catch (error) {
        console.error('Error:', error);
    }
}

function mostrarOpcionesClientes(clientes, containerId) {
    const container = document.getElementById(containerId);
    clientesEncontrados = clientes; // Guardar en variable global
    
    if (clientes.length === 0) {
        container.innerHTML = '<div class="p-3 text-muted">No se encontraron clientes</div>';
        container.style.display = 'block';
        return;
    }

    container.innerHTML = clientes.map((c, index) => `
        <div class="search-result-item" onclick="seleccionarClientePorIndice(${index})">
            <strong>${c.razon_social || `${c.nombre} ${c.apellido || ''}`.trim()}</strong><br>
            <small class="text-muted">${c.tipo_documento}: ${c.numero_documento}</small>
        </div>
    `).join('');
    
    container.style.display = 'block';
}

function seleccionarClientePorIndice(index) {
    if (clientesEncontrados[index]) {
        seleccionarCliente(clientesEncontrados[index]);
    }
}

function seleccionarCliente(cliente) {
    console.log('=== seleccionarCliente called ===');
    console.log('Tipo de cliente:', typeof cliente);
    console.log('cliente recibido:', cliente);
    console.log('cliente.id:', cliente?.id, 'tipo:', typeof cliente?.id);
    
    clienteSeleccionado = cliente;
    console.log('clienteSeleccionado asignado:', clienteSeleccionado);
    console.log('clienteSeleccionado.id:', clienteSeleccionado?.id);
    
    // Ocultar búsqueda
    document.getElementById('busquedaCliente').style.display = 'none';
    document.getElementById('resultadosNombre').style.display = 'none';
    
    // Mostrar info del cliente
    document.getElementById('clienteNombreDisplay').textContent = 
        cliente.razon_social || `${cliente.nombre} ${cliente.apellido || ''}`.trim();
    document.getElementById('clienteDocumentoDisplay').textContent = 
        `${cliente.tipo_documento}: ${cliente.numero_documento}`;
    document.getElementById('clienteEmailDisplay').textContent = cliente.email || 'Sin email';
    document.getElementById('clienteTelefonoDisplay').textContent = cliente.celular || cliente.telefono || 'Sin teléfono';
    document.getElementById('clienteDireccionDisplay').textContent = 
        cliente.direccion ? `${cliente.direccion}, ${cliente.ciudad || ''}` : 'Sin dirección';
    
    document.getElementById('clienteSeleccionado').style.display = 'block';
    
    // Habilitar sección de productos
    habilitarSeccionProductos();
    
    // Focus en búsqueda de productos
    document.getElementById('buscarProducto').focus();
}

function cambiarCliente() {
    clienteSeleccionado = null;
    document.getElementById('busquedaCliente').style.display = 'block';
    document.getElementById('clienteSeleccionado').style.display = 'none';
    document.getElementById('numeroDocumento').value = '';
    document.getElementById('buscarNombre').value = '';
    deshabilitarSeccionProductos();
}

// ============================================
// BÚSQUEDA DE PRODUCTOS
// ============================================

async function buscarProductos() {
    const busqueda = document.getElementById('buscarProducto').value.trim();
    
    if (busqueda.length < 2) {
        document.getElementById('resultadosProducto').style.display = 'none';
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/ventas/buscar-producto?empresaId=${currentEmpresa.id}&busqueda=${busqueda}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!response.ok) {
            if (response.status === 401) {
                mostrarAlerta('Sesión expirada. Por favor refresca la página (F5)', 'warning');
                return;
            }
            throw new Error('Error al buscar productos');
        }

        const data = await response.json();
        mostrarOpcionesProductos(data.data);

    } catch (error) {
        console.error('Error:', error);
    }
}

function mostrarOpcionesProductos(productos) {
    const container = document.getElementById('resultadosProducto');
    
    if (productos.length === 0) {
        container.innerHTML = '<div class="p-3 text-muted">No se encontraron productos</div>';
        container.style.display = 'block';
        return;
    }

    container.innerHTML = productos.map(p => `
        <div class="search-result-item" onclick='agregarProducto(${JSON.stringify(p).replace(/'/g, "\\'")})'">
            <div class="d-flex justify-content-between">
                <div>
                    <strong>${p.nombre}</strong>
                    ${p.aplica_iva ? '<span class="badge bg-info text-white ms-2"><i class="bi bi-percent"></i> IVA</span>' : ''}
                    <br>
                    <small class="text-muted">SKU: ${p.sku} | Stock: ${p.stock_actual}</small>
                </div>
                <div class="text-end">
                    <strong class="text-success">$${formatearNumero(p.precio_venta)}</strong>
                </div>
            </div>
        </div>
    `).join('');
    
    container.style.display = 'block';
}

function agregarProducto(producto) {
    console.log('=== agregarProducto ===');
    console.log('modoEdicionCuenta:', modoEdicionCuenta);
    console.log('cuentaActual:', cuentaActual);
    
    // Si estamos editando una cuenta abierta, SIEMPRE agregar nueva línea
    // Esto permite trazabilidad temporal de cada pedido (importante para restaurantes)
    if (modoEdicionCuenta && cuentaActual) {
        console.log('Modo edición de cuenta: agregando nuevo item con timestamp único');
        // SIEMPRE agregar nueva línea (no incrementar existente)
        // Esto permite ver cuándo se pidió cada producto
        agregarItemACuentaAbierta(producto);
        return;
    }

    console.log('Modo venta normal, agregando localmente...');
    // Modo normal de venta (sin cuenta abierta)
    // En ventas directas SÍ agrupamos productos iguales
    // Verificar si ya está en la lista
    const index = productosVenta.findIndex(p => p.id === producto.id);
    
    if (index >= 0) {
        // Incrementar cantidad si hay stock O si permite venta sin stock
        const productoActual = productosVenta[index];
        const permiteVentaSinStock = producto.permite_venta_sin_stock === 1 || producto.permite_venta_sin_stock === true;
        
        if (productoActual.cantidad < producto.stock_actual) {
            // Hay stock disponible, incrementar normalmente
            productosVenta[index].cantidad++;
            const precio = parseFloat(productosVenta[index].precio_unitario);
            productosVenta[index].subtotal = productosVenta[index].cantidad * precio;
        } else if (permiteVentaSinStock) {
            // No hay stock pero permite venta sin stock
            mostrarModalVentaSinStock(producto, index);
            return;
        } else {
            mostrarAlerta('No hay suficiente stock disponible y este producto no permite ventas sin stock', 'warning');
            return;
        }
    } else {
        // Agregar nuevo producto
        const permiteVentaSinStock = producto.permite_venta_sin_stock === 1 || producto.permite_venta_sin_stock === true;
        
        if (producto.stock_actual < 1) {
            if (permiteVentaSinStock) {
                // Mostrar modal para confirmar venta contra pedido
                mostrarModalVentaSinStock(producto, -1);
                return;
            } else {
                // Mostrar modal con disponibilidad en otras bodegas
                mostrarStockOtrasBodegas(producto, 0);
                return;
            }
        }

        const precioUnitario = parseFloat(producto.precio_venta || producto.precio_minorista);
        productosVenta.push({
            id: producto.id,
            nombre: producto.nombre,
            sku: producto.sku,
            precio_unitario: precioUnitario,
            precio_minorista: producto.precio_minorista || precioUnitario,
            precio_mayorista: producto.precio_mayorista || null,
            precio_distribuidor: producto.precio_distribuidor || null,
            precio_minimo: producto.precio_minimo || null,
            precio_maximo: producto.precio_maximo || null,
            cantidad: 1,
            stock_disponible: producto.stock_actual,
            subtotal: precioUnitario,
            tipo_venta: 'normal',
            estado_entrega: 'entregado',
            aplica_iva: producto.aplica_iva || false,
            porcentaje_iva: producto.porcentaje_iva || 19,
            iva_incluido_en_precio: producto.iva_incluido_en_precio || false
        });
    }

    // Limpiar búsqueda
    document.getElementById('buscarProducto').value = '';
    document.getElementById('resultadosProducto').style.display = 'none';

    renderizarProductos();
    calcularTotales();
    actualizarStockEnCatalogo(); // Actualizar stock visual en catálogo
    reproducirSonido('add');
}

function renderizarProductos() {
    try {
        console.log('=== renderizarProductos ===');
        console.log('productosVenta.length:', productosVenta.length);
        console.log('productosVenta:', productosVenta);
        
        const container = document.getElementById('listaProductos');

        if (productosVenta.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4" id="emptyProductos">
                    <i class="bi bi-cart display-1 opacity-25"></i>
                    <p class="mt-2">No hay productos agregados</p>
                </div>`;
            return;
        }
        
        let html = '';
        for (let index = 0; index < productosVenta.length; index++) {
            const p = productosVenta[index];
            console.log(`Generando HTML para producto ${index}:`, p);
            
            // Badge para venta contra pedido
            const badgeContraPedido = p.tipo_venta === 'contra_pedido' ? 
                `<span class="badge bg-warning text-dark ms-2">
                    <i class="bi bi-clock-history"></i> Contra Pedido
                 </span>` : '';
            
            // Información de entrega si es contra pedido
            const infoEntrega = p.tipo_venta === 'contra_pedido' && p.fecha_entrega_estimada ?
                `<br><small class="text-warning">
                    <i class="bi bi-calendar-event"></i> Entrega estimada: ${formatearFecha(p.fecha_entrega_estimada)}
                 </small>` : '';
            
            // Determinar si el precio está fuera de rango (para alertas visuales)
            let clasePrecio = '';
            let alertaPrecio = '';
            if (p.precio_minimo && p.precio_unitario < p.precio_minimo) {
                clasePrecio = 'border-danger';
                alertaPrecio = `<small class="text-danger"><i class="bi bi-exclamation-triangle"></i> Por debajo del mínimo ($${formatearNumero(p.precio_minimo)})</small>`;
            } else if (p.precio_maximo && p.precio_unitario > p.precio_maximo) {
                clasePrecio = 'border-warning';
                alertaPrecio = `<small class="text-warning"><i class="bi bi-exclamation-circle"></i> Por encima del máximo ($${formatearNumero(p.precio_maximo)})</small>`;
            }
            
            // Opciones de precios disponibles
            let opcionesPrecios = '';
            if (p.precio_minorista) {
                opcionesPrecios += `<option value="${p.precio_minorista}">Minorista - $${formatearNumero(p.precio_minorista)}</option>`;
            }
            if (p.precio_mayorista) {
                opcionesPrecios += `<option value="${p.precio_mayorista}">Mayorista - $${formatearNumero(p.precio_mayorista)}</option>`;
            }
            if (p.precio_distribuidor) {
                opcionesPrecios += `<option value="${p.precio_distribuidor}">Distribuidor - $${formatearNumero(p.precio_distribuidor)}</option>`;
            }
            opcionesPrecios += `<option value="manual">✏️ Manual</option>`;
            
            // Mostrar hora de pedido solo en modo edición de cuenta
            const infoHoraPedido = (modoEdicionCuenta && p.fecha_agregado) ?
                `<br><small class="text-primary"><i class="bi bi-clock-history"></i> Pedido: ${formatearFechaHora(p.fecha_agregado)}</small>` : '';
            
            html += `
            <div class="producto-item mb-3 p-3 border rounded ${p.tipo_venta === 'contra_pedido' ? 'border-warning' : ''} ${clasePrecio}">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <strong>${p.nombre}</strong>${badgeContraPedido}
                        ${p.aplica_iva ? '<span class="badge bg-info ms-2"><i class="bi bi-percent"></i> IVA ' + p.porcentaje_iva + '%</span>' : '<span class="badge bg-secondary ms-2">Sin IVA</span>'}<br>
                        <small class="text-muted">SKU: ${p.sku} | Stock: ${p.stock_disponible}</small>${infoHoraPedido}${infoEntrega}
                    </div>
                    <div class="d-flex align-items-start gap-2">
                        <!-- Cantidad -->
                        <div class="d-flex flex-column align-items-center">
                            <small class="text-muted mb-1">Cantidad</small>
                            <div class="d-flex align-items-center">
                                <button class="btn btn-sm btn-outline-secondary btn-cantidad" onclick="cambiarCantidad(${index}, -1)">
                                    <i class="bi bi-dash"></i>
                                </button>
                                <input type="number" class="form-control form-control-sm input-cantidad mx-1" 
                                       value="${p.cantidad}" min="1" max="${p.tipo_venta === 'contra_pedido' ? 9999 : p.stock_disponible}"
                                       onchange="actualizarCantidad(${index}, this.value)"
                                       style="width: 60px; text-align: center;">
                                <button class="btn btn-sm btn-outline-secondary btn-cantidad" onclick="cambiarCantidad(${index}, 1)">
                                    <i class="bi bi-plus"></i>
                                </button>
                            </div>
                        </div>
                        
                        <!-- Precio -->
                        <div class="d-flex flex-column" style="min-width: 180px;">
                            <small class="text-muted mb-1">Tipo de Precio</small>
                            <select class="form-select form-select-sm mb-1" onchange="cambiarTipoPrecio(${index}, this.value)" id="tipoPrecio${index}">
                                ${opcionesPrecios}
                            </select>
                            <div class="input-group input-group-sm">
                                <span class="input-group-text">$</span>
                                <input type="number" class="form-control form-control-sm" 
                                       value="${p.precio_unitario}" 
                                       min="0" step="0.01"
                                       onchange="actualizarPrecio(${index}, this.value)"
                                       onkeypress="if(event.key === 'Enter') { event.preventDefault(); actualizarPrecio(${index}, this.value); return false; }"
                                       id="precioInput${index}"
                                       style="text-align: right;">
                            </div>
                            ${alertaPrecio}
                        </div>
                        
                        <!-- Subtotal -->
                        <div class="text-end" style="min-width: 100px;">
                            <small class="text-muted">Subtotal</small><br>
                            <strong class="text-success fs-5">$${formatearNumero(p.subtotal)}</strong>
                        </div>
                        
                        <!-- Eliminar -->
                        <button class="btn btn-sm btn-outline-danger" onclick="eliminarProducto(${index})" title="Eliminar producto">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>`;
        }
        
        console.log('HTML completo generado, longitud:', html.length);
        console.log('Primeros 200 chars:', html.substring(0, 200));
        container.innerHTML = html;
        console.log('container.innerHTML actualizado, children count:', container.children.length);
        
        // Establecer el valor seleccionado en los selectores de tipo de precio
        productosVenta.forEach((p, index) => {
            const selector = document.getElementById(`tipoPrecio${index}`);
            if (selector) {
                if (p.precio_unitario === p.precio_minorista) {
                    selector.value = p.precio_minorista;
                } else if (p.precio_unitario === p.precio_mayorista) {
                    selector.value = p.precio_mayorista;
                } else if (p.precio_unitario === p.precio_distribuidor) {
                    selector.value = p.precio_distribuidor;
                } else {
                    selector.value = 'manual';
                }
            }
        });
    } catch (error) {
        console.error('ERROR en renderizarProductos:', error);
        console.error('Stack:', error.stack);
    }
}

async function cambiarCantidad(index, delta) {
    const producto = productosVenta[index];
    const cantidadAnterior = producto.cantidad; // Guardar cantidad anterior
    const nuevaCantidad = producto.cantidad + delta;

    if (nuevaCantidad < 1) {
        eliminarProducto(index);
        return;
    }

    // Permitir cantidades mayores al stock solo si es contra pedido
    if (producto.tipo_venta !== 'contra_pedido' && nuevaCantidad > producto.stock_disponible) {
        // Mostrar modal con disponibilidad en otras bodegas
        await mostrarStockOtrasBodegas(producto, producto.stock_disponible || 0);
        return;
    }

    producto.cantidad = nuevaCantidad;
    const precio = parseFloat(producto.precio_unitario);
    producto.subtotal = producto.cantidad * precio;
    
    // Si estamos editando una cuenta abierta, actualizar en el backend PRIMERO
    if (modoEdicionCuenta && cuentaActual) {
        const resultado = await actualizarItemEnBackend(index, cantidadAnterior);
        if (!resultado) {
            // Si falla, revertir el cambio
            producto.cantidad = cantidadAnterior;
            producto.subtotal = cantidadAnterior * precio;
            mostrarAlerta('Error al actualizar cantidad en el servidor', 'error');
            renderizarProductos();
            return;
        }
    }

    renderizarProductos();
    calcularTotales();
    actualizarStockEnCatalogo(); // Actualizar stock visual en catálogo
}

async function actualizarCantidad(index, valor) {
    const cantidad = parseInt(valor);
    if (isNaN(cantidad) || cantidad < 1) {
        renderizarProductos();
        return;
    }

    const producto = productosVenta[index];
    const cantidadAnterior = producto.cantidad;
    
    // Permitir cantidades mayores al stock solo si es contra pedido
    if (producto.tipo_venta !== 'contra_pedido' && cantidad > producto.stock_disponible) {
        // Mostrar modal con disponibilidad en otras bodegas
        await mostrarStockOtrasBodegas(producto, producto.stock_disponible || 0);
        renderizarProductos();
        return;
    }

    producto.cantidad = cantidad;
    const precio = parseFloat(producto.precio_unitario);
    producto.subtotal = producto.cantidad * precio;
    
    // Si estamos editando una cuenta abierta, actualizar en el backend PRIMERO
    if (modoEdicionCuenta && cuentaActual) {
        const resultado = await actualizarItemEnBackend(index, cantidadAnterior);
        if (!resultado) {
            // Si falla, revertir el cambio
            producto.cantidad = cantidadAnterior;
            producto.subtotal = cantidadAnterior * precio;
            mostrarAlerta('Error al actualizar cantidad en el servidor', 'error');
            renderizarProductos();
            return;
        }
    }

    renderizarProductos();
    actualizarStockEnCatalogo(); // Actualizar stock visual en catálogo
    calcularTotales();
}

function actualizarPrecio(index, valor) {
    console.log('actualizarPrecio llamado:', { index, valor, valorType: typeof valor });
    
    const precio = parseFloat(valor);
    if (isNaN(precio) || precio < 0) {
        console.log('Precio inválido, renderizando productos');
        renderizarProductos();
        return;
    }

    const producto = productosVenta[index];
    console.log('Producto antes de actualizar:', { ...producto });
    
    // Validar si el precio está fuera del rango permitido
    let advertencia = false;
    if (producto.precio_minimo && precio < producto.precio_minimo) {
        advertencia = true;
        if (!confirm(`⚠️ ALERTA: El precio ingresado ($${formatearNumero(precio)}) está por debajo del precio mínimo permitido ($${formatearNumero(producto.precio_minimo)}).\n\n¿Desea continuar de todas formas?`)) {
            console.log('Usuario canceló cambio de precio por debajo del mínimo');
            renderizarProductos();
            return;
        }
    } else if (producto.precio_maximo && precio > producto.precio_maximo) {
        advertencia = true;
        if (!confirm(`⚠️ ALERTA: El precio ingresado ($${formatearNumero(precio)}) está por encima del precio máximo sugerido ($${formatearNumero(producto.precio_maximo)}).\n\n¿Desea continuar de todas formas?`)) {
            console.log('Usuario canceló cambio de precio por encima del máximo');
            renderizarProductos();
            return;
        }
    }
    
    producto.precio_unitario = precio;
    producto.subtotal = producto.cantidad * precio;
    
    console.log('Producto después de actualizar:', { ...producto });
    console.log('productosVenta completo:', productosVenta.map(p => ({ id: p.id, nombre: p.nombre, cantidad: p.cantidad, precio: p.precio_unitario, subtotal: p.subtotal })));

    renderizarProductos();
    calcularTotales();
    
    // Si estamos editando una cuenta abierta, actualizar en el backend
    if (modoEdicionCuenta && cuentaActual) {
        // Llamar de forma asíncrona sin bloquear la UI
        actualizarItemEnBackend(index).catch(err => {
            console.error('Error actualizando precio en backend:', err);
        });
    }
}

// Función para cambiar el tipo de precio seleccionado
function cambiarTipoPrecio(index, valor) {
    const producto = productosVenta[index];
    
    if (valor === 'manual') {
        // Enfocar el input de precio para edición manual
        setTimeout(() => {
            const precioInput = document.getElementById(`precioInput${index}`);
            if (precioInput) {
                precioInput.focus();
                precioInput.select();
            }
        }, 100);
        return;
    }
    
    const nuevoPrecio = parseFloat(valor);
    if (isNaN(nuevoPrecio) || nuevoPrecio < 0) {
        renderizarProductos();
        return;
    }
    
    producto.precio_unitario = nuevoPrecio;
    producto.subtotal = producto.cantidad * nuevoPrecio;
    
    renderizarProductos();
    calcularTotales();
    
    // Si estamos editando una cuenta abierta, actualizar en el backend
    if (modoEdicionCuenta && cuentaActual) {
        actualizarItemEnBackend(index).catch(err => {
            console.error('Error actualizando precio en backend:', err);
        });
    }
}

async function eliminarProducto(index) {
    const producto = productosVenta[index];
    
    // Si estamos editando una cuenta abierta, eliminar del backend primero
    if (modoEdicionCuenta && cuentaActual && producto.id) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${API_URL}/cuentas-abiertas/${cuentaActual.id}/items/${producto.id}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        empresa_id: currentEmpresa.id
                    })
                }
            );
            
            if (response.status === 401) {
                handleUnauthorized();
                return;
            }
            
            const data = await response.json();
            if (!data.success) {
                mostrarAlerta('Error al eliminar: ' + data.message, 'error');
                return;
            }
            
            // Devolver stock al catálogo (backend ya sumó al inventario)
            const productoCatalogo = todosCatalogo.find(p => p.id === producto.producto_id);
            if (productoCatalogo) {
                productoCatalogo.stock_original += producto.cantidad;
                productoCatalogo.stock_actual = productoCatalogo.stock_original;
                console.log(`📦 Stock devuelto al catálogo: ${productoCatalogo.nombre} → ${productoCatalogo.stock_original}`);
            }
        } catch (error) {
            console.error('Error al eliminar item del backend:', error);
            mostrarAlerta('Error de conexión al eliminar producto', 'error');
            return;
        }
    }
    
    // Eliminar del array local
    productosVenta.splice(index, 1);
    renderizarProductos();
    calcularTotales();
    actualizarStockEnCatalogo(); // Actualizar stock visual en catálogo
}

// ============================================
// CÁLCULOS Y TOTALES
// ============================================

function calcularTotales() {
    const subtotal = productosVenta.reduce((sum, p) => sum + (parseFloat(p.subtotal) || 0), 0);
    const descuento = parseFloat(document.getElementById('inputDescuento').value) || 0;
    
    // La base imponible es el subtotal después de aplicar el descuento
    const baseImponible = subtotal - descuento;
    
    // Calcular IVA solo para productos gravados (sobre la base imponible)
    let impuesto = 0;
    productosVenta.forEach(p => {
        if (p.aplica_iva) {
            const porcentaje = (parseFloat(p.porcentaje_iva) || 19) / 100;
            // Aplicar descuento proporcionalmente a cada producto
            const factorDescuento = descuento > 0 ? (1 - descuento / subtotal) : 1;
            const subtotalProducto = (parseFloat(p.subtotal) || 0) * factorDescuento;
            impuesto += subtotalProducto * porcentaje;
        }
    });
    
    // Calcular impuestos adicionales
    let totalImpuestosAdicionales = 0;
    const detalleImpuestos = [];
    
    impuestosSeleccionados.forEach(impId => {
        const imp = impuestosDisponibles.find(i => i.id === impId);
        if (imp) {
            let base = 0;
            switch(imp.aplica_sobre) {
                case 'subtotal': base = baseImponible; break;
                case 'iva': base = impuesto; break;
                case 'total': base = baseImponible + impuesto; break;
            }
            
            const valor = imp.tipo === 'porcentaje' 
                ? base * (imp.tasa / 100)
                : parseFloat(imp.tasa);
            
            const valorConSigno = imp.afecta_total === 'resta' ? -valor : valor;
            totalImpuestosAdicionales += valorConSigno;
            
            detalleImpuestos.push({
                impuesto_id: imp.id,
                nombre: imp.nombre,
                base_calculo: base,
                tasa: imp.tasa,
                tipo: imp.tipo,
                valor: Math.abs(valor),
                afecta_total: imp.afecta_total
            });
        }
    });
    
    // Total de la factura (sin propina)
    const totalFactura = baseImponible + impuesto + totalImpuestosAdicionales;
    
    // ========================================
    // CÁLCULO DE PROPINA
    // ========================================
    const propinaHabilitada = document.getElementById('checkPropina').checked;
    let propinaValor = 0;
    let propinaPorcentaje = 0;
    
    if (propinaHabilitada) {
        propinaPorcentaje = parseFloat(document.getElementById('inputPropinaPorcentaje').value) || 0;
        // La propina se calcula sobre el NETO (subtotal sin descuento)
        propinaValor = subtotal * (propinaPorcentaje / 100);
    }
    
    // Total final a pagar (factura + propina)
    const total = totalFactura + propinaValor;
    
    // Actualizar variable global para gestión de pagos
    totalVentaActual = total;

    // ========================================
    // ACTUALIZAR UI
    // ========================================
    document.getElementById('resumenSubtotal').textContent = `$${formatearNumero(subtotal)}`;
    document.getElementById('resumenImpuesto').textContent = `$${formatearNumero(impuesto)}`;
    
    // Mostrar/ocultar línea de IVA según el valor
    const contenedorIVA = document.getElementById('contenedorIVA');
    if (impuesto > 0) {
        contenedorIVA.style.display = 'flex';
    } else {
        contenedorIVA.style.display = 'none';
    }
    
    document.getElementById('resumenTotalFactura').textContent = `$${formatearNumero(totalFactura)}`;
    document.getElementById('resumenPropinaValor').textContent = `$${formatearNumero(propinaValor)}`;
    
    // Mostrar impuestos adicionales
    const resumenImpuestos = document.getElementById('resumenImpuestosAdicionales');
    if (detalleImpuestos.length > 0) {
        resumenImpuestos.innerHTML = detalleImpuestos.map(imp => `
            <div class="d-flex justify-content-between mb-1">
                <span class="${imp.afecta_total === 'resta' ? 'text-danger' : 'text-success'}">
                    ${imp.afecta_total === 'resta' ? '-' : '+'} ${imp.nombre}:
                </span>
                <strong>$${formatearNumero(imp.valor)}</strong>
            </div>
        `).join('');
    } else {
        resumenImpuestos.innerHTML = '';
    }
    
    document.getElementById('resumenTotal').textContent = `$${formatearNumero(total)}`;

    // Actualizar estado de pagos
    actualizarEstadoPago();
    
    // Actualizar carrito flotante móvil
    actualizarCarritoFlotante();
}

// ============================================
// GESTIÓN DE PAGOS MÚLTIPLES
// ============================================

function agregarPago() {
    const selectMetodo = document.getElementById('metodoPagoNuevo');
    const inputMonto = document.getElementById('montoPago');
    const inputReferencia = document.getElementById('referenciaPago');
    const inputBanco = document.getElementById('bancoPago');
    
    const metodo = selectMetodo.value;
    const monto = parseFloat(inputMonto.value);
    const referencia = inputReferencia.value.trim();
    const banco = inputBanco.value.trim();
    
    // Validaciones
    if (!metodo) {
        mostrarAlerta('Selecciona un método de pago', 'warning');
        return;
    }
    
    if (!monto || monto <= 0) {
        mostrarAlerta('Ingresa un monto válido', 'warning');
        inputMonto.focus();
        return;
    }
    
    const totalPagado = calcularTotalPagado();
    const pendiente = totalVentaActual - totalPagado;
    
    // Permitir sobrepagos (el sistema calculará el cambio automáticamente)
    
    // Agregar pago al array
    const pago = {
        id: Date.now(),
        metodo_pago: metodo,
        monto: monto,
        referencia: referencia || null,
        banco: banco || null,
        notas: null
    };
    
    pagosPendientes.push(pago);
    
    // Limpiar formulario
    inputMonto.value = '';
    inputReferencia.value = '';
    inputBanco.value = '';
    selectMetodo.selectedIndex = 0;
    
    // Actualizar UI
    renderizarPagos();
    actualizarEstadoPago();
}

function renderizarPagos() {
    const lista = document.getElementById('listaPagos');
    
    if (pagosPendientes.length === 0) {
        lista.innerHTML = '<div class="text-muted text-center py-3">No hay pagos agregados</div>';
        return;
    }
    
    const nombresMetodos = {
        'efectivo': 'Efectivo',
        'tarjeta_debito': 'Tarjeta Débito',
        'tarjeta_credito': 'Tarjeta Crédito',
        'transferencia': 'Transferencia',
        'nequi': 'Nequi',
        'daviplata': 'Daviplata',
        'cheque': 'Cheque'
    };
    
    lista.innerHTML = pagosPendientes.map(pago => `
        <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
            <div class="flex-grow-1">
                <strong>${nombresMetodos[pago.metodo_pago] || pago.metodo_pago}</strong>
                ${pago.referencia ? `<br><small class="text-muted">Ref: ${pago.referencia}</small>` : ''}
                ${pago.banco ? `<br><small class="text-muted">Banco: ${pago.banco}</small>` : ''}
            </div>
            <div class="text-end">
                <div class="fw-bold text-success">$${formatearNumero(pago.monto)}</div>
                <button class="btn btn-sm btn-outline-danger mt-1" onclick="eliminarPago(${pago.id})">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function eliminarPago(pagoId) {
    pagosPendientes = pagosPendientes.filter(p => p.id !== pagoId);
    renderizarPagos();
    actualizarEstadoPago();
}

function calcularTotalPagado() {
    return pagosPendientes.reduce((sum, p) => sum + p.monto, 0);
}

function actualizarEstadoPago() {
    const totalPagado = calcularTotalPagado();
    const pendiente = totalVentaActual - totalPagado;
    const cambio = totalPagado - totalVentaActual;
    
    console.log('=== actualizarEstadoPago ===');
    console.log('totalVentaActual:', totalVentaActual);
    console.log('totalPagado:', totalPagado);
    console.log('pendiente:', pendiente);
    console.log('cambio:', cambio);
    console.log('clienteSeleccionado:', clienteSeleccionado);
    console.log('productosVenta.length:', productosVenta.length);
    
    // Actualizar resumen de pagos
    document.getElementById('totalVentaPagos').textContent = `$${formatearNumero(totalVentaActual)}`;
    document.getElementById('totalPagado').textContent = `$${formatearNumero(totalPagado)}`;
    
    // Mostrar pendiente o cambio según corresponda
    const montoPendienteEl = document.getElementById('montoPendiente');
    if (pendiente > 0.01) {
        montoPendienteEl.textContent = `$${formatearNumero(pendiente)}`;
        montoPendienteEl.className = 'text-danger fw-bold';
    } else if (cambio > 0.01) {
        montoPendienteEl.textContent = `$${formatearNumero(cambio)} (Cambio)`;
        montoPendienteEl.className = 'text-success fw-bold';
    } else {
        montoPendienteEl.textContent = '$0';
        montoPendienteEl.className = 'text-muted';
    }
    
    // Mostrar/ocultar alerta
    const alertaPendiente = document.getElementById('alertaPendiente');
    if (pendiente > 0.01) {
        alertaPendiente.style.display = 'block';
        alertaPendiente.textContent = `Pendiente por pagar: $${formatearNumero(pendiente)}`;
        alertaPendiente.className = 'alert alert-warning';
    } else if (cambio > 0.01) {
        alertaPendiente.style.display = 'block';
        alertaPendiente.textContent = `💵 Cambio a devolver: $${formatearNumero(cambio)}`;
        alertaPendiente.className = 'alert alert-success';
    } else {
        alertaPendiente.style.display = 'none';
    }
    
    // Habilitar/deshabilitar botones de acción
    const btnGuardar = document.getElementById('btnGuardarVenta');
    const btnAbrirCuenta = document.getElementById('btnAbrirCuenta');
    const pagoCompleto = pendiente <= 0.01; // Permitir si está pagado o sobrepagado
    const tieneCliente = !!clienteSeleccionado;
    const tieneProductos = productosVenta.length > 0;
    
    console.log('Condiciones para habilitar botones:');
    console.log('  - pagoCompleto:', pagoCompleto, '(pendiente <= 0.01)');
    console.log('  - tieneCliente:', tieneCliente);
    console.log('  - tieneProductos:', tieneProductos);
    console.log('  - btnGuardar.disabled será:', !tieneCliente || !tieneProductos || !pagoCompleto);
    console.log('  - btnAbrirCuenta.disabled será:', !tieneProductos);
    
    // Guardar Venta requiere: cliente, productos y pago completo
    btnGuardar.disabled = !tieneCliente || !tieneProductos || !pagoCompleto;
    
    // Abrir Cuenta solo requiere: productos (el cliente es opcional)
    if (btnAbrirCuenta) {
        btnAbrirCuenta.disabled = !tieneProductos;
    }
}

// ============================================
// GUARDAR VENTA (ACTUALIZADA)
// ============================================

async function guardarVenta() {
    console.log('=== Iniciando guardarVenta ===');
    console.log('clienteSeleccionado:', clienteSeleccionado);
    console.log('productosVenta:', productosVenta);
    console.log('currentEmpresa:', currentEmpresa);
    console.log('currentUsuario:', currentUsuario);

    if (!clienteSeleccionado || productosVenta.length === 0) {
        mostrarAlerta('Debes seleccionar un cliente y agregar productos', 'warning');
        return;
    }

    const subtotal = productosVenta.reduce((sum, p) => sum + p.subtotal, 0);
    const descuento = parseFloat(document.getElementById('inputDescuento').value) || 0;
    const baseImponible = subtotal - descuento;
    
    // Calcular IVA solo para productos gravados
    let impuesto = 0;
    productosVenta.forEach(p => {
        if (p.aplica_iva) {
            const porcentaje = (p.porcentaje_iva || 19) / 100;
            const subtotalProducto = p.subtotal * (descuento > 0 ? (1 - descuento / subtotal) : 1);
            impuesto += subtotalProducto * porcentaje;
        }
    });
    
    // Calcular impuestos adicionales
    let totalImpuestosAdicionales = 0;
    const impuestosVenta = [];
    
    impuestosSeleccionados.forEach(impId => {
        const imp = impuestosDisponibles.find(i => i.id === impId);
        if (imp) {
            let base = 0;
            switch(imp.aplica_sobre) {
                case 'subtotal': base = baseImponible; break;
                case 'iva': base = impuesto; break;
                case 'total': base = baseImponible + impuesto; break;
            }
            
            const valor = imp.tipo === 'porcentaje' 
                ? base * (imp.tasa / 100)
                : parseFloat(imp.tasa);
            
            const valorConSigno = imp.afecta_total === 'resta' ? -valor : valor;
            totalImpuestosAdicionales += valorConSigno;
            
            impuestosVenta.push({
                impuesto_id: imp.id,
                codigo: imp.codigo,
                nombre: imp.nombre,
                base_calculo: base,
                tasa: imp.tasa,
                valor: Math.abs(valor),
                afecta_total: imp.afecta_total
            });
        }
    });
    
    const total = baseImponible + impuesto + totalImpuestosAdicionales;
    
    // ========================================
    // CÁLCULO DE PROPINA
    // ========================================
    const propinaHabilitada = document.getElementById('checkPropina').checked;
    let propinaValor = 0;
    let propinaPorcentaje = 0;
    
    if (propinaHabilitada) {
        propinaPorcentaje = parseFloat(document.getElementById('inputPropinaPorcentaje').value) || 0;
        // La propina se calcula sobre el NETO (subtotal sin descuento)
        propinaValor = subtotal * (propinaPorcentaje / 100);
    }
    
    // Total final a pagar (factura + propina)
    const totalFinal = total + propinaValor;
    
    // Determinar método de pago para mostrar en factura
    let metodoPagoResumen = 'No especificado';
    if (pagosPendientes.length === 1) {
        metodoPagoResumen = pagosPendientes[0].metodo_pago;
    } else if (pagosPendientes.length > 1) {
        metodoPagoResumen = 'Múltiple';
    }

    const ventaData = {
        empresa_id: currentEmpresa?.id,
        cliente_id: clienteSeleccionado?.id,
        vendedor_id: currentUsuario?.id,
        subtotal: subtotal,
        descuento: descuento,
        impuesto: impuesto,
        total: totalFinal,  // Total incluyendo propina
        metodo_pago: metodoPagoResumen,
        notas: document.getElementById('notasVenta').value || null,
        // Campos de propina
        propina_habilitada: propinaHabilitada,
        propina_porcentaje: propinaHabilitada ? propinaPorcentaje : 0,
        propina_valor: propinaHabilitada ? propinaValor : 0,
        propina_base: propinaHabilitada ? subtotal : 0,
        // Impuestos y pagos
        impuestos: impuestosVenta,
        pagos: pagosPendientes,
        productos: productosVenta.map(p => ({
            producto_id: p.id,
            cantidad: p.cantidad,
            precio_unitario: p.precio_unitario,
            descuento: 0,
            subtotal: p.subtotal,
            // Campos para ventas contra pedido
            tipo_venta: p.tipo_venta || 'inmediata',
            estado_entrega: p.estado_entrega || null,
            fecha_entrega_estimada: p.fecha_entrega_estimada || null,
            notas_entrega: p.notas_entrega || null
        }))
    };

    console.log('=== DATOS DE VENTA A ENVIAR ===');
    console.log('Subtotal:', subtotal);
    console.log('Descuento:', descuento);
    console.log('Base Imponible:', baseImponible);
    console.log('Impuesto:', impuesto);
    console.log('Total (sin propina):', total);
    console.log('Propina:', propinaValor);
    console.log('Total Final:', totalFinal);
    console.log('ventaData completo:', ventaData);
    console.log('================================');

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/ventas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(ventaData)
        });

        if (!response.ok) {
            if (response.status === 401) {
                handleUnauthorized();
                return;
            }
            const error = await response.json();
            throw new Error(error.message || 'Error al guardar venta');
        }

        const data = await response.json();
        
        // Guardar nombres de productos antes de limpiar
        const productosConNombres = ventaData.productos.map(p => ({
            ...p,
            nombre: productosVenta.find(pv => pv.id === p.producto_id)?.nombre || 'Producto'
        }));
        
        // Guardar datos de venta en variables globales para la impresión
        ultimaVentaGuardada = data.data;
        
        // Agregar nombres a los impuestos para la factura
        const impuestosConNombres = ventaData.impuestos.map(impVenta => {
            const impuesto = impuestosDisponibles.find(i => i.id === impVenta.impuesto_id);
            return {
                ...impVenta,
                nombre: impuesto ? impuesto.nombre : 'Impuesto'
            };
        });
        
        ultimaVentaData = {
            ...ventaData, 
            productos: productosConNombres,
            cliente: clienteSeleccionado, // Guardar cliente para impresión
            impuestos: impuestosConNombres // Agregar impuestos con nombres
        };
        
        // Limpiar formulario SIN confirmación (ya guardamos la venta)
        limpiarVentaSinConfirmar();
        
        // Mostrar factura después de limpiar
        mostrarFactura(ultimaVentaGuardada, ultimaVentaData);
        
        mostrarAlerta('🎉 Venta guardada exitosamente', 'success');
        reproducirSonido('success');
        
        // Recargar últimas ventas
        setTimeout(cargarUltimasVentas, 500);
        
        // Si modo rápido está activo, seleccionar público general automáticamente
        if (modoRapido) {
            setTimeout(seleccionarPublicoGeneral, 1000);
        }

    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta(error.message || 'Error al guardar venta', 'danger');
        reproducirSonido('error');
    }
}

// ============================================
// UTILIDADES
// ============================================

// Limpiar venta CON confirmación (para botón "Limpiar Todo")
function limpiarVenta() {
    if (productosVenta.length > 0) {
        if (!confirm('¿Estás seguro de limpiar toda la venta?')) {
            return;
        }
    }
    limpiarVentaSinConfirmar();
}

// Limpiar venta SIN confirmación (después de guardar)
function limpiarVentaSinConfirmar() {
    clienteSeleccionado = null;
    productosVenta = [];
    pagosPendientes = [];
    totalVentaActual = 0;
    
    // Resetear impuestos a ninguno - el vendedor debe seleccionarlos manualmente
    impuestosSeleccionados = [];
    
    // Actualizar UI de impuestos
    if (impuestosDisponibles.length > 0) {
        renderizarImpuestosDisponibles();
        document.getElementById('impuestosCount').textContent = 0;
    }
    
    document.getElementById('busquedaCliente').style.display = 'block';
    document.getElementById('clienteSeleccionado').style.display = 'none';
    document.getElementById('numeroDocumento').value = '';
    document.getElementById('buscarNombre').value = '';
    document.getElementById('inputDescuento').value = '0';
    document.getElementById('checkPropina').checked = false;
    document.getElementById('contenedorPropina').style.display = 'none';
    document.getElementById('inputPropinaPorcentaje').value = '5';
    document.getElementById('notasVenta').value = '';
    
    // Limpiar campos de pago
    document.getElementById('montoPago').value = '';
    document.getElementById('referenciaPago').value = '';
    document.getElementById('bancoPago').value = '';
    document.getElementById('metodoPagoNuevo').selectedIndex = 0;
    
    renderizarProductos();
    renderizarPagos();
    calcularTotales();
    actualizarStockEnCatalogo(); // Restaurar stock en catálogo
    deshabilitarSeccionProductos();
}

function habilitarSeccionProductos() {
    document.getElementById('seccionProductos').classList.remove('section-disabled');
}

function deshabilitarSeccionProductos() {
    document.getElementById('seccionProductos').classList.add('section-disabled');
}

function abrirModalCliente() {
    document.getElementById('clienteForm').reset();
    document.getElementById('clienteTipoDocumento').value = document.getElementById('tipoDocumento').value;
    document.getElementById('clienteNumeroDocumento').value = document.getElementById('numeroDocumento').value;
    
    const modal = new bootstrap.Modal(document.getElementById('clienteModal'));
    modal.show();
}

async function guardarClienteRapido() {
    try {
        console.log('=== Iniciando guardarClienteRapido ===');
        
        // Validar que tenemos empresa activa
        if (!currentEmpresa || !currentEmpresa.id) {
            mostrarAlerta('No hay empresa activa seleccionada', 'warning');
            return;
        }
        
        console.log('Empresa activa:', currentEmpresa);

        // Obtener elementos
        const elemNumDoc = document.getElementById('clienteNumeroDocumento');
        const elemNombre = document.getElementById('clienteNombre');
        const elemApellido = document.getElementById('clienteApellido');
        const elemTelefono = document.getElementById('clienteTelefonoNuevo');
        const elemEmail = document.getElementById('clienteEmailNuevo');
        const elemTipoDoc = document.getElementById('clienteTipoDocumento');

        console.log('Elementos encontrados:', {
            elemNumDoc: !!elemNumDoc,
            elemNombre: !!elemNombre,
            elemApellido: !!elemApellido,
            elemTelefono: !!elemTelefono,
            elemEmail: !!elemEmail,
            elemTipoDoc: !!elemTipoDoc
        });

        // Validar que existen
        if (!elemNumDoc || !elemNombre) {
            console.error('Elementos del formulario no encontrados');
            mostrarAlerta('Error: No se pudo cargar el formulario', 'danger');
            return;
        }

        // Obtener valores
        const numero_documento = (elemNumDoc.value || '').trim();
        const nombre = (elemNombre.value || '').trim();
        const apellido = (elemApellido?.value || '').trim();
        const telefono = (elemTelefono?.value || '').trim();
        const email = (elemEmail?.value || '').trim();
        const tipo_documento = elemTipoDoc?.value || 'CC';

        console.log('Valores obtenidos:', {
            tipo_documento,
            numero_documento,
            nombre,
            apellido,
            telefono,
            email
        });

        // Validar campos requeridos
        if (!numero_documento || !nombre) {
            mostrarAlerta('Los campos Documento y Nombre son obligatorios', 'warning');
            console.error('Validación fallida:', { numero_documento, nombre });
            return;
        }

        console.log('Validación exitosa, preparando datos...');

        const clienteData = {
            empresa_id: currentEmpresa.id,
            tipo_documento: tipo_documento,
            numero_documento: numero_documento,
            nombre: nombre,
            apellido: apellido || null,
            telefono: telefono || null,
            email: email || null,
            estado: 'activo'
        };

        console.log('Datos a enviar:', clienteData);

        const token = localStorage.getItem('token');
        console.log('Enviando petición al servidor...');
        
        const response = await fetch(`${API_URL}/clientes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(clienteData)
        });

        console.log('Respuesta del servidor:', response.status);

        if (!response.ok) {
            if (response.status === 401) {
                handleUnauthorized();
                return;
            }
            const error = await response.json();
            console.error('Error del servidor:', error);
            throw new Error(error.message || 'Error al guardar cliente');
        }

        const data = await response.json();
        console.log('Cliente guardado exitosamente:', data);
        console.log('data.data:', data.data);
        console.log('data.data.id:', data.data?.id);
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('clienteModal'));
        if (modal) {
            modal.hide();
        }

        mostrarAlerta('Cliente creado exitosamente', 'success');

        // Seleccionar el cliente recién creado directamente
        if (data.data && data.data.id) {
            console.log('Seleccionando cliente con ID:', data.data.id);
            // El backend devuelve el cliente con ID, seleccionarlo directamente
            seleccionarCliente(data.data);
            console.log('clienteSeleccionado después de seleccionar:', clienteSeleccionado);
        } else {
            console.log('data.data no tiene ID, buscando por documento');
            // Si no devuelve el objeto completo, buscar por documento
            document.getElementById('numeroDocumento').value = numero_documento;
            setTimeout(() => {
                buscarPorDocumento();
            }, 500);
        }

    } catch (error) {
        console.error('Error en guardarClienteRapido:', error);
        mostrarAlerta(error.message || 'Error al guardar cliente', 'danger');
    }
}

/**
 * Establecer porcentaje de propina (botones rápidos)
 */
function setPropinaPorcentaje(porcentaje) {
    document.getElementById('checkPropina').checked = true;
    document.getElementById('contenedorPropina').style.display = 'block';
    document.getElementById('inputPropinaPorcentaje').value = porcentaje;
    calcularTotales();
}

function formatearNumero(num) {
    return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
}

/**
 * Parsear número formateado en formato colombiano (es-CO)
 * Ejemplo: "8.500" -> 8500, "1.234,56" -> 1234.56
 */
function parsearNumeroFormateado(texto) {
    if (!texto) return 0;
    // Remover puntos (separador de miles) y reemplazar coma por punto (decimal)
    const limpio = texto.toString().replace(/\./g, '').replace(/,/g, '.');
    return parseFloat(limpio) || 0;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = 'login.html';
}

function mostrarAlerta(mensaje, tipo = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tipo} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    alertDiv.innerHTML = `
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// ============================================
// FACTURA
// ============================================

function mostrarFactura(venta, ventaData) {
    console.log('=== mostrarFactura - Usando plantilla configurada ===');
    console.log('Plantilla ID:', configuracionPlantilla?.plantilla_id);
    
    // Usar generarHTMLImpresion con la configuración de plantilla actual
    const htmlFactura = generarHTMLImpresion('carta');
    
    document.getElementById('facturaContent').innerHTML = htmlFactura;
    const modal = new bootstrap.Modal(document.getElementById('facturaModal'));
    modal.show();
}

function imprimirFactura() {
    if (!ultimaVentaGuardada || !ultimaVentaData) {
        mostrarAlerta('No hay factura para imprimir', 'warning');
        return;
    }

    // Preguntar formato de impresión con SweetAlert2
    Swal.fire({
        title: 'Seleccione el formato de impresión',
        html: `
            <div class="text-start">
                <p class="mb-3"><strong>Seleccione el formato de impresión:</strong></p>
                <div class="form-check mb-2">
                    <input class="form-check-input" type="radio" name="formatoImpresion" id="formatoCarta" value="carta" checked>
                    <label class="form-check-label" for="formatoCarta">
                        <i class="bi bi-file-earmark-text"></i> <strong>Tamaño Carta</strong> (Letter 8.5" x 11")
                    </label>
                </div>
                <div class="form-check mb-2">
                    <input class="form-check-input" type="radio" name="formatoImpresion" id="formatoMediaCarta" value="media-carta">
                    <label class="form-check-label" for="formatoMediaCarta">
                        <i class="bi bi-file-earmark"></i> <strong>Media Carta</strong> (Half Letter 5.5" x 8.5")
                    </label>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="radio" name="formatoImpresion" id="formatoTirilla" value="tirilla">
                    <label class="form-check-label" for="formatoTirilla">
                        <i class="bi bi-receipt"></i> <strong>Tirilla Térmica</strong> (POS 58mm/80mm)
                    </label>
                </div>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-printer"></i> Imprimir',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#1E40AF',
        preConfirm: () => {
            const formato = document.querySelector('input[name="formatoImpresion"]:checked').value;
            return formato;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const formato = result.value;
            
            const numeroFactura = ultimaVentaGuardada.numero_factura || 'factura';
            const nombreArchivo = `Factura_${numeroFactura}`;

            // Generar HTML de impresión según formato seleccionado
            const htmlImpresion = generarHTMLImpresion(formato);

            // Crear un iframe oculto para imprimir (más confiable que window.open)
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            
            const iframeDoc = iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(htmlImpresion);
            iframeDoc.close();
            
            // Esperar a que cargue e imprimir
            iframe.onload = () => {
                setTimeout(() => {
                    iframe.contentWindow.print();
                    // Remover iframe después de imprimir
                    setTimeout(() => document.body.removeChild(iframe), 1000);
                }, 250);
            };
        }
    });
}

async function descargarPDF() {
    if (!ultimaVentaGuardada || !ultimaVentaData) {
        mostrarAlerta('No hay factura para descargar', 'warning');
        return;
    }

    try {
        mostrarAlerta('Generando PDF...', 'info');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'letter');
        const venta = ultimaVentaGuardada;
        const ventaData = ultimaVentaData;
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        let y = margin;

        // ENCABEZADO
        doc.setFontSize(18);
        doc.setTextColor(30, 64, 175); // #1E40AF
        doc.setFont(undefined, 'bold');
        doc.text(currentEmpresa.nombre, pageWidth / 2, y, { align: 'center' });
        y += 6;

        // Slogan
        if (currentEmpresa.slogan) {
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.setFont(undefined, 'italic');
            doc.text(currentEmpresa.slogan, pageWidth / 2, y, { align: 'center' });
            y += 5;
        }

        // Razón Social y NIT
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(currentEmpresa.razon_social, pageWidth / 2, y, { align: 'center' });
        y += 5;
        
        const digitoVerif = calcularDigitoVerificacion(currentEmpresa.nit);
        doc.text(`NIT: ${currentEmpresa.nit}-${digitoVerif}`, pageWidth / 2, y, { align: 'center' });
        y += 5;

        // Badges fiscales
        doc.setFontSize(8);
        let badgesText = [];
        if (currentEmpresa.regimen_tributario) badgesText.push(`Régimen ${currentEmpresa.regimen_tributario === 'comun' ? 'Común' : currentEmpresa.regimen_tributario}`);
        if (currentEmpresa.gran_contribuyente) badgesText.push('Gran Contribuyente');
        if (currentEmpresa.autoretenedor) badgesText.push('Autoretenedor');
        doc.text(badgesText.join(' • '), pageWidth / 2, y, { align: 'center' });
        y += 5;

        // Dirección y contacto
        doc.text(`${currentEmpresa.direccion} - ${currentEmpresa.ciudad}`, pageWidth / 2, y, { align: 'center' });
        y += 4;
        doc.text(`Tel: ${currentEmpresa.telefono} | Email: ${currentEmpresa.email}`, pageWidth / 2, y, { align: 'center' });
        y += 8;

        // FACTURA DE VENTA ELECTRÓNICA
        doc.setFillColor(30, 64, 175);
        doc.rect(margin, y, pageWidth - margin * 2, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('FACTURA DE VENTA ELECTRÓNICA', pageWidth / 2, y + 5, { align: 'center' });
        doc.setFontSize(12);
        doc.text(venta.numero_factura, pageWidth / 2, y + 10, { align: 'center' });
        y += 15;

        // Resolución DIAN
        if (currentEmpresa.resolucion_dian) {
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.text(`Resolución DIAN: ${currentEmpresa.resolucion_dian}`, margin, y);
            y += 4;
            doc.text(`Vigencia: ${currentEmpresa.fecha_resolucion_desde} al ${currentEmpresa.fecha_resolucion_hasta}`, margin, y);
            y += 8;
        }

        // DATOS CLIENTE Y VENTA (2 columnas)
        const col1 = margin;
        const col2 = pageWidth / 2 + 5;

        // Cuadro Cliente
        doc.setDrawColor(200, 200, 200);
        doc.rect(col1, y, pageWidth / 2 - margin - 5, 25);
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text('CLIENTE:', col1 + 2, y + 5);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        const clienteNombre = ventaData.cliente.razon_social || `${ventaData.cliente.nombre} ${ventaData.cliente.apellido || ''}`;
        doc.text(clienteNombre, col1 + 2, y + 10, { maxWidth: pageWidth / 2 - margin - 9 });
        doc.text(`${ventaData.cliente.tipo_documento}: ${ventaData.cliente.numero_documento}`, col1 + 2, y + 15);
        doc.text(`${ventaData.cliente.direccion || 'N/A'}, ${ventaData.cliente.ciudad || ''}`, col1 + 2, y + 20, { maxWidth: pageWidth / 2 - margin - 9 });

        // Cuadro Venta
        doc.rect(col2, y, pageWidth / 2 - margin - 5, 25);
        doc.setFont(undefined, 'bold');
        doc.text('DATOS DE VENTA:', col2 + 2, y + 5);
        doc.setFont(undefined, 'normal');
        const fecha = new Date(venta.fecha_venta).toLocaleDateString('es-CO');
        doc.text(`Fecha: ${fecha}`, col2 + 2, y + 10);
        doc.text(`Forma de Pago: Contado`, col2 + 2, y + 15);
        doc.text(`Método: ${ventaData.metodo_pago || 'Efectivo'}`, col2 + 2, y + 20);
        y += 30;

        // TABLA DE PRODUCTOS
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.text('DESCRIPCIÓN DE PRODUCTOS/SERVICIOS', margin, y);
        y += 6;

        // Cabecera tabla
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
        doc.setFontSize(8);
        doc.text('#', margin + 2, y + 4);
        doc.text('Descripción', margin + 10, y + 4);
        doc.text('Cant', pageWidth - margin - 80, y + 4);
        doc.text('Precio U.', pageWidth - margin - 65, y + 4, { align: 'right' });
        doc.text('IVA %', pageWidth - margin - 48, y + 4, { align: 'right' });
        doc.text('Total', pageWidth - margin - 2, y + 4, { align: 'right' });
        y += 8;

        // Productos
        doc.setFont(undefined, 'normal');
        ventaData.productos.forEach((prod, idx) => {
            doc.text(String(idx + 1), margin + 2, y);
            doc.text(prod.nombre.substring(0, 40), margin + 10, y);
            doc.text(String(prod.cantidad), pageWidth - margin - 80, y);
            doc.text(`$${Number(prod.precio_unitario).toLocaleString('es-CO')}`, pageWidth - margin - 65, y, { align: 'right' });
            doc.text('19%', pageWidth - margin - 48, y, { align: 'right' });
            doc.text(`$${Number(prod.subtotal).toLocaleString('es-CO')}`, pageWidth - margin - 2, y, { align: 'right' });
            y += 5;
        });

        y += 5;

        // TOTALES
        doc.setDrawColor(0, 0, 0);
        doc.line(pageWidth - margin - 60, y, pageWidth - margin, y);
        y += 6;
        
        doc.setFontSize(9);
        doc.text('SUBTOTAL:', pageWidth - margin - 55, y);
        doc.text(`$${Number(ventaData.subtotal).toLocaleString('es-CO')}`, pageWidth - margin - 2, y, { align: 'right' });
        y += 5;
        
        doc.text('IVA 19%:', pageWidth - margin - 55, y);
        doc.text(`$${Number(ventaData.impuesto).toLocaleString('es-CO')}`, pageWidth - margin - 2, y, { align: 'right' });
        y += 7;

        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text('TOTAL:', pageWidth - margin - 55, y);
        doc.text(`$${Number(ventaData.total).toLocaleString('es-CO')}`, pageWidth - margin - 2, y, { align: 'right' });
        y += 10;

        // CUFE y QR
        if (venta.cufe) {
            doc.setFontSize(7);
            doc.setFont(undefined, 'normal');
            doc.text(`CUFE: ${venta.cufe}`, margin, y, { maxWidth: pageWidth - margin * 2 - 40 });
            
            // QR Code (si existe)
            if (venta.qr_code) {
                try {
                    doc.addImage(venta.qr_code, 'PNG', pageWidth - margin - 35, y - 5, 30, 30);
                } catch (e) {
                    console.warn('No se pudo agregar QR Code al PDF');
                }
            }
            y += 25;
        }

        // Pie de página
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('Esta factura se asimila en todos sus efectos legales a una letra de cambio (Art. 774 Código de Comercio)', pageWidth / 2, pageHeight - 20, { align: 'center', maxWidth: pageWidth - margin * 2 });
        doc.text('¡Gracias por su compra!', pageWidth / 2, pageHeight - 15, { align: 'center' });

        // Descargar
        doc.save(`Factura_${venta.numero_factura}.pdf`);
        
        mostrarAlerta('PDF descargado exitosamente', 'success');
    } catch (error) {
        console.error('Error generando PDF:', error);
        mostrarAlerta('Error al generar PDF: ' + error.message, 'danger');
    }
}

// ============================================
// FUNCIONES DE GENERACIÓN DE PLANTILLAS
// ============================================

function obtenerConfiguracionActual() {
    const config = {
        plantillaId: configuracionPlantilla?.plantilla_id || 1,
        colorPrimario: configuracionPlantilla?.color_primario || currentEmpresa.color_primario || '#1E40AF',
        colorSecundario: configuracionPlantilla?.color_secundario || '#6c757d',
        fuente: configuracionPlantilla?.fuente || 'Arial',
        mostrarLogo: configuracionPlantilla?.mostrar_logo !== false,
        mostrarQR: configuracionPlantilla?.mostrar_qr !== false,
        mostrarCUFE: configuracionPlantilla?.mostrar_cufe !== false,
        mostrarBadges: configuracionPlantilla?.mostrar_badges !== false
    };
    console.log('🎨 Configuración actual para generación:', config);
    return config;
}

function generarHTMLImpresion(formato = 'carta') {
    console.log('🖨️ Generando factura - Formato:', formato);
    const venta = ultimaVentaGuardada;
    const ventaData = ultimaVentaData;
    const config = obtenerConfiguracionActual();
    console.log('📄 Usando plantilla ID:', config.plantillaId);
    
    // Decidir qué plantilla usar según formato y configuración
    if (formato === 'tirilla') {
        return generarPlantillaTirilla(venta, ventaData, config);
    } else if (formato === 'media-carta') {
        return generarPlantillaMediaCarta(venta, ventaData, config);
    } else {
        // Formato carta - usar plantilla seleccionada
        return generarPlantillaCarta(venta, ventaData, config);
    }
}

// Generar plantilla formato CARTA según configuración
function generarPlantillaCarta(venta, ventaData, config) {
    const numeroFactura = venta.numero_factura;
    const subtotal = ventaData.subtotal;
    const descuento = ventaData.descuento || 0;
    const impuesto = ventaData.impuesto;
    const total = ventaData.total;
    
    const fecha = new Date().toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const digitoVerificacion = calcularDigitoVerificacion(currentEmpresa.nit);
    const nitCompleto = `${currentEmpresa.nit}-${digitoVerificacion}`;
    
    // Usar plantilla según configuración
    switch (config.plantillaId) {
        case 2: return generarPlantillaModernaCarta(venta, ventaData, config, fecha, nitCompleto, subtotal, descuento, impuesto, total, numeroFactura);
        case 3: return generarPlantillaMinimalistaCarta(venta, ventaData, config, fecha, nitCompleto, subtotal, descuento, impuesto, total, numeroFactura);
        case 4: return generarPlantillaCorporativaCarta(venta, ventaData, config, fecha, nitCompleto, subtotal, descuento, impuesto, total, numeroFactura);
        case 5: return generarPlantillaSIIGOCarta(venta, ventaData, config, fecha, nitCompleto, subtotal, descuento, impuesto, total, numeroFactura);
        default: return generarPlantillaClasicaCarta(venta, ventaData, config, fecha, nitCompleto, subtotal, descuento, impuesto, total, numeroFactura);
    }
}

// PLANTILLA 1: CLÁSICA
function generarPlantillaClasicaCarta(venta, ventaData, config, fecha, nitCompleto, subtotal, descuento, impuesto, total, numeroFactura) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Factura_${numeroFactura}</title>
    <style>
        @page { size: letter; margin: 15mm; }
        body { font-family: ${config.fuente}, sans-serif; font-size: 10pt; color: #000; padding: 8mm; }
        .encabezado { text-align: center; margin-bottom: 5mm; padding-bottom: 3mm; border-bottom: 2px solid ${config.colorPrimario}; }
        .encabezado h2 { font-size: 16pt; margin-bottom: 2mm; color: ${config.colorPrimario}; }
        .titulo-factura { text-align: center; font-size: 10pt; font-weight: bold; margin: 3mm 0; padding: 2mm; border: 2px solid ${config.colorPrimario}; background-color: ${config.colorPrimario}15; border-radius: 3mm; }
        .info-boxes { display: flex; justify-content: space-between; gap: 3mm; margin: 4mm 0; }
        .info-box { flex: 1; border: 1px solid #ddd; padding: 3mm; border-radius: 2mm; font-size: 9pt; }
        table { width: 100%; border-collapse: collapse; margin: 4mm 0; font-size: 9pt; }
        th { background-color: ${config.colorPrimario}15; border: 1px solid #ddd; padding: 2mm; text-align: left; }
        td { border: 1px solid #ddd; padding: 2mm; }
        .text-right { text-align: right; }
        .total-final { font-size: 11pt; font-weight: bold; background-color: ${config.colorPrimario}; color: white; }
    </style>
</head>
<body>
    <div class="encabezado">
        <h2>${currentEmpresa.nombre}</h2>
        <p>${currentEmpresa.razon_social}</p>
        <p>NIT: ${nitCompleto} | ${currentEmpresa.telefono || ''}</p>
        ${config.mostrarBadges && currentEmpresa.es_gran_contribuyente ? '<span style="background: #28a745; color: white; padding: 2mm 3mm; border-radius: 2mm; font-size: 8pt;">Gran Contribuyente</span>' : ''}
    </div>
    
    <div class="titulo-factura">FACTURA ELECTRÓNICA<br>${numeroFactura}</div>
    
    <div class="info-boxes">
        <div class="info-box"><strong>Fecha:</strong><br>${fecha}</div>
        <div class="info-box">
            <strong>Cliente:</strong><br>
            ${ventaData.cliente.razon_social || `${ventaData.cliente.nombre} ${ventaData.cliente.apellido || ''}`}<br>
            ${ventaData.cliente.tipo_documento}: ${ventaData.cliente.numero_documento}
        </div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>#</th><th>Descripción</th><th class="text-right">Cant.</th><th class="text-right">Precio</th><th class="text-right">Total</th>
            </tr>
        </thead>
        <tbody>
            ${ventaData.productos.map((p, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${p.nombre}</td>
                    <td class="text-right">${p.cantidad}</td>
                    <td class="text-right">$${formatearNumero(p.precio_unitario)}</td>
                    <td class="text-right">$${formatearNumero(p.subtotal)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <div style="display: flex; justify-content: flex-end;">
        <table style="width: 250px;">
            <tr><td>Subtotal:</td><td class="text-right">$${formatearNumero(subtotal)}</td></tr>
            ${descuento > 0 ? `<tr><td>Descuento:</td><td class="text-right">-$${formatearNumero(descuento)}</td></tr>` : ''}
            <tr><td>IVA (19%):</td><td class="text-right">$${formatearNumero(impuesto)}</td></tr>
            <tr class="total-final"><td style="padding: 8px;">TOTAL:</td><td class="text-right" style="padding: 8px;">$${formatearNumero(total)}</td></tr>
        </table>
    </div>
    
    ${config.mostrarCUFE && venta.cufe ? `<div style="margin-top: 5mm; padding: 3mm; background: #f8f9fa; font-size: 7pt;"><strong>CUFE:</strong> ${venta.cufe}</div>` : ''}
    ${config.mostrarQR && venta.qr_code ? `<div style="text-align: center; margin-top: 3mm;"><img src="${venta.qr_code}" style="width: 80px; height: 80px;"></div>` : ''}
    
    <script>
        window.onload = function() {
            setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 100); }, 250);
        };
    </script>
</body>
</html>`;
}

// PLANTILLA 2: MODERNA
function generarPlantillaModernaCarta(venta, ventaData, config, fecha, nitCompleto, subtotal, descuento, impuesto, total, numeroFactura) {
    // Formatear fechas de resolución DIAN
    const formatearFecha = (fecha) => {
        if (!fecha) return 'N/A';
        const d = new Date(fecha);
        return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Factura_${numeroFactura}</title>
    <style>
        @page { size: letter; margin: 15mm; }
        body { font-family: ${config.fuente}, sans-serif; font-size: 10pt; color: #000; padding: 8mm; }
        .encabezado { display: flex; align-items: center; margin-bottom: 5mm; padding-bottom: 3mm; border-bottom: 3px solid ${config.colorPrimario}; }
        .encabezado h2 { color: ${config.colorPrimario}; margin: 0; font-size: 18pt; }
        .encabezado-info { flex-grow: 1; }
        .encabezado-info p { margin: 2px 0; font-size: 8pt; }
        .titulo-factura { background: ${config.colorPrimario}; color: white; text-align: center; font-size: 9pt; font-weight: bold; padding: 6px 12px; border-radius: 4px; margin: 10px 0; display: inline-block; margin-left: auto; margin-right: auto; }
        .titulo-factura-container { text-align: center; margin: 10px 0; }
        .resolucion-box { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 8px 12px; margin: 10px 0; font-size: 8pt; border-radius: 4px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
        .info-box { border: 1px solid #ddd; padding: 10px; border-radius: 5px; font-size: 9pt; }
        .info-box strong { color: ${config.colorPrimario}; display: block; margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 4mm 0; font-size: 9pt; }
        th { background-color: ${config.colorPrimario}; color: white; padding: 2mm; text-align: left; }
        td { border: 1px solid #ddd; padding: 2mm; }
        tbody tr:nth-child(even) { background: #f9f9f9; }
        .text-right { text-align: right; }
        .total-final { font-size: 11pt; font-weight: bold; background-color: ${config.colorPrimario}; color: white; }
    </style>
</head>
<body>
    <div class="encabezado">
        <div class="encabezado-info">
            <h2>${currentEmpresa.nombre}</h2>
            <p style="font-weight: 600; font-size: 9pt; color: ${config.colorSecundario};">${currentEmpresa.razon_social}</p>
            <p>NIT: ${nitCompleto}</p>
            <p>${currentEmpresa.direccion || ''} - ${currentEmpresa.ciudad || ''}</p>
            <p>Tel: ${currentEmpresa.telefono || ''} | Email: ${currentEmpresa.email || ''}</p>
        </div>
        ${config.mostrarBadges && currentEmpresa.es_gran_contribuyente ? `<div style="background: linear-gradient(135deg, ${config.colorPrimario}, #0ea5e9); color: white; padding: 8px 12px; border-radius: 8px; font-size: 8pt; text-align: center;"><strong>GRAN<br>CONTRIBUYENTE</strong></div>` : ''}
    </div>
    
    <div class="titulo-factura-container">
        <div class="titulo-factura">FACTURA ELECTRÓNICA ${numeroFactura}</div>
    </div>
    
    ${currentEmpresa.resolucion_dian ? `
    <div class="resolucion-box">
        <strong>Resolución DIAN:</strong> ${currentEmpresa.resolucion_dian}${currentEmpresa.fecha_resolucion ? ` del ${formatearFecha(currentEmpresa.fecha_resolucion)}` : ''}<br>
        <strong>Vigencia:</strong> ${formatearFecha(currentEmpresa.fecha_resolucion_desde)} al ${formatearFecha(currentEmpresa.fecha_resolucion_hasta)}
    </div>` : ''}
    
    <div class="info-grid">
        <div class="info-box">
            <strong>📅 Información de Factura</strong>
            Fecha: ${fecha}<br>
            Forma de Pago: ${ventaData.forma_pago === 'credito' ? 'Crédito' : 'Contado'}<br>
            Método de Pago: ${ventaData.metodo_pago || 'Efectivo'}<br>
            ${ventaData.vendedor ? `Vendedor: ${currentUsuario.nombre} ${currentUsuario.apellido}` : ''}
        </div>
        <div class="info-box">
            <strong>👤 Datos del Cliente</strong>
            ${ventaData.cliente.razon_social || `${ventaData.cliente.nombre} ${ventaData.cliente.apellido || ''}`}<br>
            ${ventaData.cliente.tipo_documento}: ${ventaData.cliente.numero_documento}<br>
            ${ventaData.cliente.direccion ? `${ventaData.cliente.direccion}<br>` : ''}
            ${ventaData.cliente.telefono || ventaData.cliente.celular || ''}
        </div>
    </div>
    
    <table>
        <thead><tr><th>#</th><th>Descripción</th><th class="text-right">Cant.</th><th class="text-right">Precio</th><th class="text-right">Total</th></tr></thead>
        <tbody>
            ${ventaData.productos.map((p, i) => `<tr><td>${i + 1}</td><td>${p.nombre}</td><td class="text-right">${p.cantidad}</td><td class="text-right">$${formatearNumero(p.precio_unitario)}</td><td class="text-right">$${formatearNumero(p.subtotal)}</td></tr>`).join('')}
        </tbody>
    </table>
    
    <div style="display: flex; justify-content: flex-end;">
        <table style="width: 250px; border: none;">
            <tr style="border: none;"><td style="border: none; padding: 4px 8px;">Subtotal:</td><td class="text-right" style="border: none; padding: 4px 8px;">$${formatearNumero(subtotal)}</td></tr>
            ${descuento > 0 ? `<tr style="border: none;"><td style="border: none; padding: 4px 8px;">Descuento:</td><td class="text-right" style="border: none; padding: 4px 8px;">-$${formatearNumero(descuento)}</td></tr>` : ''}
            <tr style="border: none;"><td style="border: none; padding: 4px 8px;">IVA (19%):</td><td class="text-right" style="border: none; padding: 4px 8px;">$${formatearNumero(impuesto)}</td></tr>
            <tr class="total-final"><td style="padding: 8px;">TOTAL:</td><td class="text-right" style="padding: 8px;">$${formatearNumero(total)}</td></tr>
        </table>
    </div>
    
    <!-- Footer: CUFE y QR Code -->
    ${config.mostrarCUFE && venta.cufe ? `
    <div style="margin-top: 10px; padding: 10px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; font-size: 7pt;">
        <strong style="color: ${config.colorPrimario};">CUFE (Código Único de Factura Electrónica):</strong><br>
        <span style="font-family: monospace; word-break: break-all; color: #334155;">${venta.cufe}</span>
    </div>` : ''}
    
    <div style="display: flex; align-items: center; gap: 15px; margin-top: 10px; padding: 10px 0; border-top: 2px solid #e2e8f0;">
        ${config.mostrarQR && venta.qr_code ? `
        <div style="text-align: center;">
            <img src="${venta.qr_code}" style="width: 100px; height: 100px; border: 2px solid #e2e8f0; border-radius: 8px; padding: 5px; background: white;">
            <p style="font-size: 7pt; color: #64748b; margin: 5px 0 0 0;">Escanea para verificar</p>
        </div>` : ''}
        <div style="flex: 1; font-size: 8pt; color: #475569;">
            <p style="margin: 0 0 5px 0;"><strong style="color: ${config.colorPrimario};">¡Gracias por su compra!</strong></p>
            <p style="margin: 0; line-height: 1.4;">Esta factura electrónica ha sido generada de acuerdo con la normativa DIAN vigente.</p>
            ${currentEmpresa.descripcion ? `<p style="margin: 5px 0 0 0; font-style: italic; color: #64748b;">${currentEmpresa.descripcion}</p>` : ''}
        </div>
    </div>
    
    <script>window.onload = function() { setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 100); }, 250); };</script>
</body>
</html>`;
}

// PLANTILLA 3: MINIMALISTA
function generarPlantillaMinimalistaCarta(venta, ventaData, config, fecha, nitCompleto, subtotal, descuento, impuesto, total, numeroFactura) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Factura_${numeroFactura}</title>
    <style>
        @page { size: letter; margin: 15mm; }
        body { font-family: ${config.fuente}, sans-serif; font-size: 10pt; color: #000; padding: 8mm; }
        .encabezado { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e0e0e0; }
        .encabezado h2 { color: ${config.colorPrimario}; margin: 0 0 8px 0; font-size: 20pt; font-weight: 300; }
        .titulo-factura { font-size: 9pt; font-weight: 300; margin: 12px 0; padding: 10px 0; border-top: 2px solid ${config.colorPrimario}; border-bottom: 1px solid ${config.colorPrimario}; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 9pt; }
        th { background-color: ${config.colorPrimario}15; padding: 8px; text-align: left; border-bottom: 2px solid ${config.colorPrimario}; }
        td { padding: 6px; border-bottom: 1px solid #f0f0f0; }
        .text-right { text-align: right; }
        .total-final { font-size: 11pt; font-weight: bold; background-color: ${config.colorPrimario}; color: white; }
    </style>
</head>
<body>
    <div class="encabezado">
        <h2>${currentEmpresa.nombre}</h2>
        <p style="margin: 2px 0; font-size: 8pt; color: #999;">${currentEmpresa.razon_social}</p>
        <p style="margin: 2px 0; font-size: 8pt; color: #999;">NIT: ${nitCompleto}</p>
    </div>
    
    <div class="titulo-factura"><strong>FACTURA</strong> ${numeroFactura}</div>
    
    <div style="display: flex; gap: 15px; margin: 15px 0;">
        <div style="flex: 1; border: 1px solid #ddd; padding: 10px; border-radius: 5px;"><strong>Fecha:</strong><br>${fecha}</div>
        <div style="flex: 2; border: 1px solid #ddd; padding: 10px; border-radius: 5px;"><strong>Cliente:</strong><br>${ventaData.cliente.razon_social || `${ventaData.cliente.nombre} ${ventaData.cliente.apellido || ''}`}<br>${ventaData.cliente.tipo_documento}: ${ventaData.cliente.numero_documento}</div>
    </div>
    
    <table>
        <thead><tr><th>#</th><th>Descripción</th><th class="text-right">Cant.</th><th class="text-right">Precio</th><th class="text-right">Total</th></tr></thead>
        <tbody>
            ${ventaData.productos.map((p, i) => `<tr><td>${i + 1}</td><td>${p.nombre}</td><td class="text-right">${p.cantidad}</td><td class="text-right">$${formatearNumero(p.precio_unitario)}</td><td class="text-right">$${formatearNumero(p.subtotal)}</td></tr>`).join('')}
        </tbody>
    </table>
    
    <div style="display: flex; justify-content: flex-end;">
        <table style="width: 250px; border: none;">
            <tr><td style="border: none; border-bottom: 1px solid #ddd; padding: 5px;">Subtotal:</td><td class="text-right" style="border: none; border-bottom: 1px solid #ddd; padding: 5px;">$${formatearNumero(subtotal)}</td></tr>
            ${descuento > 0 ? `<tr><td style="border: none; border-bottom: 1px solid #ddd; padding: 5px;">Descuento:</td><td class="text-right" style="border: none; border-bottom: 1px solid #ddd; padding: 5px;">-$${formatearNumero(descuento)}</td></tr>` : ''}
            <tr><td style="border: none; border-bottom: 1px solid #ddd; padding: 5px;">IVA (19%):</td><td class="text-right" style="border: none; border-bottom: 1px solid #ddd; padding: 5px;">$${formatearNumero(impuesto)}</td></tr>
            <tr class="total-final"><td style="padding: 8px;">TOTAL:</td><td class="text-right" style="padding: 8px;">$${formatearNumero(total)}</td></tr>
        </table>
    </div>
    
    ${config.mostrarCUFE && venta.cufe ? `<div style="margin-top: 5mm; padding: 3mm; background: #f8f9fa; font-size: 7pt;"><strong>CUFE:</strong> ${venta.cufe}</div>` : ''}
    ${config.mostrarQR && venta.qr_code ? `<div style="text-align: center; margin-top: 3mm;"><img src="${venta.qr_code}" style="width: 80px; height: 80px;"></div>` : ''}
    
    <script>window.onload = function() { setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 100); }, 250); };</script>
</body>
</html>`;
}

// PLANTILLA 4: CORPORATIVA (Premium)
function generarPlantillaCorporativaCarta(venta, ventaData, config, fecha, nitCompleto, subtotal, descuento, impuesto, total, numeroFactura) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Factura_${numeroFactura}</title>
    <style>
        @page { size: letter; margin: 15mm; }
        body { font-family: Georgia, 'Times New Roman', serif; font-size: 10pt; color: #000; padding: 8mm; }
        .header-band { background: linear-gradient(135deg, ${config.colorPrimario} 0%, ${config.colorSecundario} 100%); padding: 15px 20px; color: white; margin: -8mm -8mm 5mm -8mm; }
        .header-band h1 { margin: 0; font-size: 18pt; font-weight: 300; }
        .header-band .subtitle { font-size: 9pt; opacity: 0.9; margin-top: 3px; }
        .titulo-factura { text-align: center; font-size: 9pt; font-weight: bold; margin: 10px 0; padding: 6px; background: ${config.colorPrimario}10; border-left: 4px solid ${config.colorPrimario}; }
        .info-boxes { display: flex; gap: 3mm; margin: 4mm 0; }
        .info-box { flex: 1; border: 1px solid #ddd; padding: 3mm; font-size: 9pt; }
        .info-box strong { color: ${config.colorPrimario}; }
        table { width: 100%; border-collapse: collapse; margin: 4mm 0; font-size: 9pt; }
        th { background-color: ${config.colorPrimario}20; border: 1px solid #ddd; padding: 2mm; text-align: left; }
        td { border: 1px solid #ddd; padding: 2mm; }
        .text-right { text-align: right; }
        .total-final { font-size: 11pt; font-weight: bold; background-color: ${config.colorPrimario}; color: white; }
    </style>
</head>
<body>
    <div class="header-band">
        <h1>${currentEmpresa.nombre}</h1>
        <div class="subtitle">${currentEmpresa.razon_social} | NIT: ${nitCompleto}</div>
        <div class="subtitle">${currentEmpresa.telefono || ''} | ${currentEmpresa.email || ''}</div>
    </div>
    
    <div class="titulo-factura">FACTURA ${numeroFactura}</div>
    
    <div class="info-boxes">
        <div class="info-box"><strong>Fecha:</strong><br>${fecha}</div>
        <div class="info-box"><strong>Cliente:</strong><br>${ventaData.cliente.razon_social || `${ventaData.cliente.nombre} ${ventaData.cliente.apellido || ''}`}<br>${ventaData.cliente.tipo_documento}: ${ventaData.cliente.numero_documento}</div>
    </div>
    
    <table>
        <thead><tr><th>#</th><th>Descripción</th><th class="text-right">Cant.</th><th class="text-right">Precio</th><th class="text-right">Total</th></tr></thead>
        <tbody>
            ${ventaData.productos.map((p, i) => `<tr><td>${i + 1}</td><td>${p.nombre}</td><td class="text-right">${p.cantidad}</td><td class="text-right">$${formatearNumero(p.precio_unitario)}</td><td class="text-right">$${formatearNumero(p.subtotal)}</td></tr>`).join('')}
        </tbody>
    </table>
    
    <div style="display: flex; justify-content: flex-end;">
        <table style="width: 250px;">
            <tr><td>Subtotal:</td><td class="text-right">$${formatearNumero(subtotal)}</td></tr>
            ${descuento > 0 ? `<tr><td>Descuento:</td><td class="text-right">-$${formatearNumero(descuento)}</td></tr>` : ''}
            <tr><td>IVA (19%):</td><td class="text-right">$${formatearNumero(impuesto)}</td></tr>
            <tr class="total-final"><td style="padding: 8px;">TOTAL:</td><td class="text-right" style="padding: 8px;">$${formatearNumero(total)}</td></tr>
        </table>
    </div>
    
    ${config.mostrarCUFE && venta.cufe ? `<div style="margin-top: 5mm; padding: 3mm; background: #f8f9fa; font-size: 7pt;"><strong>CUFE:</strong> ${venta.cufe}</div>` : ''}
    ${config.mostrarQR && venta.qr_code ? `<div style="text-align: center; margin-top: 3mm;"><img src="${venta.qr_code}" style="width: 80px; height: 80px;"></div>` : ''}
    
    <script>window.onload = function() { setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 100); }, 250); };</script>
</body>
</html>`;
}

// PLANTILLA 5: SIIGO STYLE (Premium)
function generarPlantillaSIIGOCarta(venta, ventaData, config, fecha, nitCompleto, subtotal, descuento, impuesto, total, numeroFactura) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Factura_${numeroFactura}</title>
    <style>
        @page { size: letter; margin: 15mm; }
        body { font-family: ${config.fuente}, sans-serif; font-size: 10pt; color: #2d3748; padding: 8mm; background: #f7fafc; }
        .encabezado { background: white; padding: 15px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 15px; display: flex; align-items: center; gap: 15px; }
        .logo-circle { width: 60px; height: 60px; background: ${config.colorPrimario}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 24pt; font-weight: bold; }
        .empresa-info { flex: 1; }
        .empresa-info h2 { margin: 0; font-size: 14pt; color: ${config.colorPrimario}; }
        .empresa-info p { margin: 2px 0; font-size: 8pt; color: #718096; }
        .titulo-factura { background: white; text-align: center; font-size: 9pt; font-weight: 600; padding: 8px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.06); margin: 10px 0; color: ${config.colorPrimario}; }
        .info-cards { display: flex; gap: 10px; margin: 15px 0; }
        .card { flex: 1; background: white; padding: 12px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.07); font-size: 8pt; }
        .card-title { font-weight: bold; color: ${config.colorPrimario}; margin-bottom: 6px; font-size: 9pt; }
        table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 15px 0; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.07); font-size: 9pt; }
        th { background: ${config.colorPrimario}; color: white; padding: 10px 8px; text-align: left; font-weight: 600; }
        td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
        tbody tr:last-child td { border-bottom: none; }
        .text-right { text-align: right; }
        .totales-box { background: white; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.07); padding: 12px; margin-left: auto; width: 300px; margin-top: 10px; }
        .totales-box table { box-shadow: none; margin: 0; }
        .totales-box td { border: none; border-bottom: 1px solid #e2e8f0; padding: 6px 8px; font-size: 9pt; }
        .total-final { font-size: 11pt; font-weight: bold; background: ${config.colorPrimario}; color: white; }
    </style>
</head>
<body>
    <div class="encabezado">
        <div class="logo-circle">${currentEmpresa.nombre.charAt(0)}</div>
        <div class="empresa-info">
            <h2>${currentEmpresa.nombre}</h2>
            <p><strong>${currentEmpresa.razon_social}</strong></p>
            <p>NIT: ${nitCompleto} | ${currentEmpresa.telefono || ''} | ${currentEmpresa.email || ''}</p>
        </div>
    </div>
    
    <div class="titulo-factura">📄 FACTURA ${numeroFactura}</div>
    
    <div class="info-cards">
        <div class="card">
            <div class="card-title">📅 Fecha</div>
            <div>${fecha}</div>
        </div>
        <div class="card">
            <div class="card-title">👤 Cliente</div>
            <div>${ventaData.cliente.razon_social || `${ventaData.cliente.nombre} ${ventaData.cliente.apellido || ''}`}</div>
            <div style="font-size: 7pt; color: #718096;">${ventaData.cliente.tipo_documento}: ${ventaData.cliente.numero_documento}</div>
        </div>
    </div>
    
    <table>
        <thead><tr><th>#</th><th>Descripción</th><th class="text-right">Cant.</th><th class="text-right">Precio</th><th class="text-right">Total</th></tr></thead>
        <tbody>
            ${ventaData.productos.map((p, i) => `<tr><td>${i + 1}</td><td>${p.nombre}</td><td class="text-right">${p.cantidad}</td><td class="text-right">$${formatearNumero(p.precio_unitario)}</td><td class="text-right">$${formatearNumero(p.subtotal)}</td></tr>`).join('')}
        </tbody>
    </table>
    
    <div class="totales-box">
        <table>
            <tr><td>Subtotal:</td><td class="text-right">$${formatearNumero(subtotal)}</td></tr>
            ${descuento > 0 ? `<tr><td>Descuento:</td><td class="text-right">-$${formatearNumero(descuento)}</td></tr>` : ''}
            <tr><td>IVA (19%):</td><td class="text-right">$${formatearNumero(impuesto)}</td></tr>
            <tr class="total-final"><td style="padding: 10px 8px;">💰 TOTAL:</td><td class="text-right" style="padding: 10px 8px;">$${formatearNumero(total)}</td></tr>
        </table>
    </div>
    
    ${config.mostrarCUFE && venta.cufe ? `<div style="margin-top: 10px; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.06); font-size: 7pt;"><strong>CUFE:</strong> ${venta.cufe}</div>` : ''}
    ${config.mostrarQR && venta.qr_code ? `<div style="text-align: center; margin-top: 10px;"><img src="${venta.qr_code}" style="width: 80px; height: 80px; border-radius: 8px;"></div>` : ''}
    
    <script>window.onload = function() { setTimeout(function() { window.print(); setTimeout(function() { window.close(); }, 100); }, 250); };</script>
</body>
</html>`;
}

// FORMATO MEDIA CARTA - Escalado de formato carta
function generarPlantillaMediaCarta(venta, ventaData, config) {
    const numeroFactura = venta.numero_factura;
    const subtotal = ventaData.subtotal;
    const descuento = ventaData.descuento || 0;
    const impuesto = ventaData.impuesto;
    const total = ventaData.total;
    
    const fecha = new Date().toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const digitoVerificacion = calcularDigitoVerificacion(currentEmpresa.nit);
    const nitCompleto = `${currentEmpresa.nit}-${digitoVerificacion}`;
    
    // Usa la misma plantilla que carta pero con estilos adaptados a media carta
    const htmlCarta = config.plantillaId === 2 ? 
        generarPlantillaModernaCarta(venta, ventaData, config, fecha, nitCompleto, subtotal, descuento, impuesto, total, numeroFactura) :
        config.plantillaId === 3 ?
        generarPlantillaMinimalistaCarta(venta, ventaData, config, fecha, nitCompleto, subtotal, descuento, impuesto, total, numeroFactura) :
        generarPlantillaClasicaCarta(venta, ventaData, config, fecha, nitCompleto, subtotal, descuento, impuesto, total, numeroFactura);
    
    // Ajustar estilos para media carta (5.5" x 8.5")
    return htmlCarta
        .replace('size: letter;', 'size: 5.5in 8.5in;')
        .replace('margin: 15mm;', 'margin: 8mm;')
        .replace('font-size: 10pt;', 'font-size: 8pt;')
        .replace('font-size: 16pt;', 'font-size: 12pt;')
        .replace('font-size: 13pt;', 'font-size: 10pt;')
        .replace('font-size: 11pt;', 'font-size: 9pt;')
        .replace(/padding: 8mm;/g, 'padding: 5mm;')
        .replace(/padding: 12px;/g, 'padding: 8px;');
}

// FORMATO TIRILLA (mantiene formato térmico estándar - sin plantillas personalizadas)
function generarPlantillaTirilla(venta, ventaData, config) {
    const numeroFactura = venta.numero_factura;
    
    const subtotal = ventaData.subtotal;
    const descuento = ventaData.descuento || 0;
    const impuesto = ventaData.impuesto;
    const total = ventaData.total;
    
    const fecha = new Date().toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    // FORMATO TÉRMICO (58mm o 80mm)
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Factura_${numeroFactura}</title>
    <style>
    <title>Factura_${numeroFactura}</title>
    <style>
        @page {
            size: 58mm auto;
            margin: 2mm;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Courier New', monospace;
            font-size: 9pt;
            width: 58mm;
            padding: 2mm;
            background: white;
            color: black;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { 
            border-top: 1px dashed #000; 
            margin: 3mm 0;
        }
        .item {
            margin: 2mm 0;
            font-size: 8pt;
        }
        .item-name { 
            font-weight: bold;
        }
        .item-details {
            display: flex;
            justify-content: space-between;
            font-size: 8pt;
        }
        .totals {
            margin-top: 3mm;
            font-size: 9pt;
        }
        .totals-row {
            display: flex;
            justify-content: space-between;
            margin: 1mm 0;
        }
        .total-final {
            font-size: 11pt;
            font-weight: bold;
            margin-top: 2mm;
        }
        @media print {
            body { padding: 0; }
        }
    </style>
</head>
<body>
    <div class="center bold" style="font-size: 11pt;">${currentEmpresa.nombre}</div>
    <div class="center" style="font-size: 8pt;">${currentEmpresa.razon_social}</div>
    <div class="center" style="font-size: 8pt;">NIT: ${currentEmpresa.nit}</div>
    <div class="center" style="font-size: 8pt;">${currentEmpresa.telefono || ''}</div>
    
    <div class="line"></div>
    
    <div class="center bold" style="font-size: 10pt;">FACTURA DE VENTA</div>
    <div class="center bold" style="font-size: 10pt;">${numeroFactura}</div>
    <div class="center" style="font-size: 8pt;">${fecha}</div>
    
    <div class="line"></div>
    
    <div style="font-size: 8pt;">
        <div><strong>Cliente:</strong></div>
        <div>${ventaData.cliente.razon_social || `${ventaData.cliente.nombre} ${ventaData.cliente.apellido || ''}`}</div>
        <div>${ventaData.cliente.tipo_documento}: ${ventaData.cliente.numero_documento}</div>
    </div>
    
    <div class="line"></div>
    
    ${ventaData.productos.map(p => `
        <div class="item">
            <div class="item-name">${p.nombre}</div>
            <div class="item-details">
                <span>${p.cantidad} x $${formatearNumero(p.precio_unitario)}</span>
                <span>$${formatearNumero(p.subtotal)}</span>
            </div>
        </div>
    `).join('')}
    
    <div class="line"></div>
    
    <div class="totals">
        <div class="totals-row">
            <span>Subtotal:</span>
            <span>$${formatearNumero(subtotal)}</span>
        </div>
        ${descuento > 0 ? `
        <div class="totals-row">
            <span>Descuento:</span>
            <span>-$${formatearNumero(descuento)}</span>
        </div>
        ` : ''}
        <div class="totals-row">
            <span>IVA (19%):</span>
            <span>$${formatearNumero(impuesto)}</span>
        </div>
        ${ventaData.propina_habilitada ? `
        <div class="line"></div>
        <div class="totals-row">
            <span>Total Factura:</span>
            <span>$${formatearNumero(total - (ventaData.propina_valor || 0))}</span>
        </div>
        <div class="totals-row" style="font-size: 10pt; color: #28a745;">
            <span>🎉 Propina ${ventaData.propina_porcentaje}%:</span>
            <span>$${formatearNumero(ventaData.propina_valor || 0)}</span>
        </div>
        ` : ''}
        <div class="totals-row total-final">
            <span>TOTAL:</span>
            <span>$${formatearNumero(total)}</span>
        </div>
    </div>
    
    <div class="line"></div>
    
    ${ventaData.pagos && ventaData.pagos.length > 0 ? `
    <div style="font-size: 8pt;">
        <div class="bold">FORMA DE PAGO:</div>
        ${ventaData.pagos.map(pago => {
            const nombres = {
                'efectivo': 'Efectivo',
                'tarjeta_debito': 'T. Débito',
                'tarjeta_credito': 'T. Crédito',
                'transferencia': 'Transferencia',
                'nequi': 'Nequi',
                'daviplata': 'Daviplata',
                'cheque': 'Cheque'
            };
            return `<div class="totals-row">
                <span>${nombres[pago.metodo_pago] || pago.metodo_pago}:</span>
                <span>$${formatearNumero(pago.monto)}</span>
            </div>`;
        }).join('')}
    </div>
    <div class="line"></div>
    ` : ''}
    
    <div class="center" style="font-size: 8pt; margin-top: 3mm;">
        ¡Gracias por su compra!
    </div>
    <div class="center" style="font-size: 7pt;">Vendedor: ${currentUsuario.nombre} ${currentUsuario.apellido}</div>
    
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 100);
            }, 250);
        };
    </script>
</body>
</html>
    `;
}

// ============================================
// FUNCIONES PARA VENTA SIN STOCK (CONTRA PEDIDO)
// ============================================

let productoSinStockActual = null;
let indexProductoSinStock = -1;

/**
 * Modal de stock insuficiente en bodega del cajero
 */
async function consultarDisponibilidadOtrasBodegas(productoId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/productos/${productoId}/disponibilidad-bodegas?empresa_id=${currentEmpresa.id}`,
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );
        
        if (response.status === 401) {
            handleUnauthorized();
            return [];
        }
        
        const data = await response.json();
        return data.success ? data.data : [];
    } catch (error) {
        console.error('Error consultando disponibilidad:', error);
        return [];
    }
}

/**
 * Mostrar modal con disponibilidad en otras bodegas
 */
async function mostrarStockOtrasBodegas(producto, stockActual = 0) {
    const disponibilidad = await consultarDisponibilidadOtrasBodegas(producto.id);
    mostrarModalStockInsuficienteBodega(producto, stockActual, disponibilidad);
}

/**
 * Modal de stock insuficiente en bodega del cajero
 */
function mostrarModalStockInsuficienteBodega(producto, stockEnTienda, disponibilidadOtrasBodegas) {
    document.getElementById('msgStockBodegaProducto').innerHTML =
        `<strong>${producto.nombre}</strong><br>
        <small class="text-muted">Stock en esta ubicación: <span class="text-danger fw-bold">${stockEnTienda}</span></small><br>
        <small class="text-warning">⚠ Producto sin stock disponible en esta tienda. Contacte con administración para habilitar ventas sin stock.</small>`;

    const bodegasConStock = disponibilidadOtrasBodegas.filter(b => b.stock_disponible > 0);
    
    let contenido = '';
    if (bodegasConStock.length > 0) {
        contenido = `
            <div class="alert alert-info small mb-2">
                <i class="bi bi-info-circle me-1"></i>
                <strong>Buenas noticias:</strong> Este producto está disponible en otras ubicaciones. 
                Si el cliente puede esperar, se puede solicitar traslado desde una bodega cercana.
            </div>
            <p class="text-muted small mb-2">Disponibilidad en otras ubicaciones:</p>
            <table class="table table-sm table-bordered mb-0">
                <thead class="table-light">
                    <tr>
                        <th>Bodega / Tienda</th>
                        <th class="text-center">Tipo</th>
                        <th class="text-center">Disponible</th>
                    </tr>
                </thead>
                <tbody>
                    ${disponibilidadOtrasBodegas.map(b => `
                        <tr class="${b.stock_disponible > 0 ? 'table-success' : ''}">
                            <td>${b.bodega_nombre}</td>
                            <td class="text-center"><span class="badge bg-secondary">${b.bodega_tipo}</span></td>
                            <td class="text-center fw-bold ${b.stock_disponible > 0 ? 'text-success' : 'text-muted'}">${b.stock_disponible}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
    } else {
        contenido = `
            <div class="alert alert-danger small mb-0">
                <i class="bi bi-x-circle me-1"></i>
                <strong>No hay stock disponible</strong> en ninguna bodega de la empresa en este momento.
            </div>`;
    }

    document.getElementById('tablaDisponibilidadBodegas').innerHTML = contenido;

    new bootstrap.Modal(document.getElementById('modalStockInsuficienteBodega')).show();
}

/**
 * Mostrar modal para confirmar venta sin stock
 */
function mostrarModalVentaSinStock(producto, index) {
    productoSinStockActual = producto;
    indexProductoSinStock = index;
    
    const stockDisponible = producto.stock_actual || 0;
    const cantidadActual = index >= 0 ? productosVenta[index].cantidad : 0;
    const cantidadFaltante = index >= 0 ? (cantidadActual + 1 - stockDisponible) : 1;
    
    const mensaje = `
        <strong>${producto.nombre}</strong><br>
        <small class="text-muted">SKU: ${producto.sku}</small><br><br>
        Stock disponible: <strong>${stockDisponible}</strong><br>
        Cantidad solicitada: <strong>${index >= 0 ? cantidadActual + 1 : 1}</strong><br>
        Faltante: <strong class="text-danger">${cantidadFaltante}</strong>
    `;
    
    document.getElementById('mensajeStockInsuficiente').innerHTML = mensaje;
    
    // Establecer fecha mínima como mañana
    const mañana = new Date();
    mañana.setDate(mañana.getDate() + 1);
    const fechaMin = mañana.toISOString().split('T')[0];
    document.getElementById('fechaEntregaEstimada').setAttribute('min', fechaMin);
    document.getElementById('fechaEntregaEstimada').value = fechaMin;
    
    // Limpiar notas
    document.getElementById('notasEntrega').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('modalVentaSinStock'));
    modal.show();
}

/**
 * Confirmar venta contra pedido
 */
document.getElementById('btnConfirmarContraPedido').addEventListener('click', function() {
    const fechaEntrega = document.getElementById('fechaEntregaEstimada').value;
    const notasEntrega = document.getElementById('notasEntrega').value;
    
    if (!fechaEntrega) {
        mostrarAlerta('Debe indicar una fecha estimada de entrega', 'warning');
        return;
    }
    
    const producto = productoSinStockActual;
    const precioUnitario = parseFloat(producto.precio_venta || producto.precio_minorista);
    
    if (indexProductoSinStock >= 0) {
        // Incrementar cantidad de producto existente
        productosVenta[indexProductoSinStock].cantidad++;
        productosVenta[indexProductoSinStock].subtotal = productosVenta[indexProductoSinStock].cantidad * precioUnitario;
        productosVenta[indexProductoSinStock].tipo_venta = 'contra_pedido';
        productosVenta[indexProductoSinStock].estado_entrega = 'pendiente';
        productosVenta[indexProductoSinStock].fecha_entrega_estimada = fechaEntrega;
        productosVenta[indexProductoSinStock].notas_entrega = notasEntrega;
    } else {
        // Agregar nuevo producto contra pedido
        productosVenta.push({
            id: producto.id,
            nombre: producto.nombre,
            sku: producto.sku,
            precio_unitario: precioUnitario,
            precio_minorista: producto.precio_minorista || precioUnitario,
            precio_mayorista: producto.precio_mayorista || null,
            precio_distribuidor: producto.precio_distribuidor || null,
            precio_minimo: producto.precio_minimo || null,
            precio_maximo: producto.precio_maximo || null,
            cantidad: 1,
            stock_disponible: producto.stock_actual || 0,
            subtotal: precioUnitario,
            tipo_venta: 'contra_pedido',
            estado_entrega: 'pendiente',
            fecha_entrega_estimada: fechaEntrega,
            notas_entrega: notasEntrega
        });
    }
    
    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalVentaSinStock'));
    modal.hide();
    
    // Limpiar búsqueda
    document.getElementById('buscarProducto').value = '';
    document.getElementById('resultadosProducto').style.display = 'none';
    
    // Actualizar vista
    renderizarProductos();
    calcularTotales();
    
    mostrarAlerta(`Producto agregado como venta contra pedido. Entrega estimada: ${formatearFecha(fechaEntrega)}`, 'success');
});

/**
 * Formatear fecha para mostrar
 */
function formatearFecha(fecha) {
    const date = new Date(fecha + 'T00:00:00');
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-ES', opciones);
}

/**
 * Formatear fecha y hora para mostrar en cuentas abiertas
 */
function formatearFechaHora(fechaHora) {
    const date = new Date(fechaHora);
    const hoy = new Date();
    const esHoy = date.toDateString() === hoy.toDateString();
    
    const hora = date.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    if (esHoy) {
        return `Hoy ${hora}`;
    } else {
        const fecha = date.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: '2-digit' 
        });
        return `${fecha} ${hora}`;
    }
}

// ============================================
// FUNCIONES PARA IMPUESTOS ADICIONALES
// ============================================

/**
 * Cargar impuestos activos de la empresa
 */
async function cargarImpuestosActivos() {
    try {
        const empresaId = currentEmpresa?.id;
        console.log('📋 cargarImpuestosActivos - empresaId:', empresaId);
        if (!empresaId) {
            console.warn('⚠️ No hay empresaId para cargar impuestos');
            return;
        }

        const url = `${API_URL}/impuestos/activos?empresaId=${empresaId}`;
        console.log('📡 Fetching impuestos:', url);
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        console.log('📡 Response impuestos status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
            console.error('❌ Error del backend (impuestos):', errorData);
            if (response.status === 401) {
                console.warn('⚠️ Token inválido al cargar impuestos - puede necesitar refrescar la página');
            }
            // NO cerrar sesión aquí - solo fallar silenciosamente
            return;
        }
        
        const data = await response.json();
        impuestosDisponibles = data.data || [];
        
        if (impuestosDisponibles.length > 0) {
            // Mostrar contenedor de impuestos
            document.getElementById('impuestosAdicionalesContainer').style.display = 'block';
            
            // NO cargar impuestos automáticos - el vendedor debe seleccionarlos manualmente
            impuestosSeleccionados = [];
            
            // Renderizar lista
            renderizarImpuestosDisponibles();
            
            // Actualizar contador
            document.getElementById('impuestosCount').textContent = 0;
        }
    } catch (error) {
        console.error('Error al cargar impuestos:', error);
    }
}

/**
 * Renderizar lista de impuestos disponibles
 */
function renderizarImpuestosDisponibles() {
    const lista = document.getElementById('listaImpuestosDisponibles');
    if (!lista) return;

    lista.innerHTML = impuestosDisponibles.map(imp => {
        const isSelected = impuestosSeleccionados.includes(imp.id);
        const isAutomatic = imp.aplica_automaticamente;
        const tasaTexto = imp.tipo === 'porcentaje' ? `${imp.tasa}%` : `$${formatearNumero(imp.tasa)}`;
        
        return `
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" 
                       id="impuesto_${imp.id}" 
                       value="${imp.id}"
                       ${isSelected ? 'checked' : ''}
                       onchange="toggleImpuesto(${imp.id})">
                <label class="form-check-label d-flex justify-content-between" for="impuesto_${imp.id}">
                    <span>
                        ${imp.nombre}
                        ${isAutomatic ? '<span class="badge bg-info ms-1" style="font-size: 0.65rem;">Auto</span>' : ''}
                        ${imp.afecta_total === 'resta' ? '<span class="badge bg-warning ms-1" style="font-size: 0.65rem;">Resta</span>' : ''}
                    </span>
                    <span class="text-muted">${tasaTexto}</span>
                </label>
            </div>
        `;
    }).join('');
}

/**
 * Toggle selección de impuesto
 */
function toggleImpuesto(impuestoId) {
    const index = impuestosSeleccionados.indexOf(impuestoId);
    if (index > -1) {
        impuestosSeleccionados.splice(index, 1);
    } else {
        impuestosSeleccionados.push(impuestoId);
    }
    
    // Actualizar contador
    document.getElementById('impuestosCount').textContent = impuestosSeleccionados.length;
    
    // Recalcular totales
    calcularTotales();
}

// ============================================
// CATÁLOGO DE PRODUCTOS
// ============================================

/**
 * Cargar catálogo completo de productos
 */
async function cargarCatalogoProductos() {
    console.log('📦 cargarCatalogoProductos - currentEmpresa:', currentEmpresa);
    if (!currentEmpresa) {
        console.warn('⚠️ No hay currentEmpresa para cargar catálogo');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const url = `${API_URL}/productos?empresaId=${currentEmpresa.id}&estado=activo`;
        console.log('📡 Fetching catálogo:', url);
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('📡 Response catálogo status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
            console.error('❌ Error del backend (catálogo):', errorData);
            if (response.status === 401) {
                console.warn('⚠️ Token inválido al cargar catálogo - puede necesitar refrescar la página');
            }
            // NO cerrar sesión aquí - solo fallar silenciosamente
            return;
        }

        const data = await response.json();
        todosCatalogo = data.data || [];
        
        // Guardar stock original para poder restaurarlo
        todosCatalogo.forEach(p => {
            p.stock_original = p.stock_actual;
        });
        
        // Extraer categorías únicas
        categoriasCatalogo = [...new Set(todosCatalogo.map(p => p.categoria_nombre).filter(Boolean))];
        
        renderizarCategoriasFilter();
        renderizarCatalogo();

    } catch (error) {
        console.error('Error al cargar catálogo:', error);
        document.getElementById('gridProductos').innerHTML = `
            <div class="col-12 text-center text-danger py-4">
                <i class="bi bi-exclamation-triangle display-4"></i>
                <p class="mt-2">Error al cargar el catálogo</p>
            </div>
        `;
    }
}

/**
 * Renderizar filtros de categorías
 */
function renderizarCategoriasFilter() {
    const container = document.getElementById('categoriasFiltros');
    if (!container) return;
    
    const btnTodos = `
        <button class="btn btn-sm ${categoriaFiltroActual === null ? 'btn-primary' : 'btn-outline-secondary'}" 
                onclick="filtrarPorCategoria(null)">
            <i class="bi bi-star me-1"></i>Todos (${todosCatalogo.length})
        </button>
    `;
    
    const btnsCategorias = categoriasCatalogo.map(cat => {
        const count = todosCatalogo.filter(p => p.categoria_nombre === cat).length;
        return `
            <button class="btn btn-sm ${categoriaFiltroActual === cat ? 'btn-primary' : 'btn-outline-secondary'}" 
                    onclick="filtrarPorCategoria('${cat.replace(/'/g, "\\'")}')">
                ${cat} (${count})
            </button>
        `;
    }).join('');
    
    container.innerHTML = btnTodos + btnsCategorias;
}

/**
 * Filtrar productos por categoría
 */
function filtrarPorCategoria(categoria) {
    categoriaFiltroActual = categoria;
    renderizarCategoriasFilter();
    renderizarCatalogo();
}

/**
 * Cambiar vista del catálogo (grid/list)
 */
function cambiarVistaProductos(vista) {
    vistaActual = vista;
    
    // Actualizar botones
    document.querySelectorAll('#catalogoProductos .btn-group button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('button').classList.add('active');
    
    renderizarCatalogo();
}

/**
 * Renderizar catálogo de productos
 */
function renderizarCatalogo() {
    const container = document.getElementById('gridProductos');
    if (!container) return;
    
    // Filtrar productos
    let productosFiltrados = todosCatalogo;
    if (categoriaFiltroActual) {
        productosFiltrados = todosCatalogo.filter(p => p.categoria_nombre === categoriaFiltroActual);
    }
    
    if (productosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center text-muted py-4">
                <i class="bi bi-inbox display-4"></i>
                <p class="mt-2">No hay productos en esta categoría</p>
            </div>
        `;
        return;
    }
    
    if (vistaActual === 'grid') {
        renderizarCatalogoGrid(productosFiltrados, container);
    } else {
        renderizarCatalogoList(productosFiltrados, container);
    }
}

/**
 * Renderizar catálogo en vista Grid
 */
function renderizarCatalogoGrid(productos, container) {
    container.innerHTML = productos.map(p => {
        const stockClass = p.stock_actual > 10 ? 'stock-alto' : 
                          p.stock_actual > 5 ? 'stock-medio' : 
                          p.stock_actual > 0 ? 'stock-bajo' : 'stock-sin';
        
        const stockText = p.stock_actual > 0 ? p.stock_actual : 'Sin stock';
        
        return `
            <div class="col-6 col-md-4 col-lg-3">
                <div class="producto-card" 
                     onclick="seleccionarProductoCatalogo(${p.id})"
                     ondblclick="agregarProductoDesdeCatalogo(${p.id})"
                     data-producto-id="${p.id}">
                    <span class="stock-badge ${stockClass}">${stockText}</span>
                    ${p.imagen_url ? 
                        `<img src="${p.imagen_url}" class="producto-card-img mb-2" alt="${p.nombre}">` :
                        `<div class="producto-card-img-placeholder mb-2">
                            <i class="bi bi-box-seam"></i>
                         </div>`
                    }
                    <div class="mb-1">
                        <strong class="d-block text-truncate" style="font-size: 0.9rem;">${p.nombre}</strong>
                        <small class="text-muted">SKU: ${p.sku}</small>
                        ${p.aplica_iva ? '<span class="badge bg-info text-white ms-1" style="font-size: 0.65rem;">IVA</span>' : ''}
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <strong class="text-success" style="font-size: 1.1rem;">$${formatearNumero(p.precio_minorista)}</strong>
                        <button class="btn btn-sm btn-success" 
                                onclick="event.stopPropagation(); agregarProductoDesdeCatalogo(${p.id});"
                                title="Agregar producto">
                            <i class="bi bi-plus-lg"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Agregar listener para tecla Enter
    agregarListenerTeclado();
}

/**
 * Renderizar catálogo en vista List
 */
function renderizarCatalogoList(productos, container) {
    container.innerHTML = `
        <div class="col-12">
            ${productos.map(p => {
                const stockClass = p.stock_actual > 10 ? 'stock-alto' : 
                                  p.stock_actual > 5 ? 'stock-medio' : 
                                  p.stock_actual > 0 ? 'stock-bajo' : 'stock-sin';
                
                const stockText = p.stock_actual > 0 ? p.stock_actual : 'Sin stock';
                
                return `
                    <div class="producto-card-list" 
                         onclick="seleccionarProductoCatalogo(${p.id})"
                         ondblclick="agregarProductoDesdeCatalogo(${p.id})"
                         data-producto-id="${p.id}">
                        ${p.imagen_url ? 
                            `<img src="${p.imagen_url}" class="rounded me-3" style="width: 60px; height: 60px; object-fit: cover;" alt="${p.nombre}">` :
                            `<div class="rounded me-3" style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white;">
                                <i class="bi bi-box-seam" style="font-size: 1.5rem;"></i>
                             </div>`
                        }
                        <div class="flex-grow-1">
                            <strong>${p.nombre}</strong>
                            ${p.aplica_iva ? '<span class="badge bg-info text-white ms-2">IVA</span>' : ''}
                            <br>
                            <small class="text-muted">SKU: ${p.sku}</small>
                        </div>
                        <div class="text-center me-3">
                            <span class="badge ${stockClass}">${stockText}</span>
                        </div>
                        <div class="text-end me-2">
                            <strong class="text-success" style="font-size: 1.2rem;">$${formatearNumero(p.precio_minorista)}</strong>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-success" 
                                    onclick="event.stopPropagation(); agregarProductoDesdeCatalogo(${p.id});"
                                    title="Agregar producto">
                                <i class="bi bi-plus-lg"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    // Agregar listener para tecla Enter
    agregarListenerTeclado();
}

/**
 * Actualizar el stock mostrado en el catálogo basado en los productos en venta actual
 * Solo afecta la vista, no modifica los datos reales del backend
 */
function actualizarStockEnCatalogo() {
    console.log('🔄 Actualizando stock en catálogo...');
    console.log('   Modo edición cuenta:', modoEdicionCuenta);
    
    // Si no hay catálogo cargado, salir
    if (!todosCatalogo || todosCatalogo.length === 0) {
        console.log('⚠️ No hay catálogo para actualizar');
        return;
    }
    
    // Si estamos en modo edición de cuenta abierta, NO restar visualmente
    // porque los productos ya están descontados en la BD
    if (modoEdicionCuenta) {
        console.log('ℹ️ Modo edición de cuenta: no se resta stock visualmente (ya está en BD)');
        renderizarCatalogo();
        return;
    }
    
    // SOLO en venta directa: mostrar "stock virtual" restando productos pendientes
    // Restaurar stock original de todos los productos
    todosCatalogo.forEach(p => {
        if (p.stock_original !== undefined) {
            p.stock_actual = p.stock_original;
        }
    });
    
    // Restar del stock visual la cantidad en la venta actual
    productosVenta.forEach(pv => {
        // Buscar el producto en el catálogo (puede ser por id o producto_id)
        const productoCatalogo = todosCatalogo.find(p => 
            p.id === pv.id || p.id === pv.producto_id
        );
        
        if (productoCatalogo && pv.tipo_venta !== 'contra_pedido') {
            // Solo descontar si NO es contra pedido
            productoCatalogo.stock_actual = Math.max(0, productoCatalogo.stock_actual - pv.cantidad);
        }
    });
    
    // Re-renderizar el catálogo con el stock actualizado
    renderizarCatalogo();
    console.log('✅ Stock actualizado en catálogo (venta directa)');
}

/**
 * Seleccionar producto del catálogo
 */
function seleccionarProductoCatalogo(productoId) {
    // Remover selección previa
    document.querySelectorAll('.producto-card, .producto-card-list').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Seleccionar nuevo
    const card = document.querySelector(`[data-producto-id="${productoId}"]`);
    if (card) {
        card.classList.add('selected');
        productoSeleccionadoCatalogo = productoId;
    }
}

/**
 * Agregar producto desde catálogo
 */
function agregarProductoDesdeCatalogo(productoId) {
    console.log('🔵 agregarProductoDesdeCatalogo llamado con ID:', productoId);
    console.log('Stack trace:', new Error().stack);
    const producto = todosCatalogo.find(p => p.id === productoId);
    if (producto) {
        console.log('✅ Producto encontrado:', producto.nombre);
        agregarProducto(producto);
    } else {
        console.error('❌ Producto no encontrado con ID:', productoId);
    }
}

// Variable global para evitar duplicar el listener
let listenerTecladoAgregado = false;

/**
 * Agregar listener para tecla Enter en catálogo (solo una vez)
 */
function agregarListenerTeclado() {
    if (listenerTecladoAgregado) return; // Ya existe, no agregar de nuevo
    
    document.addEventListener('keydown', function(e) {
        // Ignorar si el Enter se presiona dentro de un input, textarea o select
        const elementoActivo = document.activeElement;
        const esInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(elementoActivo.tagName);
        
        if (e.key === 'Enter' && productoSeleccionadoCatalogo && !esInput) {
            agregarProductoDesdeCatalogo(productoSeleccionadoCatalogo);
        }
    });
    
    listenerTecladoAgregado = true; // Marcar como agregado
}
// ============================================
// CLIENTE PÚBLICO GENERAL
// ============================================

/**
 * Seleccionar cliente "Público General" automáticamente
 */
async function seleccionarPublicoGeneral() {
    try {
        // Buscar o crear cliente público general
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/ventas/buscar-cliente?empresaId=${currentEmpresa.id}&tipo=documento&valor=999999999`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!response.ok) {
            if (response.status === 401) {
                mostrarAlerta('Sesión expirada. Por favor refresca la página (F5)', 'warning');
                return;
            }
            throw new Error('Error al buscar cliente');
        }

        const data = await response.json();
        let clientePublico = data.data && data.data.length > 0 ? data.data[0] : null;

        // Si no existe, crearlo
        if (!clientePublico) {
            const createResponse = await fetch(`${API_URL}/clientes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    empresa_id: currentEmpresa.id,
                    tipo_documento: 'CC',
                    numero_documento: '999999999',
                    nombre: 'PÚBLICO',
                    apellido: 'GENERAL',
                    razon_social: 'PÚBLICO GENERAL',
                    email: 'publico@general.com',
                    tipo_cliente: 'ocasional',
                    estado: 'activo'
                })
            });

            if (!createResponse.ok) {
                if (createResponse.status === 401) {
                    mostrarAlerta('Sesión expirada. Por favor refresca la página (F5)', 'warning');
                    return;
                }
                throw new Error('Error al crear cliente público');
            }
            
            const createData = await createResponse.json();
            clientePublico = {
                id: createData.data.id,
                tipo_documento: 'CC',
                numero_documento: '999999999',
                nombre: 'PÚBLICO',
                apellido: 'GENERAL',
                razon_social: 'PÚBLICO GENERAL',
                email: 'publico@general.com'
            };
        }

        seleccionarCliente(clientePublico);
        reproducirSonido('success');
        mostrarAlerta('Cliente "Público General" seleccionado', 'success');

    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al seleccionar público general', 'danger');
    }
}

// ============================================
// CALCULADORA DE VUELTAS
// ============================================

/**
 * Actualizar estado de pago con calculadora de vueltas
 */
function actualizarEstadoPago() {
    const totalPagado = calcularTotalPagado();
    const pendiente = totalVentaActual - totalPagado;
    
    // Actualizar resumen de pagos
    document.getElementById('totalVentaPagos').textContent = `$${formatearNumero(totalVentaActual)}`;
    document.getElementById('totalPagado').textContent = `$${formatearNumero(totalPagado)}`;
    document.getElementById('montoPendiente').textContent = `$${formatearNumero(pendiente)}`;
    
    // Mostrar/ocultar calculadora de vueltas
    const calculadoraVueltas = document.getElementById('calculadoraVueltas');
    const alertaPendiente = document.getElementById('alertaPendiente');
    
    if (totalPagado > totalVentaActual) {
        // Hay vueltas
        const vueltas = totalPagado - totalVentaActual;
        calculadoraVueltas.style.display = 'block';
        alertaPendiente.style.display = 'none';
        document.getElementById('montoVueltas').textContent = `$${formatearNumero(vueltas)}`;
        reproducirSonido('vueltas');
    } else if (pendiente > 0.01) {
        // Falta por pagar
        calculadoraVueltas.style.display = 'none';
        alertaPendiente.style.display = 'block';
    } else {
        // Pagado exacto
        calculadoraVueltas.style.display = 'none';
        alertaPendiente.style.display = 'none';
    }
    
    // Habilitar/deshabilitar botones de acción
    const btnGuardar = document.getElementById('btnGuardarVenta');
    const btnAbrirCuenta = document.getElementById('btnAbrirCuenta');
    const pagoCompleto = Math.abs(pendiente) < 0.01 || totalPagado >= totalVentaActual;
    const tieneCliente = !!clienteSeleccionado;
    const tieneProductos = productosVenta.length > 0;
    
    // Guardar Venta requiere: cliente, productos y pago completo
    btnGuardar.disabled = !tieneCliente || !tieneProductos || !pagoCompleto;
    
    // Abrir Cuenta solo requiere: productos (el cliente es opcional)
    if (btnAbrirCuenta) {
        btnAbrirCuenta.disabled = !tieneProductos;
    }
}

// ============================================
// SONIDOS DE FEEDBACK
// ============================================

/**
 * Reproducir sonido de feedback
 */
function reproducirSonido(tipo) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch(tipo) {
        case 'success':
            oscillator.frequency.value = 800;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
            break;
        case 'add':
            oscillator.frequency.value = 600;
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.05);
            break;
        case 'error':
            oscillator.frequency.value = 200;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
            break;
        case 'vueltas':
            oscillator.frequency.value = 1000;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            oscillator.start();
            setTimeout(() => {
                oscillator.frequency.value = 1200;
            }, 100);
            oscillator.stop(audioContext.currentTime + 0.2);
            break;
    }
}

// ============================================
// ÚLTIMAS VENTAS
// ============================================

/**
 * Cargar últimas ventas del día
 */
async function cargarUltimasVentas() {
    console.log('💰 cargarUltimasVentas - currentEmpresa:', currentEmpresa);
    if (!currentEmpresa) {
        console.warn('⚠️ No hay currentEmpresa para cargar ventas');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const hoy = new Date().toISOString().split('T')[0];
        const url = `${API_URL}/ventas?empresaId=${currentEmpresa.id}&fecha_desde=${hoy}&fecha_hasta=${hoy}`;
        console.log('📡 Fetching últimas ventas:', url);
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('📡 Response ventas status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
            console.error('❌ Error del backend (ventas):', errorData);
            if (response.status === 401) {
                console.warn('⚠️ Token inválido al cargar ventas - puede necesitar refrescar la página');
            }
            // NO cerrar sesión aquí - solo fallar silenciosamente
            return;
        }

        const data = await response.json();
        ultimasVentas = data.data || [];
        
        renderizarUltimasVentas();

    } catch (error) {
        console.error('Error al cargar últimas ventas:', error);
    }
}

/**
 * Renderizar últimas ventas en el panel
 */
function renderizarUltimasVentas() {
    const container = document.getElementById('listaUltimasVentas');
    
    if (ultimasVentas.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-inbox display-4"></i>
                <p class="mt-2">No hay ventas hoy</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = ultimasVentas.slice(0, 10).map(venta => {
        // Si el cliente es Mostrador y hay observaciones, mostrar el nombre original
        let nombreCliente = venta.cliente_nombre || venta.razon_social;
        let detalleCliente = '';
        
        if (venta.cliente_nombre === 'Mostrador' && venta.observaciones) {
            // Extraer el nombre descriptivo de las observaciones (ej: "edgar (CTA-000014)" -> "edgar")
            const match = venta.observaciones.match(/^(.+?)\s*\(/);
            if (match) {
                detalleCliente = match[1]; // "edgar", "Mesa 5", etc.
            }
        }
        
        // Calcular total correcto (puede que esté mal en BD si descuento no se guardó)
        const totalCorrecto = (parseFloat(venta.subtotal) || 0) - (parseFloat(venta.descuento) || 0) + (parseFloat(venta.impuesto) || 0) + (parseFloat(venta.impuestos_adicionales) || 0) + (parseFloat(venta.propina_valor) || 0);
        
        return `
        <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <h6 class="mb-1">${venta.numero_factura}</h6>
                    <p class="mb-1 small text-muted">
                        ${nombreCliente}${detalleCliente ? `<br><small>${detalleCliente}</small>` : ''}
                    </p>
                    <small class="text-muted">${new Date(venta.fecha_venta).toLocaleTimeString('es-CO')}</small>
                </div>
                <div class="text-end">
                    <strong class="text-success d-block">$${formatearNumero(totalCorrecto)}</strong>
                    ${venta.descuento > 0 ? `<small class="text-muted">Desc: -$${formatearNumero(venta.descuento)}</small><br>` : ''}
                    <button class="btn btn-sm btn-outline-primary mt-1" onclick="reimprimirFactura('${venta.numero_factura}')">
                        <i class="bi bi-printer"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

/**
 * Reimprimir factura
 */
/**
 * Imprimir/reimprimir factura desde cualquier módulo
 * Carga los datos completos desde el backend y usa la plantilla configurada
 */
async function reimprimirFactura(numeroFactura) {
    try {
        console.log(`📄 Cargando factura ${numeroFactura} para impresión...`);
        
        // Mostrar loading
        const loadingAlert = mostrarAlerta('Cargando factura...', 'info');
        
        const token = localStorage.getItem('token');
        
        // Obtener empresaId actual
        const empresaId = currentEmpresa?.id;
        if (!empresaId) {
            throw new Error('No se ha seleccionado una empresa');
        }
        
        // Cargar datos completos de la venta desde el backend
        const response = await fetch(`${API_URL}/ventas/${numeroFactura}?empresaId=${empresaId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar la factura');
        }
        
        const result = await response.json();
        
        if (!result.success || !result.data) {
            throw new Error('Factura no encontrada');
        }
        
        const venta = result.data;
        
        console.log('✅ Factura cargada:', venta);
        
        // Preparar ventaData en el mismo formato que cuando se guarda
        const ventaData = {
            numero_factura: venta.numero_factura,
            subtotal: parseFloat(venta.subtotal) || 0,
            descuento: parseFloat(venta.descuento) || 0,
            impuesto: parseFloat(venta.impuesto) || 0,
            total: parseFloat(venta.total) || 0,
            propina_habilitada: venta.propina_habilitada || false,
            propina_porcentaje: parseFloat(venta.propina_porcentaje) || 0,
            propina_valor: parseFloat(venta.propina_valor) || 0,
            cliente: {
                razon_social: venta.razon_social || venta.cliente_nombre,
                nombre: venta.cliente_nombre,
                apellido: venta.cliente_apellido,
                tipo_documento: venta.cliente_tipo_documento,
                numero_documento: venta.numero_documento
            },
            // Mapear productos del backend al formato esperado por las plantillas
            productos: (venta.productos || []).map(p => ({
                id: p.producto_id,
                nombre: p.producto_nombre,
                sku: p.sku,
                cantidad: p.cantidad,
                precio_unitario: parseFloat(p.precio_unitario),
                subtotal: parseFloat(p.subtotal || (p.cantidad * p.precio_unitario))
            })),
            impuestos: venta.impuestos || [],
            pagos: venta.pagos || []
        };
        
        // Actualizar variables globales para que generarHTMLImpresion() funcione
        ultimaVentaGuardada = venta;
        ultimaVentaData = ventaData;
        
        // Mostrar el modal de impresión con la factura
        mostrarFactura(venta, ventaData);
        
        reproducirSonido('success');
        
    } catch (error) {
        console.error('❌ Error al reimprimir factura:', error);
        mostrarAlerta('Error al cargar la factura para impresión', 'error');
        reproducirSonido('error');
    }
}

// ============================================
// TURNOS DE CAJA
// ============================================

/**
 * Abrir modal de turno de caja
 */
// ============================================
// TURNOS DE CAJA
// ============================================

/**
 * Abrir modal de turnos
 */
async function abrirModalTurno() {
    try {
        // Verificar que la empresa esté cargada
        if (!currentEmpresa || !currentEmpresa.id) {
            mostrarAlerta('Por favor espera a que se cargue la empresa', 'warning');
            return;
        }
        
        // Obtener turno actual del usuario desde el backend
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/ventas/turno/actual?empresaId=${currentEmpresa.id}`,
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );

        const data = await response.json();
        
        if (data.success && data.data) {
            // Hay turno activo
            turnoActivo = data.data;
            mostrarTurnoActivo();
            await cargarResumenTurno();
        } else {
            // No hay turno activo
            turnoActivo = null;
            mostrarFormularioNuevoTurno();
        }
        
        const modal = new bootstrap.Modal(document.getElementById('turnoCajaModal'));
        modal.show();
        
    } catch (error) {
        console.error('Error al cargar turno:', error);
        mostrarAlerta('Error al cargar información del turno', 'error');
    }
}

/**
 * Mostrar turno activo
 */
function mostrarTurnoActivo() {
    document.getElementById('turnoNuevo').style.display = 'none';
    document.getElementById('turnoAbierto').style.display = 'block';
    
    // Mostrar/Ocultar botones del footer
    document.getElementById('btnAbrirTurno').style.display = 'none';
    document.getElementById('btnCerrarTurno').style.display = 'inline-block';
    
    const nombreUsuario = `${turnoActivo.usuario_nombre || ''} ${turnoActivo.usuario_apellido || ''}`.trim();
    document.getElementById('turnoUsuario').textContent = nombreUsuario || 'Usuario';
    document.getElementById('turnoApertura').textContent = new Date(turnoActivo.fecha_apertura).toLocaleString('es-CO');
    document.getElementById('turnoBaseInicial').textContent = formatearNumero(turnoActivo.base_inicial);
    
    // Mostrar bodega/tienda
    const bodegaEl = document.getElementById('turnoBodega');
    if (bodegaEl) {
        bodegaEl.textContent = turnoActivo.bodega_nombre || 'N/A';
    }
}

/**
 * Mostrar formulario para nuevo turno
 */
function mostrarFormularioNuevoTurno() {
    document.getElementById('turnoNuevo').style.display = 'block';
    document.getElementById('turnoAbierto').style.display = 'none';
    
    // Mostrar/Ocultar botones del footer
    document.getElementById('btnAbrirTurno').style.display = 'inline-block';
    document.getElementById('btnCerrarTurno').style.display = 'none';
    
    document.getElementById('baseInicialTurno').value = '50000';
    document.getElementById('notasAperturaTurno').value = '';
}

/**
 * Abrir nuevo turno
 */
async function abrirTurno() {
    try {
        // Verificar que la empresa esté cargada
        if (!currentEmpresa || !currentEmpresa.id) {
            mostrarAlerta('Error: Empresa no cargada', 'error');
            return;
        }
        
        // Verificar que el usuario esté cargado
        if (!currentUsuario || !currentUsuario.id) {
            mostrarAlerta('Error: Usuario no cargado', 'error');
            return;
        }
        
        const baseInicial = parseFloat(document.getElementById('baseInicialTurno').value) || 0;
        
        if (baseInicial < 0) {
            mostrarAlerta('La base inicial no puede ser negativa', 'error');
            return;
        }
        
        // Obtener bodega del usuario (si tiene asignada)
        const bodegaId = currentUsuario.bodega_id || null;
        
        if (!bodegaId) {
            mostrarAlerta('Error: Usuario sin bodega asignada. Contacte al administrador.', 'error');
            return;
        }
        
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/ventas/turno/abrir`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                empresaId: currentEmpresa.id,
                bodegaId: bodegaId,
                baseInicial
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarAlerta('Turno abierto exitosamente', 'success');
            reproducirSonido('success');
            bootstrap.Modal.getInstance(document.getElementById('turnoCajaModal')).hide();
            setTimeout(() => abrirModalTurno(), 500);
        } else {
            mostrarAlerta(data.message || 'Error al abrir turno', 'error');
        }
        
    } catch (error) {
        console.error('Error al abrir turno:', error);
        mostrarAlerta('Error al abrir turno', 'error');
    }
}

/**
 * Cargar resumen del turno
 */
async function cargarResumenTurno() {
    if (!turnoActivo) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/ventas/turno/${turnoActivo.id}/resumen?empresa_id=${currentEmpresa.id}`,
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );
        
        const data = await response.json();
        
        if (data.success) {
            const resumen = data.data;
            console.log('📊 Resumen del turno:', resumen);
            mostrarResumenEnModal(resumen);
            gastosDelTurno = resumen.gastos || [];
        } else {
            console.error('❌ Error en respuesta:', data);
        }
        
    } catch (error) {
        console.error('Error al cargar resumen:', error);
    }
}

/**
 * Mostrar resumen en el modal
 */
function mostrarResumenEnModal(resumen) {
    // Base inicial (se muestra pero NO se resta del efectivo a entregar)
    const baseInicial1 = document.getElementById('resumenBaseInicial');
    if (baseInicial1) baseInicial1.textContent = formatearNumero(resumen.base_inicial);
    
    // Ventas en efectivo
    const ventasEfectivo = resumen.ventas_por_metodo.find(v => v.metodo_pago === 'efectivo');
    const totalEfectivo = ventasEfectivo ? parseFloat(ventasEfectivo.total) : 0;
    const ventasEfectivoEl = document.getElementById('resumenVentasEfectivo');
    if (ventasEfectivoEl) ventasEfectivoEl.textContent = formatearNumero(totalEfectivo);
    
    // Total ventas (todos los métodos)
    const totalVentasEl = document.getElementById('resumenTotalVentas');
    if (totalVentasEl) totalVentasEl.textContent = formatearNumero(resumen.total_ventas);
    
    // Gastos
    const gastosEl = document.getElementById('resumenTotalGastos');
    if (gastosEl) gastosEl.textContent = formatearNumero(resumen.total_gastos);
    
    const totalGastos2 = document.getElementById('resumenTotalGastos2');
    if (totalGastos2) totalGastos2.textContent = formatearNumero(resumen.total_gastos);
    
    // Efectivo a entregar (ventas en efectivo - gastos, SIN restar la base)
    const efectivoEntregarEl = document.getElementById('resumenEfectivoEntregar');
    if (efectivoEntregarEl) efectivoEntregarEl.textContent = formatearNumero(resumen.efectivo_a_entregar);
    
    // CASO ESPECIAL: Efectivo a entregar negativo o cero
    const advertenciaDiv = document.getElementById('advertenciaEfectivoNegativo');
    const mensajeAdv = document.getElementById('mensajeAdvertencia');
    const labelEfectivo = document.getElementById('labelEfectivoContado');
    const ayudaEfectivo = document.getElementById('ayudaEfectivoContado');
    const inputEfectivo = document.getElementById('efectivoContado');
    
    if (resumen.efectivo_a_entregar <= 0) {
        // Mostrar advertencia
        if (advertenciaDiv && mensajeAdv) {
            advertenciaDiv.classList.remove('d-none');
            if (resumen.efectivo_a_entregar < 0) {
                const faltante = Math.abs(resumen.efectivo_a_entregar);
                mensajeAdv.textContent = `Los gastos ($${formatearNumero(resumen.total_gastos)}) excedieron las ventas en efectivo ($${formatearNumero(totalEfectivo)}). Se usaron $${formatearNumero(faltante)} de la base. NO hay efectivo para entregar.`;
            } else {
                mensajeAdv.textContent = 'Los gastos igualaron las ventas en efectivo. NO hay efectivo para entregar.';
            }
        }
        
        // Cambiar etiquetas
        if (labelEfectivo) labelEfectivo.textContent = 'Total Efectivo Contado en Caja';
        if (ayudaEfectivo) ayudaEfectivo.textContent = 'Efectivo físico total contado (debe ser igual o cercano a la base)';
        if (inputEfectivo) inputEfectivo.value = formatearNumero(resumen.base_inicial + resumen.efectivo_a_entregar);
    } else {
        // Ocultar advertencia (caso normal)
        if (advertenciaDiv) advertenciaDiv.classList.add('d-none');
        if (labelEfectivo) labelEfectivo.textContent = 'Efectivo Contado en Caja';
        if (ayudaEfectivo) ayudaEfectivo.textContent = 'Efectivo físico contado en la caja (sin incluir la base)';
        if (inputEfectivo) inputEfectivo.value = '';
    }
    
    // Mostrar desglose por método de pago
    mostrarDesglosePorMetodo(resumen.ventas_por_metodo);
    
    // Calcular diferencia inicial
    calcularDiferenciaTurno();
}

/**
 * Mostrar desglose por método de pago
 */
function mostrarDesglosePorMetodo(ventas) {
    const container = document.getElementById('desglosePorMetodo');
    if (!container) return;
    
    console.log('📊 Ventas por método:', ventas);
    
    if (!ventas || ventas.length === 0) {
        container.innerHTML = '<p class="text-muted text-center small">Sin ventas registradas</p>';
        return;
    }
    
    let html = '<div class="row g-2 mt-2">';
    
    const metodosNombres = {
        'efectivo': '💵 Efectivo',
        'tarjeta_debito': '💳 T. Débito',
        'tarjeta_credito': '💳 T. Crédito',
        'transferencia': '🏦 Transferencia',
        'nequi': '📱 Nequi',
        'daviplata': '📱 Daviplata',
        'cheque': '📄 Cheque'
    };
    
    ventas.forEach(v => {
        const nombre = metodosNombres[v.metodo_pago] || v.metodo_pago;
        html += `
            <div class="col-6">
                <div class="card">
                    <div class="card-body p-2">
                        <small class="d-block">${nombre}</small>
                        <strong>$${formatearNumero(v.total)}</strong>
                        <small class="text-muted d-block">(${v.cantidad} trans.)</small>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

/**
 * Calcular diferencia en el cierre
 */
function calcularDiferenciaTurno() {
    const inputEfectivo = document.getElementById('efectivoContado');
    const elemento = document.getElementById('resumenDiferencia');
    
    // Si el campo está vacío, no calcular diferencia
    if (!inputEfectivo.value || inputEfectivo.value.trim() === '') {
        elemento.className = 'text-muted';
        elemento.innerHTML = `<i class="bi bi-hourglass-split me-1"></i>Pendiente de contar`;
        return;
    }
    
    const efectivoContado = parseFloat(inputEfectivo.value) || 0;
    const esperadoTexto = document.getElementById('resumenEfectivoEntregar').textContent;
    const esperado = parsearNumeroFormateado(esperadoTexto);
    
    // CASO ESPECIAL: Si el esperado es negativo o cero, diferente lógica
    if (esperado <= 0) {
        // En este caso, el efectivo contado debería ser igual a (base + efectivo_a_entregar)
        // Ejemplo: base $50,000 + efectivo_a_entregar -$3,500 = $46,500 esperado
        const baseInicialTexto = document.getElementById('resumenBaseInicial').textContent;
        const baseInicial = parsearNumeroFormateado(baseInicialTexto);
        const totalEsperado = baseInicial + esperado; // Si esperado es negativo, resta de la base
        const diferencia = efectivoContado - totalEsperado;
        
        if (Math.abs(diferencia) < 0.01) {
            elemento.className = 'text-success';
            elemento.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i>Correcto - Cuadra exactamente`;
        } else if (diferencia > 0) {
            elemento.className = 'text-success';
            elemento.innerHTML = `<i class="bi bi-arrow-up-circle me-1"></i>+$${formatearNumero(diferencia)} (Sobrante)`;
        } else {
            elemento.className = 'text-danger';
            elemento.innerHTML = `<i class="bi bi-arrow-down-circle me-1"></i>-$${formatearNumero(Math.abs(diferencia))} (Faltante)`;
        }
    } else {
        // CASO NORMAL: Hay efectivo para entregar
        const diferencia = efectivoContado - esperado;
        
        if (Math.abs(diferencia) < 0.01) {
            elemento.className = 'text-success';
            elemento.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i>Correcto - Cuadra exactamente`;
        } else if (diferencia > 0) {
            elemento.className = 'text-success';
            elemento.innerHTML = `<i class="bi bi-arrow-up-circle me-1"></i>+$${formatearNumero(diferencia)} (Sobrante)`;
        } else {
            elemento.className = 'text-danger';
            elemento.innerHTML = `<i class="bi bi-arrow-down-circle me-1"></i>-$${formatearNumero(Math.abs(diferencia))} (Faltante)`;
        }
    }
}

/**
 * Cerrar turno
 */
async function cerrarTurno() {
    if (!turnoActivo) return;
    
    if (!confirm('¿Está seguro de cerrar el turno? Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        const efectivoContado = parseFloat(document.getElementById('efectivoContado').value) || 0;
        const notas = document.getElementById('notasCierreTurno').value;
        
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/ventas/turno/${turnoActivo.id}/cerrar`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    efectivoContado,
                    notas,
                    empresa_id: currentEmpresa.id // Requerido por middleware verificarEmpresaActiva
                })
            }
        );
        
        const data = await response.json();
        
        if (data.success) {
            mostrarAlerta('Turno cerrado exitosamente', 'success');
            reproducirSonido('success');
            bootstrap.Modal.getInstance(document.getElementById('turnoCajaModal')).hide();
            turnoActivo = null;
            
            // Preguntar si desea imprimir el cierre
            if (confirm('¿Desea imprimir el cierre de caja?')) {
                imprimirCierreCaja(data.data);
            }
        } else {
            mostrarAlerta(data.message || 'Error al cerrar turno', 'error');
        }
        
    } catch (error) {
        console.error('Error al cerrar turno:', error);
        mostrarAlerta('Error al cerrar turno', 'error');
    }
}

/**
 * Registrar gasto en el turno
 */
function registrarGasto() {
    if (!turnoActivo) {
        mostrarAlerta('No hay un turno activo', 'warning');
        return;
    }
    
    // Limpiar campos del modal
    document.getElementById('gastoDescripcion').value = '';
    document.getElementById('gastoMonto').value = '';
    
    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('modalRegistrarGasto'));
    modal.show();
    
    // Focus en el primer campo
    setTimeout(() => {
        document.getElementById('gastoDescripcion').focus();
    }, 500);
}

/**
 * Confirmar y enviar el registro de gasto
 */
async function confirmarRegistroGasto() {
    const descripcion = document.getElementById('gastoDescripcion').value.trim();
    const monto = parseFloat(document.getElementById('gastoMonto').value);
    
    // Validaciones
    if (!descripcion) {
        mostrarAlerta('Ingresa una descripción del gasto', 'warning');
        document.getElementById('gastoDescripcion').focus();
        return;
    }
    
    if (!monto || monto <= 0) {
        mostrarAlerta('Ingresa un monto válido', 'warning');
        document.getElementById('gastoMonto').focus();
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/ventas/turno/${turnoActivo.id}/gastos`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    descripcion, 
                    monto,
                    empresa_id: currentEmpresa.id // Requerido por middleware verificarEmpresaActiva
                })
            }
        );
        
        const data = await response.json();
        
        if (data.success) {
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalRegistrarGasto'));
            modal.hide();
            
            mostrarAlerta('Gasto registrado exitosamente', 'success');
            await cargarResumenTurno();
        } else {
            mostrarAlerta(data.message || 'Error al registrar gasto', 'error');
        }
        
    } catch (error) {
        console.error('Error al registrar gasto:', error);
        mostrarAlerta('Error al registrar gasto', 'error');
    }
}

/**
 * Abrir modal de historial de turnos
 */
async function abrirHistorialTurnos() {
    const modal = new bootstrap.Modal(document.getElementById('modalHistorialTurnos'));
    modal.show();
    await cargarHistorialTurnos();
}

/**
 * Cargar historial de turnos cerrados
 */
async function cargarHistorialTurnos() {
    try {
        if (!currentEmpresa || !currentEmpresa.id) {
            mostrarAlerta('No se ha seleccionado una empresa', 'warning');
            return;
        }

        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/ventas/turnos/historial?empresaId=${currentEmpresa.id}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (data.success) {
            mostrarListaHistorialTurnos(data.data);
        } else {
            document.getElementById('listaHistorialTurnos').innerHTML = 
                `<div class="alert alert-warning">${data.message || 'Error al cargar historial'}</div>`;
        }

    } catch (error) {
        console.error('Error al cargar historial de turnos:', error);
        document.getElementById('listaHistorialTurnos').innerHTML = 
            '<div class="alert alert-danger">Error al cargar historial de turnos</div>';
    }
}

/**
 * Mostrar lista de turnos en el modal
 */
function mostrarListaHistorialTurnos(turnos) {
    const container = document.getElementById('listaHistorialTurnos');

    if (!turnos || turnos.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No hay turnos cerrados registrados</div>';
        return;
    }

    let html = '<div class="list-group">';

    turnos.forEach(turno => {
        const fechaCierre = new Date(turno.fecha_cierre).toLocaleString('es-CO');
        const diferencia = turno.diferencia !== null ? parseFloat(turno.diferencia) : null;
        let claseDiferencia = 'text-muted';
        let textoDiferencia = 'N/A';

        if (diferencia !== null) {
            if (Math.abs(diferencia) < 0.01) {
                claseDiferencia = 'text-success';
                textoDiferencia = 'Exacto ✓';
            } else if (diferencia > 0) {
                claseDiferencia = 'text-success';
                textoDiferencia = `+$${formatearNumero(diferencia)}`;
            } else {
                claseDiferencia = 'text-danger';
                textoDiferencia = `-$${formatearNumero(Math.abs(diferencia))}`;
            }
        }

        html += `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">
                            <i class="bi bi-calendar3 me-1"></i>${fechaCierre}
                        </h6>
                        <p class="mb-1 small">
                            <i class="bi bi-shop me-1"></i><strong>${turno.bodega_nombre || 'N/A'}</strong>
                        </p>
                        <div class="row g-2 small">
                            <div class="col-6">
                                <span class="text-muted">Total ventas:</span><br>
                                <strong>$${formatearNumero(turno.total_ventas)}</strong>
                            </div>
                            <div class="col-6">
                                <span class="text-muted">Efectivo a entregar:</span><br>
                                <strong>$${formatearNumero(turno.efectivo_a_entregar)}</strong>
                            </div>
                            <div class="col-6">
                                <span class="text-muted">Gastos:</span><br>
                                <strong class="text-danger">$${formatearNumero(turno.total_gastos)}</strong>
                            </div>
                            <div class="col-6">
                                <span class="text-muted">Diferencia:</span><br>
                                <strong class="${claseDiferencia}">${textoDiferencia}</strong>
                            </div>
                        </div>
                    </div>
                    <div class="ms-3">
                        <button class="btn btn-sm btn-outline-primary" onclick="reimprimirCierreTurno(${turno.id})">
                            <i class="bi bi-printer"></i> Imprimir
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

/**
 * Re-imprimir cierre de un turno anterior
 */
async function reimprimirCierreTurno(turnoId) {
    try {
        if (!currentEmpresa || !currentEmpresa.id) {
            mostrarAlerta('No se ha seleccionado una empresa', 'warning');
            return;
        }

        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/ventas/turno/${turnoId}/resumen?empresa_id=${currentEmpresa.id}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (data.success) {
            imprimirCierreCaja(data.data);
        } else {
            mostrarAlerta(data.message || 'Error al obtener datos del turno', 'error');
        }

    } catch (error) {
        console.error('Error al re-imprimir cierre:', error);
        mostrarAlerta('Error al re-imprimir cierre', 'error');
    }
}

/**
 * Imprimir cierre de caja
 */
function imprimirCierreCaja(resumen) {
    const ventana = window.open('', '', 'width=300,height=600');
    const nombreEmpresa = currentEmpresa.nombre || 'Mi Empresa';
    
    // Usar datos del resumen (que vienen del backend) en lugar de turnoActivo
    const turno = resumen.turno;
    const nombreUsuario = turno.usuario_nombre && turno.usuario_apellido 
        ? `${turno.usuario_nombre} ${turno.usuario_apellido}` 
        : 'N/A';
    const nombreBodega = turno.bodega_nombre || 'N/A';
    const fechaApertura = new Date(turno.fecha_apertura).toLocaleString('es-CO');
    const fechaCierre = turno.fecha_cierre ? new Date(turno.fecha_cierre).toLocaleString('es-CO') : new Date().toLocaleString('es-CO');
    
    let htmlVentas = '';
    resumen.ventas_por_metodo.forEach(v => {
        const metodo = v.metodo_pago.replace(/_/g, ' ').toUpperCase();
        htmlVentas += `
            <tr>
                <td>${metodo}</td>
                <td align="right">$${formatearNumero(v.total)}</td>
                <td align="center">${v.cantidad}</td>
            </tr>
        `;
    });
    
    let htmlGastos = '';
    resumen.gastos.forEach(g => {
        htmlGastos += `
            <tr>
                <td>${g.descripcion}</td>
                <td align="right">$${formatearNumero(g.monto)}</td>
            </tr>
        `;
    });
    
    ventana.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cierre de Caja</title>
            <style>
                body { font-family: 'Courier New', monospace; font-size: 12px; margin: 10px; }
                h2, h3 { margin: 5px 0; text-align: center; }
                table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                th, td { padding: 3px; border-bottom: 1px dashed #000; }
                .total { font-weight: bold; border-top: 2px solid #000; }
                .highlight { background: #f0f0f0; font-weight: bold; }
                hr { border: none; border-top: 2px solid #000; }
            </style>
        </head>
        <body>
            <h2>${nombreEmpresa}</h2>
            <h3>CIERRE DE CAJA</h3>
            <hr>
            <p><strong>Cajero:</strong> ${nombreUsuario}</p>
            <p><strong>Tienda:</strong> ${nombreBodega}</p>
            <p><strong>Apertura:</strong> ${fechaApertura}</p>
            <p><strong>Cierre:</strong> ${fechaCierre}</p>
            <hr>
            <h3>VENTAS POR MÉTODO</h3>
            <table>
                <thead>
                    <tr>
                        <th align="left">Método</th>
                        <th align="right">Total</th>
                        <th align="center">Cant.</th>
                    </tr>
                </thead>
                <tbody>
                    ${htmlVentas}
                    <tr class="total">
                        <td>TOTAL VENTAS</td>
                        <td align="right">$${formatearNumero(resumen.total_ventas)}</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
            ${htmlGastos ? `
            <hr>
            <h3>GASTOS</h3>
            <table>
                ${htmlGastos}
                <tr class="total">
                    <td>TOTAL GASTOS</td>
                    <td align="right">$${formatearNumero(resumen.total_gastos)}</td>
                </tr>
            </table>
            ` : ''}
            <hr>
            <h3>RESUMEN EFECTIVO</h3>
            <table>
                <tr>
                    <td>Base Inicial (no se entrega):</td>
                    <td align="right">$${formatearNumero(resumen.base_inicial)}</td>
                </tr>
                <tr>
                    <td>Ventas Efectivo:</td>
                    <td align="right">$${formatearNumero(resumen.ventas_por_metodo.find(v => v.metodo_pago === 'efectivo')?.total || 0)}</td>
                </tr>
                <tr>
                    <td>(-) Gastos:</td>
                    <td align="right">-$${formatearNumero(resumen.total_gastos)}</td>
                </tr>
                <tr class="highlight">
                    <td><strong>EFECTIVO A ENTREGAR:</strong></td>
                    <td align="right"><strong>$${formatearNumero(resumen.efectivo_a_entregar)}</strong></td>
                </tr>
            </table>
            <p style="font-size: 10px; margin: 5px 0;"><em>* La base se queda en caja para el siguiente turno</em></p>
            <hr>
            <p style="text-align: center; margin-top: 20px;">
                _____________________________<br>
                Firma Cajero
            </p>
            <p style="text-align: center; font-size: 10px; margin-top: 20px;">
                KORE Inventory - ${new Date().toLocaleDateString('es-CO')}
            </p>
        </body>
        </html>
    `);
    
    setTimeout(() => {
        ventana.print();
        ventana.close();
    }, 250);
}

// ============================================
// MODO RÁPIDO
// ============================================

/**
 * Toggle modo rápido
 */
function toggleModoRapido(e) {
    modoRapido = e.target.checked;
    
    if (modoRapido) {
        mostrarAlerta('⚡ Modo Rápido activado - Cliente público automático', 'info');
        // En modo rápido, si no hay cliente, seleccionar público general
        if (!clienteSeleccionado) {
            seleccionarPublicoGeneral();
        }
    } else {
        mostrarAlerta('Modo Normal activado', 'info');
    }
}

// ============================================
// INICIALIZACIÓN ADICIONAL
// ============================================

// Cargar últimas ventas al iniciar
setTimeout(() => {
    cargarUltimasVentas();
    // Actualizar cada 30 segundos
    setInterval(cargarUltimasVentas, 30000);
}, 2000);

// ============================================
// CUENTAS ABIERTAS
// ============================================

/**
 * Cargar cuentas  abiertas de la empresa
 */
async function cargarCuentasAbiertas() {
    if (!currentEmpresa || !currentEmpresa.id) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/cuentas-abiertas/empresas/${currentEmpresa.id}?estado=abierta`, 
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        const data = await response.json();
        if (data.success) {
            cuentasAbiertas = data.data || [];
            renderizarCuentasAbiertas();
            actualizarBadgeCuentasAbiertas();
        }
    } catch (error) {
        console.error('Error cargando cuentas abiertas:', error);
    }
}

/**
 * Renderizar lista de cuentas abiertas
 */
function renderizarCuentasAbiertas() {
    const container = document.getElementById('listaCuentasAbiertas');
    if (!container) return;
    
    if (cuentasAbiertas.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-receipt-cutoff display-4"></i>
                <p class="mt-2">No hay cuentas abiertas</p>
            </div>
        `;
        return;
    }
    
    // Agrupar cuentas por tipo
    const cuentasPorTipo = {
        mesa: cuentasAbiertas.filter(c => c.tipo_identificacion === 'mesa'),
        cliente: cuentasAbiertas.filter(c => c.tipo_identificacion === 'cliente'),
        tab_nombre: cuentasAbiertas.filter(c => c.tipo_identificacion === 'tab_nombre')
    };
    
    let html = '';
    
    // Renderizar mesas
    if (cuentasPorTipo.mesa.length > 0) {
        html += `
            <div class="px-3 py-2 bg-light border-bottom">
                <small class="text-muted fw-bold">
                    <i class="bi bi-table me-1"></i>MESAS (${cuentasPorTipo.mesa.length})
                </small>
            </div>
        `;
        html += cuentasPorTipo.mesa.map(cuenta => renderizarItemCuenta(cuenta, 'table', 'primary')).join('');
    }
    
    // Renderizar clientes
    if (cuentasPorTipo.cliente.length > 0) {
        html += `
            <div class="px-3 py-2 bg-light border-bottom">
                <small class="text-muted fw-bold">
                    <i class="bi bi-person-circle me-1"></i>CLIENTES (${cuentasPorTipo.cliente.length})
                </small>
            </div>
        `;
        html += cuentasPorTipo.cliente.map(cuenta => renderizarItemCuenta(cuenta, 'person-circle', 'success')).join('');
    }
    
    // Renderizar tabs rápidos
    if (cuentasPorTipo.tab_nombre.length > 0) {
        html += `
            <div class="px-3 py-2 bg-light border-bottom">
                <small class="text-muted fw-bold">
                    <i class="bi bi-tag me-1"></i>TABS RÁPIDOS (${cuentasPorTipo.tab_nombre.length})
                </small>
            </div>
        `;
        html += cuentasPorTipo.tab_nombre.map(cuenta => renderizarItemCuenta(cuenta, 'tag', 'warning')).join('');
    }
    
    container.innerHTML = html;
}

/**
 * Renderizar un item de cuenta individual
 */
function renderizarItemCuenta(cuenta, icono, color) {
    const cuenta_solicitada = cuenta.cuenta_solicitada ? '<span class="badge bg-warning text-dark ms-1" title="Cliente pidió la cuenta">⏰ Cuenta pedida</span>' : '';
    const esActiva = cuentaActual && cuentaActual.id === cuenta.id;
    const borderClass = esActiva ? 'border-success border-2' : '';
    const bgClass = esActiva ? 'bg-light' : '';
    
    const nombreMostrar = cuenta.mesa_numero || cuenta.cliente_nombre || 'Sin identificar';
    const tiempoTranscurrido = calcularTiempoTranscurrido(cuenta.fecha_apertura);
    
    return `
        <div class="list-group-item list-group-item-action ${borderClass} ${bgClass}" 
             style="cursor: pointer;"
             onclick="cargarCuentaAbierta(${cuenta.id})">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <div class="mb-1">
                        <i class="bi bi-${icono} text-${color} me-1"></i>
                        <span class="fw-bold">${cuenta.numero_cuenta}</span>
                        ${esActiva ? '<span class="badge bg-success ms-1">Activa</span>' : ''}
                        ${cuenta_solicitada}
                    </div>
                    <p class="mb-1 small">
                        <strong>${nombreMostrar}</strong>
                    </p>
                    <div class="small text-muted">
                        <i class="bi bi-basket me-1"></i>${cuenta.items_count} items • 
                        <span class="fw-bold text-dark">$${formatearNumero(cuenta.total)}</span>
                    </div>
                </div>
                <div class="text-end">
                    <small class="text-muted">
                        <i class="bi bi-clock me-1"></i>${tiempoTranscurrido}
                    </small>
                </div>
            </div>
        </div>
    `;
}

/**
 * Calcular tiempo transcurrido desde apertura
 */
function calcularTiempoTranscurrido(fechaApertura) {
    const ahora = new Date();
    const apertura = new Date(fechaApertura);
    const diffMs = ahora - apertura;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
        return `${diffMins} min`;
    } else {
        const horas = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${horas}h ${mins}m`;
    }
}

/**
 * Actualizar badge de cuentas abiertas
 */
function actualizarBadgeCuentasAbiertas() {
    const badge = document.getElementById('badgeCuentasAbiertas');
    if (!badge) return;
    
    if (cuentasAbiertas.length > 0) {
        badge.textContent = cuentasAbiertas.length;
        badge.classList.remove('d-none');
    } else {
        badge.classList.add('d-none');
    }
}

/**
 * Mostrar modal para abrir nueva cuenta
 */
function mostrarModalAbrirCuenta() {
    if (productosVenta.length === 0) {
        mostrarAlerta('Debes agregar al menos un producto para abrir una cuenta', 'warning');
        return;
    }
    
    if (!currentEmpresa || !currentEmpresa.id) {
        mostrarAlerta('Error: No se ha cargado la información de la empresa. Por favor, recarga la página.', 'error');
        console.error('currentEmpresa no está definida:', currentEmpresa);
        return;
    }
    
    // Actualizar resumen en el modal
    document.getElementById('resumenCantidadProductos').textContent = productosVenta.length;
    document.getElementById('resumenTotalCuenta').textContent = formatearNumero(totalVentaActual);
    
    // Actualizar info del cliente actual
    const clienteBadge = document.getElementById('clienteActualBadge');
    if (clienteSeleccionado) {
        clienteBadge.textContent = clienteSeleccionado.nombre || clienteSeleccionado.razon_social;
        clienteBadge.className = 'badge bg-success';
    } else {
        clienteBadge.textContent = 'Cliente General';
        clienteBadge.className = 'badge bg-secondary';
    }
    
    // Limpiar campos
    document.getElementById('inputMesaNumero').value = '';
    document.getElementById('inputMesaCliente').value = '';
    document.getElementById('inputTabNombre').value = '';
    document.getElementById('inputNotasCuenta').value = document.getElementById('notasVenta').value;
    
    // Activar primer tab
    const firstTab = new bootstrap.Tab(document.getElementById('tab-cliente'));
    firstTab.show();
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalAbrirCuenta'));
    modal.show();
}

/**
 * Confirmar y abrir cuenta desde modal
 */
async function confirmarAbrirCuenta() {
    console.log('=== confirmarAbrirCuenta INICIADO ===');
    console.log('currentEmpresa:', currentEmpresa);
    console.log('productosVenta:', productosVenta);
    
    const activeTab = document.querySelector('#tiposCuentaTab .nav-link.active').id;
    console.log('Tab activo:', activeTab);
    
    let tipo_identificacion, mesa_numero, cliente_id, cliente_nombre;
    
    // Determinar datos según el tab activo
    if (activeTab === 'tab-cliente') {
        tipo_identificacion = 'cliente';
        mesa_numero = null;
        cliente_id = clienteSeleccionado?.id || null;
        cliente_nombre = clienteSeleccionado?.nombre || clienteSeleccionado?.razon_social || 'Cliente General';
        console.log('Modo CLIENTE - cliente_nombre:', cliente_nombre);
    } 
    else if (activeTab === 'tab-mesa') {
        const numeroMesa = document.getElementById('inputMesaNumero').value.trim();
        console.log('Modo MESA - numeroMesa:', numeroMesa);
        if (!numeroMesa) {
            mostrarAlerta('Debes ingresar el número de mesa', 'warning');
            return;
        }
        tipo_identificacion = 'mesa';
        mesa_numero = numeroMesa;
        cliente_id = null;
        const nombreCliente = document.getElementById('inputMesaCliente').value.trim();
        cliente_nombre = nombreCliente || numeroMesa;
        console.log('Modo MESA - cliente_nombre:', cliente_nombre);
    } 
    else if (activeTab === 'tab-nombre') {
        const nombreTab = document.getElementById('inputTabNombre').value.trim();
        console.log('Modo TAB - nombreTab:', nombreTab);
        if (!nombreTab) {
            mostrarAlerta('Debes ingresar un nombre para el tab', 'warning');
            return;
        }
        tipo_identificacion = 'tab_nombre';
        mesa_numero = null;
        cliente_id = null;
        cliente_nombre = nombreTab;
        console.log('Modo TAB - cliente_nombre:', cliente_nombre);
    }
    
    const notas = document.getElementById('inputNotasCuenta').value.trim();
    
    // Validar datos antes de enviar
    if (!currentEmpresa || !currentEmpresa.id) {
        mostrarAlerta('Error: No se ha cargado la información de la empresa', 'error');
        console.error('currentEmpresa:', currentEmpresa);
        return;
    }
    
    if (!cliente_nombre) {
        mostrarAlerta('Error: No se pudo determinar el nombre del cliente/mesa/tab', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        
        console.log('Datos a enviar:', {
            empresa_id: currentEmpresa.id,
            tipo_identificacion,
            mesa_numero,
            cliente_id,
            cliente_nombre,
            notas
        });
        
        // 1. Crear cuenta abierta
        const cuentaResponse = await fetch(`${API_URL}/cuentas-abiertas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                empresa_id: currentEmpresa.id,
                tipo_identificacion,
                mesa_numero,
                cliente_id,
                cliente_nombre,
                notas
            })
        });
        
        if (cuentaResponse.status === 401) {
            handleUnauthorized();
            return;
        }
        
        const cuentaData = await cuentaResponse.json();
        console.log('Respuesta del servidor:', cuentaData);
        console.log('Status HTTP:', cuentaResponse.status);
        
        if (!cuentaData.success) {
            console.error('ERROR del backend:', cuentaData.message);
            throw new Error(cuentaData.message);
        }
        
        // Los datos están dentro de cuentaData.data
        const cuentaId = cuentaData.data.cuenta_id;
        const numeroCuenta = cuentaData.data.numero_cuenta;
        
        console.log('Cuenta creada:', numeroCuenta, 'ID:', cuentaId);
        
        // 2. Agregar items a la cuenta
        console.log(`Agregando ${productosVenta.length} productos a la cuenta ${cuentaId}`);
        for (let i = 0; i < productosVenta.length; i++) {
            const producto = productosVenta[i];
            console.log(`Agregando producto ${i + 1}/${productosVenta.length}:`, producto);
            
            const itemResponse = await fetch(`${API_URL}/cuentas-abiertas/${cuentaId}/items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    empresa_id: currentEmpresa.id,
                    producto_id: producto.id || producto.producto_id,
                    cantidad: producto.cantidad,
                    precio_unitario: producto.precio_unitario,
                    notas: producto.notas || null
                })
            });
            
            if (!itemResponse.ok) {
                const errorText = await itemResponse.text();
                console.error(`Error agregando item ${i + 1}:`, errorText);
                throw new Error(`Error agregando producto ${producto.nombre || producto.id}: ${errorText}`);
            }
            
            console.log(`Producto ${i + 1} agregado exitosamente`);
        }
        
        console.log('Todos los productos agregados correctamente');
        
        // 3. Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalAbrirCuenta'));
        modal.hide();
        
        // 4. Mostrar confirmación
        mostrarAlerta(`✅ Cuenta ${numeroCuenta} abierta exitosamente`, 'success');
        reproducirSonido('success');
        
        // 5. Cargar la cuenta recién creada en modo edición
        await cargarCuentaAbierta(cuentaId);
        await cargarCuentasAbiertas();
        
    } catch (error) {
        console.error('Error abriendo cuenta:', error);
        mostrarAlerta('Error al abrir cuenta: ' + error.message, 'error');
    }
}

/**
 * Cargar una cuenta abierta para editarla
 */
async function cargarCuentaAbierta(cuentaId) {
    console.log('🔄 === cargarCuentaAbierta ===');
    console.log('cuentaId:', cuentaId);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/cuentas-abiertas/${cuentaId}/detalle`,
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        const data = await response.json();
        console.log('📥 Datos recibidos del backend:', data);
        if (!data.success) {
            throw new Error(data.message);
        }
        
        console.log('📊 Items recibidos:', data.data.items);
        
        // Cargar datos de la cuenta
        cuentaActual = data.data.cuenta;
        modoEdicionCuenta = true;
        
        // Cargar cliente si existe
        if (cuentaActual.cliente_id) {
            clienteSeleccionado = {
                id: cuentaActual.cliente_id,
                nombre: cuentaActual.cliente_nombre,
                numero_documento: cuentaActual.cliente_documento || '',
                email: cuentaActual.cliente_email || '',
                telefono: cuentaActual.cliente_telefono || ''
            };
            // Cliente ya cargado - Se mostrará en el resumen de la cuenta
            console.log('Cliente cargado:', clienteSeleccionado);
        }
        
        // Cargar productos con todos los campos necesarios
        productosVenta = data.data.items.map(item => ({
            id: item.id,
            producto_id: item.producto_id,
            nombre: item.producto_nombre,
            sku: item.producto_sku,
            cantidad: parseFloat(item.cantidad) || 0,
            precio_unitario: parseFloat(item.precio_unitario) || 0,
            precio_minorista: parseFloat(item.precio_unitario) || 0,
            subtotal: parseFloat(item.subtotal) || 0,
            stock_disponible: 999, // En modo edición no validamos stock
            aplica_iva: item.aplica_iva || false,
            porcentaje_iva: parseFloat(item.porcentaje_iva) || 0,
            iva_porcentaje: parseFloat(item.iva_porcentaje) || 0,
            iva_valor: parseFloat(item.iva_valor) || 0,
            impoconsumo_porcentaje: parseFloat(item.impoconsumo_porcentaje) || 0,
            impoconsumo_valor: parseFloat(item.impoconsumo_valor) || 0,
            total: parseFloat(item.total) || 0,
            fecha_agregado: item.fecha_agregado || null,
            usuario_nombre: item.usuario_nombre || null,
            notas: item.notas || null
        }));
        
        console.log('✅ productosVenta cargados desde backend:', productosVenta);
        
        // Recargar catálogo para tener stock actualizado de la BD
        console.log('🔄 Recargando catálogo para obtener stock actualizado...');
        await cargarCatalogoProductos();
        
        // Renderizar y mostrar botones apropiados
        console.log('🎨 Renderizando productos...');
        renderizarProductos();
        calcularTotales();
        actualizarStockEnCatalogo(); // Actualizar stock visual (en modo cuenta no resta nada)
        mostrarModoEdicionCuenta();
        habilitarSeccionProductos(); // Habilitar agregar productos en modo edición
        
        // Cerrar offcanvas
        const offcanvas = bootstrap.Offcanvas.getInstance(
            document.getElementById('cuentasAbiertasPanel')
        );
        if (offcanvas) {
            offcanvas.hide();
        }
        
    } catch (error) {
        console.error('Error cargando cuenta:', error);
        mostrarAlerta('Error al cargar cuenta: ' + error.message, 'error');
    }
}

/**
 * Mostrar modo edición de cuenta
 */
function mostrarModoEdicionCuenta() {
    // Ocultar botones normales
    const botonesNormales = document.getElementById('botonesVentaNormal');
    if (botonesNormales) {
        botonesNormales.classList.add('d-none');
    }
    
    // Mostrar botones de edición
    const botonesEdicion = document.getElementById('botonesEdicionCuenta');
    if (botonesEdicion) {
        botonesEdicion.classList.remove('d-none');
    }
    
    // Mostrar banner de edición
    const banner = document.getElementById('bannerEdicionCuenta');
    if (banner) {
        banner.className = 'alert alert-warning mb-0';
        banner.innerHTML = `
            <div class="container-fluid d-flex justify-content-between align-items-center">
                <div>
                    <i class="bi bi-receipt-cutoff me-2"></i>
                    <strong>Editando:</strong> ${cuentaActual.numero_cuenta} - 
                    ${cuentaActual.cliente_nombre}
                </div>
                <button class="btn btn-sm btn-outline-dark" onclick="cancelarEdicionCuenta()">
                    <i class="bi bi-x"></i> Cancelar
                </button>
            </div>
        `;
    }

    // Ocultar búsqueda de cliente y mostrar cliente de la cuenta
    const busquedaCliente = document.getElementById('busquedaCliente');
    if (busquedaCliente) {
        busquedaCliente.style.display = 'none';
    }

    const clienteSeleccionado = document.getElementById('clienteSeleccionado');
    if (clienteSeleccionado) {
        clienteSeleccionado.style.display = 'block';
        
        // Mostrar información del cliente de la cuenta
        document.getElementById('clienteNombreDisplay').textContent = cuentaActual.cliente_nombre;
        document.getElementById('clienteDocumentoDisplay').textContent = 
            `${cuentaActual.tipo_identificacion || 'N/A'}`;
        document.getElementById('clienteEmailDisplay').textContent = '-';
        document.getElementById('clienteTelefonoDisplay').textContent = '-';
        document.getElementById('clienteDireccionDisplay').textContent = '-';
        
        // Ocultar botón "Cambiar" porque no se puede cambiar el cliente de una cuenta abierta
        const btnCambiarCliente = document.getElementById('btnCambiarCliente');
        if (btnCambiarCliente) {
            btnCambiarCliente.style.display = 'none';
        }
    }
}

/**
 * Cancelar edición de cuenta
 */
function cancelarEdicionCuenta() {
    cuentaActual = null;
    modoEdicionCuenta = false;
    limpiarVentaSinConfirmar();
    
    // Ocultar banner
    const banner = document.getElementById('bannerEdicionCuenta');
    if (banner) {
        banner.className = 'd-none';
        banner.innerHTML = '';
    }
    
    // Mostrar botones normales
    const botonesNormales = document.getElementById('botonesVentaNormal');
    if (botonesNormales) {
        botonesNormales.classList.remove('d-none');
    }
    
    // Ocultar botones de edición
    const botonesEdicion = document.getElementById('botonesEdicionCuenta');
    if (botonesEdicion) {
        botonesEdicion.classList.add('d-none');
    }

    // Restaurar búsqueda de cliente
    const busquedaCliente = document.getElementById('busquedaCliente');
    if (busquedaCliente) {
        busquedaCliente.style.display = 'block';
    }

    // Ocultar cliente seleccionado
    const clienteSeleccionado = document.getElementById('clienteSeleccionado');
    if (clienteSeleccionado) {
        clienteSeleccionado.style.display = 'none';
    }

    // Mostrar botón "Cambiar"
    const btnCambiarCliente = document.getElementById('btnCambiarCliente');
    if (btnCambiarCliente) {
        btnCambiarCliente.style.display = 'block';
    }

    // Deshabilitar sección de productos (no hay cliente seleccionado)
    deshabilitarSeccionProductos();
}

/**
 * Ver total de cuenta (sin cerrar)
 */
async function verTotalCuenta() {
    if (!cuentaActual) return;
    
    try {
        // Mostrar indicador de carga en el modal
        const modalContent = document.getElementById('modalVerTotalContent');
        modalContent.innerHTML = '<div class="text-center p-5"><div class="spinner-border" role="status"><span class="visually-hidden">Cargando...</span></div><p class="mt-2">Actualizando totales...</p></div>';
        const modal = new bootstrap.Modal(document.getElementById('modalVerTotal'));
        modal.show();
        
        // Esperar un momento para que termine cualquier actualización pendiente
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const token = localStorage.getItem('token');
        
        // Recargar datos actualizados de la cuenta desde el backend
        const response = await fetch(
            `${API_URL}/cuentas-abiertas/${cuentaActual.id}/detalle`,
            {
                headers: { 'Authorization': `Bearer ${token}` }
            }
        );
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message);
        }
        
        // Actualizar datos de la cuenta
        const cuentaData = data.data.cuenta;
        const items = data.data.items || [];
        
        // Marcar que el cliente pidió la cuenta
        await fetch(
            `${API_URL}/cuentas-abiertas/${cuentaActual.id}/solicitar-cuenta`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        // Calcular total desde los datos del backend
        const totalCuenta = items.reduce((sum, item) => sum + parseFloat(item.total || 0), 0);
        
        // Función para formatear fecha/hora
        const formatearHora = (timestamp) => {
            if (!timestamp) return '-';
            const fecha = new Date(timestamp);
            return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        };
        
        // Mostrar modal con resumen detallado
        const modalHtml = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                <strong>La cuenta sigue abierta.</strong> 
                Puedes seguir agregando productos si el cliente lo desea.
            </div>
            
            <h4>Cuenta: ${cuentaData.numero_cuenta}</h4>
            <h5>Cliente: ${cuentaData.cliente_nombre}</h5>
            
            <table class="table table-sm mt-3">
                <thead>
                    <tr>
                        <th>Hora</th>
                        <th>Producto</th>
                        <th>Cant.</th>
                        <th>Precio</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td class="text-muted small">${formatearHora(item.fecha_agregado)}</td>
                            <td>${item.producto_nombre}</td>
                            <td>${item.cantidad}</td>
                            <td>$${formatearNumero(item.precio_unitario)}</td>
                            <td>$${formatearNumero(item.total)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="table-active">
                        <th colspan="4">TOTAL A PAGAR:</th>
                        <th class="text-primary fs-4">$${formatearNumero(totalCuenta)}</th>
                    </tr>
                </tfoot>
            </table>
            
            <div class="d-grid gap-2 mt-3">
                <button class="btn btn-success btn-lg" onclick="irAFormularioPago();">
                    <i class="bi bi-arrow-right-circle me-2"></i>Continuar al Pago
                </button>
                <button class="btn btn-outline-primary" data-bs-dismiss="modal">
                    <i class="bi bi-plus-circle me-2"></i>Cliente Quiere Más - Seguir Agregando
                </button>
            </div>
        `;
        
        // Mostrar en modal
        modalContent.innerHTML = modalHtml;
        
    } catch (error) {
        console.error('Error al ver total:', error);
    }
}

/**
 * Cerrar modal y llevar al usuario al formulario de pagos
 */
function irAFormularioPago() {
    // Cerrar el modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalVerTotal'));
    if (modal) {
        modal.hide();
    }
    
    // Esperar a que el modal se cierre completamente
    setTimeout(() => {
        // Hacer scroll al formulario de pagos (está en el div formaPago)
        const formaPagoDiv = document.getElementById('formaPago');
        if (formaPagoDiv) {
            formaPagoDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Agregar efecto visual temporal
            formaPagoDiv.classList.add('border-success', 'border-3', 'border');
            setTimeout(() => {
                formaPagoDiv.classList.remove('border-success', 'border-3', 'border');
            }, 2000);
        }
        
        // Hacer focus en el campo de monto después del scroll
        setTimeout(() => {
            const inputMonto = document.getElementById('montoPago');
            if (inputMonto) {
                inputMonto.focus();
                inputMonto.select(); // Seleccionar el texto si hay alguno
            }
        }, 500);
    }, 300);
}

/**
 * Agregar item a cuenta abierta en el backend
 */
async function agregarItemACuentaAbierta(producto) {
    console.log('=== agregarItemACuentaAbierta ===');
    console.log('cuentaActual:', cuentaActual);
    console.log('producto:', producto);
    console.log('Stack trace:', new Error().stack);
    
    if (!cuentaActual || !cuentaActual.id) {
        console.error('No hay cuenta actual o no tiene ID');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const precioUnitario = parseFloat(producto.precio_minorista || producto.precio_venta || 0);
        
        if (!precioUnitario || precioUnitario <= 0) {
            throw new Error('Precio unitario inválido');
        }
        
        const payload = {
            empresa_id: currentEmpresa.id,
            producto_id: producto.id,
            cantidad: 1,
            precio_unitario: precioUnitario,
            iva_porcentaje: producto.aplica_iva ? (producto.porcentaje_iva || 19) : 0,
            impoconsumo_porcentaje: producto.impoconsumo_porcentaje || 0
        };
        
        console.log('📤 Enviando al backend:', payload);
        
        const response = await fetch(
            `${API_URL}/cuentas-abiertas/${cuentaActual.id}/items`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            }
        );
        
        console.log('📥 Respuesta del backend:', response.status);
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        const data = await response.json();
        console.log('📊 Data del backend:', data);
        
        if (!data.success) {
            // Stock insuficiente en la bodega del cajero
            if (response.status === 400 && data.error && data.error.disponibilidad_otras_bodegas !== undefined) {
                mostrarModalStockInsuficienteBodega(producto, data.error.stock_en_tienda, data.error.disponibilidad_otras_bodegas);
                return;
            }
            throw new Error(data.message);
        }
        
        // En lugar de recargar toda la cuenta, agregar el item localmente
        console.log('✅ Producto agregado, actualizando localmente...');
        const nuevoItem = {
            id: data.data.item_id, // ID del item en la cuenta (retornado por backend)
            producto_id: producto.id,
            nombre: producto.nombre,
            sku: producto.sku,
            cantidad: 1,
            precio_unitario: precioUnitario,
            precio_minorista: producto.precio_minorista || precioUnitario,
            precio_mayorista: producto.precio_mayorista || null,
            precio_distribuidor: producto.precio_distribuidor || null,
            precio_minimo: producto.precio_minimo || null,
            precio_maximo: producto.precio_maximo || null,
            subtotal: precioUnitario,
            stock_disponible: 999, // En modo edición no validamos stock
            aplica_iva: producto.aplica_iva || false,
            porcentaje_iva: producto.porcentaje_iva || 19,
            iva_porcentaje: producto.porcentaje_iva || 19,
            iva_valor: 0,
            impoconsumo_porcentaje: producto.impoconsumo_porcentaje || 0,
            impoconsumo_valor: 0,
            total: precioUnitario,
            fecha_agregado: data.data.fecha_agregado || new Date().toISOString(), // Timestamp del backend o actual
            usuario_nombre: data.data.usuario_nombre || null,
            notas: null
        };
        
        productosVenta.push(nuevoItem);
        
        // Actualizar stock_original en el catálogo (backend ya restó el stock)
        const productoCatalogo = todosCatalogo.find(p => p.id === producto.id);
        if (productoCatalogo) {
            productoCatalogo.stock_original = Math.max(0, productoCatalogo.stock_original - 1);
            productoCatalogo.stock_actual = productoCatalogo.stock_original;
        }
        
        renderizarProductos();
        calcularTotales();
        actualizarStockEnCatalogo(); // Actualizar stock visual después de agregar
        
        mostrarAlerta('Producto agregado a la cuenta', 'success');
        
    } catch (error) {
        console.error('❌ Error al agregar item:', error);
        mostrarAlerta('Error al agregar producto: ' + error.message, 'error');
    }
}

/**
 * Actualizar item existente en cuenta abierta (cantidad o precio)
 */
async function actualizarItemEnBackend(index, cantidadAnterior = null) {
    const producto = productosVenta[index];
    
    if (!cuentaActual || !cuentaActual.id) {
        console.error('No hay cuenta actual para actualizar');
        return;
    }
    
    if (!producto.id) {
        console.error('El producto no tiene ID de item en la cuenta');
        console.error('Producto sin ID:', producto);
        mostrarAlerta('Error: El producto no está vinculado a la cuenta', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        
        const payload = {
            empresa_id: currentEmpresa.id,
            cantidad: producto.cantidad,
            precio_unitario: parseFloat(producto.precio_unitario)
        };
        
        console.log(`📤 Actualizando item ${producto.id} en cuenta ${cuentaActual.id}:`, payload);
        
        const response = await fetch(
            `${API_URL}/cuentas-abiertas/${cuentaActual.id}/items/${producto.id}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            }
        );
        
        console.log('📥 Respuesta del backend:', response.status);
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        const data = await response.json();
        console.log('📊 Data del backend:', data);
        
        if (!data.success) {
            console.error('❌ Error del backend:', data.message);
            mostrarAlerta('Error al actualizar: ' + data.message, 'error');
            return false; // Indicar falla
        }
        
        console.log('✅ Item actualizado en el backend correctamente');
        
        // Actualizar stock_original en el catálogo si cambió la cantidad
        if (cantidadAnterior !== null && cantidadAnterior !== producto.cantidad) {
            const diferencia = producto.cantidad - cantidadAnterior;
            console.log(`📊 Diferencia de cantidad: ${diferencia} (nueva: ${producto.cantidad}, anterior: ${cantidadAnterior})`);
            
            // Buscar producto en catálogo (puede estar en producto_id o en id)
            const productoIdBuscar = producto.producto_id || producto.id;
            const productoCatalogo = todosCatalogo.find(p => p.id === productoIdBuscar);
            
            if (productoCatalogo) {
                const stockAnterior = productoCatalogo.stock_original;
                // Si aumentó cantidad, restar más stock; si disminuyó, devolver stock
                productoCatalogo.stock_original = Math.max(0, productoCatalogo.stock_original - diferencia);
                productoCatalogo.stock_actual = productoCatalogo.stock_original;
                console.log(`📦 Stock actualizado en catálogo: ${productoCatalogo.nombre}`);
                console.log(`   Stock anterior: ${stockAnterior} → Stock nuevo: ${productoCatalogo.stock_original}`);
                console.log(`   Diferencia aplicada: -${diferencia}`);
            } else {
                console.warn(`⚠️ Producto no encontrado en catálogo con ID: ${productoIdBuscar}`);
                console.warn('   Producto actual:', producto);
            }
        }
        
        // Recalcular totales localmente (sin recargar para mejor UX)
        calcularTotales();
        
        return true; // Indicar éxito
        
    } catch (error) {
        console.error('❌ Error al actualizar item:', error);
        mostrarAlerta('Error de conexión al actualizar producto', 'error');
        // NO recargar la cuenta automáticamente, dejar que el usuario vea el error
        return false; // Indicar fallo
    }
}

/**
 * Cerrar cuenta y convertir en venta
 */
async function cerrarCuentaYCobrar() {
    if (!cuentaActual) return;
    
    // Validar que haya productos
    if (productosVenta.length === 0) {
        mostrarAlerta('No hay productos en la cuenta', 'warning');
        return;
    }
    
    // Validar que haya pagos agregados
    if (pagosPendientes.length === 0) {
        mostrarAlerta('Agrega al menos un pago antes de cerrar la cuenta', 'warning');
        return;
    }
    
    const totalAPagar = totalVentaActual;
    const totalPagado = calcularTotalPagado();
    
    // Validar que el total pagado sea suficiente
    if (totalPagado < totalAPagar) {
        const faltante = totalAPagar - totalPagado;
        mostrarAlerta(
            `Falta por pagar: $${formatearNumero(faltante)}\n\nAgrega más pagos para completar el total`,
            'warning'
        );
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const cambio = totalPagado - totalAPagar;
        
        const response = await fetch(
            `${API_URL}/cuentas-abiertas/${cuentaActual.id}/cerrar`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    empresa_id: currentEmpresa.id,
                    pagos: pagosPendientes,
                    notas: document.getElementById('notasVenta')?.value || null
                })
            }
        );
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message);
        }
        
        mostrarAlerta(
            `✅ Cuenta cerrada exitosamente\n\nTotal: $${formatearNumero(totalAPagar)}\nPagado: $${formatearNumero(totalPagado)}\nCambio: $${formatearNumero(cambio)}`,
            'success'
        );
        reproducirSonido('success');
        
        // Limpiar y recargar
        cancelarEdicionCuenta();
        await cargarCuentasAbiertas();
        
    } catch (error) {
        console.error('Error cerrando cuenta:', error);
        mostrarAlerta('Error al cerrar cuenta: ' + error.message, 'error');
    }
}

/**
 * Cancelar cuenta (reversar inventario)
 */
async function cancelarCuenta() {
    if (!cuentaActual) return;
    
    const motivo = prompt('¿Por qué desea cancelar esta cuenta?', 'Cliente se retiró sin pagar');
    
    if (!motivo) return;
    
    if (!confirm(`¿Está seguro de cancelar la cuenta ${cuentaActual.numero_cuenta}?\n\nEsta acción reversará el inventario.`)) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(
            `${API_URL}/cuentas-abiertas/${cuentaActual.id}`,
            {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    motivo,
                    empresa_id: currentEmpresa.id
                })
            }
        );
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message);
        }
        
        mostrarAlerta(`✅ Cuenta cancelada. Inventario reversado.`, 'success');
        
        // Recargar catálogo para obtener stock actualizado de la BD
        await cargarCatalogoProductos();
        
        // Limpiar y recargar
        cancelarEdicionCuenta();
        await cargarCuentasAbiertas();
        
    } catch (error) {
        console.error('Error cancelando cuenta:', error);
        mostrarAlerta('Error al cancelar cuenta: ' + error.message, 'error');
    }
}

// Cargar cuentas abiertas al iniciar
setTimeout(() => {
    cargarCuentasAbiertas();
    // Actualizar cada 30 segundos
    setInterval(cargarCuentasAbiertas, 30000);
}, 2000);

// ============================================
// FUNCIONES MÓVILES - RESPONSIVE UI
// ============================================

/**
 * Actualizar selector de empresa móvil
 */
function actualizarSelectorEmpresaMobile() {
    const btnMobile = document.getElementById('btnEmpresaMobile');
    const nombreMobile = document.getElementById('empresaNombreMobile');
    
    if (currentEmpresa && btnMobile && nombreMobile) {
        nombreMobile.textContent = currentEmpresa.nombre || 'Sin empresa';
        btnMobile.style.display = ''; // Mostrar  en móvil
    }
}

/**
 * Abrir modal selector de empresa móvil
 */
function abrirSelectorEmpresaMobile() {
    const modal = document.getElementById('modalEmpresaMobile');
    const lista = document.getElementById('listaEmpresasMobile');
    
    if (!modal || !lista) return;
    
    modal.classList.add('active');
    
    // Cargar empresas
    cargarEmpresasParaMobile();
}

/**
 * Cerrar modal selector de empresa móvil
 */
function cerrarSelectorEmpresaMobile() {
    const modal = document.getElementById('modalEmpresaMobile');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Cargar empresas en modal móvil
 */
async function cargarEmpresasParaMobile() {
    const lista = document.getElementById('listaEmpresasMobile');
    if (!lista) return;
    
    try {
        const token = localStorage.getItem('token');
        if (!currentUsuario || !currentUsuario.id) {
            console.error('❌ No hay usuario cargado');
            lista.innerHTML = '<div class="text-center p-4 text-danger">Error: Usuario no identificado</div>';
            return;
        }
        
        const response = await fetch(`${API_URL}/empresas/usuario/${currentUsuario.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Error al cargar empresas');
        
        const data = await response.json();
        const empresas = data.success ? data.data : [];
        
        if (empresas.length === 0) {
            lista.innerHTML = '<div class="text-center p-4 text-muted">No hay empresas disponibles</div>';
            return;
        }
        
        lista.innerHTML = empresas.map(emp => `
            <div class="empresa-item ${emp.id === currentEmpresa?.id ? 'selected' : ''}" 
                 onclick="seleccionarEmpresaMobile(${emp.id})">
                <div class="empresa-info">
                    <h6>${emp.nombre}</h6>
                    <small>NIT: ${emp.nit || 'N/A'}</small>
                </div>
                ${emp.id === currentEmpresa?.id ? '<i class="bi bi-check-circle text-success" style="font-size: 24px;"></i>' : ''}
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando empresas móvil:', error);
        lista.innerHTML = '<div class="text-center p-4 text-danger">Error al cargar empresas</div>';
    }
}

/**
 * Seleccionar empresa desde móvil
 */
async function seleccionarEmpresaMobile(empresaId) {
    try {
        const selector = document.getElementById('companySelector');
        if (selector) {
            selector.value = empresaId;
            // Disparar evento change
            const event = new Event('change');
            selector.dispatchEvent(event);
        }
        
        cerrarSelectorEmpresaMobile();
        
        // Actualizar UI móvil
        setTimeout(actualizarSelectorEmpresaMobile, 500);
        
    } catch (error) {
        console.error('Error seleccionando empresa:', error);
        mostrarAlerta('Error al cambiar empresa', 'error');
    }
}

/**
 * Actualizar badge carrito flotante
 */
function actualizarCarritoFlotante() {
    const btn = document.getElementById('btnCarritoFlotante');
    const badge = document.getElementById('badgeCarritoFlotante');
    const totalEl = document.getElementById('totalCarritoFlotante');
    
    if (!btn || !badge || !totalEl) return;
    
    const cantidadProductos = productosVenta.reduce((sum, p) => sum + p.cantidad, 0);
    
    badge.textContent = cantidadProductos;
    totalEl.textContent = `$${formatearNumero(totalVentaActual)}`;
    
    // Mostrar/ocultar botón
    if (cantidadProductos > 0) {
        btn.style.display = 'flex';
    } else {
        btn.style.display = 'none';
    }
}

/**
 * Abrir vista carrito móvil
 */
function abrirCarritoMobile() {
    const vista = document.getElementById('vistaCarritoMobile');
    const body = document.getElementById('bodyCarritoMobile');
    const footerTotal = document.getElementById('totalCarritoMobileFooter');
    
    if (!vista || !body) return;
    
    // Copiar contenido del resumen de venta desktop
    const carritoDesktop = document.querySelector('.col-lg-4 .card-body');
    if (carritoDesktop) {
        body.innerHTML = carritoDesktop.cloneNode(true).innerHTML;
    }
    
    // Actualizar total en footer
    if (footerTotal) {
        footerTotal.textContent = `$${formatearNumero(totalVentaActual)}`;
    }
    
    vista.classList.add('active');
    
    // Deshabilitar scroll del body
    document.body.style.overflow = 'hidden';
}

/**
 * Cerrar vista carrito móvil
 */
function cerrarCarritoMobile() {
    const vista = document.getElementById('vistaCarritoMobile');
    if (vista) {
        vista.classList.remove('active');
    }
    
    // Rehabilitar scroll del body
    document.body.style.overflow = '';
}

/**
 * Ir a pago desde vista móvil
 */
function irAPagoMobile() {
    // Mantenerse en el carrito móvil ya que tiene toda la info de pago
    // El usuario ya puede ver y usar las formas de pago dentro del carrito móvil
    const formaPago = document.querySelector('#vistaCarritoMobile #formaPago');
    if (formaPago) {
        formaPago.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

/**
 * Detectar si está en móvil
 */
function esDispositivoMovil() {
    return window.innerWidth <= 991;
}

/**
 * Inicializar funciones móviles
 */
function inicializarFuncionesMobile() {
    // Actualizar selector empresa móvil
    actualizarSelectorEmpresaMobile();
    
    // Event listener para resize
    window.addEventListener('resize', () => {
        if (esDispositivoMovil()) {
            actualizarSelectorEmpresaMobile();
        }
    });
    
    // Cerrar modales al hacer clic en overlay
    document.getElementById('modalEmpresaMobile')?.addEventListener('click', (e) => {
        if (e.target.id === 'modalEmpresaMobile') {
            cerrarSelectorEmpresaMobile();
        }
    });
}

// Extender la función actualizarResumen para actualizar carrito flotante
const actualizarResumenOriginal = window.actualizarResumen;
window.actualizarResumen = function() {
    if (typeof actualizarResumenOriginal === 'function') {
        actualizarResumenOriginal();
    }
    actualizarCarritoFlotante();
};

// Event listeners para cuentas abiertas
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnAbrirCuenta')?.addEventListener('click', mostrarModalAbrirCuenta);
    document.getElementById('btnConfirmarAbrirCuenta')?.addEventListener('click', confirmarAbrirCuenta);
    document.getElementById('btnVerTotal')?.addEventListener('click', verTotalCuenta);
    document.getElementById('btnCerrarCuenta')?.addEventListener('click', cerrarCuentaYCobrar);
    document.getElementById('btnCancelarCuenta')?.addEventListener('click', cancelarCuenta);
    
    // Inicializar funciones móviles
    setTimeout(inicializarFuncionesMobile, 1000);
});