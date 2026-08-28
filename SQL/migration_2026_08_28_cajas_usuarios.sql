-- Asignación de usuarios a cajas físicas.
-- No modifica turnos existentes ni elimina el fallback de caja principal.

CREATE TABLE IF NOT EXISTS usuario_caja (
  usuario_id INT NOT NULL,
  caja_id INT NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, caja_id),
  KEY idx_usuario_caja_caja (caja_id, activo),
  CONSTRAINT fk_usuario_caja_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_usuario_caja_caja FOREIGN KEY (caja_id) REFERENCES cajas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;