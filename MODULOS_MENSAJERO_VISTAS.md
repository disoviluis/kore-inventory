# 📱 MÓDULOS Y VISTAS DEL MENSAJERO

## 📊 Permisos del Rol "Mensajero"

El rol **Mensajero** (ID: 15) tiene acceso a los siguientes módulos:

| Módulo | Categoría | Acciones Permitidas |
|--------|-----------|---------------------|
| **bodegas** | Inventario | `view` - Ver listado de bodegas |
| **traslados** | Inventario | `view_own` - Ver solo sus traslados<br>`receive` - Recibir traslados |
| **mensajeros** | Logística | `view` - Acceso al dashboard de mensajeros |
| **productos** | Operaciones | `view` - Ver información de productos |

**Total: 4 módulos permitidos**

---

## 🎯 Detección de Vista

### Vista MÓVIL (Mensajero de Campo)

**Se muestra cuando:**
- ✅ El usuario tiene permiso del módulo `mensajeros`
- ✅ El usuario **NO** tiene acceso a módulos administrativos

**Módulos administrativos que activan vista de supervisor:**
- `usuarios`
- `roles`
- `empresas`
- `licencias`
- `auditoria`
- `facturacion`

**Interfaz:**
```
┌─────────────────────────────────┐
│     📱 MIS ENTREGAS             │
├─────────────────────────────────┤
│  Mini Stats (cards 3x)          │
│  ┌──────┐ ┌──────┐ ┌──────┐    │
│  │ Pend │ │ Ruta │ │ Comp │    │
│  └──────┘ └──────┘ └──────┘    │
├─────────────────────────────────┤
│  Tabs: [Pendientes] [En Ruta]  │
│        [Completadas]            │
├─────────────────────────────────┤
│  Filtros: ○ Hoy  ○ Semana      │
│           ○ Mes                 │
├─────────────────────────────────┤
│  Lista de traslados (cards)     │
│  ┌─────────────────────────┐   │
│  │ TRS-2025-9906          │   │
│  │ Origen → Destino       │   │
│  │ 📍 Dirección           │   │
│  │ 👤 Destinatario        │   │
│  │ 📦 10 productos        │   │
│  │ [Iniciar Ruta]         │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

**Funcionalidades:**
- Ver traslados asignados
- Iniciar entregas
- Capturar firma digital
- Registrar GPS de entrega
- Subir foto de entrega

---

### Vista ESCRITORIO (Supervisor/Admin)

**Se muestra cuando:**
- ✅ El usuario tiene permiso del módulo `mensajeros`
- ✅ El usuario **SÍ** tiene acceso a módulos administrativos

**Interfaz:**
```
┌──────────────────────────────────────────┐
│  💼 CONTROL DE MENSAJEROS                │
├──────────────────────────────────────────┤
│  Summary Stats (4 cards)                 │
│  ┌────────┐ ┌────────┐ ┌────────┐       │
│  │ Total  │ │ Activos│ │ Hoy    │       │
│  │ Mensaj.│ │ En Ruta│ │ Entreg.│       │
│  └────────┘ └────────┘ └────────┘       │
├──────────────────────────────────────────┤
│  Tabs: [Por Mensajero] [Por Estado]     │
├──────────────────────────────────────────┤
│  Tabla de traslados                      │
│  ┌────────────────────────────────────┐  │
│  │ # │ Mensajero │ Ruta │ Estado    │  │
│  │───┼───────────┼──────┼───────────│  │
│  │ 1 │ Juan M.   │ A→B  │ En Ruta   │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

**Funcionalidades:**
- Ver todos los traslados
- Monitorear mensajeros
- Estadísticas generales
- Asignación de traslados
- Reportes y métricas

---

## 🔄 Lógica de Detección (Código)

```javascript
function detectarTipoVista() {
    const modulosPermitidos = JSON.parse(localStorage.getItem('modulosPermitidos'));
    
    // Módulos administrativos
    const modulosAdmin = ['usuarios', 'roles', 'empresas', 'licencias', 'auditoria', 'facturacion'];
    
    // ¿Tiene acceso a mensajeros?
    const tieneAccesoMensajeros = modulosPermitidos.some(m => m.nombre === 'mensajeros');
    
    // ¿Tiene módulos administrativos?
    const tieneModulosAdmin = modulosPermitidos.some(m => modulosAdmin.includes(m.nombre));
    
    // Si tiene acceso a mensajeros Y NO tiene módulos admin = VISTA MÓVIL
    if (tieneAccesoMensajeros && !tieneModulosAdmin) {
        mostrarVistaMensajero();
    } else {
        mostrarVistaAdmin();
    }
}
```

---

## 👤 Usuario de Prueba: mensajero.prueba@kore.com

**Credenciales:**
- Email: `mensajero.prueba@kore.com`
- Password: `password`
- Empresa: PRUEBA1 (ID: 18)

**Módulos asignados:**
1. ✅ bodegas (view)
2. ✅ traslados (receive, view_own)
3. ✅ mensajeros (view)
4. ✅ productos (view)

**Vista esperada:** 📱 **MÓVIL** (Mensajero de campo)

**Razón:**
- ✅ Tiene acceso a `mensajeros`
- ✅ NO tiene módulos administrativos
- ✅ Total de 4 módulos operativos (bodegas, traslados, mensajeros, productos)

---

## 🧪 Testing

### Para vista MÓVIL:
```bash
# Login como mensajero
Email: mensajero.prueba@kore.com
Password: password

# Verificar en consola del navegador:
> JSON.parse(localStorage.getItem('modulosPermitidos'))
[
  { nombre: "bodegas", ... },
  { nombre: "traslados", ... },
  { nombre: "mensajeros", ... },
  { nombre: "productos", ... }
]

# Verificar vista cargada:
> document.getElementById('vistaMensajero').style.display
"block"

> document.getElementById('vistaAdmin').style.display
"none"
```

### Para vista ESCRITORIO:
Asignar al usuario un rol que incluya módulos administrativos como:
- `usuarios` o
- `roles` o
- `empresas`

---

## 📋 Sidebar Navigation

**Vista MÓVIL (Sidebar):**
- Dashboard
- **OPERACIONES** (puede estar vacío o visible según otros permisos)
  - (sin opciones si solo es mensajero)
- **INVENTARIO**
  - Bodegas
  - Traslados
- **LOGÍSTICA**
  - ✨ Control Mensajeros (página actual)

**Vista ESCRITORIO (Sidebar):**
- Dashboard
- OPERACIONES
- INVENTARIO
  - Bodegas
  - Traslados
- **LOGÍSTICA**
  - ✨ Control Mensajeros (vista supervisor)
- **ADMINISTRACIÓN** (si tiene permisos)
  - Usuarios
  - Roles
  - Etc.

---

## ⚙️ Cambios Aplicados

### Archivo: `mensajeros-dashboard.js`

**Antes (❌ Incorrecto):**
```javascript
const soloMensajero = modulosPermitidos.length <= 2 && tieneAccesoMensajeros;
```
- Problema: Contaba módulos (≤2)
- Resultado: 4 módulos = Vista Admin (incorrecto)

**Ahora (✅ Correcto):**
```javascript
const modulosAdmin = ['usuarios', 'roles', 'empresas', 'licencias', 'auditoria', 'facturacion'];
const tieneModulosAdmin = modulosPermitidos.some(m => modulosAdmin.includes(m.nombre));
const esMensajeroCampo = tieneAccesoMensajeros && !tieneModulosAdmin;
```
- Verifica: ¿Tiene mensajeros? ¿NO tiene admin?
- Resultado: 4 módulos operativos = Vista Móvil (correcto)

---

## ✅ Estado del Despliegue

- ✅ SQL ejecutado: Rol Mensajero creado (ID: 15)
- ✅ Permisos asignados: 5 permisos en 4 módulos
- ✅ Usuario de prueba: mensajero.prueba@kore.com creado
- ✅ Traslado de prueba: TRS-2025-9906 creado
- ✅ Lógica de detección: Corregida y desplegada
- ✅ Archivos desplegados:
  - `mensajeros-dashboard.html` (scripts duplicados eliminados)
  - `mensajeros-dashboard.js` (lógica de detección corregida)

---

## 🚀 Próximos Pasos

1. **Cerrar sesión del navegador**
2. **Limpiar cache** (Ctrl+Shift+Del)
3. **Iniciar sesión:**
   - Email: `mensajero.prueba@kore.com`
   - Password: `password`
4. **Verificar vista móvil cargada**
5. **Abrir consola (F12)** para ver logs de detección
6. **Probar flujo completo:**
   - Ver traslado TRS-2025-9906 en "Pendientes"
   - Click "Iniciar Ruta"
   - Click "Recibir"
   - Firmar en canvas
   - Confirmar entrega

---

## 📞 Soporte

Si la vista no se muestra correctamente:

1. **Verificar localStorage:**
   ```javascript
   // En consola del navegador
   console.log('Empresa:', localStorage.getItem('empresaActiva'));
   console.log('Módulos:', localStorage.getItem('modulosPermitidos'));
   ```

2. **Verificar logs en consola:**
   - Debe mostrar: `"✅ Mostrando vista MENSAJERO (móvil)"`

3. **Si sigue mostrando vista Admin:**
   - Verificar que el usuario NO tenga asignado ningún módulo administrativo
   - Revisar los roles asignados en la base de datos

