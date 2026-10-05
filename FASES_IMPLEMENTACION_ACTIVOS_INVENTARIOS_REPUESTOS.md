# Análisis y fases de implementación: Activos, inventarios físicos, repuestos y mantenimiento

**Proyecto:** Kore Inventory  
**Estado:** implementación en curso; migraciones preparadas para ejecución manual, sin despliegue  
**Fecha de actualización:** 2026-10-01

> Este documento conserva el análisis inicial y registra el estado actual por fase. El esquema de RDS se contrastó con la auditoría entregada; la aplicación sigue sin conectarse ni desplegarse en producción.

## 0. Restricciones de infraestructura y entrega

- El entorno de producción descrito en `ESTRUCTURA_SERVIDOR.md` usa AWS EC2 para la aplicación y Amazon RDS para la base de datos. La implementación debe respetar ese entorno y no asumir que producción es una base local.
- Las imágenes actuales usan S3 y CloudFront: S3 almacena los objetos y CloudFront los sirve desde edge locations globales. El flujo existente es híbrido: el usuario puede conservar/ingresar una URL de imagen o subir un archivo; las cargas usan S3 y generan una URL de visualización que puede usar CloudFront. Reutilizar esa integración y sus variables/configuración existentes; verificar su implementación en la Fase 0 antes de extenderla.
- La configuración documentada permite lectura pública de objetos en el bucket. Por tanto, las imágenes de catálogo pueden seguir el mecanismo actual si su visibilidad pública es aceptable, pero evidencias de daños, documentos de mantenimiento o fotos con información sensible no deben quedar públicas por heredar esa configuración. Validar clasificación y controles de acceso antes de elegir almacenamiento/URL para esos adjuntos.
- Las fases se desarrollarán y validarán antes de realizar el despliegue a producción. El despliegue final se hará una sola vez, al completar todas las fases, sus pruebas y las aprobaciones de salida. No se desplegará cada fase a AWS de forma incremental.
- Cada modificación de esquema se entregará como archivo `.sql` versionado y revisable, acompañado de instrucciones de prevalidación, respaldo, ejecución y verificación. El usuario ejecutará manualmente esos scripts contra RDS en el servidor; no se ejecutarán automáticamente desde la aplicación ni se conectará este agente a producción.
- Los scripts deberán indicar precondiciones, orden, impacto, estrategia de reversa cuando sea viable y consultas de verificación. Se probarán primero en una copia/localización de prueba que refleje el esquema real de RDS. Las credenciales y endpoints sensibles no se incluirán en código ni documentación.

> Resultado de la auditoría productiva recibida el 2026-10-01: ver [AUDITORIA_FASE0_ACTIVOS_INVENTARIOS_RDS.md](AUDITORIA_FASE0_ACTIVOS_INVENTARIOS_RDS.md). Ese informe es la referencia para el esquema de RDS; no repetir la auditoría completa.

## 1. Resumen ejecutivo

Kore Inventory ya cuenta con una base útil para inventario comercial: productos con SKU, código de barras, imagen y unidad de medida; categorías asociadas a la empresa; bodegas; existencias por bodega; movimientos de inventario; traslados; y ajustes manuales/masivos. La implementación nueva reutiliza ese catálogo y añade dominios de activos, mantenimiento, repuestos serializados e inventario físico; el estado de cada fase se mantiene en la sección 15.

La auditoría productiva confirmó que esos modelos no existían al corte inicial. Sus implementaciones locales están en curso y aún no se han desplegado ni creado en RDS.

La recomendación es construir un dominio integrado, no duplicar el catálogo comercial ni el stock. Los repuestos consumibles deben reutilizar `productos` y `productos_bodegas`; las unidades serializadas necesitan identidad y movimientos individuales adicionales. Los activos fijos deben tener identidad, ciclo de vida, asignaciones y mantenimiento propios, aunque puedan tener componentes/repuestos instalados.

El inventario físico debe capturar conteos independientes y ciegos por bodega, consolidar líneas repetidas y conciliar contra una instantánea de stock tomada en un punto de corte. La conciliación no debe modificar existencias. Las diferencias deben pasar por solicitud, revisión y autorización, y el ajuste autorizado debe producir movimientos en el libro existente dentro de una transacción.

## 2. Alcance de la revisión del código existente

### Evidencia revisada

- `backend/src/platform/inventario/inventario.controller.ts` y `inventario.routes.ts`.
- `backend/src/routes.ts` para el montaje de middleware y rutas.
- `SQL/kore_inventory_full.sql` para categorías y productos.
- `SQL/migration_bodegas_traslados.sql` para bodegas y stock por bodega.
- `SQL/inventario_movimientos.sql` para la estructura del libro de movimientos.
- Documentos `ANALISIS_ARQUITECTURA_CATEGORIAS.md`, `ARQUITECTURA_MODULOS.md`, `SISTEMA_PERMISOS_GRANULARES.md` y `GUIA_USO_BODEGAS_TRASLADOS.md`.
- Listado de módulos de `backend/src/platform/` y páginas de `frontend/public/`.

### Arquitectura actual observada

- **Backend:** TypeScript con Express; rutas y controladores organizados bajo `backend/src/platform/`. Las operaciones de inventario usan consultas SQL y existe `withTransaction()` para operaciones transaccionales.
- **Frontend:** páginas HTML con lógica JavaScript por módulo. La documentación existente describe Bootstrap 5, componentes compartidos de navegación y almacenamiento de sesión/empresa en `localStorage`.
- **Base de datos:** SQL compatible con MySQL/MariaDB e InnoDB en los archivos revisados. El dump principal y las migraciones incrementales no necesariamente representan el mismo estado que producción.
- **Producción e imágenes:** `ESTRUCTURA_SERVIDOR.md` documenta EC2, RDS y el bucket S3 existente para imágenes con distribución CloudFront; además, indica que los SQL no se ejecutan automáticamente. La carga genera una URL de imagen y también se admiten URL manuales. El bucket documentado tiene lectura pública, por lo que no se debe asumir que sirve para adjuntos confidenciales.
- **Multiempresa:** entidades como productos, categorías y bodegas tienen `empresa_id`; los endpoints de inventario se montan detrás de autenticación y verificación de empresa activa. Cada controlador nuevo debe volver a validar el tenant en servidor, sin confiar en el `empresaId` del navegador.
- **Permisos:** existe el modelo `modulo.accion` y middleware como `requirePermission`. Las rutas de inventario actualmente no declaran permisos granulares propios, aunque el montaje global sí agrega autenticación y verificación de empresa activa.
- **Bodegas:** hay bodegas de empresa y stock de productos por bodega (`productos_bodegas`), con ubicación interna. Se contemplan traslados entre bodegas.

## 3. Funcionalidades existentes reutilizables

| Capacidad | Evidencia | Reutilización recomendada |
|---|---|---|
| Catálogo de productos | `productos`: `empresa_id`, SKU, código de barras, categoría, costo/precio, unidad, imagen y stock global | Usarlo como catálogo canónico de repuestos consumibles; añadir metadatos solo cuando el requerimiento no encaje en el producto actual. |
| Categorías | `categorias` tiene `empresa_id`, nombre, descripción, icono y color; está orientada a clasificación comercial | Reutilizar para categorías de producto/repuesto cuando tenga sentido; no mezclarla automáticamente con categorías de activos, que tienen ciclo de vida y atributos distintos. |
| Bodegas y ubicaciones | `bodegas`, `productos_bodegas` con cantidad, reservas, mínimos, máximos y ubicación | Reutilizar para stock, sesiones de conteo y localización de repuestos. La jerarquía pasillo/rack/nivel puede requerir entidad propia si se necesita validar ubicaciones. |
| Movimientos de inventario | `inventario_movimientos` almacena cantidad, stock anterior/nuevo, motivo, referencia y usuario | Mantenerlo como libro de movimientos de productos y enlazar cada movimiento con la solicitud de ajuste, mantenimiento o instalación correspondiente. Confirmar extensión para bodega y trazabilidad. |
| Traslados | Flujo existente con origen, destino, aprobación, envío y recepción | Reutilizar el patrón de estados, permisos, auditoría y UI; no reutilizar la entidad de traslado para órdenes de mantenimiento. |
| Permisos y usuarios | `requirePermission(modulo, accion)` en rutas como nómina/finanzas y jerarquía de roles documentada | Añadir permisos al sistema existente y al sidebar. No crear autorización paralela. |
| Transacciones | `withTransaction()` usado por ajustes de inventario | Usarlo para aplicación de ajustes y actualizaciones de existencias serializadas; implementar idempotencia y bloqueo de filas para concurrencia. |
| Imágenes de productos | `productos.imagen_url`; carga existente hacia S3 y URL servida por CloudFront | Mantener ambas opciones: URL manual y subida de archivo; para carga, reutilizar el endpoint/configuración existente y producir URL CloudFront cuando esté configurado. Para evidencias, guardar metadatos y revisar privacidad por tipo antes de reutilizar el bucket de lectura pública. |

## 4. Funcionalidad nueva requerida

1. Registro y ciclo de vida de activos fijos con código único por empresa, categorías/tipos y atributos configurables.
2. Asignaciones de activos a responsables, bodegas y ubicaciones, con historial y eventos no destructivos.
3. Órdenes e historial de mantenimiento, con técnico, diagnóstico, tareas, costos, adjuntos y repuestos usados/retirados.
4. Compatibilidad de repuestos con activos/tipos; trazabilidad de unidades serializadas que pasan por stock, instalación, retiro, reparación, cuarentena y baja.
5. Inventarios físicos por período, bodega y ronda de conteo, con equipo de conteo y auditoría.
6. Captura de líneas repetidas por ubicación, correcciones auditadas e ingreso por SKU/código de barras.
7. Conteos ciegos independientes, comparaciones configurables, rondas adicionales y resolución supervisada de diferencias.
8. Conciliación con inventario registrado a una hora de corte, vista por bodega y consolidada.
9. Solicitudes de ajuste separadas de la captura/conciliación, con segregación de funciones y aplicación transaccional autorizada.
10. Centro de operaciones, reportes, permisos, uso móvil y estrategia gradual de trabajo con conectividad inestable.

## 5. Problemas y riesgos detectados

- El dump `SQL/kore_inventory_full.sql` contiene productos/categorías, pero las bodegas y existencias por bodega aparecen en migraciones aparte. Es una señal de que no se debe diseñar una migración basándose solo en el dump.
- La tabla revisada `inventario_movimientos` no tiene `bodega_id`; el controlador de ajustes escribe ahí, mientras actualiza stock por bodega. La trazabilidad histórica por bodega puede ser incompleta. Antes de integrar ajustes nuevos hay que decidir una migración compatible y backfill posible.
- El ajuste masivo existente modifica stock directamente, aunque sea transaccional. No implementa el ciclo de solicitud, aprobación y autorización requerido para el nuevo flujo.
- `inventario.routes.ts` no aplica `requirePermission()` por ruta. `routes.ts` agrega autenticación y empresa activa, pero se debe cerrar la brecha de autorización por acción y auditar el alcance tenant de cada consulta antes de exponer más operaciones.
- El dump SQL local inicial mostraba stock entero, pero la auditoría real de RDS confirma `DECIMAL(15,3)` en productos, stock por bodega y movimientos. Usar esa precisión en capturas/diferencias y no proponer una conversión destructiva basada en el dump desactualizado.
- El modelo de productos existente representa cantidades agregadas, no identidad serial individual, estados de reparación ni cadena de instalación. El stock numérico no basta para rastrear un repuesto que se reinstala en otro activo.
- Los conteos concurrentes sin instantánea/corte pueden compararse contra stock que cambió durante la toma. La hora de corte y el tratamiento de movimientos durante el inventario son decisiones de integridad, no detalles de UI.
- Una ausencia de producto en una ronda no equivale siempre a cero: puede ser una ronda incompleta o un producto fuera del alcance. Se necesita cobertura explícita por bodega/ronda antes de resolver diferencias.
- Se encontró uso de `localStorage` en el frontend; no se encontró uso de IndexedDB, Service Worker ni bibliotecas conocidas de escaneo en la búsqueda realizada. No asumir capacidad offline ni cámara ya implementadas.
- Los datos de fotos/evidencias requieren límites, permisos y almacenamiento privado. No guardar imágenes grandes como blobs/base64 en tablas transaccionales.
- Un solo usuario no debería poder realizar y aprobar el mismo ajuste en flujos sujetos a control interno, salvo excepción configurable y auditada.

## 6. Arquitectura funcional propuesta

### Contrato funcional base para avanzar con el MVP

Estas decisiones se adoptan como valores iniciales de implementación para no bloquear el avance. No cambian RDS ni producción y pueden ajustarse antes del despliegue final.

1. **Tenant y permisos:** cada operación de negocio se resuelve en un `empresa_id` validado en servidor. Para usuarios normales se requiere membresía activa en `usuario_empresa` (y, cuando corresponda, asignación de rol en esa empresa); nunca basta con confiar en query/body. Super Admin puede elegir empresa explícitamente y esa acción queda auditada. Se reutilizan `modulos/acciones/permisos`; se corrige o extiende la verificación para respetar `usuario_rol.empresa_id` y roles de empresa, sin crear un sistema paralelo.
2. **Activos:** identidad propia, código por empresa generado en servidor y no reutilizable; categorías y tipos del dominio de activos, separados de `categorias` de producto. Los campos técnicos se definen por tipo con atributos tipados. Cambios de estado, ubicación y responsable conservan historial; la baja es lógica/auditable.
3. **Repuestos:** producto existente como catálogo/stock para componentes no serializados; perfil adicional solo para clasificarlo como repuesto y declarar compatibilidad. Productos serializados agregan identidad individual y eventos; el stock no serializado continúa en `productos_bodegas`. Cantidades y deltas usan `DECIMAL(15,3)` como en RDS.
4. **Mantenimiento:** orden de trabajo vinculada a activo. El consumo de repuestos, cambio de estado serial y movimiento de stock se confirma en una transacción; cerrar una orden no borra ni sustituye eventos previos.
5. **Conteo físico:** conteos ciegos por ronda y bodega, con alcance/cobertura explícitos. El primer MVP requiere conectividad; el modo offline queda fuera hasta implementar y probar una cola idempotente. Se permiten líneas repetidas por ubicación y se agregan al conciliar. Una ausencia de línea sin cobertura confirmada es “incompleto”, nunca cero.
6. **Corte de stock:** en el MVP se programa ventana por bodega y se bloquean los movimientos de stock de esa bodega mientras la sesión está abierta. No se permite iniciar el conteo si no se puede hacer cumplir el bloqueo en todos los flujos que mutan stock (ventas, compras, traslados, producción y ajustes). El snapshot se toma al comenzar el bloqueo. Movimientos históricos no se reconstruyen por bodega porque el ledger actual no tiene `bodega_id`.
7. **Rondas y resolución:** por defecto se hacen dos rondas independientes; el máximo se configura por inventario. Diferencia entre rondas solicita la siguiente. Una tercera ronda igual a C1 o C2 propone esa cantidad; una tercera distinta queda en revisión manual. Cualquier ronda adicional requiere autorización registrada; al agotar el máximo no se elige promedio, mayoría ni última captura automáticamente.
8. **Ajustes:** secuencia solicitud → revisión → autorización → aplicación. Por defecto solicitante y aprobador son usuarios distintos; el aprobador no puede cambiar cantidades aprobadas. La aplicación ajusta producto+bodega y escribe movimiento en la misma transacción, con clave de idempotencia. No se ajusta stock al cerrar conteos ni al conciliar.
9. **Seriales:** transición inicial propuesta: `available → reserved → installed → repair/quarantine → available` o `unrepairable → retired`; cada transición registra actor, fecha, activo/orden y motivo, y se valida en servidor.
10. **Imágenes:** el usuario puede ingresar URL o subir imagen al mecanismo S3 existente; usar URL de CloudFront para visualización cuando está configurada. Evidencias clasificadas como privadas no se guardan en el bucket público actual.

### Estados canónicos iniciales

| Dominio | Estados iniciales | Reglas |
|---|---|---|
| Activo | `active`, `in_maintenance`, `out_of_service`, `retired`, `lost` | Asignado/responsable y ubicación son relaciones/datos actuales, no estados. `retired` y `lost` requieren motivo y evento. |
| Orden de mantenimiento | `draft`, `scheduled`, `in_progress`, `waiting_parts`, `completed`, `cancelled` | `completed` requiere trabajo realizado y cierre auditado; `cancelled` conserva motivo. |
| Unidad serializada | `available`, `reserved`, `installed`, `in_repair`, `quarantine`, `unrepairable`, `retired` | Solo transiciones autorizadas; `installed` debe apuntar a activo y evento de instalación vigente. |
| Inventario | `draft`, `scheduled`, `counting`, `reconciliation`, `review`, `adjustment_pending`, `closed`, `cancelled` | Solo `closed` es terminal normal; reapertura exige permiso y evento de auditoría. |
| Sesión de conteo | `not_started`, `in_progress`, `completed`, `locked`, `reopened` | Bodega/ronda/alcance quedan congelados al iniciar; `locked` impide capturas ordinarias. |

### Contratos API conceptuales

Nombres sujetos a las convenciones finales del backend. Toda ruta tenant usa autenticación, empresa autorizada y permiso de acción; las rutas no aceptan `empresa_id` como autoridad.

| Recurso | Operaciones iniciales |
|---|---|
| Activos | `GET/POST /api/activos`, `GET/PUT /api/activos/:id`, `POST /api/activos/:id/asignaciones`, `GET /api/activos/:id/historial`. |
| Configuración de activos | `GET/POST/PUT /api/activos/configuracion/categorias`, `/tipos` y `/atributos`, con permiso de configuración. |
| Repuestos | Consulta de productos existentes filtrados como repuestos; compatibilidad y unidades seriales bajo rutas `/api/repuestos`. Los cambios de stock pasan por servicios transaccionales, no por CRUD de perfil. |
| Mantenimiento | `GET/POST /api/mantenimientos`, `GET/PUT /api/mantenimientos/:id`, acciones explícitas para iniciar, registrar partes y cerrar/cancelar. |
| Inventario físico | `GET/POST /api/inventarios-fisicos`, detalle/configuración y acción de apertura/cierre por inventario. |
| Sesiones de conteo | Acciones start, capture, void, finish y reopen bajo inventario/ronda/bodega; capturas con UUID idempotente, sin exponer resultados previos a contadores. |
| Conciliación y ajustes | Comparación/resultados bajo permiso separado; endpoints independientes para solicitar, revisar, aprobar y aplicar ajustes. Aplicar es idempotente y solo acepta solicitud autorizada. |

Los contratos de payload, paginación, códigos de error y rutas definitivas se congelan junto con el diseño SQL de la Fase 2. Ningún endpoint debe alterar stock por campos arbitrarios enviados por frontend.

### 6.1 Dominios

- **Activos:** bien durable identificable, independiente del inventario de venta. Tiene categoría/tipo, código, estado, ubicación, asignación, atributos, documentos, eventos y depreciación futura opcional.
- **Productos/repuestos:** catálogo y existencias siguen en el módulo de productos/inventario. Repuestos no serializados son cantidades de producto. Repuestos serializados añaden identificadores unitarios y movimientos de estado.
- **Mantenimiento:** orden de trabajo vinculada a un activo; consume repuestos del stock mediante movimientos trazables y registra piezas retiradas sin borrar su historial.
- **Inventario físico:** proceso temporal con corte, alcance, rondas ciegas, sesiones, líneas y resultado. No representa el stock disponible ni lo modifica por sí mismo.
- **Ajustes:** flujo de control separado. Su autorización produce una operación inmutable referenciada en `inventario_movimientos` y actualiza el stock por bodega en una transacción.
- **Auditoría/adjuntos:** eventos y ficheros vinculados a entidades con tenant, actor, fecha, acción y referencias al objeto afectado.

### 6.2 Activos y atributos dinámicos

Mantener separados categoría y tipo de activo: una categoría agrupa (por ejemplo, Vehículos) y el tipo precisa (camión, automóvil, montacargas). No imponer campos de placa, RAM o potencia a todos los activos.

Propuesta inicial: definiciones de atributo por empresa/tipo, con tipo de dato, etiqueta, unidad, obligatoriedad, opciones y validaciones; valores tipados asociados al activo. Evitar almacenar todo como texto libre. Si la primera versión no necesita filtros/reportes por características, puede evaluarse JSON validado por esquema, pero no duplicar simultáneamente el mismo atributo en JSON y columnas. La opción final depende de consultas y volumen esperados.

Los códigos del activo deben asignarse en servidor con contador transaccional por empresa y prefijo configurable. `empresa_id + codigo` debe ser único; no calcular consecutivos leyendo y sumando en frontend.

### 6.3 Repuestos y componentes

- Consumible/no serializado: una fila en `productos`, cantidad en `productos_bodegas` y movimientos en el libro de inventario.
- Serializado: producto de tipo controlado + unidad serial identificada por número de serie/lote, con unicidad por empresa/producto y una máquina de estados validada por transiciones.
- Compatibilidad: relación muchos-a-muchos entre producto/repuesto y activo o tipo de activo; no codificar compatibilidades en texto libre.
- Instalación/retiro: evento de componente con unidad o cantidad, activo, orden de mantenimiento, técnico, fecha y causa. Las piezas retiradas pasan a una disposición explícita (stock, reparación, cuarentena, baja); nunca reaparecen en disponible solo por cambiar un campo.
- El movimiento de repuesto y el cambio del estado del activo deben confirmar o revertir juntos donde participen del mismo proceso.

## 7. Modelo de datos propuesto

Nombres conceptuales; ajustar a convenciones y tablas reales tras auditar el esquema activo. Todas las entidades propiedad de una empresa deben llevar `empresa_id`, índices que empiecen por tenant y restricciones que impidan asociar filas de empresas distintas. Usar InnoDB, claves foráneas, índices de consulta y restricciones únicas.

| Entidad conceptual | Propósito y relaciones |
|---|---|
| `asset_categories` | Categorías de activos por empresa; independientes de la taxonomía comercial. |
| `asset_types` | Tipos bajo una categoría, configurables por empresa. |
| `asset_attribute_definitions` | Atributos configurables por tipo, con tipo de dato, validación y versión. |
| `assets` | Ficha del activo; código, tipo, estado, fechas, valores, proveedor/documento, bodega/ubicación y responsable. |
| `asset_attribute_values` | Valores tipados del activo según definiciones activas; índices solo en atributos que realmente se consultarán. |
| `asset_assignments` | Historial append-only de asignación y devolución; usuario responsable, fechas y motivo. |
| `asset_events` | Línea de tiempo de cambios relevantes con actor, fecha, referencia y datos auditables. Reutilizar auditoría existente si cubre el contrato requerido. |
| `asset_media` | Fotos/documentos con propietario, ruta privada, tipo MIME, tamaño, hash, autor y fecha. |
| `maintenance_orders` | Orden/inspección/calibración ligada a activo, estado, diagnóstico, trabajo, técnico, fechas, costos y cierre. |
| `maintenance_order_parts` | Productos/unidades serializadas consumidos o retirados, cantidad, bodega, disposición y referencia a movimientos. |
| `spare_part_compatibility` | Relación repuesto-producto con tipo/activo compatible. |
| `serialized_stock_units` | Identidad, serial/lote, estado y ubicación de cada unidad cuando aplique; no sustituye stock agregado para productos no serializados. |
| `serialized_unit_events` | Historial inmutable de recepción, traslado, instalación, retiro, reparación, cuarentena y baja. |
| `physical_inventories` | Cabecera de período, tenant, código, alcance, ventana horaria, corte, estado y configuración congelada. |
| `inventory_counts` | Rondas numeradas, estado, política de independencia y responsable. Máximo configurable al crear el inventario. |
| `inventory_count_sessions` | Sesión de ronda+bodega, estado, inicio/fin, responsable/dispositivo opcional y versión de catálogo. |
| `inventory_count_members` | Integrantes y rol en la sesión, con vigencia. |
| `inventory_count_lines` | Capturas append-only: producto o unidad serial, cantidad, ubicación, actor, UUID idempotente y anulaciones auditadas. |
| `inventory_stock_snapshots` | Stock teórico por producto+bodega para el corte; almacenar origen/versionado y no recalcular con movimientos posteriores. |
| `inventory_reconciliations` | Comparación por ronda, producto y bodega; cobertura, cantidades, diferencias, estado y decisión. |
| `inventory_resolution_events` | Decisiones de rondas adicionales, revisión manual y cierre, con aprobador y evidencia. |
| `inventory_adjustment_requests` | Solicitud derivada de una conciliación aprobada, motivo, estado, solicitante/revisor/aprobador y valores esperados. |
| `inventory_adjustment_lines` | Delta por producto+bodega, valor anterior, cantidad conciliada, valor nuevo y referencia a movimiento aplicado. |
| Auditoría/adjuntos existentes | Reutilizar si garantizan tenant, actor, timestamp, acción y referencias; si no, ampliar o crear estructura común. |

### Integridad y rendimiento

- Considerar claves foráneas compuestas (por ejemplo, tenant+ID) o validaciones transaccionales equivalentes para impedir referencias cruzadas entre empresas.
- Índices para `(empresa_id, estado, fecha)`, `(empresa_id, bodega_id, producto_id)`, código de activo por empresa, SKU/código de barras por empresa y las claves de unicidad de sesión/línea.
- Capturas repetidas en distintas ubicaciones se conservan como líneas; el agregado por producto se calcula con `SUM`, bajo el alcance de la sesión. Corregir/anular crea evento compensatorio, no borrado silencioso.
- Congelar la configuración de rondas, el corte y las reglas de resolución al iniciar el inventario, para que un cambio posterior de configuración no reescriba resultados históricos.
- Cualquier ajuste que actualice stock agregado, stock por bodega y movimientos debe usar una única transacción, bloqueo de fila y clave de idempotencia.

## 8. Flujos principales

### Activo
1. Administrador configura categoría, tipo y atributos requeridos.
2. Usuario autorizado registra activo; backend asigna código por empresa y valida los campos definidos para el tipo.
3. Se registra adquisición, estado inicial, bodega/ubicación, fotos/documentos y responsable si existen.
4. Asignaciones, traslados, cambios de estado, mantenimientos y componentes generan eventos; la ficha presenta información actual más historial.
5. Baja cierra el ciclo de vida y registra motivo, fecha, actor y documentos. No se elimina físicamente un activo con historial.

### Repuesto y mantenimiento
1. Seleccionar activo/orden, tipo de trabajo y bodega de consumo.
2. Añadir repuestos disponibles; validar empresa, existencia, reserva, compatibilidad y serial si aplica.
3. Confirmar instalación/consumo y retiro en transacción, vincular cada movimiento con la orden y registrar técnico/fecha/causa.
4. Enviar pieza retirada a stock reparable, cuarentena, reparación o baja mediante una transición explícita y documentada.
5. Cerrar la orden con costos, evidencia y resultado; emitir historial consultable del activo y de cada unidad serializada.

### Inventario físico y ajuste
1. Crear período, seleccionar bodegas/productos, horario autorizado, cantidad máxima de rondas, equipos y reglas de corte.
2. Al llegar la ventana autorizada, crear sesión por ronda+bodega y capturar su cobertura; miembros del siguiente conteo no reciben resultados previos ni stock teórico.
3. Capturar cada observación con escaneo o digitación, ubicación, cantidad y UUID único. Líneas repetidas se agregan en la conciliación, no se bloquea su entrada.
4. Cerrar sesión; bloquear nuevas líneas salvo reapertura autorizada que quede auditada.
5. Comparar rondas y stock congelado. Una ronda incompleta se identifica como incompleta, no como cero.
6. Resolver diferencias según la política aprobada; dejar pendientes las discrepancias que excedan rondas o no cumplan cobertura.
7. Crear solicitud de ajuste solo desde una conciliación aprobada. Revisión y autorización por actores autorizados y, por defecto, distintos.
8. Aplicar exactamente una vez por transacción, producir movimientos referenciados, guardar antes/después y cerrar inventario con snapshot y reporte inmutable.

## 9. Permisos propuestos

Usar nombres del sistema actual `modulo.accion`; confirmar catálogo, pantalla de configuración y reglas de acceso en servidor antes de añadirlos.

- `activos.view`, `activos.create`, `activos.edit`, `activos.assign`, `activos.retire`, `activos.view_history`, `activos.export`.
- `activos_config.view`, `activos_config.manage` para categorías, tipos y atributos.
- `mantenimientos.view`, `mantenimientos.create`, `mantenimientos.edit`, `mantenimientos.close`, `mantenimientos.export`.
- `repuestos.view`, `repuestos.create`, `repuestos.edit`, `repuestos.move`, `repuestos.install`, `repuestos.remove`, `repuestos.repair`, `repuestos.retire`, `repuestos.export`.
- `inventarios_fisicos.view`, `inventarios_fisicos.create`, `inventarios_fisicos.manage`, `inventarios_fisicos.count`, `inventarios_fisicos.close_count`, `inventarios_fisicos.view_results`, `inventarios_fisicos.reopen`, `inventarios_fisicos.reconcile`, `inventarios_fisicos.approve_reconciliation`, `inventarios_fisicos.export`.
- `ajustes_inventario.request`, `ajustes_inventario.review`, `ajustes_inventario.approve`, `ajustes_inventario.apply`.

Separar `view_results` de `count` para evitar contaminación de rondas. Aplicar mínimo privilegio; `admin_empresa` no debe ser la única regla de negocio. Asegurar autorización a nivel de ruta y de objeto, verificar que cada activo/producto/bodega/sesión pertenezca al tenant activo y filtrar el sidebar solo como experiencia visual, nunca como barrera de seguridad.

## 10. Conciliación y estrategia de rondas

- Cada inventario define máximo de rondas y política. Cada ronda cubre explícitamente productos y ubicaciones que le corresponde contar.
- Usar una instantánea del stock por bodega al corte, junto con política para ventas, compras, traslados y otros movimientos durante el conteo: bloquear movimientos, pausar operaciones o mantener libro de movimientos y calcular el saldo al instante de corte. La opción debe decidirse con operaciones/contabilidad.
- Los usuarios de una ronda no consultan cantidades de otras rondas ni el saldo de sistema. La presentación de resultados se limita a perfiles designados y a estados autorizados.
- Comparación inicial: si dos rondas completas tienen la misma cantidad conciliada por producto+bodega, marcar coincidencia. Si divergen, requerir siguiente ronda según configuración.
- Con ronda 3 coincidente con una anterior, proponer el valor coincidente, indicando evidencia y regla aplicada; exigir autorización de conciliación cuando la política lo indique.
- Si la ronda 3 no coincide con ninguna, mantener “requiere revisión”; permitir ronda 4 solo si está configurada y aún disponible. Si el máximo se agota, resolución manual con motivo, actor y evidencia; no elegir automáticamente promedio, última cifra ni mayoría sin regla aprobada.
- Para distinguir cero de no contado, registrar cobertura explícita: ítem contado en alcance con cero es cero; ausencia de línea sin cobertura confirmada es incompleto.
- Consolidado: sumar resultados por bodegas del mismo corte; comparar con suma de stock teórico de esas mismas bodegas. Mostrar por bodega y consolidado, evitando comparar una cifra global con bodegas parcialmente contadas.

## 11. Estrategias específicas

### Inventarios simultáneos y concurrencia
UUID idempotente de captura y restricción única por sesión; operaciones de cierre con control de versión/estado. Definir si un producto puede estar en dos sesiones colaborativas y cómo se evita duplicar cantidades. La captura física debe seguir siendo línea por observación; la prevención de doble envío de una misma observación se resuelve con idempotencia, no deduplicando cantidades iguales.

### Auditoría
Eventos append-only con usuario, hora de servidor, tenant, entidad/ID, acción, motivo, antes/después cuando corresponda, referencia y metadatos permitidos. No confiar en hora/dispositivo del cliente. Registrar inicio/cierre/reapertura, cambio o anulación de línea, cambios de equipos, decisión, solicitud, aprobación, aplicación, movimiento serial y adjuntos. No almacenar secretos ni datos personales del dispositivo innecesarios.

### Móvil y trabajo de campo
Priorizar flujo corto: inventario → ronda → bodega → sesión/equipo → captura de código/cantidad → confirmar → finalizar bodega. Controles grandes, foco de escáner, edición explícita y estado de sincronización. Implementar offline solo tras prueba de campo: catálogo/scope precargados, cola local IndexedDB, UUID por evento, reintento idempotente, validación de ventana/estado al sincronizar y conflictos en cola de revisión. No indicar “guardado en servidor” mientras el dato solo exista localmente.

### Código de barras/QR
Probar primero `BarcodeDetector` donde esté disponible, pero no depender de él por compatibilidad desigual entre navegadores móviles. Si las pruebas lo requieren, adoptar una biblioteca mantenida (por ejemplo, ZXing) con formatos priorizados por el catálogo. Permitir teclado/manual como alternativa, validar empresa y producto en backend, controlar doble lectura por estado de captura y no descartar legítimas líneas repetidas. Solicitar cámara solo al iniciar escaneo y manejar permisos denegados, HTTPS, falta de foco y hardware ausente.

### Fotografías y documentos
Para imágenes de catálogo/ficha cuya publicación sea aceptable, ofrecer un campo de URL manual y un control de carga de archivo. La carga reutiliza la integración S3 ya existente; se comprime en cliente con el patrón vigente, y la URL de visualización usa CloudFront cuando está configurado. No forzar la carga ni invalidar una URL manual existente al editar otros campos.

Para evidencias de daños, mantenimientos, conteos o ajustes, guardar metadatos y referencia al archivo, limitar tamaño/formato, validar MIME real, retirar EXIF sensible, usar claves no predecibles y comprobar autorización por empresa/entidad. Como el bucket documentado permite lectura pública y CloudFront expone sus objetos, determinar si cada clase de evidencia puede ser pública antes de subirla allí. Si requiere confidencialidad, usar un mecanismo privado separado o una política de acceso controlado y URLs firmadas; no asumir que el bucket actual ofrece privacidad. Ligar cada evidencia al evento que la originó.

### Reportes y dashboard
Centro de control con avance por bodega/ronda, sesiones activas, conteos incompletos, discrepancias, diferencias vs. snapshot, conciliaciones pendientes y ajustes esperando aprobación. Acciones llevan a la lista filtrada correspondiente. Reportes descargables CSV/Excel primero; PDF después de validar formato, permisos de exportación, anonimización necesaria y límites de volumen.

## 12. Referencia a prácticas de sistemas profesionales

Esta revisión no realizó investigación web ni incorpora código o interfaces propietarios. La propuesta toma como criterios generales de diseño operacional: conteo ciego, corte reproducible, separación entre captura y aprobación, libro de movimientos inmutable, segregación de funciones, idempotencia, seguimiento de lote/serie y auditoría con autor/fecha. Antes de adoptar una práctica como requisito formal, validar con las políticas contables, operativas y regulatorias de las empresas usuarias.

## 13. Preguntas y decisiones pendientes

Las reglas de “Contrato funcional base para avanzar con el MVP” son los defaults adoptados para implementar. Las preguntas de esta tabla documentan límites, extensiones o decisiones que todavía requieren validación específica; no reabren los defaults ya fijados.

| Pregunta | Recomendación inicial por validar |
|---|---|
| ¿Reutilizar categorías actuales? | Reutilizar categorías comerciales para productos/repuestos; crear taxonomía de activos separada. |
| ¿Qué características de productos ya existen? | Inventariar esquema activo y módulos de producto antes de añadir columnas; reutilizar SKU, código de barras, unidad e imagen. |
| ¿Cómo se relacionan activos y productos? | Relación solo donde haya componente/repuesto; el activo no debe ser producto vendible por defecto. |
| ¿Todo repuesto es un producto? | Sí para existencias y movimientos de piezas consumibles; permitir metadatos de repuesto relacionados. |
| ¿Cómo se manejan seriales y lotes? | Decidir por empresa/producto; añadir unidad serial y eventos individuales solo para los que requieran trazabilidad. |
| ¿Cómo se manejan ubicaciones? | Reutilizar ubicación actual por bodega inicialmente; definir jerarquía física si se requiere validación/picking. |
| ¿Un activo tiene varios componentes? | Sí, con instalaciones/remociones históricas; confirmar si se necesitan jerarquías de subactivos. |
| ¿Depreciación? | Diseñar campos base de adquisición, pero dejar cálculo contable fuera de la primera entrega hasta definir norma y método. |
| ¿Baja o transferencia entre empresas? | Baja auditable; transferencia interempresa como proceso explícito con origen/destino y permisos de ambas empresas, no cambio directo de `empresa_id`. |
| ¿Movimientos de repuestos entre bodegas? | Reutilizar traslados para stock agregado; crear eventos seriales vinculados al traslado si el producto está serializado. |
| ¿Inventario físico de serializados? | Escanear identidad serial por unidad y detectar duplicados/ubicación discrepante; no contar solo cantidad agregada. |
| ¿Cómo evitar dobles escaneos? | UUID idempotente por captura y confirmación de interfaz; no suprimir lecturas iguales intencionales. |
| ¿Dos conteos simultáneos? | Sesiones distintas, alcance explícito, captura concurrente permitida dentro de equipo con control de versión e idempotencia. |
| ¿Qué ocurre sin conexión? | MVP en línea con borrador claramente distinguido; offline limitado posterior con cola durable y resolución de conflictos. |
| ¿Ajuste autorizado por quién? | Solicitante, revisor y aprobador configurables; separación solicitante/aprobador como regla por defecto. |
| ¿Quién ve resultados previos? | Solo roles de control autorizados; contadores no ven stock teórico ni otros resultados antes de cierre permitido. |
| ¿Cómo tratar conteos incompletos? | No inferir cero; impedir conciliación hasta cerrar cobertura o marcar excepción aprobada. |
| ¿Cuándo coincide la ronda 3? | Coincidencia exacta por producto+bodega con ronda completa; definir tolerancias solo para unidades fraccionarias aprobadas. |
| ¿Qué hacer si ronda 4 no coincide? | Revisión manual documentada; no promediar ni escoger automáticamente una cifra. |
| ¿Cómo se cierra inventario? | Cerrar después de conciliaciones y ajustes aprobados o excepciones justificadas; snapshot final inmutable y reapertura con permiso/auditoría. |
| ¿Qué movimientos se permiten durante el conteo? | Default del MVP: bloquear movimientos de stock en la bodega mientras su sesión está abierta; si no se puede hacer cumplir en todos los flujos, no iniciar la sesión. No reconstruir históricos por bodega sin fuente fiable. |
| ¿Cuánto dura evidencia fotográfica? | Definir política de retención, límites de almacenamiento y permisos por empresa antes de habilitar cámara. |
| ¿Cuántas rondas y cómo se cambian? | Máximo configurable por empresa, copiado al inventario al crearlo; no alterar rondas de inventarios abiertos. |
| ¿Qué escala y reportes requiere el producto? | Estimar bodegas, SKUs, capturas/día y retención para elegir índices, paginación y exportación asíncrona. |

## 14. Recomendaciones y orden de decisiones

1. Validar este análisis con responsables de inventario, mantenimiento, contabilidad y seguridad.
2. Usar [AUDITORIA_FASE0_ACTIVOS_INVENTARIOS_RDS.md](AUDITORIA_FASE0_ACTIVOS_INVENTARIOS_RDS.md) como corte del esquema productivo. La salida puntual de índices/RBAC ya fue recibida; no repetir esas consultas.
3. Verificar el endpoint de carga S3, la generación de URL mediante CloudFront, el manejo de URL manual y las políticas públicas del bucket; reutilizar el flujo híbrido para imágenes no sensibles y definir por separado el acceso a evidencias privadas.
4. Definir alcance MVP: activos, repuestos no serializados/serializados, mantenimiento, inventario físico, autorización y dispositivos disponibles.
5. Acordar política de corte y movimientos durante conteo, permisos de visibilidad, resolución de rondas y segregación de aprobaciones.
6. Revisar y cerrar el aislamiento tenant y permisos del inventario actual antes de reutilizar su endpoint de ajustes.
7. Probar rendimiento y experiencia en un caso real de bodega con mala conectividad antes de prometer soporte offline.
8. Aprobar modelo de datos y estrategia de migración/backfill antes de crear tablas o cambiar contratos de API.

## 15. Plan de implementación por fases

Las fases son propuestas. Las migraciones/tablas listadas son conceptuales hasta completar la auditoría y la decisión de diseño. Cada fase incluye objetivo, funcionalidades, datos, componentes/APIs, permisos, validaciones, riesgos, pruebas, aceptación y dependencias. Se implementarán y validarán antes de producción; los despliegues de fase son a entornos de desarrollo/prueba. Los scripts destinados a RDS se entregarán para ejecución manual del usuario, no se aplicarán automáticamente.

### Fase 0 — Auditoría del sistema actual
- **Objetivo/funcionalidades:** inventariar versión y estado real de RDS, migraciones, categorías, productos, bodegas, movimientos, auditoría, flujo S3/CloudFront de imágenes, usuarios, tenant, permisos y sidebar.
- **Datos/componentes/APIs:** completado sin cambios en RDS; registrar la salida recibida en [AUDITORIA_FASE0_ACTIVOS_INVENTARIOS_RDS.md](AUDITORIA_FASE0_ACTIVOS_INVENTARIOS_RDS.md), contrastar con SQL del repositorio e inspección local del endpoint de carga, helper S3/CloudFront, URL manual, compresión, rutas y middleware.
- **Permisos/validaciones:** comprobar middleware efectivo, empresa activa y acceso cruzado por cada endpoint existente.
- **Riesgos/pruebas/aceptación:** dump desactualizado o instalaciones divergentes; el corte productivo, columnas, índices y RBAC recibidos están documentados. La auditoría define el diseño, pero no verifica el estado vivo posterior al corte.
- **Dependencias:** ninguna; bloqueo para toda migración.

### Fase 1 — Arquitectura funcional
- **Estado:** IMPLEMENTADA (contrato funcional MVP, estados y APIs conceptuales documentados en la sección 6).
- **Objetivo/funcionalidades:** límites de dominios y decisiones funcionales base del MVP documentados en la sección 6; incluye estados, corte por bodega, conteos ciegos, aprobación, seriales e imágenes.
- **Datos/componentes/APIs:** contratos API conceptuales y dependencias documentados; sin migración ni cambios de runtime.
- **Permisos/validaciones:** tenant debe validarse por membresía activa y RBAC debe respetar el tenant; permisos separados para conteo, resultados, conciliación y aprobación.
- **Riesgos/pruebas/aceptación:** decisiones conservadoras registradas como defaults de implementación; falta validar la imposibilidad de movimientos durante sesiones contra todos los flujos de stock en fases de implementación. Aceptar la fase cuando el contrato funcional sea coherente con el esquema RDS auditado y no requiera decisiones externas para iniciar Fase 2.
- **Dependencias:** Fase 0.

### Fase 2 — Diseño de base de datos
- **Estado:** IMPLEMENTADA (script de esquema/RBAC preparado; no ejecutado en ninguna base).
- **Objetivo/funcionalidades:** modelo lógico/físico para RDS, integridad tenant, índices, retención, migraciones y backfill.
- **Datos/componentes/APIs:** [SQL/migration_20261001_fase2_activos_inventarios.sql](SQL/migration_20261001_fase2_activos_inventarios.sql) define 30 tablas nuevas y 123 claves foráneas, seeds RBAC, tabla de bloqueo por bodega y `bodega_id`/tipos de referencia nuevos en `inventario_movimientos`. No utiliza triggers: el backend bloquea filas de bodega y valida `inventarios_bodega_bloqueos` en cada transacción de stock. [SQL/migration_20261001_fase4_repuestos.sql](SQL/migration_20261001_fase4_repuestos.sql) añade el perfil reutilizado por el módulo existente de repuestos. Conserva `DECIMAL(15,3)`, reutiliza índices únicos existentes y no atribuye bodega a movimientos históricos. El orden y precondiciones están en [SQL/ORDEN_EJECUCION_ACTIVOS_INVENTARIOS.md](SQL/ORDEN_EJECUCION_ACTIVOS_INVENTARIOS.md).
- **Permisos/validaciones:** unicidad por empresa, claves foráneas, tenant en hijos, snapshots e idempotencia.
- **Riesgos/pruebas/aceptación:** volumen/locking y datos históricos; validar el script sobre copia de MySQL 8.4.8, rollback y explain de consultas críticas antes de RDS. El único cliente local disponible es MariaDB 10.4.32 y no certifica compatibilidad con MySQL 8.4.8; el script no se ha ejecutado. La ejecución contra RDS queda manual a cargo del usuario al despliegue final.
- **Dependencias:** Fases 0 y 1.

### Fase 3 — Activos
- **Estado:** SI (implementación local: CRUD, atributos dinámicos, asignaciones, baja, historial e imágenes públicas; pruebas finales pendientes).
- **Objetivo/funcionalidades:** alta, ficha, código por empresa, estados, categorías/tipos, atributos y asignaciones.
- **Datos/componentes/APIs:** categorías/tipos/definiciones, `assets`, valores, asignaciones, eventos y API CRUD/ficha/historial.
- **Permisos/validaciones:** permisos `activos.*`; validar código único, tipo/atributos, tenant, baja y cambios de asignación.
- **Riesgos/pruebas/aceptación:** atributos inconsistentes y contador concurrente; probar consecutivos paralelos y acceso cruzado. Aceptar ficha con historial sin borrado destructivo.
- **Dependencias:** Fases 1 y 2.

### Fase 4 — Repuestos
- **Estado:** SI (se reutiliza el módulo existente; compatibilidad, perfiles, unidades serializadas, transiciones y ledger; SQL de perfil separado).
- **Objetivo/funcionalidades:** reutilizar catálogo y stock, marcar metadatos de repuesto, compatibilidad y unidades serializadas opcionales.
- **Datos/componentes/APIs:** productos existentes, compatibilidad, unidades/eventos seriales; API catálogo, disponibilidad, historial y transiciones seriales.
- **Permisos/validaciones:** `repuestos.*` y permisos de producto pertinentes; validar stock/bodega, serie única y transición permitida.
- **Riesgos/pruebas/aceptación:** desincronizar stock agregado y seriales; pruebas de conciliación de cantidades y duplicidad serial. Aceptar trazabilidad completa por unidad cuando serializada.
- **Dependencias:** Fase 2 y decisiones de Fase 1.

### Fase 5 — Mantenimientos
- **Estado:** SI (órdenes, ciclo de vida, costos, repuestos consumibles, vínculos seriales e historial de eventos).
- **Objetivo/funcionalidades:** crear, asignar, ejecutar y cerrar órdenes; registrar trabajos, costos, evidencias y repuestos instalados/retirados.
- **Datos/componentes/APIs:** órdenes, líneas de repuesto, medios y eventos; API de ciclo de vida, consumos, retiros y cierre.
- **Permisos/validaciones:** `mantenimientos.*`, `repuestos.install/remove`; validar activo/tenant, estado de orden, disponibilidad y serial.
- **Riesgos/pruebas/aceptación:** operación parcialmente aplicada; transacción de stock+evento y pruebas de rollback. Aceptar historial reproducible del activo y las piezas.
- **Dependencias:** Fases 3 y 4.

### Fase 6 — Inventarios físicos
- **Estado:** SI (configuración de ventana, bodegas, equipos C1/C2, rondas y snapshots; SQL preparado, no aplicado en RDS).
- **Objetivo/funcionalidades:** período, alcance, ventana horaria, corte, bodegas, máximo de rondas y configuración congelada.
- **Datos/componentes/APIs:** cabecera `physical_inventories`, snapshots y API de crear/configurar/abrir/cerrar.
- **Permisos/validaciones:** `inventarios_fisicos.create/manage`; validar tenant, bodega, ventana, rango, duplicados y política de movimiento.
- **Riesgos/pruebas/aceptación:** movimientos en periodo y snapshots grandes; prueba de corte/reconstrucción. Aceptar configuración histórica inmutable.
- **Dependencias:** Fases 0, 1 y 2.

### Fase 7 — Conteos múltiples
- **Estado:** SI (sesiones, equipos no superpuestos, conteo ciego, cobertura explícita, líneas serializadas, scanner, anulación, cierre y reapertura auditados).
- **Objetivo/funcionalidades:** rondas, sesiones por bodega, equipos, líneas repetidas, captura manual/escáner inicial y bloqueo al cerrar.
- **Datos/componentes/APIs:** conteos, sesiones, miembros y líneas; API start/capture/void/finish/reopen.
- **Permisos/validaciones:** `count`, `close_count`, `reopen`; validar ventana, cobertura, idempotencia, cantidad/unidad, usuario y estado.
- **Riesgos/pruebas/aceptación:** duplicados por reintento o contaminación; pruebas paralelas, repetición de request y aislamiento ciego. Aceptar líneas auditables y ronda independiente.
- **Dependencias:** Fase 6.

### Fase 8 — Centro de operaciones
- **Estado:** SI (KPIs, filtros, avance por bodega/ronda, sesiones y cola de ajustes separada).
- **Objetivo/funcionalidades:** estado/avance por inventario, ronda y bodega, pendientes, actividad y filtros operacionales.
- **Datos/componentes/APIs:** consultas agregadas paginadas; frontend dashboard/tabla y API de resumen sin mutación.
- **Permisos/validaciones:** `inventarios_fisicos.view/manage`; respetar visibilidad de resultados y tenant en cada filtro/export.
- **Riesgos/pruebas/aceptación:** consultas costosas o revelación prematura; probar volumen y usuario contador vs. supervisor. Aceptar indicadores reconciliables con sesiones.
- **Dependencias:** Fases 6 y 7.

### Fase 9 — Conciliación
- **Estado:** SI (consenso de rondas configurable, resultados por bodega, ronda adicional, resolución manual y aprobación).
- **Objetivo/funcionalidades:** comparar rondas entre sí y contra snapshot; mostrar por bodega/consolidado, incompletos y reglas de siguiente conteo.
- **Datos/componentes/APIs:** conciliaciones y eventos de resolución; API compare/reconcile/results.
- **Permisos/validaciones:** `view_results`, `reconcile`, `approve_reconciliation`; validar cobertura, corte, productos serializados y política de rondas.
- **Riesgos/pruebas/aceptación:** interpretar ausencia como cero o sumar cortes distintos; pruebas de coincidencia, diferencia, faltante, sobrante y ronda incompleta. Aceptar resultado determinista y explicable.
- **Dependencias:** Fases 6-8.

### Fase 10 — Ajustes
- **Estado:** SI (solicitud, revisión, autorización y aplicación transaccional con actores segregados y movimiento enlazado).
- **Objetivo/funcionalidades:** solicitar, revisar, aprobar, aplicar y auditar diferencias conciliadas sin ajuste automático.
- **Datos/componentes/APIs:** solicitud/líneas y enlace a `inventario_movimientos`; API request/review/approve/apply.
- **Permisos/validaciones:** `ajustes_inventario.*`; tenant, segregación, motivo/evidencia, stock no negativo, versión esperada e idempotencia.
- **Riesgos/pruebas/aceptación:** doble aplicación y stock cambiado desde el corte; prueba concurrente/rollback y reconciliación contable. Aceptar movimiento aplicado una vez con valores anteriores/nuevos.
- **Dependencias:** Fase 9 y auditoría de Fase 0.

### Fase 11 — Código de barras / QR
- **Estado:** SI (escaneo de SKU/código de barras y serial; validación de bodega/alcance en backend; captura manual disponible).
- **Objetivo/funcionalidades:** lector móvil con códigos priorizados, entrada manual y alternativa de teclado.
- **Datos/componentes/APIs:** frontend de captura y endpoint existente de resolución de SKU/barcode; no requiere tabla salvo formatos adicionales justificados.
- **Permisos/validaciones:** permiso de conteo; validar producto/tenant/cámara/HTTPS, permiso de cámara y doble submit.
- **Riesgos/pruebas/aceptación:** compatibilidad móvil y lecturas repetidas; matriz de dispositivos/navegadores y formatos reales. Aceptar escaneo fiable con recuperación manual.
- **Dependencias:** Fase 7 y catálogo/decisión de formatos.

### Fase 12 — Fotografías y documentos
- **Estado:** SI en código: imágenes públicas de activos y evidencias privadas por entidad, con bucket distinto, URLs firmadas, límite/MIME/firmas y limpieza EXIF en imágenes. Producción requiere configurar `AWS_S3_PRIVATE_BUCKET` y su política privada.
- **Objetivo/funcionalidades:** admitir URL manual o carga de foto para imágenes de activos/repuestos y gestionar evidencias de mantenimiento, conteos y ajustes con política de acceso según sensibilidad.
- **Datos/componentes/APIs:** las imágenes no sensibles reutilizan el bucket público/CloudFront. Las evidencias usan `AWS_S3_PRIVATE_BUCKET`, URLs firmadas y la tabla común `activos_archivos`; el bucket y permisos AWS requeridos están documentados en [SQL/ORDEN_EJECUCION_ACTIVOS_INVENTARIOS.md](SQL/ORDEN_EJECUCION_ACTIVOS_INVENTARIOS.md).
- **Permisos/validaciones:** permisos del objeto origen; tenant, URL y dominio permitidos según política, MIME real, tamaño, autorización y vencimiento de enlaces privados cuando aplique.
- **Riesgos/pruebas/aceptación:** fuga por lectura pública, malware, EXIF y costo de almacenamiento; pruebas de URL manual, carga, CloudFront, acceso cruzado y clasificación pública/privada. Aceptar imágenes públicas compatibles con el flujo actual y evidencias protegidas según su clasificación.
- **Dependencias:** política de almacenamiento (Fase 0), luego entidades de Fases 3-10.

### Fase 13 — Auditoría
- **Estado:** SI (eventos de dominio append-only para activos, seriales, mantenimiento, conteo, conciliación y ajustes).
- **Objetivo/funcionalidades:** trazabilidad inmutable de acciones y eventos operativos críticos.
- **Datos/componentes/APIs:** reutilizar/ampliar auditoría existente o tabla de eventos; API de consulta filtrada/export controlado.
- **Permisos/validaciones:** acceso de auditoría dedicado; actor de servidor, tenant, valores permitidos y no edición por UI.
- **Riesgos/pruebas/aceptación:** volumen, datos sensibles y eventos sin transacción; probar completitud, atomicidad y límites de retención. Aceptar reconstrucción de quién/cuándo/qué.
- **Dependencias:** modelo de Fase 2 y flujos de Fases 3-12.

### Fase 14 — Reportes
- **Estado:** SI para CSV tenant-scoped de activos, mantenimiento, repuestos, conciliación y ajustes; NO se implementó PDF ni exportación Excel.
- **Estado:** NO (no se implementó el paquete de reportes/exportaciones CSV/Excel).
- **Objetivo/funcionalidades:** activos, mantenimientos, stock/trazabilidad de repuestos, inventarios, diferencias, pendientes y ajustes.
- **Datos/componentes/APIs:** consultas paginadas/agrupadas y exportación CSV/Excel; PDF solo con necesidad validada.
- **Permisos/validaciones:** `export` específico y alcance tenant; validar filtros, límites, fórmulas CSV y datos personales.
- **Riesgos/pruebas/aceptación:** reportes inconsistentes o pesados; comparar totales con ledger/snapshot y probar grandes volúmenes. Aceptar totales reproducibles y export autorizado.
- **Dependencias:** Fases 3-10 y 13.

### Fase 15 — Permisos
- **Estado:** SI (permisos del catálogo existente, controles por ruta/acción/tenant y cola de ajustes separada).
- **Objetivo/funcionalidades:** configurar acciones del dominio en roles y restringir sidebar/API.
- **Datos/componentes/APIs:** catálogo de permisos/rol existente, rutas, menú y utilidades de permisos; no crear tablas paralelas.
- **Permisos/validaciones:** matriz aprobada `activos`, `mantenimientos`, `repuestos`, `inventarios_fisicos`, `ajustes_inventario`; deny-by-default para acciones críticas.
- **Riesgos/pruebas/aceptación:** permiso visible sin autorización backend; pruebas de rol por acción, objeto y tenant. Aceptar 403 en toda operación no permitida.
- **Dependencias:** arquitectura funcional (Fase 1); completar antes de liberar módulos afectados.

### Fase 16 — Pruebas
- **Estado:** SI para build y suite automatizada local: 8 pruebas pasan (guards tenant/permisos, claves/firmas privadas, CSV y regla C1/C2/C3/C4). No reemplaza ensayo contra MySQL 8.4.8 ni regresión operativa de RDS.
- **Objetivo/funcionalidades:** pruebas unitarias, integración, regresión, concurrencia, móvil y casos de excepción de todo el dominio.
- **Datos/componentes/APIs:** fixtures tenant A/B, seriales, movimientos, rondas y approvals; suite automatizada en backend/frontend según infraestructura real.
- **Permisos/validaciones:** probar matriz completa, APIs, filtrado y exportación.
- **Riesgos/pruebas/aceptación:** casos felices no cubren concurrencia/datos históricos; incluir stock negativo, request duplicado, fallo parcial, offline/reintento y rollback. Aceptar gates acordados sin regresión del inventario actual.
- **Dependencias:** fases funcionales implementadas; pruebas de cada fase deben precederla.

### Fase 17 — Seguridad multiempresa
- **Estado:** SI para guards locales y casos negativos de tenant/permisos y claves privadas; las pruebas contra datos reales de empresas A/B quedan para la copia de RDS, antes del despliegue.
- **Objetivo/funcionalidades:** verificación integral de aislamiento a nivel de endpoint, query, adjunto, reportes y procesos asíncronos.
- **Datos/componentes/APIs:** todos los recursos y referencias tenant; revisión de middleware, SQL y tareas.
- **Permisos/validaciones:** empresa activa derivada de identidad/servidor, membresía vigente y autorización por recurso; no confiar en IDs de cliente.
- **Riesgos/pruebas/aceptación:** IDOR, joins sin tenant y adjuntos adivinables; pruebas negativas de empresa A contra IDs conocidos de B. Aceptar cero accesos cruzados en suite.
- **Dependencias:** implementaciones de dominio y Fase 15; gate obligatorio de salida.

### Fase 18 — Optimización móvil y conectividad
- **Estado:** NO para offline; el MVP opera en línea. El flujo móvil de cámara está implementado.
- **Objetivo/funcionalidades:** ergonomía en teléfono/tablet; medición de desempeño; prototipo offline limitado si se aprueba.
- **Datos/componentes/APIs:** interfaces de captura y, si se autoriza, cola IndexedDB, sincronización idempotente y estados de red.
- **Permisos/validaciones:** mantener permisos de captura/cierre; validar sesión, ventana y estado al sincronizar.
- **Riesgos/pruebas/aceptación:** conflicto y falsa confirmación de guardado; pruebas de campo, reconexión, cierre remoto y pérdida de dispositivo. Aceptar sin pérdida ni doble contabilización y con estado de sincronización inequívoco.
- **Dependencias:** Fase 7, API idempotente y decisión de offline.

### Fase 19 — Implementación final
- **Estado:** NO ejecutada por diseño. Migraciones RDS y despliegue EC2 quedan manuales para la entrega final autorizada por el usuario.
- **Objetivo/funcionalidades:** preparar y ejecutar el único despliegue a producción cuando todas las fases estén terminadas y aprobadas; capacitación, monitoreo, respaldo y procedimiento de reversa.
- **Datos/componentes/APIs:** entregar todos los scripts SQL versionados y el runbook de RDS; el usuario ejecuta manualmente cada script en el orden acordado después de validar respaldo y precondiciones. Tras verificar RDS, desplegar el conjunto completo de backend/frontend en EC2 y reiniciar servicios según `ESTRUCTURA_SERVIDOR.md`.
- **Permisos/validaciones:** confirmar roles productivos, empresa, plan/licencia, rutas protegidas, acceso al almacenamiento AWS existente y variables de entorno; no incluir credenciales en scripts ni repositorio.
- **Riesgos/pruebas/aceptación:** diferencias entre prueba y RDS, locks, cambios parciales o incompatibilidad de versión; ensayo de migración, respaldo restaurable, aprobación explícita antes de producción, verificación SQL posterior y smoke tests tras el despliegue. Aceptar cuando el sistema completo funcione y monitoreo/rollback estén listos.
- **Dependencias:** todas las fases anteriores, Fase 16 y gate de seguridad Fase 17; ninguna fase se despliega por separado a producción.

## 16. Criterios generales de aceptación

- Ningún usuario puede leer o modificar activos, repuestos, conteos, evidencias o movimientos de otra empresa mediante ID, filtro, exportación o URL directa.
- Los conteos son independientes y el rol contador no ve existencias teóricas ni cantidades de otras rondas antes de la autorización configurada.
- Una ausencia sin cobertura no se convierte silenciosamente en cero.
- No se modifica stock al cerrar una captura ni al calcular diferencias; únicamente una solicitud aprobada aplica un ajuste auditable.
- Ajustes, consumos y transiciones seriales son atómicos e idempotentes ante reintentos y concurrencia.
- Se puede reconstruir la historia de un activo, orden y repuesto serializado sin sobrescribir eventos anteriores.
- Se conserva el funcionamiento de ventas, compras, traslados y existencias actuales.
- En móvil se informa claramente el estado de cámara, guardado y sincronización.

## 17. Gate de entrega

- El usuario informó ejecución manual de Fases 2 y 4 en RDS el 2026-10-03, con evidencia de 43 permisos, `repuestos_catalogo` y `inventario_movimientos.bodega_id`. El agente no ejecutó SQL ni desplegó código a EC2. Los triggers no quedaron creados; su requisito se reemplazó por controles transaccionales del backend.
- Orden del servidor: Fase 2 y después Fase 4, siguiendo [SQL/ORDEN_EJECUCION_ACTIVOS_INVENTARIOS.md](SQL/ORDEN_EJECUCION_ACTIVOS_INVENTARIOS.md).
- Build y pruebas integrales se ejecutan una sola vez después de completar la implementación local.
- La salida a producción requiere que las fases obligatorias estén en SI, revisión de seguridad aprobada, respaldo restaurable y autorización del usuario.
- Evidencias privadas, exportaciones/reportes y modo offline están fuera de lo implementado en este MVP y permanecen en NO; no deben asumirse como capacidades disponibles.
