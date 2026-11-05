const assert = require('node:assert/strict');
const test = require('node:test');
const pool = require('../dist/shared/database').default;
const { getMatiasConnection, setMatiasService, matiasServiceCatalog } = require('../dist/platform/matias/matias.controller');
const { previewMatiasSandboxInvoice, emitMatiasSandboxInvoice } = require('../dist/platform/matias/matias.controller');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const { encryptAuthSecret } = require('../dist/core/auth/auth.security');

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

const fiscalSale = {
    numero_factura: 'FEV-000002', prefijo_factura: 'FEV', resolucion_dian: '1876000001',
    subtotal: '135000.00', descuento: '0.00', impuesto: '25650.00', retenciones: '1350.00',
    total: '159300.00', impuestos_adicionales: '0.00', propina_valor: '0.00',
    estado: 'pagada', forma_pago: 'contado', tipo_documento: 'NIT', numero_documento: '900123456',
    digito_verificacion: '8', nombre: null, apellido: null, razon_social: 'CLIENTE SINTETICO',
    email: 'cliente@example.invalid', direccion: 'Calle de prueba', ciudad: 'Bogota',
    tipo_cliente: 'empresa', regimen_tributario: 'simplificado', responsabilidad_fiscal: null
  };
  async function fiscalQuery(sql) {
    if (sql.includes('FROM matias_conexiones')) return [{
      base_url: 'https://sandbox-api.matias-api.com/api/ubl2.1', pat_cifrado: 'not-decrypted-in-preview',
      matias_company_uuid: 'client-uuid', estado: 'configurado'
    }];
    if (sql.includes('FROM matias_servicios')) return [{ activo_local: 1 }];
    if (sql.includes('FROM ventas v')) return [fiscalSale];
    if (sql.includes('FROM venta_detalle')) {
      assert.doesNotMatch(sql, /codigo_unspsc/);
      assert.match(sql, /p.porcentaje_iva/);
      return [{
        producto_id: 1943, cantidad: '1.000', precio_unitario: '135000.00', descuento: '0.00',
        subtotal: '135000.00', nombre: 'Producto sintetico', descripcion: null,
        porcentaje_iva: '19.00', aplica_iva: 1, tipo_impuesto: 'gravado', unidad_medida: 'UND'
      }];
    }
    if (sql.includes('FROM venta_pagos')) return [{ metodo_pago: 'efectivo', monto: '170000.00' }];
    if (sql.includes('FROM matias_documentos')) return [];
    if (sql.startsWith('INSERT INTO matias_eventos_auditoria')) return { affectedRows: 1 };
    assert.fail(`Unexpected SQL: ${sql}`);
  }

  test('sandbox preview returns provisional corrected JSON and blocks unconfirmed historical withholdings without writes or HTTP', async () => {
    const original = https.request;
    https.request = () => assert.fail('preview must never contact MATIAS');
    try {
      await withPool(fiscalQuery, async calls => {
        const res = responseMock();
        await previewMatiasSandboxInvoice(requestMock({ params: { empresaId: '33', ventaId: '140' } }), res);
        assert.equal(res.statusCode, 422);
        assert.equal(res.body.success, false);
        assert.equal(res.body.data.ready, false);
        assert.equal(res.body.data.preview, true);
        assert.equal(res.body.data.payload.document_number, '2');
        assert.equal(res.body.data.payload.tax_totals[0].tax_amount, 25650);
        assert.equal(res.body.data.payload.payments[0].value_paid, '159300.00');
        assert.equal(JSON.stringify(res.body).includes('pat_cifrado'), false);
        assert.ok(calls.every(call => call.sql.trim().startsWith('SELECT')));
      });
    } finally { https.request = original; }
  });

  test('sandbox preview and emission enforce the same retention blocker before creating a document', async () => {
    const original = https.request;
    https.request = () => assert.fail('blocked sale must never contact MATIAS');
    try {
      await withPool(fiscalQuery, async calls => {
        const res = responseMock();
        await emitMatiasSandboxInvoice(requestMock({ params: { empresaId: '33', ventaId: '140' } }), res);
        assert.equal(res.statusCode, 422);
        assert.match(res.body.message, /Confirme el desglose/);
        assert.equal(calls.some(call => call.sql.startsWith('INSERT INTO matias_documentos')), false);
      });
    } finally { https.request = original; }
  });

  test('sandbox preview validates an explicitly confirmed retention breakdown without sending or storing it', async () => {
    await withPool(fiscalQuery, async calls => {
      const res = responseMock();
      await previewMatiasSandboxInvoice(requestMock({
        params: { empresaId: '33', ventaId: '140' },
        body: { withholding_taxes: [{ tax_id: '7', tax_amount: 1350, taxable_amount: 135000, percent: 1 }] }
      }), res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.ready, true);
      assert.equal(res.body.data.payload.tax_totals[1].tax_id, '7');
      assert.ok(calls.every(call => call.sql.trim().startsWith('SELECT')));
    });
  });

test('sandbox preview rejects unauthorized tenants and existing fiscal attempts', async () => {
  await withPool(async sql => {
    if (sql.includes('FROM usuario_empresa')) return [];
    assert.fail('Unauthorized request must not load a sale');
  }, async () => {
    const res = responseMock();
    await previewMatiasSandboxInvoice(requestMock({
      user: { id: 2, tipo_usuario: 'admin_empresa' }, params: { empresaId: '33', ventaId: '140' }
    }), res);
    assert.equal(res.statusCode, 403);
  });
  await withPool(async sql => sql.includes('FROM matias_documentos')
    ? [{ id: 1, estado: 'unknown', request_uuid: 'existing-uuid' }] : fiscalQuery(sql), async calls => {
    const res = responseMock();
    await previewMatiasSandboxInvoice(requestMock({ params: { empresaId: '33', ventaId: '140' } }), res);
    assert.equal(res.statusCode, 409);
    assert.ok(calls.every(call => call.sql.trim().startsWith('SELECT')));
  });
});

test('emission sends and persists the same validated payload when withholding has been explicitly supplied', async () => {
    process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-bytes';
    const original = https.request;
    let sent;
    let requestUrl;
    https.request = (url, options, callback) => {
      requestUrl = url;
      const request = new EventEmitter();
      request.end = body => {
        sent = JSON.parse(body);
        const response = new EventEmitter();
        response.statusCode = 200;
        response.setEncoding = () => {};
        callback(response);
        process.nextTick(() => {
          response.emit('data', JSON.stringify({
            success: true, uuid: 'provider-uuid', XmlDocumentKey: 'sandbox-cufe',
            response: { IsValid: 'true', StatusCode: '00' }
          }));
          response.emit('end');
        });

      };
      return request;
    };
    try {
      await withPool(async sql => {
        if (sql.includes('FROM matias_conexiones')) return [{
          base_url: 'https://sandbox-api.matias-api.com/api/ubl2.1', pat_cifrado: encryptAuthSecret('fake-test-pat'),
          matias_company_uuid: 'client-uuid', estado: 'configurado'
        }];
        if (sql.startsWith('INSERT INTO matias_documentos')) return { insertId: 99 };
        if (/^(INSERT|UPDATE)/.test(sql.trim())) return { affectedRows: 1 };
        return fiscalQuery(sql);
      }, async calls => {
        const res = responseMock();
        await emitMatiasSandboxInvoice(requestMock({
          params: { empresaId: '33', ventaId: '140' },
          body: { withholding_taxes: [{ tax_id: '7', tax_amount: 1350, taxable_amount: 135000, percent: 1 }] }
        }), res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.data.estado, 'accepted');
        assert.equal(requestUrl.hostname, 'sandbox-api.matias-api.com');
        assert.equal(requestUrl.searchParams.get('client_uuid'), 'client-uuid');
        assert.equal(sent.document_number, '2');
        assert.equal(sent.type_document_id, 7);
        assert.equal(sent.payments[0].value_paid, '159300.00');
        const saved = calls.find(call => call.sql.trim().startsWith('INSERT INTO matias_documentos'));
        assert.deepEqual(saved.params.slice(2, 4), [sent.type_document_id, sent.operation_type_id]);
        assert.deepEqual(JSON.parse(saved.params[7]), sent);
        assert.equal(calls.filter(call => call.sql.trim().startsWith('INSERT INTO matias_documentos')).length, 1);
      });
    } finally { https.request = original; }
});

test('validation recovery preserves the failed document and requires explicit portal confirmation plus an empty provider lookup', async () => {
          process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-bytes';
          const client = require('../dist/platform/matias/matias.client');
          const original = { lookup: client.lookupMatiasDocument, emit: client.emitMatiasInvoice };
          const previous = { id: 1, request_uuid: 'old-uuid', estado: 'unknown', tipo_documento_id: 1,
            attempt_count: 1, last_http_status: 422, cufe: null, matias_uuid: null,
            response_payload: JSON.stringify({ message: 'El campo type_document_id no existe en la tabla accounting_documents' }) };
          try {
            for (const scenario of ['allowed', 'not-confirmed', 'found', 'timeout', 'malformed', 'already-retried', 'other-failure', 'concurrent']) {
              let posts = 0, lookups = 0;
              client.lookupMatiasDocument = async () => {
                lookups++;
                return scenario === 'timeout' ? { ok: false, status: 0 } :
                  { ok: true, status: 200, data: scenario === 'malformed' ? {} : { dataRecord: scenario === 'found' ? { uuid: 'found' } : null } };
              };
              client.emitMatiasInvoice = async (url, pat, uuid, payload) => {
                posts++;
                assert.equal(payload.type_document_id, 7);
                assert.notEqual(payload.uuid, 'old-uuid');
                return { ok: true, status: 200, data: { uuid: 'new-provider-uuid', response: { IsValid: 'true' } } };
              };
              await withPool(async sql => {
                if (sql.includes('FROM matias_conexiones')) return [{
                  base_url: 'https://sandbox-api.matias-api.com/api/ubl2.1', pat_cifrado: encryptAuthSecret('fake-test-pat'),
                  matias_company_uuid: 'client-uuid', estado: 'configurado'
                }];
                if (sql.includes('FROM matias_documentos')) return scenario === 'already-retried' ? [previous, { id: 2, estado: 'emitting' }] :
                  [{ ...previous, ...(scenario === 'other-failure' ? { last_http_status: 500 } : {}) }];
                if (sql.startsWith('INSERT INTO matias_documentos')) {
                  if (scenario === 'concurrent') throw Object.assign(new Error('duplicate test'), { code: 'ER_DUP_ENTRY' });
                  return { insertId: 2 };
                }
                if (/^(INSERT|UPDATE)/.test(sql.trim())) return { affectedRows: 1 };
                return fiscalQuery(sql);
              }, async calls => {
                const res = responseMock();
                await emitMatiasSandboxInvoice(requestMock({
                  params: { empresaId: '33', ventaId: '140' },
                  body: { ...optionsForRecovery(), portal_absence_confirmed: scenario !== 'not-confirmed' }
                }), res);
                assert.equal(res.statusCode, scenario === 'allowed' ? 200 : 409, scenario);
                assert.equal(posts, scenario === 'allowed' ? 1 : 0, scenario);
                assert.equal(calls.some(c => c.sql.startsWith('DELETE')), false);
                assert.ok(calls.filter(c => c.sql.trim().startsWith('UPDATE matias_documentos')).every(c => c.params.at(-2) === 2));
                if (scenario === 'allowed') {
                  assert.equal(lookups, 1);
                  assert.ok(calls.some(c => c.params?.includes('recuperar_validacion_tipo')));
                  assert.equal(calls.filter(c => c.sql.startsWith('INSERT INTO matias_documentos')).length, 1);
                }
              });
            }
          } finally { client.lookupMatiasDocument = original.lookup; client.emitMatiasInvoice = original.emit; }
        });

        function optionsForRecovery() {
          return { retry_validation_document_id: 1, withholding_taxes: [{ tax_id: '7', tax_amount: 1350, taxable_amount: 135000, percent: 1 }] };
        }

test('resolution recovery changes only the confirmed resolution, snapshots history and claims a single second attempt', async () => {
  process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-bytes';
  const client = require('../dist/platform/matias/matias.client');
  const { buildMatiasSandboxInvoice } = require('../dist/platform/matias/matias.invoice');
  const original = { lookup: client.lookupMatiasDocument, emit: client.emitMatiasInvoice };
  const lines = await fiscalQuery('SELECT p.porcentaje_iva FROM venta_detalle');
  const payment = await fiscalQuery('FROM venta_pagos');
  const previous = buildMatiasSandboxInvoice(fiscalSale, lines, payment, 'client-uuid', 'old-uuid', optionsForRecovery()).payload;
  const document = { id: 2, tipo_documento_id: 7, estado: 'unknown', attempt_count: 1, last_http_status: 400,
    request_uuid: 'old-uuid', request_payload: JSON.stringify(previous), payload_hash: 'old-hash',
    response_payload: JSON.stringify({ message: 'La resolución de facturación: 1876000001, no existe. Empresa KORE PRUEBAS MATIAS SOPORTE SAS-900999002' }) };
  try {
    for (const scenario of ['allowed', 'found', 'concurrent', 'changed-total', 'already-retried', 'no-confirmation']) {
      let posts = 0;
      client.lookupMatiasDocument = async () => ({ ok: true, status: 200, data: { dataRecord: scenario === 'found' ? {} : null } });
      client.emitMatiasInvoice = async (url, pat, uuid, payload) => {
        posts++;
        assert.equal(payload.resolution_number, '18760000001');
        return { ok: true, status: 200, data: { response: { IsValid: 'true' } } };
      };
      await withPool(async sql => {
        if (sql.includes('FROM matias_conexiones')) return [{
          base_url: 'https://sandbox-api.matias-api.com/api/ubl2.1', pat_cifrado: encryptAuthSecret('fake-test-pat'),
          matias_company_uuid: 'client-uuid', estado: 'configurado'
        }];
        if (sql.includes('FROM ventas v')) return [{ ...fiscalSale, resolucion_dian: '18760000001' }];
        if (sql.includes('FROM matias_documentos')) return [{ ...document,
          ...(scenario === 'already-retried' ? { attempt_count: 2 } : {}),
          ...(scenario === 'changed-total' ? { request_payload: JSON.stringify({ ...previous, notes: 'unreviewed' }) } : {}) }];
        if (sql.includes("SET estado = 'emitting'")) return { affectedRows: scenario === 'concurrent' ? 0 : 1 };
        if (/^(INSERT|UPDATE)/.test(sql.trim())) return { affectedRows: 1 };
        return fiscalQuery(sql);
      }, async calls => {
        const res = responseMock();
        await emitMatiasSandboxInvoice(requestMock({ params: { empresaId: '33', ventaId: '140' },
          body: { ...optionsForRecovery(), retry_validation_document_id: undefined, retry_resolution_document_id: 2,
            portal_absence_confirmed: scenario !== 'no-confirmation' } }), res);
        assert.equal(res.statusCode, scenario === 'allowed' ? 200 : 409, scenario);
        assert.equal(posts, scenario === 'allowed' ? 1 : 0, scenario);
        assert.equal(calls.some(c => c.sql.startsWith('INSERT INTO matias_documentos')), false);
        if (scenario === 'allowed') {
          const audit = calls.find(c => c.params?.includes('recuperar_resolucion'));
          assert.deepEqual(JSON.parse(audit.params[5]).request_payload_anterior, previous);
          const attempt = calls.find(c => c.sql.includes('INSERT INTO matias_documento_intentos'));
          assert.deepEqual(attempt.params.slice(0, 3), [2, 33, 2]);
          const claim = calls.find(c => c.sql.includes("SET estado = 'emitting'"));
          assert.deepEqual(claim.params.slice(3), [2, 33, 'old-hash']);
        }
      });
    }
  } finally { client.lookupMatiasDocument = original.lookup; client.emitMatiasInvoice = original.emit; }
});
