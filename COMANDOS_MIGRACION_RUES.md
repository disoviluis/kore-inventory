# ============================================
# COMANDOS RÁPIDOS - Migración RUES Empresas
# ============================================

# ============================================
# OPCIÓN 1: Ejecutar script automatizado
# ============================================

# 1. Conectarse al servidor
ssh -i korekey.pem ubuntu@18.191.181.99

# 2. Ir al directorio del proyecto
cd /home/ubuntu/kore-inventory

# 3. Dar permisos de ejecución al script
chmod +x scripts/deploy_rues_empresas.sh

# 4. Ejecutar el script (hace todo automáticamente)
./scripts/deploy_rues_empresas.sh


# ============================================
# OPCIÓN 2: Ejecutar migración manualmente (paso a paso)
# ============================================

# 1. Conectarse al servidor
ssh -i korekey.pem ubuntu@18.191.181.99

# 2. Ir al directorio
cd /home/ubuntu/kore-inventory

# 3. Ejecutar SOLO la migración SQL
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com \
      -u admin \
      -pKore2026! \
      kore_inventory < SQL/migration_add_campos_rues_empresas.sql

# 4. Verificar que funcionó
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com \
      -u admin \
      -pKore2026! \
      kore_inventory \
      -e "DESCRIBE empresas; SELECT id, nombre, tipo_documento, nit, digito_verificacion FROM empresas LIMIT 3;"

# 5. Recompilar backend
cd backend && npm run build && pm2 restart kore-backend && pm2 logs kore-backend --lines 30


# ============================================
# OPCIÓN 3: Una sola línea (más rápida)
# ============================================

ssh -i korekey.pem ubuntu@18.191.181.99 "cd /home/ubuntu/kore-inventory && mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com -u admin -pKore2026! kore_inventory < SQL/migration_add_campos_rues_empresas.sql && cd backend && npm run build && pm2 restart kore-backend"


# ============================================
# VERIFICACIÓN POST-DEPLOY
# ============================================

# Conectarse a MySQL para verificar
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com -u admin -pKore2026! kore_inventory

# Dentro de MySQL, ejecutar:
DESCRIBE empresas;

SELECT 
    id,
    nombre,
    tipo_documento,
    nit,
    digito_verificacion,
    CONCAT(nit, '-', digito_verificacion) AS nit_completo,
    representante_legal,
    tipo_sociedad
FROM empresas
LIMIT 5;

SHOW INDEX FROM empresas WHERE Key_name IN ('idx_nit_dv', 'idx_tipo_sociedad');

EXIT;


# ============================================
# ROLLBACK (solo en emergencia)
# ============================================

mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com -u admin -pKore2026! kore_inventory <<EOF
ALTER TABLE empresas DROP COLUMN tipo_documento;
ALTER TABLE empresas DROP COLUMN digito_verificacion;
ALTER TABLE empresas DROP COLUMN representante_legal;
ALTER TABLE empresas DROP COLUMN tipo_sociedad;
ALTER TABLE empresas DROP COLUMN matricula_mercantil;
ALTER TABLE empresas DROP COLUMN camara_comercio;
ALTER TABLE empresas DROP COLUMN fecha_matricula;
ALTER TABLE empresas DROP COLUMN actividad_economica;
DROP INDEX idx_nit_dv ON empresas;
DROP INDEX idx_tipo_sociedad ON empresas;
EOF


# ============================================
# TESTING FRONTEND
# ============================================

# 1. Abrir navegador en:
http://18.191.181.99/dashboard.html

# 2. Login como super admin:
Email: admin@kore.com
Password: [tu contraseña]

# 3. Ir a: PLATAFORMA → Empresas → Nueva Empresa

# 4. Probar:
- Tipo Documento: NIT
- Número: 900777888
- Verificar que DV se calcula automáticamente
- Click "Consultar RUES" (simulado)
- Verificar que campos se autocompletan
- Guardar

# 5. Editar una empresa existente:
- Verificar que NIT y DV se muestran por separado
- Modificar y guardar


# ============================================
# MONITOREO POST-DEPLOY
# ============================================

# Ver logs del backend en tiempo real
pm2 logs kore-backend

# Ver estado de PM2
pm2 status

# Reiniciar backend si es necesario
pm2 restart kore-backend

# Ver últimos 50 logs
pm2 logs kore-backend --lines 50


# ============================================
# QUERYS ÚTILES PARA VERIFICACIÓN
# ============================================

# Contar empresas con datos RUES
SELECT 
    COUNT(*) AS total,
    SUM(CASE WHEN representante_legal IS NOT NULL THEN 1 ELSE 0 END) AS con_representante,
    SUM(CASE WHEN tipo_sociedad IS NOT NULL THEN 1 ELSE 0 END) AS con_tipo_sociedad,
    SUM(CASE WHEN matricula_mercantil IS NOT NULL THEN 1 ELSE 0 END) AS con_matricula
FROM empresas;

# Ver distribución por tipo de documento
SELECT tipo_documento, COUNT(*) AS cantidad
FROM empresas
GROUP BY tipo_documento;

# Ver empresas con NIT completo
SELECT 
    nombre,
    CONCAT(nit, '-', digito_verificacion) AS nit_completo,
    tipo_sociedad,
    ciudad
FROM empresas
WHERE nit IS NOT NULL
ORDER BY id DESC
LIMIT 10;


# ============================================
# COMANDOS DE BACKUP (antes de ejecutar)
# ============================================

# Backup completo de la tabla empresas
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com \
      -u admin \
      -pKore2026! \
      kore_inventory \
      -e "CREATE TABLE empresas_backup_manual LIKE empresas; INSERT INTO empresas_backup_manual SELECT * FROM empresas;"

# Verificar backup
mysql -h kore-db.cp0s2wsom3o2.us-east-2.rds.amazonaws.com \
      -u admin \
      -pKore2026! \
      kore_inventory \
      -e "SELECT COUNT(*) FROM empresas_backup_manual;"
