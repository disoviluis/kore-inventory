(function () {
  const api = '/api';
  let modal;
  let activeEntity = null;

  const byId = (id) => document.getElementById(id);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const companyQuery = () => `empresa_id=${encodeURIComponent(localStorage.getItem('empresaActiva') || '')}`;

  async function request(path, options = {}) {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${api}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) throw new Error(result.message || `Error HTTP ${response.status}`);
    return result.data;
  }

  function ensureModal() {
    if (modal) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal fade" id="privateEvidenceModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-scrollable"><div class="modal-content">
          <div class="modal-header"><div><h2 class="modal-title h5">Evidencias privadas</h2><small id="privateEvidenceCaption" class="text-muted"></small></div><button class="btn-close" type="button" data-bs-dismiss="modal" aria-label="Cerrar"></button></div>
          <div class="modal-body"><div id="privateEvidenceAlert"></div><form id="privateEvidenceForm" class="row g-2 align-items-end mb-3"><div class="col"><label class="form-label" for="privateEvidenceFile">Archivo (PDF/JPG/PNG/WEBP, hasta 10 MB)</label><input class="form-control" id="privateEvidenceFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required></div><div class="col-auto"><button class="btn btn-primary" type="submit"><i class="bi bi-cloud-arrow-up me-1"></i>Subir</button></div></form><div class="table-responsive"><table class="table table-sm"><thead class="table-light"><tr><th>Archivo</th><th>Tipo</th><th>Tamaño</th><th>Fecha</th><th></th></tr></thead><tbody id="privateEvidenceBody"></tbody></table></div></div>
        </div></div>
      </div>`);
    modal = new bootstrap.Modal(byId('privateEvidenceModal'));
    byId('privateEvidenceForm').addEventListener('submit', uploadEvidence);
  }

  function showError(message, type = 'danger') {
    byId('privateEvidenceAlert').innerHTML = `<div class="alert alert-${type} py-2" role="alert">${escape(message)}</div>`;
  }

  async function loadEvidence() {
    const { type, id } = activeEntity;
    byId('privateEvidenceBody').innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">Cargando evidencias...</td></tr>';
    try {
      const rows = await request(`/evidencias/${encodeURIComponent(type)}/${encodeURIComponent(id)}?${companyQuery()}`);
      byId('privateEvidenceBody').innerHTML = rows.length ? rows.map((file) => `<tr><td>${escape(file.nombre_archivo)}</td><td>${escape(file.mime_type)}</td><td>${(Number(file.tamano_bytes) / 1024 / 1024).toFixed(2)} MB</td><td>${escape(new Date(file.created_at).toLocaleString())}</td><td class="text-end"><a class="btn btn-sm btn-outline-secondary" href="${escape(file.download_url)}" target="_blank" rel="noopener noreferrer" aria-label="Descargar evidencia"><i class="bi bi-download"></i></a></td></tr>`).join('') : '<tr><td colspan="5" class="text-center text-muted py-3">Sin evidencias privadas.</td></tr>';
    } catch (error) {
      byId('privateEvidenceBody').innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No hay permiso para consultar estas evidencias.</td></tr>';
      showError(error.message || 'No se pudo cargar la evidencia');
    }
  }

  async function uploadEvidence(event) {
    event.preventDefault();
    const file = byId('privateEvidenceFile').files[0];
    if (!file || !activeEntity) return;
    let uploadFile = file;
    if (file.type.startsWith('image/') && typeof window.comprimirImagen === 'function') {
      try {
        const compressed = await window.comprimirImagen(file);
        const extension = compressed.mime === 'image/webp' ? 'webp' : 'jpg';
        uploadFile = new File([compressed.blob], `${file.name.replace(/\.[^.]+$/, '')}.${extension}`, { type: compressed.mime });
      } catch (error) {
        showError(error.message || 'No se pudo procesar la imagen.');
        return;
      }
    }
    if (uploadFile.size > 10 * 1024 * 1024) {
      showError('El archivo supera el límite de 10 MB.');
      return;
    }
    const { type, id } = activeEntity;
    const path = `/evidencias/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
    const button = byId('privateEvidenceForm').querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const signature = await request(`${path}/upload-url?${companyQuery()}`, {
        method: 'POST', body: JSON.stringify({ filename: uploadFile.name, content_type: uploadFile.type, tamano_bytes: uploadFile.size })
      });
      const upload = await fetch(signature.upload_url, {
        method: 'PUT', headers: { 'Content-Type': uploadFile.type }, body: uploadFile
      });
      if (!upload.ok) throw new Error('Falló la carga del archivo privado a S3.');
      await request(`${path}/confirmar?${companyQuery()}`, {
        method: 'POST', body: JSON.stringify({ key: signature.key, filename: uploadFile.name, content_type: uploadFile.type, tamano_bytes: uploadFile.size })
      });
      byId('privateEvidenceFile').value = '';
      showError('Evidencia privada guardada.', 'success');
      await loadEvidence();
    } catch (error) {
      showError(error.message || 'No se pudo guardar la evidencia.');
    } finally {
      button.disabled = false;
    }
  }

  window.PrivateEvidence = {
    async open(type, id, label = '', writable = false) {
      ensureModal();
      activeEntity = { type, id };
      byId('privateEvidenceCaption').textContent = label;
      byId('privateEvidenceForm').classList.toggle('d-none', !writable);
      byId('privateEvidenceAlert').innerHTML = '';
      byId('privateEvidenceFile').value = '';
      modal.show();
      await loadEvidence();
    }
  };
})();