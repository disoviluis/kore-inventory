# Acceso verificado, migracion gradual y suscripciones

Estado: implementado y validado localmente. El propietario confirmo el 2026-10-06
la aplicacion manual de ambas migraciones: 12 usuarios legado y 3 empresas.
No desplegar antes de preparar los requisitos de produccion. El agente no ejecuta
migraciones en RDS.

## 1. Scripts manuales para RDS

Hacer primero un respaldo completo con el procedimiento existente.
Ejecutar manualmente, seleccionando la base `kore_inventory`:

`SQL/migration_20261006_acceso_verificado_licencias.sql`

Despues ejecutar `SQL/migration_20261006_smtp_global.sql` para el almacenamiento
SMTP cifrado. Si el primer script ya fue aplicado en su version final, ejecutar
solo el segundo. Ninguno configura una cuenta ni incluye una contrasena.

El script crea tablas auxiliares y registra las cuentas actuales como `legado`.
Pausar las altas/cambios de usuarios y empresas durante el intervalo entre SQL
y despliegue para que no aparezcan cuentas fuera de esa fotografia inicial.
No elimina usuarios, cambia contrasenas, mueve transacciones, acepta documentos,
publica textos legales ni renueva licencias. Mantiene los periodos existentes;
las fechas historicas DATE conservan su ultimo dia incluido. No usa triggers,
procedimientos ni INTO OUTFILE. El DDL MySQL no tiene rollback transaccional:
si hay un error, detenerse, revisar el mensaje y no desplegar una migracion parcial.
Se puede repetir el script completo para completar tablas ausentes; no usarlo
para cambiar una estructura ya creada desde una version diferente del archivo.

Comprobar manualmente los SELECT finales y estas tablas:

- usuarios_seguridad, auth_sesiones, auth_desafios, auth_limites, auth_mfa_respaldo
- documentos_legales, aceptaciones_legales, acceso_auditoria
- empresas_suscripcion, solicitudes_suscripcion, licencias_vigencias, licencias_avisos

Revisar antes del cambio las empresas con periodos ya vencidos: la nueva API las
restringe aunque su estado antiguo diga activa o trial. No se inventan pagos para
dejarlas activas. Los pagos legitimos deben confirmarse con referencia real.

## 2. Configuracion EC2 antes del unico despliegue

Editar directamente `/home/ubuntu/kore-inventory/backend/.env`.
No enviar contrasenas, claves ni codigos por chat, ni guardarlos en Git.

Alternativa para preparar los requisitos sin mostrar secretos:
`node scripts/preparar_acceso_produccion.cjs /home/ubuntu/kore-inventory/backend`.
Valida el JWT existente, genera AUTH_SECURITY_KEY solo si falta, fija la URL
publica solo si falta y crea un respaldo privado de .env. No rota claves existentes
ni ejecuta SQL. No necesita credenciales SMTP, que se configuran desde la pestaña.

```dotenv
NODE_ENV=production
APP_PUBLIC_URL=https://kinventoryservices.com
AUTH_SECURITY_KEY=CLAVE_ALEATORIA_PRIVADA_DE_AL_MENOS_32_BYTES
```

Conservar el JWT_SECRET existente si ya tiene al menos 32 bytes. Se comprobo
sin revelar su contenido que el actual cumple el requisito. La configuracion
AUTH_SMTP_* y APP_PUBLIC_URL no estaba presente en la comprobacion de EC2.
AUTH_SECURITY_KEY es una clave distinta y permanente: cifrado MFA y proteccion
de codigos. Respaldarla en un gestor seguro. No cambiarla sin una migracion
criptografica; cambiar JWT_SECRET invalida sesiones, no los secretos MFA.
El texto CLAVE_* es un marcador, no una clave utilizable.

La cuenta SMTP se configura despues del despliegue en:
Configuracion Global > Correo SMTP (solo Super Admin). No se requiere modificar
.env ni reiniciar PM2 para cambiar proveedor, usuario o remitente desde la pestaña.
El formulario incluye activacion, guardado cifrado y envio de prueba. La credencial
guardada no se devuelve al navegador; un campo vacio conserva la actual. Cambiar
servidor o usuario requiere proporcionar una nueva credencial. Guardar con el
servicio desactivado impide envios, incluso si hay SMTP configurado en .env.

Para soportekinventory@gmail.com: seleccionar Gmail, smtp.gmail.com, puerto 587,
STARTTLS, usuario y remitente soportekinventory@gmail.com, y una contrasena de
aplicacion admitida por Google con verificacion en dos pasos habilitada. No usar
la contrasena habitual. No se implemento OAuth2 en esta pestaña; si Google o el
proveedor impide SMTP con credencial de aplicacion, usar un servicio SMTP compatible.
Microsoft 365 solo funcionara si la cuenta/organizacion permite SMTP AUTH con el
metodo configurado. SMTP no significa que la entrega al buzon este garantizada:
la prueba confirma aceptacion por el servidor; revisar recepcion y spam.

AUTH_SMTP_HOST/PORT/USER/PASS y AUTH_MAIL_FROM permanecen como respaldo para
instalaciones anteriores: solo se usan si no existe una configuracion global.
Invitaciones, recuperacion y avisos de licencia comparten el servicio central.
La configuracion SMTP de nomina de cada empresa no se modifica ni reutiliza.

El transporte exige TLS: 587 STARTTLS o 465 TLS implicito. Configurar SPF, DKIM
y DMARC para el dominio remitente. Si se usa SES en sandbox, completar la salida
de sandbox antes de invitar destinatarios no verificados. No reutilizar una
cuenta SMTP de nomina de una empresa para autenticar otras empresas.

## 3. Despliegue unico

Solo despues de confirmar SQL y configuracion:

1. Preparar un unico commit/push autorizado con todo el cambio.
2. Respaldar el codigo/dist actuales en EC2, sin incluir secretos.
3. Una sola actualizacion desde `/home/ubuntu/kore-inventory`.
4. `cd backend && npm ci && npm test`.
5. `pm2 restart kore-backend --update-env` (PM2 ejecuta npm start/dist).
6. Comprobar `/health`, login, cookie Secure/HttpOnly, CSRF y cierre de sesion.
7. Entrar con el Super Admin existente; configurar y probar Correo SMTP,
   publicar documentos revisados y enviar
   una invitacion piloto a una persona real antes de migrar otras empresas.

Nginx sirve directamente frontend/public: git pull publica todas las pantallas.
No hacer pulls parciales, cambiar su root ni desplegar antes del SQL. Este cambio
requiere una pausa breve coordinada; los JWT antiguos dejan de servir y todas
las personas deberan iniciar sesion nuevamente. Las cuentas legado conservan
sus contrasenas actuales y no se bloquean masivamente por correo ficticio.

La compilacion y pruebas locales no certifican las estructuras reales de RDS,
entrega de SMTP, concurrencia real ni configuracion de nginx. Estos controles
deben comprobarse despues del despliegue con la empresa piloto.

## 4. Migracion por empresa

En Plataforma > Accesos verificados (`accesos.html`):

1. Seleccionar empresa y localizar sus cuentas legado.
2. Si corresponde a la misma persona, aprobar el correo real y confirmar la
   identidad del titular del historial. Su ID, ventas y auditoria se conservan.
3. Una cuenta compartida/ficticia no se reasigna: invitar una persona nueva con
   empresa y rol, y retirar el acceso antiguo cuando termine la transicion.
4. Elegir si se restringe inmediatamente la cuenta hasta verificar. No se puede
   aplicar este bloqueo al Super Admin durante su migracion.
5. La persona abre el enlace, confirma un codigo, establece su contrasena y acepta
   las versiones legales publicadas. El enlace dura 24 h; cada codigo 10 min.
   Cinco intentos por codigo y cinco envios; reenvio no antes de 60 segundos.
6. Completar MFA para administradores verificados, y guardar sus diez codigos de
   respaldo de un solo uso. Para el Super Admin legado la adopcion es gradual;
   una vez habilitado, no puede evitar la obligacion de MFA al reconfigurarlo.
7. Desactivar cuentas antiguas sin borrarlas. Reactivar una cuenta suspendida
   requiere una invitacion nueva y verificacion; no restaura sesiones antiguas.

La recuperacion por correo solo esta disponible para cuentas con evidencia real
de correo verificado. Las legado con correo ficticio se recuperan mediante el
Super Admin. Si hay MFA activo, recuperar la contrasena no elimina ese factor:
se exige autenticador o codigo de respaldo. Si se pierden todos los factores,
usar un procedimiento de soporte con comprobacion de identidad fuera de banda;
no existe un bypass publico para retirar MFA.

La verificacion confirma control del buzon, no identidad civil ni representacion
legal. Esa aprobacion sigue siendo responsabilidad del operador.

## 5. Documentos legales

En Accesos verificados > Documentos legales, publicar terminos y privacidad con
identidad/NIT/contacto reales del operador y version unica. El contenido se
trata como texto, no HTML ejecutable. Las versiones son inmutables y se guarda
hash, usuario, contexto, fecha UTC, IP y agente de cada aceptacion. Cada solicitud
de suscripcion conserva adicionalmente la aceptacion del administrador para
esa empresa. No se acepta en nombre de cuentas antiguas.

La publicacion requiere confirmacion explicita de revision juridica. No se
generan textos supuestamente certificados ni consentimientos retroactivos.
Mientras no esten ambos documentos publicados, no se completan activaciones
nuevas ni nuevas solicitudes comerciales. Las cuentas legado siguen accesibles.

Contenido que debe revisar el asesor juridico, asumiendo Colombia:

- Operador del SaaS, cliente empresarial y facultades de quien contrata.
- Modulos reales, limites, prueba unica, precios finales COP/impuestos,
  confirmacion manual de pago, renovacion, cancelacion y cambios de plan.
- Responsabilidades sobre inventario, contabilidad y facturacion/DIAN; no afirmar
  certificaciones ni garantias que la aplicacion no tiene.
- Datos personales, finalidades, derechos, canales de reclamo, responsable y
  encargado, obligaciones de las empresas y tratamiento internacional en AWS.
- Imagenes publicas de catalogo frente a evidencias privadas; retencion,
  exportacion/terminacion, copias de seguridad, incidentes y soporte real.
- Consentimiento publicitario separado y opcional si en el futuro se incorpora.

Referencias: Ley 1581/2012 (datos personales), Ley 527/1999 (mensajes de datos)
y Ley 1480/2011 cuando exista relacion de consumo. La implementacion tecnica
no constituye certificacion de cumplimiento legal.

## 6. Prueba y pagos

### Catalogo aprobado y publicaciones de prueba (2026-10-06)

Las nuevas ofertas aprobadas son Esencial 29.900 COP/mes, Gestion 69.900 COP/mes
e Integral 129.900 COP/mes; anual equivale a diez mensualidades. Activarlas con
`SQL/migration_20261006_catalogo_planes_aprobado.sql`, ejecutado manualmente
despues de respaldo. Crea registros nuevos y retira solo las ofertas antiguas
conocidas de nuevas ventas, sin mover empresas ni modificar licencias vigentes.
Si los nombres nuevos ya existen, no sobrescribe sus precios editados.

El editor de Planes muestra COP, modulos seleccionables y las caracteristicas
que realmente tienen controles. Los precios se pueden cambiar para solicitudes
nuevas. Para cambiar modulos/cupos de un plan con periodos pagados, duplicarlo:
no se reescriben las condiciones contratadas en sitio.

Las licencias nuevas guardan version comercial 2 en sus notas JSON. Los periodos
anteriores mantienen sus aliases y acceso previo de caracteristicas hasta una
renovacion o cambio acordado; no se elimina stock, usuarios ni bodegas existentes.

Los textos `frontend/public/assets/legal/terminos-pruebas.txt` y
`privacidad-pruebas.txt` son bases informativas publicas para revision con datos
sinteticos. El visor las presenta cuando no hay documentos definitivos publicados.
NO se insertan como documentos contractuales ni se aceptan automaticamente.
No contienen una SAS ficticia ni NIT provisional. Para activar usuarios nuevos
en produccion o contratar, sigue siendo necesario identificar al operador real,
completar las condiciones pendientes y publicar ambos textos definitivos desde
Accesos verificados. La aprobacion del catalogo no equivale a revision juridica.

Una empresa nueva espera la verificacion de su primer administrador aprobado.
Entonces comienza una unica prueba de 30 x 24 horas, registrada en UTC.
Invitaciones posteriores, cambios de usuario o plan no la reinician.
Las empresas anteriores no reciben una prueba nueva al migrar personas.

En `suscripcion.html` cada administrador selecciona un plan activo del catalogo
real. El servidor calcula monto y periodo: el navegador no puede definir precio.
La solicitud queda pendiente, sin cargo ni licencia hasta que Super Admin
confirme que recibio el importe exacto e indique una referencia bancaria real.
La aprobacion es transaccional, auditada e idempotente. Se rechazan referencias
reutilizadas y planes cuyos cupos ya son menores que los datos de la empresa.

Renovar el mismo plan anticipadamente conserva los dias pagados. Un cambio de
plan durante un periodo pagado vigente se rechaza: programarlo al vencimiento;
no se implemento prorrateo automatico. No hay pasarela ni cobro recurrente real.
El antiguo CRUD de licencias y las renovaciones simuladas estan bloqueados.

La API valida membresia, vigencia y modulos. Cupos de usuarios en las altas y de
productos/facturas en sus transacciones (incluidas cuentas abiertas). Super Admin
mantiene su excepcion administrativa. Revisar el catalogo existente antes de
comercializar: no se cambiaron precios ni se agregaron modulos a planes antiguos.

Al vencer, los usuarios pueden autenticar y acceder a suscripcion y seguridad;
las operaciones se restringen sin borrar datos. No se habilita exportacion
irrestricta despues de vencer: acordar la politica contractual de recuperacion
de datos y canal de soporte antes de publicar los documentos.

El cron existente ahora ejecuta Node con dotenv y envia avisos a administradores
verificados. No ejecuta mysql, expone contrasenas en argumentos, genera OUTFILE,
renueva ni suspende empresas. Los avisos registran entrega; un fallo SMTP se puede
reintentar. La restriccion de vencimiento NO depende del cron.

## 7. Validacion realizada

- Build TypeScript estricto y suite local completa.
- Pruebas negativas de sesiones, CSRF, codigos vencidos/usados, MFA y cupos.
- Migracion positiva conservando ID y sin reiniciar pruebas anteriores.
- Aprobacion repetida sin duplicar licencia; renovacion sin perder tiempo pagado.
- Navegador con APIs simuladas: 1280 x 800 y 390 x 844, sin desbordamiento global,
  errores de consola ni solicitudes fallidas; activacion, invitacion y solicitud.
- Auditoria npm de dependencias de produccion: cero vulnerabilidades reportadas.
- No se ejecutaron migraciones, invitaciones, cobros ni pruebas de ataque en RDS.