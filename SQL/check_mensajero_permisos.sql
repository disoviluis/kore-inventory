-- Consultar permisos del rol Mensajero (ID: 15)
SELECT 
  r.id,
  r.nombre as rol_nombre,
  m.nombre_mostrar as modulo,
  a.nombre as accion
FROM roles r
INNER JOIN roles_permisos rp ON r.id = rp.rol_id
INNER JOIN modulos m ON rp.modulo_id = m.id
INNER JOIN acciones a ON rp.accion_id = a.id
WHERE r.id = 15
ORDER BY m.nombre_mostrar, a.nombre;
