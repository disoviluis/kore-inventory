@echo off
echo Desplegando fix de bodega al servidor...

ssh ubuntu@18.191.181.99 "cat > /tmp/fix-bodega.txt" << 'EOF'
    logger.info(`${categoriasDefault.length} categorías por defecto creadas para empresa ${empresaId}`);

    // Crear bodega principal por defecto
    await connection.query(`
      INSERT INTO bodegas (
        empresa_id, codigo, nombre, tipo, es_principal, permite_ventas, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [empresaId, 'BOD-PRINCIPAL', 'Bodega Principal', 'bodega', true, true, 'activa']);

    logger.info(`Bodega principal creada para empresa ${empresaId}`);
EOF

ssh ubuntu@18.191.181.99 "cd /home/ubuntu/kore-inventory/backend && sed -i '307,315d' src/platform/super-admin/empresas-admin.controller.ts && sed -i '306r /tmp/fix-bodega.txt' src/platform/super-admin/empresas-admin.controller.ts && npm run build && pm2 restart kore-backend"

echo Fix aplicado y backend reiniciado!
pause
