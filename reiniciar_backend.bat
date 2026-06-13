@echo off
echo ========================================
echo   REINICIAR BACKEND EN SERVIDOR
echo ========================================
echo.
echo Este script va a:
echo 1. Conectarse al servidor EC2
echo 2. Actualizar el codigo con git pull
echo 3. Compilar el backend
echo 4. Reiniciar el proceso PM2
echo 5. Mostrar los logs para verificar
echo.
echo Servidor: 18.191.181.99
echo Usuario: ubuntu
echo.
pause

echo.
echo [EJECUTANDO] Reinicio de backend...
echo.

ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "cd /home/ubuntu/kore-inventory && echo '[1/5] Actualizando codigo...' && git pull origin main && echo '' && echo '[2/5] Compilando backend...' && cd backend && npm run build && echo '' && echo '[3/5] Reiniciando PM2...' && pm2 restart kore-backend && echo '' && echo '[4/5] Esperando 5 segundos...' && sleep 5 && echo '' && echo '[5/5] Estado actual:' && pm2 status && echo '' && echo '=== LOGS (ultimas 30 lineas) ===' && pm2 logs kore-backend --lines 30 --nostream"

echo.
echo ========================================
echo Backend reiniciado
echo ========================================
echo.
echo Ahora prueba la aplicacion en:
echo http://18.191.181.99/
echo.
echo Si sigue sin funcionar, ejecuta: ver_logs_backend.bat
echo.
pause
