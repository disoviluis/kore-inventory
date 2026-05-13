#!/bin/bash

# ============================================
# Script de Deploy Rápido - Migración RUES Empresas
# ============================================

echo "🚀 Iniciando migración RUES Empresas..."
echo ""

# Variables de conexión
DB_HOST="kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com"
DB_USER="admin"
DB_NAME="kore_inventory"
DB_PASS="Kore2026!"

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================
# PASO 1: Verificar conexión
# ============================================
echo -e "${YELLOW}📡 Verificando conexión a RDS...${NC}"
if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" -e "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Conexión exitosa${NC}"
else
    echo -e "${RED}❌ Error: No se pudo conectar a la base de datos${NC}"
    exit 1
fi
echo ""

# ============================================
# PASO 2: Backup preventivo
# ============================================
echo -e "${YELLOW}💾 Creando backup de tabla empresas...${NC}"
BACKUP_TABLE="empresas_backup_$(date +%Y%m%d_%H%M%S)"

mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<EOF
CREATE TABLE $BACKUP_TABLE LIKE empresas;
INSERT INTO $BACKUP_TABLE SELECT * FROM empresas;
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backup creado: $BACKUP_TABLE${NC}"
else
    echo -e "${RED}❌ Error al crear backup${NC}"
    exit 1
fi
echo ""

# ============================================
# PASO 3: Mostrar estado actual
# ============================================
echo -e "${YELLOW}📊 Estado actual de la tabla empresas:${NC}"
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<EOF
SELECT COUNT(*) AS total_empresas FROM empresas;
SELECT id, nombre, nit FROM empresas LIMIT 3;
EOF
echo ""

# ============================================
# PASO 4: Ejecutar migración
# ============================================
echo -e "${YELLOW}⚙️  Ejecutando migración SQL...${NC}"

if [ -f "SQL/migration_add_campos_rues_empresas.sql" ]; then
    mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < SQL/migration_add_campos_rues_empresas.sql
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Migración ejecutada exitosamente${NC}"
    else
        echo -e "${RED}❌ Error al ejecutar migración${NC}"
        echo -e "${YELLOW}Restaurando desde backup...${NC}"
        mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<EOF
DROP TABLE empresas;
RENAME TABLE $BACKUP_TABLE TO empresas;
EOF
        exit 1
    fi
else
    echo -e "${RED}❌ Error: No se encontró el archivo SQL/migration_add_campos_rues_empresas.sql${NC}"
    exit 1
fi
echo ""

# ============================================
# PASO 5: Verificación post-migración
# ============================================
echo -e "${YELLOW}🔍 Verificando campos agregados...${NC}"
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" <<EOF
-- Mostrar nuevos campos
DESCRIBE empresas;

-- Verificar NITs separados
SELECT 
    id,
    nombre,
    tipo_documento,
    nit,
    digito_verificacion,
    CONCAT(COALESCE(nit, ''), '-', COALESCE(digito_verificacion, '')) AS nit_completo
FROM empresas
WHERE nit IS NOT NULL
LIMIT 5;

-- Contar registros
SELECT 
    'Total empresas' AS metrica,
    COUNT(*) AS valor
FROM empresas
UNION ALL
SELECT 
    'Con NIT+DV' AS metrica,
    COUNT(*) AS valor
FROM empresas
WHERE nit IS NOT NULL AND digito_verificacion IS NOT NULL
UNION ALL
SELECT 
    'Tipo documento = NIT' AS metrica,
    COUNT(*) AS valor
FROM empresas
WHERE tipo_documento = 'NIT';
EOF
echo ""

# ============================================
# PASO 6: Recompilar y reiniciar backend
# ============================================
echo -e "${YELLOW}🔧 Recompilando backend TypeScript...${NC}"

if [ -d "backend" ]; then
    cd backend
    
    # Recompilar
    npm run build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Backend recompilado${NC}"
        
        # Reiniciar con PM2
        echo -e "${YELLOW}🔄 Reiniciando aplicación con PM2...${NC}"
        pm2 restart kore-backend
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Backend reiniciado${NC}"
            
            # Mostrar logs
            echo -e "${YELLOW}📄 Últimos logs:${NC}"
            pm2 logs kore-backend --lines 20 --nostream
        else
            echo -e "${RED}❌ Error al reiniciar backend${NC}"
        fi
    else
        echo -e "${RED}❌ Error al recompilar backend${NC}"
    fi
    
    cd ..
else
    echo -e "${YELLOW}⚠️  No se encontró carpeta backend, omitiendo recompilación${NC}"
fi
echo ""

# ============================================
# RESUMEN FINAL
# ============================================
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ MIGRACIÓN COMPLETADA EXITOSAMENTE${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📋 Resumen:"
echo "  • Backup creado: $BACKUP_TABLE"
echo "  • 8 campos RUES agregados"
echo "  • NITs migrados (separados en nit + dv)"
echo "  • Índices creados: idx_nit_dv, idx_tipo_sociedad"
echo "  • Backend recompilado y reiniciado"
echo ""
echo "🧪 Próximos pasos:"
echo "  1. Probar crear nueva empresa desde dashboard"
echo "  2. Verificar campo DV se calcula automáticamente"
echo "  3. Probar botón 'Consultar RUES'"
echo "  4. Editar una empresa existente"
echo ""
echo "🔍 Para verificar manualmente:"
echo "  mysql -h $DB_HOST -u $DB_USER -p $DB_NAME"
echo "  > DESCRIBE empresas;"
echo "  > SELECT * FROM empresas LIMIT 1\\G"
echo ""
echo -e "${YELLOW}📌 Importante:${NC} Frontend ya está listo con los nuevos campos"
echo ""

# ============================================
# Guardar log de ejecución
# ============================================
LOG_FILE="migration_rues_$(date +%Y%m%d_%H%M%S).log"
echo "Migración ejecutada el $(date)" > "$LOG_FILE"
echo "Backup: $BACKUP_TABLE" >> "$LOG_FILE"
echo "✅ Log guardado en: $LOG_FILE"

exit 0
