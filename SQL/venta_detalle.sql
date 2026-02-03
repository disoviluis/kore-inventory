-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-02-2026 a las 13:33:33
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
-- Estructura de tabla para la tabla `venta_detalle`
--

CREATE TABLE `venta_detalle` (
  `id` int(11) NOT NULL COMMENT 'ID ├║nico del detalle',
  `venta_id` int(11) NOT NULL COMMENT 'ID de la venta principal',
  `producto_id` int(11) NOT NULL COMMENT 'ID del producto vendido',
  `cantidad` int(11) NOT NULL COMMENT 'Cantidad vendida',
  `precio_unitario` decimal(15,2) NOT NULL COMMENT 'Precio unitario al momento de la venta',
  `descuento` decimal(15,2) DEFAULT 0.00 COMMENT 'Descuento aplicado al producto',
  `subtotal` decimal(15,2) NOT NULL COMMENT 'Subtotal (cantidad * precio - descuento)',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Fecha de creaci├│n'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `venta_detalle`
--
ALTER TABLE `venta_detalle`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_venta_id` (`venta_id`),
  ADD KEY `idx_producto_id` (`producto_id`);

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `venta_detalle`
--
ALTER TABLE `venta_detalle`
  ADD CONSTRAINT `venta_detalle_ibfk_1` FOREIGN KEY (`venta_id`) REFERENCES `ventas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `venta_detalle_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
