@echo off
echo ========================================
echo   KORE INVENTORY - DEPLOY TO SERVER
echo ========================================
echo.

echo [1/3] Connecting to EC2 server...
plink -batch -i "C:\Users\Administrator\kore-key.ppk" ubuntu@ec2-18-220-22-35.us-east-2.compute.amazonaws.com "cd /home/ubuntu/kore-inventory && git pull && sudo cp frontend/public/assets/js/ventas.js /var/www/html/assets/js/ && sudo cp frontend/public/assets/js/configuracion-general.js /var/www/html/assets/js/ && sudo cp frontend/public/configuracion-general.html /var/www/html/ && echo 'Files deployed successfully'"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   DEPLOY COMPLETED SUCCESSFULLY!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo   DEPLOY FAILED - CHECK ERRORS ABOVE
    echo ========================================
)

pause
