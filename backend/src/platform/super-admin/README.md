# MÓDULO SUPER ADMIN - KORE INVENTORY

## 📋 Descripción

Módulo de administración completo para la gestión de todo el sistema SaaS multi-tenant. Permite administrar empresas, usuarios, planes, licencias y configuraciones globales.

## 🎯 Características

### 1. Dashboard de Métricas
- Métricas de empresas (total, activas, en trial, suspendidas, canceladas, nuevas del mes)
- Métricas de usuarios (total, activos, por tipo, nuevos del mes)
- Métricas de licencias (activas, por vencer, vencidas, renovaciones pendientes)
- Métricas de ingresos (MRR, mes actual, mes anterior, proyección anual)
- Distribución por planes (Básico, Profesional, Enterprise)
- Actividad reciente del sistema

### 2. Gestión de Empresas
- ✅ Crear empresa nueva con asignación automática de licencia
- ✅ Listar empresas con filtros (estado, plan, búsqueda)
- ✅ Ver detalle completo de empresa (usuarios, configuraciones, licencia)
- ✅ Editar información de empresa
- ✅ Cambiar estado (activar, suspender, cancelar)
- ✅ Eliminar empresa (solo sin actividad)
- ✅ Configuraciones por defecto automáticas

### 3. Gestión de Usuarios
- ✅ Crear usuarios con asignación a múltiples empresas
- ✅ Listar usuarios con filtros (tipo, estado, empresa, búsqueda)
- ✅ Ver detalle completo (empresas asignadas, roles)
- ✅ Editar información de usuario
- ✅ Cambiar contraseña
- ✅ Asignar/desasignar empresas
- ✅ Asignar roles por empresa
- ✅ Eliminar usuario (no super admins)

## 🗃️ Estructura de Base de Datos

### Tablas Creadas

#### `modulos_plan`
Relación entre módulos y planes (qué incluye cada plan).
```sql
- plan_id (FK a planes)
- modulo_id (FK a modulos)
- incluido (boolean)
- limite_uso (int, nullable)
```

#### `empresa_configuracion`
Configuraciones key-value por empresa.
```sql
- empresa_id (FK a empresas)
- clave (varchar 100)
- valor (text)
- tipo (enum: texto, numero, boolean, json, fecha)
- categoria (varchar 50)
- descripcion (text)
```

#### `modulos_rol`
Control granular de acceso a módulos por rol.
```sql
- rol_id (FK a roles)
- modulo_id (FK a modulos)
- acceso (boolean)
```

### Tablas Actualizadas

#### `bodegas`
- **Nuevo campo**: `bodega_padre_id` (permite jerarquía de bodegas/sub-bodegas)

### Vistas Creadas

#### `vista_empresas_licencias`
Información completa de empresas con licencias activas, plan, usuarios, productos.

#### `vista_usuarios_empresas_roles`
Usuarios con sus empresas asignadas y roles por empresa.

#### `vista_modulos_planes`
Módulos incluidos en cada plan con límites.

## 📡 API Endpoints

### Dashboard y Métricas

#### `GET /api/super-admin/dashboard`
Obtiene todas las métricas del sistema.

**Response:**
```json
{
  "success": true,
  "data": {
    "empresas": {
      "total": 4,
      "activas": 2,
      "en_trial": 1,
      "suspendidas": 1,
      "canceladas": 0,
      "nuevas_mes": 1
    },
    "usuarios": {
      "total": 6,
      "activos": 5,
      "super_admins": 1,
      "admin_empresas": 2,
      "usuarios_normales": 3,
      "nuevos_mes": 2
    },
    "licencias": {
      "total": 4,
      "activas": 3,
      "por_vencer": 1,
      "vencidas": 0,
      "renovaciones_pendientes": 1
    },
    "ingresos": {
      "mes_actual": 186.00,
      "mes_anterior": 108.00,
      "proyeccion_anual": 2232.00,
      "mrr": 186.00
    },
    "planes": {
      "basico": 1,
      "profesional": 2,
      "enterprise": 1
    }
  }
}
```

#### `GET /api/super-admin/empresas-resumen`
Lista empresas con información resumida.

**Query Params:**
- `estado` (opcional): trial, activa, suspendida, cancelada
- `plan_id` (opcional): ID del plan
- `limit` (default: 50)
- `offset` (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "empresa_id": 1,
      "empresa_nombre": "Distribuidora Central",
      "nit": "900123456-7",
      "email": "contacto@distribuidora.com",
      "empresa_estado": "activa",
      "plan_nombre": "Profesional",
      "precio_mensual": 79.00,
      "licencia_estado": "activa",
      "dias_restantes": 340,
      "usuarios_activos": 8,
      "productos_creados": 245
    }
  ],
  "pagination": {
    "total": 4,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

#### `GET /api/super-admin/actividad-reciente`
Obtiene actividad reciente del sistema (últimas 20 acciones).

**Query Params:**
- `limit` (default: 20)

### Gestión de Empresas

#### `GET /api/super-admin/empresas`
Lista todas las empresas con filtros.

**Query Params:**
- `estado`: trial, activa, suspendida, cancelada
- `plan_id`: ID del plan
- `search`: Búsqueda por nombre, NIT o email
- `limit`, `offset`: Paginación

#### `GET /api/super-admin/empresas/:id`
Detalle completo de una empresa.

**Response incluye:**
- Datos de la empresa
- Plan y precio
- Licencia activa con días restantes
- Lista de usuarios asignados
- Configuraciones de la empresa

#### `POST /api/super-admin/empresas`
Crea una nueva empresa.

**Body:**
```json
{
  "nombre": "Ferretería El Tornillo",
  "nit": "900654321-8",
  "email": "admin@eltornillo.com",
  "telefono": "3201234567",
  "direccion": "Calle 45 #23-12",
  "ciudad": "Bogotá",
  "pais": "Colombia",
  "regimen_tributario": "comun",
  "tipo_contribuyente": "responsable_iva",
  "plan_id": 2,
  "tipo_facturacion": "mensual",
  "dias_trial": 15,
  "auto_renovacion": true
}
```

**Proceso automático:**
1. ✅ Crea la empresa
2. ✅ Crea licencia activa (o trial si dias_trial > 0)
3. ✅ Asigna configuraciones por defecto
4. ✅ Registra auditoría

#### `PUT /api/super-admin/empresas/:id`
Actualiza datos de una empresa.

#### `PUT /api/super-admin/empresas/:id/estado`
Cambia el estado de una empresa.

**Body:**
```json
{
  "estado": "suspendida",
  "motivo": "Pago vencido hace 30 días"
}
```

**Estados válidos:**
- `trial`: En periodo de prueba
- `activa`: Activa y operando
- `suspendida`: Suspendida temporalmente
- `cancelada`: Cancelada definitivamente

#### `DELETE /api/super-admin/empresas/:id`
Elimina una empresa (solo si no tiene ventas).

### Gestión de Usuarios

#### `GET /api/super-admin/usuarios`
Lista todos los usuarios.

**Query Params:**
- `tipo_usuario`: super_admin, admin_empresa, usuario, soporte
- `activo`: true/false
- `empresa_id`: ID de empresa
- `search`: Búsqueda por nombre, apellido o email
- `limit`, `offset`: Paginación

#### `GET /api/super-admin/usuarios/:id`
Detalle completo de un usuario.

**Response incluye:**
- Datos del usuario
- Empresas asignadas
- Roles por empresa

#### `POST /api/super-admin/usuarios`
Crea un nuevo usuario.

**Body:**
```json
{
  "nombre": "Juan",
  "apellido": "Pérez",
  "email": "juan.perez@empresa.com",
  "password": "Pass123!",
  "tipo_usuario": "admin_empresa",
  "activo": true,
  "email_verificado": true,
  "empresas_ids": [1, 2],
  "roles_por_empresa": {
    "1": 3,
    "2": 4
  }
}
```

**Tipos de usuario:**
- `super_admin`: Acceso total al sistema
- `admin_empresa`: Administrador de empresa
- `usuario`: Usuario regular
- `soporte`: Equipo de soporte

#### `PUT /api/super-admin/usuarios/:id`
Actualiza datos de un usuario.

#### `PUT /api/super-admin/usuarios/:id/password`
Cambia la contraseña de un usuario.

**Body:**
```json
{
  "password": "NuevaPass123!"
}
```

#### `POST /api/super-admin/usuarios/:id/empresas`
Asigna un usuario a una empresa.

**Body:**
```json
{
  "empresa_id": 1,
  "rol_id": 3
}
```

#### `DELETE /api/super-admin/usuarios/:id/empresas/:empresaId`
Desasigna un usuario de una empresa.

#### `DELETE /api/super-admin/usuarios/:id`
Elimina un usuario (no permite eliminar super admins).

## 🔒 Seguridad

### Middleware Requerido

Todas las rutas del módulo Super Admin deben estar protegidas con middleware que verifique:

```typescript
// Middleware a aplicar en routes.ts
import { verificarSuperAdmin } from './core/middleware/auth.middleware';

router.use('/super-admin', verificarSuperAdmin, superAdminRoutes);
```

### Implementación del Middleware

```typescript
// backend/src/core/middleware/auth.middleware.ts
export const verificarSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  const usuario = req.user; // Asume que el token JWT ya fue validado
  
  if (!usuario || usuario.tipo_usuario !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado: Se requieren privilegios de Super Admin'
    });
  }
  
  next();
};
```

## 📊 Configuraciones por Defecto

Al crear una empresa, se crean automáticamente estas configuraciones:

| Clave | Valor | Tipo | Categoría | Descripción |
|-------|-------|------|-----------|-------------|
| `moneda_simbolo` | $ | texto | general | Símbolo de la moneda |
| `moneda_codigo` | COP | texto | general | Código ISO de moneda |
| `formato_fecha` | dd/mm/yyyy | texto | general | Formato de fecha |
| `requiere_autorizacion_descuentos` | 1 | boolean | ventas | Requiere autorización para descuentos |
| `maximo_descuento_sin_autorizacion` | 5 | numero | ventas | Máximo descuento sin autorización (%) |
| `permite_ventas_credito` | 1 | boolean | ventas | Permite ventas a crédito |
| `dias_credito_default` | 30 | numero | ventas | Días de crédito por defecto |

## 🚀 Despliegue

### 1. Ejecutar Migración SQL

```bash
# En el servidor EC2
cd ~/kore-inventory

# Ejecutar migración
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com -u admin -p kore_inventory < SQL/migration_super_admin_module.sql
```

### 2. Verificar Tablas Creadas

```sql
SHOW TABLES LIKE '%modulos%';
SHOW TABLES LIKE '%empresa_configuracion%';
DESC modulos_plan;
DESC empresa_configuracion;
DESC modulos_rol;
```

### 3. Desplegar Backend

```bash
# Compilar TypeScript
cd ~/kore-inventory/backend
npm run build

# Reiniciar PM2
pm2 restart kore-backend

# Verificar logs
pm2 logs kore-backend --lines 50
```

### 4. Verificar Endpoints

```bash
# Probar dashboard
curl -X GET http://localhost:3000/api/super-admin/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"

# Probar empresas
curl -X GET http://localhost:3000/api/super-admin/empresas \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🧪 Testing

### Crear Usuario Super Admin (Si no existe)

```sql
-- Verificar si existe
SELECT * FROM usuarios WHERE tipo_usuario = 'super_admin';

-- Si no existe, crear uno
INSERT INTO usuarios (
  nombre, apellido, email, password, tipo_usuario, activo, email_verificado
) VALUES (
  'Super',
  'Admin',
  'admin@kore.inventory',
  '$2a$10$YourHashedPasswordHere', -- Generar hash con bcrypt
  'super_admin',
  1,
  1
);
```

### Generar Hash de Contraseña

```javascript
// En Node.js REPL o script
const bcrypt = require('bcrypt');
const password = 'SuperAdmin2026!';
bcrypt.hash(password, 10).then(hash => console.log(hash));
```

## 📝 TODO - Siguiente Fase

### Frontend (Próxima sesión)
- [ ] Crear `frontend/public/super-admin.html`
- [ ] Crear `frontend/public/assets/js/super-admin.js`
- [ ] Dashboard con cards de métricas
- [ ] Gráficos de distribución por planes
- [ ] Tabla de empresas con filtros
- [ ] Modal crear/editar empresa
- [ ] Modal crear/editar usuario
- [ ] Actividad reciente en sidebar

### Middleware de Seguridad
- [ ] Crear `verificarSuperAdmin` middleware
- [ ] Aplicar middleware a todas las rutas /super-admin
- [ ] Agregar validación de JWT

### Funcionalidades Adicionales
- [ ] Gestión de planes (CRUD)
- [ ] Gestión de módulos (activar/desactivar)
- [ ] Gestión de licencias (renovar, extender)
- [ ] Reportes de uso del sistema
- [ ] Notificaciones de licencias por vencer
- [ ] Exportación de datos

## 📌 Notas Importantes

1. **Seguridad crítica**: NUNCA exponer estas rutas sin autenticación y verificación de tipo_usuario = 'super_admin'
2. **Auditoría**: Todas las acciones quedan registradas en `auditoria_logs`
3. **Transacciones**: Operaciones críticas (crear empresa, usuarios) usan transacciones SQL
4. **Validaciones**: No se puede eliminar empresa con ventas ni usuario super_admin
5. **Configuraciones**: Se crean automáticamente al crear empresa
6. **Licencias**: Se crean automáticamente al crear empresa

## 🆘 Soporte

Para problemas o preguntas sobre el módulo Super Admin, revisar:
- Logs de PM2: `pm2 logs kore-backend`
- Tabla auditoria_logs: `SELECT * FROM auditoria_logs ORDER BY created_at DESC LIMIT 50;`
- Estado de empresas: `SELECT * FROM vista_empresas_licencias;`

---

**Versión:** 1.0.0  
**Fecha:** 2026-02-11  
**Autor:** KORE Inventory Team
