-- Script de prueba para verificar auto-creación de bodega principal
-- Este script se ejecutará en el servidor

-- Verificar usuario super admin
SELECT id, nombre, email 
FROM usuarios 
WHERE email = 'admin@kore.com';

-- Verificar tablas de bodegas
SHOW TABLES LIKE 'bodegas';
SHOW TABLES LIKE 'productos_bodegas';
SHOW TABLES LIKE 'traslados';

-- Ver estructura de bodegas
DESCRIBE bodegas;

-- Ver si hay bodegas existentes
SELECT * FROM bodegas;

-- Ver si hay empresas existentes
SELECT id, nombre, nit, estado FROM empresas;
