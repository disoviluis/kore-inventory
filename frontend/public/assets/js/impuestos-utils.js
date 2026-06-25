/**
 * ========================================
 * KORE INVENTORY - IMPUESTOS UTILS
 * Compartir carga y caché de impuestos entre páginas
 * ========================================
 */
(function() {
  const API_BASE_URL = typeof API_URL !== 'undefined' ? API_URL : '/api';
  const GLOBAL_NAME = 'impuestosUtils';

  if (window[GLOBAL_NAME]) {
    return;
  }

  window.impuestosGlobalCache = window.impuestosGlobalCache || [];
  window.impuestosGlobalEmpresaId = window.impuestosGlobalEmpresaId || null;

  window.impuestosUtils = {
    getApiUrl() {
      return typeof API_URL !== 'undefined' ? API_URL : API_BASE_URL;
    },

    getEmpresaActivaId() {
      return localStorage.getItem('empresaActiva');
    },

    hasImpuestosLoaded() {
      return Array.isArray(window.impuestosGlobalCache) && window.impuestosGlobalCache.length > 0;
    },

    getImpuestoById(id) {
      if (!id) return null;
      return (window.impuestosGlobalCache || []).find(item => String(item.id) === String(id));
    },

    getImpuestosActivos() {
      return (window.impuestosGlobalCache || []).filter(item => Number(item.activo) === 1);
    },

    async cargarImpuestosGlobales(empresaId) {
      empresaId = empresaId || this.getEmpresaActivaId();
      if (!empresaId) {
        console.warn('impuestosUtils: No hay empresa activa para cargar impuestos');
        return [];
      }

      if (window.impuestosGlobalEmpresaId === empresaId && this.hasImpuestosLoaded()) {
        return window.impuestosGlobalCache;
      }

      try {
        const response = await fetch(`${this.getApiUrl()}/impuestos?empresaId=${empresaId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Error al cargar impuestos (${response.status})`);
        }

        const data = await response.json();
        window.impuestosGlobalCache = data.data || [];
        window.impuestosGlobalEmpresaId = empresaId;
        window.dispatchEvent(new CustomEvent('impuestosActualizados', {
          detail: { impuestos: window.impuestosGlobalCache, empresaId }
        }));
        return window.impuestosGlobalCache;
      } catch (error) {
        console.error('impuestosUtils: Error cargando impuestos globales:', error);
        window.impuestosGlobalCache = [];
        window.impuestosGlobalEmpresaId = null;
        return [];
      }
    }
  };
})();
