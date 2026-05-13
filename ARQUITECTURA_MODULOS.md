# 🏗️ ARQUITECTURA DE MÓDULOS - KORE INVENTORY

## 📐 Principios de Diseño

### 1. **Separación por Tipo de Usuario**
Cada tipo de usuario tiene sus propios módulos con IDs únicos:
- **Super Admin:** Gestión global del sistema (todas las empresas)
- **Admin Empresa:** Gestión de su empresa específica
- **Usuario Regular:** Operaciones según permisos asignados

### 2. **IDs Únicos y Descriptivos**
- ✅ **CORRECTO:** `usuariosAdminTableBody` (indica que es para admin global)
- ✅ **CORRECTO:** `usuariosEmpresaTableBody` (indica que es por empresa)
- ❌ **INCORRECTO:** `usuariosTableBody` (ambiguo, puede duplicarse)

### 3. **Naming Convention**
```
Patrón: [Entidad][Contexto][Tipo]Body

Ejemplos:
- usuariosAdminTableBody
- usuariosEmpresaTableBody  
- rolesGlobalesTableBody
- rolesTableBody
- productosTableBody
- ventasTableBody
```

---

## 🗂️ MÓDULOS IMPLEMENTADOS

### 📊 **Módulos de Super Admin** (`tipo_usuario = 'super_admin'`)

| Módulo | ID Módulo | Función Carga | Endpoint API | Tabla/Contenedor |
|--------|-----------|---------------|--------------|------------------|
| **Dashboard** | `dashboardModule` | `cargarEstadisticas()` | `/api/dashboard` | N/A |
| **Empresas** | `empresasModule` | `cargarEmpresasSuperAdmin()` | `/api/empresas` | `empresasTableBody` |
| **Usuarios Globales** | `usuarios-adminModule` | `cargarUsuarios()` | `/api/super-admin/usuarios` | `usuariosAdminTableBody` |
| **Planes** | `planesModule` | `cargarPlanes()` | `/api/super-admin/planes` | `planesTableBody` |
| **Configuración Global** | `configuracion-globalModule` | `cargarRolesGlobales()` | `/api/super-admin/roles-globales` | `rolesGlobalesTableBody` |

---

### 🏢 **Módulos de Admin Empresa** (`tipo_usuario = 'admin_empresa'`)

| Módulo | ID Módulo | Función Carga | Endpoint API | Tabla/Contenedor |
|--------|-----------|---------------|--------------|------------------|
| **Dashboard** | `dashboardModule` | `cargarEstadisticas(empresaId)` | `/api/dashboard?empresa_id=X` | N/A |
| **Productos** | `productosModule` | `cargarProductos()` | `/api/productos?empresa_id=X` | `productosTableBody` |
| **Usuarios Empresa** | `usuariosModule` | `cargarUsuariosEmpresa()` | `/api/usuarios?empresa_id=X` | `usuariosEmpresaTableBody` |
| **Roles Empresa** | `rolesModule` | `cargarRoles()` | `/api/roles?empresa_id=X` | `rolesTableBody` |
| **Impuestos** | `impuestosModule` | `cargarImpuestos()` | `/api/impuestos?empresa_id=X` | `impuestosTableBody` |

---

### 👤 **Módulos de Usuario Regular** (`tipo_usuario = 'usuario'`)

Según permisos asignados a través de roles:
- **Ventas/POS:** `ventas.html`
- **Inventario:** `inventario.html`
- **Clientes:** `clientes.html`
- **Productos:** `productos.html`
- Etc.

---

## 🔄 FLUJO DE CAMBIO DE EMPRESA

Cuando un usuario cambia de empresa en el dropdown:

```javascript
companySelector.addEventListener('change', (e) => {
  // 1. Actualizar localStorage
  localStorage.setItem('empresaActiva', JSON.stringify(empresaSeleccionada));
  
  // 2. Recargar estadísticas
  cargarEstadisticas(empresaId);
  
  // 3. Recargar módulo activo
  if (moduloId === 'usuariosModule') {
    cargarUsuariosEmpresa(); // ← Recarga usuarios de la nueva empresa
  } else if (moduloId === 'rolesModule') {
    cargarRoles(); // ← Recarga roles de la nueva empresa
  }
  // ... etc
});
```

---

## 🛠️ CHECKLIST PARA AGREGAR UN NUEVO MÓDULO

### ✅ Paso 1: Definir Alcance
- [ ] ¿Es para Super Admin, Admin Empresa, o ambos?
- [ ] ¿Necesita filtrado por empresa?
- [ ] ¿Qué permisos se requieren?

### ✅ Paso 2: Crear HTML
```html
<!-- Ejemplo: Módulo de Proveedores para Admin Empresa -->
<div id="proveedoresModule" class="module-content" style="display: none;">
    <div id="alertContainerProveedores"></div>
    
    <!-- Contenido del módulo -->
    <table class="table">
        <tbody id="proveedoresEmpresaTableBody"></tbody>
        <!--          ^^^^^^^^^^^^^^^^^^^^^^^^  
                     ID único y descriptivo -->
    </table>
</div>
```

### ✅ Paso 3: Crear JavaScript
```javascript
/**
 * Cargar proveedores de la empresa
 */
async function cargarProveedoresEmpresa() {
  const empresaActiva = JSON.parse(localStorage.getItem('empresaActiva') || 'null');
  
  if (!empresaActiva) {
    console.warn('No hay empresa activa');
    return;
  }
  
  const response = await fetch(
    `${API_URL}/proveedores?empresa_id=${empresaActiva.id}`,
    { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}
  );
  
  const data = await response.json();
  const tbody = document.getElementById('proveedoresEmpresaTableBody');
  
  // Renderizar datos...
}
```

### ✅ Paso 4: Registrar en switchcase
```javascript
function cambiarModulo(nombreModulo) {
  switch (nombreModulo) {
    case 'proveedores':
      cargarProveedoresEmpresa();
      break;
    // ... otros casos
  }
}
```

### ✅ Paso 5: Agregar recarga en cambio de empresa
```javascript
// En el event listener del companySelector
if (moduloId === 'proveedoresModule' && typeof cargarProveedoresEmpresa === 'function') {
  cargarProveedoresEmpresa();
}
```

---

## 🚨 ERRORES COMUNES A EVITAR

### ❌ Error 1: IDs Duplicados
```html
<!-- INCORRECTO -->
<tbody id="usuariosTableBody"></tbody> <!-- Admin Global -->
<tbody id="usuariosTableBody"></tbody> <!-- Admin Empresa -->
<!-- El getElementById() siempre selecciona el primero -->

<!-- CORRECTO -->
<tbody id="usuariosAdminTableBody"></tbody>
<tbody id="usuariosEmpresaTableBody"></tbody>
```

### ❌ Error 2: No Filtrar por Empresa
```javascript
// INCORRECTO - Trae todos los usuarios del sistema
const response = await fetch(`${API_URL}/usuarios`);

// CORRECTO - Filtra por empresa activa
const empresaActiva = JSON.parse(localStorage.getItem('empresaActiva'));
const response = await fetch(`${API_URL}/usuarios?empresa_id=${empresaActiva.id}`);
```

### ❌ Error 3: No Recargar al Cambiar Empresa
```javascript
// INCORRECTO - Cambia empresa pero no recarga datos
companySelector.addEventListener('change', (e) => {
  localStorage.setItem('empresaActiva', JSON.stringify(empresaSeleccionada));
  // ← Falta recargar el módulo activo
});

// CORRECTO
companySelector.addEventListener('change', (e) => {
  localStorage.setItem('empresaActiva', JSON.stringify(empresaSeleccionada));
  
  // Recargar módulo activo
  if (moduloId === 'usuariosModule') {
    cargarUsuariosEmpresa(); // ✅ Recarga con nueva empresa
  }
});
```

---

## 📝 RESPONSABILIDADES POR CAPA

### **Frontend (dashboard.html + dashboard.js)**
- ✅ Mostrar/ocultar módulos según tipo de usuario
- ✅ Gestionar selección de empresa activa
- ✅ Recargar datos al cambiar de empresa
- ✅ Validar que hay empresa seleccionada antes de llamar API

### **Backend (controllers + routes)**
- ✅ Validar permisos del usuario (middleware auth)
- ✅ Filtrar datos por empresa_id
- ✅ Verificar que usuario tiene acceso a esa empresa
- ✅ Retornar solo datos autorizados

### **Base de Datos**
- ✅ Relación usuario_empresa (many-to-many)
- ✅ Campo empresa_id en entidades
- ✅ Índices para optimizar consultas por empresa

---

## 🔐 SEGURIDAD

### Validación en Frontend
```javascript
// Verificar que hay empresa seleccionada
if (!empresaActiva || !empresaActiva.id) {
  mostrarError('Debe seleccionar una empresa');
  return;
}
```

### Validación en Backend
```typescript
// Verificar que usuario tiene acceso a esa empresa
const tieneAcceso = await verificarAccesoEmpresa(usuarioId, empresaId);
if (!tieneAcceso) {
  return res.status(403).json({ 
    success: false, 
    message: 'No tiene acceso a esta empresa' 
  });
}
```

---

## 📈 MÉTRICAS Y MONITOREO

### Logs Informativos
```javascript
console.log('🔍 Iniciando carga de usuarios...');
console.log('📦 Empresa activa:', empresaActiva);
console.log('🌐 Llamando a API:', url);
console.log('✅ Datos recibidos:', data);
```

### Manejo de Errores
```javascript
try {
  // ... operación
} catch (error) {
  console.error('❌ Error:', error);
  mostrarError(`Error al cargar: ${error.message}`);
  // Registrar en sistema de logs si existe
}
```

---

## 🎯 ROADMAP DE MEJORAS

### Corto Plazo
- [x] Separar IDs de tablas de usuarios
- [x] Agregar recarga automática al cambiar empresa
- [x] Mejorar logs de depuración
- [ ] Documentar API endpoints

### Mediano Plazo
- [ ] Implementar caché de datos por empresa
- [ ] Agregar indicador visual de empresa activa
- [ ] Optimizar carga inicial (lazy loading)
- [ ] Tests automatizados

### Largo Plazo
- [ ] Migrar a arquitectura de micro-frontends
- [ ] Implementar state management (Redux/Zustand)
- [ ] PWA con sincronización offline
- [ ] WebSockets para actualizaciones en tiempo real

---

## 📚 Referencias

- [ESTRUCTURA_SERVIDOR.md](ESTRUCTURA_SERVIDOR.md) - Guía de deploy
- [ANALISIS_ARQUITECTURA_GESTION_ROLES.md](ANALISIS_ARQUITECTURA_GESTION_ROLES.md) - Arquitectura de roles
- Backend: `backend/src/core/usuarios/usuarios.controller.ts`
- Frontend: `frontend/public/assets/js/dashboard.js`

---

**Última actualización:** 13 de Mayo, 2026  
**Versión:** 1.0  
**Autor:** Equipo Kore Inventory
