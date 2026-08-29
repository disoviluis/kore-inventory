# Pendientes de implementación

## Gestión de cajas por tienda o bodega

### Estado actual

- La tabla `cajas` ya existe y cada tienda/bodega debe tener una caja principal activa.
- Se creó la relación `usuario_caja` para asignar uno o varios cajeros a una caja.
- Ya existen endpoints backend para consultar, crear, actualizar, activar/inactivar cajas y asignar o retirar usuarios.
- El sistema conserva un respaldo: si una tienda no tiene caja activa al abrir un turno, intenta crear una caja principal automáticamente.
- El cajero no queda ligado a un computador. La asignación pertenece al usuario y debe estar disponible al iniciar sesión desde cualquier PC.

### Bloques pendientes

1. Crear la pantalla de administración de cajas por empresa y por tienda/bodega.
2. Permitir crear varias cajas, por ejemplo `Caja 1`, `Caja 2` y `Caja 3`.
3. Mostrar y administrar los cajeros asignados a cada caja.
4. Actualizar la apertura de turno para mostrar únicamente las cajas activas autorizadas para el usuario.
5. Cargar automáticamente la caja asignada al cajero al iniciar sesión, sin depender del computador.
6. Impedir que dos turnos abiertos utilicen simultáneamente la misma caja física.
7. Agregar reportes de ventas, cierres y diferencias por caja, tienda, turno y cajero.
8. Validar con usuarios reales: cambio de PC, varias cajas en una tienda, cajero con más de una caja y cierre de caja.

### Regla de negocio definida

- Las cajas representan puntos físicos de cobro y pertenecen a una tienda/bodega.
- Los usuarios cajeros se asignan a cajas mediante `usuario_caja`.
- No se crea automáticamente una caja por cada usuario.
- Un cajero puede cambiar de computador y conservar sus cajas autorizadas.
- Recomendación inicial: un solo turno abierto por usuario y por caja.

## Página pública de cada empresa

- Se actualizó el formateo global de precios para mostrar pesos colombianos sin decimales innecesarios.
- Ejemplo: `17899.98` se muestra como `$17.900`.
- El cambio está centralizado en `frontend/public/assets/js/empresa-publica.js` y aplica a todas las empresas.