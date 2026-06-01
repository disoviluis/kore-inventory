# Instrucciones de Deploy - Sistema de Roles Globales Dinámicos

## Fecha: 2025-01-XX
## Commit: 80d9dc7

---

## ✅ COMPLETADO LOCALMENTE

### Base de Datos Local
- [x] Columna `rol_id` agregada a tabla `usuarios`
- [x] Clave foránea configurada: `usuarios.rol_id` → `roles.id`
- [x] Rol global "Administrador de Empresa" creado (id=7, nivel=80)
- [x] Usuarios migrados:
  - super_admin → rol_id = 1
  - admin_empresa → rol_id = 7
  - usuarios regulares → rol_id = NULL (correcto)

### Código
- [x] Backend modificado: `createUsuario()` acepta `rol_id`
- [x] Backend modificado: `updateUsuario()` acepta `rol_id`
- [x] Frontend modificado: Select dinámico de roles globales
- [x] Frontend modificado: `cargarRolesGlobalesEnSelect()` creada
- [x] Frontend modificado: `guardarUsuario()` envía `rol_id`
- [x] Código compilado: `npm run build` exitoso
- [x] Commit creado: 80d9dc7
- [x] Push a GitHub: exitoso

---

## ✅ DEPLOY COMPLETADO EN SERVIDOR

**Servidor:** 18.191.181.99  
**Fecha Deploy:** 30 Mayo 2026, 12:01  
**Usuario:** ubuntu  
**Base de Datos:** RDS kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com

### 1. Conectar al servidor ✅
```bash
ssh -i "C:\Users\luis.rodriguez\Downloads\korekey.pem" ubuntu@18.191.181.99
```

### 2. Actualizar código ✅
```bash
cd /home/ubuntu/kore-inventory
git pull origin main
```

### 3. Ejecutar migraciones de base de datos ✅
```bash
# Migración ejecutada con éxito
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com -u admin -p'Kore2026!' kore_inventory < /home/ubuntu/kore-inventory/SQL/agregar_rol_id_usuarios.sql
```

**Resultado:**
- ✅ Columna `rol_id` agregada a tabla `usuarios`
- ✅ Clave foránea configurada correctamente
- ✅ Rol global "Administrador de Empresa" creado (id=9, nivel=95)
- ✅ Usuarios migrados:
  - Usuario 1 (Super Admin) → rol_id = 1
  - Usuario 7 (Brayan - admin_empresa) → rol_id = 9

### 4. Rebuild y restart backend ✅
```bash
cd /home/ubuntu/kore-inventory/backend
npm run build
pm2 restart kore-backend
```

**Resultado:**
- ✅ Compilación TypeScript exitosa
- ✅ PM2 reiniciado (proceso online, uptime 32s)
- ✅ Memoria: 53.3mb
- ✅ CPU: 0%

### 5. Deploy frontend ✅
```bash
sudo cp /home/ubuntu/kore-inventory/frontend/public/dashboard.html /var/www/html/
sudo cp /home/ubuntu/kore-inventory/frontend/public/assets/js/dashboard.js /var/www/html/assets/js/
```

**Archivos actualizados:**
- ✅ `/var/www/html/dashboard.html` (138K, actualizado 30 May 12:01)
- ✅ `/var/www/html/assets/js/dashboard.js` (163K, actualizado 30 May 12:01)

### 6. Verificar deployment ✅
```bash
# Ver logs del backend
pm2 logs kore-backend --lines 50

# Verificar que el proceso está corriendo
pm2 status
```

**Estado:** ✅ Backend online y funcionando correctamente

---

## 🧪 TESTING - LISTO PARA PROBAR

### Test 1: Verificar Rol de Usuario Existente (Brayan)
1. Ir a: https://kore.com/dashboard.html (o la URL de producción)
2. Login como Super Admin
3. Ir a **Configuración Global** → **Usuarios**
4. Click en **Editar** para usuario Brayan
5. **VERIFICAR:**
   - ✅ El dropdown ahora se llama "Rol Global" (no "Tipo de Usuario")
   - ✅ Muestra opciones dinámicas de la base de datos
   - ✅ Brayan debe tener seleccionado "Administrador de Empresa (Nivel 95)"
   - ✅ El select muestra todos los roles globales activos

### Test 2: Cambiar Rol de Usuario
1. En el modal de editar Brayan
2. Cambiar rol a "Super Administrador (Nivel 100)"
3. Click **Guardar**
4. **VERIFICAR:**
   - ✅ Mensaje de éxito
   - ✅ Modal se cierra
   - ✅ Reabrir modal y verificar que el rol se guardó
   - ✅ Verificar en base de datos:
     ```sql
     SELECT id, nombre, email, rol_id FROM usuarios WHERE id = 7;
     ```

### Test 3: Crear Nuevo Usuario con Rol
1. Click en **"Nuevo Usuario"**
2. **VERIFICAR:**
   - ✅ Dropdown "Rol Global" muestra opciones dinámicas
   - ✅ Opciones muestran formato: "Nombre del Rol (Nivel XX)"
3. Llenar campos:
   - Nombre: Test Usuario
   - Email: test@nueva.com
   - Password: test123
   - Rol Global: Seleccionar "Administrador de Empresa"
4. Click **Guardar**
5. **VERIFICAR:**
   - ✅ Usuario creado exitosamente
   - ✅ En base de datos tiene `rol_id` correcto
   - ✅ `tipo_usuario` se asignó automáticamente según nivel del rol
   - ✅ `nivel_privilegio` coincide con nivel del rol

### Test 4: Verificar Base de Datos
Conectar a RDS y ejecutar:
```bash
ssh -i korekey.pem ubuntu@18.191.181.99
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com -u admin -pKore2026! kore_inventory
```

Verificar usuarios con roles:
```sql
SELECT 
    u.id,
    u.nombre,
    u.email,
    u.tipo_usuario,
    u.rol_id,
    r.nombre as rol_nombre,
    r.nivel as rol_nivel,
    u.nivel_privilegio
FROM usuarios u
LEFT JOIN roles r ON u.rol_id = r.id
WHERE u.activo = 1
ORDER BY u.id;
```

**Resultado esperado:**
- ✅ Columna `rol_id` existe
- ✅ Usuarios admin tienen `rol_id` asignado
- ✅ `nivel_privilegio` coincide con `r.nivel`

---

## 📁 ARCHIVOS MODIFICADOS

### Backend
- `backend/src/platform/super-admin/usuarios-admin.controller.ts`
  - `createUsuario()`: Acepta y valida `rol_id`
  - `updateUsuario()`: Acepta y valida `rol_id`

### Frontend
- `frontend/public/dashboard.html`
  - Select `usuarioTipo` → `usuarioRolGlobal` (dinámico)

- `frontend/public/assets/js/dashboard.js`
  - `cargarRolesGlobalesEnSelect()`: Nueva función
  - `abrirModalUsuario()`: Llama a cargar roles
  - `guardarUsuario()`: Envía `rol_id`
  - `cargarDatosUsuarioAdmin()`: Carga `rol_id`

### SQL
- `SQL/agregar_rol_id_usuarios.sql`: Script completo de migración
- `SQL/migrar_tipo_usuario_a_rol_id.sql`: Script solo migración de datos

---

## 🔍 TROUBLESHOOTING

### Error: "El rol especificado no existe"
**Causa:** Rol no existe o no es global
**Solución:**
```sql
-- Verificar roles globales activos
SELECT * FROM roles WHERE empresa_id IS NULL AND activo = 1;

-- Crear rol si no existe
INSERT INTO roles (nombre, descripcion, nivel, empresa_id, activo)
VALUES ('Nombre del Rol', 'Descripción', 80, NULL, 1);
```

### Dropdown Vacío en Frontend
**Causa:** Error en llamada al API o permisos
**Debug:**
1. Abrir consola del navegador (F12)
2. Verificar que no hay errores en Network tab
3. Verificar endpoint: `GET https://api.kore.com/api/super-admin/roles-globales`
4. Verificar respuesta incluye roles con `empresa_id: null`

**Logs backend:**
```bash
ssh -i korekey.pem ubuntu@18.191.181.99
pm2 logs kore-backend --lines 100
```

### Permisos No Se Guardan (Issue Separado)
**Estado:** ⚠️ Bug conocido, no relacionado con esta migración
**Síntoma:** Solo 1 permiso se guarda en `rol_permiso` table
**Debugging activo:** Backend tiene console.log en `updateRolGlobal()`
**Requiere:** Investigación separada de por qué `permisos_ids` array no persiste

### Usuario No Puede Ver Módulos Después de Cambiar Rol
**Causa:** Posible caché del navegador o sesión antigua
**Solución:**
1. Cerrar sesión completamente
2. Limpiar caché del navegador (Ctrl+Shift+Del)
3. Login nuevamente
4. Verificar que `nivel_privilegio` se actualizó en base de datos

### Error al Conectar a Base de Datos en Servidor
**Solución:** La BD está en RDS, no en localhost
```bash
# Correcto
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com -u admin -pKore2026! kore_inventory

# Incorrecto (error: can't connect to socket)
mysql -u admin -p kore_inventory
```

---

## ✨ MEJORAS IMPLEMENTADAS

1. **Sistema unificado**: Rol global dinámico reemplaza enum hardcodeado
2. **Escalabilidad**: Nuevos roles se crean en BD sin modificar código
3. **Validación**: Backend valida que rol sea global (empresa_id IS NULL)
4. **Compatibilidad**: Mantiene `tipo_usuario` para código legacy
5. **Nivel automático**: `nivel_privilegio` se determina por nivel del rol
6. **UX mejorada**: Dropdown muestra nombre y nivel del rol
