#!/bin/bash
# Script para verificar y actualizar usuario a super_admin

echo "=== Verificando usuario admin@kore.com ==="
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com -u admin -pKore2026! kore_inventory <<EOF
SELECT id, email, nombre, apellido, tipo_usuario
FROM usuarios 
WHERE email = 'admin@kore.com';
EOF

echo ""
echo "=== Actualizando a super_admin ==="
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com -u admin -pKore2026! kore_inventory <<EOF
UPDATE usuarios 
SET tipo_usuario = 'super_admin' 
WHERE email = 'admin@kore.com';

SELECT '✅ Usuario actualizado' as mensaje;
SELECT id, email, nombre, apellido, tipo_usuario
FROM usuarios 
WHERE email = 'admin@kore.com';
EOF
