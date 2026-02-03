-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-02-2026 a las 13:31:21
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
-- Estructura de tabla para la tabla `categorias`
--

CREATE TABLE `categorias` (
  `id` int(11) NOT NULL COMMENT 'ID ·nico de la categorÝa',
  `empresa_id` int(11) NOT NULL COMMENT 'ID de la empresa propietaria',
  `nombre` varchar(100) NOT NULL COMMENT 'Nombre de la categor├¡a',
  `descripcion` text DEFAULT NULL COMMENT 'Descripci├│n de la categor├¡a',
  `icono` varchar(50) DEFAULT NULL COMMENT 'Icono de la categor├¡a (ej: bi-laptop)',
  `color` varchar(20) DEFAULT NULL COMMENT 'Color de la categor├¡a en hexadecimal',
  `activo` tinyint(1) DEFAULT 1 COMMENT 'Estado de la categor├¡a',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Fecha de creaci├│n',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Fecha de ├║ltima actualizaci├│n'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `categorias`
--

INSERT INTO `categorias` (`id`, `empresa_id`, `nombre`, `descripcion`, `icono`, `color`, `activo`, `created_at`, `updated_at`) VALUES
(1, 1, 'Electr??nica', 'Productos electr??nicos y tecnolog??a', NULL, NULL, 1, '2026-01-05 20:59:53', '2026-01-05 20:59:53'),
(2, 1, 'Ropa y Accesorios', 'Vestimenta y complementos', NULL, NULL, 1, '2026-01-05 20:59:53', '2026-01-05 20:59:53'),
(3, 1, 'Alimentos y Bebidas', 'Productos alimenticios', NULL, NULL, 1, '2026-01-05 20:59:53', '2026-01-05 20:59:53'),
(4, 1, 'Hogar y Decoraci??n', 'Art??culos para el hogar', NULL, NULL, 1, '2026-01-05 20:59:53', '2026-01-05 20:59:53'),
(5, 1, 'Deportes y Fitness', 'Equipamiento deportivo', NULL, NULL, 1, '2026-01-05 20:59:53', '2026-01-05 20:59:53'),
(6, 1, 'Libros y Papeler??a', 'Material de lectura y oficina', NULL, NULL, 1, '2026-01-05 20:59:53', '2026-01-05 20:59:53'),
(7, 1, 'Juguetes y Juegos', 'Entretenimiento infantil', NULL, NULL, 1, '2026-01-05 20:59:53', '2026-01-05 20:59:53'),
(8, 1, 'Belleza y Cuidado Personal', 'Cosm??ticos e higiene', NULL, NULL, 1, '2026-01-05 20:59:53', '2026-01-05 20:59:53'),
(9, 1, 'Automotriz', 'Repuestos y accesorios para veh??culos', NULL, NULL, 1, '2026-01-05 20:59:53', '2026-01-05 20:59:53'),
(10, 1, 'Ferreter??a y Construcci??n', 'Herramientas y materiales', NULL, NULL, 1, '2026-01-05 20:59:53', '2026-01-05 20:59:53'),
(11, 1, 'Otros', 'Productos varios', NULL, NULL, 1, '2026-01-05 20:59:53', '2026-01-05 20:59:53');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `categorias`
--
ALTER TABLE `categorias`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_empresa_nombre` (`empresa_id`,`nombre`),
  ADD KEY `idx_empresa_id` (`empresa_id`),
  ADD KEY `idx_activo` (`activo`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `categorias`
--
ALTER TABLE `categorias`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'ID ·nico de la categorÝa', AUTO_INCREMENT=12;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `categorias`
--
ALTER TABLE `categorias`
  ADD CONSTRAINT `categorias_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
