# 🔄 GUÍA DE RESET COMPLETO DE BASE DE DATOS

## 📋 Contexto

Esta guía documenta el proceso de **reset completo** de la base de datos Kore Inventory, eliminando todos los datos de prueba y dejando el sistema en estado inicial para comenzar con datos reales.

---

## ⚠️ ADVERTENCIAS IMPORTANTES

- ✅ **SOLO ejecutar si TODOS los datos actuales son de prueba**
- ✅ **NO hay datos reales en producción**
- ✅ **Se ha notificado a todos los usuarios del reset**
- ❌ **Esta acción NO SE PUEDE DESHACER**

---

## 🎯 Qué se Preserva vs Qué se Elimina

### ✅ SE PRESERVA:
- Usuario Super Admin (`admin@kore.com`)
- Roles de sistema (`super_admin`, `admin_empresa`)
- Módulos del sistema
- Permisos del sistema
- Planes (catálogo)
- Acciones (catálogo)

### ❌ SE ELIMINA:
- **Todas las empresas** (Everest, ABC, XYZ, etc.)
- **Todos los usuarios** (excepto super_admin)
- **Todos los roles personalizados**
- **Todos los productos y categorías**
- **Todas las ventas y compras**
- **Todos los clientes y proveedores**
- **Todas las configuraciones de facturación**
- **Todos los movimientos de inventario**
- **Todos los impuestos personalizados**

---

## 📝 PASOS DE EJECUCIÓN

### Paso 1: Backup de Seguridad (Opcional pero Recomendado)

Aunque sean datos de prueba, es buena práctica hacer backup:

```bash
# Desde tu máquina local (si tienes mysql instalado)
mysqldump -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com \
  -u admin -p'Kore2026!' \
  kore_inventory > backup_pre_reset_$(date +%Y%m%d_%H%M%S).sql
```

**Alternativa desde Windows PowerShell (desde el servidor EC2):**

```bash
# Conectarse al servidor
ssh -i "C:\Users\tu-usuario\.ssh\kore-key.pem" ubuntu@18.191.181.99

# Hacer backup
mysqldump -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com \
  -u admin -p'Kore2026!' \
  kore_inventory > ~/backup_pre_reset_$(date +%Y%m%d_%H%M%S).sql

# Verificar que se creó
ls -lh ~/*.sql
```

### Paso 2: Conectarse a la Base de Datos

**Opción A: Desde phpMyAdmin local (xampp)**

1. Abrir phpMyAdmin
2. Agregar servidor remoto:
   - Host: `kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com`
   - Usuario: `admin`
   - Password: `Kore2026!`
   - Base de datos: `kore_inventory`

**Opción B: Desde MySQL Workbench**

1. Nueva conexión
2. Configurar:
   - Connection Name: Kore RDS
   - Hostname: `kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com`
   - Port: 3306
   - Username: `admin`
   - Password: `Kore2026!`
   - Default Schema: `kore_inventory`

**Opción C: Desde el servidor EC2**

```bash
ssh -i "ruta/a/kore-key.pem" ubuntu@18.191.181.99

mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com \
  -u admin -p'Kore2026!' \
  kore_inventory
```

### Paso 3: Ejecutar Script de Reset

**IMPORTANTE: Leer todo el script antes de ejecutar**

1. Abrir el archivo: `SQL/RESET_DATABASE_CLEAN_START.sql`
2. Revisar que entiendes lo que hace cada sección
3. Ejecutar el script completo

**Desde phpMyAdmin/MySQL Workbench:**
- Abrir el archivo SQL
- Ejecutar

**Desde línea de comandos (servidor EC2):**

```bash
# Asegurarse de estar en el directorio del proyecto
cd /home/ubuntu/kore-inventory

# Ejecutar el script
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com \
  -u admin -p'Kore2026!' \
  kore_inventory < SQL/RESET_DATABASE_CLEAN_START.sql
```

### Paso 4: (Opcional) Ejecutar Datos Semilla

Si deseas crear impuestos base y verificar configuraciones:

```bash
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com \
  -u admin -p'Kore2026!' \
  kore_inventory < SQL/RESET_SEED_INITIAL_DATA.sql
```

### Paso 5: Verificar el Reset

Revisar los resultados que muestra el script de reset. Debe indicar:

```
✅ OK - Solo Super Admin
✅ OK - Sin empresas
✅ OK - Sin productos
✅ OK - Sin ventas
✅ OK - Sin clientes
✅ OK - Roles de sistema preservados
✅ OK - Sin roles personalizados
```

### Paso 6: Cerrar Todas las Sesiones Activas

**IMPORTANTE:** Todos los usuarios deben cerrar sesión y volver a hacer login.

Los tokens JWT actuales contienen referencias a empresas que ya no existen.

```bash
# Opcional: Reiniciar el backend para limpiar cache
ssh -i "ruta/a/kore-key.pem" ubuntu@18.191.181.99
pm2 restart kore-backend
```

---

## 🚀 FLUJO POST-RESET

### 1. Login como Super Admin

```
URL: http://18.191.181.99/login.html
Email: admin@kore.com
Password: admin
```

**⚠️ IMPORTANTE:** Cambiar la contraseña del super admin inmediatamente.

### 2. Crear la Primera Empresa REAL

1. Ir al módulo **"Super Admin"** → **"Gestión de Empresas"**
2. Click en **"Crear Empresa"**
3. Completar con datos REALES:
   - Nombre de la empresa
   - NIT + Dígito de verificación
   - Razón social
   - Régimen tributario
   - Responsabilidades fiscales (DIAN)
   - Logo de la empresa
   - Dirección, teléfono, email
4. Asignar un plan
5. Seleccionar módulos activos para esa empresa

### 3. Crear el Administrador de la Empresa

1. En el módulo **"Usuarios"** (como super_admin)
2. Click en **"Crear Usuario"**
3. Completar datos:
   - Nombre y apellido del administrador
   - Email corporativo
   - Contraseña temporal
   - Tipo de usuario: **Admin Empresa**
   - Empresa: Seleccionar la empresa creada
4. Guardar

### 4. Login como Admin Empresa

1. Cerrar sesión del super_admin
2. Hacer login con el usuario admin empresa creado
3. Cambiar la contraseña temporal

### 5. Configurar la Empresa (como Admin Empresa)

#### 5.1 Configurar Facturación Electrónica

1. Ir a **"Configuración"** → **"Facturación Electrónica"**
2. Completar:
   - Resolución de facturación DIAN
   - Prefijo de facturas
   - Rango de numeración
   - Fecha de vencimiento de resolución
   - Configuración de logo y plantilla

#### 5.2 Crear Roles Personalizados

1. Ir a **"Administración"** → **"Roles y Permisos"**
2. Crear roles según necesidad:
   - Vendedor
   - Cajero
   - Bodeguero
   - Contador
   - etc.
3. Asignar permisos y módulos a cada rol

#### 5.3 Crear Categorías de Productos

1. Ir a **"Inventario"** → **"Categorías"**
2. Crear la estructura de categorías según el negocio

#### 5.4 Crear Productos

1. Ir a **"Inventario"** → **"Productos"**
2. Comenzar a ingresar productos REALES

#### 5.5 Crear Usuarios Operativos

1. Ir a **"Administración"** → **"Usuarios"**
2. Crear usuarios con los roles personalizados creados

---

## ✅ VERIFICACIÓN FINAL

Antes de comenzar operaciones reales, verificar:

- [ ] Solo existe 1 usuario (super_admin)
- [ ] No hay empresas de prueba
- [ ] No hay productos de prueba
- [ ] No hay ventas antiguas
- [ ] Roles de sistema funcionan correctamente
- [ ] La nueva empresa se creó correctamente
- [ ] El admin empresa puede acceder
- [ ] Los roles personalizados se crean sin errores
- [ ] La jerarquía de roles funciona (admin_empresa NO puede asignar super_admin)

---

## 🐛 Troubleshooting

### Error: "Access denied for user"

- Verificar credenciales de la base de datos
- Verificar que el RDS permite conexiones desde tu IP
- Verificar security groups de AWS

### Error: "Foreign key constraint fails"

- Verificar que `SET FOREIGN_KEY_CHECKS = 0;` se ejecutó
- Ejecutar el script completo, no por partes

### Error 403 al editar usuarios

- Cerrar sesión y volver a hacer login
- El token JWT debe regenerarse con la nueva estructura

### No aparecen módulos en el menú

- Verificar que la licencia de la empresa está activa
- Verificar que los módulos están asignados al plan
- Verificar permisos del usuario

---

## 📊 Monitoreo Post-Reset

Después del reset, monitorear:

```sql
-- Ver usuarios activos
SELECT id, nombre, email, tipo_usuario, activo 
FROM usuarios;

-- Ver empresas creadas
SELECT id, nombre, nit, activo, created_at 
FROM empresas 
ORDER BY created_at DESC;

-- Ver roles por empresa
SELECT 
    r.id,
    r.nombre,
    r.tipo,
    r.nivel,
    e.nombre as empresa
FROM roles r
LEFT JOIN empresas e ON r.empresa_id = e.id
ORDER BY r.empresa_id, r.nivel DESC;

-- Ver auditoría del reset
SELECT 
    created_at,
    modulo,
    accion,
    descripcion
FROM auditoria_logs
WHERE accion = 'RESET_DATABASE'
ORDER BY created_at DESC;
```

---

## 📝 Información de Contacto

- **Base de Datos:** kore_inventory
- **Host:** kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com
- **Usuario DB:** admin
- **Servidor Web:** 18.191.181.99
- **Usuario SSH:** ubuntu

---

## 🔐 Credenciales Post-Reset

### Super Admin
- **Email:** admin@kore.com
- **Password:** admin
- **⚠️ CAMBIAR INMEDIATAMENTE**

---

## 📅 Historial

| Fecha | Acción | Ejecutado por |
|-------|--------|---------------|
| 2026-05-13 | Reset inicial - Eliminación de datos de prueba | [Tu nombre] |

---

**FIN DE LA GUÍA**
