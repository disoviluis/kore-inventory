# 🔒 Sistema de Seguridad - KORE Inventory

## Configuración de Modos

### ⚙️ Archivo: `frontend/public/assets/js/config.js`

```javascript
const DEBUG_MODE = true; // CAMBIAR AQUÍ
```

---

## 🔧 Modo DESARROLLO (Para ti cuando haces pruebas)

**Configuración:**
```javascript
const DEBUG_MODE = true;
```

**Características:**
- ✅ Todos los `logger.log()` se muestran en consola
- ✅ F12 DevTools funciona normalmente
- ✅ Click derecho habilitado
- ✅ Puedes inspeccionar código
- ✅ Console muestra debug completo

**Usar cuando:**
- Estás desarrollando nuevas funciones
- Haciendo pruebas
- Depurando errores
- Trabajando localmente

---

## 🔐 Modo PRODUCCIÓN (Para usuarios finales)

**Configuración:**
```javascript
const DEBUG_MODE = false;
```

**Protecciones Activas:**
- 🚫 Logs ocultos (solo errores se muestran)
- 🚫 F12 bloqueado
- 🚫 Ctrl+Shift+I bloqueado
- 🚫 Ctrl+Shift+J bloqueado
- 🚫 Ctrl+U (ver código) bloqueado
- 🚫 Click derecho deshabilitado
- ⚠️ Detecta apertura de DevTools y muestra advertencia
- 🔒 Redirección automática a login si no hay token

**Usar cuando:**
- Despliegas a producción
- Usuarios finales usan la app
- Quieres proteger el código

---

## 📋 Proceso de Deployment

### 1. Desarrollo Local
```javascript
// config.js
const DEBUG_MODE = true;
```

### 2. Antes de Deployment a Producción
```javascript
// config.js
const DEBUG_MODE = false;
```

### 3. Commit y Deploy
```bash
git add .
git commit -m "chore: Activar modo producción"
git push
```

### 4. En servidor EC2
```bash
cd ~/kore-inventory
git pull
sudo cp -r frontend/public/* /var/www/kore/kore-inventory/frontend/public/
```

---

## 🛡️ Protecciones Implementadas

### 1. Sistema de Logs Condicionales
- **Desarrollo:** `logger.log()` muestra todo
- **Producción:** `logger.log()` no muestra nada
- **Siempre:** `logger.error()` muestra errores críticos

### 2. Protección de Rutas
- Solo `index.html` y `login.html` son públicas
- Todas las demás páginas requieren token válido
- Redirección automática a login si no hay autenticación

### 3. Detección de DevTools
- Detecta apertura de F12 cada 1 segundo
- Muestra mensaje de "Acceso No Autorizado"
- Requiere cerrar DevTools y recargar

### 4. Bloqueo de Atajos
- F12 → Bloqueado
- Ctrl+Shift+I (Inspeccionar) → Bloqueado
- Ctrl+Shift+J (Consola) → Bloqueado
- Ctrl+U (Ver código fuente) → Bloqueado
- Click derecho → Deshabilitado

---

## ⚠️ IMPORTANTE: Limitaciones de Seguridad Frontend

**El código JavaScript SIEMPRE será visible porque:**
- Se ejecuta en el navegador del cliente
- El navegador necesita descargarlo para ejecutarlo
- Usuarios técnicos pueden bypassear protecciones

**Estas protecciones:**
- ✅ Dificultan el acceso para usuarios casuales
- ✅ Evitan copias fáciles del código
- ✅ Protegen contra inspección básica
- ❌ NO previenen 100% acceso a código para usuarios avanzados

**Seguridad REAL está en:**
- 🔐 Autenticación con JWT tokens
- 🔐 Validación backend de permisos
- 🔐 API protegida con tokens
- 🔐 Base de datos con contraseñas hasheadas

---

## 🎯 Recomendaciones Adicionales

### Para Producción (Opcional):
1. **Minificar código:** Usa UglifyJS o Terser
2. **Ofuscar código:** Dificulta lectura
3. **Rate limiting:** Protege API de abusos
4. **HTTPS:** Siempre en producción
5. **WAF:** Web Application Firewall

### Comando para minificar (opcional):
```bash
npm install -g terser
terser frontend/public/assets/js/ventas.js -o ventas.min.js -c -m
```

---

## 📞 Soporte

Para cambiar modo o problemas:
1. Edita `config.js`
2. Cambia `DEBUG_MODE = true/false`
3. Commit y deploy
4. Limpia caché del navegador (Ctrl+Shift+R)
