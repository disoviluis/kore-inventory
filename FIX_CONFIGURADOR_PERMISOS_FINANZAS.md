# Fix: Configurador de Permisos - Módulo Finanzas

## 🔍 Problema Identificado

El módulo **Finanzas** (ID 21) con sus permisos de Cuentas por Cobrar no aparecía correctamente en el configurador de roles y permisos porque:

1. **Categoría incorrecta**: Estaba en categoría `operaciones` en lugar de `finanzas`
2. **Orden incorrecto**: Tenía orden 50, apareciendo al final de la lista

## ✅ Solución Aplicada

### Cambios en Base de Datos:

```sql
UPDATE modulos 
SET categoria = 'finanzas',
    orden = 16
WHERE id = 21 AND nombre = 'finanzas';
```

### Resultado:

Ahora el módulo **Finanzas** aparece correctamente en la categoría **FINANZAS** del configurador de permisos con el siguiente orden:

| Orden | Módulo | Submódulo | Permisos Disponibles |
|-------|--------|-----------|---------------------|
| 16 | **Finanzas** | Cuentas por Cobrar | VER, CREAR, EDITAR, ELIMINAR, EXPORTAR |
| 16 | **Finanzas** | Recibos de Caja | VER, CREAR, ELIMINAR, IMPRIMIR |
| 17 | Caja | - | (Pendiente) |
| 18 | Bancos | - | (Pendiente) |
| 19 | Contabilidad | - | (Pendiente) |
| 22 | Reportes | - | (Pendiente) |

### Permisos Específicos Creados:

1. **FINANZAS.CXC.VIEW** (ID: 135) - Ver cuentas por cobrar
2. **FINANZAS.CXC.CREATE** (ID: 131) - Crear cuentas por cobrar
3. **FINANZAS.CXC.EDIT** (ID: 133) - Editar cuentas por cobrar
4. **FINANZAS.CXC.DELETE** (ID: 132) - Eliminar cuentas por cobrar
5. **FINANZAS.CXC.EXPORT** (ID: 134) - Exportar cuentas por cobrar
6. **FINANZAS.RECIBOS.PRINT** (ID: 139) - Imprimir recibos de caja

## 🧪 Cómo Probar

1. **Acceder al Dashboard** como Super Admin
2. Ir a **Administración > Roles y Permisos**
3. Click en **"Nuevo Rol"** o editar un rol existente
4. En la matriz de permisos, buscar la sección **"FINANZAS"**
5. Verificar que aparece el módulo **"Finanzas"** con los checkboxes de permisos:
   - ✅ VER
   - ✅ CREAR
   - ✅ EDITAR
   - ✅ ELIMINAR
   - ✅ EXPORTAR
   - ✅ IMPRIMIR

## 📋 Pasos para Asignar Permisos a un Rol

### Opción 1: Desde la Interfaz (Recomendado)

1. Dashboard > **Administración > Roles y Permisos**
2. Click en **"Nuevo Rol"** o editar rol existente
3. En la sección **FINANZAS**, marcar los checkboxes deseados:
   - **Finanzas - VER**: Mínimo necesario para ver el módulo en el sidebar
   - **Finanzas - CREAR**: Para aplicar pagos y crear recibos
   - **Finanzas - EDITAR**: Para modificar registros
   - **Finanzas - ELIMINAR**: Para anular recibos
   - **Finanzas - EXPORTAR**: Para exportar reportes a Excel
   - **Finanzas - IMPRIMIR**: Para imprimir recibos de caja
4. Click en **"Guardar Rol"**

### Opción 2: SQL Directo (Solo casos especiales)

```sql
-- Asignar permiso VER a un rol específico (mínimo necesario)
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 9, 135  -- rol_id = 9, permiso_id = 135 (FINANZAS.CXC.VIEW)
WHERE NOT EXISTS (
    SELECT 1 FROM rol_permiso 
    WHERE rol_id = 9 AND permiso_id = 135
);

-- Asignar TODOS los permisos de Finanzas a un rol
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT 9, p.id
FROM permisos p
WHERE p.modulo_id = 21
  AND NOT EXISTS (
    SELECT 1 FROM rol_permiso rp 
    WHERE rp.rol_id = 9 AND rp.permiso_id = p.id
  );
```

## 🔄 Verificación Post-Asignación

Después de asignar permisos a un rol, el usuario con ese rol debería:

1. ✅ Ver "Finanzas > Cuentas por Cobrar" en el sidebar
2. ✅ Poder acceder a la página de Cuentas por Cobrar
3. ✅ Ver el dashboard con métricas de cartera
4. ✅ Ver la tabla de facturas pendientes
5. ✅ (Si tiene permiso CREATE) Aplicar pagos
6. ✅ (Si tiene permiso EXPORT) Exportar a Excel

## 📁 Archivos Modificados

- `SQL/fix_categoria_modulo_finanzas.sql` - Script de fix aplicado en producción

## 🔗 Referencias

- [GUIA_PERMISOS_FINANZAS_MULTIEMPRESA.md](GUIA_PERMISOS_FINANZAS_MULTIEMPRESA.md) - Guía completa del sistema de permisos
- [SQL/asignar_permisos_finanzas_roles.sql](SQL/asignar_permisos_finanzas_roles.sql) - Script inicial de asignación de permisos

---

**Fecha:** 2026-05-29  
**Responsable:** Automatización AI  
**Estado:** ✅ Aplicado en Producción
