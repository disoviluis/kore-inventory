# Módulo de Impuestos Adicionales

## Descripción General

Sistema de configuración de impuestos adicionales para ventas, similar a SIIGO. Permite configurar impuestos personalizados como retenciones en la fuente, retención de IVA, ICA, y otros impuestos específicos de Colombia.

## Ubicación en el Sistema

**Ruta de acceso:** Dashboard → ADMINISTRACIÓN → Configuración → Impuestos

## Características Principales

### 1. Configuración de Impuestos

Cada impuesto puede configurarse con los siguientes atributos:

- **Código:** Identificador único (ej: RET_FUENTE, RET_IVA, ICA)
- **Nombre:** Nombre descriptivo del impuesto
- **Descripción:** Información adicional sobre el impuesto
- **Tipo:** 
  - Porcentaje (%)
  - Valor Fijo ($)
- **Tasa:** Valor del impuesto (porcentaje o monto fijo)
- **Orden:** Orden de aplicación del impuesto
- **Aplica Sobre:**
  - Subtotal (antes de IVA)
  - IVA (sobre el valor del IVA)
  - Total (después de IVA)
- **Afecta Total:**
  - Suma: Aumenta el total de la factura
  - Resta: Disminuye el total (retenciones)
- **Aplicación Automática:** Se aplica automáticamente en todas las ventas
- **Requiere Autorización:** Necesita autorización para aplicar/quitar
- **Cuenta Contable:** Código de cuenta contable para integración
- **Estado:** Activo/Inactivo

### 2. Ejemplos de Impuestos Colombianos

#### Retención en la Fuente (2.5%)
```
Código: RET_FUENTE
Tipo: Porcentaje
Tasa: 2.5
Aplica Sobre: Subtotal
Afecta Total: Resta
```

#### Retención de IVA (15%)
```
Código: RET_IVA
Tipo: Porcentaje
Tasa: 15
Aplica Sobre: IVA
Afecta Total: Resta
```

#### ICA Bogotá (0.966%)
```
Código: ICA_BOG
Tipo: Porcentaje
Tasa: 0.966
Aplica Sobre: Subtotal
Afecta Total: Suma
```

## Estructura de Base de Datos

### Tabla: `impuestos`

```sql
CREATE TABLE impuestos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  tipo ENUM('porcentaje', 'valor_fijo') DEFAULT 'porcentaje',
  tasa DECIMAL(10,4) NOT NULL,
  orden INT DEFAULT 0,
  aplica_sobre ENUM('subtotal', 'iva', 'total') DEFAULT 'subtotal',
  afecta_total ENUM('suma', 'resta') DEFAULT 'suma',
  aplica_automaticamente TINYINT(1) DEFAULT 0,
  requiere_autorizacion TINYINT(1) DEFAULT 0,
  cuenta_contable VARCHAR(20),
  activo TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla: `venta_impuestos`

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

## API Endpoints

### Backend (Express/TypeScript)

**Base URL:** `http://18.191.181.99:3000/api/impuestos`

#### 1. Listar Impuestos
```
GET /impuestos?empresaId={id}
Response: { success: true, data: [...] }
```

#### 2. Listar Impuestos Activos
```
GET /impuestos/activos?empresaId={id}
Response: { success: true, data: [...] }
```

#### 3. Obtener Impuesto por ID
```
GET /impuestos/:id
Response: { success: true, data: {...} }
```

#### 4. Crear Impuesto
```
POST /impuestos
Body: {
  empresa_id: number,
  codigo: string,
  nombre: string,
  tipo: 'porcentaje' | 'valor_fijo',
  tasa: number,
  aplica_sobre: 'subtotal' | 'iva' | 'total',
  afecta_total: 'suma' | 'resta',
  ...
}
Response: { success: true, data: {...} }
```

#### 5. Actualizar Impuesto
```
PUT /impuestos/:id
Body: { ... }
Response: { success: true, data: {...} }
```

#### 6. Eliminar Impuesto
```
DELETE /impuestos/:id
Response: { success: true, message: 'Impuesto eliminado' }
```

## Funcionalidades del Frontend

### 1. Interfaz Principal (Dashboard)

- **Filtros:**
  - Búsqueda por código o nombre
  - Filtro por tipo (Porcentaje/Valor Fijo)
  - Filtro por estado (Activo/Inactivo)

- **Tabla de Impuestos:**
  - Código
  - Nombre
  - Tasa
  - Aplica Sobre
  - Efecto
  - Automático
  - Estado
  - Acciones (Ver, Editar, Eliminar)

### 2. Modal de Creación/Edición

Formulario completo con validaciones para:
- Datos básicos (código, nombre, descripción)
- Configuración de cálculo (tipo, tasa, orden)
- Reglas de aplicación (sobre qué aplica, cómo afecta)
- Comportamiento (automático, autorización)
- Integración contable

### 3. Funciones JavaScript

```javascript
// Cargar y renderizar impuestos
cargarImpuestos()
renderizarTablaImpuestos(impuestos)

// CRUD operations
abrirModalImpuesto(id)
cargarDatosImpuesto(id)
guardarImpuesto()
eliminarImpuesto(id, nombre)

// Detalle
verDetalleImpuesto(id)

// Filtrado
filtrarImpuestos()
```

## Archivos del Sistema

### Backend
- `/backend/src/platform/impuestos/impuestos.controller.ts` (181 líneas)
- `/backend/src/platform/impuestos/impuestos.routes.ts` (42 líneas)
- `/backend/src/routes.ts` (modificado)

### Frontend
- `/frontend/public/dashboard.html` (modificado)
  - Líneas 255: Link en menú ADMINISTRACIÓN
  - Líneas 1065-1130: Módulo impuestos
  - Líneas 1643-1716: Modal de impuesto
- `/frontend/public/assets/js/dashboard.js` (modificado)
  - Líneas 1853-2206: Funciones de impuestos

## Próximos Pasos

### 1. Integración con Módulo de Ventas

Para aplicar los impuestos en el punto de venta:

```javascript
// En ventas.html/ventas.js
async function cargarImpuestosActivos() {
  const response = await fetch(`${API_URL}/impuestos/activos?empresaId=${empresaId}`);
  const data = await response.json();
  return data.data;
}

function calcularImpuestos(subtotal, iva) {
  const impuestosAplicables = impuestos.filter(imp => 
    imp.aplica_automaticamente || imp.selected
  );
  
  let totalImpuestos = 0;
  const detalleImpuestos = [];
  
  impuestosAplicables.forEach(imp => {
    let base = 0;
    switch(imp.aplica_sobre) {
      case 'subtotal': base = subtotal; break;
      case 'iva': base = iva; break;
      case 'total': base = subtotal + iva; break;
    }
    
    const valor = imp.tipo === 'porcentaje' 
      ? base * (imp.tasa / 100)
      : imp.tasa;
    
    const valorConSigno = imp.afecta_total === 'resta' ? -valor : valor;
    totalImpuestos += valorConSigno;
    
    detalleImpuestos.push({
      impuesto_id: imp.id,
      base_calculo: base,
      tasa: imp.tasa,
      valor: valor,
      afecta_total: imp.afecta_total
    });
  });
  
  return { totalImpuestos, detalleImpuestos };
}
```

### 2. Actualizar Cálculo de Totales en Ventas

```javascript
function calculateTotals() {
  const subtotal = calcularSubtotal();
  const iva = subtotal * 0.19; // IVA 19%
  
  // Cargar impuestos adicionales configurados
  const { totalImpuestos, detalleImpuestos } = calcularImpuestos(subtotal, iva);
  
  const total = subtotal + iva + totalImpuestos;
  
  // Actualizar UI
  document.getElementById('subtotal').textContent = formatCurrency(subtotal);
  document.getElementById('iva').textContent = formatCurrency(iva);
  document.getElementById('impuestos').textContent = formatCurrency(totalImpuestos);
  document.getElementById('total').textContent = formatCurrency(total);
  
  // Guardar para envío
  ventaActual.impuestos = detalleImpuestos;
}
```

### 3. Modificar Endpoint de Crear Venta

Actualizar el backend para guardar los impuestos de la venta en `venta_impuestos`:

```typescript
// En compras.controller.ts o ventas.controller.ts
async function crearVenta(req, res) {
  const { productos, impuestos, ...ventaData } = req.body;
  
  // Crear venta
  const [result] = await pool.query('INSERT INTO ventas SET ?', ventaData);
  const ventaId = result.insertId;
  
  // Insertar productos
  for (const prod of productos) {
    await pool.query('INSERT INTO venta_detalle SET ?', {
      venta_id: ventaId,
      ...prod
    });
  }
  
  // Insertar impuestos adicionales
  for (const imp of impuestos) {
    await pool.query('INSERT INTO venta_impuestos SET ?', {
      venta_id: ventaId,
      ...imp
    });
  }
  
  res.json({ success: true, data: { id: ventaId } });
}
```

## Estado Actual

✅ **COMPLETADO:**
- Backend CRUD completo
- Base de datos configurada (tablas ya existen en RDS)
- Frontend módulo de administración
- Navegación y menú
- Filtros y búsqueda
- Modales de creación/edición
- Auditoría de cambios

⏳ **PENDIENTE:**
- Integración con módulo de ventas
- UI para selección de impuestos en POS
- Cálculo automático en ventas
- Reportes de impuestos
- Exportación de datos contables

## Notas Importantes

1. **Seguridad:** Solo usuarios con permisos de administración deben acceder
2. **Validación:** El código del impuesto debe ser único por empresa
3. **Eliminación:** Solo se puede eliminar si no tiene ventas asociadas
4. **Orden:** Los impuestos se aplican en el orden configurado
5. **Auditoría:** Todos los cambios se registran con usuario y timestamp

## Soporte

Para dudas o problemas:
- Revisar logs del backend: `pm2 logs backend`
- Verificar conexión a base de datos RDS
- Consultar documentación de SIIGO para referencia

---

**Última actualización:** 2024
**Versión:** 1.0.0
