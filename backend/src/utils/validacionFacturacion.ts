/**
 * Validación de Configuración de Facturación según normativa DIAN Colombia
 * 
 * Soporta 3 niveles:
 * 1. documento_equivalente: Tiquete (régimen simple, sin resolución DIAN)
 * 2. factura_pos: Factura POS (con resolución, sin CUFE)
 * 3. factura_electronica: Factura electrónica (con resolución, CUFE, firma digital)
 */

export type NivelFacturacion = 'documento_equivalente' | 'factura_pos' | 'factura_electronica';

export interface ConfiguracionRequerida {
  campos_obligatorios: string[];
  campos_opcionales: string[];
  campos_no_requeridos: string[];
  requiere_cufe: boolean;
  requiere_firma_digital: boolean;
  requiere_envio_dian: boolean;
  texto_footer: string;
  texto_footer_adicional?: string;
}

export interface ResultadoValidacion {
  valido: boolean;
  nivel: NivelFacturacion;
  errores: string[];
  advertencias: string[];
  puede_facturar: boolean;
  mensajes_ayuda: string[];
}

/**
 * Requisitos por nivel de facturación según DIAN
 */
export const REQUERIMIENTOS_POR_NIVEL: Record<NivelFacturacion, ConfiguracionRequerida> = {
  documento_equivalente: {
    campos_obligatorios: [
      'nit',
      'digito_verificacion',
      'nombre',
      'direccion',
      'telefono'
    ],
    campos_opcionales: ['email', 'logo_url', 'slogan'],
    campos_no_requeridos: [
      'resolucion_dian',
      'rango_factura_desde',
      'rango_factura_hasta',
      'cufe',
      'firma_digital',
      'clave_tecnica',
      'software_id'
    ],
    requiere_cufe: false,
    requiere_firma_digital: false,
    requiere_envio_dian: false,
    texto_footer: 'Documento Equivalente - Régimen Simple de Tributación',
    texto_footer_adicional: 'Documento Equivalente - No válido como factura'
  },

  factura_pos: {
    campos_obligatorios: [
      'nit',
      'digito_verificacion',
      'nombre',
      'direccion',
      'telefono',
      'email',
      'resolucion_dian',
      'fecha_resolucion',
      'rango_factura_desde',
      'rango_factura_hasta'
    ],
    campos_opcionales: [
      'prefijo_factura',
      'logo_url',
      'slogan',
      'fecha_resolucion_hasta'
    ],
    campos_no_requeridos: ['cufe', 'firma_digital', 'clave_tecnica', 'software_id'],
    requiere_cufe: false,
    requiere_firma_digital: false,
    requiere_envio_dian: false,
    texto_footer: 'Factura POS',
    texto_footer_adicional: 'Resolución DIAN No. {resolucion} del {fecha}\nRango autorizado del {prefijo}{desde} al {prefijo}{hasta}'
  },

  factura_electronica: {
    campos_obligatorios: [
      'nit',
      'digito_verificacion',
      'razon_social',
      'direccion',
      'telefono',
      'email',
      'resolucion_dian',
      'fecha_resolucion',
      'rango_factura_desde',
      'rango_factura_hasta',
      'clave_tecnica',
      'software_id',
      'pin_software'
    ],
    campos_opcionales: [
      'responsabilidades_fiscales',
      'actividad_economica',
      'logo_url',
      'slogan'
    ],
    campos_no_requeridos: [],
    requiere_cufe: true,
    requiere_firma_digital: true,
    requiere_envio_dian: true,
    texto_footer: 'Factura Electrónica de Venta',
    texto_footer_adicional: 'Factura Electrónica de Venta\nResolución DIAN No. {resolucion} del {fecha}\nCUFE: {cufe}\nValidada y autorizada por la DIAN'
  }
};

/**
 * Calcula el dígito de verificación según algoritmo DIAN (módulo 11)
 */
export function calcularDigitoVerificacion(nit: string): string {
  // Limpiar NIT (solo números)
  const nitLimpio = nit.replace(/\D/g, '');
  
  // Factores según posición (de derecha a izquierda)
  const factores = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  
  let suma = 0;
  const longitud = nitLimpio.length;
  
  for (let i = 0; i < longitud; i++) {
    const posicion = longitud - i - 1;
    const digito = parseInt(nitLimpio[i], 10);
    const factor = factores[posicion] || 3;
    suma += digito * factor;
  }
  
  const residuo = suma % 11;
  const dv = residuo > 1 ? 11 - residuo : residuo;
  
  return dv.toString();
}

/**
 * Valida que el DV proporcionado sea correcto
 */
export function validarDigitoVerificacion(nit: string, dv: string): boolean {
  const dvCalculado = calcularDigitoVerificacion(nit);
  return dvCalculado === dv;
}

/**
 * Valida la configuración de facturación de una empresa
 */
export function validarConfiguracionFacturacion(empresa: any): ResultadoValidacion {
  const nivel: NivelFacturacion = empresa.nivel_facturacion || 'documento_equivalente';
  const config = REQUERIMIENTOS_POR_NIVEL[nivel];
  const errores: string[] = [];
  const advertencias: string[] = [];
  const mensajes_ayuda: string[] = [];
  
  // 1. Validar campos obligatorios
  config.campos_obligatorios.forEach(campo => {
    const valor = empresa[campo];
    
    if (valor === null || valor === undefined || valor === '') {
      errores.push(`Campo obligatorio faltante: ${getNombreCampo(campo)}`);
    }
  });
  
  // 2. Validar dígito de verificación (SIEMPRE obligatorio)
  if (empresa.nit && !empresa.digito_verificacion) {
    errores.push('Falta el dígito de verificación del NIT');
    mensajes_ayuda.push('El dígito de verificación se calcula automáticamente. Haga clic en "Calcular DV"');
  }
  
  // 3. Validar coherencia de DV
  if (empresa.nit && empresa.digito_verificacion) {
    if (!validarDigitoVerificacion(empresa.nit, empresa.digito_verificacion)) {
      const dvCorrecto = calcularDigitoVerificacion(empresa.nit);
      errores.push(`Dígito de verificación incorrecto. Debería ser: ${dvCorrecto}`);
      mensajes_ayuda.push(`El NIT correcto es: ${empresa.nit}-${dvCorrecto}`);
    }
  }
  
  // 4. Advertencias para campos opcionales recomendados
  config.campos_opcionales?.forEach(campo => {
    const valor = empresa[campo];
    
    if (valor === null || valor === undefined || valor === '') {
      advertencias.push(`Se recomienda completar: ${getNombreCampo(campo)}`);
    }
  });
  
  // 5. Validaciones específicas por nivel
  if (nivel === 'factura_pos' || nivel === 'factura_electronica') {
    // Validar rango de facturación
    if (empresa.rango_factura_desde && empresa.rango_factura_hasta) {
      if (empresa.rango_factura_desde >= empresa.rango_factura_hasta) {
        errores.push('El rango de facturación es inválido (desde debe ser menor que hasta)');
      }
      
      // Verificar contador actual
      if (empresa.contador_factura_actual) {
        const restantes = empresa.rango_factura_hasta - empresa.contador_factura_actual;
        
        if (restantes <= 0) {
          errores.push('Rango de facturación agotado. Debe tramitar nueva resolución DIAN');
        } else if (restantes <= 100) {
          advertencias.push(`Quedan solo ${restantes} facturas disponibles. Tramite nueva resolución pronto.`);
        } else if (restantes <= 500) {
          advertencias.push(`Quedan ${restantes} facturas disponibles.`);
        }
      }
    }
    
    // Validar vigencia de resolución
    if (empresa.fecha_resolucion_hasta) {
      const hoy = new Date();
      const vigencia = new Date(empresa.fecha_resolucion_hasta);
      
      if (vigencia < hoy) {
        errores.push('La resolución DIAN está vencida. No puede emitir facturas.');
        mensajes_ayuda.push('Debe tramitar una nueva resolución en la DIAN antes de continuar facturando.');
      } else {
        const diasRestantes = Math.floor((vigencia.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diasRestantes <= 30) {
          advertencias.push(`⚠️ URGENTE: La resolución vence en ${diasRestantes} días (${vigencia.toLocaleDateString('es-CO')})`);
          mensajes_ayuda.push('Inicie el trámite de renovación de resolución DIAN con anticipación.');
        } else if (diasRestantes <= 90) {
          advertencias.push(`La resolución vence en ${diasRestantes} días (${vigencia.toLocaleDateString('es-CO')})`);
        }
      }
    } else {
      advertencias.push('No se ha especificado la fecha de vencimiento de la resolución');
    }
  }
  
  // 6. Validaciones específicas factura electrónica
  if (nivel === 'factura_electronica') {
    if (!empresa.clave_tecnica || !empresa.software_id || !empresa.pin_software) {
      errores.push('Faltan credenciales de facturación electrónica DIAN');
      mensajes_ayuda.push('Debe autorizar el software con la DIAN y obtener: Clave Técnica, Software ID y PIN');
    }
    
    if (empresa.ambiente_dian === 'habilitacion') {
      advertencias.push('⚠️ Sistema en ambiente de HABILITACIÓN (pruebas). Las facturas NO son válidas.');
      mensajes_ayuda.push('Cambie a ambiente PRODUCCIÓN cuando finalice las pruebas.');
    }
    
    if (!empresa.responsabilidades_fiscales) {
      advertencias.push('No se han especificado las responsabilidades fiscales');
      mensajes_ayuda.push('Configure los códigos DIAN (O-13, O-15, R-99-PN, etc.) en Configuración > Empresa');
    }
  }
  
  // 7. Validación de email (importante para factura electrónica)
  if ((nivel === 'factura_pos' || nivel === 'factura_electronica') && empresa.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(empresa.email)) {
      advertencias.push('El formato del email parece incorrecto');
    }
  }
  
  return {
    valido: errores.length === 0,
    nivel,
    errores,
    advertencias,
    puede_facturar: errores.length === 0,
    mensajes_ayuda
  };
}

/**
 * Nombres legibles para campos
 */
function getNombreCampo(campo: string): string {
  const nombres: Record<string, string> = {
    nit: 'NIT',
    digito_verificacion: 'Dígito de Verificación',
    nombre: 'Nombre Comercial',
    razon_social: 'Razón Social',
    direccion: 'Dirección',
    telefono: 'Teléfono',
    email: 'Correo Electrónico',
    resolucion_dian: 'Resolución DIAN',
    fecha_resolucion: 'Fecha de Resolución',
    fecha_resolucion_hasta: 'Vigencia de Resolución',
    rango_factura_desde: 'Rango Facturación Desde',
    rango_factura_hasta: 'Rango Facturación Hasta',
    prefijo_factura: 'Prefijo de Factura',
    clave_tecnica: 'Clave Técnica DIAN',
    software_id: 'ID de Software DIAN',
    pin_software: 'PIN del Software',
    logo_url: 'Logo de la Empresa',
    slogan: 'Eslogan',
    responsabilidades_fiscales: 'Responsabilidades Fiscales',
    actividad_economica: 'Actividad Económica'
  };
  
  return nombres[campo] || campo;
}

/**
 * Obtiene recomendaciones de nivel según características de empresa
 */
export function recomendarNivelFacturacion(empresa: any): {
  nivel_recomendado: NivelFacturacion;
  razon: string;
  puede_usar_nivel_inferior: boolean;
} {
  // Grandes contribuyentes → obligatorio factura electrónica
  if (empresa.gran_contribuyente) {
    return {
      nivel_recomendado: 'factura_electronica',
      razon: 'Como Gran Contribuyente está obligado a facturación electrónica',
      puede_usar_nivel_inferior: false
    };
  }
  
  // Autorretenedor → recomendado factura electrónica
  if (empresa.autoretenedor) {
    return {
      nivel_recomendado: 'factura_electronica',
      razon: 'Como Autorretenedor se recomienda facturación electrónica',
      puede_usar_nivel_inferior: true
    };
  }
  
  // Persona jurídica → recomendado factura POS mínimo
  if (empresa.tipo_contribuyente === 'persona_juridica') {
    return {
      nivel_recomendado: 'factura_pos',
      razon: 'Para personas jurídicas se recomienda mínimo Factura POS',
      puede_usar_nivel_inferior: true
    };
  }
  
  // Régimen común → recomendado factura POS
  if (empresa.regimen_tributario === 'comun') {
    return {
      nivel_recomendado: 'factura_pos',
      razon: 'El régimen común generalmente requiere facturación formal',
      puede_usar_nivel_inferior: true
    };
  }
  
  // Régimen simple o pequeño comercio → documento equivalente OK
  return {
    nivel_recomendado: 'documento_equivalente',
    razon: 'Para pequeños comercios y régimen simple puede usar documento equivalente',
    puede_usar_nivel_inferior: false // Ya es el nivel más bajo
  };
}

/**
 * Genera texto footer según nivel y datos de empresa
 */
export function generarTextoFooter(empresa: any, venta?: any): string {
  const nivel: NivelFacturacion = empresa.nivel_facturacion || 'documento_equivalente';
  const config = REQUERIMIENTOS_POR_NIVEL[nivel];
  
  let texto = config.texto_footer;
  
  if (config.texto_footer_adicional) {
    let adicional = config.texto_footer_adicional;
    
    // Reemplazar placeholders
    adicional = adicional
      .replace('{resolucion}', empresa.resolucion_dian || 'N/A')
      .replace('{fecha}', empresa.fecha_resolucion ? new Date(empresa.fecha_resolucion).toLocaleDateString('es-CO') : 'N/A')
      .replace('{prefijo}', empresa.prefijo_factura || '')
      .replace('{desde}', empresa.rango_factura_desde?.toString() || '1')
      .replace('{hasta}', empresa.rango_factura_hasta?.toString() || 'N/A')
      .replace('{cufe}', venta?.cufe || 'Generando...');
    
    texto += '\n' + adicional;
  }
  
  return texto;
}

export default {
  REQUERIMIENTOS_POR_NIVEL,
  calcularDigitoVerificacion,
  validarDigitoVerificacion,
  validarConfiguracionFacturacion,
  recomendarNivelFacturacion,
  generarTextoFooter
};
