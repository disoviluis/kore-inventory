import { query } from '../../shared/database';
import { centavos, conciliarPagos, ErrorCalculo, Pago } from '../../../../frontend/public/assets/js/pos-calculos';

interface ReceiptRow {
  id: number;
  total: string;
  forma_pago: string;
  estado: string;
  metodo_pago: string;
  pago_id: number | null;
  pago_metodo: string | null;
  monto: string | null;
}

export async function resumenPagosTurno(turnoId: string, execute: typeof query = query) {
  const rows: ReceiptRow[] = await execute(
    `SELECT v.id, v.total, v.forma_pago, v.estado, v.metodo_pago,
            vp.id AS pago_id, vp.metodo_pago AS pago_metodo, vp.monto
       FROM ventas v LEFT JOIN venta_pagos vp ON vp.venta_id = v.id
      WHERE v.turno_id = ? AND v.estado <> 'anulada' ORDER BY v.id, vp.id`, [turnoId]
  );
  const sales = new Map<number, { row: ReceiptRow; pagos: Pago[] }>();
  for (const row of rows) {
    const sale = sales.get(row.id) || { row, pagos: [] };
    if (row.pago_id != null) {
      if (row.pago_metodo === null || row.monto === null) throw new ErrorCalculo(`Pago incompleto en la venta ${row.id}`);
      sale.pagos.push({ metodo_pago: row.pago_metodo, monto: row.monto });
    }
    sales.set(row.id, sale);
  }
  const methods = new Map<string, { metodo_pago: string; cantidad: number; total: number }>();
  let total = 0;
  for (const { row, pagos } of sales.values()) {
    total += centavos(row.total);
    if (row.forma_pago === 'credito' || row.estado !== 'pagada') continue;
    const received = pagos.length ? pagos : [{ metodo_pago: row.metodo_pago, monto: row.total }];
    let reconciled: ReturnType<typeof conciliarPagos>;
    try { reconciled = conciliarPagos(received, row.total); }
    catch (error) {
      if (!(error instanceof ErrorCalculo)) throw error;
      throw new ErrorCalculo(`Revise los pagos historicos de la venta ${row.id} antes de cerrar caja: ${error.message}`);
    }
    const counts = new Set<string>();
    for (const pago of reconciled.pagos) {
      const method = methods.get(pago.metodo_pago) || { metodo_pago: pago.metodo_pago, cantidad: 0, total: 0 };
      method.total += centavos(pago.monto);
      if (!counts.has(pago.metodo_pago)) method.cantidad++;
      counts.add(pago.metodo_pago);
      methods.set(pago.metodo_pago, method);
    }
  }
  return { ventas: [...methods.values()].map(method => ({ ...method, total: method.total / 100 })), totalVentas: total / 100 };
}
