@echo off
echo ========================================
echo   FIX COMPLETO DEL BACKEND
echo ========================================
echo.
echo Este script ejecutara una reparacion completa:
echo 1. Detener el proceso actual
echo 2. Actualizar codigo
echo 3. Reinstalar dependencias
echo 4. Limpiar cache de build
echo 5. Compilar desde cero
echo 6. Reiniciar PM2
echo 7. Verificar estado
echo.
echo [ADVERTENCIA] Esto causara ~30 segundos de downtime
echo.
pause

echo.
echo [EJECUTANDO] Fix completo del backend...
echo.

ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "cd /home/ubuntu/kore-inventory && echo '[1/7] Deteniendo backend...' && pm2 stop kore-backend && echo '' && echo '[2/7] Actualizando codigo...' && git pull origin main && echo '' && echo '[3/7] Reinstalando dependencias...' && cd backend && npm install && echo '' && echo '[4/7] Limpiando build anterior...' && rm -rf dist && echo '' && echo '[5/7] Compilando desde cero...' && npm run build && echo '' && echo '[6/7] Reiniciando PM2...' && pm2 restart kore-backend && echo '' && echo '[7/7] Verificando estado...' && sleep 5 && pm2 status && echo '' && echo '=== LOGS ===' && pm2 logs kore-backend --lines 30 --nostream && echo '' && echo '=== TEST API ===' && curl -s http://localhost:3000/api/ventas | head -10"

echo.
echo ========================================
echo Fix completo ejecutado
echo ========================================
echo.
pause
