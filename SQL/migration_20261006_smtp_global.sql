-- Ejecutar manualmente en kore_inventory. Aditivo; no guarda credenciales iniciales.
CREATE TABLE IF NOT EXISTS auth_smtp_configuracion (
  id TINYINT NOT NULL PRIMARY KEY,
  host VARCHAR(253) NOT NULL,
  port INT NOT NULL,
  seguridad ENUM('starttls','tls') NOT NULL,
  usuario VARCHAR(254) NOT NULL,
  secreto_cifrado TEXT NOT NULL,
  remitente_email VARCHAR(254) NOT NULL,
  remitente_nombre VARCHAR(100) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  version INT NOT NULL DEFAULT 1,
  actualizado_por INT NOT NULL,
  ultima_prueba_at DATETIME NULL,
  ultima_prueba_estado ENUM('pendiente','exitoso','fallido') NOT NULL DEFAULT 'pendiente',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (actualizado_por) REFERENCES usuarios(id),
  CONSTRAINT chk_auth_smtp_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;