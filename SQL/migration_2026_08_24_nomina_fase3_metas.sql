-- Nomina Fase 3: metas y bonos por cumplimiento
-- Compatible con AWS RDS: no usa triggers ni eventos.

CREATE TABLE IF NOT EXISTS metas_nomina (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  empleado_id INT NOT NULL,
  periodo_id INT NOT NULL,
  tipo ENUM('ventas','margen','facturas','unidades') NOT NULL DEFAULT 'ventas',
  meta_valor DECIMAL(15,2) NOT NULL,
  bono_tipo ENUM('valor','porcentaje') NOT NULL DEFAULT 'valor',
  bono_valor DECIMAL(15,2) NOT NULL DEFAULT 0,
  porcentaje_minimo DECIMAL(7,4) NOT NULL DEFAULT 100.0000,
  estado ENUM('borrador','activa','cerrada','anulada') NOT NULL DEFAULT 'activa',
  created_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_meta_empleado_periodo_tipo (empleado_id, periodo_id, tipo),
  KEY idx_meta_empresa_periodo (empresa_id, periodo_id),
  CONSTRAINT fk_meta_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_meta_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
  CONSTRAINT fk_meta_periodo FOREIGN KEY (periodo_id) REFERENCES periodos_nomina(id) ON DELETE CASCADE,
  CONSTRAINT fk_meta_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO modulos (nombre, nombre_mostrar, descripcion, icono, nivel, categoria, orden, ruta, activo, requiere_licencia)
SELECT 'nomina_metas', 'Metas y Bonos', 'Metas comerciales y bonos por cumplimiento', 'bi-bullseye', 'tenant', 'nomina', 34, '/nomina-metas', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM modulos WHERE nombre = 'nomina_metas');

SET @nomina_metas_id := (SELECT id FROM modulos WHERE nombre = 'nomina_metas' LIMIT 1);
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT @nomina_metas_id, a.id, CONCAT('NOMINA.METAS.', UPPER(a.nombre)), CONCAT(a.nombre_mostrar, ' metas de nomina'), 1
FROM acciones a
WHERE a.nombre IN ('view','create','edit','delete','approve')
  AND NOT EXISTS (SELECT 1 FROM permisos p WHERE p.modulo_id = @nomina_metas_id AND p.accion_id = a.id);
