-- =============================================
-- CORRECCIÓN RÁPIDA: CATEGORÍAS PARA EMPRESA EXISTENTE
-- Ejecutar este script en RDS para la empresa que creaste
-- =============================================

-- Ver empresas activas y sus categorías
SELECT 
    e.id,
    e.nombre,
    e.estado,
    COUNT(c.id) AS total_categorias
FROM empresas e
LEFT JOIN categorias c ON e.id = c.empresa_id
GROUP BY e.id, e.nombre, e.estado
ORDER BY e.id;

-- Agregar categorías a la empresa específica (cambia el ID si es diferente)
-- Busca el ID de "TALADRO PERCUTOR S&L" en los resultados de arriba

-- Ejemplo: Si tu empresa es ID 2
SET @empresa_nueva_id = 2; -- CAMBIAR ESTE NÚMERO AL ID DE TU EMPRESA

-- Insertar categorías para la nueva empresa
INSERT INTO categorias (empresa_id, nombre, descripcion, icono, color, activo) VALUES
(@empresa_nueva_id, 'Electrónica', 'Productos electrónicos y tecnología', 'bi-laptop', '#3B82F6', 1),
(@empresa_nueva_id, 'Ropa y Accesorios', 'Vestimenta y complementos', 'bi-bag', '#8B5CF6', 1),
(@empresa_nueva_id, 'Alimentos y Bebidas', 'Productos alimenticios', 'bi-cup-straw', '#10B981', 1),
(@empresa_nueva_id, 'Hogar y Decoración', 'Artículos para el hogar', 'bi-house', '#F59E0B', 1),
(@empresa_nueva_id, 'Salud y Belleza', 'Productos de cuidado personal', 'bi-heart-pulse', '#EC4899', 1),
(@empresa_nueva_id, 'Deportes', 'Artículos deportivos y fitness', 'bi-trophy', '#EF4444', 1),
(@empresa_nueva_id, 'Libros y Papelería', 'Material de oficina y lectura', 'bi-book', '#6366F1', 1),
(@empresa_nueva_id, 'Juguetes', 'Juguetes y entretenimiento', 'bi-controller', '#F97316', 1),
(@empresa_nueva_id, 'Herramientas', 'Herramientas y ferretería', 'bi-tools', '#64748B', 1),
(@empresa_nueva_id, 'Otros', 'Productos varios sin categoría específica', 'bi-box', '#9CA3AF', 1);

-- Verificar que se crearon correctamente
SELECT 
    c.id,
    e.nombre AS empresa,
    c.nombre AS categoria,
    c.icono,
    c.color
FROM categorias c
INNER JOIN empresas e ON c.empresa_id = e.id
WHERE c.empresa_id = @empresa_nueva_id
ORDER BY c.id;

SELECT '✅ Categorías creadas exitosamente' AS resultado;
