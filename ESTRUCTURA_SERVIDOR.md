# 📁 ESTRUCTURA DEL SERVIDOR EC2

**Servidor:** AWS EC2 Ubuntu - ip-172-31-11-170  
**IP Pública:** 18.191.181.99  
**Usuario:** ubuntu  
**SSH Key:** `C:\Users\luis.rodriguez\Downloads\korekey.pem`

---

## 🎯 INSTRUCTIVO DE DEPLOY - PASO A PASO

### 📋 **Resumen Rápido: ¿Qué Hiciste?**

| Cambio Realizado | Archivos Afectados | Build | Commit/Push | Deploy Frontend | Deploy Backend | Migración DB | Restart Server |
|------------------|-------------------|-------|-------------|-----------------|----------------|--------------|----------------|
| **HTML/CSS/JS** | `frontend/public/**` | ❌ No | ✅ Sí | ✅ Sí | ❌ No | ❌ No | ❌ No |
| **Backend .ts** | `backend/src/**` | ✅ Sí | ✅ Sí | ❌ No | ✅ Sí | ❌ No | ✅ Sí (PM2) |
| **Base de Datos** | `SQL/**` | ❌ No | ✅ Sí* | ❌ No | ❌ No | ✅ Sí | ❌ No |
| **Front + Back** | Ambos | ✅ Sí | ✅ Sí | ✅ Sí | ✅ Sí | ❌ No | ✅ Sí (PM2) |
| **Todo** | Front + Back + DB | ✅ Sí | ✅ Sí | ✅ Sí | ✅ Sí | ✅ Sí | ✅ Sí (PM2) |

\* *Los archivos SQL se commitean pero NO se ejecutan automáticamente*

---

### 🟢 **OPCIÓN 1: Solo cambios en FRONTEND** 
*(Archivos .html, .css, .js en /frontend/public)*

#### **En tu PC Local:**

```bash
# 1. Verificar cambios
git status

# 2. Agregar cambios
git add frontend/public/

# 3. Commit con mensaje descriptivo
git commit -m "feat(frontend): agregar importación/exportación de productos a Excel"

# 4. Opcional: Ver qué archivos cambiaron
git show --stat

# 5. Push a GitHub
git push origin main
```

#### **En el Servidor AWS (EC2):**

```bash
# 1. Conectar por SSH
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99

# 2. Ir al repositorio
cd /home/ubuntu/kore-inventory

# 3. Actualizar código
git pull origin main

# 4. Verificar que llegaron los cambios
git log --oneline -5
ls -lt frontend/public/assets/js/ | head -5

# 5. Salir del servidor
exit
```

#### **En tu Navegador:**

```bash
# 1. Abrir la aplicación
Ir a: http://18.191.181.99/

# 2. Hard refresh (limpiar caché)
Ctrl + Shift + R  (Chrome/Edge/Firefox)

# 3. Verificar cambios
- Abrir DevTools (F12) → Network
- Verificar que los archivos .js tienen timestamp nuevo
- Probar la nueva funcionalidad
```

**✅ Tiempo estimado:** 2-3 minutos  
**⚠️ Downtime:** NINGUNO (cero downtime)

---

### 🔵 **OPCIÓN 2: Solo cambios en BACKEND**
*(Archivos .ts en /backend/src)*

#### **En tu PC Local:**

```bash
# 1. Verificar que el código compila sin errores
cd backend
npm run build
# Verificar que no hay errores de TypeScript

# 2. Agregar cambios
git add backend/src/

# 3. Commit con mensaje descriptivo
git commit -m "feat(backend): agregar endpoints para exportar datos"

# 4. Push a GitHub
git push origin main
```

#### **En el Servidor AWS (EC2):**

```bash
# 1. Conectar por SSH
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99

# 2. Ir al repositorio
cd /home/ubuntu/kore-inventory

# 3. Actualizar código
git pull origin main

# 4. Ir al backend y compilar
cd backend
npm run build

# 5. Verificar que compiló correctamente
ls -la dist/
# Debe mostrar archivos .js con timestamp actualizado

# 6. Reiniciar el servidor con PM2
pm2 restart kore-backend

# 7. Verificar que arrancó correctamente (IMPORTANTE)
pm2 logs kore-backend --lines 30 --nostream

# 8. Verificar que la API responde
curl http://localhost:3000/api/ventas | head -20

# 9. Mantener logs abiertos por 1 minuto para ver si hay errores
pm2 logs kore-backend
# Presionar Ctrl+C para salir cuando veas que funciona bien

# 10. Salir del servidor
exit
```

**✅ Tiempo estimado:** 5-7 minutos  
**⚠️ Downtime:** ~10-15 segundos (durante pm2 restart)

---

### 🟣 **OPCIÓN 3: Cambios en BASE DE DATOS**
*(Archivos .sql en /SQL o migraciones)*

#### **En tu PC Local:**

```bash
# 1. Crear o modificar archivo de migración
# Crear archivo: SQL/migration_[fecha]_[descripcion].sql

# 2. PROBAR PRIMERO EN BASE DE DATOS LOCAL
mysql -u root -p kore_inventory < SQL/migration_2026_03_11_agregar_campo_x.sql

# 3. Verificar que funcionó
mysql -u root -p
USE kore_inventory;
DESCRIBE productos;  # Ver si el cambio se aplicó
SELECT * FROM productos LIMIT 1;  # Verificar datos

# 4. Si todo está bien, agregar a git
git add SQL/migration_*.sql

# 5. Commit
git commit -m "feat(db): agregar campo X a tabla productos"

# 6. Push a GitHub
git push origin main
```

#### **En el Servidor AWS (EC2):**

```bash
# 1. Conectar por SSH
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99

# 2. Ir al repositorio
cd /home/ubuntu/kore-inventory

# 3. Actualizar código
git pull origin main

# 4. Ver el archivo SQL que llegó
cat SQL/migration_2026_03_11_agregar_campo_x.sql

# 5. HACER BACKUP DE LA BASE DE DATOS (MUY IMPORTANTE)
mysqldump -h [RDS_HOST] -u [DB_USER] -p[DB_PASSWORD] kore_inventory > ~/backup_antes_migracion_$(date +%Y%m%d_%H%M%S).sql
# Te pedirá la contraseña de la BD

# 6. Verificar que el backup se creó
ls -lh ~/backup_*.sql

# 7. Conectar a la base de datos
mysql -h [RDS_HOST] -u [DB_USER] -p[DB_PASSWORD] kore_inventory

# 8. Dentro de MySQL, verificar estado actual
SHOW TABLES;
DESCRIBE productos;  # Ver estructura antes del cambio

# 9. Ejecutar la migración
SOURCE /home/ubuntu/kore-inventory/SQL/migration_2026_03_11_agregar_campo_x.sql;

# 10. Verificar que se aplicó correctamente
DESCRIBE productos;  # Ver estructura después del cambio
SELECT * FROM productos LIMIT 1;  # Ver datos

# 11. Salir de MySQL
EXIT;

# 12. Si el backend usa el nuevo campo, reiniciarlo
cd /home/ubuntu/kore-inventory/backend
pm2 restart kore-backend
pm2 logs kore-backend --lines 20

# 13. Salir del servidor
exit
```

#### **Alternativa: Ejecutar SQL remotamente desde tu PC**

```bash
# Si tienes acceso directo a la BD desde tu PC:
mysql -h [RDS_HOST] -u [DB_USER] -p[DB_PASSWORD] kore_inventory < SQL/migration_2026_03_11_agregar_campo_x.sql

# O usar un túnel SSH:
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem -L 3307:[RDS_HOST]:3306 ubuntu@18.191.181.99
# En otra terminal:
mysql -h 127.0.0.1 -P 3307 -u [DB_USER] -p[DB_PASSWORD] kore_inventory < SQL/migration_2026_03_11_agregar_campo_x.sql
```

**✅ Tiempo estimado:** 10-15 minutos  
**⚠️ Downtime:** DEPENDE del tipo de migración:
- ALTER TABLE sin datos: ~1-5 segundos
- ALTER TABLE con muchos datos: hasta varios minutos
- INSERT/UPDATE: depende de la cantidad de registros

**⚠️⚠️ MUY IMPORTANTE:**
- **SIEMPRE hacer backup antes**
- Probar en local primero
- Ejecutar en horarios de bajo tráfico
- Tener plan de rollback

---

### 🟠 **OPCIÓN 4: DEPLOY COMPLETO (Frontend + Backend + DB)**

#### **En tu PC Local:**

```bash
# 1. Agregar todos los cambios
git add .

# 2. Commit todo
git commit -m "feat: implementar módulo completo de productos con importación Excel

- Frontend: agregar botones y modales de importación/exportación
- Backend: agregar endpoints para procesar archivos Excel
- Database: agregar campos para tracking de importaciones"

# 3. Push
git push origin main
```

#### **En el Servidor AWS (EC2):**

```bash
# 1. Conectar
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99

# 2. Actualizar código
cd /home/ubuntu/kore-inventory
git pull origin main

# 3. PRIMERO: Ejecutar migraciones de base de datos
# (seguir pasos de OPCIÓN 3)
mysql -h [RDS_HOST] -u [DB_USER] -p[DB_PASSWORD] kore_inventory < SQL/migration_X.sql

# 4. SEGUNDO: Actualizar backend
cd backend
npm install  # Solo si hay nuevas dependencias
npm run build
pm2 restart kore-backend
pm2 logs kore-backend --lines 30 --nostream

# 5. TERCERO: Frontend (automático via symlink, pero verificar)
ls -lt /home/ubuntu/kore-inventory/frontend/public/assets/js/ | head -5

# 6. Verificar todo funciona
curl http://localhost:3000/api/productos/empresa/1 | head -20
pm2 status

# 7. Salir
exit
```

#### **En tu Navegador:**

```bash
Ctrl + Shift + R (hard refresh)
Abrir DevTools y probar todas las funcionalidades nuevas
```

**✅ Tiempo estimado:** 15-20 minutos  
**⚠️ Downtime:** 10-30 segundos (solo durante pm2 restart)

---

### ⚡ **COMANDOS DE DEPLOY RÁPIDO (Una Sola Línea)**

#### **Deploy Frontend:**
```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "cd /home/ubuntu/kore-inventory && git pull origin main && ls -lt frontend/public/assets/js/ | head -5"
```

#### **Deploy Backend:**
```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "cd /home/ubuntu/kore-inventory && git pull origin main && cd backend && npm run build && pm2 restart kore-backend && pm2 logs kore-backend --lines 20 --nostream"
```

#### **Deploy Completo (Front + Back):**
```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "cd /home/ubuntu/kore-inventory && git pull origin main && cd backend && npm run build && pm2 restart kore-backend && pm2 logs kore-backend --lines 30 --nostream && pm2 status"
```

---

### 📊 **CHECKLIST DE DEPLOY COMPLETO**

#### **ANTES de hacer cambios:**
- [ ] Crear rama de feature (opcional): `git checkout -b feature/nombre`
- [ ] Verificar que estás en el directorio correcto
- [ ] Backup de archivos importantes si modificas algo crítico

#### **DURANTE el desarrollo:**
- [ ] Probar cambios localmente: `http://localhost/kore-inventory/`
- [ ] Si es backend: `cd backend && npm run build` sin errores
- [ ] Si es DB: Probar migración en base de datos local primero
- [ ] Verificar que no hay console.log() o código debug

#### **ANTES de commit:**
- [ ] `git status` - ver qué archivos cambiaron
- [ ] `git diff` - revisar cambios línea por línea
- [ ] Eliminar archivos temporales o de prueba
- [ ] Actualizar documentación si es necesario

#### **GIT - Local:**
- [ ] `git add .` o `git add [archivos específicos]`
- [ ] `git commit -m "tipo(alcance): descripción clara"`
- [ ] `git log --oneline -5` - verificar que el commit está bien
- [ ] `git push origin main` (o la rama correspondiente)

#### **DEPLOY - Servidor:**
- [ ] Conectar SSH al servidor EC2
- [ ] `cd /home/ubuntu/kore-inventory`
- [ ] `git pull origin main` - debe decir "Already up to date" o mostrar cambios
- [ ] Verificar que no hay conflictos

#### **Si hay cambios en BASE DE DATOS:**
- [ ] **HACER BACKUP:** `mysqldump ... > backup_$(date +%Y%m%d).sql`
- [ ] Verificar backup: `ls -lh ~/backup*.sql`
- [ ] Ejecutar migración: `mysql ... < SQL/migration_X.sql`
- [ ] Verificar cambios: `DESCRIBE tabla;`
- [ ] Si falla: Restaurar backup inmediatamente

#### **Si hay cambios en BACKEND:**
- [ ] `cd backend`
- [ ] `npm install` (solo si package.json cambió)
- [ ] `npm run build` - debe completar sin errores
- [ ] `ls -la dist/` - verificar archivos .js actualizados
- [ ] `pm2 restart kore-backend`
- [ ] **CRÍTICO:** `pm2 logs kore-backend --lines 30` - ver que no hay errores
- [ ] Esperar 30 segundos viendo logs
- [ ] `curl http://localhost:3000/api/ventas` - verificar API responde

#### **Si hay cambios en FRONTEND:**
- [ ] Verificar symlink: `ls -la /var/www/kore/kore-inventory`
- [ ] Ver timestamps: `ls -lt frontend/public/assets/js/ | head -5`
- [ ] Salir del servidor: `exit`
- [ ] Abrir navegador: http://18.191.181.99/
- [ ] Hard refresh: `Ctrl + Shift + R`
- [ ] DevTools → Network → verificar archivos nuevos cargados
- [ ] Probar funcionalidad modificada

#### **VERIFICACIÓN FINAL:**
- [ ] Frontend funciona correctamente
- [ ] Backend responde: `curl http://18.191.181.99:3000/api/ventas`
- [ ] PM2 en estado "online": `pm2 status`
- [ ] No hay errores en logs: `pm2 logs kore-backend --lines 50`
- [ ] Base de datos tiene los cambios esperados (si aplica)

#### **DESPUÉS DEL DEPLOY:**
- [ ] Documentar problemas encontrados
- [ ] Notificar al equipo si hubo downtime
- [ ] Actualizar este archivo si encontraste nuevos pasos necesarios
- [ ] Actualizar commit actual en este archivo

---

## ✅ CONFIGURACIÓN ACTUAL VERIFICADA (2026-02-19)

### 1️⃣ Repositorio Git (Código fuente) - ÚNICA FUENTE DE VERDAD
```
/home/ubuntu/kore-inventory/          ← PROYECTO PRINCIPAL (REPOSITORIO GIT)
├── .git/                              (repositorio activo)
├── backend/
│   ├── src/                           (código TypeScript)
│   ├── dist/                          (código compilado JavaScript)
│   ├── node_modules/
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                           (variables de entorno)
├── frontend/
│   └── public/
│       ├── *.html                     (dashboard, ventas, productos, etc.)
│       └── assets/
│           ├── css/
│           └── js/
├── SQL/                               (migraciones y scripts)
└── *.md                               (documentación)
```

**✅ Estado:**
- Git remoto: `https://github.com/disoviluis/kore-inventory.git`
- Branch: `main`
- Commit actual: `c8d71ca` (Fase 2 - Backend facturación)

**🎯 AQUÍ SE HACE TODO:**
```bash
cd /home/ubuntu/kore-inventory
git pull origin main              # Actualizar código
cd backend && npm run build       # Compilar TypeScript
pm2 restart kore-backend          # Reiniciar backend
```

---

### 2️⃣ Nginx (Servidor web Frontend)
```
Configuración: /etc/nginx/sites-available/kore
Root: /var/www/kore/kore-inventory
Puerto: 80 (HTTP)
```

**✅ Symlink activo:**
```
/var/www/kore/kore-inventory → /home/ubuntu/kore-inventory/frontend/public
```

**¿Qué significa esto?**  
- Nginx sirve archivos desde `/var/www/kore/kore-inventory`
- Pero en realidad lee desde `/home/ubuntu/kore-inventory/frontend/public` (via symlink)
- Cualquier cambio en el repositorio git se refleja automáticamente en nginx
- **NO SE COPIA NADA MANUALMENTE** - El symlink hace que ambas ubicaciones sean la misma

---

### 3️⃣ Backend (PM2 - Node.js)
```
Nombre proceso: kore-backend
ID: 0
Estado: online ✅
Puerto: 3000
Comando ejecutado: npm run dev
Script ejecutado: nodemon src/server.ts
Directorio ejecución: /home/ubuntu/kore-inventory/backend
```

**⚠️ IMPORTANTE - PM2 NO USA EL SYMLINK:**
- PM2 ejecuta directamente desde: `/home/ubuntu/kore-inventory/backend`
- **NO** ejecuta desde `/var/www/kore/kore-inventory/backend`
- El backend lee archivos TypeScript con nodemon en modo desarrollo
- Para producción se usaría: `npm start` (ejecuta dist/server.js)

**Verificar con:**
```bash
pm2 describe kore-backend    # Ver configuración completa
pm2 status                    # Ver estado
pm2 logs kore-backend         # Ver logs en tiempo real
```

---

### 4️⃣ Backup
```
/home/ubuntu/kore-inventory-backup-20260211/
```
Backup manual creado antes de cambios importantes.

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

**1. Conectar por SSH:**
```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99
```

**2. Actualizar código (SIEMPRE desde el repositorio git):**
```bash
cd /home/ubuntu/kore-inventory    # ← UBICACIÓN CORRECTA
git pull origin main
```

**3. Si cambiaste BACKEND (archivos .ts en /backend/src/):**
```bash
cd /home/ubuntu/kore-inventory/backend    # ← UBICACIÓN CORRECTA
npm install                               # Solo si hay nuevas dependencias
npm run build                             # Compilar TypeScript → dist/
pm2 restart kore-backend                  # Reiniciar proceso
pm2 logs kore-backend --lines 20          # Verificar que inició bien
```

**4. Si cambiaste FRONTEND (archivos .html, .js, .css):**
```bash
# ✅ NO HACE FALTA NADA EN EL SERVIDOR
# El symlink de nginx ya apunta al repositorio git actualizado
# Solo refresca el navegador: Ctrl + Shift + R (hard refresh)
# Si es necesario: Ctrl + Shift + Delete para limpiar caché completa
```

**5. Verificar que todo funciona:**
```bash
curl http://localhost:3000/api/ventas           # Backend API
curl http://localhost/ | head -20               # Frontend HTML
pm2 status                                      # Estado de PM2
```

---

## 📋 COMANDOS DE DEPLOY RÁPIDO

### Deploy completo en un solo comando:
```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "cd /home/ubuntu/kore-inventory && git pull origin main && cd backend && npm run build && pm2 restart kore-backend && pm2 logs kore-backend --lines 20 --nostream"
```

### Deploy solo frontend:
```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "cd /home/ubuntu/kore-inventory && git pull origin main"
# Luego hard refresh en el navegador (Ctrl+Shift+R)
```

### Deploy solo backend:
```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "cd /home/ubuntu/kore-inventory && git pull origin main && cd backend && npm run build && pm2 restart kore-backend"
```

---

## ❌ ERRORES COMUNES - NO HACER NUNCA

### ❌ 1. NO copiar archivos manualmente
```bash
# ❌ INCORRECTO - Rompe el flujo de git y crea duplicados
sudo cp -r /home/ubuntu/kore-inventory/frontend/public/* /var/www/html/
sudo cp -r /home/ubuntu/kore-inventory/frontend/* /cualquier-lugar/
```
**✅ CORRECTO:** Usar `git pull` y dejar que el symlink haga su trabajo

---

### ❌ 2. NO hacer git pull desde /var/www/
```bash
# ❌ INCORRECTO - /var/www/kore/kore-inventory es un SYMLINK, no un repo
cd /var/www/kore/kore-inventory
git pull origin main    # ❌ Esto puede fallar o crear confusión
```
**✅ CORRECTO:** Siempre hacer git pull desde `/home/ubuntu/kore-inventory`

---

### ❌ 3. NO compilar TypeScript desde /var/www/
```bash
# ❌ INCORRECTO
cd /var/www/kore/kore-inventory/backend
npm run build    # Puede funcionar pero NO es la ubicación correcta
```
**✅ CORRECTO:** Compilar desde `/home/ubuntu/kore-inventory/backend`

---

### ❌ 4. NO crear múltiples copias del código
```bash
# ❌ INCORRECTO - Crea confusión sobre cuál es la versión correcta
cd /var/www/html
git clone https://github.com/disoviluis/kore-inventory.git
```
**✅ CORRECTO:** Una sola ubicación: `/home/ubuntu/kore-inventory`

---

### ❌ 5. NO cambiar la configuración de nginx (ya está correcta)
```bash
# ❌ INCORRECTO - Rompe el symlink configurado
sudo nano /etc/nginx/sites-available/kore
# y cambiar el root o server_name
```
**✅ CORRECTO:** Dejar nginx como está, el symlink ya funciona

---

### ❌ 6. NO ejecutar PM2 desde ubicaciones incorrectas
```bash
# ❌ INCORRECTO
cd /var/www/kore/kore-inventory/backend
pm2 start npm --name kore-backend -- run dev
```
**✅ CORRECTO:** PM2 ya está configurado correctamente desde `/home/ubuntu/kore-inventory/backend`

---

## ✅ COMANDOS DE VERIFICACIÓN

### Verificar estructura del repositorio:
```bash
# Ver contenido del repositorio git
ls -la /home/ubuntu/kore-inventory/
# Debe mostrar: .git/ backend/ frontend/ SQL/ *.md

# Ver que el repositorio está actualizado
cd /home/ubuntu/kore-inventory
git log --oneline -5    # Ver últimos 5 commits
git status              # Ver estado actual
```

### Verificar symlink de nginx:
```bash
# Ver el symlink
ls -la /var/www/kore/
# Debe mostrar: kore-inventory -> /home/ubuntu/kore-inventory/frontend/public

# Verificar que apunta al lugar correcto
readlink /var/www/kore/kore-inventory
# Debe mostrar: /home/ubuntu/kore-inventory/frontend/public

# Ver archivos del frontend a través del symlink
ls -la /var/www/kore/kore-inventory/
# Debe listar: dashboard.html, ventas.html, assets/, etc.
```

### Verificar configuración de nginx:
```bash
# Ver configuración activa
sudo cat /etc/nginx/sites-available/kore | grep -E 'server_name|root'
# Debe mostrar:
#   server_name _;
#   root /var/www/kore/kore-inventory;
```

### Verificar estado del backend (PM2):
```bash
# Ver estado general
pm2 status

# Ver detalles completos del proceso
pm2 describe kore-backend
# Verificar que muestra:
#   exec cwd: /home/ubuntu/kore-inventory/backend
#   script args: run dev

# Ver logs en tiempo real
pm2 logs kore-backend

# Ver últimas 50 líneas de logs
pm2 logs kore-backend --lines 50 --nostream

# Ver solo errores
pm2 logs kore-backend --err --lines 30
```

### Verificar que el backend responde:
```bash
# Verificar endpoint de ventas
curl -s http://localhost:3000/api/ventas | jq .

# Verificar endpoint de productos
curl -s http://localhost:3000/api/productos/empresa/1 | jq . | head -30

# Verificar nuevo endpoint de facturación
curl -s http://localhost:3000/api/facturacion/configuracion/1 | jq .
```

### Verificar archivos compilados del backend:
```bash
# Ver que existe la carpeta dist con JavaScript compilado
ls -la /home/ubuntu/kore-inventory/backend/
# Debe mostrar: dist/ src/ node_modules/ package.json

# Ver contenido de dist
ls -la /home/ubuntu/kore-inventory/backend/dist/
# Debe mostrar: server.js, app.js, routes.js, controllers/, platform/, etc.
```

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### 🔄 Git pull falla por conflictos:
```bash
cd /home/ubuntu/kore-inventory
git status                    # Ver qué archivos están en conflicto

# Opción 1: Guardar cambios locales y actualizar
git stash                     # Guardar cambios temporalmente
git pull origin main          # Actualizar desde GitHub
git stash list                # Ver cambios guardados
git stash drop                # Eliminar cambios guardados (si no los necesitas)

# Opción 2: Descartar cambios locales completamente (CUIDADO)
git reset --hard HEAD
git pull origin main
```

---

### 🔗 Symlink roto o no funciona:
```bash
# Verificar si existe el symlink
ls -la /var/www/kore/kore-inventory

# Si está roto o no existe, recrearlo:
sudo rm -f /var/www/kore/kore-inventory
sudo ln -s /home/ubuntu/kore-inventory/frontend/public /var/www/kore/kore-inventory

# Dar permisos correctos
sudo chmod 755 /home/ubuntu
sudo chmod 755 /home/ubuntu/kore-inventory
sudo chmod -R 755 /home/ubuntu/kore-inventory/frontend

# Reiniciar nginx
sudo systemctl restart nginx
sudo systemctl status nginx
```

---

### 🔴 Backend no arranca después de pm2 restart:
```bash
# Ver logs de error
pm2 logs kore-backend --err --lines 50

# Ver si el puerto 3000 está ocupado
sudo lsof -i :3000
# Si aparece otro proceso, matarlo:
sudo kill -9 <PID>

# Verificar que las dependencias están instaladas
cd /home/ubuntu/kore-inventory/backend
ls -la node_modules/    # Debe existir y tener contenido
npm install             # Reinstalar si es necesario

# Verificar archivo .env
cat /home/ubuntu/kore-inventory/backend/.env
# Debe contener: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET

# Reiniciar PM2 completamente
pm2 delete kore-backend
cd /home/ubuntu/kore-inventory/backend
pm2 start npm --name kore-backend -- run dev
pm2 save                # Guardar configuración
pm2 logs kore-backend   # Ver si arranca
```

---

### 🌐 Frontend no se actualiza después de git pull:
```bash
# 1. Verificar que git pull trajo los cambios
cd /home/ubuntu/kore-inventory
git log --oneline -5             # Ver últimos commits
git show HEAD --stat             # Ver archivos del último commit

# 2. Ver última modificación de archivos
ls -lt /home/ubuntu/kore-inventory/frontend/public/assets/js/ | head -10
ls -lt /home/ubuntu/kore-inventory/frontend/public/*.html | head -10

# 3. Verificar que el symlink apunta correctamente
ls -la /var/www/kore/kore-inventory/assets/js/
# Debe mostrar los mismos archivos que en el repositorio

# 4. Verificar permisos
ls -la /home/ubuntu/kore-inventory/frontend/public/

# 5. En el navegador:
#    - Hard refresh: Ctrl + Shift + R (Chrome/Edge)
#    - Abrir DevTools → Network → Check "Disable cache"
#    - Limpiar caché: Ctrl + Shift + Delete
#    - Probar en modo incógnito
```

---

### ⚡ PM2 se cae o se reinicia constantemente:
```bash
# Ver logs para identificar el error
pm2 logs kore-backend --lines 100

# Ver monitoreo en tiempo real
pm2 monit

# Verificar memoria y CPU
pm2 list

# Si el problema es de memoria, aumentar el límite:
pm2 delete kore-backend
cd /home/ubuntu/kore-inventory/backend
pm2 start npm --name kore-backend --max-memory-restart 500M -- run dev
pm2 save
```

---

### 🗄️ Error de conexión a base de datos:
```bash
# Verificar variables de entorno
cat /home/ubuntu/kore-inventory/backend/.env

# Probar conexión desde el servidor
mysql -h <DB_HOST> -u <DB_USER> -p<DB_PASSWORD> <DB_NAME>
# Si falla, verificar:
# 1. Security group de RDS permite conexión desde EC2
# 2. Credenciales correctas
# 3. RDS está activo

# Ver logs del backend para ver error específico
pm2 logs kore-backend --lines 50
```

---

## 📊 TABLA RESUMEN DE UBICACIONES

| Componente | Ubicación Real | Cómo se Actualiza | Reinicio Necesario |
|------------|---------------|-------------------|-------------------|
| **Repositorio Git** | `/home/ubuntu/kore-inventory` | `git pull origin main` | No |
| **Frontend (HTML/JS/CSS)** | `/home/ubuntu/kore-inventory/frontend/public` | Automático después de git pull (via symlink) | No (solo Ctrl+Shift+R en navegador) |
| **Backend (TypeScript)** | `/home/ubuntu/kore-inventory/backend/src` | `git pull` + `npm run build` + `pm2 restart` | Sí (PM2 restart) |
| **Backend Compilado (JavaScript)** | `/home/ubuntu/kore-inventory/backend/dist` | `npm run build` | Sí (PM2 restart) |
| **Nginx Config** | `/etc/nginx/sites-available/kore` | No tocar (ya configurado correctamente) | Solo si cambias config |
| **Nginx Symlink** | `/var/www/kore/kore-inventory` → `/home/ubuntu/kore-inventory/frontend/public` | No tocar (ya configurado) | No |
| **PM2 Process** | Ejecuta desde `/home/ubuntu/kore-inventory/backend` | `pm2 restart kore-backend` | Sí |
| **Base de Datos** | AWS RDS (externo) | Scripts SQL manuales | No |

---

## 🎯 REGLAS DE ORO

### 1. **UNA SOLA UBICACIÓN DEL CÓDIGO**
```
/home/ubuntu/kore-inventory  ← ÚNICA FUENTE DE VERDAD
```
- Es el repositorio git activo
- Es donde se hace `git pull`
- Es donde PM2 ejecuta el backend
- Es donde nginx lee el frontend (via symlink)

### 2. **TODO SE ACTUALIZA CON GIT PULL**
```bash
cd /home/ubuntu/kore-inventory
git pull origin main
```
- Frontend: ✅ Se actualiza automáticamente (nginx + symlink)
- Backend: ✅ Código fuente actualizado (requiere build + restart)
- Base de datos: Scripts SQL manuales (no se actualizan con git)

### 3. **EL SYMLINK ES TU AMIGO**
```
/var/www/kore/kore-inventory → /home/ubuntu/kore-inventory/frontend/public
```
- Nginx lee desde `/var/www/kore/kore-inventory`
- Pero en realidad está leyendo desde el repositorio git
- **NO se copia nada** - Es la misma ubicación física
- Cualquier cambio en el repo git se refleja inmediatamente

### 4. **PM2 EJECUTA DIRECTAMENTE DESDE EL REPO GIT**
```bash
pm2 describe kore-backend
# exec cwd: /home/ubuntu/kore-inventory/backend
```
- **NO** usa symlink
- **NO** ejecuta desde /var/www/
- Ejecuta directamente desde el repositorio git
- Usa `npm run dev` (nodemon + TypeScript en desarrollo)

### 5. **NUNCA COPIAR ARCHIVOS MANUALMENTE**
```bash
# ❌ INCORRECTO - Rompe todo
sudo cp -r /home/ubuntu/kore-inventory/* /otro-lugar/

# ✅ CORRECTO - Usar git
cd /home/ubuntu/kore-inventory
git pull origin main
```

---

## 📞 INFORMACIÓN DE CONEXIÓN

### SSH
```bash
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99
```

### Acceso Web
- **Frontend:** http://18.191.181.99/
  - Dashboard: http://18.191.181.99/dashboard.html
  - Ventas: http://18.191.181.99/ventas.html
  - Productos: http://18.191.181.99/productos.html
  
- **Backend API:** http://18.191.181.99:3000/api/
  - Ventas: http://18.191.181.99:3000/api/ventas
  - Productos: http://18.191.181.99:3000/api/productos/empresa/1
  - Facturación: http://18.191.181.99:3000/api/facturacion/configuracion/1

### Base de Datos (RDS)
- **Host:** (configurado en /home/ubuntu/kore-inventory/backend/.env)
- **Puerto:** 3306
- **Database:** kore_inventory
- **Acceso:** Desde EC2 o túnel SSH
- **Security Group:** Permite conexión desde EC2

---

## 📝 CHECKLIST DE DEPLOY

### Antes de hacer deploy:
- [ ] Cambios commiteados localmente: `git status`
- [ ] Push a GitHub exitoso: `git push origin main`
- [ ] Identificar qué cambió: frontend, backend, o ambos

### Durante el deploy:
- [ ] Conectar a servidor SSH
- [ ] Navegar al repositorio: `cd /home/ubuntu/kore-inventory`
- [ ] Actualizar código: `git pull origin main`
- [ ] Verificar que el pull fue exitoso (no conflictos)

### Si hay cambios en backend:
- [ ] `cd /home/ubuntu/kore-inventory/backend`
- [ ] `npm install` (solo si hay nuevas dependencias)
- [ ] `npm run build` (compilar TypeScript)
- [ ] `pm2 restart kore-backend`
- [ ] `pm2 logs kore-backend --lines 20` (verificar sin errores)
- [ ] `curl http://localhost:3000/api/ventas` (verificar API responde)

### Si hay cambios en frontend:
- [ ] Hard refresh en navegador (Ctrl+Shift+R)
- [ ] Verificar en DevTools que se cargaron archivos nuevos (ver timestamps)
- [ ] Probar funcionalidad modificada

### Después del deploy:
- [ ] Verificar que la aplicación funciona correctamente
- [ ] Revisar `pm2 status` (proceso en estado "online")
- [ ] Revisar logs si hay errores: `pm2 logs kore-backend`
- [ ] Documentar cualquier problema encontrado

---

**Última actualización:** 2026-03-11 (Instructivo de deploy completo)  
**Última verificación:** 2026-02-19 (estructura validada con comandos SSH)  
**Estado:** ✅ Funcionando correctamente  
**Commit actual:** c8d71ca (Fase 2 - Backend facturación)  
**Módulos activos:** Dashboard, Ventas (precios dinámicos, sobrepago), Productos (con importación/exportación Excel), Proveedores (exportación Excel), Facturación (backend)  
**Últimos cambios:** 
- ✅ Productos: Implementada importación/exportación de Excel (SheetJS)
- ✅ Proveedores: Migrado de CSV a Excel (SheetJS)
- ✅ Ventas: Migrado de CSV a Excel (SheetJS)

