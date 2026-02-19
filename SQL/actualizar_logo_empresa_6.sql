-- Actualizar logo de empresa con URL funcional
UPDATE empresas SET 
  logo_url = 'https://via.placeholder.com/150x80/1E40AF/FFFFFF?text=EVEREST+SA'
WHERE id = 6;

-- Verificar
SELECT id, nombre, logo_url FROM empresas WHERE id = 6;
