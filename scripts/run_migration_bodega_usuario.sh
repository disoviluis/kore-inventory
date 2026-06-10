#!/bin/bash
DB_HOST=$(grep DB_HOST /home/ubuntu/kore-inventory/backend/.env | cut -d= -f2)
DB_USER=$(grep DB_USER /home/ubuntu/kore-inventory/backend/.env | cut -d= -f2)
DB_PASS=$(grep DB_PASSWORD /home/ubuntu/kore-inventory/backend/.env | cut -d= -f2)
DB_NAME=$(grep DB_NAME /home/ubuntu/kore-inventory/backend/.env | cut -d= -f2)

echo "Ejecutando migración: bodega_id en usuarios..."
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < /home/ubuntu/kore-inventory/SQL/migration_bodega_usuario.sql
echo "Migración completada."
