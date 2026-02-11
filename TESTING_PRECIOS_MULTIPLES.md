# Lista de Verificación - Testing del Sistema de Precios Múltiples

## ✅ Pre-requisitos
- [ ] Base de datos migrada (tabla `productos` con 32 campos)
- [ ] Backend actualizado con nuevos endpoints
- [ ] Frontend desplegado en servidor

---

## 🧪 Pruebas Funcionales

### 1. Crear Producto con Múltiples Precios

**Pasos:**
1. Click en "Nuevo Producto"
2. Llenar campos básicos:
   - Nombre: "Laptop Dell XPS 15"
   - SKU: "DELL-XPS15-001"
   - Tipo: "Producto"
3. Precios:
   - Precio Compra: $3,000,000
   - Precio Minorista: $4,500,000
   - Click en botón "Calcular Mayorista" → Debe auto-completar: $4,050,000
   - Click en botón "Calcular Distribuidor" → Debe auto-completar: $3,600,000
4. IVA:
   - Activar checkbox "Aplica IVA"
   - Seleccionar "19%"
5. Verificar tabla resumen muestra:
   - Minorista: $4,500,000 + $855,000 = $5,355,000 (Margen: 50%)
   - Mayorista: $4,050,000 + $769,500 = $4,819,500 (Margen: 35%)
   - Distribuidor: $3,600,000 + $684,000 = $4,284,000 (Margen: 20%)

**Resultado Esperado:**
- ✅ Badges de margen se colorean correctamente (verde para >30%)
- ✅ Tabla resumen calcula IVA correctamente
- ✅ Producto se guarda exitosamente

---

### 2. Crear Servicio

**Pasos:**
1. Click en "Nuevo Producto"
2. Llenar campos:
   - Nombre: "Consultoría IT"
   - SKU: "SERV-IT-001"
   - Tipo: "Servicio" ← **Importante**
3. Verificar que:
   - Sección de inventario desaparece
   - Solo campos de precios visibles
4. Configurar precio minorista: $500,000
5. Guardar

**Resultado Esperado:**
- ✅ Sección inventario se oculta automáticamente
- ✅ En la tabla, stock muestra "N/A"
- ✅ Badge "Servicio" (azul) visible
- ✅ `maneja_inventario = 0` en base de datos

---

### 3. Validación de Jerarquía de Precios

**Pasos:**
1. Crear nuevo producto
2. Ingresar precios en orden incorrecto:
   - Precio Minorista: $100,000
   - Precio Mayorista: $120,000 ← Mayor que minorista
3. Verificar alerta: "El precio mayorista debe ser menor que el precio minorista"
4. Intentar guardar

**Resultado Esperado:**
- ✅ Alerta amarilla se muestra inmediatamente
- ✅ No se puede guardar (validación en frontend)
- ✅ Backend rechaza si se intenta forzar (validación en backend)

---

### 4. Editar Producto Existente

**Pasos:**
1. Seleccionar un producto de la tabla
2. Click en "Editar"
3. Verificar que se cargan:
   - Todos los campos correctamente
   - Badges de margen calculados
   - Tabla resumen poblada
4. Modificar precio mayorista
5. Verificar que badges y tabla se actualizan en tiempo real
6. Guardar cambios

**Resultado Esperado:**
- ✅ Producto carga todos los campos
- ✅ Cálculos en tiempo real funcionan
- ✅ Cambios se guardan correctamente

---

### 5. Producto sin IVA

**Pasos:**
1. Crear nuevo producto
2. Desactivar checkbox "Aplica IVA"
3. Ingresar precios
4. Verificar tabla resumen:
   - Columna IVA = $0.00
   - Precio Final = Precio Base

**Resultado Esperado:**
- ✅ IVA se calcula como 0
- ✅ En base de datos: `aplica_iva = 0`, `porcentaje_iva = NULL`
- ✅ En tabla principal, no muestra badge de IVA

---

### 6. Compatibilidad con Datos Viejos

**Pasos:**
1. Si tienes productos creados antes de la migración:
   - Buscar producto viejo en la tabla
   - Click en "Editar"
2. Verificar que:
   - Campo `precio_minorista` se llena con valor de `precio_venta` viejo
   - Producto se puede editar normalmente
3. Guardar con nuevos campos

**Resultado Esperado:**
- ✅ Productos viejos se cargan sin errores
- ✅ Al guardar, se actualiza estructura completa
- ✅ Tabla muestra correctamente precio minorista

---

### 7. Calculadoras Automáticas

**Pasos:**
1. Crear nuevo producto
2. Ingresar precio minorista: $100,000
3. Click en "Calcular Mayorista" (-10%)
   - Verificar resultado: $90,000
4. Click en "Calcular Distribuidor" (-20%)
   - Verificar resultado: $80,000
5. Modificar manualmente precio mayorista a $85,000
6. Verificar que:
   - Badge de margen se actualiza
   - Tabla resumen se actualiza

**Resultado Esperado:**
- ✅ Botones calculan correctamente (10% y 20% descuento)
- ✅ Se puede editar manualmente después
- ✅ Cálculos en tiempo real funcionan

---

### 8. Márgenes de Rentabilidad

**Pasos:**
1. Crear producto con diferentes márgenes:
   - **Producto A:** Compra: $100, Minorista: $105 (Margen: 5%)
   - **Producto B:** Compra: $100, Minorista: $115 (Margen: 15%)
   - **Producto C:** Compra: $100, Minorista: $125 (Margen: 25%)
   - **Producto D:** Compra: $100, Minorista: $140 (Margen: 40%)
2. Verificar colores de badges:
   - Producto A: Rojo (< 10%)
   - Producto B: Amarillo (10-20%)
   - Producto C: Info (20-30%)
   - Producto D: Verde (> 30%)

**Resultado Esperado:**
- ✅ Badges se colorizan según rango de margen
- ✅ Tabla principal muestra badges correctos
- ✅ Fácil identificación visual de productos poco rentables

---

## 🔍 Pruebas de Interfaz

### Responsive Design
- [ ] Modal se ve bien en desktop (1920x1080)
- [ ] Modal se ve bien en tablet (768px)
- [ ] Modal se ve bien en móvil (375px)
- [ ] Tabla de productos scroll horizontal en móvil

### Tiempo Real
- [ ] Badges de margen se actualizan mientras se escribe
- [ ] Tabla resumen se actualiza al cambiar precios
- [ ] Alerta de jerarquía aparece/desaparece dinámicamente
- [ ] Sección inventario se muestra/oculta según tipo

### Formato de Números
- [ ] Precios muestran formato colombiano: $1.234.567,89
- [ ] Porcentajes muestran 1 decimal: 25.5%
- [ ] Campos numéricos aceptan decimales (step="0.01")

---

## 🗄️ Pruebas de Base de Datos

### Verificar Estructura
```sql
-- Ver campos de productos
DESC productos;

-- Debe mostrar:
-- tipo, maneja_inventario
-- precio_minorista, precio_mayorista, precio_distribuidor
-- aplica_iva, porcentaje_iva, tipo_impuesto
-- cuenta_ingreso, cuenta_costo, cuenta_inventario, cuenta_gasto
```

### Verificar Datos Guardados
```sql
-- Producto con 3 precios
SELECT 
    nombre,
    tipo,
    precio_compra,
    precio_minorista,
    precio_mayorista,
    precio_distribuidor,
    aplica_iva,
    porcentaje_iva
FROM productos 
WHERE id = [ID_DEL_PRODUCTO_CREADO];
```

**Resultado Esperado:**
- ✅ Todos los campos se guardan correctamente
- ✅ Tipos de datos correctos (DECIMAL para precios, TINYINT para booleanos)
- ✅ NULL donde corresponde (precios no ingresados)

---

## 🚨 Casos Edge

### Caso 1: Precio 0
- Ingresar precio compra = 0
- Verificar que margen = 0% (no división por cero)

### Caso 2: Precio Negativo
- Intentar ingresar precio negativo
- Debe ser bloqueado por `min="0"` en HTML

### Caso 3: Solo Precio Minorista
- Crear producto con solo precio minorista
- Mayorista y distribuidor vacíos
- Verificar que:
  - Tabla resumen solo muestra fila minorista
  - Se guarda correctamente con mayorista/distribuidor = NULL

### Caso 4: IVA Personalizado
- Si se requiere IVA diferente (ej: 16%)
- Editar select de porcentajes en HTML
- Verificar que acepta valor personalizado

---

## 📊 Pruebas de Rendimiento

- [ ] Tabla con 100+ productos carga en < 2 segundos
- [ ] Filtros de búsqueda responden instantáneamente
- [ ] Cálculos en tiempo real no causan lag al escribir
- [ ] Modal abre/cierra sin delay perceptible

---

## ✅ Checklist Final

- [ ] Crear producto nuevo funciona
- [ ] Crear servicio funciona
- [ ] Editar producto funciona
- [ ] Eliminar producto funciona
- [ ] Filtros y búsqueda funcionan
- [ ] Validación de jerarquía funciona
- [ ] Cálculos de margen correctos
- [ ] Cálculos de IVA correctos
- [ ] Compatibilidad con datos viejos
- [ ] No hay errores en consola del navegador
- [ ] No hay errores en logs del backend

---

## 🐛 Reporte de Bugs

Si encuentras algún error, documentar:

```
Título: [Descripción breve]
Pasos para reproducir:
1. 
2. 
3. 

Resultado esperado:
Resultado actual:
Navegador/SO:
Captura de pantalla:
```

---

## 📝 Notas

- Los cálculos de margen son: `(precioVenta - precioCompra) / precioCompra * 100`
- La jerarquía correcta es: `distribuidor < mayorista < minorista`
- El IVA se calcula sobre el precio base, no sobre el precio con margen
- Los servicios SIEMPRE tienen `maneja_inventario = 0`

---

**Fecha:** Diciembre 2024  
**Versión:** 1.0 - Sistema de Precios Múltiples
