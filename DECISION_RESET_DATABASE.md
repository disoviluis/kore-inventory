# 🔄 DECISIÓN ARQUITECTÓNICA: Reset Completo de Base de Datos

**Fecha:** 13 de Mayo, 2026  
**Decisión por:** Usuario (Propietario del proyecto)  
**Implementado por:** GitHub Copilot  
**Estado:** Pendiente de ejecución

---

## 📊 Contexto

Durante el desarrollo y testing del sistema Kore Inventory, se han realizado múltiples cambios arquitectónicos y de seguridad, especialmente relacionados con:

- Jerarquía de roles y permisos
- Validaciones de seguridad en backend
- Relaciones usuario-empresa
- Sistema de autenticación JWT
- Estructura multi-tenant

### Problema Identificado

Al implementar las **validaciones de jerarquía de roles**, se descubrió que los datos existentes (especialmente de la empresa de prueba "Everest") tienen inconsistencias:

- `empresa_id_default` en tabla `usuarios` no coincide con `usuario_empresa`
- Roles creados antes de las validaciones de seguridad
- Relaciones usuario-empresa-rol inconsistentes
- Datos de prueba mezclados sin estructura clara

### Errores Observados

```
Error 403 al intentar editar usuario Brayan (ID 7)
Causa: empresa_id del token JWT no está en usuario_empresa
```

Intentar corregir estos datos legacy uno por uno es:
- ⏱️ Consume tiempo
- 🐛 Propenso a errores
- 🔄 No garantiza consistencia futura
- 📉 No es escalable

---

## 💡 Propuesta Aprobada

**"Borrar todos los datos de prueba y empezar desde cero"**

### Razones para el Reset

1. **✅ Sin Pérdida de Datos Reales**
   - TODOS los datos actuales son de prueba
   - La empresa principal de testing es "Everest" (ficticia)
   - No hay operaciones reales en producción

2. **✅ Garantía de Consistencia**
   - Los nuevos cambios de seguridad funcionarán perfectamente con datos creados después
   - No habrá datos legacy con estructura antigua
   - Todas las validaciones se aplicarán desde el inicio

3. **✅ Eficiencia**
   - Más rápido que debuggear y corregir datos inconsistentes
   - Permite validar que todo el flujo funciona end-to-end
   - Ahorra tiempo a largo plazo

4. **✅ Moment Ideal**
   - Sistema en desarrollo, no en producción
   - Ningún cliente real afectado
   - Momento perfecto para hacer breaking changes

### Alcance del Reset

#### 🗑️ Lo que SE ELIMINA:

```sql
❌ Empresas: Everest, ABC Comercial, XYZ Distribuidora, etc.
❌ Usuarios: Todos excepto admin@kore.com (Super Admin)
❌ Productos: Todos
❌ Categorías: Todas
❌ Clientes: Todos
❌ Proveedores: Todos
❌ Ventas: Todas
❌ Compras: Todas
❌ Roles personalizados: Todos
❌ Configuraciones de facturación: Todas
❌ Movimientos de inventario: Todos
❌ Licencias: Todas
❌ Impuestos personalizados: Todos
```

#### ✅ Lo que SE PRESERVA:

```sql
✅ Usuario Super Admin (admin@kore.com)
✅ Roles de sistema (super_admin, admin_empresa)
✅ Módulos del sistema
✅ Permisos del sistema
✅ Planes (catálogo)
✅ Acciones (catálogo)
✅ Estructura de tablas (schema)
✅ Migraciones recientes aplicadas
```

---

## 🛠️ Implementación

### Archivos Creados

1. **`SQL/RESET_DATABASE_CLEAN_START.sql`**
   - Script principal de reset
   - Elimina todos los datos de prueba
   - Preserva super_admin y catálogos
   - Incluye verificaciones de integridad
   - 10 pasos documentados

2. **`SQL/RESET_SEED_INITIAL_DATA.sql`**
   - Script opcional de datos semilla
   - Crea impuestos base de Colombia
   - Verifica roles de sistema
   - Prepara sistema para uso

3. **`SQL/DIAGNOSTICO_DATABASE.sql`**
   - Queries de diagnóstico
   - Para ejecutar antes y después del reset
   - Verificación de integridad
   - Monitoreo del sistema

4. **`GUIA_RESET_DATABASE.md`**
   - Guía completa paso a paso
   - Instrucciones de ejecución
   - Flujo post-reset
   - Troubleshooting

### Pasos de Ejecución

```bash
# 1. Diagnóstico pre-reset
mysql -h kore-db... -u admin -p < SQL/DIAGNOSTICO_DATABASE.sql > pre_reset_diagnostico.txt

# 2. Backup (opcional pero recomendado)
mysqldump -h kore-db... -u admin -p kore_inventory > backup_pre_reset.sql

# 3. Ejecutar reset
mysql -h kore-db... -u admin -p kore_inventory < SQL/RESET_DATABASE_CLEAN_START.sql

# 4. Datos semilla (opcional)
mysql -h kore-db... -u admin -p kore_inventory < SQL/RESET_SEED_INITIAL_DATA.sql

# 5. Verificación post-reset
mysql -h kore-db... -u admin -p < SQL/DIAGNOSTICO_DATABASE.sql > post_reset_diagnostico.txt

# 6. Reiniciar backend
pm2 restart kore-backend
```

---

## 🚀 Flujo Post-Reset

### Fase 1: Super Admin

```
1. Login: admin@kore.com / admin
2. Cambiar contraseña del super admin
3. Crear primera empresa REAL
4. Asignar plan a la empresa
5. Crear usuario Admin Empresa
```

### Fase 2: Admin Empresa

```
1. Login con usuario admin empresa
2. Configurar facturación electrónica
3. Crear roles personalizados (Vendedor, Cajero, etc.)
4. Configurar categorías de productos
5. Crear productos REALES
6. Crear usuarios operativos
```

### Fase 3: Operación

```
1. Capacitar usuarios
2. Comenzar operaciones reales
3. Monitorear sistema
```

---

## ✅ Validaciones Post-Reset

### Base de Datos

- [ ] Solo existe 1 usuario (super_admin)
- [ ] 0 empresas
- [ ] 0 productos
- [ ] 0 ventas
- [ ] Solo roles de sistema (super_admin, admin_empresa)
- [ ] 0 roles personalizados

### Sistema

- [ ] Login como super_admin funciona
- [ ] Módulo Super Admin accesible
- [ ] Crear empresa funciona
- [ ] Crear admin_empresa funciona
- [ ] Login como admin_empresa funciona
- [ ] Crear roles personalizados funciona
- [ ] Admin empresa NO puede asignar rol super_admin ✅
- [ ] Jerarquía de roles se respeta ✅

---

## 🎯 Beneficios Esperados

### Inmediatos

- ✅ Base de datos limpia y consistente
- ✅ Sin errores 403 por datos legacy
- ✅ Validaciones de seguridad funcionan correctamente
- ✅ Relaciones usuario-empresa correctas

### A Mediano Plazo

- ✅ Datos reales desde el inicio
- ✅ Trazabilidad completa de operaciones
- ✅ Auditoría limpia
- ✅ Sin necesidad de migraciones de datos

### A Largo Plazo

- ✅ Sistema escalable con datos consistentes
- ✅ Menos bugs relacionados con datos legacy
- ✅ Mejor performance (sin datos basura)
- ✅ Facilita futuras migraciones/actualizaciones

---

## ⚠️ Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Pérdida de datos importantes | Baja | Alto | Verificar que TODOS los datos son de prueba |
| Script con errores | Media | Medio | Backup antes de ejecutar |
| Downtime del sistema | Alta | Bajo | Ejecutar en horario de bajo uso |
| Usuarios conectados | Media | Bajo | Notificar reset, cerrar sesiones |
| Foreign key errors | Baja | Bajo | Script incluye `SET FOREIGN_KEY_CHECKS=0` |

---

## 📝 Checklist Pre-Ejecución

Antes de ejecutar el reset, confirmar:

- [ ] **TODOS** los datos actuales son de prueba
- [ ] **NO** hay datos reales en producción
- [ ] Todos los stakeholders están notificados
- [ ] Se ha hecho backup de la BD (aunque sean datos de prueba)
- [ ] Se ha revisado el script completo
- [ ] Se entiende que la acción NO se puede deshacer
- [ ] Se tiene acceso a la BD (credenciales correctas)
- [ ] Se tiene tiempo para ejecutar y validar
- [ ] Se puede tolerar downtime temporal

---

## 📊 Métricas de Éxito

El reset será considerado exitoso si:

1. ✅ Script se ejecuta sin errores
2. ✅ Solo existe 1 usuario (super_admin)
3. ✅ 0 empresas, productos, ventas
4. ✅ Roles de sistema preservados
5. ✅ Login como super_admin funciona
6. ✅ Crear nueva empresa funciona
7. ✅ Jerarquía de roles se respeta
8. ✅ No hay errores 403 en operaciones normales

---

## 🔗 Referencias

- [JERARQUIA_ROLES_USUARIOS.md](../JERARQUIA_ROLES_USUARIOS.md) - Documentación de seguridad
- [ARQUITECTURA_MODULOS.md](../ARQUITECTURA_MODULOS.md) - Arquitectura del sistema
- [GUIA_RESET_DATABASE.md](../GUIA_RESET_DATABASE.md) - Guía de ejecución detallada

---

## 📅 Timeline

| Fase | Duración Estimada | Actividades |
|------|-------------------|-------------|
| Preparación | 30 min | Backup, revisión scripts, notificaciones |
| Ejecución | 10 min | Ejecutar scripts de reset |
| Verificación | 20 min | Validar que el reset fue exitoso |
| Inicialización | 1 hora | Crear primera empresa, configurar |
| **Total** | **~2 horas** | |

---

## 👥 Stakeholders

- **Propietario del Proyecto:** Aprueba reset
- **Desarrollador Backend:** Valida scripts SQL
- **Desarrollador Frontend:** Valida flujos post-reset
- **QA/Testing:** Valida funcionalidad completa
- **Usuario Final:** Informado del reset (si aplica)

---

## 📌 Notas Finales

Esta decisión arquitectónica es la forma correcta de proceder cuando:
- ✅ Estás en fase de desarrollo/testing
- ✅ No hay datos reales en riesgo
- ✅ Los cambios estructurales requieren datos limpios
- ✅ Es más eficiente que corregir datos legacy

**No es recomendable** cuando:
- ❌ Hay datos reales de clientes
- ❌ El sistema ya está en producción
- ❌ No se puede tolerar downtime
- ❌ Los problemas son de código, no de datos

En nuestro caso, cumplimos con todos los requisitos para un reset limpio y seguro.

---

**Aprobado para ejecución:** ✅  
**Próximo paso:** Ejecutar según [GUIA_RESET_DATABASE.md](../GUIA_RESET_DATABASE.md)

---

_Documento generado: 2026-05-13_  
_Última actualización: 2026-05-13_
