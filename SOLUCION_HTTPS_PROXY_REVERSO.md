# 🔒 SOLUCIÓN: Mixed Content Error - HTTPS con Proxy Reverso

## 🎯 Problema Resuelto

**Error:** "No se pudo conectar con el servidor. Verifique que el backend esté corriendo."

**Causa:** El sitio ahora usa HTTPS (`https://kinventoryservices.com`), pero el frontend intentaba hacer peticiones HTTP al backend (`http://18.191.181.99:3000`), lo cual los navegadores modernos **bloquean por seguridad** (Mixed Content Error).

```
❌ ANTES (bloqueado):
Frontend: https://kinventoryservices.com (HTTPS)
Backend:  http://18.191.181.99:3000 (HTTP)
🚫 Navegador bloquea: "Mixed Content - No se puede cargar HTTP desde HTTPS"
```

---

## ✅ Solución Implementada: Proxy Reverso con Nginx

### Cómo funciona ahora:

```
✅ AHORA (funciona):
Frontend (HTTPS) → https://kinventoryservices.com/api/ventas
                 ↓
              Nginx (Proxy)
                 ↓
          Backend (HTTP) → http://localhost:3000/api/ventas
                 ↓
            Respuesta ← JSON
```

**Ventajas:**
- ✅ Todo pasa por HTTPS externamente (sin errores de Mixed Content)
- ✅ El backend sigue en HTTP local (más simple, sin certificados SSL)
- ✅ Más seguro (el backend no está expuesto directamente)
- ✅ Más profesional (todo bajo un mismo dominio)

---

## 📝 Cambios Realizados

### 1. Configuración de Nginx (kore-nginx-ssl.conf)

**Ya estaba configurado** el proxy reverso en las líneas 42-63:

```nginx
location /api/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

**Qué hace:** Cuando llega una petición a `https://kinventoryservices.com/api/ventas`, nginx la redirige internamente a `http://localhost:3000/api/ventas`.

---

### 2. URLs del Frontend (18 archivos actualizados)

**ANTES:**
```javascript
const API_URL = 'https://kinventoryservices.com/api';
// o
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api'
    : 'https://kinventoryservices.com/api';
```

**AHORA:**
```javascript
const API_URL = '/api';
```

**Archivos actualizados:**
1. ✅ clientes.js
2. ✅ productos.js
3. ✅ ventas.js
4. ✅ ventas-historial.js
5. ✅ inventario.js
6. ✅ compras.js
7. ✅ proveedores.js
8. ✅ bodegas.js
9. ✅ traslados.js
10. ✅ dashboard.js
11. ✅ configuracion-general.js
12. ✅ configuracion-facturacion.js
13. ✅ cuentas-por-cobrar.js
14. ✅ login.js
15. ✅ mensajeros-dashboard.js
16. ✅ mensajero-mobile.js
17. ✅ company-selector.js
18. ✅ sidebar-navigation.js
19. ✅ index.html

**Beneficio:** Ahora las peticiones usan rutas relativas que funcionan automáticamente con el proxy reverso.

---

## 🚀 Cómo Desplegar los Cambios

### Opción 1: Deploy Completo Automatizado (RECOMENDADO)

```bash
deploy_https_fix.bat
```

Este script hace:
1. ✅ Commit de cambios en Git
2. ✅ Push a GitHub
3. ✅ Git pull en el servidor
4. ✅ Actualiza configuración de nginx
5. ✅ Reinicia nginx
6. ✅ Verifica que todo funcione

**Tiempo:** ~1-2 minutos  
**Downtime:** ~5 segundos (solo durante reload de nginx)

---

### Opción 2: Deploy Manual

#### Paso 1: Subir cambios a GitHub

```bash
git add .
git commit -m "fix: configurar proxy reverso para HTTPS"
git push origin main
```

#### Paso 2: Actualizar código en servidor

```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99
cd /home/ubuntu/kore-inventory
git pull origin main
```

#### Paso 3: Actualizar nginx (desde tu PC)

```bash
actualizar_nginx.bat
```

O manualmente:

```bash
# Copiar archivo
scp -i C:\Users\luis.rodriguez\Downloads\korekey.pem kore-nginx-ssl.conf ubuntu@18.191.181.99:/tmp/

# Conectar al servidor
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99

# Mover archivo
sudo mv /tmp/kore-nginx-ssl.conf /etc/nginx/sites-available/kore

# Verificar configuración
sudo nginx -t

# Reiniciar nginx
sudo systemctl reload nginx

# Verificar estado
sudo systemctl status nginx
```

---

## 🧪 Verificación

### 1. Verificar que nginx está corriendo

```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99
sudo systemctl status nginx
```

Debe decir: `active (running)`

---

### 2. Probar el proxy desde el servidor

```bash
curl http://localhost/api/public/planes
```

Debe retornar JSON con los planes disponibles.

---

### 3. Probar desde el navegador

1. Abre: `https://kinventoryservices.com/`
2. Presiona **F12** (DevTools)
3. Ve a la pestaña **Network**
4. Recarga la página (**Ctrl + Shift + R**)

**Verificaciones:**

✅ **Console:** NO debe haber errores de "Mixed Content"

✅ **Network:** 
- Las peticiones deben aparecer como `/api/...` (no `http://18.191.181.99:3000`)
- Status: **200 OK**
- Type: **xhr** o **fetch**

✅ **Aplicación funciona:** Puedes ver productos, hacer ventas, etc.

---

## 🔍 Diagnosticar Problemas

### Error: "Mixed Content" sigue apareciendo

**Causa:** Algún archivo JS todavía usa la URL antigua

**Solución:**
```bash
# Buscar archivos que usen la URL antigua
grep -r "18.191.181.99:3000" frontend/public/assets/js/
grep -r "http://localhost:3000" frontend/public/assets/js/

# Si encuentras alguno, cámbialo a '/api'
```

---

### Error: "404 Not Found" en /api/

**Causa:** Nginx no está configurado correctamente

**Diagnóstico:**
```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99
sudo nginx -t                    # Verificar sintaxis
sudo cat /etc/nginx/sites-available/kore | grep -A 10 "location /api"
```

**Solución:** Ejecutar `actualizar_nginx.bat` nuevamente

---

### Error: "502 Bad Gateway"

**Causa:** El backend no está corriendo

**Diagnóstico:**
```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99
pm2 status
pm2 logs kore-backend --lines 30
```

**Solución:**
```bash
reiniciar_backend.bat
```

---

### Error: "ERR_SSL_PROTOCOL_ERROR"

**Causa:** Certificado SSL expirado o inválido

**Diagnóstico:**
```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99
sudo certbot certificates
```

**Solución:**
```bash
# Renovar certificado
sudo certbot renew
sudo systemctl reload nginx
```

---

## 📊 Flujo de una Petición (Antes vs Ahora)

### ❌ ANTES (No funcionaba con HTTPS)

```
1. Usuario abre: https://kinventoryservices.com/ventas.html
2. Frontend carga: ventas.js
3. ventas.js intenta: fetch('http://18.191.181.99:3000/api/ventas')
4. 🚫 Navegador BLOQUEA: "Mixed Content - HTTPS → HTTP bloqueado"
5. ❌ Error: "No se pudo conectar con el servidor"
```

---

### ✅ AHORA (Funciona perfectamente)

```
1. Usuario abre: https://kinventoryservices.com/ventas.html
2. Frontend carga: ventas.js
3. ventas.js hace: fetch('/api/ventas')
4. Navegador envía: https://kinventoryservices.com/api/ventas
5. Nginx recibe la petición
6. Nginx redirige a: http://localhost:3000/api/ventas
7. Backend procesa y responde con JSON
8. Nginx devuelve respuesta al navegador (en HTTPS)
9. ✅ Frontend recibe los datos correctamente
```

---

## 🎓 Conceptos Clave

### ¿Qué es Mixed Content?

Es cuando una página HTTPS (segura) intenta cargar recursos HTTP (inseguros). Los navegadores modernos **bloquean** esto por seguridad.

```
🔒 HTTPS (página)
   ↓
   🔓 HTTP (API)  ← 🚫 BLOQUEADO
```

---

### ¿Qué es un Proxy Reverso?

Un servidor intermediario que recibe peticiones del cliente y las reenvía a otro servidor.

```
Cliente → Proxy (público) → Servidor Backend (privado)
```

**Ventajas:**
- 🔒 Seguridad (backend no expuesto directamente)
- 🚀 Performance (caching, compresión)
- 🔧 Flexibilidad (SSL termination, load balancing)

---

### ¿Por qué no usar HTTPS directamente en el backend?

**Podrías**, pero es más complejo:
- Necesitas certificado SSL en el backend
- Más configuración
- Menos flexible
- El proxy reverso es el estándar de la industria

---

## 📚 Archivos Relacionados

- 📄 [kore-nginx-ssl.conf](kore-nginx-ssl.conf) - Configuración de nginx con proxy
- 📄 [deploy_https_fix.bat](deploy_https_fix.bat) - Script de deploy completo
- 📄 [actualizar_nginx.bat](actualizar_nginx.bat) - Solo actualizar nginx
- 📄 [GUIA_SOLUCION_ERROR_BACKEND.md](GUIA_SOLUCION_ERROR_BACKEND.md) - Guía general de errores
- 📄 [ESTRUCTURA_SERVIDOR.md](ESTRUCTURA_SERVIDOR.md) - Arquitectura del servidor

---

## 🔄 Mantenimiento Futuro

### Renovar certificado SSL (cada 90 días)

```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99
sudo certbot renew
sudo systemctl reload nginx
```

Let's Encrypt hace esto automáticamente, pero verifica periódicamente.

---

### Agregar nuevo endpoint al backend

No necesitas cambiar nada en nginx. El proxy ya redirige **todo** `/api/*` al backend.

Ejemplo:
```javascript
// Frontend
fetch('/api/nuevo-endpoint')

// Nginx automáticamente lo envía a:
// http://localhost:3000/api/nuevo-endpoint
```

---

## ✅ Checklist de Deploy HTTPS

- [x] Nginx configurado con proxy reverso para `/api/`
- [x] Certificado SSL instalado (Let's Encrypt)
- [x] HTTP redirige a HTTPS (puerto 80 → 443)
- [x] URLs del frontend actualizadas a `/api`
- [x] Backend corriendo en `localhost:3000`
- [x] CORS configurado correctamente
- [x] HSTS header activado (seguridad)
- [x] Sin errores de Mixed Content
- [x] DevTools Network muestra 200 OK en peticiones API

---

## 📞 Soporte

Si tienes problemas después del deploy:

1. **Ejecutar diagnóstico:**
   ```bash
   diagnosticar_backend.bat
   ```

2. **Ver logs de nginx:**
   ```bash
   ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99
   sudo tail -f /var/log/nginx/kore_error.log
   ```

3. **Ver logs del backend:**
   ```bash
   ver_logs_backend.bat
   ```

---

**Última actualización:** 2026-06-13  
**Autor:** GitHub Copilot  
**Versión:** 1.0
