-- =============================================
-- MIGRACIÓN: CATEGORÍAS POR DEFECTO PARA TODAS LAS EMPRESAS
-- Fecha: 2026-02-18
-- Descripción: Crea categorías por defecto para empresas que no las tienen
-- =============================================

-- 1. Crear procedimiento para agregar categorías a una empresa
DELIMITER $$

DROP PROCEDURE IF EXISTS crear_categorias_empresa$$

CREATE PROCEDURE crear_categorias_empresa(IN p_empresa_id INT)
BEGIN
    -- Verificar si la empresa ya tiene categorías
    DECLARE categoria_count INT;
    
    SELECT COUNT(*) INTO categoria_count 
    FROM categorias 
    WHERE empresa_id = p_empresa_id;
    
    -- Si no tiene categorías, crearlas
    IF categoria_count = 0 THEN
        INSERT INTO categorias (empresa_id, nombre, descripcion, icono, color, activo) VALUES
        (p_empresa_id, 'Electrónica', 'Productos electrónicos y tecnología', 'bi-laptop', '#3B82F6', 1),
        (p_empresa_id, 'Ropa y Accesorios', 'Vestimenta y complementos', 'bi-bag', '#8B5CF6', 1),
        (p_empresa_id, 'Alimentos y Bebidas', 'Productos alimenticios', 'bi-cup-straw', '#10B981', 1),
        (p_empresa_id, 'Hogar y Decoración', 'Artículos para el hogar', 'bi-house', '#F59E0B', 1),
        (p_empresa_id, 'Salud y Belleza', 'Productos de cuidado personal', 'bi-heart-pulse', '#EC4899', 1),
        (p_empresa_id, 'Deportes', 'Artículos deportivos y fitness', 'bi-trophy', '#EF4444', 1),
        (p_empresa_id, 'Libros y Papelería', 'Material de oficina y lectura', 'bi-book', '#6366F1', 1),
        (p_empresa_id, 'Juguetes', 'Juguetes y entretenimiento', 'bi-controller', '#F97316', 1),
        (p_empresa_id, 'Herramientas', 'Herramientas y ferretería', 'bi-tools', '#64748B', 1),
        (p_empresa_id, 'Otros', 'Productos varios sin categoría específica', 'bi-box', '#9CA3AF', 1);
        
        SELECT CONCAT('✅ ', ROW_COUNT(), ' categorías creadas para empresa ID: ', p_empresa_id) AS resultado;
    ELSE
        SELECT CONCAT('ℹ️ La empresa ID ', p_empresa_id, ' ya tiene ', categoria_count, ' categorías') AS resultado;
    END IF;
END$$

DELIMITER ;

-- 2. Ejecutar el procedimiento para todas las empresas activas
SELECT '=== INICIANDO CREACIÓN DE CATEGORÍAS POR EMPRESA ===' AS mensaje;

CALL crear_categorias_empresa(1);  -- ABC Comercial
CALL crear_categorias_empresa(2);  -- Si existe
CALL crear_categorias_empresa(3);  -- Si existe
CALL crear_categorias_empresa(4);  -- Si existe
CALL crear_categorias_empresa(5);  -- Si existe

-- O ejecutar para TODAS las empresas automáticamente:
-- (Comentado por seguridad, descomentar si necesitas ejecutar masivamente)
/*
DELIMITER $$

DROP PROCEDURE IF EXISTS crear_categorias_todas_empresas$$

CREATE PROCEDURE crear_categorias_todas_empresas()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_empresa_id INT;
    DECLARE cur CURSOR FOR SELECT id FROM empresas WHERE estado IN ('activa', 'trial');
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO v_empresa_id;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        CALL crear_categorias_empresa(v_empresa_id);
    END LOOP;

    CLOSE cur;
    
    SELECT '✅ Proceso completado para todas las empresas' AS resultado;
END$$

DELIMITER ;

-- Ejecutar para todas las empresas
CALL crear_categorias_todas_empresas();
*/

-- 3. Verificar resultados
SELECT 
    e.id AS empresa_id,
    e.nombre AS empresa,
    COUNT(c.id) AS total_categorias
FROM empresas e
LEFT JOIN categorias c ON e.id = c.empresa_id AND c.activo = 1
WHERE e.estado IN ('activa', 'trial')
GROUP BY e.id, e.nombre
ORDER BY e.id;

-- 4. Ver todas las categorías por empresa
SELECT 
    e.nombre AS empresa,
    c.nombre AS categoria,
    c.icono,
    c.color,
    c.activo
FROM empresas e
LEFT JOIN categorias c ON e.id = c.empresa_id
WHERE e.estado IN ('activa', 'trial')
ORDER BY e.nombre, c.nombre;

SELECT '=== MIGRACIÓN COMPLETADA ===' AS mensaje;
