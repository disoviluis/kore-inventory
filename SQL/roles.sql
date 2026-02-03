-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-02-2026 a las 13:32:38
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
-- Estructura de tabla para la tabla `roles`
--

CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `empresa_id` int(11) DEFAULT NULL COMMENT 'NULL = rol global (ej: SuperAdmin)',
  `nombre` varchar(100) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `slug` varchar(100) NOT NULL COMMENT 'admin, cajero, bodeguero, etc.',
  `tipo` enum('sistema','personalizado') DEFAULT 'personalizado',
  `es_admin` tinyint(1) DEFAULT 0 COMMENT 'Admin total de la empresa',
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Roles de usuarios';

--
-- Volcado de datos para la tabla `roles`
--

INSERT INTO `roles` (`id`, `empresa_id`, `nombre`, `descripcion`, `slug`, `tipo`, `es_admin`, `activo`, `created_at`, `updated_at`, `created_by`) VALUES
(1, NULL, 'Super Administrador', 'Acceso total al sistema', 'super_admin', 'sistema', 1, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23', NULL),
(2, 1, 'Administrador Empresa', 'Administrador total de la empresa', 'admin_empresa', 'sistema', 1, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23', NULL),
(3, 1, 'Gerente', 'Gerente con acceso a reportes', 'gerente', 'personalizado', 0, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23', NULL),
(4, 1, 'Cajero', 'Usuario de punto de venta', 'cajero', 'personalizado', 0, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23', NULL),
(5, 1, 'Bodeguero', 'Control de inventario', 'bodeguero', 'personalizado', 0, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23', NULL),
(6, 4, 'Administrador', 'Administrador de la empresa', 'admin', 'sistema', 1, 1, '2026-01-05 16:16:36', '2026-01-05 16:16:36', NULL);

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_empresa_nombre` (`empresa_id`,`nombre`),
  ADD KEY `idx_empresa` (`empresa_id`),
  ADD KEY `idx_slug` (`slug`),
  ADD KEY `idx_activo` (`activo`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `roles`
--
ALTER TABLE `roles`
  ADD CONSTRAINT `roles_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
