# Auditoría Fase 0: esquema productivo de Kore Inventory

**Estado:** documentada con salida SQL proporcionada por el usuario  
**Fecha del corte:** 2026-10-01 17:45:37  
**Base:** `kore_inventory`  
**Motor/versión:** MySQL 8.4.8  
**Fuente:** resultados de `SQL/auditoria_fase0_activos_inventarios.sql` ejecutado por el usuario contra RDS. Este agente no se conectó a AWS/RDS.

> Este documento conserva el resultado recibido para evitar repetir la auditoría completa. Los conteos `TABLE_ROWS` de InnoDB son estimaciones, no conteos exactos de registros. No se consultaron filas de negocio.

## 1. Resumen del resultado

- Se reportaron **84 tablas base**, todas con motor **InnoDB**.
- La consulta de columnas devolvió **471 filas** para las tablas relevantes del filtro del script.
- La consulta de relaciones devolvió **137 claves foráneas**.
- La consulta puntual posterior devolvió **58 filas de índices** para las cinco tablas consultadas; también se recibió el catálogo completo de módulos/acciones y los 164 permisos.
- En el catálogo recibido no aparecen tablas dedicadas a activos, tipos/atributos de activos, mantenimiento, unidades serializadas de repuestos, inventarios físicos, rondas/conteos, conciliaciones ni solicitudes de ajuste.
- El inventario existente se apoya en `productos`, `productos_bodegas`, `bodegas` e `inventario_movimientos`; hay una vista de stock por bodega.
- El catálogo RBAC contiene 30 módulos, 11 acciones y 164 permisos, confirmados por consultas `SELECT` (no estimaciones de `TABLE_ROWS`).

## 2. Estructuras relevantes confirmadas

### `productos`

- Tenant y catálogo: `empresa_id`, `tipo` (`producto`/`servicio`), `maneja_inventario`, `nombre`, `descripcion`, `sku`, `codigo_barras`, `categoria_id`.
- Inventario: `stock_actual`, `stock_minimo` y `stock_maximo`, todos reportados como `DECIMAL(15,3)`; `unidad_medida` y `ubicacion_almacen`.
- Índices recibidos: PK `id`, `idx_empresa_id`, `uk_empresa_sku` único por `(empresa_id, sku)` e índices separados para categoría, estado y código de barras.
- Estado y auditoría básica: `estado`, `creado_por`, `modificado_por`, timestamps.

**Decisión técnica:** reutilizar el producto como catálogo de repuestos consumibles. No cambiar la precisión de inventario a enteros: RDS confirma cantidades fraccionarias con tres decimales. Los productos existentes no proporcionan, por sí solos, identidad serial unitaria ni historial de instalación/reparación.

### Índices únicos confirmados

- `productos.uk_empresa_sku`: único por `(empresa_id, sku)`.
- `bodegas.uk_empresa_codigo`: único por `(empresa_id, codigo)`.
- `productos_bodegas.uk_producto_bodega`: único por `(producto_id, bodega_id)`.
- `modulos.nombre`, `acciones.nombre` y `permisos.codigo` son únicos; `permisos` además es único por `(modulo_id, accion_id)`.
- Las tablas nuevas tendrán índices propios. No se duplicarán índices existentes; las alteraciones a tablas actuales se limitarán a los cambios requeridos por los flujos definidos.

### `productos_bodegas`

- Relaciona `producto_id` y `bodega_id`; no muestra `empresa_id`, por lo que el tenant se valida comprobando ambos padres.
- Stock actual, reservado, mínimo y máximo reportados como `DECIMAL(15,3)`; `stock_disponible` es columna virtual generada.
- Tiene campo `ubicacion` y timestamps.
- Tiene claves foráneas hacia productos y bodegas.
- Índice único confirmado `uk_producto_bodega` por `(producto_id, bodega_id)`; no añadir otro índice equivalente.
- Otros índices recibidos: `idx_bodega`, `idx_producto`, `idx_stock`, `idx_stock_bajo` y `idx_stock_bodega_nivel`.

**Riesgo tenant:** esta tabla no muestra `empresa_id`; las validaciones deben comprobar que el producto y la bodega referenciados pertenecen a la misma empresa, tanto al leer como al escribir.

### `bodegas`

- Tiene `empresa_id`, código, nombre, tipo, dirección, responsable, estado y marcas de bodega principal/ventas.
- La tabla reportada usa InnoDB. La consulta de filas estima seis registros en el momento del corte; esa cifra es orientativa.

### `inventario_movimientos`

- Incluye `producto_id`, tipo de movimiento, `cantidad`, `stock_anterior`, `stock_nuevo`, `costo_unitario`, motivo, referencia, usuario, fecha y notas.
- Cantidad y stocks reportados como `DECIMAL(15,3)`.
- **No aparece `bodega_id` en la estructura recibida.** No se debe asumir que el historial de movimientos existente identifica de forma fiable la bodega afectada.
- Índices recibidos: PK `id`, `idx_producto`, `idx_tipo`, `idx_fecha` y `idx_referencia` compuesto por `(referencia_tipo, referencia_id)`. No existe índice por bodega porque la columna no existe.
- La consulta estima 71 filas a la fecha del corte; no es un conteo exacto de InnoDB.

### Categorías

`categorias` es multiempresa y contiene nombre/descripcion/icono/color y `estacion ENUM('cocina','bar','postres','otro')`. Esa columna evidencia una responsabilidad orientada a operación de productos/comandas; no conviene reutilizar esta tabla como taxonomía genérica de activos. Mantener las categorías de activos separadas.

### Usuarios, bodegas asignadas, empresas y permisos

- La salida confirma `usuario_empresa` con empresa y estado de membresía, y `usuario_rol` con `empresa_id`.
- `usuarios` incluye `empresa_id_default`, `bodega_id` y vínculo opcional a empleado; existen además `usuarios_bodegas` y `empleados_bodegas`.
- El RBAC es relacional: `modulos`, `acciones`, `permisos`, `roles`, `rol_permiso` y `usuario_rol`. Las consultas recibidas confirman 30 módulos, 11 acciones y 164 permisos. Los conteos de `roles` y `rol_permiso` del primer listado eran estimaciones de InnoDB, no cifras exactas.
- Las acciones existentes son `view`, `create`, `edit`, `delete`, `approve`, `export`, `import`, `print`, `assign`, `receive` y `view_own`. El esquema propuesto agrega acciones de dominio que no pueden mapearse con seguridad a las existentes: conteo, vista de resultados, cierre/reapertura, conciliación, revisión/aplicación e instalación/retiro/reparación/baja.
- Los códigos actuales incluyen tanto `modulo.accion` como convenciones heredadas en mayúsculas. Las nuevas filas usarán `modulo.accion` en minúsculas; el middleware actual autoriza mediante joins módulo/acción, no por el texto de `codigo`.
- Las acciones/permisos del módulo nuevo se incorporarán al catálogo existente y se asignarán a roles por empresa. No crear un mecanismo paralelo.
- El contexto multiempresa debe comprobar membresía activa y empresa seleccionada en backend; no basta con `empresa_id` suministrado por el navegador.

### Auditoría

`auditoria_logs` ya dispone de `usuario_id`, `empresa_id`, `accion`, `modulo`, `tabla`, `registro_id`, `datos_anteriores`, `datos_nuevos`, IP, user-agent, URL, método y timestamp. `empresa_id` y `usuario_id` admiten NULL; antes de reutilizarla para cada evento nuevo hay que revisar el helper/escritor actual, formato de serialización y comportamiento ante fallos. No asumir que esta tabla por sí sola ofrece historial append-only de dominio o atomicidad con una transacción operativa.

## 3. Integridad referencial recibida

El resultado reporta 137 claves foráneas. Entre las relaciones útiles para el diseño están:

- `productos.empresa_id` → `empresas.id`; `productos.categoria_id` → `categorias.id`.
- `bodegas.empresa_id` → `empresas.id`; referencias de responsable/creador a usuarios.
- `productos_bodegas.producto_id` → `productos.id`; `productos_bodegas.bodega_id` → `bodegas.id`.
- `inventario_movimientos` enlaza producto y usuario según el esquema reportado, sin vínculo a bodega en sus columnas.
- `usuario_empresa`, `usuario_rol`, `roles` y `rol_permiso` implementan relaciones de pertenencia y autorización.
- `auditoria_logs` referencia usuario y empresa.

Estas FKs no prueban por sí solas que dos referencias pertenezcan al mismo tenant. Las migraciones preparadas usan FKs a las entidades padre y la aplicación valida pertenencia de empresa en cada operación transaccional; no todas las relaciones nuevas tienen todavía FKs compuestas tenant+ID, por lo que la revisión de seguridad y pruebas cruzadas siguen siendo un gate antes de producción.

## 4. Imagen y almacenamiento existente

La integración comprobada en código/documentación es híbrida:

- El producto conserva `imagen_url`, de modo que el usuario puede utilizar una URL.
- Existe endpoint de carga que genera URL presignada para S3.
- `getS3PublicUrl(key)` produce URL CloudFront si `CLOUDFRONT_URL` está configurada, o URL directa de S3 como alternativa.
- CloudFront distribuye objetos desde edge locations. La configuración documentada del bucket permite lectura pública.

Reutilizar el patrón de URL o carga para fotos no sensibles de activos/repuestos. Clasificar antes las fotos/evidencias de mantenimiento, daños, conteos y ajustes: no alojar contenido confidencial en el bucket público solo por conveniencia; definir acceso privado separado si aplica.

## 5. Consecuencias para el diseño

1. No crear un segundo catálogo ni una segunda existencia para repuestos no serializados; enlazarlos a productos y movimientos existentes.
2. Crear identidad y eventos unitarios para repuestos serializados que requieran trazabilidad; mantener la cantidad agregada para artículos no serializados.
3. Crear un dominio de activos independiente de `categorias`, con categoría/tipo/atributos propios.
4. Modelar inventarios físicos, rondas, sesiones por bodega, líneas, snapshots, conciliaciones y aprobaciones como tablas nuevas normalizadas; no hay tablas equivalentes en el catálogo recibido.
5. Preservar cantidades `DECIMAL(15,3)` en capturas, diferencias y ajustes para soportar los productos/unidades fraccionarios.
6. La aplicación de un ajuste autorizado debe actualizar stock por bodega y producto y registrar movimiento en una sola transacción. Como `inventario_movimientos` no muestra bodega, definir y probar una extensión explícita antes de implementar esa integración.
7. Añadir permisos al catálogo existente `modulos/acciones/permisos`; verificar aprovisionamiento y defaults antes de activar endpoints.
8. Aprovechar `auditoria_logs` solo después de comprobar su API de escritura y transaccionalidad; complementar con eventos de dominio append-only cuando el historial requerido lo necesite.
9. Mantener separados los despliegues de aplicación y los scripts SQL: los scripts de esquema se entregarán al usuario para ejecución manual en RDS después de pruebas, respaldo y verificación.

## 6. Estado y datos pendientes puntuales

**Auditoría Fase 0: implementada con la evidencia productiva entregada y la inspección local del repositorio.** Este documento es el registro de referencia y evita repetir el conjunto de consultas.

La salida puntual de índices/RBAC recibida el 2026-10-01 cierra los datos de esquema requeridos para diseñar la Fase 2; no hace falta repetir la auditoría.

La auditoría confirma estructura y relaciones, no valida políticas de negocio, datos de inventario, configuración AWS actual en vivo, ni todas las APIs/middleware desplegadas en producción.
