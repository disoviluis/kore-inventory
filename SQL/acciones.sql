-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-02-2026 a las 13:30:50
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
-- Estructura de tabla para la tabla `acciones`
--

CREATE TABLE `acciones` (
  `id` int(11) NOT NULL,
  `nombre` varchar(50) NOT NULL COMMENT 'view, create, edit, delete, approve, export',
  `nombre_mostrar` varchar(100) NOT NULL COMMENT 'Ver, Crear, Editar, etc.',
  `descripcion` text DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Acciones del sistema de permisos';

--
-- Volcado de datos para la tabla `acciones`
--

INSERT INTO `acciones` (`id`, `nombre`, `nombre_mostrar`, `descripcion`, `activo`, `created_at`) VALUES
(1, 'view', 'Ver', 'Visualizar registros', 1, '2026-01-05 15:56:23'),
(2, 'create', 'Crear', 'Crear nuevos registros', 1, '2026-01-05 15:56:23'),
(3, 'edit', 'Editar', 'Modificar registros existentes', 1, '2026-01-05 15:56:23'),
(4, 'delete', 'Eliminar', 'Eliminar registros', 1, '2026-01-05 15:56:23'),
(5, 'approve', 'Aprobar', 'Aprobar transacciones', 1, '2026-01-05 15:56:23'),
(6, 'export', 'Exportar', 'Exportar datos', 1, '2026-01-05 15:56:23'),
(7, 'import', 'Importar', 'Importar datos', 1, '2026-01-05 15:56:23'),
(8, 'print', 'Imprimir', 'Imprimir documentos', 1, '2026-01-05 15:56:23');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `acciones`
--
ALTER TABLE `acciones`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nombre` (`nombre`),
  ADD KEY `idx_nombre` (`nombre`),
  ADD KEY `idx_activo` (`activo`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `acciones`
--
ALTER TABLE `acciones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
