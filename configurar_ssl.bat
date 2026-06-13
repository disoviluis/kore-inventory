@echo off
echo ========================================
echo   CONFIGURAR SSL EN NGINX
echo ========================================
echo.
echo Este script instalara SSL (HTTPS) en el servidor
echo usando Let's Encrypt (Certbot)
echo.
echo Dominios a configurar:
echo - kinventoryservices.com
echo - www.kinventoryservices.com
echo.
echo IMPORTANTE: Los dominios ya deben apuntar al servidor
echo IP: 18.191.181.99
echo.
pause

echo.
echo [EJECUTANDO] Configuracion SSL...
echo.

ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "sudo apt update && sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d kinventoryservices.com -d www.kinventoryservices.com --non-interactive --agree-tos --email admin@kinventoryservices.com --redirect && sudo systemctl reload nginx && echo '' && echo '=== VERIFICAR CONFIGURACION ===' && sudo nginx -t && echo '' && echo '=== ESTADO NGINX ===' && sudo systemctl status nginx --no-pager"

echo.
echo ========================================
echo SSL configurado exitosamente
echo ========================================
echo.
echo Ahora puedes acceder a:
echo - https://kinventoryservices.com ✅
echo - https://www.kinventoryservices.com ✅
echo.
echo El backend estara disponible en:
echo - https://kinventoryservices.com/api ✅
echo.
pause
