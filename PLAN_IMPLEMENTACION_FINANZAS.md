# 🏦 PLAN DE IMPLEMENTACIÓN - MÓDULO FINANZAS
**Sistema:** KORE Inventory ERP SaaS  
**Entorno:** AWS (EC2 + RDS MySQL)  
**Fecha Creación:** 2026-05-29  
**Prioridad:** ALTA - Prerequisito para Nómina

---

## 📋 ÍNDICE
1. [Análisis de Base de Datos Actual](#análisis-de-base-de-datos-actual)
2. [Roadmap de Implementación](#roadmap-de-implementación)
3. [Fase 1: Cuentas por Cobrar](#fase-1-cuentas-por-cobrar)
4. [Fase 2: Caja](#fase-2-caja)
5. [Fase 3: Cuentas por Pagar](#fase-3-cuentas-por-pagar)
6. [Fase 4: Bancos](#fase-4-bancos)
7. [Fase 5: Gastos](#fase-5-gastos)
8. [Cronograma General](#cronograma-general)

---

## 📊 ANÁLISIS DE BASE DE DATOS ACTUAL

### ✅ **TABLAS EXISTENTES (Aprovechables)**

#### Relacionadas con Cuentas por Cobrar:
```sql
✅ ventas (38 registros en producción)
   - Campos clave: id, cliente_id, total, estado, fecha_venta, fecha_vencimiento
   - Forma_pago: 'contado', 'credito'
   - Estado: 'pendiente', 'pagada', 'cancelada', 'anulada'
   - dias_credito: int

✅ venta_pagos (múltiples pagos por venta)
   - metodo_pago: enum con 8 opciones
   - monto, referencia, banco
   - created_at (para fecha de pago)

✅ clientes (datos completos)
   - credito_disponible, limite_credito, dias_credito
   - Campos de retenciones (fuente, IVA, ICA)
```

#### Relacionadas con Cuentas por Pagar:
```sql
✅ compras 
   - Campos: proveedor_id, total, estado, fecha_compra
   - tipo_compra: 'contado', 'credito'
   - Estado: 'pendiente', 'recibida', 'parcial', 'anulada'

✅ proveedores (datos completos)
   - terminos_pago, dias_credito, limite_credito
   - numero_cuenta, banco, tipo_cuenta
```

#### Relacionadas con configuración:
```sql
✅ empresas (configuración general)
✅ usuarios (para auditoría de movimientos)
✅ auditoria_logs (registro de cambios)
```

---

### ❌ **TABLAS FALTANTES (A Crear)**

#### Para Cuentas por Cobrar:
```sql
❌ cuentas_por_cobrar (vista consolidada de saldos por cliente)
❌ recibos_caja (comprobantes de pagos recibidos)
❌ notas_credito_cliente (devoluciones, ajustes)
❌ recordatorios_cobranza (automatización de alertas)
```

#### Para Caja:
```sql
❌ cajas (configuración de cajas por empresa/sucursal)
❌ caja_movimientos (apertura, cierre, ingresos, egresos)
❌ arqueos_caja (cuadres de efectivo)
```

#### Para Cuentas por Pagar:
```sql
❌ cuentas_por_pagar (vista consolidada de saldos a proveedores)
❌ comprobantes_egreso (pagos realizados a proveedores)
❌ programacion_pagos (calendario de pagos)
❌ notas_credito_proveedor (devoluciones a proveedores)
```

#### Para Bancos:
```sql
❌ cuentas_bancarias (cuentas de la empresa)
❌ movimientos_bancarios (depósitos, retiros, transferencias)
❌ conciliacion_bancaria (cuadre con extractos)
```

#### Para Gastos:
```sql
❌ categorias_gastos (clasificación de gastos)
❌ gastos (registro de gastos operativos)
❌ gastos_aprobaciones (workflow de aprobación)
```

---

## 🗺️ ROADMAP DE IMPLEMENTACIÓN

### **Orden Estratégico:**
```
FASE 1: Cuentas por Cobrar (2 semanas)
   ↓
FASE 2: Caja (1 semana)
   ↓  
FASE 3: Cuentas por Pagar (2 semanas)
   ↓
FASE 4: Bancos (1 semana)
   ↓
FASE 5: Gastos (1 semana)

TOTAL: 7 semanas
```

---

## 💰 FASE 1: CUENTAS POR COBRAR
**Duración:** 2 semanas  
**Objetivo:** Gestionar cartera de clientes y cobranza

### 📅 **SEMANA 1: Base de Datos + Backend**

#### **DÍA 1-2: Creación de Tablas**

##### 1. Tabla: `cuentas_por_cobrar`
```sql
CREATE TABLE cuentas_por_cobrar (
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
```

##### 2. Tabla: `recibos_caja`
```sql
CREATE TABLE recibos_caja (
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
  INDEX idx_cliente (cliente_id),
  INDEX idx_fecha (fecha_recibo),
  INDEX idx_metodo_pago (metodo_pago),
  INDEX idx_anulado (anulado),
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Recibos de caja - Comprobantes de pago de clientes';
```

##### 3. Tabla: `recibos_caja_detalle`
```sql
CREATE TABLE recibos_caja_detalle (
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
```

##### 4. Tabla: `notas_credito_cliente`
```sql
CREATE TABLE notas_credito_cliente (
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
  INDEX idx_cliente (cliente_id),
  INDEX idx_venta (venta_id),
  INDEX idx_estado (estado),
  INDEX idx_fecha (fecha_emision),
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT,
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE SET NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Notas crédito para clientes (devoluciones, ajustes)';
```

##### 5. Tabla: `recordatorios_cobranza`
```sql
CREATE TABLE recordatorios_cobranza (
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
  FOREIGN KEY (cuenta_por_cobrar_id) REFERENCES cuentas_por_cobrar(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Recordatorios automáticos de cobranza';
```

#### **DÍA 3-4: Triggers y Procedimientos**

##### Trigger: Crear CxC automáticamente al crear venta a crédito
```sql
DELIMITER $$
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
```

##### Trigger: Actualizar estado CxC cuando venta cambia
```sql
DELIMITER $$
CREATE TRIGGER after_venta_update_estado_cxc
AFTER UPDATE ON ventas
FOR EACH ROW
BEGIN
  IF NEW.estado = 'pagada' THEN
    UPDATE cuentas_por_cobrar 
    SET estado = 'pagada', saldo_pendiente = 0
    WHERE venta_id = NEW.id;
  ELSEIF NEW.estado = 'anulada' THEN
    UPDATE cuentas_por_cobrar 
    SET estado = 'anulada'
    WHERE venta_id = NEW.id;
  END IF;
END$$
DELIMITER ;
```

##### Procedimiento: Calcular días de vencimiento
```sql
DELIMITER $$
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
      WHEN CURDATE() > fecha_vencimiento THEN 'vencida'
      ELSE 'vigente'
    END,
    rango_vencimiento = CASE
      WHEN estado = 'pagada' THEN 'al_dia'
      WHEN DATEDIFF(CURDATE(), fecha_vencimiento) <= 0 THEN 'al_dia'
      WHEN DATEDIFF(CURDATE(), fecha_vencimiento) BETWEEN 1 AND 30 THEN '1-30'
      WHEN DATEDIFF(CURDATE(), fecha_vencimiento) BETWEEN 31 AND 60 THEN '31-60'
      WHEN DATEDIFF(CURDATE(), fecha_vencimiento) BETWEEN 61 AND 90 THEN '61-90'
      ELSE 'mas_90'
    END
  WHERE estado IN ('vigente', 'vencida');
END$$
DELIMITER ;
```

#### **DÍA 5-7: Backend API**

##### Endpoints a crear:

```typescript
// 📂 backend/src/platform/finanzas/cuentas-por-cobrar/cxc.routes.ts

// GET /api/finanzas/cuentas-por-cobrar?empresa_id=X
// - Lista todas las CxC (con filtros: estado, cliente, rango_fecha)
router.get('/', authMiddleware, verificarEmpresaActiva, getCuentasPorCobrar);

// GET /api/finanzas/cuentas-por-cobrar/:id
// - Detalle de una CxC específica
router.get('/:id', authMiddleware, verificarEmpresaActiva, getCuentaPorCobrarById);

// GET /api/finanzas/cuentas-por-cobrar/cliente/:clienteId
// - Todas las CxC de un cliente
router.get('/cliente/:clienteId', authMiddleware, verificarEmpresaActiva, getCxCByCliente);

// GET /api/finanzas/cuentas-por-cobrar/dashboards/resumen?empresa_id=X
// - Estadísticas: total vigente, vencido, por rangos
router.get('/dashboard/resumen', authMiddleware, verificarEmpresaActiva, getResumenCartera);

// GET /api/finanzas/cuentas-por-cobrar/reportes/edades?empresa_id=X
// - Reporte de edades de cartera (Aging Report)
router.get('/reportes/edades', authMiddleware, verificarEmpresaActiva, getReporteEdades);

// POST /api/finanzas/recibos-caja
// - Crear recibo de caja (aplicar pago a facturas)
router.post('/recibos-caja', authMiddleware, verificarEmpresaActiva, crearReciboCaja);

// GET /api/finanzas/recibos-caja?empresa_id=X
// - Lista de recibos de caja
router.get('/recibos-caja', authMiddleware, verificarEmpresaActiva, getRecibosCaja);

// GET /api/finanzas/recibos-caja/:id/imprimir
// - PDF del recibo de caja
router.get('/recibos-caja/:id/imprimir', authMiddleware, verificarEmpresaActiva, imprimirReciboCaja);

// PUT /api/finanzas/recibos-caja/:id/anular
// - Anular recibo de caja (revierte aplicación de pago)
router.put('/recibos-caja/:id/anular', authMiddleware, verificarEmpresaActiva, anularReciboCaja);

// POST /api/finanzas/notas-credito
// - Crear nota crédito
router.post('/notas-credito', authMiddleware, verificarEmpresaActiva, crearNotaCredito);

// GET /api/finanzas/recordatorios-cobranza?empresa_id=X
// - Lista de recordatorios
router.get('/recordatorios-cobranza', authMiddleware, verificarEmpresaActiva, getRecordatorios);

// POST /api/finanzas/recordatorios-cobranza
// - Crear recordatorio de cobranza
router.post('/recordatorios-cobranza', authMiddleware, verificarEmpresaActiva, crearRecordatorio);
```

### 📅 **SEMANA 2: Frontend**

#### **DÍA 8-10: Interfaz de Usuario**

##### 1. Vista: `cuentas-por-cobrar.html`
```html
Componentes:
- 📊 Dashboard de Cartera
  * Total por cobrar
  * Cartera vencida
  * Cartera vigente
  * Gráfico de edades (1-30, 31-60, 61-90, +90 días)

- 📋 Tabla de CxC
  * Filtros: Cliente, Estado, Rango de fechas
  * Columnas: Factura, Cliente, Fecha emisión, Vencimiento, 
             Valor, Saldo, Días vencido, Estado
  * Acciones: Ver detalle, Aplicar pago, Enviar recordatorio

- 💰 Modal: Aplicar Pago
  * Cliente
  * Facturas pendientes (checkbox para seleccionar)
  * Método de pago
  * Valor recibido
  * Aplicación automática/manual
  * Generar recibo de caja (imprimir)

- 📧 Modal: Enviar Recordatorio
  * Cliente
  * Facturas vencidas
  * Tipo: Email, WhatsApp, SMS
  * Plantilla de mensaje (personalizable)
  * Programar fecha de envío
```

##### 2. Vista: `recibos-caja.html`
```html
Componentes:
- 📋 Lista de Recibos
  * Filtros: Fecha, Cliente, Método de pago
  * Columnas: Número, Fecha, Cliente, Valor, Método, Usuario
  * Acciones: Ver PDF, Anular (con autorización)

- 🖨️ Generación de PDF
  * Logo empresa
  * Datos del recibo (número, fecha)
  * Cliente
  * Detalle de facturas pagadas
  * Total recibido
  * Método de pago
  * Firma digital
```

#### **DÍA 11-12: Reportes**

##### 1. Reporte: Edades de Cartera
```
┌─────────────────────────────────────────────────────┐
│   EMPRESA ABC - REPORTE DE EDADES DE CARTERA       │
│   Fecha: 2026-05-29                                 │
├─────────────────────────────────────────────────────┤
│ Cliente      │ Al día │ 1-30 │ 31-60│ 61-90│ +90  │
├──────────────┼────────┼──────┼──────┼──────┼───────┤
│ Cliente A    │ $500   │ $200 │  $0  │  $0  │  $0   │
│ Cliente B    │   $0   │ $300 │ $150 │ $100 │ $50   │
├──────────────┼────────┼──────┼──────┼──────┼───────┤
│ TOTAL        │ $500   │ $500 │ $150 │ $100 │ $50   │
└──────────────┴────────┴──────┴──────┴──────┴───────┘
```

##### 2. Reporte: Estado de Cuenta Cliente
```
┌─────────────────────────────────────────────────────┐
│   ESTADO DE CUENTA - CLIENTE XYZ                    │
│   Período: 01/05/2026 - 29/05/2026                  │
├─────────────────────────────────────────────────────┤
│ Fecha │ Doc    │ Descripción  │ Débito │ Crédito   │
├───────┼────────┼──────────────┼────────┼───────────┤
│ 01/05 │ FAC-01 │ Venta        │ $1,000 │           │
│ 05/05 │ RC-001 │ Pago         │        │ $500      │
│ 10/05 │ NC-001 │ Devolución   │        │ $100      │
│ 15/05 │ FAC-02 │ Venta        │ $800   │           │
├───────┴────────┴──────────────┼────────┼───────────┤
│                      SALDO    │ $1,200 │           │
└───────────────────────────────┴────────┴───────────┘
```

#### **DÍA 13-14: Testing e Integración**

- ✅ Pruebas unitarias de endpoints
- ✅ Pruebas de triggers
- ✅ Migración de ventas existentes a CxC
- ✅ Validación de cálculos
- ✅ Pruebas de impresión de recibos
- ✅ Deploy a producción

---

## 💵 FASE 2: CAJA
**Duración:** 1 semana  
**Objetivo:** Control de apertura, cierre y cuadre de caja

### 📅 **SEMANA 3: Base de Datos + Backend + Frontend**

#### **DÍA 15-16: Creación de Tablas**

##### 1. Tabla: `cajas`
```sql
CREATE TABLE cajas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  codigo VARCHAR(20) NOT NULL COMMENT 'CAJA-01, CAJA-POS, etc',
  nombre VARCHAR(100) NOT NULL COMMENT 'Caja Principal, Caja Sucursal Norte',
  tipo ENUM('principal', 'secundaria', 'pos') DEFAULT 'principal',
  sucursal VARCHAR(100),
  ubicacion VARCHAR(200),
  responsable_id INT COMMENT 'Usuario responsable por defecto',
  monto_maximo DECIMAL(15,2) COMMENT 'Alerta si se excede',
  requiere_cuadre BOOLEAN DEFAULT TRUE,
  permite_faltante BOOLEAN DEFAULT FALSE,
  monto_maximo_faltante DECIMAL(10,2) DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_codigo (empresa_id, codigo),
  INDEX idx_empresa (empresa_id),
  INDEX idx_activo (activo),
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración de cajas por empresa';
```

##### 2. Tabla: `caja_movimientos`
```sql
CREATE TABLE caja_movimientos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  caja_id INT NOT NULL,
  tipo_movimiento ENUM('apertura', 'ingreso', 'egreso', 'cierre', 'ajuste') NOT NULL,
  numero_movimiento VARCHAR(50) COMMENT 'MOV-0001',
  fecha_movimiento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  concepto VARCHAR(200) NOT NULL,
  origen ENUM('venta', 'recibo_caja', 'gasto', 'prestamo', 'ajuste', 'otro') NOT NULL,
  referencia_id INT COMMENT 'ID de venta, recibo, gasto, etc',
  referencia_tipo VARCHAR(50) COMMENT 'ventas, recibos_caja, gastos',
  
  -- Montos por método de pago
  efectivo DECIMAL(15,2) DEFAULT 0,
  tarjeta_debito DECIMAL(15,2) DEFAULT 0,
  tarjeta_credito DECIMAL(15,2) DEFAULT 0,
  transferencia DECIMAL(15,2) DEFAULT 0,
  cheque DECIMAL(15,2) DEFAULT 0,
  nequi DECIMAL(15,2) DEFAULT 0,
  daviplata DECIMAL(15,2) DEFAULT 0,
  otro DECIMAL(15,2) DEFAULT 0,
  
  total DECIMAL(15,2) NOT NULL,
  saldo_anterior DECIMAL(15,2) DEFAULT 0,
  saldo_nuevo DECIMAL(15,2) NOT NULL,
  
  usuario_id INT NOT NULL COMMENT 'Quien realizó el movimiento',
  observaciones TEXT,
  anulado BOOLEAN DEFAULT FALSE,
  motivo_anulacion TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_empresa (empresa_id),
  INDEX idx_caja (caja_id),
  INDEX idx_tipo (tipo_movimiento),
  INDEX idx_fecha (fecha_movimiento),
  INDEX idx_origen (origen),
  INDEX idx_usuario (usuario_id),
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (caja_id) REFERENCES cajas(id) ON DELETE RESTRICT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Movimientos de caja (aperturas, ingresos, egresos, cierres)';
```

##### 3. Tabla: `arqueos_caja`
```sql
CREATE TABLE arqueos_caja (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  caja_id INT NOT NULL,
  fecha_arqueo DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_cierre TIME,
  
  -- Saldos según sistema
  saldo_sistema_inicial DECIMAL(15,2) NOT NULL,
  saldo_sistema_final DECIMAL(15,2) NOT NULL,
  
  -- Conteo físico
  efectivo_contado DECIMAL(15,2) NOT NULL,
  tarjeta_debito DECIMAL(15,2) DEFAULT 0,
  tarjeta_credito DECIMAL(15,2) DEFAULT 0,
  transferencias DECIMAL(15,2) DEFAULT 0,
  cheques DECIMAL(15,2) DEFAULT 0,
  otros DECIMAL(15,2) DEFAULT 0,
  total_contado DECIMAL(15,2) NOT NULL,
  
  -- Diferencias
  diferencia DECIMAL(15,2) NOT NULL COMMENT 'contado - sistema',
  tipo_diferencia ENUM('cuadrado', 'faltante', 'sobrante') NOT NULL,
  diferencia_autorizada BOOLEAN DEFAULT FALSE,
  autorizado_por INT,
  motivo_diferencia TEXT,
  
  -- Desglose de billetes y monedas
  desglose_efectivo JSON COMMENT '{"50000": 10, "20000": 5, ...}',
  
  estado ENUM('abierto', 'cerrado', 'auditado') DEFAULT 'abierto',
  usuario_apertura_id INT NOT NULL,
  usuario_cierre_id INT,
  usuario_auditoria_id INT,
  
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_empresa (empresa_id),
  INDEX idx_caja (caja_id),
  INDEX idx_fecha (fecha_arqueo),
  INDEX idx_estado (estado),
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (caja_id) REFERENCES cajas(id) ON DELETE RESTRICT,
  FOREIGN KEY (usuario_apertura_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  FOREIGN KEY (usuario_cierre_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (autorizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Arqueos y cuadres de caja';
```

#### **DÍA 17-18: Backend API + Triggers**

##### Trigger: Registrar venta en caja
```sql
DELIMITER $$
CREATE TRIGGER after_venta_pago_insert_caja
AFTER INSERT ON venta_pagos
FOR EACH ROW
BEGIN
  DECLARE v_caja_id INT;
  DECLARE v_saldo_anterior DECIMAL(15,2);
  
  -- Obtener caja activa del usuario (esto requiere lógica adicional)
  -- Por ahora asumimos caja_id = 1 (caja principal)
  SET v_caja_id = 1;
  
  -- Obtener saldo anterior
  SELECT COALESCE(saldo_nuevo, 0) INTO v_saldo_anterior
  FROM caja_movimientos
  WHERE caja_id = v_caja_id
  ORDER BY id DESC LIMIT 1;
  
  -- Registrar ingreso
  INSERT INTO caja_movimientos (
    empresa_id,
    caja_id,
    tipo_movimiento,
    concepto,
    origen,
    referencia_id,
    referencia_tipo,
    efectivo,
    tarjeta_debito,
    tarjeta_credito,
    transferencia,
    cheque,
    nequi,
    daviplata,
    otro,
    total,
    saldo_anterior,
    saldo_nuevo,
    usuario_id
  )
  SELECT 
    v.empresa_id,
    v_caja_id,
    'ingreso',
    CONCAT('Venta ', v.numero_factura),
    'venta',
    NEW.venta_id,
    'ventas',
    CASE WHEN NEW.metodo_pago = 'efectivo' THEN NEW.monto ELSE 0 END,
    CASE WHEN NEW.metodo_pago = 'tarjeta_debito' THEN NEW.monto ELSE 0 END,
    CASE WHEN NEW.metodo_pago = 'tarjeta_credito' THEN NEW.monto ELSE 0 END,
    CASE WHEN NEW.metodo_pago = 'transferencia' THEN NEW.monto ELSE 0 END,
    CASE WHEN NEW.metodo_pago = 'cheque' THEN NEW.monto ELSE 0 END,
    CASE WHEN NEW.metodo_pago = 'nequi' THEN NEW.monto ELSE 0 END,
    CASE WHEN NEW.metodo_pago = 'daviplata' THEN NEW.monto ELSE 0 END,
    CASE WHEN NEW.metodo_pago = 'otro' THEN NEW.monto ELSE 0 END,
    NEW.monto,
    v_saldo_anterior,
    v_saldo_anterior + NEW.monto,
    COALESCE(v.vendedor_id, 1)
  FROM ventas v
  WHERE v.id = NEW.venta_id;
END$$
DELIMITER ;
```

#### **DÍA 19-21: Frontend + Testing**

##### Vista: `caja.html`
```html
Componentes:
- 🔓 Apertura de Caja
  * Seleccionar caja
  * Fondo inicial en efectivo
  * Usuario responsable
  * Botón: "Abrir Caja"

- 📊 Vista de Caja Abierta
  * Saldo inicial
  * Total ingresos (desglosado por método)
  * Total egresos
  * Saldo actual
  * Lista de movimientos del día

- 💰 Registrar Ingreso/Egreso Manual
  * Concepto
  * Valor
  * Método de pago
  * Observaciones

- 🔒 Cierre de Caja
  * Conteo físico por método de pago
  * Calculadora de billetes/monedas
  * Diferencia (faltante/sobrante)
  * Justificación de diferencia
  * Imprimir reporte de cierre

- 📋 Historial de Arqueos
  * Filtros por fecha, caja, usuario
  * Ver detalle de cada arqueo
```

---

## 📤 FASE 3: CUENTAS POR PAGAR
**Duración:** 2 semanas  
**Objetivo:** Gestionar deudas con proveedores

### 📅 **SEMANA 4-5: Implementación Completa**

#### Estructura similar a Cuentas por Cobrar:

##### Tablas a crear:
```sql
1. cuentas_por_pagar (espejo de cuentas_por_cobrar)
2. comprobantes_egreso (espejo de recibos_caja)
3. comprobantes_egreso_detalle
4. notas_credito_proveedor
5. programacion_pagos
```

##### Endpoints:
```
GET    /api/finanzas/cuentas-por-pagar
GET    /api/finanzas/cuentas-por-pagar/proveedor/:id
GET    /api/finanzas/cuentas-por-pagar/dashboard/resumen
POST   /api/finanzas/comprobantes-egreso
GET    /api/finanzas/programacion-pagos
POST   /api/finanzas/programacion-pagos
```

##### Frontend:
```
- Vista: cuentas-por-pagar.html
- Vista: programacion-pagos.html
- Reportes: Estado de cuenta proveedor, Pagos programados
```

---

## 🏦 FASE 4: BANCOS
**Duración:** 1 semana  
**Objetivo:** Control de cuentas bancarias y conciliación

### 📅 **SEMANA 6: Implementación**

##### Tablas:
```sql
1. cuentas_bancarias
   - banco, tipo_cuenta, numero_cuenta, titular
   - saldo_inicial, saldo_actual

2. movimientos_bancarios
   - tipo: deposito, retiro, transferencia, nota_debito, nota_credito
   - origen: venta, recibo_caja, pago_proveedor, nomina
   - conciliado: boolean

3. conciliacion_bancaria
   - fecha_conciliacion
   - saldo_extracto, saldo_sistema
   - diferencias
```

---

## 💸 FASE 5: GASTOS
**Duración:** 1 semana  
**Objetivo:** Registro y control de gastos operativos

### 📅 **SEMANA 7: Implementación**

##### Tablas:
```sql
1. categorias_gastos
   - nombre: Servicios Públicos, Arriendo, Nomina, etc

2. gastos
   - categoria_id, valor, fecha, comprobante
   - proveedor_id, estado (pendiente_aprobacion, aprobado, pagado)

3. gastos_aprobaciones
   - gasto_id, aprobador_id, estado, comentarios
```

---

## 📅 CRONOGRAMA GENERAL

```
┌────────────────────────────────────────────────────────────┐
│ SEMANA │ MÓDULO              │ ENTREGABLES                 │
├────────┼─────────────────────┼─────────────────────────────┤
│   1    │ CxC - Backend       │ Tablas, Triggers, API       │
│   2    │ CxC - Frontend      │ UI, Reportes, Testing       │
│   3    │ Caja - Full         │ BD + API + UI + Tests       │
│   4    │ CxP - Backend       │ Tablas, Triggers, API       │
│   5    │ CxP - Frontend      │ UI, Reportes, Testing       │
│   6    │ Bancos - Full       │ BD + API + UI + Tests       │
│   7    │ Gastos - Full       │ BD + API + UI + Tests       │
└────────┴─────────────────────┴─────────────────────────────┘
```

---

## 🎯 HITOS CLAVE

### HITO 1 (Fin de Semana 2):
✅ **Cuentas por Cobrar funcional**
- Usuarios pueden ver cartera
- Aplicar pagos genera recibos
- Reportes de edades de cartera

### HITO 2 (Fin de Semana 3):
✅ **Caja funcional**
- Apertura/cierre de caja
- Cuadres automáticos
- Integración con ventas

### HITO 3 (Fin de Semana 5):
✅ **Cuentas por Pagar funcional**
- Control de deudas
- Programación de pagos
- Comprobantes de egreso

### HITO 4 (Fin de Semana 7):
✅ **Módulo Finanzas COMPLETO**
- Todos los submódulos integrados
- Flujo completo: Venta → CxC → Caja → Banco
- Flujo completo: Compra → CxP → Egreso → Banco

---

## 📊 MÉTRICAS DE ÉXITO

### Funcionales:
- ✅ 100% de ventas a crédito generan CxC automáticamente
- ✅ Reportes de cartera en tiempo real
- ✅ Cuadres de caja diarios sin diferencias >1%
- ✅ Todos los pagos a proveedores con comprobante

### Técnicas:
- ✅ API response time < 500ms
- ✅ Triggers ejecutan < 100ms
- ✅ Reportes generan < 2 segundos
- ✅ 0 errores en logs de producción

### Negocio:
- ✅ Reducción 80% tiempo en cobranza manual
- ✅ Reducción 90% tiempo en cuadre de caja
- ✅ Visibilidad 100% de flujo de caja

---

## 🚀 SIGUIENTES PASOS

### Después de Finanzas:
1. **Nómina Electrónica** (6-8 semanas)
2. **Contabilidad** (4 semanas)
3. **Centro de Costos** (2 semanas)

---

## 📌 NOTAS IMPORTANTES

### Consideraciones de Migración:
- ✅ Ventas existentes (38 en producción) → migrar a CxC
- ✅ Validar que todas tengan `fecha_vencimiento` calculada
- ✅ Recalcular `credito_disponible` de clientes

### Integraciones Necesarias:
- ✅ POS → Caja (automático en cada venta)
- ✅ Ventas → CxC (trigger automático)
- ✅ Recibos Caja → Actualización saldo CxC
- ✅ Caja → Bancos (consignaciones)
- ✅ Compras → CxP (trigger automático)
- ✅ Egresos → Bancos (pagos)

### Permisos a crear:
```sql
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion) VALUES
-- Finanzas - Cuentas por Cobrar
(XX, 1, 'FINANZAS.CXC.VER', 'Ver cuentas por cobrar'),
(XX, 2, 'FINANZAS.CXC.CREAR', 'Crear recibos de caja'),
(XX, 3, 'FINANZAS.CXC.EDITAR', 'Editar cuentas por cobrar'),
(XX, 4, 'FINANZAS.CXC.ELIMINAR', 'Anular recibos'),
(XX, 10, 'FINANZAS.CXC.REPORTES', 'Ver reportes de cartera'),

-- Finanzas - Caja
(XX, 1, 'FINANZAS.CAJA.VER', 'Ver movimientos de caja'),
(XX, 2, 'FINANZAS.CAJA.ABRIR', 'Abrir caja'),
(XX, 3, 'FINANZAS.CAJA.CERRAR', 'Cerrar caja'),
(XX, 4, 'FINANZAS.CAJA.AJUSTE', 'Hacer ajustes de caja');
-- etc...
```

---

## ✅ CHECKLIST DE INICIO

### Antes de comenzar Fase 1:
- [ ] Revisar este plan con el equipo
- [ ] Validar estructura de tablas existentes
- [ ] Crear rama git: `feature/finanzas-cuentas-por-cobrar`
- [ ] Configurar ambiente de desarrollo local
- [ ] Crear backup de BD producción
- [ ] Documentar APIs en Postman
- [ ] Preparar datos de prueba

---

**Última actualización:** 2026-05-29  
**Responsable:** Equipo Desarrollo KORE  
**Estado:** 📋 PLANIFICADO - Listo para iniciar
