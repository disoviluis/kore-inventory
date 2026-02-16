# Integración de Impuestos Adicionales en Módulo de Ventas

## Resumen de Cambios - 16 de Febrero 2026

### ✅ Implementación Completada

Se ha completado exitosamente la integración del sistema de impuestos adicionales en el módulo de punto de venta (POS). Los clientes ahora pueden aplicar impuestos configurables a las ventas, como retenciones en la fuente, retención de IVA, ICA, etc.

---

## 1. Cambios en Frontend - Ventas

### 1.1 HTML (ventas.html)

**Ubicación:** Sección de Resumen de Venta (líneas 553-585)

**Cambios realizados:**
- ✅ Agregado contenedor de impuestos adicionales
- ✅ Botón colapsable para mostrar/ocultar impuestos disponibles
- ✅ Badge con contador de impuestos seleccionados
- ✅ Lista de checkboxes para seleccionar impuestos
- ✅ Sección de resumen con impuestos aplicados

**Código agregado:**
```html
<!-- Impuestos Adicionales -->
<div id="impuestosAdicionalesContainer" style="display: none;">
    <div class="mb-2">
        <button type="button" class="btn btn-sm btn-outline-secondary w-100" 
                data-bs-toggle="collapse" data-bs-target="#impuestosCollapse">
            <i class="bi bi-calculator me-2"></i>Impuestos Adicionales
            <span class="badge bg-primary ms-2" id="impuestosCount">0</span>
        </button>
    </div>
    <div class="collapse" id="impuestosCollapse">
        <div class="border rounded p-2 mb-2">
            <div id="listaImpuestosDisponibles" class="small">
                <!-- Se cargarán dinámicamente -->
            </div>
        </div>
    </div>
    <div id="resumenImpuestosAdicionales" class="small">
        <!-- Se mostrarán los impuestos aplicados -->
    </div>
</div>
```

### 1.2 JavaScript (ventas.js)

#### Variables Globales Agregadas (líneas 17-18)
```javascript
let impuestosDisponibles = [];
let impuestosSeleccionados = [];
```

#### Funciones Nuevas Implementadas

**1. cargarImpuestosActivos() - Líneas 1615-1651**
- Carga impuestos activos desde el backend
- Muestra contenedor si hay impuestos disponibles
- Selecciona automáticamente impuestos con flag `aplica_automaticamente`
- Renderiza lista y actualiza contador

**2. renderizarImpuestosDisponibles() - Líneas 1656-1686**
- Genera checkboxes para cada impuesto disponible
- Muestra badges indicando si es automático o resta
- Deshabilita impuestos automáticos que requieren autorización
- Formato visual con tasa (% o $)

**3. toggleImpuesto(impuestoId) - Líneas 1691-1703**
- Agrega/quita impuesto de la selección
- Actualiza contador de impuestos
- Recalcula totales automáticamente

#### Funciones Modificadas

**1. Inicialización (línea 63)**
```javascript
// Agregado después de cargar empresa
await cargarImpuestosActivos();
```

**2. calcularTotales() - Líneas 605-669**
```javascript
// Calcular impuestos adicionales
let totalImpuestosAdicionales = 0;
const detalleImpuestos = [];

impuestosSeleccionados.forEach(impId => {
    const imp = impuestosDisponibles.find(i => i.id === impId);
    if (imp) {
        let base = 0;
        switch(imp.aplica_sobre) {
            case 'subtotal': base = baseImponible; break;
            case 'iva': base = impuesto; break;
            case 'total': base = baseImponible + impuesto; break;
        }
        
        const valor = imp.tipo === 'porcentaje' 
            ? base * (imp.tasa / 100)
            : parseFloat(imp.tasa);
        
        const valorConSigno = imp.afecta_total === 'resta' ? -valor : valor;
        totalImpuestosAdicionales += valorConSigno;
        
        detalleImpuestos.push({...});
    }
});

const total = baseImponible + impuesto + totalImpuestosAdicionales;
```

**3. guardarVenta() - Líneas 688-721**
```javascript
// Agregar cálculo de impuestos antes de crear ventaData
const impuestosVenta = [];

impuestosSeleccionados.forEach(impId => {
    const imp = impuestosDisponibles.find(i => i.id === impId);
    if (imp) {
        // ... cálculos ...
        impuestosVenta.push({
            impuesto_id: imp.id,
            base_calculo: base,
            tasa: imp.tasa,
            valor: Math.abs(valor),
            afecta_total: imp.afecta_total
        });
    }
});

// Agregar al ventaData
const ventaData = {
    ...
    impuestos: impuestosVenta,
    ...
};
```

**4. mostrarFactura() - Líneas 1107-1122**
```javascript
// Agregar sección de impuestos en factura
${ventaData.impuestos && ventaData.impuestos.length > 0 ? 
    ventaData.impuestos.map(imp => `
        <tr>
            <td colspan="3" class="text-end">
                <strong class="${imp.afecta_total === 'resta' ? 'text-danger' : 'text-success'}">
                    ${imp.afecta_total === 'resta' ? '-' : '+'} ${imp.nombre}:
                </strong>
            </td>
            <td class="text-end ${imp.afecta_total === 'resta' ? 'text-danger' : 'text-success'}">
                ${imp.afecta_total === 'resta' ? '-' : ''}$${formatearNumero(imp.valor)}
            </td>
        </tr>
    `).join('') : ''
}
```

**5. limpiarVentaSinConfirmar() - Líneas 835-848**
```javascript
// Resetear impuestos a los automáticos
impuestosSeleccionados = impuestosDisponibles
    .filter(imp => imp.aplica_automaticamente)
    .map(imp => imp.id);

// Actualizar UI de impuestos
if (impuestosDisponibles.length > 0) {
    renderizarImpuestosDisponibles();
    document.getElementById('impuestosCount').textContent = impuestosSeleccionados.length;
}
```

---

## 2. Cambios en Backend

### 2.1 Controlador de Ventas (ventas.controller.ts)

**Línea 238:** Agregar parámetro `impuestos` a destructuring
```typescript
const {
    empresa_id,
    cliente_id,
    productos,
    subtotal,
    descuento,
    impuesto,
    total,
    metodo_pago,
    notas,
    vendedor_id,
    impuestos  // ✅ NUEVO
} = req.body;
```

**Líneas 328-346:** Insertar impuestos adicionales en venta_impuestos
```typescript
// Insertar impuestos adicionales si existen
if (impuestos && Array.isArray(impuestos) && impuestos.length > 0) {
    for (const impuesto of impuestos) {
        await query(
            `INSERT INTO venta_impuestos (
                venta_id, impuesto_id, base_calculo, tasa, valor, afecta_total
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                ventaId,
                impuesto.impuesto_id,
                impuesto.base_calculo || 0,
                impuesto.tasa || 0,
                impuesto.valor || 0,
                impuesto.afecta_total || 'suma'
            ]
        );
    }
    logger.info(`${impuestos.length} impuestos adicionales registrados para venta ${ventaId}`);
}
```

---

## 3. Flujo de Funcionamiento

### 3.1 Al Iniciar Módulo de Ventas

1. ✅ Se cargan impuestos activos de la empresa (`GET /api/impuestos/activos`)
2. ✅ Se muestran en contenedor colapsable
3. ✅ Se seleccionan automáticamente los impuestos con flag `aplica_automaticamente`
4. ✅ Se actualiza el contador de impuestos

### 3.2 Durante la Venta

1. ✅ Usuario puede expandir sección de impuestos
2. ✅ Puede seleccionar/deseleccionar impuestos (excepto los automáticos con autorización)
3. ✅ Al cambiar selección:
   - Se actualiza contador
   - Se recalculan totales automáticamente
   - Se muestran impuestos en resumen con formato (suma en verde, resta en rojo)

### 3.3 Cálculo de Totales

**Fórmula:**
```
Subtotal = Suma de productos
Descuento = Valor ingresado
Base Imponible = Subtotal - Descuento
IVA = Base Imponible × 0.19

Para cada impuesto adicional:
    Base = según "aplica_sobre" (subtotal, iva o total)
    Valor = si tipo='porcentaje': Base × (tasa/100), sino: tasa
    Efecto = si afecta_total='resta': -Valor, sino: +Valor

Total = Base Imponible + IVA + Suma(Efectos de impuestos)
```

### 3.4 Al Guardar Venta

1. ✅ Se calculan todos los impuestos seleccionados
2. ✅ Se crea registro en tabla `ventas`
3. ✅ Se crean registros en tabla `venta_detalle` (productos)
4. ✅ **NUEVO:** Se crean registros en tabla `venta_impuestos` (impuestos adicionales)
5. ✅ Se actualiza stock (excepto ventas contra pedido)
6. ✅ Se genera factura con impuestos incluidos

### 3.5 Factura Impresa

La factura ahora incluye:
- Subtotal
- Descuento (si aplica)
- IVA (19%)
- **NUEVO:** Impuestos adicionales con:
  - Color verde para impuestos que suman
  - Color rojo para retenciones que restan
  - Prefijo + o - según corresponda
- Total final

---

## 4. Ejemplos de Uso

### Ejemplo 1: Venta con Retención en la Fuente

**Configuración del Impuesto:**
- Código: RET_FUENTE
- Nombre: Retención en la Fuente (2.5%)
- Tipo: Porcentaje
- Tasa: 2.5
- Aplica sobre: Subtotal
- Afecta total: Resta
- Automático: Sí

**Venta:**
- Subtotal: $1,000,000
- IVA (19%): $190,000
- Retención Fuente (2.5%): -$25,000
- **Total: $1,165,000**

### Ejemplo 2: Venta con ICA

**Configuración del Impuesto:**
- Código: ICA_BOG
- Nombre: ICA Bogotá
- Tipo: Porcentaje
- Tasa: 0.966
- Aplica sobre: Subtotal
- Afecta total: Suma
- Automático: No

**Venta:**
- Subtotal: $5,000,000
- IVA (19%): $950,000
- ICA (0.966%): +$48,300
- **Total: $5,998,300**

### Ejemplo 3: Venta con Múltiples Impuestos

**Venta con Retención Fuente + Retención IVA:**
- Subtotal: $2,000,000
- IVA (19%): $380,000
- Retención Fuente (2.5% sobre subtotal): -$50,000
- Retención IVA (15% sobre IVA): -$57,000
- **Total: $2,273,000**

---

## 5. Base de Datos

### Tabla: venta_impuestos

```sql
CREATE TABLE venta_impuestos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venta_id INT NOT NULL,
    impuesto_id INT NOT NULL,
    base_calculo DECIMAL(10,2) NOT NULL,
    tasa DECIMAL(10,4) NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    afecta_total ENUM('suma', 'resta') DEFAULT 'suma',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    FOREIGN KEY (impuesto_id) REFERENCES impuestos(id)
);
```

### Ejemplo de Registros

```sql
-- Venta ID: 123
-- Retención en la Fuente
INSERT INTO venta_impuestos VALUES (
    NULL, 123, 1, 1000000.00, 2.5000, 25000.00, 'resta', NOW()
);

-- Retención de IVA
INSERT INTO venta_impuestos VALUES (
    NULL, 123, 2, 190000.00, 15.0000, 28500.00, 'resta', NOW()
);
```

---

## 6. API Endpoints Utilizados

### GET /api/impuestos/activos
**Descripción:** Obtiene impuestos activos de la empresa

**Request:**
```
GET http://18.191.181.99:3000/api/impuestos/activos?empresaId=1
Authorization: Bearer {token}
```

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "codigo": "RET_FUENTE",
            "nombre": "Retención en la Fuente (2.5%)",
            "tipo": "porcentaje",
            "tasa": 2.5,
            "aplica_sobre": "subtotal",
            "afecta_total": "resta",
            "aplica_automaticamente": 1,
            "requiere_autorizacion": 0,
            "activo": 1
        }
    ]
}
```

### POST /api/ventas
**Descripción:** Crea una nueva venta con impuestos adicionales

**Request:**
```json
{
    "empresa_id": 1,
    "cliente_id": 5,
    "vendedor_id": 2,
    "subtotal": 1000000,
    "descuento": 0,
    "impuesto": 190000,
    "total": 1165000,
    "metodo_pago": "efectivo",
    "notas": null,
    "productos": [
        {
            "producto_id": 10,
            "cantidad": 2,
            "precio_unitario": 500000,
            "subtotal": 1000000
        }
    ],
    "impuestos": [
        {
            "impuesto_id": 1,
            "base_calculo": 1000000,
            "tasa": 2.5,
            "valor": 25000,
            "afecta_total": "resta"
        }
    ]
}
```

---

## 7. Despliegue

### Compilación Backend
```bash
cd c:\xampp\htdocs\kore-inventory\backend
npm run build
```

### Despliegue en EC2
```bash
cd C:\Users\luis.rodriguez\Downloads
ssh -i korekey.pem ubuntu@18.191.181.99 "cd /home/ubuntu/kore-inventory && git pull origin main && cd backend && npm run build && pm2 restart kore-backend"
```

**Estado:** ✅ Desplegado exitosamente (16/02/2026)

---

## 8. Archivos Modificados

### Frontend
1. ✅ `/frontend/public/ventas.html` (líneas 553-585)
2. ✅ `/frontend/public/assets/js/ventas.js`:
   - Variables globales (líneas 17-18)
   - Inicialización (línea 63)
   - calcularTotales() (líneas 605-669)
   - guardarVenta() (líneas 688-784)
   - mostrarFactura() (líneas 1033-1122)
   - limpiarVentaSinConfirmar() (líneas 835-857)
   - Funciones nuevas (líneas 1615-1703)

### Backend
1. ✅ `/backend/src/platform/ventas/ventas.controller.ts`:
   - createVenta() parámetros (línea 238)
   - Inserción de impuestos (líneas 328-346)

---

## 9. Testing

### Casos de Prueba Sugeridos

#### Test 1: Venta sin Impuestos Adicionales
- **Setup:** Sin impuestos configurados
- **Resultado esperado:** Contenedor de impuestos oculto, venta normal

#### Test 2: Venta con Impuesto Automático
- **Setup:** Retención Fuente configurada como automática
- **Resultado esperado:** 
  - Impuesto pre-seleccionado
  - No puede desmarcarse
  - Se resta del total

#### Test 3: Venta con Impuesto Manual
- **Setup:** ICA configurado como manual
- **Resultado esperado:**
  - Usuario puede marcarlo/desmarcarlo
  - Total se actualiza dinámicamente

#### Test 4: Factura con Múltiples Impuestos
- **Setup:** Venta con 2+ impuestos
- **Resultado esperado:**
  - Todos aparecen en factura
  - Colores correctos (verde/rojo)
  - Total correcto

#### Test 5: Guardado en Base de Datos
- **Setup:** Venta con impuestos adicionales
- **Verificar:**
  - Tabla `ventas` tiene total correcto
  - Tabla `venta_impuestos` tiene registros correctos
  - Relación FK correcta

---

## 10. Próximas Mejoras (Opcional)

### Corto Plazo
- [ ] Agregar permisos para modificar impuestos en venta
- [ ] Agregar tooltips explicando cada impuesto
- [ ] Validación de permisos para autorización requerida

### Mediano Plazo
- [ ] Reportes de impuestos retenidos por período
- [ ] Exportación para contabilidad (SIIGO format)
- [ ] Certificados de retención automáticos

### Largo Plazo
- [ ] Integración con API de DIAN
- [ ] Facturación electrónica con impuestos
- [ ] Cálculos automáticos según régimen tributario

---

## 11. Soporte y Documentación

**Documentación Principal:** `/IMPUESTOS_ADICIONALES.md`

**Logs del Sistema:**
```bash
pm2 logs kore-backend
```

**Verificar Estado:**
```bash
pm2 status
```

---

## ✅ Checklist de Implementación

- [x] Módulo de administración de impuestos (CRUD)
- [x] Backend API para impuestos
- [x] Integración en módulo de ventas
- [x] Cálculo dinámico de totales
- [x] Guardado en base de datos
- [x] Visualización en factura
- [x] Reseteo al limpiar venta
- [x] Despliegue en producción
- [x] Documentación completa

---

**Fecha de Implementación:** 16 de Febrero, 2026  
**Versión:** 1.0.0  
**Estado:** ✅ Producción  
**Backend:** http://18.191.181.99:3000  
**Desarrollador:** Disovi Soft
