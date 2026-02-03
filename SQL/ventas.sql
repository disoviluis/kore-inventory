-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-02-2026 a las 13:33:21
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
-- Estructura de tabla para la tabla `ventas`
--

CREATE TABLE `ventas` (
  `id` int(11) NOT NULL COMMENT 'ID ├║nico de la venta',
  `empresa_id` int(11) NOT NULL COMMENT 'ID de la empresa propietaria',
  `numero_factura` varchar(50) NOT NULL COMMENT 'N├║mero de factura ├║nico',
  `cliente_id` int(11) NOT NULL COMMENT 'ID del cliente',
  `fecha_venta` datetime NOT NULL COMMENT 'Fecha y hora de la venta',
  `subtotal` decimal(15,2) NOT NULL COMMENT 'Subtotal antes de descuentos e impuestos',
  `descuento` decimal(15,2) DEFAULT 0.00 COMMENT 'Descuento aplicado',
  `impuesto` decimal(15,2) DEFAULT 0.00 COMMENT 'Impuestos (IVA, etc.)',
  `total` decimal(15,2) NOT NULL COMMENT 'Total final de la venta',
  `estado` enum('pendiente','pagada','cancelada','anulada') DEFAULT 'pendiente' COMMENT 'Estado de la venta',
  `metodo_pago` enum('efectivo','tarjeta','transferencia','credito') DEFAULT 'efectivo' COMMENT 'M├®todo de pago utilizado',
  `notas` text DEFAULT NULL COMMENT 'Notas adicionales de la venta',
  `vendedor_id` int(11) DEFAULT NULL COMMENT 'ID del usuario vendedor',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Fecha de creaci├│n',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Fecha de ├║ltima actualizaci├│n'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `ventas`
--
ALTER TABLE `ventas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_empresa_factura` (`empresa_id`,`numero_factura`),
  ADD KEY `vendedor_id` (`vendedor_id`),
  ADD KEY `idx_empresa_id` (`empresa_id`),
  ADD KEY `idx_cliente_id` (`cliente_id`),
  ADD KEY `idx_estado` (`estado`),
  ADD KEY `idx_fecha` (`fecha_venta`);

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `ventas`
--
ALTER TABLE `ventas`
  ADD CONSTRAINT `ventas_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `ventas_ibfk_2` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  ADD CONSTRAINT `ventas_ibfk_3` FOREIGN KEY (`vendedor_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
