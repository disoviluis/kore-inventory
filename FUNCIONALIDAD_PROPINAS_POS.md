# 🎉 FUNCIONALIDAD DE PROPINAS EN PUNTO DE VENTA

## 📋 Resumen

Se ha implementado la funcionalidad de propinas en el módulo de punto de venta (POS), permitiendo a los clientes dejar propina voluntaria por el servicio recibido.

**Fecha de implementación:** 2026-06-13  
**Módulos afectados:** Ventas (Frontend + Backend), Base de datos

---

## ✨ Características Implementadas

### 1. **Checkbox de Propina Voluntaria**
- El cliente puede activar/desactivar la propina mediante un checkbox
- Cuando se activa, se muestra un campo para ingresar el porcentaje deseado

### 2. **Cálculo Automático de Propina**
- La propina se calcula sobre el **NETO** (consumos sin descuento)
- **NO** afecta la base gravable del IVA
- Porcentaje sugerido: 5% (configurable)
- Botones rápidos: 5%, 10%, 15%, 20%

### 3. **Estructura del Resumen de Venta**

```
┌─────────────────────────────────┐
│ RESUMEN DE VENTA                │
├─────────────────────────────────┤
│ Consumos (neto):    $ 95,238.10 │
│ Descuento:          $     0.00  │
│ IVA 5%:             $  4,761.90 │
├─────────────────────────────────┤
│ Total Factura:      $100,000.00 │
│ 🎉 Propina 5%:      $  4,761.90 │
├─────────────────────────────────┤
│ TOTAL A PAGAR:      $104,761.90 │
└─────────────────────────────────┘
```

### 4. **Interfaz de Usuario**

**Sección de Propina:**
- ✅ Checkbox: "¿Desea dejar propina por el servicio?"
- 📊 Campo de porcentaje (0-100%)
- 💰 Valor calculado en tiempo real
- 🔘 Botones rápidos (5%, 10%, 15%, 20%)
- ℹ️ Mensaje informativo: "La propina se calcula sobre el consumo neto"

---

## 🔧 Cambios Técnicos

### 📊 Base de Datos

**Tabla:** `ventas`

Campos agregados:
```sql
propina_habilitada   BOOLEAN       DEFAULT FALSE  -- Indica si se activó propina
propina_porcentaje   DECIMAL(5,2)  DEFAULT 0.00   -- % de propina (ej: 5.00)
propina_valor        DECIMAL(15,2) DEFAULT 0.00   -- Valor en pesos
propina_base         DECIMAL(15,2) DEFAULT 0.00   -- Base de cálculo (subtotal)
```

**Índice agregado:**
```sql
idx_propina_habilitada (propina_habilitada, empresa_id, fecha_venta)
```

**Script de migración:** `SQL/migration_2026_06_13_agregar_propina_ventas.sql`

---

### 💻 Frontend

#### **Archivos modificados:**

1. **ventas.html**
   - Nuevo resumen de venta profesional
   - Sección de propina con checkbox y controles
   - Botones rápidos de porcentaje

2. **ventas.js**
   - Función `calcularTotales()` actualizada:
     - Calcula propina sobre subtotal (neto)
     - Muestra Total Factura y Total A Pagar
   - Función `guardarVenta()` actualizada:
     - Envía datos de propina al backend
   - Nueva función `setPropinaPorcentaje(porcentaje)`
   - Event listeners para checkbox y campo de propina
   - Plantilla de impresión tirilla actualizada

#### **Flujo de Cálculo:**

```javascript
1. Subtotal = Suma de productos
2. Descuento = Valor ingresado
3. Base Imponible = Subtotal - Descuento
4. IVA = Base Imponible × 19%
5. Total Factura = Base Imponible + IVA + Impuestos Adicionales

// PROPINA (si está habilitada)
6. Propina = Subtotal × (Porcentaje / 100)  // Sobre el NETO
7. TOTAL A PAGAR = Total Factura + Propina
```

---

### 🔌 Backend

#### **Archivo modificado:** `backend/src/platform/ventas/ventas.controller.ts`

**Cambios realizados:**

1. **Destructuring de req.body:**
```typescript
const {
  // ... campos existentes
  propina_habilitada,
  propina_porcentaje,
  propina_valor,
  propina_base
} = req.body;
```

2. **INSERT actualizado:**
```sql
INSERT INTO ventas (
  ..., 
  propina_habilitada, propina_porcentaje, propina_valor, propina_base
) VALUES (?, ..., ?, ?, ?, ?)
```

3. **Valores insertados:**
```typescript
[
  // ... valores existentes
  propina_habilitada || false,
  propina_porcentaje || 0,
  propina_valor || 0,
  propina_base || 0
]
```

---

## 📄 Impresión de Facturas

### Plantilla Tirilla (Térmica) Actualizada

Muestra propina cuando está habilitada:

```
==========================================
         FACTURA ELECTRÓNICA
==========================================
Consumos (neto):          $ 95,238.10
Descuento:                $      0.00
IVA 19%:                  $  4,761.90
------------------------------------------
Total Factura:            $100,000.00
🎉 Propina 5%:            $  4,761.90
------------------------------------------
TOTAL:                    $104,761.90
==========================================
```

---

## ✅ Correcciones en Descuento

### Problema Encontrado
El descuento no se restaba correctamente del subtotal en ciertas situaciones.

### Solución Implementada
- El descuento ahora se resta **antes** de calcular el IVA
- La base imponible es: `subtotal - descuento`
- El IVA se calcula proporcionalmente sobre productos gravados

**Fórmula corregida:**
```javascript
const baseImponible = subtotal - descuento;
const factorDescuento = descuento > 0 ? (1 - descuento / subtotal) : 1;
const subtotalProducto = parseFloat(p.subtotal) * factorDescuento;
impuesto += subtotalProducto * porcentaje;
```

---

## 🚀 Despliegue

### Pasos para Deploy

#### 1. **Ejecutar Migración SQL**
```bash
# Conectar al servidor
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99

# Conectar a MySQL (RDS)
mysql -h [RDS_HOST] -u [DB_USER] -p[DB_PASSWORD] kore_inventory

# Ejecutar migración
SOURCE /home/ubuntu/kore-inventory/SQL/migration_2026_06_13_agregar_propina_ventas.sql;

# Verificar campos agregados
DESCRIBE ventas;
```

#### 2. **Desplegar Frontend y Backend**
```bash
# Ejecutar desde tu PC:
deploy_propinas.bat
```

O manualmente:
```bash
# Local
git add .
git commit -m "feat: agregar funcionalidad de propinas en POS"
git push origin main

# Servidor
ssh -i korekey.pem ubuntu@18.191.181.99
cd /home/ubuntu/kore-inventory
git pull origin main
cd backend
npm run build
pm2 restart kore-backend
```

---

## 🧪 Pruebas

### Casos de Prueba

#### ✅ Caso 1: Venta con propina del 5%
```
Consumos (neto):    $ 100,000.00
Descuento:          $       0.00
IVA 19%:            $  19,000.00
Total Factura:      $ 119,000.00
Propina 5%:         $   5,000.00  (sobre $100,000)
TOTAL A PAGAR:      $ 124,000.00
```

#### ✅ Caso 2: Venta con descuento Y propina
```
Consumos (neto):    $ 100,000.00
Descuento:          $  10,000.00
IVA 19%:            $  17,100.00  (sobre $90,000)
Total Factura:      $ 107,100.00
Propina 10%:        $  10,000.00  (sobre $100,000 neto)
TOTAL A PAGAR:      $ 117,100.00
```

#### ✅ Caso 3: Venta sin propina
```
Consumos (neto):    $ 100,000.00
Descuento:          $       0.00
IVA 19%:            $  19,000.00
Total Factura:      $ 119,000.00
Propina:            $       0.00  (checkbox no marcado)
TOTAL A PAGAR:      $ 119,000.00
```

#### ✅ Caso 4: Venta con impuestos adicionales + propina
```
Consumos (neto):         $ 100,000.00
Descuento:               $       0.00
IVA 19%:                 $  19,000.00
Impoconsumo 8%:          $   8,000.00
Total Factura:           $ 127,000.00
Propina 15%:             $  15,000.00  (sobre $100,000)
TOTAL A PAGAR:           $ 142,000.00
```

---

## 📊 Reportes y Consultas

### Consultas Útiles

#### **Ventas con propina del día:**
```sql
SELECT 
  v.numero_factura,
  v.subtotal,
  v.total,
  v.propina_porcentaje,
  v.propina_valor,
  c.razon_social
FROM ventas v
JOIN clientes c ON v.cliente_id = c.id
WHERE v.propina_habilitada = TRUE
  AND DATE(v.fecha_venta) = CURDATE()
  AND v.empresa_id = ?
ORDER BY v.fecha_venta DESC;
```

#### **Total de propinas del mes:**
```sql
SELECT 
  SUM(propina_valor) as total_propinas,
  AVG(propina_porcentaje) as promedio_porcentaje,
  COUNT(*) as ventas_con_propina
FROM ventas
WHERE propina_habilitada = TRUE
  AND MONTH(fecha_venta) = MONTH(CURDATE())
  AND YEAR(fecha_venta) = YEAR(CURDATE())
  AND empresa_id = ?;
```

#### **Propinas por vendedor:**
```sql
SELECT 
  u.nombre,
  u.apellido,
  COUNT(v.id) as ventas_con_propina,
  SUM(v.propina_valor) as total_propinas,
  AVG(v.propina_porcentaje) as promedio_porcentaje
FROM ventas v
JOIN usuarios u ON v.vendedor_id = u.id
WHERE v.propina_habilitada = TRUE
  AND v.empresa_id = ?
GROUP BY v.vendedor_id
ORDER BY total_propinas DESC;
```

---

## 🔐 Reglas de Negocio

1. **La propina es VOLUNTARIA**
   - Requiere aceptación explícita del cliente (checkbox)
   - Por defecto está desactivada

2. **Base de cálculo**
   - La propina se calcula sobre el SUBTOTAL (neto, sin descuento)
   - NO se incluye en la base gravable del IVA

3. **Porcentajes permitidos**
   - Rango: 0% - 100%
   - Sugerencia inicial: 5%
   - Incrementos: 0.5%

4. **Impresión**
   - Si propina > 0: Se muestra desglosada en factura
   - Si propina = 0: No se muestra en factura

5. **Pagos**
   - La propina forma parte del TOTAL A PAGAR
   - Debe incluirse en el cálculo de vueltas

---

## 📝 Notas Importantes

⚠️ **La propina NO es un impuesto:**
- No afecta la base gravable del IVA
- Es un cargo adicional voluntario
- Se suma al final (después de impuestos)

⚠️ **Contabilidad:**
- La propina debe registrarse en cuenta separada
- Consultar con contador para tratamiento contable
- Puede tener implicaciones laborales (propinas a empleados)

⚠️ **Aspectos Legales:**
- Verificar regulación local sobre propinas
- Algunas jurisdicciones requieren informar propinas
- Puede afectar declaración de impuestos

---

## 🔄 Rollback

Si necesitas revertir esta funcionalidad:

```sql
ALTER TABLE ventas 
DROP COLUMN propina_habilitada,
DROP COLUMN propina_porcentaje,
DROP COLUMN propina_valor,
DROP COLUMN propina_base,
DROP INDEX idx_propina_habilitada;
```

**Nota:** Esto eliminará permanentemente los datos de propinas registrados.

---

## 📞 Soporte

**Autor:** GitHub Copilot  
**Fecha:** 2026-06-13  
**Versión:** 1.0

Para dudas o problemas:
1. Revisar logs: `pm2 logs kore-backend --lines 100`
2. Verificar consola del navegador (F12)
3. Revisar datos en base de datos

---

## ✅ Checklist de Verificación

Después del deploy, verificar:

- [ ] Migración SQL ejecutada correctamente
- [ ] Campos visibles en tabla `ventas`
- [ ] Checkbox de propina aparece en POS
- [ ] Cálculo de propina funciona correctamente
- [ ] Total se actualiza al activar/desactivar propina
- [ ] Botones rápidos funcionan (5%, 10%, 15%, 20%)
- [ ] Propina se guarda en base de datos
- [ ] Factura impresa muestra propina correctamente
- [ ] Descuento funciona correctamente
- [ ] No hay errores en consola del navegador
- [ ] Backend acepta datos sin errores

---

**¡Funcionalidad de propinas implementada exitosamente! 🎉**
