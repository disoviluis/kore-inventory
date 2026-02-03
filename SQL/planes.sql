-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-02-2026 a las 13:32:16
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
-- Estructura de tabla para la tabla `planes`
--

CREATE TABLE `planes` (
  `id` int(11) NOT NULL,
  `nombre` varchar(50) NOT NULL COMMENT 'B??sico, Profesional, Enterprise',
  `descripcion` text DEFAULT NULL,
  `precio_mensual` decimal(10,2) NOT NULL,
  `precio_anual` decimal(10,2) DEFAULT NULL,
  `max_empresas` int(11) DEFAULT 1 COMMENT 'N??mero m??ximo de empresas',
  `max_usuarios_por_empresa` int(11) DEFAULT 5 COMMENT 'Usuarios por empresa',
  `max_productos` int(11) DEFAULT NULL COMMENT 'NULL = ilimitado',
  `max_facturas_mes` int(11) DEFAULT NULL COMMENT 'NULL = ilimitado',
  `modulos_incluidos` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Array de m??dulos: ["pos", "inventario", "contabilidad"]' CHECK (json_valid(`modulos_incluidos`)),
  `soporte_nivel` enum('email','prioritario','24/7') DEFAULT 'email',
  `api_access` tinyint(1) DEFAULT 0,
  `white_label` tinyint(1) DEFAULT 0,
  `reportes_avanzados` tinyint(1) DEFAULT 0,
  `multi_bodega` tinyint(1) DEFAULT 0,
  `activo` tinyint(1) DEFAULT 1,
  `destacado` tinyint(1) DEFAULT 0 COMMENT 'Plan recomendado',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Planes de suscripci??n del sistema SaaS';

--
-- Volcado de datos para la tabla `planes`
--

INSERT INTO `planes` (`id`, `nombre`, `descripcion`, `precio_mensual`, `precio_anual`, `max_empresas`, `max_usuarios_por_empresa`, `max_productos`, `max_facturas_mes`, `modulos_incluidos`, `soporte_nivel`, `api_access`, `white_label`, `reportes_avanzados`, `multi_bodega`, `activo`, `destacado`, `created_at`, `updated_at`) VALUES
(1, 'B??sico', 'Plan ideal para peque??os negocios que est??n comenzando', 29.00, 290.00, 1, 5, 500, 100, '[\"pos\", \"inventario\", \"ventas\", \"clientes\"]', 'email', 0, 0, 0, 0, 1, 0, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(2, 'Profesional', 'Plan completo para empresas en crecimiento', 79.00, 790.00, 5, 20, NULL, NULL, '[\"pos\", \"inventario\", \"ventas\", \"clientes\", \"compras\", \"proveedores\", \"caja\", \"contabilidad\", \"reportes\"]', 'prioritario', 1, 0, 1, 1, 1, 1, '2026-01-05 15:56:23', '2026-01-05 15:56:23'),
(3, 'Enterprise', 'Soluci??n empresarial sin l??mites', 199.00, 1990.00, NULL, NULL, NULL, NULL, '[\"pos\", \"inventario\", \"ventas\", \"clientes\", \"compras\", \"proveedores\", \"caja\", \"bancos\", \"contabilidad\", \"reportes\", \"usuarios\", \"roles\"]', '24/7', 1, 1, 1, 1, 1, 0, '2026-01-05 15:56:23', '2026-01-05 15:56:23');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `planes`
--
ALTER TABLE `planes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nombre` (`nombre`),
  ADD KEY `idx_activo` (`activo`),
  ADD KEY `idx_destacado` (`destacado`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `planes`
--
ALTER TABLE `planes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
