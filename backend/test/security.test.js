const assert = require('node:assert/strict');
const test = require('node:test');
const pool = require('../dist/shared/database').default;
const { resolveActivosEmpresa, requireActivosPermission } = require('../dist/platform/activos/activos.security');
const { evaluateRoundConsensus } = require('../dist/platform/inventario/reconciliation.rules');
const { assertBodegasDisponibles, assertEmpresaInventarioDisponible } = require('../dist/shared/inventario-bloqueos');
const { moverStock } = require('../dist/shared/inventario');
const repuestosController = require('../dist/platform/repuestos/repuestos.controller');
const inventariosController = require('../dist/platform/inventario/inventarios-fisicos.controller');
const rolesGlobalesController = require('../dist/platform/super-admin/roles-globales.controller');
const activosController = require('../dist/platform/activos/activos.controller');
const {
  isValidPrivateEvidenceKey,
  matchesEvidenceFileSignature
} = require('../dist/platform/archivos/evidencias.rules');

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function invoke(middleware, req) {
  const res = responseMock();
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test('tenant guard rejects a company without an active membership', async () => {
  const original = pool.execute;
  try {
    pool.execute = async () => [[], []];
    const { res, nextCalled } = await invoke(resolveActivosEmpresa, {
      user: { id: 17, tipo_usuario: 'usuario' }, query: { empresa_id: '42' }, body: {}, params: {}
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  } finally {
    pool.execute = original;
  }
});

test('permission guard rejects a role scoped to a different company', async () => {
  const original = pool.execute;
  try {
    pool.execute = async () => [[], []];
    const { res, nextCalled } = await invoke(requireActivosPermission('inventarios_fisicos', 'count'), {
      user: { id: 17, tipo_usuario: 'usuario' }, activosEmpresaId: 42
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  } finally {
    pool.execute = original;
  }
});

test('tenant guard accepts only the active company membership returned by SQL', async () => {
  const original = pool.execute;
  try {
    pool.execute = async (_sql, params) => params[0] === 42
      ? [[{ id: 17, tipo_usuario: 'usuario', empresa_id_default: 8, membresia_id: 3, membresia_activa: 1 }], []]
      : [[], []];
    const req = { user: { id: 17 }, query: { empresa_id: '42' }, body: {}, params: {} };
    const { res, nextCalled } = await invoke(resolveActivosEmpresa, req);
    assert.equal(nextCalled, true);
    assert.equal(req.activosEmpresaId, 42);
    assert.equal(res.statusCode, 200);
  } finally {
    pool.execute = original;
  }
});

test('private evidence rejects cross-tenant keys and MIME/signature mismatches', () => {
  const companyKey = `empresa/42/evidencias/activo/7/123e4567-e89b-12d3-a456-426614174000.pdf`;
  assert.equal(isValidPrivateEvidenceKey(companyKey, 42, 'activo', 7, 'application/pdf'), true);
  assert.equal(isValidPrivateEvidenceKey(companyKey, 43, 'activo', 7, 'application/pdf'), false);
  assert.equal(isValidPrivateEvidenceKey(companyKey, 42, 'mantenimiento', 7, 'application/pdf'), false);
  assert.equal(matchesEvidenceFileSignature('application/pdf', Buffer.from('%PDF-1.7')), true);
  assert.equal(matchesEvidenceFileSignature('application/pdf', Buffer.from('<html>')), false);
  assert.equal(matchesEvidenceFileSignature('image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
});

test('C1 and C2 agreement resolves without requiring C3', () => {
  assert.deepEqual(evaluateRoundConsensus([
    { numero: 1, ronda_id: 11, cantidad: 7 },
    { numero: 2, ronda_id: 12, cantidad: 7 }
  ], 4), { physical: 7, status: 'matched', resolvingRoundId: 12 });
});

test('C3 resolves only when it agrees with C1 or C2', () => {
  const rounds = [
    { numero: 1, ronda_id: 11, cantidad: 7 },
    { numero: 2, ronda_id: 12, cantidad: 9 },
    { numero: 3, ronda_id: 13, cantidad: 9 }
  ];
  assert.deepEqual(evaluateRoundConsensus(rounds, 4), { physical: 9, status: 'matched', resolvingRoundId: 13 });
  assert.deepEqual(evaluateRoundConsensus(rounds.map((round) => round.numero === 3 ? { ...round, cantidad: 8 } : round), 4), {
    physical: null, status: 'difference', resolvingRoundId: null
  });
});

test('C4 disagreement at configured maximum requires manual review, never majority vote', () => {
  const result = evaluateRoundConsensus([
    { numero: 1, ronda_id: 11, cantidad: 7 },
    { numero: 2, ronda_id: 12, cantidad: 9 },
    { numero: 3, ronda_id: 13, cantidad: 8 },
    { numero: 4, ronda_id: 14, cantidad: 7 }
  ], 4);
  assert.deepEqual(result, { physical: null, status: 'review', resolvingRoundId: null });
});

test('warehouse guard locks unique warehouses in order before checking the persistent count lock', async () => {
  const calls = [];
  await assertBodegasDisponibles(async (sql, params) => {
    calls.push({ sql, params });
    return calls.length === 1 ? [{ id: 3 }, { id: 7 }] : [];
  }, [7, 3, 7]);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].params, [3, 7]);
  assert.deepEqual(calls[1].params, [3, 7]);
  assert.match(calls[0].sql, /FROM bodegas.*ORDER BY id FOR UPDATE/);
  assert.match(calls[1].sql, /inventarios_bodega_bloqueos.*FOR UPDATE/);
});

test('warehouse guard rejects either end of a transfer while allowing unrelated warehouses', async () => {
  const tx = async (sql, ids) => sql.includes('FROM bodegas')
    ? ids.map((id) => ({ id })) : ids.includes(7) ? [{ bodega_id: 7 }] : [];
  await assert.rejects(() => assertBodegasDisponibles(tx, [3, 7]), (error) => error.status === 409);
  await assertBodegasDisponibles(tx, [3]);
});

test('warehouse guard fails closed on invalid warehouses or unavailable lock table', async () => {
  await assert.rejects(() => assertBodegasDisponibles(async () => [], [0]), (error) => error.status === 400);
  await assert.rejects(() => assertBodegasDisponibles(async () => [], [3]), (error) => error.status === 404);
  await assert.rejects(() => assertBodegasDisponibles(async (sql) => {
    if (sql.includes('FROM bodegas')) return [{ id: 3 }];
    throw Object.assign(new Error('Missing lock table'), { code: 'ER_NO_SUCH_TABLE' });
  }, [3]), (error) => error.code === 'ER_NO_SUCH_TABLE');
});

test('catalogue guard checks all company warehouses before accepting changes', async () => {
  const calls = [];
  await assert.rejects(() => assertEmpresaInventarioDisponible(async (sql, params) => {
    calls.push({ sql, params });
    return sql.includes('inventarios_bodega_bloqueos') ? [{ bodega_id: 7 }] : [{ id: 3 }, { id: 7 }];
  }, 42), (error) => error.status === 409);
  assert.deepEqual(calls[0].params, [42]);
  assert.match(calls[0].sql, /empresa_id = \?.*FOR UPDATE/);
});

test('sales and open-account stock helper performs no writes when warehouse is frozen', async () => {
  const calls = [];
  await assert.rejects(() => moverStock(async (sql) => {
    calls.push(sql);
    if (sql.includes('producto_insumos')) return [];
    if (sql.includes('FROM bodegas')) return [{ id: 7 }];
    if (sql.includes('inventarios_bodega_bloqueos')) return [{ bodega_id: 7 }];
    throw new Error('Unexpected query after count lock');
  }, { productoId: 10, cantidad: 1, bodegaId: 7, usuarioId: 17, signo: -1, motivo: 'venta' }), (error) => error.status === 409);
  assert.equal(calls.some((sql) => /^\s*(UPDATE|INSERT|DELETE)/i.test(sql)), false);
});

test('stock movement without explicit warehouse still checks company-wide count locks', async () => {
  await assert.rejects(() => moverStock(async (sql) => {
    if (sql.includes('producto_insumos')) return [];
    if (sql.includes('SELECT DISTINCT empresa_id')) return [{ empresa_id: 42 }];
    if (sql.includes('FROM bodegas')) return [{ id: 7 }];
    if (sql.includes('inventarios_bodega_bloqueos')) return [{ bodega_id: 7 }];
    throw new Error('Unexpected query after count lock');
  }, { productoId: 10, cantidad: 1, bodegaId: null, usuarioId: 17, signo: 1, motivo: 'devolucion' }), (error) => error.status === 409);
});

test('serialized unit list returns every row from the transaction helper', async () => {
  const original = pool.getConnection;
  const units = [{ id: 1, numero_serie: 'QA-1' }, { id: 2, numero_serie: 'QA-2' }];
  let committed = false;
  try {
    pool.getConnection = async () => ({
      beginTransaction: async () => {}, rollback: async () => {}, release() {},
      commit: async () => { committed = true; }, execute: async () => [units, []]
    });
    const res = responseMock();
    await repuestosController.listSerializedUnits({ activosEmpresaId: 42, params: { productoId: '10' } }, res);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, units);
    assert.equal(committed, true);
  } finally {
    pool.getConnection = original;
  }
});

test('adjustment review writes reviewer using the locked previous state', async () => {
  const original = pool.getConnection;
  let update;
  try {
    pool.getConnection = async () => ({
      beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {},
      execute: async (sql, params) => {
        if (sql.startsWith('SELECT * FROM inventarios_ajustes')) {
          return [[{ id: 2, estado: 'requested', solicitado_por: 1, inventario_id: 5 }], []];
        }
        if (sql.includes('UPDATE inventarios_ajustes')) update = { sql, params };
        return [{ affectedRows: 1, insertId: 9 }, []];
      }
    });
    const res = responseMock();
    await inventariosController.reviewAdjustment({
      activosEmpresaId: 42, user: { id: 3 }, params: { ajusteId: '2' },
      body: { estado: 'under_review', observaciones: 'QA' }
    }, res);
    assert.equal(res.body.success, true);
    assert.equal(update.params[0], 'under_review');
    assert.equal(update.params[1], 'requested');
    assert.equal(update.params[2], 3);
    assert.equal(update.params[3], 'requested');
  } finally {
    pool.getConnection = original;
  }
});

async function withGlobalRoleMocks(level, role, operation) {
  const originalConnection = pool.getConnection;
  const originalExecute = pool.execute;
  const calls = [];
  let committed = false;
  let releases = 0;
  try {
    pool.execute = async () => [[{ nivel_privilegio: level }], []];
    pool.getConnection = async () => ({
      beginTransaction: async () => {}, rollback: async () => {},
      release() { releases += 1; }, commit: async () => { committed = true; },
      execute: async (sql, params) => {
        calls.push({ sql, params });
        if (sql.startsWith('SELECT * FROM roles')) return [role ? [role] : [], []];
        if (sql.includes('SELECT id FROM roles')) return [[], []];
        return [{ insertId: 9, affectedRows: 1 }, []];
      },
      query: async (sql, params) => {
        calls.push({ sql, params });
        return [{ affectedRows: 1 }, []];
      }
    });
    const res = responseMock();
    await operation(res);
    assert.equal(releases, 1);
    return { res, calls, committed };
  } finally {
    pool.getConnection = originalConnection;
    pool.execute = originalExecute;
  }
}

test('Super Admin at level 100 may create a global level 100 role', async () => {
  const result = await withGlobalRoleMocks(100, null, (res) => rolesGlobalesController.createRolGlobal({
    user: { id: 1, tipo_usuario: 'super_admin' },
    body: { nombre: 'Administrador adicional', nivel: 100, permisos_ids: [7] }
  }, res));
  assert.equal(result.res.statusCode, 201);
  assert.equal(result.committed, true);
});

test('lower-level Super Admin and non-Super Admin cannot create level 100 roles', async () => {
  for (const actor of [{ type: 'super_admin', level: 99 }, { type: 'admin_empresa', level: 100 }]) {
    const result = await withGlobalRoleMocks(actor.level, null, (res) => rolesGlobalesController.createRolGlobal({
      user: { id: 1, tipo_usuario: actor.type }, body: { nombre: 'No autorizado', nivel: 100 }
    }, res));
    assert.equal(result.res.statusCode, 403);
    assert.equal(result.committed, false);
    assert.equal(result.calls.some((call) => /INSERT|UPDATE|DELETE/.test(call.sql)), false);
  }
});

test('global role level must be an integer in the 80-100 range', async () => {
  for (const level of [79, 101, 99.5]) {
    const result = await withGlobalRoleMocks(100, null, (res) => rolesGlobalesController.createRolGlobal({
      user: { id: 1, tipo_usuario: 'super_admin' }, body: { nombre: 'Nivel invalido', nivel: level }
    }, res));
    assert.equal(result.res.statusCode, 400);
    assert.equal(result.committed, false);
  }
});

test('principal Super Admin permissions are editable and renaming preserves its reserved slug', async () => {
  const result = await withGlobalRoleMocks(100, { id: 1, slug: 'super_admin', nivel: 100 },
    (res) => rolesGlobalesController.updateRolGlobal({
      params: { id: '1' }, user: { id: 1, tipo_usuario: 'super_admin' },
      body: { nombre: 'Administrador principal', permisos_ids: [7, 8] }
    }, res));
  assert.equal(result.res.body.success, true);
  assert.equal(result.committed, true);
  const update = result.calls.find((call) => call.sql.startsWith('UPDATE roles'));
  assert.equal(update.params[1], 'super_admin');
  assert.match(result.calls[0].sql, /FOR UPDATE/);
});

test('principal Super Admin cannot be deactivated or demoted', async () => {
  for (const body of [{ nivel: 99 }, { activo: false }, { activo: 0 }]) {
    const result = await withGlobalRoleMocks(100, { id: 1, slug: 'super_admin', nivel: 100 },
      (res) => rolesGlobalesController.updateRolGlobal({
        params: { id: '1' }, user: { id: 1, tipo_usuario: 'super_admin' }, body
      }, res));
    assert.equal(result.res.statusCode, 403);
    assert.equal(result.committed, false);
    assert.equal(result.calls.some((call) => /INSERT|UPDATE roles|DELETE/.test(call.sql)), false);
  }
});

test('editing level 100 permissions requires a Super Admin at level 100', async () => {
  const result = await withGlobalRoleMocks(99, { id: 1, slug: 'super_admin', nivel: 100 },
    (res) => rolesGlobalesController.updateRolGlobal({
      params: { id: '1' }, user: { id: 2, tipo_usuario: 'super_admin' }, body: { permisos_ids: [7] }
    }, res));
  assert.equal(result.res.statusCode, 403);
  assert.equal(result.committed, false);
});

test('asset references use provider razon_social and preserve tenant-scoped reference lists', async () => {
  const original = pool.execute;
  try {
    pool.execute = async (sql, params) => {
      assert.equal(params[0], 42);
      if (sql.includes('FROM proveedores')) {
        assert.match(sql, /razon_social AS nombre/);
        assert.match(sql, /ORDER BY razon_social/);
        assert.match(sql, /empresa_id = \?/);
        return [[{ id: 4, nombre: 'Proveedor QA' }], []];
      }
      if (sql.includes('FROM bodegas')) return [[{ id: 1, nombre: 'Bodega QA', estado: 'activa' }], []];
      assert.deepEqual(params, [42, 42]);
      return [[{ id: 2, nombre: 'Responsable QA', activo: 1 }], []];
    };
    const res = responseMock();
    await activosController.getAssetReferences({ activosEmpresaId: 42 }, res);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data.proveedores, [{ id: 4, nombre: 'Proveedor QA' }]);
    assert.equal(res.body.data.bodegas.length, 1);
    assert.equal(res.body.data.usuarios.length, 1);
  } finally {
    pool.execute = original;
  }
});