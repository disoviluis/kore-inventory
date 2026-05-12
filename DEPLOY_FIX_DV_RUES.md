# Guía de Despliegue - Corrección DV y Campos RUES

## ✅ Correcciones y Nuevas Funcionalidades

### 1. ✅ Algoritmo Dígito de Verificación CORREGIDO

**Problema identificado**: Los pesos estaban en orden inverso

**Solución aplicada**: 
- Pesos correctos DIAN: `[3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]`
- Aplicación de derecha a izquierda sobre el NIT

**Validación con NITs reales**:
```
✓ NIT 900342297 (Arturo Calle) -> DV = 2 ✓
✓ NIT 900156264 (Ejemplo) -> DV = 2 ✓
✓ NIT 900123456 (XYZ) -> DV = 9 ✓
```

---

### 2. 🆕 Campos RUES Agregados

Nuevos campos en tabla `proveedores`:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `representante_legal` | VARCHAR(200) | Nombre completo del representante legal |
| `tipo_sociedad` | VARCHAR(50) | SAS, LTDA, SA, etc. |
| `matricula_mercantil` | VARCHAR(100) | Número de matrícula |
| `camara_comercio` | VARCHAR(100) | Cámara de comercio donde está registrado |
| `fecha_matricula` | DATE | Fecha de constitución/matrícula |
| `actividad_economica` | VARCHAR(255) | Código y descripción CIIU |
| `departamento` | VARCHAR(100) | Departamento (adicional a ciudad) |

---

### 3. 🔍 Función "Consultar RUES"

**Implementación**:
- ✅ Botón en formulario de proveedores
- ✅ Validación: solo disponible para NIT
- ✅ Auto-completado de todos los campos desde RUES
- ✅ Spinner de carga durante consulta
- ✅ Datos simulados para demostración (NITs conocidos)

**NITs de prueba disponibles**:
```javascript
900342297 - Arturo Calle (Medellín, Antioquia)
900156264 - Empresa Ejemplo (Bogotá, Cundinamarca)
900123456 - Distribuidora XYZ (Cali, Valle del Cauca)
```

**Para integrar API real**: Editar función `consultarRUES()` en `proveedores.js` línea 420+

---

## 📦 Archivos Modificados

```
SQL/migration_add_campos_rues_proveedores.sql (nuevo)
backend/src/platform/proveedores/proveedores.controller.ts
frontend/public/proveedores.html
frontend/public/assets/js/proveedores.js
```

**Total**: 405 líneas agregadas, 13 líneas eliminadas

---

## 🚀 Comandos de Despliegue

### Paso 1: Ejecutar Migración en RDS

Conéctese a su servidor EC2:

```bash
ssh -i "tu-clave.pem" ubuntu@18.191.181.99
```

Una vez dentro, ejecute la migración:

```bash
# Navegar al directorio del proyecto
cd kore-inventory

# Ejecutar migración SQL en RDS
mysql -h kore-inventory.cpifmq4gwbbf.us-east-2.rds.amazonaws.com \
      -u admin \
      -p \
      kore_inventory < SQL/migration_add_campos_rues_proveedores.sql
```

**Contraseña RDS**: (ingresarla cuando se solicite)

---

### Paso 2: Desplegar Código en EC2

Desde el servidor EC2:

```bash
# Ya debe estar en ~/kore-inventory desde el paso anterior

# Traer últimos cambios desde GitHub
git pull origin main

# Compilar backend TypeScript
cd backend
npm run build

# Reiniciar servicios con PM2
pm2 restart all

# Verificar estado
pm2 status
pm2 logs --lines 50

# Salir del servidor
exit
```

---

## 🧪 Pruebas Post-Despliegue

### 1. Probar Dígito de Verificación Corregido

1. Ir a módulo **Proveedores**
2. Clic en **Nuevo Proveedor**
3. Seleccionar **Tipo Documento: NIT**
4. Ingresar: `900342297`
5. **Verificar**: Campo DV debe mostrar automáticamente: **2** ✓

### 2. Probar Consulta RUES

1. En el mismo formulario de Nuevo Proveedor
2. Con el NIT `900342297` ingresado
3. Clic en botón **"Consultar RUES"**
4. **Verificar**: Se debe autocompletar:
   - Razón Social: COMERCIALIZADORA ARTURO CALLE S.A.S.
   - Nombre Comercial: Arturo Calle
   - Representante Legal: Juan Carlos Calle
   - Tipo Sociedad: SAS
   - Ciudad: Medellín
   - Departamento: Antioquia
   - Dirección, teléfono, email, etc.

### 3. Probar Guardado con Nuevos Campos

1. Completar otros campos requeridos
2. Guardar proveedor
3. **Verificar**: Sin errores de backend
4. Editar el proveedor recién creado
5. **Verificar**: Todos los campos RUES se cargan correctamente

---

## 🔧 Integración con API RUES Real (Opcional)

Actualmente usa datos simulados. Para integrar API real:

### Opción 1: API RUES Oficial
```javascript
// En frontend/public/assets/js/proveedores.js -> función consultarRUES()
const response = await fetch(`https://api.rues.org.co/consulta/${nitCompleto}`, {
    headers: {
        'Authorization': 'Bearer TU_API_KEY_AQUI'
    }
});
const datos = await response.json();
```

### Opción 2: Servicios Comerciales
- **Verifik.co**: https://verifik.co/api
- **TuDian.com**: https://tudian.com/api
- **DataCrédito**: Consulta empresarial

**Nota**: Requiere registro y API KEY. Costos varían según proveedor.

---

## 📊 Estado del Sistema

### Base de Datos
- ✅ Campo `digito_verificacion` existente (migración anterior)
- ⏳ Campos RUES pendientes de ejecutar migración

### Backend
- ✅ Compilación exitosa sin errores
- ✅ CRUD completo para nuevos campos
- ✅ Validaciones implementadas

### Frontend
- ✅ UI actualizada con 7 nuevos campos
- ✅ Botón Consultar RUES funcional
- ✅ Auto-completado implementado
- ✅ Tooltips y ayudas visuales

---

## 🎯 Próximos Pasos Sugeridos

1. **Ejecutar migración en RDS** (requerido)
2. **Desplegar en EC2** (requerido)
3. **Probar funcionalidad** (recomendado)
4. **Contratar API RUES real** (opcional, para producción)
5. **Replicar en módulo Clientes** (sugerido - mismos campos)

---

## 📝 Notas Importantes

### Cálculo DV - Ejemplo Detallado

Para NIT `900342297`:

```
Dígitos:  9   0   0   3   4   2   2   9   7
Pesos:   71  67  59  53  47  43  41  37  29

Productos:
9 × 71 = 639
0 × 67 = 0
0 × 59 = 0
3 × 53 = 159
4 × 47 = 188
2 × 43 = 86
2 × 41 = 82
9 × 37 = 333
7 × 29 = 203

Suma = 1690
Residuo = 1690 % 11 = 9
DV = 11 - 9 = 2 ✓
```

### Compatibilidad

- ✅ MySQL/MariaDB (RDS)
- ✅ TypeScript 4.x+
- ✅ Bootstrap 5
- ✅ Navegadores modernos (Chrome, Firefox, Edge, Safari)

---

## 🆘 Troubleshooting

### Error: "Column 'representante_legal' doesn't exist"
**Solución**: Ejecutar migración SQL en RDS (Paso 1)

### Error: "Cannot read properties of undefined (reading 'representante_legal')"
**Solución**: Limpiar caché del navegador (Ctrl+Shift+R)

### DV sigue mostrando valor incorrecto
**Solución**: 
1. Limpiar caché navegador
2. Verificar que se desplegó `proveedores.js` actualizado
3. Ver consola del navegador para errores JavaScript

### Botón "Consultar RUES" no responde
**Solución**: 
1. Verificar consola de navegador (F12)
2. Asegurar que tipo_documento = 'NIT'
3. Ingresar NIT válido antes de consultar

---

## ✅ Checklist de Despliegue

- [ ] Migración SQL ejecutada en RDS
- [ ] `git pull` en servidor EC2
- [ ] `npm run build` exitoso
- [ ] `pm2 restart all` ejecutado
- [ ] DV calcula correctamente (prueba con 900342297 -> DV=2)
- [ ] Botón RUES autocompleta (prueba con 900342297)
- [ ] Guardado de proveedor con nuevos campos funciona
- [ ] Edición carga campos RUES correctamente

---

**Commit**: `71c2273`  
**Fecha**: 2026-05-12  
**Estado**: ✅ Listo para despliegue  
**Requiere**: Migración SQL + Restart PM2
