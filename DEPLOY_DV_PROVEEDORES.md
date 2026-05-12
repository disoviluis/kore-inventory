# Guía de Despliegue - Dígito de Verificación NIT Proveedores

## Cambios Implementados

### Backend
- **Archivo**: `backend/src/platform/proveedores/proveedores.controller.ts`
  - ✅ Campo `digito_verificacion` agregado en INSERT y SELECT
  - ✅ Validación: solo acepta dígitos 0-9
  - ✅ Campo enviado como `null` cuando tipo_documento != 'NIT'

### Frontend
- **Archivo**: `frontend/public/proveedores.html`
  - ✅ Nuevo campo "DV" con tooltip informativo
  - ✅ Campo visible solo cuando tipo_documento = 'NIT'
  - ✅ Reducción de tamaño del campo número documento (col-md-6)

- **Archivo**: `frontend/public/assets/js/proveedores.js`
  - ✅ Función `calcularDigitoVerificacionDIAN()` - Algoritmo oficial DIAN
  - ✅ Función `toggleDigitoVerificacion()` - Mostrar/ocultar campo
  - ✅ Función `autoCalcularDigitoVerificacion()` - Cálculo automático
  - ✅ Event listeners en tipoDocumento y numeroDocumento
  - ✅ Campo incluido en objeto proveedorData al guardar

### Base de Datos
- **Archivo**: `SQL/migration_add_digito_verificacion_proveedores.sql`
  - ⚠️ **IMPORTANTE**: Esta migración YA FUE EJECUTADA en RDS
  - Campo `digito_verificacion VARCHAR(1)` ya existe en tabla proveedores

---

## Comandos de Despliegue en EC2

Conéctese al servidor EC2 y ejecute los siguientes comandos:

```bash
# Conectar al servidor
ssh -i "tu-archivo.pem" ubuntu@18.191.181.99

# Una vez dentro del servidor:
cd kore-inventory

# Traer cambios desde GitHub
git pull origin main

# Compilar backend TypeScript
cd backend
npm run build

# Reiniciar servicio con PM2
pm2 restart all

# Verificar estado
pm2 status

# Salir del servidor
exit
```

---

## Funcionalidad Implementada

### Para el Usuario:

1. **Crear Proveedor con NIT**:
   - Seleccionar "NIT" en tipo de documento
   - Se muestra automáticamente el campo "DV" pequeño
   - Al escribir el número de NIT (ej: `900123456`)
   - El dígito de verificación se calcula automáticamente según DIAN
   - El usuario puede editarlo manualmente si es necesario

2. **Otros Tipos de Documento**:
   - Si selecciona CC, CE, RUT o PASAPORTE
   - El campo "DV" se oculta automáticamente
   - No se envía digito_verificacion al backend

3. **Editar Proveedor**:
   - Si el proveedor tiene NIT, se muestra el DV guardado
   - Si cambia a otro tipo de documento, el campo DV se oculta

### Algoritmo DIAN

El cálculo utiliza los pesos oficiales de la DIAN:
```
Pesos: [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3]
Aplicación: De derecha a izquierda sobre cada dígito del NIT
Fórmula: 
  - suma = Σ (dígito[i] × peso[i])
  - residuo = suma % 11
  - DV = residuo ≤ 1 ? 0 : (11 - residuo)
```

**Ejemplo**: NIT `900123456`
- Multiplicaciones: 6×71 + 5×67 + 4×59 + 3×53 + 2×47 + 1×29 + 0×23 + 0×19 + 9×17
- Suma: 426 + 335 + 236 + 159 + 94 + 29 + 0 + 0 + 153 = 1432
- Residuo: 1432 % 11 = 2
- DV: 11 - 2 = **9**

Resultado completo: `900123456-9`

---

## Validaciones Backend

El controlador valida:
- ✅ Si se proporciona DV, debe ser un dígito (0-9)
- ✅ Si tipo_documento != 'NIT', DV se guarda como `null`
- ✅ Si tipo_documento = 'NIT' y no se proporciona DV, también `null` (permitido)

---

## Archivos Modificados

```
SQL/migration_add_digito_verificacion_proveedores.sql (nuevo)
backend/src/platform/proveedores/proveedores.controller.ts
frontend/public/proveedores.html
frontend/public/assets/js/proveedores.js
```

**Total**: 199 líneas agregadas, 6 líneas eliminadas

---

## Commit

```
feat: implementar dígito de verificación DIAN para NIT en proveedores
- Migración SQL para campo digito_verificacion
- Backend: validación y soporte en crear/actualizar
- Frontend: campo condicional solo para NIT
- Algoritmo DIAN (pesos 71,67,59,53,47,43,41,37,29,23,19,17,13,7,3)
- Auto-cálculo y tooltip informativo

Commit: 482c0b2
```

---

## Próximos Pasos (Opcionales)

El sistema ya está listo para cumplimiento tributario colombiano básico con NIT.

### Futuras Mejoras Sugeridas:
1. 🇨🇴 **Facturación Electrónica** (mencionada por el usuario)
   - Integración con proveedores DIAN (Siigo, Alegra, eFactory)
   - Generación de XML según resolución DIAN
   - Firma digital y envío automático

2. **Validaciones Adicionales NIT**:
   - Consultar NIT en API DIAN para validar existencia
   - Validar estado jurídico (activo/inactivo)

3. **Campo DV en Clientes**:
   - Aplicar misma lógica al módulo de clientes
   - Reutilizar función `calcularDigitoVerificacionDIAN()`

---

## Soporte

Para consultas sobre facturación electrónica o mejoras adicionales, el sistema está preparado para integración con APIs de terceros compatibles con DIAN.

**Estado**: ✅ Implementación completa - Lista para despliegue
**Compilación**: ✅ Sin errores TypeScript
**Git**: ✅ Commit 482c0b2 pushed a main
