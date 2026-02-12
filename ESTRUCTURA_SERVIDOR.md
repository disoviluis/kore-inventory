# 📁 ESTRUCTURA DEL SERVIDOR EC2

## ✅ CONFIGURACIÓN CORRECTA (NO CAMBIAR)

### 1️⃣ Repositorio Git (Código fuente)
```
/home/ubuntu/kore-inventory/
├── backend/
├── frontend/
│   └── public/
│       ├── *.html
│       └── assets/
│           ├── css/
│           └── js/
└── SQL/
```

**Aquí haces:** `git pull origin main`

---

### 2️⃣ Nginx (Servidor web)
```
Configuración: /etc/nginx/sites-available/kore
Apunta a: /var/www/kore/kore-inventory/frontend/public
```

**Esto es un SYMLINK a:** `/home/ubuntu/kore-inventory`

---

### 3️⃣ Backend (PM2)
```
Directorio: /home/ubuntu/kore-inventory/backend
Proceso: kore-backend (puerto 3000)
```

---

## 🚀 FLUJO DE TRABAJO CORRECTO

### En tu PC (Local):
```bash
# 1. Hacer cambios en el código
# 2. Probar localmente
# 3. Commit y push
git add .
git commit -m "Descripción del cambio"
git push origin main
```

### En el Servidor EC2:
```bash
# 1. Conectar por SSH
ssh -i korekey.pem ubuntu@18.191.181.99

# 2. Actualizar código
cd ~/kore-inventory
git pull origin main

# 3. Si cambiaste BACKEND:
cd backend
npm run build
pm2 restart kore-backend

# 4. Si cambiaste FRONTEND:
# No hace falta nada, el symlink ya apunta al repo actualizado
# Solo refresca el navegador: Ctrl + Shift + R
```

---

## ❌ NO HACER NUNCA

### ❌ NO copiar archivos manualmente
```bash
# ❌ INCORRECTO
sudo cp -r ~/kore-inventory/frontend/public/* /var/www/html/
sudo cp -r ~/kore-inventory/frontend/public/* /cualquier-otro-lugar/
```

### ❌ NO cambiar la configuración de nginx
```bash
# ❌ INCORRECTO
sudo nano /etc/nginx/sites-available/kore
# y cambiar el root
```

### ❌ NO crear múltiples copias del código
```bash
# ❌ INCORRECTO
git clone ... en otro directorio
```

---

## ✅ COMANDOS DE VERIFICACIÓN

### Ver estructura correcta:
```bash
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

**Última actualización:** 2026-02-12  
**Estructura verificada y funcionando:** ✅
