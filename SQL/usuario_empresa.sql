-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-02-2026 a las 13:33:03
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
-- Estructura de tabla para la tabla `usuario_empresa`
--

CREATE TABLE `usuario_empresa` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `empresa_id` int(11) NOT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Usuarios que pertenecen a empresas';

--
-- Volcado de datos para la tabla `usuario_empresa`
--

INSERT INTO `usuario_empresa` (`id`, `usuario_id`, `empresa_id`, `activo`, `created_at`, `created_by`) VALUES
(1, 2, 1, 1, '2026-01-05 15:56:23', NULL),
(2, 3, 1, 1, '2026-01-05 15:56:23', NULL),
(3, 4, 2, 1, '2026-01-05 15:56:23', NULL),
(4, 5, 1, 1, '2026-01-05 15:56:23', NULL),
(5, 6, 4, 1, '2026-01-05 16:16:36', NULL);

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `usuario_empresa`
--
ALTER TABLE `usuario_empresa`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_usuario_empresa` (`usuario_id`,`empresa_id`),
  ADD KEY `idx_usuario` (`usuario_id`),
  ADD KEY `idx_empresa` (`empresa_id`),
  ADD KEY `idx_activo` (`activo`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `usuario_empresa`
--
ALTER TABLE `usuario_empresa`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `usuario_empresa`
--
ALTER TABLE `usuario_empresa`
  ADD CONSTRAINT `usuario_empresa_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `usuario_empresa_ibfk_2` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
