# Orden de ejecución SQL: activos e inventarios

**Destino:** esquema `kore_inventory` en Amazon RDS MySQL 8.4.8  
**Ejecución:** manual por el usuario en el servidor. No ejecutar en producción antes del respaldo y del ensayo en una copia.

## Scripts del módulo

1. `migration_20261001_fase2_activos_inventarios.sql`
   - Crea los dominios de activos, mantenimiento, seriales, inventarios, resultados, ajustes y eventos.
   - Extiende los catálogos RBAC y crea `inventarios_bodega_bloqueos`. No crea triggers: el backend valida el bloqueo dentro de cada transacción de stock.
   - Al final altera `inventario_movimientos` para añadir `bodega_id` y los tipos de referencia nuevos.
   - El `ALTER TABLE` final no es repetible. Si la ejecución se interrumpe, inspeccionar la columna, índice y FK antes de reanudarlo; no volver a ejecutar el bloque a ciegas.
2. `migration_20261001_fase4_repuestos.sql`
   - Ejecutar solo después de completar Fase 2. Crea `repuestos_catalogo`, reutilizado por el módulo existente.

Los scripts de auditoría `auditoria_fase0_activos_inventarios.sql` y `auditoria_indices_permisos_fase2.sql` son consultas de solo lectura, no migraciones. La primera auditoría ya fue ejecutada y su resultado está archivado en `AUDITORIA_FASE0_ACTIVOS_INVENTARIOS_RDS.md`; repetirla es opcional para confirmar que el servidor no cambió desde el corte.

`parametrizacion_contable_empresa31_p4_p5_p6.sql` no pertenece a este módulo y no forma parte de este orden. Conservarlo sin cambios.

## Secuencia y comprobación

1. Confirmar `SELECT DATABASE(), VERSION();` y que el destino sea `kore_inventory` en MySQL 8.4.8.
2. Crear un respaldo restaurable y ensayar ambos scripts, en este orden, sobre una copia reciente de RDS.
3. Ejecutar Fase 2 sin necesidad de `DELIMITER` ni permisos de creación de triggers. El DDL hace commits implícitos; no confiar en un `ROLLBACK` global.
4. Comprobar que aparecen las tablas indicadas al final del script y que `inventario_movimientos` contiene `bodega_id` y el FK correspondiente.
5. Ejecutar Fase 4 y comprobar `SHOW CREATE TABLE repuestos_catalogo;`.
6. Verificar que las acciones y permisos nuevos aparecen en los catálogos existentes y que las claves/columnas únicas previas de productos y bodegas no se duplicaron.

No backfillear `bodega_id` en movimientos históricos: no existe una fuente fiable para inferir esa bodega.

## Reemplazo de triggers en RDS (2026-10-03)

Las migraciones ya aplicadas no deben repetirse. Si `inventarios_bodega_bloqueos` y `inventario_movimientos.bodega_id` existen, no se requiere SQL adicional para este reemplazo: desplegar el backend actualizado.

Ventas/cuentas abiertas, compras, traslados, ajustes manuales/masivos, mantenimiento y transiciones seriales adquieren `SELECT ... FOR UPDATE` sobre las bodegas y verifican que no haya bloqueo de conteo, en la misma transacción que cambia stock/reservas. Las altas y modificaciones sensibles del catálogo también se rechazan mientras exista un bloqueo de la empresa. El ajuste autorizado verifica que el bloqueo pertenezca a su inventario y lo libera transaccionalmente al aplicar.

La protección cubre las rutas de esta aplicación, no escrituras SQL directas o aplicaciones externas. Pausar importaciones externas y cambios manuales de stock/catalogo mientras haya conteos; no habilitar conteos hasta actualizar todos los procesos backend que escriben stock. Un `SHOW TRIGGERS` vacío es esperado con esta implementación.

## Evidencias privadas en AWS

El código de evidencias no usa el bucket público de imágenes ni CloudFront. Antes de habilitarlo en producción:

- Crear un bucket S3 privado distinto y configurarlo como `AWS_S3_PRIVATE_BUCKET` en el entorno backend.
- Activar S3 Block Public Access, cifrado en reposo, versionado/retención según política y no asociarlo al CloudFront público.
- Asignar al rol de EC2 permisos `s3:PutObject`, `s3:GetObject` y `s3:DeleteObject` limitados al prefijo `empresa/*/evidencias/*`. Usar el rol IAM de la instancia cuando esté disponible; no incorporar claves al repositorio.
- Configurar CORS del bucket privado para permitir `PUT` desde los orígenes de la aplicación y los tipos `application/pdf`, `image/jpeg`, `image/png` e `image/webp`.
- Las cargas aceptan hasta 10 MB; las imágenes se recomprimen en cliente y se comprueba la firma real del archivo. Las descargas se entregan mediante URLs firmadas de cinco minutos.

Si `AWS_S3_PRIVATE_BUCKET` no está configurado, el resto del módulo opera normalmente, pero la API de evidencias devuelve `503` y la carga privada no está disponible.