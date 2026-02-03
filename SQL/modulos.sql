-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-02-2026 a las 13:31:59
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
-- Estructura de tabla para la tabla `modulos`
--

CREATE TABLE `modulos` (
  `id` int(11) NOT NULL,
  `nombre` varchar(50) NOT NULL COMMENT 'pos, inventario, ventas, etc.',
  `nombre_mostrar` varchar(100) NOT NULL COMMENT 'Nombre para UI',
  `descripcion` text DEFAULT NULL,
  `icono` varchar(50) DEFAULT NULL COMMENT 'Clase de icono Bootstrap',
  `nivel` enum('platform','core','tenant') NOT NULL COMMENT 'Nivel de acceso',
  `categoria` varchar(50) DEFAULT NULL COMMENT 'operaciones, finanzas, administracion',
  `orden` int(11) DEFAULT 0 COMMENT 'Orden en men??',
  `ruta` varchar(100) DEFAULT NULL COMMENT 'Ruta del m??dulo',
  `activo` tinyint(1) DEFAULT 1,
  `requiere_licencia` tinyint(1) DEFAULT 1 COMMENT 'Si requiere estar en el plan',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='M??dulos del sistema';

--
-- Volcado de datos para la tabla `modulos`
--

INSERT INTO `modulos` (`id`, `nombre`, `nombre_mostrar`, `descripcion`, `icono`, `nivel`, `categoria`, `orden`, `ruta`, `activo`, `requiere_licencia`, `created_at`, `updated_at`) VALUES
(1, 'empresas', 'Empresas', 'Gesti??n de empresas del sistema', 'bi-building', 'platform', 'plataforma', 1, '/empresas', 1, 0, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(2, 'planes', 'Planes', 'Gesti??n de planes de suscripci??n', 'bi-box', 'platform', 'plataforma', 2, '/planes', 1, 0, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(3, 'licencias', 'Licencias', 'Gesti??n de licencias', 'bi-key', 'platform', 'plataforma', 3, '/licencias', 1, 0, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(4, 'dashboard', 'Dashboard', 'Panel principal', 'bi-speedometer2', 'core', NULL, 0, '/dashboard', 1, 0, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(5, 'usuarios', 'Usuarios', 'Gesti??n de usuarios', 'bi-person-gear', 'core', 'administracion', 20, '/usuarios', 1, 0, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(6, 'roles', 'Roles y Permisos', 'Gesti??n de roles', 'bi-shield-check', 'core', 'administracion', 21, '/roles', 1, 0, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(7, 'pos', 'Punto de Venta', 'Sistema POS', 'bi-cart-check', 'tenant', 'operaciones', 10, '/pos', 1, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(8, 'ventas', 'Ventas', 'Gesti??n de ventas', 'bi-receipt', 'tenant', 'operaciones', 11, '/ventas', 1, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(9, 'clientes', 'Clientes', 'Gesti??n de clientes', 'bi-people', 'tenant', 'operaciones', 12, '/clientes', 1, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(10, 'productos', 'Productos', 'Cat??logo de productos', 'bi-tags', 'tenant', 'operaciones', 13, '/productos', 1, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(11, 'inventario', 'Inventario', 'Control de inventario', 'bi-box-seam', 'tenant', 'operaciones', 14, '/inventario', 1, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(12, 'compras', 'Compras', 'Gesti??n de compras', 'bi-cart-plus', 'tenant', 'operaciones', 15, '/compras', 1, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(13, 'proveedores', 'Proveedores', 'Gesti??n de proveedores', 'bi-truck', 'tenant', 'operaciones', 16, '/proveedores', 1, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(14, 'caja', 'Caja', 'Movimientos de caja', 'bi-cash-stack', 'tenant', 'finanzas', 17, '/caja', 1, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(15, 'bancos', 'Bancos', 'Cuentas bancarias', 'bi-bank', 'tenant', 'finanzas', 18, '/bancos', 1, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(16, 'contabilidad', 'Contabilidad', 'Sistema contable', 'bi-calculator', 'tenant', 'finanzas', 19, '/contabilidad', 1, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(17, 'reportes', 'Reportes', 'Reportes e informes', 'bi-graph-up', 'tenant', 'finanzas', 22, '/reportes', 1, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `modulos`
--
ALTER TABLE `modulos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nombre` (`nombre`),
  ADD KEY `idx_nivel` (`nivel`),
  ADD KEY `idx_activo` (`activo`),
  ADD KEY `idx_orden` (`orden`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `modulos`
--
ALTER TABLE `modulos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
