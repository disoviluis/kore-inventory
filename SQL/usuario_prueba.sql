-- =============================================
-- SCRIPT DE USUARIO DE PRUEBA
-- Kore Inventory - Disovi Soft
-- =============================================

-- Este usuario tiene password: "password"
-- Hash bcrypt generado con 10 rounds

USE kore_inventory;

-- Insertar usuario de prueba
INSERT INTO usuarios (
    nombre, 
    apellido, 
    email, 
    password, 
    tipo_usuario, 
    activo, 
    email_verificado,
    created_at
) VALUES (
    'Admin',
    'Test',
    'test@kore.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'super_admin',
    1,
    1,
    NOW()
);

-- =============================================
-- CREDENCIALES DE PRUEBA
-- =============================================
-- Email: test@kore.com
-- Password: password
-- =============================================

-- Verificar que se insertó correctamente
SELECT id, nombre, apellido, email, tipo_usuario, activo 
FROM usuarios 
WHERE email = 'test@kore.com';
