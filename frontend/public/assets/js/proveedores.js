/**
 * =================================
 * KORE INVENTORY - PROVEEDORES MODULE
 * Módulo de gestión de proveedores
 * Version: 1.0.0 - 2026-02-06
 * =================================
 */

const API_URL = 'http://18.191.181.99:3000/api';
let currentEmpresa = null;
let currentUsuario = null;
let proveedoresData = [];
let proveedorModal = null;

console.log('🚀 Proveedores.js cargado - Versión 1.0.0');

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
        // Obtener usuario
        let usuario = JSON.parse(localStorage.getItem('usuario'));
        if (!usuario) {
            const responseUser = await fetch(`${API_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const userData = await responseUser.json();
            usuario = userData.data;
            localStorage.setItem('usuario', JSON.stringify(usuario));
        }
        currentUsuario = usuario;

        // Configurar visibilidad de PLATAFORMA en sidebar
        if (typeof configurarSidebarSuperAdmin === 'function') {
            configurarSidebarSuperAdmin();
        }

        // Cargar empresas del usuario
        await cargarEmpresas(usuario.id);

        // Obtener empresa activa
        currentEmpresa = JSON.parse(localStorage.getItem('empresaActiva'));
        if (!currentEmpresa) {
            mostrarAlerta('Por favor selecciona una empresa desde el dashboard', 'warning');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
            return;
        }

        // Actualizar UI
        document.getElementById('userName').textContent = `${usuario.nombre} ${usuario.apellido}`;
        document.getElementById('userRole').textContent = getTipoUsuarioTexto(usuario.tipo_usuario);

        // Inicializar modal
        proveedorModal = new bootstrap.Modal(document.getElementById('proveedorModal'));

        // Cargar proveedores
        await cargarProveedores();

        // Event listeners
        setupEventListeners();

    } catch (error) {
        console.error('Error en inicialización:', error);
        mostrarAlerta('Error al cargar la información inicial', 'error');
    }
});

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Búsqueda
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => cargarProveedores(), 500);
    });

    // Filtro estado
    document.getElementById('filterEstado').addEventListener('change', cargarProveedores);

    // Botones
    document.getElementById('btnNuevoProveedor').addEventListener('click', abrirModalNuevo);
    const btnQuick = document.getElementById('btnNuevoProveedorQuick');
    if (btnQuick) btnQuick.addEventListener('click', abrirModalNuevo);
    document.getElementById('btnGuardarProveedor').addEventListener('click', guardarProveedor);
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);
    document.getElementById('btnExportar').addEventListener('click', exportarProveedores);
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) btnLogout.addEventListener('click', cerrarSesion);
    
    // Tipo documento para mostrar/ocultar DV
    document.getElementById('tipoDocumento').addEventListener('change', toggleDigitoVerificacion);
    
    // Auto-calcular DV al escribir NIT
    document.getElementById('numeroDocumento').addEventListener('blur', autoCalcularDigitoVerificacion);
    document.getElementById('numeroDocumento').addEventListener('input', autoCalcularDigitoVerificacion);
    
    // Consultar RUES
    document.getElementById('btnConsultarRUES').addEventListener('click', consultarRUES);
    
    // Sidebar toggle
    const toggleBtn = document.getElementById('toggleSidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('active');
            document.getElementById('sidebarOverlay').classList.toggle('active');
        });
    }

    const closeSidebar = document.getElementById('closeSidebar');
    if (closeSidebar) {
        closeSidebar.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('sidebarOverlay').classList.remove('active');
        });
    }

    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('sidebarOverlay').classList.remove('active');
        });
    }
}

// ============================================
// UTILIDADES DE USUARIO
// ============================================

function getTipoUsuarioTexto(tipo) {
    const tipos = {
        'super_admin': 'Super Administrador',
        'admin_empresa': 'Administrador',
        'usuario': 'Usuario',
        'soporte': 'Soporte'
    };
    return tipos[tipo] || tipo;
}

// ============================================// CARGAR EMPRESAS DEL USUARIO
// ============================================

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
            
            // Event listener para cambio de empresa
            companySelector.addEventListener('change', (e) => {
                const empresaId = e.target.value;
                const empresaSeleccionada = data.data.find(emp => emp.id == empresaId);
                localStorage.setItem('empresaActiva', JSON.stringify(empresaSeleccionada));
                // Recargar datos del módulo
                cargarProveedores();
            });
            
        } else {
            companySelector.innerHTML = '<option value="">Sin empresas asignadas</option>';
        }
        
    } catch (error) {
        console.error('Error al cargar empresas:', error);
        companySelector.innerHTML = '<option value="">Error al cargar empresas</option>';
    }
}

// ============================================// CRUD PROVEEDORES
// ============================================

async function cargarProveedores() {
    try {
        mostrarCargando(true);

        const token = localStorage.getItem('token');
        const searchTerm = document.getElementById('searchInput').value;
        const estado = document.getElementById('filterEstado').value;

        let url = `${API_URL}/proveedores?empresaId=${currentEmpresa.id}`;
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
        if (estado !== '') url += `&estado=${estado}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error al cargar proveedores');

        const data = await response.json();
        proveedoresData = data.data;

        renderProveedores(proveedoresData);
        mostrarCargando(false);

    } catch (error) {
        console.error('Error al cargar proveedores:', error);
        mostrarAlerta('Error al cargar los proveedores', 'error');
        mostrarCargando(false);
    }
}

function renderProveedores(proveedores) {
    const tbody = document.getElementById('proveedoresTableBody');
    const emptyState = document.getElementById('emptyState');
    const tableContainer = document.getElementById('tableContainer');
    const resultCount = document.getElementById('resultCount');

    if (!proveedores || proveedores.length === 0) {
        emptyState.style.display = 'block';
        tableContainer.style.display = 'none';
        resultCount.textContent = '0';
        return;
    }

    emptyState.style.display = 'none';
    tableContainer.style.display = 'block';
    resultCount.textContent = proveedores.length;

    tbody.innerHTML = proveedores.map((proveedor, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>
                <div class="fw-bold">${proveedor.razon_social}</div>
                ${proveedor.nombre_comercial ? `<small class="text-muted">${proveedor.nombre_comercial}</small>` : ''}
            </td>
            <td>${proveedor.numero_documento}</td>
            <td>${proveedor.nombre_contacto || '-'}</td>
            <td>
                ${proveedor.telefono || proveedor.celular || '-'}
                ${proveedor.telefono && proveedor.celular ? `<br><small class="text-muted">${proveedor.celular}</small>` : ''}
            </td>
            <td>${proveedor.email || '-'}</td>
            <td>${proveedor.ciudad || '-'}</td>
            <td>
                <span class="badge ${proveedor.estado == 1 ? 'bg-success' : 'bg-secondary'}">
                    ${proveedor.estado == 1 ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td class="text-center">
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-primary" onclick="verProveedor(${proveedor.id})" title="Ver detalles">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-warning" onclick="editarProveedor(${proveedor.id})" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    ${proveedor.estado == 1 ? 
                        `<button class="btn btn-outline-danger" onclick="eliminarProveedor(${proveedor.id})" title="Desactivar">
                            <i class="bi bi-trash"></i>
                        </button>` : 
                        `<button class="btn btn-outline-success" onclick="activarProveedor(${proveedor.id})" title="Activar">
                            <i class="bi bi-check-circle"></i>
                        </button>`
                    }
                </div>
            </td>
        </tr>
    `).join('');
}

function abrirModalNuevo() {
    document.getElementById('proveedorModalLabel').innerHTML = '<i class="bi bi-truck me-2"></i>Nuevo Proveedor';
    document.getElementById('proveedorForm').reset();
    document.getElementById('proveedorId').value = '';
    document.getElementById('estado').value = '1';
    document.getElementById('pais').value = 'Colombia';
    document.getElementById('diasCredito').value = '30';
    document.getElementById('terminosPago').value = '30 días';
    document.getElementById('tipoDocumento').value = 'NIT';
    
    // Mostrar campo DV para NIT por defecto
    toggleDigitoVerificacion();
    
    // Inicializar tooltips
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach(el => new bootstrap.Tooltip(el));

    proveedorModal.show();
}

// ============================================
// DÍGITO DE VERIFICACIÓN (DIAN)
// ============================================

/**
 * Muestra u oculta el campo de dígito de verificación según el tipo de documento
 */
function toggleDigitoVerificacion() {
    const tipoDoc = document.getElementById('tipoDocumento').value;
    const dvContainer = document.getElementById('digitoVerificacionContainer');
    const numeroDocContainer = document.getElementById('numeroDocumentoContainer');
    
    if (tipoDoc === 'NIT') {
        dvContainer.style.display = 'block';
        numeroDocContainer.classList.remove('col-md-8');
        numeroDocContainer.classList.add('col-md-6');
        
        // Auto-calcular si ya hay un número
        autoCalcularDigitoVerificacion();
    } else {
        dvContainer.style.display = 'none';
        numeroDocContainer.classList.remove('col-md-6');
        numeroDocContainer.classList.add('col-md-8');
        document.getElementById('digitoVerificacion').value = '';
    }
}

/**
 * Auto-calcula el dígito de verificación cuando el tipo es NIT
 */
function autoCalcularDigitoVerificacion() {
    const tipoDoc = document.getElementById('tipoDocumento').value;
    if (tipoDoc !== 'NIT') return;
    
    const nit = document.getElementById('numeroDocumento').value.trim();
    if (!nit || nit.length < 6) {
        document.getElementById('digitoVerificacion').value = '';
        return;
    }
    
    // Calcular DV
    const dv = calcularDigitoVerificacionDIAN(nit);
    document.getElementById('digitoVerificacion').value = dv;
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

// ============================================
// CONSULTA RUES (Registro Único Empresarial)
// ============================================

/**
 * Consulta información empresarial desde RUES
 * Puede integrarse con APIs como:
 * - API RUES oficial (https://www.rues.org.co)
 * - Verifik.co
 * - TuDian.com
 * - Datasketch
 */
async function consultarRUES() {
    try {
        const tipoDoc = document.getElementById('tipoDocumento').value;
        const numeroDoc = document.getElementById('numeroDocumento').value.trim();
        const dv = document.getElementById('digitoVerificacion').value.trim();
        
        // Validar que sea NIT
        if (tipoDoc !== 'NIT') {
            mostrarAlerta('La consulta RUES solo está disponible para NIT', 'warning');
            return;
        }
        
        if (!numeroDoc) {
            mostrarAlerta('Por favor ingrese el número de NIT', 'warning');
            return;
        }
        
        // Mostrar spinner
        const btnRUES = document.getElementById('btnConsultarRUES');
        const spinner = document.getElementById('spinnerRUES');
        btnRUES.disabled = true;
        spinner.classList.remove('d-none');
        
        // Construir NIT completo
        const nitCompleto = dv ? `${numeroDoc}-${dv}` : numeroDoc;
        
        // ==============================================
        // OPCIÓN 1: API RUES REAL (requiere configuración)
        // ==============================================
        // const response = await fetch(`https://api.rues.org.co/consulta/${nitCompleto}`, {
        //     headers: {
        //         'Authorization': 'Bearer TU_API_KEY_AQUI'
        //     }
        // });
        
        // ==============================================
        // OPCIÓN 2: SIMULACIÓN para demostración
        // ==============================================
        // Simular delay de API
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Datos simulados basados en NITs conocidos
        const datosSimulados = obtenerDatosSimuladosRUES(numeroDoc);
        
        if (datosSimulados) {
            // Autocompletar formulario con datos RUES
            document.getElementById('razonSocial').value = datosSimulados.razon_social;
            document.getElementById('nombreComercial').value = datosSimulados.nombre_comercial || '';
            document.getElementById('representanteLegal').value = datosSimulados.representante_legal || '';
            document.getElementById('tipoSociedad').value = datosSimulados.tipo_sociedad || '';
            document.getElementById('matriculaMercantil').value = datosSimulados.matricula_mercantil || '';
            document.getElementById('camaraComercio').value = datosSimulados.camara_comercio || '';
            document.getElementById('fechaMatricula').value = datosSimulados.fecha_matricula || '';
            document.getElementById('actividadEconomica').value = datosSimulados.actividad_economica || '';
            document.getElementById('direccion').value = datosSimulados.direccion || '';
            document.getElementById('ciudad').value = datosSimulados.ciudad || '';
            document.getElementById('departamento').value = datosSimulados.departamento || '';
            document.getElementById('telefono').value = datosSimulados.telefono || '';
            document.getElementById('email').value = datosSimulados.email || '';
            
            mostrarAlerta('Datos autocompletados desde RUES exitosamente', 'success');
        } else {
            mostrarAlerta(`No se encontró información para el NIT ${nitCompleto} en RUES`, 'warning');
        }
        
    } catch (error) {
        console.error('Error al consultar RUES:', error);
        mostrarAlerta('Error al consultar información RUES. Por favor complete los datos manualmente.', 'error');
    } finally {
        // Ocultar spinner
        const btnRUES = document.getElementById('btnConsultarRUES');
        const spinner = document.getElementById('spinnerRUES');
        btnRUES.disabled = false;
        spinner.classList.add('d-none');
    }
}

/**
 * Datos simulados de empresas colombianas conocidas
 * En producción, esto debe reemplazarse por llamadas a API real
 */
function obtenerDatosSimuladosRUES(nit) {
    const empresasConocidas = {
        '900342297': {
            razon_social: 'COMERCIALIZADORA ARTURO CALLE S.A.S.',
            nombre_comercial: 'Arturo Calle',
            representante_legal: 'Juan Carlos Calle',
            tipo_sociedad: 'SAS',
            matricula_mercantil: '00123456',
            camara_comercio: 'Medellín',
            fecha_matricula: '1990-03-15',
            actividad_economica: '4771 - Comercio al por menor de prendas de vestir',
            direccion: 'Calle 50 # 43-83',
            ciudad: 'Medellín',
            departamento: 'Antioquia',
            telefono: '6044441234',
            email: 'info@arturocalle.com'
        },
        '900156264': {
            razon_social: 'EMPRESA DE EJEMPLO S.A.S.',
            nombre_comercial: 'Ejemplo Corp',
            representante_legal: 'María Fernanda López',
            tipo_sociedad: 'SAS',
            matricula_mercantil: '00987654',
            camara_comercio: 'Bogotá',
            fecha_matricula: '2010-06-20',
            actividad_economica: '6201 - Desarrollo de software',
            direccion: 'Carrera 7 # 71-21',
            ciudad: 'Bogotá',
            departamento: 'Cundinamarca',
            telefono: '6013001234',
            email: 'contacto@ejemplo.com'
        },
        '900123456': {
            razon_social: 'DISTRIBUIDORA XYZ LTDA',
            nombre_comercial: 'XYZ Distribuciones',
            representante_legal: 'Carlos Andrés Pérez',
            tipo_sociedad: 'LTDA',
            matricula_mercantil: '00555555',
            camara_comercio: 'Cali',
            fecha_matricula: '2005-09-10',
            actividad_economica: '4663 - Comercio al por mayor de materiales',
            direccion: 'Avenida 6N # 25-50',
            ciudad: 'Cali',
            departamento: 'Valle del Cauca',
            telefono: '6026001234',
            email: 'ventas@xyzltda.com'
        }
    };
    
    return empresasConocidas[nit] || null;
}

async function verProveedor(id) {
    try {
        const proveedor = proveedoresData.find(p => p.id === id);
        if (!proveedor) {
            mostrarAlerta('Proveedor no encontrado', 'error');
            return;
        }

        // Llenar el formulario con los datos
        await editarProveedor(id);
        
        // Deshabilitar todos los campos para solo lectura
        const form = document.getElementById('proveedorForm');
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => input.disabled = true);
        
        // Cambiar el botón de guardar
        const btnGuardar = document.getElementById('btnGuardarProveedor');
        btnGuardar.style.display = 'none';
        
        document.getElementById('proveedorModalLabel').innerHTML = '<i class="bi bi-eye me-2"></i>Ver Proveedor';
        
        // Cuando se cierre el modal, rehabilitar campos
        const modal = document.getElementById('proveedorModal');
        modal.addEventListener('hidden.bs.modal', function handler() {
            inputs.forEach(input => input.disabled = false);
            btnGuardar.style.display = 'block';
            modal.removeEventListener('hidden.bs.modal', handler);
        });

    } catch (error) {
        console.error('Error al ver proveedor:', error);
        mostrarAlerta('Error al cargar los datos del proveedor', 'error');
    }
}

async function editarProveedor(id) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/proveedores/${id}?empresaId=${currentEmpresa.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error al obtener proveedor');

        const data = await response.json();
        const proveedor = data.data;

        // Llenar formulario
        document.getElementById('proveedorId').value = proveedor.id;
        document.getElementById('tipoDocumento').value = proveedor.tipo_documento;
        document.getElementById('numeroDocumento').value = proveedor.numero_documento;
        document.getElementById('digitoVerificacion').value = proveedor.digito_verificacion || '';
        document.getElementById('razonSocial').value = proveedor.razon_social;
        document.getElementById('nombreComercial').value = proveedor.nombre_comercial || '';
        document.getElementById('representanteLegal').value = proveedor.representante_legal || '';
        document.getElementById('tipoSociedad').value = proveedor.tipo_sociedad || '';
        document.getElementById('matriculaMercantil').value = proveedor.matricula_mercantil || '';
        document.getElementById('camaraComercio').value = proveedor.camara_comercio || '';
        document.getElementById('fechaMatricula').value = proveedor.fecha_matricula || '';
        document.getElementById('actividadEconomica').value = proveedor.actividad_economica || '';
        document.getElementById('departamento').value = proveedor.departamento || '';
        document.getElementById('nombreContacto').value = proveedor.nombre_contacto || '';
        document.getElementById('email').value = proveedor.email || '';
        document.getElementById('telefono').value = proveedor.telefono || '';
        document.getElementById('celular').value = proveedor.celular || '';
        document.getElementById('sitioWeb').value = proveedor.sitio_web || '';
        document.getElementById('direccion').value = proveedor.direccion || '';
        document.getElementById('ciudad').value = proveedor.ciudad || '';
        document.getElementById('pais').value = proveedor.pais || 'Colombia';
        document.getElementById('codigoPostal').value = proveedor.codigo_postal || '';
        document.getElementById('terminosPago').value = proveedor.terminos_pago || '';
        document.getElementById('diasCredito').value = proveedor.dias_credito || 0;
        document.getElementById('limiteCredito').value = proveedor.limite_credito || 0;
        document.getElementById('productosSuministra').value = proveedor.productos_suministra || '';
        document.getElementById('banco').value = proveedor.banco || '';
        document.getElementById('tipoCuenta').value = proveedor.tipo_cuenta || '';
        document.getElementById('numeroCuenta').value = proveedor.numero_cuenta || '';
        document.getElementById('observaciones').value = proveedor.observaciones || '';
        document.getElementById('estado').value = proveedor.estado;
        
        // Mostrar/ocultar campo DV según tipo de documento
        toggleDigitoVerificacion();
        
        // Inicializar tooltips
        const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltips.forEach(el => new bootstrap.Tooltip(el));

        document.getElementById('proveedorModalLabel').innerHTML = '<i class="bi bi-pencil me-2"></i>Editar Proveedor';
        proveedorModal.show();

    } catch (error) {
        console.error('Error al editar proveedor:', error);
        mostrarAlerta('Error al cargar los datos del proveedor', 'error');
    }
}

async function guardarProveedor() {
    try {
        const id = document.getElementById('proveedorId').value;
        const tipoDoc = document.getElementById('tipoDocumento').value;
        
        const proveedorData = {
            empresa_id: currentEmpresa.id,
            tipo_documento: tipoDoc,
            numero_documento: document.getElementById('numeroDocumento').value.trim(),
            digito_verificacion: tipoDoc === 'NIT' ? (document.getElementById('digitoVerificacion').value.trim() || null) : null,
            razon_social: document.getElementById('razonSocial').value.trim(),
            nombre_comercial: document.getElementById('nombreComercial').value.trim() || null,
            representante_legal: document.getElementById('representanteLegal').value.trim() || null,
            tipo_sociedad: document.getElementById('tipoSociedad').value || null,
            matricula_mercantil: document.getElementById('matriculaMercantil').value.trim() || null,
            camara_comercio: document.getElementById('camaraComercio').value.trim() || null,
            fecha_matricula: document.getElementById('fechaMatricula').value || null,
            actividad_economica: document.getElementById('actividadEconomica').value.trim() || null,
            departamento: document.getElementById('departamento').value.trim() || null,
            nombre_contacto: document.getElementById('nombreContacto').value.trim() || null,
            email: document.getElementById('email').value.trim() || null,
            telefono: document.getElementById('telefono').value.trim() || null,
            celular: document.getElementById('celular').value.trim() || null,
            sitio_web: document.getElementById('sitioWeb').value.trim() || null,
            direccion: document.getElementById('direccion').value.trim() || null,
            ciudad: document.getElementById('ciudad').value.trim() || null,
            pais: document.getElementById('pais').value.trim() || 'Colombia',
            codigo_postal: document.getElementById('codigoPostal').value.trim() || null,
            terminos_pago: document.getElementById('terminosPago').value || null,
            dias_credito: parseInt(document.getElementById('diasCredito').value) || 0,
            limite_credito: parseFloat(document.getElementById('limiteCredito').value) || 0.00,
            productos_suministra: document.getElementById('productosSuministra').value.trim() || null,
            banco: document.getElementById('banco').value.trim() || null,
            tipo_cuenta: document.getElementById('tipoCuenta').value || null,
            numero_cuenta: document.getElementById('numeroCuenta').value.trim() || null,
            observaciones: document.getElementById('observaciones').value.trim() || null,
            estado: parseInt(document.getElementById('estado').value)
        };

        // Validaciones
        if (!proveedorData.numero_documento || !proveedorData.razon_social) {
            mostrarAlerta('Por favor complete los campos requeridos', 'warning');
            return;
        }

        const token = localStorage.getItem('token');
        const url = id ? `${API_URL}/proveedores/${id}` : `${API_URL}/proveedores`;
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(proveedorData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al guardar proveedor');
        }

        const data = await response.json();
        
        mostrarAlerta(id ? 'Proveedor actualizado exitosamente' : 'Proveedor creado exitosamente', 'success');
        proveedorModal.hide();
        await cargarProveedores();

    } catch (error) {
        console.error('Error al guardar proveedor:', error);
        mostrarAlerta(error.message || 'Error al guardar el proveedor', 'error');
    }
}

async function eliminarProveedor(id) {
    if (!confirm('¿Está seguro de desactivar este proveedor?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/proveedores/${id}?empresaId=${currentEmpresa.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error al eliminar proveedor');

        mostrarAlerta('Proveedor desactivado exitosamente', 'success');
        await cargarProveedores();

    } catch (error) {
        console.error('Error al eliminar proveedor:', error);
        mostrarAlerta('Error al desactivar el proveedor', 'error');
    }
}

async function activarProveedor(id) {
    if (!confirm('¿Está seguro de activar este proveedor?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/proveedores/${id}/activar?empresaId=${currentEmpresa.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error al activar proveedor');

        mostrarAlerta('Proveedor activado exitosamente', 'success');
        await cargarProveedores();

    } catch (error) {
        console.error('Error al activar proveedor:', error);
        mostrarAlerta('Error al activar el proveedor', 'error');
    }
}

// ============================================
// UTILIDADES
// ============================================

function limpiarFiltros() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterEstado').value = '1';
    cargarProveedores();
}

function exportarProveedores() {
    if (!proveedoresData || proveedoresData.length === 0) {
        mostrarAlerta('No hay datos para exportar', 'warning');
        return;
    }

    try {
        // Preparar datos para exportar
        const datosExportar = proveedoresData.map(p => ({
            'ID': p.id,
            'Razón Social': p.razon_social,
            'Nombre Comercial': p.nombre_comercial || '',
            'Tipo Doc': p.tipo_documento,
            'Número Doc': p.numero_documento,
            'Contacto': p.nombre_contacto || '',
            'Teléfono': p.telefono || '',
            'Celular': p.celular || '',
            'Email': p.email || '',
            'Dirección': p.direccion || '',
            'Ciudad': p.ciudad || '',
            'País': p.pais || '',
            'Términos Pago': p.terminos_pago || '',
            'Días Crédito': p.dias_credito || 0,
            'Límite Crédito': p.limite_credito || 0,
            'Estado': p.estado == 1 ? 'Activo' : 'Inactivo'
        }));

        // Crear libro de Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(datosExportar);

        // Ajustar ancho de columnas
        const colWidths = [
            { wch: 6 },   // ID
            { wch: 30 },  // Razón Social
            { wch: 30 },  // Nombre Comercial
            { wch: 10 },  // Tipo Doc
            { wch: 15 },  // Número Doc
            { wch: 25 },  // Contacto
            { wch: 15 },  // Teléfono
            { wch: 15 },  // Celular
            { wch: 30 },  // Email
            { wch: 35 },  // Dirección
            { wch: 20 },  // Ciudad
            { wch: 15 },  // País
            { wch: 15 },  // Términos Pago
            { wch: 12 },  // Días Crédito
            { wch: 15 },  // Límite Crédito
            { wch: 10 }   // Estado
        ];
        ws['!cols'] = colWidths;

        // Agregar hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Proveedores');

        // Descargar archivo
        const fecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `proveedores_${fecha}.xlsx`);

        mostrarAlerta(`${proveedoresData.length} proveedores exportados exitosamente`, 'success');

    } catch (error) {
        console.error('Error al exportar proveedores:', error);
        mostrarAlerta('Error al exportar proveedores a Excel', 'error');
    }
}

function mostrarCargando(show) {
    const spinner = document.getElementById('loadingSpinner');
    const tableContainer = document.getElementById('tableContainer');
    const emptyState = document.getElementById('emptyState');

    if (show) {
        spinner.style.display = 'block';
        tableContainer.style.display = 'none';
        emptyState.style.display = 'none';
    } else {
        spinner.style.display = 'none';
    }
}

function mostrarAlerta(mensaje, tipo) {
    const alertClass = {
        'success': 'alert-success',
        'error': 'alert-danger',
        'warning': 'alert-warning',
        'info': 'alert-info'
    }[tipo] || 'alert-info';

    const alertHtml = `
        <div class="alert ${alertClass} alert-dismissible fade show position-fixed top-0 end-0 m-3" role="alert" style="z-index: 9999;">
            <i class="bi bi-${tipo === 'success' ? 'check-circle' : tipo === 'error' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', alertHtml);

    setTimeout(() => {
        const alert = document.querySelector('.alert');
        if (alert) alert.remove();
    }, 3000);
}

function cerrarSesion() {
    if (confirm('¿Está seguro de cerrar sesión?')) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}
