# 📁 ESTRUCTURA DEL SERVIDOR EC2

**Servidor:** AWS EC2 Ubuntu - ip-172-31-11-170  
**IP Pública:** 18.191.181.99  
**Usuario:** ubuntu  
**SSH Key:** `C:\Users\luis.rodriguez\Downloads\korekey.pem`

---

## ✅ CONFIGURACIÓN ACTUAL VERIFICADA

### 1️⃣ Repositorio Git (Código fuente)
```
/home/ubuntu/kore-inventory/          ← PROYECTO PRINCIPAL
├── .git/                              (repositorio activo)
├── backend/
│   ├── src/
│   ├── node_modules/
│   ├── package.json
│   └── .env                           (variables de entorno)
├── frontend/
│   └── public/
│       ├── dashboard.html
│       ├── super-admin.html
│       └── assets/
│           ├── css/
│           └── js/
│               ├── dashboard.js       (22KB - con módulos)
│               └── super-admin.js     (18KB - actualizado)
├── SQL/
└── [archivos markdown de documentación]
```

**✅ Estado actual:**
- Git remoto: `https://github.com/disoviluis/kore-inventory.git`
- Branch: `main`
- Último commit local: `78926ec`
- Cambios locales: guardados en stash (no afectan funcionalidad)

**Aquí haces:** `git pull origin main`

---

### 2️⃣ Nginx (Servidor web)
```
Configuración: /etc/nginx/sites-available/kore
Root: /var/www/kore/kore-inventory/frontend/public
Puerto: 80 (HTTP)
```

**✅ Symlink activo:**
```
/var/www/kore/kore-inventory → /home/ubuntu/kore-inventory
```

Esto significa que cuando nginx sirve archivos, los lee directamente desde el repositorio git.

---

### 3️⃣ Backend (PM2)
```
Nombre proceso: kore-backend
ID: 1
Estado: online ✅
Puerto: 3000
Directorio ejecución: /home/ubuntu/kore-inventory/backend
Comando: npm run dev
Uptime actual: 3+ días
```

**Verificar con:** `pm2 status`

---

### 4️⃣ Backup
```
/home/ubuntu/kore-inventory-backup-20260211/
```
Backup automático creado antes de cambios importantes.

---

## 🚀 FLUJO DE TRABAJO CORRECTO

### En tu PC (Local):
```bash
# 1. Hacer cambios en el código
# 2. Probar localmente en http://localhost/kore-inventory/
# 3. Commit y push
git add .
git commit -m "feat: descripción del cambio"
git push origin main
```

### En el Servidor EC2:
```bash
# 1. Conectar por SSH (desde PowerShell local)
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99

# 2. Actualizar código
cd ~/kore-inventory
git pull origin main

# 3. Si cambiaste BACKEND (archivos .ts en /backend/src/):
cd backend
npm install              # Si hay nuevas dependencias
pm2 restart kore-backend
pm2 logs --lines 20      # Verificar que inició bien

# 4. Si cambiaste FRONTEND (archivos .html, .js, .css):
# ✅ NO HACE FALTA NADA
# El symlink ya apunta al repo actualizado
# Solo refresca el navegador: Ctrl + Shift + R (hard refresh)

# 5. Verificar que todo funciona
curl http://localhost:3000/api/health    # Backend
curl http://localhost/                    # Frontend
```

---

## 📋 COMANDOS DE DEPLOY COMPLETO

### Deploy rápido (un solo comando):
```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 \
  "cd ~/kore-inventory && git pull origin main && cd backend && npm install && pm2 restart kore-backend && pm2 logs --lines 20"
```

### Deploy paso a paso:
```bash
# 1. Conectar
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99

# 2. Actualizar
cd ~/kore-inventory
git status                # Ver estado
git pull origin main      # Traer cambios

# 3. Backend (si es necesario)
cd backend
npm install
pm2 restart kore-backend

# 4. Verificar
pm2 status
pm2 logs kore-backend --lines 30
```

---

## ❌ NO HACER NUNCA

### ❌ NO copiar archivos manualmente
```bash
# ❌ INCORRECTO - destruye el flujo de git
sudo cp -r ~/kore-inventory/frontend/public/* /var/www/html/
sudo cp -r ~/kore-inventory/frontend/public/* /cualquier-otro-lugar/
```

### ❌ NO cambiar la configuración de nginx
```bash
# ❌ INCORRECTO - rompe el symlink
sudo nano /etc/nginx/sites-available/kore
# y cambiar el root
```

### ❌ NO crear múltiples copias del código
```bash
# ❌ INCORRECTO - crea confusión
cd /var/www
git clone https://github.com/disoviluis/kore-inventory.git
```

### ❌ NO hacer git pull desde /var/www/
```bash
# ❌ INCORRECTO - /var/www/kore/kore-inventory es un SYMLINK, no un repo
cd /var/www/kore/kore-inventory
git pull  # ❌ Esto falla porque es un symlink
```

---

## ✅ COMANDOS DE VERIFICACIÓN

### Ver estructura correcta:
```bash
# Ver dónde está el repo
ls -la ~/kore-inventory/
# Debe mostrar: .git/ backend/ frontend/ SQL/ etc.

# Ver configuración de nginx
cat /etc/nginx/sites-available/kore | grep root
# Debe mostrar: root /var/www/kore/kore-inventory/frontend/public;

# Verificar que el symlink funciona
ls -la /var/www/kore/
# Debe mostrar: kore-inventory -> /home/ubuntu/kore-inventory

# Ver archivos reales del frontend
ls -la /var/www/kore/kore-inventory/frontend/public/assets/js/
# Debe listar: dashboard.js, super-admin.js, etc.

# Verificar tamaño de archivos actualizados
ls -lh ~/kore-inventory/frontend/public/assets/js/super-admin.js
# Debe mostrar: ~18KB
```

### Ver estado del backend:
```bash
pm2 status
pm2 info kore-backend
pm2 logs kore-backend --lines 20
```

### Ver logs de nginx:
```bash
sudo tail -30 /var/log/nginx/error.log
sudo tail -30 /var/log/nginx/access.log
```

### Verificar que el backend responde:
```bash
curl http://localhost:3000/api/health
# Debe responder: {"status":"ok"}

# Ver endpoints disponibles
curl http://localhost:3000/api/ | jq
```

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### ⚠️ Git stash (cambios locales guardados)
**Situación actual:** El servidor tiene cambios guardados con `git stash`

**¿Es un problema?** ❌ NO - Los cambios nuevos ya están integrados correctamente

**Si quieres limpiar el stash:**
```bash
cd ~/kore-inventory
git stash list              # Ver qué hay guardado
git stash drop              # Eliminar último stash (opcional)
# O eliminar todos:
git stash clear             # Limpiar todo el stash
```

**Si algo salió mal con el último pull:**
```bash
cd ~/kore-inventory
git stash pop               # Restaurar cambios guardados
# Resolver conflictos si hay
git status
```

---

### 🔄 Si el git pull falla por conflictos:
```bash
cd ~/kore-inventory
git status                  # Ver qué archivos están en conflicto

# Opción 1: Descartar cambios locales (CUIDADO)
git reset --hard HEAD
git pull origin main

# Opción 2: Guardar y luego actualizar
git stash
git pull origin main
# Si no necesitas los cambios locales:
git stash drop
```

---

### 🔗 Verificar/Recrear symlink:
```bash
# Ver si existe
ls -la /var/www/kore/kore-inventory
# Debe mostrar: kore-inventory -> /home/ubuntu/kore-inventory

# Si el symlink no existe o está roto:
sudo rm /var/www/kore/kore-inventory 2>/dev/null
sudo ln -s /home/ubuntu/kore-inventory /var/www/kore/kore-inventory
sudo chmod 755 /home/ubuntu
sudo chmod -R 755 ~/kore-inventory
sudo systemctl restart nginx
```

---

### 🔴 Backend no arranca:
```bash
# Ver logs de error
pm2 logs kore-backend --err --lines 50

# Verificar puerto 3000 libre
sudo lsof -i :3000

# Reiniciar completamente
pm2 delete kore-backend
cd ~/kore-inventory/backend
pm2 start npm --name kore-backend -- run dev
pm2 save

# Ver variables de entorno
pm2 env 1
cat ~/kore-inventory/backend/.env
```

---

### 🌐 Frontend no se actualiza:
```bash
# 1. Verificar que git pull trajo los cambios
cd ~/kore-inventory
git log --oneline -5

# 2. Ver última modificación de archivos
ls -lt ~/kore-inventory/frontend/public/assets/js/ | head -10

# 3. Verificar permisos
ls -la ~/kore-inventory/frontend/public/

# 4. Hard refresh en navegador
# Chrome/Edge: Ctrl + Shift + R
# Firefox: Ctrl + F5

# 5. Limpiar caché de navegador completamente
# DevTools → Network → Disable cache (mientras está abierto)
```

---

## 📊 TABLA RESUMEN

| Componente | Ubicación Real | Comando Actualización | Reinicio Necesario |
|------------|---------------|----------------------|-------------------|
| **Código Fuente** | `/home/ubuntu/kore-inventory` | `git pull origin main` | No |
| **Frontend HTML/JS/CSS** | Symlink desde nginx | Automático con git pull | No (solo Ctrl+Shift+R) |
| **Backend TypeScript** | `/home/ubuntu/kore-inventory/backend` | `git pull` + `pm2 restart kore-backend` | Sí |
| **Base de Datos** | AWS RDS MySQL | Scripts SQL manuales | No |
| **Nginx** | Configuración en `/etc/nginx/` | No tocar (ya configurado) | Solo si cambias config |

---

## 🎯 REGLAS DE ORO

### 1. **UNA SOLA UBICACIÓN DEL CÓDIGO**
```
/home/ubuntu/kore-inventory  ← ÚNICA FUENTE DE VERDAD
```

### 2. **TODO SE ACTUALIZA CON GIT PULL**
- Frontend: ✅ Automático (gracias al symlink)
- Backend: ✅ git pull + pm2 restart
- Base de datos: Scripts SQL manuales

### 3. **EL SYMLINK ES TU AMIGO**
```
/var/www/kore/kore-inventory → /home/ubuntu/kore-inventory
```
Nginx sirve archivos desde aquí, pero en realidad lee desde el repo git.

### 4. **PM2 GESTIONA EL BACKEND**
```bash
pm2 status          # Ver estado
pm2 restart         # Reiniciar
pm2 logs           # Ver logs
```

### 5. **NO COPIES ARCHIVOS MANUALMENTE**
Si necesitas actualizar → usa `git pull`

---

## 📞 INFORMACIÓN DE CONEXIÓN

### SSH
```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99
```

### Acceso Web
- **Frontend:** http://18.191.181.99/dashboard.html
- **Backend API:** http://18.191.181.99:3000/api/

### Base de Datos (RDS)
- **Host:** [configurado en backend/.env]
- **Puerto:** 3306
- **Database:** kore_inventory
- **Acceso:** Desde EC2 o con túnel SSH

---

## 📝 CHECKLIST DE DEPLOY

- [ ] Cambios commiteados localmente: `git status`
- [ ] Push a GitHub: `git push origin main`
- [ ] Conectar a servidor SSH
- [ ] Ir al directorio: `cd ~/kore-inventory`
- [ ] Actualizar código: `git pull origin main`
- [ ] Si hay cambios en backend:
  - [ ] `cd backend && npm install`
  - [ ] `pm2 restart kore-backend`
  - [ ] `pm2 logs --lines 20`
- [ ] Si hay cambios en frontend:
  - [ ] Hard refresh en navegador (Ctrl+Shift+R)
- [ ] Verificar en navegador que todo funciona
- [ ] Revisar PM2: `pm2 status`
- [ ] Cerrar sesión SSH: `exit`

---

**Última actualización:** 2026-02-16 14:40 UTC  
**Última verificación:** 2026-02-16 (estructura validada con comandos SSH)  
**Estado:** ✅ Funcionando correctamente  
**Archivos actualizados:** dashboard.html (con empresasModule), super-admin.js (18KB), dashboard.js (22KB)

---
# Ver dónde está el repo
ls -la ~/kore-inventory/

# Ver configuración de nginx
cat /etc/nginx/sites-available/kore

# Ver que el symlink funciona
ls -la /var/www/kore/kore-inventory/frontend/public/
```

### Ver estado del backend:
```bash
pm2 status
pm2 logs kore-backend --lines 20
```

### Ver logs de nginx:
```bash
sudo tail -30 /var/log/nginx/error.log
sudo tail -30 /var/log/nginx/access.log
```

---

## 🔧 SI ALGO SE ROMPE

### Verificar symlink:
```bash
ls -la /var/www/kore/kore-inventory
# Debe mostrar: kore-inventory -> /home/ubuntu/kore-inventory
```

### Recrear symlink (solo si es necesario):
```bash
sudo rm /var/www/kore/kore-inventory
sudo ln -s /home/ubuntu/kore-inventory /var/www/kore/kore-inventory
chmod 755 /home/ubuntu
chmod -R 755 ~/kore-inventory
sudo systemctl restart nginx
```

---

## 📊 RESUMEN RÁPIDO

| Componente | Ubicación Real | Cómo Actualizar |
|------------|---------------|-----------------|
| **Código Fuente** | `/home/ubuntu/kore-inventory` | `git pull` |
| **Frontend** | Symlink desde nginx | Automático después de git pull |
| **Backend** | `/home/ubuntu/kore-inventory/backend` | `git pull` + `npm run build` + `pm2 restart` |
| **Nginx** | Apunta a `/var/www/kore/kore-inventory` | No tocar |

---

## 🎯 REGLA DE ORO

**UNA SOLA UBICACIÓN DEL CÓDIGO:** `/home/ubuntu/kore-inventory`

- Git pull actualiza aquí
- Nginx lee desde aquí (via symlink)
- Backend corre desde aquí
- PM2 gestiona desde aquí

**TODO LO DEMÁS SON ERRORES**

---

**Última actualización:** 2026-02-16 14:40 UTC  
**Última verificación:** 2026-02-16 (estructura validada con comandos SSH)  
**Estado:** ✅ Funcionando correctamente  
**Archivos actualizados:** dashboard.html (con empresasModule), super-admin.js (18KB), dashboard.js (22KB)

---
