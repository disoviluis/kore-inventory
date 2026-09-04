/**
 * Consumo de inventario compartido entre ventas y cuentas abiertas.
 * Un producto con insumos definidos consume su composición; el resto descuenta su propio stock.
 */

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

  if (signo < 0) await validarDisponibilidad(txQuery, lineas, bodegaId);

  for (const linea of lineas) {
    const delta = signo * linea.cantidad;

    const actual = await txQuery('SELECT stock_actual FROM productos WHERE id = ? FOR UPDATE', [linea.id]);
    const stockAnterior = actual.length > 0 ? Number(actual[0].stock_actual) || 0 : 0;
    const stockNuevo = stockAnterior + delta;

    await txQuery('UPDATE productos SET stock_actual = ? WHERE id = ?', [stockNuevo, linea.id]);

    if (bodegaId) {
      await txQuery(
        'UPDATE productos_bodegas SET stock_actual = stock_actual + ? WHERE producto_id = ? AND bodega_id = ?',
        [delta, linea.id, bodegaId]
      );
    }

    await txQuery(
      `INSERT INTO inventario_movimientos
        (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo, referencia_tipo, referencia_id, usuario_id, fecha, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        linea.id,
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
