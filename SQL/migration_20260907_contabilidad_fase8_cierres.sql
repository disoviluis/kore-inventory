-- =============================================================
-- Fase 8 - Periodos y cierres contables
-- =============================================================
-- Requisitos: Fases 1 a 7 ejecutadas en AWS.
-- Ejecutar despues de backup. No crea periodos automaticamente ni
-- modifica comprobantes historicos.
-- =============================================================

USE kore_inventory;

CREATE TABLE IF NOT EXISTS periodos_contables (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  anio SMALLINT NOT NULL,
  mes TINYINT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  estado ENUM('abierto','reabierto','cerrado') NOT NULL DEFAULT 'abierto',
  cerrado_at DATETIME NULL,
  cerrado_por INT NULL,
  motivo_cierre VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_periodo_empresa_anio_mes (empresa_id, anio, mes),
  KEY idx_periodo_empresa_estado (empresa_id, estado),
  KEY idx_periodo_fechas (fecha_inicio, fecha_fin),
  CONSTRAINT fk_contable_periodo_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_contable_periodo_usuario FOREIGN KEY (cerrado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT chk_contable_periodo_mes CHECK (mes BETWEEN 1 AND 12),
  CONSTRAINT chk_contable_periodo_fechas CHECK (fecha_inicio <= fecha_fin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auditoria_reaperturas_contables (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  periodo_id INT NOT NULL,
  empresa_id INT NOT NULL,
  usuario_id INT NULL,
  motivo VARCHAR(255) NOT NULL,
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_reapertura_periodo (periodo_id),
  KEY idx_reapertura_empresa_fecha (empresa_id, creado_at),
  CONSTRAINT fk_reapertura_periodo FOREIGN KEY (periodo_id) REFERENCES periodos_contables(id) ON DELETE CASCADE,
  CONSTRAINT fk_reapertura_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_reapertura_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_abrir_periodo_contable$$
CREATE PROCEDURE sp_abrir_periodo_contable(
  IN p_empresa_id INT,
  IN p_anio SMALLINT,
  IN p_mes TINYINT,
  IN p_usuario_id INT
)
BEGIN
  DECLARE v_periodo_id INT DEFAULT NULL;
  DECLARE v_estado VARCHAR(20) DEFAULT NULL;
  DECLARE v_inicio DATE;
  DECLARE v_fin DATE;

  SET v_inicio = STR_TO_DATE(CONCAT(p_anio, '-', LPAD(p_mes, 2, '0'), '-01'), '%Y-%m-%d');
  SET v_fin = LAST_DAY(v_inicio);

  SELECT id, estado INTO v_periodo_id, v_estado
  FROM periodos_contables
  WHERE empresa_id = p_empresa_id AND anio = p_anio AND mes = p_mes;

  IF v_periodo_id IS NULL THEN
    INSERT INTO periodos_contables
      (empresa_id, anio, mes, fecha_inicio, fecha_fin, estado)
    VALUES
      (p_empresa_id, p_anio, p_mes, v_inicio, v_fin, 'abierto');
    SET v_periodo_id = LAST_INSERT_ID();
  ELSEIF v_estado = 'cerrado' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El periodo ya esta cerrado; debe reabrirse con motivo autorizado.';
  ELSE
    UPDATE periodos_contables
    SET estado = 'abierto', fecha_inicio = v_inicio, fecha_fin = v_fin
    WHERE id = v_periodo_id;
  END IF;

  SELECT v_periodo_id AS periodo_id, p_empresa_id AS empresa_id,
         p_anio AS anio, p_mes AS mes, 'ABIERTO' AS estado;
END$$

DROP PROCEDURE IF EXISTS sp_validar_periodo_contable$$
CREATE PROCEDURE sp_validar_periodo_contable(
  IN p_empresa_id INT,
  IN p_fecha DATE
)
BEGIN
  SELECT
    p_empresa_id AS empresa_id,
    p_fecha AS fecha,
    pc.id AS periodo_id,
    COALESCE(pc.estado, 'SIN_PERIODO') AS estado_periodo,
    CASE
      WHEN pc.id IS NULL THEN 'SIN_PERIODO'
      WHEN pc.estado IN ('abierto', 'reabierto') THEN 'PERMITIDO'
      ELSE 'BLOQUEADO'
    END AS resultado
  FROM (SELECT 1 AS existe) base
  LEFT JOIN periodos_contables pc
    ON pc.empresa_id = p_empresa_id
   AND p_fecha BETWEEN pc.fecha_inicio AND pc.fecha_fin;
END$$

DROP PROCEDURE IF EXISTS sp_cerrar_periodo_contable$$
CREATE PROCEDURE sp_cerrar_periodo_contable(
  IN p_periodo_id INT,
  IN p_usuario_id INT,
  IN p_motivo VARCHAR(255)
)
BEGIN
  DECLARE v_empresa_id INT DEFAULT NULL;
  DECLARE v_estado VARCHAR(20) DEFAULT NULL;
  DECLARE v_inicio DATE DEFAULT NULL;
  DECLARE v_fin DATE DEFAULT NULL;
  DECLARE v_desbalanceados INT DEFAULT 0;

  SELECT empresa_id, estado, fecha_inicio, fecha_fin
    INTO v_empresa_id, v_estado, v_inicio, v_fin
  FROM periodos_contables
  WHERE id = p_periodo_id;

  IF v_empresa_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El periodo contable no existe.';
  END IF;

  IF v_estado = 'cerrado' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El periodo contable ya esta cerrado.';
  END IF;

  SELECT COUNT(*) INTO v_desbalanceados
  FROM (
    SELECT c.id
    FROM comprobantes_contables c
    LEFT JOIN movimientos_contables m ON m.comprobante_id = c.id
    WHERE c.empresa_id = v_empresa_id
      AND c.estado = 'confirmado'
      AND c.fecha BETWEEN v_inicio AND v_fin
    GROUP BY c.id
    HAVING COALESCE(SUM(m.debito), 0.00) <> COALESCE(SUM(m.credito), 0.00)
  ) pendientes;

  IF v_desbalanceados > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No se puede cerrar el periodo: existen comprobantes desbalanceados.';
  END IF;

  UPDATE periodos_contables
  SET estado = 'cerrado', cerrado_at = NOW(), cerrado_por = p_usuario_id,
      motivo_cierre = p_motivo
  WHERE id = p_periodo_id;

  SELECT p_periodo_id AS periodo_id, v_empresa_id AS empresa_id,
         'CERRADO' AS estado, v_desbalanceados AS comprobantes_desbalanceados;
END$$

DROP PROCEDURE IF EXISTS sp_reabrir_periodo_contable$$
CREATE PROCEDURE sp_reabrir_periodo_contable(
  IN p_periodo_id INT,
  IN p_usuario_id INT,
  IN p_motivo VARCHAR(255)
)
BEGIN
  DECLARE v_empresa_id INT DEFAULT NULL;
  DECLARE v_estado VARCHAR(20) DEFAULT NULL;

  IF p_motivo IS NULL OR CHAR_LENGTH(TRIM(p_motivo)) < 10 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'La reapertura requiere un motivo de al menos 10 caracteres.';
  END IF;

  SELECT empresa_id, estado INTO v_empresa_id, v_estado
  FROM periodos_contables
  WHERE id = p_periodo_id;

  IF v_empresa_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El periodo contable no existe.';
  END IF;

  IF v_estado <> 'cerrado' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Solo se pueden reabrir periodos cerrados.';
  END IF;

  UPDATE periodos_contables
  SET estado = 'reabierto'
  WHERE id = p_periodo_id;

  INSERT INTO auditoria_reaperturas_contables
    (periodo_id, empresa_id, usuario_id, motivo)
  VALUES
    (p_periodo_id, v_empresa_id, p_usuario_id, p_motivo);

  SELECT p_periodo_id AS periodo_id, v_empresa_id AS empresa_id,
         'REABIERTO' AS estado;
END$$

DROP PROCEDURE IF EXISTS sp_exigir_periodo_abierto$$
CREATE PROCEDURE sp_exigir_periodo_abierto(
  IN p_empresa_id INT,
  IN p_fecha DATE
)
BEGIN
  IF EXISTS (
    SELECT 1 FROM periodos_contables pc
    WHERE pc.empresa_id = p_empresa_id
      AND p_fecha BETWEEN pc.fecha_inicio AND pc.fecha_fin
      AND pc.estado = 'cerrado'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No se puede confirmar un comprobante en un periodo cerrado.';
  END IF;
END$$

DELIMITER ;

SELECT
  'fase8' AS fase,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'periodos_contables') THEN 'OK' ELSE 'REVISAR' END AS tabla_periodos,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'auditoria_reaperturas_contables') THEN 'OK' ELSE 'REVISAR' END AS tabla_auditoria,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_cerrar_periodo_contable' AND routine_type = 'PROCEDURE') THEN 'OK' ELSE 'REVISAR' END AS procedimiento_cierre,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_name = 'sp_exigir_periodo_abierto' AND routine_type = 'PROCEDURE') THEN 'OK' ELSE 'REVISAR' END AS bloqueo_periodo,
  'PENDIENTE_VALIDACION_AWS' AS estado_ejecucion;
