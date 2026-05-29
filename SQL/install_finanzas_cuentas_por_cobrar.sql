-- =====================================================================
-- MÓDULO FINANZAS - FASE 1: CUENTAS POR COBRAR
-- Sistema: KORE Inventory ERP SaaS
-- Fecha: 2026-05-29
-- =====================================================================

USE kore_inventory;

-- =====================================================================
-- 1. TABLA: cuentas_por_cobrar
-- Registro de todas las cuentas por cobrar (cartera de clientes)
-- =====================================================================
CREATE TABLE IF NOT EXISTS cuentas_por_cobrar (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  cliente_id INT NOT NULL,
  venta_id INT NOT NULL,
  numero_documento VARCHAR(50) NOT NULL COMMENT 'FAC-0001, REM-0001',
  tipo_documento ENUM('factura', 'remision', 'nota_debito') DEFAULT 'factura',
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  valor_original DECIMAL(15,2) NOT NULL,
  valor_pagado DECIMAL(15,2) DEFAULT 0.00,
  saldo_pendiente DECIMAL(15,2) NOT NULL,
  estado ENUM('vigente', 'vencida', 'pagada', 'anulada') DEFAULT 'vigente',
  dias_vencimiento INT DEFAULT 0 COMMENT 'Calculado automáticamente',
  rango_vencimiento ENUM('al_dia', '1-30', '31-60', '61-90', 'mas_90') DEFAULT 'al_dia',
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_empresa (empresa_id),
  INDEX idx_cliente (cliente_id),
  INDEX idx_venta (venta_id),
  INDEX idx_estado (estado),
  INDEX idx_fecha_vencimiento (fecha_vencimiento),
  INDEX idx_rango_vencimiento (rango_vencimiento),
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Cartera de clientes - Cuentas por cobrar';

-- =====================================================================
-- 2. TABLA: recibos_caja
-- Comprobantes de pago recibidos de clientes
-- =====================================================================
CREATE TABLE IF NOT EXISTS recibos_caja (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  numero_recibo VARCHAR(50) NOT NULL COMMENT 'RC-0001',
  cliente_id INT NOT NULL,
  fecha_recibo DATE NOT NULL,
  valor_total DECIMAL(15,2) NOT NULL,
  metodo_pago ENUM('efectivo','tarjeta_debito','tarjeta_credito','transferencia','cheque','nequi','daviplata','otro') NOT NULL,
  referencia VARCHAR(100) COMMENT 'Número de cheque, transacción, etc',
  banco VARCHAR(100),
  cuenta_bancaria_id INT COMMENT 'A qué cuenta se consignó',
  observaciones TEXT,
  usuario_id INT NOT NULL COMMENT 'Quien recibió el pago',
  anulado BOOLEAN DEFAULT FALSE,
  motivo_anulacion TEXT,
  fecha_anulacion DATETIME,
  usuario_anulacion_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_numero_recibo (empresa_id, numero_recibo),
  INDEX idx_empresa (empresa_id),
  INDEX idx_cliente (cliente_id),
  INDEX idx_fecha (fecha_recibo),
  INDEX idx_metodo_pago (metodo_pago),
  INDEX idx_anulado (anulado),
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  FOREIGN KEY (usuario_anulacion_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Recibos de caja - Comprobantes de pago de clientes';

-- =====================================================================
-- 3. TABLA: recibos_caja_detalle
-- Detalle de aplicación de pagos a facturas específicas
-- =====================================================================
CREATE TABLE IF NOT EXISTS recibos_caja_detalle (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recibo_caja_id INT NOT NULL,
  cuenta_por_cobrar_id INT NOT NULL COMMENT 'A qué factura se aplica',
  venta_id INT NOT NULL,
  valor_aplicado DECIMAL(15,2) NOT NULL,
  saldo_anterior DECIMAL(15,2) NOT NULL,
  saldo_nuevo DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_recibo (recibo_caja_id),
  INDEX idx_cxc (cuenta_por_cobrar_id),
  INDEX idx_venta (venta_id),
  
  FOREIGN KEY (recibo_caja_id) REFERENCES recibos_caja(id) ON DELETE CASCADE,
  FOREIGN KEY (cuenta_por_cobrar_id) REFERENCES cuentas_por_cobrar(id) ON DELETE RESTRICT,
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Detalle de aplicación de pagos a facturas';

-- =====================================================================
-- 4. TABLA: notas_credito_cliente
-- Notas crédito para clientes (devoluciones, ajustes)
-- =====================================================================
CREATE TABLE IF NOT EXISTS notas_credito_cliente (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  numero_nota VARCHAR(50) NOT NULL COMMENT 'NC-0001',
  cliente_id INT NOT NULL,
  venta_id INT COMMENT 'Factura original (si aplica)',
  fecha_emision DATE NOT NULL,
  motivo ENUM('devolucion', 'descuento', 'ajuste', 'anulacion') NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  estado ENUM('activa', 'aplicada', 'anulada') DEFAULT 'activa',
  descripcion TEXT NOT NULL,
  usuario_id INT NOT NULL,
  fecha_aplicacion DATE,
  aplicada_a_recibo INT COMMENT 'ID del recibo donde se aplicó',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_numero_nota (empresa_id, numero_nota),
  INDEX idx_empresa (empresa_id),
  INDEX idx_cliente (cliente_id),
  INDEX idx_venta (venta_id),
  INDEX idx_estado (estado),
  INDEX idx_fecha (fecha_emision),
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE SET NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  FOREIGN KEY (aplicada_a_recibo) REFERENCES recibos_caja(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Notas crédito para clientes (devoluciones, ajustes)';

-- =====================================================================
-- 5. TABLA: recordatorios_cobranza
-- Recordatorios automáticos de cobranza
-- =====================================================================
CREATE TABLE IF NOT EXISTS recordatorios_cobranza (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  cliente_id INT NOT NULL,
  cuenta_por_cobrar_id INT NOT NULL,
  tipo_recordatorio ENUM('email', 'whatsapp', 'sms', 'llamada') NOT NULL,
  fecha_programada DATE NOT NULL,
  fecha_envio DATETIME,
  estado ENUM('pendiente', 'enviado', 'fallido', 'cancelado') DEFAULT 'pendiente',
  mensaje TEXT,
  respuesta_cliente TEXT,
  usuario_id INT COMMENT 'Quien programó el recordatorio',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_empresa (empresa_id),
  INDEX idx_cliente (cliente_id),
  INDEX idx_cxc (cuenta_por_cobrar_id),
  INDEX idx_estado (estado),
  INDEX idx_fecha_programada (fecha_programada),
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  FOREIGN KEY (cuenta_por_cobrar_id) REFERENCES cuentas_por_cobrar(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Recordatorios automáticos de cobranza';

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- Trigger: Crear CxC automáticamente al crear venta a crédito
DELIMITER $$
DROP TRIGGER IF EXISTS after_venta_insert_crear_cxc$$
CREATE TRIGGER after_venta_insert_crear_cxc
AFTER INSERT ON ventas
FOR EACH ROW
BEGIN
  IF NEW.forma_pago = 'credito' THEN
    INSERT INTO cuentas_por_cobrar (
      empresa_id,
      cliente_id,
      venta_id,
      numero_documento,
      tipo_documento,
      fecha_emision,
      fecha_vencimiento,
      valor_original,
      saldo_pendiente,
      estado
    ) VALUES (
      NEW.empresa_id,
      NEW.cliente_id,
      NEW.id,
      NEW.numero_factura,
      'factura',
      DATE(NEW.fecha_venta),
      NEW.fecha_vencimiento,
      NEW.total,
      NEW.total,
      'vigente'
    );
  END IF;
END$$
DELIMITER ;

-- Trigger: Actualizar estado CxC cuando venta cambia
DELIMITER $$
DROP TRIGGER IF EXISTS after_venta_update_estado_cxc$$
CREATE TRIGGER after_venta_update_estado_cxc
AFTER UPDATE ON ventas
FOR EACH ROW
BEGIN
  IF NEW.estado = 'pagada' THEN
    UPDATE cuentas_por_cobrar 
    SET estado = 'pagada', 
        saldo_pendiente = 0,
        valor_pagado = valor_original
    WHERE venta_id = NEW.id;
  ELSEIF NEW.estado = 'anulada' THEN
    UPDATE cuentas_por_cobrar 
    SET estado = 'anulada'
    WHERE venta_id = NEW.id;
  END IF;
END$$
DELIMITER ;

-- =====================================================================
-- EVENTOS PROGRAMADOS
-- =====================================================================

-- Evento: Actualizar días de vencimiento diariamente
DELIMITER $$
DROP EVENT IF EXISTS actualizar_dias_vencimiento_cxc$$
CREATE EVENT actualizar_dias_vencimiento_cxc
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_DATE + INTERVAL 1 DAY
DO
BEGIN
  UPDATE cuentas_por_cobrar
  SET 
    dias_vencimiento = DATEDIFF(CURDATE(), fecha_vencimiento),
    estado = CASE 
      WHEN estado = 'pagada' THEN 'pagada'
      WHEN estado = 'anulada' THEN 'anulada'
      WHEN CURDATE() > fecha_vencimiento THEN 'vencida'
      ELSE 'vigente'
    END,
    rango_vencimiento = CASE
      WHEN estado IN ('pagada', 'anulada') THEN rango_vencimiento
      WHEN DATEDIFF(CURDATE(), fecha_vencimiento) <= 0 THEN 'al_dia'
      WHEN DATEDIFF(CURDATE(), fecha_vencimiento) BETWEEN 1 AND 30 THEN '1-30'
      WHEN DATEDIFF(CURDATE(), fecha_vencimiento) BETWEEN 31 AND 60 THEN '31-60'
      WHEN DATEDIFF(CURDATE(), fecha_vencimiento) BETWEEN 61 AND 90 THEN '61-90'
      ELSE 'mas_90'
    END
  WHERE estado IN ('vigente', 'vencida');
END$$
DELIMITER ;

-- =====================================================================
-- MIGRACIÓN DE DATOS EXISTENTES
-- Convertir ventas a crédito existentes en CxC
-- =====================================================================

INSERT INTO cuentas_por_cobrar (
  empresa_id,
  cliente_id,
  venta_id,
  numero_documento,
  tipo_documento,
  fecha_emision,
  fecha_vencimiento,
  valor_original,
  valor_pagado,
  saldo_pendiente,
  estado,
  dias_vencimiento,
  rango_vencimiento,
  created_at
)
SELECT 
  v.empresa_id,
  v.cliente_id,
  v.id,
  v.numero_factura,
  'factura',
  DATE(v.fecha_venta),
  COALESCE(v.fecha_vencimiento, DATE_ADD(DATE(v.fecha_venta), INTERVAL 30 DAY)),
  v.total,
  CASE 
    WHEN v.estado = 'pagada' THEN v.total
    ELSE 0
  END as valor_pagado,
  CASE 
    WHEN v.estado = 'pagada' THEN 0
    ELSE v.total
  END as saldo_pendiente,
  CASE 
    WHEN v.estado = 'pagada' THEN 'pagada'
    WHEN v.estado = 'anulada' THEN 'anulada'
    WHEN CURDATE() > COALESCE(v.fecha_vencimiento, DATE_ADD(DATE(v.fecha_venta), INTERVAL 30 DAY)) THEN 'vencida'
    ELSE 'vigente'
  END as estado,
  DATEDIFF(CURDATE(), COALESCE(v.fecha_vencimiento, DATE_ADD(DATE(v.fecha_venta), INTERVAL 30 DAY))) as dias_vencimiento,
  CASE
    WHEN v.estado IN ('pagada', 'anulada') THEN 'al_dia'
    WHEN DATEDIFF(CURDATE(), COALESCE(v.fecha_vencimiento, DATE_ADD(DATE(v.fecha_venta), INTERVAL 30 DAY))) <= 0 THEN 'al_dia'
    WHEN DATEDIFF(CURDATE(), COALESCE(v.fecha_vencimiento, DATE_ADD(DATE(v.fecha_venta), INTERVAL 30 DAY))) BETWEEN 1 AND 30 THEN '1-30'
    WHEN DATEDIFF(CURDATE(), COALESCE(v.fecha_vencimiento, DATE_ADD(DATE(v.fecha_venta), INTERVAL 30 DAY))) BETWEEN 31 AND 60 THEN '31-60'
    WHEN DATEDIFF(CURDATE(), COALESCE(v.fecha_vencimiento, DATE_ADD(DATE(v.fecha_venta), INTERVAL 30 DAY))) BETWEEN 61 AND 90 THEN '61-90'
    ELSE 'mas_90'
  END as rango_vencimiento,
  v.created_at
FROM ventas v
WHERE v.forma_pago = 'credito'
AND NOT EXISTS (
  SELECT 1 FROM cuentas_por_cobrar cxc 
  WHERE cxc.venta_id = v.id
);

-- =====================================================================
-- INSERTAR MÓDULO Y PERMISOS
-- =====================================================================

-- Insertar módulo Finanzas si no existe
INSERT INTO modulos (nombre, slug, descripcion, icono, orden, activo)
SELECT 'Finanzas', 'finanzas', 'Gestión de cuentas por cobrar, pagar, caja y bancos', 'bi-cash-coin', 50, 1
WHERE NOT EXISTS (SELECT 1 FROM modulos WHERE slug = 'finanzas');

-- Obtener ID del módulo Finanzas
SET @modulo_finanzas_id = (SELECT id FROM modulos WHERE slug = 'finanzas');

-- Insertar permisos para Cuentas por Cobrar
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT @modulo_finanzas_id, a.id, CONCAT('FINANZAS.CXC.', UPPER(a.slug)), CONCAT(a.nombre, ' cuentas por cobrar'), 1
FROM acciones a
WHERE a.slug IN ('ver', 'crear', 'editar', 'eliminar', 'exportar', 'reportes')
AND NOT EXISTS (
  SELECT 1 FROM permisos p 
  WHERE p.codigo = CONCAT('FINANZAS.CXC.', UPPER(a.slug))
);

-- Insertar permisos para Recibos de Caja
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT @modulo_finanzas_id, a.id, CONCAT('FINANZAS.RECIBOS.', UPPER(a.slug)), CONCAT(a.nombre, ' recibos de caja'), 1
FROM acciones a
WHERE a.slug IN ('ver', 'crear', 'editar', 'eliminar', 'imprimir')
AND NOT EXISTS (
  SELECT 1 FROM permisos p 
  WHERE p.codigo = CONCAT('FINANZAS.RECIBOS.', UPPER(a.slug))
);

-- =====================================================================
-- VISTAS ÚTILES
-- =====================================================================

-- Vista: Estado de cartera por cliente
CREATE OR REPLACE VIEW vista_cartera_clientes AS
SELECT 
  c.id as cliente_id,
  c.empresa_id,
  c.nombre,
  c.numero_documento,
  c.limite_credito,
  c.credito_disponible,
  COUNT(cxc.id) as facturas_pendientes,
  COALESCE(SUM(CASE WHEN cxc.estado = 'vigente' THEN cxc.saldo_pendiente ELSE 0 END), 0) as cartera_vigente,
  COALESCE(SUM(CASE WHEN cxc.estado = 'vencida' THEN cxc.saldo_pendiente ELSE 0 END), 0) as cartera_vencida,
  COALESCE(SUM(CASE WHEN cxc.rango_vencimiento = '1-30' THEN cxc.saldo_pendiente ELSE 0 END), 0) as rango_1_30,
  COALESCE(SUM(CASE WHEN cxc.rango_vencimiento = '31-60' THEN cxc.saldo_pendiente ELSE 0 END), 0) as rango_31_60,
  COALESCE(SUM(CASE WHEN cxc.rango_vencimiento = '61-90' THEN cxc.saldo_pendiente ELSE 0 END), 0) as rango_61_90,
  COALESCE(SUM(CASE WHEN cxc.rango_vencimiento = 'mas_90' THEN cxc.saldo_pendiente ELSE 0 END), 0) as rango_mas_90,
  COALESCE(SUM(cxc.saldo_pendiente), 0) as total_cartera
FROM clientes c
LEFT JOIN cuentas_por_cobrar cxc ON c.id = cxc.cliente_id 
  AND cxc.estado IN ('vigente', 'vencida')
GROUP BY c.id, c.empresa_id, c.nombre, c.numero_documento, c.limite_credito, c.credito_disponible;

-- =====================================================================
-- FIN DEL SCRIPT
-- =====================================================================

SELECT 'Módulo Finanzas - Cuentas por Cobrar instalado exitosamente' as mensaje;
SELECT 'Tablas creadas: 5' as tablas;
SELECT 'Triggers creados: 2' as triggers;
SELECT 'Eventos creados: 1' as eventos;
SELECT COUNT(*) as ventas_migradas FROM cuentas_por_cobrar;
