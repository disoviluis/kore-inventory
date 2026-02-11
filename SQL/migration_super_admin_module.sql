-- =========================================
-- MIGRACIÓN: MÓDULO DE SUPER ADMIN
-- Sistema completo de administración multiempresa
-- Fecha: 2026-02-11
-- =========================================

USE kore_inventory;

-- =========================================
-- 1. TABLA: MÓDULOS POR PLAN
-- =========================================
CREATE TABLE IF NOT EXISTS modulos_plan (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plan_id INT NOT NULL,
    modulo_id INT NOT NULL,
    incluido TINYINT(1) DEFAULT 1 COMMENT 'Si está incluido en el plan',
    limite_uso INT NULL COMMENT 'Límite específico para este módulo (ej: max productos)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_plan_modulo (plan_id, modulo_id),
    FOREIGN KEY (plan_id) REFERENCES planes(id) ON DELETE CASCADE,
    FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Módulos incluidos en cada plan';

-- =========================================
-- 2. TABLA: CONFIGURACIÓN DE EMPRESA
-- =========================================
CREATE TABLE IF NOT EXISTS empresa_configuracion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL,
    clave VARCHAR(100) NOT NULL COMMENT 'Clave de configuración',
    valor TEXT NULL COMMENT 'Valor de configuración',
    tipo ENUM('texto', 'numero', 'boolean', 'json', 'fecha') DEFAULT 'texto',
    categoria VARCHAR(50) NULL COMMENT 'Categoría (general, contable, inventario, etc)',
    descripcion TEXT NULL COMMENT 'Descripción de la configuración',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_empresa_clave (empresa_id, clave),
    KEY idx_empresa (empresa_id),
    KEY idx_categoria (categoria),
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuraciones específicas por empresa';

-- =========================================
-- 3. TABLA: MÓDULOS POR ROL (Control granular)
-- =========================================
CREATE TABLE IF NOT EXISTS modulos_rol (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rol_id INT NOT NULL,
    modulo_id INT NOT NULL,
    acceso TINYINT(1) DEFAULT 1 COMMENT 'Si tiene acceso al módulo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT NULL,
    UNIQUE KEY uk_rol_modulo (rol_id, modulo_id),
    FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Módulos accesibles por rol';

-- =========================================
-- 4. ACTUALIZAR TABLA BODEGAS (Jerarquía)
-- =========================================
ALTER TABLE bodegas 
ADD COLUMN IF NOT EXISTS bodega_padre_id INT NULL COMMENT 'Bodega padre para sub-bodegas'
AFTER empresa_id;

ALTER TABLE bodegas 
ADD CONSTRAINT fk_bodegas_padre 
FOREIGN KEY (bodega_padre_id) REFERENCES bodegas(id) ON DELETE CASCADE;

-- =========================================
-- 5. POBLAR MÓDULOS_PLAN
-- =========================================

-- PLAN BÁSICO (id=1): Módulos esenciales
INSERT INTO modulos_plan (plan_id, modulo_id, incluido, limite_uso) VALUES
(1, 4, 1, NULL),   -- Dashboard
(1, 7, 1, NULL),   -- POS
(1, 8, 1, 50),     -- Ventas (max 50/mes)
(1, 9, 1, 100),    -- Clientes (max 100)
(1, 10, 1, 200),   -- Productos (max 200)
(1, 11, 1, NULL),  -- Inventario
(1, 5, 1, NULL),   -- Usuarios
ON DUPLICATE KEY UPDATE incluido=VALUES(incluido), limite_uso=VALUES(limite_uso);

-- PLAN PROFESIONAL (id=2): Más módulos y sin límites en básicos
INSERT INTO modulos_plan (plan_id, modulo_id, incluido, limite_uso) VALUES
(2, 4, 1, NULL),   -- Dashboard
(2, 7, 1, NULL),   -- POS
(2, 8, 1, NULL),   -- Ventas (sin límite)
(2, 9, 1, NULL),   -- Clientes (sin límite)
(2, 10, 1, NULL),  -- Productos (sin límite)
(2, 11, 1, NULL),  -- Inventario
(2, 12, 1, NULL),  -- Compras
(2, 13, 1, NULL),  -- Proveedores
(2, 14, 1, NULL),  -- Caja
(2, 5, 1, NULL),   -- Usuarios
(2, 6, 1, NULL),   -- Roles
(2, 17, 1, NULL),  -- Reportes
ON DUPLICATE KEY UPDATE incluido=VALUES(incluido), limite_uso=VALUES(limite_uso);

-- PLAN ENTERPRISE (id=3): Todos los módulos
INSERT INTO modulos_plan (plan_id, modulo_id, incluido, limite_uso) VALUES
(3, 4, 1, NULL),   -- Dashboard
(3, 7, 1, NULL),   -- POS
(3, 8, 1, NULL),   -- Ventas
(3, 9, 1, NULL),   -- Clientes
(3, 10, 1, NULL),  -- Productos
(3, 11, 1, NULL),  -- Inventario
(3, 12, 1, NULL),  -- Compras
(3, 13, 1, NULL),  -- Proveedores
(3, 14, 1, NULL),  -- Caja
(3, 15, 1, NULL),  -- Bancos
(3, 16, 1, NULL),  -- Contabilidad
(3, 5, 1, NULL),   -- Usuarios
(3, 6, 1, NULL),   -- Roles
(3, 17, 1, NULL),  -- Reportes
ON DUPLICATE KEY UPDATE incluido=VALUES(incluido), limite_uso=VALUES(limite_uso);

-- =========================================
-- 6. VERIFICAR/CREAR USUARIO SUPER ADMIN
-- =========================================

-- Verificar si existe usuario super admin
SELECT COUNT(*) INTO @super_admin_exists FROM usuarios WHERE tipo_usuario = 'super_admin';

-- Si no existe, crear uno por defecto
INSERT INTO usuarios (
    nombre, 
    apellido, 
    email, 
    password, 
    tipo_usuario, 
    activo,
    email_verificado
)
SELECT 
    'Super',
    'Admin',
    'admin@kore.inventory',
    '$2a$10$YourHashedPasswordHere', -- CAMBIAR por contraseña hasheada
    'super_admin',
    1,
    1
WHERE @super_admin_exists = 0;

-- =========================================
-- 7. CREAR CONFIGURACIONES INICIALES
-- =========================================

-- Configuraciones por defecto para nuevas empresas
INSERT INTO empresa_configuracion (empresa_id, clave, valor, tipo, categoria, descripcion)
SELECT 
    e.id,
    'moneda_simbolo',
    '$',
    'texto',
    'general',
    'Símbolo de la moneda'
FROM empresas e
WHERE NOT EXISTS (
    SELECT 1 FROM empresa_configuracion ec 
    WHERE ec.empresa_id = e.id AND ec.clave = 'moneda_simbolo'
);

INSERT INTO empresa_configuracion (empresa_id, clave, valor, tipo, categoria, descripcion)
SELECT 
    e.id,
    'formato_fecha',
    'dd/mm/yyyy',
    'texto',
    'general',
    'Formato de fecha'
FROM empresas e
WHERE NOT EXISTS (
    SELECT 1 FROM empresa_configuracion ec 
    WHERE ec.empresa_id = e.id AND ec.clave = 'formato_fecha'
);

INSERT INTO empresa_configuracion (empresa_id, clave, valor, tipo, categoria, descripcion)
SELECT 
    e.id,
    'requiere_autorizacion_descuentos',
    '1',
    'boolean',
    'ventas',
    'Requiere autorización para aplicar descuentos'
FROM empresas e
WHERE NOT EXISTS (
    SELECT 1 FROM empresa_configuracion ec 
    WHERE ec.empresa_id = e.id AND ec.clave = 'requiere_autorizacion_descuentos'
);

-- =========================================
-- 8. ÍNDICES ADICIONALES PARA RENDIMIENTO
-- =========================================

CREATE INDEX IF NOT EXISTS idx_empresas_estado ON empresas(estado);
CREATE INDEX IF NOT EXISTS idx_licencias_empresa_estado ON licencias(empresa_id, estado);
CREATE INDEX IF NOT EXISTS idx_usuarios_tipo_activo ON usuarios(tipo_usuario, activo);
CREATE INDEX IF NOT EXISTS idx_modulos_nivel_activo ON modulos(nivel, activo);

-- =========================================
-- 9. VISTAS ÚTILES PARA SUPER ADMIN
-- =========================================

-- Vista: Empresas con resumen de licencias
CREATE OR REPLACE VIEW vista_empresas_licencias AS
SELECT 
    e.id as empresa_id,
    e.nombre as empresa_nombre,
    e.nit,
    e.email,
    e.estado as empresa_estado,
    p.nombre as plan_nombre,
    p.precio_mensual,
    l.id as licencia_id,
    l.estado as licencia_estado,
    l.fecha_inicio,
    l.fecha_fin,
    DATEDIFF(l.fecha_fin, CURDATE()) as dias_restantes,
    l.tipo_facturacion,
    l.auto_renovacion,
    (SELECT COUNT(*) FROM usuarios u 
     INNER JOIN usuario_empresa ue ON u.id = ue.usuario_id 
     WHERE ue.empresa_id = e.id AND u.activo = 1) as usuarios_activos,
    l.limite_usuarios,
    (SELECT COUNT(*) FROM productos pr WHERE pr.empresa_id = e.id) as productos_creados,
    l.limite_productos,
    e.created_at as empresa_creada
FROM empresas e
LEFT JOIN planes p ON e.plan_id = p.id
LEFT JOIN licencias l ON e.id = l.empresa_id AND l.estado = 'activa'
ORDER BY e.created_at DESC;

-- Vista: Usuarios por empresa y rol
CREATE OR REPLACE VIEW vista_usuarios_empresas_roles AS
SELECT 
    u.id as usuario_id,
    u.nombre,
    u.apellido,
    u.email,
    u.tipo_usuario,
    u.activo as usuario_activo,
    e.id as empresa_id,
    e.nombre as empresa_nombre,
    e.estado as empresa_estado,
    r.id as rol_id,
    r.nombre as rol_nombre,
    r.es_admin,
    ue.activo as asignacion_activa,
    u.ultimo_login,
    u.created_at as usuario_creado
FROM usuarios u
INNER JOIN usuario_empresa ue ON u.id = ue.usuario_id
INNER JOIN empresas e ON ue.empresa_id = e.id
LEFT JOIN usuario_rol ur ON u.id = ur.usuario_id AND ur.empresa_id = e.id
LEFT JOIN roles r ON ur.rol_id = r.id
WHERE u.tipo_usuario != 'super_admin'
ORDER BY e.nombre, u.nombre;

-- Vista: Módulos por plan con límites
CREATE OR REPLACE VIEW vista_modulos_planes AS
SELECT 
    p.id as plan_id,
    p.nombre as plan_nombre,
    p.precio_mensual,
    m.id as modulo_id,
    m.nombre as modulo_nombre,
    m.nombre_mostrar as modulo_display,
    m.nivel as modulo_nivel,
    m.categoria as modulo_categoria,
    mp.incluido,
    mp.limite_uso,
    m.requiere_licencia
FROM planes p
CROSS JOIN modulos m
LEFT JOIN modulos_plan mp ON p.id = mp.plan_id AND m.id = mp.modulo_id
WHERE p.activo = 1 AND m.activo = 1
ORDER BY p.orden, m.nivel, m.orden;

-- =========================================
-- FIN DE LA MIGRACIÓN
-- =========================================

-- Mensaje de confirmación
SELECT 'Migración de Módulo Super Admin completada exitosamente' as status;
SELECT COUNT(*) as total_modulos FROM modulos;
SELECT COUNT(*) as total_planes FROM planes;
SELECT COUNT(*) as modulos_plan_configurados FROM modulos_plan;
SELECT COUNT(*) as empresas_registradas FROM empresas;
