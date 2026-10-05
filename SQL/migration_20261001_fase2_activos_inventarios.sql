-- Fase 2: esquema base para activos, repuestos, mantenimiento e inventario fisico.
-- Destino: MySQL 8.4.8, base kore_inventory (AWS RDS).
-- EJECUCION: manual por el usuario, despues de backup y prueba sobre una copia.
-- Este agente NO ejecuta este archivo ni se conecta a RDS.
--
-- IMPORTANTE:
-- 1. Revisar DATABASE() y VERSION() antes de ejecutar.
-- 2. El DDL de MySQL hace commits implicitos; no confiar en ROLLBACK global.
-- 3. Las tablas CREATE IF NOT EXISTS y los seeds RBAC son repetibles.
-- 4. El bloque de ALTER TABLE del ledger es de una sola ejecucion. Si se interrumpe,
--    inspeccionar columnas/indices/FK existentes antes de continuar; no repetirlo ciegamente.
-- 5. Las filas historicas de inventario_movimientos conservaran bodega_id NULL; no
--    existe fuente fiable para reconstruir su bodega.
-- 6. Todas las tablas usan InnoDB. Los IDs de empresa/producto/bodega/usuario siguen
--    el tipo INT confirmado en RDS. Cantidades siguen DECIMAL(15,3).
-- 7. Se reutilizan los indices unicos RDS existentes uk_empresa_sku,
--    uk_empresa_codigo y uk_producto_bodega; no se recrean en este script.

SELECT DATABASE() AS esquema_destino, VERSION() AS version_mysql;

-- -----------------------------------------------------------------------------
-- A. Catalogos RBAC existentes: agregar acciones y modulos al sistema actual.
-- -----------------------------------------------------------------------------

INSERT INTO acciones (nombre, nombre_mostrar, descripcion, activo)
VALUES
  ('count', 'Contar', 'Registrar conteos fisicos independientes', 1),
  ('view_results', 'Ver resultados', 'Consultar resultados y conciliaciones de conteos', 1),
  ('close', 'Cerrar', 'Cerrar sesiones u ordenes del modulo', 1),
  ('reopen', 'Reabrir', 'Reabrir sesiones o procesos cerrados', 1),
  ('reconcile', 'Conciliar', 'Ejecutar o confirmar conciliaciones', 1),
  ('review', 'Revisar', 'Revisar solicitudes y diferencias', 1),
  ('apply', 'Aplicar', 'Aplicar cambios de inventario autorizados', 1),
  ('install', 'Instalar', 'Instalar repuestos en activos', 1),
  ('remove', 'Retirar', 'Retirar repuestos de activos', 1),
  ('repair', 'Reparar', 'Registrar reparacion de repuestos', 1),
  ('retire', 'Dar de baja', 'Dar de baja activos o repuestos', 1)
ON DUPLICATE KEY UPDATE
  nombre_mostrar = VALUES(nombre_mostrar),
  descripcion = VALUES(descripcion),
  activo = 1;

INSERT INTO modulos
  (nombre, nombre_mostrar, descripcion, icono, nivel, categoria, orden, ruta, activo, requiere_licencia)
VALUES
  ('activos', 'Activos', 'Gestion y trazabilidad de activos fijos', 'bi-pc-display', 'tenant', 'activos', 40, '/activos', 1, 1),
  ('activos_config', 'Configuracion de activos', 'Categorias, tipos y atributos de activos', 'bi-sliders', 'tenant', 'activos', 41, '/activos-configuracion', 1, 1),
  ('repuestos', 'Repuestos', 'Catalogo, disponibilidad y trazabilidad de repuestos', 'bi-tools', 'tenant', 'mantenimiento', 42, '/repuestos', 1, 1),
  ('mantenimientos', 'Mantenimientos', 'Ordenes de trabajo e historial de mantenimiento', 'bi-wrench-adjustable', 'tenant', 'mantenimiento', 43, '/mantenimientos', 1, 1),
  ('inventarios_fisicos', 'Inventarios fisicos', 'Conteos, conciliaciones y sesiones por bodega', 'bi-clipboard-check', 'tenant', 'inventario', 44, '/inventarios-fisicos', 1, 1),
  ('ajustes_inventario', 'Ajustes de inventario', 'Solicitudes y aplicacion autorizada de ajustes', 'bi-arrow-left-right', 'tenant', 'inventario', 45, '/ajustes-inventario', 1, 1)
ON DUPLICATE KEY UPDATE
  nombre_mostrar = VALUES(nombre_mostrar),
  descripcion = VALUES(descripcion),
  icono = VALUES(icono),
  nivel = VALUES(nivel),
  categoria = VALUES(categoria),
  orden = VALUES(orden),
  ruta = VALUES(ruta),
  activo = 1,
  requiere_licencia = 1;

-- Seed de permisos mediante los IDs reales de los catalogos (sin IDs fijos).
INSERT INTO permisos (modulo_id, accion_id, codigo, descripcion, activo)
SELECT m.id, a.id, CONCAT(d.modulo, '.', d.accion), d.descripcion, 1
FROM (
  SELECT 'activos' AS modulo, 'view' AS accion, 'Consultar activos y su historial' AS descripcion
  UNION ALL SELECT 'activos', 'create', 'Crear activos'
  UNION ALL SELECT 'activos', 'edit', 'Editar datos de activos'
  UNION ALL SELECT 'activos', 'delete', 'Eliminar activos sin historial asociado'
  UNION ALL SELECT 'activos', 'assign', 'Asignar activos a responsables o ubicaciones'
  UNION ALL SELECT 'activos', 'retire', 'Dar de baja activos'
  UNION ALL SELECT 'activos', 'export', 'Exportar activos'
  UNION ALL SELECT 'activos_config', 'view', 'Consultar configuracion de activos'
  UNION ALL SELECT 'activos_config', 'create', 'Crear configuracion de activos'
  UNION ALL SELECT 'activos_config', 'edit', 'Editar configuracion de activos'
  UNION ALL SELECT 'activos_config', 'delete', 'Desactivar configuracion de activos'
  UNION ALL SELECT 'repuestos', 'view', 'Consultar repuestos y trazabilidad'
  UNION ALL SELECT 'repuestos', 'create', 'Crear metadatos de repuestos'
  UNION ALL SELECT 'repuestos', 'edit', 'Editar metadatos de repuestos'
  UNION ALL SELECT 'repuestos', 'assign', 'Reservar repuestos'
  UNION ALL SELECT 'repuestos', 'install', 'Instalar repuestos'
  UNION ALL SELECT 'repuestos', 'remove', 'Retirar repuestos'
  UNION ALL SELECT 'repuestos', 'repair', 'Registrar reparacion de repuestos'
  UNION ALL SELECT 'repuestos', 'retire', 'Dar de baja repuestos'
  UNION ALL SELECT 'repuestos', 'export', 'Exportar repuestos'
  UNION ALL SELECT 'mantenimientos', 'view', 'Consultar ordenes e historial de mantenimiento'
  UNION ALL SELECT 'mantenimientos', 'create', 'Crear ordenes de mantenimiento'
  UNION ALL SELECT 'mantenimientos', 'edit', 'Editar ordenes de mantenimiento'
  UNION ALL SELECT 'mantenimientos', 'close', 'Cerrar ordenes de mantenimiento'
  UNION ALL SELECT 'mantenimientos', 'approve', 'Aprobar ordenes de mantenimiento cuando se requiera'
  UNION ALL SELECT 'mantenimientos', 'export', 'Exportar mantenimientos'
  UNION ALL SELECT 'inventarios_fisicos', 'view', 'Consultar inventarios y sesiones propias autorizadas'
  UNION ALL SELECT 'inventarios_fisicos', 'create', 'Crear inventarios fisicos'
  UNION ALL SELECT 'inventarios_fisicos', 'edit', 'Administrar alcance y configuracion del inventario'
  UNION ALL SELECT 'inventarios_fisicos', 'count', 'Capturar cantidades de una sesion asignada'
  UNION ALL SELECT 'inventarios_fisicos', 'view_results', 'Consultar resultados de conteos cerrados'
  UNION ALL SELECT 'inventarios_fisicos', 'review', 'Resolver diferencias de conteo en revision manual'
  UNION ALL SELECT 'inventarios_fisicos', 'close', 'Finalizar una sesion de conteo'
  UNION ALL SELECT 'inventarios_fisicos', 'reopen', 'Reabrir una sesion con motivo'
  UNION ALL SELECT 'inventarios_fisicos', 'reconcile', 'Conciliar conteos y stock de corte'
  UNION ALL SELECT 'inventarios_fisicos', 'approve', 'Aprobar conciliaciones'
  UNION ALL SELECT 'inventarios_fisicos', 'export', 'Exportar resultados de inventario'
  UNION ALL SELECT 'ajustes_inventario', 'view', 'Consultar solicitudes de ajuste'
  UNION ALL SELECT 'ajustes_inventario', 'export', 'Exportar solicitudes de ajuste'
  UNION ALL SELECT 'ajustes_inventario', 'create', 'Solicitar ajustes derivados de conciliacion'
  UNION ALL SELECT 'ajustes_inventario', 'review', 'Revisar solicitudes de ajuste'
  UNION ALL SELECT 'ajustes_inventario', 'approve', 'Autorizar solicitudes de ajuste'
  UNION ALL SELECT 'ajustes_inventario', 'apply', 'Aplicar ajustes previamente autorizados'
) AS d
INNER JOIN modulos m ON m.nombre = d.modulo AND m.activo = 1
INNER JOIN acciones a ON a.nombre = d.accion AND a.activo = 1
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion), activo = 1;

-- -----------------------------------------------------------------------------
-- B. Dominio de activos.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS activos_categorias (
  id INT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT NULL,
  estado ENUM('activa','inactiva') NOT NULL DEFAULT 'activa',
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_activos_categoria_empresa_nombre (empresa_id, nombre),
  KEY idx_activos_categoria_empresa_estado (empresa_id, estado),
  CONSTRAINT fk_activos_categoria_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_activos_categoria_usuario FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activos_tipos (
  id INT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  categoria_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT NULL,
  estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_activos_tipo_empresa_categoria_nombre (empresa_id, categoria_id, nombre),
  KEY idx_activos_tipo_empresa_estado (empresa_id, estado),
  CONSTRAINT fk_activos_tipo_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_activos_tipo_categoria FOREIGN KEY (categoria_id) REFERENCES activos_categorias(id),
  CONSTRAINT fk_activos_tipo_usuario FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activos_atributos_def (
  id INT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  tipo_id INT NOT NULL,
  clave VARCHAR(80) NOT NULL,
  etiqueta VARCHAR(120) NOT NULL,
  tipo_dato ENUM('texto','numero','booleano','fecha','opcion') NOT NULL,
  unidad VARCHAR(30) NULL,
  requerido TINYINT(1) NOT NULL DEFAULT 0,
  opciones_json JSON NULL,
  orden SMALLINT NOT NULL DEFAULT 0,
  estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_activos_atributo_tipo_clave (tipo_id, clave),
  KEY idx_activos_atributo_empresa (empresa_id, tipo_id, estado),
  CONSTRAINT fk_activos_atributo_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_activos_atributo_tipo FOREIGN KEY (tipo_id) REFERENCES activos_tipos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activos_consecutivos (
  empresa_id INT NOT NULL,
  prefijo VARCHAR(20) NOT NULL DEFAULT 'KI',
  siguiente BIGINT UNSIGNED NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id),
  CONSTRAINT fk_activos_consecutivo_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activos (
  id INT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  codigo VARCHAR(40) NOT NULL,
  codigo_interno VARCHAR(80) NULL,
  categoria_id INT NOT NULL,
  tipo_id INT NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT NULL,
  marca VARCHAR(100) NULL,
  modelo VARCHAR(100) NULL,
  numero_serie VARCHAR(120) NULL,
  referencia VARCHAR(120) NULL,
  estado ENUM('active','in_maintenance','out_of_service','retired','lost') NOT NULL DEFAULT 'active',
  fecha_adquisicion DATE NULL,
  fecha_puesta_servicio DATE NULL,
  valor_adquisicion DECIMAL(15,2) NULL,
  proveedor_id INT NULL,
  documento_compra VARCHAR(120) NULL,
  bodega_id INT NULL,
  ubicacion VARCHAR(160) NULL,
  responsable_id INT NULL,
  imagen_url VARCHAR(1000) NULL,
  observaciones TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_activos_empresa_codigo (empresa_id, codigo),
  UNIQUE KEY uk_activos_empresa_codigo_interno (empresa_id, codigo_interno),
  KEY idx_activos_empresa_estado (empresa_id, estado),
  KEY idx_activos_empresa_tipo (empresa_id, tipo_id),
  KEY idx_activos_empresa_bodega (empresa_id, bodega_id),
  KEY idx_activos_empresa_responsable (empresa_id, responsable_id),
  UNIQUE KEY uk_activos_empresa_numero_serie (empresa_id, numero_serie),
  CONSTRAINT fk_activos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_activos_categoria FOREIGN KEY (categoria_id) REFERENCES activos_categorias(id),
  CONSTRAINT fk_activos_tipo FOREIGN KEY (tipo_id) REFERENCES activos_tipos(id),
  CONSTRAINT fk_activos_bodega FOREIGN KEY (bodega_id) REFERENCES bodegas(id) ON DELETE SET NULL,
  CONSTRAINT fk_activos_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL,
  CONSTRAINT fk_activos_responsable FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_activos_creador FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activos_atributos_valores (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  activo_id INT NOT NULL,
  atributo_id INT NOT NULL,
  valor_texto TEXT NULL,
  valor_numero DECIMAL(20,6) NULL,
  valor_booleano TINYINT(1) NULL,
  valor_fecha DATE NULL,
  updated_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_activo_atributo_valor (activo_id, atributo_id),
  KEY idx_activo_atributos_empresa (empresa_id, activo_id),
  CONSTRAINT fk_activo_valor_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_activo_valor_activo FOREIGN KEY (activo_id) REFERENCES activos(id),
  CONSTRAINT fk_activo_valor_def FOREIGN KEY (atributo_id) REFERENCES activos_atributos_def(id),
  CONSTRAINT fk_activo_valor_usuario FOREIGN KEY (updated_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activos_asignaciones (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  activo_id INT NOT NULL,
  usuario_id INT NULL,
  bodega_id INT NULL,
  ubicacion VARCHAR(160) NULL,
  asignado_por INT NULL,
  fecha_asignacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_devolucion DATETIME NULL,
  motivo VARCHAR(255) NULL,
  observaciones TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activo_asignaciones_historial (empresa_id, activo_id, fecha_asignacion),
  KEY idx_activo_asignaciones_usuario (empresa_id, usuario_id, fecha_devolucion),
  CONSTRAINT fk_activo_asignacion_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_activo_asignacion_activo FOREIGN KEY (activo_id) REFERENCES activos(id),
  CONSTRAINT fk_activo_asignacion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_activo_asignacion_bodega FOREIGN KEY (bodega_id) REFERENCES bodegas(id) ON DELETE SET NULL,
  CONSTRAINT fk_activo_asignacion_actor FOREIGN KEY (asignado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activos_eventos (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  activo_id INT NOT NULL,
  tipo_evento VARCHAR(60) NOT NULL,
  referencia_tipo VARCHAR(50) NULL,
  referencia_id BIGINT NULL,
  motivo VARCHAR(255) NULL,
  datos_anteriores JSON NULL,
  datos_nuevos JSON NULL,
  usuario_id INT NULL,
  ocurrido_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activos_eventos_historial (empresa_id, activo_id, ocurrido_at),
  KEY idx_activos_eventos_referencia (referencia_tipo, referencia_id),
  CONSTRAINT fk_activos_evento_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_activos_evento_activo FOREIGN KEY (activo_id) REFERENCES activos(id),
  CONSTRAINT fk_activos_evento_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla polimorfica de metadatos; el servicio valida la entidad destino y su tenant.
CREATE TABLE IF NOT EXISTS activos_archivos (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  entidad_tipo ENUM('activo','mantenimiento','repuesto','inventario','sesion_conteo','ajuste') NOT NULL,
  entidad_id BIGINT NOT NULL,
  origen ENUM('url','s3_upload') NOT NULL,
  url VARCHAR(1200) NULL,
  s3_key VARCHAR(700) NULL,
  nivel_acceso ENUM('publico','privado') NOT NULL DEFAULT 'publico',
  nombre_archivo VARCHAR(255) NULL,
  mime_type VARCHAR(120) NULL,
  tamano_bytes BIGINT UNSIGNED NULL,
  creado_por INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_activos_archivos_s3_key (s3_key),
  KEY idx_activos_archivos_entidad (empresa_id, entidad_tipo, entidad_id, created_at),
  CONSTRAINT fk_activos_archivos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_activos_archivos_usuario FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT chk_activos_archivos_referencia CHECK (url IS NOT NULL OR s3_key IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- C. Repuestos serializados y mantenimiento. Stock agregado sigue en productos.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS mantenimiento_consecutivos (
  empresa_id INT NOT NULL,
  prefijo VARCHAR(20) NOT NULL DEFAULT 'MT',
  siguiente BIGINT UNSIGNED NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (empresa_id),
  CONSTRAINT fk_mantenimiento_consecutivo_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mantenimiento_tipos (
  id INT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  codigo VARCHAR(40) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_mantenimiento_tipo_empresa_codigo (empresa_id, codigo),
  CONSTRAINT fk_mantenimiento_tipo_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO mantenimiento_tipos (empresa_id, codigo, nombre)
SELECT e.id, tipos.codigo, tipos.nombre
FROM empresas e
CROSS JOIN (
  SELECT 'preventivo' AS codigo, 'Preventivo' AS nombre
  UNION ALL SELECT 'correctivo', 'Correctivo'
  UNION ALL SELECT 'predictivo', 'Predictivo'
  UNION ALL SELECT 'inspeccion', 'Inspección'
  UNION ALL SELECT 'calibracion', 'Calibración'
  UNION ALL SELECT 'otro', 'Otro'
) tipos;

-- `repuestos_catalogo` se crea en SQL/migration_20261001_fase4_repuestos.sql,
-- que coincide con el controlador existente en backend/src/platform/repuestos.

CREATE TABLE IF NOT EXISTS repuestos_compatibilidad (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  producto_id INT NOT NULL,
  activo_tipo_id INT NOT NULL,
  notas VARCHAR(500) NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_repuesto_tipo_compatible (producto_id, activo_tipo_id),
  KEY idx_repuesto_compatibilidad_empresa (empresa_id, activo_tipo_id),
  CONSTRAINT fk_repuesto_compat_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_repuesto_compat_producto FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT fk_repuesto_compat_tipo FOREIGN KEY (activo_tipo_id) REFERENCES activos_tipos(id),
  CONSTRAINT fk_repuesto_compat_usuario FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repuestos_unidades (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  producto_id INT NOT NULL,
  numero_serie VARCHAR(160) NOT NULL,
  lote VARCHAR(100) NULL,
  estado ENUM('available','reserved','installed','in_repair','quarantine','unrepairable','retired') NOT NULL DEFAULT 'available',
  activo_actual_id INT NULL,
  bodega_actual_id INT NULL,
  recibido_at DATETIME NULL,
  notas TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_repuesto_unidad_serie (empresa_id, producto_id, numero_serie),
  KEY idx_repuesto_unidad_estado (empresa_id, estado, bodega_actual_id),
  KEY idx_repuesto_unidad_activo (empresa_id, activo_actual_id),
  CONSTRAINT fk_repuesto_unidad_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_repuesto_unidad_producto FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT fk_repuesto_unidad_activo FOREIGN KEY (activo_actual_id) REFERENCES activos(id) ON DELETE SET NULL,
  CONSTRAINT fk_repuesto_unidad_bodega FOREIGN KEY (bodega_actual_id) REFERENCES bodegas(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mantenimiento_ordenes (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  codigo VARCHAR(50) NOT NULL,
  activo_id INT NOT NULL,
  tipo_id INT NOT NULL,
  estado ENUM('draft','scheduled','in_progress','waiting_parts','completed','cancelled') NOT NULL DEFAULT 'draft',
  prioridad ENUM('baja','normal','alta','critica') NOT NULL DEFAULT 'normal',
  solicitada_por INT NULL,
  tecnico_id INT NULL,
  programada_at DATETIME NULL,
  iniciada_at DATETIME NULL,
  cerrada_at DATETIME NULL,
  diagnostico TEXT NULL,
  trabajo_realizado TEXT NULL,
  costo_mano_obra DECIMAL(15,2) NOT NULL DEFAULT 0,
  costo_externo DECIMAL(15,2) NOT NULL DEFAULT 0,
  observaciones TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_mantenimiento_orden_empresa_codigo (empresa_id, codigo),
  KEY idx_mantenimiento_orden_activo (empresa_id, activo_id, created_at),
  KEY idx_mantenimiento_orden_estado (empresa_id, estado, programada_at),
  KEY idx_mantenimiento_orden_tecnico (empresa_id, tecnico_id, estado),
  CONSTRAINT fk_mantenimiento_orden_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_mantenimiento_orden_activo FOREIGN KEY (activo_id) REFERENCES activos(id),
  CONSTRAINT fk_mantenimiento_orden_tipo FOREIGN KEY (tipo_id) REFERENCES mantenimiento_tipos(id),
  CONSTRAINT fk_mantenimiento_orden_solicitante FOREIGN KEY (solicitada_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_mantenimiento_orden_tecnico FOREIGN KEY (tecnico_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_mantenimiento_orden_creador FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS repuestos_unidades_eventos (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  unidad_id BIGINT NOT NULL,
  tipo_evento VARCHAR(40) NOT NULL,
  estado_anterior VARCHAR(30) NULL,
  estado_nuevo VARCHAR(30) NULL,
  activo_id INT NULL,
  mantenimiento_id BIGINT NULL,
  bodega_id INT NULL,
  movimiento_id INT NULL,
  motivo VARCHAR(255) NULL,
  usuario_id INT NULL,
  ocurrido_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_repuesto_evento_unidad (empresa_id, unidad_id, ocurrido_at),
  KEY idx_repuesto_evento_activo (empresa_id, activo_id, ocurrido_at),
  CONSTRAINT fk_repuesto_evento_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_repuesto_evento_unidad FOREIGN KEY (unidad_id) REFERENCES repuestos_unidades(id),
  CONSTRAINT fk_repuesto_evento_activo FOREIGN KEY (activo_id) REFERENCES activos(id),
  CONSTRAINT fk_repuesto_evento_mantenimiento FOREIGN KEY (mantenimiento_id) REFERENCES mantenimiento_ordenes(id),
  CONSTRAINT fk_repuesto_evento_bodega FOREIGN KEY (bodega_id) REFERENCES bodegas(id) ON DELETE SET NULL,
  CONSTRAINT fk_repuesto_evento_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_repuesto_evento_movimiento FOREIGN KEY (movimiento_id) REFERENCES inventario_movimientos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mantenimiento_ordenes_repuestos (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  mantenimiento_id BIGINT NOT NULL,
  producto_id INT NOT NULL,
  unidad_serial_id BIGINT NULL,
  bodega_id INT NULL,
  operacion ENUM('instalado','consumido','retirado','devuelto') NOT NULL,
  cantidad DECIMAL(15,3) NOT NULL,
  movimiento_id INT NULL,
  motivo_retiro VARCHAR(255) NULL,
  observaciones TEXT NULL,
  usuario_id INT NULL,
  ocurrido_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mantenimiento_repuesto_orden (empresa_id, mantenimiento_id),
  KEY idx_mantenimiento_repuesto_producto (empresa_id, producto_id, ocurrido_at),
  CONSTRAINT fk_mant_repuesto_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_mant_repuesto_orden FOREIGN KEY (mantenimiento_id) REFERENCES mantenimiento_ordenes(id),
  CONSTRAINT fk_mant_repuesto_producto FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT fk_mant_repuesto_unidad FOREIGN KEY (unidad_serial_id) REFERENCES repuestos_unidades(id),
  CONSTRAINT fk_mant_repuesto_bodega FOREIGN KEY (bodega_id) REFERENCES bodegas(id),
  CONSTRAINT fk_mant_repuesto_movimiento FOREIGN KEY (movimiento_id) REFERENCES inventario_movimientos(id) ON DELETE SET NULL,
  CONSTRAINT fk_mant_repuesto_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- D. Inventarios fisicos, rondas independientes, resultados y ajustes.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inventarios_fisicos (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  codigo VARCHAR(50) NOT NULL,
  nombre VARCHAR(160) NOT NULL,
  estado ENUM('draft','scheduled','counting','reconciliation','review','adjustment_pending','closed','cancelled') NOT NULL DEFAULT 'draft',
  ventana_inicio DATETIME NULL,
  ventana_fin DATETIME NULL,
  max_rondas SMALLINT UNSIGNED NOT NULL DEFAULT 2,
  corte_stock_at DATETIME NULL,
  created_by INT NULL,
  closed_by INT NULL,
  closed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_inventario_fisico_empresa_codigo (empresa_id, codigo),
  KEY idx_inventario_fisico_empresa_estado (empresa_id, estado, ventana_inicio),
  CONSTRAINT fk_inventario_fisico_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_inventario_fisico_creador FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_inventario_fisico_cerrador FOREIGN KEY (closed_by) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT chk_inventario_fisico_rondas CHECK (max_rondas >= 2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventarios_fisicos_bodegas (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  inventario_id BIGINT NOT NULL,
  bodega_id INT NOT NULL,
  estado ENUM('not_started','counting','reconciliation','review','reconciled','closed') NOT NULL DEFAULT 'not_started',
  iniciada_at DATETIME NULL,
  corte_stock_at DATETIME NULL,
  cerrada_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_inventario_fisico_bodega (inventario_id, bodega_id),
  KEY idx_inventario_fisico_bodegas_empresa (empresa_id, estado),
  CONSTRAINT fk_inv_fisico_bodega_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_inv_fisico_bodega_inventario FOREIGN KEY (inventario_id) REFERENCES inventarios_fisicos(id),
  CONSTRAINT fk_inv_fisico_bodega_bodega FOREIGN KEY (bodega_id) REFERENCES bodegas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventarios_rondas (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  inventario_id BIGINT NOT NULL,
  numero SMALLINT UNSIGNED NOT NULL,
  estado ENUM('not_started','in_progress','completed','authorized') NOT NULL DEFAULT 'not_started',
  responsable_id INT NULL,
  iniciada_at DATETIME NULL,
  terminada_at DATETIME NULL,
  autorizada_por INT NULL,
  autorizada_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_inventario_ronda_numero (inventario_id, numero),
  KEY idx_inventario_ronda_empresa_estado (empresa_id, estado),
  CONSTRAINT fk_inventario_ronda_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_inventario_ronda_inventario FOREIGN KEY (inventario_id) REFERENCES inventarios_fisicos(id),
  CONSTRAINT fk_inventario_ronda_responsable FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_inventario_ronda_autoriza FOREIGN KEY (autorizada_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventarios_sesiones (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  ronda_id BIGINT NOT NULL,
  inventario_bodega_id BIGINT NOT NULL,
  estado ENUM('not_started','in_progress','completed','locked','reopened') NOT NULL DEFAULT 'not_started',
  version INT UNSIGNED NOT NULL DEFAULT 1,
  iniciada_por INT NULL,
  iniciada_at DATETIME NULL,
  cerrada_por INT NULL,
  cerrada_at DATETIME NULL,
  dispositivo VARCHAR(160) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_inventario_sesion_ronda_bodega (ronda_id, inventario_bodega_id),
  KEY idx_inventario_sesion_empresa_estado (empresa_id, estado),
  CONSTRAINT fk_inventario_sesion_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_inventario_sesion_ronda FOREIGN KEY (ronda_id) REFERENCES inventarios_rondas(id),
  CONSTRAINT fk_inventario_sesion_bodega FOREIGN KEY (inventario_bodega_id) REFERENCES inventarios_fisicos_bodegas(id),
  CONSTRAINT fk_inventario_sesion_inicio FOREIGN KEY (iniciada_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_inventario_sesion_cierre FOREIGN KEY (cerrada_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventarios_sesiones_integrantes (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  sesion_id BIGINT NOT NULL,
  usuario_id INT NOT NULL,
  rol ENUM('responsable','apoyo','observador') NOT NULL DEFAULT 'apoyo',
  agregado_por INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_inventario_sesion_integrante (sesion_id, usuario_id),
  KEY idx_inventario_integrante_usuario (empresa_id, usuario_id),
  CONSTRAINT fk_inventario_integrante_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_inventario_integrante_sesion FOREIGN KEY (sesion_id) REFERENCES inventarios_sesiones(id),
  CONSTRAINT fk_inventario_integrante_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_inventario_integrante_agregado FOREIGN KEY (agregado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventarios_sesiones_productos (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  sesion_id BIGINT NOT NULL,
  producto_id INT NOT NULL,
  cobertura ENUM('pending','counted','not_present','excluded') NOT NULL DEFAULT 'pending',
  cantidad_declarada DECIMAL(15,3) NULL,
  confirmado_por INT NULL,
  confirmado_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_inventario_sesion_producto (sesion_id, producto_id),
  KEY idx_inventario_sesion_producto_empresa (empresa_id, producto_id),
  CONSTRAINT fk_inventario_sesion_producto_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_inventario_sesion_producto_sesion FOREIGN KEY (sesion_id) REFERENCES inventarios_sesiones(id),
  CONSTRAINT fk_inventario_sesion_producto_producto FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT fk_inventario_sesion_producto_usuario FOREIGN KEY (confirmado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT chk_inventario_sesion_producto_cantidad CHECK (cantidad_declarada IS NULL OR cantidad_declarada >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventarios_conteo_lineas (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  sesion_id BIGINT NOT NULL,
  producto_id INT NOT NULL,
  unidad_serial_id BIGINT NULL,
  ubicacion VARCHAR(160) NULL,
  cantidad DECIMAL(15,3) NOT NULL,
  idempotency_key CHAR(36) NOT NULL,
  capturado_por INT NULL,
  capturado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  anulado_por INT NULL,
  anulado_at DATETIME NULL,
  motivo_anulacion VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_inventario_linea_idempotencia (sesion_id, idempotency_key),
  KEY idx_inventario_linea_producto (empresa_id, sesion_id, producto_id),
  KEY idx_inventario_linea_serial (unidad_serial_id),
  CONSTRAINT fk_inventario_linea_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_inventario_linea_sesion FOREIGN KEY (sesion_id) REFERENCES inventarios_sesiones(id),
  CONSTRAINT fk_inventario_linea_producto FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT fk_inventario_linea_serial FOREIGN KEY (unidad_serial_id) REFERENCES repuestos_unidades(id),
  CONSTRAINT fk_inventario_linea_capturador FOREIGN KEY (capturado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_inventario_linea_anulador FOREIGN KEY (anulado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT chk_inventario_linea_cantidad CHECK (cantidad >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventarios_stock_snapshot (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  inventario_id BIGINT NOT NULL,
  bodega_id INT NOT NULL,
  producto_id INT NOT NULL,
  stock_sistema DECIMAL(15,3) NOT NULL,
  stock_reservado DECIMAL(15,3) NOT NULL DEFAULT 0,
  capturado_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_inventario_snapshot_producto (inventario_id, bodega_id, producto_id),
  KEY idx_inventario_snapshot_empresa_producto (empresa_id, producto_id),
  CONSTRAINT fk_inventario_snapshot_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_inventario_snapshot_inventario FOREIGN KEY (inventario_id) REFERENCES inventarios_fisicos(id),
  CONSTRAINT fk_inventario_snapshot_bodega FOREIGN KEY (bodega_id) REFERENCES bodegas(id),
  CONSTRAINT fk_inventario_snapshot_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventarios_resultados (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  inventario_id BIGINT NOT NULL,
  bodega_id INT NOT NULL,
  producto_id INT NOT NULL,
  stock_sistema DECIMAL(15,3) NOT NULL,
  cantidad_fisica DECIMAL(15,3) NULL,
  diferencia DECIMAL(15,3) NULL,
  estado ENUM('incomplete','matched','difference','review','approved') NOT NULL DEFAULT 'incomplete',
  ronda_resolutiva_id BIGINT NULL,
  resuelto_por INT NULL,
  resuelto_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_inventario_resultado_producto (inventario_id, bodega_id, producto_id),
  KEY idx_inventario_resultado_empresa_estado (empresa_id, estado, bodega_id),
  CONSTRAINT fk_inventario_resultado_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_inventario_resultado_inventario FOREIGN KEY (inventario_id) REFERENCES inventarios_fisicos(id),
  CONSTRAINT fk_inventario_resultado_bodega FOREIGN KEY (bodega_id) REFERENCES bodegas(id),
  CONSTRAINT fk_inventario_resultado_producto FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT fk_inventario_resultado_ronda FOREIGN KEY (ronda_resolutiva_id) REFERENCES inventarios_rondas(id) ON DELETE SET NULL,
  CONSTRAINT fk_inventario_resultado_usuario FOREIGN KEY (resuelto_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventarios_resultados_rondas (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  resultado_id BIGINT NOT NULL,
  ronda_id BIGINT NOT NULL,
  cantidad DECIMAL(15,3) NULL,
  cobertura ENUM('complete','incomplete','not_present') NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_inventario_resultado_ronda (resultado_id, ronda_id),
  KEY idx_inventario_resultado_ronda_empresa (empresa_id, ronda_id),
  CONSTRAINT fk_inventario_resultado_ronda_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_inventario_resultado_ronda_resultado FOREIGN KEY (resultado_id) REFERENCES inventarios_resultados(id),
  CONSTRAINT fk_inventario_resultado_ronda_ronda FOREIGN KEY (ronda_id) REFERENCES inventarios_rondas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventarios_eventos (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  inventario_id BIGINT NOT NULL,
  bodega_id INT NULL,
  sesion_id BIGINT NULL,
  tipo_evento VARCHAR(60) NOT NULL,
  motivo VARCHAR(255) NULL,
  datos_anteriores JSON NULL,
  datos_nuevos JSON NULL,
  usuario_id INT NULL,
  ocurrido_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventario_evento_historial (empresa_id, inventario_id, ocurrido_at),
  CONSTRAINT fk_inventario_evento_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_inventario_evento_inventario FOREIGN KEY (inventario_id) REFERENCES inventarios_fisicos(id),
  CONSTRAINT fk_inventario_evento_bodega FOREIGN KEY (bodega_id) REFERENCES bodegas(id) ON DELETE SET NULL,
  CONSTRAINT fk_inventario_evento_sesion FOREIGN KEY (sesion_id) REFERENCES inventarios_sesiones(id) ON DELETE SET NULL,
  CONSTRAINT fk_inventario_evento_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventarios_bodega_bloqueos (
  bodega_id INT NOT NULL,
  empresa_id INT NOT NULL,
  sesion_id BIGINT NOT NULL,
  bloqueado_por INT NULL,
  bloqueado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (bodega_id),
  UNIQUE KEY uk_inventario_bloqueo_sesion (sesion_id),
  KEY idx_inventario_bloqueo_empresa (empresa_id),
  CONSTRAINT fk_inventario_bloqueo_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_inventario_bloqueo_bodega FOREIGN KEY (bodega_id) REFERENCES bodegas(id),
  CONSTRAINT fk_inventario_bloqueo_sesion FOREIGN KEY (sesion_id) REFERENCES inventarios_sesiones(id),
  CONSTRAINT fk_inventario_bloqueo_usuario FOREIGN KEY (bloqueado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventarios_ajustes (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  inventario_id BIGINT NOT NULL,
  codigo VARCHAR(50) NOT NULL,
  estado ENUM('requested','under_review','approved','rejected','applied','cancelled') NOT NULL DEFAULT 'requested',
  motivo TEXT NOT NULL,
  solicitado_por INT NOT NULL,
  revisado_por INT NULL,
  aprobado_por INT NULL,
  aplicado_por INT NULL,
  solicitado_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revisado_at DATETIME NULL,
  aprobado_at DATETIME NULL,
  aplicado_at DATETIME NULL,
  observaciones TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_inventario_ajuste_empresa_codigo (empresa_id, codigo),
  KEY idx_inventario_ajuste_estado (empresa_id, estado, solicitado_at),
  CONSTRAINT fk_inventario_ajuste_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_inventario_ajuste_inventario FOREIGN KEY (inventario_id) REFERENCES inventarios_fisicos(id),
  CONSTRAINT fk_inventario_ajuste_solicitante FOREIGN KEY (solicitado_por) REFERENCES usuarios(id),
  CONSTRAINT fk_inventario_ajuste_revisor FOREIGN KEY (revisado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_inventario_ajuste_aprobador FOREIGN KEY (aprobado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_inventario_ajuste_aplicador FOREIGN KEY (aplicado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventarios_ajustes_detalle (
  id BIGINT NOT NULL AUTO_INCREMENT,
  empresa_id INT NOT NULL,
  ajuste_id BIGINT NOT NULL,
  resultado_id BIGINT NOT NULL,
  producto_id INT NOT NULL,
  bodega_id INT NOT NULL,
  stock_anterior DECIMAL(15,3) NOT NULL,
  cantidad_objetivo DECIMAL(15,3) NOT NULL,
  diferencia DECIMAL(15,3) NOT NULL,
  movimiento_id INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_inventario_ajuste_resultado (ajuste_id, resultado_id),
  KEY idx_inventario_ajuste_detalle_producto (empresa_id, producto_id, bodega_id),
  CONSTRAINT fk_inventario_ajuste_det_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_inventario_ajuste_det_ajuste FOREIGN KEY (ajuste_id) REFERENCES inventarios_ajustes(id),
  CONSTRAINT fk_inventario_ajuste_det_resultado FOREIGN KEY (resultado_id) REFERENCES inventarios_resultados(id),
  CONSTRAINT fk_inventario_ajuste_det_producto FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT fk_inventario_ajuste_det_bodega FOREIGN KEY (bodega_id) REFERENCES bodegas(id),
  CONSTRAINT fk_inventario_ajuste_det_movimiento FOREIGN KEY (movimiento_id) REFERENCES inventario_movimientos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- La proteccion del corte no usa triggers ni requiere DELIMITER en RDS.
-- El backend bloquea bodegas con SELECT ... FOR UPDATE y consulta
-- inventarios_bodega_bloqueos en la MISMA transaccion que modifica stock.
-- No ejecutar escrituras SQL externas de stock/catalogo durante un conteo.

-- -----------------------------------------------------------------------------
-- E. Integrar el ledger existente con movimientos por bodega y dominio.
-- Ejecutar este ALTER una sola vez y solo tras confirmar sus precondiciones.
-- -----------------------------------------------------------------------------

ALTER TABLE inventario_movimientos
  ADD COLUMN bodega_id INT NULL AFTER producto_id,
  MODIFY COLUMN referencia_tipo ENUM(
    'venta','compra','ajuste','devolucion','produccion','mantenimiento','inventario_fisico'
  ) DEFAULT NULL,
  ADD KEY idx_movimiento_bodega_fecha (bodega_id, fecha),
  ADD CONSTRAINT fk_movimiento_bodega FOREIGN KEY (bodega_id) REFERENCES bodegas(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- F. Verificacion posterior (debe devolver columnas, tablas y permisos nuevos).
-- -----------------------------------------------------------------------------

SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'activos','activos_categorias','activos_tipos','activos_atributos_def',
    'activos_asignaciones','mantenimiento_ordenes','repuestos_unidades',
    'inventarios_fisicos','inventarios_rondas','inventarios_sesiones',
    'inventarios_conteo_lineas','inventarios_stock_snapshot','inventarios_resultados',
    'inventarios_ajustes','inventarios_ajustes_detalle'
  )
ORDER BY TABLE_NAME;

SELECT COLUMN_NAME, COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'inventario_movimientos'
  AND COLUMN_NAME IN ('bodega_id','referencia_tipo');

SELECT m.nombre AS modulo, a.nombre AS accion, p.codigo
FROM permisos p
INNER JOIN modulos m ON m.id = p.modulo_id
INNER JOIN acciones a ON a.id = p.accion_id
WHERE m.nombre IN ('activos','activos_config','repuestos','mantenimientos','inventarios_fisicos','ajustes_inventario')
ORDER BY m.nombre, a.nombre;
