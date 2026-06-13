@echo off
echo ========================================
echo   VER LOGS DEL BACKEND EN TIEMPO REAL
echo ========================================
echo.
echo Este script mostrara los logs del backend
echo Presiona Ctrl+C para salir
echo.
pause

ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99 "pm2 logs kore-backend"
