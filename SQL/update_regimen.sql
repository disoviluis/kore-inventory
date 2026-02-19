UPDATE empresas SET regimen_tributario = 'comun' WHERE id = 1;
SELECT id, nombre, regimen_tributario, gran_contribuyente, autoretenedor FROM empresas WHERE id = 1;
