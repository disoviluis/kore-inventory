-- Permisos base para la matriz de roles de Comandas y Cocina
-- No asigna permisos a ningún rol; solo hace disponibles las casillas.

INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT m.id, a.id, CONCAT(m.nombre, '.', a.nombre), CONCAT(a.nombre_mostrar, ' ', m.nombre_mostrar), 1
FROM modulos m
CROSS JOIN acciones a
WHERE m.nombre IN ('comandas', 'cocina')
  AND a.activo = 1
  AND NOT EXISTS (
    SELECT 1 FROM permisos p
    WHERE p.modulo_id = m.id AND p.accion_id = a.id
  );
