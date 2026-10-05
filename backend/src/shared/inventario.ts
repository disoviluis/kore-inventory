/**
 * Consumo de inventario compartido entre ventas y cuentas abiertas.
 * Un producto con insumos definidos consume su composición; el resto descuenta su propio stock.
 */

import { assertBodegasDisponibles, assertEmpresaInventarioDisponible } from './inventario-bloqueos';

type TxQuery = (sql: string, params?: any[]) => Promise<any>;

export type LineaStock = { id: number; cantidad: number };

export type OpcionesMovimiento = {
  productoId: number;
  cantidad: number;
  bodegaId: number | null;
  usuarioId: number | null;
  /** -1 descuenta, 1 devuelve */
  signo: number;
  motivo: string;
  referenciaTipo?: 'venta' | 'compra' | 'ajuste' | 'devolucion' | 'produccion';
  referenciaId?: number | null;
};

export const expandirInsumos = async (
  txQuery: TxQuery,
  productoId: number,
  cantidad: number
): Promise<LineaStock[]> => {
  const insumos = await txQuery(
    'SELECT insumo_id, cantidad FROM producto_insumos WHERE producto_id = ?',
    [productoId]
  );
  if (insumos.length === 0) return [{ id: Number(productoId), cantidad }];
  return insumos.map((insumo: any) => ({
    id: Number(insumo.insumo_id),
    cantidad: Number(insumo.cantidad) * cantidad
  }));
};

export const validarDisponibilidad = async (
  txQuery: TxQuery,
  lineas: LineaStock[],
  bodegaId: number | null
): Promise<void> => {
  for (const linea of lineas) {
    const productos = await txQuery(
      'SELECT nombre, maneja_inventario, permite_venta_sin_stock, stock_actual FROM productos WHERE id = ?',
      [linea.id]
    );
    if (productos.length === 0) throw new Error('Un producto del pedido no existe');

    const producto = productos[0];
    if (!Number(producto.maneja_inventario) || Number(producto.permite_venta_sin_stock)) continue;

    let disponible = Number(producto.stock_actual) || 0;
    if (bodegaId) {
      const porBodega = await txQuery(
        'SELECT stock_actual FROM productos_bodegas WHERE producto_id = ? AND bodega_id = ?',
        [linea.id, bodegaId]
      );
      disponible = porBodega.length > 0 ? Number(porBodega[0].stock_actual) : 0;
    }

    if (disponible < linea.cantidad) {
      throw new Error(`Stock insuficiente de ${producto.nombre}. Disponible: ${disponible}, requerido: ${linea.cantidad}`);
    }
  }
};

export const moverStock = async (txQuery: TxQuery, opciones: OpcionesMovimiento): Promise<LineaStock[]> => {
  const { productoId, cantidad, bodegaId, usuarioId, signo, motivo, referenciaTipo, referenciaId } = opciones;
  const lineas = await expandirInsumos(txQuery, productoId, cantidad);

  if (bodegaId) {
    await assertBodegasDisponibles(txQuery, [bodegaId]);
  } else {
    const products = await txQuery('SELECT DISTINCT empresa_id FROM productos WHERE id IN (' + lineas.map(() => '?').join(',') + ')', lineas.map((linea) => linea.id));
    for (const product of products) await assertEmpresaInventarioDisponible(txQuery, Number(product.empresa_id));
  }
  if (signo < 0) await validarDisponibilidad(txQuery, lineas, bodegaId);

  for (const linea of lineas) {
    const delta = signo * linea.cantidad;

    const actual = await txQuery('SELECT stock_actual FROM productos WHERE id = ? FOR UPDATE', [linea.id]);
    const stockAnterior = actual.length > 0 ? Number(actual[0].stock_actual) || 0 : 0;
    let stockNuevo = stockAnterior + delta;

    if (bodegaId) {
      const warehouseRows = await txQuery(
        'SELECT stock_actual FROM productos_bodegas WHERE producto_id = ? AND bodega_id = ? FOR UPDATE',
        [linea.id, bodegaId]
      );
      const warehouseStock = warehouseRows.length ? Number(warehouseRows[0].stock_actual) + delta : delta;
      if (warehouseStock < 0) throw new Error(`Stock insuficiente en la bodega para el producto ${linea.id}`);
      if (warehouseRows.length) {
        await txQuery('UPDATE productos_bodegas SET stock_actual = ? WHERE producto_id = ? AND bodega_id = ?', [warehouseStock, linea.id, bodegaId]);
      } else {
        await txQuery('INSERT INTO productos_bodegas (producto_id, bodega_id, stock_actual) VALUES (?, ?, ?)', [linea.id, bodegaId, warehouseStock]);
      }
      const totals = await txQuery('SELECT COALESCE(SUM(stock_actual), 0) AS total FROM productos_bodegas WHERE producto_id = ?', [linea.id]);
      stockNuevo = Number(totals[0].total);
    }

    await txQuery('UPDATE productos SET stock_actual = ? WHERE id = ?', [stockNuevo, linea.id]);

    await txQuery(
      `INSERT INTO inventario_movimientos
        (producto_id, bodega_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, referencia_tipo, referencia_id, usuario_id, fecha, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        linea.id,
        bodegaId || null,
        delta < 0 ? 'salida' : 'entrada',
        Math.abs(delta),
        stockAnterior,
        stockNuevo,
        motivo,
        referenciaTipo || null,
        referenciaId || null,
        usuarioId
      ]
    );
  }

  return lineas;
};
