# 📚 MANUAL DEL SUPER ADMINISTRADOR
## KORE Inventory - Sistema ERP SaaS Multitenant

---

## 📌 DATOS DE ACCESO

### 🌐 URL de la Aplicación
**Producción:** http://18.191.181.99/

### 👤 Credenciales Super Admin
- **Usuario:** [COMPLETAR CON EL EMAIL]
- **Contraseña:** [COMPLETAR CON LA CONTRASEÑA]
- **Rol:** Super Administrador (acceso total al sistema)

---

## 🎯 RESPONSABILIDADES DEL SUPER ADMIN

Como Super Administrador, tienes control total sobre:

✅ **Gestión de Empresas**: Crear y configurar nuevas empresas en el sistema  
✅ **Roles Globales**: Crear roles que se replican en todas las empresas  
✅ **Usuarios Globales**: Crear usuarios con acceso multi-empresa  
✅ **Administradores de Empresa**: Asignar administradores a cada empresa  
✅ **Supervisión General**: Monitorear el funcionamiento de todas las empresas  

---

## 🚀 PRIMEROS PASOS

### 1. Acceder al Sistema

1. Abre tu navegador (recomendado: Chrome, Edge, Firefox)
2. Ve a: http://18.191.181.99/
3. Ingresa tu **usuario** y **contraseña**
4. Haz clic en **"Iniciar Sesión"**

![Login Screen]

### 2. Pantalla Principal

Una vez dentro verás:
- **Sidebar izquierdo**: Menú de navegación
- **Dashboard**: Estadísticas generales del sistema
- **Navbar superior**: Tu nombre de usuario y opciones

---

## 🏢 GESTIÓN DE EMPRESAS

### ¿Qué es una Empresa en KORE Inventory?

Una **empresa** es un tenant (inquilino) independiente que tiene:
- ✅ Sus propios productos
- ✅ Sus propios clientes
- ✅ Sus propias ventas y compras
- ✅ Sus propios usuarios
- ✅ Su propia configuración de facturación

💡 **Importante**: Los datos de una empresa NO se mezclan con los de otras empresas.

---

### 📝 CREAR UNA NUEVA EMPRESA

#### Paso 1: Ir al Módulo de Empresas
1. En el sidebar, haz clic en **"Empresas"**
2. Verás la lista de empresas existentes
3. Haz clic en el botón **"+ Nueva Empresa"**

#### Paso 2: Datos Básicos de la Empresa

**DATOS OBLIGATORIOS:**

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **Razón Social** | Nombre legal completo | "Tienda El Paraíso S.A.S." |
| **NIT** | Número de identificación tributaria | "900123456-7" |
| **Teléfono** | Número de contacto | "3001234567" |
| **Email** | Correo electrónico | "contacto@elparaiso.com" |
| **Dirección** | Dirección física completa | "Calle 123 #45-67, Bogotá" |

**DATOS DE FACTURACIÓN (CRÍTICOS):**

| Campo | Descripción | Valor |
|-------|-------------|--------|
| **Tipo Régimen** | Régimen tributario | "Común" o "Simplificado" |
| **Responsabilidad Fiscal** | Código DIAN | "O-13" (común), "O-47" (simplificado) |
| **¿Factura Electrónica?** | Si facturará electrónicamente | Sí / No |

**DATOS IMPORTANTES PARA FACTURACIÓN ELECTRÓNICA:**

Si la empresa va a usar **factura electrónica**, necesitas:
- ✅ **Prefijo de factura**: Ej: "SETT" (asignado por la DIAN)
- ✅ **Resolución DIAN**: Número de resolución
- ✅ **Fecha inicio resolución**: Fecha de inicio
- ✅ **Fecha fin resolución**: Fecha de vencimiento
- ✅ **Numeración desde**: Primer número autorizado
- ✅ **Numeración hasta**: Último número autorizado

💡 **Nota**: Si no tienes estos datos aún, puedes crear la empresa y configurarlos después en **Configuración → Facturación**.

#### Paso 3: Guardar la Empresa
1. Completa todos los campos obligatorios
2. Haz clic en **"Guardar"**
3. La empresa aparecerá en la lista

---

## 👥 GESTIÓN DE ROLES GLOBALES

### ¿Qué son los Roles Globales?

Los **roles globales** son plantillas de permisos que se crean UNA VEZ y se replican automáticamente en TODAS las empresas del sistema.

**Roles Globales Predeterminados:**
- ✅ **Super Administrador**: Acceso total al sistema
- ✅ **Administrador de Empresa**: Administra una empresa específica
- ✅ **Cajero**: Solo punto de venta (POS)
- ✅ **Inventario**: Gestión de productos y stock
- ✅ **Vendedor**: Ventas y clientes

---

### 📝 CREAR UN ROL GLOBAL

#### Paso 1: Ir a Roles Globales
1. En el sidebar, haz clic en **"Roles Globales"** (menú Super Admin)
2. Verás la lista de roles existentes
3. Haz clic en **"+ Nuevo Rol Global"**

#### Paso 2: Configurar el Rol

**Datos del Rol:**
- **Nombre**: Nombre descriptivo del rol (Ej: "Supervisor de Tienda")
- **Descripción**: Para qué sirve el rol

**Permisos por Módulo:**

Marca los permisos que necesita el rol:

| Módulo | Permisos Disponibles |
|--------|---------------------|
| **Dashboard** | Ver estadísticas |
| **Ventas** | Crear, Ver, Editar, Eliminar ventas |
| **Productos** | Crear, Ver, Editar, Eliminar productos |
| **Inventario** | Gestionar stock, traslados, ajustes |
| **Clientes** | Crear, Ver, Editar, Eliminar clientes |
| **Proveedores** | Crear, Ver, Editar, Eliminar proveedores |
| **Compras** | Crear, Ver, Editar, Eliminar compras |
| **Reportes** | Ver reportes, Descargar |
| **Configuración** | Modificar configuración de empresa |
| **Usuarios** | Crear, Ver, Editar, Eliminar usuarios |
| **Facturación** | Configurar facturación electrónica |

💡 **Tip**: Define permisos siguiendo el **principio de mínimo privilegio** (solo lo que necesitan).

#### Paso 3: Guardar el Rol
1. Selecciona los permisos necesarios
2. Haz clic en **"Guardar Rol Global"**
3. El rol se creará automáticamente en todas las empresas

---

## 👨‍💼 GESTIÓN DE USUARIOS GLOBALES

### ¿Qué son los Usuarios Globales?

Los **usuarios globales** pueden acceder a **múltiples empresas**. Son útiles para:
- 🏢 Contadores que manejan varias empresas
- 🏢 Supervisores multi-tienda
- 🏢 Personal de soporte

---

### 📝 CREAR UN USUARIO GLOBAL

#### Paso 1: Ir a Usuarios
1. En el sidebar, haz clic en **"Usuarios"** (menú Super Admin)
2. Verás la lista de usuarios del sistema
3. Haz clic en **"+ Nuevo Usuario"**

#### Paso 2: Datos del Usuario

**Información Personal:**
- **Nombre completo**: Nombre y apellidos
- **Email**: Correo electrónico (será el usuario de login)
- **Teléfono**: Número de contacto
- **Contraseña**: Contraseña inicial (el usuario puede cambiarla después)

**Configuración de Acceso:**
- **Rol Global**: Selecciona el rol que tendrá
- **Empresas asignadas**: Marca las empresas a las que puede acceder

💡 **Importante**: Si asignas múltiples empresas, el usuario verá un selector de empresa al iniciar sesión.

#### Paso 3: Guardar el Usuario
1. Completa todos los campos
2. Haz clic en **"Guardar"**
3. El usuario recibirá sus credenciales por email (si está configurado)

---

## 🔑 CREAR ADMINISTRADOR DE EMPRESA

El **Administrador de Empresa** es el usuario principal de cada empresa. Tiene control total sobre SU empresa (pero no sobre las demás).

### Paso 1: Crear el Usuario
1. Ve a **"Usuarios"** → **"+ Nuevo Usuario"**
2. Completa los datos personales
3. En **"Rol Global"** selecciona: **"Administrador de Empresa"**
4. En **"Empresas asignadas"** selecciona **SOLO UNA empresa**

### Paso 2: Entregar Credenciales
Proporciona al administrador:
- 🌐 **URL**: http://18.191.181.99/
- 📧 **Usuario**: Su email
- 🔒 **Contraseña**: La contraseña temporal que creaste
- 📄 **Manual**: Entrégale el manual de Administrador de Empresa

💡 **Recomendación**: Pídele que cambie su contraseña al primer login.

---

## 📚 CAPACITAR AL ADMINISTRADOR DE EMPRESA

El Administrador de Empresa debe saber cómo:

### 1️⃣ Gestionar Roles de Empresa
Ruta: **Configuración → Roles y Permisos**
- Crear roles específicos para su negocio
- Asignar permisos granulares
- Ejemplo: "Mesero", "Cocinero", "Supervisor Turno Noche"

### 2️⃣ Gestionar Usuarios de Empresa
Ruta: **Configuración → Usuarios**
- Crear usuarios para su equipo
- Asignar roles
- Activar/desactivar usuarios

### 3️⃣ Configurar Facturación
Ruta: **Configuración → Facturación**
- Configurar datos de factura electrónica
- Plantilla de factura (logo, encabezado, pie de página)
- Numeración de facturas

### 4️⃣ Gestionar Productos
Ruta: **Productos**
- Crear categorías de productos
- Agregar productos con:
  - SKU, código de barras
  - Precio de compra y venta
  - Stock inicial
  - IVA y impuestos

### 5️⃣ Gestionar Proveedores
Ruta: **Proveedores**
- Agregar proveedores
- Datos de contacto
- Condiciones de pago

### 6️⃣ Gestionar Compras
Ruta: **Compras**
- Registrar entradas de mercancía
- Vincular con proveedores
- Actualizar inventario automáticamente

### 7️⃣ Realizar Ventas
Ruta: **Ventas (POS)**
- Ventas directas (cobro inmediato)
- Cuentas abiertas (mesas, habitaciones, etc.)
- Aplicar descuentos
- Múltiples formas de pago

---

## 🛒 GUÍA RÁPIDA: CREAR PRODUCTOS

### Prerrequisito: Crear Categorías
1. Ve a **Productos → Categorías**
2. Crea categorías: "Bebidas", "Alimentos", "Licores", etc.

### Paso 1: Agregar Producto
1. Ve a **Productos → + Nuevo Producto**

### Paso 2: Información Básica
- **Nombre**: Nombre del producto
- **SKU**: Código único (Ej: "BEB-001")
- **Código de barras**: Si tiene (opcional)
- **Categoría**: Selecciona la categoría
- **Descripción**: Descripción del producto

### Paso 3: Precios e Impuestos
- **Precio de compra**: Costo de adquisición
- **Precio de venta**: Precio al público
- **IVA**: Selecciona % (0%, 5%, 19%)
- **¿Aplica IVA?**: Sí / No

### Paso 4: Inventario
- **Stock inicial**: Cantidad en inventario
- **Stock mínimo**: Para alertas de reorden
- **Unidad de medida**: Unidad, Kg, Litro, etc.

### Paso 5: Guardar
Haz clic en **"Guardar Producto"**

---

## 💰 GUÍA RÁPIDA: REALIZAR VENTAS

### VENTA DIRECTA (Cobro Inmediato)

#### Paso 1: Abrir POS
1. Ve a **Ventas** (Punto de Venta)
2. Verás la interfaz del POS

#### Paso 2: Seleccionar Cliente
- **Público General**: Para ventas rápidas sin cliente específico
- **Buscar Cliente**: Por documento o nombre
- **Nuevo Cliente**: Si no existe, créalo rápido

#### Paso 3: Agregar Productos
- **Buscar**: Escribe el nombre o escanea código de barras
- **Clic en producto**: Se agrega al carrito
- **Ajustar cantidad**: Usa los botones +/-

#### Paso 4: Aplicar Descuento (Opcional)
- Ingresa el monto o % de descuento

#### Paso 5: Agregar Forma(s) de Pago
Puedes usar **múltiples formas de pago**:
- Efectivo: $50,000
- Tarjeta: $30,000
- Total: $80,000

#### Paso 6: Cobrar
1. Haz clic en **"Cobrar y Guardar Venta"**
2. El sistema calcula **vueltas** automáticamente
3. Se genera la factura
4. El inventario se actualiza automáticamente

---

### CUENTA ABIERTA (Mesa, Habitación, Tag)

Para restaurantes, hoteles, bares:

#### Paso 1: Crear Cuenta Abierta
1. Agrega productos al carrito
2. Haz clic en **"Abrir Cuenta"**
3. Ingresa el identificador:
   - **Mesa #5**
   - **Habitación 203**
   - **Cliente Juan Pérez**

#### Paso 2: Guardar Cuenta
La cuenta queda **pendiente de pago**

#### Paso 3: Agregar Más Productos
1. Ve a **"Cuentas Abiertas"** (navbar superior)
2. Selecciona la cuenta
3. Agrega más productos
4. Guarda cambios

#### Paso 4: Cerrar Cuenta y Cobrar
1. Selecciona la cuenta
2. Haz clic en **"Cerrar Cuenta y Cobrar"**
3. Agrega formas de pago
4. Cobra

---

## 📦 GUÍA RÁPIDA: PROVEEDORES Y COMPRAS

### CREAR PROVEEDOR

#### Paso 1: Ir a Proveedores
1. Ve a **Proveedores → + Nuevo Proveedor**

#### Paso 2: Datos del Proveedor
- **Nombre o Razón Social**
- **NIT o Documento**
- **Email y Teléfono**
- **Dirección**
- **Persona de contacto**
- **Condiciones de pago**: Contado, 30 días, 60 días, etc.

#### Paso 3: Guardar
Haz clic en **"Guardar Proveedor"**

---

### REGISTRAR COMPRA

#### Paso 1: Nueva Compra
1. Ve a **Compras → + Nueva Compra**

#### Paso 2: Seleccionar Proveedor
- Busca y selecciona el proveedor

#### Paso 3: Agregar Productos
Para cada producto:
- Selecciona el producto
- Cantidad comprada
- Precio de compra unitario
- Subtotal (se calcula automáticamente)

#### Paso 4: Información Adicional
- **Fecha de compra**
- **Número de factura del proveedor**
- **Forma de pago**: Efectivo, Crédito, Transferencia
- **Observaciones**

#### Paso 5: Guardar Compra
1. Haz clic en **"Guardar Compra"**
2. El inventario se **actualiza automáticamente** (suma stock)
3. Se registra el movimiento contable

---

## 🎓 CAPACITACIÓN DE USUARIOS FINALES

### ROL: CAJERO

**Módulos que puede ver:**
- ✅ Dashboard (resumen de su turno)
- ✅ Ventas (POS)
- ✅ Cuentas Abiertas

**Funciones principales:**
- Abrir/cerrar turno de caja
- Registrar ventas
- Crear cuentas abiertas
- Cerrar cuentas abiertas
- Imprimir facturas

**Manual recomendado:**
- Entregar sección: "Realizar Ventas"
- Entregar sección: "Cuentas Abiertas"
- Entregar sección: "Turnos de Caja"

---

### ROL: INVENTARIO

**Módulos que puede ver:**
- ✅ Productos
- ✅ Inventario (ajustes, traslados)
- ✅ Compras
- ✅ Proveedores

**Funciones principales:**
- Crear/editar productos
- Ajustar inventario
- Trasladar entre bodegas
- Registrar compras
- Gestionar proveedores

**Manual recomendado:**
- Entregar sección: "Crear Productos"
- Entregar sección: "Proveedores y Compras"
- Entregar sección: "Gestión de Inventario"

---

### ROL: VENDEDOR

**Módulos que puede ver:**
- ✅ Dashboard
- ✅ Ventas (POS)
- ✅ Clientes

**Funciones principales:**
- Registrar ventas
- Gestionar clientes
- Ver historial de ventas

**Manual recomendado:**
- Entregar sección: "Realizar Ventas"
- Entregar sección: "Gestión de Clientes"

---

## 📱 USO EN MÓVIL

KORE Inventory es **responsive** y funciona perfectamente en tablets y smartphones.

### Recomendaciones Móvil:

✅ **POS Móvil**: Ideal para vendedores de campo  
✅ **Inventario Móvil**: Contar stock con tablet  
✅ **Ventas Móvil**: Meseros tomando pedidos en tablet  

**Navegación Móvil:**
- Usa el botón **☰** (hamburguesa) para abrir el sidebar
- Botón flotante 🛒 para ver el carrito de compras
- Interface táctil optimizada (botones grandes)

---

## 🔧 SOLUCIÓN DE PROBLEMAS COMUNES

### ❌ "No puedo crear una empresa"
- ✔️ Verifica que tengas rol **Super Administrador**
- ✔️ Completa TODOS los campos obligatorios
- ✔️ El NIT debe tener formato válido (ej: 900123456-7)

### ❌ "El usuario no puede iniciar sesión"
- ✔️ Verifica que el email sea correcto
- ✔️ Verifica que el usuario esté **activo**
- ✔️ Resetea la contraseña si es necesario
- ✔️ Verifica que tenga al menos UNA empresa asignada

### ❌ "El producto no aparece en el POS"
- ✔️ Verifica que el producto esté **activo**
- ✔️ Verifica que tenga **stock disponible**
- ✔️ Verifica que tenga **precio de venta** configurado
- ✔️ Recarga la página (F5)

### ❌ "Error al guardar venta"
- ✔️ Verifica que haya productos en el carrito
- ✔️ Verifica que el cliente esté seleccionado
- ✔️ Verifica que las formas de pago cubran el total
- ✔️ Revisa la consola del navegador (F12)

### ❌ "No veo todos los módulos"
- ✔️ Tu rol determina qué módulos ves
- ✔️ Contacta al Super Admin para ajustar permisos

---

## 🆘 SOPORTE Y CONTACTO

### Contacto con el Desarrollador

**Desarrollador:** [TU NOMBRE]  
**Email:** [TU EMAIL]  
**WhatsApp:** [TU WHATSAPP]

**Horario de soporte:**  
Lunes a Viernes: 8:00 AM - 6:00 PM

### Reporte de Errores

Cuando encuentres un error, reporta:
1. ✅ **Qué estabas haciendo**: "Estaba creando una venta..."
2. ✅ **Qué esperabas**: "Esperaba que se guardara la venta"
3. ✅ **Qué pasó**: "Salió un error: ..."
4. ✅ **Captura de pantalla**: Del error
5. ✅ **Consola del navegador**: F12 → Console → Screenshot

---

## 📊 BUENAS PRÁCTICAS

### ✅ Seguridad
- Cambia tu contraseña cada 3 meses
- No compartas tus credenciales
- Cierra sesión al terminar
- Usa contraseñas fuertes (mínimo 8 caracteres)

### ✅ Gestión de Usuarios
- Desactiva usuarios que ya no trabajan
- Revisa permisos regularmente
- Usa el principio de mínimo privilegio

### ✅ Gestión de Empresas
- Mantén actualizada la info de facturación
- Revisa numeración de facturas antes de que se agote
- Haz backup de datos críticos

### ✅ Inventario
- Realiza conteos físicos periódicos
- Ajusta inventario cuando haya diferencias
- Define stock mínimo para alertas de reorden

### ✅ Capacitación
- Capacita a nuevos usuarios antes de darles acceso
- Mantén actualizados los manuales
- Documenta procesos específicos de cada empresa

---

## 🎯 CHECKLIST: CONFIGURAR NUEVA EMPRESA

Usa este checklist al configurar cada nueva empresa:

- [ ] 1. Crear la empresa con todos los datos
- [ ] 2. Configurar facturación electrónica (si aplica)
- [ ] 3. Subir logo de la empresa
- [ ] 4. Crear administrador de empresa
- [ ] 5. Entregar credenciales al administrador
- [ ] 6. Capacitar al administrador
- [ ] 7. Crear categorías de productos
- [ ] 8. Importar/crear productos iniciales
- [ ] 9. Crear proveedores principales
- [ ] 10. Crear roles específicos de la empresa
- [ ] 11. Crear usuarios del equipo
- [ ] 12. Configurar impuestos adicionales (si aplica)
- [ ] 13. Hacer venta de prueba
- [ ] 14. Verificar factura generada
- [ ] 15. Capacitar al equipo en el uso del sistema

---

## 📖 HISTORIAL DE VERSIONES

**Versión 1.0** - 5 de Junio 2026
- Manual inicial del Super Administrador
- Guías de configuración
- Solución de problemas
- Buenas prácticas

---

## 📝 NOTAS FINALES

Este manual es un **documento vivo** que debe actualizarse cuando:
- ✏️ Se agreguen nuevas funcionalidades
- ✏️ Se cambien procesos
- ✏️ Se detecten errores o confusiones

**Próxima revisión programada:** [FECHA]

---

**© 2026 KORE Inventory - Sistema ERP SaaS Multitenant**  
**Desarrollado por:** Disovi Soft  
**Versión del Sistema:** 1.0.0
