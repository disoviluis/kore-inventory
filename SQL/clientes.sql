-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-02-2026 a las 13:31:31
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
-- Estructura de tabla para la tabla `clientes`
--

CREATE TABLE `clientes` (
  `id` int(11) NOT NULL COMMENT 'ID ├║nico del cliente',
  `empresa_id` int(11) NOT NULL COMMENT 'ID de la empresa propietaria',
  `tipo_documento` enum('CC','NIT','CE','Pasaporte') DEFAULT 'CC' COMMENT 'Tipo de documento de identidad',
  `numero_documento` varchar(50) NOT NULL COMMENT 'N├║mero de documento ├║nico',
  `nombre` varchar(200) NOT NULL COMMENT 'Nombre del cliente o empresa',
  `apellido` varchar(200) DEFAULT NULL COMMENT 'Apellido del cliente (si es individual)',
  `razon_social` varchar(300) DEFAULT NULL COMMENT 'Raz├│n social (si es empresa)',
  `email` varchar(150) DEFAULT NULL COMMENT 'Correo electr├│nico',
  `telefono` varchar(50) DEFAULT NULL COMMENT 'Tel├®fono fijo',
  `celular` varchar(50) DEFAULT NULL COMMENT 'N├║mero de celular',
  `direccion` varchar(300) DEFAULT NULL COMMENT 'Direcci├│n completa',
  `ciudad` varchar(100) DEFAULT NULL COMMENT 'Ciudad',
  `departamento` varchar(100) DEFAULT NULL COMMENT 'Departamento/Estado',
  `pais` varchar(100) DEFAULT 'Colombia' COMMENT 'Pa├¡s',
  `tipo_cliente` enum('individual','empresa') DEFAULT 'individual' COMMENT 'Tipo de cliente',
  `estado` enum('activo','inactivo') DEFAULT 'activo' COMMENT 'Estado del cliente',
  `credito_disponible` decimal(15,2) DEFAULT 0.00 COMMENT 'Cr├®dito disponible actual',
  `limite_credito` decimal(15,2) DEFAULT 0.00 COMMENT 'L├¡mite de cr├®dito m├íximo',
  `notas` text DEFAULT NULL COMMENT 'Notas adicionales del cliente',
  `creado_por` int(11) DEFAULT NULL COMMENT 'ID del usuario que cre├│ el cliente',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Fecha de creaci├│n',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Fecha de ├║ltima actualizaci├│n'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `clientes`
--
ALTER TABLE `clientes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_empresa_documento` (`empresa_id`,`numero_documento`),
  ADD KEY `creado_por` (`creado_por`),
  ADD KEY `idx_empresa_id` (`empresa_id`),
  ADD KEY `idx_estado` (`estado`),
  ADD KEY `idx_documento` (`numero_documento`),
  ADD KEY `idx_nombre` (`nombre`);

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `clientes`
--
ALTER TABLE `clientes`
  ADD CONSTRAINT `clientes_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `clientes_ibfk_2` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
