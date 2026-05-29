# Sistema de Permisos Multi-Empresa - Módulo Finanzas

## ✅ IMPLEMENTACIÓN COMPLETADA

### 🎯 ¿Qué se hizo?

1. **Activación del módulo en el sidebar**: 
   - "Cuentas por Cobrar" ahora es un link activo (no "Próximamente")
   - Se quitó la clase `disabled` del enlace

2. **Asignación de permisos a roles existentes**:
   - Roles ID 2, 9, 11 (Admin Empresa) ahora tienen permiso `FINANZAS.CXC.VIEW`
   - Esto permite que vean el módulo en el sidebar

---

## 🔐 Cómo Funciona el Sistema de Permisos

### Niveles de Privilegio

| Nivel | Rol | Comportamiento |
|-------|-----|----------------|
| **100** | Super Admin | Ve TODOS los módulos automáticamente (no necesita permisos explícitos) |
| **95** | Admin Empresa | Solo ve módulos para los que tenga permisos asignados |
| **< 95** | Usuarios | Solo ve módulos según permisos de su rol |

### Visibilidad en el Sidebar

Un módulo aparece en el sidebar si el usuario cumple **AL MENOS UNO** de estos criterios:
1. Tiene nivel de privilegio = 100 (Super Admin)
2. Tiene al menos 1 permiso del módulo (típicamente VIEW)

---

## 👨‍💼 Para Super Admin: Crear Roles con Acceso a Finanzas

Cuando crees un nuevo rol de "Administrador de Empresa", debes asignarle permisos del módulo Finanzas:

### Opción 1: Desde el Dashboard (Recomendado)

1. Ir a **Administración > Roles y Permisos**
2. Crear nuevo rol (tipo: `admin_empresa`)
3. En la sección de permisos, buscar **"Finanzas"**
4. Seleccionar permisos deseados:
   - ✅ **FINANZAS.CXC.VIEW** - Ver cuentas por cobrar (mínimo necesario)
   - `FINANZAS.CXC.CREATE` - Crear registros
   - `FINANZAS.CXC.EDIT` - Editar registros
   - `FINANZAS.CXC.DELETE` - Eliminar registros
   - `FINANZAS.CXC.EXPORT` - Exportar a Excel
   - ✅ **FINANZAS.RECIBOS.VIEW** - Ver recibos de caja
   - `FINANZAS.RECIBOS.CREATE` - Aplicar pagos
   - `FINANZAS.RECIBOS.DELETE` - Anular recibos
   - `FINANZAS.RECIBOS.PRINT` - Imprimir recibos

### Opción 2: Vía SQL (Para casos especiales)

```sql
-- Asignar permiso VIEW a un rol específico (reemplaza 15 con el ID del rol)
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 15, p.id
FROM permisos p
WHERE p.modulo_id = 21  -- Módulo Finanzas
  AND p.accion_id = 1   -- Acción VIEW
  AND NOT EXISTS (
    SELECT 1 FROM rol_permiso rp 
    WHERE rp.rol_id = 15 AND rp.permiso_id = p.id
  );

-- Para dar TODOS los permisos de Finanzas:
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 15, p.id
FROM permisos p
WHERE p.modulo_id = 21
  AND NOT EXISTS (
    SELECT 1 FROM rol_permiso rp 
    WHERE rp.rol_id = 15 AND rp.permiso_id = p.id
  );
```

---

## 🏢 Multi-Empresa: Cómo Funciona

### Filtrado Automático por Empresa

El módulo de Finanzas **ya está configurado** para filtrar automáticamente por empresa:

1. **Frontend** (`cuentas-por-cobrar.js`):
   ```javascript
   // Detecta automáticamente la empresa activa del selector
   empresaActiva = parseInt(document.getElementById('companySelector').value);
   
   // Todas las peticiones incluyen el empresaId
   fetch(`${API_URL}/finanzas/cuentas-por-cobrar?empresaId=${empresaActiva}`)
   ```

2. **Backend** (todos los controllers):
   ```typescript
   // Todos los endpoints requieren empresaId
   const { empresaId } = req.query;
   
   // Todas las queries filtran por empresa
   WHERE cxc.empresa_id = ?
   ```

### Cambio de Empresa

Cuando un usuario cambia de empresa en el selector:
1. El `empresaId` se actualiza automáticamente
2. Todas las consultas siguientes usan la nueva empresa
3. No se comparten datos entre empresas

---

## 📊 Módulos Actuales en el Sistema

| ID | Nombre | Nivel | Estado |
|----|--------|-------|--------|
| 21 | **finanzas** | core | ✅ **ACTIVO** |
| 7 | pos | tenant | ✅ Activo |
| 8 | ventas | tenant | ✅ Activo |
| 9 | clientes | tenant | ✅ Activo |
| 10 | productos | tenant | ✅ Activo |
| 18 | bodegas | tenant | ✅ Activo |
| 19 | traslados | tenant | ✅ Activo |
| 14 | caja | tenant | 🔒 Próximamente |
| 15 | bancos | tenant | 🔒 Próximamente |

---

## 🧪 Testing - Verificar Funcionamiento

### 1. Como Super Admin:
- ✅ Deberías ver "Finanzas > Cuentas por Cobrar" en el sidebar
- ✅ Al hacer clic, deberías acceder sin problemas

### 2. Como Admin Empresa:
- ✅ Si tienes permiso VIEW, verás el módulo
- ❌ Si NO tienes permisos, el módulo no aparecerá

### 3. Verificar Permisos de un Rol (SQL):

```sql
-- Ver todos los permisos de un rol específico (ejemplo: ID 9)
SELECT 
    m.nombre_mostrar as modulo,
    a.nombre as accion,
    p.codigo as permiso
FROM rol_permiso rp
INNER JOIN permisos p ON rp.permiso_id = p.id
INNER JOIN modulos m ON p.modulo_id = m.id
INNER JOIN acciones a ON p.accion_id = a.id
WHERE rp.rol_id = 9
ORDER BY m.nombre_mostrar, a.id;
```

---

## ⚠️ Problemas Comunes

### "No veo el módulo de Finanzas en el sidebar"

**Causa**: Tu rol no tiene permisos asignados

**Solución**:
1. Si eres Super Admin (nivel 100): Deberías verlo automáticamente
2. Si eres Admin Empresa: Necesitas que el Super Admin te asigne permisos
3. Ejecutar query de verificación (arriba) para confirmar permisos

### "ERROR 403: No tienes permisos"

**Causa**: Intentas acceder a una acción para la que no tienes permiso

**Ejemplo**: Tienes VIEW pero no CREATE

**Solución**: Pedir al Super Admin que asigne más permisos

---

## 📁 Archivos Modificados

1. `frontend/public/dashboard.html` - Link de Cuentas por Cobrar activado
2. `SQL/asignar_permisos_finanzas_roles.sql` - Script de asignación de permisos
3. ✅ Desplegado en producción

---

## 🚀 Próximos Pasos

Para agregar más submódulos de Finanzas (Caja, Bancos, Gastos):
1. Crear tabla de permisos para el nuevo submódulo
2. Asignar permisos a roles según sea necesario
3. Activar link en el sidebar (quitar `disabled`)
4. El sistema multi-empresa ya funciona automáticamente
