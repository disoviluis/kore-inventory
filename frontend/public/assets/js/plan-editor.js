(function () {
  'use strict';
  let catalogPromise;
  async function catalog() {
    if (!catalogPromise) catalogPromise = fetch('/api/super-admin/planes/catalogo-modulos').then(async response => {
      const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.message || 'No se pudo cargar el catalogo de modulos'); return result.data;
    }).catch(error => { catalogPromise = null; throw error; });
    return catalogPromise;
  }
  async function render(modules) {
    const button = document.querySelector('button[form="planForm"]'); button.disabled = true;
    const status = document.getElementById('planModuleStatus'); status.textContent = '';
    try {
      const entries = await catalog();
      const selected = modules === null ? entries.map(entry => entry.codigo) : modules;
      const container = document.getElementById('planModuleChecks'); container.replaceChildren();
      for (const entry of entries) {
        const column = document.createElement('div'); column.className = 'col-md-4';
        const wrapper = document.createElement('div'); wrapper.className = 'form-check';
        const input = document.createElement('input'); input.type = 'checkbox'; input.className = 'form-check-input'; input.id = `plan-module-${entry.codigo}`; input.value = entry.codigo; input.checked = selected.includes(entry.codigo);
        const label = document.createElement('label'); label.className = 'form-check-label'; label.htmlFor = input.id; label.textContent = entry.nombre;
        wrapper.append(input, label); column.append(wrapper); container.append(column);
      }
      button.disabled = false;
    } catch (error) { status.className = 'alert alert-danger mt-2'; status.textContent = error.message; }
  }
  window.korePlanEditor = {
    reset() {
      document.getElementById('duplicatePlanButton').classList.add('d-none');
      for (const id of ['planMultiBodega', 'planReportesAvanzados', 'planDestacado']) document.getElementById(id).checked = false;
      return render(['pos', 'inventario', 'ventas', 'clientes', 'usuarios', 'roles']);
    },
    async setPlan(plan) {
      document.getElementById('planMultiBodega').checked = Boolean(Number(plan.multi_bodega));
      document.getElementById('planReportesAvanzados').checked = Boolean(Number(plan.reportes_avanzados));
      document.getElementById('planDestacado').checked = Boolean(Number(plan.destacado));
      document.getElementById('duplicatePlanButton').classList.remove('d-none');
      const modules = typeof plan.modulos_incluidos === 'string' ? JSON.parse(plan.modulos_incluidos) : plan.modulos_incluidos;
      await render(modules);
    },
    selectedModules() { return Array.from(document.querySelectorAll('#planModuleChecks input:checked'), input => input.value); }
  };
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('duplicatePlanButton')?.addEventListener('click', () => {
      document.getElementById('planId').value = '';
      const name = document.getElementById('planNombre'); name.value = `${name.value} copia`.slice(0, 50);
      document.getElementById('planModalTitle').textContent = 'Nuevo plan desde copia';
      document.getElementById('duplicatePlanButton').classList.add('d-none');
      document.getElementById('planActivo').value = '0';
    });
  });
})();