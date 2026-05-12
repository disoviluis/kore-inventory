# Deploy Frontend - Roles Globales 🚀

## 📋 Resumen de Cambios

Se ha implementado el frontend completo para la gestión de roles globales en el módulo de **Configuración Global** (Solo Super Admin).

### Archivos Modificados:
- `frontend/public/dashboard.html` - Nuevo módulo y modal de roles globales
- `frontend/public/assets/js/dashboard.js` - 11 nuevas funciones para CRUD completo

### Commit:
```
commit 03f930c
feat: Implementar frontend para gestión de roles globales (Super Admin)
```

---

## 🔧 Instrucciones de Deploy en AWS EC2

### Opción 1: Deploy Automático (Recomendado)

```bash
ssh -i "tu-llave.pem" ubuntu@18.191.181.99

# Una vez conectado, ejecutar:
cd ~/kore-inventory && \
git pull origin main && \
cd backend && \
npm run build && \
pm2 restart kore-backend && \
pm2 logs kore-backend --lines 20
```

### Opción 2: Deploy Paso a Paso

```bash
# 1. Conectar al servidor
ssh -i "tu-llave.pem" ubuntu@18.191.181.99

# 2. Ir al directorio del proyecto
cd ~/kore-inventory

# 3. Verificar estado actual
git status
git log --oneline -3

# 4. Traer cambios desde GitHub
git pull origin main

# 5. Verificar qué cambió
git log --oneline -1
git show --stat

# 6. Compilar backend (por si acaso)
cd backend
npm run build

# 7. Reiniciar PM2
pm2 restart kore-backend

# 8. Ver logs y verificar que todo está OK
pm2 logs kore-backend --lines 30

# 9. Verificar estado de PM2
pm2 status
```

---

## ✅ Verificación Post-Deploy

### 1. Verificar que la aplicación esté corriendo
```bash
pm2 status
# Debería mostrar "kore-backend" en estado "online"

curl http://localhost:3000/api/health
# Debería responder OK
```

### 2. Verificar los archivos del frontend
```bash
cd ~/kore-inventory/frontend/public

# Verificar que dashboard.html tiene el nuevo módulo
grep -n "configuracion-globalModule" dashboard.html

# Verificar que dashboard.js tiene las nuevas funciones
grep -n "function cargarRolesGlobales" assets/js/dashboard.js
```

### 3. Probar en el navegador
1. Abrir: `http://18.191.181.99/` (o tu dominio)
2. Iniciar sesión como **Super Admin**
3. Expandir menú **PLATAFORMA** en el sidebar
4. Click en **"Configuración Global"** (ya no debe estar disabled)
5. Verificar que se carga el módulo con la tabla de roles globales
6. Probar crear un nuevo rol global:
   - Click en "Crear Rol Global"
   - Llenar formulario (Nombre, Nivel 80-99, Permisos)
   - Guardar y verificar que aparece en la tabla
7. Probar editar, ver detalle y eliminar

---

## 🎯 Funcionalidades Implementadas

### ✅ Menú Activado
- Menú "Configuración Global" ahora está activo en PLATAFORMA
- Solo visible para usuarios Super Admin (nivel 100)

### ✅ Módulo de Roles Globales
- **Tabla de roles globales** con:
  - Columnas: Nombre, Descripción, Nivel, Empresas Usando, Estado, Acciones
  - Filtros: Búsqueda por nombre y filtro por nivel
  - Badges de colores según nivel (99=danger, 90+=warning, 80+=info)

### ✅ Modal Crear/Editar
- Formulario completo con validaciones
- Selector de nivel (80-99)
- Matriz de permisos por módulos y acciones
- Botones "Seleccionar Todos" / "Limpiar"
- Alert informativo sobre jerarquía

### ✅ Funciones JS Implementadas
1. `cargarRolesGlobales()` - Carga tabla desde API
2. `abrirModalRolGlobal(id)` - Abre modal crear/editar
3. `cargarModulosAccionesGlobal()` - Carga permisos
4. `renderizarMatrizPermisosGlobales()` - Renderiza matriz
5. `togglePermisoGlobal(id)` - Toggle checkboxes
6. `seleccionarTodosPermisosGlobales(bool)` - Seleccionar/limpiar todos
7. `guardarRolGlobal()` - POST/PUT a API
8. `verDetalleRolGlobal(id)` - Modal con detalle y permisos
9. `editarRolGlobal(id)` - Abre modal en edición
10. `eliminarRolGlobal(id)` - DELETE con confirmación
11. `mostrarAlertaConfigGlobal()` - Alertas al usuario

### ✅ Integración con Backend
- API: `/api/super-admin/roles-globales`
- Endpoints: GET, POST, PUT, DELETE
- Validaciones de jerarquía
- Headers: Authorization Bearer token

---

## 🔍 Troubleshooting

### Si el módulo no se muestra:
```bash
# Verificar que los archivos del frontend se actualizaron
ls -lh ~/kore-inventory/frontend/public/dashboard.html
ls -lh ~/kore-inventory/frontend/public/assets/js/dashboard.js

# Ver fecha de modificación (debe ser reciente)
stat ~/kore-inventory/frontend/public/dashboard.html
```

### Si hay error 403 al cargar roles globales:
- Verificar que estás logueado como Super Admin (tipo_usuario='super_admin')
- Verificar que el backend tiene los endpoints en super-admin.routes.ts
- Ver logs: `pm2 logs kore-backend`

### Si no aparece el menú "Configuración Global":
- Verificar en el navegador que estás logueado como Super Admin
- Inspeccionar elemento en navegador: buscar `id="plataformaSection"`
- Debe tener `style="display: block;"` cuando eres super admin

### Si la compilación del backend falla:
```bash
cd ~/kore-inventory/backend
npm install
npm run build

# Ver errores
cat /var/log/pm2/kore-backend-error.log
```

---

## 📊 Estado del Proyecto

### Backend ✅ COMPLETO (ya deployado)
- ✅ Migración BD: campos `nivel` y `nivel_privilegio`
- ✅ Controlador: `roles-globales.controller.ts`
- ✅ Rutas: `/api/super-admin/roles-globales`
- ✅ Validaciones: jerarquía y permisos

### Frontend ✅ COMPLETO (pendiente de deploy)
- ✅ HTML: Módulo y modal
- ✅ JS: 11 funciones CRUD
- ✅ UI: Tabla, filtros, alertas
- ✅ Integración: API calls

### Database ✅ COMPLETO
- ✅ Tabla `roles` con campo `nivel`
- ✅ Tabla `usuarios` con campo `nivel_privilegio`
- ✅ Datos sincronizados (usuarios tienen niveles correctos)

---

## 🎉 Próximos Pasos

Después del deploy, el sistema estará completamente funcional para:

1. **Super Admin puede:**
   - Crear roles globales (nivel 80-99)
   - Asignar permisos granulares
   - Editar y eliminar roles globales
   - Ver qué empresas usan cada rol

2. **Admin Empresa puede:**
   - Ver roles globales disponibles (solo lectura)
   - Crear roles de empresa basados en globales (nivel 10-79)
   - Asignar roles a usuarios de su empresa

3. **Sistema valida:**
   - Jerarquía de niveles en toda operación
   - Permisos según role_id del usuario
   - Solo super admin gestiona roles globales

---

## 📞 Contacto

Si hay problemas durante el deploy, revisar:
- Logs de PM2: `pm2 logs kore-backend --lines 50`
- Logs del navegador: Consola de DevTools (F12)
- Base de datos: Verificar que campos `nivel` existen

**¡Deploy listo para ejecutar! 🚀**
