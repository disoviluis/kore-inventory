const assert = require('node:assert/strict');
const test = require('node:test');
const pool = require('../dist/shared/database').default;
const inventory = require('../dist/shared/inventario');
const { createVenta, getVentaById, cerrarTurno, registrarGasto } = require('../dist/platform/ventas/ventas.controller');
const { cerrarCuenta, agregarItemCuenta } = require('../dist/platform/cuentas-abiertas/cuentas-abiertas.controller');
const { resumenPagosTurno } = require('../dist/platform/ventas/ventas.pagos');

const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});
const body = extra => ({
  empresa_id: 33, cliente_id: 45, forma_pago: 'contado',
  productos: [{ producto_id: 1943, cantidad: 1, precio_unitario: 135000, tipo_venta: 'contra_pedido' }],
  subtotal: 135000, impuesto: 25650, total: 160650,
  pagos: [{ metodo_pago: 'efectivo', monto: 170000 }], ...extra
});
const request = data => ({ user: { id: 1, tipo_usuario: 'super_admin' }, body: data, params: {} });

async function database(handler, callback) {
  const original = { execute: pool.execute, getConnection: pool.getConnection };
  const calls = [];
  const execute = async (sql, params = []) => {
    assert.equal((sql.match(/\?/g) || []).length, params.length, `SQL placeholder mismatch: ${sql}`);
    calls.push({ sql, params });
    return [await handler(sql, params), []];
  };
  const connection = { execute,
    beginTransaction: async () => calls.push({ sql: 'BEGIN' }),
    commit: async () => calls.push({ sql: 'COMMIT' }),
    rollback: async () => calls.push({ sql: 'ROLLBACK' }),
    release: () => calls.push({ sql: 'RELEASE' }) };
  pool.execute = execute;
  pool.getConnection = async () => connection;
  try { await callback(calls); } finally { Object.assign(pool, original); }
}
function saleQuery(sql) {
  if (sql.includes('FROM clientes')) {
    assert.match(sql, /empresa_id = \?/);
    return [{ tipo_documento: 'NIT', numero_documento: '900123456', tipo_cliente: 'empresa', responsabilidad_fiscal: 'Gran Contribuyente' }];
  }
  if (sql.includes('FROM productos')) return [{ id: 1943, aplica_iva: 1, porcentaje_iva: '19.00', tipo_impuesto: 'gravado', iva_incluido_en_precio: 0 }];
  if (sql.includes('FROM impuestos')) return [{ id: 8, nombre: 'ICA seleccionada', codigo: 'ICA', tipo: 'porcentaje', tasa: '1.00', aplica_sobre: 'subtotal', afecta_total: 'resta' }];
  if (sql.includes('FROM empresas')) {
    assert.match(sql, /FOR UPDATE/);
    return [{ prefijo_factura: 'FEV', numeracion_actual: 2, nit: '900999002', ambiente: 'pruebas' }];
  }
  if (sql.includes('FROM turnos_caja') || sql.includes('FROM usuarios')) return [];
  if (/^(INSERT|UPDATE)/.test(sql.trim())) return { insertId: 141, affectedRows: 1 };
  assert.fail(`Unexpected SQL: ${sql}`);
}

test('sale detail attaches fiscal metadata scoped to the same company without exposing local CUFE as validation', async () => {
  await database(async (sql, params) => {
    if (sql.includes('FROM ventas v')) return [{ id: 141, empresa_id: 33, total: '160650.00', cufe: 'LOCAL' }];
    if (sql.includes('FROM matias_documentos')) {
      assert.deepEqual(params, ['33', 141]);
      assert.match(sql, /empresa_id = \? AND venta_id = \?/);
      return [{ id: 2, entorno: 'sandbox', estado: 'accepted', cufe: 'PROVIDER' }];
    }
    return [];
  }, async () => {
    const res = response();
    await getVentaById({ params: { id: '141' }, query: { empresaId: '33' } }, res);
    assert.equal(res.body.data.documento_fiscal.cufe, 'PROVIDER');
    assert.equal(res.body.data.cufe, 'LOCAL');
    assert.equal(res.body.data.total, '160650.00');
  });
});

test('server ignores client tax flags and never withholds by legal-person status or thresholds', async () => {
  await database(saleQuery, async calls => {
    const res = response();
    const originalJson = res.json;
    res.json = function (data) { assert.ok(calls.some(c => c.sql === 'COMMIT')); return originalJson.call(this, data); };
    await createVenta(request(body()), res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.retenciones, 0);
    assert.equal(res.body.data.total, 160650);
    assert.equal(res.body.data.cambio, 9350);
    assert.equal(res.body.data.numero_factura, 'FEV-000003');
    assert.equal(res.body.data.empresa_id, 33);
    assert.equal(res.body.data.estado, 'pagada');
    const sale = calls.find(c => /INSERT INTO ventas \(/.test(c.sql));
    assert.deepEqual(sale.params.slice(3, 9), [135000, 0, 25650, 160650, 0, 0]);
    assert.equal(calls.find(c => c.sql.includes('INSERT INTO venta_pagos')).params[2], 160650);
    assert.equal(calls.find(c => c.sql.includes('INSERT INTO venta_detalle')).params[5], 135000);
    const begin = calls.findIndex(c => c.sql === 'BEGIN');
    const number = calls.findIndex(c => c.sql.includes('UPDATE empresas'));
    assert.ok(begin < number && number < calls.indexOf(sale));
    assert.equal(calls.some(c => c.sql === 'ROLLBACK'), false);
  });
});

test('tampered totals and noncash overpayments are rejected before writes or numbering', async () => {
  for (const extra of [{ total: 159300 }, { impuesto: 0 }, { subtotal: 130000 },
    { pagos: [{ metodo_pago: 'transferencia', monto: 170000 }] },
    { productos: [{ producto_id: 1943, cantidad: 1, precio_unitario: 135000, aplica_iva: 0 }], impuesto: 0, total: 135000 }]) {
    await database(saleQuery, async calls => {
      const res = response();
      await createVenta(request(body(extra)), res);
      assert.equal(res.statusCode, 422);
      assert.ok(calls.every(c => c.sql.trim().startsWith('SELECT')));
    });
  }
});

test('selected taxes are reloaded within company scope and persisted with the same net total', async () => {
  await database(saleQuery, async calls => {
    const res = response();
    await createVenta(request(body({ impuestos: [{ impuesto_id: 8, tasa: 99 }], total: 159300 })), res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.retenciones, 1350);
    assert.match(calls.find(c => c.sql.includes('FROM impuestos')).sql, /empresa_id = \? AND activo = 1/);
    assert.deepEqual(calls.find(c => c.sql.includes('INSERT INTO venta_impuestos')).params, [141, 8, 'ICA', 'ICA seleccionada', 135000, 1, 1350, 'resta']);
    assert.equal(calls.find(c => c.sql.includes('INSERT INTO venta_pagos')).params[2], 159300);
  });
});

test('unavailable or duplicate taxes cannot silently be accepted', async () => {
  for (const taxes of [[{ impuesto_id: 9 }], [{ impuesto_id: 8 }, { impuesto_id: 8 }]]) {
    await database(sql => sql.includes('FROM impuestos') ? [] : saleQuery(sql), async calls => {
      const res = response();
      await createVenta(request(body({ impuestos: taxes })), res);
      assert.equal(res.statusCode, 422);
      assert.ok(calls.every(c => c.sql.trim().startsWith('SELECT')));
    });
  }
});

test('failed payment insert rolls back sale, details and numbering together', async () => {
  await database(sql => {
    if (sql.includes('INSERT INTO venta_pagos')) throw new Error('test payment failure');
    return saleQuery(sql);
  }, async calls => {
    const res = response();
    await createVenta(request(body()), res);
    assert.equal(res.statusCode, 500);
    assert.ok(calls.some(c => c.sql === 'ROLLBACK'));
    assert.equal(calls.some(c => c.sql === 'COMMIT'), false);
  });
});

test('immediate deliveries keep stock updates in the sale transaction and roll back stock errors', async () => {
  const original = inventory.moverStock;
  try {
    inventory.moverStock = async (tx, options) => {
      assert.equal(options.productoId, 1943);
      assert.equal(options.cantidad, 1);
      assert.equal(options.signo, -1);
      throw new Error('test stock failure');
    };
    await database(saleQuery, async calls => {
      const res = response();
      await createVenta(request(body({ productos: [{ producto_id: 1943, cantidad: 1, precio_unitario: 135000 }] })), res);
      assert.equal(res.statusCode, 500);
      assert.ok(calls.some(c => c.sql === 'ROLLBACK'));
      assert.equal(calls.some(c => c.sql === 'COMMIT'), false);
    });
  } finally { inventory.moverStock = original; }
});

test('credit creates the exact receivable but never an invented cash payment', async () => {
  await database(saleQuery, async calls => {
    const res = response();
    await createVenta(request(body({ forma_pago: 'credito', fecha_vencimiento: '2027-01-01', pagos: [] })), res);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(calls.find(c => c.sql.includes('INSERT INTO cuentas_por_cobrar')).params.slice(4, 6), [160650, 160650]);
    assert.equal(calls.some(c => c.sql.includes('INSERT INTO venta_pagos')), false);
  });
});

const account = { id: 1, empresa_id: 33, estado: 'abierta', cliente_id: 45, subtotal: '100.00', total_impuestos: '19.00',
  total: '119.00', propina_valor: '10.00', propina_habilitada: 1, propina_porcentaje: 10, propina_base: 100 };
function accountQuery(sql) {
  if (sql.includes('SELECT * FROM cuentas_abiertas')) { assert.match(sql, /empresa_id = \? FOR UPDATE/); return [account]; }
  if (sql.includes('SELECT * FROM cuenta_abierta_detalle')) return [{
    producto_id: 1943, cantidad: 1, precio_unitario: 100, subtotal: '100.00', iva_valor: '19.00', impoconsumo_valor: '0.00', otros_impuestos: '0.00', total: '119.00'
  }];
  if (sql.includes('FROM empresas')) return [{ prefijo_factura: 'FEV', numeracion_actual: 2 }];
  if (sql.includes('FROM turnos_caja') || sql.includes('FROM usuarios')) return [];
  if (/^(INSERT|UPDATE)/.test(sql.trim())) return { insertId: 142, affectedRows: 1 };
  assert.fail(`Unexpected account SQL: ${sql}`);
}
test('open-account close includes tip, persists base excluding IVA, nets cash and commits atomically', async () => {
  await database(accountQuery, async calls => {
    const res = response();
    const req = request({ empresa_id: 33, total: 129, pagos: [{ metodo_pago: 'efectivo', monto: 150 }] });
    req.params.id = '1';
    await cerrarCuenta(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data, { venta_id: 142, numero_factura: 'FEV-000003', total: 129, cambio: 21 });
    assert.equal(calls.find(c => c.sql.includes('INSERT INTO venta_detalle')).params[4], '100.00');
    assert.equal(calls.find(c => c.sql.includes('INSERT INTO venta_pagos')).params[2], 129);
    assert.equal(calls.at(-2).sql, 'COMMIT');
  });
});

test('open-account close rejects missing/insufficient payments, changed totals and already-closed accounts', async () => {
  for (const extra of [{ pagos: [] }, { pagos: [{ metodo_pago: 'efectivo', monto: 119 }] }, { total: 119 }]) {
    await database(accountQuery, async calls => {
      const res = response();
      const req = request({ empresa_id: 33, total: 129, pagos: [{ metodo_pago: 'efectivo', monto: 150 }], ...extra });
      req.params.id = '1';
      await cerrarCuenta(req, res);
      assert.equal(res.statusCode, 422);
      assert.equal(calls.some(c => /^(INSERT|UPDATE)/.test(c.sql.trim())), false);
    });
  }
  await database(sql => sql.includes('SELECT * FROM cuentas_abiertas') ? [{ ...account, estado: 'cerrada' }] : accountQuery(sql), async calls => {
    const req = request({ empresa_id: 33 }); req.params.id = '1';
    const res = response();
    await cerrarCuenta(req, res);
    assert.equal(res.statusCode, 422);
    assert.equal(calls.some(c => /^(INSERT|UPDATE)/.test(c.sql.trim())), false);
  });
});

test('failed open-account payment rolls back both sale and account close', async () => {
  await database(sql => {
    if (sql.includes('INSERT INTO venta_pagos')) throw new Error('test account payment failure');
    return accountQuery(sql);
  }, async calls => {
    const req = request({ empresa_id: 33, total: 129, pagos: [{ metodo_pago: 'efectivo', monto: 150 }] });
    req.params.id = '1';
    const res = response();
    await cerrarCuenta(req, res);
    assert.equal(res.statusCode, 500);
    assert.ok(calls.some(c => c.sql === 'ROLLBACK'));
    assert.equal(calls.some(c => c.sql === 'COMMIT'), false);
  });
});

test('cash report splits mixed payments, deducts historical change and excludes unpaid credit', async () => {
  const base = { total: '119.00', forma_pago: 'contado', estado: 'pagada', metodo_pago: 'Múltiple' };
  await database(() => [
    { ...base, id: 1, pago_id: 1, pago_metodo: 'tarjeta_credito', monto: '50.00' },
    { ...base, id: 1, pago_id: 2, pago_metodo: 'efectivo', monto: '100.00' },
    { ...base, id: 2, forma_pago: 'credito', estado: 'pendiente', pago_id: null },
    { ...base, id: 3, metodo_pago: 'efectivo', pago_id: null }
  ], async () => {
    const result = await resumenPagosTurno('1');
    assert.equal(result.totalVentas, 357);
    assert.deepEqual(result.ventas, [
      { metodo_pago: 'tarjeta_credito', cantidad: 1, total: 50 },
      { metodo_pago: 'efectivo', cantidad: 2, total: 188 }
    ]);
  });
});

test('open-account items preserve zero/exempt IVA, included prices and atomic header/stock updates', async () => {
  const original = inventory.moverStock;
  try {
    let stockCalls = 0;
    inventory.moverStock = async () => { stockCalls++; };
    for (const [product, expected] of [
      [{ aplica_iva: 1, porcentaje_iva: 0 }, [119, 0, 0, 119]],
      [{ aplica_iva: 1, porcentaje_iva: 19, tipo_impuesto: 'exento' }, [119, 0, 0, 119]],
      [{ aplica_iva: 1, porcentaje_iva: 19, iva_incluido_en_precio: 1 }, [100, 19, 19, 119]]
    ]) {
      let detail;
      await database((sql, params) => {
        if (sql.includes('FROM cuentas_abiertas')) return [{ id: 1, empresa_id: 33, estado: 'abierta' }];
        if (sql.includes('FROM productos')) return [{ id: 1943, nombre: 'Prueba', sku: 'TEST', ...product }];
        if (sql.includes('INSERT INTO cuenta_abierta_detalle')) { detail = params; return { insertId: 5 }; }
        if (sql.includes('COALESCE(SUM(subtotal)')) return [{ subtotal: detail[6], total_impuestos: detail[8], total: detail[11] }];
        if (sql.startsWith('UPDATE cuentas_abiertas')) return { affectedRows: 1 };
        assert.fail(sql);
      }, async calls => {
        const req = request({ producto_id: 1943, cantidad: 1, precio_unitario: 119 }); req.params.id = '1';
        const res = response();
        await agregarItemCuenta(req, res);
        assert.equal(res.statusCode, 201);
        assert.deepEqual([detail[6], detail[7], detail[8], detail[11]], expected);
        const lock = calls.findIndex(c => c.sql.includes('SELECT estado') && c.sql.includes('FOR UPDATE'));
        const insert = calls.findIndex(c => c.sql.includes('INSERT INTO cuenta_abierta_detalle'));
        const header = calls.findIndex(c => c.sql.startsWith('UPDATE cuentas_abiertas'));
        const commit = calls.findIndex(c => c.sql === 'COMMIT');
        assert.ok(lock < insert && insert < header && header < commit);
      });
    }
    assert.equal(stockCalls, 3);
  } finally { inventory.moverStock = original; }
});

function shiftQuery(sql) {
  if (sql.includes('FROM turnos_caja t')) {
    assert.match(sql, /FOR UPDATE/);
    return [{ estado: 'abierto', base_inicial: '0.00' }];
  }
  if (sql.includes('FROM ventas v LEFT JOIN')) return [{
    id: 1, total: '119.01', forma_pago: 'contado', estado: 'pagada', metodo_pago: 'efectivo', pago_id: 1, pago_metodo: 'efectivo', monto: '150.00'
  }];
  if (sql.includes('FROM gastos_caja')) return [{ monto: '19.01' }];
  if (/^(INSERT|UPDATE)/.test(sql.trim())) return { insertId: 1, affectedRows: 1 };
  assert.fail(sql);
}

test('shift close locks before reading receipts, persists zero counted cash and commits totals together', async () => {
  await database(shiftQuery, async calls => {
    const req = request({ efectivoContado: 0 }); req.params.turnoId = '1';
    const res = response();
    await cerrarTurno(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.efectivo_a_entregar, 100);
    const closing = calls.find(c => c.sql.includes('UPDATE turnos_caja'));
    assert.deepEqual(closing.params.slice(0, 5), [119.01, 19.01, 100, 0, -100]);
    assert.equal(calls[0].sql, 'BEGIN');
    assert.equal(calls.at(-2).sql, 'COMMIT');
  });
});

test('shift close errors roll back method totals and leave the shift open', async () => {
  await database(sql => {
    if (sql.includes('UPDATE turnos_caja')) throw new Error('test close failure');
    return shiftQuery(sql);
  }, async calls => {
    const req = request({ efectivoContado: 100 }); req.params.turnoId = '1';
    const res = response();
    await cerrarTurno(req, res);
    assert.equal(res.statusCode, 500);
    assert.ok(calls.some(c => c.sql === 'ROLLBACK'));
    assert.equal(calls.some(c => c.sql === 'COMMIT'), false);
  });
});

test('negative or fractional-cent cash expenses are rejected before writes', async () => {
  for (const monto of [-10, 0.001, 'NaN']) {
    await database(() => assert.fail('invalid expense must not touch the database'), async () => {
      const req = request({ descripcion: 'Prueba', monto }); req.params.turnoId = '1';
      const res = response();
      await registrarGasto(req, res);
      assert.equal(res.statusCode, 422);
    });
  }
});
