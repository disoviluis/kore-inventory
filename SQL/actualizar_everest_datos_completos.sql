-- ============================================================================
-- Actualizar empresa con datos completos de EVEREST SA
-- ============================================================================

USE kore_inventory;

UPDATE empresas 
SET 
  nombre = 'EVEREST SA',
  razon_social = 'EVEREST SOCIEDAD ANÓNIMA',
  nit = '900456789',
  email = 'ventas@everestsa.com.co',
  telefono = '(601) 742 8900',
  direccion = 'Carrera 7 No. 71-21 Torre B Piso 12',
  ciudad = 'Bogotá D.C.',
  pais = 'Colombia',
  logo_url = 'https://pixabay.com/get/gcc1c031779007f2d6a4bc97690b34474b46af1461da6c43a22e990bc591bf4f145ea01554d096cccc15c1d88f6af18accf4cd777f333241d5e281e8cb3455655e59b797cfd1dcea9f2febc47616b08c4_640.png',
  sitio_web = 'https://www.everestsa.com.co',
  slogan = 'Soluciones que elevan tu negocio',
  descripcion = 'Soluciones empresariales de alta calidad para elevar tu negocio al siguiente nivel',
  regimen_tributario = 'comun',
  tipo_contribuyente = 'persona_juridica',
  gran_contribuyente = 1,
  autoretenedor = 1,
  agente_retenedor_iva = 1,
  agente_retenedor_ica = 1,
  resolucion_dian = '18764000045892',
  fecha_resolucion = '2024-03-15',
  fecha_resolucion_desde = '2024-03-15',
  fecha_resolucion_hasta = '2026-03-15',
  prefijo_factura = 'FAC',
  rango_factura_desde = 1,
  rango_factura_hasta = 100000,
  numeracion_actual = 156,
  software_id = 'SW-12345678',
  pin_software = '98765',
  ambiente = 'produccion'
WHERE id = 1;

SELECT 'Empresa EVEREST SA actualizada con datos completos' AS resultado;
