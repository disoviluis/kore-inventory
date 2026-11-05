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
| NIT sintetico usado en MATÍAS Sandbox | 900999002 |
| Digito de verificacion calculado por MATÍAS | 7 |
| Representante legal | USUARIO PRUEBA KORE |
| Tipo de sociedad | SAS |
| Matricula mercantil | PRUEBA-MATIAS-001 |
| Camara de comercio | CAMARA-PRUEBAS |
| Actividad economica | 4791 - Comercio al por menor por Internet |
| Correo principal de datos de prueba locales | pruebas.matias@example.invalid (marcador no utilizable para crear una cuenta MATÍAS) |
| Telefono | 3000000001 |
| Direccion | Calle 00 # 00-00, Datos de prueba |
| Ciudad | Bogota |
| Pais | Colombia |
| Regimen tributario | Comun |
| Tipo de contribuyente | Persona juridica |
| Ambiente de facturacion | Sandbox solamente |

El NIT debe conservarse como dato de prueba de Sandbox y no debe reutilizarse
para una empresa real ni en Produccion.

**Resultado del registro en MATÍAS Sandbox (2026-11-04):** el primer NIT
sintetico `900999001` ya existia en esa base. MATÍAS confirmó que no hay NIT
reservado oficial y que se pueden usar datos propios de prueba en Sandbox. La
subcuenta se creó correctamente con NIT `900999002` (el portal calculó DV 7).
El correo del primer intento ya estaba registrado; la cuenta finalmente creada
usa otro correo real controlado por el equipo, cuyo valor no se registra aqui.

### Confirmacion de MATÍAS sobre alta y requisitos Sandbox (2026-11-04)

MATÍAS confirmo que:

- La subcuenta se crea desde la cuenta principal en el menu **Clientes**.
- Sandbox no tiene restricciones sobre los datos de prueba propios; no hay un
  NIT de pruebas reservado oficialmente.
- No se necesita certificado digital ni configuracion/habilitacion DIAN para
  emitir documentos de prueba en Sandbox.
- El prefijo y rango de numeracion se crean manualmente en **Resoluciones** o
  **Numeraciones** del portal Sandbox.

El flujo de alta quedó completado en **Clientes > Crear cliente** con un NIT
sintetico sin DV y correo valido no registrado. La cuenta es exclusiva del
portal `sandbox-auth`; no usar la URL ni las credenciales de Produccion.

### Subcuenta sintetica creada en MATÍAS Sandbox (2026-11-04)

La captura del usuario muestra la empresa creada y listada en **Clientes**:

| Campo | Valor observado |
|---|---|
| Razon social | KORE PRUEBAS MATIAS SOPORTE SAS |
| Nombre comercial | KORE PRUEBAS MATIAS SOPORTE |
| NIT mostrado | 900.999.002-7 (NIT digitado sin DV: `900999002`) |
| Ciudad | Bogota, D.C., Bogota |
| `client_uuid` | `486470ef-d897-11f1-a807-d843ae899220` |
| Actividad del cliente | Sin documentos emitidos en 2026 |
| Resoluciones activas mostradas | 11 |
| Resolucion de factura (FEV) | `1876000001`, rango 1-1000, prefijo `FEV`, siguiente 1 |
| Vigencia FEV mostrada | 04/11/2026 a 19/01/2030 (interpretacion dia/mes/año de la interfaz) |
| Preparacion DIAN mostrada | Certificado indicado como vigente hasta 04/11/2027; ambiente `Habilitacion (pruebas)` |

La subcuenta ya fue creada y el UUID anterior es el `client_uuid` que debe
asociarse a la empresa sintetica de Kinventory; no confundirlo con el ID
numerico de cliente ni con el token. La captura muestra una resolucion FEV
activa y un rango; no hace falta crear otra antes de confirmar que esta
resolucion corresponde a la prueba. Aunque MATÍAS indicó que Sandbox no
requiere certificado ni configuracion DIAN, el panel muestra estado de
certificado y ambiente de pruebas; no iniciar acciones de habilitacion
productiva. Validar la resolucion/payload Sandbox antes de emitir.

### Usuario administrador de prueba

Crear un usuario separado de los administradores reales:

| Campo | Valor sugerido |
|---|---|
| Nombre | Admin |
| Apellido | Matias Pruebas |
| Correo | Usar un correo real, único y controlado por el equipo para el usuario de la subcuenta MATÍAS; no usar `example.invalid`. |
| Tipo | admin_empresa |
| Empresa | KORE PRUEBAS MATIAS SOPORTE |
| Rol | Administrador de empresa |

La contrasena debe establecerse manualmente y nunca escribirse en este archivo,
Git, SQL, tickets ni capturas de pantalla.

**Correo para cuenta de acceso MATÍAS:** no usar las direcciones
`example.invalid` de los ejemplos de datos locales: ese dominio reservado no
recibe mensajes. Para la cuenta/subcuenta que se crea en MATÍAS, usar una
dirección real, válida, única y accesible por el equipo responsable. Aunque la
documentación de Casa de Software indica que el alta de subcuenta no envía
verificación por correo, el email queda como usuario de acceso y puede ser
necesario para recuperación, avisos o soporte. Se puede usar un alias dedicado
si el dominio de correo acepta alias y el equipo puede recibirlos. No reutilizar
un correo ya registrado si MATÍAS exige unicidad.

La contraseña de esa cuenta debe generarse de forma única y cumplir la regla
que muestra el formulario (mínimo 12 caracteres, mayúsculas/minúsculas, número
y símbolo). Guardarla en el gestor de contraseñas aprobado; no escribirla en el
Markdown, Git ni chat.

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
| Portal Sandbox | `https://sandbox-auth.matias-api.com/` | Portal autenticado de pruebas; alta de subcuentas mediante el menú Clientes de la cuenta principal Casa de Software. |
| API de facturacion Sandbox | `https://sandbox-api.matias-api.com/api/ubl2.1` | Base confirmada en la documentacion oficial publica de MATÍAS. Es independiente de produccion y del portal web. |
| Prueba de autenticacion | `GET /auth/user` | Documentada para verificar el token. Usar contra la base Sandbox, nunca contra produccion durante las pruebas. |
| Emision de factura estandar | `POST /invoice` | Documentada para Sandbox. Usar un payload de ejemplo oficial y una resolucion de prueba. |
| Firma digital en produccion | Certificado digital obligatorio. | Nunca registrar certificados ni llaves privadas en este archivo. |
| Firma/certificados en Sandbox | MATÍAS confirma que no se requiere certificado digital para emitir en Sandbox. Maticerts Sandbox (`https://sandbox-app.maticerts.com/`) es una opcion separada para pruebas gratuitas. | No confundir la API de Maticerts con la API de facturacion MATÍAS; certificado fuera del alcance de la prueba Sandbox. |
| Identificacion de cliente | MATÍAS confirmó que `client_uuid` debe ir en el body de cada POST JSON y es obligatorio. | La documentacion de Casa de Software tambien describe `client_uuid` como parametro query para operaciones multiempresa. Se enviara en el body, como indico MATÍAS, y tambien como query hasta validar el comportamiento exacto del endpoint. El UUID de la subcuenta de prueba ya esta registrado en la seccion de alta. |
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

### Incidente resuelto: alta de cuenta/subcuenta Sandbox

Inicialmente, al abrir el registro, el portal mostró `En sandbox no se pueden
crear cuentas`. El usuario luego pudo autenticarse en Sandbox y MATÍAS aclaró el
2026-11-04 que el flujo oficial para esta cuenta Casa de Software es crear
subcuentas desde el menú **Clientes**. No usar `POST /register` para crear una
subcuenta; ese endpoint crea cuentas principales.

La cuenta principal Sandbox ya existe y la subcuenta se creó desde el menú
**Clientes**. Su `client_uuid` quedó registrado en la sección de alta; falta
configurarlo en la empresa sintetica de Kinventory y verificar la conexion.

### Actualizacion: metadatos de token recibidos

El 2026-10-28 el usuario compartio la pantalla de detalles de un token:

| Campo | Valor informado |
|---|---|
| Nombre | `Login - soporte.disovi@kinventoryservices.com` |
| Estado | Activo |
| Creacion | 2026-10-28 12:28 |
| Expiracion | 2027-01-26 12:28 |
| Duracion | 90 dias |
| Ultimo uso mostrado | 2026-10-28 12:41 |
| Zona horaria de la pantalla | No confirmada |
| Entorno de origen | Sandbox; usuario confirmo `https://sandbox-auth.matias-api.com/` |
| Valor secreto del token | No recibido; no compartir por chat ni registrar aqui |

Se recibio un identificador de token, no el valor secreto para autenticacion.
El nombre `Login - ...` sugiere un token de sesion; no confirma que se haya
generado un PAT dedicado a Kinventory. El usuario confirmo acceso autenticado al
portal Sandbox; el aviso de registro anterior queda como antecedente y no impide
continuar con esta cuenta existente. Crear el PAT de integracion en el dashboard
Sandbox y pegarlo directamente en Kinventory, sin incluirlo en este documento.

### Actualizacion de cuenta y PAT (2026-10-31)

El usuario informo que genero un token de acceso personal con nombre
`kinventory` para continuar las pruebas de Sandbox. El secreto fue compartido
en el chat: tratar ese PAT como expuesto, revocarlo desde MATÍAS y generar un
reemplazo. No se copio el secreto a este archivo ni se utilizo para pruebas.
No inferir que esta activo o que tiene permisos suficientes sin validacion del
proveedor.

La captura compartida corresponde al paso de revision del registro, no acredita
por si sola que el alta se haya completado:

| Campo | Dato informado / estado |
|---|---|
| Nombre o razon social | DISOVI SOFT SERVICES |
| Nombre comercial | KINVENTORY |
| Tipo de documento | NIT; numero y DV no reproducidos en este manual |
| Tipo de contribuyente | Persona Juridica |
| Regimen contable mostrado | No responsable de IVA |
| Responsabilidad mostrada | R-99-PN - No aplica - Otros |
| Contacto y acceso | Datos personales de la captura no reproducidos aqui |
| Relacion con la empresa sintetica de AWS | Cuenta principal Casa de Software; subcuenta sintetica creada en Sandbox. Falta vincularla en Kinventory. |

Estos datos no sustituyen los de KORE PRUEBAS MATIAS SOPORTE SAS de la seccion 1.
La cuenta principal de acceso al proveedor y la subcuenta emisora son conceptos
distintos. La subcuenta y su `client_uuid` ya se confirmaron en la captura del
2026-11-04. Los campos tributarios de la cuenta principal deben validarse con
MATÍAS; no constituyen una certificacion fiscal.

El usuario confirmo que dispone de otro token, sin compartir su secreto. Aun
falta confirmar la revocacion del PAT expuesto y que el reemplazo este guardado
en Kinventory Sandbox. No conoce el ID de la empresa sintetica de AWS.

Pendientes inmediatos:

1. Revocar el PAT expuesto y generar otro exclusivo de Sandbox. Pegar el
   reemplazo solo en el campo seguro de Kinventory; no compartirlo en el chat.
2. Identificar en Kinventory la empresa sintetica de AWS y registrar su ID
   interno para trazabilidad.
3. Configurar el `client_uuid` ya creado en esa empresa, con entorno Sandbox.
4. Guardar y probar conexion en Kinventory. No emitir hasta validar el payload,
   la identidad del emisor y la resolucion de prueba.

### Captura del panel Sandbox: software y habilitacion DIAN (2026-11-04)

La captura muestra el panel MATÍAS rotulado como entorno Sandbox, en Ajustes >
Software, con `FACTURACIÓN` seleccionado. Observaciones registradas sin copiar
la clave técnica:

- Aparecen cuatro tipos de software: Facturacion, Nomina, Documento Soporte y
  D.E. P.O.S. Electronico.
- Para Facturacion se ve PIN `00000`, folio inicial `1`, ambiente de operacion
  `DESCONOCIDO` e identificacion del software vacia.
- La habilitacion ante DIAN figura como `En habilitación`, pero el panel avisa
  que no se puede iniciar/finalizar la habilitacion ni consultar/sincronizar
  resoluciones DIAN en Sandbox. Indica que esas acciones deben hacerse desde
  Produccion.
- El panel deja consultar normalmente los datos del software. La clave tecnica
  aparece parcialmente enmascarada; no transcribirla ni compartirla.

Esta pantalla no demuestra que la conexion API de Kinventory este configurada.
El `client_uuid` aparece en la ficha del cliente, documentada arriba. Tampoco es necesario
completar la habilitacion DIAN en Sandbox para probar la API. No cambiar a
Produccion ni iniciar habilitacion real para avanzar con la prueba.

Para Sandbox, seguir usando la resolucion/rango de prueba autogestionados que
MATÍAS indico. Si el panel no permite crearla manualmente desde Resoluciones/
Numeraciones, pedir a MATÍAS la ruta exacta o confirmacion de que la emision
Sandbox puede usar el PIN/folio mostrado. No pulsar consultar/sincronizar
resoluciones DIAN en este entorno.

**Faltantes para avanzar desde esta pantalla:**

1. Confirmar que el PAT nuevo es dedicado a Sandbox y que el token anterior
   compartido por chat fue revocado. Pegar el secreto nuevo directamente en
   Kinventory, no aqui.
2. En Kinventory, seleccionar la empresa sintética AWS, entorno Sandbox,
   guardar PAT y `client_uuid`, y probar conexión.
3. Confirmar que la resolucion FEV observada (prefijo `FEV`, rango 1-1000,
   siguiente 1) es la que debe usar esta cuenta de prueba.
4. Validar el payload de factura antes de la primera emisión controlada.

### Aclaracion: crear subcuenta desde Casa de Software

MATÍAS confirmó que el menu **Clientes** de la cuenta principal es el flujo
oficial para crear la subcuenta. La documentacion tecnica tambien expone este
flujo como `POST /company/{uuid}/customer`; no es necesario usar manualmente la
API si el formulario del portal realiza el alta.

La documentacion oficial de MATÍAS diferencia ambos conceptos y define las
subcuentas de Casa de Software como clientes creados mediante el portal o API:

1. Con el PAT de la cuenta principal Casa de Software, llamar
   `GET /company` para obtener el `uuid` de la empresa principal.
2. Crear la subcuenta con `POST /company/{uuid_principal}/customer`. El
   `{uuid_principal}` de la ruta es el UUID de la empresa desarrolladora, no el
   UUID de un cliente.
3. Enviar los datos requeridos de la empresa y un usuario administrador:
   `first_name`, `last_name`, `company_name`, `email`, `password`,
   `password_confirmation` y `dni` (NIT solo digitos, sin DV, puntos ni guion).
   MATÍAS indica valores predeterminados para algunos catalogos, pero validar
   los datos fiscales y NIT de prueba aceptables antes de crearla.
4. La respuesta incluye `dataRecords.uuid`; ese UUID de cliente es el
   `client_uuid` para las operaciones de API. No usar `dataRecords.id`
   numerico.
5. Verificarla con `GET /company/customers` y guardar el UUID en la conexion
   Sandbox de la empresa sintetica AWS correspondiente.

La guia indica que la creacion es con el token de Casa de Software, crea una
relacion activa, un usuario `CLIENT` y una suscripcion FREE en Sandbox; la
creacion no envia correo de verificacion ni crea cuotas. La contrasena del
usuario cliente debe establecerse y compartirse con el responsable por un
canal seguro, nunca en este documento. No ejecutar el POST hasta validar que
el registro no exista ya, para evitar duplicados.

Fuente: [Gestion de clientes de Casa de Software](https://docs.matias-api.com/docs/endpoints/company#gestion-de-clientes-casa-de-software).

### Revision de documentacion publica

Revision realizada el 2026-10-28: se localizaron la guia de introduccion,
Quickstart Sandbox, autenticacion y una coleccion Postman publica. La guia
indica que Swagger UI requiere servicio activo. Revisar los ejemplos despues de
crear/vincular la subcuenta y comparar cualquier diferencia con la indicacion
directa de MATÍAS, en especial el envio de `client_uuid`.

- [Introduccion y URL base](https://docs.matias-api.com/docs/intro/)
- [Quickstart Sandbox](https://docs.matias-api.com/docs/sandbox/quickstart.md)
- [Autenticacion y PAT](https://docs.matias-api.com/docs/endpoints/intro-auth#personal-access-tokens)
- [Casa de Software y client_uuid](https://docs.matias-api.com/docs/endpoints/company#clientes-casa-software)
- [Coleccion Postman MATÍAS](https://documenter.getpostman.com/view/8699065/2s9YyvBLby)

Al 2026-11-04 el `client_uuid` de la subcuenta sintetica esta confirmado en la
captura anterior. No se han confirmado Software ID ni TestSetId. El PAT
compartido en el chat requiere revocacion y reemplazo; nunca guardar PAT,
contrasenas, certificados o llaves privadas en este documento.

### Pendientes para continuar

**Pendientes para la prueba real en Sandbox:**

- Confirmar que el PAT nuevo es exclusivo de Sandbox y que el PAT expuesto en
  el chat fue revocado; guardar el secreto nuevo solo en el campo seguro de
  Kinventory, nunca en este archivo o logs.
- Identificar la empresa sintetica AWS y asociarle el `client_uuid`
  `486470ef-d897-11f1-a807-d843ae899220`.
- Guardar y probar la conexion Sandbox en Kinventory; MATÍAS indico que
  `client_uuid` es obligatorio en el body de cada POST JSON.
- Confirmar en la cuenta o con soporte si la misma operacion requiere tambien
  el parametro query `client_uuid`, descrito por la guia generica de Casa de
  Software.
- El certificado y la habilitacion DIAN no son requisitos para Sandbox, segun
  confirmacion directa de MATÍAS; mantenerlos fuera del alcance de esta prueba.
- Validar que la resolucion FEV activa observada y sus fechas/rango corresponden
  a la emision Sandbox prevista. No llamar sincronizacion DIAN.

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

- **Conexion Sandbox probada (2026-11-05 20:45 UTC):** empresa Kinventory AWS
  `id 33` (KORE PRUEBAS MATIAS SOPORTE), entorno Sandbox, URL
  `https://sandbox-api.matias-api.com/api/ubl2.1`, `client_uuid` configurado y
  PAT cifrado. `GET /auth/user` respondio correctamente: estado `configurado`,
  sin error. Los campos "ID o referencia Matias" e "ID de token" son solo de
  referencia interna (no se envian a MATÍAS).
- **Correccion desplegada (commit `5f80ce7`):** la empresa 33 no tenia filas en
  `matias_servicios` (creada despues de la migracion Fase 1), por lo que activar
  un servicio no tenia efecto. Ahora el catalogo se crea al abrir la pestaña o
  activar un servicio y la lista se filtra por entorno.
- **Preparacion verificada (2026-11-05, despues de la venta POS):**
  - Empresa 33: NIT actualizado a `900999002-7`, resolucion `1876000001` y
    prefijo `FEV`.
  - Conexion Sandbox `configurado`; servicio `factura_electronica` activo
    en Sandbox e inactivo en Produccion.
  - Venta `id 140`, factura local `FEV-000002`, estado `pagada`.
    Subtotal: 135000.00; descuento: 0.00; IVA: 25650.00;
    retenciones: 1350.00; total neto: 159300.00.
    Pago en efectivo registrado: 170000.00 (diferencia frente al neto: 10700.00).
  - No hay documentos en `matias_documentos` para esta empresa: la factura
    del POS no acredita emision electronica en MATÍAS.
- **Correcciones del payload (2026-11-05):**
  - Eliminada la consulta a `p.codigo_unspsc`, inexistente en AWS. Se usa el
    ID interno del producto como `code` y el estandar del contribuyente
    (`type_item_identifications_id = 4`), admitido por MATIAS.
  - `FEV-000002` se normaliza a prefijo `FEV` y consecutivo `2`.
  - IVA en cada linea y agrupado por tarifa en `tax_totals`; el total calculado
    debe coincidir con el IVA registrado en la venta. No se distribuye el IVA
    global arbitrariamente ni se certifican tarifas historicas.
  - Total fiscal bruto: 160650.00 en `tax_inclusive_amount` y `payable_amount`,
    siguiendo el ejemplo oficial de factura con retenciones. El neto cobrado
    se concilia aparte: 160650.00 - 1350.00 = 159300.00.
  - `payments.value_paid`: 159300.00; efectivo recibido 170000.00 y cambio
    10700.00. Solo se permite descontar cambio de pagos en efectivo.
  - Tipo de documento, organizacion y regimen IVA del cliente mapeados a los
    IDs MATIAS. Bogota corresponde a `city_id = 149`, no a `city_name`
    (este ultimo es para extranjeros). Otras ciudades requieren un
    `customer_city_id` explicito del catalogo del proveedor.
  - La responsabilidad fiscal vacia no se inventa: se omite `tax_level_id` y
    se advierte que MATIAS documenta por defecto 5 (R-99-PN).
- **Decision del usuario sobre retenciones (2026-11-05):** no esta confirmado
  que los 1350.00 sean ReteICA al 1%. La emision debe permanecer bloqueada
  hasta verificar el desglose. No reclasificar ni modificar la venta.
  La previsualizacion muestra el IVA y los importes corregidos, con
  `ready: false`, HTTP 422 y el motivo de bloqueo; no es un JSON listo para
  enviar mientras falte esa confirmacion.
- **Previsualizacion sin efectos fiscales:**
  `POST /api/matias/33/ventas/140/previsualizar-sandbox` con body `{}`.
  Usa la misma validacion y constructor de JSON que `emitir-sandbox`, exige
  la sesion, permisos y CSRF habituales; no descifra ni devuelve el PAT,
  no llama al proveedor y no crea documentos/intentos ni modifica ventas.
  El UUID de la vista previa es provisional y no reserva un consecutivo.
  Cuando el desglose haya sido confirmado, ambos endpoints aceptan
  `withholding_taxes`: arreglo con `tax_id` (5 ReteIVA, 6 ReteRenta, 7 ReteICA),
  `tax_amount`, `taxable_amount` y `percent`. Se valida base, tarifa y suma
  contra la retencion registrada. No inferir el desglose a partir del total.
- **Alcance actual del mapeo Sandbox:** ventas pagadas de contado, productos
  por unidad, IVA 0/5/19 con conciliacion por linea, y medios de pago con
  equivalencia explicita. Descuentos de linea/globales, propinas, impuestos
  adicionales, unidades sin mapeo, ventas de credito o datos inconsistentes
  se rechazan con un mensaje explicito; no se envian aproximaciones fiscales.
- **Fuentes verificadas para este ajuste:**
  [Campos del documento](https://docs.matias-api.com/docs/billing-fields/),
  [Factura con retenciones](https://docs.matias-api.com/docs/jsons-billing/invoice-with-retentions-example/)
  y catalogos publicos Sandbox de impuestos, identificacion, regimenes,
  ciudades, identificacion de item y medios de pago.
- **Siguiente paso:** confirmar la naturaleza/base/tarifa de los 1350.00 de
  retenciones y revisar nuevamente la previsualizacion. No repetir el cobro
  ni emitir hasta entonces. Sigue pendiente confirmar la revocacion del PAT
  expuesto anteriormente.
- **Despliegue y verificacion (2026-11-05 21:18 UTC):** commit `5a82a46`
  desplegado en EC2; build TypeScript correcto y 21/21 pruebas focalizadas
  MATIAS aprobadas en local y AWS. PM2 `kore-backend` online y health correcto.
  La previsualizacion del controlador con la venta real 140 ejecuto 8 consultas
  SELECT, con escrituras y HTTP externo impedidos por el script de validacion.
  Resultado esperado: HTTP 422, `ready: false`, consecutivo `2`, IVA 25650.00,
  pago 159300.00 y cambio 10700.00; solo bloquea el desglose de retenciones.
  Documentos fiscales antes/despues: 0/0. No se modifico la venta, no se
  recalculo su cobro ni se emitio a MATIAS.
- **Emision real de prueba:** el backend desplegado en AWS tiene rutas para
  configurar, probar conexion y emitir una venta en Sandbox. Antes de emitir se
  requiere PAT, `client_uuid`, resolucion/rango de prueba y validar el payload
  oficial.
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

### Correccion de calculos del POS (2026-11-05)

El usuario autorizo corregir y desplegar los calculos, sin modificar ventas
historicas. La causa de la retencion inesperada era una regla interna:
cliente de tipo empresa => ICA del 1%. Tambien existian reglas implicitas de
retefuente y reteIVA por texto de responsabilidad o umbral de valor. No eran
requisitos de MATIAS.

Cambios:

- Eliminadas esas retenciones implicitas. Solo se calculan los impuestos
  configurados y seleccionados en el POS; el servidor vuelve a consultar su
  configuracion activa dentro de la empresa. No se infiere la obligacion
  tributaria del cliente por ser persona juridica.
- Una calculadora compartida entre navegador y backend trabaja en centavos
  enteros, con redondeo de mitad hacia arriba. Admite cantidades de hasta tres
  decimales, precios/importes de dos, IVA cero, exento/excluido, IVA incluido,
  descuentos por linea y distribucion proporcional del descuento global.
- La propina conserva la convencion anterior: porcentaje sobre el subtotal
  antes del descuento global y sin IVA. No es un cambio de politica fiscal.
- El servidor recalcula subtotal, IVA, adicionales, retenciones, propina y
  total. Si el total mostrado no coincide, rechaza antes de numerar/cobrar y
  pide actualizar el POS. No sustituye silenciosamente un importe cobrado.
- Los pagos deben cubrir el neto; el excedente solo puede salir del efectivo.
  Se conservan tarjeta/transferencia y se registran pagos netos, sin guardar
  el cambio como ingreso. El credito sin abono crea la cuenta por cobrar;
  los abonos se registran por cartera, no como efectivo ficticio en el POS.
- Numeracion, venta, detalles, stock, impuestos, pagos y cartera se confirman
  en una sola transaccion. Un fallo revierte tambien el consecutivo.
- El resumen y cierre de turno separan los pagos mixtos, descuentan el cambio
  de registros antiguos y no cuentan credito como ingreso de efectivo.
  Los registros antiguos pagados sin filas de pago usan su metodo guardado;
  un pago historico incoherente bloquea el cierre con identificacion de venta.
- El cierre de cuenta abierta bloquea la cuenta, comprueba los importes
  registrados, incluye la propina, exige pagos y total mostrado explicitos y
  guarda venta/detalles/pagos/cierre atomicamente. El detalle conserva la base
  sin IVA, no el total con IVA. Usa la numeracion de la empresa.
  Agregar/editar/eliminar items actualiza stock y cabecera en la misma
  transaccion y no permite modificar una cuenta que ya se cerro.
- Historial, exportacion y reimpresion respetan el total guardado, incluso si
  existen retenciones historicas. La interfaz muestra hasta dos decimales.

Compatibilidad: actualizar el POS tras el despliegue. Los consumidores del
cierre de cuenta deben enviar `total` junto a `pagos`. No se reconstruyen ni
se corrigen cuentas o documentos historicos automaticamente. Una diferencia
entre la cuenta almacenada y ajustes locales de propina/descuento/impuestos
detiene el cobro hasta revisar/guardar los datos compatibles de la cuenta.
La calculadora no certifica por si sola la procedencia fiscal de una retencion;
esa parametrizacion requiere revision del responsable contable.

Validacion local: build TypeScript y 116/116 pruebas aprobadas, incluidas 31
pruebas nuevas de calculo, persistencia, rollback, cuentas abiertas, caja e
impresion. Uno de esos casos recorre 500 carritos.
Se validaron tambien sintaxis JavaScript y diferencias sin errores de formato.

Despliegue verificado en AWS (2026-11-05 21:47 UTC): correccion `31a91ce` y
ajuste de compatibilidad de pruebas Node 22 `dfd3cf2`. La suite completa paso
116/116 en EC2 antes del reinicio; PM2 `kore-backend` quedo online y se guardo
su estado. Health local `localhost:3000/health` correcto. Los cuatro scripts
publicos del POS/historial coinciden por SHA-256 con los archivos desplegados
en `https://kinventoryservices.com`; el HTML carga las versiones nuevas.
La API de ventas sin sesion sigue respondiendo 401.
La comprobacion funcional en AWS uso solo la calculadora y consultas SELECT:
total nuevo 160650.00, retenciones cero, cambio 9350.00; venta 140 intacta y
cero documentos MATIAS de la empresa 33. No se crearon ventas ni se emitio.

Consulta AWS exclusivamente de lectura para preparar revision historica:

| Empresa interna | Ventas con retenciones sin desglose conciliable | Retenciones registradas |
|---|---:|---:|
| 32 | 3 | 34200.00 |
| 33 (sintetica) | 1 | 1350.00 |

Estos cuatro registros requieren revision individual; el agregado no demuestra
que todas las retenciones sean improcedentes. No se modificaron.

La venta 140 / `FEV-000002` sigue con neto 159300.00 y retencion 1350.00.
Su emision MATIAS permanece bloqueada. Para una venta nueva con la misma
base 135000.00 e IVA 25650.00, sin retenciones aplicables, el calculo probado
es total 160650.00 y cambio 9350.00 al recibir 170000.00.
No volver a cobrar la venta 140 ni emitirla como si se hubiera corregido.

### Nueva prueba POS FEV-000003 (2026-11-05)

El usuario confirmo que repitio la prueba. Verificacion AWS de solo lectura:

| Campo | Resultado registrado |
|---|---:|
| Empresa interna / venta | 33 / 141 |
| Factura local | FEV-000003 |
| Estado / forma / medio | pagada / contado / efectivo |
| Subtotal | 135000.00 |
| Descuento | 0.00 |
| IVA | 25650.00 |
| Retenciones | 0.00 |
| Adicionales / propina | 0.00 / 0.00 |
| Total | 160650.00 |
| Pago neto registrado | 160650.00 |

Detalle: producto interno 1944, cantidad 1.000, precio/base 135000.00.
Sin filas de impuestos adicionales o retenciones. El pago concilia exactamente
con el total. El importe entregado originalmente y el cambio no se pueden
reconstruir del pago neto guardado; no se afirma que se recibieran 170000.00
en esta nueva prueba.

Previsualizacion local MATIAS sobre venta 141: HTTP 200, `ready: true`,
`blockingErrors: []`, prefijo FEV, consecutivo 3, IVA 25650.00 sobre 135000.00,
total fiscal y pago 160650.00, medio efectivo. Se ejecuto el controlador
desplegado con SQL no SELECT y solicitudes HTTP salientes bloqueados:
6 SELECT, sin escrituras ni envio al proveedor.

Advertencias antes de emitir: la responsabilidad fiscal del cliente esta vacia;
se omite `tax_level_id` y MATIAS documenta por defecto 5 (R-99-PN). Confirmar
que corresponde al cliente sintetico antes de emitir. El contraste de IVA usa
las tarifas actuales de productos y no constituye certificacion tributaria.
En esa primera verificacion la empresa 33 tenia cero documentos MATIAS. Esta factura era una venta
POS validada y previsualizada, no un documento electronico emitido o aceptado.
La venta 140 / FEV-000002 permanece intacta y bloqueada por separado.

### Continuacion Sandbox y primer envio FEV-000003 (2026-11-05)

El usuario actualizo la responsabilidad fiscal del cliente a
`R-99-PN — No aplica/Otros.` y autorizo continuar la prueba.

- La primera validacion detecto que el campo libre contenia codigo y
  descripcion, no solo el codigo. Se corrigio el lector para aceptar un codigo
  conocido seguido de su etiqueta (sin inferirlo desde texto libre ni cambiar
  la ficha). Commit `a70ceab`, 22/22 pruebas MATIAS en local/AWS.
- Nueva previsualizacion: HTTP 200, `ready: true`, `tax_level_id: 5`; sin
  advertencia de responsabilidad vacia. Persiste la advertencia informativa
  de contraste de IVA con tarifas actuales.
- Se ejecuto **un solo POST** al endpoint oficial Sandbox `/invoice`, con
  destino/subcuenta controlados y bloqueo de un segundo POST en el script.
  No se creo otra venta ni se repitio el cobro.
- MATIAS respondio **HTTP 422**:
  `El campo type_document_id no existe en la tabla accounting_documents`.
  El conector enviaba `type_document_id: 1`; el catalogo real de MATIAS usa
  **ID 7** para factura electronica, con codigo DIAN `01`. No son el mismo
  identificador.
- Registro local fiscal `id 1`, venta 141, numero fiscal `FEV3`, un intento,
  estado conservador `unknown`, sin CUFE ni UUID del proveedor. El HTTP 422
  es un fallo de validacion API, no una confirmacion de rechazo DIAN.
  El payload original y su tipo 1 permanecen como evidencia, sin sobrescribir.
- Se consulto por GET `/documents/{request_uuid}` en la misma subcuenta:
  HTTP 200, `success: true`, **`dataRecord: null`**. La consulta no encontro
  documento para ese UUID; no equivale por si sola a una autorizacion para
  reenviar ni demuestra que el numero este libre por otras referencias.
- Se corrigio el mapeo para futuros envios a `type_document_id: 7` y la
  persistencia toma el tipo/operacion del payload real. Commit `315f926`,
  build y 22/22 pruebas focalizadas en local/AWS; PM2 online y health correcto
  a las 22:10 UTC.
- No se realizo un segundo envio. El bloqueo de duplicados sigue activo para
  venta 141, y no se cambio manualmente su estado ni se elimino el intento.
  **Pendiente:** conciliar en el portal MATIAS por subcuenta, prefijo FEV,
  consecutivo 3 y UUID de solicitud; despues definir un reintento controlado
  y auditable sobre la misma venta, conservando el intento inicial.
- Venta 141 intacta: pagada, total 160650.00, retenciones 0.00. La venta 140
  tambien sigue sin modificaciones. No hay confirmacion de factura aceptada.

Fuentes verificadas para el mapeo:
[catalogo Sandbox de tipos](https://sandbox-api.matias-api.com/api/ubl2.1/document-type)
y [referencia de campos MATIAS](https://docs.matias-api.com/docs/billing-fields/).

### Recuperacion autorizada de FEV-000003 (2026-11-05)

El usuario confirmo que el portal sin documentos corresponde a la subcuenta
KORE PRUEBAS MATIAS SOPORTE SAS, NIT 900999002, en Sandbox, y autorizo
preparar/ejecutar un reintento controlado sin repetir cobro o inventario.

La ruta de emision Sandbox acepta recuperacion unicamente con
`retry_validation_document_id` y `portal_absence_confirmed: true`, si existe
exactamente un documento previo: tipo erroneo 1, estado unknown, un intento
HTTP 422 y el mensaje exacto de validacion de tipo, sin CUFE ni UUID proveedor.
No se habilitan reintentos generales de timeout, rechazo DIAN ni documentos
ya emitidos. Se consulta de nuevo el UUID anterior al proveedor y solo se
continua ante HTTP 200 / success true / dataRecord null.

La recuperacion conserva el documento/solicitud/payload/intento original y
crea una solicitud tipo 7 con UUID nuevo, enlazada al anterior mediante
auditoria. La restriccion unica de BD impide dos solicitudes tipo 7 concurrentes;
si ya hay una solicitud nueva, se bloquea otro envio. Las consultas de estado
seleccionan el registro mas reciente. Sin cambios de esquema.

Despliegue `3b41910` verificado a las 22:22 UTC: 119/119 pruebas en AWS,
build correcto, PM2 online y health correcto. El usuario autorizo el reintento
tras confirmar la ausencia en el portal de la subcuenta.

Resultado de la ejecucion:

- GET previo al proveedor: ausencia confirmada para UUID original.
- Un solo POST nuevo, con tipo 7. MATIAS respondio **HTTP 400**:
  `La resolucion de facturacion: 1876000001, no existe. Empresa KORE PRUEBAS MATIAS SOPORTE SAS-900999002`
  (texto normalizado sin acentos en este resumen).
- Documento local nuevo `id 2`, venta 141, tipo 7, numero `FEV3`, estado
  conservador `unknown`, un intento. Sin CUFE, UUID proveedor ni estado DIAN.
- Documento original `id 1` intacto: se compararon id, estado, UUID y hash
  antes/despues. El nuevo registro queda relacionado por auditoria.
- Venta 141 intacta: total 160650.00, retenciones 0.00, pagada.
- No se hizo otro POST ni se cambio la resolucion. El mecanismo de recuperacion
  de tipo erroneo no permite recuperar este nuevo fallo de resolucion.
- **Bloqueo actual:** confirmar/copiar desde Resoluciones/Numeraciones de
  la subcuenta Sandbox el numero real, prefijo FEV, tipo factura electronica,
  rango y vigencia. El dato 1876000001 previamente documentado no esta
  reconocido por la API para esta empresa. No crear otra venta ni asumir que
  el error es de impuestos, cobro o numeracion local.

### Consumidor final y documento equivalente electronico POS

Que el comprador diga que no desea factura electronica a su nombre no significa
que la venta pueda quedar sin soporte fiscal ni que no se reporte a la DIAN.
Un comercio puede usar documento equivalente electronico POS cuando corresponde,
o factura electronica de venta, segun su operacion y obligaciones.
El registro generico interno de Kinventory no sustituye ninguno de ellos.

La DIAN contempla consumidor final y el identificador `222222222222` cuando el
adquirente no suministra sus datos; no es un NIT real a inventar o reutilizar
como empresa. Para soportar impuestos descontables, costos/deducciones del
comprador se debe cumplir la identificacion y los demas requisitos aplicables.
El POS electronico identificado tambien puede dar ese soporte: no es un
beneficio exclusivo de la factura electronica de venta.

Para Kinventory son dos integraciones fiscales diferentes: factura de venta
MATIAS tipo 7 y equivalente POS tipo 20. Esta prueba implementa y valida la
primera, no certifica que el equivalente POS ya este integrado. La decision
de no pedir factura nominativa nunca debe convertirse en una opcion de
omitir obligaciones fiscales. Confirmar el flujo de produccion con el
responsable contable.

Fuentes oficiales:
[DIAN: documento equivalente electronico](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documento-equivalente-electronico/),
[DIAN: soporte tributario del POS identificado](https://www.dian.gov.co/Prensa/Paginas/NG-Comunicado-de-prensa-009-22-01-2024.aspx)
y [doctrina DIAN sobre consumidor final, Oficio 903747 de 2022](https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_903747_2022.htm).

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

### Datos de acceso Sandbox: estado actual

- Cuenta principal Casa de Software y subcuenta emisora creadas.
- `client_uuid` de la subcuenta sintetica: ver la ficha registrada en la seccion
  de alta anterior; falta asociarlo a la empresa sintetica de Kinventory.
- PAT: usar un token de reemplazo si el anterior compartido por chat no ha sido
  revocado. No pegar secretos en este documento, Git, chats o logs.

La relacion entre Kinventory y MATÍAS sigue pendiente de prueba de conexion.

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

## 5. Preparacion tecnica Fase 1 (estado)

Las migraciones Fase 1 y Fase 2 ya estaban aplicadas en la base autorizada de
AWS y fueron verificadas; no se requiere volver a ejecutarlas. El backend se
desplegó y la ruta de salud respondió correctamente. Para la prueba que falta:

1. Entrar con el administrador autorizado y seleccionar la empresa sintetica.
2. Guardar la conexion **Sandbox** con el PAT de reemplazo y el `client_uuid`
   ya registrado. No configurar Produccion.
3. Probar conexion y confirmar el resultado en la interfaz.
4. Activar solo `factura_electronica` para Sandbox, si aun no esta activo.
5. Confirmar que el PAT no se devuelve al navegador ni aparece en logs.
6. No emitir todavia: primero revisar la resolucion y el payload de la venta
   sintetica seleccionada.
7. Registrar fecha, ambiente, resultado y evidencia de la prueba.

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
