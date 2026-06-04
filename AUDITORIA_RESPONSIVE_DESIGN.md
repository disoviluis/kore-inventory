# 📱 Auditoría Responsive Design - Kore Inventory

**Fecha Inicio**: 4 de Junio 2026  
**Objetivo**: Optimizar UI para móviles/tablets manteniendo toda la funcionalidad de desktop  
**Criterio de Éxito**: UI profesional, amigable y funcional en todos los dispositivos

---

## 🎯 Estrategia General

### Principios de Diseño Móvil:
1. **Mobile-First**: Priorizar experiencia móvil
2. **Touch-Friendly**: Botones mínimo 44x44px
3. **Navegación Clara**: Menús accesibles, breadcrumbs visibles
4. **Información Progresiva**: Mostrar lo esencial primero
5. **Gestos Nativos**: Swipe, tap, long-press donde tenga sentido

### Breakpoints Recomendados:
```css
/* Mobile (Portrait) */
@media (max-width: 576px) { }

/* Mobile (Landscape) / Small Tablets */
@media (min-width: 577px) and (max-width: 768px) { }

/* Tablets */
@media (min-width: 769px) and (max-width: 992px) { }

/* Desktop */
@media (min-width: 993px) { }
```

---

## 🔥 PRIORIDAD 0: CRÍTICO (Implementar PRIMERO)

### 1. Selector de Empresa (Super Admin)

**Problema Reportado**: 
> "En móvil no podía seleccionar la empresa porque no tiene el selector de empresas"

#### Análisis Desktop:
- [ ] ¿Dónde está el selector? (Navbar, sidebar, modal)
- [ ] ¿Cómo se activa? (Dropdown, modal)
- [ ] ¿Qué muestra? (Lista empresas, búsqueda, filtros)

#### Problemas Móvil:
- [ ] Selector oculto o fuera de viewport
- [ ] Click area muy pequeña
- [ ] Dropdown cortado por límites de pantalla
- [ ] z-index incorrecto (detrás de otros elementos)

#### Soluciones Propuestas:

**Opción A: Modal Full-Screen** (Recomendado)
```html
<!-- Botón visible en mobile navbar -->
<button class="btn-empresa-mobile d-md-none" onclick="abrirModalEmpresas()">
  <i class="bi bi-building"></i>
  <span class="empresa-nombre">CIGARRERIA AC</span>
  <i class="bi bi-chevron-down"></i>
</button>

<!-- Modal full-screen solo en móvil -->
<div class="modal modal-empresa-selector">
  <div class="modal-content">
    <div class="modal-header">
      <h5>Seleccionar Empresa</h5>
      <button class="btn-close" onclick="cerrarModalEmpresas()"></button>
    </div>
    <div class="modal-body">
      <!-- Búsqueda -->
      <input type="text" placeholder="Buscar empresa..." class="form-control mb-3">
      
      <!-- Lista de empresas (touch-friendly) -->
      <div class="empresas-list">
        <div class="empresa-item" data-id="28">
          <div class="empresa-info">
            <h6>CIGARRERIA AC</h6>
            <small>NIT: 1016085506-8</small>
          </div>
          <i class="bi bi-check-circle text-success"></i>
        </div>
        <!-- Más empresas... -->
      </div>
    </div>
  </div>
</div>

<style>
/* Mobile: Full-screen modal */
@media (max-width: 768px) {
  .modal-empresa-selector .modal-content {
    width: 100vw;
    height: 100vh;
    max-width: none;
    margin: 0;
    border-radius: 0;
  }
  
  .empresa-item {
    padding: 16px;
    min-height: 60px; /* Touch-friendly */
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .empresa-item:active {
    background-color: #f0f0f0;
  }
}
</style>
```

**Opción B: Bottom Sheet** (Estilo nativo móvil)
```html
<!-- Slide-up panel desde abajo -->
<div class="bottom-sheet empresa-selector">
  <div class="bottom-sheet-handle"></div>
  <div class="bottom-sheet-content">
    <!-- Contenido similar al modal -->
  </div>
</div>

<style>
@media (max-width: 768px) {
  .bottom-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
    transform: translateY(100%);
    transition: transform 0.3s ease;
    z-index: 9999;
    max-height: 70vh;
    overflow-y: auto;
  }
  
  .bottom-sheet.active {
    transform: translateY(0);
  }
  
  .bottom-sheet-handle {
    width: 40px;
    height: 4px;
    background: #ccc;
    border-radius: 2px;
    margin: 12px auto;
  }
}
</style>
```

#### Plan Implementación:
- [ ] **Paso 1**: Identificar archivo del selector (buscar en navbar/header)
- [ ] **Paso 2**: Agregar botón visible en mobile
- [ ] **Paso 3**: Crear modal full-screen responsive
- [ ] **Paso 4**: Ajustar z-index y overlay
- [ ] **Paso 5**: Testing en 3 tamaños: 375px, 768px, 1024px

---

### 2. Módulo Punto de Venta (POS)

**Problema Reportado**: 
> "La UI es confusa y no se ve bien distribuida en móvil"

#### Análisis Desktop (ventas.html):

**Layout Desktop** (estimado según arquitectura típica):
```
┌─────────────────────────────────────────────────────┐
│  Header/Navbar                                      │
├──────────────┬──────────────────────────────────────┤
│              │  Panel Productos                     │
│  Sidebar     │  - Categorías                        │
│  - Búsqueda  │  - Grid productos (cards)            │
│  - Filtros   │                                      │
│              ├──────────────────────────────────────┤
│              │  Panel Carrito                       │
│              │  - Productos agregados               │
│              │  - Totales                           │
│              │  - Botones: Guardar/Cuenta Abierta   │
└──────────────┴──────────────────────────────────────┘
```

#### Problemas Típicos en Móvil:

**A. Layout**:
- [ ] 2-3 columnas forzadas → todo se comprime
- [ ] Sidebar ocupa mucho espacio horizontal
- [ ] Grid productos (4-6 cols desktop) → ilegible en móvil
- [ ] Carrito lateral no visible (fuera de viewport)

**B. Interacción**:
- [ ] Botones pequeños (difícil tocar)
- [ ] Inputs de cantidad difíciles de modificar
- [ ] Scroll confuso (múltiples áreas con scroll)
- [ ] Info crítica oculta (totales, métodos de pago)

**C. Navegación**:
- [ ] Menú hamburguesa mal implementado
- [ ] No hay breadcrumbs
- [ ] Difícil volver atrás
- [ ] Modal cuentas abiertas cortado

#### Soluciones Propuestas:

**Layout Móvil Optimizado**:

```
┌──────────────────────┐
│ Header Compacto      │
│ [☰] POS [🛒 3] [👤] │
├──────────────────────┤
│ 🔍 Buscar producto   │
├──────────────────────┤
│ [Cat1][Cat2][Cat3]   │ ← Scroll horizontal
├──────────────────────┤
│                      │
│  Producto 1          │ ← 1 columna
│  [IMG] Nombre        │   Cards grandes
│  $10.000   [+]       │   Touch-friendly
│                      │
│  Producto 2          │
│  [IMG] Nombre        │
│  $15.000   [+]       │
│                      │
├──────────────────────┤
│ [Ver Carrito (3)] 💰 │ ← Botón flotante sticky
└──────────────────────┘

Al tocar "Ver Carrito":
┌──────────────────────┐
│ [←] Carrito          │
├──────────────────────┤
│ Aguardiente Antq x2  │
│ $50.000   [-][+][🗑] │
│                      │
│ Cervila x1           │
│ $3.000    [-][+][🗑] │
├──────────────────────┤
│ Subtotal    $53.000  │
│ Descuento        $0  │
│ TOTAL       $53.000  │
├──────────────────────┤
│ [💰 Pagar]           │ ← Grande, prominente
│ [📋 Guardar Cuenta]  │
└──────────────────────┘
```

**Características Clave**:

1. **Navegación por Pestañas/Vistas**:
```javascript
// Estados de vista móvil
const vistasMovil = {
  PRODUCTOS: 'productos',
  CARRITO: 'carrito',
  CUENTAS_ABIERTAS: 'cuentas_abiertas',
  PAGO: 'pago'
};

let vistaActual = vistasMovil.PRODUCTOS;

function cambiarVista(nuevaVista) {
  // Ocultar todas
  document.querySelectorAll('.vista-pos').forEach(v => v.classList.add('d-none'));
  
  // Mostrar la seleccionada
  document.querySelector(`#vista-${nuevaVista}`).classList.remove('d-none');
  
  vistaActual = nuevaVista;
  actualizarNavegacion();
}
```

2. **Botón Carrito Flotante** (Badge con cantidad):
```html
<button class="btn-carrito-flotante d-md-none" onclick="cambiarVista('carrito')">
  <i class="bi bi-cart3"></i>
  <span class="badge">3</span>
  <span class="total">$53.000</span>
</button>

<style>
@media (max-width: 768px) {
  .btn-carrito-flotante {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #1E40AF;
    color: white;
    border: none;
    border-radius: 50px;
    padding: 12px 24px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    min-height: 56px; /* Touch-friendly */
  }
  
  .btn-carrito-flotante .badge {
    background: red;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
  }
}
</style>
```

3. **Grid Productos Responsive**:
```css
/* Desktop: 4 columnas */
@media (min-width: 993px) {
  .productos-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
}

/* Tablet: 2-3 columnas */
@media (min-width: 577px) and (max-width: 992px) {
  .productos-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
}

/* Mobile: 1 columna con cards horizontales */
@media (max-width: 576px) {
  .productos-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .producto-card {
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 12px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    min-height: 80px; /* Touch-friendly */
  }
  
  .producto-card img {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 8px;
    margin-right: 12px;
  }
  
  .producto-info {
    flex: 1;
  }
  
  .producto-nombre {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 4px;
  }
  
  .producto-precio {
    font-size: 16px;
    font-weight: bold;
    color: #1E40AF;
  }
  
  .btn-agregar {
    min-width: 44px;
    min-height: 44px;
    border-radius: 50%;
    background: #1E40AF;
    color: white;
    border: none;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
```

4. **Modal Cuentas Abiertas Responsive**:
```css
@media (max-width: 768px) {
  .modal-cuentas-abiertas .modal-dialog {
    margin: 0;
    max-width: 100%;
    height: 100vh;
  }
  
  .modal-cuentas-abiertas .modal-content {
    height: 100%;
    border-radius: 0;
  }
  
  .cuenta-item {
    padding: 16px;
    min-height: 80px;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .cuenta-item:active {
    background-color: #f0f0f0;
  }
  
  .cuenta-acciones {
    display: flex;
    gap: 8px;
  }
  
  .cuenta-acciones button {
    min-width: 44px;
    min-height: 44px;
  }
}
```

#### Plan Implementación POS Móvil:

**Fase 1: Análisis y Wireframes** (Hoy)
- [ ] Abrir ventas.html en DevTools (375px width)
- [ ] Screenshot de estado actual
- [ ] Identificar todos los elementos (sidebar, grid, carrito, modals)
- [ ] Crear wireframe móvil propuesto
- [ ] Documentar clases CSS a modificar

**Fase 2: Quick Wins** (1-2 horas)
- [ ] Agregar `d-none d-md-block` a sidebar en móvil
- [ ] Grid productos: 4 cols → 1 col en mobile
- [ ] Botón carrito flotante
- [ ] Fix tamaños mínimos botones (44x44px)
- [ ] Modal cuentas abiertas full-screen

**Fase 3: Refactoring Layout** (2-4 horas)
- [ ] Sistema de vistas (productos/carrito/pago)
- [ ] Navegación entre vistas con animaciones
- [ ] Badge contador en carrito flotante
- [ ] Optimizar formulario de pago para móvil
- [ ] Testing exhaustivo gestos touch

**Fase 4: Polish** (1-2 horas)
- [ ] Animaciones fluidas
- [ ] Loading states
- [ ] Offline indicators
- [ ] Feedback táctil (haptic si PWA)

---

## ⚡ PRIORIDAD 1: ALTA

### 3. Módulo Inventario

#### Problemas Anticipados:
- Tabla con muchas columnas → scroll horizontal incómodo
- Botones acción (editar/eliminar) muy pequeños
- Filtros apilados verticalmente ocupan mucho espacio
- Imágenes productos no se ven bien

#### Soluciones:
- **Cards en móvil** en lugar de tabla
- **Swipe actions** (deslizar para editar/eliminar)
- **Filtros en modal/drawer**
- **Búsqueda prominente**

### 4. Módulo Clientes

Similar a inventario - mismo patrón de solución.

---

## 📊 PRIORIDAD 2: MEDIA

### 5. Dashboard
### 6. Reportes

---

## 🔧 PRIORIDAD 3: BAJA

### 7. Configuración

---

## 🛠️ Herramientas de Testing

### Chrome DevTools - Device Mode:
```
F12 → Toggle Device Toolbar (Ctrl+Shift+M)

Dispositivos a probar:
- iPhone SE (375x667) - Móvil pequeño
- iPhone 12 Pro (390x844) - Móvil estándar
- iPad Air (820x1180) - Tablet
- Galaxy S20 (360x800) - Android
```

### Responsive Design Checker:
```
https://responsivedesignchecker.com
```

### Testing Real:
- [ ] iPhone físico (si disponible)
- [ ] Android físico (si disponible)
- [ ] iPad/Tablet (si disponible)

---

## 📋 Checklist General Por Módulo

Antes de marcar como "completo":

### Funcionalidad:
- [ ] Todas las funciones desktop disponibles en móvil
- [ ] Botones mínimo 44x44px (recomendación Apple/Google)
- [ ] Inputs fácil de tocar y escribir
- [ ] Modals full-screen o bottom-sheet
- [ ] Navegación clara (back button visible)

### Visual:
- [ ] Texto legible (mínimo 16px body)
- [ ] Contraste adecuado (WCAG AA)
- [ ] Imágenes escaladas correctamente
- [ ] No scroll horizontal accidental
- [ ] Spacing adecuado entre elementos

### Performance:
- [ ] Sin lag al scroll
- [ ] Touch events responden instantly
- [ ] Imágenes optimizadas (lazy loading)
- [ ] CSS minificado

### Testing:
- [ ] Probado en 375px (móvil pequeño)
- [ ] Probado en 768px (tablet)
- [ ] Probado en 1024px (desktop pequeño)
- [ ] Orientación portrait y landscape
- [ ] Con teclado virtual abierto

---

## 🎨 Patrones de Diseño Recomendados

### 1. Bottom Navigation (móvil)
```html
<nav class="bottom-nav d-md-none">
  <a href="/dashboard.html" class="nav-item">
    <i class="bi bi-house"></i>
    <span>Inicio</span>
  </a>
  <a href="/ventas.html" class="nav-item active">
    <i class="bi bi-cart"></i>
    <span>Ventas</span>
  </a>
  <a href="/inventario.html" class="nav-item">
    <i class="bi bi-box"></i>
    <span>Inventario</span>
  </a>
  <a href="/clientes.html" class="nav-item">
    <i class="bi bi-people"></i>
    <span>Clientes</span>
  </a>
</nav>

<style>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  display: flex;
  justify-content: space-around;
  padding: 8px 0;
  border-top: 1px solid #ddd;
  z-index: 1000;
}

.bottom-nav .nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  text-decoration: none;
  color: #666;
  font-size: 12px;
}

.bottom-nav .nav-item.active {
  color: #1E40AF;
}

.bottom-nav .nav-item i {
  font-size: 20px;
  margin-bottom: 4px;
}
</style>
```

### 2. Hamburger Menu (sidebar móvil)
```html
<button class="btn-menu-mobile d-md-none" onclick="toggleMobileMenu()">
  <i class="bi bi-list"></i>
</button>

<div class="mobile-sidebar" id="mobileSidebar">
  <div class="sidebar-header">
    <h5>Menú</h5>
    <button onclick="toggleMobileMenu()">
      <i class="bi bi-x"></i>
    </button>
  </div>
  <nav class="sidebar-nav">
    <!-- Menu items -->
  </nav>
</div>

<div class="sidebar-overlay" onclick="toggleMobileMenu()"></div>

<style>
@media (max-width: 768px) {
  .mobile-sidebar {
    position: fixed;
    top: 0;
    left: -280px;
    width: 280px;
    height: 100vh;
    background: white;
    z-index: 9999;
    transition: left 0.3s ease;
    box-shadow: 2px 0 8px rgba(0,0,0,0.1);
  }
  
  .mobile-sidebar.active {
    left: 0;
  }
  
  .sidebar-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 9998;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }
  
  .sidebar-overlay.active {
    opacity: 1;
    pointer-events: all;
  }
}
</style>

<script>
function toggleMobileMenu() {
  document.getElementById('mobileSidebar').classList.toggle('active');
  document.querySelector('.sidebar-overlay').classList.toggle('active');
}
</script>
```

### 3. Swipe Actions (para listas)
```html
<!-- Requiere librería como HammerJS o código custom -->
<div class="swipe-item" data-id="123">
  <div class="swipe-content">
    <h6>Producto XYZ</h6>
    <p>Stock: 10 unidades</p>
  </div>
  <div class="swipe-actions">
    <button class="btn-edit">
      <i class="bi bi-pencil"></i>
    </button>
    <button class="btn-delete">
      <i class="bi bi-trash"></i>
    </button>
  </div>
</div>
```

---

## 📊 Métricas de Éxito

Al finalizar la optimización móvil:

### Métricas Cuantitativas:
- [ ] 100% funcionalidad disponible en móvil
- [ ] Lighthouse: Mobile Score > 90
- [ ] Tiempo de interacción < 3s
- [ ] Sin errores console en móvil
- [ ] Touch targets: 100% > 44px

### Métricas Cualitativas:
- [ ] Usuarios pueden completar venta completa en móvil
- [ ] Navegación intuitiva sin instrucciones
- [ ] UI "se siente" nativa
- [ ] Feedback de usuarios: "fácil de usar"

---

## 🚀 Plan de Implementación Global

### Semana 1: Análisis y Quick Wins
- **Día 1**: Auditoría completa POS + Selector Empresa
- **Día 2**: Implementar fixes críticos (P0)
- **Día 3**: Testing y ajustes P0
- **Día 4**: Auditoría Inventario + Clientes (P1)
- **Día 5**: Implementar P1

### Semana 2: Refinamiento
- **Día 1-2**: Dashboard + Reportes (P2)
- **Día 3**: Configuración (P3)
- **Día 4**: Testing integral todos módulos
- **Día 5**: Polish + documentación

---

## 📝 Notas de Implementación

### Framework CSS Actual:
- Bootstrap 5.3 - Ya tiene muchas utilidades responsive
- Aprovechar: `d-none d-md-block`, `col-12 col-md-6`, `flex-column flex-md-row`

### No Reinventar la Rueda:
- Usar componentes Bootstrap móvil existentes
- Offcanvas para sidebars móviles
- Collapse para filtros/acordeones
- Modal con `.modal-fullscreen-sm-down`

### Progressive Enhancement:
- Desktop first (código actual)
- Agregar estilos móvil sin romper desktop
- Media queries de menor a mayor

---

**Última Actualización**: 4 de Junio 2026  
**Estado**: 📋 Pendiente de implementación  
**Responsable**: Equipo Desarrollo  
**Próximo Paso**: Comenzar auditoría POS + Selector Empresa (P0)
