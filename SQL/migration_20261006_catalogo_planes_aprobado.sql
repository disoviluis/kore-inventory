-- Ejecutar MANUALMENTE en kore_inventory despues de respaldo.
-- Crea ofertas nuevas; no cambia empresas, licencias ni periodos existentes.
-- Si alguno de estos nombres ya existe, conserva el registro para no pisar
-- precios que el operador haya editado posteriormente desde la aplicacion.
START TRANSACTION;

INSERT INTO planes (nombre, descripcion, precio_mensual, precio_anual, max_empresas,
  max_usuarios_por_empresa, max_productos, max_facturas_mes, modulos_incluidos,
  soporte_nivel, api_access, white_label, reportes_avanzados, multi_bodega, activo, destacado)
SELECT 'Esencial', 'POS e inventario para una empresa: 3 usuarios, 500 productos y 300 documentos de venta por mes.',
  29900.00, 299000.00, 1, 3, 500, 300,
  JSON_ARRAY('pos','inventario','ventas','clientes','facturacion','impuestos','caja','cuentas_abiertas','usuarios','roles'),
  'email', 0, 0, 0, 0, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM planes WHERE nombre = 'Esencial');

INSERT INTO planes (nombre, descripcion, precio_mensual, precio_anual, max_empresas,
  max_usuarios_por_empresa, max_productos, max_facturas_mes, modulos_incluidos,
  soporte_nivel, api_access, white_label, reportes_avanzados, multi_bodega, activo, destacado)
SELECT 'Gestion', '10 usuarios, compras, activos y mantenimiento, finanzas, 3000 productos, 1500 documentos mensuales y multi-bodega.',
  69900.00, 699000.00, 1, 10, 3000, 1500,
  JSON_ARRAY('pos','inventario','ventas','clientes','facturacion','impuestos','caja','cuentas_abiertas','usuarios','roles',
    'compras','proveedores','bodegas','traslados','activos','mantenimientos','finanzas','reportes'),
  'email', 0, 0, 0, 1, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM planes WHERE nombre = 'Gestion');

INSERT INTO planes (nombre, descripcion, precio_mensual, precio_anual, max_empresas,
  max_usuarios_por_empresa, max_productos, max_facturas_mes, modulos_incluidos,
  soporte_nivel, api_access, white_label, reportes_avanzados, multi_bodega, activo, destacado)
SELECT 'Integral', '25 usuarios, productos y documentos mensuales sin limite; repuestos, conteos, cocina, contabilidad, nomina y reportes financieros.',
  129900.00, 1299000.00, 1, 25, NULL, NULL,
  JSON_ARRAY('pos','inventario','ventas','clientes','facturacion','impuestos','caja','cuentas_abiertas','usuarios','roles',
    'compras','proveedores','bodegas','traslados','activos','mantenimientos','finanzas','reportes',
    'repuestos','inventarios_fisicos','comandas','cocina','contabilidad','nomina'),
  'prioritario', 0, 0, 1, 1, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM planes WHERE nombre = 'Integral');

-- Retira solo las tres ofertas antiguas conocidas del catalogo de nuevas ventas.
-- Los contratos y empresas que las referencian siguen apuntando al mismo plan.
UPDATE planes SET activo = 0, destacado = 0
WHERE (id = 1 AND nombre IN ('Basico','Básico'))
   OR (id = 2 AND nombre = 'Profesional')
   OR (id = 3 AND nombre = 'Enterprise');

COMMIT;

SELECT id, nombre, precio_mensual, precio_anual, max_usuarios_por_empresa,
       max_productos, max_facturas_mes, multi_bodega, reportes_avanzados, activo
FROM planes ORDER BY id;
-- No se inventan pagos ni se reinician pruebas. No se alteran documentos legales.