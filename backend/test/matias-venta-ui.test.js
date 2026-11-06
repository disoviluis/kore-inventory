const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(responses, options = {}) {
  class Element {
    constructor() { this.children = []; this.textContent = ''; this.disabled = false; this.handlers = {}; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute() {}
    closest() { return null; }
    addEventListener(event, handler) { this.handlers[event] = handler; }
    async click() { if (!this.disabled) await this.handlers.click(); }
    get text() { return [this.textContent, ...this.children.map(child => child.text)].join(' '); }
  }
  const calls = [];
  const session = options.session || new Map();
  const context = {
    URL, document: { createElement: () => new Element() },
    localStorage: { getItem: () => 'test-session-not-a-real-token' },
    sessionStorage: { getItem: key => session.get(key), setItem: (key, value) => session.set(key, value) },
    confirm: text => { calls.push({ confirmation: text }); return options.confirm !== false; },
    fetch: async (url, init) => {
      calls.push({ url, init });
      assert.ok(responses.length, `Unexpected request ${url}`);
      const next = responses.shift();
      if (next instanceof Error) throw next;
      if (typeof next === 'function') return next();
      const status = next.status || 200;
      return { status, ok: status < 400, json: async () => ({ success: status < 400, ...next }) };
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../frontend/public/assets/js/matias-venta.js'), 'utf8'), context);
  const container = new Element();
  const sale = { id: 141, empresa_id: 33, estado: 'pagada', numero_factura: 'FEV-000003', ...options.sale };
  let expired = 0;
  const dispose = context.MatiasVenta.mount({
    container, empresaId: 33, venta: sale, usuario: { tipo_usuario: options.role || 'admin_empresa' },
    onUnauthorized: () => expired++, isCurrent: options.isCurrent
  });
  const section = container.children[0];
  return {
    calls, session, sale, dispose, context,
    emit: section.children[4], refresh: section.children[3],
    text: () => container.text, expired: () => expired,
    ready: () => new Promise(resolve => setImmediate(resolve))
  };
}
const preview = { data: { ready: true, payload: { legal_monetary_totals: { payable_amount: 160650 }, customer: { company_name: 'CLIENTE PRUEBA', dni: '123' } }, reconciliation: { gross: '160650.00', withholdings: '0.00', net: '160650.00' }, warnings: ['SOLO SANDBOX'] } };
const doc = { id: 2, entorno: 'sandbox', estado: 'accepted', cufe: 'CUFE-REAL-SANDBOX', pdf_path: 'https://sandbox-api.matias-api.com/prueba.pdf', qr_url: 'javascript:alert(1)' };

test('accepted Sandbox document is visible and never offers another POST', async () => {
  const h = harness([{ data: doc }]);
  await h.ready();
  assert.match(h.text(), /Aceptada en Sandbox/);
  assert.match(h.text(), /CUFE-REAL-SANDBOX/);
  assert.equal(h.emit.disabled, true);
  await h.emit.click();
  assert.equal(h.calls.length, 1);
  assert.equal(h.context.MatiasVenta.safeLink(doc.qr_url), null);
  assert.equal(h.context.MatiasVenta.safeLink('http://insecure.test'), null);
  assert.equal(h.context.MatiasVenta.safeLink('https://user:password@example.com'), null);
  assert.equal(h.context.MatiasVenta.safeLink('https://matias-api.com.attacker.test'), null);
  assert.equal(h.context.MatiasVenta.safeLink('https://unknown.test/file.pdf'), null);
  assert.equal(h.context.MatiasVenta.safeLink(doc.pdf_path), doc.pdf_path);
});

test('preview shows amount, customer and warnings; cancel does not POST or latch', async () => {
  const h = harness([{ data: null }, { data: null }, preview], { confirm: false });
  await h.ready();
  await h.emit.click();
  assert.match(h.calls[3].confirmation, /160650[\s\S]*CLIENTE PRUEBA[\s\S]*SOLO SANDBOX/);
  assert.equal(h.session.size, 0);
  assert.equal(h.emit.disabled, false);
  assert.ok(h.calls.every(call => !call.url?.endsWith('/emitir-sandbox')));
});

test('one confirmed emission refreshes persisted state without creating another sale', async () => {
  const h = harness([{ data: null }, { data: null }, preview, { message: 'Enviado', data: { estado: 'accepted' } }, { data: doc }]);
  await h.ready();
  await Promise.all([h.emit.click(), h.emit.click()]);
  assert.equal(h.calls.filter(call => call.url?.endsWith('/emitir-sandbox')).length, 1);
  assert.match(h.text(), /Aceptada en Sandbox/);
  assert.equal(h.sale.documento_fiscal.cufe, doc.cufe);
  assert.equal(h.emit.disabled, true);
  assert.equal(h.session.get('matias-sandbox-intento:33:141'), 'iniciado');
});

test('lost POST response blocks further attempts, even if a later GET returns no document', async () => {
  const session = new Map();
  const h = harness([{ data: null }, { data: null }, preview, new Error('Conexion perdida'), { data: null }], { session });
  await h.ready();
  await h.emit.click();
  assert.equal(h.emit.disabled, true);
  assert.match(h.text(), /No reenvie/);
  const reopened = harness([{ data: null }], { session });
  await reopened.ready();
  assert.equal(reopened.emit.disabled, true);
  assert.match(reopened.text(), /envio iniciado/);
});

test('failed lookup is not interpreted as absence and can be explicitly refreshed', async () => {
  const h = harness([new Error('Sin conexion'), { data: null }]);
  await h.ready();
  assert.equal(h.emit.disabled, true);
  assert.match(h.text(), /No se pudo consultar/);
  await h.refresh.click();
  assert.equal(h.emit.disabled, false);
});

test('malformed success or a production document never enables Sandbox emission', async () => {
  for (const response of [{}, { data: { ...doc, entorno: 'produccion' } }]) {
    const h = harness([response]);
    await h.ready();
    assert.equal(h.emit.disabled, true);
    assert.match(h.text(), /no devolvio un estado Sandbox valido/);
  }
});

test('validation failure and unauthorized session do not emit', async () => {
  const h = harness([{ data: null }, { data: null }, { status: 422, message: 'Responsabilidad fiscal invalida' }]);
  await h.ready();
  await h.emit.click();
  assert.match(h.text(), /Responsabilidad fiscal invalida/);
  assert.equal(h.session.size, 0);
  const expired = harness([{ status: 401 }]);
  await expired.ready();
  assert.equal(expired.expired(), 1);
  assert.equal(expired.emit.disabled, true);
  const denied = harness([{ status: 403, message: 'No tiene acceso' }]);
  await denied.ready();
  assert.equal(denied.emit.disabled, true);
  assert.match(denied.text(), /No tiene acceso/);
});

test('every existing state blocks resubmission; a cashier cannot emit or query', async () => {
  for (const estado of ['created', 'emitting', 'emitted', 'rejected', 'unknown', 'voided']) {
    const h = harness([{ data: { ...doc, estado } }]);
    await h.ready();
    assert.equal(h.emit.disabled, true, estado);
  }
  const h = harness([], { role: 'cajero' });
  await h.ready();
  assert.equal(h.calls.length, 0);
  assert.equal(h.emit.disabled, true);
  assert.match(h.text(), /requieren un administrador/);
});

test('disposing or changing company while a lookup is pending cannot emit or mutate the sale', async () => {
  let resolve;
  const h = harness([() => new Promise(done => { resolve = done; })]);
  h.dispose();
  resolve({ status: 200, ok: true, json: async () => ({ success: true, data: doc }) });
  await h.ready();
  assert.equal(h.sale.documento_fiscal, undefined);
  assert.equal(h.emit.disabled, true);
  let current = true;
  const changed = harness([{ data: null }, () => {
    current = false;
    return { status: 200, ok: true, json: async () => ({ success: true, data: null }) };
  }], { isCurrent: () => current });
  await changed.ready();
  await changed.emit.click();
  assert.equal(changed.calls.length, 2);
  assert.equal(changed.emit.disabled, true);
});
