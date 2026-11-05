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
