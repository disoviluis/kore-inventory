-- Ejecutar manualmente en kore_inventory, despues de un respaldo completo.
-- No elimina usuarios, no reasigna historial, no reinicia pruebas existentes.
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS usuarios_seguridad (
  usuario_id INT NOT NULL PRIMARY KEY,
  estado ENUM('legado','invitado','verificado','suspendido') NOT NULL DEFAULT 'legado',
  email_verificado_at DATETIME NULL,
  correo_pendiente VARCHAR(100) NULL,
  version_sesion INT NOT NULL DEFAULT 1,
  mfa_secret TEXT NULL,
  mfa_pendiente TEXT NULL,
  mfa_ultimo_paso BIGINT NULL,
  mfa_obligatorio TINYINT(1) NOT NULL DEFAULT 0,
  actualizado_por INT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  UNIQUE KEY uq_seguridad_correo_pendiente (correo_pendiente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO usuarios_seguridad (usuario_id, estado)
SELECT id, 'legado' FROM usuarios;

CREATE TABLE IF NOT EXISTS auth_sesiones (
  id CHAR(36) NOT NULL PRIMARY KEY,
  usuario_id INT NOT NULL,
  version_sesion INT NOT NULL,
  csrf_hash CHAR(64) NOT NULL,
  expira_at DATETIME NOT NULL,
  revocada_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  INDEX idx_auth_sesion_usuario (usuario_id, expira_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS auth_desafios (
  id CHAR(36) NOT NULL PRIMARY KEY,
  usuario_id INT NOT NULL,
  tipo ENUM('invitacion','recuperacion') NOT NULL,
  email VARCHAR(254) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  codigo_hash CHAR(64) NOT NULL,
  expira_at DATETIME NOT NULL,
  codigo_expira_at DATETIME NOT NULL,
  intentos INT NOT NULL DEFAULT 0,
  envios INT NOT NULL DEFAULT 1,
  ultimo_envio_at DATETIME NOT NULL,
  consumido_at DATETIME NULL,
  creado_por INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  UNIQUE KEY uq_auth_token (token_hash),
  INDEX idx_auth_desafio_usuario (usuario_id, tipo, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS auth_limites (
  clave CHAR(64) NOT NULL PRIMARY KEY,
  inicio_at DATETIME NOT NULL,
  intentos INT NOT NULL DEFAULT 0,
  INDEX idx_auth_limite_fecha (inicio_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS auth_mfa_respaldo (
  usuario_id INT NOT NULL,
  codigo_hash CHAR(64) NOT NULL,
  usado_at DATETIME NULL,
  PRIMARY KEY (usuario_id, codigo_hash),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS licencias_avisos (
  empresa_id INT NOT NULL,
  usuario_id INT NOT NULL,
  vencimiento_at DATETIME NOT NULL,
  dias INT NOT NULL,
  estado ENUM('pendiente','enviado') NOT NULL DEFAULT 'pendiente',
  actualizado_at DATETIME NOT NULL,
  PRIMARY KEY (empresa_id, usuario_id, vencimiento_at, dias),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS documentos_legales (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('terminos','privacidad') NOT NULL,
  version VARCHAR(60) NOT NULL,
  titulo VARCHAR(150) NOT NULL,
  contenido MEDIUMTEXT NOT NULL,
  hash CHAR(64) NOT NULL,
  operador_nombre VARCHAR(200) NOT NULL,
  operador_nit VARCHAR(40) NOT NULL,
  operador_contacto VARCHAR(254) NOT NULL,
  publicado_at DATETIME NULL,
  creado_por INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_legal_version (tipo, version),
  FOREIGN KEY (creado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aceptaciones_legales (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  documento_id INT NOT NULL,
  empresa_id INT NULL,
  hash CHAR(64) NOT NULL,
  ip VARCHAR(45) NULL,
  agente VARCHAR(255) NULL,
  aceptado_at DATETIME NOT NULL,
  UNIQUE KEY uq_aceptacion_usuario_documento (usuario_id, documento_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (documento_id) REFERENCES documentos_legales(id),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS acceso_auditoria (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  actor_id INT NULL,
  accion VARCHAR(60) NOT NULL,
  datos JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  INDEX idx_acceso_auditoria_usuario (usuario_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS empresas_suscripcion (
  empresa_id INT NOT NULL PRIMARY KEY,
  trial_inicio_at DATETIME NULL,
  trial_fin_at DATETIME NULL,
  trial_utilizado TINYINT(1) NOT NULL DEFAULT 0,
  es_nueva TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO empresas_suscripcion
  (empresa_id, trial_inicio_at, trial_fin_at, trial_utilizado, es_nueva)
SELECT id, fecha_inicio_trial, DATE_ADD(fecha_fin_trial, INTERVAL 1 DAY),
       IF(fecha_inicio_trial IS NOT NULL OR fecha_fin_trial IS NOT NULL, 1, 0), 0
FROM empresas;

CREATE TABLE IF NOT EXISTS solicitudes_suscripcion (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  usuario_id INT NOT NULL,
  plan_id INT NOT NULL,
  periodicidad ENUM('mensual','anual') NOT NULL,
  meses INT NOT NULL DEFAULT 1,
  monto DECIMAL(10,2) NOT NULL,
  moneda CHAR(3) NOT NULL DEFAULT 'COP',
  estado ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente',
  referencia VARCHAR(100) NULL,
  observaciones VARCHAR(1000) NULL,
  confirmada_por INT NULL,
  confirmada_at DATETIME NULL,
  licencia_id INT NULL,
  documentos_aceptados JSON NOT NULL,
  aceptacion_ip VARCHAR(45) NULL,
  aceptacion_agente VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (plan_id) REFERENCES planes(id),
  FOREIGN KEY (licencia_id) REFERENCES licencias(id),
  INDEX idx_solicitud_empresa (empresa_id, estado),
  UNIQUE KEY uq_solicitud_referencia (referencia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS licencias_vigencias (
  licencia_id INT NOT NULL PRIMARY KEY,
  inicio_at DATETIME NOT NULL,
  fin_at DATETIME NOT NULL,
  FOREIGN KEY (licencia_id) REFERENCES licencias(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT estado, COUNT(*) AS usuarios FROM usuarios_seguridad GROUP BY estado;
SELECT COUNT(*) AS empresas_conservadas FROM empresas_suscripcion;
-- Las licencias y pagos historicos NO se alteran en esta migracion.
-- Ningun documento se publica ni se acepta en nombre de los usuarios.