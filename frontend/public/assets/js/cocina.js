const API_URL = '/api';
const MINUTOS_ALERTA = 15;

let empresaId = null;
let idsConocidos = new Set();
let primeraCarga = true;

const token = () => localStorage.getItem('token');

async function api(url, options = {}) {
  const respuesta = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...(options.headers || {}) }
  });
  const datos = await respuesta.json();
  if (!respuesta.ok || !datos.success) throw new Error(datos.message || 'Error en la solicitud');
  return datos.data;
}

// Un pitido corto avisa al cocinero sin depender de archivos externos.
function sonarAviso() {
  if (!document.getElementById('sonidoActivo').checked) return;
  try {
    const contexto = new (window.AudioContext || window.webkitAudioContext)();
    const oscilador = contexto.createOscillator();
    const ganancia = contexto.createGain();
    oscilador.connect(ganancia);
    ganancia.connect(contexto.destination);
    oscilador.frequency.value = 880;
    ganancia.gain.setValueAtTime(0.25, contexto.currentTime);
    ganancia.gain.exponentialRampToValueAtTime(0.01, contexto.currentTime + 0.4);
    oscilador.start();
    oscilador.stop(contexto.currentTime + 0.4);
  } catch {
    // Si el navegador bloquea el audio, el aviso visual sigue funcionando.
  }
}

function ticket(item) {
  const minutos = Number(item.minutos_espera) || 0;
  const demorado = minutos >= MINUTOS_ALERTA && item.estado !== 'listo';
  const clase = demorado ? 'demorado' : item.estado === 'pendiente' ? 'nuevo' : item.estado === 'en_preparacion' ? 'preparando' : 'listo';

  const acciones = item.estado === 'pendiente'
    ? `<button class="btn btn-warning btn-accion" onclick="cambiarEstado(${item.id},'en_preparacion')">Preparar</button>`
    : item.estado === 'en_preparacion'
      ? `<button class="btn btn-success btn-accion" onclick="cambiarEstado(${item.id},'listo')">Listo</button>`
      : '<span class="badge bg-success">Esperando al mesero</span>';

  return `<div class="ticket ${clase}">
    <div class="mesa">${item.mesa_numero || item.cliente_nombre || item.numero_cuenta} · Comanda #${item.numero_comanda}</div>
    <div class="producto">${Number(item.cantidad)} × ${item.producto_nombre}</div>
    ${item.observaciones ? `<div class="nota"><i class="bi bi-exclamation-triangle-fill me-1"></i>${item.observaciones}</div>` : ''}
    <div class="pie">
      <span class="cronometro ${demorado ? 'alerta' : ''}"><i class="bi bi-clock me-1"></i>${minutos} min</span>
      ${acciones}
    </div>
    <div class="mesa mt-1">${(item.mesero_nombre || '').trim()}</div>
  </div>`;
}

async function cargarTablero() {
  const estacion = document.getElementById('selectorEstacion').value;
  const datos = await api(`/comandas/tablero?empresa_id=${empresaId}&estacion=${estacion}`);
  const items = datos.items || [];

  const pendientes = items.filter(item => item.estado === 'pendiente');
  const preparacion = items.filter(item => item.estado === 'en_preparacion');
  const listos = items.filter(item => item.estado === 'listo');

  document.getElementById('conteoPendientes').textContent = pendientes.length;
  document.getElementById('conteoPreparacion').textContent = preparacion.length;
  document.getElementById('conteoListos').textContent = listos.length;

  const vacio = texto => `<div class="vacio">${texto}</div>`;
  document.getElementById('columnaPendientes').innerHTML = pendientes.length ? pendientes.map(ticket).join('') : vacio('Sin pedidos nuevos');
  document.getElementById('columnaPreparacion').innerHTML = preparacion.length ? preparacion.map(ticket).join('') : vacio('Nada en preparación');
  document.getElementById('columnaListos').innerHTML = listos.length ? listos.map(ticket).join('') : vacio('Nada por entregar');

  const idsActuales = new Set(items.map(item => item.id));
  const hayNuevos = pendientes.some(item => !idsConocidos.has(item.id));
  if (hayNuevos && !primeraCarga) sonarAviso();
  idsConocidos = idsActuales;
  primeraCarga = false;

  document.getElementById('ultimaActualizacion').textContent = `Actualizado ${new Date().toLocaleTimeString('es-CO')}`;
}

async function cambiarEstado(itemId, estado) {
  try {
    await api(`/comandas/items/${itemId}/estado`, {
      method: 'PUT',
      body: JSON.stringify({ empresa_id: empresaId, estado })
    });
    await cargarTablero();
  } catch (error) {
    alert(error.message);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!token()) { window.location.href = 'login.html'; return; }

  try {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    const empresas = await api(`/empresas/usuario/${usuario.id}`);
    empresaId = Number(localStorage.getItem('empresaActiva')) || Number(empresas?.[0]?.id);
    if (!empresaId) throw new Error('No hay empresa activa');

    document.getElementById('selectorEstacion').onchange = () => {
      primeraCarga = true;
      cargarTablero().catch(error => alert(error.message));
    };

    await cargarTablero();
    setInterval(() => { cargarTablero().catch(() => {}); }, 8000);
  } catch (error) {
    alert(error.message);
  }
});
