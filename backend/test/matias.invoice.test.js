const assert = require('node:assert/strict');
const test = require('node:test');
const { buildMatiasSandboxInvoice: build, fiscalDocumentNumber, MatiasInvoiceValidationError } = require('../dist/platform/matias/matias.invoice');

const sale = {
  numero_factura: 'FEV-000002', prefijo_factura: 'FEV', resolucion_dian: '1876000001',
  subtotal: '135000.00', descuento: '0.00', impuesto: '25650.00', retenciones: '1350.00',
  total: '159300.00', impuestos_adicionales: '0.00', propina_valor: '0.00',
  estado: 'pagada', forma_pago: 'contado', tipo_documento: 'NIT', numero_documento: '900123456',
  digito_verificacion: '8', nombre: null, apellido: null, razon_social: 'CLIENTE SINTETICO',
  email: 'cliente@example.invalid', direccion: 'Calle de prueba', ciudad: 'Bogotá',
  tipo_cliente: 'empresa', regimen_tributario: 'simplificado', responsabilidad_fiscal: null
};
const line = {
  producto_id: 1943, cantidad: '1.000', precio_unitario: '135000.00', descuento: '0.00',
  subtotal: '135000.00', nombre: 'Producto de prueba', descripcion: null,
  porcentaje_iva: '19.00', aplica_iva: 1, tipo_impuesto: 'gravado', unidad_medida: 'UND'
};
const payments = [{ metodo_pago: 'efectivo', monto: '170000.00' }];
const options = { withholding_taxes: [{ tax_id: '7', tax_amount: 1350, taxable_amount: 135000, percent: 1 }] };
const invoice = (overrides = {}, lines = [line], paid = payments, settings = options) =>
  build({ ...sale, ...overrides }, lines, paid, 'client-uuid', 'request-uuid', settings);

test('FEV sale normalizes consecutive, maps customer and separates IVA, retention, cash and change', () => {
  const { payload, reconciliation, blockingErrors } = invoice();
  assert.equal(payload.document_number, '2');
  assert.equal(payload.type_document_id, 7, 'MATIAS catalog API id, not DIAN code 01');
  assert.equal(payload.prefix, 'FEV');
  assert.equal(payload.client_uuid, 'client-uuid');
  assert.equal(payload.uuid, 'request-uuid');
  assert.equal(payload.send_email, false);
  assert.equal(payload.customer.identity_document_id, 3);
  assert.equal(payload.customer.type_organization_id, 1);
  assert.equal(payload.customer.tax_regime_id, 2);
  assert.equal(payload.customer.city_id, 149);
  assert.equal('city_name' in payload.customer, false);
  assert.equal('tax_level_id' in payload.customer, false);
  assert.deepEqual(payload.tax_totals, [
    { tax_id: '1', tax_amount: 25650, taxable_amount: 135000, percent: 19 },
    { tax_id: '7', tax_amount: 1350, taxable_amount: 135000, percent: 1 }
  ]);
  assert.deepEqual(payload.lines[0].tax_totals, [payload.tax_totals[0]]);
  assert.equal(payload.lines[0].code, '1943');
  assert.equal(payload.lines[0].type_item_identifications_id, '4');
  assert.equal(payload.payments[0].value_paid, '159300.00');
  assert.deepEqual(payload.legal_monetary_totals, {
    line_extension_amount: '135000.00', tax_exclusive_amount: '135000.00',
    tax_inclusive_amount: '160650.00', payable_amount: '160650.00'
  });
  assert.deepEqual(reconciliation, { gross: '160650.00', withholdings: '1350.00', net: '159300.00', tendered: '170000.00', change: '10700.00' });
  assert.deepEqual(blockingErrors, []);
});

test('historic aggregate withholding never implies a confirmed tax type', () => {
  const result = invoice({}, [line], payments, {});
  assert.equal(result.blockingErrors.length, 1);
  assert.match(result.blockingErrors[0], /Confirme el desglose/);
  assert.equal(result.payload.tax_totals.length, 1);
  assert.equal(result.reconciliation.withholdings, '1350.00');
});

test('consecutives handle literal prefixes and reject malformed or mismatched numbers', () => {
  assert.equal(fiscalDocumentNumber('FEV000002', 'FEV'), '2');
  assert.equal(fiscalDocumentNumber('F.E-000002', 'F.E'), '2');
  assert.equal(fiscalDocumentNumber('fev-000002', 'FEV'), '2');
  for (const number of ['FAC-000002', 'FEV--2', 'FEV-0', 'FEV-2x', 'FEV-1.5', 'FEV-9007199254740992']) {
    assert.throws(() => fiscalDocumentNumber(number, 'FEV'), MatiasInvoiceValidationError);
  }
});

test('NIT formatting removes DV before punctuation; documentless clients are not replaced', () => {
  assert.equal(invoice({ numero_documento: '900.123.456-8' }).payload.customer.dni, '900123456');
  assert.throws(() => invoice({ numero_documento: '' }), /NIT del cliente invalido/);
  assert.throws(() => invoice({ tipo_documento: 'DESCONOCIDO' }), /Tipo de documento/);
  const client = invoice({ tipo_documento: 'CC', numero_documento: '123456789', tipo_cliente: 'persona', responsabilidad_fiscal: 'R-99-PN' }).payload.customer;
  assert.equal(client.identity_document_id, 1);
  assert.equal(client.type_organization_id, 2);
  assert.equal(client.tax_level_id, 5);
});

test('invalid monetary inputs and unsupported adjustments block emission explicitly', () => {
  for (const changes of [{ total: '159301.00' }, { subtotal: null }, { impuesto: 'NaN' }, { retenciones: -1 },
    { total: 159300.001 }, { descuento: '1.00' }, { propina_valor: '1.00' }, { impuestos_adicionales: '1.00' },
    { estado: 'anulada' }, { forma_pago: 'credito' }]) {
    assert.throws(() => invoice(changes), MatiasInvoiceValidationError);
  }
});

test('fiscal responsibility accepts an explicit catalog code with its display label, never inferring it from text', () => {
  for (const [responsabilidad_fiscal, id] of [
    ['R-99-PN', 5], ['R-99-PN \u2014 No aplica/Otros.', 5],
    ['O-13 - Gran contribuyente', 1], ['o-15 : Autorretenedor', 2],
    ['O-23 \u00b7 Agente de retencion IVA', 3], ['O-47 \u2013 Regimen simple', 4]
  ]) {
    assert.equal(invoice({ responsabilidad_fiscal }).payload.customer.tax_level_id, id);
    assert.equal(invoice({ responsabilidad_fiscal }).warnings.some(w => w.includes('Responsabilidad fiscal del cliente vacia')), false);
  }
  for (const responsabilidad_fiscal of ['No aplica/Otros', 'R-99-PNX', 'O-13, O-23', 'O-99', 'R-99-PN O-13']) {
    assert.throws(() => invoice({ responsabilidad_fiscal }), /Responsabilidad fiscal/);
  }
});

test('line subtotals and current IVA rates must reconcile with the recorded sale', () => {
  assert.throws(() => invoice({}, [{ ...line, porcentaje_iva: '5.00' }]), /IVA por producto no coincide/);
  assert.throws(() => invoice({}, [{ ...line, subtotal: '134000.00' }]), /linea no cuadra/);
  assert.throws(() => invoice({}, [{ ...line, nombre: null }]), /Producto inexistente/);
  assert.throws(() => invoice({}, [{ ...line, unidad_medida: 'kg' }]), /Unidad de medida/);
});

test('mixed IVA rates are grouped by rate with no invented distribution', () => {
  const lines = [
    { ...line, precio_unitario: '100.00', subtotal: '100.00' },
    { ...line, precio_unitario: '200.00', subtotal: '200.00', porcentaje_iva: '5.00' },
    { ...line, precio_unitario: '100.00', subtotal: '100.00', porcentaje_iva: '0.00', tipo_impuesto: 'excluido' }
  ];
  const result = invoice({ subtotal: '400.00', impuesto: '29.00', retenciones: '0.00', total: '429.00' }, lines,
    [{ metodo_pago: 'efectivo', monto: '500.00' }], {});
  assert.deepEqual(result.payload.tax_totals.map(tax => tax.percent), [19, 5]);
  assert.equal(result.payload.legal_monetary_totals.tax_exclusive_amount, '300.00');
  assert.deepEqual(result.payload.lines[2].tax_totals, []);
});

test('withholding input must match the saved total, percentage and applicable base', () => {
  for (const tax of [
    { tax_id: '1', tax_amount: 1350, taxable_amount: 135000, percent: 1 },
    { tax_id: '7', tax_amount: 1351, taxable_amount: 135000, percent: 1 },
    { tax_id: '7', tax_amount: 2700, taxable_amount: 135000, percent: 2 },
    { tax_id: '7', tax_amount: 1350, taxable_amount: 1350000, percent: 0.1 },
    { tax_id: '5', tax_amount: 1350, taxable_amount: 135000, percent: 1 }
  ]) {
    assert.throws(() => invoice({}, [line], payments, { withholding_taxes: [tax] }), MatiasInvoiceValidationError);
  }
  assert.throws(() => invoice({}, [line], payments, { withholding_taxes: [] }), /desglose/);
});

test('payments subtract change only from cash and reject unknown or insufficient tenders', () => {
  const result = invoice({}, [line], [
    { metodo_pago: 'tarjeta_credito', monto: '100000.00' }, { metodo_pago: 'efectivo', monto: '70000.00' }
  ]);
  assert.deepEqual(result.payload.payments.map(p => [p.means_payment_id, p.value_paid]), [[48, '100000.00'], [10, '59300.00']]);
  assert.throws(() => invoice({}, [line], [{ metodo_pago: 'efectivo', monto: '159299.00' }]), /pagos no cubren/);
  assert.throws(() => invoice({}, [line], [{ metodo_pago: 'tarjeta_credito', monto: '170000.00' }]), /excedente/);
  assert.throws(() => invoice({}, [line], [{ metodo_pago: 'otro', monto: '170000.00' }]), /Medio de pago/);
  assert.throws(() => invoice({}, [line], []), /detalle del pago/);
});

test('unknown cities need an explicit provider ID and optional fiscal values are not invented', () => {
  assert.throws(() => invoice({ ciudad: 'Otra ciudad' }), /customer_city_id/);
  const result = invoice({ ciudad: 'Otra ciudad' }, [line], payments, { ...options, customer_city_id: 836 });
  assert.equal(result.payload.customer.city_id, 836);
  assert.match(result.warnings[0], /Responsabilidad fiscal.*vacia/);
  assert.throws(() => invoice({ responsabilidad_fiscal: 'inventada' }), /Responsabilidad fiscal/);
  assert.throws(() => invoice({ email: '' }), /correo valido/);
});
