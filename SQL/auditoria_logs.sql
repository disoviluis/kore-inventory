-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-02-2026 a las 13:31:07
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
-- Estructura de tabla para la tabla `auditoria_logs`
--

CREATE TABLE `auditoria_logs` (
  `id` bigint(20) NOT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `empresa_id` int(11) DEFAULT NULL,
  `accion` varchar(100) NOT NULL COMMENT 'create, update, delete, login, etc.',
  `modulo` varchar(50) DEFAULT NULL COMMENT 'M??dulo donde ocurri??',
  `tabla` varchar(100) DEFAULT NULL COMMENT 'Tabla afectada',
  `registro_id` int(11) DEFAULT NULL COMMENT 'ID del registro afectado',
  `datos_anteriores` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Estado antes del cambio' CHECK (json_valid(`datos_anteriores`)),
  `datos_nuevos` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Estado despu??s del cambio' CHECK (json_valid(`datos_nuevos`)),
  `ip` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `url` varchar(500) DEFAULT NULL,
  `metodo` varchar(10) DEFAULT NULL COMMENT 'GET, POST, PUT, DELETE',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Auditor??a de todas las acciones del sistema';

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `auditoria_logs`
--
ALTER TABLE `auditoria_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_usuario` (`usuario_id`),
  ADD KEY `idx_empresa` (`empresa_id`),
  ADD KEY `idx_accion` (`accion`),
  ADD KEY `idx_modulo` (`modulo`),
  ADD KEY `idx_tabla_registro` (`tabla`,`registro_id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_usuario_fecha` (`usuario_id`,`created_at`),
  ADD KEY `idx_empresa_fecha` (`empresa_id`,`created_at`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `auditoria_logs`
--
ALTER TABLE `auditoria_logs`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `auditoria_logs`
--
ALTER TABLE `auditoria_logs`
  ADD CONSTRAINT `auditoria_logs_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `auditoria_logs_ibfk_2` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
