# 📝 Instrucciones de Integración - Sistema de Licencias Frontend

## 🎯 Objetivo
Integrar el manejo automático de licencias vencidas en todas las páginas protegidas del frontend.

## 📦 Archivos Creados

### 1. `licencia-vencida.html`
**Ubicación:** `/frontend/public/licencia-vencida.html`

Pantalla que se muestra cuando la licencia de una empresa ha vencido.

**Características:**
- Diseño atractivo con 2 planes: Mensual y Anual
- Plan Anual con 20% de descuento (badge "MÁS POPULAR")
- Modal de confirmación con selección de método de pago
- Checkbox de auto-renovación
- Integración con endpoint de activación de licencia
- Responsive design para móviles

**Planes Mostrados:**
- **Plan Mensual:** $15.990 COP/mes
- **Plan Anual:** $153.500 COP/año (ahorra $38.380)

### 2. `api-utils.js`
**Ubicación:** `/frontend/public/assets/js/api-utils.js`

Librería de utilidades para manejo de llamadas API con detección automática de licencias vencidas.

**Funciones Exportadas:**
- `apiFetch(url, options)` - Fetch con manejo de errores de licencia
- `apiGet(url, options)` - Wrapper para GET
- `apiPost(url, data, options)` - Wrapper para POST
- `apiPut(url, data, options)` - Wrapper para PUT
- `apiDelete(url, options)` - Wrapper para DELETE
- `checkLicenseOnLoad()` - Verificación automática al cargar página

**Códigos de Error Detectados:**
- `LICENCIA_VENCIDA` - Licencia expirada
- `LICENCIA_SUSPENDIDA` - Licencia suspendida por falta de pago
- `EMPRESA_SUSPENDIDA` - Empresa suspendida por administrador
- `SIN_LICENCIA` - Empresa sin licencia activa

## 🔧 Integración en Páginas Existentes

### Paso 1: Agregar Script en HTML

Agregar el script **ANTES** de cualquier otro script de la aplicación:

```html
<!-- Antes de cerrar </body> -->
<script src="assets/js/api-utils.js"></script>
<script src="assets/js/dashboard.js"></script> <!-- Ejemplo -->
```

**Páginas que DEBEN incluir el script:**
- ✅ `dashboard.html`
- ✅ `productos.html`
- ✅ `categorias.html`
- ✅ `clientes.html`
- ✅ `ventas.html`
- ✅ `proveedores.html`
- ✅ `inventario.html`
- ✅ `compras.html`
- ✅ `facturacion.html`
- ✅ `bodegas.html`
- ✅ `traslados.html`
- ✅ `configuracion.html`
- ✅ `usuarios.html`
- ✅ Cualquier página que use la API

**Páginas que NO necesitan el script:**
- ❌ `index.html` (landing page)
- ❌ `login.html` (página pública)
- ❌ `licencia-vencida.html` (ya es la página de destino)

### Paso 2: Reemplazar llamadas `fetch()` por `apiFetch()`

**ANTES:**
```javascript
const response = await fetch(`${API_URL}/api/productos`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
```

**DESPUÉS:**
```javascript
const data = await apiGet(`${API_URL}/api/productos`);
```

**O usando apiFetch directamente:**
```javascript
const response = await apiFetch(`${API_URL}/api/productos`, {
  method: 'GET'
});
const data = await response.json();
```

### Paso 3: Manejo de Errores

El script `api-utils.js` maneja automáticamente:
- ✅ Errores 403 con códigos de licencia → Redirige a `/licencia-vencida.html`
- ✅ Errores 401 (no autorizado) → Redirige a `/login.html`
- ✅ Agrega token automáticamente a las peticiones

**No es necesario verificar manualmente** si la licencia está vencida.

## 📋 Ejemplo Completo de Integración

### dashboard.html (ANTES)
```html
<!DOCTYPE html>
<html>
<head>
  <title>Dashboard</title>
</head>
<body>
  <!-- Contenido -->
  
  <script>
    async function cargarDatos() {
      const token = sessionStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/dashboard/metricas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      
      const data = await response.json();
      console.log(data);
    }
    
    cargarDatos();
  </script>
</body>
</html>
```

### dashboard.html (DESPUÉS)
```html
<!DOCTYPE html>
<html>
<head>
  <title>Dashboard</title>
</head>
<body>
  <!-- Contenido -->
  
  <!-- AGREGAR AQUÍ -->
  <script src="assets/js/api-utils.js"></script>
  
  <script>
    async function cargarDatos() {
      // Mucho más simple, manejo automático de errores
      const data = await apiGet('http://localhost:3000/api/dashboard/metricas');
      console.log(data);
    }
    
    cargarDatos();
  </script>
</body>
</html>
```

## 🧪 Testing

### Test 1: Simular Licencia Vencida

1. En el navegador, abrir DevTools → Console
2. Ejecutar:
```javascript
sessionStorage.setItem('license_error', JSON.stringify({
  code: 'LICENCIA_VENCIDA',
  message: 'Tu licencia ha vencido'
}));
location.reload();
```
3. **Resultado esperado:** Redirige a `/licencia-vencida.html`

### Test 2: Flujo Completo de Renovación

1. Ir a `/licencia-vencida.html`
2. Hacer clic en "Seleccionar Plan Mensual" o "Plan Anual"
3. Seleccionar método de pago
4. Hacer clic en "Proceder al Pago"
5. **Resultado esperado:**
   - Llamada a `POST /api/super-admin/empresas/:id/activar-licencia`
   - Mensaje de éxito
   - Redirección a `/dashboard.html`

### Test 3: Backend con Middleware Activado

1. Ir a cualquier página protegida (ej: `/dashboard.html`)
2. El middleware `verificarEmpresaActiva` detecta licencia vencida
3. Retorna HTTP 403 con código `LICENCIA_VENCIDA`
4. **Resultado esperado:**
   - `api-utils.js` detecta el error 403
   - Redirige automáticamente a `/licencia-vencida.html`

## ⚠️ Importante

### Configuración de URL de API

En `licencia-vencida.html`, la URL de la API está hardcodeada:
```javascript
const response = await fetch(`http://localhost:3000/api/super-admin/empresas/${empresaId}/activar-licencia`, {
```

**CAMBIAR EN PRODUCCIÓN a:**
```javascript
const API_URL = 'https://tu-dominio.com'; // O usar variable de entorno
const response = await fetch(`${API_URL}/api/super-admin/empresas/${empresaId}/activar-licencia`, {
```

### Integración con Pasarela de Pago

Actualmente el pago está **simulado**. Para producción:

1. **Elegir pasarela de pago:**
   - Wompi (Colombia) - Recomendado
   - PayU (Latam)
   - Stripe (Internacional)
   - Mercado Pago (Latam)

2. **Modificar función `procesarPago()`** en `licencia-vencida.html`:
```javascript
async function procesarPago() {
  // Opción 1: Redirigir a checkout de pasarela
  // window.location.href = `https://checkout.wompi.co/...`;
  
  // Opción 2: Modal de pago embebido
  // const wompi = new Wompi(PUBLIC_KEY);
  // const transaction = await wompi.createTransaction({...});
  
  // Opción 3: Backend procesa el pago
  // await apiPost('/api/super-admin/empresas/:id/activar-licencia', {...});
}
```

## 📊 Estado Actual

### ✅ Implementado
- Backend: Sistema completo de licencias
- Backend: Middleware de verificación
- Backend: Endpoints de activación
- Frontend: Pantalla de licencia vencida
- Frontend: API utils con detección automática
- Cron job: Verificación diaria configurado

### ⏳ Pendiente
- [ ] Agregar `api-utils.js` a todas las páginas protegidas
- [ ] Reemplazar `fetch()` por `apiGet/Post/Put/Delete()`
- [ ] Integrar pasarela de pago real
- [ ] Configurar variable de entorno para API_URL
- [ ] Testing en producción

## 📞 Soporte

Para dudas o problemas:
- Email: soporte@koreinventory.com
- Teléfono: +57 300 123 4567

---

**Última actualización:** 27 de Mayo 2026  
**Versión:** 1.0.0
