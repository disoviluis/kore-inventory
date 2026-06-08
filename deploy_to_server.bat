@echo off
echo ========================================
echo   DESPLEGANDO AL SERVIDOR EC2
echo ========================================
echo.
echo Servidor: 18.191.181.99
echo Usuario: ubuntu
echo.

echo Conectando al servidor y desplegando cambios...

ssh -i "C:\Users\LUIS\Downloads\korekey.pem" ubuntu@18.191.181.99 "cd /home/ubuntu/kore-inventory && git pull origin main && cd backend && npm run build && cd .. && pm2 restart kore-backend && echo '✓ Backend reiniciado exitosamente' && pm2 logs kore-backend --lines 20 --nostream"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   DEPLOY COMPLETADO EXITOSAMENTE!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo   ERROR EN EL DEPLOY
    echo ========================================
)

pause
