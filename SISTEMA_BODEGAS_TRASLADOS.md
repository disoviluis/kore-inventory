# 📦 SISTEMA DE BODEGAS Y TRASLADOS - DOCUMENTACIÓN

## 🎯 Resumen Ejecutivo

Se ha implementado un sistema completo de gestión de bodegas y traslados de mercancía que incluye:

### ✅ Implementado

#### 1. **Base de Datos**
- ✅ Tabla `bodegas`: Gestión de múltiples ubicaciones (bodegas, sucursales, locales, almacenes, tiendas)
- ✅ Tabla `productos_bodegas`: Control de stock distribuido por bodega
- ✅ Tabla `traslados`: Workflow completo de movimientos entre bodegas
- ✅ Tabla `traslados_detalle`: Detalle de productos por traslado
- ✅ Campos adicionales para **módulo de mensajero** con firma digital

#### 2. **Backend API - Bodegas** (`/api/bodegas`)
- ✅ `GET /api/bodegas` - Listar bodegas por empresa
- ✅ `GET /api/bodegas/:id` - Obtener bodega específica
- ✅ `POST /api/bodegas` - Crear nueva bodega
- ✅ `PUT /api/bodegas/:id` - Actualizar bodega
- ✅ `DELETE /api/bodegas/:id` - Eliminar bodega
- ✅ `GET /api/bodegas/:bodega_id/stock` - Ver stock en bodega específica

**Características:**
- Auto-creación de bodega principal al crear empresa
- Validación de código único por empresa
- Solo una bodega puede ser principal
- Control de permisos super_admin vs admin_empresa
- No se puede eliminar bodega con stock

#### 3. **Backend API - Traslados** (`/api/traslados`)
- ✅ `GET /api/traslados` - Listar traslados con filtros
- ✅ `GET /api/traslados/:id` - Ver traslado con detalle
- ✅ `POST /api/traslados` - Crear traslado
- ✅ `PUT /api/traslados/:id/aprobar` - Aprobar traslado
- ✅ `PUT /api/traslados/:id/enviar` - Despachar traslado
- ✅ `PUT /api/traslados/:id/recibir` - Recibir con firma digital
- ✅ `PUT /api/traslados/:id/cancelar` - Cancelar traslado
- ✅ `GET /api/traslados/mensajero/mis-traslados` - Vista de mensajero

**Workflow de Estados:**
```
borrador → pendiente_aprobacion → aprobado → en_transito → recibido
                                                         ↓
                                              parcialmente_recibido
```

#### 4. **Módulo de Mensajero** 🚚

**Campos implementados en BD:**
- `mensajero_id`: Usuario asignado para entrega
- `destinatario_nombre`: Quien debe recibir
- `destinatario_documento`: Cédula del receptor
- `destinatario_telefono`: Contacto del receptor
- `destinatario_cargo`: Puesto del receptor
- `firma_recepcion`: Imagen base64 de firma digital
- `fecha_firma`: Timestamp de la firma
- `ip_recepcion`: IP desde donde se firmó
- `gps_latitud` / `gps_longitud`: Geolocalización de recepción
- `dispositivo_recepcion`: Info del dispositivo usado

**Funcionalidades:**
1. Al crear traslado, se capturan datos del destinatario
2. Mensajero inicia sesión y ve solo sus traslados asignados
3. Al llegar a destino, presiona "Recibir"
4. Se abre modal con canvas para firma digital
5. Se captura:
   - Firma del receptor (base64)
   - Ubicación GPS del punto de entrega
   - IP y dispositivo usado
   - Timestamp exacto
6. Sistema actualiza stock automáticamente:
   - Quita de bodega origen
   - Agrega a bodega destino

---

## 📊 Estructura de Datos

### Bodega
```typescript
{
  id: number,
  empresa_id: number,
  codigo: string,              // BOD-001, SUC-CENTRO
  nombre: string,              // "Bodega Principal"
  tipo: 'bodega' | 'sucursal' | 'local' | 'almacen' | 'tienda',
  direccion: string,
  ciudad: string,
  responsable_id: number,      // Usuario a cargo
  es_principal: boolean,       // Solo una por empresa
  permite_ventas: boolean,     // Si puede vender desde POS
  activa: boolean
}
```

### Traslado
```typescript
{
  id: number,
  empresa_id: number,
  numero_traslado: string,     // TRS-2026-001
  bodega_origen_id: number,
  bodega_destino_id: number,
  
  // Workflow
  estado: 'borrador' | 'pendiente_aprobacion' | 'aprobado' | 
          'en_transito' | 'parcialmente_recibido' | 'recibido' | 'cancelado',
  
  // Usuarios involucrados
  usuario_solicita_id: number,
  usuario_aprueba_id: number,
  usuario_envia_id: number,
  usuario_recibe_id: number,
  mensajero_id: number,
  
  // Destinatario
  destinatario_nombre: string,
  destinatario_documento: string,
  destinatario_telefono: string,
  destinatario_cargo: string,
  
  // Firma digital
  firma_recepcion: string,     // Base64 de la imagen
  fecha_firma: Date,
  ip_recepcion: string,
  gps_latitud: decimal(10,8),
  gps_longitud: decimal(11,8),
  dispositivo_recepcion: string,
  
  // Fechas
  fecha_solicitud: Date,
  fecha_aprobacion: Date,
  fecha_envio: Date,
  fecha_recepcion: Date,
  
  motivo: string,
  observaciones: string
}
```

### Detalle de Traslado
```typescript
{
  id: number,
  traslado_id: number,
  producto_id: number,
  cantidad_solicitada: number,
  cantidad_aprobada: number,
  cantidad_recibida: number,
  diferencia: number           // GENERATED
}
```

---

## 🔐 Permisos y Seguridad

### Roles soportados:
- **super_admin**: Acceso total a todas las empresas
- **admin_empresa**: Solo sus bodegas y traslados
- **mensajero**: Solo traslados asignados a él (vista limitada)

### Validaciones implementadas:
1. ✅ Bodegas origen y destino deben ser diferentes
2. ✅ Stock suficiente en origen antes de crear traslado
3. ✅ Solo se puede aprobar traslado en estado correcto
4. ✅ Al enviar traslado, se reserva stock
5. ✅ Al recibir traslado, se mueve stock físicamente
6. ✅ Al cancelar en tránsito, se libera stock reservado
7. ✅ Mensajero solo ve sus traslados
8. ✅ Código de bodega único por empresa

---

## 🚀 Endpoints Disponibles

### Bodegas
```
GET    /api/bodegas?empresa_id=1
GET    /api/bodegas/:id
POST   /api/bodegas
PUT    /api/bodegas/:id
DELETE /api/bodegas/:id
GET    /api/bodegas/:bodega_id/stock
```

### Traslados
```
GET    /api/traslados?empresa_id=1&estado=en_transito
GET    /api/traslados/:id
POST   /api/traslados
PUT    /api/traslados/:id/aprobar
PUT    /api/traslados/:id/enviar
PUT    /api/traslados/:id/recibir
PUT    /api/traslados/:id/cancelar

GET    /api/traslados/mensajero/mis-traslados    (Solo mensajeros)
```

---

## 📱 Flujo de Usuario - Módulo Mensajero

### 1. **Admin crea traslado**
```json
POST /api/traslados
{
  "empresa_id": 1,
  "bodega_origen_id": 1,
  "bodega_destino_id": 3,
  "motivo": "Reabastecimiento sucursal centro",
  "destinatario_nombre": "Carlos Pérez",
  "destinatario_documento": "1234567890",
  "destinatario_telefono": "+57 300 1234567",
  "destinatario_cargo": "Jefe de Almacén",
  "productos": [
    { "producto_id": 10, "cantidad_solicitada": 50 },
    { "producto_id": 15, "cantidad_solicitada": 30 }
  ]
}
```

### 2. **Admin aprueba traslado**
```json
PUT /api/traslados/1/aprobar
{
  "productos_aprobados": [
    { "producto_id": 10, "cantidad_aprobada": 45 },  // Ajusta cantidad
    { "producto_id": 15, "cantidad_aprobada": 30 }
  ]
}
```

### 3. **Admin despacha y asigna mensajero**
```json
PUT /api/traslados/1/enviar
{
  "mensajero_id": 25
}
```
**Resultado:** Stock se reserva en bodega origen

### 4. **Mensajero ve sus traslados**
```json
GET /api/traslados/mensajero/mis-traslados?estado=en_transito

// Respuesta
{
  "success": true,
  "data": [
    {
      "id": 1,
      "numero_traslado": "TRS-2026-001",
      "bodega_destino_nombre": "Sucursal Centro",
      "bodega_destino_direccion": "Calle 50 #45-30",
      "bodega_destino_ciudad": "Bogotá",
      "destinatario_nombre": "Carlos Pérez",
      "destinatario_telefono": "+57 300 1234567",
      "total_productos": 2,
      "total_unidades": 75
    }
  ]
}
```

### 5. **Mensajero entrega y captura firma**
```json
PUT /api/traslados/1/recibir
{
  "productos_recibidos": [
    { "producto_id": 10, "cantidad_recibida": 45 },
    { "producto_id": 15, "cantidad_recibida": 30 }
  ],
  "observaciones_recepcion": "Entrega sin novedad",
  "firma_recepcion": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "gps_latitud": 4.6533326,
  "gps_longitud": -74.0836333,
  "dispositivo_recepcion": "Mozilla/5.0 (Android 12; SM-G991B)"
}
```

**Resultado:**
- Stock se quita de origen
- Stock se agrega a destino
- Firma queda almacenada
- GPS registra ubicación exacta de entrega

---

## 🎨 Frontend Pendiente

### Módulo Bodegas (Admin)
- [ ] Lista de bodegas con filtros
- [ ] Formulario crear/editar bodega
- [ ] Vista de stock por bodega
- [ ] Asignar responsable (dropdown de usuarios)

### Módulo Traslados (Admin)
- [ ] Lista de traslados con estados
- [ ] Crear traslado (selector origen/destino, productos)
- [ ] Aprobar traslados pendientes
- [ ] Enviar traslado (asignar mensajero)
- [ ] Ver historial completo

### Módulo Mensajero (Móvil-First)
- [ ] Login con credenciales de mensajero
- [ ] Lista de "Mis Traslados"
- [ ] Vista detalle con:
  - Dirección destino
  - Mapa de ubicación
  - Datos del destinatario
  - Lista de productos
- [ ] Modal de recepción con:
  - Canvas para firma digital (signature_pad.js)
  - Captura de geolocalización automática
  - Captura de foto (opcional)
  - Campos de observaciones

---

## 🔧 Tecnologías y Librerías Sugeridas

### Backend (Implementado)
- ✅ TypeScript + Express
- ✅ MySQL 8.0
- ✅ Transacciones para integridad de datos
- ✅ Validaciones de stock
- ✅ Auditoría completa

### Frontend (Por implementar)
- **Signature Pad**: https://github.com/szimek/signature_pad
- **Leaflet o Google Maps**: Para mostrar ubicaciones
- **Geolocation API**: HTML5 `navigator.geolocation`
- **Bootstrap 5**: Responsive design
- **SweetAlert2**: Modales bonitos
- **QR Code Generator**: Para códigos de traslado

---

## 📈 Métricas y Reportes Sugeridos

### Dashboard Gerencial
1. Stock consolidado (todas las bodegas)
2. Stock por bodega
3. Traslados pendientes de aprobación
4. Traslados en tránsito
5. Productos con stock bajo en cada bodega
6. Eficiencia de mensajeros (entregas a tiempo)

### Reportes
1. Historial de movimientos de un producto
2. Traslados por mensajero
3. Tiempos promedio de entrega
4. Diferencias detectadas en recepción
5. Mapa de entregas (GPS tracking)

---

## 🔮 Mejoras Futuras

### Corto plazo
1. **Notificaciones push** cuando traslado llega a destino
2. **Firma del mensajero** al recoger (además de firma del receptor)
3. **Foto de productos** al recibir
4. **Escaneo de QR** del traslado para validar

### Mediano plazo
1. **Rutas optimizadas** para mensajeros (múltiples entregas)
2. **Tracking en tiempo real** del mensajero
3. **Integración con transportadoras** (TCC, Servientrega)
4. **Alertas de stock bajo** automáticas generando traslados
5. **AI para predecir necesidades** de reabastecimiento

### Largo plazo
1. **App móvil nativa** para mensajeros (React Native)
2. **Wearables** (smartwatch) para confirmar entregas
3. **Blockchain** para trazabilidad inmutable
4. **IoT** para tracking de temperatura/condiciones

---

## ⚠️ Consideraciones Importantes

### Base de Datos
- Las columnas de GPS usan `DECIMAL(10,8)` y `DECIMAL(11,8)` para precisión
- Firma se almacena como `LONGTEXT` (puede ser grande en base64)
- Campos de firma/GPS son opcionales (NULL) para no bloquear flujo

### Seguridad
- Validar tamaño de imagen de firma (máx 1MB)
- Sanitizar dispositivo_recepcion para evitar XSS
- HTTPS obligatorio para captura de GPS
- No permitir editar traslados recibidos

### Performance
- Índices en estados de traslados para reportes
- Índice en mensajero_id para consultas de móvil
- Considerar caché para stock consolidado

---

## 📞 Soporte

**Desarrollador:** Disovi Soft  
**Fecha:** Mayo 13, 2026  
**Versión Backend:** 1.0.0  
**Estado:** ✅ Backend completo y desplegado  
**Siguiente paso:** Implementar frontend
