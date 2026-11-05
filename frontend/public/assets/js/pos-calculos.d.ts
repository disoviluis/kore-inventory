export type Decimal = number | string;
export interface Linea {
    producto_id?: number;
    cantidad: Decimal;
    precio_unitario: Decimal;
    descuento?: Decimal;
    aplica_iva: boolean | number;
    porcentaje_iva: Decimal;
    tipo_impuesto?: string;
    iva_incluido_en_precio?: boolean | number;
}
export interface Impuesto {
    id: number;
    codigo: string;
    nombre: string;
    tipo: string;
    tasa: Decimal;
    aplica_sobre: string;
    afecta_total: string;
}
export interface Pago {
    metodo_pago: string;
    monto: Decimal;
    referencia?: string;
    banco?: string;
    notas?: string;
}
export interface Entrada {
    productos: Linea[];
    descuento?: Decimal;
    impuestos?: Impuesto[];
    propina_habilitada?: boolean;
    propina_porcentaje?: Decimal;
}
export interface Resultado {
    productos: (Linea & { subtotal: number; base_gravable: number; iva_valor: number })[];
    impuestos: { impuesto_id: number; codigo: string; nombre: string; base_calculo: number; tasa: number; valor: number; afecta_total: string }[];
    subtotal: number;
    descuento: number;
    impuesto: number;
    impuestos_adicionales: number;
    retenciones: number;
    total_factura: number;
    total: number;
    propina_valor: number;
    propina_porcentaje: number;
    propina_base: number;
}
export class ErrorCalculo extends Error { status: number }
export function centavos(value: Decimal, field?: string): number;
export function calcular(input: Entrada): Resultado;
export function conciliarPagos(pagos: Pago[], total: Decimal, credito?: boolean): { pagos: Pago[]; recibido: number; cambio: number };
