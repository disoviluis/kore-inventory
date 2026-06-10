# 🎓 PROPUESTA: MÓDULO DE MANUALES INTEGRADO

## 📋 RESUMEN EJECUTIVO

Sistema de ayuda y capacitación integrado en KORE Inventory que muestra manuales contextuales según el rol del usuario.

---

## 🎯 OBJETIVOS

1. ✅ **Autoservicio**: Usuarios resuelven dudas sin contactar soporte
2. ✅ **Contextual**: Ver solo manuales relevantes a su rol
3. ✅ **Actualizable**: Modificar manuales sin redesplegar la app
4. ✅ **Búsqueda**: Encontrar información rápidamente
5. ✅ **Multimedia**: Texto + imágenes + videos

---

## 🏗️ ARQUITECTURA PROPUESTA

### Backend

#### Tabla: `manuales`
```sql
CREATE TABLE manuales (
    id INT PRIMARY KEY AUTO_INCREMENT,
    titulo VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    contenido LONGTEXT NOT NULL, -- HTML o Markdown
    categoria_id INT,
    rol_id INT NULL, -- NULL = visible para todos
    orden INT DEFAULT 0,
    icono VARCHAR(50) DEFAULT 'bi-book',
    es_destacado BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (categoria_id) REFERENCES categorias_manuales(id),
    FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE SET NULL,
    
    INDEX idx_rol (rol_id),
    INDEX idx_categoria (categoria_id),
    INDEX idx_slug (slug)
);
```

#### Tabla: `categorias_manuales`
```sql
CREATE TABLE categorias_manuales (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT,
    icono VARCHAR(50) DEFAULT 'bi-folder',
    color VARCHAR(20) DEFAULT '#1E40AF',
    orden INT DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE
);
```

#### Tabla: `manual_vistas` (Analytics)
```sql
CREATE TABLE manual_vistas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    manual_id INT NOT NULL,
    usuario_id INT NOT NULL,
    empresa_id INT NOT NULL,
    fecha_vista TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tiempo_lectura INT, -- segundos
    
    FOREIGN KEY (manual_id) REFERENCES manuales(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    
    INDEX idx_manual (manual_id),
    INDEX idx_usuario (usuario_id)
);
```

#### Tabla: `manual_valoraciones` (Feedback)
```sql
CREATE TABLE manual_valoraciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    manual_id INT NOT NULL,
    usuario_id INT NOT NULL,
    valoracion TINYINT CHECK (valoracion BETWEEN 1 AND 5),
    comentario TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (manual_id) REFERENCES manuales(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_valoracion (manual_id, usuario_id)
);
```

---

### API Endpoints

#### GET `/api/manuales`
**Descripción**: Lista manuales visibles para el usuario actual  
**Filtros**:
- `?categoria=slug` - Filtrar por categoría
- `?buscar=texto` - Búsqueda full-text
- `?destacados=true` - Solo destacados

**Respuesta**:
```json
{
  "success": true,
  "manuales": [
    {
      "id": 1,
      "titulo": "Cómo realizar una venta",
      "slug": "como-realizar-venta",
      "categoria": {
        "id": 2,
        "nombre": "Punto de Venta",
        "slug": "punto-venta",
        "color": "#10B981"
      },
      "icono": "bi-cash-coin",
      "es_destacado": true,
      "tiempo_lectura_estimado": 5,
      "vistas": 142
    }
  ],
  "categorias": [...]
}
```

#### GET `/api/manuales/:slug`
**Descripción**: Obtener contenido completo de un manual  
**Respuesta**:
```json
{
  "success": true,
  "manual": {
    "id": 1,
    "titulo": "Cómo realizar una venta",
    "contenido": "<h1>Paso 1...</h1>...",
    "categoria": {...},
    "manuales_relacionados": [...],
    "valoracion_promedio": 4.5,
    "total_valoraciones": 23
  }
}
```

#### POST `/api/manuales/:id/vista`
**Descripción**: Registrar que el usuario vio el manual  
**Body**:
```json
{
  "tiempo_lectura": 180 // segundos
}
```

#### POST `/api/manuales/:id/valoracion`
**Descripción**: Valorar un manual  
**Body**:
```json
{
  "valoracion": 5,
  "comentario": "Muy útil, me ayudó mucho"
}
```

---

## 🎨 FRONTEND

### Ubicación en el Sistema

#### Opción 1: Botón Flotante de Ayuda (Recomendado)
```html
<!-- Botón flotante en todas las páginas -->
<button class="btn-ayuda-flotante" onclick="abrirCentroAyuda()">
    <i class="bi bi-question-circle"></i>
    <span>Ayuda</span>
</button>
```

- 📍 **Posición**: Esquina inferior derecha
- 🎨 **Estilo**: Circular, color primario, con sombra
- 📱 **Móvil**: Más pequeño pero siempre visible
- ⌨️ **Atajo**: `Ctrl + H` o `F1`

#### Opción 2: Menú en Sidebar
```html
<li class="sidebar-item">
    <a href="manuales.html" class="sidebar-link">
        <i class="bi bi-book"></i>
        <span>Centro de Ayuda</span>
    </a>
</li>
```

#### Opción 3: Combinación (Mejor UX)
- Botón flotante para acceso rápido
- Ítem en sidebar para explorar todos los manuales

---

### Páginas Frontend

#### 1. `manuales.html` - Centro de Ayuda

**Layout**:
```
┌────────────────────────────────────────────┐
│  🔍 Buscar en manuales...                  │
├────────────────────────────────────────────┤
│  📚 Categorías                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │ POS  │ │ Inv  │ │ Conf │ │ Más  │      │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
├────────────────────────────────────────────┤
│  ⭐ Manuales Destacados                     │
│  📄 Cómo realizar una venta                │
│  📄 Cómo crear productos                   │
│  📄 Configurar facturación electrónica     │
├────────────────────────────────────────────┤
│  📋 Todos los Manuales                     │
│  [Lista filtrada por rol del usuario]     │
└────────────────────────────────────────────┘
```

#### 2. `manual-detalle.html` - Vista de Manual

**Layout**:
```
┌────────────────────────────────────────────┐
│  ← Volver a manuales                       │
├────────────────────────────────────────────┤
│  📘 Punto de Venta > Cómo realizar venta   │
│                                            │
│  ⏱️ Tiempo de lectura: 5 min               │
│  ⭐⭐⭐⭐⭐ (23 valoraciones)                 │
├────────────────────────────────────────────┤
│  [Tabla de contenidos]                     │
│  1. Paso 1: Seleccionar cliente            │
│  2. Paso 2: Agregar productos              │
│  3. Paso 3: Aplicar descuentos             │
│  ...                                       │
├────────────────────────────────────────────┤
│  [Contenido del manual con imágenes]      │
│                                            │
│  [Botón: ¿Te fue útil? 👍 👎]             │
├────────────────────────────────────────────┤
│  📚 Manuales Relacionados                  │
│  • Cómo crear cuentas abiertas             │
│  • Gestión de formas de pago               │
└────────────────────────────────────────────┘
```

---

### Componentes UI

#### Modal de Ayuda Contextual

```javascript
// Mostrar ayuda contextual según la página actual
function mostrarAyudaContextual() {
    const pagina = obtenerPaginaActual(); // 'ventas', 'productos', etc.
    
    // Buscar manuales relevantes
    const manuales = await fetch(`/api/manuales?pagina=${pagina}`);
    
    // Mostrar modal con sugerencias
    mostrarModal({
        titulo: '💡 ¿Necesitas ayuda?',
        contenido: renderizarSugerencias(manuales),
        botones: ['Ver todos los manuales', 'Cerrar']
    });
}
```

#### Búsqueda Inteligente

```javascript
// Búsqueda con autocompletado
<input 
    type="text" 
    placeholder="¿Qué necesitas hacer?"
    oninput="buscarManuales(this.value)"
/>

// Sugerencias:
// - "crear venta" → Manual: Cómo realizar ventas
// - "agregar producto" → Manual: Gestión de productos
// - "factura electrónica" → Manual: Configurar facturación
```

---

## 📝 CATEGORÍAS SUGERIDAS

### Para Super Administrador
```sql
INSERT INTO categorias_manuales (nombre, slug, icono, color) VALUES
('Gestión de Empresas', 'gestion-empresas', 'bi-building', '#6366F1'),
('Roles Globales', 'roles-globales', 'bi-shield-lock', '#8B5CF6'),
('Usuarios Globales', 'usuarios-globales', 'bi-people', '#EC4899'),
('Configuración Avanzada', 'config-avanzada', 'bi-gear', '#6B7280');
```

### Para Admin de Empresa
```sql
INSERT INTO categorias_manuales (nombre, slug, icono, color) VALUES
('Configuración', 'configuracion', 'bi-sliders', '#1E40AF'),
('Facturación', 'facturacion', 'bi-receipt', '#059669'),
('Usuarios y Permisos', 'usuarios-permisos', 'bi-person-badge', '#DC2626');
```

### Para Usuarios Operativos
```sql
INSERT INTO categorias_manuales (nombre, slug, icono, color) VALUES
('Punto de Venta', 'punto-venta', 'bi-cash-coin', '#10B981'),
('Productos', 'productos', 'bi-box-seam', '#F59E0B'),
('Inventario', 'inventario', 'bi-clipboard-data', '#3B82F6'),
('Clientes', 'clientes', 'bi-person-lines-fill', '#8B5CF6'),
('Proveedores', 'proveedores', 'bi-truck', '#EC4899'),
('Compras', 'compras', 'bi-cart-plus', '#6366F1'),
('Reportes', 'reportes', 'bi-graph-up', '#06B6D4');
```

---

## 🎬 CONTENIDO INICIAL SUGERIDO

### Manuales Esenciales (Crear Primero)

#### Para Cajero:
1. ✅ **Cómo realizar una venta** (Destacado)
2. ✅ **Cómo crear una cuenta abierta** (Destacado)
3. ✅ **Cómo cerrar una cuenta abierta**
4. ✅ **Cómo abrir y cerrar turno de caja**
5. ✅ **Cómo aplicar descuentos**
6. ✅ **Usar múltiples formas de pago**
7. ✅ **Reimprimir facturas**

#### Para Inventario:
1. ✅ **Cómo crear un producto** (Destacado)
2. ✅ **Cómo crear categorías**
3. ✅ **Ajustar inventario** (sobrantes/faltantes)
4. ✅ **Traslados entre bodegas**
5. ✅ **Registrar una compra**
6. ✅ **Gestionar proveedores**
7. ✅ **Importar productos masivamente**

#### Para Admin de Empresa:
1. ✅ **Configurar facturación electrónica** (Destacado)
2. ✅ **Crear roles personalizados** (Destacado)
3. ✅ **Gestionar usuarios**
4. ✅ **Personalizar plantilla de factura**
5. ✅ **Configurar impuestos adicionales**
6. ✅ **Ver reportes de ventas**
7. ✅ **Configurar bodegas**

#### Para Super Admin:
1. ✅ **Crear una nueva empresa** (Destacado)
2. ✅ **Crear roles globales** (Destacado)
3. ✅ **Crear usuarios globales**
4. ✅ **Asignar administrador de empresa**
5. ✅ **Monitorear licencias**
6. ✅ **Gestionar planes y módulos**

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### Fase 1: MVP (Básico Funcional) - 2 semanas

**Backend** (1 semana):
- [ ] Crear tablas de base de datos
- [ ] Endpoints API de manuales
- [ ] Filtrado por rol
- [ ] Búsqueda básica

**Frontend** (1 semana):
- [ ] Página `manuales.html`
- [ ] Página `manual-detalle.html`
- [ ] Botón flotante de ayuda
- [ ] Integración con sidebar

**Contenido**:
- [ ] 5 manuales esenciales por rol
- [ ] Formato texto + imágenes

---

### Fase 2: Mejoras - 1 semana

- [ ] Sistema de valoraciones
- [ ] Analytics (vistas, tiempo lectura)
- [ ] Manuales relacionados
- [ ] Búsqueda avanzada (full-text)
- [ ] Autocompletado

---

### Fase 3: Multimedia - 1 semana

- [ ] Soporte para videos (YouTube/Vimeo embeds)
- [ ] GIFs animados
- [ ] Capturas de pantalla interactivas
- [ ] Tours guiados (intro.js)

---

### Fase 4: Avanzado - 2 semanas

- [ ] Editor de manuales en el admin
- [ ] Versionado de manuales
- [ ] Notificaciones de nuevos manuales
- [ ] Traducción multi-idioma
- [ ] Exportar a PDF

---

## 💡 CARACTERÍSTICAS AVANZADAS

### 1. Ayuda Contextual Automática

```javascript
// Detectar cuando el usuario está perdido
let tiempoInactivo = 0;
setInterval(() => {
    if (usuarioInactivo) {
        tiempoInactivo++;
        if (tiempoInactivo > 30) { // 30 segundos
            mostrarAyudaContextual();
        }
    }
}, 1000);
```

### 2. Tours Guiados Interactivos

```javascript
// Usar intro.js para tours paso a paso
function iniciarTourVentas() {
    const tour = introJs();
    tour.setOptions({
        steps: [
            {
                element: '#buscarCliente',
                intro: 'Primero busca o crea un cliente aquí',
                position: 'bottom'
            },
            {
                element: '#buscarProducto',
                intro: 'Luego busca productos para agregar',
                position: 'bottom'
            },
            // ...
        ]
    });
    tour.start();
}
```

### 3. Chatbot de Ayuda

```javascript
// Integrar con OpenAI o similar
async function preguntarAlBot(pregunta) {
    const respuesta = await fetch('/api/ayuda/chatbot', {
        method: 'POST',
        body: JSON.stringify({ pregunta })
    });
    
    // Responde basándose en los manuales
    // "¿Cómo creo una venta?"
    // Bot: "Para crear una venta, sigue estos pasos: ..."
}
```

### 4. Notificaciones de Nuevos Manuales

```javascript
// Cuando se publica un nuevo manual relevante
{
    "titulo": "🎉 Nuevo manual disponible",
    "mensaje": "Ya puedes aprender sobre: Traslados entre bodegas",
    "link": "/manuales/traslados-bodegas",
    "tipo": "info"
}
```

---

## 📊 MÉTRICAS Y ANALYTICS

### Dashboard de Admin

**Métricas a mostrar**:
- 📈 **Manuales más vistos** (Top 10)
- ⭐ **Mejor valorados** (Top 5)
- 🔍 **Búsquedas sin resultados** (Para crear nuevos manuales)
- 👥 **Usuarios más activos en ayuda**
- ⏱️ **Tiempo promedio de lectura por manual**
- 📉 **Manuales con baja valoración** (Necesitan mejora)

### Reporte SQL

```sql
-- Manuales más útiles (muchas vistas + alta valoración)
SELECT 
    m.titulo,
    COUNT(DISTINCT mv.usuario_id) as total_vistas,
    AVG(mr.valoracion) as valoracion_promedio,
    AVG(mv.tiempo_lectura) as tiempo_lectura_promedio
FROM manuales m
LEFT JOIN manual_vistas mv ON m.id = mv.manual_id
LEFT JOIN manual_valoraciones mr ON m.id = mr.manual_id
WHERE m.activo = TRUE
GROUP BY m.id
ORDER BY total_vistas DESC, valoracion_promedio DESC
LIMIT 10;
```

---

## ✅ VENTAJAS DE ESTE ENFOQUE

### Para Super Admin:
✅ **Centralizado**: Un solo lugar para gestionar toda la ayuda  
✅ **Escalable**: Fácil agregar nuevos manuales  
✅ **Analytics**: Saber qué confunde a los usuarios  
✅ **Reducción de soporte**: Usuarios resuelven dudas solos  

### Para Usuarios:
✅ **Accesible**: Siempre disponible con 1 clic  
✅ **Contextual**: Solo ven lo relevante a su rol  
✅ **Multimedia**: Texto + imágenes + videos  
✅ **Búsqueda**: Encuentran rápido lo que necesitan  

### Para la Empresa:
✅ **Mejor onboarding**: Nuevos usuarios se capacitan más rápido  
✅ **Menos errores**: Guías claras evitan confusiones  
✅ **Feedback**: Valoraciones muestran qué mejorar  
✅ **Documentación viva**: Siempre actualizada  

---

## 🎯 RECOMENDACIÓN FINAL

### Para AHORA:
✅ Usa el manual de Markdown que creé  
✅ Distribúyelo a tu administrador  
✅ Crea versiones específicas por rol (extractos del manual principal)  

### Para FUTURO (6-8 semanas):
✅ Implementa el módulo de manuales integrado  
✅ Migra el contenido del Markdown a la base de datos  
✅ Agrega videos y tours guiados  
✅ Activa analytics para mejorar continuamente  

---

## 📋 ESTIMACIÓN DE ESFUERZO

| Fase | Tiempo | Complejidad |
|------|--------|-------------|
| **Fase 1: MVP** | 2 semanas | Media |
| **Fase 2: Mejoras** | 1 semana | Baja |
| **Fase 3: Multimedia** | 1 semana | Media |
| **Fase 4: Avanzado** | 2 semanas | Alta |
| **TOTAL** | **6 semanas** | **Media-Alta** |

**Prioridad recomendada**: 🟡 Media  
**Justificación**: Muy útil pero no bloquea operación actual. Considerar después de módulos core.

---

## 📞 PRÓXIMOS PASOS

1. ✅ **Revisar manual de Super Admin** creado
2. ✅ **Completar credenciales** en el manual
3. ✅ **Entregar a tu administrador**
4. ⏳ **Decidir si implementar módulo de manuales** (evaluar costo/beneficio)
5. ⏳ **Si decides implementar**: Comenzar con Fase 1 (MVP)

---

**¿Preguntas o ajustes necesarios?** 🤔
