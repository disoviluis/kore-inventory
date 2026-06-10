# 📖 MANUAL DEL CAJERO
## KORE Inventory - Punto de Venta

---

## 🎯 TU ROL: CAJERO

Como **Cajero**, tus responsabilidades son:

✅ Atender clientes en el punto de venta  
✅ Registrar ventas y cobros  
✅ Gestionar cuentas abiertas (mesas, habitaciones)  
✅ Abrir y cerrar tu turno de caja  
✅ Manejar efectivo correctamente  

---

## 🚀 ACCESO AL SISTEMA

### URL: http://18.191.181.99/

### Tus Credenciales:
- **Usuario:** [Tu email]
- **Contraseña:** [Tu contraseña]

💡 **Tip**: Cambia tu contraseña al primer ingreso en: Perfil → Cambiar Contraseña

---

## 🖥️ PANTALLA PRINCIPAL - PUNTO DE VENTA (POS)

Al iniciar sesión, verás el **Punto de Venta**:

```
┌─────────────────────────────────────────────────────┐
│  CLIENTE                    │  RESUMEN DE VENTA   │
│  [Buscar cliente...]        │  Subtotal: $0       │
│                             │  IVA: $0            │
│  PRODUCTOS                  │  Total: $0          │
│  [Buscar producto...]       │                     │
│  [Catálogo de productos]    │  [Formas de pago]   │
│                             │  [Cobrar]           │
└─────────────────────────────────────────────────────┘
```

---

## 💰 REALIZAR UNA VENTA

### Paso 1: Seleccionar Cliente

**Opción A: Público General** (Venta rápida sin cliente específico)
- Haz clic en botón **"Público"**

**Opción B: Cliente Existente**
1. Escribe documento o nombre en el buscador
2. Selecciona el cliente de la lista

**Opción C: Cliente Nuevo**
1. Haz clic en **"+ Nuevo Cliente"**
2. Completa:
   - Tipo documento (CC, NIT, CE)
   - Número documento
   - Nombre completo
   - Teléfono y email
3. Guarda

### Paso 2: Agregar Productos

**Método 1: Buscar por Nombre**
- Escribe el nombre del producto
- Haz clic en el producto para agregarlo

**Método 2: Código de Barras**
- Con lector de código de barras:
  1. Enfoca el campo de búsqueda
  2. Escanea el código
  3. Se agrega automáticamente

**Método 3: Catálogo Visual**
- Navega por categorías
- Haz clic en el producto que deseas vender

### Paso 3: Ajustar Cantidades
- Usa los botones **+** y **-** junto a cada producto
- O escribe la cantidad directamente

### Paso 4: Aplicar Descuento (Si Aplica)
- En el campo "Descuento" ingresa el monto
- El total se recalcula automáticamente

### Paso 5: Agregar Forma(s) de Pago

Puedes usar **UNA o VARIAS formas de pago**:

**Formas disponibles:**
- 💵 Efectivo
- 💳 Tarjeta Débito
- 💳 Tarjeta Crédito
- 🏦 Transferencia
- 📱 Nequi
- 📱 Daviplata
- 📝 Cheque

**Ejemplo**: Venta de $100,000
- $70,000 en Efectivo
- $30,000 en Nequi
- **Total**: $100,000 ✅

**Cómo agregar pagos:**
1. Selecciona la forma de pago
2. Ingresa el monto
3. Haz clic en **"+"**
4. Repite si necesitas agregar más

💡 **Vueltas automáticas**: Si el cliente paga con $150,000 en efectivo y la venta es de $100,000, el sistema calcula automáticamente las vueltas de $50,000.

### Paso 6: Cobrar
1. Verifica que el **Total Pagado** cubra el **Total Venta**
2. Haz clic en **"Cobrar y Guardar Venta"**
3. Se imprime o muestra la factura
4. **¡Listo!** El inventario se actualiza automáticamente

---

## 🍽️ CUENTAS ABIERTAS (Mesas / Habitaciones)

Para restaurantes, bares, hoteles.

### ¿Qué es una Cuenta Abierta?

Una **cuenta abierta** es una venta que queda pendiente de pago. Útil para:
- 🍽️ **Mesas** en restaurantes
- 🏨 **Habitaciones** en hoteles
- 👤 **Clientes** con consumo a crédito

---

### Crear Cuenta Abierta

#### Paso 1: Agregar Productos
- Agrega los productos al carrito (igual que venta normal)

#### Paso 2: Abrir Cuenta
1. Haz clic en **"Abrir Cuenta"** (botón amarillo)
2. Ingresa el identificador:
   - "Mesa 5"
   - "Habitación 203"
   - "Cliente Juan Pérez"
3. Guarda

✅ La cuenta queda **pendiente de pago**

---

### Ver Cuentas Abiertas

1. En el navbar superior, verás el botón **"Cuentas Abiertas"** con un badge (número)
2. Haz clic para ver todas las cuentas pendientes

---

### Agregar Más Productos a Cuenta Abierta

1. Haz clic en **"Cuentas Abiertas"**
2. Selecciona la cuenta (ej: "Mesa 5")
3. Se cargan los productos existentes
4. Agrega más productos
5. Haz clic en **"Ver Total"** para guardar cambios

---

### Cerrar Cuenta Abierta y Cobrar

1. Haz clic en **"Cuentas Abiertas"**
2. Selecciona la cuenta a cerrar
3. Haz clic en **"Cerrar Cuenta y Cobrar"**
4. Agrega las formas de pago
5. Cobra normalmente
6. La cuenta se elimina de "Cuentas Abiertas"

---

## ⏰ TURNO DE CAJA

### Abrir Turno

**Al inicio de tu jornada:**

1. Haz clic en **"Turno"** (navbar superior)
2. En el modal, haz clic en **"Abrir Turno"**
3. Ingresa el **base inicial** (dinero en caja al inicio)
   - Ejemplo: $50,000
4. Guarda

✅ Tu turno queda **abierto**

💡 **Importante**: No puedes hacer ventas sin turno abierto.

---

### Cerrar Turno

**Al final de tu jornada:**

1. Haz clic en **"Turno"**
2. Verás el resumen de tu turno:
   - Ventas realizadas
   - Total vendido
   - Total en efectivo esperado
3. Haz clic en **"Cerrar Turno"**
4. **Cuenta el efectivo físico** en tu caja
5. Ingresa el **efectivo contado** real
6. El sistema calcula la diferencia:
   - ✅ **Cuadra**: Diferencia = $0
   - ⚠️ **Sobrante**: Diferencia positiva
   - ❌ **Faltante**: Diferencia negativa
7. Agrega observaciones si hay diferencia
8. Confirma el cierre

✅ Turno cerrado. Entrega el efectivo a tu supervisor.

---

## 📱 USO EN MÓVIL / TABLET

KORE Inventory funciona **perfectamente en móvil**.

### Navegación Móvil

**Botón ☰ (Hamburguesa):**
- Abre el menú lateral
- Accede a otras secciones

**Botón 🛒 Flotante:**
- Muestra el resumen de venta
- Accede a formas de pago
- Cobra la venta

**Tip**: Recarga la página con **Ctrl+Shift+R** si algo no carga.

---

## ❓ PROBLEMAS COMUNES

### "No puedo agregar productos"
**Solución:**
1. ✔️ Verifica que tengas turno abierto
2. ✔️ El producto debe tener stock disponible
3. ✔️ Recarga la página (F5)

### "Error al guardar venta"
**Solución:**
1. ✔️ Verifica que seleccionaste un cliente
2. ✔️ Las formas de pago deben cubrir el total
3. ✔️ Verifica tu conexión a internet

### "No veo el botón Cobrar"
**Solución:**
1. ✔️ El carrito debe tener al menos un producto
2. ✔️ Debe haber un total mayor a $0
3. ✔️ En móvil, usa el botón flotante 🛒

### "La impresora no imprime"
**Solución:**
1. ✔️ Verifica que la impresora esté encendida
2. ✔️ Verifica que tenga papel
3. ✔️ Intenta reimprimir desde "Últimas Ventas"

---

## 🎯 BUENAS PRÁCTICAS

### ✅ Al Inicio del Día
- Abre tu turno con el efectivo base correcto
- Verifica que la impresora tenga papel
- Confirma que tienes internet

### ✅ Durante el Día
- Revisa cada venta antes de cobrar
- Si el cliente pregunta por un producto sin stock, anótalo para informar a inventario
- Sé amable y paciente con clientes nuevos

### ✅ Al Final del Día
- Cuenta el efectivo ANTES de cerrar el turno
- Si hay diferencia, busca el error antes de cerrar
- Entrega el efectivo y reporte a tu supervisor

### ✅ Seguridad
- No compartas tu contraseña
- Cierra sesión si te ausentas
- Reporta cualquier error inmediatamente

---

## 📞 ¿NECESITAS AYUDA?

**Contacto interno:**
- Tu supervisor inmediato
- Administrador de la empresa

**Soporte técnico:**
- [Email de soporte]
- [WhatsApp de soporte]

---

## ✅ RESUMEN RÁPIDO

| Tarea | Botón/Acción |
|-------|--------------|
| **Venta rápida** | Público → Productos → Cobrar |
| **Buscar producto** | Campo de búsqueda o escanear |
| **Abrir cuenta** | Productos → Abrir Cuenta |
| **Ver cuentas** | "Cuentas Abiertas" (navbar) |
| **Cerrar cuenta** | Seleccionar → Cerrar y Cobrar |
| **Abrir turno** | "Turno" → Abrir Turno |
| **Cerrar turno** | "Turno" → Cerrar Turno |
| **Ayuda** | Botón ☰ → Centro de Ayuda |

---

**© 2026 KORE Inventory**  
**Manual del Cajero v1.0**
