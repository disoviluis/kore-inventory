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

3. Mostrar y administrar los cajeros asignados a cada caja (Modal con usuario_caja table)
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