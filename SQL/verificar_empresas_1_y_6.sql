-- Verificar qué empresa está usando el usuario
SELECT id, nombre, nit, email, telefono, slogan, razon_social 
FROM empresas 
WHERE id IN (1, 6);
