#!/bin/bash

# ================================================================
# SCRIPT CRON - Verificación Diaria de Licencias
# ================================================================
# Ejecutar diariamente a la 1:00 AM
# Crontab: 0 1 * * * /home/ubuntu/kore-inventory/scripts/cron_verificacion_licencias.sh >> /var/log/kore/cron_licencias.log 2>&1
# ================================================================

set -e  # Salir si hay error

# Variables de entorno (cargar desde .env si existe)
ENV_FILE="/home/ubuntu/kore-inventory/backend/.env"
if [ -f "$ENV_FILE" ]; then
    export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
fi

# Configuración
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-admin}"
DB_PASSWORD="${DB_PASSWORD}"
DB_NAME="${DB_NAME:-kore_inventory}"
SQL_SCRIPT="/home/ubuntu/kore-inventory/SQL/verificacion_diaria_licencias.sql"
LOG_DIR="/var/log/kore"
BACKEND_DIR="/home/ubuntu/kore-inventory/backend"

# Crear directorio de logs si no existe
mkdir -p "$LOG_DIR"

echo "========================================"
echo "VERIFICACIÓN DIARIA DE LICENCIAS"
echo "Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# 1. Ejecutar script SQL de verificación
echo "[1/4] Ejecutando verificación SQL..."
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$SQL_SCRIPT"

if [ $? -eq 0 ]; then
    echo "✓ Verificación SQL completada"
else
    echo "✗ Error en verificación SQL"
    exit 1
fi

# 2. Procesar notificaciones de vencimiento
echo "[2/4] Procesando notificaciones..."
if [ -f "/tmp/notificaciones_vencimiento.json" ]; then
    # Llamar a endpoint del backend para procesar notificaciones
    curl -X POST "http://localhost:3000/api/licencias/procesar-notificaciones" \
         -H "Content-Type: application/json" \
         -H "X-Cron-Secret: ${CRON_SECRET}" \
         -d @/tmp/notificaciones_vencimiento.json \
         --silent --show-error
    
    echo "✓ Notificaciones procesadas"
    rm -f /tmp/notificaciones_vencimiento.json
else
    echo "  No hay notificaciones pendientes"
fi

# 3. Procesar renovaciones automáticas
echo "[3/4] Procesando renovaciones automáticas..."
if [ -f "/tmp/renovaciones_pendientes.json" ]; then
    # Llamar a endpoint del backend para procesar renovaciones
    curl -X POST "http://localhost:3000/api/licencias/procesar-renovaciones" \
         -H "Content-Type: application/json" \
         -H "X-Cron-Secret: ${CRON_SECRET}" \
         -d @/tmp/renovaciones_pendientes.json \
         --silent --show-error
    
    echo "✓ Renovaciones procesadas"
    rm -f /tmp/renovaciones_pendientes.json
else
    echo "  No hay renovaciones pendientes"
fi

# 4. Generar reporte
echo "[4/4] Generando reporte diario..."
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
SELECT 
  CURDATE() as fecha,
  (SELECT COUNT(*) FROM licencias WHERE estado = 'vencida') as licencias_vencidas_total,
  (SELECT COUNT(*) FROM empresas WHERE estado = 'suspendida') as empresas_suspendidas_total,
  (SELECT COUNT(*) FROM licencias WHERE estado = 'activa' AND DATEDIFF(fecha_fin, CURDATE()) <= 7) as por_vencer_7dias,
  (SELECT COUNT(*) FROM empresas WHERE estado = 'trial') as en_trial,
  (SELECT COUNT(*) FROM licencias WHERE estado = 'activa') as licencias_activas
FROM dual;
"

echo "========================================"
echo "✓ Verificación completada exitosamente"
echo "========================================"

exit 0
