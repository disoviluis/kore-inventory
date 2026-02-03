-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-02-2026 a las 13:31:51
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
-- Estructura de tabla para la tabla `licencias`
--

CREATE TABLE `licencias` (
  `id` int(11) NOT NULL,
  `empresa_id` int(11) NOT NULL,
  `plan_id` int(11) NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `tipo_facturacion` enum('mensual','anual') DEFAULT 'mensual',
  `monto` decimal(10,2) NOT NULL,
  `moneda` varchar(3) DEFAULT 'COP',
  `estado` enum('activa','vencida','cancelada','suspendida') DEFAULT 'activa',
  `auto_renovacion` tinyint(1) DEFAULT 1,
  `limite_usuarios` int(11) DEFAULT NULL,
  `limite_productos` int(11) DEFAULT NULL,
  `limite_facturas_mes` int(11) DEFAULT NULL,
  `ultimo_pago_id` int(11) DEFAULT NULL COMMENT 'Referencia a tabla de pagos',
  `proximo_pago_fecha` date DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `cancelada_at` timestamp NULL DEFAULT NULL,
  `cancelada_razon` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Licencias de empresas';

--
-- Volcado de datos para la tabla `licencias`
--

INSERT INTO `licencias` (`id`, `empresa_id`, `plan_id`, `fecha_inicio`, `fecha_fin`, `tipo_facturacion`, `monto`, `moneda`, `estado`, `auto_renovacion`, `limite_usuarios`, `limite_productos`, `limite_facturas_mes`, `ultimo_pago_id`, `proximo_pago_fecha`, `notas`, `created_at`, `updated_at`, `cancelada_at`, `cancelada_razon`) VALUES
(1, 1, 2, '2025-01-01', '2025-12-31', 'anual', 790.00, 'COP', 'activa', 1, 20, NULL, NULL, NULL, NULL, NULL, '2026-01-05 15:56:23', '2026-01-05 15:56:23', NULL, NULL),
(2, 2, 1, '2025-01-01', '2025-01-31', 'mensual', 29.00, 'COP', 'activa', 1, 5, 500, 100, NULL, NULL, NULL, '2026-01-05 15:56:23', '2026-01-05 15:56:23', NULL, NULL),
(3, 3, 3, '2025-01-01', '2025-12-31', 'anual', 1990.00, 'COP', 'activa', 1, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-05 15:56:23', '2026-01-05 15:56:23', NULL, NULL),
(4, 4, 1, '2026-01-05', '2026-01-20', 'mensual', 0.00, 'COP', 'activa', 1, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-05 16:16:36', '2026-01-05 16:16:36', NULL, NULL);

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `licencias`
--
ALTER TABLE `licencias`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_empresa_activa` (`empresa_id`,`estado`),
  ADD KEY `plan_id` (`plan_id`),
  ADD KEY `idx_empresa` (`empresa_id`),
  ADD KEY `idx_estado` (`estado`),
  ADD KEY `idx_fecha_fin` (`fecha_fin`),
  ADD KEY `idx_empresa_estado` (`empresa_id`,`estado`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `licencias`
--
ALTER TABLE `licencias`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `licencias`
--
ALTER TABLE `licencias`
  ADD CONSTRAINT `licencias_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `licencias_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `planes` (`id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
