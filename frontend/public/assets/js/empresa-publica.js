window.API_URL = window.API_URL || '/api';

const alertContainer = document.getElementById('alertContainer');
const paginaHero = document.getElementById('paginaHero');
const empresaBadge = document.getElementById('empresaBadge');
const paginaTitulo = document.getElementById('paginaTitulo');
const paginaSubtitulo = document.getElementById('paginaSubtitulo');
const paginaDescripcion = document.getElementById('paginaDescripcion');
const empresaLogo = document.getElementById('empresaLogo');
const empresaDescripcion = document.getElementById('empresaDescripcion');
const empresaDetalles = document.getElementById('empresaDetalles');
const contactosInfo = document.getElementById('contactosInfo');
const productosSection = document.getElementById('productosSection');

function showPublicAlert(message, type = 'warning') {
  if (!alertContainer) return;
  alertContainer.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
}

function setHeroBackground(url) {
  if (!paginaHero) return;
  if (url) {
    paginaHero.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('${url}')`;
  } else {
    paginaHero.style.backgroundImage = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }
}

function updateContactoItem(label, value) {
  if (!value) return '';
  return `<li class="mb-2"><strong>${label}:</strong> ${value}</li>`;
}

function renderProductos(productos = [], mostrarPrecios = false) {
  if (!productosSection) return;
  if (!productos || productos.length === 0) {
    productosSection.innerHTML = `
      <div class="col-12">
        <div class="alert alert-light border">No hay productos visibles configurados para esta empresa.</div>
      </div>
    `;
    return;
  }

  productosSection.innerHTML = productos.map(producto => `
    <div class="col-md-6 col-lg-4 mb-4">
      <div class="card producto-card shadow-sm h-100">
        <img src="${producto.imagen_url || 'assets/img/logo-kore-inventory.png'}" class="card-img-top" alt="${producto.nombre}">
        <div class="card-body">
          <h5 class="card-title">${producto.nombre}</h5>
          <p class="card-text text-muted">${producto.descripcion || 'Sin descripción disponible.'}</p>
          ${mostrarPrecios ? `<p class="fw-bold mt-3">$${producto.precio_venta?.toLocaleString('es-CO') || '0'}</p>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

async function loadEmpresaPublica() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if (!slug) {
    showPublicAlert('No se encontró el identificador de la empresa en la URL.', 'danger');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/public/empresa/${encodeURIComponent(slug)}`);
    if (!response.ok) {
      if (response.status === 404) {
        showPublicAlert('Página pública no encontrada o no habilitada.', 'danger');
      } else {
        showPublicAlert('Error al cargar la página pública. Intente de nuevo más tarde.', 'danger');
      }
      return;
    }

    const data = await response.json();
    if (!data.success) {
      showPublicAlert(data.message || 'Error al cargar la página pública.', 'danger');
      return;
    }

    const payload = data.data;
    if (!payload || !payload.empresa || !payload.pagina) {
      showPublicAlert('Datos incompletos de la empresa pública.', 'danger');
      return;
    }

    const empresa = payload.empresa;
    const pagina = payload.pagina;

    if (empresaLogo) {
      empresaLogo.src = empresa.logo_url || 'assets/img/logo-kore-inventory.png';
      empresaLogo.alt = `${empresa.nombre} logo`;
    }

    if (empresaBadge) {
      empresaBadge.textContent = empresa.nombre || 'Empresa pública';
    }

    if (paginaTitulo) paginaTitulo.textContent = pagina.pagina_titulo || empresa.nombre || 'Empresa pública';
    if (paginaSubtitulo) paginaSubtitulo.textContent = pagina.pagina_subtitulo || empresa.slogan || 'Visita nuestra oferta de productos y servicios.';
    if (paginaDescripcion) paginaDescripcion.textContent = pagina.pagina_descripcion || empresa.descripcion || 'Descubre más sobre nuestra empresa y lo que ofrecemos.';
    if (empresaDescripcion) empresaDescripcion.textContent = empresa.descripcion || pagina.pagina_descripcion || 'Información no disponible.';

    if (empresaDetalles) {
      empresaDetalles.innerHTML = [
        updateContactoItem('Teléfono', empresa.telefono),
        updateContactoItem('Email', empresa.email),
        updateContactoItem('Dirección', empresa.direccion),
        updateContactoItem('Ciudad', empresa.ciudad),
        updateContactoItem('País', empresa.pais),
        updateContactoItem('Sitio web', empresa.sitio_web)
      ].join('');
    }

    if (contactosInfo) {
      contactosInfo.innerHTML = `
        ${empresa.telefono ? `<a class="btn btn-light btn-sm" href="tel:${empresa.telefono}"><i class="bi bi-telephone me-2"></i>Contacto</a>` : ''}
        ${empresa.sitio_web ? `<a class="btn btn-outline-light btn-sm" href="${empresa.sitio_web}" target="_blank"><i class="bi bi-globe me-2"></i>Sitio web</a>` : ''}
      `;
    }

    setHeroBackground(pagina.pagina_banner_url);
    renderProductos(payload.productos || [], !!pagina.pagina_mostrar_precios);
  } catch (error) {
    console.error('Error al cargar página pública:', error);
    showPublicAlert('Error al cargar la página pública. Revise su conexión.', 'danger');
  }
}

document.addEventListener('DOMContentLoaded', loadEmpresaPublica);
