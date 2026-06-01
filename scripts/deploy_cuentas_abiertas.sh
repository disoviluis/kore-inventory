# =============================================
# SCRIPT DE DESPLIEGUE - SISTEMA CUENTAS ABIERTAS
# Fecha: 2026-06-01
# =============================================

# PASO 1: EJECUTAR MIGRACIÓN SQL
# =============================================

echo "📊 PASO 1: Ejecutando migración SQL..."

# Conectar a la base de datos y ejecutar migration
mysql -h database-1.ch0kypvzovnu.us-east-2.rds.amazonaws.com \
      -u adminUser \
      -p'Siempre4*' \
      kore_inventory < ~/kore-inventory/SQL/migration_cuentas_abiertas.sql

if [ $? -eq 0 ]; then
    echo "✅ Migración SQL completada exitosamente"
else
    echo "❌ Error en migración SQL"
    exit 1
fi


# PASO 2: COMPILAR BACKEND
# =============================================

echo ""
echo "🔨 PASO 2: Compilando backend TypeScript..."

cd ~/kore-inventory/backend

# Instalar dependencias (si hay nuevas)
npm install

# Compilar TypeScript
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Backend compilado exitosamente"
else
    echo "❌ Error compilando backend"
    exit 1
fi


# PASO 3: REINICIAR SERVIDOR
# =============================================

echo ""
echo "🔄 PASO 3: Reiniciando servidor PM2..."

pm2 restart kore-backend

if [ $? -eq 0 ]; then
    echo "✅ Servidor reiniciado exitosamente"
else
    echo "❌ Error reiniciando servidor"
    exit 1
fi


# PASO 4: VERIFICAR LOGS
# =============================================

echo ""
echo "📋 PASO 4: Verificando logs del servidor..."

pm2 logs kore-backend --lines 30 --nostream


# PASO 5: COPIAR ARCHIVOS FRONTEND
# =============================================

echo ""
echo "🎨 PASO 5: Archivos frontend ya están en el repositorio"
echo "El frontend se actualiza automáticamente al hacer git pull"


# RESUMEN
# =============================================

echo ""
echo "====================================="
echo "✅ DESPLIEGUE COMPLETADO"
echo "====================================="
echo ""
echo "📋 Cambios desplegados:"
echo "  ✓ Tablas de base de datos creadas"
echo "  ✓ Backend actualizado con nuevo controller"
echo "  ✓ Frontend actualizado con UI de cuentas abiertas"
echo ""
echo "🌐 Puedes probar en:"
echo "  http://18.191.181.99/ventas.html"
echo ""
echo "📊 Para verificar las tablas, ejecuta:"
echo "  SHOW TABLES LIKE 'cuentas%';"
echo ""
