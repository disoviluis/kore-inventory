# Frontend Bodegas y Control de Mensajeros

## 📋 Resumen

Implementación frontend para el sistema de gestión de bodegas y control de mensajeros en traslados.

**Estado**: ✅ Completado - Módulos de Bodegas y Dashboard de Mensajeros
**Fecha**: Enero 2025

---

## ✅ Archivos Creados

### 1. Bodegas - CRUD Completo

#### **frontend/public/bodegas.html** (583 líneas)
- ✅ Interfaz completa de gestión de bodegas
- ✅ Cards de estadísticas (Total, Activas, Con Ventas, Principal)
- ✅ Barra de búsqueda y filtros (tipo, estado)
- ✅ Tabla responsiva con todas las bodegas
- ✅ Modal crear/editar bodega (14 campos)
- ✅ Modal visualización de stock por bodega
- ✅ Navegación integrada con sidebar

**Campos del formulario**:
- Código* (auto-generado)
- Tipo* (bodega, sucursal, local, almacen, tienda)
- Nombre*
- Dirección
- Ciudad, Departamento
- Teléfono, Email
- Responsable (dropdown de usuarios activos)
- Es Principal (checkbox) - solo puede haber 1 por empresa
- Permite Ventas (checkbox)
- Descripción

#### **frontend/public/assets/js/bodegas.js** (520 líneas)
- ✅ Conexión completa con API backend
- ✅ CRUD operations: Create, Read, Update, Delete
- ✅ Validación de formularios
- ✅ Gestión de bodega principal (única por empresa)
- ✅ Visualización de stock por bodega
- ✅ Filtros client-side (búsqueda, tipo, estado)
- ✅ SweetAlert2 para confirmaciones
- ✅ Manejo de errores y feedback al usuario

**API Endpoints utilizados**:
```javascript
GET    /api/bodegas?empresa_id=X          // Listar bodegas
GET    /api/bodegas/:id                   // Ver detalle
POST   /api/bodegas                       // Crear
PUT    /api/bodegas/:id                   // Actualizar
DELETE /api/bodegas/:id                   // Eliminar
GET    /api/bodegas/:id/stock             // Ver inventario
GET    /api/usuarios?empresa_id=X         // Dropdown responsables
```

---

### 2. Control de Mensajeros - Dashboard Supervisor

#### **frontend/public/mensajeros-dashboard.html** (400 líneas)
- ✅ Dashboard de supervisión multi-mensajero
- ✅ 4 cards de estadísticas (Total Mensajeros, En Tránsito, Entregados Hoy, Pendientes)
- ✅ Sistema de tabs:
  - **Por Mensajero**: Tarjetas individuales con traslados activos por persona
  - **Por Estado**: Tablas agrupadas por estado (En Tránsito, Aprobados, Recibidos Hoy)
  - **Mapa de Entregas**: Placeholder para GPS (futuro)
- ✅ Modales:
  - Detalle completo de traslado (ruta, productos, timeline)
  - Visualización de firma digital + GPS + IP
- ✅ Navegación integrada con sidebar

**Visualizaciones**:
- **Tarjetas de Mensajero**: Muestra estadísticas (en ruta, entregados, productos) + últimos 5 traslados
- **Tabla En Tránsito**: Número, mensajero, origen→destino, destinatario, productos, fecha envío
- **Tabla Aprobados**: Listos para asignar mensajero + botón "Enviar"
- **Tabla Recibidos Hoy**: Con acceso a firma digital

#### **frontend/public/assets/js/mensajeros-dashboard.js** (675 líneas)
- ✅ Carga y procesamiento de todos los traslados
- ✅ Agrupación automática por mensajero
- ✅ Cálculo de estadísticas en tiempo real
- ✅ Renderizado de tarjetas por mensajero
- ✅ Renderizado de tablas por estado
- ✅ Modal de asignación de mensajero a traslados aprobados
- ✅ Visualización de firma digital con metadatos
- ✅ Auto-refresh cada 60 segundos
- ✅ Función `enviarTraslado()` para asignar mensajero

**API Endpoints utilizados**:
```javascript
GET /api/traslados?empresa_id=X           // Todos los traslados
GET /api/traslados/:id                    // Detalle de traslado
PUT /api/traslados/:id/enviar             // Asignar mensajero y enviar
GET /api/usuarios?empresa_id=X            // Lista de mensajeros
```

**Filtros aplicados client-side**:
- Por estado: en_transito, aprobado, recibido, parcialmente_recibido
- Por fecha: recibidos hoy (fecha_recepcion === fecha_actual)
- Por mensajero: agrupación por mensajero_id

---

## 🎨 Características de Diseño

### Visual
- ✅ Bootstrap 5.3.2 responsive
- ✅ Bootstrap Icons 1.11.2
- ✅ Cards con animaciones hover
- ✅ Badges de colores por estado/tipo
- ✅ Tablas con hover effects
- ✅ Timeline visual para traslados por mensajero
- ✅ Modales con scroll automático

### UX
- ✅ SweetAlert2 para confirmaciones y notificaciones
- ✅ Validación de formularios con feedback visual
- ✅ Auto-refresh en dashboard mensajeros (60s)
- ✅ Búsqueda en tiempo real (bodegas)
- ✅ Filtros combinados (tipo + estado)
- ✅ Loading states durante operaciones

### Seguridad
- ✅ JWT token authentication
- ✅ Multi-tenant (empresa_id scoping)
- ✅ Validación de bodega principal única
- ✅ Control de roles (super_admin vs admin_empresa)

---

## 📊 Flujo de Trabajo del Usuario

### Gestión de Bodegas

1. **Crear Bodega**:
   - Click "Nueva Bodega"
   - Llenar formulario (tipo, nombre, dirección, etc.)
   - Seleccionar responsable
   - Marcar como principal (opcional, máx 1 por empresa)
   - Indicar si permite ventas
   - Guardar

2. **Editar Bodega**:
   - Click botón editar (lápiz) en tabla
   - Modificar campos
   - Sistema valida bodega principal única
   - Guardar cambios

3. **Ver Stock**:
   - Click "Ver Stock" en acciones
   - Modal muestra: producto, stock_actual, stock_reservado, stock_disponible, ubicación

4. **Eliminar Bodega**:
   - Click botón eliminar (tacho)
   - Confirmación con SweetAlert
   - Backend valida que no tenga movimientos activos

### Control de Mensajeros

1. **Vista "Por Mensajero"** (Tab 1):
   - Ve todas las tarjetas de mensajeros con traslados asignados
   - Cada tarjeta muestra:
     - Nombre y email
     - Estadísticas: En ruta, Entregados, Productos totales
     - Timeline de últimos 5 traslados
   - Click "Ver Todos los Traslados" → Modal con listado completo

2. **Vista "Por Estado"** (Tab 2):
   - **Tabla En Tránsito**: Traslados actualmente en camino
   - **Tabla Aprobados**: Listos para asignar mensajero → Click "Enviar" → Selecciona mensajero → Envía
   - **Tabla Recibidos Hoy**: Completados hoy → Click "Ver" en firma → Modal con imagen + GPS + timestamp

3. **Detalle de Traslado**:
   - Click icono ojo en cualquier tabla
   - Modal muestra:
     - Estado y fechas (solicitud, envío, recepción)
     - Destinatario (nombre, documento, teléfono, cargo)
     - Ruta (origen → destino con direcciones)
     - Productos (solicitado, aprobado, recibido)

4. **Ver Firma Digital**:
   - Solo disponible en traslados recibidos
   - Muestra:
     - Imagen de firma (base64)
     - Firmante
     - Fecha y hora
     - Coordenadas GPS
     - IP de recepción

---

## 🔄 Integración con Backend

### Stock Movement Logic
El frontend se integra con el workflow de 4 fases del backend:

1. **Create** (`POST /api/traslados`): 
   - Frontend: Crear formulario (futuro módulo traslados.html)
   - Backend: Valida stock_disponible >= cantidad_solicitada

2. **Approve** (`PUT /api/traslados/:id/aprobar`):
   - Frontend: Botón aprobar (futuro)
   - Backend: Ajusta cantidad_aprobada (puede diferir)

3. **Send** (`PUT /api/traslados/:id/enviar`):
   - Frontend: Dashboard mensajeros → Tabla Aprobados → "Enviar" → Selecciona mensajero
   - Backend: `UPDATE productos_bodegas SET stock_reservado += cantidad_aprobada` (origen)
   - Estado: `aprobado` → `en_transito`

4. **Receive** (`PUT /api/traslados/:id/recibir`):
   - Frontend: Mensajero mobile (futuro)
   - Backend: 
     - Origen: `stock_actual -= cantidad, stock_reservado -= cantidad`
     - Destino: `stock_actual += cantidad`
   - Estado: `en_transito` → `recibido`

### Multi-Messenger Support
El dashboard de mensajeros procesa todos los traslados y agrupa por `mensajero_id`, permitiendo:
- ✅ Supervisar múltiples mensajeros simultáneamente
- ✅ Ver qué lleva cada uno
- ✅ Monitorear estados en tiempo real
- ✅ Asignar nuevos traslados desde aprobados

---

## 📱 Navegación Integrada

Ambos módulos incluyen sidebar completo con nueva sección **LOGÍSTICA**:

```
📊 Dashboard
📦 OPERACIONES
   ├─ POS
   ├─ Ventas
   ├─ Clientes
   ├─ Inventario
   ├─ Productos
   ├─ Proveedores
   └─ Compras

📍 LOGÍSTICA (NUEVA)
   ├─ ✅ Bodegas
   ├─ ⏳ Traslados (próximamente)
   └─ ✅ Control Mensajeros (NUEVO)

📈 REPORTES
⚙️  ADMINISTRACIÓN
```

---

## ⏳ Pendiente de Implementación

### 1. Módulo Traslados CRUD
**Archivos a crear**:
- `frontend/public/traslados.html`
- `frontend/public/assets/js/traslados.js`

**Funcionalidades**:
- Formulario crear traslado:
  - Seleccionar bodega origen/destino (dropdown)
  - Agregar productos (tabla dinámica con búsqueda)
  - Cantidad solicitada por producto
  - Datos destinatario (nombre, documento, teléfono, cargo)
  - Campo motivo/observaciones
- Listado de traslados con filtros:
  - Por estado (todos, borrador, pendiente, aprobado, en_transito, recibido)
  - Por fecha (rango)
  - Por bodega (origen o destino)
- Acciones:
  - Aprobar traslado (admin)
  - Cancelar traslado (si no está en_transito)
  - Ver detalle
  - Imprimir guía de despacho

**API Endpoints**:
```javascript
POST   /api/traslados                     // Crear
GET    /api/traslados                     // Listar con filtros
GET    /api/traslados/:id                 // Ver detalle
PUT    /api/traslados/:id/aprobar         // Aprobar
PUT    /api/traslados/:id/cancelar        // Cancelar
DELETE /api/traslados/:id                 // Eliminar (solo borrador)
```

---

### 2. Mensajero Mobile View
**Archivos a crear**:
- `frontend/public/mensajero-mobile.html`
- `frontend/public/assets/js/mensajero-mobile.js`

**Funcionalidades**:
- Login como usuario mensajero
- Listar "Mis Entregas" asignadas:
  - `GET /api/traslados/mensajero/mis-traslados` (filtrar por usuario actual)
  - Vista mobile-first con cards grandes
- Detalle de entrega:
  - Dirección destino con botón "Ver en Google Maps"
  - Datos destinatario
  - Lista de productos con cantidades
  - Botón "Confirmar Recepción"
- Modal de recepción:
  - Canvas para captura de firma (biblioteca `signature_pad.js`)
  - Auto-captura GPS (Geolocation API)
  - Inputs cantidad recibida por producto
  - Observaciones opcionales
  - Botón "Finalizar Entrega" → `PUT /api/traslados/:id/recibir`

**Librerías necesarias**:
```html
<script src="https://cdn.jsdelivr.net/npm/signature_pad@4.0.0/dist/signature_pad.umd.min.js"></script>
```

**API GPS**:
```javascript
navigator.geolocation.getCurrentPosition(
  (position) => {
    const gps_latitud = position.coords.latitude;
    const gps_longitud = position.coords.longitude;
    // Enviar con firma
  },
  (error) => {
    console.error('GPS no disponible:', error);
  }
);
```

---

### 3. Mejoras Futuras

#### Mapa de Entregas (GPS Visualization)
- ✅ Tab ya existe en mensajeros-dashboard.html
- ⏳ Integrar Google Maps API o Leaflet
- ⏳ Mostrar pins por estado:
  - Verde: Recibido
  - Amarillo: En tránsito
  - Rojo: Pendiente
- ⏳ Rutas trazadas entre origen-destino

#### Notificaciones en Tiempo Real
- ⏳ WebSockets para updates en vivo
- ⏳ Notificación push cuando mensajero entrega
- ⏳ Alerta de traslados sin recibir después de X horas

#### Analytics
- ⏳ Dashboard de KPIs:
  - Tiempo promedio de entrega
  - Tasa de entregas exitosas
  - Mensajero más eficiente
  - Rutas más frecuentes

#### Impresión
- ⏳ Generar PDF de guía de despacho
- ⏳ Código QR con número de traslado
- ⏳ Etiquetas para productos

---

## 🧪 Testing Workflow Recomendado

### Fase 1: Setup Inicial
1. Crear empresa de prueba
2. Backend auto-crea bodega principal
3. Verificar en `bodegas.html` que aparece

### Fase 2: Bodegas
1. Crear bodega tipo "Sucursal" en otra ciudad
2. Crear bodega tipo "Local" para ventas
3. Editar bodega, cambiar responsable
4. Ver stock de bodega principal
5. Intentar eliminar bodega con stock → debe fallar
6. Intentar marcar 2 bodegas como principal → debe fallar

### Fase 3: Productos en Bodegas
1. Crear productos desde módulo productos
2. Asignar stock a bodega principal
3. Ver stock desde `bodegas.html` → "Ver Stock"
4. Verificar stock_actual, stock_disponible, stock_reservado

### Fase 4: Traslados (cuando se implemente frontend)
1. Crear traslado de Principal → Sucursal
2. Agregar 3 productos diferentes
3. Aprobar traslado
4. Verificar estado = "aprobado"
5. Desde `mensajeros-dashboard.html`:
   - Ver en tabla "Aprobados"
   - Click "Enviar"
   - Seleccionar usuario mensajero
   - Confirmar
6. Verificar que traslado pasa a "En Tránsito"
7. Ver tarjeta del mensajero en tab "Por Mensajero"

### Fase 5: Recepción (cuando se implemente mobile)
1. Login como usuario mensajero
2. Ver "Mis Entregas"
3. Click en traslado asignado
4. Ver detalle con dirección y productos
5. Click "Confirmar Recepción"
6. Dibujar firma en canvas
7. Permitir GPS (simulado si no hay sensor)
8. Confirmar cantidades recibidas
9. Finalizar
10. Desde `mensajeros-dashboard.html`:
    - Verificar en "Recibidos Hoy"
    - Click "Ver" firma
    - Ver imagen + GPS + timestamp

### Fase 6: Validación de Stock
1. Después de recepción:
2. Ir a bodega origen → Ver Stock → Verificar que stock_actual disminuyó
3. Ir a bodega destino → Ver Stock → Verificar que stock_actual aumentó
4. Verificar que stock_reservado volvió a 0 en origen

---

## 🔐 Control de Acceso

### Roles Soportados

**Super Admin**:
- ✅ Ve todas las empresas (selector)
- ✅ Acceso a todos los módulos
- ✅ Puede crear/editar/eliminar bodegas de cualquier empresa

**Admin Empresa**:
- ✅ Ve solo su empresa (empresa_id_default)
- ✅ Gestión completa de bodegas
- ✅ Asignación de mensajeros
- ✅ Aprobación de traslados

**Usuario Regular** (futuro):
- ⏳ Puede crear traslados
- ⏳ No puede aprobar
- ⏳ Solo ve sus propios traslados

**Mensajero** (futuro):
- ⏳ Solo ve traslados asignados a él
- ⏳ Puede recibir traslados
- ⏳ Captura firma y GPS

---

## 📖 Guía de Archivos

```
frontend/public/
├── bodegas.html                           ✅ CRUD de bodegas
├── mensajeros-dashboard.html              ✅ Dashboard supervisor
├── traslados.html                         ⏳ CRUD de traslados (pendiente)
├── mensajero-mobile.html                  ⏳ Vista móvil mensajero (pendiente)
│
└── assets/js/
    ├── bodegas.js                         ✅ Lógica CRUD bodegas
    ├── mensajeros-dashboard.js            ✅ Lógica dashboard mensajeros
    ├── traslados.js                       ⏳ Lógica traslados (pendiente)
    ├── mensajero-mobile.js                ⏳ Lógica mobile (pendiente)
    └── sidebar-navigation.js              ✅ Control de sidebar (existente)
```

---

## 🚀 Próximos Pasos

### Inmediatos (Alta Prioridad)
1. ✅ ~~Crear bodegas.html y bodegas.js~~ COMPLETADO
2. ✅ ~~Crear mensajeros-dashboard.html y mensajeros-dashboard.js~~ COMPLETADO
3. ⏳ Crear traslados.html y traslados.js (CRUD de traslados)
4. ⏳ Crear mensajero-mobile.html y mensajero-mobile.js
5. ⏳ Integrar signature_pad.js
6. ⏳ Testing end-to-end completo

### Mediano Plazo
- Implementar mapa GPS en tab "Mapa de Entregas"
- Notificaciones push para supervisores
- Reportes de eficiencia de mensajeros
- Impresión de guías de despacho

### Largo Plazo
- App móvil nativa (React Native / Flutter)
- Integración con sistemas de tracking GPS externos
- IA para optimización de rutas
- Analytics avanzados con ML

---

## 📞 Soporte

Para dudas o issues:
- Backend API: http://18.191.181.99:3000/api
- Documentación técnica: `SISTEMA_BODEGAS_TRASLADOS.md`
- Stack: Node.js + Express + MySQL + JWT
- Frontend: Vanilla JS + Bootstrap 5.3 + SweetAlert2

---

**Última actualización**: Enero 2025
**Autor**: GitHub Copilot
**Versión**: 1.0.0
