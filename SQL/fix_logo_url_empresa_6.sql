-- Actualizar logo URL a un servicio que funcione correctamente
UPDATE empresas 
SET logo_url = 'https://placehold.co/150x80/1E40AF/FFFFFF/png?text=EVEREST+SA'
WHERE id = 6;

-- Verificar
SELECT id, nombre, logo_url FROM empresas WHERE id = 6;
