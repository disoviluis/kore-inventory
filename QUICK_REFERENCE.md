# Quick Reference - Sistema de Precios Múltiples

## 🎯 Archivos Modificados

### Backend
```
✅ backend/src/platform/productos/productos.controller.ts
   - Líneas modificadas: ~150 líneas
   - Cambios: getProductos(), createProducto(), updateProducto()
```

### Frontend
```
✅ frontend/public/productos.html
   - Líneas modificadas: ~150 líneas
   - Sección modal completa rediseñada (líneas 526-730)

✅ frontend/public/assets/js/productos.js
   - Líneas modificadas: ~300 líneas
   - 5 funciones nuevas + 5 funciones modificadas
```

### Base de Datos
```
✅ SQL/migration_productos_mejoras_siigo.sql
   - Ejecutado ✅ en RDS
   - 12 campos nuevos en productos
   - 5 tablas nuevas (bodegas, traslados, etc.)
   - 3 vistas + 2 triggers
```

---

## 🔑 Campos Clave del Formulario

### IDs de Inputs (HTML)
```javascript
// Tipo
productoTipo              // 'producto' | 'servicio'
productoManejaInventario  // '0' | '1'

// Precios
productoPrecioCompra      // number
productoPrecioMinorista   // number (required)
productoPrecioMayorista   // number (optional)
productoPrecioDistribuidor // number (optional)

// IVA
productoAplicaIVA         // checkbox (boolean)
productoPorcentajeIVA     // '0' | '5' | '19'
productoTipoImpuesto      // 'gravado' | 'exento' | 'excluido'

// Badges dinámicos
margenMinorista           // span (badge)
margenMayorista           // span (badge)
margenDistribuidor        // span (badge)

// Elementos especiales
alertJerarquiaPrecios     // div (alerta de validación)
tablaResumenPrecios       // tbody (tabla dinámica)
seccionInventario         // div (mostrar/ocultar)
```

---

## 🧮 Fórmulas de Cálculo

### Margen de Ganancia
```javascript
margen = ((precioVenta - precioCompra) / precioCompra) * 100

Ejemplo:
  Compra: $50,000
  Venta: $75,000
  Margen: ((75000 - 50000) / 50000) * 100 = 50%
```

### Descuentos Automáticos
```javascript
// Mayorista (-10%)
precioMayorista = precioMinorista * 0.9

// Distribuidor (-20%)
precioDistribuidor = precioMinorista * 0.8

Ejemplo:
  Minorista: $100,000
  Mayorista: $100,000 * 0.9 = $90,000
  Distribuidor: $100,000 * 0.8 = $80,000
```

### IVA
```javascript
valorIVA = precioBase * (porcentajeIVA / 100)
precioFinal = precioBase + valorIVA

Ejemplo (19%):
  Base: $100,000
  IVA: $100,000 * 0.19 = $19,000
  Final: $100,000 + $19,000 = $119,000
```

---

## 🎨 Rangos de Color (Márgenes)

```javascript
if (margen < 10)      → badge bg-danger     (🔴 Rojo)
if (margen < 20)      → badge bg-warning    (🟡 Amarillo)
if (margen < 30)      → badge bg-info       (🔵 Azul)
if (margen >= 30)     → badge bg-success    (🟢 Verde)
```

---

## ✅ Validaciones

### Jerarquía de Precios
```javascript
✅ Válido:   distribuidor < mayorista < minorista
❌ Inválido: distribuidor >= mayorista
❌ Inválido: mayorista >= minorista
❌ Inválido: distribuidor >= minorista
```

### Porcentaje IVA
```javascript
✅ Permitido: 0, 5, 19
❌ Rechazado: Cualquier otro valor
```

### Servicios
```javascript
if (tipo === 'servicio') {
  manejaInventario = 0
  // Ocultar sección de inventario
}
```

---

## 📡 Estructura de Datos (API)

### Request (POST/PUT)
```typescript
{
  empresa_id: number,
  nombre: string,
  sku: string,
  tipo: 'producto' | 'servicio',
  maneja_inventario: 0 | 1,
  
  // Precios
  precio_compra: number,
  precio_minorista: number,
  precio_mayorista?: number | null,
  precio_distribuidor?: number | null,
  
  // IVA
  aplica_iva: 0 | 1,
  porcentaje_iva?: number | null,
  tipo_impuesto?: string | null,
  
  // Cuentas (opcional)
  cuenta_ingreso?: string | null,
  cuenta_costo?: string | null,
  cuenta_inventario?: string | null,
  cuenta_gasto?: string | null,
  
  // Inventario
  stock_actual: number,
  stock_minimo: number,
  stock_maximo?: number | null,
  unidad_medida: string,
  ubicacion_almacen: string,
  estado: 'activo' | 'inactivo'
}
```

### Response (GET)
```typescript
{
  id: number,
  empresa_id: number,
  nombre: string,
  sku: string,
  tipo: 'producto' | 'servicio',
  maneja_inventario: 0 | 1,
  
  // Precios
  precio_compra: number,
  precio_minorista: number,
  precio_mayorista: number | null,
  precio_distribuidor: number | null,
  
  // IVA
  aplica_iva: 0 | 1,
  porcentaje_iva: number | null,
  tipo_impuesto: string | null,
  
  // Márgenes calculados (desde backend)
  margen_minorista: number | null,
  margen_mayorista: number | null,
  margen_distribuidor: number | null,
  
  // Inventario
  stock_actual: number,
  stock_minimo: number,
  // ... otros campos
}
```

---

## 🔧 Funciones JavaScript Principales

### Cálculos
```javascript
calcularMargenes()             // Calcula y actualiza todos los márgenes
actualizarBadgeMargen(id, %)   // Coloriza badge según margen
updateTablaResumenPrecios()    // Actualiza tabla con IVA y márgenes
```

### Validaciones
```javascript
validarJerarquiaPrecios(min, may, dist)  // Valida orden de precios
```

### CRUD
```javascript
abrirModalNuevo()         // Abre modal vacío con defaults
editarProducto(id)        // Carga producto en modal
guardarProducto(e)        // Valida y envía a backend
```

### Helpers
```javascript
getMargenBadgeClass(margen)    // Retorna clase CSS según margen
getStockBadgeClass(act, min)   // Retorna clase CSS según stock
```

---

## 🐛 Debugging Rápido

### Error: Badges no se actualizan
```javascript
// Verificar que existen los elementos
console.log(document.getElementById('margenMinorista'));
console.log(document.getElementById('margenMayorista'));
console.log(document.getElementById('margenDistribuidor'));

// Verificar event listeners
// Debería ejecutarse calcularMargenes() al escribir precios
```

### Error: Tabla resumen vacía
```javascript
// Verificar que existe el tbody
console.log(document.getElementById('tbodyResumenPrecios'));

// Verificar valores de precios
console.log('Minorista:', document.getElementById('productoPrecioMinorista').value);
console.log('Aplica IVA:', document.getElementById('productoAplicaIVA').checked);
```

### Error: Validación no funciona
```javascript
// Verificar alerta
const alert = document.getElementById('alertJerarquiaPrecios');
console.log('Alert exists:', alert !== null);
console.log('Alert display:', alert.style.display);
```

### Error: Inventario no se oculta
```javascript
// Verificar evento de tipo
const tipoSelect = document.getElementById('productoTipo');
console.log('Tipo value:', tipoSelect.value);

const seccion = document.getElementById('seccionInventario');
console.log('Seccion display:', seccion.style.display);
```

---

## 📊 Testing Rápido

### Test 1: Crear Producto Básico
```
1. Click "Nuevo Producto"
2. Nombre: "Test Product"
3. SKU: "TEST-001"
4. Precio Compra: 100
5. Precio Minorista: 150
6. Guardar
✅ Verificar: Badge de margen = 50% (verde)
```

### Test 2: Calculadora
```
1. Precio Minorista: 100
2. Click botón mayorista (-10%)
3. Verificar: 90
4. Click botón distribuidor (-20%)
5. Verificar: 80
✅ Precios calculados correctamente
```

### Test 3: Validación
```
1. Precio Minorista: 100
2. Precio Mayorista: 120
3. Verificar: Alerta amarilla aparece
4. Intentar guardar
✅ No permite guardar (validación frontend)
```

### Test 4: Servicio
```
1. Tipo: Servicio
2. Verificar: Sección inventario desaparece
3. Guardar
4. Verificar en tabla: Badge "Servicio", Stock "N/A"
✅ Comportamiento correcto
```

---

## 🚀 Deploy Checklist

```bash
# 1. Verificar cambios locales
git status

# 2. Commit
git add .
git commit -m "feat: Sistema precios múltiples + IVA completo"

# 3. Push
git push origin main

# 4. En EC2 (SSH)
cd /ruta/proyecto
git pull
pm2 restart backend

# 5. Verificar
# - Abrir frontend en navegador
# - Crear producto de prueba
# - Verificar logs: pm2 logs backend
```

---

## 📞 Comandos Útiles

### Git
```bash
git log --oneline -5          # Ver últimos commits
git diff productos.html       # Ver cambios
git checkout -- archivo.js    # Descartar cambios
```

### PM2 (EC2)
```bash
pm2 list                      # Ver procesos
pm2 restart backend           # Reiniciar backend
pm2 logs backend --lines 50   # Ver logs
pm2 monit                     # Monitor en tiempo real
```

### MySQL
```sql
-- Ver estructura de productos
DESC productos;

-- Contar productos por tipo
SELECT tipo, COUNT(*) FROM productos GROUP BY tipo;

-- Ver productos con 3 precios
SELECT nombre, precio_minorista, precio_mayorista, precio_distribuidor 
FROM productos 
WHERE precio_mayorista IS NOT NULL 
  AND precio_distribuidor IS NOT NULL;
```

---

## 🎓 Conceptos Clave

- **Precio Minorista:** Precio al público general (retail)
- **Precio Mayorista:** Precio para clientes que compran en volumen
- **Precio Distribuidor:** Precio para revendedores autorizados
- **Margen:** Porcentaje de ganancia sobre el costo
- **IVA:** Impuesto al Valor Agregado (Colombia: 0%, 5%, 19%)
- **Servicio:** No maneja inventario físico
- **Producto:** Maneja inventario y stock

---

**Última actualización:** Diciembre 2024  
**Versión:** 1.0 - Sistema de Precios Múltiples  
**Estado:** ✅ Listo para Producción
