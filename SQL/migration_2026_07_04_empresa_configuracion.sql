-- Migración: Crear tabla empresa_configuracion para página pública
-- Fecha: 2026-07-04
-- Descripción: Almacena configuración key-value por empresa (slug, plantilla, redes, etc.)

CREATE TABLE IF NOT EXISTS empresa_configuracion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  clave VARCHAR(100) NOT NULL,
  valor TEXT,
  tipo ENUM('texto','numero','boolean','json','fecha') DEFAULT 'texto',
  categoria VARCHAR(50),
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_empresa_clave (empresa_id, clave),
  CONSTRAINT fk_empresa_conf FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);
