const API_URL = '/api';
let empresaActiva = null;
let cuentas = [];
let ultimoCruce = null;

const token = () => localStorage.getItem('token');
const dinero = valor => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor) || 0);

async function api(url, options = {}) {
  const response = await fetch(`${API_URL}${url}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...(options.headers || {}) } });
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

async function cargarCuentas() {
  cuentas = (await api(`/finanzas/bancos/cuentas?empresa_id=${empresaActiva.id}`)) || [];
  const activas = cuentas.filter(cuenta => Number(cuenta.activo) === 1);
  document.getElementById('selectorCuenta').innerHTML = activas.length
    ? activas.map(cuenta => `<option value="${cuenta.id}">${cuenta.banco} - ${cuenta.nombre}</option>`).join('')
    : '<option value="">No hay cuentas bancarias activas</option>';
}

function periodo() {
  return { desde: document.getElementById('fechaDesde').value, hasta: document.getElementById('fechaHasta').value };
}

function cuentaSeleccionada() {
  return Number(document.getElementById('selectorCuenta').value) || null;
}

async function cargarMovimientos() {
  const cuenta = cuentaSeleccionada();
  const { desde, hasta } = periodo();
  if (!cuenta || !desde || !hasta) { alert('Selecciona la cuenta y el rango de fechas'); return; }
  const data = await api(`/finanzas/bancos/conciliacion/movimientos?empresa_id=${empresaActiva.id}&cuenta_bancaria_id=${cuenta}&desde=${desde}&hasta=${hasta}`);
  document.getElementById('kpiLibros').textContent = data.movimientos.length;
  document.getElementById('tablaSoloLibros').innerHTML = data.movimientos.length
    ? data.movimientos.map(movimiento => `<tr><td>${String(movimiento.fecha_movimiento).slice(0, 10)}</td><td>${movimiento.descripcion}</td><td class="text-end">${dinero(movimiento.valor)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="text-center text-muted py-3">Sin movimientos en el período</td></tr>';
}

function descargarPlantillaExtracto() {
  const filas = [{ Fecha: new Date().toISOString().slice(0, 10), Descripcion: 'Consignación cliente', Referencia: '', Valor: 0 }];
  const libro = XLSX.utils.book_new();
  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 20 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(libro, hoja, 'Extracto');
  XLSX.writeFile(libro, 'plantilla_extracto_bancario.xlsx');
}

function normalizarFecha(valor) {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  const texto = String(valor || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
  const partes = texto.split(/[\/\-]/);
  if (partes.length === 3) {
    const [dia, mes, anio] = partes;
    if (anio.length === 4) return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  return '';
}

async function procesarExtracto(evento) {
  const archivo = evento.target.files[0];
  evento.target.value = '';
  if (!archivo) return;

  const cuenta = cuentaSeleccionada();
  const { desde, hasta } = periodo();
  if (!cuenta || !desde || !hasta) { alert('Selecciona la cuenta y el rango de fechas'); return; }

  try {
    const libro = XLSX.read(await archivo.arrayBuffer(), { cellDates: true });
    const hoja = libro.Sheets['Extracto'] || libro.Sheets[libro.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(hoja);

    const extracto = filas
      .map(fila => ({
        fecha: normalizarFecha(fila.Fecha ?? fila.fecha),
        descripcion: fila.Descripcion ?? fila['Descripción'] ?? '',
        referencia: fila.Referencia ?? fila.referencia ?? '',
        valor: Number(fila.Valor ?? fila.valor)
      }))
      .filter(fila => Number.isFinite(fila.valor) && fila.valor !== 0);

    if (!extracto.length) { alert('El archivo no tiene filas válidas. Revisa las columnas Fecha, Descripcion, Referencia y Valor.'); return; }

    ultimoCruce = await api('/finanzas/bancos/conciliacion/cruzar', {
      method: 'POST',
      body: JSON.stringify({ empresa_id: empresaActiva.id, cuenta_bancaria_id: cuenta, desde, hasta, extracto })
    });
    renderizarCruce();
  } catch (error) {
    alert(error.message);
  }
}

function renderizarCruce() {
  const { resumen, conciliables, solo_libros: soloLibros, solo_banco: soloBanco } = ultimoCruce;

  document.getElementById('kpiLibros').textContent = resumen.movimientos_libros;
  document.getElementById('kpiCoincidencias').textContent = resumen.coincidencias;
  document.getElementById('kpiSoloLibros').textContent = resumen.solo_libros;
  document.getElementById('kpiSoloBanco').textContent = resumen.solo_banco;

  document.getElementById('tablaCoincidencias').innerHTML = conciliables.length
    ? conciliables.map(item => `<tr>
        <td><input type="checkbox" class="form-check-input chk-conciliar" value="${item.movimiento_id}" ${item.ya_conciliado ? 'disabled' : 'checked'}></td>
        <td>${item.fecha_libros}</td><td>${item.descripcion}</td>
        <td>${item.extracto_referencia || '-'}<small class="text-muted d-block">Fila ${item.extracto_fila}</small></td>
        <td class="text-end fw-semibold">${dinero(item.valor)}</td>
        <td>${item.ya_conciliado ? '<span class="badge bg-secondary">Ya conciliado</span>' : '<span class="badge bg-success">Por conciliar</span>'}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="text-center text-muted py-4">Sin coincidencias</td></tr>';

  document.getElementById('tablaSoloLibros').innerHTML = soloLibros.length
    ? soloLibros.map(item => `<tr><td>${item.fecha}</td><td>${item.descripcion}</td><td class="text-end">${dinero(item.valor)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="text-center text-muted py-3">Todo cruzó correctamente</td></tr>';

  document.getElementById('tablaSoloBanco').innerHTML = soloBanco.length
    ? soloBanco.map(item => `<tr><td>${item.fecha || '-'}</td><td>${item.descripcion || '-'}</td><td class="text-end">${dinero(item.valor)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="text-center text-muted py-3">Todo cruzó correctamente</td></tr>';

  document.getElementById('btnCerrarConciliacion').disabled = conciliables.length === 0;
}

async function cerrarConciliacion() {
  if (!ultimoCruce) return;
  const seleccionados = Array.from(document.querySelectorAll('.chk-conciliar:checked')).map(input => Number(input.value));
  if (!seleccionados.length) { alert('Selecciona al menos un movimiento para conciliar'); return; }
  if (!confirm(`Se conciliarán ${seleccionados.length} movimientos y se cerrará el período. ¿Continuar?`)) return;

  const { desde, hasta } = periodo();
  try {
    const resultado = await api('/finanzas/bancos/conciliacion/cerrar', {
      method: 'POST',
      body: JSON.stringify({
        empresa_id: empresaActiva.id,
        cuenta_bancaria_id: cuentaSeleccionada(),
        desde,
        hasta,
        movimientos: seleccionados,
        saldo_extracto: Number(document.getElementById('saldoExtracto').value) || 0
      })
    });
    alert(`Conciliación cerrada. Movimientos conciliados: ${resultado.conciliados}. Diferencia: ${dinero(resultado.diferencia)}`);
    ultimoCruce = null;
    document.getElementById('btnCerrarConciliacion').disabled = true;
    await Promise.all([cargarMovimientos(), cargarHistorial()]);
  } catch (error) {
    alert(error.message);
  }
}

async function cargarHistorial() {
  const historial = await api(`/finanzas/bancos/conciliacion/historial?empresa_id=${empresaActiva.id}`);
  document.getElementById('tablaHistorial').innerHTML = historial.length
    ? historial.map(item => `<tr>
        <td>${item.fecha_desde} a ${item.fecha_hasta}</td>
        <td>${item.banco} - ${item.cuenta_nombre}</td>
        <td class="text-end">${dinero(item.saldo_libros)}</td>
        <td class="text-end">${dinero(item.saldo_extracto)}</td>
        <td class="text-end ${Number(item.diferencia) === 0 ? 'text-success' : 'text-danger'}">${dinero(item.diferencia)}</td>
        <td>${(item.usuario_nombre || '').trim() || '-'}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="text-center text-muted py-3">Sin conciliaciones registradas</td></tr>';
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await cargarEmpresa();
    await cargarCuentas();

    const hoy = new Date();
    document.getElementById('fechaDesde').value = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
    document.getElementById('fechaHasta').value = hoy.toISOString().slice(0, 10);

    document.getElementById('btnCargarMovimientos').onclick = () => cargarMovimientos().catch(error => alert(error.message));
    document.getElementById('btnPlantillaExtracto').onclick = descargarPlantillaExtracto;
    document.getElementById('btnSubirExtracto').onclick = () => document.getElementById('archivoExtracto').click();
    document.getElementById('archivoExtracto').addEventListener('change', procesarExtracto);
    document.getElementById('btnCerrarConciliacion').onclick = cerrarConciliacion;

    await cargarHistorial();
  } catch (error) {
    alert(error.message);
  }
});
