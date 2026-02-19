// configuracion-facturacion.js
// Gestión de configuración de facturación

const API_BASE = 'http://localhost:3000/api';
let empresaActual = null;

// ============================
// Inicialización
// ============================

document.addEventListener('DOMContentLoaded', async function() {
    verificarAutenticacion();
    await cargarDatosUsuario();
    await cargarEmpresas();
    inicializarEventos();
    
    // Sidebar toggle
    document.getElementById('toggleSidebar').addEventListener('click', function() {
        document.getElementById('sidebar').classList.toggle('active');
        document.getElementById('sidebarOverlay').classList.toggle('active');
    });
    
    document.getElementById('closeSidebar').addEventListener('click', function() {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('sidebarOverlay').classList.remove('active');
    });
    
    document.getElementById('sidebarOverlay').addEventListener('click', function() {
        document.getElementById('sidebar').classList.remove('active');
        document.getElementById('sidebarOverlay').classList.remove('active');
    });
});

// ============================
// Autenticación y Usuario
// ============================

function verificarAutenticacion() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

async function cargarDatosUsuario() {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const empresa = JSON.parse(localStorage.getItem('empresa') || '{}');
    
    document.getElementById('userName').textContent = usuario.nombre || 'Usuario';
    document.getElementById('userRole').textContent = empresa.nombre || 'Sin empresa';
}

function logout() {
    if (confirm('¿Está seguro de cerrar sesión?')) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

// ============================
// Gestión de Empresas
// ============================

async function cargarEmpresas() {
    try {
        const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
        const empresaId = usuario.empresa_id;
        
        if (!empresaId) {
            mostrarAlerta('No se encontró empresa asociada', 'warning');
            return;
        }
        
        const select = document.getElementById('empresaSelect');
        const empresa = JSON.parse(localStorage.getItem('empresa') || '{}');
        
        select.innerHTML = `<option value="${empresaId}" selected>${empresa.nombre || 'Empresa Actual'}</option>`;
        empresaActual = empresaId;
        
        // Cargar configuración de esta empresa
        await cargarConfiguracion();
        
    } catch (error) {
        console.error('Error cargando empresas:', error);
        mostrarAlerta('Error al cargar empresas', 'danger');
    }
}

// ============================
// Cargar Configuración
// ============================

async function cargarConfiguracion() {
    if (!empresaActual) {
        mostrarAlerta('Seleccione una empresa', 'warning');
        return;
    }
    
    const loadingOverlay = document.getElementById('loadingOverlay');
    const form = document.getElementById('formConfiguracion');
    
    try {
        loadingOverlay.style.display = 'block';
        form.style.display = 'none';
        
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/facturacion/configuracion/${empresaActual}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar configuración');
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
            llenarFormulario(result.data);
        } else {
            // No hay configuración, usar valores por defecto
            resetearFormulario();
        }
        
        form.style.display = 'block';
        
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al cargar la configuración', 'danger');
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

function llenarFormulario(config) {
    // Apariencia
    if (config.color_primario) {
        document.getElementById('colorPrimario').value = config.color_primario;
        document.getElementById('colorPrimarioText').value = config.color_primario;
    }
    if (config.color_secundario) {
        document.getElementById('colorSecundario').value = config.color_secundario;
        document.getElementById('colorSecundarioText').value = config.color_secundario;
    }
    if (config.fuente) {
        document.getElementById('fuente').value = config.fuente;
    }
    if (config.tamano_fuente) {
        document.getElementById('tamanoFuente').value = config.tamano_fuente;
    }
    
    // Elementos visuales
    document.getElementById('mostrarLogo').checked = config.mostrar_logo === 1;
    document.getElementById('mostrarSlogan').checked = config.mostrar_slogan === 1;
    document.getElementById('mostrarQr').checked = config.mostrar_qr === 1;
    document.getElementById('mostrarCufe').checked = config.mostrar_cufe === 1;
    document.getElementById('mostrarFirma').checked = config.mostrar_firma === 1;
    
    if (config.logo_posicion) {
        document.getElementById('logoPosicion').value = config.logo_posicion;
    }
    
    if (config.texto_firma) {
        document.getElementById('textoFirma').value = config.texto_firma;
    }
    
    // Mostrar/ocultar texto de firma
    const mostrarFirma = config.mostrar_firma === 1;
    document.getElementById('textoFirmaContainer').style.display = mostrarFirma ? 'block' : 'none';
    
    // Textos
    if (config.mensaje_agradecimiento) {
        document.getElementById('mensajeAgradecimiento').value = config.mensaje_agradecimiento;
    }
    if (config.notas_predeterminadas) {
        document.getElementById('notasPredeterminadas').value = config.notas_predeterminadas;
    }
    if (config.pie_pagina) {
        document.getElementById('piePagina').value = config.pie_pagina;
    }
    if (config.terminos_condiciones) {
        document.getElementById('terminosCondiciones').value = config.terminos_condiciones;
    }
    
    // Cuentas bancarias
    if (config.cuentas_bancarias) {
        try {
            const cuentas = typeof config.cuentas_bancarias === 'string' 
                ? JSON.parse(config.cuentas_bancarias) 
                : config.cuentas_bancarias;
            
            if (Array.isArray(cuentas) && cuentas.length > 0) {
                cuentas.forEach(cuenta => agregarCuentaBancaria(cuenta));
            }
        } catch (e) {
            console.error('Error parseando cuentas bancarias:', e);
        }
    }
}

function resetearFormulario() {
    // Valores por defecto
    document.getElementById('colorPrimario').value = '#007bff';
    document.getElementById('colorPrimarioText').value = '#007bff';
    document.getElementById('colorSecundario').value = '#6c757d';
    document.getElementById('colorSecundarioText').value = '#6c757d';
    document.getElementById('fuente').value = 'Arial';
    document.getElementById('tamanoFuente').value = '10';
    
    document.getElementById('mostrarLogo').checked = true;
    document.getElementById('mostrarSlogan').checked = true;
    document.getElementById('mostrarQr').checked = true;
    document.getElementById('mostrarCufe').checked = true;
    document.getElementById('mostrarFirma').checked = false;
    
    document.getElementById('logoPosicion').value = 'izquierda';
    document.getElementById('textoFirma').value = '';
    document.getElementById('textoFirmaContainer').style.display = 'none';
    
    document.getElementById('mensajeAgradecimiento').value = 'Gracias por su compra';
    document.getElementById('notasPredeterminadas').value = '';
    document.getElementById('piePagina').value = '';
    document.getElementById('terminosCondiciones').value = '';
    
    // Limpiar cuentas bancarias
    document.getElementById('cuentasBancariasContainer').innerHTML = '';
}

// ============================
// Cuentas Bancarias
// ============================

function agregarCuentaBancaria(cuenta = null) {
    const container = document.getElementById('cuentasBancariasContainer');
    const index = container.children.length;
    
    const cuentaHtml = `
        <div class="cuenta-bancaria-row" data-index="${index}">
            <div class="row g-2">
                <div class="col-md-3">
                    <label class="form-label small">Banco</label>
                    <input type="text" class="form-control form-control-sm cuenta-banco" 
                           value="${cuenta?.banco || ''}" placeholder="Ej: Bancolombia">
                </div>
                <div class="col-md-2">
                    <label class="form-label small">Tipo</label>
                    <select class="form-select form-select-sm cuenta-tipo">
                        <option value="Ahorros" ${cuenta?.tipo === 'Ahorros' ? 'selected' : ''}>Ahorros</option>
                        <option value="Corriente" ${cuenta?.tipo === 'Corriente' ? 'selected' : ''}>Corriente</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <label class="form-label small">Número de Cuenta</label>
                    <input type="text" class="form-control form-control-sm cuenta-numero" 
                           value="${cuenta?.numero || ''}" placeholder="1234567890">
                </div>
                <div class="col-md-3">
                    <label class="form-label small">Titular</label>
                    <input type="text" class="form-control form-control-sm cuenta-titular" 
                           value="${cuenta?.titular || ''}" placeholder="Nombre del titular">
                </div>
                <div class="col-md-1 d-flex align-items-end">
                    <button type="button" class="btn btn-danger btn-sm btn-remove-cuenta" 
                            onclick="eliminarCuentaBancaria(${index})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', cuentaHtml);
}

function eliminarCuentaBancaria(index) {
    const cuenta = document.querySelector(`.cuenta-bancaria-row[data-index="${index}"]`);
    if (cuenta) {
        cuenta.remove();
    }
}

function obtenerCuentasBancarias() {
    const cuentas = [];
    const rows = document.querySelectorAll('.cuenta-bancaria-row');
    
    rows.forEach(row => {
        const banco = row.querySelector('.cuenta-banco').value.trim();
        const tipo = row.querySelector('.cuenta-tipo').value;
        const numero = row.querySelector('.cuenta-numero').value.trim();
        const titular = row.querySelector('.cuenta-titular').value.trim();
        
        if (banco && numero) {
            cuentas.push({ banco, tipo, numero, titular });
        }
    });
    
    return cuentas;
}

// ============================
// Guardar Configuración
// ============================

async function guardarConfiguracion(event) {
    event.preventDefault();
    
    if (!empresaActual) {
        mostrarAlerta('Seleccione una empresa', 'warning');
        return;
    }
    
    const cuentasBancarias = obtenerCuentasBancarias();
    
    const configuracion = {
        mostrar_logo: document.getElementById('mostrarLogo').checked ? 1 : 0,
        logo_posicion: document.getElementById('logoPosicion').value,
        mostrar_slogan: document.getElementById('mostrarSlogan').checked ? 1 : 0,
        color_primario: document.getElementById('colorPrimario').value,
        color_secundario: document.getElementById('colorSecundario').value,
        fuente: document.getElementById('fuente').value,
        tamano_fuente: parseInt(document.getElementById('tamanoFuente').value),
        pie_pagina: document.getElementById('piePagina').value.trim() || null,
        terminos_condiciones: document.getElementById('terminosCondiciones').value.trim() || null,
        notas_predeterminadas: document.getElementById('notasPredeterminadas').value.trim() || null,
        mensaje_agradecimiento: document.getElementById('mensajeAgradecimiento').value.trim() || null,
        mostrar_qr: document.getElementById('mostrarQr').checked ? 1 : 0,
        mostrar_cufe: document.getElementById('mostrarCufe').checked ? 1 : 0,
        mostrar_firma: document.getElementById('mostrarFirma').checked ? 1 : 0,
        texto_firma: document.getElementById('textoFirma').value.trim() || null,
        cuentas_bancarias: cuentasBancarias.length > 0 ? cuentasBancarias : null
    };
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/facturacion/configuracion/${empresaActual}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(configuracion)
        });
        
        const result = await response.json();
        
        if (result.success) {
            mostrarAlerta('Configuración guardada exitosamente', 'success');
        } else {
            throw new Error(result.message || 'Error al guardar');
        }
        
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('Error al guardar la configuración: ' + error.message, 'danger');
    }
}

// ============================
// Eventos
// ============================

function inicializarEventos() {
    // Sincronizar color pickers con inputs de texto
    document.getElementById('colorPrimario').addEventListener('input', function(e) {
        document.getElementById('colorPrimarioText').value = e.target.value;
    });
    
    document.getElementById('colorPrimarioText').addEventListener('input', function(e) {
        if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
            document.getElementById('colorPrimario').value = e.target.value;
        }
    });
    
    document.getElementById('colorSecundario').addEventListener('input', function(e) {
        document.getElementById('colorSecundarioText').value = e.target.value;
    });
    
    document.getElementById('colorSecundarioText').addEventListener('input', function(e) {
        if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
            document.getElementById('colorSecundario').value = e.target.value;
        }
    });
    
    // Toggle texto de firma
    document.getElementById('mostrarFirma').addEventListener('change', function(e) {
        document.getElementById('textoFirmaContainer').style.display = e.target.checked ? 'block' : 'none';
    });
    
    // Agregar cuenta bancaria
    document.getElementById('btnAgregarCuenta').addEventListener('click', function() {
        agregarCuentaBancaria();
    });
    
    // Cambio de empresa
    document.getElementById('empresaSelect').addEventListener('change', async function(e) {
        empresaActual = e.target.value;
        await cargarConfiguracion();
    });
    
    // Submit del formulario
    document.getElementById('formConfiguracion').addEventListener('submit', guardarConfiguracion);
}

// ============================
// Utilidades
// ============================

function mostrarAlerta(mensaje, tipo = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertHtml = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            <i class="bi bi-${tipo === 'success' ? 'check-circle' : tipo === 'danger' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    alertContainer.innerHTML = alertHtml;
    
    // Auto-ocultar después de 5 segundos
    setTimeout(() => {
        const alert = alertContainer.querySelector('.alert');
        if (alert) {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 150);
        }
    }, 5000);
}
