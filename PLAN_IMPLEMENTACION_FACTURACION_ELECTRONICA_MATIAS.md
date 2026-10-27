# Plan de implementacion: facturacion electronica mediante Matias API

**Estado:** propuesta tecnica por fases; requiere validacion comercial y aprobacion antes de implementar.
**Enfoque:** Kinventory sera el ERP/conector. Cada empresa conserva su contrato, cuenta y pago con Matias; Matias sera el proveedor tecnologico fiscal.
**Aplicacion piloto:** empezar con facturacion de venta standard, sandbox y una empresa piloto. No iniciar produccion hasta completar pruebas y validar requisitos fiscales.

## Regla operativa de implementacion

- Implementar una fase completa por entregable, sin comentarios o explicaciones narrativas durante cada paso del codigo.
- Al finalizar cada fase, entregar un resumen breve del estado real: terminado, pendiente, bloqueado y validado.
- Documentar la fase terminada en este mismo archivo, incluyendo cambios, scripts ejecutables, scripts SQL manuales, pruebas realizadas y pendientes conocidos.
- No publicar, subir ni desplegar cambios en AWS hasta que el usuario confirme que todas las fases planeadas para una entrega han terminado.
- Las tablas nuevas o modificaciones deben entregarse como scripts SQL versionados y sin modificaciones destructivas ocultas. El usuario los ejecutara manualmente.
- No ejecutar migraciones sobre bases de datos locales, de pruebas ni de AWS desde el proceso de implementacion salvo instruccion explicita posterior.
- Cada fase debe conservar idempotencia y scripts seguros para reejecucion cuando sea posible.
- No incluir secretos, PAT, claves, contrasenas ni certificados dentro de codigo, logs, SQL ni documentacion.

## Estado de fases

| Fase | Estado | Implementacion |
|---|---|---|
| Fase 0 | Pendiente de acuerdos comerciales | No implementada |
| Fase 1 | Completada | SQL aplicado y verificado en AWS RDS; código local pendiente de deploy |
| Fase 2 | Implementada localmente | Emision sandbox, persistencia e idempotencia; pendiente SQL y prueba real |
| Fase 3 | No iniciada | Webhooks y resiliencia |
| Fase 4 | No iniciada | Servicios adicionales |
| Fase 5 | No iniciada | Produccion controlada |
| Fase 6 | No iniciada | Escala y operacion |

## 1. Resumen ejecutivo

Matias ofrece una API REST para emitir y consultar documentos electronicos ante la DIAN: factura, POS, notas, documento soporte, nomina y eventos RADIAN. La documentacion publica ofrece dos entornos separados:

- Sandbox: gratuito, con base `https://sandbox-api.matias-api.com/api/ubl2.1`.
- Produccion: URL privada entregada al contratar el servicio.

Las credenciales no son compartidas entre entornos: sandbox y produccion usan cuentas/base URLs independientes. Matias recomienda Personal Access Tokens (PAT) para integraciones servidor-a-servidor y webhooks firmados con HMAC-SHA256 para actualizar estados.

La recomendacion para Kinventory es evitar que un administrador empresarial tenga que exponer su correo o clave bancaria. La activacion debe ser una conexion mediante PAT, creada por el propietario de la cuenta Matias y entregada a Kinventory una sola vez. El secreto se cifra y no vuelve al navegador. La cuenta Matias pertenece a la empresa y conserva su membresia, consumo y configuracion fiscal.

Matias confirmo que Kinventory puede operar bajo el modelo **Casa de Software**: Kinventory mantiene una cuenta principal, crea las empresas cliente como subcuentas y usa `client_uuid` para operar sobre cada una. Cada cliente puede adquirir el paquete que requiera; Kinventory integra una vez el conector y la Casa de Software administra el consumo con cuotas o la bolsa compartida cuando corresponda.

Matias se encargara del proceso de registro de software ante la DIAN como “MATÍAS API”; las empresas clientes no deben registrar manualmente ese software. Matias tambien ofrece sandbox independiente para facturacion y certificados a traves de Maticerts.

## 2. Decisiones fundamentales

### Modelo de negocio

- Kinventory sera una **Casa de Software MATÍAS API** con una cuenta principal propia.
- Cada empresa Kinventory sera una subcuenta Matias mediante `POST /company/{uuid}/customer`, donde `{uuid}` sera el UUID de la empresa principal Kinventory, no el de un cliente.
- Cada empresa podra contratar el paquete de Matias que necesite y pagar por su consumo.
- Kinventory podra asignar cuotas vigentes desde su cuenta principal; si una subcuenta no tiene cuota vigente, consumira la bolsa compartida de Kinventory segun las reglas Matias.
- Kinventory mantendra un registro local de servicios activos, estado tecnico, cuota, consumo y fecha de validacion.
- El estado real de contrato y cuota se consultara con los endpoints de membresias/clientes o webhooks cuando Matias los soporte.
- Los pagos y eventos reservados de Matias no se asumiran hasta que Matias confirme que estan emitidos.

### Modelo tecnico

- La cuenta principal Kinventory tendra credenciales propias y administrara subcuentas clientes con su PAT principal.
- Cada subcuenta guardara su UUID Matias (`client_uuid`), entorno, URL base, PAT asociado, ID de token, fechas y estado de salud cuando Matias exponga esos datos.
- Las operaciones fiscales de cada tenant iran acompañadas del `client_uuid` correspondiente y nunca podran operar sobre una subcuenta ajena.
- Si la empresa necesita una cuenta totalmente independiente, el modelo Casa de Software sera reemplazado solo mediante una decision comercial explicita y migracion controlada.
- Nunca se guardaran claves de acceso por defecto ni contrasenas de usuario Matias.
- Se implementara sandbox primero y una configuracion separada para produccion.
- Los webhooks tendran una URL, secreto HMAC y evento configurados por empresa cuando el modelo de cuenta lo permita. Si no, se usara consulta periodica de estado.

### Modelo fiscal

Kinventory conserva datos fiscales propios para templates y operacion POS, pero Matias sera responsable de:

- Registro de la solucion ante la DIAN como MATÍAS API para las empresas cliente Casa de Software.
- Certificado digital; Matias ofrece acceso a un certificado de firma para paquetes elegibles, sujeto al paquete contratado y a las reglas comerciales vigentes. Actualmente se informa un certificado gratuito por un año para el primer cliente/NIT registrado bajo paquetes desde 10.000 documentos por año, pero debe confirmarse por escrito antes de migrar clientes.
- Informacion de software asociada por Matias.
- Resolucion y rangos DIAN.
- Firma, XML, CUFE, PDF y respuesta DIAN.
- Numeracion y validaciones de la API, cuando se use su numeracion.
- Estado oficial y reenvios definidos por Matias.

Kinventory no debe afirmar que una factura fue aceptada solo porque la solicitud fue recibida. Solo estados `accepted`/validado por Matias o DIAN seran considerados fiscales. Los estados `created`, `emitted` y pendientes requieren seguimiento.

## 3. Alcance funcional por empresa

La pestaña **Facturacion electronica** de Configuracion General tendra como objetivo que el administrador pueda:

1. Ver si existe una conexion activa con Matias.
2. Elegir entorno Sandbox o Produccion.
3. Iniciar el asistente de activacion.
4. Crear o confirmar la subcuenta Matias de la empresa cliente mediante Casa de Software.
5. Vincular manualmente una cuenta existente solo si Matias permite esa operacion sin duplicarla.
6. Configurar servicios disponibles por bandera de activacion.
7. Probar la conexion sin emitir documentos reales.
8. Completar requisitos fiscales pendientes y abrir Matias para resolverlos.
9. Activar/desactivar servicios que Matias confirme como contratados.
10. Revocar, rotar o reemplazar el PAT.
11. Consultar consumos, errores y estados recientes sin mostrar secretos.

Servicios iniciales candidatos, sujetos al contrato Matias de cada empresa:

- Factura electronica de venta.
- POS electronico/documento equivalente.
- Nota credito.
- Nota debito.
- Documento soporte.
- Nomina electronica.
- Eventos RADIAN y recepcion.
- Envio masivo.
- Webhooks.

Cada servicio sera independiente de los demas. Activar un conector general no significa activar todos los modulos.

## 4. Flujo de activacion propuesto

### Paso 1: Estado inicial

La pantalla muestra `No configurado`, `Sandbox pendiente`, `Requiere configuracion fiscal`, `Conectado`, `Suspendido` o `Error`.

No se muestra el contenido del PAT. Solo fecha de creacion, vencimiento, entorno, ultimo uso e ID token mascarado si Matias lo entrega.

### Paso 2: Contrato y alta de subcuenta

El administrador Kinventory:

1. Verifica que la empresa tenga un contrato y paquete Matias elegible.
2. Usa la cuenta principal Casa de Software para crear la subcuenta con los datos fiscales de la empresa cliente.
3. Guarda el UUID devuelto por Matias como `matias_client_uuid`.
4. Confirma con la empresa los datos fiscales que Matias recibira y la responsabilidad sobre la numeracion/resolucion.
5. Solicita al equipo Matias la configuracion fiscal, software, certificado o sandbox correspondiente segun el paquete.
6. Si Matias entrega PAT o credencial por subcuenta, la crea/rota desde la cuenta principal y guarda solo metadatos y el secreto cifrado.

Opcionalmente, el administrador empresario debera poder abrir links oficiales para portal y soporte sin que Kinventory intercepte las credenciales de Matias. El alta inicial no debe pedir credenciales de acceso web ni contrasenas de usuarios Matias.

### Paso 3: Prueba segura

Kinventory:

- Valida formato del token.
- Consulta el perfil y empresa Matias.
- Valida entorno y URL configurados.
- Compara el NIT Kinventory con el NIT Matias antes de activar produccion.
- Consulta resoluciones, software, certificado, membresia y consumo segun endpoints disponibles.
- Ejecuta solo operaciones de lectura o sandbox durante configuracion.
- No reusa el PAT para iniciar sesion en pantalla de Matias ni lo registra en logs.

La activacion no debe emitirse hasta completar:

- Validacion del certificado digital.
- Resolucion/rango vigente, si aplica.
- Informacion de software.
- Datos fiscales minimos de la empresa.
- Resultado de una factura sandbox aceptada o simulada segun el caso.

### Paso 4: Activacion de servicios

Para cada servicio, Kinventory mostrara:

- Nombre.
- Estado en Matias: disponible, contratado, activo, vencido o desconocido si no hay API.
- Estado local: activo o inactivo.
- Pagador: cuenta propia de la empresa.
- Ultima sincronizacion.
- Boton probar, activar o desactivar.

Kinventory solo debe permitir activar un servicio si existe evidencia tecnica disponible y la empresa confirma que posee el servicio/pago correspondiente. La confirmacion se registra con usuario, fecha, ambiente y version de Matias.

### Paso 5: Produccion

El cambio Sandbox -> Produccion sera una accion separada, reversible y con confirmacion.

Requerira:

- PAT principal Casa de Software valido o credencial de subcuenta habilitada por Matias.
- URL real entregada por Matias.
- Confirmacion de NIT, razon social y resolución.
- Prueba de lectura exitosa.
- Permiso fiscal del usuario administrador.
- Feature flag de empresa piloto.

## 5. Arquitectura backend propuesta

### Tablas nuevas

- `matias_conexiones`
  - `empresa_id`, `entorno`, `base_url`, `matias_company_uuid`, `matias_company_id`, `nit`, `estado`, `token_id`, `pat_cifrado`, `expires_at`, `ultimo_uso`, `ultimo_error`, `created_by`, `updated_by`, `disabled_at`.
- `matias_servicios`
  - `empresa_id`, `codigo`, `nombre`, `contratado`, `activo_local`, `activo_proveedor`, `ultima_verificacion`, `datos_publicos`, `version_api`.
- `matias_documentos`
  - `empresa_id`, `venta_id`/documento local, `tipo_documento`, `numero`, `uuid_externo`, `track_id`, `cufe`, `estado`, `estado_dian`, `environment`, `request_id`, `response_hash`, `xml_path`, `pdf_path`, `error_code`, `created_at`, `updated_at`.
- `matias_webhooks`
  - `empresa_id`, `environment`, `matias_webhook_id`, `url`, `secret_cifrado`, `eventos`, `activo`, `ultimo_evento_at`.
- `matias_eventos`
  - `empresa_id`, `provider_event_id`, `event_type`, `documento_id`, `payload_hash`, `signature_valid`, `processed_at`.
- `matias_auditoria`
  - actor, empresa, accion, antes, despues, entorno, IP, resultado, referencia, sin incluir tokens ni payload completo.

Las tablas deben llevar claves compuestas y filtros de `empresa_id` en todo endpoint. No se permitira operar sobre otra empresa aun si se conoce el ID interno.

### Cliente de proveedor

Crear `backend/src/platform/matias/` con:

- `matias.client.ts`: HTTP timeout, retries, headers, no logging de Authorization.
- `matias.service.ts`: consulta de perfil/empresa, miembros, resoluciones, software, certificado y documentos disponibles.
- `matias.mapper.ts`: traduce payloads Kinventory -> Matias y respuestas Matias -> modelo local.
- `matias.webhooks.controller.ts`: raw body, HMAC, timestamp/idempotencia, cola y respuesta rapida.
- `matias-document-state.service.ts`: maquina de estados y sincronizacion de estados DIAN.
- `matias.routes.ts`: configuracion, servicios, prueba, emitir y consultar.

No se debe reutilizar la clase de configuracion visual `configuracion_factura` como lugar de credenciales.

### Seguridad de tokens

- PAT cifrado en reposo con AES-GCM/KMS secreto fuera de Git.
- El PAT nunca debe ir al frontend despues de guardar.
- El backend debe almacenar solo hash/identificador y metadatos, no nombre completo ni credencial secundaria.
- Rotacion manual sin borrar el historico de documentos.
- Revocacion elimina el secreto del uso inmediato y marca la conexion suspendida.
- Sanitizar logs, cuerpos de error y excepciones HTTP.
- Redactar URL firmada, XML, CUFE sensible y Authorization.
- Alertar vencimiento de tokens antes de la fecha de expiracion configurada.

### Idempotencia fiscal

Toda emisión local llevara una clave interna estable enviada o registrada como referencia del proveedor si Matias la admite. Reintentos backend:

- Consultan primero el documento local por venta/operacion.
- Consultan estado externo si existe track ID/CUFE.
- Nunca reenvian una factura con el mismo numero y intentan crear otro documento.
- Usan transaccion para actualizar documento externo y venta local.

### Estados locales

`NOT_CONFIGURED -> SANDBOX_TESTING -> CONFIGURED -> READY_FOR_PRODUCTION -> ACTIVE`, mas estados técnicos `SUSPENDED`, `TOKEN_EXPIRED`, `PROVIDER_ERROR`, `REVOKED`.

Estados de documento:

`DRAFT -> CREATED -> EMITTING -> EMITTED -> ACCEPTED` o `REJECTED` o `VOIDED`; incluir `UNKNOWN` ante timeout. Corregir y reemitir nunca debe destruir el documento original ni su auditoria.

## 6. Cambios en frontend

Se agregara una pestaña **Facturacion electronica** a [frontend/public/configuracion-general.html](frontend/public/configuracion-general.html#L361), separada de la plantilla PDF actual.

Componentes previstos:

- Selector entorno Sandbox/Produccion.
- Estado de conexion y prueba.
- Boton “Activar conector”.
- Asistente por pasos.
- Catalogo de servicios con toggles de activacion.
- Estado de contrato/local Matias y ultimo chequeo.
- Campos NIT, cuenta Matias, URL de produccion solo si corresponde y PAT de entrada.
- Barra de consumo documental y cuota sin mostrar datos del tercero si la API no los entrega.
- Acciones: probar, guardar, rotar token, suspender, revocar.
- Modal para confirmar cambio a produccion.
- Lista de documentos enviados y errores recientes.

Permisos recomendados:

- `facturacion.configurar`: ver/editar configuración fiscal del conector.
- `facturacion.activar`: cambiar entorno, activar servicios o revocar.
- `facturacion.emitir`: crear/enviar documentos electronicos.
- `facturacion.consultar_estado`: consultar/ver estados y webhooks.

En base a la arquitectura de permisos existente, todas las operaciones deben comprobar `empresa_id` y pertenencia al tenant.

## 7. Integracion con ventas

La venta POS/mayorista actual continuara siendo la fuente contable y operacional. Por defecto, el flujo sera factura POS/documento equivalente u otro documento local segun la parametrizacion; la factura electronica sera opt-in por venta.

### Toggle de facturacion electronica en POS

- Cada venta tendra un control visible **Facturar electronicamente** apagado por defecto.
- El cajero solo podra encenderlo si la empresa tiene el conector Matias activo, la subcuenta esta habilitada y el servicio de factura electronica esta disponible.
- El toggle sera una decision por venta. Guardar una configuracion como predeterminada no debera activarse silenciosamente para todos los clientes.
- Al apagarlo o vender sin identificacion, Kinventory continuara con el documento equivalente/ticket permitido por su configuracion fiscal actual.
- Al activarlo, el POS exige datos fiscales suficientes antes de confirmar la venta:
  - Tipo de documento.
  - Numero/NIT sin DV y DV separado cuando aplique.
  - Nombre o razon social.
  - Email.
  - Direccion y ciudad.
  - Tipo de persona y regimen fiscal cuando Matias los requiera.
- Si el cajero ingresa un documento y el cliente no existe, se mostrara un panel de creacion rapida sin abandonar el POS.
- Si el cliente ya existe, el POS precargara todos los datos conocidos y permitira corregirlos para esa venta.
- Los datos fiscales recolectados para facturacion se guardaran tambien en el cliente, evitando capturar dos veces para ventas futuras.
- La creacion rapida respetara permisos; si el usuario solo puede vender, podra seleccionar o crear el cliente segun una politica explicitamente habilitada.
- Nunca se usara el nombre del cliente de una venta anterior como identidad fiscal sin documentarse y confirmar el cambio.
- Las cantidades, productos, impuestos, total y datos fiscales se validaran antes de enviar el documento a Matias.

Solo al confirmar la facturacion electronica:

1. Se valida nivel fiscal y estado de conexion activa.
2. Se bloquea cambios esenciales de la venta durante la emision.
3. Se arma payload Matias desde ventas, cliente, impuestos y resolucion.
4. Se persiste una solicitud local en estado `CREATED` antes de llamar a Matias.
5. Se llama `POST /invoice`, `/pos` u otro endpoint segun tipo.
6. Se guarda respuesta, track ID/CUFE/UUID.
7. Se registra el PDF/XML recibido o las rutas devueltas por Matias.
8. El webhook o consulta posterior actualiza estado.

No se deben eliminar ni reconstruir documentos fiscales existentes cuando cambie la configuracion visual o el conector. Los documentos previos conservaran su proveedor, entorno, payload y respuesta.

## 8. Webhooks

Implementar recepcion robusta:

- Registrar una URL publica HTTPS por entorno y empresa.
- Suscribir solo eventos activos relevantes: documentos, correos y lotes masivos inicialmente.
- Validar HMAC-SHA256 sobre bytes raw y secretos por empresa.
- Rechazar eventos con firma invalida.
- Guardar `X-Webhook-Id` y descartar duplicados.
- Responder rapido, menor de 5 segundos, y procesar via cola.
- Actualizar estados locales por documento/track ID.
- Implementar fallback de consulta para webhooks ausentes o fallidos.
- Permitir probar webhook desde el admin y reintentar entregas.
- No depender de eventos `payment.*`, `quota.*` o `token.*`, que la documentacion los marca reservados/no emitidos.

## 9. Costos y cuotas

Kinventory registrara consumo solo cuando Matias lo entregue de forma fiable para la subcuenta cliente:

- Documentos consumidos por cliente o por bolsa compartida.
- Cuota asignada, vigencia y periodo.
- Limite y saldo de la cuenta principal cuando Matias permita consultarlos.
- Fechas de membresia y vencimiento.
- XML/almacenamiento si el endpoint lo informa.
- Estado expirado/sin cupo.
- Fecha de ultima consulta.

Bajo el modelo Casa de Software, Kinventory podra vender/administrar internamente paquetes ERP separados del servicio Matias solo si existe un acuerdo comercial. En el MVP, la compra fiscal debe ocurrir directamente con Matias y el cliente debe poder consultar su propio consumo.

Kinventory puede mostrar advertencias, bloquear nuevas emisiones y ofrecer enlace para contratar o recargar, pero nunca asumira que el cobro en Kinventory pago la bolsa Matias. Cuando exista asignacion de cuota, esta se confirmara por el endpoint Matias antes de activar el servicio fiscal en produccion.

## 10. Plan por fases

### Fase 0: Aprobacion y acuerdos comerciales

**Estado:** pendiente de acuerdos comerciales.

Objetivo: confirmar modelo contractual y alcance inicial.

- Confirmar por escrito el alta de empresas como subcuentas Casa de Software y el uso de `client_uuid`.
- Confirmar URL de produccion y cuentas de soporte.
- Confirmar API/portal de sandbox para facturacion y Maticerts independiente para certificados.
- Confirmar limites, beneficios y vigencia de los paquetes desde 10.000 documentos por año.
- Confirmar si el certificado gratuito cubre solo el primer NIT y como manejar certificados adicionales.
- Confirmar quien administra certificados, software DIAN, resoluciones y renovaciones.
- Confirmar servicios disponibles, planes, recargas y limites.
- Confirmar facturación POS, Factura estandar, Nota y alcance piloto.
- Obtener credenciales sandbox independientes para Kinventory y empresa piloto.

Salida: alcance, modelo comercial, responsable fiscal y politica de soporte aprobados.

### Fase 2 - implementada localmente

Fecha: 2026-10-27.

Estado: implementación local completada sin emisión real ni deployment. Incluye tabla SQL manual, cliente POST `/invoice`, registro de solicitudes/intentos y endpoints protegidos para emisión/consulta sandbox.

Scripts:

- [SQL/migration_20261027_matias_fase2.sql](SQL/migration_20261027_matias_fase2.sql)

Archivos principales de Fase 2:

- [backend/src/platform/matias/matias.client.ts](backend/src/platform/matias/matias.client.ts)
- [backend/src/platform/matias/matias.controller.ts](backend/src/platform/matias/matias.controller.ts)
- [backend/src/platform/matias/matias.routes.ts](backend/src/platform/matias/matias.routes.ts)

Validaciones:

- Backend compilado con `npm run build`.
- Producción bloqueada en el endpoint de emisión; solo está disponible sandbox.

Pendientes:

- Ejecutar la migración manual en AWS.
- Deployar backend y reiniciar PM2.
- Configurar PAT sandbox y subcuenta de prueba.
- Emitir una venta sandbox real y verificar CUFE/estado.
- Repetir con timeout, rechazo, timeout y reintento sin duplicar número.

### Fase 1: Sandbox, seguridad y modelo local

**Estado:** completada; SQL verificado en AWS y código local pendiente de deploy/prueba sandbox real.

Objetivo: establecer conexion aislada sin emitir documentos reales.

- Crear migraciones de conexion, servicio, documento, webhook, evento y auditoria.
- Implementar cifrado/gestor de secretos.
- Implementar cliente HTTP Matias con sandbox y timeout.
- Crear onboarding de cuenta principal Casa de Software y acceso a cada subcuenta.
- Crear consulta segura de perfil, subcuenta y cuota.
- Crear autenticacion en endpoints con filtros tenant y validacion estricta de `client_uuid`.
- Implementar alta de subcuenta y consulta de cuota via cuenta principal.
- Implementar prueba de conexion sandbox.
- Agregar pestaña y estado inicial en configuracion.

Salida: una empresa piloto puede guardar un PAT sandbox, probarla y ver estado sin secretos.

**Entregables Fase 1:** migracion SQL manual, rutas tenant protegidas para consulta/configuracion de conexion, cifrado de PAT con clave existente de seguridad, consulta probador al sandbox cuando Matias este disponible, pestaña de configuración base y registro de auditoria.

**Validacion requerida antes de marcarla terminada:** ejecutar migracion SQL manualmente, ejecutar build del backend y revisar la pestaña sin activar emisión fiscal.

### Fase 2: Emision sandbox minima

**Estado:** implementada localmente; pendiente migración SQL manual, deploy AWS y prueba real sandbox.

Objetivo: emitir y consultar los primeros documentos de prueba.

- Mapear cliente, venta, productos, impuestos, moneda y totales al payload Matias.
- Validar datos del emisor y cliente con errores claros.
- Implementar `invoice` sandbox y consulta de estado.
- Implementar obtencion de PDF/XML.
- Persistir track ID, CUFE, respuestas y errores.
- Implementar idempotencia/reintento contra envios duplicados.
- Validar toggle POS apagado, cliente nuevo y cliente existente con toggle activado.
- Guardar datos fiscales de la captura rapida sin duplicar la entidad cliente.
- Añadir notas credito, notas debito y POS luego de estabilizar factura standard.

Salida: factura sandbox emitida y trazada con PDF/XML, rechazos simulados y estado aceptado.

**Entregables Fase 2:** migracion SQL manual para solicitudes/intentos Matias, cliente POST `/invoice`, endpoint opt-in de emision sandbox, consulta local de documento, hash de payload y bloqueo de produccion en esta fase.

**Pendientes de cierre Fase 2:** ejecutar la migracion manual en AWS, desplegar backend, configurar una subcuenta/PAT sandbox y emitir una venta de prueba sin modificar el flujo POS existente.

### Fase 3: Webhooks y resiliencia

Objetivo: reemplazar consultas manuales donde sea posible.

- Crear endpoint webhook público por entorno.
- Verificar HMAC sobre raw body.
- Idempotencia por `X-Webhook-Id`.
- Cola asincrona para document.created/emitted/accepted/rejected/voided.
- Consulta de fallback programada.
- Alertas de token vencido, error 402, rechazo DIAN y webhook fallido.
- Regeneracion de secreto y reintento manual.

Salida: un estado cambia de forma automatica una sola vez, con historial auditable y recuperacion ante caída.

### Fase 4: Servicios adicionales activables

Objetivo: convertir la conexion base en catalogo modular.

- Implementar POS electronico/documento equivalente.
- Nota credito y nota debito.
- Documento soporte si Matias lo requiere para la empresa.
- Nomina si es prioridad y los datos laborales ya existen.
- RADIAN y recepcion por empresa.
- Envio masivo.

Cada servicio tendra pruebas, campos, permisos, estados y criterios propios. No se implementaran todos en una misma entrega.

### Fase 5: Produccion controlada

Objetivo: activar la primera empresa real.

- Verificacion fiscal previa a produccion.
- Cambio de URL/PAT produccion por accion separada.
- Alta de resolucion/certificado/software desde Matias o sincronizacion.
- Prueba sin emision cuando sea suficiente.
- Emitir factura real con usuario autorizado y aprobacion.
- Monitorear primeras emisiones y conciliarlas con DIAN.
- Desactivar servicios fallidos sin borrar configuracion.

Salida: al menos una empresa real emite, recibe CUFE/XML/PDF y estado DIAN sin reenvios duplicados.

### Fase 6: Escala, operacion y cobranza

Objetivo: operar varias empresas de forma aislada.

- Limites por empresa y por plan interno.
- Cola/rate limits por tenant.
- Rotacion masiva de token con alertas.
- Historial de consumo Matias.
- Panel administrativo de conexiones.
- Metricas de aceptación, rechazo, tiempo y fallas.
- Runbooks de soporte y revocacion.
- Decision sobre Casa de Software si Matias/Kinventory acuerdan ese modelo.

## 11. Modelo de datos de una factura

La relacion debe conservar origen y destino:

```text
venta local
  -> matias_documentos.solicitud local
  -> Matias document UUID / track ID / CUFE
  -> estados Matias + DIAN
  -> rutas PDF/XML/ZIP/QR
  -> webhooks/eventos
  -> auditoria
```

La venta no debe almacenar el PAT ni el secreto HMAC. La factura fiscal y su `cufe` son datos fiscales recuperables, no secretos de autenticacion.

## 12. Pruebas exigidas

### Seguridad

- Empresa A no puede leer ni emitir con conexion o PAT de empresa B.
- Token no aparece en logs, respuestas, auditoria ni consola.
- Rotacion/revocacion detiene la emisión inmediatamente.
- PAT vencido devuelve estado y opcion de renovar.
- Webhook con firma invalida, replay o timestamp manipulado se rechaza.
- Cambio Sandbox/Produccion requiere permiso y confirmacion.
- Una venta con toggle electronico activo exige datos fiscales completos y un cliente valido.
- Una venta sin toggle no llama Matias ni crea factura electronica.
- Cliente nuevo y reutilizacion por documento tienen pruebas separadas.

### Fiscal

- No emitir sin datos fiscales minimos.
- No emitir duplicado ante reintentos.
- Rechazo DIAN visible y sin marcar venta aceptada.
- Timeout conserva estado `UNKNOWN`, luego consulta/reconciliacion.
- Nota credito enlazada al documento original.
- Anulacion no elimina XML/PDF o venta historica.
- Numeracion local y Matias no permiten saltos no auditados.

### Operacional

- Sandbox completo de factura/POS/notas.
- Webhooks aceptados y duplicados.
- Reintentos con backoff.
- API 402 sin cupo y 429 por limite.
- Falla 500 Matias con ticket/reference si viene.
- Emision masiva no activa documentos fuera de cuota.
- El panel rapido de POS no permite reutilizar datos fiscales de otro documento sin confirmacion.
- Actualizar datos de cliente conservando historico fiscal no modifica facturas emitidas.

## 13. Endpoints y conceptos Matias a verificar antes de codificar

Antes de implementar, el equipo debe confirmar en la cuenta Sandbox/Produccion:

- URL exacta de produccion entregada al contratar.
- Endpoint real de perfil/empresa disponible para el PAT.
- Payload completo de factura vigente para Resolucion 000948/2026 segun Matias.
- Payload de POS, notas, documento soporte, nomina y RADIAN.
- Endpoint de resoluciones y software de cada cliente.
- Endpoint de certificado y requisitos por ambiente.
- Endpoint de membresias/cuotas disponibles para cuentas propias.
- Comportamiento Casa de Software confirmado, alcance de `client_uuid` y permisos del PAT principal.
- Webhooks por subcuenta o cuenta principal y si un secreto puede compartirse entre clientes.
- Eventos emitidos efectivamente, ya que pagos/cuotas/tokens estan reservados actualmente.
- Retencion y disponibilidad de PDF/XML/XML ApplicationResponse.

## 14. Riesgos y mitigaciones

### Riesgo: la cuenta principal no puede operar una subcuenta o asignar cuota

Mitigacion: confirmar sandbox y permisos del PAT principal antes de crear clientes. Guardar `matias_client_uuid` obligatorio para cada subcuenta y bloquear operaciones si falta, esta deshabilitada o no pertenece a Kinventory.

### Riesgo: la subcuenta existe pero no tiene paquete Matias vigente

Mitigacion: mostrar estado desconocido y exigir confirmacion del paquete/cuota. Nunca activar factura electronica por el solo hecho de estar creada la subcuenta.

### Riesgo: secreto PAT exponido

Mitigacion: cifrado, no mostrar, revocacion, rotacion, redaccion de logs y auditoria.

### Riesgo: factura duplicada por timeout o reintento

Mitigacion: referencia local, transaccion, consulta previa, estados y lock por venta.

### Riesgo: estado fiscal incorrecto

Mitigacion: no usar 2xx local como aceptacion; aceptar solo estados reconocidos y mostrar `UNKNOWN` ante ambiguedad.

### Riesgo: webhook no recibido o payload alterado

Mitigacion: HMAC, idempotencia, consulta de estado y fallback.

### Riesgo: la empresa tiene factura POS activa pero no factura electronica contratada

Mitigacion: el toggle fiscal permanece desactivado y muestra estado de servicio/cupo. No inferir contrato a partir del acceso al ERP.

### Riesgo: el cliente compra el paquete pero Kinventory no refleja la cuota

Mitigacion: estado de salud y sincronizacion manual; webhook de cuota solo si Matias lo activa; avisos locales basados en respuesta 402, cuotas asignadas y fechas de membresia.

### Riesgo: Matias cambia reglas de certificado, software o bolsa compartida

Mitigacion: registrar version comercial y resultados de soporte en la auditoria; no migrar mas empresas hasta validar el nuevo comportamiento.

## 15. Fuera de alcance inicial

- No implementar facturacion directa propia sin Matias.
- No guardar contrasenas Matias ni reutilizar autenticacion OAuth interactiva en workers.
- No asumir que la cuenta Kinventory pagara documentos de todas las empresas.
- No activar todos los servicios al pulsar un único boton.
- No emitir produccion desde Sandbox.
- No reconstruir documentos fiscales enviados desde una configuración nueva.
- No contabilizar pago Matias con eventos reservados aun no emitidos.
- No crear ni operar clientes como Casa de Software hasta completar sandbox, contratos y acuerdo tecnico con Matias.
- No asumir que el certificado de Matias cubre todos los clientes; confirmar elegibilidad por paquete y NIT.
- No activar en masa subcuentas, cuotas o produccion sin piloto autorizado.
- No tratar `document.created/emitted` como validacion fiscal final.

## 16. Definicion de terminado para MVP

El MVP estará listo cuando una empresa piloto pueda:

1. Tener la empresa creada como subcuenta Casa de Software en Matias.
2. Registrar la conexion sandbox desde Configuracion sin guardar credenciales visibles.
3. Activar solo Factura electronica.
4. Completar una venta en POS con cliente nuevo y el toggle electronico apagado.
5. Completar el mismo flujo con cliente existente y el toggle electronico activado.
6. Pasar una factura sandbox completa.
7. Ver estados, PDF/XML/CUFE y rechazos sin exponerse a secretos.
8. Emitir una primera factura real bajo aprobacion y registrar su estado DIAN.
9. Revocar o rotar la conexion y comprobar que no se puede emitir mientras este desconectada.
10. Consultar auditoria y reprocesar sin duplicar el documento fiscal.

## Registro de fases terminadas

Las fases terminadas se documentaran aqui con fecha, resumen, scripts SQL entregados, archivos modificados, validaciones y pendientes.

### Fase 1 - implementada localmente

Fecha: 2026-10-26. Migracion AWS verificada el 2026-10-27.

Estado: backend y pestaña de configuración implementados localmente. El SQL fue ejecutado manualmente en AWS RDS y las tablas fueron verificadas por SSH. Aún no se realizó deployment del código ni se completó la prueba sandbox real.

Verificacion AWS realizada:

- `matias_conexiones` existe con clave única empresa/entorno e índices esperados.
- `matias_eventos_auditoria` existe.
- `matias_servicios` existe con `27` registros sandbox para las `3` empresas actuales.
- La última versión local del script también crea servicios de producción; el seed de producción quedó pendiente hasta reejecutar o aplicar el script actualizado.

Scripts entregados:

- [SQL/migration_20261026_matias_fase1.sql](SQL/migration_20261026_matias_fase1.sql)
- [SQL/migration_20261027_matias_fase2.sql](SQL/migration_20261027_matias_fase2.sql)

Archivos principales:

- [backend/src/platform/matias/matias.client.ts](backend/src/platform/matias/matias.client.ts)
- [backend/src/platform/matias/matias.controller.ts](backend/src/platform/matias/matias.controller.ts)
- [backend/src/platform/matias/matias.routes.ts](backend/src/platform/matias/matias.routes.ts)
- [frontend/public/assets/js/matias-configuracion.js](frontend/public/assets/js/matias-configuracion.js)
- [frontend/public/configuracion-general.html](frontend/public/configuracion-general.html#L361)

Validaciones realizadas:

- Build TypeScript backend completado con `npm run build`.
- Sin errores de sintaxis reportados por VS Code en archivos backend, frontend y Markdown modificados.

Pendientes para cerrar Fase 1:

- Mantener el SQL aplicado en AWS actualizado cuando se reejecute el seed para producción.
- Crear una cuenta sandbox y obtener PAT independiente.
- Guardar y probar la conexión desde la pestaña Facturación electrónica.
- Confirmar que el endpoint `/auth/user` de la URL base entregada responde correctamente con PAT.
- Validar aislamiento tenant con dos usuarios/empresas.
- Ejecutar deploy AWS solo después de aprobar toda la entrega.

## Fuentes verificadas

- Matias Introduccion y autenticacion: https://docs.matias-api.com/docs/intro/
- Sandbox Quickstart: https://docs.matias-api.com/docs/sandbox/quickstart.md
- Autenticacion y PAT: https://docs.matias-api.com/docs/endpoints/intro-auth#personal-access-tokens
- Gestion de clientes/Casa de Software: https://docs.matias-api.com/docs/endpoints/company#clientes-casa-software
- Webhooks y HMAC: https://docs.matias-api.com/docs/endpoints/webhooks
