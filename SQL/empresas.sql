-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-02-2026 a las 13:31:42
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
-- Estructura de tabla para la tabla `empresas`
--

CREATE TABLE `empresas` (
  `id` int(11) NOT NULL,
  `nombre` varchar(200) NOT NULL,
  `razon_social` varchar(200) DEFAULT NULL,
  `nit` varchar(50) DEFAULT NULL,
  `email` varchar(100) NOT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `direccion` text DEFAULT NULL,
  `ciudad` varchar(100) DEFAULT NULL,
  `pais` varchar(100) DEFAULT 'Colombia',
  `logo_url` varchar(500) DEFAULT NULL,
  `color_primario` varchar(7) DEFAULT '#1E40AF' COMMENT 'Hex color',
  `plan_id` int(11) NOT NULL,
  `moneda` varchar(3) DEFAULT 'COP' COMMENT 'ISO 4217',
  `zona_horaria` varchar(50) DEFAULT 'America/Bogota',
  `idioma` varchar(5) DEFAULT 'es',
  `regimen_tributario` enum('simplificado','com??n','especial') DEFAULT 'simplificado',
  `tipo_contribuyente` enum('persona_natural','persona_juridica') DEFAULT 'persona_juridica',
  `estado` enum('activa','suspendida','cancelada','trial') DEFAULT 'trial',
  `fecha_inicio_trial` date DEFAULT NULL,
  `fecha_fin_trial` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL COMMENT 'Usuario que cre?? la empresa'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Empresas del sistema multi-tenant';

--
-- Volcado de datos para la tabla `empresas`
--

INSERT INTO `empresas` (`id`, `nombre`, `razon_social`, `nit`, `email`, `telefono`, `direccion`, `ciudad`, `pais`, `logo_url`, `color_primario`, `plan_id`, `moneda`, `zona_horaria`, `idioma`, `regimen_tributario`, `tipo_contribuyente`, `estado`, `fecha_inicio_trial`, `fecha_fin_trial`, `created_at`, `updated_at`, `created_by`) VALUES
(1, 'ABC Comercial S.A.', 'ABC Comercial Sociedad An??nima', '900123456-1', 'contacto@abccomercial.com', '+57 300 1234567', 'Calle 123 #45-67', 'Bogot??', 'Colombia', NULL, '#1E40AF', 2, 'COP', 'America/Bogota', 'es', 'simplificado', 'persona_juridica', 'activa', '2025-01-01', NULL, '2026-01-05 15:56:23', '2026-01-05 15:56:23', NULL),
(2, 'XYZ Distribuidora', 'XYZ Distribuidora Ltda', '900234567-2', 'info@xyzdistribuidora.com', '+57 300 2345678', 'Carrera 45 #67-89', 'Medell??n', 'Colombia', NULL, '#1E40AF', 1, 'COP', 'America/Bogota', 'es', 'simplificado', 'persona_juridica', 'activa', '2025-01-01', NULL, '2026-01-05 15:56:23', '2026-01-05 15:56:23', NULL),
(3, 'TechCorp Solutions', 'TechCorp Solutions SAS', '900345678-3', 'admin@techcorp.com', '+57 300 3456789', 'Avenida 34 #12-34', 'Cali', 'Colombia', NULL, '#1E40AF', 3, 'COP', 'America/Bogota', 'es', 'simplificado', 'persona_juridica', 'activa', '2025-01-01', NULL, '2026-01-05 15:56:23', '2026-01-05 15:56:23', NULL),
(4, 'Nueva Empresa Test SAS', NULL, NULL, 'test@nuevaempresa.com', NULL, NULL, NULL, 'Colombia', NULL, '#1E40AF', 1, 'COP', 'America/Bogota', 'es', 'simplificado', 'persona_juridica', 'trial', '2026-01-05', '2026-01-20', '2026-01-05 16:16:36', '2026-01-05 16:16:36', NULL);

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `empresas`
--
ALTER TABLE `empresas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `nit` (`nit`),
  ADD KEY `idx_estado` (`estado`),
  ADD KEY `idx_plan` (`plan_id`),
  ADD KEY `idx_nit` (`nit`),
  ADD KEY `idx_email` (`email`);
ALTER TABLE `empresas` ADD FULLTEXT KEY `ft_busqueda` (`nombre`,`razon_social`,`nit`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `empresas`
--
ALTER TABLE `empresas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `empresas`
--
ALTER TABLE `empresas`
  ADD CONSTRAINT `empresas_ibfk_1` FOREIGN KEY (`plan_id`) REFERENCES `planes` (`id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
