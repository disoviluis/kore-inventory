# Plan de implementación: Comandas y tablero de cocina

Documento de trabajo. Las fases se implementan una por una, con validación al final de cada una.

---

## 1. Qué se quiere conseguir

Que el mesero tome pedidos desde su celular y la cocina los vea al instante, sin papeles y sin que nadie tenga que preguntar "¿ya salió lo de la mesa 4?".

En concreto:

- El mesero abre una cuenta por mesa o agrega productos a una que ya existe.
- Busca productos rápido: escribiendo el nombre o el SKU, viendo la lista completa, o filtrando por categoría.
- Indica cantidad y una observación por producto ("sin cebolla", "carne término medio", "extra queso").
- Envía el pedido a cocina. Ese envío genera una **comanda con número consecutivo**.
- La cocina ve en un tablero los pedidos nuevos, los cambios y las cancelaciones, con alertas de color.
- El cocinero marca cada producto como *en preparación* y luego *listo*.
- El mesero recibe aviso cuando un producto está listo para recogerlo.
- El mesero puede modificar o eliminar productos, consultar el total de la mesa en su celular y solicitar en caja la impresión de la cuenta.
- El cajero ve las mismas cuentas en el punto de venta y cobra normalmente.
- Se sabe qué mesa atiende cada mesero, para asignarle la propina.

**Principio rector:** una sola fuente de verdad. La comanda no crea una cuenta paralela; es el envío a cocina de items que ya viven en la cuenta abierta del POS. Así la sincronización con caja es automática, no un proceso que pueda desfasarse.

---

## 2. Qué ya existe y se reutiliza

No hay que construir desde cero. El sistema ya tiene:

| Pieza | Estado | Uso en comandas |
|---|---|---|
| `cuentas_abiertas` | Funcionando, 7 cuentas activas | La cuenta de la mesa |
| `cuenta_abierta_detalle` | Funcionando | Los productos pedidos |
| Campo `notas` en el detalle | Existe (500 caracteres) | Observaciones del cliente |
| `tipo_identificacion = 'mesa'` y `mesa_numero` | Existe | Identificación de la mesa |
| `usuario_apertura` | Existe | Mesero que abrió la cuenta |
| `cuenta_solicitada` | Existe | Cliente pidió la cuenta |
| `mesas_configuracion` | Tabla creada, sin uso | Mesas, zonas y capacidad |
| Propinas en ventas | Existe | Propina al cerrar |
| API de cuentas abiertas | Funcionando | Base de los endpoints |
| Vista de cuentas en el POS | Funcionando | El cajero ya las ve |

Esto significa que el mesero y el cajero **ya comparten datos**. Lo que falta es la capa de comandas, los estados de cocina y las interfaces móviles.

---

## 3. Problemas detectados que hay que resolver primero

Al revisar el código encontré tres asuntos que afectan directamente a este módulo:

### 3.1 Los insumos no se descuentan en cuentas abiertas (crítico)

La lógica de composición por insumos que implementamos vive en `ventas.controller.ts`. Pero el flujo de restaurante **no pasa por ahí**: pasa por `agregarItemCuenta` en `cuentas-abiertas.controller.ts`, que descuenta el stock del plato directamente.

Consecuencia: si un taco tiene definidos sus insumos, al pedirlo desde una mesa **no se descontará ni tortilla ni carne**. El módulo de comandas sería inútil para controlar inventario si no se corrige.

### 3.2 Cuentas abiertas no usa transacciones reales

`agregarItemCuenta` ejecuta el insert del item, el descuento de stock y el registro del movimiento como sentencias sueltas. Si algo falla a mitad, queda el item sin descuento o el descuento sin item.

### 3.3 Momento del descuento de inventario (decisión tomada)

Se evaluó mover el descuento al momento en que la cocina marca *en preparación*, que conceptualmente es cuando se consumen los insumos.

**Se descartó.** El inventario sigue moviéndose cuando el producto entra o sale de la cuenta. Razones:

- Cancelar antes de cocinar ya está resuelto: al eliminar el producto de la cuenta se devuelve el stock automáticamente.
- Las cuentas abiertas también las usan tiendas y bares sin comandas; cambiar el momento del descuento alteraría su comportamiento.
- Tener dos lugares que descuentan el mismo inventario es la principal fuente de descuadres.

La comanda queda como registro de despacho a cocina y **no toca inventario**. El campo `inventario_descontado` se guarda en `comanda_items` para dejar explícito que el movimiento ya ocurrió al agregar el producto.

---

## 4. Mejoras que propongo sobre lo descrito

Además de lo que pediste, recomiendo lo siguiente:

**1. Estados por producto, no por comanda.**  
Una mesa puede tener la sopa lista y el plato fuerte todavía en el fogón. Si el estado fuera por comanda completa, el mesero no sabría qué recoger. Estados: `pendiente` → `en_preparacion` → `listo` → `entregado`.

**2. Estaciones de despacho (cocina, bar, postres).**  
Cada categoría de producto se asigna a una estación. Las bebidas van a la pantalla del bar y los platos a la de cocina. Evita que el barista tenga que leer pedidos que no le corresponden. Es la diferencia entre un tablero usable y uno saturado.

**3. Control sobre la eliminación de productos.**  
Si un producto ya está en preparación o listo, el mesero no debería poder borrarlo sin dejar rastro: ya se gastaron insumos. Propuesta: permitir cancelar siempre, pero exigir motivo y registrar quién lo hizo. Las cancelaciones de productos ya preparados quedan en un reporte de mermas.

**4. Precuenta mixta: el mesero consulta, la caja imprime.**  
El mesero ve el detalle y el total en su celular para responder al instante cuánto va la mesa. Si el cliente la pide impresa, el mesero toca **Solicitar cuenta**: eso marca el campo `cuenta_solicitada` que ya existe y le avisa al cajero, que imprime el documento marcado como **no es factura**.

La razón no es de control sino física: el sistema imprime con `window.print()` del navegador, así que sale por la impresora del dispositivo que la dispara. Un celular no tiene impresora térmica. Y la ventaja operativa es real: el cajero se entera mientras el cliente sigue sentado, no cuando ya está parado frente a él.

El mesero nunca cierra la cuenta ni registra pagos. El dinero entra solo por caja.

**5. Tiempos de preparación.**  
Guardar cuándo entró el pedido y cuándo quedó listo permite mostrar en el tablero un cronómetro y colorear en rojo lo que lleva demasiado tiempo. Es la información que más agradece un jefe de cocina.

**6. Propina por mesero.**  
Registrar explícitamente el mesero en la cuenta y arrastrarlo a la venta, para poder liquidar propinas por persona al final del turno.

**7. Actualización cada pocos segundos, no en tiempo real todavía.**  
El sistema no tiene WebSockets; el patrón actual es consultar cada 30 segundos. Para cocina eso es demasiado lento. Propongo consultar cada 8 segundos en las pantallas activas, que es suficiente y no requiere cambiar la infraestructura. WebSockets queda como mejora posterior.

**8. Interfaz pensada para dedos, no para mouse.**  
Botones grandes, categorías como fichas, buscador siempre visible, cantidad con botones `+` y `−` en lugar de teclado, y observaciones con frases frecuentes preconfiguradas ("sin cebolla", "para llevar", "término medio") además del texto libre.

**9. Bloqueo de mesa por mesero.**  
Mostrar quién está atendiendo cada mesa para evitar que dos meseros tomen el mismo pedido.

**10. La propina se acuerda en la mesa, no en la caja.**  
El mesero le pregunta al cliente si desea dejar propina y con qué porcentaje o valor. La decisión queda guardada en la cuenta, así que el total que informa el mesero es exactamente el que cobra el cajero.

Además de evitar el disgusto del cliente, esto cumple la Ley 2110 de 2021: la propina es voluntaria y debe consultarse y aceptarse explícitamente. La cuenta guarda quién la confirmó y cuándo.

Para que mesero y cajero manejen el mismo número, el porcentaje sugerido se configura por empresa en `propina_sugerida_porcentaje`.

---

## 5. Modelo de datos

### Tablas nuevas

**`comandas`** — cada envío a cocina

```
id, empresa_id, cuenta_abierta_id, numero_comanda (consecutivo por empresa),
mesero_id, estado ENUM('pendiente','en_preparacion','lista','entregada','cancelada'),
observaciones, fecha_envio, fecha_lista, fecha_entrega, created_at
UNIQUE (empresa_id, numero_comanda)
```

**`comanda_items`** — productos de cada comanda, enlazados al detalle de la cuenta

```
id, comanda_id, cuenta_detalle_id, producto_id, producto_nombre,
cantidad, observaciones, estacion ENUM('cocina','bar','postres','otro'),
estado ENUM('pendiente','en_preparacion','listo','entregado','cancelado'),
motivo_cancelacion, usuario_estado_id,
fecha_inicio_preparacion, fecha_listo, fecha_entrega
```

### Cambios en tablas existentes

- `cuentas_abiertas`: agregar `mesero_id INT NULL` (quién atiende) y `estado_atencion` para el tablero.
- `categorias`: agregar `estacion` para saber a qué pantalla enviar cada producto.
- `ventas`: agregar `mesero_id INT NULL` para liquidar propinas.
- `mesas_configuracion`: empezar a usarla; sembrar las mesas de cada restaurante.

---

## 6. Endpoints

**Mesero**

```
GET    /api/comandas/mesas                      Mesas con su estado y cuenta activa
POST   /api/comandas                            Enviar items a cocina (crea comanda)
GET    /api/comandas/mis-comandas               Comandas del mesero y estado de cada item
PUT    /api/comandas/items/:id/cancelar         Cancelar un producto con motivo
PUT    /api/comandas/items/:id/entregado        Marcar producto entregado en la mesa
GET    /api/comandas/cuenta/:cuentaId/resumen   Detalle, total y propina sugerida
POST   /api/comandas/cuenta/:cuentaId/propina   Registra la decisión de propina del cliente
POST   /api/comandas/cuenta/:cuentaId/solicitar Marca cuenta_solicitada y avisa a caja
```

**Cocina**

```
GET    /api/comandas/tablero?estacion=cocina    Pedidos pendientes y en preparación
PUT    /api/comandas/items/:id/preparar         Marcar en preparación (descuenta insumos)
PUT    /api/comandas/items/:id/listo            Marcar listo
```

**Caja**  
Sigue usando `/api/cuentas-abiertas`, que ya devuelve las cuentas creadas por meseros. Se agrega la impresión de la precuenta no fiscal desde el POS.

---

## 7. Interfaces

### 7.1 Mesero (`comandas.html`)

Pensada para celular en vertical.

- **Pantalla de mesas:** cuadrícula de tarjetas grandes con número de mesa, estado por color (libre, ocupada, cuenta pedida, pedido listo), total y mesero asignado.
- **Pantalla de pedido:** buscador arriba, fichas de categorías, cuadrícula de productos. Un toque agrega; segundo toque abre cantidad y observaciones.
- **Observaciones:** botones rápidos frecuentes más campo libre.
- **Carrito:** lista de lo que aún no se ha enviado, con botón grande **Enviar a cocina**.
- **Estado:** los productos ya enviados aparecen con su estado y color; los listos parpadean.
- **Ver cuenta:** muestra el detalle y el total en pantalla, para informarle al cliente sin caminar a la caja.
- **Solicitar cuenta:** avisa al cajero que la mesa pidió la cuenta y quedan marcadas la hora y el mesero. El botón cambia a "Cuenta solicitada" para no repetir el aviso.

### 7.2 Cocina (`cocina.html`)

Pensada para tablet en horizontal, pantalla siempre encendida.

- Columnas por estado: **Pendientes**, **En preparación**, **Listos**.
- Tarjeta por producto: mesa, producto, cantidad, observaciones destacadas en color, y cronómetro desde que entró.
- Colores: verde recién llegado, amarillo en preparación, rojo si supera el tiempo objetivo.
- Aviso sonoro cuando entra un pedido nuevo o se cancela uno.
- Botones grandes: **Preparar** y **Listo**.
- Selector de estación arriba.

### 7.3 Caja

- Aviso visible de las mesas que solicitaron la cuenta, con la hora de solicitud.
- Botón para imprimir la precuenta no fiscal.
- La cuenta muestra el mesero que atendió.
- Al registrar propina se asocia a ese mesero.

---

## 8. Fases de implementación

### Fase 1 — Cimientos (sin interfaz)
1. Envolver `agregarItemCuenta`, `actualizarItemCuenta` y `eliminarItemCuenta` en transacciones reales.
2. Unificar el consumo de insumos entre ventas y cuentas abiertas.
3. Migración: tablas `comandas` y `comanda_items`, más `mesero_id` en cuentas y ventas, y `estacion` en categorías.
4. Registrar los módulos `comandas` y `cocina` en la tabla `modulos`.

### Fase 2 — API de comandas
1. Crear comanda con consecutivo bloqueado por empresa.
2. Endpoints de mesero y de tablero.
3. Cambios de estado con registro de quién y cuándo.
4. Resumen de cuenta con propina sugerida y registro de la decisión del cliente.

### Fase 3 — Interfaz del mesero
1. Pantalla de mesas.
2. Buscador, categorías y cuadrícula de productos.
3. Cantidad y observaciones.
4. Envío a cocina y seguimiento de estados.
5. Ver cuenta y solicitar cuenta.

### Fase 4 — Tablero de cocina
1. Columnas por estado y tarjetas.
2. Cronómetros y colores.
3. Botones de cambio de estado.
4. Actualización cada 8 segundos y aviso sonoro.
5. Filtro por estación.

### Fase 5 — Integración con caja y propinas
1. Aviso en el POS de las mesas que solicitaron la cuenta.
2. Impresión de la precuenta no fiscal desde caja.
3. Mostrar mesero en la cuenta dentro del POS.
4. **Arrastrar la propina acordada en la mesa a la venta al cerrar la cuenta.** Sin esto, el cajero volvería a preguntar y el total podría cambiar.
5. Arrastrar `mesero_id` a la venta al cerrar.
6. Reporte de propinas por mesero y turno.

### Fase 6 — Configuración y permisos
1. Administración de mesas y zonas.
2. Asignación de estación por categoría.
3. Permisos: el mesero accede solo a comandas; el cocinero solo al tablero.
4. Tiempos objetivo de preparación por categoría.

### Fase 7 — Pruebas y despliegue
1. Pedido completo: abrir mesa, enviar, preparar, listo, entregar, cobrar.
2. Agregar productos a una cuenta ya existente.
3. Cancelar un producto antes y después de prepararlo.
4. Dos meseros trabajando en paralelo.
5. Verificar descuento correcto de insumos.
6. Probar en celular y tablet reales.
7. Migración con respaldo y despliegue.

---

## 9. Riesgos

- **Doble descuento de inventario.** Mitigado: la comanda no toca inventario, el descuento ocurre solo al agregar o quitar productos de la cuenta.
- **Consecutivo de comanda duplicado.** Se resuelve con bloqueo, igual que se hizo con los recibos de caja.
- **Saturación por consultas frecuentes.** Con pocas mesas no hay problema; si crece, conviene pasar a WebSockets.
- **Cancelaciones sin control.** Sin exigir motivo, el módulo se presta para descuadres de inventario.

---

## 10. Definición de terminado

- Un mesero toma un pedido desde el celular en menos de 30 segundos.
- La cocina lo ve en menos de 10 segundos.
- El mesero se entera de que el plato está listo sin ir a preguntar.
- El mesero responde cuánto va la mesa sin caminar a la caja.
- El cajero sabe que la mesa pidió la cuenta antes de que el cliente llegue.
- El total que informa el mesero es el mismo que cobra la caja, propina incluida.
- El cajero cobra la cuenta sin volver a digitar nada.
- El inventario descuenta los insumos correctos una sola vez.
- La propina queda asignada al mesero que atendió.
