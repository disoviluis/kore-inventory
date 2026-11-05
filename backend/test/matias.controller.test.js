const assert = require('node:assert/strict');
const test = require('node:test');
const pool = require('../dist/shared/database').default;
const { getMatiasConnection, setMatiasService, matiasServiceCatalog } = require('../dist/platform/matias/matias.controller');

function responseMock() {
  return {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function requestMock(extra) {
  return {
    user: { id: 1, tipo_usuario: 'super_admin' }, ip: '127.0.0.1', get: () => 'test',
    params: { empresaId: '33' }, query: {}, body: {}, ...extra
  };
}

async function withPool(handler, callback) {
  const original = { execute: pool.execute, query: pool.query };
  const calls = [];
  pool.execute = async (sql, params) => { calls.push({ sql, params }); return [await handler(sql, params), []]; };
  pool.query = async (sql, params) => { calls.push({ sql, params }); return [{ affectedRows: 0 }, []]; };
  try { return await callback(calls); } finally { Object.assign(pool, original); }
}

test('service toggle creates missing service rows before activating them', async () => {
  await withPool(async sql => {
    if (sql.includes('FROM matias_conexiones')) return [{ estado: 'configurado', pat_cifrado: 'x' }];
    if (sql.startsWith('UPDATE matias_servicios')) return { affectedRows: 1 };
    return { affectedRows: 1 };
  }, async calls => {
    const res = responseMock();
    await setMatiasService(requestMock({ params: { empresaId: '33', codigo: 'factura_electronica' }, body: { entorno: 'sandbox', activo: true } }), res);
    assert.equal(res.statusCode, 200);
    const seed = calls.find(call => call.sql.startsWith('INSERT IGNORE INTO matias_servicios'));
    assert.ok(seed, 'missing service rows must be seeded');
    assert.equal(seed.params[0].length, matiasServiceCatalog.length * 2);
    assert.ok(seed.params[0].every(row => row[0] === 33));
    const seedIndex = calls.indexOf(seed);
    const updateIndex = calls.findIndex(call => call.sql.startsWith('UPDATE matias_servicios'));
    assert.ok(seedIndex < updateIndex);
  });
});

test('service toggle reports failure when no row was updated', async () => {
  await withPool(async sql => {
    if (sql.includes('FROM matias_conexiones')) return [{ estado: 'configurado', pat_cifrado: 'x' }];
    if (sql.startsWith('UPDATE matias_servicios')) return { affectedRows: 0 };
    return { affectedRows: 1 };
  }, async () => {
    const res = responseMock();
    await setMatiasService(requestMock({ params: { empresaId: '33', codigo: 'factura_electronica' }, body: { entorno: 'sandbox', activo: true } }), res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
  });
});

test('service toggle rejects unknown service codes without writing', async () => {
  await withPool(async () => assert.fail('no database access expected'), async calls => {
    const res = responseMock();
    await setMatiasService(requestMock({ params: { empresaId: '33', codigo: 'otro' }, body: { entorno: 'sandbox', activo: true } }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(calls.length, 0);
  });
});

test('connection services are limited to the selected environment', async () => {
  await withPool(async (sql, params) => {
    if (sql.includes('FROM matias_conexiones')) return [{ entorno: 'sandbox', estado: 'configurado' }];
    if (sql.includes('FROM matias_servicios')) {
      assert.match(sql, /entorno = \?/);
      assert.deepEqual(params, [33, 'produccion']);
      return [];
    }
    return [];
  }, async calls => {
    const res = responseMock();
    await getMatiasConnection(requestMock({ query: { entorno: 'produccion' } }), res);
    assert.equal(res.body.success, true);
    assert.ok(calls.some(call => call.sql.startsWith('INSERT IGNORE INTO matias_servicios')));
  });
});
