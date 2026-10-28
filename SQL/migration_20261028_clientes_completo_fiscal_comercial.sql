-- Completa la ficha fiscal y comercial de clientes.
-- Ejecutar manualmente en la base autorizada antes de desplegar el backend.
-- No contiene secretos ni modifica datos existentes.

DELIMITER //

DROP PROCEDURE IF EXISTS add_clientes_complete_column //

CREATE PROCEDURE add_clientes_complete_column(IN column_definition VARCHAR(500))
BEGIN
  SET @column_name = SUBSTRING_INDEX(column_definition, ' ', 1);
  SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'clientes'
      AND COLUMN_NAME = @column_name
  );

  IF @column_exists = 0 THEN
    SET @sql = CONCAT('ALTER TABLE clientes ADD COLUMN ', column_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //

CALL add_clientes_complete_column('nombre_comercial VARCHAR(300) NULL');
CALL add_clientes_complete_column('lista_precio VARCHAR(100) NOT NULL DEFAULT ''General''');
CALL add_clientes_complete_column('aplica_retencion_fuente TINYINT(1) NOT NULL DEFAULT 0');
CALL add_clientes_complete_column('tasa_retencion_fuente DECIMAL(5,2) NOT NULL DEFAULT 0');
CALL add_clientes_complete_column('aplica_retencion_iva TINYINT(1) NOT NULL DEFAULT 0');
CALL add_clientes_complete_column('tasa_retencion_iva DECIMAL(5,2) NOT NULL DEFAULT 0');
CALL add_clientes_complete_column('aplica_ica TINYINT(1) NOT NULL DEFAULT 0');
CALL add_clientes_complete_column('tasa_ica DECIMAL(5,3) NOT NULL DEFAULT 0');

DROP PROCEDURE IF EXISTS add_clientes_complete_column //

DELIMITER ;
