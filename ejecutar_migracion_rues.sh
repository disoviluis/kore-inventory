#!/bin/bash
# Script para ejecutar migración RUES en RDS
# Ejecutar desde servidor EC2: bash ejecutar_migracion_rues.sh

echo "========================================="
echo "Migración: Campos RUES en Proveedores"
echo "========================================="
echo ""

# Ejecutar migración
mysql -h kore-inventory.cpifmq4gwbbf.us-east-2.rds.amazonaws.com \
      -u admin \
      -p \
      kore_inventory < SQL/migration_add_campos_rues_proveedores.sql

echo ""
echo "Migración ejecutada. Verificando campos..."
echo ""

# Verificar campos creados
mysql -h kore-inventory.cpifmq4gwbbf.us-east-2.rds.amazonaws.com \
      -u admin \
      -p \
      kore_inventory -e "
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    IS_NULLABLE 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'kore_inventory' 
AND TABLE_NAME = 'proveedores'
AND COLUMN_NAME IN (
    'representante_legal', 
    'tipo_sociedad', 
    'matricula_mercantil',
    'camara_comercio',
    'fecha_matricula',
    'actividad_economica',
    'departamento'
)
ORDER BY ORDINAL_POSITION;
"

echo ""
echo "¡Verificación completada!"
