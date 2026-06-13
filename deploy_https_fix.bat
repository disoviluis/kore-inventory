@echo off
echo ========================================
echo   DEPLOY COMPLETO - HTTPS FIX
echo ========================================
echo.
echo Este script va a:
echo 1. Hacer commit de los cambios en Git
echo 2. Push al repositorio
echo 3. Actualizar codigo en el servidor (git pull)
echo 4. Actualizar configuracion de nginx
echo 5. Reiniciar nginx
echo 6. Verificar que todo funcione
echo.
pause

REM ==========================================
REM PARTE 1: GIT LOCAL
REM ==========================================
echo.
echo [1/6] Haciendo commit de los cambios...
git add frontend/public/assets/js/*.js
git add frontend/public/index.html
git add kore-nginx-ssl.conf
git commit -m "fix: actualizar URLs del API para usar proxy reverso con HTTPS

- Cambiar todas las URLs del API de https://kinventoryservices.com/api a /api
- Configurar proxy reverso en nginx para /api/
- Soluciona error de Mixed Content (HTTPS llamando a HTTP)
- Ahora el frontend usa rutas relativas que funcionan con el proxy"

if %errorlevel% neq 0 (
    echo [ADVERTENCIA] No hay cambios para hacer commit o hubo un error
    echo Continuando de todas formas...
)

echo.
echo [2/6] Haciendo push a GitHub...
git push origin main

if %errorlevel% neq 0 (
    echo [ERROR] No se pudo hacer push
    pause
    exit /b 1
)
echo [OK] Push exitoso

REM ==========================================
REM PARTE 2: SERVIDOR - GIT PULL
REM ==========================================
echo.
echo [3/6] Actualizando codigo en el servidor...
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "cd /home/ubuntu/kore-inventory && git pull origin main"

if %errorlevel% neq 0 (
    echo [ERROR] No se pudo actualizar el codigo
    pause
    exit /b 1
)
echo [OK] Codigo actualizado

REM ==========================================
REM PARTE 3: ACTUALIZAR NGINX
REM ==========================================
echo.
echo [4/6] Actualizando configuracion de nginx...
echo Copiando archivo...
scp -i C:\Users\luis.rodriguez\Downloads\korekey.pem kore-nginx-ssl.conf ubuntu@18.191.181.99:/tmp/kore-nginx-ssl.conf

if %errorlevel% neq 0 (
    echo [ERROR] No se pudo copiar el archivo
    pause
    exit /b 1
)

echo Moviendo a /etc/nginx/sites-available/kore...
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "sudo mv /tmp/kore-nginx-ssl.conf /etc/nginx/sites-available/kore"

if %errorlevel% neq 0 (
    echo [ERROR] No se pudo mover el archivo
    pause
    exit /b 1
)
echo [OK] Configuracion actualizada

REM ==========================================
REM PARTE 4: VERIFICAR Y REINICIAR NGINX
REM ==========================================
echo.
echo [5/6] Verificando configuracion de nginx...
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "sudo nginx -t"

if %errorlevel% neq 0 (
    echo [ERROR] La configuracion de nginx tiene errores
    echo No se reiniciara nginx
    pause
    exit /b 1
)
echo [OK] Configuracion valida

echo.
echo Reiniciando nginx...
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "sudo systemctl reload nginx"

if %errorlevel% neq 0 (
    echo [ERROR] No se pudo reiniciar nginx
    pause
    exit /b 1
)
echo [OK] Nginx reiniciado

REM ==========================================
REM PARTE 5: VERIFICACION
REM ==========================================
echo.
echo [6/6] Verificando que todo funcione...
echo.
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "echo '=== Estado Nginx ===' && sudo systemctl status nginx | head -5 && echo '' && echo '=== Test API ===' && curl -s http://localhost/api/public/planes | head -10 && echo '' && echo '=== Estado Backend ===' && pm2 status"

echo.
echo ========================================
echo   DEPLOY COMPLETADO EXITOSAMENTE
echo ========================================
echo.
echo Los cambios han sido desplegados:
echo.
echo [FRONTEND]
echo - Todas las URLs del API ahora usan /api
echo - Compatible con HTTPS (sin Mixed Content)
echo.
echo [NGINX]
echo - Configurado proxy reverso para /api/
echo - Redirige peticiones a localhost:3000
echo.
echo PRUEBA LA APLICACION:
echo https://kinventoryservices.com/
echo.
echo Abre DevTools (F12) y verifica:
echo 1. Console: NO debe haber errores de Mixed Content
echo 2. Network: Peticiones a /api/ deben aparecer como 200 OK
echo.
pause
