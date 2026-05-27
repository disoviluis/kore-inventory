USE kore_inventory;

SELECT 
    u.id,
    u.email, 
    u.nombre,
    u.apellido,
    u.activo,
    u.tipo_usuario,
    ue.empresa_id,
    e.nombre as empresa_nombre,
    ur.rol_id,
    r.nombre as rol_nombre
FROM usuarios u
LEFT JOIN usuario_empresa ue ON u.id = ue.usuario_id
LEFT JOIN empresas e ON ue.empresa_id = e.id
LEFT JOIN usuario_rol ur ON u.id = ur.usuario_id AND ur.empresa_id = ue.empresa_id
LEFT JOIN roles r ON ur.rol_id = r.id
WHERE u.email = 'mensajero.prueba@kore.com';
