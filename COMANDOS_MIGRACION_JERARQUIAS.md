# 🔄 COMANDOS PARA MIGRACIÓN DE JERARQUÍAS

**Fecha:** 2026-03-12  
**Migración:** Sistema de Jerarquías de Roles  
**Archivo:** `SQL/migration_roles_jerarquia.sql`

---

## 📋 RESUMEN

Esta migración agrega:
- ✅ Campo `nivel` a tabla `roles` (10-100)
- ✅ Campo `nivel_privilegio` a tabla `usuarios`
- ✅ 3 triggers automáticos para sincronización
- ✅ Actualización de roles existentes con sus niveles

---

## 🧪 PASO 1: PROBAR EN LOCAL (XAMPP)

### Windows PowerShell

```powershell
# Navegar al proyecto
cd C:\xampp\htdocs\kore-inventory

# 1. Backup local
C:\xampp\mysql\bin\mysqldump.exe -u root kore_inventory > "backup_local_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# 2. Ejecutar migración
C:\xampp\mysql\bin\mysql.exe -u root kore_inventory < SQL\migration_roles_jerarquia.sql

# 3. Verificar campo 'nivel' en roles
C:\xampp\mysql\bin\mysql.exe -u root kore_inventory -e "DESC roles;"

# 4. Verificar campo 'nivel_privilegio' en usuarios
C:\xampp\mysql\bin\mysql.exe -u root kore_inventory -e "DESC usuarios;"

# 5. Ver roles con niveles asignados
C:\xampp\mysql\bin\mysql.exe -u root kore_inventory -e "SELECT id, nombre, slug, nivel, tipo FROM roles ORDER BY nivel DESC;"

# 6. Ver usuarios con niveles
C:\xampp\mysql\bin\mysql.exe -u root kore_inventory -e "SELECT id, nombre, email, tipo_usuario, nivel_privilegio FROM usuarios ORDER BY nivel_privilegio DESC;"

# 7. Verificar triggers
C:\xampp\mysql\bin\mysql.exe -u root kore_inventory -e "SHOW TRIGGERS WHERE \`Table\` IN ('usuario_rol', 'roles');"
```

### Verificación Esperada

**Roles con niveles:**
```
+----+-----------------------+---------------+-------+---------------+
| id | nombre                | slug          | nivel | tipo          |
+----+-----------------------+---------------+-------+---------------+
|  1 | Super Administrador   | super_admin   |   100 | sistema       |
|  2 | Administrador Empresa | admin_empresa |    80 | sistema       |
|  6 | Administrador         | admin         |    80 | sistema       |
|  3 | Gerente               | gerente       |    60 | personalizado |
|  4 | Cajero                | cajero        |    20 | personalizado |
|  5 | Bodeguero             | bodeguero     |    20 | personalizado |
+----+-----------------------+---------------+-------+---------------+
```

---

## 🚀 PASO 2: COMMIT Y PUSH A GITHUB

```powershell
# 1. Ver cambios
git status

# 2. Agregar archivos nuevos
git add SQL/migration_roles_jerarquia.sql
git add ANALISIS_ARQUITECTURA_GESTION_ROLES.md
git add COMANDOS_MIGRACION_JERARQUIAS.md

# 3. Commit
git commit -m "feat(db): agregar sistema de jerarquías a roles

- Agregar campo nivel (10-100) a tabla roles
- Agregar campo nivel_privilegio a tabla usuarios
- Crear triggers para sincronización automática
- Actualizar roles existentes con niveles apropiados
- Super Admin: 100, Admin Empresa: 80, Gerente: 60, Operativos: 20"

# 4. Push a GitHub
git push origin main
```

---

## 🌩️ PASO 3: EJECUTAR EN AWS RDS (PRODUCCIÓN)

### Conectar al Servidor EC2

```powershell
# Desde tu PC con PowerShell
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99
```

### En el Servidor EC2 (Ubuntu)

```bash
# 1. Ir al repositorio
cd /home/ubuntu/kore-inventory

# 2. Actualizar código desde GitHub
git pull origin main

# 3. Verificar que llegó la migración
ls -la SQL/migration_roles_jerarquia.sql
cat SQL/migration_roles_jerarquia.sql | head -20

# 4. Cargar variables de entorno (credenciales RDS)
cd backend
source .env

# Verificar conexión
echo "🔗 Conectando a RDS:"
echo "   Host: $DB_HOST"
echo "   User: $DB_USER"
echo "   DB: $DB_NAME"

# 5. ⚠️ HACER BACKUP DE RDS (MUY IMPORTANTE)
echo "📦 Creando backup de RDS..."
mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME > ~/backup_antes_jerarquia_$(date +%Y%m%d_%H%M%S).sql

# 6. Verificar que el backup se creó
ls -lh ~/backup_antes_jerarquia_*.sql
echo "✅ Backup creado exitosamente"

# 7. EJECUTAR MIGRACIÓN
echo "🚀 Ejecutando migración..."
cd /home/ubuntu/kore-inventory
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < SQL/migration_roles_jerarquia.sql

# 8. Verificar estructura actualizada
echo "🔍 Verificando campo 'nivel' en roles..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "DESC roles;" | grep nivel

echo "🔍 Verificando campo 'nivel_privilegio' en usuarios..."
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "DESC usuarios;" | grep nivel

# 9. Ver roles con niveles asignados
echo "📊 Roles con niveles:"
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SELECT id, nombre, slug, nivel, tipo, empresa_id FROM roles ORDER BY nivel DESC, nombre ASC;"

# 10. Ver usuarios con sus niveles
echo "👥 Usuarios con niveles de privilegio:"
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "
SELECT 
  u.id,
  u.nombre,
  u.email,
  u.tipo_usuario,
  u.nivel_privilegio,
  GROUP_CONCAT(r.nombre SEPARATOR ', ') as roles
FROM usuarios u
LEFT JOIN usuario_rol ur ON u.id = ur.usuario_id
LEFT JOIN roles r ON ur.rol_id = r.id
GROUP BY u.id
ORDER BY u.nivel_privilegio DESC;
"

# 11. Verificar triggers creados
echo "🔧 Triggers creados:"
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SHOW TRIGGERS WHERE \`Table\` IN ('usuario_rol', 'roles');"

# 12. Salir (si todo está bien)
exit
```

---

## 🧪 PASO 4: PROBAR TRIGGERS (OPCIONAL)

**En el servidor EC2:**

```bash
cd /home/ubuntu/kore-inventory/backend
source .env

# TEST 1: Crear usuario de prueba
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME << EOF
-- Crear usuario test
INSERT INTO usuarios (nombre, apellido, email, password, tipo_usuario, activo)
VALUES ('Test', 'Jerarquias', 'test.jerarquias@test.com', '\$2a\$10\$dummy', 'usuario', 1);

SET @test_user_id = LAST_INSERT_ID();

-- Mostrar usuario antes de asignar rol
SELECT id, nombre, email, nivel_privilegio FROM usuarios WHERE id = @test_user_id;
EOF

# TEST 2: Asignar rol de nivel 60 (Gerente)
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME << EOF
SET @test_user_id = (SELECT id FROM usuarios WHERE email = 'test.jerarquias@test.com');
SET @gerente_rol_id = (SELECT id FROM roles WHERE slug = 'gerente' LIMIT 1);
SET @empresa_id = (SELECT empresa_id FROM roles WHERE slug = 'gerente' LIMIT 1);

-- Asignar rol
INSERT INTO usuario_rol (usuario_id, rol_id, empresa_id)
VALUES (@test_user_id, @gerente_rol_id, @empresa_id);

-- Ver usuario después de asignar rol (debe tener nivel_privilegio = 60)
SELECT 
  u.id, 
  u.nombre, 
  u.email, 
  u.nivel_privilegio,
  '(Debe ser 60)' as esperado
FROM usuarios u 
WHERE u.id = @test_user_id;
EOF

# TEST 3: Limpiar datos de prueba
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME << EOF
DELETE FROM usuario_rol WHERE usuario_id = (SELECT id FROM usuarios WHERE email = 'test.jerarquias@test.com');
DELETE FROM usuarios WHERE email = 'test.jerarquias@test.com';
SELECT '✅ Usuario de prueba eliminado' as Resultado;
EOF
```

---

## 🔥 EN CASO DE ERROR - ROLLBACK

**Si algo sale mal durante la migración:**

```bash
# Conectar al servidor
ssh -i C:\Users\luis.rodriguez\Downloads\korekey.pem ubuntu@18.191.181.99

# Ir al home
cd ~

# Ver backups disponibles
ls -lh backup_antes_jerarquia_*.sql

# Restaurar el backup más reciente
cd /home/ubuntu/kore-inventory/backend
source .env

# RESTAURAR
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < ~/backup_antes_jerarquia_YYYYMMDD_HHMMSS.sql

# Verificar que se restauró
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "DESC roles;" | grep nivel
# Si no aparece "nivel", la restauración fue exitosa
```

---

## ✅ CHECKLIST COMPLETO

### Pre-Migración
- [ ] Migración probada en local (XAMPP) sin errores
- [ ] Código commiteado y pusheado a GitHub
- [ ] Verificado que git push fue exitoso

### Migración en Producción
- [ ] Conectado al servidor EC2 por SSH
- [ ] Git pull ejecutado (migración descargada)
- [ ] Variables de entorno cargadas (.env)
- [ ] Backup de RDS creado
- [ ] Backup verificado (archivo existe y tiene tamaño)

### Post-Migración
- [ ] Migración ejecutada sin errores
- [ ] Campo `nivel` existe en tabla `roles`
- [ ] Campo `nivel_privilegio` existe en tabla `usuarios`
- [ ] Roles tienen niveles correctos (Super Admin=100, etc.)
- [ ] Usuarios tienen nivel_privilegio poblado
- [ ] 3 triggers creados (`update_usuario_nivel_after_insert`, `update_usuario_nivel_after_delete`, `update_usuario_nivel_after_update_rol`)
- [ ] Tests de triggers funcionando correctamente

### Verificación Backend
- [ ] Backend reiniciado (`pm2 restart kore-backend`)
- [ ] Sin errores en logs (`pm2 logs kore-backend --lines 50`)
- [ ] API responde correctamente (`curl http://localhost:3000/api/roles`)

---

## 📞 SOPORTE

Si tienes problemas durante la migración:

1. **NO PÁNICO** - El backup está listo para restaurar
2. Copia el mensaje de error completo
3. Verifica los logs: `pm2 logs kore-backend`
4. Si es necesario, restaura el backup

---

**Última actualización:** 2026-03-12  
**Estado:** ✅ Listo para ejecutar
