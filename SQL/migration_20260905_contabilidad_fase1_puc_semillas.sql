-- =========================================================
-- FASE 1 - SEMILLAS DEL CATÁLOGO PUC BASE
-- Archivo: SQL/migration_20260905_contabilidad_fase1_puc_semillas.sql
-- =========================================================
-- Objetivo:
--   Insertar un conjunto base de cuentas para ERP multiempresa.
--   Las empresas luego activan solo las que necesiten.
-- =========================================================
-- Ejecutar después de la tabla base.
-- mysql -u usuario -p kore_inventory < SQL/migration_20260905_contabilidad_fase1_puc_semillas.sql
-- =========================================================

INSERT INTO catalogo_puc_base (
    codigo,
    nombre,
    tipo,
    nivel,
    naturaleza,
    acepta_movimientos,
    perfil_negocio,
    activa,
    version_puc
)
SELECT
    seed.codigo,
    seed.nombre,
    seed.tipo,
    seed.nivel,
    seed.naturaleza,
    seed.acepta_movimientos,
    seed.perfil_negocio,
    seed.activa,
    seed.version_puc
FROM (
    SELECT '1105' AS codigo, 'Caja' AS nombre, 'activo' AS tipo, 2 AS nivel, 'debito' AS naturaleza, 1 AS acepta_movimientos, 'general' AS perfil_negocio, 1 AS activa, 'base-2026' AS version_puc
    UNION ALL SELECT '1110', 'Bancos', 'activo', 2, 'debito', 1, 'general', 1, 'base-2026'
    UNION ALL SELECT '1205', 'Cuentas por cobrar', 'activo', 2, 'debito', 1, 'general', 1, 'base-2026'
    UNION ALL SELECT '1305', 'Clientes', 'activo', 2, 'debito', 1, 'general', 1, 'base-2026'
    UNION ALL SELECT '1355', 'IVA descontable', 'activo', 2, 'debito', 1, 'general', 1, 'base-2026'
    UNION ALL SELECT '1435', 'Inventarios', 'activo', 2, 'debito', 0, 'comercio', 1, 'base-2026'
    UNION ALL SELECT '143505', 'Materias primas', 'activo', 3, 'debito', 0, 'manufactura', 1, 'base-2026'
    UNION ALL SELECT '143510', 'Productos terminados', 'activo', 3, 'debito', 0, 'manufactura', 1, 'base-2026'
    UNION ALL SELECT '2205', 'Proveedores', 'pasivo', 2, 'credito', 1, 'general', 1, 'base-2026'
    UNION ALL SELECT '2365', 'Retención en la fuente', 'pasivo', 2, 'credito', 1, 'general', 1, 'base-2026'
    UNION ALL SELECT '2380', 'Propinas por pagar', 'pasivo', 2, 'credito', 1, 'restaurante', 1, 'base-2026'
    UNION ALL SELECT '2408', 'IVA generado', 'pasivo', 2, 'credito', 1, 'general', 1, 'base-2026'
    UNION ALL SELECT '2610', 'Cuentas por pagar', 'pasivo', 2, 'credito', 1, 'general', 1, 'base-2026'
    UNION ALL SELECT '3105', 'Capital social', 'patrimonio', 2, 'credito', 1, 'general', 1, 'base-2026'
    UNION ALL SELECT '3205', 'Utilidades acumuladas', 'patrimonio', 2, 'credito', 1, 'general', 1, 'base-2026'
    UNION ALL SELECT '4105', 'Ingresos por servicios', 'ingreso', 2, 'credito', 1, 'servicios', 1, 'base-2026'
    UNION ALL SELECT '4135', 'Ingresos por ventas', 'ingreso', 2, 'credito', 1, 'general', 1, 'base-2026'
    UNION ALL SELECT '4175', 'Devoluciones en ventas', 'ingreso', 2, 'debito', 1, 'general', 1, 'base-2026'
    UNION ALL SELECT '5105', 'Gastos de personal', 'gasto', 2, 'debito', 1, 'general', 1, 'base-2026'
    UNION ALL SELECT '5135', 'Servicios públicos', 'gasto', 2, 'debito', 1, 'general', 1, 'base-2026'
    UNION ALL SELECT '5195', 'Gastos generales', 'gasto', 2, 'debito', 1, 'general', 1, 'base-2026'
    UNION ALL SELECT '6105', 'Compras de mercaderías', 'costo', 2, 'debito', 1, 'comercio', 1, 'base-2026'
    UNION ALL SELECT '6135', 'Costo de ventas', 'costo', 2, 'debito', 1, 'general', 1, 'base-2026'
    UNION ALL SELECT '613505', 'Costo de alimentos', 'costo', 3, 'debito', 1, 'restaurante', 1, 'base-2026'
    UNION ALL SELECT '7105', 'Materia prima consumida', 'costo', 3, 'debito', 1, 'manufactura', 1, 'base-2026'
    UNION ALL SELECT '7110', 'Mano de obra directa', 'costo', 3, 'debito', 1, 'manufactura', 1, 'base-2026'
    UNION ALL SELECT '7115', 'Costos indirectos de fabricación', 'costo', 3, 'debito', 1, 'manufactura', 1, 'base-2026'
) AS seed
WHERE NOT EXISTS (
    SELECT 1
    FROM catalogo_puc_base c
    WHERE c.codigo = seed.codigo
      AND c.version_puc = seed.version_puc
);

SELECT 'Semillas del catálogo PUC creadas correctamente.' AS resultado;
