type TxQuery = (sql: string, params?: any[]) => Promise<any>;

export const assertBodegasDisponibles = async (tx: TxQuery, bodegaIds: number[]): Promise<void> => {
  const ids = [...new Set(bodegaIds.map(Number))].sort((left, right) => left - right);
  if (!ids.length || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw Object.assign(new Error('Bodegas invalidas para modificar inventario'), { status: 400 });
  }
  const placeholders = ids.map(() => '?').join(',');
  const warehouses = await tx(`SELECT id FROM bodegas WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`, ids);
  if (warehouses.length !== ids.length) throw Object.assign(new Error('Bodega no encontrada'), { status: 404 });
  const locks = await tx(
    `SELECT bodega_id FROM inventarios_bodega_bloqueos WHERE bodega_id IN (${placeholders}) ORDER BY bodega_id FOR UPDATE`,
    ids
  );
  if (locks.length) throw Object.assign(new Error('Bodega bloqueada por inventario fisico; movimiento cancelado'), { status: 409 });
};

export const assertEmpresaInventarioDisponible = async (tx: TxQuery, empresaId: number): Promise<void> => {
  const warehouses = await tx('SELECT id FROM bodegas WHERE empresa_id = ? ORDER BY id FOR UPDATE', [empresaId]);
  if (warehouses.length) await assertBodegasDisponibles(tx, warehouses.map((warehouse: any) => Number(warehouse.id)));
};