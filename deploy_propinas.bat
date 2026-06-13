@echo off
REM ================================================================
REM Script de Deploy: Funcionalidad de Propinas en POS
REM ================================================================
REM Fecha: 2026-06-13
REM Descripción: Despliega la funcionalidad de propinas al servidor
REM ================================================================

echo.
echo ================================================================
echo   DEPLOY: FUNCIONALIDAD DE PROPINAS EN POS
echo ================================================================
echo.

REM ===== PASO 1: Confirmar Deploy =====
echo [PASO 1/6] Confirmando deploy...
echo.
echo Este script va a:
echo   1. Ejecutar migracion SQL para agregar campos de propina
echo   2. Hacer commit y push de los cambios
echo   3. Actualizar codigo en servidor
echo   4. Reiniciar backend
echo.
set /p confirm="Deseas continuar? (S/N): "
if /i not "%confirm%"=="S" (
    echo.
    echo Deploy cancelado.
    pause
    exit /b
)

REM ===== PASO 2: Ejecutar Migración SQL en Servidor =====
echo.
echo [PASO 2/6] Ejecutando migracion SQL en servidor...
echo.
echo Necesitas las credenciales de RDS (Amazon Database)
echo.
set /p rds_host="Ingresa RDS HOST: "
set /p db_user="Ingresa DB USER: "
set /p db_pass="Ingresa DB PASSWORD: "

echo.
echo Conectando a base de datos...
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "mysql -h %rds_host% -u %db_user% -p%db_pass% kore_inventory < /home/ubuntu/kore-inventory/SQL/migration_2026_06_13_agregar_propina_ventas.sql"

if errorlevel 1 (
    echo.
    echo ERROR: Fallo la ejecucion de la migracion SQL
    echo Verifica la conexion al servidor y los datos de RDS
    pause
    exit /b 1
)

echo.
echo ✓ Migracion SQL ejecutada correctamente
timeout /t 2 >nul

REM ===== PASO 3: Git Add, Commit, Push =====
echo.
echo [PASO 3/6] Haciendo commit de cambios...
echo.

git add .
git commit -m "feat: agregar funcionalidad de propinas en POS - Checkbox de propina voluntaria - Calculo automatico sobre neto - Correccion de descuentos - Actualizacion de plantillas de impresion - Migracion SQL para campos de propina"

if errorlevel 1 (
    echo.
    echo ADVERTENCIA: No hubo cambios para commitear o fallo el commit
    echo Continuando con el deploy...
)

echo.
echo Haciendo push a GitHub...
git push origin main

if errorlevel 1 (
    echo.
    echo ERROR: Fallo el push a GitHub
    pause
    exit /b 1
)

echo.
echo ✓ Cambios enviados a GitHub
timeout /t 2 >nul

REM ===== PASO 4: Actualizar Código en Servidor =====
echo.
echo [PASO 4/6] Actualizando codigo en servidor...
echo.

ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "cd /home/ubuntu/kore-inventory && git pull origin main"

if errorlevel 1 (
    echo.
    echo ERROR: Fallo la actualizacion del codigo en servidor
    pause
    exit /b 1
)

echo.
echo ✓ Codigo actualizado en servidor
timeout /t 2 >nul

REM ===== PASO 5: Compilar Backend =====
echo.
echo [PASO 5/6] Compilando backend...
echo.

ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "cd /home/ubuntu/kore-inventory/backend && npm run build"

if errorlevel 1 (
    echo.
    echo ERROR: Fallo la compilacion del backend
    pause
    exit /b 1
)

echo.
echo ✓ Backend compilado correctamente
timeout /t 2 >nul

REM ===== PASO 6: Reiniciar Backend con PM2 =====
echo.
echo [PASO 6/6] Reiniciando backend...
echo.

ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "pm2 restart kore-backend"

if errorlevel 1 (
    echo.
    echo ERROR: Fallo el reinicio del backend
    pause
    exit /b 1
)

echo.
echo ✓ Backend reiniciado correctamente
timeout /t 2 >nul

REM ===== RESUMEN =====
echo.
echo ================================================================
echo   DEPLOY COMPLETADO EXITOSAMENTE
echo ================================================================
echo.
echo Cambios desplegados:
echo   ✓ Migracion SQL ejecutada (4 nuevos campos)
echo   ✓ Frontend actualizado (UI de propinas)
echo   ✓ Backend actualizado (soporte de propinas)
echo   ✓ Plantilla de impresion actualizada
echo.
echo Siguiente paso:
echo   - Abrir https://kinventoryservices.com/ventas.html
echo   - Probar funcionalidad de propinas
echo   - Verificar impresion de factura
echo.
echo Documentacion: FUNCIONALIDAD_PROPINAS_POS.md
echo.
echo ================================================================
echo.
pause
