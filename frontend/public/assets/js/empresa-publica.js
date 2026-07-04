/* ==========================================================
   EMPRESA PÚBLICA — Página de catálogo público por empresa
   ========================================================== */
window.API_URL = window.API_URL || '/api';

// ── Helpers ──────────────────────────────────────────────
function showAlert(msg, type = 'warning') {
  const c = document.getElementById('alertContainer');
  if (c) c.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${msg}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>`;
}

function fmt(num) {
  return (num || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });
}

function whatsappUrl(numero, msg = '') {
  const n = (numero || '').replace(/\D/g, '');
  return `https://wa.me/${n}${msg ? '?text=' + encodeURIComponent(msg) : ''}`;
}

function socialUrl(red, valor) {
  if (!valor) return null;
  if (valor.startsWith('http')) return valor;
  if (red === 'facebook') return `https://facebook.com/${valor.replace('@', '')}`;
  if (red === 'instagram') return `https://instagram.com/${valor.replace('@', '')}`;
  if (red === 'tiktok') return `https://tiktok.com/@${valor.replace('@', '')}`;
  return valor;
}

// ── Plantilla y color ─────────────────────────────────────
function aplicarPlantilla(plantilla, colorPrimario) {
  const body = document.body;
  body.classList.remove('plantilla-clasica', 'plantilla-moderna', 'plantilla-minimalista');
  body.classList.add(`plantilla-${plantilla || 'clasica'}`);

  const color = colorPrimario || '#0d6efd';
  document.documentElement.style.setProperty('--color-primario', color);
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  document.documentElement.style.setProperty('--color-primario-rgb', `${r},${g},${b}`);
}

// ── Hero ─────────────────────────────────────────────────
function renderHero(empresa, pagina) {
  const titulo = pagina.pagina_titulo || empresa.nombre || 'Bienvenidos';
  const subtitulo = pagina.pagina_subtitulo || empresa.slogan || '';
  const descripcion = pagina.pagina_descripcion || empresa.descripcion || '';
  const bannerUrl = pagina.pagina_banner_url;
  const logoUrl = empresa.logo_url;
  const whatsapp = pagina.pagina_whatsapp;

  document.getElementById('pageTitle').textContent = `${empresa.nombre} — Catálogo`;
  document.getElementById('pageDesc').setAttribute('content', descripcion || subtitulo);

  const navLogo = document.getElementById('navLogo');
  if (logoUrl) { navLogo.src = logoUrl; navLogo.style.display = 'block'; }
  document.getElementById('navNombre').textContent = empresa.nombre || '';

  const hero = document.querySelector('.ep-hero');
  if (bannerUrl) {
    hero.style.backgroundImage = `url('${bannerUrl}')`;
    hero.classList.add('has-banner');
  }

  document.getElementById('heroTitulo').textContent = titulo;
  document.getElementById('heroSubtitulo').textContent = subtitulo;
  document.getElementById('heroDescripcion').textContent = descripcion;

  const heroLogo = document.getElementById('heroLogo');
  if (logoUrl) { heroLogo.src = logoUrl; heroLogo.alt = empresa.nombre; heroLogo.style.display = 'block'; }

  const heroBotones = document.getElementById('heroBotones');
  const btns = [];
  if (whatsapp) {
    btns.push(`<a href="${whatsappUrl(whatsapp, `Hola ${empresa.nombre}! Vi su catálogo y quiero información.`)}" target="_blank" class="btn btn-wa rounded-pill px-4"><i class="bi bi-whatsapp me-2"></i>WhatsApp</a>`);
  }
  if (empresa.telefono && !whatsapp) {
    btns.push(`<a href="tel:${empresa.telefono}" class="btn btn-light rounded-pill px-4"><i class="bi bi-telephone me-2"></i>${empresa.telefono}</a>`);
  }
  if (empresa.sitio_web) {
    btns.push(`<a href="${empresa.sitio_web}" target="_blank" class="btn btn-outline-light rounded-pill px-4"><i class="bi bi-globe me-2"></i>Sitio web</a>`);
  }
  heroBotones.innerHTML = btns.join('');

  if (whatsapp) {
    const waUrl = whatsappUrl(whatsapp, `Hola ${empresa.nombre}!`);
    const navWa = document.getElementById('navWhatsapp');
    navWa.href = waUrl;
    document.getElementById('navWhatsappItem').style.display = '';
    const waFlot = document.getElementById('waFlotante');
    waFlot.href = waUrl;
    waFlot.style.display = 'flex';
  }
}

// ── Catálogo ─────────────────────────────────────────────
let todosProductos = [];

function renderCatalogo(productos, pagina) {
  todosProductos = productos || [];
  const grid = document.getElementById('productosGrid');
  const badge = document.getElementById('totalProductosBadge');
  const promoBanner = document.getElementById('promoBanner');
  const mostrarPrecios = pagina.pagina_mostrar_precios !== 0;
  const mostrarPromos = pagina.pagina_mostrar_promociones !== 0;

  if (!todosProductos.length) {
    grid.innerHTML = `<div class="col-12 text-center py-5 text-muted"><i class="bi bi-box-seam" style="font-size:3rem"></i><p class="mt-3">No hay productos disponibles.</p></div>`;
    return;
  }

  badge.textContent = `${todosProductos.length} productos`;
  badge.style.display = '';

  const enPromo = todosProductos.filter(p => p.en_promocion_activa == 1);
  if (mostrarPromos && enPromo.length > 0) {
    document.getElementById('promoCount').textContent = enPromo.length;
    promoBanner.style.display = '';
  }

  const categorias = [...new Set(todosProductos.map(p => p.categoria_nombre).filter(Boolean))];
  const filtros = document.getElementById('filtrosCatalogo');
  if (categorias.length > 1) {
    filtros.innerHTML = `<button class="btn btn-sm btn-primary rounded-pill" onclick="filtrarCatalogo('all')">Todos</button>` +
      categorias.map(c => `<button class="btn btn-sm btn-outline-secondary rounded-pill" onclick="filtrarCatalogo('${c}')">${c}</button>`).join('');
  }

  renderGrid(todosProductos, mostrarPrecios, mostrarPromos);
}

window.filtrarCatalogo = function(categoria) {
  const pagina = window._paginaConfig || {};
  const mostrarPrecios = pagina.pagina_mostrar_precios !== 0;
  const mostrarPromos = pagina.pagina_mostrar_promociones !== 0;
  const filtrados = categoria === 'all' ? todosProductos : todosProductos.filter(p => p.categoria_nombre === categoria);
  renderGrid(filtrados, mostrarPrecios, mostrarPromos);
  document.querySelectorAll('#filtrosCatalogo button').forEach(b => {
    const esActivo = b.textContent === 'Todos' ? categoria === 'all' : b.textContent === categoria;
    b.classList.toggle('btn-primary', esActivo);
    b.classList.toggle('btn-outline-secondary', !esActivo);
  });
};

function renderGrid(productos, mostrarPrecios, mostrarPromos) {
  const grid = document.getElementById('productosGrid');
  grid.innerHTML = productos.map(p => {
    const enPromo = mostrarPromos && p.en_promocion_activa == 1 && p.precio_promocion;
    const imgHtml = p.imagen_url
      ? `<img src="${p.imagen_url}" class="card-img-top" alt="${p.nombre}" onerror="this.style.display='none;this.parentElement.innerHTML='<div class=card-img-top d-flex align-items-center justify-content-center bg-light text-secondary style=height:190px><i class=bi bi-image style=font-size:2rem></i></div>'">`
      : `<div class="card-img-top d-flex align-items-center justify-content-center bg-light text-secondary" style="height:190px"><i class="bi bi-image" style="font-size:2rem"></i></div>`;

    let precioHtml = '';
    if (mostrarPrecios && p.precio_venta != null) {
      precioHtml = enPromo
        ? `<div class="mt-2"><span class="precio-tachado">$${fmt(p.precio_venta)}</span> <span class="precio-promo ms-1 fs-5">$${fmt(p.precio_promocion)}</span></div>`
        : `<p class="fw-bold fs-6 mt-2 mb-0">$${fmt(p.precio_venta)}</p>`;
    }

    const promoBadge = enPromo ? `<span class="position-absolute top-0 end-0 m-2 badge promo-badge"><i class="bi bi-tag-fill me-1"></i>PROMO</span>` : '';

    return `
      <div class="col-sm-6 col-lg-4">
        <div class="card h-100 shadow-sm card-producto">
          <div class="position-relative">${imgHtml}${promoBadge}</div>
          <div class="card-body">
            <h6 class="card-title fw-semibold mb-1">${p.nombre}</h6>
            <p class="card-text text-muted small mb-0">${p.descripcion || ''}</p>
            ${precioHtml}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── Horario ───────────────────────────────────────────────
function renderHorario(horarioTexto) {
  if (!horarioTexto) return;
  const lineas = horarioTexto.split('\n').filter(l => l.trim());
  if (!lineas.length) return;
  const section = document.getElementById('horarioSection');
  section.style.display = '';
  document.getElementById('horarioContenido').innerHTML = lineas.map(l =>
    `<div class="horario-linea d-flex align-items-center gap-2 py-2">
      <i class="bi bi-clock text-secondary"></i>
      <span>${l.trim()}</span>
    </div>`
  ).join('');
  document.getElementById('contactoCol').className = 'col-lg-7';
}

// ── Contacto ─────────────────────────────────────────────
function renderContacto(empresa, pagina) {
  const detalles = [];
  if (empresa.direccion) detalles.push(`<i class="bi bi-geo-alt text-secondary me-2"></i>${empresa.direccion}${empresa.ciudad ? ', ' + empresa.ciudad : ''}`);
  if (empresa.telefono) detalles.push(`<a href="tel:${empresa.telefono}" class="text-decoration-none text-body"><i class="bi bi-telephone text-secondary me-2"></i>${empresa.telefono}</a>`);
  if (empresa.email) detalles.push(`<a href="mailto:${empresa.email}" class="text-decoration-none text-body"><i class="bi bi-envelope text-secondary me-2"></i>${empresa.email}</a>`);
  if (empresa.sitio_web) detalles.push(`<a href="${empresa.sitio_web}" target="_blank" class="text-decoration-none text-body"><i class="bi bi-globe text-secondary me-2"></i>${empresa.sitio_web}</a>`);

  document.getElementById('contactoDetalles').innerHTML = detalles.map(d => `<p class="mb-2">${d}</p>`).join('');

  const acciones = [];
  if (pagina.pagina_whatsapp) {
    acciones.push(`<a href="${whatsappUrl(pagina.pagina_whatsapp, `Hola ${empresa.nombre}! Vi su catálogo.`)}" target="_blank" class="btn btn-wa rounded-pill px-4 ep-btn-accion"><i class="bi bi-whatsapp me-2"></i>Escribir por WhatsApp</a>`);
  }
  if (empresa.email) {
    acciones.push(`<a href="mailto:${empresa.email}" class="btn btn-outline-secondary rounded-pill px-4"><i class="bi bi-envelope me-2"></i>Enviar email</a>`);
  }
  document.getElementById('contactoAcciones').innerHTML = `<div class="d-flex flex-wrap gap-2 mb-3">${acciones.join('')}</div>`;

  const redes = [];
  if (pagina.pagina_instagram) redes.push(`<a href="${socialUrl('instagram', pagina.pagina_instagram)}" target="_blank" class="social-icon" style="background:#e1306c;color:#fff" title="Instagram"><i class="bi bi-instagram"></i></a>`);
  if (pagina.pagina_facebook) redes.push(`<a href="${socialUrl('facebook', pagina.pagina_facebook)}" target="_blank" class="social-icon" style="background:#1877f2;color:#fff" title="Facebook"><i class="bi bi-facebook"></i></a>`);
  if (pagina.pagina_tiktok) redes.push(`<a href="${socialUrl('tiktok', pagina.pagina_tiktok)}" target="_blank" class="social-icon" style="background:#010101;color:#fff" title="TikTok"><i class="bi bi-tiktok"></i></a>`);
  if (redes.length) {
    document.getElementById('contactoRedes').innerHTML = `<div class="d-flex gap-2 align-items-center"><span class="text-muted small me-1">Síguenos:</span>${redes.join('')}</div>`;
  }

  document.getElementById('footerNombre').textContent = `© ${new Date().getFullYear()} ${empresa.nombre || ''}`;
}

// ── Carga principal ───────────────────────────────────────
async function loadEmpresaPublica() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if (!slug) {
    showAlert('No se encontró el identificador de la empresa en la URL.', 'danger');
    document.getElementById('productosGrid').innerHTML = '';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/public/empresa/${encodeURIComponent(slug)}`);
    if (!response.ok) {
      showAlert(response.status === 404
        ? 'Página pública no encontrada o no habilitada.'
        : 'Error al cargar la página. Intenta de nuevo más tarde.', 'danger');
      document.getElementById('productosGrid').innerHTML = '';
      return;
    }

    const data = await response.json();
    if (!data.success || !data.data) {
      showAlert(data.message || 'Error al cargar la página pública.', 'danger');
      return;
    }

    const { empresa, pagina, productos } = data.data;
    window._paginaConfig = pagina;

    aplicarPlantilla(pagina.pagina_plantilla, pagina.pagina_color_primario);
    renderHero(empresa, pagina);
    renderCatalogo(productos, pagina);
    renderHorario(pagina.pagina_horario);
    renderContacto(empresa, pagina);

  } catch (error) {
    console.error('Error al cargar página pública:', error);
    showAlert('Error de conexión. Revisa tu internet e intenta de nuevo.', 'danger');
  }
}

document.addEventListener('DOMContentLoaded', loadEmpresaPublica);
