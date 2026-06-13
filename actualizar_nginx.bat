@echo off
echo ========================================
echo   ACTUALIZAR CONFIGURACION NGINX
echo ========================================
echo.
echo Este script va a:
echo 1. Copiar kore-nginx-ssl.conf al servidor
echo 2. Actualizar la configuracion de nginx
echo 3. Verificar que la configuracion es valida
echo 4. Reiniciar nginx
echo.
echo Servidor: 18.191.181.99
echo Usuario: ubuntu
echo.
pause

echo.
echo [1/4] Copiando archivo de configuracion al servidor...
scp -i C:\Users\luis.rodriguez\Downloads\korekey.pem kore-nginx-ssl.conf ubuntu@18.191.181.99:/tmp/kore-nginx-ssl.conf

if %errorlevel% neq 0 (
    echo [ERROR] No se pudo copiar el archivo
    pause
    exit /b 1
)
echo [OK] Archivo copiado

echo.
echo [2/4] Actualizando configuracion de nginx en el servidor...
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "sudo mv /tmp/kore-nginx-ssl.conf /etc/nginx/sites-available/kore && echo 'Configuracion actualizada'"

if %errorlevel% neq 0 (
    echo [ERROR] No se pudo mover el archivo
    pause
    exit /b 1
)

echo.
echo [3/4] Verificando que la configuracion es valida...
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "sudo nginx -t"

if %errorlevel% neq 0 (
    echo [ERROR] La configuracion de nginx tiene errores
    echo No se reiniciara nginx para evitar problemas
    pause
    exit /b 1
)
echo [OK] Configuracion valida

echo.
echo [4/4] Reiniciando nginx...
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "sudo systemctl reload nginx && echo 'Nginx reiniciado exitosamente'"

if %errorlevel% neq 0 (
    echo [ERROR] No se pudo reiniciar nginx
    pause
    exit /b 1
)

echo.
echo ========================================
echo   ACTUALIZACION COMPLETADA
echo ========================================
echo.
echo Nginx ha sido actualizado con la configuracion del proxy reverso.
echo.
echo Ahora las peticiones a /api/ se redirigiran al backend en localhost:3000
echo.
echo Prueba la aplicacion en:
echo https://kinventoryservices.com/
echo.
pause
