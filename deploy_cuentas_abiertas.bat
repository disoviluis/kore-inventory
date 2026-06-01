@echo off
echo =============================================
echo DEPLOY SISTEMA CUENTAS ABIERTAS
echo Fecha: %date% %time%
echo =============================================
echo.

REM Ir al directorio del proyecto
cd /d C:\xampp\htdocs\kore-inventory

echo [1/5] Agregando archivos al repositorio...
git add .

echo.
echo [2/5] Haciendo commit...
git commit -m "feat: Sistema de cuentas abiertas (tabs) para POS - Implementacion completa

- SQL: Tablas cuentas_abiertas, cuenta_abierta_detalle
- Backend: Controller y routes para cuentas abiertas
- Frontend: UI hibrida en ventas.html
- JS: Funciones completas para manejo de cuentas
- Permite abrir cuenta, agregar items, ver total, cerrar y cobrar
- Modo dual: venta directa + cuentas abiertas
"

if errorlevel 1 (
    echo ERROR: Fallo al hacer commit
    pause
    exit /b 1
)

echo.
echo [3/5] Subiendo cambios a GitHub...
git push origin main

if errorlevel 1 (
    echo ERROR: Fallo al hacer push
    pause
    exit /b 1
)

echo.
echo [4/5] Conectando al servidor...
echo.
echo INSTRUCCIONES PARA DESPLEGAR EN SERVIDOR:
echo.
echo 1. Conectate al servidor EC2:
echo    ssh -i "tu-llave.pem" ubuntu@18.191.181.99
echo.
echo 2. Ve al directorio del proyecto:
echo    cd ~/kore-inventory
echo.
echo 3. Haz pull de los cambios:
echo    git pull origin main
echo.
echo 4. Ejecuta el script de despliegue:
echo    bash scripts/deploy_cuentas_abiertas.sh
echo.
echo ALTERNATIVA: Ejecutar comandos manualmente:
echo.
echo    # Ejecutar migracion SQL
echo    mysql -h database-1.ch0kypvzovnu.us-east-2.rds.amazonaws.com -u adminUser -p'Siempre4*' kore_inventory ^< SQL/migration_cuentas_abiertas.sql
echo.
echo    # Compilar backend
echo    cd backend ^&^& npm install ^&^& npm run build ^&^& cd ..
echo.
echo    # Reiniciar PM2
echo    pm2 restart kore-backend
echo.
echo    # Ver logs
echo    pm2 logs kore-backend --lines 30
echo.
echo =============================================
echo [5/5] GIT PUSH COMPLETADO
echo =============================================
echo.
echo Cambios subidos a GitHub exitosamente!
echo Ahora debes ejecutar los comandos en el servidor.
echo.
pause
