# Propuesta de planes y controles

Estado: tarifas y alcance aprobados por el propietario el 2026-10-06.
Moneda: COP. Cada suscripcion corresponde a una empresa.
Activar el catalogo ejecutando manualmente SQL/migration_20261006_catalogo_planes_aprobado.sql.
El tratamiento tributario debe confirmarse antes de facturar el servicio.

## Catalogo propuesto

| Condicion | Esencial | Gestion | Integral |
|---|---:|---:|---:|
| Mensual COP | 29.900 | 69.900 | 129.900 |
| Anual COP (10 mensualidades) | 299.000 | 699.000 | 1.299.000 |
| Usuarios activos | 3 | 10 | 25 |
| Productos activos | 500 | 3.000 | Sin limite |
| Documentos de venta al mes | 300 | 1.500 | Sin limite |
| Bodegas | 1 | Multiples | Multiples |
| POS, ventas, clientes, inventario | Si | Si | Si |
| Compras y proveedores | No | Si | Si |
| Activos y mantenimiento | No | Si | Si |
| Repuestos y conteos fisicos | No | No | Si |
| Traslados | No | Si | Si |
| Comandas y cocina | No | No | Si |
| Finanzas y reportes basicos | No | Si | Si |
| Reportes financieros avanzados | No | No | Si |
| Contabilidad y nomina | No | No | Si |
| Soporte | Email | Email | Prioridad de atencion |

No se promete SLA, soporte humano 24/7, API externa, marca blanca, facturacion
electronica DIAN certificada, offline ni un paquete de varias empresas.
Los modulos de seguridad y administracion basica corresponden al acceso del
usuario; no equivalen a privilegios de Super Admin ni acceso a otras empresas.
El plan de soporte describe un compromiso operativo, no una funcion automatica.

## Modulos sugeridos

- Esencial: pos, inventario, ventas, clientes, facturacion, impuestos, caja,
  cuentas_abiertas, usuarios, roles.
- Gestion: los anteriores mas compras, proveedores, bodegas, traslados, activos,
  mantenimientos, finanzas, reportes. Multi-bodega activo.
- Integral: los anteriores mas repuestos, inventarios_fisicos, comandas, cocina,
  contabilidad y nomina. Multi-bodega y reportes avanzados activos.

La oferta Integral no tiene todos los cupos ilimitados: usuarios maximo 25. La
palabra ilimitado debe reservarse a un recurso cuyo limite real sea NULL.
No hay aun cupos comerciales numericos para cantidad de activos, repuestos,
mantenimientos, archivos o espacio S3. No venderlos como limites configurables.

## Hallazgos corregidos localmente

- La interfaz enviaba multi_bodega/reportes_avanzados/API/marca_blanca siempre
  en cero, incluso al editar planes con otras opciones guardadas.
- Los niveles de soporte basico/estandar/premium no coincidían con el ENUM
  email/prioritario/24/7 de MySQL; en el catalogo publico aparecian vacios.
- La duracion de trial era editable pero se ignoraba. Ahora se muestra fija en 30.
- Crear un plan convertia usuarios ilimitados NULL en 5 por un valor por defecto.
- Los modulos se introducian como JSON manual; ahora son casillas seleccionables.
- Los precios no indicaban COP claramente. Los valores antiguos 15.99/24.99/49.90
  no se convierten: las ofertas nuevas tienen sus propios registros y precios.
- Reportes avanzados y multi-bodega estaban almacenados pero no controlados.
- Algunos modulos premium se concedian implicitamente por incluir inventario,
  activos o POS. Ahora tienen comprobacion independiente y dependencias.

## Criterios de verificacion

- Usuarios: se cuenta el total activo de la empresa al invitar, bajo bloqueo
  transaccional; Super Admin conserva su excepcion administrativa.
- Productos: creacion transaccional, contando activos.
- Facturas: documentos de venta del mes calendario colombiano; incluye cierre
  de cuentas abiertas. No es una medicion de timbrados/validaciones DIAN.
- Multi-bodega: impide agregar o reactivar una segunda bodega activa en un plan
  sin la caracteristica; no elimina bodegas existentes. Restringe traslados y
  rechaza activar un plan sin multi-bodega en una empresa con varias activas.
- Reportes avanzados: estado de resultados y flujo de caja financiero requieren
  el indicador, los modulos y permisos correspondientes.
- API externa y marca blanca: no comercializables; el formulario no las habilita.
- Multiempresa: no comercializable como un unico paquete; cada empresa requiere
  su propia vigencia. El acceso multiempresa de usuarios no implica una licencia
  global que cubra todas sus empresas.
- Cupos nuevos inferiores al uso actual: rechazo sin borrar datos.
- Periodos pagados: no se permiten editar en sitio modulos, cupos, soporte y
  caracteristicas de un plan con licencias pagadas vigentes o futuras. Duplicar
  para nuevas condiciones. Los precios nuevos aplican a solicitudes nuevas.

## Antes del despliegue

1. Tarifas y ventajas aprobadas. Confirmar impuestos y obligaciones del proveedor.
2. Revisar las condiciones que ya reciben las empresas existentes. Los controles
  nuevos se aplican a licencias emitidas con version comercial 2. Los periodos
  anteriores conservan sus accesos tolerados hasta renovacion o cambio acordado.
3. Crear los nuevos planes como copias, sin reemplazar periodos pagados.
4. Confirmar datos reales del operador, politica de privacidad y textos legales.
5. Publicar los documentos de contratacion solo con aprobacion explicita real,
   nunca con un NIT inventado o una casilla de revision juridica falsa.