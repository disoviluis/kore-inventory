# 🔧 GUÍA DE SOLUCIÓN - ERROR DE CONEXIÓN CON BACKEND

## ❌ Error: "No se pudo conectar con el servidor. Verifique que el backend esté corriendo."

---

## 📋 SCRIPTS .BAT CREADOS

He creado 5 scripts para ayudarte a diagnosticar y solucionar el problema:

### 1. **diagnosticar_backend.bat** 🔍
**Usa este PRIMERO** para identificar el problema.

```
¿Qué hace?
- Verifica conectividad con el servidor (ping)
- Prueba si el backend responde en puerto 3000
- Muestra estado de PM2 y logs
- Te dice exactamente cuál es el problema
```

**Cuándo usarlo:** Siempre que aparezca el error de conexión

---

### 2. **reiniciar_backend.bat** 🔄
**Solución rápida** - El más usado

```
¿Qué hace?
- Actualiza código con git pull
- Compila el backend
- Reinicia el proceso PM2
- Muestra logs para verificar
```

**Cuándo usarlo:** 
- Después de hacer cambios en el código
- Cuando el backend está caído
- Después de un deploy

**Tiempo:** ~30-40 segundos  
**Downtime:** ~10 segundos

---

### 3. **ver_logs_backend.bat** 📊
**Monitoreo en tiempo real**

```
¿Qué hace?
- Muestra logs del backend en vivo
- Útil para ver errores en tiempo real
```

**Cuándo usarlo:**
- Para detectar errores mientras pruebas
- Después de reiniciar el backend
- Cuando necesitas ver qué está fallando

**Tip:** Déjalo abierto mientras pruebas la aplicación

---

### 4. **estado_servidor.bat** 📈
**Información completa del servidor**

```
¿Qué hace?
- Estado de todos los procesos PM2
- Uso de CPU y memoria
- Espacio en disco
- Commit actual de Git
- Puertos abiertos
```

**Cuándo usarlo:**
- Para monitoreo general
- Antes de hacer cambios importantes
- Para verificar que todo está OK

---

### 5. **fix_backend_completo.bat** ⚠️
**Reparación profunda** - Úsalo solo si los demás fallan

```
¿Qué hace?
- Detiene el backend
- Actualiza código
- Reinstala dependencias (npm install)
- Limpia cache de compilación
- Compila desde cero
- Reinicia PM2
```

**Cuándo usarlo:**
- Cuando reiniciar_backend.bat no funciona
- Después de cambiar package.json
- Si sospechas que hay módulos corruptos
- Error de compilación o dependencias

**Tiempo:** ~2-3 minutos  
**Downtime:** ~30-45 segundos

---

## 🔍 ¿POR QUÉ PUEDE PASAR ESTE ERROR?

### 1. **El Backend se Cayó (PM2 Offline)** ⚠️
**Causa más común**

- PM2 intentó reiniciar 15 veces y se rindió
- Error en el código que crashea el servidor
- Error de base de datos (conexión RDS)
- Memoria insuficiente en EC2

**Solución:**
```bash
reiniciar_backend.bat
# Si no funciona:
ver_logs_backend.bat  # Ver qué error aparece
```

**Prevención:**
- Siempre probar código localmente antes de deploy
- Verificar conexión a base de datos
- Monitorear uso de memoria

---

### 2. **El Servidor EC2 está Apagado** 🖥️
**Poco común, pero posible**

- Instancia EC2 detenida manualmente
- Problemas de AWS
- Factura de AWS sin pagar

**Cómo detectar:**
```bash
diagnosticar_backend.bat
# Dirá: "No se puede alcanzar el servidor"
```

**Solución:**
- Ir a AWS Console → EC2 → Instances
- Verificar estado de la instancia
- Iniciar si está detenida

---

### 3. **Puerto 3000 Bloqueado (Security Group)** 🔒
**Causa:** Tu IP cambió y AWS bloquea el puerto 3000

**Cómo detectar:**
- `diagnosticar_backend.bat` dirá que el servidor está activo pero puerto 3000 no responde

**Solución:**
1. Ir a AWS Console → EC2 → Security Groups
2. Encontrar el grupo asociado a la instancia
3. Agregar regla de entrada:
   - Tipo: TCP Personalizado
   - Puerto: 3000
   - Origen: Tu IP o 0.0.0.0/0 (cualquier IP)

**Prevención:**
- Dejar puerto 3000 abierto a 0.0.0.0/0 para desarrollo
- O usar VPN con IP fija

---

### 4. **Error en Base de Datos (RDS)** 🗄️
**Causa:** El backend no puede conectar con RDS

**Cómo detectar:**
```bash
ver_logs_backend.bat
# Verás error tipo:
# "ECONNREFUSED" o "Access denied for user"
```

**Solución:**
```bash
# Conectar al servidor
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99

# Verificar .env del backend
cd /home/ubuntu/kore-inventory/backend
cat .env

# Probar conexión manual
mysql -h [RDS_HOST] -u [DB_USER] -p[DB_PASSWORD]
```

**Causas comunes:**
- Contraseña incorrecta en .env
- RDS apagado o eliminado
- Security Group de RDS bloqueando EC2

---

### 5. **Error de Compilación TypeScript** 💻
**Causa:** El código no compila (error de sintaxis)

**Cómo detectar:**
```bash
reiniciar_backend.bat
# Verás errores tipo:
# "TS2322: Type 'string' is not assignable to type 'number'"
```

**Solución:**
```bash
# Ir al último commit que funcionaba
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99
cd /home/ubuntu/kore-inventory
git log --oneline -10
git checkout [commit-que-funcionaba]
pm2 restart kore-backend

# Luego arreglar el código localmente y hacer push
```

**Prevención:**
- SIEMPRE correr `npm run build` localmente antes de push
- Configurar ESLint y Prettier
- Usar TypeScript strict mode

---

### 6. **Memoria Insuficiente en EC2** 💾
**Causa:** La instancia se quedó sin RAM

**Cómo detectar:**
```bash
estado_servidor.bat
# Verás memoria al 100%
```

**Solución Temporal:**
```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99
pm2 restart kore-backend
```

**Solución Permanente:**
- Upgrade instancia EC2 (ej: de t2.micro a t2.small)
- Optimizar código (memory leaks)
- Agregar swap memory

---

### 7. **CORS Bloqueado** 🚫
---

### 9. **Mixed Content Error (HTTPS → HTTP Bloqueado)** 🔒
**Causa:** El sitio usa HTTPS pero el frontend intenta llamar al backend por HTTP

**Cómo detectar:**
- El sitio funciona en `http://18.191.181.99` pero NO en `https://kinventoryservices.com`
- En DevTools Console aparece: `Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure resource 'http://...'`
- Backend ESTÁ corriendo (PM2 online) pero el frontend no puede conectarse

**Solución:**
Configurar proxy reverso en nginx para que todo pase por HTTPS.

```bash
# Ya está implementado en kore-nginx-ssl.conf
# Solo necesitas desplegar:
deploy_https_fix.bat
```

Ver guía completa: [SOLUCION_HTTPS_PROXY_REVERSO.md](SOLUCION_HTTPS_PROXY_REVERSO.md)

**Prevención:**
- Usar siempre rutas relativas (`/api`) en lugar de URLs absolutas
- Configurar proxy reverso desde el inicio cuando uses HTTPS

---

### 10. **CORS Bloqueado** 🚫**Causa:** El frontend NO puede hacer peticiones al backend por CORS

**Cómo detectar:**
- Backend ESTÁ corriendo (PM2 online)
- En DevTools del navegador aparece: `CORS policy: No 'Access-Control-Allow-Origin'`

**Solución:**
```javascript
// En backend/src/server.ts
// Verificar que tienes:
app.use(cors({
  origin: ['http://18.191.181.99', 'https://kinventoryservices.com'],
  credentials: true
}));
```

---

### 10. **URL Incorrecta en Frontend** 🔗
**Causa:** El frontend apunta a URL equivocada

**Cómo detectar:**
```javascript
// Abrir DevTools → Network
// Ver a qué URL se está haciendo la petición
// Ejemplo incorrecto: http://localhost:3000/api/ventas
// Ejemplo correcto: http://18.191.181.99:3000/api/ventas
```

**Solución:**
```javascript
// En frontend verificar configuración API:
const API_BASE_URL = 'http://18.191.181.99:3000/api';
```

---

## 📊 DIAGNÓSTICO RÁPIDO (FLOWCHART)

```
¿El error dice "No se pudo conectar con el servidor"?
│
├─ SÍ → Ejecutar: diagnosticar_backend.bat
│   │
│   ├─ "Servidor no alcanzable" → EC2 apagado (ir a AWS Console)
│   │
│   ├─ "Puerto 3000 no responde" → 
│   │   ├─ Ejecutar: reiniciar_backend.bat
│   │   ├─ Si sigue sin funcionar → ver_logs_backend.bat
│   │   └─ Ver logs para identificar error específico
│   │
│   └─ "Backend responde OK" → 
│       ├─ Error es en frontend (URL incorrecta o CORS)
│       └─ Abrir DevTools → Console/Network
│
└─ NO → El error es otro (no es de conexión)
```

---

## 🚀 WORKFLOW RECOMENDADO

### Cuando aparece el error:

1. **Ejecutar:** `diagnosticar_backend.bat` (30 segundos)
2. **Leer el resultado:** Te dirá exactamente qué está mal
3. **Según el resultado:**
   - Backend caído → `reiniciar_backend.bat`
   - Servidor apagado → AWS Console
   - Error desconocido → `ver_logs_backend.bat`

### Después de hacer cambios en código:

1. **En local:** `git push origin main`
2. **En servidor:** `reiniciar_backend.bat`
3. **Verificar:** Abrir app en navegador y probar

### Si nada funciona:

1. `fix_backend_completo.bat` (último recurso)
2. `ver_logs_backend.bat` (ver qué error da)
3. Si aún falla → revisar .env y conexión DB

---

## 🔧 COMANDOS MANUALES ÚTILES

### Conectar al servidor:
```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99
```

### Ver estado PM2:
```bash
pm2 status
pm2 logs kore-backend --lines 50
```

### Reiniciar manualmente:
```bash
cd /home/ubuntu/kore-inventory/backend
npm run build
pm2 restart kore-backend
```

### Ver errores de compilación:
```bash
cd /home/ubuntu/kore-inventory/backend
npm run build
# Si hay errores, aparecerán aquí
```

### Verificar puerto 3000:
```bash
curl http://localhost:3000/api/ventas
# Debe retornar JSON
```

---

## 📞 CONTACTO / ESCALACIÓN

Si ninguno de los scripts funciona:

1. Revisar AWS Console → EC2 (estado instancia)
2. Revisar AWS Console → RDS (estado base de datos)
3. Revisar logs completos: `pm2 logs kore-backend --lines 200`
4. Backup y rollback: `git log` → `git checkout [commit-anterior]`

---

## ✅ CHECKLIST DE SALUD DEL BACKEND

Ejecutar periódicamente (1 vez al día):

- [ ] `estado_servidor.bat` - Todo verde
- [ ] Memoria < 80%
- [ ] Disco < 80%
- [ ] PM2 status = "online"
- [ ] Logs sin errores críticos
- [ ] Base de datos respondiendo

---

**Última actualización:** 2026-06-13  
**Creado por:** GitHub Copilot  
**Versión:** 1.0
