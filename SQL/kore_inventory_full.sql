-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: kore_inventory
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `acciones`
--

DROP TABLE IF EXISTS `acciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `acciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL COMMENT 'view, create, edit, delete, approve, export',
  `nombre_mostrar` varchar(100) NOT NULL COMMENT 'Ver, Crear, Editar, etc.',
  `descripcion` text DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`),
  KEY `idx_nombre` (`nombre`),
  KEY `idx_activo` (`activo`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Acciones del sistema de permisos';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `acciones`
--

LOCK TABLES `acciones` WRITE;
/*!40000 ALTER TABLE `acciones` DISABLE KEYS */;
INSERT INTO `acciones` VALUES (1,'view','Ver','Visualizar registros',1,'2026-01-05 15:56:23'),(2,'create','Crear','Crear nuevos registros',1,'2026-01-05 15:56:23'),(3,'edit','Editar','Modificar registros existentes',1,'2026-01-05 15:56:23'),(4,'delete','Eliminar','Eliminar registros',1,'2026-01-05 15:56:23'),(5,'approve','Aprobar','Aprobar transacciones',1,'2026-01-05 15:56:23'),(6,'export','Exportar','Exportar datos',1,'2026-01-05 15:56:23'),(7,'import','Importar','Importar datos',1,'2026-01-05 15:56:23'),(8,'print','Imprimir','Imprimir documentos',1,'2026-01-05 15:56:23');
/*!40000 ALTER TABLE `acciones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auditoria_logs`
--

DROP TABLE IF EXISTS `auditoria_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auditoria_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
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
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_usuario` (`usuario_id`),
  KEY `idx_empresa` (`empresa_id`),
  KEY `idx_accion` (`accion`),
  KEY `idx_modulo` (`modulo`),
  KEY `idx_tabla_registro` (`tabla`,`registro_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_usuario_fecha` (`usuario_id`,`created_at`),
  KEY `idx_empresa_fecha` (`empresa_id`,`created_at`),
  CONSTRAINT `auditoria_logs_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `auditoria_logs_ibfk_2` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Auditor??a de todas las acciones del sistema';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auditoria_logs`
--

LOCK TABLES `auditoria_logs` WRITE;
/*!40000 ALTER TABLE `auditoria_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `auditoria_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categorias`
--

DROP TABLE IF EXISTS `categorias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `categorias` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'ID ·nico de la categorÝa',
  `empresa_id` int(11) NOT NULL COMMENT 'ID de la empresa propietaria',
  `nombre` varchar(100) NOT NULL COMMENT 'Nombre de la categor├¡a',
  `descripcion` text DEFAULT NULL COMMENT 'Descripci├│n de la categor├¡a',
  `icono` varchar(50) DEFAULT NULL COMMENT 'Icono de la categor├¡a (ej: bi-laptop)',
  `color` varchar(20) DEFAULT NULL COMMENT 'Color de la categor├¡a en hexadecimal',
  `activo` tinyint(1) DEFAULT 1 COMMENT 'Estado de la categor├¡a',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Fecha de creaci├│n',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Fecha de ├║ltima actualizaci├│n',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_empresa_nombre` (`empresa_id`,`nombre`),
  KEY `idx_empresa_id` (`empresa_id`),
  KEY `idx_activo` (`activo`),
  CONSTRAINT `categorias_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categorias`
--

LOCK TABLES `categorias` WRITE;
/*!40000 ALTER TABLE `categorias` DISABLE KEYS */;
INSERT INTO `categorias` VALUES (1,1,'Electr??nica','Productos electr??nicos y tecnolog??a',NULL,NULL,1,'2026-01-05 20:59:53','2026-01-05 20:59:53'),(2,1,'Ropa y Accesorios','Vestimenta y complementos',NULL,NULL,1,'2026-01-05 20:59:53','2026-01-05 20:59:53'),(3,1,'Alimentos y Bebidas','Productos alimenticios',NULL,NULL,1,'2026-01-05 20:59:53','2026-01-05 20:59:53'),(4,1,'Hogar y Decoraci??n','Art??culos para el hogar',NULL,NULL,1,'2026-01-05 20:59:53','2026-01-05 20:59:53'),(5,1,'Deportes y Fitness','Equipamiento deportivo',NULL,NULL,1,'2026-01-05 20:59:53','2026-01-05 20:59:53'),(6,1,'Libros y Papeler??a','Material de lectura y oficina',NULL,NULL,1,'2026-01-05 20:59:53','2026-01-05 20:59:53'),(7,1,'Juguetes y Juegos','Entretenimiento infantil',NULL,NULL,1,'2026-01-05 20:59:53','2026-01-05 20:59:53'),(8,1,'Belleza y Cuidado Personal','Cosm??ticos e higiene',NULL,NULL,1,'2026-01-05 20:59:53','2026-01-05 20:59:53'),(9,1,'Automotriz','Repuestos y accesorios para veh??culos',NULL,NULL,1,'2026-01-05 20:59:53','2026-01-05 20:59:53'),(10,1,'Ferreter??a y Construcci??n','Herramientas y materiales',NULL,NULL,1,'2026-01-05 20:59:53','2026-01-05 20:59:53'),(11,1,'Otros','Productos varios',NULL,NULL,1,'2026-01-05 20:59:53','2026-01-05 20:59:53');
/*!40000 ALTER TABLE `categorias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clientes`
--

DROP TABLE IF EXISTS `clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Fecha de ├║ltima actualizaci├│n',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_empresa_documento` (`empresa_id`,`numero_documento`),
  KEY `creado_por` (`creado_por`),
  KEY `idx_empresa_id` (`empresa_id`),
  KEY `idx_estado` (`estado`),
  KEY `idx_documento` (`numero_documento`),
  KEY `idx_nombre` (`nombre`),
  CONSTRAINT `clientes_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `clientes_ibfk_2` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clientes`
--

LOCK TABLES `clientes` WRITE;
/*!40000 ALTER TABLE `clientes` DISABLE KEYS */;
/*!40000 ALTER TABLE `clientes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `empresas`
--

DROP TABLE IF EXISTS `empresas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `empresas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
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
  `created_by` int(11) DEFAULT NULL COMMENT 'Usuario que cre?? la empresa',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `nit` (`nit`),
  KEY `idx_estado` (`estado`),
  KEY `idx_plan` (`plan_id`),
  KEY `idx_nit` (`nit`),
  KEY `idx_email` (`email`),
  FULLTEXT KEY `ft_busqueda` (`nombre`,`razon_social`,`nit`),
  CONSTRAINT `empresas_ibfk_1` FOREIGN KEY (`plan_id`) REFERENCES `planes` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Empresas del sistema multi-tenant';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `empresas`
--

LOCK TABLES `empresas` WRITE;
/*!40000 ALTER TABLE `empresas` DISABLE KEYS */;
INSERT INTO `empresas` VALUES (1,'ABC Comercial S.A.','ABC Comercial Sociedad An??nima','900123456-1','contacto@abccomercial.com','+57 300 1234567','Calle 123 #45-67','Bogot??','Colombia',NULL,'#1E40AF',2,'COP','America/Bogota','es','simplificado','persona_juridica','activa','2025-01-01',NULL,'2026-01-05 15:56:23','2026-01-05 15:56:23',NULL),(2,'XYZ Distribuidora','XYZ Distribuidora Ltda','900234567-2','info@xyzdistribuidora.com','+57 300 2345678','Carrera 45 #67-89','Medell??n','Colombia',NULL,'#1E40AF',1,'COP','America/Bogota','es','simplificado','persona_juridica','activa','2025-01-01',NULL,'2026-01-05 15:56:23','2026-01-05 15:56:23',NULL),(3,'TechCorp Solutions','TechCorp Solutions SAS','900345678-3','admin@techcorp.com','+57 300 3456789','Avenida 34 #12-34','Cali','Colombia',NULL,'#1E40AF',3,'COP','America/Bogota','es','simplificado','persona_juridica','activa','2025-01-01',NULL,'2026-01-05 15:56:23','2026-01-05 15:56:23',NULL),(4,'Nueva Empresa Test SAS',NULL,NULL,'test@nuevaempresa.com',NULL,NULL,NULL,'Colombia',NULL,'#1E40AF',1,'COP','America/Bogota','es','simplificado','persona_juridica','trial','2026-01-05','2026-01-20','2026-01-05 16:16:36','2026-01-05 16:16:36',NULL);
/*!40000 ALTER TABLE `empresas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `licencias`
--

DROP TABLE IF EXISTS `licencias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `licencias` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `plan_id` int(11) NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `tipo_facturacion` enum('mensual','anual') DEFAULT 'mensual',
  `monto` decimal(10,2) NOT NULL,
  `moneda` varchar(3) DEFAULT 'COP',
  `estado` enum('activa','vencida','cancelada','suspendida') DEFAULT 'activa',
  `auto_renovacion` tinyint(1) DEFAULT 1,
  `limite_usuarios` int(11) DEFAULT NULL,
  `limite_productos` int(11) DEFAULT NULL,
  `limite_facturas_mes` int(11) DEFAULT NULL,
  `ultimo_pago_id` int(11) DEFAULT NULL COMMENT 'Referencia a tabla de pagos',
  `proximo_pago_fecha` date DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `cancelada_at` timestamp NULL DEFAULT NULL,
  `cancelada_razon` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_empresa_activa` (`empresa_id`,`estado`),
  KEY `plan_id` (`plan_id`),
  KEY `idx_empresa` (`empresa_id`),
  KEY `idx_estado` (`estado`),
  KEY `idx_fecha_fin` (`fecha_fin`),
  KEY `idx_empresa_estado` (`empresa_id`,`estado`),
  CONSTRAINT `licencias_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `licencias_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `planes` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Licencias de empresas';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `licencias`
--

LOCK TABLES `licencias` WRITE;
/*!40000 ALTER TABLE `licencias` DISABLE KEYS */;
INSERT INTO `licencias` VALUES (1,1,2,'2025-01-01','2025-12-31','anual',790.00,'COP','activa',1,20,NULL,NULL,NULL,NULL,NULL,'2026-01-05 15:56:23','2026-01-05 15:56:23',NULL,NULL),(2,2,1,'2025-01-01','2025-01-31','mensual',29.00,'COP','activa',1,5,500,100,NULL,NULL,NULL,'2026-01-05 15:56:23','2026-01-05 15:56:23',NULL,NULL),(3,3,3,'2025-01-01','2025-12-31','anual',1990.00,'COP','activa',1,NULL,NULL,NULL,NULL,NULL,NULL,'2026-01-05 15:56:23','2026-01-05 15:56:23',NULL,NULL),(4,4,1,'2026-01-05','2026-01-20','mensual',0.00,'COP','activa',1,NULL,NULL,NULL,NULL,NULL,NULL,'2026-01-05 16:16:36','2026-01-05 16:16:36',NULL,NULL);
/*!40000 ALTER TABLE `licencias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `modulos`
--

DROP TABLE IF EXISTS `modulos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `modulos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
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
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`),
  KEY `idx_nivel` (`nivel`),
  KEY `idx_activo` (`activo`),
  KEY `idx_orden` (`orden`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='M??dulos del sistema';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `modulos`
--

LOCK TABLES `modulos` WRITE;
/*!40000 ALTER TABLE `modulos` DISABLE KEYS */;
INSERT INTO `modulos` VALUES (1,'empresas','Empresas','Gesti??n de empresas del sistema','bi-building','platform','plataforma',1,'/empresas',1,0,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(2,'planes','Planes','Gesti??n de planes de suscripci??n','bi-box','platform','plataforma',2,'/planes',1,0,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(3,'licencias','Licencias','Gesti??n de licencias','bi-key','platform','plataforma',3,'/licencias',1,0,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(4,'dashboard','Dashboard','Panel principal','bi-speedometer2','core',NULL,0,'/dashboard',1,0,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(5,'usuarios','Usuarios','Gesti??n de usuarios','bi-person-gear','core','administracion',20,'/usuarios',1,0,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(6,'roles','Roles y Permisos','Gesti??n de roles','bi-shield-check','core','administracion',21,'/roles',1,0,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(7,'pos','Punto de Venta','Sistema POS','bi-cart-check','tenant','operaciones',10,'/pos',1,1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(8,'ventas','Ventas','Gesti??n de ventas','bi-receipt','tenant','operaciones',11,'/ventas',1,1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(9,'clientes','Clientes','Gesti??n de clientes','bi-people','tenant','operaciones',12,'/clientes',1,1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(10,'productos','Productos','Cat??logo de productos','bi-tags','tenant','operaciones',13,'/productos',1,1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(11,'inventario','Inventario','Control de inventario','bi-box-seam','tenant','operaciones',14,'/inventario',1,1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(12,'compras','Compras','Gesti??n de compras','bi-cart-plus','tenant','operaciones',15,'/compras',1,1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(13,'proveedores','Proveedores','Gesti??n de proveedores','bi-truck','tenant','operaciones',16,'/proveedores',1,1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(14,'caja','Caja','Movimientos de caja','bi-cash-stack','tenant','finanzas',17,'/caja',1,1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(15,'bancos','Bancos','Cuentas bancarias','bi-bank','tenant','finanzas',18,'/bancos',1,1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(16,'contabilidad','Contabilidad','Sistema contable','bi-calculator','tenant','finanzas',19,'/contabilidad',1,1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(17,'reportes','Reportes','Reportes e informes','bi-graph-up','tenant','finanzas',22,'/reportes',1,1,'2026-01-05 15:56:23','2026-01-05 15:56:23');
/*!40000 ALTER TABLE `modulos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permisos`
--

DROP TABLE IF EXISTS `permisos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permisos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `modulo_id` int(11) NOT NULL,
  `accion_id` int(11) NOT NULL,
  `codigo` varchar(100) NOT NULL,
  `descripcion` text DEFAULT NULL COMMENT 'Descripci??n clara del permiso',
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  UNIQUE KEY `uk_modulo_accion` (`modulo_id`,`accion_id`),
  KEY `idx_modulo` (`modulo_id`),
  KEY `idx_accion` (`accion_id`),
  KEY `idx_codigo` (`codigo`),
  KEY `idx_activo` (`activo`),
  CONSTRAINT `permisos_ibfk_1` FOREIGN KEY (`modulo_id`) REFERENCES `modulos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `permisos_ibfk_2` FOREIGN KEY (`accion_id`) REFERENCES `acciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Permisos del sistema (m??dulo + acci??n)';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permisos`
--

LOCK TABLES `permisos` WRITE;
/*!40000 ALTER TABLE `permisos` DISABLE KEYS */;
INSERT INTO `permisos` VALUES (1,4,1,'dashboard.view','Ver Dashboard',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(2,7,1,'pos.view','Ver Punto de Venta',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(3,7,2,'pos.create','Crear Punto de Venta',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(5,8,1,'ventas.view','Ver Ventas',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(6,8,2,'ventas.create','Crear Ventas',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(7,8,3,'ventas.edit','Editar Ventas',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(8,8,4,'ventas.delete','Eliminar Ventas',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(9,8,6,'ventas.export','Exportar Ventas',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(10,8,8,'ventas.print','Imprimir Ventas',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(12,10,1,'productos.view','Ver Productos',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(13,10,2,'productos.create','Crear Productos',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(14,10,3,'productos.edit','Editar Productos',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(15,10,4,'productos.delete','Eliminar Productos',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(16,10,6,'productos.export','Exportar Productos',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(17,10,7,'productos.import','Importar Productos',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(19,11,1,'inventario.view','Ver Inventario',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(20,11,3,'inventario.edit','Editar Inventario',1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(21,11,5,'inventario.approve','Aprobar Inventario',1,'2026-01-05 15:56:23','2026-01-05 15:56:23');
/*!40000 ALTER TABLE `permisos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `planes`
--

DROP TABLE IF EXISTS `planes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `planes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
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
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`),
  KEY `idx_activo` (`activo`),
  KEY `idx_destacado` (`destacado`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Planes de suscripci??n del sistema SaaS';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `planes`
--

LOCK TABLES `planes` WRITE;
/*!40000 ALTER TABLE `planes` DISABLE KEYS */;
INSERT INTO `planes` VALUES (1,'B??sico','Plan ideal para peque??os negocios que est??n comenzando',29.00,290.00,1,5,500,100,'[\"pos\", \"inventario\", \"ventas\", \"clientes\"]','email',0,0,0,0,1,0,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(2,'Profesional','Plan completo para empresas en crecimiento',79.00,790.00,5,20,NULL,NULL,'[\"pos\", \"inventario\", \"ventas\", \"clientes\", \"compras\", \"proveedores\", \"caja\", \"contabilidad\", \"reportes\"]','prioritario',1,0,1,1,1,1,'2026-01-05 15:56:23','2026-01-05 15:56:23'),(3,'Enterprise','Soluci??n empresarial sin l??mites',199.00,1990.00,NULL,NULL,NULL,NULL,'[\"pos\", \"inventario\", \"ventas\", \"clientes\", \"compras\", \"proveedores\", \"caja\", \"bancos\", \"contabilidad\", \"reportes\", \"usuarios\", \"roles\"]','24/7',1,1,1,1,1,0,'2026-01-05 15:56:23','2026-01-05 15:56:23');
/*!40000 ALTER TABLE `planes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productos`
--

DROP TABLE IF EXISTS `productos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `productos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL COMMENT 'ID de la empresa propietaria',
  `nombre` varchar(200) NOT NULL COMMENT 'Nombre del producto',
  `descripcion` text DEFAULT NULL COMMENT 'Descripci├│n detallada del producto',
  `sku` varchar(100) NOT NULL COMMENT 'C├│digo SKU ├║nico por empresa',
  `codigo_barras` varchar(100) DEFAULT NULL COMMENT 'C├│digo de barras del producto',
  `categoria_id` int(11) DEFAULT NULL COMMENT 'ID de la categor├¡a',
  `precio_compra` decimal(15,2) DEFAULT 0.00 COMMENT 'Precio de compra',
  `precio_venta` decimal(15,2) NOT NULL COMMENT 'Precio de venta al p├║blico',
  `stock_actual` int(11) DEFAULT 0 COMMENT 'Stock disponible actual',
  `stock_minimo` int(11) DEFAULT 0 COMMENT 'Stock m├¡nimo de alerta',
  `stock_maximo` int(11) DEFAULT NULL COMMENT 'Stock m├íximo permitido',
  `unidad_medida` varchar(50) DEFAULT 'unidad' COMMENT 'Unidad de medida (unidad, kg, litro, etc.)',
  `ubicacion_almacen` varchar(100) DEFAULT NULL COMMENT 'Ubicaci├│n f├¡sica en almac├®n',
  `imagen_url` varchar(500) DEFAULT NULL COMMENT 'URL de la imagen del producto',
  `estado` enum('activo','inactivo') DEFAULT 'activo' COMMENT 'Estado del producto',
  `creado_por` int(11) DEFAULT NULL COMMENT 'ID del usuario que cre├│ el producto',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Fecha de creaci├│n',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Fecha de ├║ltima actualizaci├│n',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_empresa_sku` (`empresa_id`,`sku`),
  KEY `creado_por` (`creado_por`),
  KEY `idx_empresa_id` (`empresa_id`),
  KEY `idx_categoria_id` (`categoria_id`),
  KEY `idx_estado` (`estado`),
  KEY `idx_stock` (`stock_actual`),
  KEY `idx_codigo_barras` (`codigo_barras`),
  KEY `idx_nombre` (`nombre`),
  CONSTRAINT `productos_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `productos_ibfk_2` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`) ON DELETE SET NULL,
  CONSTRAINT `productos_ibfk_3` FOREIGN KEY (`creado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productos`
--

LOCK TABLES `productos` WRITE;
/*!40000 ALTER TABLE `productos` DISABLE KEYS */;
INSERT INTO `productos` VALUES (1,1,'camisa','camisa t11','1112',NULL,2,5.00,10.00,5,2,15,'unidad',NULL,NULL,'activo',1,'2026-01-06 15:16:49','2026-01-06 15:16:49');
/*!40000 ALTER TABLE `productos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rol_permiso`
--

DROP TABLE IF EXISTS `rol_permiso`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rol_permiso` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rol_id` int(11) NOT NULL,
  `permiso_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rol_permiso` (`rol_id`,`permiso_id`),
  KEY `idx_rol` (`rol_id`),
  KEY `idx_permiso` (`permiso_id`),
  CONSTRAINT `rol_permiso_ibfk_1` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rol_permiso_ibfk_2` FOREIGN KEY (`permiso_id`) REFERENCES `permisos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Permisos asignados a roles';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rol_permiso`
--

LOCK TABLES `rol_permiso` WRITE;
/*!40000 ALTER TABLE `rol_permiso` DISABLE KEYS */;
/*!40000 ALTER TABLE `rol_permiso` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) DEFAULT NULL COMMENT 'NULL = rol global (ej: SuperAdmin)',
  `nombre` varchar(100) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `slug` varchar(100) NOT NULL COMMENT 'admin, cajero, bodeguero, etc.',
  `tipo` enum('sistema','personalizado') DEFAULT 'personalizado',
  `es_admin` tinyint(1) DEFAULT 0 COMMENT 'Admin total de la empresa',
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_empresa_nombre` (`empresa_id`,`nombre`),
  KEY `idx_empresa` (`empresa_id`),
  KEY `idx_slug` (`slug`),
  KEY `idx_activo` (`activo`),
  CONSTRAINT `roles_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Roles de usuarios';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,NULL,'Super Administrador','Acceso total al sistema','super_admin','sistema',1,1,'2026-01-05 15:56:23','2026-01-05 15:56:23',NULL),(2,1,'Administrador Empresa','Administrador total de la empresa','admin_empresa','sistema',1,1,'2026-01-05 15:56:23','2026-01-05 15:56:23',NULL),(3,1,'Gerente','Gerente con acceso a reportes','gerente','personalizado',0,1,'2026-01-05 15:56:23','2026-01-05 15:56:23',NULL),(4,1,'Cajero','Usuario de punto de venta','cajero','personalizado',0,1,'2026-01-05 15:56:23','2026-01-05 15:56:23',NULL),(5,1,'Bodeguero','Control de inventario','bodeguero','personalizado',0,1,'2026-01-05 15:56:23','2026-01-05 15:56:23',NULL),(6,4,'Administrador','Administrador de la empresa','admin','sistema',1,1,'2026-01-05 16:16:36','2026-01-05 16:16:36',NULL);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuario_empresa`
--

DROP TABLE IF EXISTS `usuario_empresa`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `usuario_empresa` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `empresa_id` int(11) NOT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_usuario_empresa` (`usuario_id`,`empresa_id`),
  KEY `idx_usuario` (`usuario_id`),
  KEY `idx_empresa` (`empresa_id`),
  KEY `idx_activo` (`activo`),
  CONSTRAINT `usuario_empresa_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `usuario_empresa_ibfk_2` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Usuarios que pertenecen a empresas';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuario_empresa`
--

LOCK TABLES `usuario_empresa` WRITE;
/*!40000 ALTER TABLE `usuario_empresa` DISABLE KEYS */;
INSERT INTO `usuario_empresa` VALUES (1,2,1,1,'2026-01-05 15:56:23',NULL),(2,3,1,1,'2026-01-05 15:56:23',NULL),(3,4,2,1,'2026-01-05 15:56:23',NULL),(4,5,1,1,'2026-01-05 15:56:23',NULL),(5,6,4,1,'2026-01-05 16:16:36',NULL);
/*!40000 ALTER TABLE `usuario_empresa` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuario_rol`
--

DROP TABLE IF EXISTS `usuario_rol`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `usuario_rol` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` int(11) NOT NULL,
  `rol_id` int(11) NOT NULL,
  `empresa_id` int(11) NOT NULL COMMENT 'Rol del usuario en esta empresa',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_usuario_rol_empresa` (`usuario_id`,`rol_id`,`empresa_id`),
  KEY `idx_usuario` (`usuario_id`),
  KEY `idx_rol` (`rol_id`),
  KEY `idx_empresa` (`empresa_id`),
  KEY `idx_usuario_empresa` (`usuario_id`,`empresa_id`),
  CONSTRAINT `usuario_rol_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `usuario_rol_ibfk_2` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `usuario_rol_ibfk_3` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Roles de usuarios por empresa';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuario_rol`
--

LOCK TABLES `usuario_rol` WRITE;
/*!40000 ALTER TABLE `usuario_rol` DISABLE KEYS */;
INSERT INTO `usuario_rol` VALUES (1,1,1,1,'2026-01-05 15:56:23',NULL),(2,2,2,1,'2026-01-05 15:56:23',NULL),(3,3,4,1,'2026-01-05 15:56:23',NULL),(4,4,2,2,'2026-01-05 15:56:23',NULL),(5,5,3,1,'2026-01-05 15:56:23',NULL),(6,6,6,4,'2026-01-05 16:16:36',NULL);
/*!40000 ALTER TABLE `usuario_rol` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
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
  `created_by` int(11) DEFAULT NULL COMMENT 'Usuario que lo cre??',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`),
  KEY `idx_tipo` (`tipo_usuario`),
  KEY `idx_activo` (`activo`),
  KEY `idx_empresa_default` (`empresa_id_default`),
  FULLTEXT KEY `ft_busqueda` (`nombre`,`apellido`,`email`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`empresa_id_default`) REFERENCES `empresas` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Usuarios del sistema';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (1,'Super','Admin','admin@kore.com',NULL,'$2a$10$S01LoSwWiRGAMx79Bcl30ebU/sauGbD9aQjgLW4gBf7MU4b48UM/u',NULL,'super_admin',NULL,'es','America/Bogota','light','2026-02-03 16:16:38','::1',0,NULL,1,NULL,NULL,NULL,NULL,1,'2026-01-05 15:56:23','2026-02-03 16:16:38',NULL),(2,'Juan','Perez','juan@abccomercial.com',NULL,'$2a$10$S01LoSwWiRGAMx79Bcl30ebU/sauGbD9aQjgLW4gBf7MU4b48UM/u',NULL,'admin_empresa',1,'es','America/Bogota','light','2026-01-05 16:57:33','::1',0,NULL,1,NULL,NULL,NULL,NULL,1,'2026-01-05 15:56:23','2026-01-05 16:57:33',NULL),(3,'Mar??a','Gonz??lez','maria@abccomercial.com',NULL,'$2a$10$S01LoSwWiRGAMx79Bcl30ebU/sauGbD9aQjgLW4gBf7MU4b48UM/u',NULL,'usuario',1,'es','America/Bogota','light',NULL,NULL,0,NULL,1,NULL,NULL,NULL,NULL,1,'2026-01-05 15:56:23','2026-01-05 16:15:11',NULL),(4,'Carlos','Rodr??guez','carlos@xyzdistribuidora.com',NULL,'$2a$10$S01LoSwWiRGAMx79Bcl30ebU/sauGbD9aQjgLW4gBf7MU4b48UM/u',NULL,'admin_empresa',2,'es','America/Bogota','light',NULL,NULL,0,NULL,1,NULL,NULL,NULL,NULL,1,'2026-01-05 15:56:23','2026-01-05 16:15:11',NULL),(5,'Demo','User','demo@kore.com',NULL,'$2a$10$S01LoSwWiRGAMx79Bcl30ebU/sauGbD9aQjgLW4gBf7MU4b48UM/u',NULL,'usuario',1,'es','America/Bogota','light',NULL,NULL,0,NULL,1,NULL,NULL,NULL,NULL,1,'2026-01-05 15:56:23','2026-01-05 16:15:11',NULL),(6,'Carlos','Rodriguez','test@nuevaempresa.com',NULL,'$2a$10$ey6e/wjioRlL9Xi/nsoSveOH8fGnxtQdpJ/eBLSA1IdJTBlUp30JW',NULL,'admin_empresa',4,'es','America/Bogota','light',NULL,NULL,0,NULL,0,NULL,NULL,NULL,NULL,1,'2026-01-05 16:16:36','2026-01-05 16:16:36',NULL);
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `venta_detalle`
--

DROP TABLE IF EXISTS `venta_detalle`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `venta_detalle` (
  `id` int(11) NOT NULL COMMENT 'ID ├║nico del detalle',
  `venta_id` int(11) NOT NULL COMMENT 'ID de la venta principal',
  `producto_id` int(11) NOT NULL COMMENT 'ID del producto vendido',
  `cantidad` int(11) NOT NULL COMMENT 'Cantidad vendida',
  `precio_unitario` decimal(15,2) NOT NULL COMMENT 'Precio unitario al momento de la venta',
  `descuento` decimal(15,2) DEFAULT 0.00 COMMENT 'Descuento aplicado al producto',
  `subtotal` decimal(15,2) NOT NULL COMMENT 'Subtotal (cantidad * precio - descuento)',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Fecha de creaci├│n',
  PRIMARY KEY (`id`),
  KEY `idx_venta_id` (`venta_id`),
  KEY `idx_producto_id` (`producto_id`),
  CONSTRAINT `venta_detalle_ibfk_1` FOREIGN KEY (`venta_id`) REFERENCES `ventas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `venta_detalle_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `venta_detalle`
--

LOCK TABLES `venta_detalle` WRITE;
/*!40000 ALTER TABLE `venta_detalle` DISABLE KEYS */;
/*!40000 ALTER TABLE `venta_detalle` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ventas`
--

DROP TABLE IF EXISTS `ventas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ventas` (
  `id` int(11) NOT NULL COMMENT 'ID ├║nico de la venta',
  `empresa_id` int(11) NOT NULL COMMENT 'ID de la empresa propietaria',
  `numero_factura` varchar(50) NOT NULL COMMENT 'N├║mero de factura ├║nico',
  `cliente_id` int(11) NOT NULL COMMENT 'ID del cliente',
  `fecha_venta` datetime NOT NULL COMMENT 'Fecha y hora de la venta',
  `subtotal` decimal(15,2) NOT NULL COMMENT 'Subtotal antes de descuentos e impuestos',
  `descuento` decimal(15,2) DEFAULT 0.00 COMMENT 'Descuento aplicado',
  `impuesto` decimal(15,2) DEFAULT 0.00 COMMENT 'Impuestos (IVA, etc.)',
  `total` decimal(15,2) NOT NULL COMMENT 'Total final de la venta',
  `estado` enum('pendiente','pagada','cancelada','anulada') DEFAULT 'pendiente' COMMENT 'Estado de la venta',
  `metodo_pago` enum('efectivo','tarjeta','transferencia','credito') DEFAULT 'efectivo' COMMENT 'M├®todo de pago utilizado',
  `notas` text DEFAULT NULL COMMENT 'Notas adicionales de la venta',
  `vendedor_id` int(11) DEFAULT NULL COMMENT 'ID del usuario vendedor',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'Fecha de creaci├│n',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'Fecha de ├║ltima actualizaci├│n',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_empresa_factura` (`empresa_id`,`numero_factura`),
  KEY `vendedor_id` (`vendedor_id`),
  KEY `idx_empresa_id` (`empresa_id`),
  KEY `idx_cliente_id` (`cliente_id`),
  KEY `idx_estado` (`estado`),
  KEY `idx_fecha` (`fecha_venta`),
  CONSTRAINT `ventas_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ventas_ibfk_2` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `ventas_ibfk_3` FOREIGN KEY (`vendedor_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ventas`
--

LOCK TABLES `ventas` WRITE;
/*!40000 ALTER TABLE `ventas` DISABLE KEYS */;
/*!40000 ALTER TABLE `ventas` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-03 11:37:36
