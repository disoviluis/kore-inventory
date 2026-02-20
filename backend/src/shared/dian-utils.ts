/**
 * =================================
 * KORE INVENTORY - DIAN UTILITIES
 * Utilidades para facturación electrónica DIAN
 * =================================
 */

import crypto from 'crypto';
import QRCode from 'qrcode';

/**
 * Generar número de factura con prefijo y consecutivo
 */
export const generarNumeroFactura = (prefijo: string = 'FAC', consecutivo: number): string => {
  return `${prefijo}-${String(consecutivo).padStart(6, '0')}`;
};

/**
 * Calcular dígito de verificación del NIT (algoritmo oficial DIAN)
 */
export const calcularDigitoVerificacion = (nit: string): number => {
  const nitNumeros = nit.replace(/[^0-9]/g, '');
  const vpri = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  
  let suma = 0;
  for (let i = 0; i < nitNumeros.length && i < 15; i++) {
    suma += parseInt(nitNumeros[nitNumeros.length - 1 - i]) * vpri[i];
  }
  
  const residuo = suma % 11;
  return residuo > 1 ? 11 - residuo : residuo;
};

/**
 * Generar CUFE (Código Único de Factura Electrónica)
 * Algoritmo oficial DIAN Colombia
 */
export interface CUFEParams {
  numeroFactura: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS
  subtotal: number;
  impuesto: number;
  total: number;
  nitEmisor: string;
  tipoDocAdquiriente: string; // '31' = NIT, '13' = Cédula, etc
  numDocAdquiriente: string;
  softwareId: string;
  ambiente: '1' | '2'; // 1=producción, 2=pruebas
  pin: string;
}

export const generarCUFE = (params: CUFEParams): string => {
  // Formato DIAN: NumFac + FecFac + HorFac + ValFac + CodImp1 + ValImp1 + CodImp2 + ValImp2 + CodImp3 + ValImp3 + ValTot + NitFac + TipAdq + NumAdq + SoftwareID + Ambiente + PIN
  
  const cadena = [
    params.numeroFactura,
    params.fecha.replace(/-/g, ''),
    params.hora.replace(/:/g, ''),
    String(params.subtotal.toFixed(2)),
    '01', // Código IVA
    String(params.impuesto.toFixed(2)),
    '04', // Código INC (consumo)
    '0.00',
    '03', // Código Retención
    '0.00',
    String(params.total.toFixed(2)),
    params.nitEmisor.replace(/[^0-9]/g, ''),
    params.tipoDocAdquiriente,
    params.numDocAdquiriente.replace(/[^0-9]/g, ''),
    params.softwareId,
    params.ambiente,
    params.pin
  ].join('');

  // Generar hash SHA-384
  return crypto.createHash('sha384').update(cadena).digest('hex');
};

/**
 * Generar código QR para validación DIAN
 */
export interface QRData {
  NumFac: string;
  FecFac: string;
  NitFac: string;
  DocAdq: string;
  ValFac: string;
  ValIva: string;
  ValOtroIm: string;
  ValTotal: string;
  CUFE: string;
}

export const generarQRCode = async (data: QRData): Promise<string> => {
  // Generar JSON para QR
  const jsonData = JSON.stringify(data);
  
  // Generar QR como Data URL (base64)
  try {
    const qrDataURL = await QRCode.toDataURL(jsonData, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 1
    });
    
    return qrDataURL; // Devuelve "data:image/png;base64,iVBORw0KGgoAAAANS..."
  } catch (error) {
    console.error('Error generando QR Code:', error);
    throw new Error('Error al generar código QR');
  }
};

/**
 * Convertir valor numérico a texto (para facturas)
 * Ejemplo: 8794100 -> "OCHO MILLONES SETECIENTOS NOVENTA Y CUATRO MIL CIEN PESOS M/CTE"
 */
export const numeroATexto = (numero: number): string => {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  if (numero === 0) return 'CERO PESOS M/CTE';
  if (numero === 1) return 'UN PESO M/CTE';

  const convertirGrupo = (n: number): string => {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;
    
    let resultado = '';
    
    if (c > 0) resultado += centenas[c];
    if (d === 1 && u > 0) {
      resultado += (resultado ? ' ' : '') + especiales[u];
    } else {
      if (d > 0) resultado += (resultado ? ' Y ' : '') + decenas[d];
      if (u > 0) resultado += (resultado ? ' Y ' : '') + unidades[u];
    }
    
    return resultado;
  };

  let texto = '';
  const millones = Math.floor(numero / 1000000);
  const miles = Math.floor((numero % 1000000) / 1000);
  const cientos = numero % 1000;

  if (millones > 0) {
    if (millones === 1) {
      texto = 'UN MILLÓN';
    } else {
      texto = convertirGrupo(millones) + ' MILLONES';
    }
  }

  if (miles > 0) {
    const textoMiles = convertirGrupo(miles);
    if (texto) texto += ' ';
    texto += textoMiles + ' MIL';
  }

  if (cientos > 0) {
    const textoCientos = convertirGrupo(cientos);
    if (texto) texto += ' ';
    texto += textoCientos;
  }

  return texto + ' PESOS M/CTE';
};

/**
 * Calcular retenciones automáticamente según reglas fiscales Colombia
 */
export interface Retenciones {
  retencionFuente: number;
  retencionIVA: number;
  retencionICA: number;
}

export const calcularRetenciones = (
  subtotal: number,
  impuesto: number,
  total: number,
  clienteEsGranContribuyente: boolean,
  clienteTipoPersona: 'natural' | 'juridica'
): Retenciones => {
  let retencionFuente = 0;
  let retencionIVA = 0;
  let retencionICA = 0;

  // Retención en la fuente: 2.5% sobre base (si cliente es gran contribuyente)
  if (clienteEsGranContribuyente) {
    retencionFuente = subtotal * 0.025;
  }

  // Retención IVA: 15% del IVA (si total supera 4 UVT ≈ $176.000 en 2026)
  if (total > 176000 && impuesto > 0) {
    retencionIVA = impuesto * 0.15;
  }

  // Retención ICA: 1% sobre base (solo para Bogotá, si cliente es persona jurídica)
  if (clienteTipoPersona === 'juridica') {
    retencionICA = subtotal * 0.01;
  }

  return {
    retencionFuente: Math.round(retencionFuente * 100) / 100,
    retencionIVA: Math.round(retencionIVA * 100) / 100,
    retencionICA: Math.round(retencionICA * 100) / 100
  };
};
