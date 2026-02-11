# 🚀 MEJORAS AL MÓDULO DE PRODUCTOS - ESTILO SIIGO

## 📌 RESUMEN EJECUTIVO

Este documento detalla las mejoras recomendadas para elevar el módulo de productos de KORE Inventory al nivel profesional de sistemas ERP como SIIGO, manteniendo la identidad y necesidades específicas del proyecto.

### 📄 **DOCUMENTOS RELACIONADOS**

- 📘 **Documento actual**: Mejoras generales al módulo de productos
- 💰 **[PRECIOS_MULTIPLES_Y_TRASLADOS.md](PRECIOS_MULTIPLES_Y_TRASLADOS.md)**: Sistema de 3 precios y traslados entre bodegas
- 🗄️ **[SQL/migration_productos_mejoras_siigo.sql](SQL/migration_productos_mejoras_siigo.sql)**: Script de migración completo

---

## 🔍 ANÁLISIS COMPARATIVO

### ✅ FORTALEZAS ACTUALES

| Característica | Estado | Observación |
|---------------|--------|-------------|
| Multi-empresa | ✅ Implementado | Excelente separación por `empresa_id` |
| SKU único | ✅ Implementado | Constraint `uk_empresa_sku` correcto |
| Control de stock | ✅ Implementado | Mínimo, máximo y actual |
| Categorización | ✅ Implementado | Relación con tabla categorías |
| Auditoría básica | ✅ Implementado | `created_at`, `updated_at`, `creado_por` |
| Múltiples precios | ✅ Implementado | Compra y venta |
| Unidad de medida | ✅ Implementado | Flexible (VARCHAR) |

### ⚠️ OPORTUNIDADES DE MEJORA

| Característica | Prioridad | Impacto | Estado |
|---------------|-----------|---------|--------|
| Tipo Producto/Servicio | 🔴 CRÍTICA | Alto | ❌ Falta |
| Gestión de Impuestos (IVA) | 🔴 CRÍTICA | Alto | ❌ Falta |
| **Múltiples Precios (3 niveles)** | 🔴 **CRÍTICA** | **Alto** | ❌ **Falta** |
| **Bodegas y Traslados** | 🔴 **CRÍTICA** | **Alto** | ❌ **Falta** |
| Cuentas Contables | 🟡 MEDIA | Medio | ❌ Falta |
| Historial de cambios | 🟡 MEDIA | Medio | ❌ Falta |
| Margen calculado | 🟢 BAJA | Bajo | ❌ Falta |
| Validación duplicados | 🟢 BAJA | Bajo | ⚠️ Mejorar |

---

## 🎯 NUEVAS FUNCIONALIDADES

### 1️⃣ **DIFERENCIACIÓN: PRODUCTO vs SERVICIO**

#### **Problema Actual**
No existe distinción entre productos físicos y servicios, todos se tratan igual.

#### **Solución SIIGO**
Campo `tipo` con dos valores:
- **Producto**: Maneja inventario, stock, entradas/salidas
- **Servicio**: Solo precio, sin control de inventario

#### **Implementación**
```sql
tipo ENUM('producto', 'servicio') DEFAULT 'producto'
maneja_inventario BOOLEAN DEFAULT TRUE
```

#### **Lógica de Negocio**
```javascript
if (tipo === 'servicio') {
  maneja_inventario = false;
  stock_actual = null;
  stock_minimo = null;
  stock_maximo = null;
  ubicacion_almacen = null;
}
```

#### **Beneficios**
- ✅ Registrar servicios sin inventario (consultoría, mantenimiento, etc.)
- ✅ Evitar confusión en reportes
- ✅ Cumplir normativas contables

---

### 2️⃣ **GESTIÓN DE IMPUESTOS (IVA)**

#### **Problema Actual**
No se registra información tributaria, complicando:
- Facturación electrónica
- Reportes DIAN
- Cálculo de impuestos

#### **Solución SIIGO**
```sql
aplica_iva BOOLEAN DEFAULT TRUE
porcentaje_iva DECIMAL(5,2) DEFAULT 19.00
tipo_impuesto ENUM('gravado', 'exento', 'excluido') DEFAULT 'gravado'
```

#### **Valores Permitidos (Colombia)**
| IVA | Casos de Uso |
|-----|--------------|
| 0% | Productos exentos (canasta básica) |
| 5% | Productos especiales |
| 19% | General (mayoría de productos) |

#### **Cálculo Automático**
```javascript
precioConIVA = precioVenta * (1 + (porcentajeIVA / 100))
valorIVA = precioVenta * (porcentajeIVA / 100)
```

#### **Beneficios**
- ✅ Cumplimiento legal
- ✅ Facturación correcta
- ✅ Reportes tributarios automáticos

---

### 3️⃣ **MARGEN DE UTILIDAD AUTOMÁTICO**

#### **Problema Actual**
El margen debe calcularse manualmente cada vez.

#### **Solución SIIGO**
Vista con columna calculada:

```sql
CREATE VIEW vista_productos_con_margen AS
SELECT 
    *,
    ROUND(((precio_venta - precio_compra) / precio_compra) * 100, 2) as margen_utilidad,
    (precio_venta - precio_compra) as utilidad_bruta
FROM productos;
```

#### **Mostrar en Interfaz**
```javascript
const margen = ((precioVenta - precioCompra) / precioCompra) * 100;
document.getElementById('margen').textContent = `${margen.toFixed(2)}%`;

// Validación: Precio venta no debe ser menor que compra
if (precioVenta < precioCompra) {
  mostrarAdvertencia('El precio de venta es menor al costo');
}
```

#### **Beneficios**
- ✅ Visibilidad inmediata de rentabilidad
- ✅ Alertas de márgenes negativos
- ✅ Análisis de productos más rentables

---

### 4️⃣ **SISTEMA DE MÚLTIPLES PRECIOS** 💰 **NUEVO**

#### **Problema Actual**
Solo hay un precio de venta, no se adapta a diferentes tipos de clientes.

#### **Solución SIIGO + Mejora Propia**
```sql
precio_compra DECIMAL(15,2)         -- Costo
precio_minorista DECIMAL(15,2)      -- Precio público (antes precio_venta)
precio_mayorista DECIMAL(15,2)      -- Precio para mayoristas (-10%)
precio_distribuidor DECIMAL(15,2)   -- Precio para distribuidores (-20%)
```

#### **Lógica de Negocio**
| Tipo Cliente | Precio a Usar | Descuento Típico |
|--------------|---------------|------------------|
| Minorista | precio_minorista | 0% |
| Mayorista | precio_mayorista | 10-15% |
| Distribuidor | precio_distribuidor | 20-30% |

#### **Validaciones**
```javascript
// Jerarquía de precios
precio_compra < precio_distribuidor < precio_mayorista < precio_minorista
```

#### **Beneficios**
- ✅ Precios diferenciados por tipo de cliente
- ✅ Cálculo automático de descuentos
- ✅ Márgenes por cada nivel
- ✅ Mayor flexibilidad comercial

**📘 Ver documento completo**: [PRECIOS_MULTIPLES_Y_TRASLADOS.md](PRECIOS_MULTIPLES_Y_TRASLADOS.md)

---

### 5️⃣ **BODEGAS Y TRASLADOS** 🏢 **NUEVO**

#### **Problema Actual**
No se puede gestionar inventario en múltiples ubicaciones físicas.

#### **Solución Profesional**
Sistema completo de:
- **Bodegas**: Múltiples almacenes por empresa
- **Stock distribuido**: Cada producto puede estar en varias bodegas
- **Traslados**: Movimiento controlado entre bodegas

#### **Estructura**
```sql
-- Bodegas
bodegas (id, empresa_id, codigo, nombre, responsable_id)

-- Stock por bodega
productos_bodegas (producto_id, bodega_id, stock_actual)

-- Traslados
traslados (id, bodega_origen_id, bodega_destino_id, estado)
traslados_detalle (traslado_id, producto_id, cantidad)
```

#### **Flujo de Traslado**
```
Solicitud (pendiente) → Autorización (en_transito) → Recepción (recibido)
```

#### **Beneficios**
- ✅ Control de inventario por ubicación
- ✅ Trazabilidad de movimientos
- ✅ Alertas de stock por bodega
- ✅ Reportes consolidados

**📘 Ver documento completo**: [PRECIOS_MULTIPLES_Y_TRASLADOS.md](PRECIOS_MULTIPLES_Y_TRASLADOS.md)

---

### 6️⃣ **CUENTAS CONTABLES (NIVEL PRO)**

#### **Problema Actual**
No hay integración con contabilidad.

#### **Solución SIIGO**
```sql
cuenta_ingreso VARCHAR(20)    -- PUC 4xxxxx (Ingresos)
cuenta_costo VARCHAR(20)      -- PUC 6xxxxx (Costos)
cuenta_inventario VARCHAR(20) -- PUC 1xxxxx (Activos)
cuenta_gasto VARCHAR(20)      -- PUC 5xxxxx (Gastos)
```

#### **Uso**
| Tipo | Cuenta | Ejemplo |
|------|--------|---------|
| Producto | Ingreso | 413505 - Venta de mercancía |
| Producto | Costo | 613505 - Costo de mercancía |
| Producto | Inventario | 143505 - Inventario |
| Servicio | Ingreso | 413595 - Servicio |
| Servicio | Gasto | 519595 - Otros gastos |

#### **Implementación Progresiva**
1. **Fase 1**: Agregar campos (opcional)
2. **Fase 2**: Selector de cuentas en formulario
3. **Fase 3**: Integración con módulo contable

#### **Beneficios**
- ✅ Preparación para contabilidad integrada
- ✅ Reportes financieros automáticos
- ✅ Cumplimiento normativo

---

### 7️⃣ **HISTORIAL DE CAMBIOS DE PRECIO**

#### **Problema Actual**
No se registran cambios históricos de precios.

#### **Solución SIIGO**

**Tabla adicional:**
```sql
CREATE TABLE productos_historial_precios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    producto_id INT,
    precio_compra_anterior DECIMAL(15,2),
    precio_compra_nuevo DECIMAL(15,2),
    precio_venta_anterior DECIMAL(15,2),
    precio_venta_nuevo DECIMAL(15,2),
    motivo VARCHAR(255),
    usuario_id INT,
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Trigger automático:**
```sql
CREATE TRIGGER tr_productos_precio_change
BEFORE UPDATE ON productos
FOR EACH ROW
BEGIN
    IF OLD.precio_venta != NEW.precio_venta THEN
        INSERT INTO productos_historial_precios (...)
        VALUES (...);
    END IF;
END;
```

#### **Beneficios**
- ✅ Auditoría completa
- ✅ Análisis de tendencias de precios
- ✅ Trazabilidad de cambios

---

## 🎨 MEJORAS DE INTERFAZ DE USUARIO

### **1. Formulario Dinámico según Tipo**

```javascript
// Al cambiar tipo de producto/servicio
document.getElementById('tipo').addEventListener('change', function(e) {
  const esServicio = e.target.value === 'servicio';
  
  // Ocultar/mostrar sección de inventario
  document.getElementById('seccionInventario').style.display = 
    esServicio ? 'none' : 'block';
  
  // Cambiar etiquetas
  document.getElementById('labelUnidad').textContent = 
    esServicio ? 'Unidad (Hora/Servicio/Día)' : 'Unidad de Medida';
});
```

### **2. Cálculo de Margen en Tiempo Real**

```javascript
function calcularMargen() {
  const precioCompra = parseFloat(document.getElementById('precioCompra').value) || 0;
  const precioVenta = parseFloat(document.getElementById('precioVenta').value) || 0;
  
  if (precioCompra > 0) {
    const margen = ((precioVenta - precioCompra) / precioCompra) * 100;
    const badge = document.getElementById('margenBadge');
    
    badge.textContent = `Margen: ${margen.toFixed(2)}%`;
    badge.className = margen < 0 ? 'badge bg-danger' : 
                     margen < 20 ? 'badge bg-warning' : 
                     'badge bg-success';
  }
}

// Eventos
document.getElementById('precioCompra').addEventListener('input', calcularMargen);
document.getElementById('precioVenta').addEventListener('input', calcularMargen);
```

### **3. Precio con IVA Calculado**

```javascript
function calcularPrecioConIVA() {
  const precioVenta = parseFloat(document.getElementById('precioVenta').value) || 0;
  const aplicaIVA = document.getElementById('aplicaIVA').checked;
  const porcentajeIVA = parseFloat(document.getElementById('porcentajeIVA').value) || 0;
  
  if (aplicaIVA) {
    const valorIVA = precioVenta * (porcentajeIVA / 100);
    const precioConIVA = precioVenta + valorIVA;
    
    document.getElementById('valorIVA').textContent = `$${valorIVA.toFixed(2)}`;
    document.getElementById('precioConIVA').textContent = `$${precioConIVA.toFixed(2)}`;
  }
}
```

### **4. Alertas de Stock Bajo**

```javascript
function renderProducto(producto) {
  let badgeStock = '';
  
  if (producto.maneja_inventario) {
    if (producto.stock_actual === 0) {
      badgeStock = '<span class="badge bg-danger">AGOTADO</span>';
    } else if (producto.stock_actual <= producto.stock_minimo) {
      badgeStock = '<span class="badge bg-warning">STOCK BAJO</span>';
    }
  } else {
    badgeStock = '<span class="badge bg-secondary">N/A</span>';
  }
  
  return `
    <tr>
      <td>${producto.nombre}</td>
      <td>${badgeStock}</td>
      ...
    </tr>
  `;
}
```

---

## 🔧 VALIDACIONES RECOMENDADAS

### **Backend (TypeScript)**

```typescript
// productos.controller.ts

export const createProducto = async (req: Request, res: Response) => {
  const { tipo, precio_compra, precio_venta, aplica_iva, porcentaje_iva } = req.body;
  
  // VALIDACIÓN 1: Servicios no manejan inventario
  if (tipo === 'servicio') {
    req.body.maneja_inventario = false;
    req.body.stock_actual = null;
    req.body.stock_minimo = null;
    req.body.stock_maximo = null;
  }
  
  // VALIDACIÓN 2: Advertencia si precio venta < precio compra
  if (precio_venta < precio_compra) {
    logger.warn(`Producto con margen negativo: ${req.body.nombre}`);
    // No bloquear, solo advertir
  }
  
  // VALIDACIÓN 3: IVA válido para Colombia
  if (aplica_iva && ![0, 5, 19].includes(porcentaje_iva)) {
    return errorResponse(res, 'IVA debe ser 0%, 5% o 19%', null, 400);
  }
  
  // VALIDACIÓN 4: Código único
  const existe = await query(
    'SELECT id FROM productos WHERE empresa_id = ? AND sku = ?',
    [req.body.empresa_id, req.body.sku]
  );
  
  if (existe.length > 0) {
    return errorResponse(res, 'El código SKU ya existe', null, 409);
  }
  
  // Continuar con inserción...
};
```

### **Frontend (JavaScript)**

```javascript
// Validación antes de enviar
function validarFormulario() {
  const tipo = document.getElementById('tipo').value;
  const precioCompra = parseFloat(document.getElementById('precioCompra').value);
  const precioVenta = parseFloat(document.getElementById('precioVenta').value);
  
  // Advertencia de margen negativo
  if (precioVenta < precioCompra) {
    const confirmar = confirm(
      '⚠️ ADVERTENCIA: El precio de venta es menor al costo.\n' +
      'Esto generará pérdidas. ¿Desea continuar?'
    );
    if (!confirmar) return false;
  }
  
  // Validar stock para productos
  if (tipo === 'producto') {
    const stockMinimo = parseInt(document.getElementById('stockMinimo').value);
    const stockMaximo = parseInt(document.getElementById('stockMaximo').value);
    
    if (stockMaximo && stockMaximo < stockMinimo) {
      mostrarAlerta('El stock máximo debe ser mayor al mínimo', 'danger');
      return false;
    }
  }
  
  return true;
}
```

---

## 📊 NUEVOS REPORTES RECOMENDADOS

### **1. Productos con Bajo Margen**

```sql
SELECT 
    nombre,
    precio_compra,
    precio_venta,
    ROUND(((precio_venta - precio_compra) / precio_compra) * 100, 2) as margen
FROM productos
WHERE precio_compra > 0
  AND ((precio_venta - precio_compra) / precio_compra) * 100 < 20
ORDER BY margen ASC;
```

### **2. Productos con Stock Crítico**

```sql
SELECT 
    p.nombre,
    p.stock_actual,
    p.stock_minimo,
    c.nombre as categoria
FROM productos p
LEFT JOIN categorias c ON p.categoria_id = c.id
WHERE p.maneja_inventario = TRUE
  AND p.stock_actual <= p.stock_minimo
  AND p.estado = 'activo'
ORDER BY p.stock_actual ASC;
```

### **3. Análisis de Rentabilidad**

```sql
SELECT 
    c.nombre as categoria,
    COUNT(*) as total_productos,
    AVG(ROUND(((p.precio_venta - p.precio_compra) / p.precio_compra) * 100, 2)) as margen_promedio,
    SUM(p.stock_actual * p.precio_compra) as valor_inventario,
    SUM(p.stock_actual * p.precio_venta) as valor_venta_potencial
FROM productos p
LEFT JOIN categorias c ON p.categoria_id = c.id
WHERE p.estado = 'activo'
  AND p.maneja_inventario = TRUE
GROUP BY c.nombre
ORDER BY margen_promedio DESC;
```

---

## 🎯 PLAN DE IMPLEMENTACIÓN

### **FASE 1: CRÍTICO** (Implementar YA)

- [x] Script de migración SQL
- [ ] Actualizar modelo de datos
- [ ] Agregar campo `tipo` al formulario
- [ ] Agregar gestión de IVA
- [ ] Lógica: Ocultar inventario si es servicio
- [ ] Validaciones backend

**Tiempo estimado**: 4-6 horas  
**Impacto**: ALTO

### **FASE 2: IMPORTANTE** (Próxima semana)

- [ ] Cálculo de margen en tiempo real
- [ ] Historial de precios
- [ ] Vista con margen calculado
- [ ] Alertas de stock bajo
- [ ] Validación precios negativos

**Tiempo estimado**: 6-8 horas  
**Impacto**: MEDIO

### **FASE 3: MEJORAS** (Próximo sprint)

- [ ] Cuentas contables
- [ ] Reportes avanzados
- [ ] Historial de cambios completo
- [ ] Dashboard de productos
- [ ] Exportación Excel/PDF

**Tiempo estimado**: 8-12 horas  
**Impacto**: MEDIO-BAJO

---

## 📝 UNIDADES DE MEDIDA RECOMENDADAS

### **Para Productos Físicos**
```javascript
const unidadesProducto = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'caja', label: 'Caja' },
  { value: 'paquete', label: 'Paquete' },
  { value: 'kg', label: 'Kilogramo' },
  { value: 'gramo', label: 'Gramo' },
  { value: 'tonelada', label: 'Tonelada' },
  { value: 'litro', label: 'Litro' },
  { value: 'galon', label: 'Galón' },
  { value: 'metro', label: 'Metro' },
  { value: 'bulto', label: 'Bulto' },       // ⭐ Para Baggrit
  { value: 'saco', label: 'Saco' },         // ⭐ Para Baggrit
  { value: 'arroba', label: 'Arroba' },     // ⭐ Para Baggrit
];
```

### **Para Servicios**
```javascript
const unidadesServicio = [
  { value: 'hora', label: 'Hora' },
  { value: 'dia', label: 'Día' },
  { value: 'mes', label: 'Mes' },
  { value: 'servicio', label: 'Servicio' },
  { value: 'visita', label: 'Visita' },
  { value: 'proyecto', label: 'Proyecto' },
];
```

---

## 🚨 DETALLES QUE HACEN LA DIFERENCIA

### ✅ **Checklist de Calidad Profesional**

- [x] Validar códigos duplicados
- [ ] Mostrar margen en tiempo real
- [ ] Historial de cambios
- [ ] Productos inactivos no se eliminan (soft delete)
- [ ] Alertas de stock bajo
- [ ] Búsqueda por múltiples campos (nombre, SKU, código de barras)
- [ ] Exportar a Excel
- [ ] Importar desde Excel (CSV)
- [ ] Código de barras generado automáticamente si está vacío
- [ ] Imágenes de productos (carga y preview)
- [ ] Filtros avanzados (categoría, estado, stock)
- [ ] Paginación de resultados
- [ ] Ordenamiento por columnas

---

## 💡 COMPARACIÓN FINAL

| Característica | Antes | Después | Estado |
|---------------|-------|---------|--------|
| Tipo producto/servicio | ❌ No | ✅ Sí | 🔧 Pendiente |
| Gestión IVA | ❌ No | ✅ Sí | 🔧 Pendiente |
| Margen calculado | ❌ Manual | ✅ Automático | 🔧 Pendiente |
| Historial precios | ❌ No | ✅ Sí | 🔧 Pendiente |
| Cuentas contables | ❌ No | ✅ Sí (opcional) | 🔧 Pendiente |
| Alertas stock | ⚠️ Básico | ✅ Avanzado | 🔧 Pendiente |
| Validaciones | ⚠️ Básicas | ✅ Completas | 🔧 Pendiente |

---

## 🎓 CONCLUSIONES

### **Lo que tenías bien**
- ✅ Base de datos sólida
- ✅ Multi-empresa
- ✅ SKU único
- ✅ Control de stock básico

### **Lo que faltaba (crítico)**
- 🔴 Diferenciación Producto/Servicio
- 🔴 Gestión de impuestos (IVA)
- 🟡 Cuentas contables
- 🟡 Historial de cambios

### **Próximos pasos**
1. Ejecutar script de migración SQL
2. Actualizar backend (TypeScript)
3. Actualizar frontend (HTML/JS)
4. Probar con datos reales
5. Implementar fases 2 y 3

---

## 📞 SOPORTE

Si necesitas ayuda con:
- Implementación del código
- Modificaciones a la estructura
- Nuevas funcionalidades

¡Estoy aquí para ayudarte! 🚀

---

**Documento creado**: 2026-02-11  
**Versión**: 1.0  
**Autor**: GitHub Copilot  
**Proyecto**: KORE Inventory - Disovi Soft
