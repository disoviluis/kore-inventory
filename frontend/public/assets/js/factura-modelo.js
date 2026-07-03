/**
 * KORE INVENTORY - Invoice template helper
 * Shared between ventas and ventas-historial.
 */

function facturaModel_formatearNumero(num) {
    return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Number(num || 0));
}

function facturaModel_calcularDigitoVerificacion(nit) {
    const nitNumeros = String(nit || '').replace(/[^0-9]/g, '');
    const vpri = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
    let suma = 0;
    for (let i = 0; i < nitNumeros.length && i < 15; i++) {
        suma += parseInt(nitNumeros[nitNumeros.length - 1 - i], 10) * vpri[i];
    }
    const residuo = suma % 11;
    return residuo > 1 ? 11 - residuo : residuo;
}

function facturaModel_esBanderasValidas(valor) {
    return valor === true || valor === 1 || valor === '1';
}

function facturaModel_obtenerConfiguracionActual(configuracionPlantilla, currentEmpresa) {
    return {
        plantillaId: configuracionPlantilla?.plantilla_id || 1,
        colorPrimario: configuracionPlantilla?.color_primario || currentEmpresa?.color_primario || '#1E40AF',
        colorSecundario: configuracionPlantilla?.color_secundario || '#6c757d',
        fuente: configuracionPlantilla?.fuente || 'Arial',
        mostrarLogo: configuracionPlantilla?.mostrar_logo === undefined ? true : facturaModel_esBanderasValidas(configuracionPlantilla.mostrar_logo),
        mostrarQR: configuracionPlantilla?.mostrar_qr === undefined ? true : facturaModel_esBanderasValidas(configuracionPlantilla.mostrar_qr),
        mostrarCUFE: configuracionPlantilla?.mostrar_cufe === undefined ? true : facturaModel_esBanderasValidas(configuracionPlantilla.mostrar_cufe),
        mostrarBadges: configuracionPlantilla?.mostrar_badges === undefined ? true : facturaModel_esBanderasValidas(configuracionPlantilla.mostrar_badges),
        logoPosicion: configuracionPlantilla?.logo_posicion || 'center'
    };
}

function facturaModel_obtenerLogoUrl(currentEmpresa) {
    return currentEmpresa?.logo_url || currentEmpresa?.logo || currentEmpresa?.logoUrl || currentEmpresa?.empresa_logo || null;
}

function facturaModel_generarFacturaHtmlBody(venta, ventaData, currentEmpresa, configuracionPlantilla, compact = false) {
    const config = facturaModel_obtenerConfiguracionActual(configuracionPlantilla, currentEmpresa);
    const logoUrl = facturaModel_obtenerLogoUrl(currentEmpresa);
    const fechaFormateada = formatFechaColombia(venta.fecha_venta || new Date());
    const nitCompleto = `${currentEmpresa?.nit || ''}-${facturaModel_calcularDigitoVerificacion(currentEmpresa?.nit || '')}`;
    const numeroFactura = venta.numero_factura || 'FACTURA';

    const subtotal = Number(ventaData.subtotal || 0);
    const descuento = Number(ventaData.descuento || 0);
    const impuesto = Number(ventaData.impuesto || 0);
    const propinaValor = Number(ventaData.propina_valor || 0);
    const total = Number(ventaData.total || subtotal - descuento + impuesto + propinaValor);

    // Valores compactos para media carta
    const outerPad  = compact ? '10px' : '20px';
    const headerPad = compact ? '8px 10px' : '18px';
    const cellPad   = compact ? '5px 6px' : '10px';
    const infoPad   = compact ? '8px 10px' : '18px';
    const cardPad   = compact ? '6px 8px' : '12px';
    const sectionMt = compact ? '10px' : '20px';
    const logoMaxH  = compact ? '55px' : '90px';
    const logoThumb = compact ? '55px' : '90px';
    const logoFs    = compact ? '18px' : '28px';
    const minW1     = compact ? '140px' : '220px';
    const minW2     = compact ? '120px' : '180px';
    const gap       = compact ? '8px' : '16px';
    const h2Fs      = compact ? '1rem' : '1.4rem';
    const numFs     = compact ? '0.95rem' : '1.2rem';
    const bodyFs    = compact ? '8.5pt' : '10pt';

    const tipoFactura = config.plantillaId === 5 ? 'FACTURA ELECTRÓNICA SIIGO' : 'FACTURA DE VENTA';
    const headerBg = config.plantillaId === 4 ? config.colorPrimario : '#ffffff';
    const textColor = config.plantillaId === 4 ? '#ffffff' : '#000000';
    const titleBackground = config.plantillaId === 2 ? `${config.colorPrimario}20` : '#f8f9fa';
    const accentBorder = config.colorPrimario;
    const esGranContribuyente = currentEmpresa?.es_gran_contribuyente || currentEmpresa?.gran_contribuyente || false;
    const badgeHtml = config.mostrarBadges && esGranContribuyente ? `<span style="display:inline-block; padding:4px 10px; border-radius:999px; background: ${config.colorPrimario}; color:white; font-weight:600;">GRAN CONTRIBUYENTE</span>` : '';
    const logoAlignment = config.logoPosicion === 'left' ? 'flex-start' : config.logoPosicion === 'right' ? 'flex-end' : 'center';
    const logoElement = config.mostrarLogo ? (logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height: ${logoMaxH}; width: auto; object-fit: contain;">` : `<div style="width: ${logoThumb}; height: ${logoThumb}; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: ${config.colorPrimario}; color: white; font-size: ${logoFs}; font-weight: bold;">${(currentEmpresa?.nombre || '').charAt(0).toUpperCase() || 'E'}</div>`) : '';

    return `
        <div id="facturaDetallePrint" style="font-family: ${config.fuente}, Arial, sans-serif; font-size: ${bodyFs}; color: ${textColor};">
            <div style="padding: ${outerPad}; border: 1px solid #ddd; border-radius: 8px; background: #fff;">
                <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: ${gap}; align-items: center; background: ${headerBg}; color: ${textColor}; padding: ${headerPad}; border-radius: 8px 8px 0 0; border: 1px solid ${accentBorder};">
                    <div style="flex: 1; min-width: ${minW1};">
                        <h2 style="margin:0; font-size: ${h2Fs};">${currentEmpresa?.nombre || ''}</h2>
                        <p style="margin: 3px 0;">${currentEmpresa?.razon_social || ''}</p>
                        <p style="margin: 3px 0;">NIT: ${nitCompleto}</p>
                        <div style="margin-top: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            ${badgeHtml}
                        </div>
                    </div>
                    <div style="flex: 1; min-width: ${minW2}; display: flex; justify-content: ${logoAlignment};">
                        ${logoElement}
                    </div>
                    <div style="min-width: ${minW2}; text-align: right;">
                        <p style="margin: 3px 0; font-weight: bold;">${tipoFactura}</p>
                        <p style="margin: 3px 0; font-size: ${numFs}; font-weight: 700;">${numeroFactura}</p>
                    </div>
                </div>

                <div style="padding: ${infoPad}; background: #f8f9fa; display: grid; grid-template-columns: repeat(auto-fit, minmax(${minW1}, 1fr)); gap: ${gap};">
                    <div style="border: 1px solid #e0e0e0; border-radius: 6px; padding: ${cardPad}; background: #fff;">
                        <strong>Fecha</strong><br>${fechaFormateada}
                    </div>
                    <div style="border: 1px solid #e0e0e0; border-radius: 6px; padding: ${cardPad}; background: #fff;">
                        <strong>Cliente</strong><br>
                        ${ventaData.cliente?.razon_social || `${ventaData.cliente?.nombre || ''} ${ventaData.cliente?.apellido || ''}`.trim()}<br>
                        ${ventaData.cliente?.tipo_documento || ''}: ${ventaData.cliente?.numero_documento || ''}<br>
                        ${ventaData.cliente?.telefono || ''}
                    </div>
                    <div style="border: 1px solid #e0e0e0; border-radius: 6px; padding: ${cardPad}; background: #fff;">
                        <strong>Dirección</strong><br>
                        ${currentEmpresa?.direccion || '-'}
                    </div>
                </div>

                <div style="margin-top: ${sectionMt};">
                    <table style="width:100%; border-collapse: collapse;">
                        <thead style="background: ${titleBackground};">
                            <tr>
                                <th style="text-align:left; padding: ${cellPad}; border: 1px solid #ddd;">Producto</th>
                                <th style="text-align:left; padding: ${cellPad}; border: 1px solid #ddd;">SKU</th>
                                <th style="text-align:center; padding: ${cellPad}; border: 1px solid #ddd;">Cant.</th>
                                <th style="text-align:right; padding: ${cellPad}; border: 1px solid #ddd;">Precio</th>
                                <th style="text-align:right; padding: ${cellPad}; border: 1px solid #ddd;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ventaData.productos?.map((item, index) => `
                                <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
                                    <td style="padding: ${cellPad}; border: 1px solid #ddd;">${item.nombre || ''}</td>
                                    <td style="padding: ${cellPad}; border: 1px solid #ddd;">${item.sku || '-'}</td>
                                    <td style="padding: ${cellPad}; border: 1px solid #ddd; text-align:center;">${item.cantidad || 0}</td>
                                    <td style="padding: ${cellPad}; border: 1px solid #ddd; text-align:right;">$${facturaModel_formatearNumero(item.precio_unitario || item.precio)}</td>
                                    <td style="padding: ${cellPad}; border: 1px solid #ddd; text-align:right;">$${facturaModel_formatearNumero(item.subtotal)}</td>
                                </tr>
                            `).join('') || ''}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="4" style="padding: ${cellPad}; border: 1px solid #ddd; text-align:right;"><strong>Subtotal</strong></td>
                                <td style="padding: ${cellPad}; border: 1px solid #ddd; text-align:right;">$${facturaModel_formatearNumero(subtotal)}</td>
                            </tr>
                            ${descuento > 0 ? `
                                <tr>
                                    <td colspan="4" style="padding: ${cellPad}; border: 1px solid #ddd; text-align:right;"><strong>Descuento</strong></td>
                                    <td style="padding: ${cellPad}; border: 1px solid #ddd; text-align:right;">-$${facturaModel_formatearNumero(descuento)}</td>
                                </tr>
                            ` : ''}
                            <tr>
                                <td colspan="4" style="padding: ${cellPad}; border: 1px solid #ddd; text-align:right;"><strong>IVA</strong></td>
                                <td style="padding: ${cellPad}; border: 1px solid #ddd; text-align:right;">$${facturaModel_formatearNumero(impuesto)}</td>
                            </tr>
                            ${(ventaData.impuestos || []).map(imp => `
                                <tr>
                                    <td colspan="4" style="padding: ${cellPad}; border: 1px solid #ddd; text-align:right;"><strong>${imp.nombre || imp.nombre_impuesto || imp.impuesto_nombre || 'Impuesto'}${imp.tasa ? ` (${imp.tasa}%)` : ''}</strong></td>
                                    <td style="padding: ${cellPad}; border: 1px solid #ddd; text-align:right;">${imp.afecta_total === 'resta' ? '-' : ''}$${facturaModel_formatearNumero(Math.abs(imp.valor || 0))}</td>
                                </tr>
                            `).join('')}
                            ${propinaValor > 0 ? `
                                <tr>
                                    <td colspan="4" style="padding: ${cellPad}; border: 1px solid #ddd; text-align:right;">Propina (${ventaData.propina_porcentaje || 0}%)</td>
                                    <td style="padding: ${cellPad}; border: 1px solid #ddd; text-align:right;">$${facturaModel_formatearNumero(propinaValor)}</td>
                                </tr>
                            ` : ''}
                            <tr style="background: ${config.colorPrimario}; color: white;">
                                <td colspan="4" style="padding: ${cellPad}; border: 1px solid ${config.colorPrimario}; text-align:right;"><strong>TOTAL</strong></td>
                                <td style="padding: ${cellPad}; border: 1px solid ${config.colorPrimario}; text-align:right;"><strong>$${facturaModel_formatearNumero(total)}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                ${ventaData.pagos && ventaData.pagos.length > 0 ? `
                    <div style="margin-top: ${sectionMt}; padding: ${cardPad}; border: 1px solid #e0e0e0; border-radius: 6px; background: #fbfbfb;">
                        <strong style="font-size:0.9rem;">Medios de Pago</strong>
                        <table style="width:100%; margin-top:8px; border-collapse:collapse;">
                            ${ventaData.pagos.map(p => {
                                const nombres = { efectivo:'Efectivo', tarjeta_debito:'Tarjeta Débito', tarjeta_credito:'Tarjeta Crédito', transferencia:'Transferencia', nequi:'Nequi', daviplata:'Daviplata', cheque:'Cheque' };
                                const nombre = nombres[p.metodo_pago] || p.metodo_pago;
                                const detalle = [p.referencia ? 'Ref: '+p.referencia : '', p.banco ? p.banco : ''].filter(Boolean).join(' · ');
                                return `<tr><td style="padding:4px 8px 4px 0;">${nombre}${detalle ? '<br><small style="color:#888;">' + detalle + '</small>' : ''}</td><td style="text-align:right; padding:4px 0; font-weight:600;">$${facturaModel_formatearNumero(p.monto)}</td></tr>`;
                            }).join('')}
                        </table>
                    </div>
                ` : ''}

                ${ventaData.notas ? `
                    <div style="margin-top: ${sectionMt}; padding: ${cardPad}; border: 1px solid #e0e0e0; border-radius: 6px; background: #fbfbfb;">
                        <strong>Notas</strong><br>
                        <p style="margin: 0;">${ventaData.notas}</p>
                    </div>
                ` : ''}

                <div style="margin-top: ${sectionMt}; display: flex; justify-content: space-between; flex-wrap: wrap; gap: ${gap}; align-items: center;">
                    ${config.mostrarCUFE && venta.cufe ? `<div style="flex: 1; min-width: ${minW1}; padding: ${cardPad}; border: 1px solid #e0e0e0; border-radius: 8px; background: #f8f9fa; font-size: 0.65rem; word-break: break-all; overflow-wrap: break-word; font-family: monospace;"><strong style="font-family: sans-serif;">CUFE:</strong><br>${venta.cufe}</div>` : ''}
                    ${config.mostrarQR && venta.qr_code ? `<div style="flex: 0 0 ${compact ? '80px' : '120px'}; text-align: center; padding: ${cardPad}; border: 1px solid #e0e0e0; border-radius: 8px; background: #f8f9fa;"><img src="${venta.qr_code}" alt="QR Code" style="width: ${compact ? '70px' : '100px'}; height: ${compact ? '70px' : '100px'}; object-fit: contain;"></div>` : ''}
                </div>
                <div style="margin-top: ${compact ? '12px' : '24px'}; text-align:center; color: #6c757d;">
                    <p style="margin-top: 8px; font-size: ${compact ? '0.8rem' : '0.95rem'};">Gracias por preferirnos.</p>
                </div>
            </div>
        </div>
    `;
}

function facturaModel_generarFacturaHtmlPage(venta, ventaData, currentEmpresa, configuracionPlantilla) {
    const facturaBody = facturaModel_generarFacturaHtmlBody(venta, ventaData, currentEmpresa, configuracionPlantilla);
    const numeroFactura = venta.numero_factura || 'FACTURA';

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${numeroFactura}</title><style>body{margin:0;padding:0;background:#f0f0f0;}@media print{body{margin:0;}}img{max-width:100%;}</style></head><body>${facturaBody}<script>window.onload=function(){setTimeout(function(){window.print();window.close();},250);};</script></body></html>`;
}
