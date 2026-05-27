# 🔐 SISTEMA DE PERMISOS GRANULARES - KORE INVENTORY

## 📋 Resumen Ejecutivo

El sistema de permisos de KORE Inventory implementa una **jerarquía de 3 niveles** con control granular basado en **módulos y acciones**:

1. **Super Admin** → Acceso total sin restricciones
2. **Admin Empresa** → Acceso a módulos de gestión (excepto plataforma)
3. **Roles Personalizados** → Solo módulos/acciones asignadas

---

## 🏗️ Jerarquía de Usuarios

```
┌─────────────────────────────────────────┐
│         SUPER ADMIN (Nivel 100)         │
│  - Ve TODOS los módulos (incluido       │
│    Plataforma)                           │
│  - Puede gestionar empresas, licencias   │
│  - Crea roles globales (80-99)           │
│  - No tiene restricciones                │
└─────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│      ADMIN EMPRESA (Nivel 60-79)        │
│  - Ve módulos operativos y admin        │
│  - NO ve módulos de Plataforma          │
│  - Gestiona usuarios de su empresa      │
│  - Crea roles personalizados (1-59)     │
│  - Asigna permisos a roles               │
└─────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│    ROLES PERSONALIZADOS (Nivel 1-59)    │
│  - Vendedor, Cajero, Bodeguero,         │
│    Mensajero, etc.                       │
│  - Solo ven módulos asignados           │
│  - Solo ejecutan acciones permitidas    │
│  - NO pueden modificar permisos          │
└─────────────────────────────────────────┘
```

---

## 🎯 Permisos Granulares

### Estructura: Módulo + Acción

Cada permiso se define como: **`modulo.accion`**

**Ejemplo:**
- `traslados.create` → Crear traslados
- `traslados.view` → Ver todos los traslados
- `traslados.view_own` → Ver solo sus traslados
- `traslados.receive` → Recibir traslados
- `ventas.edit` → Editar ventas
- `productos.delete` → Eliminar productos

### Acciones Disponibles

| Acción | Descripción | Ejemplo de Uso |
|--------|-------------|----------------|
| `view` | Ver listados completos | Ver todos los traslados de la empresa |
| `view_own` | Ver solo registros propios | Mensajero ve sus traslados únicamente |
| `create` | Crear nuevos registros | Crear nuevo traslado, producto, venta |
| `edit` | Modificar registros existentes | Editar producto, actualizar precio |
| `delete` | Eliminar registros | Eliminar producto, cancelar traslado |
| `approve` | Aprobar solicitudes | Aprobar traslado antes de enviarlo |
| `send` | Despachar/Enviar | Bodega envía traslado aprobado |
| `deliver` | Mensajero inicia entrega | Mensajero marca "en ruta" |
| `receive` | Recibir con firma | Bodega destino recibe traslado |
| `export` | Exportar datos | Exportar excel, PDF |
| `import` | Importar datos | Importar productos masivamente |
| `print` | Imprimir documentos | Imprimir factura, etiqueta |

---

## 🔒 Implementación Backend

### Middleware de Permisos

```typescript
import { requirePermission, requireModuleAccess } from '../../core/middleware/permissions.middleware';

// Requiere permiso específico
router.post('/traslados', requirePermission('traslados', 'create'), createTraslado);

// Requiere acceso al módulo (cualquier acción)
router.get('/traslados', requireModuleAccess('traslados'), getTraslados);
```

### Validación Automática

El middleware **valida automáticamente** antes de ejecutar el controlador:

1. ✅ **Super Admin** → Pasa siempre
2. ✅ **Admin Empresa** → Pasa (excepto módulos de plataforma)
3. 🔍 **Otros usuarios** → Consulta BD para verificar permiso
4. ❌ **Sin permiso** → Retorna `403 Forbidden`

**Respuesta de error:**
```json
{
  "success": false,
  "message": "No tienes permisos para create en traslados",
  "detail": {
    "modulo": "traslados",
    "accion": "create",
    "required": "traslados.create"
  }
}
```

---

## 🎨 Implementación Frontend

### Sistema de Utilidades de Permisos

```javascript
// Verificar permiso antes de ejecutar acción
const puedeCrear = await tienePermiso('traslados', 'create');

if (!puedeCrear) {
  mostrarErrorPermiso('crear traslados');
  return;
}

// Ejecutar con validación automática
await ejecutarConPermiso('traslados', 'delete', async () => {
  await eliminarTraslado(id);
}, 'eliminar este traslado');
```

### Atributos HTML para Ocultar Elementos

```html
<!-- Botones con validación de permisos -->
<button class="btn btn-primary" 
        data-permiso-modulo="traslados"
        data-permiso-accion="create">
  Nuevo Traslado
</button>

<button class="btn btn-danger" 
        data-permiso-modulo="productos"
        data-permiso-accion="delete">
  Eliminar
</button>
```

**Al cargar la página:**
```javascript
// Oculta automáticamente botones sin permiso
await PermisosUtils.inicializarPermisos();
```

---

## 👤 Ejemplo: Rol Mensajero

### Permisos Asignados

| Módulo | Acciones | Razón |
|--------|----------|-------|
| **bodegas** | `view` | Ver info de bodegas origen/destino |
| **traslados** | `view_own`, `receive`, `deliver` | Ver sus traslados, iniciar ruta, recibir |
| **mensajeros** | `view` | Acceso al dashboard de mensajeros |
| **productos** | `view` | Ver info de productos que transporta |

### Permisos NO Asignados

❌ `traslados.create` → NO puede crear traslados (solo bodegueros/supervisores)  
❌ `traslados.approve` → NO puede aprobar traslados  
❌ `traslados.view` → NO ve traslados de otros mensajeros  
❌ `productos.edit` → NO puede modificar productos  

### Validación en Código

**Backend (rutas):**
```typescript
// ✅ Mensajero puede recibir
router.put('/:id/recibir', requirePermission('traslados', 'receive'), recibirTraslado);

// ❌ Mensajero NO puede crear (403 Forbidden)
router.post('/', requirePermission('traslados', 'create'), createTraslado);
```

**Frontend (HTML):**
```html
<!-- ✅ Botón visible para mensajero -->
<button data-permiso-modulo="traslados" data-permiso-accion="receive">
  Recibir Ahora
</button>

<!-- ❌ Botón OCULTO automáticamente -->
<button data-permiso-modulo="traslados" data-permiso-accion="create">
  Nuevo Traslado
</button>
```

---

## ✅ Reglas de Jerarquía

### 1. Super Admin

- ✅ Ve TODOS los módulos
- ✅ Puede ejecutar TODAS las acciones
- ✅ Gestiona roles globales (nivel 80-99)
- ✅ Accede a módulos de Plataforma
- ⚠️ **No se validan permisos** - middleware pasa automáticamente

### 2. Admin Empresa

- ✅ Ve TODOS los módulos excepto Plataforma
- ✅ Puede ejecutar TODAS las acciones (en su empresa)
- ✅ Gestiona roles personalizados (nivel 1-59)
- ✅ Asigna usuarios a roles
- ❌ NO puede editar roles de sistema
- ❌ NO puede gestionar roles de otras empresas
- ⚠️ **Validación automática** - verifica que módulo no sea "platform"

### 3. Roles Personalizados

- 🔍 **Se valida CADA acción** consultando BD
- ✅ Solo ven módulos con al menos 1 permiso
- ✅ Solo ejecutan acciones explícitamente asignadas
- ❌ NO pueden modificar permisos
- ❌ NO pueden ver módulos sin acceso

### Regla de Nivel

**Un usuario solo puede gestionar roles de nivel inferior:**

- Super Admin (100) → Puede gestionar hasta nivel 99
- Admin Empresa (70) → Puede gestionar hasta nivel 59
- Vendedor (30) → NO puede gestionar roles

---

## 📝 Base de Datos

### Tablas Involucradas

```sql
usuarios
  └── usuario_rol (N:M)
       └── roles
            └── rol_permiso (N:M)
                 └── permisos
                      ├── modulos (N:1)
                      └── acciones (N:1)
```

### Consulta de Validación

```sql
SELECT COUNT(*) as count
FROM usuarios u
INNER JOIN usuario_rol ur ON u.id = ur.usuario_id
INNER JOIN roles r ON ur.rol_id = r.id
INNER JOIN rol_permiso rp ON r.id = rp.rol_id
INNER JOIN permisos p ON rp.permiso_id = p.id
INNER JOIN modulos m ON p.modulo_id = m.id
INNER JOIN acciones a ON p.accion_id = a.id
WHERE u.id = ?
  AND m.nombre = 'traslados'
  AND a.nombre = 'create'
  AND u.activo = 1
  AND r.activo = 1
  AND p.activo = 1
  AND m.activo = 1;
```

**Si count > 0 → Tiene permiso ✅**  
**Si count = 0 → NO tiene permiso ❌**

---

## 🧪 Testing de Permisos

### Verificar Permisos en Consola

```javascript
// En navegador (F12)
const permisos = await PermisosUtils.getPermisosDetallados();
console.table(permisos);

// Verificar permiso específico
const puede = await PermisosUtils.tienePermiso('traslados', 'create');
console.log('Puede crear traslados:', puede);

// Ver acciones permitidas en módulo
const acciones = await PermisosUtils.getAccionesPermitidas('traslados');
console.log('Acciones en traslados:', acciones);
```

### Testing con Usuario Mensajero

```bash
# Login
Email: mensajero.prueba@kore.com
Password: password

# Verificar en consola
> await tienePermiso('traslados', 'create')
false ❌

> await tienePermiso('traslados', 'receive')
true ✅

> await tienePermiso('traslados', 'view_own')
true ✅
```

### Testing de API

```bash
# Con token de mensajero
curl -H "Authorization: Bearer {token}" \
  -X POST http://18.191.181.99/api/traslados \
  -d '{"empresa_id":18, ...}'

# Respuesta esperada:
{
  "success": false,
  "message": "No tienes permisos para create en traslados"
}
```

---

## 📊 Matriz de Permisos Típicos

| Rol | Traslados | Productos | Ventas | Bodegas | Usuarios |
|-----|-----------|-----------|--------|---------|----------|
| **Super Admin** | Todos | Todos | Todos | Todos | Todos |
| **Admin Empresa** | Todos excepto plataforma | Todos | Todos | Todos | Gestión |
| **Mensajero** | view_own, receive, deliver | view | - | view | - |
| **Bodeguero** | view, create, approve, send | view, edit | - | view, edit | - |
| **Vendedor** | - | view | view, create, edit | - | - |
| **Cajero** | - | view | view, create, print | - | - |

---

## 🚀 Archivos Modificados/Creados

### Backend

✅ **Nuevos:**
- `backend/src/core/middleware/permissions.middleware.ts` - Middleware de validación

✅ **Modificados:**
- `backend/src/platform/traslados/traslados.routes.ts` - Agregados middlewares de permisos

### Frontend

✅ **Nuevos:**
- `frontend/public/assets/js/permissions-utils.js` - Utilidades de permisos

✅ **Modificados:**
- `frontend/public/traslados.html` - Atributos data-permiso-* en botones
- `frontend/public/assets/js/traslados.js` - Inicialización de permisos

---

## ✅ Estado del Deploy

### Backend
- ✅ Middleware compilado y desplegado
- ✅ Rutas actualizadas con validaciones
- ✅ PM2 reiniciado (restart #43)

### Frontend
- ✅ permissions-utils.js desplegado
- ✅ traslados.html actualizado
- ✅ traslados.js inicializa permisos

### Testing Pendiente
- 🧪 Limpiar cache del navegador
- 🧪 Login como mensajero y verificar botón "Nuevo Traslado" oculto
- 🧪 Intentar crear traslado vía API (debe retornar 403)
- 🧪 Verificar que puede recibir traslados

---

## ⚠️ Importante: Migración de Datos

Si existen roles sin permisos asignados, ejecutar migraciones:

```sql
-- Verificar roles sin permisos
SELECT r.id, r.nombre, COUNT(rp.permiso_id) as permisos_count
FROM roles r
LEFT JOIN rol_permiso rp ON r.id = rp.rol_id
GROUP BY r.id, r.nombre
HAVING permisos_count = 0;

-- Asignar permisos básicos a rol Mensajero (ejemplo)
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 15, p.id
FROM permisos p
INNER JOIN modulos m ON p.modulo_id = m.id
INNER JOIN acciones a ON p.accion_id = a.id
WHERE (m.nombre = 'traslados' AND a.nombre IN ('view_own', 'receive', 'deliver'))
   OR (m.nombre = 'bodegas' AND a.nombre = 'view')
   OR (m.nombre = 'productos' AND a.nombre = 'view')
   OR (m.nombre = 'mensajeros' AND a.nombre = 'view');
```

---

## 📞 Soporte

**¿Cómo agregar una nueva acción?**

1. Insertar en tabla `acciones`:
```sql
INSERT INTO acciones (nombre, nombre_mostrar, descripcion, orden)
VALUES ('custom_action', 'Acción Custom', 'Descripción', 99);
```

2. Crear permisos (combinar módulo + acción):
```sql
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion)
SELECT m.id, a.id, CONCAT(m.nombre, '.custom_action'), 'Descripción'
FROM modulos m, acciones a
WHERE m.nombre = 'traslados' AND a.nombre = 'custom_action';
```

3. Asignar a roles:
```sql
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 15, p.id
FROM permisos p
WHERE p.codigo = 'traslados.custom_action';
```

4. Proteger endpoint:
```typescript
router.post('/custom', requirePermission('traslados', 'custom_action'), customHandler);
```

---

**Fecha de implementación:** Mayo 15, 2026  
**Versión:** 1.0.0  
**Estado:** ✅ Implementado y desplegado
