# Empresa de prueba Matias y soporte

## Objetivo

Crear una empresa sintetica, aislada de clientes reales, para probar:

- Conexion Matias Sandbox.
- Emision y consulta de documentos electronicos en Sandbox.
- Idempotencia, rechazos, errores y reintentos.
- Inventario, compras, ventas, facturacion, cartera, contabilidad, bodegas,
  traslados, activos, reportes, usuarios, roles y demas modulos de soporte.
- Diagnostico de incidentes sin usar datos de clientes reales.

No usar estos datos para produccion, documentos DIAN reales, pagos reales ni
comunicaciones comerciales. Todos los nombres, correos, NIT y documentos de
este manual son sinteticos.

## 1. Empresa sintetica

### Datos para crearla

| Campo | Valor de prueba |
|---|---|
| Nombre comercial | KORE PRUEBAS MATIAS SOPORTE |
| Razon social | KORE PRUEBAS MATIAS SOPORTE SAS |
| Tipo de documento | NIT |
| NIT sintetico | 900999001 |
| Digito de verificacion | 1 |
| Representante legal | USUARIO PRUEBA KORE |
| Tipo de sociedad | SAS |
| Matricula mercantil | PRUEBA-MATIAS-001 |
| Camara de comercio | CAMARA-PRUEBAS |
| Actividad economica | 4791 - Comercio al por menor por Internet |
| Correo principal | pruebas.matias@example.invalid |
| Telefono | 3000000001 |
| Direccion | Calle 00 # 00-00, Datos de prueba |
| Ciudad | Bogota |
| Pais | Colombia |
| Regimen tributario | Comun |
| Tipo de contribuyente | Persona juridica |
| Ambiente de facturacion | Sandbox solamente |

El NIT debe conservarse como dato de prueba y no debe reutilizarse para una
empresa real. Si Matias exige un NIT valido para Sandbox, solicitar a Matias
un NIT de prueba o el procedimiento oficial para datos sinteticos.

### Usuario administrador de prueba

Crear un usuario separado de los administradores reales:

| Campo | Valor sugerido |
|---|---|
| Nombre | Admin |
| Apellido | Matias Pruebas |
| Correo | admin.matias.pruebas@example.invalid |
| Tipo | admin_empresa |
| Empresa | KORE PRUEBAS MATIAS SOPORTE |
| Rol | Administrador de empresa |

La contrasena debe establecerse manualmente y nunca escribirse en este archivo,
Git, SQL, tickets ni capturas de pantalla.

## 2. Licencia de prueba

### Estado requerido

La empresa debe quedar con:

- Empresa en estado `activa`.
- Plan asignado: `Plan Integral`.
- Licencia activa asociada al mismo plan.
- Limites suficientes para probar todos los modulos: usuarios, productos,
  bodegas, ventas, facturas, almacenamiento y demas capacidades contratadas.
- Sin dependencia del trial.
- Sin fecha de vencimiento operativa durante el periodo de soporte.
- Auto-renovacion desactivada si la licencia se administra manualmente.

### Advertencia sobre la licencia vitalicia

El backend actual de activacion de licencias solo acepta `mensual` y `anual`.
No existe una modalidad `vitalicia` nativa en el flujo actual. Por tanto:

1. Un Super Admin debe confirmar que existe el plan exacto `Plan Integral`.
2. Debe confirmar con el responsable del producto como se representa una
   licencia vitalicia en la base y en los trabajos de vencimiento.
3. La licencia debe asignarse mediante la herramienta o procedimiento aprobado
   por soporte.
4. No usar `9999-12-31`, fechas inventadas, monto cero ni cambios directos sin
   respaldo y sin validar el job de vencimiento.
5. Si el producto requiere una modalidad permanente formal, primero debe
   implementarse un tipo de licencia soportado y probarse en una base no
   productiva.

### Verificacion por Super Admin

Registrar estos valores despues de la asignacion:

```text
Empresa ID: ______________________________
Plan Integral ID: _________________________
Licencia ID: ______________________________
Estado empresa: ___________________________
Estado licencia: __________________________
Fecha inicio: _____________________________
Fecha fin o indicador vitalicio: ___________
Limite usuarios: __________________________
Limite productos: _________________________
Limite facturas: __________________________
Metodo de asignacion: _____________________
Responsable: ______________________________
Fecha de verificacion: _____________________
```

La empresa no debe quedar en `trial`, `suspendida`, `cancelada` ni con una
licencia vencida. Tomar una captura o exportar el resultado de la verificacion
sin exponer contrasenas, tokens ni datos de otras empresas.

## 3. Datos funcionales base

### Bodegas

Crear al menos dos bodegas para probar inventario y traslados:

| Codigo | Nombre | Estado |
|---|---|---|
| PRUEBA-BOG | Bodega prueba Bogota | Activa |
| PRUEBA-ALT | Bodega prueba alterna | Activa |

Validar que ambas tengan el mismo `empresa_id` de la empresa sintetica. No
reutilizar una bodega asignada a otra empresa.

### Productos

| SKU | Nombre | Precio venta | Costo | IVA | Stock inicial |
|---|---|---:|---:|---:|---:|
| MAT-001 | Producto prueba gravado | 100000 | 60000 | 19% | 50 |
| MAT-002 | Producto prueba exento | 50000 | 30000 | 0% | 30 |
| MAT-003 | Servicio prueba | 25000 | 0 | 0% | 0 |

Crear existencias por bodega y verificar que el stock global coincida con la
suma de `productos_bodegas`.

### Clientes

#### Cliente persona juridica

```text
TIPO E IDENTIFICACION
Tipo de cliente: Empresa
Tipo de persona: Juridica
Razon social: CLIENTE PRUEBA MATIAS SAS
Nombre comercial: CLIENTE MATIAS PRUEBAS
Tipo documento: NIT
Numero documento: 901000001
Digito verificacion: 1

CONTACTO
Nombre contacto: CONTACTO PRUEBA MATIAS
Apellido contacto: FACTURACION
Correo: cliente.matias@example.invalid
Telefono: 6010000001
Celular: 3000000002

DIRECCION
Direccion: Calle 00 # 00-01
Ciudad: Bogota
Departamento: Cundinamarca
Codigo postal: 110111
Pais: Colombia

INFORMACION FISCAL
Regimen tributario: comun
Responsabilidad fiscal: IVA; Responsable de IVA
Actividad economica: 4690 - Comercio al por mayor no especializado
Codigo CIIU: 4690

CONDICIONES COMERCIALES
Forma de pago predeterminada: Contado
Dias de credito: 0
Limite de credito: 0
Moneda: COP
Lista de precios: General

RETENCIONES
Aplica retencion en la fuente: No
Tasa retencion en la fuente: 0
Aplica retencion de IVA: No
Tasa retencion de IVA: 0
Aplica ICA: No
Tasa ICA: 0

PRUEBA MATIAS
Uso: Factura electronica Sandbox
Correo para documento: cliente.matias@example.invalid
Observacion: Cliente sintetico; no tiene validez comercial ni fiscal.
```

#### Cliente persona natural

```text
Nombres: CLIENTE NATURAL PRUEBA
Apellidos: MATIAS
Tipo documento: Cedula de ciudadania
Numero documento: 1000000001
Correo: cliente.natural.matias@example.invalid
Direccion: Calle 00 # 00-02
Ciudad: Bogota
Regimen: No responsable de IVA
Forma de pago: Contado
```

## 4. Informacion que debe suministrar Matias

Solicitar por escrito y conservar la respuesta en el expediente de soporte:

### Datos recibidos

Informacion recibida el 2026-10-28 para MATÍAS API — Kinventory Services:

| Tema | Dato confirmado | Estado / aclaracion |
|---|---|---|
| API de produccion | `https://api-v2.matias-api.com/api/ubl2.1` | URL base informada; no usar hasta completar pruebas y autorizacion de produccion. |
| Acceso de produccion | `https://auth-v2.matias-api.com/#/auth/login` | Portal de login informado. |
| Portal Sandbox | `https://sandbox-auth.matias-api.com/` | Portal para crear y administrar una cuenta de prueba, incluida nomina. |
| API de facturacion Sandbox | `https://sandbox-api.matias-api.com/api/ubl2.1` | Base confirmada en la documentacion oficial publica de MATÍAS. Es independiente de produccion y del portal web. |
| Prueba de autenticacion | `GET /auth/user` | Documentada para verificar el token. Usar contra la base Sandbox, nunca contra produccion durante las pruebas. |
| Emision de factura estandar | `POST /invoice` | Documentada para Sandbox. Usar un payload de ejemplo oficial y una resolucion de prueba. |
| Firma digital en produccion | Certificado digital obligatorio. | Nunca registrar certificados ni llaves privadas en este archivo. |
| Firma/certificados en Sandbox | Maticerts Sandbox: `https://sandbox-app.maticerts.com/`; API indicada: `https://sandbox-api.maticerts.com`. Pruebas gratuitas. | Servicio de certificados identificado por MATÍAS; no confundir con la API de facturacion MATÍAS. Confirmar flujo de uso e integracion en la documentacion del Sandbox. |
| Identificacion de cliente | MATÍAS confirmó que `client_uuid` debe ir en el body de cada POST JSON y es obligatorio. | La documentacion de Casa de Software tambien describe `client_uuid` como parametro query para operaciones multiempresa. Se enviara en el body, como indico MATÍAS, y tambien como query hasta validar el comportamiento exacto del endpoint. Falta obtener el UUID de prueba. |
| PAT | Cuenta Sandbox independiente: registrar, verificar el correo e iniciar sesion; el PAT se crea desde el dashboard autenticado. | Documentacion publica indica expiracion configurable de 1 a 365 dias (90 por defecto) y que el token se muestra una sola vez. No copiar el secreto aqui. |
| Resoluciones Sandbox | Se crean en el portal en la seccion Resoluciones/Numeraciones. | Crear una resolucion sintetica y registrar prefijo, rango y vigencia en el entorno seguro correspondiente. |
| Limite de solicitudes | MATÍAS informa un limite de 60 a 90 peticiones por minuto; al excederlo responde HTTP 429. | Falta confirmar el limite efectivo de la cuenta y el intervalo/estrategia de reintento; no asumir que reintentar inmediatamente es seguro. |
| Emision y consulta | Emision sincrona. El estado, CUFE, XML y PDF se consultan desde el dashboard. | Falta confirmar si existen endpoints API para consulta/descarga y conocer sus respuestas exactas. |
| Registro DIAN | Registrar el software como `MATÍAS API` en `Software Propio`. | El equipo de desarrollo MATÍAS hace el registro; compartirles el Software ID y TestSetId por el chat cuando se obtengan. |
| Soporte tecnico | MATÍAS ofrece coordinar una videollamada por el mismo chat. | Acordar fecha y participantes cuando se necesite revisar la guia de integracion. |

Respuesta de MATÍAS recibida el 2026-10-28. El equipo indico que los ejemplos
exactos de headers, factura aceptada/rechazada, codigos y reintentos
idempotentes estan en la documentacion del Sandbox y ofrecio coordinacion
tecnica por videollamada. Tambien solicita informar el lenguaje/framework y la
guia de implementacion para confirmar compatibilidad.

### Revision de documentacion publica

Revision realizada el 2026-10-28: se localizaron la guia de introduccion,
Quickstart Sandbox, autenticacion y una coleccion Postman publica. La guia
indica que Swagger UI requiere servicio activo. Revisar los ejemplos despues de
crear la cuenta y comparar cualquier diferencia con la indicacion directa de
MATÍAS, en especial el envio de `client_uuid`.

- [Introduccion y URL base](https://docs.matias-api.com/docs/intro/)
- [Quickstart Sandbox](https://docs.matias-api.com/docs/sandbox/quickstart.md)
- [Autenticacion y PAT](https://docs.matias-api.com/docs/endpoints/intro-auth#personal-access-tokens)
- [Casa de Software y client_uuid](https://docs.matias-api.com/docs/endpoints/company#clientes-casa-software)
- [Coleccion Postman MATÍAS](https://documenter.getpostman.com/view/8699065/2s9YyvBLby)

No se recibieron credenciales, `client_uuid`, Software ID ni TestSetId en el
mensaje. No inventar esos valores ni guardar PAT, contrasenas, certificados o
llaves privadas en este documento.

### Pendientes para continuar

**Bloqueantes para la prueba real en Sandbox:**

- Crear la cuenta Sandbox, verificar su correo e iniciar sesion.
- Crear el PAT de prueba desde el dashboard y guardarlo en el secreto local
  aprobado; nunca incluirlo en este archivo, repositorio o logs.
- Obtener/configurar el `client_uuid` que corresponde a la subcuenta que
  emitira; MATÍAS indico que es obligatorio en el body de cada POST JSON.
- Confirmar en la cuenta o con soporte si la misma operacion requiere tambien
  el parametro query `client_uuid`, descrito por la guia generica de Casa de
  Software.
- Confirmar en la guia como se asocia Maticerts Sandbox a MATÍAS Sandbox y si
  hace falta certificado para el flujo de facturacion de prueba. MATÍAS indico
  que el certificado es obligatorio en produccion.
- Crear la resolucion de prueba y registrar prefijo, rango y vigencia fuera de
  este archivo si incluyen datos sensibles.

**Necesarios para preparar y validar la integracion completa:**

- Payload oficial minimo y respuestas de exito/rechazo, campos obligatorios y
  datos fiscales de emisor/cliente aceptados en Sandbox.
- Reglas aplicables a impuestos, descuentos, retenciones, redondeo, moneda,
  unidades de medida y codigos UNSPSC.
- Casos de aceptacion y rechazo; codigos HTTP/proveedor y catalogo de errores.
- Confirmar el limite efectivo (MATÍAS indico 60-90 solicitudes por minuto),
  politica segura de reintentos ante HTTP 429, timeouts e idempotencia.
- MATÍAS indica emision sincrona y consulta de estado, CUFE, XML y PDF desde el
  dashboard; confirmar en la guia si tambien hay endpoints API y como manejar
  respuestas pendientes o desconocidas. Consultar si QR esta disponible.
- Obtener el Software ID y TestSetId mediante el proceso DIAN y compartirlos con
  MATÍAS por el chat para el registro como `MATÍAS API`.
- Confirmacion de que los documentos de Sandbox no tienen validez fiscal.
- Lenguaje/stack de la integracion y documento que se usara como guia paso a
  paso, datos que MATÍAS tambien solicito confirmar.

### Estado de pruebas e implementacion local

- **Se puede empezar ya:** build y pruebas locales sin contactar al proveedor;
  crear la cuenta Sandbox; revisar la documentacion/coleccion Postman; y probar
  `GET /auth/user` una vez se disponga del PAT.
- **Emision real de prueba:** el backend local ya tiene rutas para configurar,
  probar conexion y emitir una venta en Sandbox. Antes de emitir se requiere
  PAT, `client_uuid`, resolucion/rango de prueba y validar el payload oficial.
- **Ajuste local realizado:** asegurar `client_uuid` en el body JSON de emision,
  conservarlo en el payload persistido/hash, enviarlo tambien como query por la
  guia multiempresa y rechazar la emision si falta. Tambien se bloquea una
  segunda emision local de una venta con solicitud fiscal previa; se debe
  revisar el dashboard antes de considerar un reenvio.
- **Validacion local (2026-10-28):** `npm --prefix backend test` compilo el
  backend y paso las 64 pruebas, incluidas las dos nuevas pruebas del cliente
  MATÍAS. No se hicieron llamadas al proveedor ni emisiones.
- **Validacion AWS (2026-10-28):** `npm ci` y `npm test` completaron en EC2 con
  64 pruebas aprobadas; el proceso PM2 reinicio correctamente. La pestaña de
  Facturacion electronica esta disponible desde el frontend servido por Nginx.
- **Base AWS:** Fase 1 y Fase 2 verificadas; ambas migraciones ya estaban
  aplicadas. El commit `bd9e934` con los cambios del conector fue desplegado en
  EC2; `kore-backend` esta online y `/health` respondio correctamente.
- **Pendiente de integracion funcional:** aun no esta conectado el boton de
  emision al flujo POS; la prueba inicial se debe ejecutar con la ruta protegida
  de emision Sandbox sobre una venta sintetica.
- **Reintentos:** no activar reintentos automaticos ante timeout/429 hasta
  validar en la documentacion el contrato de idempotencia. La API describe la
  emision como sincrona; un timeout puede dejar resultado desconocido. El
  endpoint local bloquea por ahora cualquier reemision de la misma venta.

### Verificacion AWS autorizada (2026-10-28)

Destino comprobado: EC2 `18.191.181.99`, rama `main`, backend PM2
`kore-backend`; base conectada desde la aplicacion: `kore_inventory`.

- Fase 1 verificada en modo solo lectura: existen `matias_conexiones`,
  `matias_servicios` y `matias_eventos_auditoria`. Hay 27 servicios sembrados
  para Sandbox.
- Fase 2 ya estaba aplicada: existen `matias_documentos` y
  `matias_documento_intentos`, con las 14 columnas criticas y los tres indices
  unicos requeridos. Resultado: `OK - MIGRACION FASE 2 VALIDA`.
- Por tanto, **no fue necesario ejecutar DDL en RDS**; la base no fue
  modificada durante esta verificacion.
- Aun no se ha configurado un PAT/UUID ni se ha probado autenticacion o enviado
  una factura a MATÍAS.

### Cuenta y acceso Sandbox

- `client_id` o referencia de la subcuenta, si aplica.

El PAT debe entregarse por un canal seguro y nunca debe copiarse a este
documento, Git, chats, logs o capturas.

### Datos fiscales de Sandbox

- NIT y datos de emisor aceptados por Sandbox.
- `client_uuid` asociado al NIT.
- Resolucion, prefijo y rango de numeracion de prueba.
- Fecha de vigencia de la resolucion de prueba.
- Datos fiscales de cliente aceptados.
- Reglas de IVA, descuentos, retenciones, redondeo y moneda.
- Codigo UNSPSC o unidad de medida requerida.
- Datos minimos obligatorios para persona natural y juridica.
- Ejemplos oficiales de payload y respuesta.
- Resultado esperado para factura aceptada.
- Casos oficiales para factura rechazada.
- Forma de consultar estado, CUFE, XML, PDF y QR.

### Pruebas de error solicitadas

Matias debe indicar como provocar de forma segura:

- Resolucion invalida o vencida.
- Cliente con datos fiscales incompletos.
- Producto o impuesto invalido.
- Numero de documento duplicado.
- Token vencido o revocado.
- Timeout o respuesta 5xx simulada.
- Rate limit.
- Respuesta pendiente o estado desconocido.

### Soporte y evidencias

- Canal y horario de soporte tecnico.
- Identificador requerido para cada ticket.
- Tiempo objetivo de respuesta.
- Politica de retencion de XML, PDF y respuestas.
- Procedimiento para solicitar reenvio o consulta de estado.
- Confirmacion de que los documentos Sandbox no tienen validez fiscal.

## 5. Preparacion tecnica Fase 1

1. Ejecutar manualmente la migracion Fase 1 en la base autorizada.
2. Confirmar las tablas `matias_conexiones`, `matias_servicios` y
   `matias_eventos_auditoria`.
3. Confirmar que los servicios iniciales fueron creados para la empresa y ambos
   entornos.
4. Entrar con el administrador de prueba y seleccionar la empresa sintetica.
5. Guardar la conexion Sandbox con el PAT y el `client_uuid` entregados por
   Matias.
6. Probar conexion y confirmar estado local `configurado`.
7. Activar solo `factura_electronica` para Sandbox.
8. Confirmar que el PAT nunca se devuelve al navegador ni aparece en logs.
9. Probar aislamiento con otra empresa: consulta, escritura y prueba deben ser
   rechazadas si el usuario no pertenece a la empresa sintetica.
10. Registrar fecha, usuario, ambiente, resultado y evidencia de cada prueba.

## 6. Preparacion tecnica Fase 2

1. Ejecutar manualmente la migracion Fase 2.
2. Ejecutar la validacion de Fase 2 y conservar el resultado `OK - MIGRACION
   FASE 2 VALIDA`.
3. Crear una venta de prueba con el cliente juridico, `MAT-001` y `MAT-002`.
4. Confirmar que la empresa tiene resolucion y prefijo de Sandbox suministrados
   por Matias.
5. Confirmar que la conexion esta probada y el servicio esta activo.
6. Emitir la venta en Sandbox.
7. Verificar el documento local, el UUID, el estado, la respuesta, el CUFE si
   Matias lo devuelve y el registro de intento.
8. Consultar nuevamente el documento y comparar el estado.
9. Repetir la solicitud sobre la misma venta. Debe conservar la idempotencia y
   no crear documentos duplicados.
10. Ejecutar los casos de rechazo y timeout autorizados por Matias.
11. Confirmar que errores y respuestas no contienen el PAT.

### Criterios de aprobacion Fase 2

- La venta original no se duplica.
- La solicitud queda trazada en `matias_documentos`.
- Cada intento queda trazado en `matias_documento_intentos`.
- Los estados `accepted`, `rejected`, `emitted` y `unknown` se distinguen.
- Una respuesta pendiente no se reporta como aceptacion fiscal.
- La empresa y la venta siempre pertenecen al mismo tenant.
- El payload y la respuesta pueden auditarse sin secretos.
- La consulta posterior devuelve el mismo documento local.

## 7. Pruebas posteriores de soporte

Ejecutar con datos sinteticos y registrar el resultado:

| Area | Prueba minima |
|---|---|
| Acceso | Login, logout, expiracion de sesion y recuperacion |
| Empresas | Selector de empresa y aislamiento entre tenants |
| Licencias | Plan Integral, permisos de modulo y bloqueo de vencimiento |
| Usuarios | Alta, baja, reactivacion, roles y limite del plan |
| Productos | CRUD, categorias, impuestos, precios y stock |
| Bodegas | Dos bodegas, conteo, ajuste, bloqueo y traslado |
| Compras | Proveedor, compra, recepcion y entrada de inventario |
| Ventas | Venta contado, credito, impuestos, pagos y anulacion |
| Matias | Conexion, emision Sandbox, rechazo, reintento e idempotencia |
| Cartera | Cuenta por cobrar, abono, vencimiento y saldo |
| Finanzas | Bancos, gastos, ingresos y reportes |
| Contabilidad | Plan de cuentas, comprobantes y cierre de prueba |
| Activos | Alta, asignacion, mantenimiento y baja |
| Reportes | Filtros, exportacion y datos por empresa |
| Seguridad | Permisos, CSRF, tenant cruzado y auditoria |
| Frontend | Cambio de empresa, cache, errores de red y responsive |

## 8. Registro de evidencias

Por cada prueba registrar:

```text
ID de prueba:
Fecha y hora:
Responsable:
Empresa ID:
Usuario:
Ambiente: Sandbox / local / soporte
Precondiciones:
Pasos ejecutados:
Resultado esperado:
Resultado observado:
HTTP o codigo proveedor:
ID documento / intento / ticket:
Evidencia adjunta:
Estado: aprobado / rechazado / bloqueado
Accion siguiente:
```

## Referencias del repositorio

- [Migracion Matias Fase 1](SQL/migration_20261026_matias_fase1.sql)
- [Migracion Matias Fase 2](SQL/migration_20261027_matias_fase2.sql)
- [Validacion Matias Fase 2](SQL/validar_migration_20261027_matias_fase2.sql)
- [Plan de implementacion Matias](PLAN_IMPLEMENTACION_FACTURACION_ELECTRONICA_MATIAS.md)
- [Arquitectura de licencias](ARQUITECTURA_LICENCIAS_PLANES.md)
