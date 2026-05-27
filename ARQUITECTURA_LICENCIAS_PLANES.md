# 🎫 ARQUITECTURA DE LICENCIAS Y PLANES - KORE INVENTORY

**Fecha:** 2026-05-27  
**Autor:** Análisis del sistema actual y recomendaciones

---

## 📊 ESTADO ACTUAL DEL SISTEMA

### **Tablas Involucradas:**

#### 1️⃣ **Tabla `empresas`**
```sql
estado ENUM('activa', 'suspendida', 'cancelada', 'trial') DEFAULT 'trial'
fecha_inicio_trial DATE
fecha_fin_trial DATE
plan_id INT (FK a planes)
```

#### 2️⃣ **Tabla `licencias`**
```sql
empresa_id INT (FK a empresas)
plan_id INT (FK a planes)
fecha_inicio DATE NOT NULL
fecha_fin DATE NOT NULL
tipo_facturacion ENUM('mensual', 'anual') DEFAULT 'mensual'
estado ENUM('activa', 'vencida', 'cancelada', 'suspendida') DEFAULT 'activa'
auto_renovacion BOOLEAN DEFAULT 1
limite_usuarios INT
limite_productos INT
limite_facturas_mes INT
monto DECIMAL(10,2)
```

#### 3️⃣ **Tabla `planes`**
```sql
nombre VARCHAR (ej: 'Basico', 'Profesional', 'Enterprise')
precio_mensual DECIMAL
precio_anual DECIMAL
max_usuarios_por_empresa INT
max_productos INT
max_facturas_mes INT
activo BOOLEAN
```

---

## 🔧 CÓMO FUNCIONA ACTUALMENTE

### **Al crear una empresa nueva:**

**Código actual en `empresas-admin.controller.ts`:**

```typescript
// Parámetros que recibe:
dias_trial = 15              // Días de prueba gratuita
tipo_facturacion = 'mensual' // 'mensual' o 'anual'
auto_renovacion = true       // ¿Se renueva automáticamente?
plan_id                      // Plan seleccionado (1=Básico, 2=Pro, etc)

// 1. Crea la EMPRESA
estado: dias_trial > 0 ? 'trial' : 'activa'
fecha_inicio_trial: HOY
fecha_fin_trial: HOY + dias_trial

// 2. Crea la LICENCIA
estado: 'activa' (siempre)
fecha_inicio: HOY
fecha_fin: 
  - Si dias_trial > 0: HOY + dias_trial
  - Si mensual: HOY + 1 mes
  - Si anual: HOY + 1 año
```

### **Problema Detectado:**

❌ **Inconsistencia de estados:**
- Empresa puede estar en `trial`
- Licencia siempre en `activa`
- No hay distinción clara entre trial y licencia pagada

❌ **Campo `estado` en licencias tenía bug:**
- Intentaba guardar `'trial'` 
- Pero ENUM solo acepta: `'activa', 'vencida', 'cancelada', 'suspendida'`
- Quedaba vacío ('')
- ✅ **YA CORREGIDO** en último commit

---

## 🎯 RECOMENDACIÓN PROFESIONAL

### **Flujo de Licencias Ideal (SaaS estándar):**

```
┌─────────────────────────────────────────────────────────────┐
│                     CICLO DE VIDA EMPRESA                    │
└─────────────────────────────────────────────────────────────┘

1. REGISTRO INICIAL (Trial Gratuito)
   ↓
   empresa.estado = 'trial'
   licencia.estado = 'activa'
   fecha_fin = HOY + 15 días (o 30 días)
   monto = 0.00

2. VENCIMIENTO TRIAL (Día 15/30)
   ↓
   empresa.estado = 'suspendida'
   licencia.estado = 'vencida'
   ⚠️ Sistema bloquea acceso
   📧 Email: "Tu trial expiró, elige un plan"

3. CLIENTE PAGA LICENCIA
   ↓
   empresa.estado = 'activa'
   licencia.estado = 'activa'
   Nueva licencia creada:
     - fecha_inicio = HOY
     - fecha_fin = HOY + 1 mes (o 12 meses si anual)
     - monto = precio del plan
     - tipo_facturacion = 'mensual' / 'anual'

4. RENOVACIÓN AUTOMÁTICA (si auto_renovacion = true)
   ↓
   Al llegar fecha_fin:
   - Se cobra automáticamente
   - Se extiende fecha_fin (+1 mes o +1 año)
   - licencia.estado sigue 'activa'

5. RENOVACIÓN MANUAL (si auto_renovacion = false)
   ↓
   Al llegar fecha_fin:
   - empresa.estado = 'suspendida'
   - licencia.estado = 'vencida'
   - ⚠️ Sistema bloquea acceso
   - 📧 Email: "Tu licencia venció, renueva ahora"
   
   Cliente paga:
   - Se crea NUEVA licencia
   - empresa.estado = 'activa'

6. CANCELACIÓN
   ↓
   empresa.estado = 'cancelada'
   licencia.estado = 'cancelada'
   cancelada_at = fecha actual
   cancelada_razon = motivo
```

---

## 📋 REGLAS DE NEGOCIO RECOMENDADAS

### ✅ **1. Trial Gratuito**

```javascript
// Una sola vez por empresa
- Duración: 15-30 días (configurable)
- Plan incluido: Básico (o el que decidas)
- Monto: $0.00
- NO requiere tarjeta de crédito al inicio
- Al vencer:
  ✓ Empresa pasa a 'suspendida'
  ✓ Licencia pasa a 'vencida'
  ✓ Se bloquea acceso al sistema
  ✓ Se envía email de "elige un plan"
```

### ✅ **2. Licencia Mensual**

```javascript
- Cobro cada mes
- fecha_fin = fecha_inicio + 1 mes
- Si auto_renovacion = true:
  ✓ Se cobra automáticamente
  ✓ fecha_fin se extiende +1 mes
  ✓ Licencia sigue 'activa'
  
- Si auto_renovacion = false:
  ✓ Al vencer, empresa pasa a 'suspendida'
  ✓ Cliente debe renovar manualmente
```

### ✅ **3. Licencia Anual**

```javascript
- Cobro una vez al año
- fecha_fin = fecha_inicio + 12 meses
- Descuento típico: 15-20% vs mensual
- Mismo comportamiento de renovación
```

### ✅ **4. Cambio de Plan (Upgrade/Downgrade)**

```javascript
// Cliente quiere cambiar de Básico a Profesional
- Opción A: Cambio inmediato
  ✓ Prorratea días restantes
  ✓ Cobra diferencia
  ✓ Nueva licencia desde HOY
  
- Opción B: Cambio al vencimiento
  ✓ Sigue con plan actual hasta fecha_fin
  ✓ Al renovar, cambia al nuevo plan
```

### ✅ **5. Estados de Empresa**

```javascript
'trial'      → En período de prueba gratuita
'activa'     → Licencia pagada y vigente
'suspendida' → Licencia vencida, acceso bloqueado
'cancelada'  → Cliente canceló definitivamente
```

### ✅ **6. Estados de Licencia**

```javascript
'activa'     → Vigente, sistema funcional
'vencida'    → Expiró, bloquear acceso
'suspendida' → Pago fallido, dar gracia de 3-7 días
'cancelada'  → Cancelada por el cliente
```

---

## 🔄 PROCESO DE VERIFICACIÓN DIARIA

**Tarea Cron (cada día a las 00:00):**

```sql
-- 1. Marcar licencias vencidas
UPDATE licencias 
SET estado = 'vencida' 
WHERE fecha_fin < CURDATE() 
  AND estado = 'activa';

-- 2. Suspender empresas con licencia vencida
UPDATE empresas e
INNER JOIN licencias l ON e.id = l.empresa_id
SET e.estado = 'suspendida'
WHERE l.estado = 'vencida' 
  AND e.estado = 'activa';

-- 3. Enviar emails de renovación próxima (7 días antes)
SELECT 
  e.id,
  e.nombre,
  e.email,
  l.fecha_fin,
  DATEDIFF(l.fecha_fin, CURDATE()) as dias_restantes
FROM empresas e
INNER JOIN licencias l ON e.id = l.empresa_id
WHERE l.estado = 'activa'
  AND DATEDIFF(l.fecha_fin, CURDATE()) = 7;
  -- Enviar email de "renueva en 7 días"

-- 4. Procesar renovaciones automáticas
SELECT 
  e.id,
  e.nombre,
  l.id as licencia_id,
  l.tipo_facturacion,
  l.monto
FROM empresas e
INNER JOIN licencias l ON e.id = l.empresa_id
WHERE l.estado = 'activa'
  AND l.auto_renovacion = 1
  AND l.fecha_fin = CURDATE();
  -- Intentar cobro automático
```

---

## 💡 MEJORAS SUGERIDAS AL CÓDIGO ACTUAL

### **1. Tabla de Historial de Pagos**

```sql
CREATE TABLE pagos_licencias (
  id INT PRIMARY KEY AUTO_INCREMENT,
  licencia_id INT NOT NULL,
  empresa_id INT NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  moneda VARCHAR(3) DEFAULT 'COP',
  tipo VARCHAR(50), -- 'mensual', 'anual', 'upgrade', 'trial'
  metodo_pago VARCHAR(50), -- 'tarjeta', 'transferencia', 'paypal'
  estado ENUM('pendiente', 'exitoso', 'fallido', 'reembolsado'),
  referencia_pago VARCHAR(100), -- ID transacción externa
  fecha_pago DATETIME,
  periodo_inicio DATE,
  periodo_fin DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (licencia_id) REFERENCES licencias(id),
  FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  INDEX idx_empresa_fecha (empresa_id, fecha_pago)
);
```

### **2. Modificar función `createEmpresa`**

```typescript
// Actualmente mezcla trial y licencia
// SEPARAR en dos funciones:

1. createEmpresaTrial() 
   - Crea empresa en trial
   - dias_trial = 15 o 30
   - monto = 0
   - Solo una vez por cliente

2. createLicenciaPagada(empresaId, planId, tipo)
   - Requiere pago confirmado
   - Crea licencia activa
   - Cambia empresa a 'activa'
   - Registra en tabla pagos_licencias
```

### **3. Agregar Middleware de Verificación**

```typescript
// middleware/checkLicencia.ts
export const verificarLicenciaActiva = async (req, res, next) => {
  const empresaId = req.user.empresa_id;
  
  const [licencia] = await pool.query(`
    SELECT estado, fecha_fin 
    FROM licencias 
    WHERE empresa_id = ? 
      AND estado = 'activa' 
      AND fecha_fin >= CURDATE()
    ORDER BY fecha_fin DESC 
    LIMIT 1
  `, [empresaId]);
  
  if (licencia.length === 0) {
    return res.status(403).json({
      success: false,
      message: 'Tu licencia ha expirado. Renueva para continuar.',
      codigo: 'LICENCIA_VENCIDA',
      accion_requerida: '/planes'
    });
  }
  
  // Advertencia si está por vencer (7 días)
  const diasRestantes = daysDiff(licencia[0].fecha_fin, new Date());
  if (diasRestantes <= 7) {
    req.licenciaAdvertencia = {
      dias_restantes: diasRestantes,
      mensaje: `Tu licencia vence en ${diasRestantes} días`
    };
  }
  
  next();
};
```

### **4. Estados en Frontend**

```javascript
// dashboard.js
// Mostrar banner según estado

if (licenciaAdvertencia) {
  // Banner amarillo: "Tu licencia vence en X días - Renovar ahora"
}

if (empresa.estado === 'trial') {
  // Banner azul: "Estás en período de prueba - X días restantes"
}

if (empresa.estado === 'suspendida') {
  // Pantalla completa roja: "Tu licencia expiró - Elige un plan"
  // Bloquear acceso a módulos
}
```

---

## 📊 RESPUESTAS A TUS PREGUNTAS

### ❓ **"Cuando creo empresa activa, ¿puedo darle trial adicional?"**

**Respuesta:** NO profesionalmente. El trial es **inicial** y **único**.

```
✅ Flujo correcto:
Empresa nueva → Trial 15 días → Vence → Cliente paga → Activa

❌ Flujo incorrecto:
Empresa activa → Le doy trial → Confusión
```

**Excepción:** Solo si es un "crédito de cortesía" por problemas técnicos.

---

### ❓ **"¿Lo mejor es crear empresa en trial 30 días y luego inactiva?"**

**Respuesta:** ✅ SÍ, exactamente. Flujo profesional:

```javascript
1. Registro → empresa 'trial', 30 días gratis
2. Día 30 → empresa 'suspendida', licencia 'vencida'
3. Cliente paga → empresa 'activa', nueva licencia
4. NO más trial nunca
```

---

### ❓ **"Empresa mensual ¿se inactiva cada mes?"**

**Respuesta:** Depende de `auto_renovacion`:

```javascript
// CON auto_renovacion = true (recomendado)
Día 1: Cliente paga $15.99
Día 30: Sistema cobra automáticamente → Extiende +30 días
Día 60: Sistema cobra automáticamente → Extiende +30 días
// Cliente activo mientras pague

// CON auto_renovacion = false
Día 1: Cliente paga $15.99
Día 30: Empresa pasa a 'suspendida'
Cliente debe renovar manualmente
```

---

### ❓ **"¿Licencia anual no se debe inactivar cada mes?"**

**Respuesta:** ✅ CORRECTO. Por eso existe `tipo_facturacion`:

```javascript
tipo_facturacion = 'mensual' → fecha_fin = +1 mes, cobra cada mes
tipo_facturacion = 'anual'   → fecha_fin = +12 meses, cobra una vez

// Ventaja anual: 
// Precio mensual: $15.99 x 12 = $191.88
// Precio anual: $159.90 (ahorro 17%)
```

---

## 🚀 PLAN DE IMPLEMENTACIÓN RECOMENDADO

### **Fase 1: Fix Inmediato (Ya hecho ✅)**
- [x] Corregir bug de estado vacío en licencias
- [x] Licencias siempre 'activa' al crear

### **Fase 2: Corto Plazo (1-2 semanas)**
- [ ] Crear tabla `pagos_licencias`
- [ ] Separar `createEmpresaTrial` de `createLicenciaPagada`
- [ ] Implementar middleware `verificarLicenciaActiva`
- [ ] Script cron para verificación diaria

### **Fase 3: Mediano Plazo (1 mes)**
- [ ] Integrar pasarela de pagos (Stripe/PayU/Mercado Pago)
- [ ] Sistema de renovación automática
- [ ] Emails de notificación (vencimiento, renovación)
- [ ] Dashboard de facturación para clientes

### **Fase 4: Largo Plazo (2-3 meses)**
- [ ] Sistema de upgrade/downgrade de planes
- [ ] Prorratas y reembolsos
- [ ] Reportes financieros
- [ ] Facturación electrónica DIAN

---

## 📌 CONCLUSIÓN

**Estado Actual:**
- ✅ Base de datos bien diseñada
- ⚠️ Lógica de negocio mezclada (trial + licencia)
- ⚠️ Falta verificación de vencimiento
- ⚠️ No hay historial de pagos

**Recomendación:**
1. **Trial único de 30 días** (gratis, sin tarjeta)
2. Al vencer → **empresa suspendida**
3. Cliente paga → **nueva licencia activa**
4. **Renovación automática** por defecto
5. **Verificación diaria** con cron
6. **Middleware** que bloquea acceso si venció

**Beneficios:**
- 💰 Flujo de ingresos predecible
- 🔒 Control de acceso automático
- 📊 Métricas claras (churn, MRR, ARR)
- 😊 Experiencia de usuario profesional

---

**¿Implementamos estas mejoras?** 🚀
