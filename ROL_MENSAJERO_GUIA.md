# 🚚 ROL DE MENSAJERO - GUÍA COMPLETA

## 📋 Resumen

El sistema de mensajeros actualmente funciona de **DOS formas diferentes**:

### 1. **tipo_usuario = 'mensajero'** (ACTUAL - Ya implementado)
- Es una clasificación de usuario a nivel de sistema
- Similar a `super_admin` o `admin_empresa`
- **No es un rol asignable**, es un tipo de cuenta
- Tiene acceso hardcodeado a funcionalidades específicas
- No usa la tabla `roles` ni `permisos`

### 2. **ROL "Mensajero"** (RECOMENDADO - Por implementar)
- Es un rol dentro de una empresa
- Se asigna a usuarios normales
- Usa el sistema de permisos estándar
- Más flexible y escalable
- Permite que un usuario sea mensajero en una empresa y bodeguero en otra

---

## 🎯 Comparación: tipo_usuario vs ROL

| Característica | tipo_usuario = 'mensajero' | Rol "Mensajero" |
|---|---|---|
| **Creación** | Super admin crea cuenta especial | Admin empresa asigna rol a usuario |
| **Flexibilidad** | Usuario SOLO puede ser mensajero | Usuario puede tener múltiples roles |
| **Multi-tenant** | Complejo (requiere usuario_empresa) | Natural (rol por empresa) |
| **Permisos** | Hardcodeados en código | Gestionados en BD |
| **Dashboard** | Vista única (mensajeros-dashboard.html) | Vista según permisos asignados |
| **Escalabilidad** | Limitado | ✅ Recomendado |

---

## ✅ **RECOMENDACIÓN:** Usar ROL en lugar de tipo_usuario

### Ventajas:
1. ✅ Admin empresa puede crear y gestionar mensajeros
2. ✅ Un usuario puede ser mensajero en Empresa A y vendedor en Empresa B
3. ✅ Se usa el sistema de permisos estándar
4. ✅ Más fácil de mantener y escalar
5. ✅ No requiere código especial

---

## 🔧 Implementación del ROL "Mensajero"

### **PASO 1: Crear el módulo "mensajeros" en la BD**

```sql
-- Insertar módulo para Control de Mensajeros (si no existe)
INSERT INTO modulos (nombre, nombre_mostrar, icono, descripcion, categoria, nivel, orden, activo)
VALUES (
  'mensajeros',
  'Control Mensajeros',
  'bi-truck',
  'Dashboard de control y supervisión de entregas',
  'logistica',
  'tenant',
  14,
  1
);

SET @modulo_mensajeros_id = LAST_INSERT_ID();
```

### **PASO 2: Verificar permisos existentes para traslados**

```sql
-- Ver permisos actuales de traslados
SELECT 
  p.id,
  p.codigo,
  m.nombre as modulo,
  a.nombre as accion
FROM permisos p
INNER JOIN modulos m ON p.modulo_id = m.id
INNER JOIN acciones a ON p.accion_id = a.id
WHERE m.nombre = 'traslados';
```

**Permisos que debería tener el módulo traslados:**
- `traslados.view` - Ver traslados
- `traslados.view_own` - Ver solo mis traslados
- `traslados.receive` - Recibir/Firmar entregas

### **PASO 3: Crear acción especial "view_own"** (si no existe)

```sql
-- Acción para ver solo recursos propios
INSERT INTO acciones (nombre, nombre_mostrar, descripcion, activo)
VALUES (
  'view_own',
  'Ver Propios',
  'Ver solo recursos asignados al usuario',
  1
);
```

### **PASO 4: Crear permisos específicos para mensajeros**

```sql
-- Obtener IDs
SET @modulo_traslados = (SELECT id FROM modulos WHERE nombre = 'traslados' LIMIT 1);
SET @accion_view = (SELECT id FROM acciones WHERE nombre = 'view' LIMIT 1);
SET @accion_view_own = (SELECT id FROM acciones WHERE nombre = 'view_own' LIMIT 1);
SET @accion_receive = (SELECT id FROM acciones WHERE nombre = 'receive' LIMIT 1);

-- Crear permisos
INSERT INTO permisos (codigo, modulo_id, accion_id, descripcion, activo)
VALUES
  ('traslados.view_own', @modulo_traslados, @accion_view_own, 'Ver solo traslados asignados a mí', 1),
  ('traslados.receive', @modulo_traslados, @accion_receive, 'Recibir traslados y firmar entrega', 1);
```

### **PASO 5: Crear el ROL "Mensajero" (plantilla de sistema)**

```sql
-- Rol de sistema (empresa_id = NULL) para ser plantilla
INSERT INTO roles (empresa_id, nombre, slug, descripcion, nivel, tipo, activo)
VALUES (
  NULL,
  'Mensajero',
  'mensajero',
  'Encargado de entregas y traslados entre bodegas',
  30,  -- Nivel bajo (similar a bodeguero)
  'sistema',  -- Plantilla auto-creada para nuevas empresas
  1
);

SET @rol_mensajero_id = LAST_INSERT_ID();
```

### **PASO 6: Asignar permisos al ROL Mensajero**

```sql
-- Asignar permisos específicos
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 
  @rol_mensajero_id,
  p.id
FROM permisos p
INNER JOIN modulos m ON p.modulo_id = m.id
INNER JOIN acciones a ON p.accion_id = a.id
WHERE 
  -- Solo módulo de traslados
  m.nombre = 'traslados'
  -- Y solo estas acciones
  AND a.nombre IN ('view_own', 'receive')
  AND p.activo = 1;

-- También podríamos darle acceso de vista a bodegas
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 
  @rol_mensajero_id,
  p.id
FROM permisos p
INNER JOIN modulos m ON p.modulo_id = m.id
INNER JOIN acciones a ON p.accion_id = a.id
WHERE 
  m.nombre = 'bodegas'
  AND a.nombre = 'view'
  AND p.activo = 1;
```

---

## 📱 Dashboard de Mensajero

### Opción A: Dashboard dedicado (mensajeros-dashboard.html)
**Ventajas:**
- Interfaz optimizada para móvil
- Funciones específicas (firma, GPS, etc.)
- Vista simplificada

**Desventajas:**
- Duplicación de código
- Mantenimiento adicional

### Opción B: Usar dashboard.html con módulo filtrado
**Ventajas:**
- Menos duplicación
- Sistema de permisos unificado
- Un solo punto de entrada

**Desventajas:**
- Menos optimizado para móvil
- Requiere diseño responsive

### **RECOMENDACIÓN:** Opción A (Dashboard dedicado)

**Razón:** Los mensajeros usan móvil en campo, necesitan:
- Interfaz grande y táctil
- Acceso rápido a GPS
- Canvas para firma
- Lista simple de pendientes

---

## 🔒 Ubicación del Módulo en Sidebar

### ✅ **SÍ - Debe estar en LOGÍSTICA**

```html
<!-- LOGÍSTICA Section -->
<li class="nav-item">
    <a class="nav-link nav-section" data-bs-toggle="collapse" href="#logisticaCollapse">
        <i class="bi bi-boxes"></i>
        <span>LOGÍSTICA</span>
        <i class="bi bi-chevron-down ms-auto collapse-icon"></i>
    </a>
    <div class="collapse" id="logisticaCollapse">
        <ul class="nav flex-column ms-3">
            <li class="nav-item">
                <a class="nav-link" href="bodegas.html">
                    <i class="bi bi-building"></i>
                    <span>Bodegas</span>
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" href="traslados.html">
                    <i class="bi bi-arrow-left-right"></i>
                    <span>Traslados</span>
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" href="mensajeros-dashboard.html">
                    <i class="bi bi-truck"></i>
                    <span>Control Mensajeros</span>
                </a>
            </li>
        </ul>
    </div>
</li>
```

**Razón:**
- Traslados y Mensajeros están relacionados
- Ambos son parte de logística interna
- Admin que gestiona bodegas también asigna mensajeros

---

## 🎯 Dashboard del Mensajero - Funcionalidades

### Vista Principal (tabs)

#### **Tab 1: Pendientes** 🔴
```
┌─────────────────────────────────────┐
│ 🚚 TRS-2026-001                     │
│ Bodega Principal → Sucursal Centro  │
│ Destinatario: Carlos Pérez          │
│ 📦 5 productos (120 unidades)       │
│ 📍 Calle 50 #45-30, Bogotá         │
│ 📞 +57 300 1234567                 │
│                                     │
│ [Ver Mapa] [Iniciar Entrega]       │
└─────────────────────────────────────┘
```

#### **Tab 2: En Tránsito** 🟡
- Traslados que ya recogió pero no ha entregado
- Botón: **[Recibir y Firmar]**

#### **Tab 3: Completadas** ✅
- Histórico de entregas del día/semana
- Ver firma capturada
- Ver GPS de entrega

### Modal de Recepción

```
┌────────────────────────────────────────┐
│ Recibir Traslado TRS-2026-001         │
│────────────────────────────────────────│
│                                        │
│ Productos Recibidos:                   │
│ [✓] Producto A - 50 unidades           │
│ [✓] Producto B - 30 unidades           │
│ [ ] Producto C - 40 unidades (faltante)│
│                                        │
│ Datos del Receptor:                    │
│ Nombre:  [Carlos Pérez Gómez........] │
│ Cédula:  [1234567890................] │
│ Teléfono:[+57 300 1234567...........] │
│ Cargo:   [Jefe de Almacén...........] │
│                                        │
│ Firma Digital:                         │
│ ┌──────────────────────────────────┐  │
│ │                                  │  │
│ │     [Canvas para firmar]         │  │
│ │                                  │  │
│ └──────────────────────────────────┘  │
│ [Limpiar]                              │
│                                        │
│ 📸 [Tomar Foto] (Opcional)             │
│ 📍 GPS: 4.6533, -74.0836 ✅             │
│                                        │
│ Observaciones:                         │
│ [.................................]    │
│                                        │
│ [Cancelar]  [Confirmar Recepción]     │
└────────────────────────────────────────┘
```

---

## 🔄 Flujo Completo

### Desde la perspectiva del Admin:

1. **Crear traslado**
   - Selecciona bodega origen y destino
   - Agrega productos
   - Captura datos del destinatario

2. **Aprobar traslado**
   - Revisa cantidades solicitadas
   - Puede ajustar cantidades

3. **Despachar y asignar mensajero**
   - Selecciona mensajero del dropdown
   - Sistema reserva stock

### Desde la perspectiva del Mensajero:

4. **Login en mensajeros-dashboard.html**
   - Ve lista de sus traslados pendientes

5. **Iniciar entrega**
   - Presiona "Iniciar Entrega"
   - Sistema cambia estado a "en_transito"
   - Aparece en tab "En Tránsito"

6. **Llegar a destino**
   - Entrega productos físicamente
   - Presiona "Recibir y Firmar"

7. **Capturar firma**
   - Modal se abre con canvas
   - Receptor firma en pantalla
   - GPS se captura automáticamente
   - Puede tomar foto de productos

8. **Confirmar recepción**
   - Sistema actualiza stock:
     - Quita de bodega origen
     - Agrega a bodega destino
   - Guarda firma, GPS, timestamp
   - Traslado pasa a "recibido"

---

## 🛠️ Modificaciones en Backend

### traslados.controller.ts

Actualmente usa:
```typescript
const esMensajero = usuario.tipo_usuario === 'mensajero';
```

**Cambiar a:**
```typescript
// Verificar si el usuario tiene ROL de mensajero en esta empresa
const [rolesMensajero] = await pool.execute<RowDataPacket[]>(
  `SELECT r.slug 
   FROM usuario_rol ur
   INNER JOIN roles r ON ur.rol_id = r.id
   WHERE ur.usuario_id = ? 
     AND ur.empresa_id = ?
     AND r.slug = 'mensajero'
     AND r.activo = 1`,
  [usuario.id, empresa_id]
);

const esMensajero = rolesMensajero.length > 0;
```

**Ventaja:** Ahora cualquier usuario puede ser mensajero si tiene el rol asignado.

---

## 📊 Permisos Recomendados para el ROL Mensajero

| Módulo | Permiso | Acción | Justificación |
|--------|---------|--------|---------------|
| **traslados** | `traslados.view_own` | Ver solo míos | Solo sus traslados asignados |
| **traslados** | `traslados.receive` | Recibir | Puede marcar como entregado y firmar |
| **bodegas** | `bodegas.view` | Ver | Necesita ver direcciones de destino |
| **productos** | `productos.view` | Ver | Necesita ver qué entrega |

**NO debe tener:**
- ❌ `traslados.create` - No crea traslados
- ❌ `traslados.approve` - No aprueba
- ❌ `traslados.send` - No despacha
- ❌ `traslados.cancel` - No cancela
- ❌ `traslados.delete` - No elimina
- ❌ Ningún permiso de `edit` en otros módulos

---

## 🎨 Sidebar Filtrado por Permisos

Con el sistema de permisos actual, el mensajero vería:

```
DASHBOARD
  └─ [Oculto - no tiene permiso]

OPERACIONES
  └─ [Toda la sección oculta]

LOGÍSTICA
  ├─ Bodegas (solo ver, no editar)
  ├─ Traslados (solo ver los suyos)
  └─ Control Mensajeros (su dashboard principal)

FINANZAS
  └─ [Toda la sección oculta]

REPORTES
  └─ [Toda la sección oculta]

ADMINISTRACIÓN
  └─ [Toda la sección oculta]
```

**Resultado esperado:** El mensajero básicamente solo ve "Control Mensajeros" y tiene acceso limitado a Traslados.

---

## ✅ Checklist de Implementación

### Base de Datos
- [ ] Crear módulo `mensajeros`
- [ ] Crear acción `view_own` (si no existe)
- [ ] Crear acción `receive` (si no existe)
- [ ] Crear permisos `traslados.view_own` y `traslados.receive`
- [ ] Crear rol sistema "Mensajero"
- [ ] Asignar permisos al rol

### Backend
- [ ] Modificar traslados.controller.ts para usar roles en lugar de tipo_usuario
- [ ] Crear endpoint `GET /api/traslados/mis-traslados` basado en rol
- [ ] Validar permiso `traslados.receive` en endpoint de recepción

### Frontend
- [ ] Actualizar mensajeros-dashboard.html
- [ ] Implementar canvas de firma (signature_pad.js)
- [ ] Integrar Geolocation API
- [ ] Mostrar solo traslados con `mensajero_id = usuario.id`
- [ ] Modal de recepción con todos los campos

### Sistema de Permisos
- [ ] Filtrar sidebar según permisos
- [ ] Verificar que mensajero solo ve su módulo
- [ ] Redirigir a mensajeros-dashboard.html si solo tiene ese permiso

---

## 🚀 Próximos Pasos Recomendados

1. ✅ **Ejecutar script SQL** para crear rol y permisos
2. ✅ **Modificar backend** para usar roles
3. ✅ **Compilar y desplegar** backend actualizado
4. ✅ **Crear usuario de prueba** y asignar rol "Mensajero"
5. ✅ **Probar** que solo vea sus traslados
6. ✅ **Implementar frontend** completo

---

## 📞 Dudas Frecuentes

### ¿Puede un mensajero trabajar para varias empresas?
✅ **SÍ** - Con el sistema de roles por empresa:
- Usuario 25 es mensajero en Empresa A (via usuario_rol)
- Usuario 25 es vendedor en Empresa B (via usuario_rol)

### ¿El mensajero debe tener cuenta especial?
❌ **NO** - Es un usuario normal con rol específico asignado por admin_empresa

### ¿Dónde aparece "Control Mensajeros" en el sidebar?
✅ **LOGÍSTICA** - Junto a Bodegas y Traslados

### ¿Qué dashboard se carga al hacer login como mensajero?
✅ **mensajeros-dashboard.html** - Interfaz optimizada para móvil

### ¿Admin empresa puede crear mensajeros?
✅ **SÍ** - Solo necesita:
1. Crear usuario normal
2. Asignar rol "Mensajero"
3. Dar acceso a la empresa (usuario_empresa)

---

## 📝 Notas Finales

### **RECOMENDACIÓN FINAL:** 
Migrar de `tipo_usuario='mensajero'` a **ROL de mensajero** para aprovechar el sistema de permisos existente y permitir que admin_empresa gestione sus propios mensajeros sin intervención del super_admin.

### Script SQL Completo en el Siguiente Archivo:
`SQL/create_rol_mensajero.sql`

---

**Fecha:** 14 de Mayo, 2026  
**Autor:** Disovi Soft  
**Estado:** 📖 Documentación - Pendiente implementación
