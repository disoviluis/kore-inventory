# Plan de implementación: contabilidad completa

## Resumen de implementación y alcance actual

Este documento es la referencia funcional y técnica del módulo de contabilidad. Debe leerse en dos niveles:

- **Implementado:** estructuras SQL, procedimientos, estado de parametrización, endpoints y primera interfaz de configuración que ya existen en el repositorio o fueron validados en AWS.
- **Pendiente:** validaciones funcionales, decisiones del contador, integración automática de todos los módulos y migración de históricos. Lo pendiente no debe presentarse como funcionalidad terminada ni ejecutarse de forma masiva.

### Interfaz aprobada: parametrización sin duplicar datos

La interfaz contable se integra como la pestaña **Contabilidad** de `configuracion-general.html`. Su responsabilidad es coordinar la parametrización y mostrar el estado; no debe convertirse en un segundo formulario de empresa, facturación o bancos.

La regla para cualquier dato requerido es:

1. **Buscar primero el dato en el módulo propietario.** La interfaz contable debe leerlo mediante su API o mostrar su estado, sin copiarlo ni crear una segunda fuente.
2. **Si falta, dirigir al usuario al formulario existente.** El botón debe guardar el destino `Contabilidad` y abrir la pantalla que ya captura el dato.
3. **Al terminar, regresar a Contabilidad.** Se conserva la empresa activa y se vuelve a la pestaña o pantalla contable para continuar el asistente. En Empresa este retorno ya funciona dentro de Configuración General; Facturación y Bancos todavía deben completar su navegación de retorno.
4. **Validar nuevamente al regresar.** El asistente debe comprobar que el dato ya existe y mostrar el siguiente requisito pendiente.
5. **No borrar ni reemplazar información existente.** Las correcciones se hacen en el módulo dueño y deben respetar sus permisos y auditoría.

### Datos propios y datos reutilizados

| Dato requerido | Módulo propietario | Tratamiento en Contabilidad |
|---|---|---|
| Nombre, NIT, dirección, ciudad y régimen tributario | Empresa | Consultar y enlazar al formulario de Empresa |
| Resolución DIAN, prefijo, numeración y tipo de facturación | Facturación | Consultar y enlazar al formulario de Facturación |
| Cuentas bancarias y medios de dinero | Bancos/Cajas | Consultar y enlazar al módulo correspondiente |
| Productos, proveedores, clientes y terceros | Sus módulos operativos | Reutilizar por sus IDs; no volver a solicitarlos |
| Fecha de inicio, fecha de corte, perfil y estado contable | Contabilidad | Capturar y guardar en la parametrización contable |
| Cuentas por defecto y excepciones contables | Contabilidad | Configurar en `configuracion_contable` y `plan_cuentas` |

La interfaz puede mostrar un resumen o estado de completitud de los datos externos, pero no debe duplicar sus campos. Un enlace de retorno no significa que el dato se copie: significa que se vuelve a consultar desde su fuente original.

### Estado real de la interfaz y backend

Ya existe una primera entrega funcional de coordinación:

- Pestaña **Contabilidad** con fecha de inicio, fecha de corte, perfil y estado.
- Acciones para iniciar, continuar después y activar la parametrización.
- Bloque de enlaces a Empresa, Facturación y Bancos para completar datos existentes.
- Retorno contextual mediante `sessionStorage`: Facturación y Bancos muestran un botón para volver a Configuración General, que abre la pestaña Contabilidad.
- `GET /api/empresas/:id/contabilidad/estado` para consultar el estado.
- `PUT /api/empresas/:id/contabilidad/estado` para guardar el estado y sus fechas.
- Manual HTML accesible desde la pestaña Contabilidad: `frontend/public/manual-contabilidad.html`.

Esta entrega es una **interfaz de preparación segura**. Activar el estado no equivale todavía a haber terminado la configuración de cuentas obligatorias ni habilita por sí solo toda la contabilización automática.

El manual explica para usuarios no contadores:

- El orden recomendado para parametrizar una empresa.
- Qué datos pertenecen a Empresa, Facturación, Bancos y módulos operativos.
- Para qué sirve cada parámetro y qué parte de la aplicación afecta.
- Cómo elegir el perfil de comercio, servicios, restaurante o manufactura.
- Qué cuentas y fechas deben revisar antes de activar.
- Qué errores deben evitar y cuándo solicitar revisión del contador.

### Responsable inicial de la parametrización

La parametrización se realiza por empresa y por usuarios autorizados. Como actualmente no se han creado usuarios contadores para todas las empresas, se adopta esta política inicial:

- El `admin_empresa` puede ingresar a las empresas que tiene asignadas y realizar la parametrización contable de esas empresas.
- El administrador puede actuar temporalmente como responsable contable sin crear un usuario adicional.
- Posteriormente, el administrador puede crear un usuario de empresa con `tipo_usuario = 'usuario'` y asignarle un rol empresarial llamado **Contador**.
- No se debe crear un nuevo valor `tipo_usuario = 'contador'`; el alcance contable se controla mediante el rol, los permisos y la relación `usuario_empresa`.
- Un contador solo puede consultar o modificar las empresas que tenga asignadas mediante `usuario_empresa`.
- La configuración, las cuentas, los comprobantes y la auditoría siempre quedan asociados a `empresa_id`, aunque el mismo contador atienda varias empresas.

Flujo esperado:

1. El administrador o contador inicia sesión.
2. El sistema lista únicamente las empresas asignadas al usuario.
3. El usuario selecciona una empresa y entra a **Configuración > Contabilidad**.
4. Realiza la parametrización y guarda el avance de esa empresa.
5. Puede cambiar a otra empresa asignada sin mezclar planes de cuentas, fechas ni estados.
6. Al finalizar, activa la parametrización solo cuando las cuentas obligatorias y los datos requeridos estén completos.

Cuando se cree el rol **Contador**, sus permisos mínimos serán `contabilidad.view`, `contabilidad.create`, `contabilidad.edit`, `contabilidad.approve` y `contabilidad.export`, según la política de la empresa. El permiso `delete` no debe concederse para comprobantes confirmados, porque estos se anulan mediante reversos.

## Objetivo

Convertir KORE Inventory de un sistema financiero operativo a un sistema con contabilidad formal para empresas colombianas de cualquier sector, manteniendo separados:

- **Operación:** ventas, compras, inventario, recibos, bancos y gastos.
- **Contabilidad:** cuentas PUC, comprobantes, asientos de partida doble, libros y estados financieros.

Cada operación aprobada debe poder generar un comprobante contable auditable. Los asientos no se borran: se anulan mediante un asiento inverso.

La contabilidad es un **núcleo transversal**. No debe asumir que todas las empresas tienen restaurante, comandas, propinas, manufactura o inventario.

## Arquitectura definitiva del módulo contable

Este ERP debe seguir una sola arquitectura base para todos los sectores y empresas, con variación solo en los perfiles, plantillas y cuentas activas por empresa. No hay un “plan alternativo” ni una segunda lógica contable.

La arquitectura definitiva es:

1. **Catálogo contable global del ERP**
   - Mantiene el PUC base colombiano, versionado por normativa y por sector.
   - Se crea una sola vez en el sistema.
   - No se modifica desde cada empresa.

2. **Perfil operativo por empresa**
   - Cada empresa selecciona un perfil principal, por ejemplo: comercio, servicios, restaurante, manufactura, distribución o mixta.
   - El perfil define qué módulos operativos están habilitados.
   - El perfil no cambia el motor contable; solo cambia la plantilla inicial de cuentas y validaciones.

3. **Plantilla contable inicial**
   - Cuando se crea la empresa, se aplica una plantilla sugerida según el perfil.
   - La plantilla es una base de inicio, no un catálogo rígido.
   - El contador puede activar, inactivar y personalizar cuentas.

4. **Plan contable activo por empresa**
   - `plan_cuentas` es el conjunto final que usa cada empresa.
   - Se llena a partir del catálogo global y el perfil de la empresa.
   - Cada empresa puede ampliar subcuentas auxiliares sin alterar el catálogo base.

5. **Sin plan paralelo ni migraciones alternativas**
   - No se crean dos arquitecturas paralelas ni dos formas distintas de contabilizar.
   - La variación está en el perfil, la plantilla y el plan contable activo, no en la lógica contable central.

6. **Regla operativa**
   - Las empresas pequeñas reciben menos cuentas visibles.
   - Las empresas grandes reciben más cuentas y más detalle.
   - El motor contable y las reglas de partida doble son iguales para todos.

### Perfiles operativos

La empresa debe tener un perfil operativo configurable, por ejemplo:

- **Comercio:** compra y vende productos terminados; usa inventario, ventas, compras y cartera.
- **Servicios:** vende servicios; normalmente no maneja inventario ni costo por insumos.
- **Restaurante, panadería o cafetería:** usa mesas, cuentas abiertas, comandas, cocina, recetas/insumos y propinas opcionales.
- **Manufactura:** compra materias primas, transforma productos y controla materiales, producción y costos.
- **Confecciones:** maneja tela, hilo, botones y prendas terminadas; puede requerir órdenes de producción.
- **Distribución:** controla bodegas, lotes, despachos, compras y ventas a crédito.
- **Empresa mixta:** combina productos, servicios, inventario y procesos de fabricación.

El perfil activa módulos y configuraciones, pero **no cambia el motor contable**. Solo determina qué operaciones pueden generarse.

### Matriz de módulos por perfil

| Módulo | Comercio | Servicios | Restaurante | Manufactura |
|---|---:|---:|---:|---:|
| Ventas y facturación | Sí | Sí | Sí | Sí |
| Compras y proveedores | Sí | Opcional | Sí | Sí |
| Inventario | Sí | Opcional | Sí, insumos | Sí |
| Bodegas | Opcional | No | Opcional | Sí |
| Cuentas abiertas | Opcional | Opcional | Sí | Opcional |
| Comandas y cocina | No | No | Sí | No |
| Composición/insumos | Opcional | No | Sí | Sí |
| Producción | No | No | Opcional | Sí |
| Propinas | Opcional | Opcional | Sí, voluntaria | Opcional |
| Contabilidad | Sí | Sí | Sí | Sí |

Los módulos no aplicables deben ocultarse del menú y no deben ser requisito para crear una empresa, un rol o una factura.

---

## Estado actual verificado

La aplicación ya tiene:

- Ventas y facturación.
- Compras y proveedores.
- Cuentas por cobrar y por pagar.
- Recibos de caja y comprobantes de egreso.
- Gastos generales y gastos de caja.
- Cuentas bancarias, movimientos y conciliación.
- Inventario por bodega e insumos.
- Campos aislados en productos: `cuenta_ingreso`, `cuenta_costo`, `cuenta_inventario` y `cuenta_gasto`.

Estado de implementación:

- Fases 1 y 2: estructura y configuración contable validadas.
- Fase 3: motor de comprobantes y movimientos validado con partida doble.
- Fase 4: venta real de la empresa 32 contabilizada y balanceada.
- Fases 5 y 5A: estructuras y procedimientos validados en AWS.
- Fase 7: procedimientos de libros y reportes validados estructuralmente en AWS.

Pendiente:

- Fase 6: completar pruebas funcionales de recibos, egresos, gastos, bancos y propinas.
- Validación funcional de producción y demás flujos financieros.
- Fase 9: migración y conciliación de históricos.
- Interfaces, APIs y activación automática desde la aplicación.

## Política operativa aprobada para parametrización contable

La contabilidad se configura por empresa. No se debe obligar a todas las empresas a iniciar el mismo día ni con las mismas cuentas, pero tampoco se debe permitir que una empresa genere operaciones contables sin configuración válida.

### Empresas nuevas

Al crear una empresa se crea también su estado de parametrización contable:

- `pendiente`: la empresa existe, pero aún no puede confirmar operaciones que requieran asiento.
- `en_configuracion`: el administrador o contador está completando el asistente.
- `activa`: las cuentas obligatorias y la fecha de inicio fueron aprobadas.
- `omitida_temporalmente`: el administrador puede continuar usando módulos operativos no contables.

En el primer ingreso del administrador de empresa se debe mostrar el asistente de parametrización. El asistente debe solicitar como mínimo:

1. Perfil operativo.
2. Fecha de inicio contable.
3. Cuentas por defecto de caja, bancos, clientes, proveedores, ingresos, impuestos, inventario, costos y gastos según el perfil.
4. Si maneja inventario, producción, propinas y terceros.
5. Usuario contador o responsable de aprobación.

El administrador puede elegir `Continuar después`, pero esa opción no debe habilitar contabilidad parcial. Mientras la parametrización esté omitida:

- Se pueden consultar y operar módulos no contables autorizados.
- No se confirma una venta, compra, recibo, egreso, gasto o producción que deba generar asiento.
- El sistema muestra el estado pendiente y permite retomar el asistente.
- No se deben crear comprobantes incompletos ni usar cuentas genéricas silenciosamente.

### Empresas actuales

Las empresas 29, 31 y 32 deben recibir el mismo asistente en el siguiente ingreso del administrador, pero en modo revisión. No se deben borrar sus cuentas ni comprobantes existentes.

El asistente debe mostrar:

- Perfil actual.
- Cuentas contables asignadas.
- Fecha de inicio propuesta: `2026-09-01`.
- Comprobantes ya creados.
- Operaciones de prueba identificadas.

El administrador puede:

- Confirmar la parametrización y continuar.
- Corregir cuentas o fecha con autorización del contador.
- Omitir temporalmente y seguir usando la aplicación, sin activar nuevas operaciones contables.

### Ventas y compras actuales

La venta `VENTA-136` y la compra de prueba de la empresa 32 deben conservarse como operaciones reales de prueba para validar el funcionamiento del ERP. No deben eliminarse.

Sin embargo, deben quedar identificadas como `origen_tipo` de prueba o excluidas expresamente del saldo inicial productivo. No deben duplicarse ni mezclarse con saldos históricos cuando se active la fecha contable `2026-09-01`.

Las siguientes ventas y compras reales creadas después de activar la parametrización deben generar comprobantes automáticamente. Si la parametrización está omitida, la aplicación debe permitir únicamente operaciones que no requieran contabilización automática, según la política definida por el contador.

### Decisiones contables pendientes

Mientras no exista un contador externo asignado, se adopta provisionalmente esta política técnica, sujeta a aprobación posterior:

- Fecha de inicio contable: `2026-09-01`.
- Fecha de corte de históricos: `2026-08-31`.
- Históricos: saldos iniciales, no comprobantes masivos.
- Inventario: saldo inicial por empresa, producto y bodega.
- Cartera: saldo inicial por cliente.
- Proveedores: saldo inicial por proveedor.
- Caja y bancos: saldo inicial conciliado.
- Patrimonio: cuenta de apertura aprobada antes de cargar saldos.
- IVA, retenciones y costos: se cargan separados, nunca mezclados con ingresos o patrimonio.

Esta política permite probar ventas y compras actuales como operaciones reales de funcionamiento sin contaminar la apertura contable ni bloquear el uso general de las empresas.

Los campos de cuenta que ya existen en Productos son únicamente referencias de texto. No generan asientos por sí solos.

---

## Principios contables del módulo

1. Todo asiento debe cumplir `total débitos = total créditos`.
2. Un documento confirmado genera un comprobante contable inmutable.
3. Un documento anulado genera un comprobante inverso.
4. No se permite borrar asientos confirmados.
5. Un período cerrado no puede recibir modificaciones sin reapertura autorizada.
6. Cada asiento debe guardar empresa, fecha, usuario, origen y referencia operativa.
7. Los impuestos deben quedar separados del ingreso o costo.
8. La contabilidad debe usar valores monetarios con dos decimales.
9. Las existencias y costos de inventario deben conservar trazabilidad por bodega.
10. El contador debe poder revisar el documento origen desde el asiento y el asiento desde el documento.

---

## Modelo contable recomendado

### Catálogo base colombiano y plan contable personalizado por empresa

En Colombia no existe un único PUC oficial y rígido para todas las empresas bajo NIIF. El punto de partida operativo sigue siendo el catálogo contable del Decreto 2650 y la estructura fiscal de la DIAN, mientras que la NIIF se aplica como capa de presentación, análisis y revelación. Por eso, el ERP debe manejar dos niveles bien diferenciados:

1. **Catálogo maestro global del ERP:** incluye el PUC colombiano base (clases, grupos, cuentas y subcuentas), así como extensiones por sector, tipo de operación y normativa contable.
2. **Plan contable de cada empresa:** cada empresa activa solo las cuentas que necesita, puede personalizarlas y ampliar subcuentas auxiliares sin alterar el catálogo maestro.

Esto es viable y recomendable para un ERP multiempresa y multisector. Una cafetería, un comercio, una constructora, una empresa de servicios o una industria pueden compartir el mismo motor contable, pero cada una debe trabajar con un plan de cuentas propio, filtrado por perfil, negocio y necesidad de reporte.

El catálogo base puede incluir perfiles y plantillas como:

- General / comercio.
- Servicios.
- Restaurante, panadería y cafetería.
- Manufactura.
- Confecciones.
- Distribución.
- Cooperativas, salud, transporte, educación y otros sectores especiales.

Al crear una empresa, el sistema puede proponer una plantilla inicial según el perfil elegido, pero la empresa debe poder activar, ocultar o desactivar cuentas. Una empresa mixta puede combinar perfiles sin cambiar la lógica contable central del ERP.

### Recomendación de diseño para un ERP colombiano

Para evitar sobrecargar a empresas pequeñas y dar flexibilidad a organizaciones grandes, el sistema debe separar claramente:

- **Catálogo regulatorio y fiscal:** cuentas base del PUC colombiano, vigentes y administrables por versión.
- **Plantillas operativas por sector:** conjuntos sugeridos de cuentas según el tipo de negocio.
- **Plan contable activo por empresa:** cuentas habilitadas, personalizadas y con jerarquía propia.
- **Estructura NIIF / análisis financiero:** agrupaciones y reportes por naturaleza, función y revelación, sin depender de un solo código numérico como criterio único.

Por ejemplo:

- Una cafetería puede iniciar con 30 a 80 cuentas activas, visibles y operativas.
- Una empresa mediana puede activar un catálogo más completo del PUC estándar.
- Una empresa grande puede requerir cuentas auxiliares, centros de costo, multiempresa y presentación bajo NIIF más detallada.

La clave es que el ERP no obligue a todas las empresas a usar el mismo catálogo completo, sino que el catálogo global esté disponible para cargarse y seleccionar lo necesario por empresa.

### Regla de mantenimiento recomendada

- El catálogo global no se elimina ni se modifica desde la empresa cliente.
- La empresa y el contador solo activan y personalizan su plan contable.
- Las cuentas de último nivel son las que aceptan movimientos.
- Las cuentas de grupo o padre no deben recibir movimientos directos.
- La estructura debe validar jerarquía por nivel: clase, grupo, cuenta, subcuenta y auxiliar.
- Las cuentas de inventario, IVA, costos, gastos y propinas deben poder activarse por perfil operativo, sin exigirlas en negocios que no las usan.

Esto hace que el diseño sea compatible con el modelo colombiano real, las exigencias fiscales, y la necesidad de una plataforma ERP que soporte empresas de distintos tamaños y sectores.

### Tabla `catalogo_puc_base`

Catálogo global mantenido por la plataforma.

Campos recomendados:

- `id`.
- `codigo`.
- `nombre`.
- `tipo`: activo, pasivo, patrimonio, ingreso, costo o gasto.
- `nivel`.
- `cuenta_padre_id`.
- `naturaleza`: débito o crédito.
- `perfil_negocio`.
- `acepta_movimientos`.
- `activa`.
- `version_puc`.

Ejemplos:

```text
1105       Caja
1110       Bancos
1305       Clientes
1435       Inventarios
4135       Ingresos por ventas
2408       IVA generado
2365       Retención en la fuente
6135       Costo de ventas
```

### Tabla `plan_cuentas`

Plan contable activo de cada empresa.

Debe conservar:

- `empresa_id`.
- `catalogo_puc_base_id` nullable, cuando proviene del catálogo global.
- `codigo` único dentro de la empresa.
- `nombre` personalizado.
- `tipo`, `nivel`, `cuenta_padre_id`, `naturaleza`.
- `acepta_movimientos`.
- `activa`.
- `es_personalizada`.
- `created_at`, `updated_at`.

Al seleccionar un perfil, el sistema copia las cuentas base recomendadas a `plan_cuentas`. Después el contador puede activar, renombrar o ampliar el catálogo de la empresa sin alterar el catálogo global.

### Agregar cuentas auxiliares

El contador o administrador autorizado podrá crear una cuenta desde el plan de cuentas con:

- Código.
- Nombre.
- Tipo.
- Cuenta padre.
- Naturaleza.
- Nivel.
- Si acepta movimientos.
- Perfil o centro de costo relacionado.

Ejemplo para confecciones:

```text
1435       Inventarios
143505     Materias primas
14350501   Tela
14350502   Hilo
14350503   Botones
143510     Productos terminados
14351001   Pantalones
14351002   Camisas
```

Ejemplo para restaurantes:

```text
1435       Inventarios
143505     Insumos de cocina
14350501   Carnes
14350502   Granos
14350503   Verduras
6135       Costo de ventas
613505     Costo de alimentos
613510     Costo de bebidas
2380       Cuentas por pagar
238005     Propinas por pagar
```

Las cuentas padre agrupan y las cuentas auxiliares reciben movimientos. Si una cuenta tiene cuentas hijas, el sistema debe impedir registrar movimientos directamente en ella.

### Reglas de mantenimiento

- El código es único por empresa.
- El catálogo global no se modifica desde una empresa.
- Una cuenta con movimientos no se elimina; se inactiva.
- Una cuenta inactiva no puede usarse en operaciones nuevas.
- Las cuentas configuradas en ventas, compras o gastos deben aceptar movimientos.
- Las cuentas obligatorias se validan solo cuando el módulo correspondiente está activo.
- Una fábrica no necesita configurar cuentas de propinas.
- Una empresa de servicios no necesita configurar inventario si no lo utiliza.

### Relación con perfiles operativos

| Perfil | Cuentas iniciales recomendadas |
|---|---|
| Comercio | Caja, bancos, clientes, inventario, ingresos, costo de ventas, IVA |
| Servicios | Caja, bancos, clientes, ingresos, gastos, IVA si aplica |
| Restaurante | Comercio más insumos, costo de alimentos, propinas por pagar y cuentas abiertas |
| Manufactura | Materias primas, productos en proceso, productos terminados, costos indirectos |
| Confecciones | Tela, hilo, botones, mano de obra, productos terminados y costo de producción |
| Distribución | Inventarios por bodega, transporte, ventas, cartera y proveedores |

La empresa puede combinar perfiles sin cambiar el motor contable.

### Tabla `plan_cuentas`

Representa el PUC de cada empresa.

Campos principales:

- `id`.
- `empresa_id`.
- `codigo`.
- `nombre`.
- `tipo`: activo, pasivo, patrimonio, ingreso, costo, gasto.
- `nivel`.
- `cuenta_padre_id`.
- `acepta_movimientos`.
- `activa`.
- `naturaleza`: débito o crédito.
- `created_at`, `updated_at`.

Reglas:

- El código es único por empresa.
- Las cuentas de grupo no reciben movimientos directos.
- Solo las cuentas auxiliares aceptan débitos y créditos.
- El sistema debe permitir cargar un PUC base y personalizarlo por empresa.

### Tabla `comprobantes_contables`

Cabecera del asiento.

Campos principales:

- `id`.
- `empresa_id`.
- `numero`.
- `tipo`: venta, compra, recibo_caja, egreso, gasto, inventario, ajuste, cierre, manual.
- `fecha`.
- `estado`: borrador, confirmado, anulado.
- `origen_tipo`.
- `origen_id`.
- `descripcion`.
- `usuario_id`.
- `comprobante_anulacion_id`.
- `created_at`.

### Tabla `movimientos_contables`

Detalle de cada partida.

Campos principales:

- `id`.
- `comprobante_id`.
- `cuenta_id`.
- `tercero_tipo`.
- `tercero_id`.
- `bodega_id`.
- `debito`.
- `credito`.
- `descripcion`.
- `created_at`.

Restricciones:

- No permitir débito y crédito positivos en la misma línea.
- No permitir una línea con ambos valores en cero.
- El comprobante confirmado debe estar balanceado.
- La suma de débitos y créditos se valida en backend y en la base transaccional.

### Tabla `configuracion_contable`

Mapea operaciones a cuentas por empresa y permite activar reglas solo cuando el perfil las necesita.

Configuraciones mínimas:

- Caja general.
- Bancos.
- Cuentas por cobrar.
- Cuentas por pagar.
- Ingresos por ventas.
- Devoluciones en ventas.
- IVA generado.
- IVA descontable.
- Retenciones.
- Inventario.
- Costo de ventas.
- Gastos generales.
- Diferencias de inventario.
- Propinas por pagar, solo si la empresa tiene propinas habilitadas.
- Resultado del ejercicio.

Campos adicionales recomendados:

- `perfil_operativo`.
- `modulo_comandas_activo`.
- `modulo_produccion_activo`.
- `maneja_propinas`.
- `maneja_inventario`.
- `maneja_terceros`.
- `centros_costo_activos`.

Una configuración no debe obligar a asignar cuenta de propinas a una fábrica o empresa de servicios que no utiliza propinas.

---

## Asientos que debe generar el sistema

### Venta de contado

```text
Débito   Caja o banco                         Total recibido
Crédito  Ingresos por ventas                  Base sin impuestos
Crédito  IVA generado                         IVA
```

Si se maneja costo de ventas:

```text
Débito   Costo de ventas                      Costo del inventario vendido
Crédito  Inventario                           Costo del inventario vendido
```

### Venta a crédito

```text
Débito   Cuentas por cobrar                   Total de la factura
Crédito  Ingresos por ventas                  Base sin impuestos
Crédito  IVA generado                         IVA
```

### Recibo de caja

```text
Débito   Caja o banco                         Valor recibido
Crédito  Cuentas por cobrar                   Valor aplicado
```

### Compra de inventario a crédito

```text
Débito   Inventario                           Base de compra
Débito   IVA descontable                      IVA descontable
Crédito  Cuentas por pagar                    Total de la compra
```

### Pago a proveedor

```text
Débito   Cuentas por pagar                    Valor aplicado
Crédito  Caja o banco                         Valor pagado
```

### Gasto pagado por banco

```text
Débito   Cuenta de gasto                      Base del gasto
Débito   IVA descontable                      Si aplica
Crédito  Banco                                Total pagado
```

### Gasto pagado en efectivo

```text
Débito   Cuenta de gasto                      Valor del gasto
Crédito  Caja                                 Valor pagado
```

### Entrada de inventario inicial

```text
Débito   Inventario                           Valor inicial
Crédito  Ajuste o patrimonio                  Valor inicial
```

### Salida por venta

```text
Débito   Costo de ventas                      Costo de insumos o producto
Crédito  Inventario                           Costo de insumos o producto
```

### Propina (solo empresas que la habiliten)

La propina no debe mezclarse con ingresos propios del restaurante. Debe quedar como valor recibido por cuenta de terceros:

```text
Débito   Caja o banco                         Propina recibida
Crédito  Propinas por pagar                   Propina recibida
```

Cuando se entregue al personal:

```text
Débito   Propinas por pagar                   Valor entregado
Crédito  Caja o banco                         Valor entregado
```

El tratamiento laboral y tributario debe ser validado por el contador.

Una venta de una fábrica, tienda o empresa de servicios no debe generar cuentas de propinas. El asiento de propina solo se crea cuando:

1. La empresa tiene `maneja_propinas = 1`.
2. El cliente acepta un porcentaje o valor.
3. La venta contiene un valor de propina mayor que cero.

---

## Fases de implementación

### Política de migraciones SQL y despliegue

- Sí, la implementación requerirá tablas SQL nuevas y modificaciones controladas de tablas existentes.
- Las migraciones se entregarán en archivos independientes, numerados por fase y con instrucciones de ejecución.
- Puedes ejecutarlas manualmente en RDS desde el servidor, siempre después de realizar un backup.
- Las migraciones deben ser idempotentes cuando sea posible: si una tabla, columna, índice o permiso ya existe, no deben duplicarse.
- Cada migración debe probarse primero en local o staging.
- La base de datos puede prepararse manualmente antes del deploy, pero la aplicación no se publicará hasta completar todas las fases.
- El deploy final incluirá el código, el build del backend, el frontend y la verificación de las migraciones.

Orden de trabajo para cada migración:

1. Crear backup de RDS.
2. Revisar el archivo SQL y sus dependencias.
3. Ejecutarlo manualmente en RDS.
4. Verificar tablas, columnas, índices, claves foráneas y cantidad de registros afectados.
5. Continuar con la fase siguiente sin hacer deploy a producción.
6. Al finalizar la Fase 10, desplegar todo el código en una sola ventana controlada.

Las tablas exactas se entregarán junto con cada fase. No conviene crear desde ahora todas las tablas contables porque algunas dependen de decisiones del contador sobre PUC, impuestos, retenciones, centros de costo y perfiles de empresa.

### Ruta ejecutiva y orden recomendado

La implementación debe hacerse incrementalmente. No se debe activar la contabilidad automática antes de tener el plan de cuentas, la configuración y el motor de partida doble.

| Orden | Fase | Alcance | Complejidad | Dependencia |
|---|---|---|---|---|
| 1 | Diseño y catálogo contable | PUC, cuentas padre, cuentas auxiliares y naturaleza | Media | Validación del contador |
| 2 | Configuración por empresa | Mapeo de ventas, compras, impuestos, bancos, cartera, gastos e inventario | Media | Fase 1 |
| 3 | Motor contable | Comprobantes, débitos, créditos, balanceo, numeración, auditoría y reversos | Alta | Fases 1 y 2 |
| 4 | Ventas y facturación | Ventas de contado/crédito, IVA, descuentos, propinas opcionales y costo de ventas | Alta | Fase 3 |
| 5 | Compras e inventario | Compras, cuentas por pagar, inventario inicial, ajustes, mermas y traslados | Alta | Fase 3 |
| 5A | Manufactura y composición | Insumos, transformación, productos terminados y costos de producción | Alta, opcional | Fase 5 |
| 6 | Finanzas | Recibos, egresos, gastos, bancos, conciliación y propinas por pagar | Media-alta | Fases 3, 4 y 5 |
| 7 | Libros y reportes | Diario, mayor, balance, resultados, flujo de efectivo, IVA y retenciones | Media | Fases 4, 5 y 6 |
| 8 | Cierres contables | Períodos, bloqueos, reapertura y cierre de resultados | Alta | Fase 7 |
| 9 | Migración y parametrización | Perfiles por empresa, cuentas históricas, saldos iniciales y centros de costo | Alta | Fases 1 a 8 |
| 10 | Pruebas y puesta en marcha | Validación con contador y perfiles de negocio en staging | Alta | Todas las anteriores |

### Dependencias por tipo de empresa

- **Comercio:** fases 1, 2, 3, 4, 5, 6, 7, 8 y 10.
- **Servicios:** fases 1, 2, 3, 4, 6, 7, 8 y 10; la parte de inventario solo si aplica.
- **Restaurante:** fases 1 a 10, incluyendo comandas, insumos y propinas si están habilitadas.
- **Manufactura o confecciones:** fases 1 a 10, incluyendo la Fase 5A.
- **Empresa mixta:** activa únicamente las operaciones que utiliza, pero comparte el mismo motor contable.

### Complejidad y control de alcance

La complejidad total es alta, pero cada fase puede validarse de forma independiente. El mayor riesgo está en el motor contable y en los costos de inventario; por eso deben implementarse después de confirmar el PUC con el contador.

Cada fase debe terminar con:

1. Migración revisada y respaldada cuando corresponda.
2. Backend compilado y pruebas de balance contable.
3. Validación con datos de prueba.
4. Revisión del contador antes de activar la siguiente fase.

El despliegue productivo debe hacerse únicamente después de completar la Fase 10. Las empresas que no utilicen comandas, producción o propinas no deben recibir esos módulos ni sus cuentas contables obligatorias.

### Fase 1 - Diseño y catálogo contable

> **Deploy:** esta fase se implementa y valida localmente/staging. El deploy completo se realizará únicamente al finalizar todas las fases.

Migración SQL: `SQL/migration_20260905_contabilidad_fase1_puc.sql`.

**Estado:** ✅ Completada y verificada. Se crearon `catalogo_puc_base` y `plan_cuentas`, y se cargaron 19 cuentas base del catálogo global. La Fase 1 quedó validada para las empresas 29, 31 y 32, cada una con su perfil contable y su plan de cuentas inicial cargado sin duplicados.

La migración crea `catalogo_puc_base` y `plan_cuentas`, carga un conjunto inicial de cuentas globales y no modifica todavía la contabilización de ventas, compras o gastos. La copia a cada empresa se validó con perfiles operativos reales:

- Empresa 29: `restaurante` con `maneja_inventario = 1`, `maneja_propinas = 1`, `maneja_produccion = 0`.
- Empresa 31: `restaurante` con `maneja_inventario = 1`, `maneja_propinas = 1`, `maneja_produccion = 0`.
- Empresa 32: `manufactura` con `maneja_inventario = 1`, `maneja_propinas = 0`, `maneja_produccion = 1`.

Verificación realizada:

- `SELECT * FROM empresa_perfil_contable WHERE empresa_id IN (29, 31, 32);` → 3 registros.
- `SELECT empresa_id, COUNT(*) AS total_cuentas FROM plan_cuentas WHERE empresa_id IN (29, 31, 32) GROUP BY empresa_id;` → empresa 29 = 19, empresa 31 = 19, empresa 32 = 19.

1. Validar con el contador el PUC base de Colombia que utilizará cada empresa. ✅
2. Crear `catalogo_puc_base` con versiones y perfiles de negocio. ✅
3. Definir el proceso para copiar cuentas base al `plan_cuentas` de cada empresa. ✅
4. Crear migración de `plan_cuentas` personalizado. ✅
5. Cargar cuentas raíz y cuentas auxiliares recomendadas por perfil. ✅
6. Crear API para listar, crear, editar, activar e inactivar cuentas. ⏳ pendiente en backend/UX; la base quedó preparada.
7. Permitir crear cuentas auxiliares respetando la jerarquía padre-hijo. ⏳ base estructural definida, implementación de API pendiente.
8. Impedir eliminar cuentas usadas en movimientos. ⏳ regla definida, validación en API pendiente.
9. Crear interfaz de administración del plan de cuentas. ⏳ pendiente en frontend.

**Resultado:** las empresas ya tienen perfil contable definido y un plan de cuentas inicial cargado, listo para continuar con la Fase 2 de configuración contable por empresa.

### Fase 2 - Configuración contable por empresa

> **Deploy:** esta fase se implementa y valida localmente/staging. El deploy completo se realizará únicamente al finalizar todas las fases.

Migración SQL: [SQL/migration_20260905_contabilidad_fase2_configuracion_empresas.sql](SQL/migration_20260905_contabilidad_fase2_configuracion_empresas.sql).

**Estado:** ✅ Implementada y validada para las empresas 29, 31 y 32.

La migración crea `configuracion_contable` y asocia cada empresa con sus cuentas operativas según su perfil real:

- Empresa 29: `restaurante` con `maneja_inventario = 1`, `maneja_propinas = 1`, `modulo_comandas_activo = 1`, `modulo_produccion_activo = 0`.
- Empresa 31: `restaurante` con `maneja_inventario = 1`, `maneja_propinas = 1`, `modulo_comandas_activo = 1`, `modulo_produccion_activo = 0`.
- Empresa 32: `manufactura` con `maneja_inventario = 1`, `maneja_propinas = 0`, `modulo_comandas_activo = 0`, `modulo_produccion_activo = 1`.

La tabla mapea las cuentas base de `plan_cuentas` a los campos clave de cada empresa: caja, bancos, clientes, proveedores, ingresos por ventas, IVA generado, IVA descontable, inventario, costo de ventas, gastos generales y propinas por pagar.

1. Crear `configuracion_contable`.
2. Crear pantalla de configuración.
3. Asignar cuentas para ventas, compras, impuestos, cartera, bancos, gastos e inventario.
4. Validar que no se pueda confirmar una operación si le falta una cuenta obligatoria.
5. Permitir excepciones por producto, categoría, impuesto o proveedor.
6. Reemplazar los campos de texto actuales por referencias a `plan_cuentas.id`.
7. Mantener compatibilidad temporal con los campos antiguos durante la migración.

**Resultado:** el contador configura una vez cómo se contabiliza cada operación y cada empresa queda ligada a su plan contable real, sin obligar a perfiles no aplicables.

Migración SQL: [SQL/migration_20260905_contabilidad_fase3_motor_asientos.sql](SQL/migration_20260905_contabilidad_fase3_motor_asientos.sql).

### Fase 3 - Motor de asientos contables

> **Deploy:** esta fase se implementa y valida localmente/staging. El deploy completo se realizará únicamente al finalizar todas las fases.

Migración SQL: [SQL/migration_20260905_contabilidad_fase3_motor_asientos.sql](SQL/migration_20260905_contabilidad_fase3_motor_asientos.sql).

**Estado:** ✅ Estructura base creada y validada con un asiento balanceado de prueba.

La migración crea `comprobantes_contables` y `movimientos_contables`, y deja un bloque final de validación para comprobar:

- que las tablas existen,
- que hay registro de empresas configuradas,
- que los comprobantes y movimientos fueron creados,
- y que las sumas de débitos y créditos quedan balanceadas.

Validación ejecutada en `kore_inventory`:

- `comprobantes_contables` existe.
- `movimientos_contables` existe.
- Hay 3 empresas configuradas y 57 cuentas por empresa en el alcance validado.
- La empresa 32 generó el comprobante `PRUEBA-FASE3-32-001` con 2 movimientos.
- Débitos: `100000.00`; créditos: `100000.00`; resultado: `BALANCEADO`.

Prueba utilizada: [SQL/prueba_contabilidad_fase3_empresa32.sql](SQL/prueba_contabilidad_fase3_empresa32.sql).

1. Crear servicio `contabilidad.service.ts`.
2. Crear función transaccional para crear comprobantes.
3. Validar partida doble antes de confirmar.
4. Crear numeración por empresa y tipo de comprobante.
5. Guardar origen y referencia del documento operativo.
6. Crear asiento inverso para anulaciones.
7. Impedir edición y eliminación de comprobantes confirmados.
8. Agregar pruebas automáticas para asientos balanceados y desbalanceados.

**Resultado:** existe un motor único para generar contabilidad.

### Fase 4 - Contabilizar ventas y facturación

> **Deploy:** esta fase se implementa y valida localmente/staging. El deploy completo se realizará únicamente al finalizar todas las fases.

Migración SQL: [SQL/migration_20260905_contabilidad_fase4_ventas.sql](SQL/migration_20260905_contabilidad_fase4_ventas.sql).

**Estado:** ✅ Base SQL implementada y validada con una venta real de la empresa 32.

La migración crea `sp_contabilizar_venta(venta_id)`. La rutina es transaccional e idempotente y genera el comprobante usando la configuración contable de la empresa:

- Venta de contado: débito a caja.
- Venta por transferencia: débito a bancos.
- Venta a crédito: débito a cuentas por cobrar.
- Crédito a ingresos por la base de la venta.
- Crédito a IVA generado cuando existe impuesto.
- Débito a costo de ventas y crédito a inventario cuando los detalles tienen costo de compra.
- Asociación con la venta mediante `origen_tipo = 'venta'` y `origen_id`.
- La numeración de facturas es independiente por empresa; nunca se debe asumir un consecutivo global. La unicidad se valida con `(empresa_id, numero_factura)`.
- Confirmación únicamente después de validar partida doble.

Uso controlado:

```sql
CALL sp_contabilizar_venta(<venta_id>);
```

Validación ejecutada:

- Empresa: `32` (`EVEREST JACKETS`).
- Venta: `id = 136`, factura `FACT-000002`, total de factura `125000.00`.
- Comprobante: `VENTA-136`, estado `confirmado`.
- Movimientos: `4`.
- Débitos: `190000.00`; créditos: `190000.00`; resultado: `BALANCEADO`.

La suma contable es `190000.00` porque incluye el débito de caja por la venta (`125000.00`) y el débito del costo de ventas (`65000.00`); sus contrapartidas son ingresos por `125000.00` e inventario por `65000.00`. El costo no se suma al valor cobrado al cliente.

La contabilización automática de todas las ventas productivas sigue pendiente hasta validar IVA, descuentos, costos y anulaciones con el contador.

1. Generar asiento al confirmar una venta.
2. Separar base, IVA, descuentos y propina.
3. Registrar caja, banco o cartera según forma de pago.
4. Generar costo de ventas usando productos, insumos o costo estándar según el perfil.
5. Asociar el mesero y la propina únicamente cuando la empresa utilice esas funciones.
6. Crear reversión contable al anular la venta.
7. Validar facturas con múltiples métodos de pago.
8. Probar ventas con productos, servicios, insumos y propinas.

### Fase 5 - Contabilizar compras e inventario

> **Deploy:** esta fase se implementa y valida localmente/staging. El deploy completo se realizará únicamente al finalizar todas las fases.

Migración SQL: [SQL/migration_20260907_contabilidad_fase5_compras_inventario.sql](SQL/migration_20260907_contabilidad_fase5_compras_inventario.sql).

**Estado:** ✅ Estructura y procedimiento creados en AWS; pendiente validación funcional durante las pruebas finales de deploy.

La migración reutiliza las tablas existentes `compras`, `compras_detalle`, `proveedores` y `productos`. No las recrea ni modifica compras históricas. Crea `sp_contabilizar_compra(compra_id)`, que:

- Solo acepta compras con estado `recibida`.
- Usa la cuenta de inventario configurada por empresa.
- Usa proveedores como tercero contable.
- Lleva compras de contado contra caja y compras a crédito contra proveedores.
- Registra IVA descontable cuando la compra tiene impuestos.
- Evita duplicar el comprobante mediante `COMPRA-<compra_id>`.
- Confirma únicamente después de validar partida doble.

Validación esperada en AWS después de ejecutar la migración:

```text
fase: fase5
estado_procedimiento: OK
estado_dependencias: ESTRUCTURA_LISTA
```

Validación ejecutada en AWS el 2026-09-07:

- `estado_procedimiento`: `OK`.
- `estado_dependencias`: `ESTRUCTURA_LISTA`.
- La estructura de Fase 5 quedó disponible sin ejecutar todavía una compra de prueba.

La prueba funcional se realizará después del deploy con una compra recibida real o de staging, no en el entorno local.

1. Contabilizar compras de inventario.
2. Contabilizar compras de gasto.
3. Registrar IVA descontable.
4. Registrar cuentas por pagar.
5. Contabilizar pagos a proveedores.
6. Contabilizar inventario inicial.
7. Contabilizar ajustes, mermas, devoluciones y traslados.
8. Contabilizar consumo de insumos por ventas solo para empresas con composición o producción.
9. Validar costo promedio y costo de ventas.

### Fase 5A - Manufactura y productos compuestos (opcional)

> **Deploy:** esta fase se implementa y valida localmente/staging. El deploy completo se realizará únicamente al finalizar todas las fases.

Migración SQL: [SQL/migration_20260907_contabilidad_fase5a_manufactura.sql](SQL/migration_20260907_contabilidad_fase5a_manufactura.sql).

**Estado:** ✅ Tablas y procedimiento creados en AWS; pendiente validación funcional durante las pruebas finales de deploy.

La migración crea:

- `ordenes_produccion`, con empresa, producto terminado, bodega, cantidades, costos y estado.
- `ordenes_produccion_consumos`, con insumos, cantidades y costo consumido.
- `sp_contabilizar_produccion(orden_id)`, disponible únicamente cuando `modulo_produccion_activo = 1`.

En esta primera implementación la transformación usa la cuenta de inventario configurada para registrar la entrada del producto terminado y la salida de materias primas. Antes de producción, el contador debe definir si se requieren cuentas separadas para materias primas, productos en proceso, productos terminados, mano de obra y costos indirectos.

Validación esperada en AWS después de ejecutar la migración:

```text
fase: fase5a
tabla_ordenes: OK
tabla_consumos: OK
estado_procedimiento: OK
estado_ejecucion: PENDIENTE_VALIDACION_AWS
```

Validación ejecutada en AWS el 2026-09-07:

- `tabla_ordenes`: `OK`.
- `tabla_consumos`: `OK`.
- `estado_procedimiento`: `OK`.
- `estado_ejecucion`: `PENDIENTE_VALIDACION_AWS`.
- La estructura de Fase 5A quedó creada para la empresa 32, que tiene producción activa.

No se crearán órdenes ni se ejecutará producción durante esta etapa local. La prueba funcional se hará en AWS durante el deploy final para la empresa 32, que es la única empresa actualmente configurada con producción activa.

Esta fase no debe activarse para todas las empresas.

1. Permitir productos compuestos por insumos para restaurantes, panaderías y confecciones.
2. Permitir materias primas y productos terminados para manufactura.
3. Crear órdenes de producción cuando una empresa fabrique antes de vender.
4. Separar consumo de materias primas, mano de obra y costos indirectos.
5. Definir costo estándar o costo real según la política del contador.
6. Generar asientos de transformación de inventario.
7. Permitir que una tienda venda productos terminados sin tener composición.

Para una fábrica de pantalones, por ejemplo:

```text
Débito   Inventario de producto terminado       Costo del pantalón
Crédito  Inventario de tela                    Costo de tela consumida
Crédito  Inventario de hilo y botones          Costo de insumos consumidos
```

El detalle final depende de si la empresa usa producción bajo pedido, producción anticipada o solo compra y reventa.

### Fase 6 - Recibos, gastos, bancos y propinas

> **Deploy:** esta fase se implementa y valida localmente/staging. El deploy completo se realizará únicamente al finalizar todas las fases.

Migración SQL: [SQL/migration_20260907_contabilidad_fase6_finanzas.sql](SQL/migration_20260907_contabilidad_fase6_finanzas.sql).

**Estado:** ✅ Procedimientos creados y prueba funcional de compra ejecutada en AWS; pendientes los flujos de recibos, egresos, gastos y producción.

La migración crea procedimientos idempotentes para:

- Recibos de caja: débito a caja/bancos y crédito a clientes.
- Comprobantes de egreso: débito a proveedores y crédito a caja/bancos.
- Gastos generales: débito a gastos y crédito a caja/bancos.

Cada procedimiento valida que el documento esté vigente, usa la configuración contable de la empresa, respeta el guard de período abierto y confirma solo después de verificar partida doble. La instalación de Fase 8 debe ejecutarse antes de contabilizar documentos de Fase 6.

Validación esperada en AWS:

```text
fase: fase6
recibos: OK
egresos: OK
gastos: OK
guard_periodo: OK
estado_ejecucion: PENDIENTE_VALIDACION_AWS
```

Validación funcional ejecutada en AWS el 2026-09-07:

- Empresa: `32`.
- Compra contabilizada: comprobante `3`.
- Movimientos: `2`.
- Débitos: `750000.00`; créditos: `750000.00`.
- Resultado: `BALANCEADO`.

1. Generar asiento para recibos de caja.
2. Generar asiento para comprobantes de egreso.
3. Generar asiento para gastos generales.
4. Generar asiento para gastos de caja.
5. Separar propinas por pagar de los ingresos del restaurante.
6. Relacionar movimientos bancarios con comprobantes contables.
7. Crear reversión contable para anulaciones.
8. Validar que conciliación bancaria y contabilidad puedan cruzarse.

### Fase 7 - Libros y reportes

> **Deploy:** esta fase se ejecutará y validará en AWS. No se realizan pruebas locales; el deploy y las pruebas finales se harán en la ventana controlada definida para el proyecto.

Migración SQL: [SQL/migration_20260907_contabilidad_fase7_libros_reportes.sql](SQL/migration_20260907_contabilidad_fase7_libros_reportes.sql).

**Estado:** ✅ Procedimientos creados y validados estructuralmente en AWS; pendiente validación funcional de reportes con períodos reales.

La migración crea procedimientos parametrizados para consultar:

- Libro diario por empresa y rango de fechas.
- Mayor de una cuenta con saldo acumulado.
- Balance de comprobación.
- Estado de resultados.
- Balance general.

Los reportes solo consideran comprobantes `confirmado` y respetan la empresa y el período solicitados. No se ejecutaron pruebas locales.

Validación esperada en AWS:

```text
fase: fase7
libro_diario: OK
mayor: OK
balance_comprobacion: OK
estado_resultados: OK
balance_general: OK
estado_ejecucion: PENDIENTE_VALIDACION_AWS
```

Validación ejecutada en AWS el 2026-09-07:

- `libro_diario`: `OK`.
- `mayor`: `OK`.
- `balance_comprobacion`: `OK`.
- `estado_resultados`: `OK`.
- `balance_general`: `OK`.
- La validación funcional con rangos y períodos reales queda pendiente para las pruebas finales.

Crear:

- Libro diario.
- Libro mayor y auxiliares.
- Balance de comprobación.
- Estado de resultados.
- Balance general.
- Flujo de efectivo contable.
- Movimiento por cuenta.
- Movimiento por tercero.
- Movimiento por centro de costo o bodega.
- Reporte de IVA generado y descontable.
- Reporte de retenciones.
- Reporte de propinas por mesero.

Filtros mínimos:

- Empresa.
- Período.
- Cuenta.
- Tercero.
- Tipo de comprobante.
- Estado.
- Bodega.

Exportaciones:

- Excel.
- CSV.
- PDF.
- Formato acordado con el contador.

### Fase 8 - Cierres contables

> **Deploy:** esta fase se ejecutará y validará en AWS. No se realizan pruebas locales; el deploy y las pruebas finales se harán en la ventana controlada definida para el proyecto.

Migración SQL: [SQL/migration_20260907_contabilidad_fase8_cierres.sql](SQL/migration_20260907_contabilidad_fase8_cierres.sql).

**Estado:** ✅ Estructura, guard de período y prueba funcional de cierre/reapertura validados en AWS.

La migración crea:

- `periodos_contables`, con rango, estado, usuario y motivo de cierre.
- `auditoria_reaperturas_contables`, para registrar cada reapertura autorizada.
- Procedimientos para abrir, validar, cerrar y reabrir períodos.
- Bloqueo de confirmación de comprobantes dentro de períodos cerrados.

El cierre rechaza períodos que contengan comprobantes confirmados desbalanceados. La reapertura exige un motivo y queda auditada. No se crean períodos automáticamente ni se modifican comprobantes históricos.

Validación esperada en AWS:

```text
fase: fase8
tabla_periodos: OK
tabla_auditoria: OK
procedimiento_cierre: OK
bloqueo_periodo: OK
estado_ejecucion: PENDIENTE_VALIDACION_AWS
```

Validación estructural ejecutada en AWS el 2026-09-07:

- `tabla_periodos`: `OK`.
- `tabla_auditoria`: `OK`.
- `procedimiento_cierre`: `OK`.
- `bloqueo_periodo`: `OK`.
- `estado_ejecucion`: `PENDIENTE_VALIDACION_AWS`.

Validación funcional ejecutada en AWS el 2026-09-07:

- Empresa: `32`.
- Período probado: agosto de `2026`.
- Estado final: `reabierto`.
- Auditoría de reapertura: registro `1`.
- Comprobante de compra: `3`, estado `confirmado`.
- Débitos y créditos: `750000.00` y `750000.00`.
- Resultado: `OK`.

Se reemplazó el trigger anterior porque la política del proyecto indica que la cuenta de aplicación en RDS no puede usar triggers. Las rutinas de ventas, compras, producción y finanzas llaman explícitamente `sp_exigir_periodo_abierto` antes de confirmar comprobantes.

No se ejecutaron pruebas locales. La apertura, cierre y reapertura funcional se probarán en AWS durante el deploy final.

1. Crear tabla de períodos contables.
2. Abrir y cerrar períodos.
3. Bloquear operaciones posteriores a la fecha de cierre.
4. Permitir reapertura solo con permiso especial.
5. Registrar usuario, fecha y motivo de reapertura.
6. Generar asiento de cierre del resultado del ejercicio.
7. Crear saldos iniciales para el período siguiente.
8. Probar cierre mensual y anual.

Orden técnico de ejecución AWS para esta integración:

1. Ejecutar la migración de Fase 8 y comprobar `bloqueo_periodo = OK`. ✅
2. Ejecutar la migración de Fase 6 y comprobar `guard_periodo = OK`. ✅
3. Ejecutar las pruebas funcionales de recibo, egreso, gasto, cierre y reapertura. ✅ cierre y reapertura; recibo, egreso y gasto pendientes.

### Fase 9 - Integración y migración

> **Deploy:** esta fase se ejecutará y validará en AWS. No se realizan pruebas locales; el deploy y las pruebas finales se harán en la ventana controlada definida para el proyecto.

**Estado:** 🟡 Diagnóstico inicial habilitado en AWS; la carga histórica todavía requiere aprobación del contador.

Diagnóstico de solo lectura: [SQL/diagnostico_fase9_contabilidad_rds.sql](SQL/diagnostico_fase9_contabilidad_rds.sql).

### Parametrización inicial por empresa

Migración SQL: [SQL/migration_20260907_contabilidad_parametrizacion_empresa.sql](SQL/migration_20260907_contabilidad_parametrizacion_empresa.sql).

**Estado:** ✅ Ejecutada en AWS para las empresas 29, 31 y 32.

La migración crea `estado_parametrizacion_contable`, que conserva el avance de cada empresa sin bloquear las operaciones existentes. Los estados disponibles son:

- `pendiente`: la empresa aún no ha confirmado su configuración contable.
- `en_configuracion`: el administrador o contador está diligenciando el asistente.
- `activa`: la parametrización fue confirmada.
- `omitida_temporalmente`: el administrador decidió continuar después.

Resultado validado en AWS:

```text
empresas_registradas: 3
pendientes: 3
activas: 0
omitidas_temporalmente: 0
politica_actual: NO_BLOQUEA_OPERACIONES_EXISTENTES
```

La migración propone provisionalmente:

```text
fecha_inicio_contable: 2026-09-01
fecha_corte_historico: 2026-08-31
```

También se agregó el endpoint backend:

```http
GET /api/empresas/:id/contabilidad/estado
```

El endpoint permite que la interfaz conozca el estado contable de la empresa. Si la tabla aún no tiene registro para una empresa, responde un estado `pendiente` provisional sin modificar la base de datos.

El backend fue validado con `npx tsc --noEmit -p tsconfig.json`.

### Plan de interfaz en `configuracion-general.html`

La configuración contable ya quedó integrada como una pestaña adicional dentro del módulo existente de configuración general:

```text
Categorías | Impuestos | Empresa | Cajas | Página pública | Contabilidad
```

La pestaña **Contabilidad** consulta el endpoint según la empresa activa y muestra:

1. Estado de parametrización: pendiente, en configuración, activa u omitida temporalmente.
2. Fecha de inicio contable.
3. Fecha de corte histórico.
4. Perfil operativo de la empresa.
5. Resumen breve de la política aplicada.
6. Acciones: `Iniciar parametrización`, `Continuar después` y `Activar contabilidad`.
7. Un bloque de reutilización de datos: si un dato ya se solicita en otra pantalla, la interfaz dirige al usuario a ese formulario y luego vuelve a la pestaña de Contabilidad.

Comportamiento implementado:

- Empresas nuevas: la pestaña muestra el estado actual y permite iniciar la parametrización sin bloquear la operación.
- Empresas 29, 31 y 32: la pestaña se abre en modo revisión sin borrar ni reemplazar información ya registrada.
- `Continuar después`: cambia el estado a `omitida_temporalmente` y permite seguir usando la aplicación.
- `Iniciar parametrización`: cambia el estado a `en_configuracion`.
- `Activar contabilidad`: solo se habilita si la fecha de inicio, la fecha de corte y el perfil están completos.
- Si un dato ya se diligencia en Empresa, Facturación o Bancos, la contabilidad no lo duplica. En su lugar, enlaza ese módulo; Empresa, Facturación y Bancos ya ofrecen el retorno a Contabilidad.
- La política aplicada es `NO_BLOQUEA_OPERACIONES_EXISTENTES` y la fase sigue siendo de preparación segura, no de carga histórica.

Reutilización de datos propuesta y aplicada:

- Empresa: nombre comercial, NIT, dirección, ciudad, régimen tributario, número DIAN y datos fiscales.
- Facturación: resolución DIAN, prefijo, numeración, tipo de facturación y plantilla.
- Bancos: cuentas bancarias, flujo de dinero y conciliation mode.
- Contabilidad: solo guarda la fecha de inicio, el perfil contable y el estado de parametrización.

Archivos frontend involucrados:

- `frontend/public/configuracion-general.html`: pestaña y panel visual.
- `frontend/public/assets/js/configuracion-general.js`: carga del estado, eventos y preparación del retorno a la pestaña de Contabilidad.
- `backend/src/platform/empresas/empresas.controller.ts`: actualización segura del estado.
- `backend/src/platform/empresas/empresas.routes.ts`: endpoint PUT para gestionar el estado.

### Lo implementado

| Área | Estado documentado | Alcance real |
|---|---|---|
| Fase 1 | ✅ Estructuralmente validada | Catálogo PUC base, planes por empresa y perfiles iniciales |
| Fase 2 | ✅ Implementada y validada | Configuración contable inicial por empresa |
| Fase 3 | ✅ Validada con prueba balanceada | Comprobantes, movimientos y partida doble |
| Fase 4 | ✅ Validada con venta real de empresa 32 | Procedimiento de contabilización de ventas; la automatización productiva completa sigue pendiente |
| Fase 5 | ✅ Estructura disponible | Procedimiento de compras creado; prueba funcional pendiente |
| Fase 5A | ✅ Estructura disponible | Producción creada para perfiles aplicables; prueba funcional pendiente |
| Fase 6 | 🟡 Parcial | Procedimientos creados; recibos, egresos, gastos y producción requieren pruebas funcionales |
| Fase 7 | 🟡 Estructural | Procedimientos de libros creados; validación con períodos y rangos reales pendiente |
| Fase 8 | 🟡 Parcial | Cierre y reapertura probados; cobertura funcional completa pendiente |
| Fase 9 | 🟡 Diagnóstico y preparación | Estado por empresa, diagnóstico y primera interfaz; históricos y saldos iniciales pendientes |

Además, ya están implementados:

- Estado por empresa en `estado_parametrizacion_contable`.
- Endpoint GET/PUT para consultar y actualizar el estado contable.
- Pestaña de Contabilidad con flujo seguro y sin bloqueo operativo.
- Enlaces de reutilización hacia Empresa, Facturación y Bancos, con retorno implementado mediante la pestaña contable y botones contextuales en las pantallas externas.
- API inicial protegida de plan de cuentas: listar, crear e inactivar cuentas por empresa.
- Interfaz inicial de plan de cuentas dentro de Configuración General: listado, creación de cuentas auxiliares e inactivación.
- Validación de cuenta padre, tipo, naturaleza, jerarquía, código duplicado y cuentas con movimientos.

### Lo pendiente

- Validación real del flujo por administrador y contador de cada empresa.
- Pantalla o flujo guiado para que el administrador cree un usuario `usuario`, cree/asigne el rol empresarial **Contador** y lo vincule a una o varias empresas.
- Definir si el administrador puede aprobar definitivamente la parametrización o si esa aprobación debe requerir un usuario con rol Contador.
- Definición exacta del perfil operativo por sector: comercio, servicios, restaurante, manufactura.
- Completar la administración del plan de cuentas: edición, permisos contables granulares y validaciones adicionales. La primera consulta, creación e inactivación ya están implementadas con validación de pertenencia de la empresa al usuario.
- Formulario completo de asignación de cuentas obligatorias y excepciones por operación, producto, impuesto o tercero.
- Validación backend de cuentas obligatorias antes de confirmar cada operación aplicable.
- Activación automática desde ventas, compras, recibos, egresos, gastos, bancos, inventario y producción.
- Pruebas funcionales pendientes de Fases 5, 5A, 6, 7 y cobertura completa de Fase 8.
- Carga histórica o saldos iniciales, que requiere aprobación formal y backup previo.
- Sincronización de la configuración contable con módulos de finanzas, facturación y bancos sin duplicar información.
- Validación al regresar desde cada módulo enlazado: el asistente debe consultar nuevamente la fuente y marcar el requisito como completo o pendiente; la navegación ya está implementada, pero esta validación de completitud todavía falta.
- Migración gradual de referencias contables de texto hacia `plan_cuentas.id`, manteniendo compatibilidad mientras dure la transición.

La primera entrega ya quedó implementada en la interfaz y en el backend como preparación segura para la Fase 9. La carga histórica, los saldos iniciales y la contabilización retroactiva siguen pendientes de aprobación del contador y no se ejecutan con esta etapa.

Las Fases 1 a 8 reportaron `OK` estructuralmente en AWS, por lo que ya se puede iniciar la Fase 9 en su etapa de diagnóstico y conciliación. Esto no autoriza todavía la creación masiva de saldos iniciales ni la contabilización retroactiva.

Resultado del diagnóstico ejecutado en AWS el 2026-09-07:

- Estado general: `DIAGNOSTICO_ESTRUCTURAL_OK`.
- Empresas 29, 31 y 32: 19 cuentas en cada plan contable.
- Fases 1 a 8: `OK`.
- Empresa 32: 1 venta operativa y 1 venta contabilizada.
- Empresa 32: 1 compra operativa y 0 compras contabilizadas; queda pendiente probar `sp_contabilizar_compra`.
- No hay comprobantes confirmados desbalanceados.
- No hay comprobantes duplicados por origen.
- No hay saldos pendientes en cuentas por cobrar o por pagar.
- No hay productos con cuentas contables antiguas en texto para el alcance revisado.
- No hay períodos contables registrados todavía; debe abrirse el primer período en la prueba funcional de Fase 8.

Script de validación funcional AWS: [SQL/validar_fase6_fase8_empresa32.sql](SQL/validar_fase6_fase8_empresa32.sql).

Este script toma la primera compra recibida de la empresa 32 que aún no tenga comprobante, abre su período, ejecuta `sp_contabilizar_compra`, valida la partida doble, cierra el período y lo reabre dejando auditoría. No debe ejecutarse si el período ya está cerrado sin revisar primero el motivo.

Resultado esperado:

```text
estado_compra: BALANCEADO
estado_periodo_final: REABIERTO
resultado_final: OK
validacion_final: OK
```

La Fase 9 debe implementarse como una migración controlada y no como una conversión masiva automática. Antes de crear asientos históricos se debe definir con el contador:

- Fecha exacta desde la cual se contabilizarán operaciones.
- Si las ventas y compras anteriores se migran como saldos iniciales o como comprobantes históricos.
- Mapeo de cada cuenta antigua o texto de producto hacia `plan_cuentas.id` por empresa.
- Tratamiento de IVA, retenciones, costos, cartera, proveedores, bancos e inventario.
- Saldos iniciales y documento de conciliación por empresa.

La revisión de las tablas existentes confirma que ya hay fuentes operativas para ventas, compras, cuentas por cobrar, cuentas por pagar, recibos, egresos y gastos. El diagnóstico debe ejecutarse antes de una migración porque:

1. Se debe confirmar la cobertura funcional de Fase 6 y los períodos de Fase 8.
2. La empresa 32 ya tiene movimientos contables reales, por lo que debe evitarse duplicar `VENTA-136`.
3. Los consecutivos de facturas y compras son independientes por empresa.
4. Los datos históricos requieren una conciliación previa entre operación, inventario y saldos contables.

Ruta recomendada para Fase 9:

1. Crear un reporte de diagnóstico por empresa sin modificar datos.
2. Validar cuentas, empresas, terceros, ventas, compras, cartera, proveedores e inventario.
3. Seleccionar fecha de corte y período inicial.
4. Generar una tabla de mapeo y diferencias para revisión del contador.
5. Cargar saldos iniciales en comprobantes identificados como `saldo_inicial`.
6. Conciliar los saldos contra operación.
7. Ejecutar la migración en AWS con backup y ventana controlada.

El diagnóstico debe finalizar con `DIAGNOSTICO_ESTRUCTURAL_OK`. Después se requiere aprobación del contador y una fecha de corte antes de crear cualquier migración de saldos iniciales. No se crea todavía una migración destructiva o de carga histórica.

1. Migrar los campos de cuenta actuales a IDs del plan de cuentas.
2. Revisar las facturas y compras históricas.
3. Definir desde qué fecha se contabilizará automáticamente.
4. Crear saldos iniciales de cuentas.
5. Conciliar bancos, cartera, proveedores e inventario contra contabilidad.
6. Comparar reportes del sistema con los del contador.
7. Ejecutar en staging.
8. Respaldar antes de producción.

### Fase 9A - Parametrización por tipo de empresa

> **Deploy:** esta fase se implementa y valida localmente/staging. El deploy completo se realizará únicamente al finalizar todas las fases.

1. Crear selector de perfil operativo en la configuración de empresa.
2. Mostrar solo módulos incluidos en el perfil y plan contratado.
3. Permitir activar o desactivar comandas, cocina, producción, insumos y propinas.
4. No exigir cuentas contables para módulos que están desactivados.
5. Definir cuentas por defecto según operación, no según una interfaz fija de restaurante.
6. Crear asistentes iniciales para comercio, servicios, restaurante y manufactura.
7. Permitir que una empresa mixta active más de un perfil.
8. Validar cambios de perfil sin borrar historial ni asientos existentes.

### Fase 10 - Pruebas y puesta en marcha

> **Deploy:** esta es la fase final. Después de aprobar todas las pruebas se ejecutará el deploy completo en producción.

1. Venta de contado.
2. Venta a crédito.
3. Venta con IVA.
4. Venta con descuento.
5. Venta con propina.
6. Venta con múltiples métodos de pago.
7. Anulación de venta.
8. Compra de inventario.
9. Pago a proveedor.
10. Gasto por banco.
11. Gasto en efectivo.
12. Recibo de caja.
13. Anulación de recibo.
14. Ajuste de inventario.
15. Consumo de insumos.
16. Conciliación bancaria.
17. Cierre y reapertura de período.
18. Verificación de débitos y créditos.
19. Revisión con el contador.
20. Despliegue final.

---

## Roles y permisos contables

Los roles deben depender de los módulos activos de la empresa. Un contador puede existir en cualquier perfil; un mesero, cocinero o encargado de producción solo debe aparecer cuando corresponda.

### Contador

- Puede ser el administrador de empresa durante la etapa inicial, si la empresa aún no tiene un usuario contador separado.
- Ver plan de cuentas.
- Crear y editar cuentas.
- Ver comprobantes.
- Confirmar comprobantes manuales.
- Anular comprobantes.
- Cerrar períodos.
- Exportar libros y reportes.

### Auxiliar contable

- Crear comprobantes en borrador.
- Ver documentos.
- Aplicar recibos y pagos.
- No cerrar períodos.
- No modificar comprobantes confirmados.

### Administrador de empresa

- Configurar cuentas por defecto.
- Consultar reportes.
- Autorizar anulaciones según política.
- Crear usuarios de empresa y asignarles el rol empresarial **Contador**, siempre dentro de las empresas que administra.

### Cajero, mesero y cocina

- **Cajero:** opera ventas, pagos y cierres; no accede al plan de cuentas.
- **Mesero:** usa comandas y cuentas abiertas solo si el perfil tiene esos módulos activos.
- **Cocina:** usa el tablero solo para empresas con comandas.
- **Vendedor de tienda:** factura productos sin recibir permisos de comandas ni cocina.
- **Operario de producción:** registra consumos y terminaciones solo para manufactura.
- Ninguno crea asientos manuales salvo que una política expresa lo autorice.
- Todos generan operaciones que el motor contabiliza automáticamente.

---

## Reglas de seguridad y auditoría

- Toda modificación contable registra usuario, fecha y motivo.
- Los comprobantes confirmados son inmutables.
- Las anulaciones crean movimientos inversos.
- No se permite cambiar una cuenta contable después del cierre del período.
- Las operaciones deben pertenecer a la empresa activa.
- Los usuarios no pueden contabilizar operaciones de otra empresa.
- Los totales de documentos y asientos se comparan automáticamente.
- Los errores de configuración deben detener la confirmación antes de afectar libros.

---

## Decisiones que debe validar el contador

Antes de implementar el motor definitivo, el contador debe confirmar:

1. PUC y nivel de detalle requerido.
2. Tratamiento de IVA por tipo de producto.
3. Tratamiento de propinas.
4. Manejo de retenciones.
5. Cuentas para costo promedio e inventario.
6. Fecha desde la cual se contabilizarán operaciones.
7. Si se requieren centros de costo por bodega, restaurante o área.
8. Si las ventas a crédito usan cuentas auxiliares por cliente.
9. Política de cierres mensuales.
10. Formato de exportación para el software o contador externo.

---

## Criterio de terminado

La contabilidad estará lista cuando:

- Cada venta, compra, cobro, pago, gasto e inventario genere su asiento correcto.
- Todos los comprobantes estén balanceados.
- El contador pueda consultar libro diario y mayor.
- El estado de resultados coincida con los movimientos operativos.
- El balance de comprobación no tenga diferencias.
- Las anulaciones generen reversos completos.
- Los períodos cerrados no puedan modificarse sin autorización.
- La información pueda exportarse para revisión externa.
- El contador valide los saldos en un ambiente de pruebas antes del despliegue.

### Pruebas por perfil

**Comercio o tienda:**

- Puede vender un producto terminado.
- Puede comprar y controlar inventario.
- No ve Comandas ni Cocina.
- No se genera asiento de propina.

**Empresa de servicios:**

- Puede facturar un servicio sin inventario.
- Puede registrar gastos, bancos y cartera.
- No se exige cuenta de inventario ni costo de insumos.

**Restaurante:**

- Puede abrir mesas y enviar comandas.
- Consume insumos definidos en la composición.
- Registra propina solo si el cliente la acepta.
- Contabiliza ventas, propinas y costos correctamente.

**Manufactura o confección:**

- Puede controlar materias primas y productos terminados.
- Puede registrar consumos y producción.
- Puede vender prendas sin mostrar tela, hilo o botones en el catálogo.
- Contabiliza transformación y costo de ventas según la política configurada.

No se debe considerar terminada la contabilidad hasta probar al menos un caso de comercio, uno de servicios, uno de restaurante y uno de manufactura en staging.

**Importante:** este módulo debe implementarse con validación directa del contador. El sistema puede automatizar la mecánica, pero la definición de cuentas, impuestos, retenciones y cierres es una decisión contable y tributaria.
