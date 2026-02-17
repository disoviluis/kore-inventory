-- Verificar tipo de usuario
-- Ejecuta esto en MySQL para confirmar que tu usuario es super_admin

-- Ver TODOS los usuarios y sus tipos
SELECT 
    id,
    email,
    nombre,
    apellido,
    tipo_usuario,
    estado
FROM usuarios
ORDER BY tipo_usuario, id;

-- Si necesitas cambiar tu usuario a super_admin:
-- UPDATE usuarios SET tipo_usuario = 'super_admin' WHERE email = 'TU_EMAIL_AQUI';

-- Verificar el usuario específico (cambia el email):
-- SELECT * FROM usuarios WHERE email = 'admin@kore.com';
