const API_URL = '/api';

let usuario = null;
let empresaId = null;
let productos = [];
let categorias = [];
let cuentas = [];
let cuentaActiva = null;
let categoriaFiltro = 'todas';
let productoSeleccionado = null;
let propinaPorcentajeElegido = null;

const OBSERVACIONES_RAPIDAS = ['Sin cebolla', 'Sin picante', 'Término medio', 'Bien cocido', 'Para llevar', 'Sin sal', 'Extra queso', 'Aparte'];
const PORCENTAJES_PROPINA = [0, 5, 10, 15, 20];

const token = () => localStorage.getItem('token');
const dinero = valor => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor) || 0);

async function api(url, options = {}) {
  const respuesta = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...(options.headers || {}) }
  });
  const datos = await respuesta.json();
  if (!respuesta.ok || !datos.success) throw new Error(datos.message || 'Error en la solicitud');
  return datos.data;
}

function avisar(mensaje, tipo = 'success') {
  const alerta = document.createElement('div');
  alerta.className = `alert alert-${tipo} position-fixed top-0 start-50 translate-middle-x mt-2 shadow`;
  alerta.style.zIndex = '2000';
  alerta.textContent = mensaje;
  document.body.appendChild(alerta);
  setTimeout(() => alerta.remove(), 2600);
}

// ─── NAVEGACIÓN ───────────────────────────────────────────────────────────────
const TITULOS = { mesas: 'Mesas', pedido: 'Tomar pedido', pedidos: 'Mis pedidos', cuenta: 'Cuenta' };

function irAVista(vista) {
  if ((vista === 'pedido' || vista === 'cuenta') && !cuentaActiva) {
    avisar('Primero selecciona una mesa', 'warning');
    return;
  }
  document.querySelectorAll('.vista').forEach(seccion => seccion.classList.remove('activa'));
  document.getElementById(`vista${vista.charAt(0).toUpperCase()}${vista.slice(1)}`).classList.add('activa');
  document.querySelectorAll('.barra-inferior button').forEach(boton => boton.classList.toggle('activa', boton.dataset.vista === vista));
  document.getElementById('tituloVista').textContent = TITULOS[vista];

  if (vista === 'mesas') cargarCuentas();
  if (vista === 'pedidos') cargarMisPedidos();
  if (vista === 'cuenta') cargarCuenta();
}

// ─── MESAS ────────────────────────────────────────────────────────────────────
async function cargarCuentas() {
  const datos = await api(`/comandas/mesas?empresa_id=${empresaId}`);
  cuentas = datos.cuentas || [];
  const contenedor = document.getElementById('listaCuentas');

  if (!cuentas.length) {
    contenedor.innerHTML = '<div class="vacio"><i class="bi bi-cup-hot"></i>No hay cuentas abiertas</div>';
    return;
  }

  contenedor.innerHTML = cuentas.map(cuenta => {
    const clase = Number(cuenta.items_listos) > 0 ? 'listo' : cuenta.cuenta_solicitada ? 'solicitada' : 'ocupada';
    const etiquetas = [];
    if (Number(cuenta.items_listos) > 0) etiquetas.push(`<span class="badge bg-success">${cuenta.items_listos} listo(s)</span>`);
    if (Number(cuenta.items_sin_enviar) > 0) etiquetas.push(`<span class="badge bg-warning text-dark">${cuenta.items_sin_enviar} sin enviar</span>`);
    if (cuenta.cuenta_solicitada) etiquetas.push('<span class="badge bg-dark">Pidió la cuenta</span>');

    return `<div class="card tarjeta-mesa ${clase}" onclick="seleccionarCuenta(${cuenta.id})">
      <div class="card-body py-3">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="fw-bold">${cuenta.mesa_numero || cuenta.cliente_nombre || cuenta.numero_cuenta}</div>
            <small class="text-muted">${cuenta.numero_cuenta} · ${cuenta.items} producto(s)</small>
            <div class="mt-1 d-flex gap-1 flex-wrap">${etiquetas.join('')}</div>
          </div>
          <div class="text-end">
            <div class="fw-bold text-primary">${dinero(cuenta.total)}</div>
            <small class="text-muted">${(cuenta.mesero_nombre || '').trim()}</small>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function seleccionarCuenta(id) {
  cuentaActiva = cuentas.find(cuenta => cuenta.id === id);
  document.getElementById('pedidoMesa').textContent = cuentaActiva.mesa_numero || cuentaActiva.cliente_nombre;
  document.getElementById('pedidoCliente').textContent = cuentaActiva.numero_cuenta;
  irAVista('pedido');
}

async function crearCuenta(evento) {
  evento.preventDefault();
  const tipo = document.getElementById('nuevaTipo').value;
  const mesa = document.getElementById('nuevaMesa').value.trim();
  const nombre = document.getElementById('nuevaNombre').value.trim();

  try {
    const cuenta = await api('/cuentas-abiertas', {
      method: 'POST',
      body: JSON.stringify({
        empresa_id: empresaId,
        tipo_identificacion: tipo,
        mesa_numero: tipo === 'mesa' ? (mesa || nombre) : null,
        cliente_nombre: nombre
      })
    });
    bootstrap.Modal.getInstance(document.getElementById('modalNuevaCuenta')).hide();
    evento.target.reset();
    await cargarCuentas();
    seleccionarCuenta(cuenta.cuenta_id);
    avisar('Cuenta abierta');
  } catch (error) {
    avisar(error.message, 'danger');
  }
}

// ─── PRODUCTOS ────────────────────────────────────────────────────────────────
function precioDe(producto) {
  return producto.en_promocion_activa && producto.precio_promocion
    ? Number(producto.precio_promocion)
    : Number(producto.precio_minorista || 0);
}

function renderizarCategorias() {
  const chips = ['<button class="chip activa" data-categoria="todas">Todas</button>']
    .concat(categorias.map(categoria => `<button class="chip" data-categoria="${categoria.id}">${categoria.nombre}</button>`));
  const contenedor = document.getElementById('chipsCategorias');
  contenedor.innerHTML = chips.join('');
  contenedor.querySelectorAll('.chip').forEach(chip => {
    chip.onclick = () => {
      contenedor.querySelectorAll('.chip').forEach(otro => otro.classList.remove('activa'));
      chip.classList.add('activa');
      categoriaFiltro = chip.dataset.categoria;
      renderizarProductos();
    };
  });
}

function renderizarProductos() {
  const texto = document.getElementById('buscadorProducto').value.trim().toLowerCase();
  const filtrados = productos.filter(producto => {
    const coincideCategoria = categoriaFiltro === 'todas' || String(producto.categoria_id) === String(categoriaFiltro);
    const coincideTexto = !texto ||
      producto.nombre.toLowerCase().includes(texto) ||
      String(producto.sku || '').toLowerCase().includes(texto);
    return coincideCategoria && coincideTexto;
  });

  document.getElementById('gridProductos').innerHTML = filtrados.length
    ? filtrados.map(producto => `<button class="card-producto" onclick="abrirProducto(${producto.id})">
        <div class="nombre">${producto.nombre}</div>
        <small class="text-muted">${producto.sku || ''}</small>
        <div class="precio">${dinero(precioDe(producto))}</div>
      </button>`).join('')
    : '<div class="vacio"><i class="bi bi-search"></i>Sin resultados</div>';
}

function abrirProducto(id) {
  productoSeleccionado = productos.find(producto => producto.id === id);
  document.getElementById('modalProductoNombre').textContent = productoSeleccionado.nombre;
  document.getElementById('modalCantidad').value = 1;
  document.getElementById('modalObservaciones').value = '';

  const chips = document.getElementById('chipsObservaciones');
  chips.innerHTML = OBSERVACIONES_RAPIDAS.map(texto => `<button type="button" class="chip">${texto}</button>`).join('');
  chips.querySelectorAll('.chip').forEach(chip => {
    chip.onclick = () => {
      const campo = document.getElementById('modalObservaciones');
      campo.value = campo.value ? `${campo.value}, ${chip.textContent}` : chip.textContent;
    };
  });

  new bootstrap.Modal(document.getElementById('modalProducto')).show();
}

function cambiarCantidad(delta) {
  const campo = document.getElementById('modalCantidad');
  campo.value = Math.max(1, (Number(campo.value) || 1) + delta);
}

async function agregarProducto() {
  const cantidad = Number(document.getElementById('modalCantidad').value) || 1;
  const notas = document.getElementById('modalObservaciones').value.trim();

  try {
    await api(`/cuentas-abiertas/${cuentaActiva.id}/items`, {
      method: 'POST',
      body: JSON.stringify({
        empresa_id: empresaId,
        producto_id: productoSeleccionado.id,
        cantidad,
        precio_unitario: precioDe(productoSeleccionado),
        notas: notas || null
      })
    });
    bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide();
    avisar(`${productoSeleccionado.nombre} agregado`);
    await actualizarCarrito();
  } catch (error) {
    avisar(error.message, 'danger');
  }
}

async function actualizarCarrito() {
  const datos = await api(`/comandas/mesas?empresa_id=${empresaId}`);
  cuentas = datos.cuentas || [];
  const actual = cuentas.find(cuenta => cuenta.id === cuentaActiva.id);
  const sinEnviar = actual ? Number(actual.items_sin_enviar) : 0;
  cuentaActiva = actual || cuentaActiva;
  document.getElementById('carritoConteo').textContent = sinEnviar;
  document.getElementById('carritoFlotante').style.display = sinEnviar > 0 ? 'block' : 'none';
}

async function enviarACocina() {
  try {
    const resultado = await api('/comandas', {
      method: 'POST',
      body: JSON.stringify({ empresa_id: empresaId, cuenta_abierta_id: cuentaActiva.id })
    });
    avisar(`Comanda #${resultado.numero_comanda} enviada`);
    await actualizarCarrito();
  } catch (error) {
    avisar(error.message, 'danger');
  }
}

// ─── MIS PEDIDOS ──────────────────────────────────────────────────────────────
async function cargarMisPedidos() {
  const items = await api(`/comandas/mis-comandas?empresa_id=${empresaId}`);
  const listos = items.filter(item => item.estado === 'listo').length;
  const contador = document.getElementById('contadorListos');
  contador.style.display = listos > 0 ? 'inline-block' : 'none';
  contador.textContent = listos;

  const etiquetas = { pendiente: 'En espera', en_preparacion: 'Preparando', listo: 'LISTO' };
  document.getElementById('listaMisPedidos').innerHTML = items.length
    ? items.map(item => `<div class="card tarjeta-mesa estado-${item.estado}">
        <div class="card-body py-2 d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-semibold">${item.cantidad} × ${item.producto_nombre}</div>
            <small class="text-muted">${item.mesa_numero || item.cliente_nombre} · Comanda #${item.numero_comanda}</small>
            ${item.observaciones ? `<div class="small text-danger">${item.observaciones}</div>` : ''}
          </div>
          <div class="text-end">
            <span class="badge ${item.estado === 'listo' ? 'bg-success' : item.estado === 'en_preparacion' ? 'bg-warning text-dark' : 'bg-secondary'}">${etiquetas[item.estado]}</span>
            ${item.estado === 'listo' ? `<button class="btn btn-sm btn-success mt-2 d-block w-100" onclick="marcarEntregado(${item.id})">Entregué</button>` : ''}
          </div>
        </div>
      </div>`).join('')
    : '<div class="vacio"><i class="bi bi-check2-circle"></i>No tienes pedidos en curso</div>';
}

async function marcarEntregado(itemId) {
  try {
    await api(`/comandas/items/${itemId}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ empresa_id: empresaId, estado: 'entregado' })
    });
    await cargarMisPedidos();
  } catch (error) {
    avisar(error.message, 'danger');
  }
}

// ─── CUENTA ───────────────────────────────────────────────────────────────────
async function cargarCuenta() {
  const datos = await api(`/comandas/cuenta/${cuentaActiva.id}/resumen?empresa_id=${empresaId}`);

  document.getElementById('detalleCuenta').innerHTML = `
    <div class="card mb-3"><div class="card-body">
      <h6 class="fw-bold mb-1">${datos.cuenta.mesa_numero || datos.cuenta.cliente_nombre}</h6>
      <small class="text-muted">${datos.cuenta.numero_cuenta}</small>
      <hr class="my-2">
      ${datos.items.map(item => `<div class="d-flex justify-content-between small py-1">
        <div>${item.cantidad} × ${item.producto_nombre}${item.notas ? `<div class="text-danger" style="font-size:.72rem">${item.notas}</div>` : ''}</div>
        <div>${dinero(item.total)}</div>
      </div>`).join('')}
      <hr class="my-2">
      <div class="d-flex justify-content-between"><span>Consumo</span><strong>${dinero(datos.total_consumo)}</strong></div>
      <div class="d-flex justify-content-between ${datos.propina.aceptada ? 'text-success' : 'text-muted'}">
        <span>Propina ${datos.propina.aceptada ? `(${datos.propina.porcentaje}%)` : `sugerida ${datos.propina.sugerida_porcentaje}%`}</span>
        <span>${dinero(datos.propina.valor)}</span>
      </div>
      <hr class="my-2">
      <div class="d-flex justify-content-between fs-5"><strong>Total a pagar</strong><strong class="text-primary">${dinero(datos.total_a_pagar)}</strong></div>
      <div class="alert alert-light border mt-2 mb-0 py-2" style="font-size:.72rem">
        La propina es voluntaria. El cliente puede aceptarla, modificarla o rechazarla.
      </div>
    </div></div>
    <button class="btn btn-outline-primary w-100 py-3 mb-2" onclick="abrirPropina(${datos.subtotal})">
      <i class="bi bi-cash-coin me-2"></i>${datos.propina.aceptada ? 'Cambiar propina' : 'Preguntar por propina'}
    </button>
    <button class="btn btn-warning w-100 py-3 fw-semibold" onclick="solicitarCuenta()" ${datos.cuenta.cuenta_solicitada ? 'disabled' : ''}>
      <i class="bi bi-bell me-2"></i>${datos.cuenta.cuenta_solicitada ? 'Cuenta solicitada' : 'Solicitar cuenta en caja'}
    </button>`;
}

function abrirPropina(base) {
  propinaPorcentajeElegido = null;
  document.getElementById('propinaValor').value = '';
  const chips = document.getElementById('chipsPropina');
  chips.innerHTML = PORCENTAJES_PROPINA.map(porcentaje => `<button type="button" class="chip" data-porcentaje="${porcentaje}">${porcentaje}%</button>`).join('');
  chips.querySelectorAll('.chip').forEach(chip => {
    chip.onclick = () => {
      chips.querySelectorAll('.chip').forEach(otro => otro.classList.remove('activa'));
      chip.classList.add('activa');
      propinaPorcentajeElegido = Number(chip.dataset.porcentaje);
      document.getElementById('propinaValor').value = '';
      document.getElementById('previoPropina').textContent = `Propina: ${dinero(base * propinaPorcentajeElegido / 100)}`;
    };
  });
  document.getElementById('previoPropina').textContent = 'Selecciona un porcentaje o escribe un valor.';
  new bootstrap.Modal(document.getElementById('modalPropina')).show();
}

async function guardarPropina(acepta) {
  const valor = document.getElementById('propinaValor').value;
  const cuerpo = { empresa_id: empresaId, acepta };
  if (acepta) {
    if (valor) cuerpo.valor = Number(valor);
    else if (propinaPorcentajeElegido !== null) cuerpo.porcentaje = propinaPorcentajeElegido;
    else { avisar('Selecciona un porcentaje o escribe un valor', 'warning'); return; }
  }

  try {
    const resultado = await api(`/comandas/cuenta/${cuentaActiva.id}/propina`, { method: 'POST', body: JSON.stringify(cuerpo) });
    bootstrap.Modal.getInstance(document.getElementById('modalPropina')).hide();
    avisar(acepta ? `Total a pagar: ${dinero(resultado.total_a_pagar)}` : 'Registrado sin propina');
    await cargarCuenta();
  } catch (error) {
    avisar(error.message, 'danger');
  }
}

async function solicitarCuenta() {
  try {
    await api(`/comandas/cuenta/${cuentaActiva.id}/solicitar`, { method: 'POST', body: JSON.stringify({ empresa_id: empresaId }) });
    avisar('Caja fue notificada');
    await cargarCuenta();
  } catch (error) {
    avisar(error.message, 'danger');
  }
}

// ─── INICIO ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (!token()) { window.location.href = 'login.html'; return; }

  try {
    usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const empresas = await api(`/empresas/usuario/${usuario.id}`);
    empresaId = Number(localStorage.getItem('empresaActiva')) || Number(empresas?.[0]?.id);
    if (!empresaId) throw new Error('No hay empresa activa');

    document.getElementById('infoMesero').textContent = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim();

    const [listaProductos, listaCategorias] = await Promise.all([
      api(`/productos?empresaId=${empresaId}`),
      api(`/categorias?empresaId=${empresaId}`)
    ]);
    productos = (listaProductos || []).filter(producto => producto.estado === 'activo');
    categorias = listaCategorias || [];

    renderizarCategorias();
    renderizarProductos();
    await cargarCuentas();
    await cargarMisPedidos();

    document.querySelectorAll('.barra-inferior button').forEach(boton => {
      boton.onclick = () => irAVista(boton.dataset.vista);
    });
    document.getElementById('btnRecargar').onclick = () => location.reload();
    document.getElementById('btnNuevaCuenta').onclick = () => new bootstrap.Modal(document.getElementById('modalNuevaCuenta')).show();
    document.getElementById('formNuevaCuenta').addEventListener('submit', crearCuenta);
    document.getElementById('nuevaTipo').onchange = evento => {
      document.getElementById('campoMesa').style.display = evento.target.value === 'mesa' ? 'block' : 'none';
    };
    document.getElementById('buscadorProducto').addEventListener('input', renderizarProductos);
    document.getElementById('btnAgregarProducto').onclick = agregarProducto;
    document.getElementById('btnEnviarCocina').onclick = enviarACocina;
    document.getElementById('btnConfirmarPropina').onclick = () => guardarPropina(true);
    document.getElementById('btnSinPropina').onclick = () => guardarPropina(false);

    // El mesero necesita enterarse pronto de que un plato quedó listo.
    setInterval(() => { cargarMisPedidos().catch(() => {}); }, 8000);
  } catch (error) {
    avisar(error.message, 'danger');
  }
});
