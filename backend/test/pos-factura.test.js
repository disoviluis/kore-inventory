const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function templates() {
  const browser = { console: { log() {} }, document: { addEventListener() {} }, formatFechaColombia: () => '05/11/2026' };
  vm.createContext(browser);
  for (const file of ['factura-modelo.js', 'ventas-historial.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../frontend/public/assets/js', file), 'utf8'), browser);
  }
  return browser;
}

test('historical invoice printing respects the persisted net, including unexplained historical retentions', () => {
  const browser = templates();
  const html = browser.generarHTMLFacturaVentaHistorial({
    numero_factura: 'FEV-000002', subtotal: '135000.00', impuesto: '25650.00', descuento: '0',
    retenciones: '1350.00', total: '159300.00', impuestos: []
  }, []);
  assert.match(html, /<strong>\$159\.300<\/strong>/);
  assert.doesNotMatch(html, /<strong>\$160\.650<\/strong>/);
});

test('zero persisted totals and line subtotals are not replaced with reconstructed positive values', () => {
  const browser = templates();
  const html = browser.generarHTMLFacturaVentaHistorial({
    numero_factura: 'TEST', subtotal: 100, descuento: 100, impuesto: 0, total: 0
  }, [{ cantidad: 1, precio_unitario: 100, subtotal: 0 }]);
  assert.match(html, /<strong>\$0<\/strong>/);
});

test('invoice templates show cents and reject missing totals instead of inventing one', () => {
  const browser = templates();
  assert.equal(browser.facturaModel_formatearNumero(119.01), '119,01');
  assert.throws(() => browser.generarHTMLFacturaVentaHistorial({ subtotal: 100, impuesto: 19 }, []), /total valido registrado/);
});

test('printing never presents a locally generated CUFE or QR as fiscal validation', () => {
  const browser = templates();
  const html = browser.generarHTMLFacturaVentaHistorial({
    numero_factura: 'TEST', subtotal: 100, impuesto: 19, total: 119, cufe: 'SYNTHETIC-CUFE',
    qr_code: 'data:image/png;base64,LOCAL-QR'
  }, []);
  assert.doesNotMatch(html, /SYNTHETIC-CUFE|LOCAL-QR|FACTURA ELECTRÓNICA SIIGO/);
  assert.match(html, /COMPROBANTE LOCAL/);
  assert.match(html, /No acredita una factura electronica validada/);
});

test('Sandbox printing identifies the environment and uses only the accepted provider CUFE', () => {
  const browser = templates();
  const sale = {
    numero_factura: 'FEV-000003', subtotal: 135000, impuesto: 25650, total: 160650, cufe: 'SYNTHETIC',
    documento_fiscal: { estado: 'accepted', entorno: 'sandbox', cufe: 'PROVIDER-CUFE' }
  };
  const html = browser.generarHTMLFacturaVentaHistorial(sale, []);
  assert.match(html, /PROVIDER-CUFE/);
  assert.match(html, /sin validez en Produccion/);
  assert.doesNotMatch(html, /SYNTHETIC/);
  sale.documento_fiscal.estado = 'unknown';
  assert.doesNotMatch(browser.generarHTMLFacturaVentaHistorial(sale, []), /PROVIDER-CUFE/);
  sale.documento_fiscal.estado = 'accepted';
  sale.documento_fiscal.cufe = '<img src=x onerror=alert(1)>';
  const escaped = browser.generarHTMLFacturaVentaHistorial(sale, []);
  assert.doesNotMatch(escaped, /<img src=x/);
  assert.match(escaped, /&lt;img src=x/);
});

test('POS thermal and legacy letter layouts label Sandbox and suppress synthetic fiscal fields', () => {
  const browser = {
    console: { log() {} }, localStorage: { getItem() { return null; } }, setTimeout() {},
    document: { addEventListener() {}, getElementById() { return { addEventListener() {} }; } },
    formatFechaColombia: () => '06/11/2026'
  };
  browser.window = browser;
  vm.createContext(browser);
  for (const file of ['factura-modelo.js', 'ventas.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../frontend/public/assets/js', file), 'utf8'), browser);
  }
  vm.runInContext(`currentEmpresa = { id: 33, nombre: 'PRUEBA', nit: '900999002' };
    currentUsuario = { nombre: 'PRUEBA' };`, browser);
  const sale = { numero_factura: 'FEV-000003', cufe: 'SYNTHETIC', qr_code: 'LOCAL-QR' };
  const data = { total: 119, subtotal: 100, impuesto: 19, productos: [], cliente: {} };
  for (const fiscal of [null, { estado: 'accepted', entorno: 'sandbox', cufe: 'PROVIDER-CUFE' }]) {
    sale.documento_fiscal = fiscal;
    const outputs = [browser.generarPlantillaTirilla(sale, data, {})];
    for (let plantillaId = 1; plantillaId <= 5; plantillaId++) {
      outputs.push(browser.generarPlantillaCarta(sale, data, { plantillaId, mostrarCUFE: true }));
    }
    for (const html of outputs) {
      assert.doesNotMatch(html, /SYNTHETIC|LOCAL-QR|FACTURA ELECTRÓNICA SIIGO/);
      assert.match(html, /COMPROBANTE LOCAL/);
      if (fiscal) assert.match(html, /sin validez en Produccion/);
    }
  }
});
