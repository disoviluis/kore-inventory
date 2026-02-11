# Comandos SSH para EC2 - Kore Inventory

## 📋 Información del Servidor
- **Servidor:** ip-172-31-11-170 (AWS EC2 Ubuntu)
- **Usuario:** ubuntu
- **Ruta proyecto:** ~/kore-inventory
- **Proceso PM2:** kore-backend (id: 0)
- **Base de datos:** MySQL RDS (kore_inventory)

---

## 🔐 Conectar al Servidor

```bash
# Conectar vía SSH (desde tu terminal local)
ssh -i "tu-llave.pem" ubuntu@tu-ip-publica.compute.amazonaws.com

# O si tienes configurado en ~/.ssh/config
ssh kore-server
```

---

## 📦 Deploy Completo (Actualizar Código)

```bash
# Secuencia completa de deploy
cd ~/kore-inventory && \
git pull origin main && \
cd backend && \
npm install && \
cd .. && \
pm2 restart kore-backend && \
pm2 logs kore-backend --lines 20
```

### Paso por paso:
```bash
# 1. Ir al directorio del proyecto
cd ~/kore-inventory

# 2. Hacer backup (opcional pero recomendado)
cp -r . ../kore-inventory-backup-$(date +%Y%m%d)

# 3. Traer cambios desde GitHub
git pull origin main

# 4. Ver qué archivos cambiaron
git log --oneline -5
git diff HEAD~1

# 5. Actualizar dependencias del backend
cd backend
npm install

# 6. Volver a raíz
cd ~/kore-inventory

# 7. Reiniciar backend
pm2 restart kore-backend

# 8. Ver logs
pm2 logs kore-backend --lines 30

# 9. Verificar estado
pm2 status
```

---

## 🔄 Gestión de PM2

### Ver Procesos
```bash
# Listar todos los procesos
pm2 list

# Ver estado detallado
pm2 status

# Ver información de un proceso
pm2 info kore-backend
```

### Reiniciar/Recargar
```bash
# Reiniciar el backend (con downtime)
pm2 restart kore-backend

# Recargar sin downtime (reload)
pm2 reload kore-backend

# Reiniciar todos los procesos
pm2 restart all

# Detener el backend
pm2 stop kore-backend

# Iniciar el backend (si está detenido)
pm2 start kore-backend
```

### Ver Logs
```bash
# Ver logs en tiempo real
pm2 logs kore-backend

# Ver últimas 50 líneas
pm2 logs kore-backend --lines 50

# Ver solo errores
pm2 logs kore-backend --err

# Ver logs y seguir actualizándolos
pm2 logs kore-backend --lines 100

# Limpiar logs viejos
pm2 flush
```

### Guardar Configuración
```bash
# Guardar configuración actual
pm2 save

# Configurar arranque automático
pm2 startup

# Resucitar procesos guardados
pm2 resurrect
```

### Monitoreo
```bash
# Monitor en tiempo real (CPU, RAM)
pm2 monit

# Ver métricas
pm2 describe kore-backend
```

---

## 📂 Gestión de Archivos

### Navegar
```bash
# Ir a directorio del proyecto
cd ~/kore-inventory

# Ver estructura de directorios
tree -L 2

# O con ls
ls -la

# Ver tamaño de directorios
du -sh *

# Buscar archivos
find . -name "*.js" -type f
```

### Ver/Editar Archivos
```bash
# Ver contenido de archivo
cat backend/src/server.ts

# Ver con paginación
less backend/src/server.ts

# Ver últimas líneas
tail -20 backend/src/app.ts

# Editar archivo
nano backend/src/app.ts
# O con vim
vim backend/src/app.ts
```

### Permisos
```bash
# Ver permisos
ls -la backend/

# Cambiar permisos (si es necesario)
chmod 755 backend/src/server.ts

# Cambiar dueño
sudo chown ubuntu:ubuntu -R backend/
```

---

## 📊 Git

### Ver Estado
```bash
# Estado actual
git status

# Ver ramas
git branch -a

# Ver último commit
git log --oneline -1

# Ver últimos 10 commits
git log --oneline -10

# Ver cambios sin commitear
git diff
```

### Actualizar Código
```bash
# Traer cambios
git pull origin main

# Si hay conflictos, ver archivos
git status

# Descartar cambios locales (CUIDADO)
git reset --hard HEAD

# Descartar un archivo específico
git checkout -- archivo.js
```

### Información del Repositorio
```bash
# Ver remotes
git remote -v

# Ver configuración
git config --list

# Ver información de commit específico
git show <commit-hash>
```

---

## 🗄️ Base de Datos MySQL (RDS)

### Conectar a Base de Datos
```bash
# Conectar a MySQL (necesitas host, user, password)
mysql -h tu-rds-endpoint.rds.amazonaws.com -u admin -p kore_inventory

# O si está en variables de entorno
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME
```

### Consultas Rápidas
```bash
# Desde línea de comandos (sin entrar a MySQL)
mysql -h host -u user -p -e "USE kore_inventory; SELECT COUNT(*) FROM productos;"

# Ver estructura de tabla
mysql -h host -u user -p -e "USE kore_inventory; DESC productos;"

# Hacer backup
mysqldump -h host -u user -p kore_inventory > backup_$(date +%Y%m%d).sql

# Restaurar backup
mysql -h host -u user -p kore_inventory < backup_20240211.sql
```

### Consultas Útiles (dentro de MySQL)
```sql
-- Ver productos con nuevos campos
USE kore_inventory;
SELECT id, nombre, precio_minorista, precio_mayorista, precio_distribuidor, aplica_iva 
FROM productos 
ORDER BY id DESC 
LIMIT 10;

-- Ver estructura de productos
DESC productos;

-- Contar productos por tipo
SELECT tipo, COUNT(*) as total 
FROM productos 
GROUP BY tipo;

-- Ver productos sin precio mayorista
SELECT nombre, precio_minorista 
FROM productos 
WHERE precio_mayorista IS NULL;

-- Ver bodegas
SELECT * FROM bodegas;

-- Salir de MySQL
EXIT;
```

---

## 🔍 Monitoreo del Sistema

### Recursos del Servidor
```bash
# Ver uso de CPU y RAM
top
# Presiona 'q' para salir

# O con htop (más visual)
htop

# Ver memoria
free -h

# Ver disco
df -h

# Ver procesos de Node.js
ps aux | grep node

# Ver puertos abiertos
sudo netstat -tulpn | grep LISTEN

# Ver puerto específico (ej: 3000)
sudo lsof -i :3000
```

### Logs del Sistema
```bash
# Ver logs de PM2
pm2 logs --lines 100

# Ver logs de sistema
sudo journalctl -xe

# Ver logs de nginx (si usas)
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Ver logs de aplicación (si guardas en archivo)
tail -f ~/kore-inventory/logs/app.log
```

---

## 🌐 Nginx (si lo usas como reverse proxy)

### Comandos Básicos
```bash
# Ver estado de nginx
sudo systemctl status nginx

# Reiniciar nginx
sudo systemctl restart nginx

# Recargar configuración
sudo systemctl reload nginx

# Verificar configuración
sudo nginx -t

# Ver configuración
sudo cat /etc/nginx/sites-available/default
```

---

## 🚨 Troubleshooting

### Backend no arranca
```bash
# Ver logs de error
pm2 logs kore-backend --err --lines 50

# Verificar que el puerto no esté ocupado
sudo lsof -i :3000

# Matar proceso en puerto (si es necesario)
sudo kill -9 $(sudo lsof -t -i:3000)

# Reiniciar PM2 completamente
pm2 kill
cd ~/kore-inventory/backend
pm2 start src/server.ts --name kore-backend --interpreter ts-node
pm2 save

# Ver variables de entorno
pm2 env 0
```

### Git pull falla
```bash
# Ver qué archivos tienen conflictos
git status

# Descartar cambios locales
git reset --hard HEAD
git pull origin main

# O guardar cambios temporalmente
git stash
git pull origin main
git stash pop
```

### Frontend no se actualiza
```bash
# Limpiar caché del navegador (Ctrl+Shift+R)

# Verificar que los archivos se actualizaron
ls -la frontend/public/assets/js/
stat frontend/public/assets/js/productos.js

# Ver última modificación
ls -lt frontend/public/assets/js/ | head
```

### Error 502 Bad Gateway
```bash
# Verificar que backend esté corriendo
pm2 status

# Reiniciar backend
pm2 restart kore-backend

# Reiniciar nginx
sudo systemctl restart nginx

# Ver logs
pm2 logs kore-backend --err
sudo tail -f /var/log/nginx/error.log
```

### Base de datos no conecta
```bash
# Verificar conexión
mysql -h tu-rds-endpoint -u admin -p -e "SELECT 1;"

# Ver variables de entorno del backend
cat ~/kore-inventory/backend/.env

# Verificar security groups en AWS Console
# - Debe permitir puerto 3306 desde IP de EC2
```

---

## 🔐 Seguridad

### Ver Logs de Acceso
```bash
# Ver últimos logins
last -10

# Ver intentos fallidos de login
sudo lastb -10

# Ver logs de autenticación
sudo tail -f /var/log/auth.log
```

### Firewall
```bash
# Ver estado de UFW
sudo ufw status

# Ver reglas
sudo ufw status numbered

# Permitir puerto (si es necesario)
sudo ufw allow 3000/tcp
```

---

## 📦 Node.js / NPM

### Gestión de Dependencias
```bash
# Ver versión de Node
node --version

# Ver versión de npm
npm --version

# Ver paquetes instalados
cd ~/kore-inventory/backend
npm list --depth=0

# Ver paquetes desactualizados
npm outdated

# Actualizar un paquete específico
npm update express

# Limpiar caché de npm
npm cache clean --force

# Reinstalar todo
rm -rf node_modules package-lock.json
npm install
```

---

## 🎯 Comandos Rápidos Favoritos

```bash
# Reinicio rápido después de cambios
pm2 restart kore-backend && pm2 logs kore-backend --lines 20

# Ver estado completo
pm2 status && free -h && df -h

# Deploy completo en una línea
cd ~/kore-inventory && git pull && cd backend && npm install && cd .. && pm2 restart kore-backend

# Ver últimos errores
pm2 logs kore-backend --err --lines 50

# Backup rápido de código
tar -czf ~/backup-kore-$(date +%Y%m%d-%H%M).tar.gz ~/kore-inventory

# Limpiar todo y arrancar fresco
pm2 kill && cd ~/kore-inventory/backend && rm -rf node_modules && npm install && pm2 start src/server.ts --name kore-backend --interpreter ts-node && pm2 save
```

---

## 📝 Notas Importantes

1. **Siempre hacer backup antes de cambios mayores**
   ```bash
   cp -r ~/kore-inventory ~/kore-inventory-backup-$(date +%Y%m%d)
   ```

2. **Ver logs después de cada deploy**
   ```bash
   pm2 logs kore-backend --lines 50
   ```

3. **Verificar que el backend responde**
   ```bash
   curl http://localhost:3000/api/health
   ```

4. **Si algo sale mal, revertir con git**
   ```bash
   git log --oneline -5
   git reset --hard <commit-anterior>
   pm2 restart kore-backend
   ```

5. **Mantener PM2 actualizado**
   ```bash
   npm install -g pm2@latest
   pm2 update
   ```

---

## 🆘 Contactos de Emergencia

- **AWS Console:** [tu-url-de-aws-console]
- **RDS Endpoint:** [tu-rds-endpoint.rds.amazonaws.com]
- **GitHub Repo:** [tu-repositorio]
- **Domain:** [tu-dominio.com]

---

## 📚 Referencias Rápidas

- PM2 Docs: https://pm2.keymetrics.io/docs/usage/quick-start/
- Node.js Docs: https://nodejs.org/docs/
- Git Cheatsheet: https://education.github.com/git-cheat-sheet-education.pdf
- MySQL Docs: https://dev.mysql.com/doc/

---

**Última actualización:** Febrero 11, 2026  
**Versión:** 1.0 - Sistema de Precios Múltiples
