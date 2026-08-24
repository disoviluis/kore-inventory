-- Nomina Fase 4: novedades y conceptos administrables
-- Compatible con AWS RDS: no usa triggers ni eventos.

INSERT INTO modulos (nombre, nombre_mostrar, descripcion, icono, nivel, categoria, orden, ruta, activo, requiere_licencia)
SELECT 'nomina_novedades', 'Novedades', 'Horas, bonos, descuentos y novedades de empleados', 'bi-journal-plus', 'tenant', 'nomina', 35, '/nomina-novedades', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM modulos WHERE nombre = 'nomina_novedades');

SET @nomina_novedades_id := (SELECT id FROM modulos WHERE nombre = 'nomina_novedades' LIMIT 1);
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT @nomina_novedades_id, a.id, CONCAT('NOMINA.NOVEDADES.', UPPER(a.nombre)), CONCAT(a.nombre_mostrar, ' novedades de nomina'), 1
FROM acciones a
WHERE a.nombre IN ('view','create','edit','delete','approve')
  AND NOT EXISTS (SELECT 1 FROM permisos p WHERE p.modulo_id = @nomina_novedades_id AND p.accion_id = a.id);
