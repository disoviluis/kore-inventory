# 🏗️ ANÁLISIS DE ARQUITECTURA: Módulo de Categorías

## 📋 OBJETIVO
Crear módulo de gestión de categorías consistente con la arquitectura existente del sistema.

---

## 1️⃣ MÓDULOS SIMILARES EXISTENTES

### Módulos Analizados:
1. **Clientes** (`clientes.html` + `clientes.js`)
2. **Proveedores** (`proveedores.html` + `proveedores.js`)
3. **Productos** (`productos.html` + `productos.js`)

---

## 2️⃣ PATRONES Y ESTRUCTURA IDENTIFICADOS

### **A. Estructura de Archivos**
```
frontend/public/
├── [modulo].html          ← Página principal
└── assets/js/
    └── [modulo].js        ← Lógica del módulo

backend/src/platform/
└── [modulo]/
    ├── [modulo].controller.ts
    └── [modulo].routes.ts
```

### **B. Estructura HTML Consistente**

#### Encabezado Común:
```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[Módulo] - KORE Inventory</title>
    
    <!-- Bootstrap 5.3 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.2/font/bootstrap-icons.css">
    <!-- Custom CSS -->
    <link rel="stylesheet" href="assets/css/dashboard.css">
</head>
```

#### Estructura de Página:
```
1. Sidebar (común a todos)
   - Logo + nombre
   - User Info
   - Company Selector
   - Navigation Menu
   - Sidebar Footer

2. Main Content
   - Top Navbar (breadcrumb, búsqueda, notificaciones, quick actions)
   - Page Content Container
     - Page Header (título + botón principal)
     - Filtros y búsqueda (card)
     - Tabla de datos (card)
     - Empty state (si no hay datos)
   - Footer

3. Modal CRUD
   - Modal Header (título + botón cerrar)
   - Modal Body (formulario)
   - Modal Footer (cancelar + guardar)
```

#### Footer Común:
```html
<footer class="main-footer">
    <div class="container-fluid">
        <div class="row align-items-center">
            <div class="col-md-6">
                <p class="mb-0 text-muted">© 2025 <strong>Disovi Soft</strong>. Todos los derechos reservados.</p>
            </div>
            <div class="col-md-6 text-md-end">
                <a href="#" class="text-muted me-3">Términos</a>
                <a href="#" class="text-muted me-3">Privacidad</a>
                <a href="#" class="text-muted">Soporte</a>
            </div>
        </div>
    </div>
</footer>
```

#### Scripts Comunes:
```html
<!-- Bootstrap 5.3 JS Bundle -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
<!-- Axios -->
<script src="https://cdn.jsdelivr.net/npm/axios@1.6.2/dist/axios.min.js"></script>
<!-- Sidebar Navigation (Common) -->
<script src="assets/js/sidebar-navigation.js"></script>
<!-- Custom JS -->
<script src="assets/js/[modulo].js"></script>
```

---

### **C. Estructura JavaScript Consistente**

#### Template Estándar:
```javascript
/**
 * =================================
 * KORE INVENTORY - [MÓDULO] MODULE
 * Módulo de gestión de [módulo]
 * Version: 1.0.0 - YYYY-MM-DD
 * =================================
 */

const API_URL = 'http://18.191.181.99:3000/api';
let currentEmpresa = null;
let currentUsuario = null;
let [modulo]Data = [];

console.log('🚀 [Módulo].js cargado - Versión 1.0.0');

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    // 1. Verificar autenticación
    // 2. Obtener usuario
    // 3. Configurar sidebar
    // 4. Cargar empresas
    // 5. Obtener empresa activa
    // 6. Actualizar UI
    // 7. Cargar datos iniciales
    // 8. Event listeners
});

// ============================================
// CARGAR EMPRESAS DEL USUARIO
// ============================================
async function cargarEmpresas(usuarioId) { }

// ============================================
// CARGAR [DATOS]
// ============================================
async function cargar[Datos]() { }

// ============================================
// RENDERIZAR TABLA
// ============================================
function renderizar[Datos](items) { }

// ============================================
// MODAL CRUD
// ============================================
function abrirModalNuevo() { }
async function editar[Item](id) { }
async function guardar[Item]() { }
async function eliminar[Item](id) { }

// ============================================
// FILTROS Y BÚSQUEDA
// ============================================
function filtrar[Datos]() { }
function limpiarFiltros() { }

// ============================================
// UTILIDADES
// ============================================
function mostrarAlerta(mensaje, tipo) { }
function cerrarSesion() { }
function getTipoUsuarioTexto(tipo) { }
```

---

### **D. Backend Controller Consistente**

```typescript
/**
 * =================================
 * KORE INVENTORY - [MÓDULO] CONTROLLER
 * Controlador de [módulo]
 * =================================
 */

import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import { CONSTANTS } from '../../shared/constants';
import logger from '../../shared/logger';

// GET /api/[modulo]?empresaId=X
export const get[Modulos] = async (req: Request, res: Response) => {}

// GET /api/[modulo]/:id
export const get[Modulo]ById = async (req: Request, res: Response) => {}

// POST /api/[modulo]
export const create[Modulo] = async (req: Request, res: Response) => {}

// PUT /api/[modulo]/:id
export const update[Modulo] = async (req: Request, res: Response) => {}

// DELETE /api/[modulo]/:id
export const delete[Modulo] = async (req: Request, res: Response) => {}
```

---

## 3️⃣ DIFERENCIAS ENCONTRADAS ENTRE MÓDULOS

### **Clientes vs. Proveedores:**

| Aspecto | Clientes | Proveedores |
|---------|----------|-------------|
| **Versión en JS** | Sin versión explícita | `Version: 1.0.0` con console.log |
| **Inicialización** | Usa `auth/verify` | Usa `auth/me` |
| **Modal Bootstrap** | No guarda referencia | `proveedorModal = new bootstrap.Modal()` |
| **Event Listeners** | Función inline | Función `setupEventListeners()` separada |
| **Búsqueda** | Filtro sin debounce | Debounce 500ms |

### **Productos:**
- Más complejo (precio, IVA, stock, imágenes)
- Tiene calculadoras de margen
- Validaciones de jerarquía de precios

---

## 4️⃣ BACKEND DE CATEGORÍAS (YA EXISTE)

### Endpoints Disponibles:
```typescript
✅ GET    /api/categorias?empresaId=X         - Listar categorías
✅ GET    /api/categorias/:id                 - Obtener por ID
✅ POST   /api/categorias                     - Crear categoría
✅ PUT    /api/categorias/:id                 - Actualizar
✅ DELETE /api/categorias/:id                 - Eliminar
```

### Campos de la tabla `categorias`:
```sql
id              INT AUTO_INCREMENT PRIMARY KEY
empresa_id      INT NOT NULL
nombre          VARCHAR(100) NOT NULL
descripcion     TEXT
icono           VARCHAR(50)     ← Bootstrap Icons (ej: 'bi-laptop')
color           VARCHAR(20)     ← Hexadecimal (ej: '#3B82F6')
activo          TINYINT(1) DEFAULT 1
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

---

## 5️⃣ PROPUESTA DE IMPLEMENTACIÓN CONSISTENTE

### **Módulo: Categorías**

#### **Archivo:** `categorias.html`
**Basado en:** Proveedores (estructura más limpia y moderna)

**Características:**
- ✅ Sidebar completo (como todos los módulos)
- ✅ Top navbar con breadcrumb
- ✅ Filtros: Búsqueda + Estado (Activo/Inactivo)
- ✅ Tabla con columnas:
  - Icono (preview visual)
  - Nombre
  - Descripción
  - Color (badge con color)
  - Productos (count)
  - Estado (badge)
  - Acciones (editar, eliminar)
- ✅ Modal CRUD con:
  - Nombre (text, required)
  - Descripción (textarea)
  - Icono (select con preview de iconos Bootstrap)
  - Color (color picker)
  - Estado (switch activo/inactivo)
- ✅ Empty state si no hay categorías
- ✅ Validación: No eliminar si tiene productos asociados

#### **Archivo:** `categorias.js`
**Basado en:** Proveedores (mejor estructurado)

**Estructura:**
```javascript
const API_URL = 'http://18.191.181.99:3000/api';
let currentEmpresa = null;
let currentUsuario = null;
let categoriasData = [];
let categoriaModal = null;

// Secciones:
1. Inicialización (DOMContentLoaded)
2. cargarEmpresas()
3. cargarCategorias()
4. renderizarCategorias()
5. abrirModalNuevo()
6. editarCategoria(id)
7. guardarCategoria()
8. eliminarCategoria(id)
9. filtrarCategorias()
10. setupEventListeners()
11. Utilidades (mostrarAlerta, getTipoUsuarioTexto, cerrarSesion)
```

**Funcionalidades especiales:**
- Selector de iconos Bootstrap (dropdown con preview)
- Color picker HTML5 `<input type="color">`
- Validación: Verificar productos asociados antes de eliminar
- Contador de productos por categoría en la tabla

---

## 6️⃣ INTEGRACIÓN CON MENÚ LATERAL

### Ubicación Propuesta:
**ADMINISTRACIÓN → Categorías**

```html
<li class="nav-item">
    <a class="nav-link nav-section" data-bs-toggle="collapse" href="#administracionCollapse" role="button" aria-expanded="false">
        <i class="bi bi-gear-fill"></i>
        <span>ADMINISTRACIÓN</span>
        <i class="bi bi-chevron-down ms-auto collapse-icon"></i>
    </a>
    <div class="collapse" id="administracionCollapse">
        <ul class="nav flex-column ms-3">
            <li class="nav-item">
                <a class="nav-link" href="categorias.html">
                    <i class="bi bi-tags"></i>
                    <span>Categorías</span>
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" href="#">
                    <i class="bi bi-people"></i>
                    <span>Usuarios</span>
                </a>
            </li>
            <!-- ... otros items ... -->
        </ul>
    </div>
</li>
```

---

## 7️⃣ VALIDACIONES Y REGLAS DE NEGOCIO

### Crear/Editar Categoría:
- ✅ Nombre requerido (máx 100 caracteres)
- ✅ No duplicar nombre en la misma empresa
- ✅ Icono opcional (default: 'bi-box')
- ✅ Color opcional (default: '#9CA3AF')
- ✅ Descripción opcional

### Eliminar Categoría:
- ❌ **NO** permitir si tiene productos asociados
- ✅ Mostrar confirmación con contador de productos
- ✅ Alternativa: Desactivar en lugar de eliminar

### Cambio de Estado:
- ✅ Activar/Desactivar con toggle
- ⚠️ Advertir si hay productos asociados al desactivar

---

## 8️⃣ COMPONENTES REUTILIZABLES

### Selector de Iconos Bootstrap:
```html
<select class="form-select" id="categoriaIcono">
    <option value="bi-laptop">💻 Laptop (Electrónica)</option>
    <option value="bi-bag">👜 Bag (Ropa)</option>
    <option value="bi-cup-straw">🥤 Cup (Alimentos)</option>
    <option value="bi-house">🏠 House (Hogar)</option>
    <!-- ... más iconos ... -->
</select>
```

### Color Picker:
```html
<input type="color" class="form-control form-control-color" id="categoriaColor" value="#3B82F6">
```

### Badge de Categoría (para usar en productos):
```html
<span class="badge" style="background-color: {{color}}">
    <i class="{{icono}} me-1"></i>{{nombre}}
</span>
```

---

## 9️⃣ ENDPOINTS BACKEND A VERIFICAR

### Ya Existen:
✅ `getCategorias(req, res)` - GET /api/categorias?empresaId=X
✅ `getCategor iaById(req, res)` - GET /api/categorias/:id
✅ `createCategoria(req, res)` - POST /api/categorias
✅ `updateCategoria(req, res)` - PUT /api/categorias/:id
✅ `deleteCategoria(req, res)` - DELETE /api/categorias/:id

### Nuevos Requeridos:
⚠️ **VERIFICAR:** ¿Eliminar valida productos asociados?

```typescript
// En deleteCategoria, agregar:
const productosConCategoria = await query(
  'SELECT COUNT(*) as count FROM productos WHERE categoria_id = ?',
  [id]
);

if (productosConCategoria[0].count > 0) {
  return errorResponse(
    res,
    `No se puede eliminar. Hay ${productosConCategoria[0].count} productos asociados a esta categoría.`,
    null,
    CONSTANTS.HTTP_STATUS.CONFLICT
  );
}
```

---

## 🎯 DECISIÓN FINAL

### **Implementar Módulo de Categorías siguiendo:**

1. **Estructura HTML:** Proveedores (más limpia)
2. **Estructura JS:** Proveedores (mejor organizado)
3. **Validaciones:** Productos (más robustas)
4. **Estilo:** Consistente con todos los módulos

### **Componentes Especiales:**
- Selector de iconos Bootstrap con preview
- Color picker HTML5
- Validación de productos asociados antes de eliminar
- Empty state personalizado

---

## ✅ PRÓXIMO PASO

**¿Proceder con la implementación usando este análisis?**

**Archivos a crear:**
1. `frontend/public/categorias.html` (basado en proveedores.html)
2. `frontend/public/assets/js/categorias.js` (basado en proveedores.js)
3. Modificar `backend/src/platform/categorias/categorias.controller.ts` (agregar validación de productos)
4. Actualizar menú lateral en todos los módulos

**Tiempo estimado:** 2-3 horas de desarrollo + testing
