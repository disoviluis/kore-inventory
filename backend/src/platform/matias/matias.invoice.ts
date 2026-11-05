type Amount = string | number;

export interface MatiasSale {
  numero_factura: string;
  prefijo_factura: string;
  resolucion_dian: string;
  subtotal: Amount;
  descuento: Amount;
  impuesto: Amount;
  retenciones: Amount;
  total: Amount;
  impuestos_adicionales: Amount;
  propina_valor: Amount;
  estado: string;
  forma_pago: string;
  tipo_documento: string;
  numero_documento: string;
  digito_verificacion: string | null;
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  email: string | null;
  direccion: string | null;
  ciudad: string | null;
  tipo_cliente: string;
  regimen_tributario: string | null;
  responsabilidad_fiscal: string | null;
}

export interface MatiasLine {
  producto_id: number;
  cantidad: Amount;
  precio_unitario: Amount;
  descuento: Amount;
  subtotal: Amount;
  nombre: string | null;
  descripcion: string | null;
  porcentaje_iva: Amount;
  aplica_iva: number;
  tipo_impuesto: string;
  unidad_medida: string | null;
}

export interface MatiasPayment { metodo_pago: string; monto: Amount }
interface Tax { tax_id: string; tax_amount: number; taxable_amount: number; percent: number }

export class MatiasInvoiceValidationError extends Error {}

function requireInvoice(condition: unknown, message: string): asserts condition {
  if (!condition) throw new MatiasInvoiceValidationError(message);
}

function numeric(value: unknown, field: string): number {
  requireInvoice((typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())) ||
    (typeof value === 'number' && Number.isFinite(value)), `${field}: valor numerico obligatorio`);
  const result = Number(value);
  requireInvoice(result >= 0 && Number.isFinite(result), `${field}: valor invalido`);
  return result;
}

function cents(value: unknown, field: string): number {
  const result = numeric(value, field) * 100;
  requireInvoice(Number.isSafeInteger(Math.round(result)) && Math.abs(result - Math.round(result)) < 0.00001,
    `${field}: se requieren como maximo dos decimales`);
  return Math.round(result);
}

const money = (value: number) => (value / 100).toFixed(2);
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function fiscalDocumentNumber(invoice: string, prefix: string): string {
  requireInvoice(Boolean(prefix?.trim()), 'Debe configurar el prefijo fiscal');
  const number = invoice?.trim() || '';
  requireInvoice(number.toUpperCase().startsWith(prefix.toUpperCase()), 'El numero de venta no coincide con el prefijo fiscal');
  const suffix = number.slice(prefix.length).replace(/^-/, '');
  requireInvoice(/^\d+$/.test(suffix) && Number.isSafeInteger(Number(suffix)) && Number(suffix) > 0,
    'El consecutivo fiscal debe ser un entero positivo');
  return String(Number(suffix));
}

// Historic sales store only the withholding sum. Never guess its tax type or rate.
function withholdingTaxes(value: unknown, expected: number, subtotal: number, iva: number): Tax[] {
  if (value === undefined) return [];
  requireInvoice(Array.isArray(value), 'withholding_taxes debe ser un arreglo');
  const taxes = value.map((item: unknown) => {
    requireInvoice(item !== null && typeof item === 'object', 'Retencion invalida');
    const tax = item as Record<string, unknown>;
    const id = String(tax.tax_id);
    requireInvoice(['5', '6', '7'].includes(id), 'Retencion: tax_id debe ser ReteIVA (5), ReteRenta (6) o ReteICA (7)');
    const amount = cents(tax.tax_amount, 'Retencion');
    const base = cents(tax.taxable_amount, 'Base de retencion');
    const percent = numeric(tax.percent, 'Tarifa de retencion');
    requireInvoice(base <= (id === '5' ? iva : subtotal), 'La base de retencion supera el IVA o subtotal aplicable');
    requireInvoice(base > 0 && amount > 0 && percent > 0 && percent <= 100 &&
      Math.round(base * percent / 100) === amount, 'La retencion no coincide con su base y tarifa porcentual');
    return { tax_id: id, tax_amount: amount / 100, taxable_amount: base / 100, percent };
  });
  requireInvoice(taxes.reduce((sum, tax) => sum + Math.round(tax.tax_amount * 100), 0) === expected,
    'El desglose de retenciones no coincide con el total registrado en la venta');
  return taxes;
}

export function buildMatiasSandboxInvoice(
  sale: MatiasSale, details: MatiasLine[], payments: MatiasPayment[],
  clientUuid: string, requestUuid: string, options: Record<string, unknown> = {}
) {
  requireInvoice(Boolean(clientUuid?.trim()), 'Falta client_uuid');
  requireInvoice(Boolean(sale.resolucion_dian?.trim()), 'Falta la resolucion fiscal');
  requireInvoice(sale.estado === 'pagada' && sale.forma_pago === 'contado',
    'La emision Sandbox soporta ventas pagadas de contado; no emitir una venta pendiente o anulada');
  const subtotal = cents(sale.subtotal, 'Subtotal');
  const iva = cents(sale.impuesto, 'IVA');
  const withheld = cents(sale.retenciones, 'Retenciones');
  const net = cents(sale.total, 'Total');
  requireInvoice(cents(sale.descuento, 'Descuento') === 0 &&
    cents(sale.impuestos_adicionales, 'Impuestos adicionales') === 0 && cents(sale.propina_valor, 'Propina') === 0,
    'Esta emision Sandbox aun no soporta descuentos globales, impuestos adicionales ni propina');
  requireInvoice(subtotal + iva - withheld === net && net > 0,
    'El subtotal, IVA, retenciones y total neto de la venta no cuadran');
  const prefix = sale.prefijo_factura?.trim() || '';
  const documentNumber = fiscalDocumentNumber(sale.numero_factura, prefix);
  requireInvoice(details.length > 0, 'La venta no tiene productos');
  const groups = new Map<number, { base: number; amount: number }>();
  let lineTotal = 0;
  const lines = details.map(line => {
    const quantity = numeric(line.cantidad, 'Cantidad');
    const price = cents(line.precio_unitario, 'Precio unitario');
    const base = cents(line.subtotal, 'Subtotal de linea');
    requireInvoice(quantity > 0 && base > 0 && Math.round(quantity * price) === base &&
      cents(line.descuento, 'Descuento de linea') === 0,
      'La linea no cuadra o contiene descuentos aun no soportados');
    requireInvoice(Boolean(line.nombre) && Number.isInteger(line.producto_id) && line.producto_id > 0,
      'Producto inexistente o sin nombre en la empresa de la venta');
    requireInvoice(['unidad', 'und', 'un', 'u'].includes(normalized(line.unidad_medida || '')),
      'Unidad de medida sin equivalencia MATIAS; configure el mapeo antes de emitir');
    requireInvoice(['gravado', 'exento', 'excluido'].includes(line.tipo_impuesto), 'Tipo de impuesto de producto no confirmado');
    const taxable = line.tipo_impuesto === 'exento' || line.tipo_impuesto === 'gravado' && Boolean(line.aplica_iva);
    const rate = taxable && line.tipo_impuesto === 'gravado' ? numeric(line.porcentaje_iva, 'Tarifa IVA') : 0;
    requireInvoice([0, 5, 19].includes(rate), 'Tarifa IVA no soportada');
    const amount = Math.round(base * rate / 100);
    lineTotal += base;
    if (taxable) {
      const group = groups.get(rate) || { base: 0, amount: 0 };
      groups.set(rate, { base: group.base + base, amount: group.amount + amount });
    }
    return {
      invoiced_quantity: String(quantity), line_extension_amount: money(base),
      description: line.nombre, code: String(line.producto_id),
      type_item_identifications_id: '4', quantity_units_id: '1093',
      price_amount: money(price), base_quantity: '1', free_of_charge_indicator: false,
      tax_totals: taxable ? [{ tax_id: '1', tax_amount: amount / 100, taxable_amount: base / 100, percent: rate }] : []
    };
  });
  requireInvoice(lineTotal === subtotal,
    'La suma de lineas no coincide con el subtotal de la venta');
  requireInvoice([...groups.values()].reduce((sum, group) => sum + group.amount, 0) === iva,
    'El IVA por producto no coincide con la venta; revise las tarifas historicas antes de emitir');
  const taxes: Tax[] = [...groups].map(([percent, group]) => ({
    tax_id: '1', tax_amount: group.amount / 100, taxable_amount: group.base / 100, percent
  }));
  const retentions = withholdingTaxes(options.withholding_taxes, withheld, subtotal, iva);
  taxes.push(...retentions);
  const blockingErrors: string[] = [];
  if (withheld > 0 && options.withholding_taxes === undefined) {
    blockingErrors.push('Confirme el desglose de retenciones (withholding_taxes): la venta solo conserva el total, no el tipo ni la tarifa. No se emitira hasta confirmarlo.');
  }

  const identityIds: Record<string, number> = { CC: 1, CE: 2, NIT: 3, RC: 6, TI: 7, TE: 8, PA: 9, PASAPORTE: 9, PPT: 13, PEP: 14 };
  const identity = identityIds[sale.tipo_documento?.toUpperCase()];
  requireInvoice(Number.isInteger(identity), 'Tipo de documento del cliente sin equivalencia MATIAS');
  requireInvoice(['empresa', 'natural', 'individual', 'persona'].includes(sale.tipo_cliente),
    'Tipo de organizacion del cliente no confirmado');
  let dni = sale.numero_documento?.trim() || '';
  if (identity === 3) {
    // Drop a formatted NIT's DV before removing punctuation, not afterwards.
    dni = dni.split('-')[0].replace(/[.\s]/g, '');
    requireInvoice(/^\d+$/.test(dni), 'NIT del cliente invalido');
  }
  requireInvoice(/^[A-Za-z0-9]+$/.test(dni), 'Documento del cliente obligatorio; no se sustituye por consumidor final');
  const name = sale.razon_social?.trim() || `${sale.nombre || ''} ${sale.apellido || ''}`.trim();
  requireInvoice(Boolean(name) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sale.email || ''),
    'El cliente requiere nombre y correo valido');
  requireInvoice(Boolean(sale.direccion?.trim()), 'El cliente requiere direccion');
  const regime = normalized(sale.regimen_tributario || '');
  requireInvoice(['comun', 'simplificado', 'responsable de iva', 'no responsable de iva'].includes(regime),
    'Regimen IVA del cliente no confirmado');
  const fiscalIds: Record<string, number> = { 'O-13': 1, 'O-15': 2, 'O-23': 3, 'O-47': 4, 'R-99-PN': 5 };
  const fiscalValue = sale.responsabilidad_fiscal?.trim().toUpperCase();
  const fiscalCode = fiscalValue?.match(/^(O-13|O-15|O-23|O-47|R-99-PN)(?:\s+[-:\u2013\u2014\u00b7]\s+.+)?$/)?.[1];
  requireInvoice(!fiscalValue || Boolean(fiscalCode), 'Responsabilidad fiscal del cliente sin equivalencia MATIAS');
  const city = normalized(sale.ciudad || '').replace(/[.,]/g, '').replace(/\s+/g, ' ');
  const cityId = options.customer_city_id ?? (['bogota', 'bogota dc', '11001'].includes(city) ? 149 : undefined);
  requireInvoice(Number.isInteger(cityId) && Number(cityId) > 0,
    'Falta customer_city_id del catalogo MATIAS para la ciudad del cliente');
  const warnings = [];
  if (!fiscalCode) warnings.push('Responsabilidad fiscal del cliente vacia: se omite tax_level_id; MATIAS documenta por defecto 5 (R-99-PN). Confirmar antes de emitir.');
  warnings.push('IVA de lineas contrastado con el total registrado usando las tarifas actuales de productos; no constituye certificacion tributaria.');

  requireInvoice(payments.length > 0, 'Falta el detalle del pago');
  const paymentIds: Record<string, number> = { efectivo: 10, transferencia: 30, tarjeta_credito: 48, tarjeta_debito: 49, consignacion: 42 };
  const received = payments.map(payment => {
    const method = normalized(payment.metodo_pago);
    requireInvoice(Number.isInteger(paymentIds[method]), 'Medio de pago sin equivalencia MATIAS; no se sustituye por efectivo');
    return { method, amount: cents(payment.monto, 'Pago') };
  });
  const cash = received.filter(payment => payment.method === 'efectivo').reduce((sum, p) => sum + p.amount, 0);
  const tendered = received.reduce((sum, p) => sum + p.amount, 0);
  let change = tendered - net;
  requireInvoice(change >= 0 && change <= cash, 'Los pagos no cubren el neto o el excedente no corresponde a efectivo');
  const fiscalPayments = received.map(payment => {
    const returned = payment.method === 'efectivo' ? Math.min(change, payment.amount) : 0;
    change -= returned;
    return { payment_method_id: 1, means_payment_id: paymentIds[payment.method], value_paid: money(payment.amount - returned) };
  }).filter(payment => payment.value_paid !== '0.00');
  return {
    payload: {
      client_uuid: clientUuid, uuid: requestUuid, resolution_number: sale.resolucion_dian.trim(),
      prefix, document_number: documentNumber,
      operation_type_id: 1, type_document_id: 7, graphic_representation: true, send_email: false,
      customer: {
        company_name: name, dni, ...(identity === 3 && sale.digito_verificacion != null ? { dv: String(sale.digito_verificacion) } : {}),
        identity_document_id: identity, type_organization_id: sale.tipo_cliente === 'empresa' ? 1 : 2,
        tax_regime_id: ['comun', 'responsable de iva'].includes(regime) ? 1 : 2,
        ...(fiscalCode ? { tax_level_id: fiscalIds[fiscalCode] } : {}),
        country_id: 45, city_id: Number(cityId), email: sale.email, address: sale.direccion
      },
      payments: fiscalPayments, lines, tax_totals: taxes,
      legal_monetary_totals: {
        line_extension_amount: money(subtotal),
        tax_exclusive_amount: money([...groups].filter(([rate]) => rate > 0).reduce((sum, [, group]) => sum + group.base, 0)),
        // MATIAS' retention example keeps the fiscal payable gross of withholdings.
        tax_inclusive_amount: money(subtotal + iva), payable_amount: money(subtotal + iva)
      }
    },
    blockingErrors, warnings,
    reconciliation: { gross: money(subtotal + iva), withholdings: money(withheld), net: money(net), tendered: money(tendered), change: money(tendered - net) }
  };
}
