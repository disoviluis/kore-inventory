# Pendientes de implementación

## Gestión de cajas por tienda o bodega

### Estado actual

- La tabla `cajas` ya existe y cada tienda/bodega debe tener una caja principal activa.
- Se creó la relación `usuario_caja` para asignar uno o varios cajeros a una caja.
- Ya existen endpoints backend para consultar, crear, actualizar, activar/inactivar cajas y asignar o retirar usuarios.
- El sistema conserva un respaldo: si una tienda no tiene caja activa al abrir un turno, intenta crear una caja principal automáticamente.
- El cajero no queda ligado a un computador. La asignación pertenece al usuario y debe estar disponible al iniciar sesión desde cualquier PC.
- **NEW (Bloque 2):** Interfaz de administración de cajas en pestaña "Cajas" de configuración general. Permite crear, editar, eliminar cajas y visualizar cajeros asignados.

### Bloques completados

✅ **Bloque 1 - Base de datos y API (Commit c13406e)**
- Tabla `usuario_caja` con relaciones y índices
- Endpoints: GET /api/cajas, POST /api/cajas, PUT /api/cajas/:id
- Endpoints: POST /api/cajas/:id/usuarios, DELETE /api/cajas/:id/usuarios/:usuarioId
- Integración en router principal
- Deployed to production

✅ **Bloque 2 - Interfaz Admin (Commit b0e4912)**
- Nueva pestaña "Cajas" en configuracion-general.html
- Selector de tienda/bodega con carga de cajas disponibles
- Tabla con listado de cajas (código, nombre, tipo, cajeros asignados, estado)
- Modal para crear/editar cajas (código, nombre, tipo, estado)
- Botones de acción: Editar, Asignar Cajeros, Eliminar
- Validaciones de entrada
- Deployed to production

### Bloques pendientes

✅ **Bloque 3 - Cajeros asignados por caja (Commit 5574d47)**
- Modal de administración con usuarios asignados mediante `usuario_caja`

✅ **Bloque 4 - Cajas autorizadas en apertura (Commit 2cf0356)**
- La apertura muestra únicamente cajas activas autorizadas para el usuario

✅ **Bloque 5 - Caja del usuario al iniciar sesión (Commit a7bdbec)**
- Las cajas autorizadas se cargan desde la sesión, sin depender del computador

✅ **Bloque 6 - Bloqueo de turnos simultáneos (Commit 99d42e0)**
- Se impide abrir dos turnos sobre la misma caja física

✅ **Bloque 7 - Reportes de ventas y cierres**
- Dashboard de ventas, ganancia, productos, categorías, bodegas e inventario en riesgo
- Reporte de cierres por caja, bodega, turno y cajero
- Totales de ventas, gastos, efectivo esperado, efectivo contado, faltantes y sobrantes
- Filtros por fechas, caja, cajero y turno en `GET /api/reportes/cierres-caja`
- Reportes guardados protegidos por empresa, usuario propietario y visibilidad pública

⏳ **Bloque 8 - Validación con usuarios reales**
- Pendiente ejecutar la matriz de pruebas con cuentas reales y datos de producción o staging

### Regla de negocio definida

- Las cajas representan puntos físicos de cobro y pertenecen a una tienda/bodega.
- Los usuarios cajeros se asignan a cajas mediante `usuario_caja`.
- No se crea automáticamente una caja por cada usuario.
- Un cajero puede cambiar de computador y conservar sus cajas autorizadas.
- Recomendación inicial: un solo turno abierto por usuario y por caja.

### Matriz de validación del Bloque 8

| Escenario | Resultado esperado | Estado |
|---|---|---|
| Cajero cambia de computador | Conserva sus cajas autorizadas al iniciar sesión | Pendiente ejecución |
| Tienda con varias cajas | Puede seleccionar únicamente cajas activas autorizadas | Pendiente ejecución |
| Cajero con una caja | La caja se selecciona automáticamente | Pendiente ejecución |
| Cajero con más de una caja | Puede elegir entre sus cajas autorizadas | Pendiente ejecución |
| Dos usuarios abren la misma caja | El segundo intento es rechazado | Pendiente ejecución |
| Cierre con efectivo exacto | Diferencia igual a cero | Pendiente ejecución |
| Cierre con faltante o sobrante | La diferencia queda registrada y aparece en reportes | Pendiente ejecución |
| Reporte entre empresas | Un usuario no puede consultar datos de otra empresa | Pendiente ejecución |

## Página pública de cada empresa

- Se actualizó el formateo global de precios para mostrar pesos colombianos sin decimales innecesarios.
- Ejemplo: `17899.98` se muestra como `$17.900`.
- El cambio está centralizado en `frontend/public/assets/js/empresa-publica.js` y aplica a todas las empresas.

## Plan de implementación: inventario profesional y carga por Excel

### Objetivo

Separar claramente el maestro de productos del control de existencias:

- **Productos:** catálogo, precios, impuestos, cuentas contables y parámetros del artículo.
- **Inventario:** existencias por bodega, movimientos, inventario inicial, conteos físicos y ajustes.
- **Ventas:** descuentan automáticamente el stock de la bodega que factura y generan un movimiento trazable.

### Fase 1 - Separar Productos e Inventario ✅

1. ✅ Quitar `Stock Actual` del formulario de crear y editar productos.
2. ✅ Hacer que un producto nuevo inicie con stock cero.
3. ✅ Retirar `stock_actual` del payload de productos y de la importación de catálogo.
4. ✅ Mantener temporalmente `productos.stock_actual` solo por compatibilidad, sin permitir su edición desde Productos.
5. ⏳ Definir `productos_bodegas.stock_actual` como existencia operativa por bodega.
6. ⏳ Revisar listados, exportaciones y alertas para que usen stock por bodega o el total calculado.

### Fase 2 - Movimiento único de inventario

⏳ Crear un servicio interno para registrar movimientos y actualizar existencias dentro de una transacción. El endpoint de ajustes ya aplica este patrón por bodega; falta reutilizarlo en ventas, compras y traslados. Debe recibir:

- `producto_id`.
- `bodega_id`.
- `cantidad`.
- `tipo_movimiento`.
- `motivo`.
- `referencia_tipo` y `referencia_id`.
- Usuario autenticado desde el JWT.
- Notas opcionales.

Tipos mínimos:

- `inventario_inicial`.
- `entrada_compra`.
- `salida_venta`.
- `entrada_anulacion_venta`.
- `ajuste_fisico`.
- `entrada_devolucion`.
- `salida_merma`.
- `salida_traslado` y `entrada_traslado`.

✅ En ajustes manuales, la operación guarda stock anterior y nuevo, impide existencias negativas y actualiza el total global de forma consistente.

### Fase 3 - Inventario inicial manual

Agregar en el módulo Inventario un flujo para registrar inventario inicial:

1. Seleccionar empresa y bodega.
2. Seleccionar producto.
3. Registrar cantidad, costo unitario, fecha y observaciones.
4. Mostrar confirmación antes de aplicar.
5. Crear un movimiento `inventario_inicial` auditable.
6. Impedir duplicar el inventario inicial de un mismo producto y bodega, o exigir un ajuste autorizado.

### Fase 4 - Carga masiva mediante Excel ✅

✅ Agregados en Inventario los botones **Descargar Excel** y **Subir conteo**.
✅ La bodega se selecciona en pantalla y el archivo usa el stock real de esa bodega.
✅ Se agregó vista previa y confirmación atómica mediante `POST /api/inventario/ajuste-masivo`.

Pendientes de endurecimiento de esta fase:

- Registrar el archivo y la carga completa como una entidad auditable.
- Revalidar el stock de referencia mostrado en la plantilla al confirmar.
- Agregar permisos específicos para inventario inicial y conteo físico.

El archivo debe incluir:

| Columna | Uso |
|---|---|
| SKU | Identifica el producto |
| Código de barras | Referencia visual opcional |
| Producto | Solo informativo |
| Stock sistema | Referencia no editable |
| Stock físico | Cantidad que el usuario diligencia |
| Diferencia | Calculada por el sistema |
| Observaciones | Justificación opcional |

Reglas de carga:

1. La bodega se selecciona antes de descargar o cargar el archivo.
2. El SKU debe existir y pertenecer a la empresa activa.
3. No se aceptan SKUs duplicados, cantidades negativas ni fórmulas como valor final.
4. `Stock sistema` no se utiliza para actualizar existencias; solo sirve de referencia.
5. El sistema calcula `diferencia = stock_fisico - stock_sistema`.
6. La pantalla debe mostrar una vista previa con válidos, errores y diferencias.
7. Solo al confirmar se aplican los movimientos.
8. Cada diferencia genera un movimiento `ajuste_fisico` dentro de una transacción.
9. Debe registrarse usuario, bodega, fecha, archivo, motivo y resultado de la carga.
10. Una fila con diferencia cero no genera movimiento.

### Fase 5 - Endpoints propuestos

- `GET /api/inventario/plantilla?empresaId=X&bodegaId=Y`
- `POST /api/inventario/importar/validar`
- `POST /api/inventario/importar/confirmar`
- `GET /api/inventario/cargas?empresaId=X`
- `GET /api/inventario/cargas/:id`

La validación y la confirmación deben estar separadas. La confirmación debe volver a comprobar permisos, empresa, bodega y stock actual para evitar aplicar una plantilla desactualizada.

### Fase 6 - Ventas y otros movimientos automáticos

1. Mantener el descuento automático al facturar.
2. Registrar también `salida_venta` en `inventario_movimientos`.
3. Asociar el movimiento con factura, turno, caja, usuario y bodega.
4. En anulación, generar `entrada_anulacion_venta`.
5. Compras, traslados, devoluciones y mermas deben utilizar el mismo servicio.
6. Validar stock disponible en la bodega antes de vender.
7. Usar transacciones y actualizaciones seguras para evitar stock negativo por ventas simultáneas.

### Fase 7 - Seguridad y permisos

- El backend debe ignorar `stock_actual` recibido desde Productos.
- El usuario siempre debe salir del JWT.
- Solo usuarios con permiso de inventario pueden cargar o ajustar existencias.
- El inventario inicial debe requerir permiso administrativo.
- Todas las consultas deben filtrar por empresa y bodega autorizada.
- Las cargas confirmadas no deben editarse; cualquier corrección debe ser otro movimiento.

### Fase 8 - Pruebas y salida a producción

1. Crear producto nuevo y comprobar stock cero.
2. Intentar modificar stock desde Productos y comprobar que el backend lo rechaza o ignora.
3. Registrar inventario inicial manual por bodega.
4. Descargar, modificar y cargar plantilla Excel.
5. Verificar vista previa, errores, diferencias y confirmación.
6. Comprobar que una fila con diferencia cero no crea movimiento.
7. Vender y confirmar salida automática en la bodega correcta.
8. Anular venta y confirmar reversión trazable.
9. Probar dos cargas simultáneas sobre el mismo producto.
10. Validar permisos entre empresas y bodegas.
11. Ejecutar respaldo y migración en staging antes de producción.
12. Mantener compatibilidad temporal con datos históricos y comparar totales antes de retirar la edición antigua.

## Módulo financiero de gastos ✅ (pendiente ejecutar migración)

Se implementó un módulo independiente para gastos generales de la empresa, separado de `gastos_caja`:

- Tabla y migración: `SQL/migration_20260902_gastos.sql`.
- API: listar, resumen por período/categoría, registrar y anular gastos.
- Control de empresa mediante usuario autenticado.
- Anulación lógica con motivo, usuario y fecha.
- Pantalla: `frontend/public/gastos.html`.
- Acceso habilitado desde la sección Finanzas.

Antes de usarlo en producción:

1. Ejecutar la migración en RDS después de realizar backup.
2. Desplegar backend y frontend.
3. Validar registro, filtros, resumen y anulación con una cuenta de prueba.

### Orden recomendado de ejecución

1. Bloquear edición de stock en backend y frontend.
2. Crear el servicio transaccional de movimientos.
3. Implementar inventario inicial manual.
4. Implementar plantilla y carga Excel con vista previa.
5. Integrar ventas, compras, traslados y anulaciones al servicio.
6. Migrar y conciliar existencias históricas por bodega.
7. Ejecutar pruebas con usuarios reales.
8. Retirar definitivamente el stock del importador de Productos.