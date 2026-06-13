@echo off
echo ========================================
echo   DIAGNOSTICO DE CONEXION BACKEND
echo ========================================
echo.

REM Verificar conectividad con el servidor
echo [1/5] Verificando conectividad con el servidor...
ping -n 2 18.191.181.99 > nul
if %errorlevel% neq 0 (
    echo [ERROR] No se puede alcanzar el servidor 18.191.181.99
    echo Posibles causas:
    echo - El servidor EC2 esta apagado
    echo - Tu conexion a internet tiene problemas
    echo - El Security Group de AWS bloquea tu IP
    pause
    exit /b 1
)
echo [OK] Servidor alcanzable

echo.
echo [2/5] Verificando conectividad HTTP al puerto 3000...
curl -s --connect-timeout 5 http://18.191.181.99:3000/api/ventas > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] El backend no responde en el puerto 3000
    echo El servidor esta activo pero el backend no esta corriendo
) else (
    echo [OK] Backend responde correctamente
    echo.
    echo No hay problema de conexion. El error puede ser:
    echo - Configuracion incorrecta en el frontend
    echo - CORS bloqueado
    echo - URL incorrecta en las peticiones
    pause
    exit /b 0
)

echo.
echo [3/5] El backend NO responde. Conectando por SSH para diagnosticar...
echo.
pause
echo Presiona cualquier tecla para conectar al servidor...

REM Conectar por SSH y ejecutar diagnostico
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "cd /home/ubuntu/kore-inventory && echo '=== Estado PM2 ===' && pm2 status && echo '' && echo '=== Ultimas lineas de log ===' && pm2 logs kore-backend --lines 20 --nostream"

echo.
echo ========================================
echo Diagnostico completado
echo ========================================
pause
