-- =============================================================
-- Fase 3 - Motor de asientos contables
-- =============================================================
-- Objetivo:
-- 1. Crear la estructura base de comprobantes y movimientos.
-- 2. Permitir validación de partida doble y auditoría.
-- 3. Dejar un resumen final para verificar que la fase quedó bien.
--
-- Requisitos previos:
-- - Fase 1 validada: catalogo_puc_base + plan_cuentas.
-- - Fase 2 validada: configuracion_contable por empresa.
--
-- Ejecutar con backup y validar en local/staging antes de producción.
-- =============================================================

CREATE TABLE IF NOT EXISTS comprobantes_contables (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  numero VARCHAR(50) NOT NULL,
  tipo ENUM(
    'venta',
    'compra',
    'recibo_caja',
    'egreso',
    'gasto',
    'inventario',
    'ajuste',
    'cierre',
    'manual',
    'anulacion'
  ) NOT NULL,
  fecha DATE NOT NULL,
  estado ENUM('borrador', 'confirmado', 'anulado') NOT NULL DEFAULT 'borrador',
  origen_tipo VARCHAR(50) NULL,
  origen_id BIGINT NULL,
  descripcion VARCHAR(255) NULL,
  usuario_id INT NULL,
  comprobante_anulacion_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_comprobante_empresa_numero (empresa_id, numero),
  KEY idx_comprobantes_empresa_fecha (empresa_id, fecha),
  KEY idx_comprobantes_estado (estado),
  KEY idx_comprobantes_origen (origen_tipo, origen_id),
  KEY idx_comprobantes_empresa_tipo (empresa_id, tipo),
  KEY idx_comprobantes_usuario (usuario_id),
  CONSTRAINT fk_comprobante_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_comprobante_anulacion
    FOREIGN KEY (comprobante_anulacion_id) REFERENCES comprobantes_contables(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS movimientos_contables (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  comprobante_id BIGINT NOT NULL,
  cuenta_id INT NOT NULL,
  tercero_tipo VARCHAR(40) NULL,
  tercero_id INT NULL,
  bodega_id INT NULL,
  debito DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  credito DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  descripcion VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_movimientos_comprobante (comprobante_id),
  KEY idx_movimientos_cuenta (cuenta_id),
  KEY idx_movimientos_tercero (tercero_tipo, tercero_id),
  KEY idx_movimientos_bodega (bodega_id),
  KEY idx_movimientos_fecha (created_at),
  CONSTRAINT fk_movimiento_comprobante
    FOREIGN KEY (comprobante_id) REFERENCES comprobantes_contables(id) ON DELETE CASCADE,
  CONSTRAINT fk_contabilidad_movimiento_cuenta
    FOREIGN KEY (cuenta_id) REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  CONSTRAINT chk_movimiento_validacion
    CHECK (
      (debito >= 0 AND credito >= 0)
      AND ((debito > 0 AND credito = 0) OR (debito = 0 AND credito > 0))
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- VALIDACION DE ESTADO FINAL DE FASE 3
-- =============================================================
-- Esta validación no falla si una tabla aún no existe.
-- En lugar de referenciar la tabla directamente, usa information_schema.
DELIMITER $$

DROP PROCEDURE IF EXISTS sp_validar_fase3$$
CREATE PROCEDURE sp_validar_fase3()
BEGIN
  DECLARE v_existe_comprobantes INT DEFAULT 0;
  DECLARE v_existe_movimientos INT DEFAULT 0;
  DECLARE v_empresas_configuradas INT DEFAULT 0;
  DECLARE v_total_cuentas INT DEFAULT 0;

  SELECT COUNT(*) INTO v_existe_comprobantes
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'comprobantes_contables';

  SELECT COUNT(*) INTO v_existe_movimientos
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'movimientos_contables';

  SELECT COUNT(*) INTO v_empresas_configuradas
  FROM configuracion_contable
  WHERE empresa_id IN (29, 31, 32);

  SELECT COUNT(*) INTO v_total_cuentas
  FROM plan_cuentas
  WHERE empresa_id IN (29, 31, 32);

  SELECT
    'fase3' AS fase,
    CASE
      WHEN v_existe_comprobantes = 1 AND v_existe_movimientos = 1 AND v_empresas_configuradas > 0 THEN 'OK'
      ELSE 'REVISAR'
    END AS estado_general,
    v_existe_comprobantes AS comprobantes_tabla_existe,
    v_existe_movimientos AS movimientos_tabla_existe,
    v_empresas_configuradas AS empresas_configuradas,
    v_total_cuentas AS cuentas_por_empresa,
    CASE
      WHEN v_existe_comprobantes = 1 AND v_existe_movimientos = 1 THEN 'ESTRUCTURA_LISTA'
      ELSE 'REVISION'
    END AS resultado_tecnico;

  IF v_existe_comprobantes = 1 AND v_existe_movimientos = 1 THEN
    SELECT
      c.id AS comprobante_id,
      c.empresa_id,
      c.numero,
      c.estado,
      SUM(m.debito) AS total_debito,
      SUM(m.credito) AS total_credito,
      CASE
        WHEN SUM(m.debito) = SUM(m.credito) THEN 'BALANCEADO'
        ELSE 'DESBALANCEADO'
      END AS verificacion_partida_doble
    FROM comprobantes_contables c
    LEFT JOIN movimientos_contables m ON m.comprobante_id = c.id
    GROUP BY c.id, c.empresa_id, c.numero, c.estado
    ORDER BY c.empresa_id, c.id;
  ELSE
    SELECT 'No se puede validar partida doble porque faltan las tablas de comprobantes y/o movimientos.' AS mensaje;
  END IF;
END$$

DELIMITER ;

CALL sp_validar_fase3();

-- Si la primera consulta devuelve 'OK' y la segunda muestra 'BALANCEADO'
-- para todos los comprobantes con datos reales, la Fase 3 queda verificada.
