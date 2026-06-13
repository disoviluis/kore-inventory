@echo off
echo ========================================
echo   ESTADO COMPLETO DEL SERVIDOR
echo ========================================
echo.

ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "echo '=== ESTADO PM2 ===' && pm2 status && echo '' && echo '=== USO DE CPU Y MEMORIA ===' && pm2 monit --no-daemon --iterations 1 2>/dev/null || top -bn1 | head -20 && echo '' && echo '=== ESPACIO EN DISCO ===' && df -h && echo '' && echo '=== COMMIT ACTUAL ===' && cd /home/ubuntu/kore-inventory && git log --oneline -5 && echo '' && echo '=== PUERTO 3000 ===' && netstat -tuln | grep :3000 || ss -tuln | grep :3000"

echo.
pause
