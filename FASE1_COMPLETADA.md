# ✅ FASE 1 COMPLETADA: Migración de Base de Datos + Backend

**Fecha:** 2026-02-12

## 📋 Cambios Implementados

### 1. Script de Migración SQL
**Archivo:** `SQL/migration_mejoras_productos_ventas.sql`

**Nuevos campos en `productos`:**
- ✅ `iva_incluido_en_precio` (BOOLEAN) - Indica si el precio ya incluye el IVA
- ✅ `permite_venta_sin_stock` (BOOLEAN) - Permite ventas aunque no haya stock

**Nuevos campos en `venta_detalle`:**
- ✅ `tipo_venta` (ENUM: 'normal', 'contra_pedido')
- ✅ `estado_entrega` (ENUM: 'entregado', 'pendiente', 'en_transito')
- ✅ `fecha_entrega_estimada` (DATE)
- ✅ `notas_entrega` (TEXT)

**Índices creados:**
- ✅ `idx_permite_venta_sin_stock` - Para búsquedas rápidas
- ✅ `idx_venta_detalle_estado_entrega` - Para órdenes pendientes

### 2. Backend Actualizado
**Archivo:** `backend/src/platform/productos/productos.controller.ts`

**Cambios realizados:**

#### ✅ **Eliminadas validaciones de jerarquía de precios**
```typescript
// ANTES: Validaba que mayorista < minorista < distribuidor
// AHORA: Libertad total para el administrador
```

#### ✅ **Agregados nuevos campos en SELECT**
```typescript
- iva_incluido_en_precio
- permite_venta_sin_stock
```

#### ✅ **Agregados nuevos campos en INSERT**
```typescript
INSERT INTO productos (..., iva_incluido_en_precio, ..., permite_venta_sin_stock, ...)
```

#### ✅ **Agregados nuevos campos en UPDATE**
```typescript
if (req.body.iva_incluido_en_precio !== undefined) {
  updates.push('iva_incluido_en_precio = ?');
}
if (req.body.permite_venta_sin_stock !== undefined) {
  updates.push('permite_venta_sin_stock = ?');
}
```

## 🚀 Instrucciones de Despliegue

### En tu máquina local:
```bash
# 1. Commit de los cambios
git add .
git commit -m "feat: Fase 1 - Migración BD y backend para IVA y ventas sin stock"
git push origin main
```

### En el servidor EC2:
```bash
# 1. Conectarse por SSH
ssh -i korekey.pem ubuntu@18.191.181.99

# 2. Ir al directorio del proyecto
cd ~/kore-inventory

# 3. Hacer pull de los cambios
git pull origin main

# 4. Ejecutar la migración SQL
mysql -u tu_usuario -p kore_inventory < SQL/migration_mejoras_productos_ventas.sql

# 5. Reiniciar el backend
cd backend
pm2 restart all

# 6. Ver logs
pm2 logs --lines 20
```

## 📝 Notas Importantes

1. **Backup automático:** El script SQL hace backup antes de ejecutar cambios
2. **Servicios sin stock:** Los productos tipo 'servicio' automáticamente tendrán `permite_venta_sin_stock = TRUE`
3. **Compatibilidad:** Los productos existentes funcionarán sin problemas (valores por defecto)

## ⚠️ Validaciones Eliminadas

Se eliminaron las siguientes restricciones para dar libertad al administrador:

```typescript
// ❌ ELIMINADO: precio_mayorista debe ser <= precio_minorista
// ❌ ELIMINADO: precio_distribuidor debe ser <= precio_mayorista
```

**Razón:** El administrador debe tener total libertad para establecer precios según su estrategia comercial.

## ✅ Próximos Pasos

**FASE 2:** Actualizar frontend de productos
- Agregar campos de IVA incluido
- Agregar checkbox "Permitir venta sin stock"
- Agregar calculadora de IVA en tiempo real
- Actualizar formulario de productos

**FASE 3:** Actualizar módulo de ventas
- Detectar stock insuficiente
- Preguntar si vender "contra pedido"
- Manejar estados de entrega
- Notificaciones de entregas pendientes
