-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-02-2026 a las 13:15:25
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
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `apellido` varchar(100) DEFAULT NULL,
  `email` varchar(100) NOT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `password` varchar(255) NOT NULL COMMENT 'Hash bcrypt',
  `avatar_url` varchar(500) DEFAULT NULL,
  `tipo_usuario` enum('super_admin','admin_empresa','usuario','soporte') DEFAULT 'usuario',
  `empresa_id_default` int(11) DEFAULT NULL COMMENT 'Empresa por defecto al login',
  `idioma` varchar(5) DEFAULT 'es',
  `zona_horaria` varchar(50) DEFAULT 'America/Bogota',
  `tema` enum('light','dark','auto') DEFAULT 'light',
  `ultimo_login` timestamp NULL DEFAULT NULL,
  `ultimo_ip` varchar(45) DEFAULT NULL,
  `intentos_fallidos` int(11) DEFAULT 0,
  `bloqueado_hasta` timestamp NULL DEFAULT NULL,
  `email_verificado` tinyint(1) DEFAULT 0,
  `email_verificado_at` timestamp NULL DEFAULT NULL,
  `token_verificacion` varchar(255) DEFAULT NULL,
  `token_reset_password` varchar(255) DEFAULT NULL,
  `token_reset_expira` timestamp NULL DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL COMMENT 'Usuario que lo cre??'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Usuarios del sistema';

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id`, `nombre`, `apellido`, `email`, `telefono`, `password`, `avatar_url`, `tipo_usuario`, `empresa_id_default`, `idioma`, `zona_horaria`, `tema`, `ultimo_login`, `ultimo_ip`, `intentos_fallidos`, `bloqueado_hasta`, `email_verificado`, `email_verificado_at`, `token_verificacion`, `token_reset_password`, `token_reset_expira`, `activo`, `created_at`, `updated_at`, `created_by`) VALUES
(1, 'Super', 'Admin', 'admin@kore.com', NULL, '$2a$10$S01LoSwWiRGAMx79Bcl30ebU/sauGbD9aQjgLW4gBf7MU4b48UM/u', NULL, 'super_admin', NULL, 'es', 'America/Bogota', 'light', '2026-01-06 15:15:43', '::1', 0, NULL, 1, NULL, NULL, NULL, NULL, 1, '2026-01-05 15:56:23', '2026-01-06 15:15:43', NULL),
(2, 'Juan', 'Perez', 'juan@abccomercial.com', NULL, '$2a$10$S01LoSwWiRGAMx79Bcl30ebU/sauGbD9aQjgLW4gBf7MU4b48UM/u', NULL, 'admin_empresa', 1, 'es', 'America/Bogota', 'light', '2026-01-05 16:57:33', '::1', 0, NULL, 1, NULL, NULL, NULL, NULL, 1, '2026-01-05 15:56:23', '2026-01-05 16:57:33', NULL),
(3, 'Mar??a', 'Gonz??lez', 'maria@abccomercial.com', NULL, '$2a$10$S01LoSwWiRGAMx79Bcl30ebU/sauGbD9aQjgLW4gBf7MU4b48UM/u', NULL, 'usuario', 1, 'es', 'America/Bogota', 'light', NULL, NULL, 0, NULL, 1, NULL, NULL, NULL, NULL, 1, '2026-01-05 15:56:23', '2026-01-05 16:15:11', NULL),
(4, 'Carlos', 'Rodr??guez', 'carlos@xyzdistribuidora.com', NULL, '$2a$10$S01LoSwWiRGAMx79Bcl30ebU/sauGbD9aQjgLW4gBf7MU4b48UM/u', NULL, 'admin_empresa', 2, 'es', 'America/Bogota', 'light', NULL, NULL, 0, NULL, 1, NULL, NULL, NULL, NULL, 1, '2026-01-05 15:56:23', '2026-01-05 16:15:11', NULL),
(5, 'Demo', 'User', 'demo@kore.com', NULL, '$2a$10$S01LoSwWiRGAMx79Bcl30ebU/sauGbD9aQjgLW4gBf7MU4b48UM/u', NULL, 'usuario', 1, 'es', 'America/Bogota', 'light', NULL, NULL, 0, NULL, 1, NULL, NULL, NULL, NULL, 1, '2026-01-05 15:56:23', '2026-01-05 16:15:11', NULL),
(6, 'Carlos', 'Rodriguez', 'test@nuevaempresa.com', NULL, '$2a$10$ey6e/wjioRlL9Xi/nsoSveOH8fGnxtQdpJ/eBLSA1IdJTBlUp30JW', NULL, 'admin_empresa', 4, 'es', 'America/Bogota', 'light', NULL, NULL, 0, NULL, 0, NULL, NULL, NULL, NULL, 1, '2026-01-05 16:16:36', '2026-01-05 16:16:36', NULL);

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_tipo` (`tipo_usuario`),
  ADD KEY `idx_activo` (`activo`),
  ADD KEY `idx_empresa_default` (`empresa_id_default`);
ALTER TABLE `usuarios` ADD FULLTEXT KEY `ft_busqueda` (`nombre`,`apellido`,`email`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`empresa_id_default`) REFERENCES `empresas` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
