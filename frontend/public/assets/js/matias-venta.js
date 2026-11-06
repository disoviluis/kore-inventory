(function (root) {
    'use strict';
    const active = new Map();
    const labels = {
        created: 'Solicitud registrada', emitting: 'En proceso: no reenviar',
        emitted: 'Enviada: validacion pendiente', accepted: 'Aceptada en Sandbox',
        rejected: 'Rechazada: requiere revision', unknown: 'Resultado incierto: no reenviar',
        voided: 'Documento anulado: requiere revision'
    };

    function safeLink(value) {
        if (!value) return null;
        try {
            const url = new URL(value);
            const allowed = ['matias-api.com', 'dian.gov.co'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
            return allowed && url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
        } catch { return null; }
    }

    function mount({ container, empresaId, venta, usuario, onDocument, onUnauthorized, isCurrent = () => true }) {
        const key = `${empresaId}:${venta.id}`;
        const marker = `matias-sandbox-intento:${key}`;
        const knownDocument = venta.documento_fiscal?.entorno === 'sandbox' ? venta.documento_fiscal : null;
        const state = { disposed: false, busy: false, loaded: false, document: knownDocument, blocked: false };
        if (!Number.isSafeInteger(Number(empresaId)) || !Number.isSafeInteger(Number(venta.id))) {
            throw new Error('Empresa o venta invalida para consultar MATIAS');
        }
        active.get(container)?.();
        const modal = container.closest('.modal');
        const dispose = () => { state.disposed = true; modal?.removeEventListener('hidden.bs.modal', dispose); };
        active.set(container, dispose);
        modal?.addEventListener('hidden.bs.modal', dispose);
        const box = document.createElement('section');
        box.className = 'border rounded p-3 m-3';
        box.setAttribute('aria-label', 'Facturacion MATIAS Sandbox');
        const heading = document.createElement('h6');
        heading.textContent = 'Factura electronica - MATIAS Sandbox';
        const status = document.createElement('p');
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        const details = document.createElement('div');
        details.className = 'small text-break mb-2';
        const refresh = document.createElement('button');
        refresh.type = 'button';
        refresh.className = 'btn btn-outline-secondary btn-sm me-2';
        refresh.textContent = 'Consultar estado registrado';
        const emit = document.createElement('button');
        emit.type = 'button';
        emit.className = 'btn btn-outline-primary btn-sm';
        emit.textContent = 'Emitir en Sandbox';
        emit.disabled = true;
        box.append(heading, status, details, refresh, emit);
        container.replaceChildren(box);
        const canOperate = ['super_admin', 'admin_empresa'].includes(usuario?.tipo_usuario);

        function buttons() {
            refresh.disabled = state.busy;
            emit.disabled = state.busy || !state.loaded || !!state.document || state.blocked ||
                !canOperate || venta.estado !== 'pagada' || !isCurrent() || active.get(container) !== dispose;
        }
        function render() {
            details.replaceChildren();
            if (state.document) {
                const doc = state.document;
                status.textContent = `${labels[doc.estado] || 'Estado no reconocido: requiere revision'}. Solo pruebas, sin validez en Produccion.`;
                if (doc.cufe && doc.estado === 'accepted') {
                    const cufe = document.createElement('p');
                    cufe.textContent = `CUFE Sandbox: ${doc.cufe}`;
                    details.append(cufe);
                    for (const [label, value] of [['Abrir PDF de MATIAS', doc.pdf_path], ['Abrir QR de MATIAS', doc.qr_url]]) {
                        const url = safeLink(value);
                        if (!url) continue;
                        const link = document.createElement('a');
                        link.textContent = label;
                        link.href = url;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.className = 'btn btn-outline-success btn-sm me-2 mb-2';
                        details.append(link);
                    }
                    const note = document.createElement('p');
                    note.textContent = 'Use el PDF de MATIAS como representacion del documento de prueba. Si un enlace no esta disponible, consulte el portal Sandbox.';
                    details.append(note);
                }
                if (doc.estado !== 'accepted') {
                    const note = document.createElement('p');
                    note.textContent = doc.dian_status_description || 'Existe una solicitud fiscal. Consulte MATIAS y al administrador antes de cualquier reintento; esta pantalla no reenvia solicitudes existentes.';
                    details.append(note);
                }
            } else {
                status.textContent = !state.loaded ? 'Estado fiscal sin consultar. No se puede emitir hasta verificarlo.' : state.blocked
                    ? 'Hay un envio iniciado desde este navegador. Consulte su estado con el administrador; no repita el envio.'
                    : 'Venta local sin solicitud Sandbox registrada. No es una factura electronica validada.';
            }
            if (!canOperate) {
                status.textContent += ' La emision y consulta fiscal requieren un administrador de empresa.';
                refresh.disabled = true;
            }
            buttons();
            if (!canOperate) refresh.disabled = true;
        }
        async function api(suffix, body) {
            const token = localStorage.getItem('token');
            if (!token) {
                onUnauthorized?.();
                throw new Error('Debe volver a iniciar sesion');
            }
            const response = await fetch(`/api/matias/${encodeURIComponent(empresaId)}/ventas/${encodeURIComponent(venta.id)}/${suffix}`, {
                method: body === undefined ? 'GET' : 'POST',
                headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
                ...(body === undefined ? {} : { body: JSON.stringify(body) })
            });
            if (response.status === 401) {
                onUnauthorized?.();
                throw new Error('Su sesion vencio; vuelva a iniciar sesion');
            }
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || `Error MATIAS HTTP ${response.status}`);
            return result;
        }
        async function load() {
            const result = await api('documento?entorno=sandbox');
            if (state.disposed || !isCurrent()) return;
            if (result.data !== null && (!result.data || result.data.entorno !== 'sandbox' || !result.data.id || !result.data.estado)) {
                throw new Error('La consulta no devolvio un estado Sandbox valido');
            }
            state.document = result.data;
            state.loaded = true;
            venta.documento_fiscal = result.data;
            onDocument?.(result.data);
        }
        async function consult() {
            if (state.busy || state.disposed || !canOperate) return;
            state.busy = true;
            buttons();
            status.textContent = 'Consultando estado fiscal...';
            try {
                state.blocked = sessionStorage.getItem(marker) === 'iniciado';
                await load();
                if (!state.disposed) render();
            } catch (error) {
                state.loaded = false;
                if (!state.disposed) status.textContent = `No se pudo consultar el estado fiscal: ${error.message}`;
            } finally { state.busy = false; if (!state.disposed) buttons(); }
        }
        async function emitInvoice() {
            if (emit.disabled || state.disposed) return;
            state.busy = true;
            buttons();
            status.textContent = 'Validando la venta y su estado fiscal...';
            let sendStarted = false;
            try {
                await load();
                if (state.disposed || !isCurrent()) return;
                if (state.document) { render(); return; }
                const preview = await api('previsualizar-sandbox', {});
                if (state.disposed || !isCurrent()) return;
                if (preview.data?.ready !== true) throw new Error('La previsualizacion no confirma que la venta este lista');
                const payload = preview.data.payload;
                const totals = preview.data.reconciliation;
                if (!totals || !['gross', 'withholdings', 'net'].every(field => totals[field] != null && Number.isFinite(Number(totals[field])))) {
                    throw new Error('La previsualizacion no contiene totales conciliados validos');
                }
                const confirmed = root.confirm(
                    `Emitir SOLO en MATIAS Sandbox\nVenta: ${venta.numero_factura}\nTotal neto: $${totals.net}\n` +
                    `Bruto con impuestos: $${totals.gross}\nRetenciones: $${totals.withholdings}\n` +
                    `Cliente: ${payload.customer.company_name}\nDocumento: ${payload.customer.dni}\n` +
                    `Advertencias:\n${(preview.data.warnings || []).join('\n') || 'Ninguna'}\n\n` +
                    'Revise los datos del cliente. No se volvera a cobrar ni a mover inventario. No tiene validez en Produccion. Confirmar envio?'
                );
                if (!confirmed || state.disposed || !isCurrent()) { render(); return; }
                // A lost response must not make an unconfirmed POST look safe to repeat.
                sessionStorage.setItem(marker, 'iniciado');
                state.blocked = true;
                sendStarted = true;
                status.textContent = 'Enviando a MATIAS Sandbox. Espere el resultado y no reenvie.';
                const result = await api('emitir-sandbox', {});
                await load();
                if (!state.disposed) {
                    render();
                    status.textContent += state.document
                        ? ` ${result.message}`
                        : ' El envio respondio, pero no se confirmo el documento registrado. No reenvie; consulte al administrador.';
                }
            } catch (error) {
                const message = error.message;
                if (sendStarted) {
                    try { await load(); }
                    catch (lookupError) { if (!state.disposed) status.textContent = `${message}. No se pudo consultar el resultado: ${lookupError.message}. No reenvie.`; return; }
                }
                if (!state.disposed) { render(); status.textContent += ` Error: ${message}${sendStarted ? '. No reenvie; revise el estado.' : ''}`; }
            } finally { state.busy = false; if (!state.disposed) buttons(); }
        }
        refresh.addEventListener('click', consult);
        emit.addEventListener('click', emitInvoice);
        if (canOperate) consult();
        else render();
        return dispose;
    }
    root.MatiasVenta = { mount, safeLink };
})(typeof globalThis !== 'undefined' ? globalThis : this);
