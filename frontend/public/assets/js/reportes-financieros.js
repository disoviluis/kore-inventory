const API_URL = '/api';
let empresaActiva = null;

const token = () => localStorage.getItem('token');
const dinero = valor => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor) || 0);

async function api(url) {
  const response = await fetch(`${API_URL}${url}`, { headers: { Authorization: `Bearer ${token()}` } });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || 'Error en la solicitud');
  return data.data;
}

async function cargarEmpresa() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const empresas = await api(`/empresas/usuario/${usuario.id}`);
  const id = Number(localStorage.getItem('empresaActiva')) || Number(empresas?.[0]?.id);
  empresaActiva = empresas.find(empresa => Number(empresa.id) === id) || empresas[0];
  if (!empresaActiva) throw new Error('No hay empresa activa');

  document.getElementById('userName').textContent = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || 'Usuario';
  document.getElementById('userRole').textContent = usuario.tipo_usuario || '-';
  const selector = document.getElementById('companySelector');
  selector.innerHTML = empresas.map(empresa => `<option value="${empresa.id}" ${Number(empresa.id) === Number(empresaActiva.id) ? 'selected' : ''}>${empresa.nombre}</option>`).join('');
  selector.addEventListener('change', () => {
    localStorage.setItem('empresaActiva', selector.value);
    window.location.reload();
  });
}

function fila(concepto, valor, opciones = {}) {
  const clase = opciones.negativo ? 'text-danger' : (opciones.destacado ? 'fw-bold' : '');
  const sangria = opciones.sangria ? 'ps-4 text-muted' : '';
  return `<tr class="${opciones.destacado ? 'table-light' : ''}"><td class="${sangria}">${concepto}</td><td class="text-end ${clase} ${opciones.destacado ? 'fw-bold' : ''}">${dinero(valor)}</td></tr>`;
}

async function generar() {
  const desde = document.getElementById('fechaDesde').value;
  const hasta = document.getElementById('fechaHasta').value;

  const [resultados, flujo] = await Promise.all([
    api(`/finanzas/reportes/estado-resultados?empresaId=${empresaActiva.id}&desde=${desde}&hasta=${hasta}`),
    api(`/finanzas/reportes/flujo-caja?empresaId=${empresaActiva.id}&desde=${desde}&hasta=${hasta}`)
  ]);

  document.getElementById('kpiIngresos').textContent = dinero(resultados.ingresos.total);
  document.getElementById('kpiUtilidadBruta').textContent = dinero(resultados.utilidad_bruta);
  document.getElementById('kpiMargenBruto').textContent = `${resultados.margen_bruto_pct}% de margen`;
  document.getElementById('kpiGastos').textContent = dinero(resultados.gastos.total);
  document.getElementById('kpiUtilidadNeta').textContent = dinero(resultados.utilidad_neta);
  document.getElementById('kpiUtilidadNeta').className = `h4 ${resultados.utilidad_neta >= 0 ? 'text-success' : 'text-danger'}`;
  document.getElementById('kpiMargenNeto').textContent = `${resultados.margen_neto_pct}% de margen`;

  document.getElementById('tablaEstadoResultados').innerHTML = [
    fila(`Ingresos (${resultados.ingresos.facturas} facturas)`, resultados.ingresos.total),
    fila('(-) Costo de ventas', resultados.costo_ventas, { negativo: true }),
    fila('= Utilidad bruta', resultados.utilidad_bruta, { destacado: true }),
    fila('(-) Gastos generales', resultados.gastos.generales, { negativo: true, sangria: true }),
    fila('(-) Gastos de caja', resultados.gastos.caja, { negativo: true, sangria: true }),
    fila('= Utilidad neta', resultados.utilidad_neta, { destacado: true })
  ].join('');

  document.getElementById('tablaFlujoCaja').innerHTML = [
    fila('Ventas de contado', flujo.entradas.ventas_contado, { sangria: true }),
    fila('Cobros a clientes', flujo.entradas.cobros_clientes, { sangria: true }),
    fila('= Total entradas', flujo.total_entradas, { destacado: true }),
    fila('Gastos generales', flujo.salidas.gastos_generales, { negativo: true, sangria: true }),
    fila('Gastos de caja', flujo.salidas.gastos_caja, { negativo: true, sangria: true }),
    fila('Pagos a proveedores', flujo.salidas.pagos_proveedores, { negativo: true, sangria: true }),
    fila('= Total salidas', flujo.total_salidas, { destacado: true }),
    fila('Flujo neto del período', flujo.flujo_neto, { destacado: true }),
    fila('Saldo actual en bancos', flujo.saldo_bancos)
  ].join('');

  const categorias = resultados.gastos.por_categoria || [];
  const totalCategorias = categorias.reduce((suma, item) => suma + Number(item.total), 0);
  document.getElementById('tablaGastosCategoria').innerHTML = categorias.length
    ? categorias.map(item => `<tr><td>${item.categoria}</td><td class="text-end">${dinero(item.total)}</td><td class="text-end text-muted">${totalCategorias > 0 ? Math.round((Number(item.total) / totalCategorias) * 100) : 0}%</td></tr>`).join('')
    : '<tr><td colspan="3" class="text-center text-muted py-3">Sin gastos en el período</td></tr>';
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await cargarEmpresa();
    const hoy = new Date();
    document.getElementById('fechaDesde').value = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
    document.getElementById('fechaHasta').value = hoy.toISOString().slice(0, 10);
    document.getElementById('btnGenerar').onclick = () => generar().catch(error => alert(error.message));
    await generar();
  } catch (error) {
    alert(error.message);
  }
});
