-- ============================================================
-- MIGRACIÓN: Tabla usuarios_bodegas (multi-bodega por usuario)
-- Permite asignar varias bodegas a un mismo usuario
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios_bodegas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id    INT NOT NULL,
  empresa_id    INT NOT NULL,
  bodega_id     INT NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_usuario_empresa_bodega (usuario_id, empresa_id, bodega_id),
  KEY idx_ub_usuario  (usuario_id),
  KEY idx_ub_empresa  (empresa_id),
  KEY idx_ub_bodega   (bodega_id),

  CONSTRAINT fk_ub_usuario  FOREIGN KEY (usuario_id)  REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_ub_empresa  FOREIGN KEY (empresa_id)  REFERENCES empresas (id) ON DELETE CASCADE,
  CONSTRAINT fk_ub_bodega   FOREIGN KEY (bodega_id)   REFERENCES bodegas  (id) ON DELETE CASCADE
);

-- Migrar las asignaciones únicas que ya existen en la columna bodega_id de usuarios
INSERT IGNORE INTO usuarios_bodegas (usuario_id, empresa_id, bodega_id)
SELECT u.id, ue.empresa_id, u.bodega_id
FROM usuarios u
INNER JOIN usuario_empresa ue ON ue.usuario_id = u.id AND ue.activo = 1
WHERE u.bodega_id IS NOT NULL;
