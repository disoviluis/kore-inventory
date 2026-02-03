# 🚀 KORE INVENTORY - BACKEND API

Sistema ERP SaaS Multiempresa - Backend desarrollado con Node.js + TypeScript + Express + MySQL

**Desarrollado por:** Disovi Soft © 2026

---

## 📋 Características

- ✅ API REST con TypeScript
- ✅ Autenticación JWT
- ✅ Multi-tenant (multiempresa)
- ✅ Sistema de roles y permisos granulares
- ✅ Seguridad con Helmet y CORS
- ✅ Validación de datos
- ✅ Manejo de errores centralizado
- ✅ Logging personalizado
- ✅ Conexión a MySQL con pool

---

## 🛠️ Tecnologías

- **Runtime:** Node.js
- **Lenguaje:** TypeScript
- **Framework:** Express.js
- **Base de datos:** MySQL (MariaDB)
- **Autenticación:** JWT (jsonwebtoken)
- **Encriptación:** bcryptjs
- **Validación:** express-validator
- **Seguridad:** helmet, cors

---

## 📦 Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Copia el archivo `.env.example` a `.env` y configura tus valores:

```bash
cp .env.example .env
```

Edita el archivo `.env` con tu configuración local.

### 3. Asegurarte que XAMPP esté corriendo

- Inicia Apache
- Inicia MySQL
- Verifica que la base de datos `kore_inventory` exista

---

## 🚀 Ejecución

### Modo desarrollo (con hot-reload)

```bash
npm run dev
```

### Compilar TypeScript

```bash
npm run build
```

### Modo producción

```bash
npm start
```

---

## 📍 Endpoints Disponibles

### Health Check
```
GET /health
```
Verifica que el servidor esté funcionando.

### Autenticación

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@kore.com",
  "password": "tu_password"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Inicio de sesión exitoso",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "usuario": {
      "id": 1,
      "nombre": "Super",
      "apellido": "Admin",
      "email": "admin@kore.com",
      "tipo_usuario": "super_admin"
    }
  }
}
```

#### Verificar Token
```
GET /api/auth/verify
Authorization: Bearer <token>
```

#### Logout
```
POST /api/auth/logout
Authorization: Bearer <token>
```

---

## 🔐 Seguridad

### Características implementadas:

- **JWT:** Tokens seguros con expiración
- **Bcrypt:** Encriptación de contraseñas con 10 rounds
- **Intentos fallidos:** Bloqueo automático después de 5 intentos
- **Tiempo de bloqueo:** 15 minutos
- **Helmet:** Protección de headers HTTP
- **CORS:** Control de orígenes permitidos
- **Rate limiting:** (pendiente de implementar)

---

## 📁 Estructura del Proyecto

```
backend/
├── src/
│   ├── core/                   # Módulos centrales
│   │   ├── auth/              # Autenticación
│   │   ├── usuarios/          # Gestión de usuarios
│   │   ├── roles/             # Roles
│   │   ├── permisos/          # Permisos
│   │   └── middleware/        # Middlewares
│   │
│   ├── platform/              # Módulos de plataforma
│   │   ├── empresas/          # Gestión de empresas
│   │   ├── planes/            # Planes de suscripción
│   │   └── licencias/         # Licencias
│   │
│   ├── tenant/                # Módulos por empresa
│   │   ├── productos/         # Productos
│   │   ├── inventario/        # Inventario
│   │   └── ventas/            # Ventas y POS
│   │
│   ├── shared/                # Utilidades compartidas
│   │   ├── database.ts        # Conexión MySQL
│   │   ├── logger.ts          # Sistema de logs
│   │   ├── helpers.ts         # Funciones auxiliares
│   │   └── constants.ts       # Constantes
│   │
│   ├── routes.ts              # Rutas principales
│   ├── app.ts                 # Configuración Express
│   └── server.ts              # Punto de entrada
│
├── .env                       # Variables de entorno
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🧪 Testing

```bash
# Ejecutar tests (cuando estén implementados)
npm test
```

---

## 🐛 Debugging

El backend incluye logs detallados en modo desarrollo:

- `[INFO]` - Información general
- `[SUCCESS]` - Operaciones exitosas
- `[WARNING]` - Advertencias
- `[ERROR]` - Errores
- `[DEBUG]` - Información de debug (solo en desarrollo)

---

## 📝 Usuarios de Prueba

Según la base de datos actual:

| Email | Password | Tipo |
|-------|----------|------|
| admin@kore.com | (ver BD) | super_admin |
| juan@abccomercial.com | (ver BD) | admin_empresa |

---

## 🔄 Próximos Pasos

- [ ] Implementar módulo de empresas
- [ ] Implementar sistema de roles y permisos
- [ ] Implementar módulo de productos
- [ ] Implementar módulo de inventario
- [ ] Implementar POS
- [ ] Rate limiting
- [ ] Tests unitarios
- [ ] Documentación con Swagger

---

## 👨‍💻 Desarrollado por

**Disovi Soft**
Sistema Kore Inventory - ERP SaaS Multiempresa

---

## 📄 Licencia

Propietario - Todos los derechos reservados © 2026
