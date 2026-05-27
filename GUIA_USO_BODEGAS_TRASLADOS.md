# 📦 Guía de Uso - Sistema de Bodegas y Traslados

## 🎯 Módulos Implementados

### ✅ 1. Gestión de Bodegas
**Archivo:** `frontend/public/bodegas.html`

#### Funcionalidades:
- ✅ Crear bodegas (bodega, sucursal, local, almacén, tienda)
- ✅ Editar información de bodegas
- ✅ Ver stock por bodega (productos, cantidades, ubicaciones)
- ✅ Marcar bodega principal (única)
- ✅ Habilitar/deshabilitar ventas por bodega
- ✅ Filtrar por tipo y estado
- ✅ Asignar responsable

#### Navegación:
```
Menú → LOGÍSTICA → Bodegas
```

---

### ✅ 2. Gestión de Traslados
**Archivo:** `frontend/public/traslados.html`

#### Funcionalidades:
- ✅ **Crear traslado**: Seleccionar origen/destino, agregar productos
- ✅ **Aprobar traslado**: Revisar y aprobar cantidades
- ✅ **Enviar traslado**: Asignar mensajero
- ✅ **Cancelar traslado**: Con motivo de cancelación
- ✅ **Ver detalle**: Timeline completo del traslado
- ✅ Filtros: Por estado, bodega, fecha
- ✅ Estadísticas: Total, pendientes, en tránsito, completados

#### Estados del Traslado:
1. **Borrador** → Se puede editar
2. **Pendiente Aprobación** → Esperando aprobación
3. **Aprobado** → Listo para enviar
4. **En Tránsito** → Asignado a mensajero
5. **Recibido** → Completado
6. **Cancelado** → Cancelado con motivo

#### Navegación:
```
Menú → LOGÍSTICA → Traslados
```

---

### ✅ 3. Dashboard Control de Mensajeros
**Archivo:** `frontend/public/mensajeros-dashboard.html`

#### Funcionalidades:
- ✅ Ver todos los mensajeros activos
- ✅ **Tab "Por Mensajero"**: Tarjetas individuales con stats
- ✅ **Tab "Por Estado"**: 
  - En Tránsito
  - Aprobados (listos para enviar)
  - Recibidos Hoy
- ✅ Enviar traslados desde dashboard
- ✅ Ver firma digital con GPS
- ✅ Auto-refresh cada 60 segundos
- ✅ Ver detalle completo de cada traslado

#### Navegación:
```
Menú → LOGÍSTICA → Control Mensajeros
```

---

## 🔄 Flujo Completo de Traslado

### Paso 1: Configuración Inicial
```
1. Crear bodegas necesarias (Bodegas → Nueva Bodega)
   - Bodega Principal (automática al crear empresa)
   - Sucursales
   - Locales
   
2. Agregar productos al inventario (Productos)

3. Asignar stock inicial a bodegas (Inventario)
```

### Paso 2: Crear Traslado
```
Traslados → Nuevo Traslado

1. Seleccionar bodega ORIGEN
2. Seleccionar bodega DESTINO
3. Hacer clic en "Agregar" productos
4. Buscar y seleccionar productos
5. Ingresar cantidades (valida stock disponible)
6. Completar datos del destinatario (opcional):
   - Nombre
   - Documento
   - Teléfono
   - Cargo
7. Agregar observaciones
8. Guardar Traslado
   → Estado: PENDIENTE APROBACIÓN
```

### Paso 3: Aprobar Traslado
```
Traslados → Ver traslado → Botón "Aprobar"

Usuario con permisos:
1. Revisa productos y cantidades
2. Puede ajustar cantidades aprobadas
3. Hacer clic en "Aprobar"
   → Estado: APROBADO
   → Stock se RESERVA en bodega origen
```

### Paso 4: Enviar Traslado
```
Traslados → Ver traslado → Botón "Enviar"
O desde: Control Mensajeros → Aprobados → Enviar

1. Seleccionar MENSAJERO de la lista
2. Agregar observaciones del envío
3. Hacer clic en "Enviar"
   → Estado: EN TRÁNSITO
   → Notifica al mensajero (futuro)
```

### Paso 5: Recepción (Mensajero Mobile - Futuro)
```
Vista Móvil Mensajero → Mis Entregas → Ver detalle

1. Ver productos a entregar
2. Llegar a bodega destino
3. Capturar firma del receptor (canvas)
4. Capturar GPS automático
5. Confirmar cantidades recibidas
6. Recibir traslado
   → Estado: RECIBIDO
   → Stock se TRANSFIERE físicamente
   → Firma y GPS guardados
```

### Paso 6: Verificación
```
Control Mensajeros → Recibidos Hoy → Ver Firma

Supervisor verifica:
- Firma digital
- GPS de recepción
- Cantidades recibidas vs enviadas
- Timestamp de recepción
```

---

## 📊 Movimientos de Stock

### Flujo de Reserva y Transferencia:

#### 1. **Crear Traslado** (Borrador → Pendiente)
```sql
-- Solo validación
SELECT stock_disponible >= cantidad_solicitada
FROM productos_bodegas
WHERE producto_id = X AND bodega_id = ORIGEN
```
✅ No hay cambios en stock

#### 2. **Aprobar Traslado** (Pendiente → Aprobado)
```sql
-- Reservar stock en origen
UPDATE productos_bodegas
SET stock_reservado = stock_reservado + cantidad_aprobada
WHERE producto_id = X AND bodega_id = ORIGEN
```
✅ `stock_disponible` disminuye (no disponible para ventas)
✅ `stock_actual` NO cambia (producto aún está físicamente)

#### 3. **Enviar Traslado** (Aprobado → En Tránsito)
```sql
-- Mantiene la reserva
```
✅ Stock sigue reservado
✅ Asigna mensajero
✅ Registra fecha envío

#### 4. **Recibir Traslado** (En Tránsito → Recibido)
```sql
-- ORIGEN: Disminuir físicamente
UPDATE productos_bodegas
SET stock_actual = stock_actual - cantidad_recibida,
    stock_reservado = stock_reservado - cantidad_recibida
WHERE producto_id = X AND bodega_id = ORIGEN;

-- DESTINO: Aumentar físicamente
UPDATE productos_bodegas
SET stock_actual = stock_actual + cantidad_recibida
WHERE producto_id = X AND bodega_id = DESTINO;
```
✅ Transferencia física completada
✅ Reserva liberada en origen
✅ Stock incrementado en destino

#### 5. **Cancelar Traslado** (Cualquiera → Cancelado)
```sql
-- Si estaba aprobado o en tránsito, liberar reserva
UPDATE productos_bodegas
SET stock_reservado = stock_reservado - cantidad_aprobada
WHERE producto_id = X AND bodega_id = ORIGEN
```
✅ Stock vuelve a estar disponible
✅ No hay transferencia física

---

## 🔐 Permisos y Roles

### Acciones por Rol:

| Acción | Admin Empresa | Supervisor | Almacenista | Mensajero |
|--------|---------------|------------|-------------|-----------|
| Ver bodegas | ✅ | ✅ | ✅ | ❌ |
| Crear bodegas | ✅ | ❌ | ❌ | ❌ |
| Ver traslados | ✅ | ✅ | ✅ | Solo asignados |
| Crear traslados | ✅ | ✅ | ✅ | ❌ |
| Aprobar traslados | ✅ | ✅ | ❌ | ❌ |
| Enviar traslados | ✅ | ✅ | ❌ | ❌ |
| Recibir traslados | ✅ | ✅ | ✅ | ✅ (solo suyos) |
| Ver mensajeros | ✅ | ✅ | ❌ | ❌ |
| Cancelar traslados | ✅ | ✅ | ❌ | ❌ |

---

## 🎨 Interfaz y Características

### Bodegas
- **Stats Cards**: Total, Activas, Con Ventas, Principal
- **Filtros**: Tipo, Estado, Búsqueda
- **Acciones**: Crear, Editar, Ver Stock, Eliminar
- **Badges de Tipo**: 
  - Bodega (azul)
  - Sucursal (cian)
  - Local (verde)
  - Almacén (amarillo)
  - Tienda (rojo)

### Traslados
- **Stats Cards**: Total, Pendientes, En Tránsito, Completados
- **Filtros**: Estado, Bodega, Fecha, Búsqueda
- **Selector de Productos**: 
  - Muestra stock disponible
  - Valida cantidades
  - Vista en lista de productos seleccionados
- **Timeline**: Visualización del flujo completo

### Control Mensajeros
- **Stats Cards**: Total Mensajeros, En Tránsito, Entregados Hoy, Pendientes
- **Vista por Mensajero**: Tarjetas individuales con stats
- **Vista por Estado**: Tablas agrupadas
- **Firma Digital**: Modal con imagen, GPS, timestamp
- **Auto-refresh**: Cada 60 segundos

---

## 📱 Vista Móvil Mensajero (Próximamente)

### Características Planificadas:
```
mensajero-mobile.html

1. Login como mensajero
2. Ver "Mis Entregas" (solo asignadas)
3. Detalle de entrega:
   - Dirección destino
   - Datos destinatario
   - Lista de productos
   - Mapa con GPS
4. Acción "Recibir":
   - Canvas para firma
   - Captura GPS automática
   - Confirmar cantidades
   - Foto opcional
5. Historial de entregas completadas
```

---

## 🔍 Testing Recomendado

### Test 1: Flujo Completo
```
✓ Crear 2 bodegas (Principal, Sucursal A)
✓ Agregar producto con stock en Principal
✓ Crear traslado: Principal → Sucursal A
✓ Aprobar traslado
✓ Enviar traslado (asignar mensajero)
✓ Verificar en dashboard mensajeros
✓ [Futuro] Recibir con firma
✓ Verificar stock en ambas bodegas
```

### Test 2: Cancelación
```
✓ Crear traslado
✓ Aprobar (stock reservado)
✓ Cancelar con motivo
✓ Verificar stock liberado
```

### Test 3: Stock Insuficiente
```
✓ Crear traslado con cantidad > stock_disponible
✓ Verificar mensaje de error
```

### Test 4: Múltiples Productos
```
✓ Crear traslado con 5+ productos
✓ Diferentes cantidades
✓ Aprobar parcialmente (ajustar cantidades)
✓ Completar flujo
```

---

## 🐛 Solución de Problemas

### Problema: No aparece botón "Aprobar"
**Solución:** El traslado debe estar en estado "Pendiente Aprobación"

### Problema: No puedo agregar productos
**Solución:** Primero selecciona la bodega origen

### Problema: Error "Stock insuficiente"
**Solución:** Verifica stock disponible (no reservado) en bodega origen

### Problema: DV no se calcula
**Solución:** Tipo de documento debe ser "NIT"

### Problema: RUES no autocompleta
**Solución:** Implementación es simulada, conectar API real en producción

---

## 📚 Archivos del Sistema

### Frontend
```
frontend/public/
├── bodegas.html                    # CRUD bodegas
├── traslados.html                  # CRUD traslados
├── mensajeros-dashboard.html       # Dashboard supervisores
└── assets/js/
    ├── bodegas.js                  # Lógica bodegas
    ├── traslados.js                # Lógica traslados
    └── mensajeros-dashboard.js     # Lógica dashboard
```

### Backend
```
backend/src/routes/
├── bodegas.routes.ts               # 6 endpoints
└── traslados.routes.ts             # 8 endpoints
```

### Base de Datos
```sql
-- Tablas principales
bodegas
productos_bodegas
traslados
traslados_detalle
```

---

## 🔜 Próximas Mejoras

### Alta Prioridad
- [ ] Vista móvil mensajero (mensajero-mobile.html)
- [ ] Captura de firma digital (signature_pad.js)
- [ ] Captura GPS automática
- [ ] Notificaciones push a mensajeros
- [ ] Imprimir guía de traslado (PDF)

### Media Prioridad
- [ ] Reportes de traslados por período
- [ ] Gráficas de movimientos entre bodegas
- [ ] Historial de stock por bodega
- [ ] Exportar traslados a Excel
- [ ] Códigos QR para traslados

### Baja Prioridad
- [ ] Mapa GPS en tiempo real
- [ ] Chat mensajero-supervisor
- [ ] Fotos de productos al recibir
- [ ] Integración con impresora térmica
- [ ] API para apps externas

---

## 📞 Soporte

Para dudas o problemas:
1. Revisar esta guía
2. Verificar logs del navegador (F12 → Console)
3. Verificar estado del backend (PM2 logs)
4. Consultar documentación técnica:
   - [SISTEMA_BODEGAS_TRASLADOS.md](SISTEMA_BODEGAS_TRASLADOS.md)
   - [MEJORAS_EMPRESAS_SUPERADMIN.md](MEJORAS_EMPRESAS_SUPERADMIN.md)

---

**Última actualización:** 2026-05-13
**Versión:** 1.0.0
**Estado:** ✅ Módulos principales completados
