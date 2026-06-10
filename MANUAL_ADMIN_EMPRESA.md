# 📊 MANUAL DEL ADMINISTRADOR DE EMPRESA
## KORE Inventory - Gestión Completa de tu Negocio

---

## 🎯 TU ROL: ADMINISTRADOR DE EMPRESA

Como **Administrador de Empresa**, eres el responsable de:

✅ **Configurar tu empresa** (facturación, plantillas, impuestos)  
✅ **Gestionar tu equipo** (crear usuarios y asignar roles)  
✅ **Administrar productos** (catálogo, precios, inventario)  
✅ **Gestionar proveedores y compras**  
✅ **Supervisar ventas y reportes**  
✅ **Configurar bodegas y traslados**  

💡 **Importante**: Solo administras TU empresa, no tienes acceso a otras empresas del sistema.

---

## 🚀 PRIMEROS PASOS

### 1. Acceso al Sistema

**URL:** http://18.191.181.99/  
**Usuario:** [Tu email]  
**Contraseña:** [Contraseña temporal]  

⚠️ **IMPORTANTE**: Cambia tu contraseña al primer ingreso:
1. Haz clic en tu nombre (navbar superior)
2. "Mi Perfil" → "Cambiar Contraseña"
3. Usa una contraseña segura (min. 8 caracteres)

---

### 2. Dashboard - Tu Pantalla Principal

Al iniciar sesión verás el **Dashboard** con:

📊 **Estadísticas del día:**
- Ventas de hoy
- Productos más vendidos
- Cuentas por cobrar
- Alertas de inventario

📈 **Gráficas:**
- Ventas por día/semana/mes
- Productos con bajo stock
- Ventas por categoría

---

## ⚙️ CONFIGURACIÓN INICIAL

### Paso 1: Verificar Datos de tu Empresa

1. Ve a **Configuración → Información de Empresa**
2. Revisa y completa:
   - Razón Social
   - NIT
   - Dirección completa
   - Teléfonos y email
   - Logo de la empresa (súbelo aquí)

💡 **Tip**: Estos datos aparecerán en tus facturas.

---

### Paso 2: Configurar Facturación Electrónica

Si vas a emitir **facturación electrónica**:

1. Ve a **Configuración → Facturación**

2. Completa los **Datos DIAN**:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **Régimen** | Común o Simplificado | Común |
| **Responsabilidad** | Código DIAN | O-13 |
| **Prefijo** | Prefijo autorizado | "FE" |
| **Resolución** | Número resolución DIAN | 18762000001234 |
| **Fecha inicio** | Inicio autorización | 01/01/2026 |
| **Fecha fin** | Fin autorización | 31/12/2026 |
| **Desde** | Primer número | 1 |
| **Hasta** | Último número | 5000 |

3. **Plantilla de Factura**:
   - Encabezado: Texto que aparece arriba
   - Pie de página: Texto que aparece abajo
   - Logo: Sube tu logo

4. Guarda

⚠️ **CRÍTICO**: Sin estos datos NO podrás facturar electrónicamente.

---

### Paso 3: Configurar Impuestos

**Impuesto por Defecto: IVA**

Ya está configurado (0%, 5%, 19%). Puedes crear **impuestos adicionales**:

1. Ve a **Configuración → Impuestos**
2. Haz clic en **"+ Nuevo Impuesto"**

**Ejemplo: Impoconsumo (Bebidas Alcohólicas)**
- Nombre: "Impoconsumo"
- Tipo: Porcentaje
- Tasa: 8%
- Aplica sobre: Subtotal
- Afecta total: Suma

3. Asigna el impuesto a productos específicos

---

## 👥 GESTIÓN DE ROLES Y USUARIOS

### ¿Qué son los Roles?

Los **roles** definen QUÉ puede hacer cada usuario en el sistema.

**Roles Predeterminados:**
- ✅ **Administrador** (tú) - Acceso total
- ✅ **Cajero** - Solo punto de venta
- ✅ **Inventario** - Productos, compras, stock
- ✅ **Vendedor** - Ventas y clientes

---

### Crear Rol Personalizado

Si necesitas un rol específico para tu negocio:

1. Ve a **Configuración → Roles y Permisos**
2. Haz clic en **"+ Nuevo Rol"**
3. Define:
   - **Nombre**: Ej: "Mesero", "Supervisor Turno Noche"
   - **Descripción**: Para qué sirve

4. **Selecciona permisos por módulo**:

| Módulo | Permisos | Ejemplo (Mesero) |
|--------|----------|------------------|
| Dashboard | Ver | ✅ |
| Ventas | Crear, Ver | ✅ Crear, ✅ Ver |
| Productos | Ver | ✅ Ver |
| Clientes | Crear, Ver | ✅ Crear, ✅ Ver |
| Reportes | Ver | ❌ |
| Configuración | - | ❌ |

5. Guarda el rol

---

### Crear Usuario

1. Ve a **Configuración → Usuarios**
2. Haz clic en **"+ Nuevo Usuario"**

3. Completa:
   - **Nombre completo**
   - **Email** (será su usuario de login)
   - **Teléfono**
   - **Contraseña temporal**
   - **Rol**: Selecciona el rol apropiado
   - **Estado**: Activo

4. Guarda

5. **Entrega credenciales al usuario**:
   - URL: http://18.191.181.99/
   - Usuario: [email]
   - Contraseña: [contraseña temporal]
   - Manual según su rol

💡 **Tip**: Pídele que cambie su contraseña al primer login.

---

### Gestionar Usuarios Existentes

**Editar usuario:**
- Cambiar rol
- Cambiar nombre/teléfono
- Resetear contraseña

**Desactivar usuario:**
- Cuando un empleado ya no trabaja
- El usuario no podrá iniciar sesión
- Sus datos históricos se conservan

**Reactivar usuario:**
- Si el empleado regresa

---

## 📦 GESTIÓN DE PRODUCTOS

### Paso 1: Crear Categorías

Primero organiza tu catálogo:

1. Ve a **Productos → Categorías**
2. Crea categorías según tu negocio:

**Ejemplo (Restaurante):**
- 🍔 Alimentos
- 🍺 Bebidas
- 🍻 Licores
- 🍰 Postres

**Ejemplo (Tienda):**
- 👕 Ropa
- 👟 Calzado
- 👜 Accesorios
- 🎒 Equipaje

---

### Paso 2: Crear Producto

1. Ve a **Productos → + Nuevo Producto**

2. **Información Básica:**
   - **Nombre**: Nombre comercial
   - **SKU**: Código único (Ej: "BEB-001")
   - **Código de barras**: Si tiene
   - **Categoría**: Selecciona
   - **Descripción**: Descripción detallada

3. **Precios e Impuestos:**
   - **Precio de compra**: Lo que te cuesta
   - **Precio de venta**: Lo que cobras
   - **% Utilidad**: Se calcula automáticamente
   - **IVA**: 0%, 5% o 19%
   - **Impuestos adicionales**: Si aplica

4. **Inventario:**
   - **Stock inicial**: Cantidad actual
   - **Stock mínimo**: Para alertas (Ej: 10 unidades)
   - **Unidad medida**: Unidad, Kg, Litro, etc.
   - **Bodega**: Bodega principal por defecto

5. **Imagen del producto** (Opcional):
   - Sube una foto del producto

6. Guarda

---

### Paso 3: Importar Productos Masivamente

Si tienes muchos productos:

1. Ve a **Productos → Importar**
2. Descarga la **plantilla Excel**
3. Completa la plantilla:
   - Una fila por producto
   - Todos los campos requeridos
4. Sube el archivo
5. El sistema importa todos los productos

⚠️ **Importante**: Verifica que no haya errores en la plantilla antes de importar.

---

## 🏬 GESTIÓN DE PROVEEDORES

### Crear Proveedor

1. Ve a **Proveedores → + Nuevo Proveedor**

2. Completa:
   - **Razón Social o Nombre**
   - **NIT o Documento**
   - **Email y Teléfono**
   - **Dirección**
   - **Persona de contacto**
   - **Condiciones de pago**: 
     - Contado
     - 15 días
     - 30 días
     - 60 días

3. Guarda

---

## 🛒 GESTIÓN DE COMPRAS

### Registrar Compra

Cuando recibes mercancía de un proveedor:

1. Ve a **Compras → + Nueva Compra**

2. **Selecciona proveedor**

3. **Agrega productos**:
   - Producto
   - Cantidad recibida
   - Precio de compra unitario
   - El subtotal se calcula solo

4. **Detalles de la compra**:
   - **Fecha de compra**
   - **Número de factura** del proveedor
   - **Forma de pago**: Efectivo, Crédito, etc.
   - **Observaciones**

5. Guarda

✅ **Resultado**:
- El inventario se actualiza AUTOMÁTICAMENTE (suma stock)
- Se registra el costo de compra
- Queda el historial

---

## 📊 BODEGAS Y TRASLADOS

### Crear Bodega

Si tienes múltiples ubicaciones:

1. Ve a **Inventario → Bodegas**
2. Haz clic en **"+ Nueva Bodega"**
3. Completa:
   - Nombre: "Bodega Principal", "Tienda Centro", "Cocina"
   - Código: "BOD-01"
   - Responsable: Usuario encargado
   - Dirección

---

### Trasladar entre Bodegas

Para mover productos de una bodega a otra:

1. Ve a **Inventario → Traslados**
2. **+ Nuevo Traslado**
3. Selecciona:
   - **Bodega origen**
   - **Bodega destino**
   - **Productos y cantidades**
4. Guarda

✅ El sistema resta del origen y suma al destino automáticamente.

---

## 📈 REPORTES

### Reportes Disponibles

1. **Reporte de Ventas**:
   - Por día, semana, mes, año
   - Por producto
   - Por vendedor
   - Por forma de pago

2. **Reporte de Inventario**:
   - Stock actual
   - Productos con bajo stock
   - Movimientos de inventario
   - Valorización del inventario

3. **Reporte de Compras**:
   - Por proveedor
   - Por período
   - Costo de mercancía vendida

4. **Reporte de Clientes**:
   - Clientes más frecuentes
   - Cuentas por cobrar

---

### Generar Reporte

1. Ve a **Reportes**
2. Selecciona el tipo de reporte
3. Define filtros:
   - Rango de fechas
   - Producto/categoría específica
   - Usuario/vendedor
4. Visualiza en pantalla
5. **Exportar**:
   - PDF
   - Excel
   - Imprimir

---

## 🎓 CAPACITAR A TU EQUIPO

### Checklist de Capacitación

Antes de que un nuevo usuario empiece a trabajar:

**Cajero:**
- [ ] Entregar manual de cajero
- [ ] Mostrar cómo hacer una venta
- [ ] Practicar con venta de prueba
- [ ] Enseñar turno de caja
- [ ] Explicar cuentas abiertas (si aplica)
- [ ] Dar credenciales
- [ ] Supervisar primeras ventas reales

**Inventario:**
- [ ] Entregar manual de inventario
- [ ] Mostrar cómo crear productos
- [ ] Explicar ajustes de inventario
- [ ] Enseñar registro de compras
- [ ] Practicar con datos de prueba
- [ ] Dar credenciales
- [ ] Supervisar primeras operaciones

---

## 💰 CUADRE DIARIO

### Procedimiento Recomendado

**Al final de cada día:**

1. **Revisar ventas del día**:
   - Ve a Reportes → Ventas del día
   - Verifica número de transacciones
   - Total vendido

2. **Verificar formas de pago**:
   - Total en efectivo
   - Total en tarjetas
   - Total en transferencias
   - Total en otros

3. **Cuadrar caja**:
   - Contar efectivo físico
   - Comparar con efectivo esperado
   - Investigar diferencias

4. **Revisar cuentas abiertas**:
   - Verificar que mesas/habitaciones estén correctas
   - Cerrar las que se puedan

5. **Hacer backup** (si aplica):
   - Exportar reporte del día
   - Guardar copia de seguridad

---

## ❓ PROBLEMAS COMUNES

### "No puedo crear usuarios"
**Solución:**
- ✔️ Solo el Administrador puede crear usuarios
- ✔️ Verifica tu rol en: Perfil → Ver Rol

### "El producto no aparece en ventas"
**Solución:**
- ✔️ El producto debe estar activo
- ✔️ Debe tener stock > 0
- ✔️ Debe tener precio de venta configurado

### "Error de numeración de facturas"
**Solución:**
- ✔️ Revisa que no hayas agotado la numeración
- ✔️ Ve a Configuración → Facturación
- ✔️ Verifica rangos autorizados
- ✔️ Solicita nueva resolución DIAN si se agotó

### "Diferencias en inventario"
**Solución:**
- ✔️ Haz conteo físico
- ✔️ Usa Ajustes de Inventario
- ✔️ Investiga: Robos, mermas, errores de registro

---

## 🛡️ SEGURIDAD Y BUENAS PRÁCTICAS

### ✅ Seguridad
- Cambia tu contraseña cada 3 meses
- No compartas tus credenciales con NADIE
- Cierra sesión al terminar tu jornada
- Revisa periódicamente usuarios activos

### ✅ Respaldos
- Exporta reportes importantes semanalmente
- Guarda copias de facturas electrónicas
- Documenta cambios importantes

### ✅ Auditoría
- Revisa logs de usuarios (cuando esté disponible)
- Verifica ventas anuladas
- Monitorea movimientos de inventario
- Revisa accesos de usuarios

### ✅ Mantenimiento
- Revisa productos con bajo stock semanalmente
- Actualiza precios cuando cambien
- Desactiva productos descontinuados
- Limpia clientes duplicados

---

## 📞 SOPORTE

### Nivel 1: Manual y Centro de Ayuda
- Consulta este manual
- Revisa el centro de ayuda integrado
- Busca videos tutoriales

### Nivel 2: Super Administrador
- Contacta al Super Admin del sistema
- Para problemas de acceso o configuración

### Nivel 3: Soporte Técnico
- **Email:** [email soporte]
- **WhatsApp:** [whatsapp soporte]
- **Horario:** Lunes a Viernes 8AM - 6PM

### Al Reportar un Error

Incluye:
1. ✅ Qué estabas haciendo
2. ✅ Qué esperabas que pasara
3. ✅ Qué pasó realmente
4. ✅ Captura de pantalla del error
5. ✅ Tu usuario y nombre de empresa

---

## ✅ CHECKLIST: CONFIGURACIÓN COMPLETA

Usa este checklist al iniciar por primera vez:

**Configuración Inicial:**
- [ ] Cambiar contraseña
- [ ] Completar datos de la empresa
- [ ] Subir logo
- [ ] Configurar facturación (si aplica)
- [ ] Revisar impuestos

**Catálogo:**
- [ ] Crear categorías de productos
- [ ] Crear/importar productos
- [ ] Verificar precios
- [ ] Configurar stock inicial

**Proveedores:**
- [ ] Registrar proveedores principales
- [ ] Configurar condiciones de pago

**Equipo:**
- [ ] Crear roles necesarios
- [ ] Crear usuarios
- [ ] Entregar credenciales
- [ ] Capacitar equipo

**Pruebas:**
- [ ] Hacer venta de prueba
- [ ] Verificar factura generada
- [ ] Probar cuenta abierta (si aplica)
- [ ] Revisar reporte de ventas

**Producción:**
- [ ] Cargar inventario real
- [ ] Registrar efectivo base de caja
- [ ] Iniciar operación
- [ ] Monitorear primeros días

---

## 🎯 CONSEJOS FINALES

### 💡 Para el éxito de tu negocio:

1. **Mantén actualizado el inventario**: Registra compras y ajustes inmediatamente
2. **Capacita bien a tu equipo**: Un equipo bien capacitado = menos errores
3. **Revisa reportes diariamente**: Detecta problemas temprano
4. **Escucha a tu equipo**: Ellos usan el sistema a diario, conocen puntos de mejora
5. **Mantén el sistema actualizado**: Reporta bugs y solicita mejoras

---

**© 2026 KORE Inventory**  
**Manual del Administrador de Empresa v1.0**
