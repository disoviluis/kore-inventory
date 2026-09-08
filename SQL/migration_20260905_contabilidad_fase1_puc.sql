-- Fase 1 de contabilidad: catálogo PUC base y plan por empresa
-- No crea asientos ni cambia la contabilización de operaciones existentes.
-- Ejecutar después de realizar backup de la base de datos.

CREATE TABLE IF NOT EXISTS catalogo_puc_base (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL,
  nombre VARCHAR(180) NOT NULL,
  tipo ENUM('activo','pasivo','patrimonio','ingreso','costo','gasto') NOT NULL,
  nivel TINYINT UNSIGNED NOT NULL DEFAULT 1,
  cuenta_padre_id INT NULL,
  naturaleza ENUM('debito','credito') NOT NULL,
  acepta_movimientos TINYINT(1) NOT NULL DEFAULT 1,
  perfil_negocio VARCHAR(40) NOT NULL DEFAULT 'general',
  activa TINYINT(1) NOT NULL DEFAULT 1,
  version_puc VARCHAR(30) NOT NULL DEFAULT 'base-2026',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_catalogo_puc_codigo_version (codigo, version_puc),
  KEY idx_catalogo_puc_padre (cuenta_padre_id),
  KEY idx_catalogo_puc_perfil (perfil_negocio, activa),
  CONSTRAINT fk_catalogo_puc_padre FOREIGN KEY (cuenta_padre_id)
    REFERENCES catalogo_puc_base(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plan_cuentas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  catalogo_puc_base_id INT NULL,
  codigo VARCHAR(30) NOT NULL,
  nombre VARCHAR(180) NOT NULL,
  tipo ENUM('activo','pasivo','patrimonio','ingreso','costo','gasto') NOT NULL,
  nivel TINYINT UNSIGNED NOT NULL DEFAULT 1,
  cuenta_padre_id INT NULL,
  naturaleza ENUM('debito','credito') NOT NULL,
  acepta_movimientos TINYINT(1) NOT NULL DEFAULT 1,
  es_personalizada TINYINT(1) NOT NULL DEFAULT 0,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_plan_cuentas_empresa_codigo (empresa_id, codigo),
  KEY idx_plan_cuentas_empresa_activa (empresa_id, activa),
  KEY idx_plan_cuentas_padre (cuenta_padre_id),
  CONSTRAINT fk_plan_cuentas_empresa FOREIGN KEY (empresa_id)
    REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_plan_cuentas_catalogo FOREIGN KEY (catalogo_puc_base_id)
    REFERENCES catalogo_puc_base(id) ON DELETE SET NULL,
  CONSTRAINT fk_plan_cuentas_padre FOREIGN KEY (cuenta_padre_id)
    REFERENCES plan_cuentas(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cuentas base mínimas. El contador podrá ampliar el catálogo por perfil.
INSERT INTO catalogo_puc_base
  (codigo, nombre, tipo, nivel, naturaleza, acepta_movimientos, perfil_negocio)
SELECT datos.codigo, datos.nombre, datos.tipo, datos.nivel, datos.naturaleza,
       datos.acepta_movimientos, datos.perfil_negocio
FROM (
  SELECT '1105' codigo, 'Caja' nombre, 'activo' tipo, 2 nivel, 'debito' naturaleza, 1 acepta_movimientos, 'general' perfil_negocio
  UNION ALL SELECT '1110', 'Bancos', 'activo', 2, 'debito', 1, 'general'
  UNION ALL SELECT '1305', 'Clientes', 'activo', 2, 'debito', 1, 'general'
  UNION ALL SELECT '1435', 'Inventarios', 'activo', 2, 'debito', 0, 'comercio'
  UNION ALL SELECT '2205', 'Proveedores', 'pasivo', 2, 'credito', 1, 'general'
  UNION ALL SELECT '2408', 'IVA generado', 'pasivo', 2, 'credito', 1, 'general'
  UNION ALL SELECT '1355', 'IVA descontable', 'activo', 2, 'debito', 1, 'general'
  UNION ALL SELECT '3105', 'Capital social', 'patrimonio', 2, 'credito', 1, 'general'
  UNION ALL SELECT '4135', 'Ingresos por ventas', 'ingreso', 2, 'credito', 1, 'general'
  UNION ALL SELECT '4175', 'Devoluciones en ventas', 'ingreso', 2, 'debito', 1, 'general'
  UNION ALL SELECT '6135', 'Costo de ventas', 'costo', 2, 'debito', 1, 'comercio'
  UNION ALL SELECT '5105', 'Gastos de personal', 'gasto', 2, 'debito', 1, 'general'
  UNION ALL SELECT '5135', 'Servicios', 'gasto', 2, 'debito', 1, 'general'
  UNION ALL SELECT '5195', 'Gastos generales', 'gasto', 2, 'debito', 1, 'general'
  UNION ALL SELECT '2380', 'Propinas por pagar', 'pasivo', 2, 'credito', 1, 'restaurante'
  UNION ALL SELECT '613505', 'Costo de alimentos', 'costo', 3, 'debito', 1, 'restaurante'
  UNION ALL SELECT '143505', 'Materias primas', 'activo', 3, 'debito', 0, 'manufactura'
  UNION ALL SELECT '143510', 'Productos terminados', 'activo', 3, 'debito', 0, 'manufactura'
  UNION ALL SELECT '7105', 'Materia prima consumida', 'costo', 3, 'debito', 1, 'manufactura'
) datos
WHERE NOT EXISTS (
  SELECT 1 FROM catalogo_puc_base c
  WHERE c.codigo = datos.codigo AND c.version_puc = 'base-2026'
);

-- Las cuentas base se copian por empresa en una fase posterior,
-- después de seleccionar el perfil y validar el PUC con el contador.
