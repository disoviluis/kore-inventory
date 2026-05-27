-- ================================================================
-- MIGRACIÓN: Sistema de Pagos y Licencias
-- ================================================================
-- Crea tabla para historial de pagos de licencias
-- y ajusta configuraciones del sistema
-- ================================================================

-- 1. Crear tabla de pagos de licencias
CREATE TABLE IF NOT EXISTS pagos_licencias (
  id INT PRIMARY KEY AUTO_INCREMENT,
  licencia_id INT NOT NULL,
  empresa_id INT NOT NULL,
  plan_id INT NOT NULL,
  
  -- Información del pago
  monto DECIMAL(10,2) NOT NULL,
  moneda VARCHAR(3) DEFAULT 'COP',
  tipo VARCHAR(50) NOT NULL COMMENT 'trial_inicial, mensual, anual, upgrade, downgrade, renovacion',
  metodo_pago VARCHAR(50) COMMENT 'tarjeta, transferencia, paypal, stripe, mercadopago',
  
  -- Estado del pago
  estado ENUM('pendiente', 'exitoso', 'fallido', 'reembolsado', 'cancelado') DEFAULT 'pendiente',
  
  -- Referencias externas
  referencia_pago VARCHAR(100) COMMENT 'ID de transacción de la pasarela de pago',
  referencia_externa VARCHAR(100) COMMENT 'Número de factura o referencia del cliente',
  
  -- Período que cubre este pago
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  
  -- Información adicional
  descripcion TEXT COMMENT 'Descripción del pago',
  datos_pago JSON COMMENT 'Datos adicionales de la pasarela (respuesta completa)',
  
  -- Fechas
  fecha_pago DATETIME COMMENT 'Fecha/hora en que se procesó el pago',
  fecha_vencimiento_pago DATE COMMENT 'Para pagos pendientes',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Claves foráneas
  FOREIGN KEY (licencia_id) REFERENCES licencias(id) ON DELETE CASCADE,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES planes(id),
  
  -- Índices
  INDEX idx_empresa_fecha (empresa_id, fecha_pago),
  INDEX idx_licencia (licencia_id),
  INDEX idx_estado (estado),
  INDEX idx_tipo (tipo),
  INDEX idx_periodo (periodo_inicio, periodo_fin),
  INDEX idx_referencia (referencia_pago)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Historial de pagos de licencias';

-- 2. Agregar campo para contar intentos de cobro fallidos
ALTER TABLE licencias 
ADD COLUMN IF NOT EXISTS intentos_cobro_fallidos INT DEFAULT 0 
COMMENT 'Contador de intentos fallidos de renovación automática';

-- 3. Agregar campo para fecha del último intento de cobro
ALTER TABLE licencias 
ADD COLUMN IF NOT EXISTS ultima_fecha_intento_cobro DATETIME 
COMMENT 'Fecha del último intento de cobro automático';

-- 4. Agregar campo para indicar si está en período de gracia
ALTER TABLE licencias 
ADD COLUMN IF NOT EXISTS en_periodo_gracia BOOLEAN DEFAULT FALSE 
COMMENT 'TRUE si está en período de gracia por fallo de pago';

-- 5. Crear tabla de configuración del sistema
CREATE TABLE IF NOT EXISTS sistema_configuracion (
  id INT PRIMARY KEY AUTO_INCREMENT,
  clave VARCHAR(100) UNIQUE NOT NULL,
  valor TEXT NOT NULL,
  tipo ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  categoria VARCHAR(50) DEFAULT 'general',
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_categoria (categoria),
  INDEX idx_clave (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Configuración global del sistema';

-- 6. Insertar configuraciones por defecto
INSERT INTO sistema_configuracion (clave, valor, tipo, categoria, descripcion) VALUES
('dias_trial_default', '30', 'number', 'licencias', 'Días de prueba gratuita por defecto'),
('dias_periodo_gracia', '7', 'number', 'licencias', 'Días de gracia después de fallo de pago'),
('max_intentos_cobro', '3', 'number', 'licencias', 'Máximo de intentos de cobro automático'),
('dias_aviso_vencimiento', '7', 'number', 'notificaciones', 'Días antes de vencer para enviar aviso'),
('permitir_multiple_trial', 'false', 'boolean', 'licencias', 'Permitir múltiples períodos de prueba')
ON DUPLICATE KEY UPDATE valor=VALUES(valor);

-- 7. Crear tabla de eventos/logs del sistema de licencias
CREATE TABLE IF NOT EXISTS licencias_eventos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  licencia_id INT,
  evento VARCHAR(100) NOT NULL COMMENT 'trial_iniciado, licencia_activada, licencia_vencida, pago_exitoso, pago_fallido, etc',
  descripcion TEXT,
  datos JSON COMMENT 'Datos adicionales del evento',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (licencia_id) REFERENCES licencias(id) ON DELETE CASCADE,
  
  INDEX idx_empresa (empresa_id),
  INDEX idx_licencia (licencia_id),
  INDEX idx_evento (evento),
  INDEX idx_fecha (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Log de eventos del sistema de licencias';

-- ================================================================
-- VERIFICACIÓN
-- ================================================================

-- Ver estructura de pagos_licencias
DESCRIBE pagos_licencias;

-- Ver configuraciones
SELECT * FROM sistema_configuracion WHERE categoria = 'licencias';

-- Ver eventos recientes
SELECT * FROM licencias_eventos ORDER BY created_at DESC LIMIT 10;

-- ================================================================
-- NOTA: Ejecutar este script en la base de datos de producción
-- ================================================================
