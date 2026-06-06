/**
 * =================================
 * KORE INVENTORY - CLIENTES MODULE
 * Módulo de gestión de clientes
 * =================================
 */

const API_URL = 'https://kinventoryservices.com/api';
let currentEmpresa = null;
let clientes = [];

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    // Verificar autenticación
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        // Obtener usuario desde localStorage (ya fue validado en login/dashboard)
        let usuario = JSON.parse(localStorage.getItem('usuario'));
        
        // Si no hay usuario en localStorage, verificar token
        if (!usuario) {
            const response = await fetch(`${API_URL}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                localStorage.removeItem('token');
                localStorage.removeItem('usuario');
                window.location.href = 'login.html';
                return;
            }

            const data = await response.json();
            usuario = data.data;
            localStorage.setItem('usuario', JSON.stringify(usuario));
        }

        // Cargar información del usuario en la UI
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
        
        // Si currentEmpresa no se estableció por cargarEmpresas, cargar desde API
        if (!currentEmpresa || !currentEmpresa.id) {
            await cargarDatosEmpresa(empresaActivaId);
        }
        
        console.log(`✅ Empresa activa: ${currentEmpresa.nombre} (ID: ${currentEmpresa.id})`);

        // Cargar datos iniciales
        await cargarClientes();

        // Inicializar event listeners
        initEventListeners();

    } catch (error) {
        console.error('Error de inicialización:', error);
        mostrarAlerta('Error al inicializar el módulo', 'danger');
    }
});

// ============================================
// CARGAR INFORMACIÓN DEL USUARIO
// ============================================

function cargarInfoUsuario(usuario) {
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    
    if (userName) {
        const nombre = usuario.nombre || '';
        const apellido = usuario.apellido || '';
        userName.textContent = `${nombre} ${apellido}`.trim() || 'Usuario';
    }
    
    if (userRole) {
        userRole.textContent = getTipoUsuarioTexto(usuario.tipo_usuario);
    }
}

function getTipoUsuarioTexto(tipo) {
    const tipos = {
        'super_admin': 'Super Administrador',
        'admin_empresa': 'Administrador',
        'usuario': 'Usuario',
        'soporte': 'Soporte'
    };
    return tipos[tipo] || tipo;
}

// ============================================
// CARGAR EMPRESAS DEL USUARIO
// ============================================

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
            const tieneSoloUnaEmpresa = data.data.length === 1;
            
            if (esUsuarioRegular || tieneSoloUnaEmpresa) {
                // Usuario Regular o Admin con 1 sola empresa: mostrar solo texto
                companySelector.style.display = 'none';
                if (companyText) companyText.style.display = 'block';
                if (companyNameText) companyNameText.textContent = data.data[0].nombre;
                
                // Establecer empresa activa (solo ID en localStorage)
                localStorage.setItem('empresaActiva', data.data[0].id.toString());
                currentEmpresa = data.data[0];
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
                const empresaGuardadaId = localStorage.getItem('empresaActiva');
                if (empresaGuardadaId) {
                    // Verificar que la empresa guardada existe en la lista
                    const empresaExiste = data.data.find(emp => emp.id == empresaGuardadaId);
                    if (empresaExiste) {
                        companySelector.value = empresaGuardadaId;
                        currentEmpresa = empresaExiste;
                    } else {
                        // Si no existe, usar la primera empresa
                        companySelector.value = data.data[0].id;
                        localStorage.setItem('empresaActiva', data.data[0].id.toString());
                        currentEmpresa = data.data[0];
                    }
                } else {
                    // No hay empresa guardada, usar la primera
                    companySelector.value = data.data[0].id;
                    localStorage.setItem('empresaActiva', data.data[0].id.toString());
                    currentEmpresa = data.data[0];
                }
                
                // Event listener para cambio de empresa
                companySelector.addEventListener('change', (e) => {
                    const empresaId = e.target.value;
                    const empresaSeleccionada = data.data.find(emp => emp.id == empresaId);
                    localStorage.setItem('empresaActiva', empresaId);
                    currentEmpresa = empresaSeleccionada;
                    // Recargar datos del módulo
                    cargarClientes();
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

// ============================================
// CARGAR DATOS COMPLETOS DE EMPRESA
// ============================================

async function cargarDatosEmpresa(empresaId) {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`${API_URL}/empresas/${empresaId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success && data.data) {
            currentEmpresa = data.data;
            console.log('✅ Datos completos de empresa cargados:', currentEmpresa.nombre);
            
            // Actualizar el nombre de la empresa en el DOM
            const companyNameText = document.getElementById('companyNameText');
            if (companyNameText) {
                companyNameText.textContent = currentEmpresa.nombre;
            }
        } else {
            console.error('❌ Error al obtener datos de empresa:', data.message);
        }
    } catch (error) {
        console.error('❌ Error al cargar datos de empresa:', error);
    }
}

// ============================================
// CARGAR CLIENTES
// ============================================

async function cargarClientes() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/clientes?empresaId=${currentEmpresa.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error al cargar clientes');

        const data = await response.json();
        clientes = data.data || [];

        renderizarClientes(clientes);

    } catch (error) {
        console.error('Error al cargar clientes:', error);
        mostrarAlerta('Error al cargar clientes', 'danger');
    }
}

// ============================================
// RENDERIZAR TABLA DE CLIENTES
// ============================================

function renderizarClientes(items) {
    const tbody = document.getElementById('clientesTableBody');
    const emptyState = document.getElementById('emptyState');
    const clientesTable = document.getElementById('clientesTable');
    
    if (!items || items.length === 0) {
        // Ocultar tabla y mostrar empty state
        if (clientesTable) clientesTable.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        tbody.innerHTML = '';
        return;
    }
    
    // Mostrar tabla y ocultar empty state
    if (clientesTable) clientesTable.style.display = 'table';
    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = items.map((cliente, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>
                <div>
                    <strong>${cliente.razon_social || `${cliente.nombre} ${cliente.apellido || ''}`.trim()}</strong>
                    ${cliente.razon_social ? `<br><small class="text-muted">${cliente.nombre} ${cliente.apellido || ''}</small>` : ''}
                </div>
            </td>
            <td>${cliente.tipo_documento || 'CC'}: ${cliente.numero_documento}</td>
            <td>${cliente.email || '-'}</td>
            <td>${cliente.celular || cliente.telefono || '-'}</td>
            <td>${cliente.ciudad || '-'}</td>
            <td class="text-center">
                <span class="badge ${cliente.estado === 'activo' ? 'bg-success' : 'bg-secondary'}">
                    ${cliente.estado === 'activo' ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editarCliente(${cliente.id})" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="eliminarCliente(${cliente.id})" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ============================================
// EVENT LISTENERS
// ============================================

function initEventListeners() {
    // Botón nuevo cliente
    document.getElementById('btnNuevoCliente').addEventListener('click', abrirModalNuevo);
    
    // Botón nuevo cliente empty state (si existe)
    const btnEmpty = document.getElementById('btnNuevoClienteEmpty');
    if (btnEmpty) {
        btnEmpty.addEventListener('click', (e) => {
            e.preventDefault();
            abrirModalNuevo();
        });
    }

    // Formulario cliente
    document.getElementById('clienteForm').addEventListener('submit', guardarCliente);
    
    // Validaciones en tiempo real
    agregarValidacionesCliente();

    // Búsqueda y filtros
    document.getElementById('searchInput').addEventListener('input', filtrarClientes);
    document.getElementById('filterTipoDocumento').addEventListener('change', filtrarClientes);
    document.getElementById('filterEstado').addEventListener('change', filtrarClientes);
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);

    // Cerrar sesión
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        cerrarSesion();
    });

    // Sidebar toggle
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
}

// ============================================
// VALIDACIONES DEL FORMULARIO
// ============================================

function agregarValidacionesCliente() {
    // Validación de email
    const emailInput = document.getElementById('clienteEmail');
    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            if (this.value && !validarEmail(this.value)) {
                this.classList.add('is-invalid');
                this.classList.remove('is-valid');
            } else if (this.value) {
                this.classList.add('is-valid');
                this.classList.remove('is-invalid');
            } else {
                this.classList.remove('is-invalid', 'is-valid');
            }
        });
    }
    
    // Validación de número de documento (solo alfanumérico)
    const docInput = document.getElementById('clienteNumeroDocumento');
    if (docInput) {
        docInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^a-zA-Z0-9-]/g, '');
        });
    }
    
    // Validación de teléfonos (solo números y algunos caracteres)
    const telefonoInput = document.getElementById('clienteTelefono');
    const celularInput = document.getElementById('clienteCelular');
    
    [telefonoInput, celularInput].forEach(input => {
        if (input) {
            input.addEventListener('input', function() {
                this.value = this.value.replace(/[^0-9+() -]/g, '');
            });
        }
    });
    
    // Validación de límite de crédito (no negativo)
    const limiteCreditoInput = document.getElementById('clienteLimiteCredito');
    if (limiteCreditoInput) {
        limiteCreditoInput.addEventListener('input', function() {
            if (parseFloat(this.value) < 0) this.value = '0';
        });
    }
    
    // Validación de días de crédito (no negativo)
    const diasCreditoInput = document.getElementById('clienteDiasCredito');
    if (diasCreditoInput) {
        diasCreditoInput.addEventListener('input', function() {
            if (parseInt(this.value) < 0) this.value = '0';
        });
    }
}

function validarEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// ============================================
// MODAL CLIENTE
// ============================================

function abrirModalNuevo() {
    document.getElementById('clienteModalTitle').textContent = 'Nuevo Cliente';
    document.getElementById('clienteForm').reset();
    document.getElementById('clienteId').value = '';
    
    // Establecer valores por defecto
    document.getElementById('clienteTipoDocumento').value = 'CC';
    document.getElementById('clientePais').value = 'Colombia';
    document.getElementById('clienteLimiteCredito').value = '0';
    document.getElementById('clienteDiasCredito').value = '0';
    document.getElementById('clienteEstado').value = 'activo';
    
    // Limpiar validaciones visuales si existen
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    document.querySelectorAll('.is-valid').forEach(el => el.classList.remove('is-valid'));
    
    const modal = new bootstrap.Modal(document.getElementById('clienteModal'));
    modal.show();
}

async function editarCliente(id) {
    try {
        const cliente = clientes.find(c => c.id === id);
        if (!cliente) {
            mostrarAlerta('Cliente no encontrado', 'danger');
            return;
        }

        document.getElementById('clienteModalTitle').textContent = 'Editar Cliente';
        document.getElementById('clienteId').value = cliente.id;
        document.getElementById('clienteTipoDocumento').value = cliente.tipo_documento || 'CC';
        document.getElementById('clienteNumeroDocumento').value = cliente.numero_documento;
        document.getElementById('clienteNombre').value = cliente.nombre;
        document.getElementById('clienteApellido').value = cliente.apellido || '';
        document.getElementById('clienteRazonSocial').value = cliente.razon_social || '';
        document.getElementById('clienteEmail').value = cliente.email || '';
        document.getElementById('clienteTelefono').value = cliente.telefono || '';
        document.getElementById('clienteCelular').value = cliente.celular || '';
        document.getElementById('clienteDireccion').value = cliente.direccion || '';
        document.getElementById('clienteCiudad').value = cliente.ciudad || '';
        document.getElementById('clienteDepartamento').value = cliente.departamento || '';
        document.getElementById('clientePais').value = cliente.pais || 'Colombia';
        document.getElementById('clienteLimiteCredito').value = cliente.limite_credito || 0;
        document.getElementById('clienteDiasCredito').value = cliente.dias_credito || 0;
        document.getElementById('clienteEstado').value = cliente.estado;

        const modal = new bootstrap.Modal(document.getElementById('clienteModal'));
        modal.show();

    } catch (error) {
        console.error('Error al editar cliente:', error);
        mostrarAlerta('Error al cargar datos del cliente', 'danger');
    }
}

// ============================================
// GUARDAR CLIENTE
// ============================================

async function guardarCliente(e) {
    e.preventDefault();

    const clienteId = document.getElementById('clienteId').value;
    const token = localStorage.getItem('token');
    
    // Validar campos requeridos
    const numeroDocumento = document.getElementById('clienteNumeroDocumento').value.trim();
    const nombre = document.getElementById('clienteNombre').value.trim();
    
    if (!numeroDocumento) {
        mostrarAlerta('El número de documento es requerido', 'warning');
        document.getElementById('clienteNumeroDocumento').focus();
        return;
    }
    
    if (!nombre) {
        mostrarAlerta('El nombre es requerido', 'warning');
        document.getElementById('clienteNombre').focus();
        return;
    }
    
    // Validar email si está presente
    const email = document.getElementById('clienteEmail').value.trim();
    if (email && !validarEmail(email)) {
        mostrarAlerta('El email ingresado no es válido', 'warning');
        document.getElementById('clienteEmail').focus();
        return;
    }

    const clienteData = {
        empresa_id: currentEmpresa.id,
        tipo_documento: document.getElementById('clienteTipoDocumento').value,
        numero_documento: numeroDocumento,
        nombre: nombre,
        apellido: document.getElementById('clienteApellido').value.trim() || null,
        razon_social: document.getElementById('clienteRazonSocial').value.trim() || null,
        email: email || null,
        telefono: document.getElementById('clienteTelefono').value.trim() || null,
        celular: document.getElementById('clienteCelular').value.trim() || null,
        direccion: document.getElementById('clienteDireccion').value.trim() || null,
        ciudad: document.getElementById('clienteCiudad').value.trim() || null,
        departamento: document.getElementById('clienteDepartamento').value.trim() || null,
        pais: document.getElementById('clientePais').value.trim() || 'Colombia',
        limite_credito: parseFloat(document.getElementById('clienteLimiteCredito').value) || 0,
        dias_credito: parseInt(document.getElementById('clienteDiasCredito').value) || 0,
        estado: document.getElementById('clienteEstado').value
    };

    try {
        const url = clienteId ? 
            `${API_URL}/clientes/${clienteId}` : 
            `${API_URL}/clientes`;
        
        const method = clienteId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(clienteData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al guardar cliente');
        }

        mostrarAlerta(
            clienteId ? 'Cliente actualizado exitosamente' : 'Cliente creado exitosamente',
            'success'
        );

        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('clienteModal'));
        modal.hide();

        // Recargar clientes
        await cargarClientes();

    } catch (error) {
        console.error('Error al guardar cliente:', error);
        mostrarAlerta(error.message || 'Error al guardar cliente', 'danger');
    }
}

// ============================================
// ELIMINAR CLIENTE
// ============================================

async function eliminarCliente(id) {
    if (!confirm('¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/clientes/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al eliminar cliente');
        }

        mostrarAlerta('Cliente eliminado exitosamente', 'success');
        await cargarClientes();

    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        mostrarAlerta(error.message || 'Error al eliminar cliente', 'danger');
    }
}

// ============================================
// FILTROS Y BÚSQUEDA
// ============================================

function filtrarClientes() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const tipoDocumento = document.getElementById('filterTipoDocumento').value;
    const estado = document.getElementById('filterEstado').value;

    const clientesFiltrados = clientes.filter(cliente => {
        const matchSearch = !searchTerm || 
            cliente.nombre.toLowerCase().includes(searchTerm) ||
            (cliente.apellido && cliente.apellido.toLowerCase().includes(searchTerm)) ||
            (cliente.razon_social && cliente.razon_social.toLowerCase().includes(searchTerm)) ||
            cliente.numero_documento.includes(searchTerm) ||
            (cliente.email && cliente.email.toLowerCase().includes(searchTerm));

        const matchTipo = !tipoDocumento || cliente.tipo_documento === tipoDocumento;
        const matchEstado = !estado || cliente.estado === estado;

        return matchSearch && matchTipo && matchEstado;
    });

    renderizarClientes(clientesFiltrados);
}

function limpiarFiltros() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterTipoDocumento').value = '';
    document.getElementById('filterEstado').value = '';
    renderizarClientes(clientes);
}

// ============================================
// CERRAR SESIÓN
// ============================================

function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('empresaActiva');
    window.location.href = 'login.html';
}

// ============================================
// UTILIDADES
// ============================================

function mostrarAlerta(mensaje, tipo = 'info') {
    // Crear elemento de alerta
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tipo} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${mensaje}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(alertDiv);

    // Auto-cerrar después de 5 segundos
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}
