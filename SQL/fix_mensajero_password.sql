USE kore_inventory;

-- Actualizar contraseña a "password" (en minúscula)
-- Este es el hash bcrypt válido para "password"
UPDATE usuarios 
SET password = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE email = 'mensajero.prueba@kore.com';

-- Verificar actualización
SELECT 
    id, 
    email, 
    nombre, 
    activo, 
    'Nueva contraseña: password (en minúsculas)' as nota
FROM usuarios
WHERE email = 'mensajero.prueba@kore.com';
