# Testing Sistema de Pagos Múltiples

## ✅ Implementación Completada - 16/02/2026

### 🎯 Objetivo
Permitir registrar múltiples métodos de pago en una misma venta (como SIIGO), con validación de que la suma de pagos coincida con el total de la venta.

---

## 📋 Cambios Implementados

### 1. Base de Datos
**Tabla:** `venta_pagos`

```sql
CREATE TABLE venta_pagos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venta_id INT NOT NULL,
    metodo_pago ENUM('efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'cheque', 'nequi', 'daviplata', 'otro') NOT NULL,
    monto DECIMAL(15,2) NOT NULL CHECK (monto > 0),
    referencia VARCHAR(100),
    banco VARCHAR(100),
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_venta_pago FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    INDEX idx_venta (venta_id),
    INDEX idx_metodo (metodo_pago),
    INDEX idx_fecha (created_at)
);
```

**Archivo:** `SQL/migration_pagos_multiples.sql`

### 2. Backend

**Archivo:** `backend/src/platform/ventas/ventas.controller.ts`

#### Cambios:
- ✅ Agregado parámetro `pagos: Array` en `createVenta`
- ✅ Validación: suma de pagos debe ser igual al total (tolerancia 0.01)
- ✅ Inserción de múltiples pagos en tabla `venta_pagos`
- ✅ Logging de cantidad de métodos registrados

**Validación:**
```typescript
const totalPagos = pagos.reduce((sum, p) => sum + parseFloat(p.monto), 0);
if (Math.abs(totalPagos - total) > 0.01) {
    return res.status(400).json({
        ok: false,
        msg: `La suma de pagos ($${totalPagos}) no coincide con el total ($${total})`
    });
}
```

### 3. Frontend - HTML

**Archivo:** `frontend/public/ventas.html`

#### Cambios:
- ❌ Eliminado: Select simple de método de pago único
- ✅ Agregado: Card completa de gestión de pagos con:
  - Lista dinámica de pagos agregados (`listaPagos`)
  - Resumen de pago (Total Venta, Total Pagado, Pendiente)
  - Alerta visual cuando hay saldo pendiente
  - Formulario para agregar pagos:
    - Select de método de pago (7 opciones)
    - Input de monto
    - Campos opcionales: referencia, banco
    - Botón "Agregar Pago"

### 4. Frontend - JavaScript

**Archivo:** `frontend/public/assets/js/ventas.js`

#### Variables Agregadas:
```javascript
let pagosPendientes = []; // Array de pagos múltiples
let totalVentaActual = 0; // Total de la venta actual
```

#### Funciones Agregadas:

##### `agregarPago()`
- Valida método y monto
- Verifica que no exceda el saldo pendiente
- Agrega pago al array `pagosPendientes`
- Actualiza UI

##### `renderizarPagos()`
- Muestra lista de pagos con formato
- Incluye botón de eliminar por cada pago
- Muestra referencia y banco si están disponibles

##### `eliminarPago(pagoId)`
- Elimina pago del array
- Actualiza UI

##### `calcularTotalPagado()`
- Suma todos los montos de `pagosPendientes`
- Retorna total pagado

##### `actualizarEstadoPago()`
- Actualiza resumen (Total Venta, Total Pagado, Pendiente)
- Muestra/oculta alerta de saldo pendiente
- Habilita/deshabilita botón "Guardar Venta" según:
  - Tiene cliente ✓
  - Tiene productos ✓
  - Pago completo (pendiente < 0.01) ✓

#### Funciones Modificadas:

##### `calcularTotales()`
- Actualiza `totalVentaActual` con el total calculado
- Llama a `actualizarEstadoPago()` en lugar de manejar botón directamente

##### `guardarVenta()`
- ❌ Eliminado: `metodo_pago: document.getElementById('metodoPago').value`
- ✅ Agregado: `pagos: pagosPendientes`

##### `limpiarVentaSinConfirmar()`
- Resetea `pagosPendientes = []`
- Resetea `totalVentaActual = 0`
- Limpia campos del formulario de pagos

### 5. Factura

**Archivo:** `frontend/public/assets/js/ventas.js` (función `mostrarFactura`)

#### Formato Térmico:
- Muestra sección "FORMA DE PAGO" con desglose de métodos
- Formato: `Método: $Monto`

#### Formato Carta:
- Muestra sección "FORMA DE PAGO" después de totales
- Incluye referencia si está disponible
- Formato tabla con método y monto

---

## 🧪 Casos de Prueba

### Test 1: Pago Simple (1 Método)
**Escenario:** Venta de $100,000 pagada completamente en efectivo

**Pasos:**
1. Agregar productos hasta $100,000
2. Agregar pago: Efectivo $100,000
3. Verificar que botón "Guardar" se habilite
4. Guardar venta
5. Verificar en factura que muestre "Efectivo: $100,000"

**Resultado esperado:** ✅ Venta guardada exitosamente

---

### Test 2: Pago Mixto (2 Métodos)
**Escenario:** Venta de $150,000 pagada con efectivo y tarjeta

**Pasos:**
1. Agregar productos hasta $150,000
2. Agregar pago: Efectivo $80,000
3. Agregar pago: Tarjeta Débito $70,000
4. Verificar que pendiente = $0
5. Guardar venta
6. Verificar factura muestre ambos métodos

**Resultado esperado:** ✅ Venta guardada con 2 registros en venta_pagos

---

### Test 3: Pago Múltiple (3+ Métodos)
**Escenario:** Venta de $500,000 con múltiples métodos

**Pasos:**
1. Agregar productos hasta $500,000
2. Agregar pagos:
   - Efectivo: $200,000
   - Tarjeta Crédito: $150,000
   - Nequi: $100,000
   - Transferencia: $50,000 (con referencia y banco)
3. Verificar que pendiente = $0
4. Guardar venta
5. Verificar factura muestre los 4 métodos

**Resultado esperado:** ✅ Venta guardada con 4 registros en venta_pagos

---

### Test 4: Validación Monto Excedido
**Escenario:** Intentar agregar pago mayor al pendiente

**Pasos:**
1. Agregar productos hasta $100,000
2. Agregar pago: Efectivo $80,000
3. Intentar agregar: Tarjeta $30,000 (excede pendiente de $20,000)

**Resultado esperado:** ⚠️ Alerta "El monto excede lo pendiente ($20,000)"

---

### Test 5: Validación Backend - Suma Incorrecta
**Escenario:** Manipulación del frontend (solo para desarrollo)

**Backend debe rechazar:**
```javascript
// Ejemplo de data inválida
{
    total: 100000,
    pagos: [
        { metodo_pago: 'efectivo', monto: 50000 }
    ]
    // Suma = 50000, total = 100000 ❌
}
```

**Resultado esperado:** ❌ Error 400: "La suma de pagos no coincide con el total"

---

### Test 6: Botón Guardar Deshabilitado
**Escenario:** Verificar que no se pueda guardar con pago incompleto

**Condiciones que deshabilitan el botón:**
1. No hay cliente seleccionado
2. No hay productos agregados
3. Pago incompleto (pendiente > 0.01)

**Resultado esperado:** 🔒 Botón "Guardar Venta" deshabilitado

---

### Test 7: Eliminar Pago
**Escenario:** Agregar y eliminar un pago

**Pasos:**
1. Agregar productos hasta $100,000
2. Agregar pago: Efectivo $80,000
3. Hacer clic en botón eliminar (ícono basura)
4. Verificar que pendiente vuelva a $100,000

**Resultado esperado:** ✅ Pago eliminado, estado actualizado

---

### Test 8: Limpiar Venta
**Escenario:** Botón "Nueva Venta" debe resetear pagos

**Pasos:**
1. Agregar productos y pagos
2. Hacer clic en "Nueva Venta"
3. Verificar que `listaPagos` esté vacía
4. Verificar que campos de pago estén limpios

**Resultado esperado:** ✅ Todo reseteado correctamente

---

### Test 9: Factura Térmica
**Escenario:** Verificar formato térmico muestra pagos

**Pasos:**
1. Crear venta con múltiples pagos
2. Imprimir factura térmica
3. Verificar sección "FORMA DE PAGO" con lista de métodos

**Resultado esperado:** ✅ Factura térmica correcta

---

### Test 10: Factura Carta
**Escenario:** Verificar formato carta muestra pagos

**Pasos:**
1. Crear venta con múltiples pagos (incluir referencias)
2. Imprimir factura carta
3. Verificar tabla de pagos después de totales

**Resultado esperado:** ✅ Factura carta correcta con referencias

---

## 📊 Verificación en Base de Datos

### Consulta para verificar pagos de una venta:
```sql
SELECT 
    v.id,
    v.numero_factura,
    v.total,
    vp.metodo_pago,
    vp.monto,
    vp.referencia,
    vp.banco
FROM ventas v
LEFT JOIN venta_pagos vp ON v.id = vp.venta_id
WHERE v.id = ?
ORDER BY vp.id;
```

### Consulta para verificar suma de pagos:
```sql
SELECT 
    v.id,
    v.total as total_venta,
    SUM(vp.monto) as total_pagos,
    v.total - SUM(vp.monto) as diferencia
FROM ventas v
LEFT JOIN venta_pagos vp ON v.id = vp.venta_id
WHERE v.id = ?
GROUP BY v.id;
```

**Resultado esperado:** diferencia = 0.00

---

## 🔄 Rollback (Si es necesario)

### Git:
```bash
git checkout backup/pre-pagos-multiples
```

### Base de Datos:
```bash
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com \
  -u admin -p'Kore2026!' kore_inventory \
  < backup_pre_pagos_multiples.sql
```

---

## 📝 Notas Importantes

1. **Tolerancia de Redondeo:** Backend acepta diferencia de hasta $0.01 para evitar problemas de precisión decimal
2. **Campos Opcionales:** `referencia` y `banco` no son obligatorios
3. **Métodos Disponibles:** efectivo, tarjeta_debito, tarjeta_credito, transferencia, cheque, nequi, daviplata
4. **ON DELETE CASCADE:** Si se elimina una venta, sus pagos se eliminan automáticamente
5. **Índices:** Creados en venta_id, metodo_pago y created_at para optimizar consultas

---

## ✅ Estado del Deployment

- [x] Código subido a GitHub
- [x] Git pull en EC2 exitoso
- [x] Migración SQL aplicada en RDS
- [x] Backend compilado y reiniciado
- [x] PM2 mostrando proceso online
- [x] Tabla venta_pagos creada correctamente

**Backend URL:** http://18.191.181.99:3000/api
**Estado:** ✅ Online y funcional

---

## 🎯 Próximos Pasos (Opcional)

1. **Reportes:** Agregar análisis de métodos de pago más usados
2. **Histórico:** Mostrar desglose de pagos en historial de ventas
3. **Validaciones Extra:** Límites por método de pago
4. **Integración:** Pasarelas de pago automáticas (PSE, PayU, etc.)

---

**Documentado por:** GitHub Copilot  
**Fecha:** 16 de Febrero de 2026  
**Versión:** 1.7.0 - Pagos Múltiples
