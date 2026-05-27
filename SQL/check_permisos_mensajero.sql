USE kore_inventory;

-- Ver permisos del rol Mensajero
SELECT 
    r.nombre as rol,
    m.nombre as modulo,
    a.nombre as accion,
    rp.permiso_id
FROM roles r
INNER JOIN rol_permiso rp ON r.id = rp.rol_id
INNER JOIN permisos p ON rp.permiso_id = p.id
INNER JOIN modulos m ON p.modulo_id = m.id
LEFT JOIN acciones a ON p.accion_id = a.id
WHERE r.id = 15
ORDER BY m.nombre, a.nombre;

-- Contar módulos únicos permitidos
SELECT 
    'Total módulos permitidos:' as resumen,
    COUNT(DISTINCT m.id) as cantidad
FROM roles r
INNER JOIN rol_permiso rp ON r.id = rp.rol_id
INNER JOIN permisos p ON rp.permiso_id = p.id
INNER JOIN modulos m ON p.modulo_id = m.id
WHERE r.id = 15;

-- Ver módulos permitidos
SELECT DISTINCT
    m.id,
    m.nombre,
    m.categoria
FROM roles r
INNER JOIN rol_permiso rp ON r.id = rp.rol_id
INNER JOIN permisos p ON rp.permiso_id = p.id
INNER JOIN modulos m ON p.modulo_id = m.id
WHERE r.id = 15
ORDER BY m.categoria, m.nombre;
