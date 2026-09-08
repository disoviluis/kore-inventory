-- Fase 2 de contabilidad: configuración contable por empresa
-- Crea la configuración base por empresa usando los perfiles ya validados:
--   - Empresa 29: restaurante
--   - Empresa 31: restaurante
--   - Empresa 32: manufactura
-- Ejecutar únicamente después de confirmar que Fase 1 fue creada y validada.

CREATE TABLE IF NOT EXISTS configuracion_contable (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  perfil_operativo VARCHAR(40) NOT NULL,
  modulo_comandas_activo TINYINT(1) NOT NULL DEFAULT 0,
  modulo_produccion_activo TINYINT(1) NOT NULL DEFAULT 0,
  maneja_propinas TINYINT(1) NOT NULL DEFAULT 0,
  maneja_inventario TINYINT(1) NOT NULL DEFAULT 0,
  maneja_terceros TINYINT(1) NOT NULL DEFAULT 1,
  centros_costo_activos TINYINT(1) NOT NULL DEFAULT 0,
  cuenta_caja_id INT NULL,
  cuenta_bancos_id INT NULL,
  cuenta_clientes_id INT NULL,
  cuenta_proveedores_id INT NULL,
  cuenta_ingresos_ventas_id INT NULL,
  cuenta_devoluciones_ventas_id INT NULL,
  cuenta_iva_generado_id INT NULL,
  cuenta_iva_descontable_id INT NULL,
  cuenta_retenciones_id INT NULL,
  cuenta_inventario_id INT NULL,
  cuenta_costo_ventas_id INT NULL,
  cuenta_gastos_generales_id INT NULL,
  cuenta_diferencia_inventario_id INT NULL,
  cuenta_propinas_pagar_id INT NULL,
  cuenta_resultado_ejercicio_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_configuracion_empresa (empresa_id),
  KEY idx_configuracion_perfil (perfil_operativo),
  CONSTRAINT fk_configuracion_contable_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  CONSTRAINT fk_configuracion_contable_caja
    FOREIGN KEY (cuenta_caja_id) REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_configuracion_contable_bancos
    FOREIGN KEY (cuenta_bancos_id) REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_configuracion_contable_clientes
    FOREIGN KEY (cuenta_clientes_id) REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_configuracion_contable_proveedores
    FOREIGN KEY (cuenta_proveedores_id) REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_configuracion_contable_ingresos_ventas
    FOREIGN KEY (cuenta_ingresos_ventas_id) REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_configuracion_contable_devoluciones_ventas
    FOREIGN KEY (cuenta_devoluciones_ventas_id) REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_configuracion_contable_iva_generado
    FOREIGN KEY (cuenta_iva_generado_id) REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_configuracion_contable_iva_descontable
    FOREIGN KEY (cuenta_iva_descontable_id) REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_configuracion_contable_retenciones
    FOREIGN KEY (cuenta_retenciones_id) REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_configuracion_contable_inventario
    FOREIGN KEY (cuenta_inventario_id) REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_configuracion_contable_costo_ventas
    FOREIGN KEY (cuenta_costo_ventas_id) REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_configuracion_contable_gastos_generales
    FOREIGN KEY (cuenta_gastos_generales_id) REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_configuracion_contable_diferencia_inventario
    FOREIGN KEY (cuenta_diferencia_inventario_id) REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_configuracion_contable_propinas_pagar
    FOREIGN KEY (cuenta_propinas_pagar_id) REFERENCES plan_cuentas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_configuracion_contable_resultado_ejercicio
    FOREIGN KEY (cuenta_resultado_ejercicio_id) REFERENCES plan_cuentas(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Empresa 29: restaurante
INSERT INTO configuracion_contable (
  empresa_id,
  perfil_operativo,
  modulo_comandas_activo,
  modulo_produccion_activo,
  maneja_propinas,
  maneja_inventario,
  maneja_terceros,
  centros_costo_activos,
  cuenta_caja_id,
  cuenta_bancos_id,
  cuenta_clientes_id,
  cuenta_proveedores_id,
  cuenta_ingresos_ventas_id,
  cuenta_devoluciones_ventas_id,
  cuenta_iva_generado_id,
  cuenta_iva_descontable_id,
  cuenta_retenciones_id,
  cuenta_inventario_id,
  cuenta_costo_ventas_id,
  cuenta_gastos_generales_id,
  cuenta_diferencia_inventario_id,
  cuenta_propinas_pagar_id,
  cuenta_resultado_ejercicio_id
)
SELECT
  29,
  'restaurante',
  1,
  0,
  1,
  1,
  1,
  0,
  MAX(CASE WHEN pc.codigo = '1105' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '1110' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '1305' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '2205' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '4135' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '4175' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '2408' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '1355' THEN pc.id END),
  NULL,
  MAX(CASE WHEN pc.codigo = '1435' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '6135' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '5195' THEN pc.id END),
  NULL,
  MAX(CASE WHEN pc.codigo = '2380' THEN pc.id END),
  NULL
FROM plan_cuentas pc
WHERE pc.empresa_id = 29
ON DUPLICATE KEY UPDATE
  perfil_operativo = VALUES(perfil_operativo),
  modulo_comandas_activo = VALUES(modulo_comandas_activo),
  modulo_produccion_activo = VALUES(modulo_produccion_activo),
  maneja_propinas = VALUES(maneja_propinas),
  maneja_inventario = VALUES(maneja_inventario),
  maneja_terceros = VALUES(maneja_terceros),
  centros_costo_activos = VALUES(centros_costo_activos),
  cuenta_caja_id = VALUES(cuenta_caja_id),
  cuenta_bancos_id = VALUES(cuenta_bancos_id),
  cuenta_clientes_id = VALUES(cuenta_clientes_id),
  cuenta_proveedores_id = VALUES(cuenta_proveedores_id),
  cuenta_ingresos_ventas_id = VALUES(cuenta_ingresos_ventas_id),
  cuenta_devoluciones_ventas_id = VALUES(cuenta_devoluciones_ventas_id),
  cuenta_iva_generado_id = VALUES(cuenta_iva_generado_id),
  cuenta_iva_descontable_id = VALUES(cuenta_iva_descontable_id),
  cuenta_retenciones_id = VALUES(cuenta_retenciones_id),
  cuenta_inventario_id = VALUES(cuenta_inventario_id),
  cuenta_costo_ventas_id = VALUES(cuenta_costo_ventas_id),
  cuenta_gastos_generales_id = VALUES(cuenta_gastos_generales_id),
  cuenta_diferencia_inventario_id = VALUES(cuenta_diferencia_inventario_id),
  cuenta_propinas_pagar_id = VALUES(cuenta_propinas_pagar_id),
  cuenta_resultado_ejercicio_id = VALUES(cuenta_resultado_ejercicio_id);

-- Empresa 31: restaurante
INSERT INTO configuracion_contable (
  empresa_id,
  perfil_operativo,
  modulo_comandas_activo,
  modulo_produccion_activo,
  maneja_propinas,
  maneja_inventario,
  maneja_terceros,
  centros_costo_activos,
  cuenta_caja_id,
  cuenta_bancos_id,
  cuenta_clientes_id,
  cuenta_proveedores_id,
  cuenta_ingresos_ventas_id,
  cuenta_devoluciones_ventas_id,
  cuenta_iva_generado_id,
  cuenta_iva_descontable_id,
  cuenta_retenciones_id,
  cuenta_inventario_id,
  cuenta_costo_ventas_id,
  cuenta_gastos_generales_id,
  cuenta_diferencia_inventario_id,
  cuenta_propinas_pagar_id,
  cuenta_resultado_ejercicio_id
)
SELECT
  31,
  'restaurante',
  1,
  0,
  1,
  1,
  1,
  0,
  MAX(CASE WHEN pc.codigo = '1105' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '1110' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '1305' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '2205' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '4135' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '4175' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '2408' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '1355' THEN pc.id END),
  NULL,
  MAX(CASE WHEN pc.codigo = '1435' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '6135' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '5195' THEN pc.id END),
  NULL,
  MAX(CASE WHEN pc.codigo = '2380' THEN pc.id END),
  NULL
FROM plan_cuentas pc
WHERE pc.empresa_id = 31
ON DUPLICATE KEY UPDATE
  perfil_operativo = VALUES(perfil_operativo),
  modulo_comandas_activo = VALUES(modulo_comandas_activo),
  modulo_produccion_activo = VALUES(modulo_produccion_activo),
  maneja_propinas = VALUES(maneja_propinas),
  maneja_inventario = VALUES(maneja_inventario),
  maneja_terceros = VALUES(maneja_terceros),
  centros_costo_activos = VALUES(centros_costo_activos),
  cuenta_caja_id = VALUES(cuenta_caja_id),
  cuenta_bancos_id = VALUES(cuenta_bancos_id),
  cuenta_clientes_id = VALUES(cuenta_clientes_id),
  cuenta_proveedores_id = VALUES(cuenta_proveedores_id),
  cuenta_ingresos_ventas_id = VALUES(cuenta_ingresos_ventas_id),
  cuenta_devoluciones_ventas_id = VALUES(cuenta_devoluciones_ventas_id),
  cuenta_iva_generado_id = VALUES(cuenta_iva_generado_id),
  cuenta_iva_descontable_id = VALUES(cuenta_iva_descontable_id),
  cuenta_retenciones_id = VALUES(cuenta_retenciones_id),
  cuenta_inventario_id = VALUES(cuenta_inventario_id),
  cuenta_costo_ventas_id = VALUES(cuenta_costo_ventas_id),
  cuenta_gastos_generales_id = VALUES(cuenta_gastos_generales_id),
  cuenta_diferencia_inventario_id = VALUES(cuenta_diferencia_inventario_id),
  cuenta_propinas_pagar_id = VALUES(cuenta_propinas_pagar_id),
  cuenta_resultado_ejercicio_id = VALUES(cuenta_resultado_ejercicio_id);

-- Empresa 32: manufactura
INSERT INTO configuracion_contable (
  empresa_id,
  perfil_operativo,
  modulo_comandas_activo,
  modulo_produccion_activo,
  maneja_propinas,
  maneja_inventario,
  maneja_terceros,
  centros_costo_activos,
  cuenta_caja_id,
  cuenta_bancos_id,
  cuenta_clientes_id,
  cuenta_proveedores_id,
  cuenta_ingresos_ventas_id,
  cuenta_devoluciones_ventas_id,
  cuenta_iva_generado_id,
  cuenta_iva_descontable_id,
  cuenta_retenciones_id,
  cuenta_inventario_id,
  cuenta_costo_ventas_id,
  cuenta_gastos_generales_id,
  cuenta_diferencia_inventario_id,
  cuenta_propinas_pagar_id,
  cuenta_resultado_ejercicio_id
)
SELECT
  32,
  'manufactura',
  0,
  1,
  0,
  1,
  1,
  1,
  MAX(CASE WHEN pc.codigo = '1105' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '1110' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '1305' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '2205' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '4135' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '4175' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '2408' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '1355' THEN pc.id END),
  NULL,
  MAX(CASE WHEN pc.codigo = '1435' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '6135' THEN pc.id END),
  MAX(CASE WHEN pc.codigo = '5195' THEN pc.id END),
  NULL,
  NULL,
  NULL
FROM plan_cuentas pc
WHERE pc.empresa_id = 32
ON DUPLICATE KEY UPDATE
  perfil_operativo = VALUES(perfil_operativo),
  modulo_comandas_activo = VALUES(modulo_comandas_activo),
  modulo_produccion_activo = VALUES(modulo_produccion_activo),
  maneja_propinas = VALUES(maneja_propinas),
  maneja_inventario = VALUES(maneja_inventario),
  maneja_terceros = VALUES(maneja_terceros),
  centros_costo_activos = VALUES(centros_costo_activos),
  cuenta_caja_id = VALUES(cuenta_caja_id),
  cuenta_bancos_id = VALUES(cuenta_bancos_id),
  cuenta_clientes_id = VALUES(cuenta_clientes_id),
  cuenta_proveedores_id = VALUES(cuenta_proveedores_id),
  cuenta_ingresos_ventas_id = VALUES(cuenta_ingresos_ventas_id),
  cuenta_devoluciones_ventas_id = VALUES(cuenta_devoluciones_ventas_id),
  cuenta_iva_generado_id = VALUES(cuenta_iva_generado_id),
  cuenta_iva_descontable_id = VALUES(cuenta_iva_descontable_id),
  cuenta_retenciones_id = VALUES(cuenta_retenciones_id),
  cuenta_inventario_id = VALUES(cuenta_inventario_id),
  cuenta_costo_ventas_id = VALUES(cuenta_costo_ventas_id),
  cuenta_gastos_generales_id = VALUES(cuenta_gastos_generales_id),
  cuenta_diferencia_inventario_id = VALUES(cuenta_diferencia_inventario_id),
  cuenta_propinas_pagar_id = VALUES(cuenta_propinas_pagar_id),
  cuenta_resultado_ejercicio_id = VALUES(cuenta_resultado_ejercicio_id);

-- =============================================================
-- RESUMEN FINAL DE VALIDACION DE FASE 2
-- =============================================================
-- Este bloque debe devolver exactamente 3 filas (empresas 29, 31 y 32)
-- y en la columna estado_final debe aparecer 'OK' para cada una.
SELECT 
  cc.empresa_id,
  e.nombre AS empresa,
  cc.perfil_operativo,
  CASE WHEN cc.maneja_inventario = 1 AND cc.cuenta_inventario_id IS NOT NULL THEN 'OK' ELSE 'FALTA' END AS inventario,
  CASE WHEN cc.maneja_propinas = 1 AND cc.cuenta_propinas_pagar_id IS NOT NULL THEN 'OK' WHEN cc.maneja_propinas = 0 THEN 'NO_APLICA' ELSE 'FALTA' END AS propinas,
  CASE WHEN cc.modulo_produccion_activo = 1 AND cc.cuenta_costo_ventas_id IS NOT NULL THEN 'OK' WHEN cc.modulo_produccion_activo = 0 THEN 'NO_APLICA' ELSE 'FALTA' END AS produccion,
  CASE WHEN cc.cuenta_caja_id IS NOT NULL AND cc.cuenta_bancos_id IS NOT NULL AND cc.cuenta_clientes_id IS NOT NULL AND cc.cuenta_proveedores_id IS NOT NULL AND cc.cuenta_ingresos_ventas_id IS NOT NULL AND cc.cuenta_iva_generado_id IS NOT NULL AND cc.cuenta_iva_descontable_id IS NOT NULL THEN 'OK' ELSE 'FALTA' END AS cuentas_basicas,
  CASE 
    WHEN cc.maneja_inventario = 1 AND cc.cuenta_inventario_id IS NOT NULL
      AND cc.maneja_propinas = 1 AND cc.cuenta_propinas_pagar_id IS NOT NULL
      AND cc.modulo_produccion_activo = 0
      THEN 'OK'
    WHEN cc.maneja_inventario = 1 AND cc.cuenta_inventario_id IS NOT NULL
      AND cc.maneja_propinas = 0
      AND cc.modulo_produccion_activo = 1 AND cc.cuenta_costo_ventas_id IS NOT NULL
      THEN 'OK'
    ELSE 'REVISAR'
  END AS estado_final,
  pc_caja.codigo AS caja_codigo,
  pc_bancos.codigo AS bancos_codigo,
  pc_clientes.codigo AS clientes_codigo,
  pc_proveedores.codigo AS proveedores_codigo,
  pc_ingresos.codigo AS ingresos_codigo,
  pc_iva_gen.codigo AS iva_generado_codigo,
  pc_iva_desc.codigo AS iva_descontable_codigo,
  pc_inv.codigo AS inventario_codigo,
  pc_costo.codigo AS costo_ventas_codigo,
  pc_prop.codigo AS propinas_codigo
FROM configuracion_contable cc
JOIN empresas e ON e.id = cc.empresa_id
LEFT JOIN plan_cuentas pc_caja ON pc_caja.id = cc.cuenta_caja_id
LEFT JOIN plan_cuentas pc_bancos ON pc_bancos.id = cc.cuenta_bancos_id
LEFT JOIN plan_cuentas pc_clientes ON pc_clientes.id = cc.cuenta_clientes_id
LEFT JOIN plan_cuentas pc_proveedores ON pc_proveedores.id = cc.cuenta_proveedores_id
LEFT JOIN plan_cuentas pc_ingresos ON pc_ingresos.id = cc.cuenta_ingresos_ventas_id
LEFT JOIN plan_cuentas pc_iva_gen ON pc_iva_gen.id = cc.cuenta_iva_generado_id
LEFT JOIN plan_cuentas pc_iva_desc ON pc_iva_desc.id = cc.cuenta_iva_descontable_id
LEFT JOIN plan_cuentas pc_inv ON pc_inv.id = cc.cuenta_inventario_id
LEFT JOIN plan_cuentas pc_costo ON pc_costo.id = cc.cuenta_costo_ventas_id
LEFT JOIN plan_cuentas pc_prop ON pc_prop.id = cc.cuenta_propinas_pagar_id
WHERE cc.empresa_id IN (29, 31, 32)
ORDER BY cc.empresa_id;

-- Si todas las filas salen con estado_final = 'OK', entonces la Fase 2 quedó bien configurada.
-- Si alguna aparece 'REVISAR' o 'FALTA', debe corregirse antes de avanzar a Fase 3.
