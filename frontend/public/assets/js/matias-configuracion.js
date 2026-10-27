window.MatiasConfiguracion = (() => {
    'use strict';

    const getCompanyId = () => {
        const selector = document.getElementById('companySelector');
        return Number(selector?.value || localStorage.getItem('empresaActiva') || 0);
    };

    const headers = () => ({ 'Content-Type': 'application/json' });

    async function load() {
        const empresaId = getCompanyId();
        if (!empresaId) return;
        const response = await fetch(`/api/matias/${empresaId}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'No fue posible cargar Matias');
        render(result.data);
    }

    function render(data) {
        const connection = data.connection;
        const estado = document.getElementById('matiasEstado');
        estado.textContent = connection ? connection.estado.replace(/_/g, ' ') : 'no configurado';
        document.getElementById('matiasEntorno').value = connection?.entorno || 'sandbox';
        document.getElementById('matiasCompanyUuid').value = connection?.matias_company_uuid || '';
        document.getElementById('matiasCompanyId').value = connection?.matias_company_id || '';
        document.getElementById('matiasNit').value = connection?.nit || '';
        document.getElementById('matiasRazonSocial').value = connection?.razon_social || '';
        document.getElementById('matiasBaseUrl').value = connection?.entorno === 'produccion' ? connection.base_url || '' : '';
        document.getElementById('matiasTokenId').textContent = connection?.token_id || 'Sin ID registrado';
        document.getElementById('matiasTienePat').textContent = connection?.tiene_pat ? 'PAT registrado' : 'PAT no registrado';
        document.getElementById('matiasUltimaPrueba').textContent = connection?.ultimo_prueba_at || 'Nunca probado';
        document.getElementById('matiasUltimoError').textContent = connection?.ultimo_error || '';

        const container = document.getElementById('matiasServicios');
        container.innerHTML = (data.services || []).map(service => `
            <div class="border rounded p-3 d-flex justify-content-between align-items-center gap-3">
                <div>
                    <div class="fw-semibold">${escapeHtml(service.nombre)}</div>
                    <small class="text-muted">Contratado: ${service.contratado ? 'Sí' : 'No confirmado'} | Proveedor: ${service.activo_proveedor === null ? 'Desconocido' : (service.activo_proveedor ? 'Activo' : 'Inactivo')}</small>
                </div>
                <div class="form-check form-switch flex-shrink-0">
                    <input class="form-check-input matias-service-toggle" type="checkbox" data-codigo="${escapeHtml(service.codigo)}" ${service.activo_local ? 'checked' : ''}>
                </div>
            </div>
        `).join('');
    }

    async function save() {
        const empresaId = getCompanyId();
        const entorno = document.getElementById('matiasEntorno').value;
        const payload = {
            entorno,
            base_url: document.getElementById('matiasBaseUrl').value.trim(),
            matias_company_uuid: document.getElementById('matiasCompanyUuid').value.trim(),
            matias_company_id: document.getElementById('matiasCompanyId').value.trim(),
            nit: document.getElementById('matiasNit').value.trim(),
            razon_social: document.getElementById('matiasRazonSocial').value.trim(),
            token_id: document.getElementById('matiasTokenIdInput')?.value.trim() || undefined,
            pat: document.getElementById('matiasPat').value.trim() || undefined
        };
        const response = await fetch(`/api/matias/${empresaId}`, { method: 'PUT', headers: headers(), body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'No fue posible guardar la conexion');
        document.getElementById('matiasPat').value = '';
        await load();
        return result;
    }

    async function probe() {
        const empresaId = getCompanyId();
        const entorno = document.getElementById('matiasEntorno').value;
        const response = await fetch(`/api/matias/${empresaId}/probar?entorno=${encodeURIComponent(entorno)}`, { method: 'POST', headers: headers() });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'La prueba de Matias falló');
        await load();
        return result;
    }

    async function revoke() {
        const empresaId = getCompanyId();
        const entorno = document.getElementById('matiasEntorno').value;
        const response = await fetch(`/api/matias/${empresaId}/revocar?entorno=${encodeURIComponent(entorno)}`, { method: 'POST', headers: headers() });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'No fue posible revocar la conexion');
        await load();
        return result;
    }

    async function toggleService(input) {
        const empresaId = getCompanyId();
        const entorno = document.getElementById('matiasEntorno').value;
        const response = await fetch(`/api/matias/${empresaId}/servicios/${encodeURIComponent(input.dataset.codigo)}`, {
            method: 'PUT', headers: headers(), body: JSON.stringify({ entorno, activo: input.checked })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            input.checked = false;
            throw new Error(result.message || 'No fue posible actualizar el servicio');
        }
        return result;
    }

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    function notify(error, success) {
        if (typeof showNotification === 'function') showNotification(error?.message || success, error ? 'danger' : 'success');
    }

    function init() {
        document.getElementById('matiasGuardar')?.addEventListener('click', async () => {
            try { const result = await save(); notify(null, result.message); } catch (error) { notify(error); }
        });
        document.getElementById('matiasProbar')?.addEventListener('click', async () => {
            try { const result = await probe(); notify(null, result.message); } catch (error) { notify(error); }
        });
        document.getElementById('matiasRevocar')?.addEventListener('click', async () => {
            if (!window.confirm('¿Revocar la conexión Matias de este entorno?')) return;
            try { const result = await revoke(); notify(null, result.message); } catch (error) { notify(error); }
        });
        document.getElementById('matiasServicios')?.addEventListener('change', async event => {
            const input = event.target.closest('.matias-service-toggle');
            if (!input) return;
            try { const result = await toggleService(input); notify(null, result.message); } catch (error) { notify(error); }
        });
        document.getElementById('matiasEntorno')?.addEventListener('change', event => {
            const production = event.target.value === 'produccion';
            document.getElementById('matiasBaseUrlGroup').classList.toggle('d-none', !production);
        });
        document.getElementById('matias-tab')?.addEventListener('shown.bs.tab', () => load().catch(error => notify(error)));
        document.getElementById('companySelector')?.addEventListener('change', () => load().catch(error => notify(error)));
    }

    document.addEventListener('DOMContentLoaded', () => {
        init();
        load().catch(error => notify(error));
    });

    return { load, save, probe, revoke };
})();
