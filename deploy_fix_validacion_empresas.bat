@echo off
echo ========================================
echo   DEPLOY FIX VALIDACION EMPRESAS
echo ========================================
echo.
echo Archivos a desplegar:
echo   - backend/src/platform/super-admin/empresas-admin.controller.ts
echo   - frontend/public/assets/js/dashboard.js
echo   - frontend/public/dashboard.html
echo.

echo [1/4] Compilando backend TypeScript...
cd backend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Fallo la compilacion del backend
    pause
    exit /b 1
)
cd ..

echo.
echo [2/4] Haciendo commit de cambios...
git add backend/src/platform/super-admin/empresas-admin.controller.ts
git add frontend/public/assets/js/dashboard.js
git add frontend/public/dashboard.html
git commit -m "Fix: Agregar validacion frontend/backend para creacion de empresas"

echo.
echo [3/4] Subiendo cambios a GitHub...
git push origin main

echo.
echo [4/4] Desplegando en servidor EC2...
plink -batch -i "C:\Users\Administrator\kore-key.ppk" ubuntu@ec2-18-220-22-35.us-east-2.compute.amazonaws.com "cd /home/ubuntu/kore-inventory && git pull origin main && cd backend && npm install && cd .. && sudo cp frontend/public/assets/js/dashboard.js /var/www/html/assets/js/ && sudo cp frontend/public/dashboard.html /var/www/html/ && pm2 restart kore-backend && echo '✓ Backend reiniciado' && pm2 logs kore-backend --lines 20"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   DEPLOY COMPLETADO EXITOSAMENTE!
    echo ========================================
    echo.
    echo Cambios desplegados:
    echo   ✓ Validacion frontend de campos requeridos
    echo   ✓ Validacion backend con mensajes claros
    echo   ✓ Feedback visual en formulario
    echo.
) else (
    echo.
    echo ========================================
    echo   DEPLOY FALLIDO - REVISAR ERRORES
    echo ========================================
)

pause
