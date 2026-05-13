# Deploy: Migración Campos RUES Empresas

## 📋 Resumen

**Objetivo**: Agregar campos de Registro Único Empresarial (RUES) a la tabla `empresas` para mejorar el módulo de creación de empresas del super admin.

**Fecha**: 2026-05-13  
**Base de datos**: AWS RDS MySQL - kore_inventory  
**Impacto**: Bajo riesgo - Solo agrega campos, no modifica lógica existente  
**Downtime**: No requiere - Migración en caliente

---

## ✅ Pre-requisitos

- [x] Frontend ya implementado (dashboard.html + dashboard.js)
- [x] Script SQL creado: `SQL/migration_add_campos_rues_empresas.sql`
- [x] Backup de tabla empresas (automático en RDS)
- [x] Acceso SSH al servidor EC2
- [x] Credenciales MySQL RDS

---

## 🚀 Paso a Paso - Ejecución

### 1️⃣ Conectarse al Servidor EC2

Desde tu máquina local (Windows):

```powershell
# Ir a la carpeta de la llave
cd C:\Users\luis.rodriguez\Downloads

# Conectar por SSH
ssh -i korekey.pem ubuntu@18.191.181.99
```

### 2️⃣ Subir Script SQL al Servidor

**Opción A: Crear el archivo directamente en el servidor**

```bash
# En el servidor EC2
cd /home/ubuntu/kore-inventory

# Crear el archivo SQL
nano SQL/migration_add_campos_rues_empresas.sql
```

Luego copia y pega el contenido del archivo `migration_add_campos_rues_empresas.sql` y guarda con `Ctrl+X`, `Y`, `Enter`.

**Opción B: Subir desde local (si tienes Git configurado)**

```bash
# En el servidor EC2
cd /home/ubuntu/kore-inventory

# Hacer pull del repositorio
git pull origin main

# Verificar que el archivo existe
ls -la SQL/migration_add_campos_rues_empresas.sql
```

### 3️⃣ Backup Preventivo (Opcional pero Recomendado)

```bash
# Conectarse a MySQL y hacer backup de la tabla empresas
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com -u admin -p kore_inventory <<EOF
-- Crear tabla de respaldo
CREATE TABLE empresas_backup_20260513 LIKE empresas;
INSERT INTO empresas_backup_20260513 SELECT * FROM empresas;
EOF
```

Contraseña: `Kore2026!`

### 4️⃣ Verificar Estado Actual

```bash
# Conectarse a MySQL
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com -u admin -p kore_inventory
```

Contraseña: `Kore2026!`

```sql
-- Ver estructura actual de empresas
DESCRIBE empresas;

-- Ver empresas existentes y sus NITs
SELECT id, nombre, nit FROM empresas;

-- Salir
EXIT;
```

### 5️⃣ Ejecutar Migración

```bash
# Ejecutar el script SQL
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com \
      -u admin \
      -p kore_inventory < SQL/migration_add_campos_rues_empresas.sql
```

Contraseña: `Kore2026!`

**Tiempo estimado**: 2-5 segundos (la tabla empresas tiene pocos registros)

### 6️⃣ Verificación Post-Migración

```bash
# Conectarse nuevamente a MySQL
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com -u admin -p kore_inventory
```

```sql
-- 1. Verificar que los campos se agregaron
DESCRIBE empresas;

-- Deberías ver:
-- - tipo_documento (después de razon_social)
-- - digito_verificacion (después de nit)
-- - representante_legal (después de telefono)
-- - tipo_sociedad
-- - matricula_mercantil
-- - camara_comercio
-- - fecha_matricula
-- - actividad_economica

-- 2. Verificar que los NITs se separaron correctamente
SELECT 
    id,
    nombre,
    tipo_documento,
    nit,
    digito_verificacion,
    CONCAT(nit, '-', digito_verificacion) AS nit_completo
FROM empresas;

-- 3. Verificar índices creados
SHOW INDEX FROM empresas WHERE Key_name IN ('idx_nit_dv', 'idx_tipo_sociedad');

-- 4. Contar registros (debe ser el mismo número de antes)
SELECT COUNT(*) AS total_empresas FROM empresas;

-- Salir
EXIT;
```

**Resultados Esperados**:
- ✅ 8 campos nuevos agregados
- ✅ NITs separados: `nit` = número, `digito_verificacion` = DV
- ✅ `tipo_documento` = 'NIT' en registros existentes
- ✅ 2 índices nuevos creados
- ✅ Mismo número de empresas que antes

---

## 🔄 Actualización Backend (TypeScript)

### 7️⃣ Actualizar DTO de Empresas

Editar: `backend/src/routes/super-admin/empresas.ts`

```typescript
interface EmpresaCreateDTO {
  nombre: string;
  razon_social?: string;
  
  // NUEVOS CAMPOS
  tipo_documento: 'NIT' | 'CC' | 'CE' | 'PASAPORTE';
  nit: string;
  digito_verificacion?: string;
  
  email: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  pais: string;
  plan_id: number;
  estado: 'activa' | 'suspendida' | 'cancelada' | 'trial';
  regimen_tributario: 'simplificado' | 'común' | 'especial';
  tipo_contribuyente: 'persona_natural' | 'persona_juridica';
  
  // NUEVOS CAMPOS RUES
  representante_legal?: string;
  tipo_sociedad?: string;
  matricula_mercantil?: string;
  camara_comercio?: string;
  fecha_matricula?: Date;
  actividad_economica?: string;
}
```

### 8️⃣ Recompilar y Desplegar Backend

```bash
# En el servidor EC2, en la carpeta del backend
cd /home/ubuntu/kore-inventory/backend

# Recompilar TypeScript
npm run build

# Reiniciar aplicación con PM2
pm2 restart kore-backend

# Verificar que inició correctamente
pm2 logs kore-backend --lines 50
```

---

## 🧪 Testing Completo

### 9️⃣ Probar Crear Empresa con Nuevos Campos

1. **Abrir dashboard como super_admin**:
   - URL: http://18.191.181.99/dashboard.html
   - Login: `admin@kore.com`

2. **Ir a módulo Empresas**:
   - Click en sidebar: PLATAFORMA → Empresas

3. **Crear Nueva Empresa**:
   - Click "Nueva Empresa"
   - Llenar campos:
     ```
     Tipo Documento: NIT
     Número: 900999888
     DV: (se calcula auto) → 6
     Razón Social: Empresa Test RUES SAS
     Email: test.rues@example.com
     Clic en "Consultar RUES" (simulado)
     ```
   - Verificar que campos RUES se autocompletan
   - Guardar

4. **Verificar en Base de Datos**:
   ```sql
   SELECT 
       nombre,
       tipo_documento,
       nit,
       digito_verificacion,
       representante_legal,
       tipo_sociedad,
       matricula_mercantil
   FROM empresas
   WHERE email = 'test.rues@example.com';
   ```

5. **Editar Empresa Existente**:
   - Seleccionar una empresa antigua
   - Click "Editar"
   - Verificar que:
     - Campo NIT carga sin DV
     - Campo DV muestra el dígito separado
     - Formulario se ve completo
   - Modificar y guardar

**Checklist Testing**:
- [ ] NIT se separa correctamente en número + DV
- [ ] DV se calcula automáticamente al escribir NIT
- [ ] Botón "Consultar RUES" funciona (simulado)
- [ ] Campos RUES se guardan correctamente
- [ ] Al editar empresa, NIT y DV cargan separados
- [ ] Al cambiar tipo documento a CC, campo DV se oculta
- [ ] Validación requiere NIT si tipo = NIT

---

## 📊 Monitoreo Post-Deploy

### Métricas a Revisar

```sql
-- 1. Empresas con NITs completos (número + DV)
SELECT 
    COUNT(*) AS empresas_con_nit_completo
FROM empresas
WHERE nit IS NOT NULL AND digito_verificacion IS NOT NULL;

-- 2. Distribución por tipo de documento
SELECT 
    tipo_documento,
    COUNT(*) AS cantidad
FROM empresas
GROUP BY tipo_documento;

-- 3. Empresas con información RUES completa
SELECT 
    COUNT(*) AS con_info_rues
FROM empresas
WHERE representante_legal IS NOT NULL
   OR tipo_sociedad IS NOT NULL
   OR matricula_mercantil IS NOT NULL;
```

---

## 🔙 Rollback (Solo si hay problemas)

```bash
# Conectarse a MySQL
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com -u admin -p kore_inventory
```

```sql
-- CUIDADO: Solo ejecutar si la migración falló

-- Eliminar campos agregados
ALTER TABLE empresas DROP COLUMN tipo_documento;
ALTER TABLE empresas DROP COLUMN digito_verificacion;
ALTER TABLE empresas DROP COLUMN representante_legal;
ALTER TABLE empresas DROP COLUMN tipo_sociedad;
ALTER TABLE empresas DROP COLUMN matricula_mercantil;
ALTER TABLE empresas DROP COLUMN camara_comercio;
ALTER TABLE empresas DROP COLUMN fecha_matricula;
ALTER TABLE empresas DROP COLUMN actividad_economica;

-- Eliminar índices
DROP INDEX idx_nit_dv ON empresas;
DROP INDEX idx_tipo_sociedad ON empresas;

-- Restaurar desde backup
-- (Opcional, solo si hiciste backup en paso 3)
DROP TABLE empresas;
RENAME TABLE empresas_backup_20260513 TO empresas;
```

---

## 📝 Checklist Final

### Pre-Deploy
- [ ] Script SQL revisado y probado en local
- [ ] Backup preventivo ejecutado
- [ ] Frontend ya desplegado con nuevos campos

### Deploy
- [ ] Conectado a servidor EC2
- [ ] Script SQL subido/creado en servidor
- [ ] Migración ejecutada sin errores
- [ ] Verificación post-migración OK

### Post-Deploy
- [ ] Backend actualizado con nuevos campos DTO
- [ ] Backend recompilado y reiniciado
- [ ] Testing crear empresa nueva: OK
- [ ] Testing editar empresa existente: OK
- [ ] Testing campos RUES se guardan: OK
- [ ] NITs migrados correctamente (separados): OK

---

## 🐛 Troubleshooting

### Problema: "Column already exists"
**Solución**: La migración ya se ejecutó. Verificar con `DESCRIBE empresas;`

### Problema: "Access denied"
**Solución**: Verificar contraseña MySQL: `Kore2026!`

### Problema: Backend no inicia después de recompilar
```bash
# Ver logs completos
pm2 logs kore-backend --lines 200

# Verificar errores TypeScript
cd /home/ubuntu/kore-inventory/backend
npm run build
```

### Problema: Frontend no envía nuevos campos
**Solución**: Verificar que `dashboard.js` tiene funciones:
- `toggleDigitoVerificacionEmpresa()`
- `autoCalcularDigitoVerificacionEmpresa()`
- `consultarRUESEmpresa()`

---

## 📞 Contactos Emergencia

- **DBA**: Luis Rodriguez
- **Backend**: Revisar PM2 logs
- **Frontend**: Revisar consola del navegador (F12)

---

## 🎯 Resumen Ejecutivo

| Item | Status | Notas |
|------|--------|-------|
| Script SQL | ✅ Creado | migration_add_campos_rues_empresas.sql |
| Backup DB | ⏳ Pendiente | Opcional pero recomendado |
| Migración | ⏳ Pendiente | Ejecutar en RDS |
| Backend Update | ⏳ Pendiente | Actualizar DTO TypeScript |
| Testing | ⏳ Pendiente | Crear/editar empresas |

**Tiempo total estimado**: 15-20 minutos

**¿Listo para ejecutar?** 🚀

---

**Fecha creación**: 2026-05-13  
**Última actualización**: 2026-05-13  
**Autor**: GitHub Copilot (Claude Sonnet 4.5)
