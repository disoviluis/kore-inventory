/**
 * =================================
 * KORE INVENTORY - CONFIGURACIÓN
 * =================================
 */

// CAMBIAR A false PARA PRODUCCIÓN
const DEBUG_MODE = true; // true = desarrollo, false = producción
const ENABLE_DEVTOOLS_DETECTION = !DEBUG_MODE; // Detectar F12 en producción

// API URL
const API_URL = 'http://18.191.181.99:3000/api';

// Sistema de logging condicional
const logger = {
    log: (...args) => {
        if (DEBUG_MODE) console.log(...args);
    },
    error: (...args) => {
        // Los errores siempre se muestran
        console.error(...args);
    },
    warn: (...args) => {
        if (DEBUG_MODE) console.warn(...args);
    },
    info: (...args) => {
        if (DEBUG_MODE) console.info(...args);
    }
};

// Protección contra DevTools
if (ENABLE_DEVTOOLS_DETECTION) {
    // Detectar apertura de DevTools
    const devtoolsDetector = () => {
        const threshold = 160;
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;
        
        if (widthThreshold || heightThreshold) {
            document.body.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; font-family: Arial;">
                    <h1 style="color: #dc3545;">⚠️ Acceso No Autorizado</h1>
                    <p>Esta acción ha sido registrada.</p>
                    <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px; cursor: pointer;">Cerrar DevTools y Recargar</button>
                </div>
            `;
        }
    };
    
    // Verificar cada 1 segundo
    setInterval(devtoolsDetector, 1000);
    
    // Deshabilitar click derecho
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });
    
    // Deshabilitar atajos de teclado
    document.addEventListener('keydown', (e) => {
        // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
        if (
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && e.key === 'I') ||
            (e.ctrlKey && e.shiftKey && e.key === 'J') ||
            (e.ctrlKey && e.shiftKey && e.key === 'C') ||
            (e.ctrlKey && e.key === 'u')
        ) {
            e.preventDefault();
            return false;
        }
    });
}

// Función para verificar autenticación
function verificarAutenticacion() {
    const currentPage = window.location.pathname.split('/').pop();
    const token = localStorage.getItem('token');
    
    // Lista de páginas públicas (solo login/index)
    const paginasPublicas = ['index.html', 'login.html', ''];
    
    // Si no es página pública y no hay token, redirigir a login
    if (!paginasPublicas.includes(currentPage) && !token) {
        logger.warn('No autorizado - redirigiendo a login');
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
}

// Verificar autenticación al cargar cualquier página
document.addEventListener('DOMContentLoaded', verificarAutenticacion);

logger.log('🔒 Sistema de seguridad inicializado - Modo:', DEBUG_MODE ? 'DESARROLLO' : 'PRODUCCIÓN');
