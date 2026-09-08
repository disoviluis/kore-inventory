-- =========================================================
-- FASE 1 - TABLAS BASE: CATÁLOGO PUC Y PLAN CONTABLE
-- Archivo: SQL/migration_20260905_contabilidad_fase1_puc_tablas.sql
-- =========================================================
-- Objetivo:
--   Crear el catálogo maestro global y el plan contable por empresa.
--   Sin generar asientos ni modificar la contabilización actual.
-- =========================================================
-- Ejecutar con respaldo previo.
-- mysql -u usuario -p kore_inventory < SQL/migration_20260905_contabilidad_fase1_puc_tablas.sql
-- =========================================================

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS catalogo_puc_base (
    id INT NOT NULL AUTO_INCREMENT,
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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_catalogo_puc_codigo_version (codigo, version_puc),
    KEY idx_catalogo_puc_padre (cuenta_padre_id),
    KEY idx_catalogo_puc_perfil (perfil_negocio, activa),
    CONSTRAINT fk_catalogo_puc_padre
        FOREIGN KEY (cuenta_padre_id)
        REFERENCES catalogo_puc_base(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plan_cuentas (
    id INT NOT NULL AUTO_INCREMENT,
    empresa_id INT NOT NULL,
    catalogo_puc_base_id INT NULL,
    codigo VARCHAR(30) NOT NULL,
    nombre VARCHAR(180) NOT NULL,
    tipo ENUM('activo','pasivo','patrimonio','ingreso','costo','gasto') NOT NULL,
    nivel TINYINT UNSIGNED NOT NULL DEFAULT 1,
    cuenta_padre_id INT NULL,
    naturaleza ENUM('debito','credito') NOT NULL,
    acepta_movimientos TINYINT(1) NOT NULL DEFAULT 1,
    activa TINYINT(1) NOT NULL DEFAULT 1,
    es_personalizada TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_plan_cuentas_empresa_codigo (empresa_id, codigo),
    KEY idx_plan_cuentas_empresa_activa (empresa_id, activa),
    KEY idx_plan_cuentas_padre (cuenta_padre_id),
    KEY idx_plan_cuentas_catalogo (catalogo_puc_base_id),
    CONSTRAINT fk_plan_cuentas_empresa
        FOREIGN KEY (empresa_id)
        REFERENCES empresas(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_plan_cuentas_catalogo
        FOREIGN KEY (catalogo_puc_base_id)
        REFERENCES catalogo_puc_base(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_plan_cuentas_padre
        FOREIGN KEY (cuenta_padre_id)
        REFERENCES plan_cuentas(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Tablas base de contabilidad creadas correctamente.' AS resultado;
