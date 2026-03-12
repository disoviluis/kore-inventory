# 🏗️ ANÁLISIS DE ARQUITECTURA - GESTIÓN DE ROLES

**Fecha:** 2026-03-12  
**Módulo:** Gestión de Roles y Permisos  
**Ubicación Propuesta:** PLATAFORMA → Usuarios → Roles  
**Estado:** ✅ ANÁLISIS COMPLETADO

---

## 📋 RESUMEN EJECUTIVO

### **Situación Actual**
- ✅ **Backend de Roles YA EXISTE**: `backend/src/core/roles/` (Funcional pero incompleto)
- ✅ **Frontend de Roles YA EXISTE**: En `dashboard.html` (Solo para Admin Empresa)
- ❌ **Problema 1**: NO existe gestión de roles GLOBALES para Super Admin
- ❌ **Problema 2**: NO hay jerarquía de niveles de privilegio entre roles
- ❌ **Problema 3**: NO hay restricciones para evitar que usuarios creen roles superiores a ellos
- ❌ **Problema 4**: Admin Empresa solo puede crear roles personalizados de su empresa

### **Problema Real Identificado**

El sistema actual tiene **UN SOLO MÓDULO** de roles que:
- Admin Empresa usa para crear roles específicos de su empresa (cajeros, contadores)
- Super Admin NO TIENE interfaz para crear roles GLOBALES (admin_empresa, gerente_general)

### **Necesidad Real**

Necesitamos **DOS NIVELES** de gestión de roles con **JERARQUÍAS**:

1. **ROLES GLOBALES (Super Admin)**
   - `empresa_id = NULL` (aplican a todas las empresas)
   - Nivel alto de privilegio (80-100)
   - Ejemplos: Super Admin, Administrador de Empresa
   - Solo Super Admin puede crearlos/editarlos

2. **ROLES ESPECÍFICOS (Admin Empresa)**
   - `empresa_id = X` (solo para su empresa)
   - Nivel medio/bajo de privilegio (10-60)
   - Ejemplos: Cajero, Contador, Supervisor
   - Admin Empresa puede crearlos pero con nivel < 80

### **Propuesta**
Crear **DOS INTERFACES DIFERENTES** compartiendo el mismo backend mejorado:
- **Super Admin** → Módulo de Roles Globales (crea roles para asignar a administradores)
- **Admin Empresa** → Módulo de Roles Específicos (crea roles para su equipo interno)

---

## 🏆 SISTEMA DE JERARQUÍAS DE ROLES (NUEVO)

### **Concepto de Jerarquía**

Cada rol tiene un **nivel de privilegio** numérico que determina:
1. ✅ Qué acciones puede realizar
2. ✅ Qué roles puede crear/editar (solo roles de nivel inferior)
3. ✅ Qué usuarios puede gestionar

### **Tabla de Niveles Propuesta**

| Nivel | Nombre Rol | Tipo | Empresa ID | Quién lo crea | Puede crear roles hasta |
|-------|------------|------|------------|---------------|-------------------------|
| **100** | Super Administrador | Sistema | NULL | Manual (seed) | Nivel 99 |
| **80** | Administrador Empresa | Sistema | NULL | Super Admin | Nivel 79 |
| **60** | Gerente General | Personalizado | NULL o X | Super Admin | Nivel 59 |
| **50** | Supervisor | Personalizado | X | Admin Empresa | Nivel 49 |
| **40** | Contador/Analista | Personalizado | X | Admin Empresa | Nivel 39 |
| **20** | Operativo (Cajero, Vendedor) | Personalizado | X | Admin Empresa | Nivel 19 |
| **10** | Consulta (Solo lectura) | Personalizado | X | Admin Empresa | Nivel 9 |

### **Reglas de Jerarquía**

```typescript
// Regla 1: Solo puedes crear roles de nivel menor al tuyo
if (nuevoRol.nivel >= usuarioActual.rol.nivel) {
  throw new Error('No puedes crear un rol de nivel igual o superior al tuyo');
}

// Regla 2: Solo puedes editar roles de nivel menor al tuyo
if (rolParaEditar.nivel >= usuarioActual.rol.nivel) {
  throw new Error('No puedes editar un rol de nivel igual o superior al tuyo');
}

// Regla 3: Solo puedes asignar roles de nivel menor al tuyo
if (rolParaAsignar.nivel >= usuarioActual.rol.nivel) {
  throw new Error('No puedes asignar un rol de nivel igual o superior al tuyo');
}

// Regla 4: Solo Super Admin puede crear roles globales (empresa_id = NULL)
if (nuevoRol.empresa_id === null && usuarioActual.tipo !== 'super_admin') {
  throw new Error('Solo el Super Admin puede crear roles globales');
}

// Regla 5: Admin Empresa solo puede crear roles con nivel <= 60
if (usuarioActual.tipo === 'admin_empresa' && nuevoRol.nivel > 60) {
  throw new Error('No puedes crear roles de nivel superior a 60');
}

// Regla 6: Admin Empresa solo crea roles para SU empresa
if (usuarioActual.tipo === 'admin_empresa' && nuevoRol.empresa_id !== usuarioActual.empresa_id) {
  throw new Error('Solo puedes crear roles para tu empresa');
}
```

### **Migración de Base de Datos Necesaria**

```sql
-- Agregar campo nivel a la tabla roles
ALTER TABLE `roles` ADD COLUMN `nivel` INT NOT NULL DEFAULT 20 
  COMMENT 'Nivel de privilegio: 100=super_admin, 80=admin_empresa, 60-10=otros' 
  AFTER `es_admin`;

-- Agregar índice para nivel
ALTER TABLE `roles` ADD INDEX `idx_nivel` (`nivel`);

-- Actualizar roles existentes con sus niveles
UPDATE `roles` SET `nivel` = 100 WHERE `slug` = 'super_admin';
UPDATE `roles` SET `nivel` = 80 WHERE `slug` = 'admin_empresa';
UPDATE `roles` SET `nivel` = 60 WHERE `slug` = 'gerente';
UPDATE `roles` SET `nivel` = 20 WHERE `slug` = 'cajero';
UPDATE `roles` SET `nivel` = 20 WHERE `slug` = 'bodeguero';

-- Actualizar también la tabla usuarios para tener el nivel directamente
ALTER TABLE `usuarios` ADD COLUMN `nivel_privilegio` INT DEFAULT NULL 
  COMMENT 'Nivel heredado del rol principal' 
  AFTER `tipo_usuario`;

-- Trigger para actualizar nivel_privilegio automáticamente
DELIMITER $$
CREATE TRIGGER update_usuario_nivel 
AFTER INSERT ON usuario_rol
FOR EACH ROW
BEGIN
  DECLARE max_nivel INT;
  
  -- Obtener el nivel más alto de todos los roles del usuario
  SELECT MAX(r.nivel) INTO max_nivel
  FROM usuario_rol ur
  INNER JOIN roles r ON ur.rol_id = r.id
  WHERE ur.usuario_id = NEW.usuario_id;
  
  -- Actualizar el nivel del usuario
  UPDATE usuarios SET nivel_privilegio = max_nivel WHERE id = NEW.usuario_id;
END$$
DELIMITER ;
```

---

## 🔍 1. MÓDULOS SIMILARES EXISTENTES (ACTUALIZADO)

### **A. Módulo PLATAFORMA (Super Admin)**

**Ubicación**: `backend/src/platform/super-admin/`

**Estructura Actual:**
```
super-admin/
├── super-admin.controller.ts    (Dashboard y métricas)
├── empresas-admin.controller.ts (CRUD de empresas)
├── usuarios-admin.controller.ts (CRUD de usuarios) ⭐ SIMILAR
├── planes-admin.controller.ts   (CRUD de planes y licencias)
├── super-admin.routes.ts        (Rutas centralizadas)
└── README.md
```

**Frontend**:
- `frontend/public/super-admin.html` (Aplicación SPA con tabs)
- `frontend/public/assets/js/super-admin.js` (Lógica del frontend)

**Patrón Identificado:**
1. ✅ Controladores separados por dominio (empresas, usuarios, planes)
2. ✅ Un archivo de rutas centralizado (`super-admin.routes.ts`)
3. ✅ Frontend SPA con navegación por tabs/secciones
4. ✅ Cada sección tiene su propio contenedor en el HTML
5. ✅ JavaScript modular en un solo archivo `super-admin.js`

### **B. Módulo CORE Roles (Existente)**

**Ubicación**: `backend/src/core/roles/`

**Estructura:**
```
roles/
├── roles.controller.ts    (6 endpoints completos)
└── roles.routes.ts        (Rutas definidas)
```

**Endpoints Implementados:**
```typescript
GET    /api/roles                  // Lista de roles
GET    /api/roles/modulos-acciones // Matriz de permisos
GET    /api/roles/:id              // Detalle de rol con permisos
POST   /api/roles                  // Crear rol
PUT    /api/roles/:id              // Actualizar rol
DELETE /api/roles/:id              // Eliminar rol (soft delete)
```

**Frontend Existente:**
```html
<!-- dashboard.html -->
<div id="rolesModule" class="module-content">
  <!-- Tabla de roles -->
  <!-- Modal para crear/editar roles -->
  <!-- Matriz de permisos (módulos × acciones) -->
</div>
```

**JavaScript:**
```javascript
// dashboard.js (líneas 2274-2838)
- cargarRoles()
- abrirModalRol()
- cargarModulosAcciones()
- renderizarMatrizPermisos()
- togglePermiso()
- guardarRol()
- eliminarRol()
```

**Funcionalidad Completa:**
- ✅ CRUD completo de roles
- ✅ Matriz de permisos granular (módulos × acciones)
- ✅ Filtrado por tipo de rol (sistema/personalizado)
- ✅ Asignación de permisos por checkbox
- ✅ Contador de usuarios por rol
- ✅ Validación de seguridad (admin_empresa solo ve sus roles)

---

## 🗂️ 2. ESTRUCTURA ACTUAL DEL SISTEMA

### **Arquitectura de Módulos**

```
backend/src/
├── core/                           # Funcionalidades base del sistema
│   ├── auth/                       # Autenticación
│   ├── roles/                      # ⭐ Gestión de roles (ACTUAL)
│   ├── usuarios/                   # Usuarios base
│   ├── dashboard/                  # Dashboard general
│   └── middleware/                 # Middlewares
│
├── platform/                       # Módulos de la plataforma multi-tenant
│   ├── super-admin/                # ⭐ Módulo super administrador
│   │   ├── super-admin.controller.ts
│   │   ├── empresas-admin.controller.ts
│   │   ├── usuarios-admin.controller.ts  # ⭐ INTEGRAR AQUÍ
│   │   ├── planes-admin.controller.ts
│   │   └── super-admin.routes.ts
│   │
│   ├── ventas/                     # Gestión de ventas
│   ├── productos/                  # Catálogo de productos
│   ├── clientes/                   # CRM de clientes
│   ├── inventario/                 # Control de inventario
│   ├── facturacion/                # Facturación electrónica
│   └── ...                         # Otros módulos tenant
│
└── shared/                         # Utilidades compartidas
    ├── database.ts
    ├── logger.ts
    └── utils.ts
```

### **Base de Datos - Modelo de Permisos**

```sql
-- Tabla de módulos del sistema
modulos (17 registros)
├── id, nombre, nombre_mostrar
├── nivel: 'platform' | 'core' | 'tenant'
├── categoria: 'plataforma', 'administracion', 'operaciones', 'finanzas'
└── Ejemplos: empresas, planes, usuarios, roles, pos, ventas, productos...

-- Tabla de acciones disponibles
acciones (8 registros)
├── id, nombre, nombre_mostrar
└── Ejemplos: view, create, edit, delete, approve, export, import, print

-- Tabla de permisos (módulo × acción)
permisos
├── id, modulo_id, accion_id
├── codigo: 'productos.view', 'ventas.create', etc.
└── activo

-- Tabla de roles
roles
├── id, empresa_id (NULL = global)
├── nombre, descripcion, slug
├── tipo: 'sistema' | 'personalizado'
├── es_admin
└── activo

-- Tabla relacional rol_permiso
rol_permiso
├── rol_id
└── permiso_id

-- Tabla relacional usuario_rol
usuario_rol
├── usuario_id
├── rol_id
└── empresa_id
```

**Roles de Sistema Pre-configurados:**
1. `super_admin` (id=1, empresa_id=NULL) - Acceso total
2. `admin_empresa` (id=2) - Admin de empresa específica
3. `gerente`, `cajero`, `bodeguero` - Roles personalizados de ejemplo

---

## 📊 3. PATRONES Y CONVENCIONES IDENTIFICADAS

### **A. Estructura de Controladores**

**Patrón Observado en `usuarios-admin.controller.ts`:**

```typescript
/**
 * ========================================
 * MÓDULO: SUPER ADMIN - GESTIÓN DE USUARIOS
 * ========================================
 * CRUD de usuarios, asignación de roles y empresas
 */

import { Request, Response } from 'express';
import pool from '../../shared/database';
import logger from '../../shared/logger';

// Funciones exportadas:
export const getUsuarios = async (req: Request, res: Response) => { /* ... */ }
export const getUsuarioById = async (req: Request, res: Response) => { /* ... */ }
export const createUsuario = async (req: Request, res: Response) => { /* ... */ }
export const updateUsuario = async (req: Request, res: Response) => { /* ... */ }
export const deleteUsuario = async (req: Request, res: Response) => { /* ... */ }
export const asignarUsuarioEmpresa = async (req: Request, res: Response) => { /* ... */ }
```

**Patrón de Respuestas:**
```typescript
// Éxito
res.json({
  success: true,
  data: resultado,
  pagination?: { total, limit, offset }
});

// Error
res.status(400/404/500).json({
  success: false,
  message: 'Descripción del error',
  error?: error.message
});
```

### **B. Estructura de Rutas**

**Patrón Observado en `super-admin.routes.ts`:**

```typescript
import { Router } from 'express';
import * as usuariosAdminController from './usuarios-admin.controller';

const router = Router();

// ========================================
// GESTIÓN DE USUARIOS
// ========================================
router.get('/usuarios', usuariosAdminController.getUsuarios);
router.get('/usuarios/:id', usuariosAdminController.getUsuarioById);
router.post('/usuarios', usuariosAdminController.createUsuario);
router.put('/usuarios/:id', usuariosAdminController.updateUsuario);
router.delete('/usuarios/:id', usuariosAdminController.deleteUsuario);

// Sub-recursos
router.post('/usuarios/:id/empresas', usuariosAdminController.asignarUsuarioEmpresa);
router.delete('/usuarios/:id/empresas/:empresaId', usuariosAdminController.desasignarUsuarioEmpresa);
```

### **C. Frontend - Patrón SPA con Tabs**

**Patrón Observado en `super-admin.html`:**

```html
<!-- Navbar con tabs de navegación -->
<nav class="navbar">
  <ul class="navbar-nav">
    <li><a href="#dashboard">Dashboard</a></li>
    <li><a href="#empresas">Empresas</a></li>
    <li><a href="#usuarios">Usuarios</a></li> <!-- ⭐ AGREGAR ROLES AQUÍ -->
    <li><a href="#planes">Planes y Licencias</a></li>
  </ul>
</nav>

<!-- Contenedor para cada sección -->
<div id="dashboard-section" class="section-content">...</div>
<div id="empresas-section" class="section-content">...</div>
<div id="usuarios-section" class="section-content">
  <!-- ⭐ AGREGAR SUB-TAB DE ROLES AQUÍ -->
</div>
<div id="planes-section" class="section-content">...</div>
```

**Patrón Observado en `super-admin.js`:**

```javascript
// Navegación entre secciones
function cambiarSeccion(seccion) {
  // Ocultar todas las secciones
  document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');
  // Mostrar la sección activa
  document.getElementById(`${seccion}-section`).style.display = 'block';
  // Cargar datos
  if (seccion === 'usuarios') cargarUsuarios();
}

// Funciones CRUD por sección
async function cargarUsuarios() { /* ... */ }
async function crearUsuario(datos) { /* ... */ }
async function actualizarUsuario(id, datos) { /* ... */ }
```

## 🎯 4. DIFERENCIAS CLAVE ENTRE MÓDULOS (ACTUALIZADO)

### **Comparación: Roles Globales vs Roles Específicos**

| Aspecto | ROLES GLOBALES (Super Admin) | ROLES ESPECÍFICOS (Admin Empresa) |
|---------|------------------------------|-----------------------------------|
| **Ámbito** | Todo el sistema | Solo su empresa |
| **empresa_id** | `NULL` | Valor específico (ej: 1, 2, 3) |
| **Nivel Permitido** | 80-99 (hasta 100 es solo seed) | 10-60 |
| **Acceso API** | `/api/super-admin/roles-globales` | `/api/roles` (actual) |
| **Quién Crea** | Solo super_admin | admin_empresa de la empresa |
| **Ejemplos** | Super Admin, Admin Empresa, Gerente General | Cajero, Contador, Supervisor, Vendedor |
| **Frontend** | `super-admin.html` (NUEVO) | `dashboard.html` (YA EXISTE) |
| **Seguridad** | Middleware super_admin | Middleware + filtro empresa_id |
| **Edición** | Solo super_admin | admin_empresa (solo sus roles) |
| **Asignación** | Super Admin asigna a usuarios de empresas | Admin Empresa asigna a su equipo |
| **Jerarquía** | Puede crear hasta nivel 99 | Puede crear hasta nivel 60 |

### **Validaciones por Nivel de Usuario**

```typescript
// SUPER ADMIN (nivel 100)
✅ Puede crear roles globales (empresa_id = NULL)
✅ Puede crear roles específicos de cualquier empresa
✅ Puede crear roles hasta nivel 99
✅ Puede editar cualquier rol excepto otro super_admin
✅ Puede asignar roles globales (admin_empresa) a usuarios
✅ Puede ver TODOS los roles del sistema

// ADMIN EMPRESA (nivel 80)
❌ NO puede crear roles globales
✅ Puede crear roles SOLO de su empresa (empresa_id = X)
✅ Puede crear roles hasta nivel 60 (no puede crear otro admin_empresa)
✅ Puede editar roles de su empresa con nivel < 80
✅ Puede asignar roles de su empresa a su equipo
✅ Puede ver roles globales (solo lectura) y sus roles específicos

// GERENTE (nivel 60)
❌ NO puede crear/editar roles (solo usar el módulo si tiene permiso)
✅ Puede ver los roles de su empresa
❌ NO puede asignar roles a otros usuarios

// OTROS ROLES (nivel < 60)
❌ NO tienen acceso al módulo de gestión de roles
✅ Solo usan los permisos heredados de su rol
```

---

## 💡 5. PROPUESTA DE IMPLEMENTACIÓN (ACTUALIZADA)

## 💡 5. PROPUESTA DE IMPLEMENTACIÓN (ACTUALIZADA)

### **Enfoque: MANTENER DOS MÓDULOS SEPARADOS + JERARQUÍAS**

**NO fusionar**, sino **mejorar y complementar** con jerarquías:

1. ✅ **Mantener módulo actual** en `dashboard.html` (Admin Empresa)
2. ✅ **Crear nuevo módulo** en `super-admin.html` (Super Admin)
3. ✅ **Agregar sistema de jerarquías** en el backend (nivel de privilegio)
4. ✅ **Compartir lógica común** pero con validaciones diferentes

### **Arquitectura Propuesta**

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND - Controladores                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  core/roles/                                                     │
│  ├── roles.controller.ts          ← MEJORAR (agregar jerarquías)│
│  │   ├── getRoles()               (filtrar por empresa_id)      │
│  │   ├── createRol()              (validar nivel < usuario)     │
│  │   ├── updateRol()              (validar nivel < usuario)     │
│  │   └── deleteRol()              (validar nivel < usuario)     │
│  └── roles.routes.ts                                             │
│                                                                  │
│  platform/super-admin/                                           │
│  ├── roles-globales.controller.ts  ← NUEVO                      │
│  │   ├── getRolesGlobales()       (empresa_id = NULL)           │
│  │   ├── createRolGlobal()        (solo super_admin)            │
│  │   ├── updateRolGlobal()        (validar nivel = 80-99)       │
│  │   └── deleteRolGlobal()        (validar no asignado)         │
│  └── super-admin.routes.ts        ← ACTUALIZAR                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND - Interfaces                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  super-admin.html                  ← AGREGAR sección            │
│  ├── Tab: Roles Globales           (empresa_id = NULL)          │
│  │   ├── Lista de roles globales                                │
│  │   ├── Crear/Editar (nivel 80-99)                             │
│  │   └── Asignar a administradores                              │
│  └── super-admin.js                ← AGREGAR funciones          │
│                                                                  │
│  dashboard.html                    ← MEJORAR existente          │
│  ├── Módulo: Roles (ya existe)                                  │
│  │   ├── Ver roles globales (solo lectura)                      │
│  │   ├── Gestionar roles específicos (nivel 10-60)              │
│  │   └── Limitar creación por nivel                             │
│  └── dashboard.js                  ← MEJORAR validaciones       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    BASE DE DATOS - Cambios                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  roles                             ← AGREGAR campo              │
│  ├── nivel INT NOT NULL DEFAULT 20  (jerarquía de privilegios)  │
│  └── INDEX idx_nivel (nivel)                                     │
│                                                                  │
│  usuarios                          ← AGREGAR campo              │
│  └── nivel_privilegio INT           (caché del nivel más alto)  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### **Implementación Detallada**

#### **FASE 1: Migración de Base de Datos (1 hora)**

**Archivo**: ✅ `SQL/migration_roles_jerarquia.sql` **(YA CREADO)**

**⚠️ IMPORTANTE: La base de datos está en AWS RDS, NO local**

**Guía Completa**: Ver archivo [COMANDOS_MIGRACION_JERARQUIAS.md](COMANDOS_MIGRACION_JERARQUIAS.md)

##### **Paso 1A: Probar en Local (Opcional pero Recomendado)**

```powershell
# En tu PC con XAMPP
cd C:\xampp\htdocs\kore-inventory

# 1. Backup local
C:\xampp\mysql\bin\mysqldump.exe -u root kore_inventory > backup_local.sql

# 2. Ejecutar migración
C:\xampp\mysql\bin\mysql.exe -u root kore_inventory < SQL\migration_roles_jerarquia.sql

# 3. Verificar
C:\xampp\mysql\bin\mysql.exe -u root kore_inventory -e "SELECT id, nombre, nivel FROM roles ORDER BY nivel DESC;"
```

##### **Paso 1B: Ejecutar en AWS RDS (Producción)**

```bash
# 1. Conectar al servidor EC2
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99

# 2. Actualizar código
cd /home/ubuntu/kore-inventory
git pull origin main

# 3. Cargar credenciales RDS
cd backend
source .env

# 4. ⚠️ HACER BACKUP DE RDS (CRÍTICO)
mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME > ~/backup_jerarquia_$(date +%Y%m%d_%H%M%S).sql

# 5. Verificar backup
ls -lh ~/backup_jerarquia_*.sql

# 6. EJECUTAR MIGRACIÓN
cd /home/ubuntu/kore-inventory
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < SQL/migration_roles_jerarquia.sql

# 7. Verificar campos creados
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "DESC roles;" | grep nivel
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "DESC usuarios;" | grep nivel

# 8. Ver roles con niveles
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SELECT id, nombre, nivel FROM roles ORDER BY nivel DESC;"

# 9. Verificar triggers
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SHOW TRIGGERS WHERE \`Table\` IN ('usuario_rol', 'roles');"
```

**Rollback (si algo falla):**
```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < ~/backup_jerarquia_YYYYMMDD_HHMMSS.sql
```

#### **FASE 2: Backend - Jerarquías en Roles Existente (2-3 horas)**

**Archivo**: `backend/src/core/roles/roles.controller.ts`

**Mejoras a aplicar:**

```typescript
// ============================================
// HELPER: Validar jerarquía de roles
// ============================================

interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Valida si un usuario puede crear/editar un rol según jerarquía
 */
async function validarJerarquiaRol(
  usuario: any,
  nivelRolObjetivo: number,
  empresaIdRol: number | null,
  operacion: 'crear' | 'editar' | 'eliminar'
): Promise<ValidationResult> {
  
  // Obtener nivel del usuario
  let nivelUsuario = usuario.nivel_privilegio;
  
  // Si no tiene nivel_privilegio, buscarlo de sus roles
  if (!nivelUsuario) {
    const [roles] = await pool.execute<RowDataPacket[]>(`
      SELECT MAX(r.nivel) as max_nivel
      FROM usuario_rol ur
      INNER JOIN roles r ON ur.rol_id = r.id
      WHERE ur.usuario_id = ?
    `, [usuario.id]);
    
    nivelUsuario = roles[0]?.max_nivel || 0;
  }

  // Regla 1: Solo puedes crear/editar roles de nivel menor al tuyo
  if (nivelRolObjetivo >= nivelUsuario) {
    return {
      valid: false,
      message: `No puedes ${operacion} un rol de nivel igual o superior al tuyo (${nivelUsuario})`
    };
  }

  // Regla 2: Solo super_admin puede crear roles globales
  if (empresaIdRol === null && usuario.tipo_usuario !== 'super_admin') {
    return {
      valid: false,
      message: 'Solo el Super Admin puede crear roles globales'
    };
  }

  // Regla 3: Admin empresa solo puede crear roles hasta nivel 60
  if (usuario.tipo_usuario === 'admin_empresa' && nivelRolObjetivo > 60) {
    return {
      valid: false,
      message: 'Como Admin de Empresa solo puedes crear roles hasta nivel 60'
    };
  }

  // Regla 4: Admin empresa solo crea roles para SU empresa
  if (usuario.tipo_usuario === 'admin_empresa' && 
      empresaIdRol !== null && 
      empresaIdRol !== usuario.empresa_id) {
    return {
      valid: false,
      message: 'Solo puedes crear roles para tu empresa'
    };
  }

  return { valid: true };
}

// ============================================
// CREAR ROL (MEJORADO CON JERARQUÍAS)
// ============================================

export const createRol = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const usuario = (req as any).user;
    const { nombre, descripcion, empresa_id, permisos_ids, nivel } = req.body;

    if (!usuario) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
      await connection.rollback();
      connection.release();
      return;
    }

    // Validaciones básicas
    if (!nombre || !nombre.trim()) {
      res.status(400).json({
        success: false,
        message: 'El nombre del rol es obligatorio'
      });
      await connection.rollback();
      connection.release();
      return;
    }

    if (!nivel || nivel < 10 || nivel > 99) {
      res.status(400).json({
        success: false,
        message: 'El nivel del rol debe estar entre 10 y 99'
      });
      await connection.rollback();
      connection.release();
      return;
    }

    // ⭐ VALIDAR JERARQUÍA
    const validacion = await validarJerarquiaRol(
      usuario,
      nivel,
      empresa_id || null,
      'crear'
    );

    if (!validacion.valid) {
      res.status(403).json({
        success: false,
        message: validacion.message
      });
      await connection.rollback();
      connection.release();
      return;
    }

    // Determinar empresa_id según tipo de usuario
    let empresaIdFinal: number | null = null;
    if (usuario.tipo_usuario !== 'super_admin') {
      empresaIdFinal = usuario.empresa_id;
    } else {
      empresaIdFinal = empresa_id || null;
    }

    // Validar nombre único en el scope
    const [existentes] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM roles 
       WHERE nombre = ? 
       AND empresa_id <=> ?`,
      [nombre.trim(), empresaIdFinal]
    );

    if (existentes.length > 0) {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: 'Ya existe un rol con ese nombre en esta empresa'
      });
      connection.release();
      return;
    }

    // Generar slug
    const slug = nombre.toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '_');

    // Crear el rol CON NIVEL
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO roles (
        empresa_id,
        nombre,
        descripcion,
        slug,
        tipo,
        es_admin,
        nivel,
        activo,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaIdFinal,
        nombre.trim(),
        descripcion?.trim() || null,
        slug,
        empresaIdFinal === null ? 'sistema' : 'personalizado',
        nivel >= 80 ? 1 : 0,  // Es admin si nivel >= 80
        nivel,
        1,  // activo por defecto
        usuario.id
      ]
    );

    const rolId = result.insertId;

    // Asignar permisos
    if (permisos_ids && Array.isArray(permisos_ids) && permisos_ids.length > 0) {
      const permisosValues = permisos_ids.map((permisoId: number) => [
        rolId,
        permisoId,
        usuario.id
      ]);

      await connection.query(
        `INSERT INTO rol_permiso (rol_id, permiso_id, created_by) VALUES ?`,
        [permisosValues]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Rol creado exitosamente',
      data: {
        id: rolId,
        nombre,
        nivel,
        empresa_id: empresaIdFinal,
        permisos_count: permisos_ids?.length || 0
      }
    });

  } catch (error: any) {
    await connection.rollback();
    console.error('Error al crear rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear rol',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ============================================
// ACTUALIZAR ROL (MEJORADO CON JERARQUÍAS)
// ============================================

export const updateRol = async (req: Request, res: Response): Promise<void> => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const usuario = (req as any).user;
    const { nombre, descripcion, activo, permisos_ids, nivel } = req.body;

    // Obtener rol actual
    const [roles] = await connection.execute<RowDataPacket[]>(
      `SELECT * FROM roles WHERE id = ?`,
      [id]
    );

    if (roles.length === 0) {
      await connection.rollback();
      res.status(404).json({
        success: false,
        message: 'Rol no encontrado'
      });
      connection.release();
      return;
    }

    const rolActual = roles[0];

    // ⭐ VALIDAR JERARQUÍA para editar
    const validacion = await validarJerarquiaRol(
      usuario,
      rolActual.nivel,
      rolActual.empresa_id,
      'editar'
    );

    if (!validacion.valid) {
      res.status(403).json({
        success: false,
        message: validacion.message
      });
      await connection.rollback();
      connection.release();
      return;
    }

    // Si cambia el nivel, validar el nuevo nivel también
    if (nivel && nivel !== rolActual.nivel) {
      const validacionNuevoNivel = await validarJerarquiaRol(
        usuario,
        nivel,
        rolActual.empresa_id,
        'editar'
      );

      if (!validacionNuevoNivel.valid) {
        res.status(403).json({
          success: false,
          message: validacionNuevoNivel.message
        });
        await connection.rollback();
        connection.release();
        return;
      }
    }

    // No permitir editar roles de sistema
    if (rolActual.tipo === 'sistema') {
      await connection.rollback();
      res.status(400).json({
        success: false,
        message: 'Los roles de sistema no se pueden modificar'
      });
      connection.release();
      return;
    }

    // Actualizar rol
    await connection.execute(
      `UPDATE roles 
       SET nombre = ?, 
           descripcion = ?, 
           activo = ?,
           nivel = ?,
           es_admin = ?
       WHERE id = ?`,
      [
        nombre || rolActual.nombre,
        descripcion !== undefined ? descripcion : rolActual.descripcion,
        activo !== undefined ? activo : rolActual.activo,
        nivel || rolActual.nivel,
        (nivel || rolActual.nivel) >= 80 ? 1 : 0,  // Actualizar es_admin según nivel
        id
      ]
    );

    // Actualizar permisos si se proporcionaron
    if (permisos_ids && Array.isArray(permisos_ids)) {
      await connection.execute(
        `DELETE FROM rol_permiso WHERE rol_id = ?`,
        [id]
      );

      if (permisos_ids.length > 0) {
        const permisosValues = permisos_ids.map((permisoId: number) => [
          id,
          permisoId,
          usuario.id
        ]);

        await connection.query(
          `INSERT INTO rol_permiso (rol_id, permiso_id, created_by) VALUES ?`,
          [permisosValues]
        );
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Rol actualizado exitosamente'
    });

  } catch (error: any) {
    await connection.rollback();
    console.error('Error al actualizar rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar rol',
      error: error.message
    });
  } finally {
    connection.release();
  }
};
```

#### **FASE 3: Backend - Nuevo Controlador Roles Globales (2 horas)**

**Archivo**: `backend/src/platform/super-admin/roles-globales.controller.ts`

```typescript
/**
 * ========================================
 * MÓDULO: SUPER ADMIN - GESTIÓN DE ROLES GLOBALES
 * ========================================
 * Gestión de roles globales (empresa_id = NULL)
 * Solo accesible por super_admin
 */

import { Request, Response } from 'express';
import pool from '../../shared/database';
import logger from '../../shared/logger';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * GET /api/super-admin/roles-globales
 * Lista roles globales (empresa_id = NULL)
 */
export const getRolesGlobales = async (req: Request, res: Response) => {
  try {
    const usuario = (req as any).user;

    if (usuario.tipo_usuario !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo el Super Admin puede acceder a los roles globales'
      });
    }

    const [roles] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        r.id,
        r.nombre,
        r.descripcion,
        r.slug,
        r.tipo,
        r.nivel,
        r.es_admin,
        r.activo,
        r.created_at,
        r.updated_at,
        (SELECT COUNT(*) FROM usuario_rol WHERE rol_id = r.id) as usuarios_count
      FROM roles r
      WHERE r.empresa_id IS NULL
      ORDER BY r.nivel DESC, r.nombre ASC
    `);

    res.json({
      success: true,
      data: roles
    });

  } catch (error: any) {
    logger.error('Error al obtener roles globales:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener roles globales',
      error: error.message
    });
  }
};

/**
 * POST /api/super-admin/roles-globales
 * Crear un rol global
 */
export const createRolGlobal = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    const usuario = (req as any).user;
    const { nombre, descripcion, nivel, permisos_ids } = req.body;

    if (usuario.tipo_usuario !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo el Super Admin puede crear roles globales'
      });
    }

    // Validaciones
    if (!nombre) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es obligatorio'
      });
    }

    if (!nivel || nivel < 80 || nivel > 99) {
      return res.status(400).json({
        success: false,
        message: 'El nivel debe estar entre 80 y 99 para roles globales'
      });
    }

    // Validar nombre único
    const [existentes] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM roles WHERE nombre = ? AND empresa_id IS NULL`,
      [nombre]
    );

    if (existentes.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Ya existe un rol global con ese nombre'
      });
    }

    const slug = nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_');

    // Crear rol global
    const [result] = await connection.execute<ResultSetHeader>(`
      INSERT INTO roles (
        empresa_id, nombre, descripcion, slug, tipo, es_admin, nivel, activo, created_by
      ) VALUES (NULL, ?, ?, ?, 'sistema', ?, ?, 1, ?)
    `, [nombre, descripcion, slug, nivel >= 80 ? 1 : 0, nivel, usuario.id]);

    const rolId = result.insertId;

    // Asignar permisos
    if (permisos_ids && Array.isArray(permisos_ids) && permisos_ids.length > 0) {
      const values = permisos_ids.map((pid: number) => [rolId, pid, usuario.id]);
      await connection.query(
        `INSERT INTO rol_permiso (rol_id, permiso_id, created_by) VALUES ?`,
        [values]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Rol global creado exitosamente',
      data: { id: rolId, nombre, nivel }
    });

  } catch (error: any) {
    await connection.rollback();
    logger.error('Error al crear rol global:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear rol global',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// ... Implementar updateRolGlobal, deleteRolGlobal similar
```

**Actualizar** `super-admin.routes.ts`:

```typescript
import * as rolesGlobalesController from './roles-globales.controller';

// GESTIÓN DE ROLES GLOBALES
router.get('/roles-globales', rolesGlobalesController.getRolesGlobales);
router.post('/roles-globales', rolesGlobalesController.createRolGlobal);
router.put('/roles-globales/:id', rolesGlobalesController.updateRolGlobal);
router.delete('/roles-globales/:id', rolesGlobalesController.deleteRolGlobal);
```

---

### **Resumen de Cambios**

| Componente | Acción | Tiempo Estimado |
|------------|--------|-----------------|
| **Base de Datos** | Migración (agregar `nivel`) | 1 hora |
| **Backend Core** | Mejorar `roles.controller.ts` con jerarquías | 2-3 horas |
| **Backend Super Admin** | Crear `roles-globales.controller.ts` | 2 horas |
| **Frontend Super Admin** | Agregar sección en `super-admin.html` | 3 horas |
| **Frontend Dashboard** | Mejorar validaciones en `dashboard.html` | 2 horas |
| **Testing** | Pruebas completas de jerarquías | 2 horas |
| **Deploy** | Migración y deploy en servidor | 1 hora |
| **TOTAL** | | **13-15 horas** (2-3 días) |

---

## ✅ 7. PLAN DE IMPLEMENTACIÓN (ACTUALIZADO)

---

## 🔒 8. CONSIDERACIONES DE SEGURIDAD

### **Validaciones Necesarias**

```typescript
// En roles-admin.controller.ts

// 1. Solo super_admin puede acceder
if (usuario.tipo_usuario !== 'super_admin') {
  return res.status(403).json({
    success: false,
    message: 'Acceso denegado. Se requiere rol de Super Administrador.'
  });
}

// 2. No permitir eliminar roles con usuarios asignados
const [usuarios] = await pool.execute(
  'SELECT COUNT(*) as total FROM usuario_rol WHERE rol_id = ?',
  [rolId]
);
if (usuarios[0].total > 0) {
  return res.status(400).json({
    success: false,
    message: `No se puede eliminar. Hay ${usuarios[0].total} usuario(s) con este rol.`
  });
}

// 3. No permitir editar roles de sistema
if (rol.tipo === 'sistema') {
  return res.status(400).json({
    success: false,
    message: 'Los roles de sistema no se pueden modificar.'
  });
}

// 4. Log de auditoría
await pool.execute(`
  INSERT INTO auditoria_logs (usuario_id, accion, tabla, registro_id, detalles)
  VALUES (?, ?, ?, ?, ?)
`, [
  usuario.id,
  'DELETE_ROL',
  'roles',
  rolId,
  JSON.stringify({ nombre: rol.nombre })
]);
```

---

## 📝 9. CHECKLIST DE IMPLEMENTACIÓN

### **Backend**
- [ ] Crear archivo `roles-admin.controller.ts`
- [ ] Implementar función `getRoles()`
- [ ] Implementar función `getRolById()`
- [ ] Implementar función `createRol()`
- [ ] Implementar función `updateRol()`
- [ ] Implementar función `deleteRol()`
- [ ] Implementar función `getModulosAcciones()`
- [ ] Agregar validaciones de seguridad
- [ ] Agregar logs de auditoría
- [ ] Actualizar `super-admin.routes.ts`
- [ ] Probar endpoints con Postman

### **Frontend**
- [ ] Crear sección "Roles" en `super-admin.html`
- [ ] Migrar tabla de roles
- [ ] Migrar modal de creación/edición
- [ ] Migrar matriz de permisos
- [ ] Migrar funciones JS a `super-admin.js`
- [ ] Actualizar rutas API
- [ ] Probar CRUD completo en navegador
- [ ] Verificar estilos CSS
- [ ] Probar responsive design

### **Testing**
- [ ] Crear rol personalizado
- [ ] Editar rol personalizado
- [ ] Asignar permisos granulares
- [ ] Eliminar rol sin usuarios
- [ ] Intentar eliminar rol con usuarios (debe fallar)
- [ ] Intentar editar rol de sistema (debe fallar)
- [ ] Verificar permisos desde dashboard normal
- [ ] Probar con usuario no super_admin (debe bloquear)

### **Documentación**
- [ ] Actualizar README de super-admin
- [ ] Actualizar ESTRUCTURA_SERVIDOR.md
- [ ] Documentar nuevas rutas API
- [ ] Crear guía de uso para super_admin

### **Deploy**
- [ ] Build de backend: `npm run build`
- [ ] Commit y push a GitHub
- [ ] Git pull en servidor EC2
- [ ] Restart PM2: `pm2 restart kore-backend`
- [ ] Verificar logs: `pm2 logs kore-backend`
- [ ] Smoke test en producción

---

## 🎨 10. WIREFRAME PROPUESTO

### **Super Admin → Usuarios → Roles**

```
┌─────────────────────────────────────────────────────────────┐
│ KORE Super Admin                         🔔  👤 Super Admin │
├─────────────────────────────────────────────────────────────┤
│ Dashboard  Empresas  [Usuarios]  Planes  Actividad         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────┐              │
│  │ 📋 Lista de Usuarios  │  🛡️ Roles        │              │
│  └──────────────────────────────────────────┘              │
│                                                              │
│  Gestión de Roles y Permisos               [➕ Crear Rol]  │
│  Administración de roles con permisos granulares           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐│
│  │ 🛡️  Roles de Sistema                                    ││
│  ├────┬──────────────┬───────────┬────────┬────────────────┤│
│  │ 🛡️ │ Nombre       │ Tipo      │Usuarios│ Acciones       ││
│  ├────┼──────────────┼───────────┼────────┼────────────────┤│
│  │ 🛡️ │ Super Admin  │ Sistema   │   1    │ 👁️ Ver         ││
│  │ 🛡️ │ Admin Empresa│ Sistema   │   5    │ 👁️ Ver         ││
│  └────┴──────────────┴───────────┴────────┴────────────────┘│
│                                                              │
│  ┌────────────────────────────────────────────────────────┐│
│  │ ⚙️  Roles Personalizados        ☑️ Mostrar inactivos   ││
│  ├────┬──────────────┬───────────┬────────┬────────────────┤│
│  │ 🛡️ │ Nombre       │ Tipo      │Usuarios│ Acciones       ││
│  ├────┼──────────────┼───────────┼────────┼────────────────┤│
│  │ 🛡️ │ Gerente      │Personaliz.│   3    │👁️ ✏️ 🗑️        ││
│  │ 🛡️ │ Cajero       │Personaliz.│   8    │👁️ ✏️ 🗑️        ││
│  │ 🛡️ │ Bodeguero    │Personaliz.│   4    │👁️ ✏️ 🗑️        ││
│  └────┴──────────────┴───────────┴────────┴────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘

Modal: Crear/Editar Rol
┌─────────────────────────────────────────────┐
│ ✏️ Crear Rol                           ✖️   │
├─────────────────────────────────────────────┤
│ Nombre: [_____________________________]     │
│ Descripción: [________________________]     │
│                                             │
│ ⚙️ Permisos por Módulo                      │
│ ┌─────────────────────────────────────────┐│
│ │ 📂 OPERACIONES                          ││
│ │ ┌───────────┬───┬───┬───┬───┬───┬───┐  ││
│ │ │ Módulo    │Ver│Cre│Edi│Eli│Exp│☑️ │  ││
│ │ ├───────────┼───┼───┼───┼───┼───┼───┤  ││
│ │ │ Ventas    │ ☑️│ ☑️│ ☐ │ ☐ │ ☑️│ ☑️│  ││
│ │ │ Productos │ ☑️│ ☐ │ ☐ │ ☐ │ ☑️│ ☐ │  ││
│ │ │ Clientes  │ ☑️│ ☑️│ ☑️│ ☐ │ ☑️│ ☑️│  ││
│ │ └───────────┴───┴───┴───┴───┴───┴───┘  ││
│ └─────────────────────────────────────────┘│
│                                             │
│             [Cancelar]  [Guardar Rol]       │
└─────────────────────────────────────────────┘
```

---

## 🚀 8. RECOMENDACIÓN FINAL (ACTUALIZADA)

### **Implementar: Sistema de Jerarquías + Dos Módulos Separados**

**Enfoque Recomendado:**

1. ✅ **Mantener dos módulos separados** con propósitos distintos
2. ✅ **Agregar sistema de jerarquías** (campo `nivel`) en backend
3. ✅ **Crear módulo nuevo** en Super Admin para roles globales
4. ✅ **Mejorar módulo existente** en Dashboard para roles específicos

### **Justificación**

**Por qué DOS módulos y NO fusionar:**

1. ✅ **Separación de Responsabilidades**: 
   - Super Admin gestiona roles GLOBALES para administradores
   - Admin Empresa gestiona roles ESPECÍFICOS para su equipo

2. ✅ **Diferentes Contextos de Uso**:
   - Super Admin: Vista global del sistema, crea roles 80-99
   - Admin Empresa: Vista de su empresa, crea roles 10-60

3. ✅ **Mejor Seguridad**:
   - Validaciones diferentes según el contexto
   - Imposible que admin empresa cree roles superiores

4. ✅ **Mejor UX**:
   - Super Admin no se confunde con roles de empresas específicas
   - Admin Empresa solo ve lo relevante para su gestión

5. ✅ **Escalabilidad**:
   - Permite agregar funcionalidades específicas por módulo
   - Facilita futuras mejoras sin afectar el otro módulo

### **Esfuerzo Estimado**

| Fase | Tiempo | Complejidad |
|------|--------|-------------|
| **Migración BD** (agregar nivel) | 1 hora | Media |
| **Backend Core** (jerarquías en roles.controller) | 2-3 horas | Alta |
| **Backend Super Admin** (roles-globales.controller) | 2 horas | Media |
| **Frontend Super Admin** (nueva sección) | 3 horas | Media |
| **Frontend Dashboard** (mejoras validación) | 2 horas | Baja |
| **Testing Completo** | 2 horas | Alta |
| **Deploy Producción** | 1 hora | Media |
| **TOTAL** | **13-15 horas** | |

**Equivale a: 2-3 días de trabajo**

### **Riesgos y Mitigaciones**

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Migración BD falla | Baja | Alto | Backup completo antes de aplicar |
| Roles existentes sin nivel | Media | Medio | Script de actualización incluido |
| Usuarios sin nivel_privilegio | Baja | Medio | Trigger automático actualiza |
| Jerarquías mal validadas | Media | Alto | Testing exhaustivo de todos los casos |
| Admin empresa crea rol superior | Baja | Alto | Validación doble (frontend + backend) |

### **Beneficios Clave**

✅ **Jerarquías Claras**: Nadie puede crear roles superiores a su nivel  
✅ **Seguridad Mejorada**: Solo super_admin crea administradores  
✅ **UX Optimizada**: Cada usuario ve solo lo que le corresponde  
✅ **Auditoría**: Logs de quién crea qué roles  
✅ **Flexibilidad**: Admin empresa personaliza roles de su equipo  
✅ **Control Centralizado**: Super admin gestiona roles globales  
✅ **Escalable**: Fácil agregar más niveles en el futuro  

### **Casos de Uso Resueltos**

**Caso 1: Super Admin crea nueva empresa**
```
1. Super Admin crea rol "Gerente General" (nivel 60, global)
2. Crea empresa "Empresa XYZ"
3. Crea usuario "Juan Pérez" para esa empresa
4. Asigna rol "Admin Empresa" (nivel 80) a Juan
5. Juan ahora puede gestionar SU empresa
```

**Caso 2: Admin Empresa organiza su equipo**
```
1. Juan (Admin Empresa, nivel 80) entra a su panel
2. Ve roles globales (solo lectura): Admin Empresa, Gerente General
3. Crea rol "Cajero Turno Mañana" (nivel 20) con permisos POS
4. Crea rol "Contador Junior" (nivel 40) con permisos contables
5. Asigna estos roles a su equipo
6. NO puede crear rol nivel 80+ (bloqueado)
```

**Caso 3: Jerarquía previene escalada de privilegios**
```
1. Admin Empresa intenta crear rol nivel 85
   ❌ Backend rechaza: "Nivel máximo permitido: 60"
   
2. Admin Empresa intenta editar rol "Admin Empresa" 
   ❌ Backend rechaza: "No puedes editar roles de nivel superior"
   
3. Gerente (nivel 60) intenta crear rol nivel 30
   ❌ Backend rechaza: "No tienes permisos para gestionar roles"
   (Solo admin_empresa y super_admin pueden crear roles)
```

### **Decisión: ¿Proceder con Implementación?**

**✅ SÍ - Recomiendo implementar por las siguientes razones:**

1. **Necesidad Real**: El sistema actual NO tiene gestión de roles globales
2. **Problema de Seguridad**: Actualmente no hay jerarquías (cualquiera podría crear cualquier rol)
3. **Mejora Crítica**: Las jeraraquías son fundamentales para multi-tenancy seguro
4. **ROI Alto**: 2-3 días de trabajo por una mejora permanente en seguridad y UX
5. **Sin Breaking Changes**: El módulo actual sigue funcionando, solo se mejora

**📋 Próximos Pasos Sugeridos:**

1. **Aprobar** el análisis y plan de implementación
2. **Priorizar** en el roadmap (sugerencia: próximo sprint)
3. **Preparar** entorno de pruebas con datos de varios roles
4. **Ejecutar Fase 1** (migración BD) en local primero
5. **Desarrollo iterativo** fase por fase
6. **Testing continuo** después de cada fase
7. **Deploy gradual**: Local → Staging → Producción

---

## 📚 9. REFERENCIAS

### **Archivos Analizados**

**Backend:**
- `backend/src/core/roles/roles.controller.ts` (693 líneas)
- `backend/src/core/roles/roles.routes.ts`
- `backend/src/platform/super-admin/usuarios-admin.controller.ts` (583 líneas)
- `backend/src/platform/super-admin/super-admin.routes.ts`
- `backend/src/routes.ts`

**Frontend:**
- `frontend/public/dashboard.html` (líneas 1192-1267: módulo roles)
- `frontend/public/super-admin.html` (880 líneas)
- `frontend/public/assets/js/dashboard.js` (líneas 2274-2838: gestión roles)
- `frontend/public/assets/js/super-admin.js`

**Base de Datos:**
- `SQL/roles.sql` (estructura tabla roles)
- `SQL/modulos.sql` (17 módulos del sistema)
- `SQL/acciones.sql` (8 acciones: view, create, edit, delete, etc.)
- `SQL/rol_permiso.sql` (tabla relacional)
- `SQL/kore_inventory_full.sql` (esquema completo)

**Documentación:**
- `ESTRUCTURA_SERVIDOR.md` (988 líneas, estructura completa)
- `backend/src/platform/super-admin/README.md`

### **Tablas de Base de Datos Involucradas**

```sql
roles
├── id
├── empresa_id (NULL = global)
├── nombre
├── slug
├── tipo ('sistema' | 'personalizado')
├── es_admin
├── nivel ⭐ NUEVO
└── activo

usuarios
├── id
├── tipo_usuario ('super_admin' | 'admin_empresa' | 'usuario')
├── nivel_privilegio ⭐ NUEVO (caché del rol más alto)
└── empresa_id

usuario_rol (relacional)
├── usuario_id
├── rol_id
└── empresa_id

rol_permiso (relacional)
├── rol_id
└── permiso_id

permisos (módulo × acción)
├── id
├── modulo_id
├── accion_id
└── codigo (ej: 'ventas.create')

modulos (17 registros)
├── id
├── nombre
└── nivel ('platform' | 'core' | 'tenant')

acciones (8 registros)
├── id
└── nombre ('view', 'create', 'edit', 'delete', etc.)
```

---

## ✍️ 10. CONCLUSIÓN

### **Situación Actual**
El sistema tiene un módulo de roles básico en `core/roles/` que funciona, pero tiene **limitaciones críticas**:

❌ NO hay gestión de roles globales para Super Admin  
❌ NO hay jerarquías de privilegios  
❌ NO hay restricciones para evitar escalada de privilegios  
❌ Admin Empresa puede ver todos los roles (no filtrados)  

### **Problema Real**
Un admin_empresa podría teóricamente crear un rol con permisos totales y asignárselo, escalando sus privilegios indebidamente. **No hay control de jerarquías**.

### **Solución Propuesta**
Implementar **sistema de jerarquías** mediante:
1. Campo `nivel` en tabla `roles` (10-100)
2. Validación: solo puedes crear roles de nivel inferior al tuyo
3. Dos módulos separados con contextos diferentes:
   - Super Admin → roles globales (80-99)
   - Admin Empresa → roles específicos (10-60)

### **Recomendación**
✅ **SÍ, implementar** - Es una mejora **crítica de seguridad** que además mejora la UX y organización del sistema.

**Tiempo**: 2-3 días de trabajo  
**Prioridad**: Alta (seguridad)  
**Riesgo**: Medio (con mitigaciones claras)  
**ROI**: Muy alto (beneficios duraderos)

### **Pregunta para el Usuario**

¿Deseas que proceda con la **Fase 1 (Migración de Base de Datos)** y creemos el archivo `SQL/migration_roles_jerarquia.sql`?

---

**Autor:** GitHub Copilot  
**Fecha:** 2026-03-12  
**Versión:** 2.0 (Actualizada con jerarquías)  
**Estado:** ✅ Análisis Completado - Pendiente Aprobación

