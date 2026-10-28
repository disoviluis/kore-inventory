-- Datos fiscales y condiciones comerciales de clientes.
-- Ejecutar manualmente en la base autorizada antes de desplegar el backend.
-- No contiene secretos ni modifica datos existentes.

DELIMITER //

DROP PROCEDURE IF EXISTS add_clientes_column //

CREATE PROCEDURE add_clientes_column(IN column_definition VARCHAR(500))
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

CALL add_clientes_column('tipo_persona VARCHAR(20) NULL');
CALL add_clientes_column('regimen_tributario VARCHAR(50) NULL');
CALL add_clientes_column('responsabilidad_fiscal VARCHAR(200) NULL');
CALL add_clientes_column('actividad_economica VARCHAR(200) NULL');
CALL add_clientes_column('codigo_postal VARCHAR(10) NULL');
CALL add_clientes_column('dias_credito INT NOT NULL DEFAULT 0');
CALL add_clientes_column('forma_pago_predeterminada ENUM(''contado'',''credito'') NOT NULL DEFAULT ''contado''');

DROP PROCEDURE IF EXISTS add_clientes_column //

DELIMITER ;
