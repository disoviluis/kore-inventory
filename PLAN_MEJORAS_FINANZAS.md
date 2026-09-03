# Plan de mejoras: Finanzas y contabilidad

Documento de trabajo. Las fases se implementan una por una y el despliegue se hace al finalizar todas.

## Contexto

La aplicación ya cuenta con cuentas por cobrar, cuentas por pagar, recibos de caja, bancos, caja por turnos y gastos generales. Al revisar el código se detectaron defectos de integridad y funcionalidades que un contador espera y que hoy no existen.

---

## Hallazgos verificados en el código

### 1. Recibos de caja sin transacción real (crítico)

En `backend/src/platform/finanzas/recibos-caja.controller.ts` se usa:

```ts
await query('START TRANSACTION');
```

`query()` toma una conexión distinta del pool en cada llamada, por lo que `START TRANSACTION`, los `UPDATE` y el `COMMIT` pueden ejecutarse en conexiones diferentes.

Consecuencias:

- El `ROLLBACK` no revierte nada.
- Un fallo a mitad del proceso deja el recibo creado con saldos sin actualizar, o saldos actualizados sin recibo.
- El `FOR UPDATE` sobre la cuenta bancaria no bloquea nada.

Es el mismo patrón que ya se corrigió en ventas mediante `withTransaction()`.

### 2. Campos obligatorios que no se envían (confirmado contra RDS)

- `recibos_caja.fecha_recibo` es `DATE NOT NULL` y el `INSERT` no la envía.
- `recibos_caja_detalle.venta_id` es `INT NOT NULL` y el `INSERT` no lo envía.

El servidor tiene `sql_mode = NO_ENGINE_SUBSTITUTION`, es decir, sin modo estricto. MySQL no lanza error: rellena con `0000-00-00` y `0`.

Impacto: los filtros por fecha y los reportes de recibos quedarían inservibles.

Estado actual: la tabla está vacía, por lo que aún no hay datos dañados. El defecto se activaría con el primer recibo real.

### 3. Numeración de recibos sin bloqueo

`RC-0001` se calcula leyendo el último registro y sumando uno, sin bloqueo. Dos cajeros simultáneos pueden generar el mismo número y chocar contra la clave única `uk_numero_recibo`.

### 4. Anulación de recibos incompleta

- Restaura `saldo_pendiente = saldo_anterior`, lo que ignora pagos posteriores registrados sobre la misma factura.
- No reversa el movimiento bancario ni el saldo de la cuenta cuando el pago entró por transferencia.

### 5. Gastos desconectados de bancos y caja

El módulo de gastos registra el egreso, pero no afecta el saldo bancario ni el efectivo de caja.

### 6. Conciliación bancaria incompleta

Hoy solo existe un botón que marca `conciliado = 1` movimiento por movimiento. No hay importación de extracto, ni cruce automático, ni reporte de diferencias, ni cierre mensual.

---

## Fases de implementación

### Fase 1 - Corregir recibos de caja (implementada)

- Reemplazado `START TRANSACTION` por `withTransaction()`.
- Número de recibo reservado con `FOR UPDATE`.
- Se envían `fecha_recibo` y `venta_id`.
- Las facturas se validan contra la empresa y el cliente del recibo.
- Anulación: revierte sumando el valor aplicado al saldo vigente.
- Anulación: reversa el movimiento bancario y el saldo de la cuenta.

### Fase 2 - Conectar gastos con bancos (implementada)

- Migración `SQL/migration_20260903_gastos_bancos.sql` agrega `cuenta_bancaria_id` a `gastos`.
- Un gasto no efectivo descuenta el saldo bancario y registra `movimientos_bancarios` con origen `gasto`.
- La anulación del gasto devuelve el dinero a la cuenta y deja el movimiento inverso.
- El formulario exige la cuenta bancaria cuando el pago no es en efectivo.

### Fase 3 - Conciliación bancaria (implementada)

- Migración `SQL/migration_20260903_conciliacion_bancaria.sql` crea `conciliaciones_bancarias`.
- Pantalla `frontend/public/conciliacion.html`.
- Plantilla de extracto en Excel con columnas Fecha, Descripcion, Referencia y Valor.
- Cruce automático por valor exacto y fecha con tolerancia de 5 días; la referencia tiene prioridad.
- Vistas separadas: coincidencias, solo en libros y solo en el banco.
- Cierre del período con saldo en libros, saldo del extracto, diferencia y responsable.

### Fase 4 - Reportes financieros (implementada)

- Pantalla `frontend/public/reportes-financieros.html`.
- Estado de resultados por causación: ingresos, costo de ventas, utilidad bruta, gastos y utilidad neta.
- Flujo de caja: ventas de contado, cobros, gastos, pagos a proveedores y flujo neto.
- Gastos por categoría con participación porcentual.

---

## Migraciones pendientes de ejecutar en producción

Ejecutar en este orden, con respaldo previo:

1. `SQL/migration_20260903_gastos_bancos.sql`
2. `SQL/migration_20260903_conciliacion_bancaria.sql`

---

## Pendientes posteriores (fuera de este plan)

- Notas crédito y devoluciones de venta.
- Retenciones: retefuente, reteICA y reteIVA.
- Cierre contable por período con bloqueo de edición.

---

## Reglas de trabajo

- Cada fase se valida con compilación de backend y revisión de sintaxis del frontend.
- No se despliega hasta terminar todas las fases.
- Las migraciones SQL se ejecutan con respaldo previo.
