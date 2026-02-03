-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-02-2026 a las 13:32:26
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `kore_inventory`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `productos`
--

CREATE TABLE `productos` (
  `id` int(11) NOT NULL,
  `empresa_id` int(11) NOT NULL COMMENT 'ID de la empresa propietaria',
  `nombre` varchar(200) NOT NULL COMMENT 'Nombre del producto',
  `descripcion` text DEFAULT NULL COMMENT 'Descripci├│n detallada del producto',
  `sku` varchar(100) NOT NULL COMMENT 'C├│digo SKU ├║nico por empresa',
  `codigo_barras` varchar(100) DEFAULT NULL COMMENT 'C├│digo de barras del producto',
  `categoria_id` int(11) DEFAULT NULL COMMENT 'ID de la categor├¡a',
  `precio_compra` decimal(15,2) DEFAULT 0.00 COMMENT 'Precio de compra',
  `precio_venta` decimal(15,2) NOT NULL COMMENT 'Precio de venta al p├║blico',
  `stock_actual` int(11) DEFAULT 0 COMMENT 'Stock disponible actual',
  `stock_minimo` int(11) DEFAULT 0 COMMENT 'Stock m├¡nimo de alerta',
  `stock_maximo` int(11) DEFAULT NULL COMMENT 'Stock m├íximo permitido',
  `unidad_medida` varchar(50) DEFAULT 'unidad' COMMENT 'Unidad de medida (unidad, kg, litro, etc.)',
  `ubicacion_almacen` varchar(100) DEFAULT NULL COMMENT 'Ubicaci├│n f├¡sica en almac├®n',
  `imagen_url` varchar(500) DEFAULT NULL COMMENT 'URL de la imagen del producto',
  `estado` enum('activo','inactivo') DEFAULT 'activo' COMMENT 'Estado del producto',
  `creado_por` int(11) DEFAULT NULL COMMENT 'ID del usuario que cre├│ el producto',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Fecha de creaci├│n',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Fecha de ├║ltima actualizaci├│n'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `productos`
--

INSERT INTO `productos` (`id`, `empresa_id`, `nombre`, `descripcion`, `sku`, `codigo_barras`, `categoria_id`, `precio_compra`, `precio_venta`, `stock_actual`, `stock_minimo`, `stock_maximo`, `unidad_medida`, `ubicacion_almacen`, `imagen_url`, `estado`, `creado_por`, `created_at`, `updated_at`) VALUES
(1, 1, 'camisa', 'camisa t11', '1112', NULL, 2, 5.00, 10.00, 5, 2, 15, 'unidad', NULL, NULL, 'activo', 1, '2026-01-06 15:16:49', '2026-01-06 15:16:49');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `productos`
--
ALTER TABLE `productos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_empresa_sku` (`empresa_id`,`sku`),
  ADD KEY `creado_por` (`creado_por`),
  ADD KEY `idx_empresa_id` (`empresa_id`),
  ADD KEY `idx_categoria_id` (`categoria_id`),
  ADD KEY `idx_estado` (`estado`),
  ADD KEY `idx_stock` (`stock_actual`),
  ADD KEY `idx_codigo_barras` (`codigo_barras`),
  ADD KEY `idx_nombre` (`nombre`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `productos`
--
ALTER TABLE `productos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `productos`
--
ALTER TABLE `productos`
  ADD CONSTRAINT `productos_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `productos_ibfk_2` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `productos_ibfk_3` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
