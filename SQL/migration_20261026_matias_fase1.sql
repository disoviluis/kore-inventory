-- MATIAS FASE 1 - Conexion Casa de Software
-- Ejecutar manualmente. No contiene secretos ni PAT reales.

CREATE TABLE IF NOT EXISTS matias_conexiones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  entorno ENUM('sandbox','produccion') NOT NULL DEFAULT 'sandbox',
  base_url VARCHAR(500) NOT NULL,
  matias_company_uuid VARCHAR(36) NULL,
  matias_company_id VARCHAR(100) NULL,
  nit VARCHAR(15) NULL,
  razon_social VARCHAR(200) NULL,
  pat_cifrado TEXT NULL,
  token_id VARCHAR(100) NULL,
  estado ENUM('no_configurado','sandbox_pendiente','configurado','ready_produccion','activo','suspendido','token_expirado','revocado','error') NOT NULL DEFAULT 'no_configurado',
  ultimo_uso_at DATETIME NULL,
  ultimo_prueba_at DATETIME NULL,
  expires_at DATETIME NULL,
  ultimo_error TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT NULL,
  updated_by INT NULL,
  disabled_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_matias_empresa_entorno (empresa_id, entorno),
  KEY idx_matias_company_uuid (matias_company_uuid),
  KEY idx_matias_estado (estado),
  CONSTRAINT fk_matias_conexion_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_matias_conexion_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_matias_conexion_updated_by FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS matias_servicios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  entorno ENUM('sandbox','produccion') NOT NULL DEFAULT 'sandbox',
  codigo VARCHAR(50) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  contratado TINYINT(1) NOT NULL DEFAULT 0,
  activo_local TINYINT(1) NOT NULL DEFAULT 0,
  activo_proveedor TINYINT(1) NULL,
  ultima_verificacion_at DATETIME NULL,
  datos_publicos JSON NULL,
  version_api VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_matias_servicio (empresa_id, entorno, codigo),
  KEY idx_matias_servicio_activo (empresa_id, entorno, activo_local),
  CONSTRAINT fk_matias_servicio_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS matias_eventos_auditoria (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  entorno ENUM('sandbox','produccion') NOT NULL,
  usuario_id INT NULL,
  accion VARCHAR(100) NOT NULL,
  resultado ENUM('ok','error') NOT NULL,
  referencia VARCHAR(100) NULL,
  detalle JSON NULL,
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_matias_evento_empresa_fecha (empresa_id, created_at),
  KEY idx_matias_evento_accion (accion, resultado),
  CONSTRAINT fk_matias_evento_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_matias_evento_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO matias_servicios (empresa_id, entorno, codigo, nombre)
SELECT e.id, ent.entorno, s.codigo, s.nombre
FROM empresas e
CROSS JOIN (
  SELECT 'sandbox' AS entorno UNION ALL
  SELECT 'produccion'
) ent
CROSS JOIN (
  SELECT 'factura_electronica' AS codigo, 'Factura electronica' AS nombre UNION ALL
  SELECT 'pos_electronico', 'POS electronico' UNION ALL
  SELECT 'nota_credito', 'Nota credito' UNION ALL
  SELECT 'nota_debito', 'Nota debito' UNION ALL
  SELECT 'documento_soporte', 'Documento soporte' UNION ALL
  SELECT 'nomina_electronica', 'Nomina electronica' UNION ALL
  SELECT 'radian', 'RADIAN y recepcion' UNION ALL
  SELECT 'envio_masivo', 'Envio masivo' UNION ALL
  SELECT 'webhooks', 'Webhooks'
) s;
