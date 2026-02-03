-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-02-2026 a las 13:33:14
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
-- Estructura de tabla para la tabla `usuario_rol`
--

CREATE TABLE `usuario_rol` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `rol_id` int(11) NOT NULL,
  `empresa_id` int(11) NOT NULL COMMENT 'Rol del usuario en esta empresa',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Roles de usuarios por empresa';

--
-- Volcado de datos para la tabla `usuario_rol`
--

INSERT INTO `usuario_rol` (`id`, `usuario_id`, `rol_id`, `empresa_id`, `created_at`, `created_by`) VALUES
(1, 1, 1, 1, '2026-01-05 15:56:23', NULL),
(2, 2, 2, 1, '2026-01-05 15:56:23', NULL),
(3, 3, 4, 1, '2026-01-05 15:56:23', NULL),
(4, 4, 2, 2, '2026-01-05 15:56:23', NULL),
(5, 5, 3, 1, '2026-01-05 15:56:23', NULL),
(6, 6, 6, 4, '2026-01-05 16:16:36', NULL);

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `usuario_rol`
--
ALTER TABLE `usuario_rol`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_usuario_rol_empresa` (`usuario_id`,`rol_id`,`empresa_id`),
  ADD KEY `idx_usuario` (`usuario_id`),
  ADD KEY `idx_rol` (`rol_id`),
  ADD KEY `idx_empresa` (`empresa_id`),
  ADD KEY `idx_usuario_empresa` (`usuario_id`,`empresa_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `usuario_rol`
--
ALTER TABLE `usuario_rol`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `usuario_rol`
--
ALTER TABLE `usuario_rol`
  ADD CONSTRAINT `usuario_rol_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `usuario_rol_ibfk_2` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `usuario_rol_ibfk_3` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
