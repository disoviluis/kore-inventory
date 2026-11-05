(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.PosCalculos = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    class ErrorCalculo extends Error {
        constructor(message) { super(message); this.status = 422; }
    }
    function exigir(condition, message) { if (!condition) throw new ErrorCalculo(message); }
    function entero(value, decimals, field) {
        exigir(typeof value === 'number' || typeof value === 'string', `${field}: valor obligatorio`);
        const text = String(value).trim();
        exigir(/^\d+(\.\d+)?$/.test(text), `${field}: debe ser un numero no negativo`);
        const [whole, fraction = ''] = text.split('.');
        const significantFraction = fraction.replace(/0+$/, '');
        exigir(significantFraction.length <= decimals, `${field}: maximo ${decimals} decimales`);
        const result = BigInt(whole) * 10n ** BigInt(decimals) +
            BigInt(significantFraction.padEnd(decimals, '0') || '0');
        exigir(result <= BigInt(Number.MAX_SAFE_INTEGER), `${field}: valor fuera de rango`);
        return Number(result);
    }
    function dividir(numerator, denominator) {
        const n = BigInt(numerator), d = BigInt(denominator);
        exigir(d > 0n, 'Base de calculo invalida');
        const result = Number((n + d / 2n) / d);
        exigir(Number.isSafeInteger(result), 'Importe fuera de rango');
        return result;
    }
    const importe = value => value / 100;
    const centavos = (value, field = 'Importe') => entero(value, 2, field);
    const sumar = values => {
        const result = values.reduce((sum, value) => sum + value, 0);
        exigir(Number.isSafeInteger(result), 'Total fuera de rango');
        return result;
    };
    const porcentaje = (base, rate) => dividir(BigInt(base) * BigInt(rate), 1000000);

    function calcular(input) {
        exigir(Array.isArray(input.productos), 'Productos invalidos');
        const lineas = input.productos.map(line => {
            const cantidad = entero(line.cantidad, 3, 'Cantidad');
            exigir(cantidad > 0, 'La cantidad debe ser mayor que cero');
            const precio = centavos(line.precio_unitario, 'Precio');
            const descuento = centavos(line.descuento ?? 0, 'Descuento de linea');
            const gross = dividir(BigInt(precio) * BigInt(cantidad), 1000);
            exigir(descuento <= gross, 'Descuento de linea mayor que su importe');
            const taxable = Number(line.aplica_iva) === 1 && (!line.tipo_impuesto || line.tipo_impuesto === 'gravado');
            const tarifa = taxable ? entero(line.porcentaje_iva, 4, 'Tarifa IVA') : 0;
            exigir(tarifa <= 1000000, 'Tarifa IVA mayor al 100%');
            const included = Number(line.iva_incluido_en_precio) === 1 && taxable;
            const base = included ? dividir(BigInt(gross - descuento) * 1000000n, 1000000 + tarifa) : gross - descuento;
            return { ...line, base, tarifa, incluido: included, bruto: gross - descuento };
        });
        const subtotal = sumar(lineas.map(line => line.base));
        const descuento = centavos(input.descuento ?? 0, 'Descuento global');
        exigir(descuento <= subtotal, 'El descuento global supera el subtotal');
        let acumulado = 0, distribuido = 0;
        let iva = 0;
        const productos = lineas.map(line => {
            acumulado += line.base;
            const nuevo = subtotal ? dividir(BigInt(descuento) * BigInt(acumulado), subtotal) : 0;
            const rebaja = nuevo - distribuido;
            distribuido = nuevo;
            const base = line.base - rebaja;
            const impuesto = line.incluido && descuento === 0 ? line.bruto - line.base : porcentaje(base, line.tarifa);
            iva += impuesto;
            return { ...line, subtotal: importe(line.base), base_gravable: importe(base), iva_valor: importe(impuesto) };
        });
        const base = subtotal - descuento;
        const seleccionados = new Set();
        const impuestos = (input.impuestos ?? []).map(tax => {
            exigir(!seleccionados.has(String(tax.id)), 'Impuesto seleccionado mas de una vez');
            seleccionados.add(String(tax.id));
            exigir(['subtotal', 'iva', 'total'].includes(tax.aplica_sobre), 'Base de impuesto no configurada');
            exigir(['suma', 'resta'].includes(tax.afecta_total), 'Afectacion de impuesto no configurada');
            const taxable = tax.aplica_sobre === 'iva' ? iva : tax.aplica_sobre === 'total' ? base + iva : base;
            exigir(['porcentaje', 'valor_fijo'].includes(tax.tipo), 'Tipo de impuesto no configurado');
            const rate = entero(tax.tasa, 4, 'Tasa');
            exigir(tax.tipo !== 'porcentaje' || rate <= 1000000, 'Tasa de impuesto mayor al 100%');
            const value = tax.tipo === 'porcentaje' ? porcentaje(taxable, rate) : centavos(tax.tasa, 'Impuesto fijo');
            return { impuesto_id: tax.id, codigo: tax.codigo, nombre: tax.nombre,
                base_calculo: importe(taxable), tasa: Number(tax.tasa), valor: importe(value), afecta_total: tax.afecta_total };
        });
        const adicionales = sumar(impuestos.filter(tax => tax.afecta_total === 'suma').map(tax => centavos(tax.valor)));
        const retenciones = sumar(impuestos.filter(tax => tax.afecta_total === 'resta').map(tax => centavos(tax.valor)));
        const tipRate = input.propina_habilitada ? entero(input.propina_porcentaje, 4, 'Porcentaje propina') : 0;
        exigir(tipRate <= 1000000, 'Propina mayor al 100%');
        // Preserve the configured POS convention: tip on subtotal before global discount, excluding IVA.
        const propina = porcentaje(subtotal, tipRate);
        const totalFactura = base + iva + adicionales - retenciones;
        exigir(totalFactura >= 0, 'Las retenciones superan el importe de la factura');
        const total = sumar([totalFactura, propina]);
        return { productos, impuestos, subtotal: importe(subtotal), descuento: importe(descuento), impuesto: importe(iva),
            impuestos_adicionales: importe(adicionales), retenciones: importe(retenciones),
            total_factura: importe(totalFactura), total: importe(total),
            propina_valor: importe(propina), propina_porcentaje: tipRate / 10000,
            propina_base: input.propina_habilitada ? importe(subtotal) : 0 };
    }

    function conciliarPagos(pagos, total, credito = false) {
        const due = centavos(total, 'Total');
        exigir(Array.isArray(pagos), 'Los pagos deben ser un arreglo');
        if (credito) {
            exigir(pagos.length === 0, 'El credito con abono inicial debe registrarse por el flujo de cartera');
            return { pagos: [], recibido: 0, cambio: 0 };
        }
        exigir(pagos.length > 0, 'Debe registrar el pago de la venta');
        const methods = ['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'transferencia', 'nequi', 'daviplata', 'cheque', 'consignacion', 'bono', 'vale'];
        const received = pagos.map(payment => {
            exigir(methods.includes(payment.metodo_pago), 'Metodo de pago no reconocido');
            const amount = centavos(payment.monto, 'Pago');
            exigir(amount > 0, 'El pago debe ser mayor que cero');
            return { ...payment, cents: amount };
        });
        const sum = sumar(received.map(payment => payment.cents));
        const cash = sumar(received.filter(payment => payment.metodo_pago === 'efectivo').map(payment => payment.cents));
        let change = sum - due;
        exigir(change >= 0, 'Los pagos no cubren el total de la venta');
        exigir(change <= cash, 'El excedente de pago solo se permite como cambio de efectivo');
        const netPayments = received.map(payment => {
            const returned = payment.metodo_pago === 'efectivo' ? Math.min(change, payment.cents) : 0;
            change -= returned;
            const { cents: amount, ...data } = payment;
            return { ...data, monto: importe(amount - returned) };
        }).filter(payment => payment.monto > 0);
        return { pagos: netPayments, recibido: importe(sum), cambio: importe(sum - due) };
    }

    return { calcular, conciliarPagos, centavos, ErrorCalculo };
});
