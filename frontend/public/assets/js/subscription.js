(async function () {
  'use strict';
  let companyId;
  let plans = [];
  let documents = [];
  let canManage = false;
  const money = amount => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 }).format(amount);
  const alert = (text, error = false) => {
    const element = document.getElementById('subscriptionAlert'); element.className = `alert alert-${error ? 'danger' : 'success'}`; element.textContent = text;
  };
  async function api(path, body) {
    const response = await fetch(`/api/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.message || 'No se pudo consultar la suscripcion'); return data.data;
  }
  function updateTotal() {
    const plan = plans.find(plan => plan.id === Number(document.getElementById('selectedPlan').value));
    const annual = document.getElementById('planPeriod').value === 'anual';
    document.getElementById('planMonths').disabled = annual;
    const total = plan ? Number(annual ? plan.precio_anual : Number(plan.precio_mensual) * Number(document.getElementById('planMonths').value)) : 0;
    document.getElementById('subscriptionTotal').textContent = total > 0 ? `Total: ${money(total)}` : 'Precio no disponible para este periodo';
  }
  function appendCell(row, text) { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); return cell; }
  async function loadSubscription() {
    const data = await api(`suscripciones/${companyId}`);
    plans = data.planes; canManage = data.puede_gestionar;
    document.getElementById('subscriptionState').textContent = data.vigente ? `Vigente | ${data.licencia?.plan_nombre || 'Prueba gratuita'} | Vence: ${new Date(data.licencia?.fin_at || data.empresa.trial_fin_at).toLocaleString('es-CO')}` : 'Sin suscripcion vigente';
    const container = document.getElementById('subscriptionPlans'); container.replaceChildren();
    const selector = document.getElementById('selectedPlan'); selector.replaceChildren();
    for (const plan of plans) {
      selector.add(new Option(plan.nombre, plan.id));
      const column = document.createElement('div'); column.className = 'col-md-4';
      const item = document.createElement('div'); item.className = 'border rounded p-3 h-100 bg-white';
      const title = document.createElement('h3'); title.className = 'h6'; title.textContent = plan.nombre;
      const price = document.createElement('p'); price.textContent = `${money(plan.precio_mensual)}/mes | ${Number(plan.precio_anual) > 0 ? money(plan.precio_anual) + '/ano' : 'Sin tarifa anual'}`;
      const limits = document.createElement('p'); limits.className = 'small mb-0'; limits.textContent = `Usuarios: ${plan.max_usuarios_por_empresa ?? 'sin limite'} | Productos: ${plan.max_productos ?? 'sin limite'} | Facturas/mes: ${plan.max_facturas_mes ?? 'sin limite'}`;
      item.append(title, price, limits); column.append(item); container.append(column);
    }
    document.getElementById('subscriptionRequest').classList.toggle('d-none', !canManage);
    const history = document.getElementById('subscriptionHistory'); history.replaceChildren();
    for (const request of data.solicitudes) {
      const row = document.createElement('tr'); appendCell(row, `#${request.id}`); appendCell(row, new Date(request.created_at).toLocaleDateString('es-CO'));
      appendCell(row, money(request.monto)); appendCell(row, request.estado); appendCell(row, request.referencia || '-'); const actions = appendCell(row, '');
      if (request.estado === 'pendiente' && canManage) {
        const button = document.createElement('button'); button.className = 'btn btn-sm btn-outline-danger'; button.title = 'Cancelar solicitud'; button.setAttribute('aria-label', 'Cancelar solicitud'); button.innerHTML = '<i class="bi bi-x-circle"></i>';
        button.onclick = async () => { if (!confirm('Cancelar esta solicitud sin realizar ningun cobro?')) return;
          try { await api(`suscripciones/${companyId}/solicitudes/${request.id}/cancelar`, {}); await loadSubscription(); } catch (error) { alert(error.message, true); } };
        actions.append(button);
      }
      history.append(row);
    }
    updateTotal();
  }
  try {
    const session = await api('auth/verify');
    localStorage.setItem('usuario', JSON.stringify(session.usuario));
    const companies = await api(`empresas/usuario/${session.usuario.id}`);
    const selector = document.getElementById('subscriptionCompany');
    for (const company of companies) selector.add(new Option(company.nombre, company.id));
    let activeCompany = null;
    try { activeCompany = JSON.parse(localStorage.getItem('empresaActiva') || 'null'); } catch { }
    companyId = Number(new URLSearchParams(location.search).get('empresa_id')) ||
      Number(activeCompany && typeof activeCompany === 'object' ? activeCompany.id || activeCompany.empresa_id : activeCompany) || Number(companies[0]?.id);
    if (!companies.some(company => company.id === companyId)) companyId = Number(companies[0]?.id);
    if (!companyId) throw new Error('No tiene empresas asignadas');
    selector.value = String(companyId);
    selector.onchange = async () => { companyId = Number(selector.value); try { await loadSubscription(); } catch (error) { alert(error.message, true); } };
    documents = await api('public/documentos-legales');
    const legal = document.getElementById('subscriptionLegal');
    for (const documentData of documents) {
      const row = document.createElement('div'); row.className = 'form-check mb-2'; const input = document.createElement('input');
      input.type = 'checkbox'; input.className = 'form-check-input'; input.required = true; input.id = `subscription-legal-${documentData.id}`;
      const label = document.createElement('label'); label.className = 'form-check-label'; label.htmlFor = input.id; label.append('Acepto ');
      const link = document.createElement('a'); link.href = `documentos-legales.html?tipo=${documentData.tipo}`; link.target = '_blank'; link.rel = 'noopener'; link.textContent = `${documentData.titulo} (${documentData.version})`; label.append(link); row.append(input, label); legal.append(row);
    }
    await loadSubscription();
    for (const id of ['selectedPlan', 'planPeriod', 'planMonths']) document.getElementById(id).addEventListener('input', updateTotal);
    document.getElementById('subscriptionRequest').addEventListener('submit', async event => {
      event.preventDefault(); const button = event.currentTarget.querySelector('button[type=submit]'); button.disabled = true;
      try {
        await api(`suscripciones/${companyId}/solicitudes`, { plan_id: Number(document.getElementById('selectedPlan').value), periodicidad: document.getElementById('planPeriod').value,
          meses: Number(document.getElementById('planMonths').value), observaciones: document.getElementById('paymentNotes').value,
          aceptaciones: documents.filter(documentData => document.getElementById(`subscription-legal-${documentData.id}`).checked).map(documentData => ({ id: documentData.id, hash: documentData.hash })) });
        alert('Solicitud pendiente. Super Admin debe confirmar el pago recibido antes de activar la licencia.'); await loadSubscription();
      } catch (error) { alert(error.message, true); } finally { button.disabled = false; }
    });
  } catch (error) { alert(error.message, true); }
})();