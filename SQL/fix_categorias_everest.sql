-- ============================================================================
-- AGREGAR CATEGORÍAS A EVEREST SA (empresa_id = 6)
-- Fecha: 2025-01-26
-- ============================================================================

USE kore_inventory;

-- Variable para la empresa EVEREST SA
SET @empresa_everest = 6;

-- Verificar empresa
SELECT 
    e.id,
    e.nombre,
    e.nit,
    COUNT(c.id) as categorias_actuales
FROM empresas e
LEFT JOIN categorias c ON c.empresa_id = e.id
WHERE e.id = @empresa_everest
GROUP BY e.id;

-- Insertar 10 categorías predeterminadas
INSERT INTO categorias (empresa_id, nombre, descripcion, icono, color, activo) VALUES
(@empresa_everest, 'Electrónica', 'Computadoras, laptops, tablets y accesorios', 'bi-laptop', '#3B82F6', 1),
(@empresa_everest, 'Ropa y Moda', 'Prendas de vestir, accesorios y calzado', 'bi-bag', '#EC4899', 1),
(@empresa_everest, 'Alimentos', 'Productos alimenticios y bebidas', 'bi-cup-straw', '#10B981', 1),
(@empresa_everest, 'Hogar y Decoración', 'Muebles, decoración y artículos para el hogar', 'bi-house', '#F59E0B', 1),
(@empresa_everest, 'Salud y Belleza', 'Productos de cuidado personal y cosméticos', 'bi-heart-pulse', '#EF4444', 1),
(@empresa_everest, 'Deportes', 'Artículos deportivos y equipamiento', 'bi-trophy', '#8B5CF6', 1),
(@empresa_everest, 'Libros y Papelería', 'Libros, cuadernos y artículos de oficina', 'bi-book', '#06B6D4', 1),
(@empresa_everest, 'Juguetes', 'Juguetes y juegos para niños', 'bi-controller', '#F97316', 1),
(@empresa_everest, 'Automotriz', 'Repuestos y accesorios para vehículos', 'bi-car-front', '#64748B', 1),
(@empresa_everest, 'Herramientas', 'Herramientas manuales y eléctricas', 'bi-tools', '#6B7280', 1);

-- Verificar inserción
SELECT 
    id,
    nombre,
    descripcion,
    icono,
    color,
    activo,
    created_at
FROM categorias
WHERE empresa_id = @empresa_everest
ORDER BY id;

-- Resumen final
SELECT 
    e.nombre as empresa,
    COUNT(c.id) as total_categorias
FROM empresas e
LEFT JOIN categorias c ON c.empresa_id = e.id
WHERE e.id = @empresa_everest
GROUP BY e.id;
