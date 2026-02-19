-- Cambiar ENUM para usar valores sin tilde
ALTER TABLE empresas MODIFY COLUMN regimen_tributario ENUM('simplificado', 'comun', 'especial') DEFAULT 'simplificado';

-- Actualizar EVEREST SA con régimen común
UPDATE empresas SET regimen_tributario = 'comun' WHERE id = 1;

-- Verificar
SELECT id, nombre, regimen_tributario, gran_contribuyente FROM empresas WHERE id = 1;
