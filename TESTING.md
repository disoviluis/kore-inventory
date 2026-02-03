# 🧪 PRUEBAS DE LOGIN - KORE INVENTORY

## 🚀 Iniciar el Backend

1. **Abrir terminal en la carpeta backend:**
   ```bash
   cd C:\xampp\htdocs\kore-inventory\backend
   ```

2. **Iniciar servidor de desarrollo:**
   ```bash
   npm run dev
   ```

3. **Verificar que esté corriendo:**
   - Deberías ver el banner de KORE INVENTORY
   - API disponible en: `http://localhost:3000/api`

---

## 🌐 Abrir el Frontend

1. **Iniciar XAMPP:**
   - Asegúrate que Apache esté corriendo
   - MySQL debe estar activo

2. **Abrir en el navegador:**
   ```
   http://localhost/kore-inventory/frontend/public/login.html
   ```
   
   O usando la IP local:
   ```
   http://127.0.0.1/kore-inventory/frontend/public/login.html
   ```

---

## 🔑 Credenciales de Prueba

**Todos los usuarios tienen password:** `admin123`

### Super Administrador
```
Email: admin@kore.com
Password: admin123
Rol: Super Admin
Empresa: - (Acceso a todas)
```

### Administrador de Empresa
```
Email: juan@abccomercial.com
Password: admin123
Rol: Admin Empresa
Empresa: ABC Comercial
```

### Usuario Demo/Gerente
```
Email: demo@kore.com
Password: admin123
Rol: Gerente
Empresa: ABC Comercial
```

### Otros Usuarios Disponibles

| Email | Password | Tipo | Empresa |
|-------|----------|------|---------|
| maria@abccomercial.com | admin123 | Usuario | ABC Comercial |
| carlos@xyzdistribuidora.com | admin123 | Admin Empresa | XYZ Distribuidora |

---

## 🧪 Probar el Login

### Método 1: Desde el navegador

1. Abre `http://localhost/kore-inventory/frontend/public/login.html`
2. Ingresa las credenciales
3. Click en "Iniciar Sesión"
4. Si es exitoso, serás redirigido al dashboard

### Método 2: Desde Postman/Thunder Client

```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "admin@kore.com",
  "password": "admin123"
}
```

**Respuesta esperada (éxito):**
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

---

## 🐛 Solución de Problemas

### Error: "No se pudo conectar con el servidor"
- ✅ Verifica que el backend esté corriendo (`npm run dev`)
- ✅ Verifica que esté en `http://localhost:3000`
- ✅ Abre la consola del navegador (F12) para ver errores

### Error: "Credenciales inválidas"
- ✅ Verifica el email en la base de datos
- ✅ Crea un usuario de prueba con password conocido
- ✅ Verifica que el usuario esté activo (`activo = 1`)

### Error CORS
Si ves error de CORS en la consola:
- ✅ Verifica que el backend tenga configurado CORS correctamente
- ✅ El archivo `.env` debe tener: `CORS_ORIGIN=http://localhost:8080,http://127.0.0.1:8080`
- ✅ Agrega el puerto de XAMPP si es diferente

### La página no carga
- ✅ Verifica que Apache (XAMPP) esté corriendo
- ✅ Verifica la ruta correcta del archivo
- ✅ Abre la consola del navegador para ver errores

---

## 📋 Checklist de Funcionamiento

- [ ] Backend corriendo sin errores
- [ ] Conexión a base de datos exitosa
- [ ] XAMPP Apache corriendo
- [ ] MySQL corriendo
- [ ] Usuario de prueba creado
- [ ] Login page cargando correctamente
- [ ] Formulario de login visible
- [ ] Puede escribir en los campos
- [ ] Botón de login funcional
- [ ] Al hacer login exitoso, redirige al dashboard
- [ ] Token guardado en localStorage
- [ ] Datos de usuario guardados en localStorage

---

## 🔍 Verificar en el Navegador

1. **Abrir DevTools (F12)**
2. **Ir a la pestaña Console** - Ver logs de JavaScript
3. **Ir a la pestaña Network** - Ver las peticiones HTTP
4. **Ir a Application > Local Storage** - Ver el token guardado

---

## 📝 Notas

- El token JWT expira en 24 horas (configurable en `.env`)
- Después de 5 intentos fallidos, la cuenta se bloquea por 15 minutos
- El dashboard básico solo muestra datos del usuario por ahora
- Los módulos completos se implementarán gradualmente

---

## 🎯 Próximos Pasos

Una vez que el login funcione:
1. ✅ Completar diseño del dashboard
2. ✅ Implementar módulo de empresas
3. ✅ Implementar sistema de permisos
4. ✅ Implementar módulo de productos
5. ✅ Implementar inventario
6. ✅ Implementar POS

---

**Desarrollado por:** Disovi Soft © 2026
