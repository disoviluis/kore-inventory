const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { calcular, conciliarPagos, centavos } = require('../../frontend/public/assets/js/pos-calculos');
const modulePath = path.resolve(__dirname, '../../frontend/public/assets/js/pos-calculos.js');
const line = (extra = {}) => ({ cantidad: 1, precio_unitario: 135000, aplica_iva: 1, porcentaje_iva: 19, ...extra });
const tax = (extra = {}) => ({ id: 1, codigo: 'RETEICA', nombre: 'Retencion confirmada',
  tipo: 'porcentaje', tasa: 1, aplica_sobre: 'subtotal', afecta_total: 'resta', ...extra });

test('POS never creates ICA, renta or IVA withholdings without explicit selected configuration', () => {
  for (const price of [135000, 200000, 1000000]) {
    const result = calcular({ productos: [line({ precio_unitario: price })] });
    assert.equal(result.retenciones, 0);
    assert.equal(result.total, price * 119 / 100);
    assert.deepEqual(result.impuestos, []);
  }
});

test('original synthetic sale recomputes to 160650 with 9350 cash change, without altering history', () => {
  const result = calcular({ productos: [line()] });
  assert.equal(result.total, 160650);
  const payment = conciliarPagos([{ metodo_pago: 'efectivo', monto: 170000 }], result.total);
  assert.deepEqual(payment, { pagos: [{ metodo_pago: 'efectivo', monto: 160650 }], recibido: 170000, cambio: 9350 });
});

test('explicit selected withholding is applied once with a persisted breakdown and exact net', () => {
  const result = calcular({ productos: [line()], impuestos: [tax()] });
  assert.equal(result.retenciones, 1350);
  assert.equal(result.total, 159300);
  assert.equal(result.impuestos[0].base_calculo, 135000);
  assert.equal(result.impuestos[0].valor, 1350);
  assert.throws(() => calcular({ productos: [line()], impuestos: [tax(), tax()] }), /mas de una vez/);
});

test('zero IVA remains zero; excluded and exempt products do not acquire a default 19 percent', () => {
  for (const product of [line({ porcentaje_iva: 0 }), line({ aplica_iva: 0 }), line({ tipo_impuesto: 'exento' }), line({ tipo_impuesto: 'excluido' })]) {
    assert.equal(calcular({ productos: [product] }).impuesto, 0);
  }
});

test('included IVA is extracted, never added twice, with exact line-level rounding', () => {
  const result = calcular({ productos: [line({ cantidad: 3, precio_unitario: 10, iva_incluido_en_precio: true })] });
  assert.equal(result.subtotal, 25.21);
  assert.equal(result.impuesto, 4.79);
  assert.equal(result.total, 30);
});

test('discount is allocated by cents across mixed IVA rates and cannot exceed the base', () => {
  const result = calcular({ productos: [line({ precio_unitario: 100 }), line({ precio_unitario: 100, porcentaje_iva: 5 })], descuento: 10 });
  assert.equal(result.subtotal, 200);
  assert.equal(result.impuesto, 22.8);
  assert.equal(result.total, 212.8);
  assert.equal(result.productos.reduce((sum, p) => sum + centavos(p.base_gravable), 0), 19000);
  assert.throws(() => calcular({ productos: [line()], descuento: 135000.01 }), /supera el subtotal/);
});

test('fractional quantities, line discounts and tiny amounts are rounded only at defined boundaries', () => {
  const result = calcular({ productos: [line({ cantidad: 1.125, precio_unitario: 10.01, descuento: 0.26 })] });
  assert.equal(result.subtotal, 11);
  assert.equal(result.impuesto, 2.09);
  assert.equal(result.total, 13.09);
  assert.equal(calcular({ productos: [line({ precio_unitario: 0.03 })] }).impuesto, 0.01);
});

test('additional charges, deductions, IVA bases and tip reconcile without hiding retentions', () => {
  const result = calcular({ productos: [line()], descuento: 5000,
    impuestos: [tax(), tax({ id: 2, codigo: 'CARGO', tipo: 'valor_fijo', tasa: 2000, afecta_total: 'suma' }),
      tax({ id: 3, codigo: 'RIVA', tasa: 15, aplica_sobre: 'iva' })],
    propina_habilitada: true, propina_porcentaje: 10 });
  assert.equal(result.impuesto, 24700);
  assert.equal(result.impuestos_adicionales, 2000);
  assert.equal(result.retenciones, 5005);
  assert.equal(result.propina_valor, 13500);
  assert.equal(result.total, 165195);
});

test('invalid inputs never silently become zero or NaN', () => {
  for (const price of [null, undefined, '', '12x', NaN, Infinity, -1, 0.001, '1e10']) {
    assert.throws(() => calcular({ productos: [line({ precio_unitario: price })] }));
  }
  assert.throws(() => calcular({ productos: [line({ cantidad: 0 })] }));
  assert.throws(() => calcular({ productos: [line({ cantidad: 0.0001 })] }));
  assert.throws(() => calcular({ productos: [line({ porcentaje_iva: null })] }));
  assert.throws(() => calcular({ productos: [line()], propina_habilitada: true, propina_porcentaje: -1 }));
});

test('mixed payments return change from cash only and keep card/transfer amounts intact', () => {
  const result = conciliarPagos([{ metodo_pago: 'tarjeta_credito', monto: 100000 }, { metodo_pago: 'efectivo', monto: 70000 }], 160650);
  assert.deepEqual(result.pagos.map(p => p.monto), [100000, 60650]);
  assert.equal(result.cambio, 9350);
  assert.throws(() => conciliarPagos([{ metodo_pago: 'tarjeta_credito', monto: 170000 }], 160650), /solo.*efectivo/);
  assert.throws(() => conciliarPagos([{ metodo_pago: 'efectivo', monto: 160649.99 }], 160650), /no cubren/);
  assert.throws(() => conciliarPagos([{ metodo_pago: 'efectivo', monto: 'NaN' }], 160650));
  assert.throws(() => conciliarPagos([], 160650), /registrar el pago/);
  assert.throws(() => conciliarPagos([{ metodo_pago: 'otro', monto: 170000 }], 160650));
});

test('credit is not counted as cash and initial deposits require the cartera workflow', () => {
  assert.deepEqual(conciliarPagos([], 160650, true), { pagos: [], recibido: 0, cambio: 0 });
  assert.throws(() => conciliarPagos([{ metodo_pago: 'efectivo', monto: 1000 }], 160650, true), /cartera/);
});

test('browser and server execute the same calculator with identical results', () => {
  const browser = {};
  vm.createContext(browser);
  vm.runInContext(fs.readFileSync(modulePath, 'utf8'), browser);
  const input = { productos: [line({ cantidad: 1.125, precio_unitario: 10.01 })], descuento: 0.01, impuestos: [tax()] };
  assert.equal(JSON.stringify(browser.PosCalculos.calcular(input)), JSON.stringify(calcular(input)));
});

test('500 mixed carts reconcile in integer cents and all applied payments sum to their total', () => {
  for (let i = 1; i <= 500; i++) {
    const result = calcular({ productos: [line({ cantidad: i % 7 + 1, precio_unitario: (i * 13 + 1) / 100 }),
      line({ precio_unitario: 10.01, porcentaje_iva: i % 2 ? 5 : 0 })], descuento: (i % 5) / 100 });
    assert.equal(centavos(result.total), centavos(result.subtotal) - centavos(result.descuento) + centavos(result.impuesto));
    const tender = (centavos(result.total) + 99) / 100;
    const received = conciliarPagos([{ metodo_pago: 'efectivo', monto: tender }], result.total);
    assert.equal(centavos(received.pagos[0].monto), centavos(result.total));
    assert.equal(received.cambio, 0.99);
  }
});
