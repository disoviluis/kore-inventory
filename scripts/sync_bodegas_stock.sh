#!/bin/bash
DB_PASS=$(grep DB_PASSWORD /home/ubuntu/kore-inventory/backend/.env | cut -d= -f2)
DB_NAME=$(grep DB_NAME /home/ubuntu/kore-inventory/backend/.env | cut -d= -f2)
DB_USER=$(grep DB_USER /home/ubuntu/kore-inventory/backend/.env | cut -d= -f2)
DB_HOST=$(grep DB_HOST /home/ubuntu/kore-inventory/backend/.env | cut -d= -f2)

echo "Base de datos: $DB_NAME en $DB_HOST"
echo "Ejecutando sincronización de stock a bodega principal..."

mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<SQL
INSERT INTO productos_bodegas (producto_id, bodega_id, stock_actual, stock_minimo, stock_maximo)
SELECT 
    p.id,
    b.id,
    p.stock_actual,
    p.stock_minimo,
    NULLIF(p.stock_maximo, 0)
FROM productos p
INNER JOIN bodegas b ON p.empresa_id = b.empresa_id AND b.es_principal = TRUE AND b.estado = 'activa'
WHERE p.estado = 'activo'
  AND p.maneja_inventario = TRUE
  AND NOT EXISTS (
      SELECT 1 FROM productos_bodegas pb 
      WHERE pb.producto_id = p.id AND pb.bodega_id = b.id
  );
SELECT CONCAT('Productos sincronizados: ', ROW_COUNT()) as resultado;
SELECT COUNT(*) as total_en_productos_bodegas FROM productos_bodegas;
SQL

echo "Listo."
