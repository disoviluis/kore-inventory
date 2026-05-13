# 🔐 JERARQUÍA DE ROLES Y USUARIOS - KORE INVENTORY

## 📐 Principio Fundamental

**LA JERARQUÍA SE RESPETA SIEMPRE:**
```
Super Admin (nivel 100)
    ↓ puede crear/modificar
Admin Empresa (nivel 80)
    ↓ puede crear/modificar  
Gerente (nivel 60)
    ↓ puede crear/modificar
Usuario Regular (nivel 20-50)
```

**Regla de Oro:** Un usuario **NUNCA** puede crear o modificar otro usuario con nivel igual o superior al suyo.

---

## 🏗️ FLUJO DE CREACIÓN CORRECTO

### 1️⃣ **Super Admin crea la Empresa**
```
Super Admin → Módulo: Empresas → Crear Nueva Empresa
```

**Datos requeridos:**
- Nombre de la empresa
- NIT
- Email
- Dirección
- Plan asignado

**Resultado:**
- ✅ Empresa creada en BD
- ✅ `empresa_id` generado
- ✅ Configuraciones iniciales creadas

---

### 2️⃣ **Super Admin crea el Administrador de la Empresa**

```
Super Admin → Módulo: Usuarios → Crear Usuario
```

**Proceso:**
1. Seleccionar la empresa en el dropdown
2. Crear usuario con datos:
   - Nombre, email, contraseña
   - `tipo_usuario = 'admin_empresa'`
   - Asignar rol: "Administrador de Empresa" (nivel 80, sistema)
3. **Importante:** Este usuario queda asociado a `usuario_empresa` con esa empresa

**Resultado:**
- ✅ Usuario creado con tipo `admin_empresa`
- ✅ Asociado a la empresa en tabla `usuario_empresa`
- ✅ Rol de sistema "Administrador de Empresa" asignado
- ✅ **NO puede ser modificado por admin_empresa**

---

### 3️⃣ **Admin Empresa crea Roles Personalizados (Opcional)**

```
Admin Empresa → Módulo: Roles y Permisos → Crear Rol
```

**Restricciones:**
- ❌ **NO puede crear roles de sistema**
- ❌ **NO puede crear roles con nivel >= 80**
- ✅ **SÍ puede crear roles personalizados** (nivel 10-79)

**Ejemplos de roles permitidos:**
- Gerente de Ventas (nivel 60)
- Cajero (nivel 30)
- Bodeguero (nivel 25)
- Vendedor (nivel 20)

**Resultado:**
- ✅ Roles personalizados en tabla `roles`
- ✅ `empresa_id` = empresa del admin
- ✅ `tipo = 'personalizado'`
- ✅ `nivel` < 80

---

### 4️⃣ **Admin Empresa crea Usuarios de la Empresa**

```
Admin Empresa → Módulo: Usuarios → Crear Usuario
```

**Restricciones:**
- ❌ **NO puede asignar roles de sistema** (Super Admin, Admin Empresa)
- ❌ **NO puede asignar roles con nivel >= 80**
- ✅ **SÍ puede asignar roles personalizados creados** por él
- ✅ **SÍ puede crear usuarios regulares** (`tipo_usuario = 'usuario'`)

**Proceso:**
1. Ingresar datos del usuario
2. Seleccionar roles **personalizados** disponibles
3. Guardar

**Resultado:**
- ✅ Usuario creado con `tipo_usuario = 'usuario'`
- ✅ Asociado a la empresa
- ✅ Roles personalizados asignados
- ✅ Permisos heredados de los roles

---

## 🔒 RESTRICCIONES DE SEGURIDAD

### ❌ **Acciones PROHIBIDAS para Admin Empresa**

| Acción | Razón |
|--------|-------|
| Asignar rol "Super Administrator" | Es un rol de sistema (nivel 100) |
| Asignar rol "Administrador de Empresa" | Es un rol de sistema (nivel 80) |
| Modificar su propio rol | Fue asignado por Super Admin |
| Crear roles de sistema | Solo Super Admin puede hacerlo |
| Editar usuarios de otras empresas | Solo ve usuarios de su empresa |
| Ver roles globales/sistema | Solo ve roles personalizados |

### ✅ **Acciones PERMITIDAS para Admin Empresa**

| Acción | Descripción |
|--------|-------------|
| Crear usuarios regulares | Con `tipo_usuario = 'usuario'` |
| Asignar roles personalizados | Roles creados por él (nivel < 80) |
| Editar usuarios de su empresa | Excepto su propio rol |
| Crear roles personalizados | Con nivel 10-79 |
| Gestionar permisos de roles personalizados | De su empresa |

---

## 🛡️ VALIDACIONES IMPLEMENTADAS

### **Frontend (dashboard.js)**

```javascript
// Filtrar roles según tipo de usuario
const rolesFiltrados = rolesDisponiblesEmpresa.filter(rol => {
  // Super admin puede asignar cualquier rol
  if (usuarioActual.tipo_usuario === 'super_admin') {
    return true;
  }
  
  // Admin empresa NO puede asignar roles de sistema (nivel >= 80)
  if (rol.tipo === 'sistema' || rol.nivel >= 80) {
    console.warn(`⚠️ Rol "${rol.nombre}" filtrado`);
    return false;
  }
  
  return true;
});
```

### **Backend (roles.controller.ts)**

```typescript
// admin_empresa NO puede ver ni asignar roles de sistema
if (usuario.tipo_usuario !== 'super_admin') {
  query += ` AND r.empresa_id = ? 
             AND r.tipo = 'personalizado' 
             AND r.nivel < 80`;
  params.push(empresa_id || usuario.empresa_id);
}
```

### **Backend (usuarios.controller.ts - CREATE)**

```typescript
// Validar que admin_empresa NO pueda asignar roles de sistema
if (usuario.tipo_usuario !== 'super_admin') {
  const [rolesAValidar] = await connection.execute(
    `SELECT id, nombre, tipo, nivel FROM roles WHERE id IN (?)`,
    [roles_ids]
  );

  for (const rol of rolesAValidar) {
    if (rol.tipo === 'sistema' || rol.nivel >= 80) {
      throw new Error(`No puedes asignar el rol "${rol.nombre}"`);
    }
  }
}
```

### **Backend (usuarios.controller.ts - UPDATE)**

```typescript
// Misma validación al actualizar roles
// Previene manipulación vía API directa
```

---

## 📊 TABLA DE NIVELES DE PRIVILEGIO

| Nivel | Tipo | Nombre | Puede crear/modificar |
|-------|------|--------|-----------------------|
| **100** | Sistema | Super Administrator | Todos los usuarios y roles |
| **80** | Sistema | Administrador de Empresa | Usuarios regulares (nivel < 80) |
| **60** | Personalizado | Gerente | Usuarios de menor nivel (según permisos) |
| **40** | Personalizado | Supervisor | Usuarios operativos |
| **30** | Personalizado | Cajero | - |
| **25** | Personalizado | Bodeguero | - |
| **20** | Personalizado | Vendedor | - |

---

## 🔐 TIPOS DE ROLES

### **Roles de Sistema** (`tipo = 'sistema'`)

| ID | Nombre | Nivel | empresa_id | Asignable por |
|----|--------|-------|------------|---------------|
| 1 | Super Administrador | 100 | NULL | Solo sistema |
| 9 | Administrador de Empresa | 80 | NULL | Solo Super Admin |

**Características:**
- ✅ Creados por el sistema
- ✅ `empresa_id = NULL` (globales)
- ✅ `tipo = 'sistema'`
- ❌ **NO modificables** por nadie
- ❌ **NO asignables** por admin_empresa

### **Roles Personalizados** (`tipo = 'personalizado'`)

| ID | Nombre | Nivel | empresa_id | Asignable por |
|----|--------|-------|------------|---------------|
| 3 | Gerente | 60 | 1 | Admin Empresa 1 |
| 4 | Cajero | 30 | 1 | Admin Empresa 1 |
| 5 | Bodeguero | 25 | 1 | Admin Empresa 1 |

**Características:**
- ✅ Creados por admin_empresa
- ✅ `empresa_id` = empresa específica
- ✅ `tipo = 'personalizado'`
- ✅ `nivel` entre 10-79
- ✅ Modificables por quien los creó
- ✅ Asignables a usuarios de esa empresa

---

## 🚨 CASOS DE USO Y ERRORES COMUNES

### ❌ **Error: Admin intenta asignarse Super Admin**

**Escenario:**
```
Admin Empresa edita su propio usuario
Selecciona rol "Super Administrator"
Intenta guardar
```

**Validación Frontend:**
```javascript
// Rol filtrado - no aparece en lista
console.warn('⚠️ Rol "Super Administrator" filtrado (nivel: 100)');
```

**Validación Backend:**
```typescript
res.status(403).json({
  message: 'No tienes permiso para asignar el rol "Super Administrator"'
});
```

---

### ❌ **Error: Admin intenta crear rol de sistema**

**Escenario:**
```
Admin Empresa → Crear Rol
Nombre: "Administrador General"
Nivel: 85
```

**Validación Backend:**
```typescript
if (nivel >= 80 && usuario.tipo_usuario !== 'super_admin') {
  return res.status(403).json({
    message: 'Solo Super Admin puede crear roles con nivel >= 80'
  });
}
```

---

### ✅ **Correcto: Admin crea usuario regular**

**Escenario:**
```
Admin Empresa → Crear Usuario
Tipo: Usuario Regular
Roles: Cajero (nivel 30) ✅
```

**Flujo:**
1. ✅ Validación frontend: Rol aparece en lista
2. ✅ Validación backend: Rol válido (nivel < 80, tipo = 'personalizado')
3. ✅ Usuario creado correctamente
4. ✅ Rol asignado en `usuario_rol`

---

## 📋 CHECKLIST DE SEGURIDAD

### **Al crear un nuevo usuario:**
- [ ] Verifico tipo de usuario actual (super_admin vs admin_empresa)
- [ ] Si soy admin_empresa:
  - [ ] ¿El rol a asignar es personalizado? ✅
  - [ ] ¿El nivel del rol es < 80? ✅
  - [ ] ¿El rol pertenece a mi empresa? ✅
- [ ] Si soy super_admin:
  - [ ] Puedo asignar cualquier rol ✅

### **Al modificar un usuario:**
- [ ] ¿El usuario fue creado por super_admin?
  - [ ] Si sí, solo super_admin puede modificar roles de sistema
- [ ] ¿Estoy intentando cambiar mi propio rol?
  - [ ] Si sí, validar que no sea downgrade no autorizado

### **Al crear un rol:**
- [ ] Si soy admin_empresa:
  - [ ] `tipo` = 'personalizado' ✅
  - [ ] `nivel` < 80 ✅
  - [ ] `empresa_id` = mi empresa ✅

---

## 🔄 FLUJO COMPLETO - DIAGRAMA

```
┌─────────────────────────────────────────────────────────────┐
│                     SUPER ADMIN                             │
│                     (nivel 100)                             │
└──────────────┬──────────────────────────────────────────────┘
               │ 1. Crear Empresa
               │ 2. Crear Admin Empresa (nivel 80, sistema)
               │ 3. Puede ver/modificar TODO
               ▼
┌─────────────────────────────────────────────────────────────┐
│               ADMIN EMPRESA (nivel 80)                      │
│               Empresa: ABC Comercial                        │
└──────────────┬──────────────────────────────────────────────┘
               │ 1. Crear roles personalizados (nivel < 80)
               │ 2. Crear usuarios regulares
               │ 3. Asignar SOLO roles personalizados
               │ 4. NO puede asignar roles de sistema
               ▼
┌─────────────────────────────────────────────────────────────┐
│              USUARIO REGULAR (nivel 20-60)                  │
│              Empresa: ABC Comercial                         │
│              Roles: Cajero, Vendedor                        │
└─────────────────────────────────────────────────────────────┘
               │ 1. Opera según permisos
               │ 2. NO puede gestionar usuarios
               │ 3. NO puede gestionar roles
```

---

## 📚 REFERENCIAS

- **Backend:** `backend/src/core/roles/roles.controller.ts`
- **Backend:** `backend/src/core/usuarios/usuarios.controller.ts`
- **Frontend:** `frontend/public/assets/js/dashboard.js`
- **Arquitectura:** [ARQUITECTURA_MODULOS.md](ARQUITECTURA_MODULOS.md)
- **Deploy:** [ESTRUCTURA_SERVIDOR.md](ESTRUCTURA_SERVIDOR.md)

---

**Última actualización:** 13 de Mayo, 2026  
**Versión:** 1.0  
**Autor:** Equipo Kore Inventory
