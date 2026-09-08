-- =============================================================
-- Fase 9 - Estado de parametrizacion contable por empresa
-- =============================================================
-- AWS/RDS. Esta migracion no bloquea operaciones existentes.
-- Permite mostrar el asistente contable al administrador y conservar
-- la decision de continuar despues.

USE kore_inventory;

CREATE TABLE IF NOT EXISTS estado_parametrizacion_contable (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  estado ENUM('pendiente','en_configuracion','activa','omitida_temporalmente') NOT NULL DEFAULT 'pendiente',
  fecha_inicio_contable DATE NULL,
  fecha_corte_historico DATE NULL,
  perfil_operativo VARCHAR(40) NULL,
  contador_usuario_id INT NULL,
  omitida_at DATETIME NULL,
  activada_at DATETIME NULL,
  observaciones VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_estado_contable_empresa (empresa_id),
  KEY idx_estado_contable_estado (estado),
  CONSTRAINT fk_estado_contable_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_estado_contable_contador FOREIGN KEY (contador_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO estado_parametrizacion_contable
  (empresa_id, estado, fecha_inicio_contable, fecha_corte_historico, perfil_operativo, observaciones)
SELECT e.id, 'pendiente', '2026-09-01', '2026-08-31', cc.perfil_operativo,
       'Parametrizacion pendiente de confirmacion del administrador y contador'
FROM empresas e
LEFT JOIN configuracion_contable cc ON cc.empresa_id = e.id
WHERE e.id IN (29, 31, 32)
  AND NOT EXISTS (
    SELECT 1 FROM estado_parametrizacion_contable epc WHERE epc.empresa_id = e.id
  );

SELECT
  'fase9_parametrizacion' AS fase,
  COUNT(*) AS empresas_registradas,
  SUM(estado = 'pendiente') AS pendientes,
  SUM(estado = 'activa') AS activas,
  SUM(estado = 'omitida_temporalmente') AS omitidas_temporalmente,
  'NO_BLOQUEA_OPERACIONES_EXISTENTES' AS politica_actual
FROM estado_parametrizacion_contable
WHERE empresa_id IN (29, 31, 32);
