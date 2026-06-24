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

function facturaModel_obtenerConfiguracionActual(configuracionPlantilla, currentEmpresa) {
    return {
        plantillaId: configuracionPlantilla?.plantilla_id || 1,
        colorPrimario: configuracionPlantilla?.color_primario || currentEmpresa?.color_primario || '#1E40AF',
        colorSecundario: configuracionPlantilla?.color_secundario || '#6c757d',
        fuente: configuracionPlantilla?.fuente || 'Arial',
        mostrarLogo: configuracionPlantilla?.mostrar_logo !== false,
        mostrarQR: configuracionPlantilla?.mostrar_qr !== false,
        mostrarCUFE: configuracionPlantilla?.mostrar_cufe !== false,
        mostrarBadges: configuracionPlantilla?.mostrar_badges !== false
    };
}

function facturaModel_generarFacturaHtmlBody(venta, ventaData, currentEmpresa, configuracionPlantilla) {
    const config = facturaModel_obtenerConfiguracionActual(configuracionPlantilla, currentEmpresa);
    const fechaFormateada = new Date(venta.fecha_venta || new Date()).toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    const nitCompleto = `${currentEmpresa?.nit || ''}-${facturaModel_calcularDigitoVerificacion(currentEmpresa?.nit || '')}`;
    const numeroFactura = venta.numero_factura || 'FACTURA';

    const subtotal = Number(ventaData.subtotal || 0);
    const descuento = Number(ventaData.descuento || 0);
    const impuesto = Number(ventaData.impuesto || 0);
    const impuestosAdicionales = Number(ventaData.impuestos_adicionales || 0);
    const propinaValor = Number(ventaData.propina_valor || 0);
    const total = Number(ventaData.total || subtotal - descuento + impuesto + impuestosAdicionales + propinaValor);

    const tipoFactura = config.plantillaId === 5 ? 'FACTURA ELECTRÓNICA SIIGO' : 'FACTURA DE VENTA';
    const headerBg = config.plantillaId === 4 ? config.colorPrimario : '#ffffff';
    const textColor = config.plantillaId === 4 ? '#ffffff' : '#000000';
    const titleBackground = config.plantillaId === 2 ? `${config.colorPrimario}20` : '#f8f9fa';
    const accentBorder = config.colorPrimario;
    const badgeHtml = config.mostrarBadges ? `<span style="display:inline-block; padding:6px 14px; border-radius:999px; border:1px solid ${config.colorPrimario}; color:${config.colorPrimario};">Modelo ${config.plantillaId}</span>` : '';

    return `
        <div id="facturaDetallePrint" style="font-family: ${config.fuente}, Arial, sans-serif; color: ${textColor};">
            <div style="padding: 20px; border: 1px solid #ddd; border-radius: 12px; background: #fff;">
                <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px; align-items: center; background: ${headerBg}; color: ${textColor}; padding: 18px; border-radius: 12px 12px 0 0; border: 1px solid ${accentBorder};">
                    <div>
                        <h2 style="margin:0; font-size: 1.4rem;">${currentEmpresa?.nombre || ''}</h2>
                        <p style="margin: 4px 0;">${currentEmpresa?.razon_social || ''}</p>
                        <p style="margin: 4px 0;">NIT: ${nitCompleto}</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 4px 0; font-weight: bold;">${tipoFactura}</p>
                        <p style="margin: 4px 0; font-size: 1.2rem; font-weight: 700;">${numeroFactura}</p>
                    </div>
                </div>

                <div style="padding: 18px; background: #f8f9fa; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
                    <div style="border: 1px solid #e0e0e0; border-radius: 10px; padding: 12px; background: #fff;">
                        <strong>Fecha</strong><br>${fechaFormateada}
                    </div>
                    <div style="border: 1px solid #e0e0e0; border-radius: 10px; padding: 12px; background: #fff;">
                        <strong>Cliente</strong><br>
                        ${ventaData.cliente?.razon_social || `${ventaData.cliente?.nombre || ''} ${ventaData.cliente?.apellido || ''}`.trim()}<br>
                        ${ventaData.cliente?.tipo_documento || ''}: ${ventaData.cliente?.numero_documento || ''}<br>
                        ${ventaData.cliente?.telefono || ''}
                    </div>
                    <div style="border: 1px solid #e0e0e0; border-radius: 10px; padding: 12px; background: #fff;">
                        <strong>Dirección</strong><br>
                        ${currentEmpresa?.direccion || '-'}
                    </div>
                </div>

                <div style="margin-top: 20px;">
                    <table style="width:100%; border-collapse: collapse;">
                        <thead style="background: ${titleBackground};">
                            <tr>
                                <th style="text-align:left; padding: 10px; border: 1px solid #ddd;">Producto</th>
                                <th style="text-align:left; padding: 10px; border: 1px solid #ddd;">SKU</th>
                                <th style="text-align:center; padding: 10px; border: 1px solid #ddd;">Cant.</th>
                                <th style="text-align:right; padding: 10px; border: 1px solid #ddd;">Precio</th>
                                <th style="text-align:right; padding: 10px; border: 1px solid #ddd;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ventaData.productos?.map((item, index) => `
                                <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
                                    <td style="padding: 10px; border: 1px solid #ddd;">${item.nombre || ''}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">${item.sku || '-'}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd; text-align:center;">${item.cantidad || 0}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd; text-align:right;">$${facturaModel_formatearNumero(item.precio)}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd; text-align:right;">$${facturaModel_formatearNumero(item.subtotal)}</td>
                                </tr>
                            `).join('') || ''}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="4" style="padding: 10px; border: 1px solid #ddd; text-align:right;"><strong>Subtotal</strong></td>
                                <td style="padding: 10px; border: 1px solid #ddd; text-align:right;">$${facturaModel_formatearNumero(subtotal)}</td>
                            </tr>
                            ${descuento > 0 ? `
                                <tr>
                                    <td colspan="4" style="padding: 10px; border: 1px solid #ddd; text-align:right;"><strong>Descuento</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd; text-align:right;">-$${facturaModel_formatearNumero(descuento)}</td>
                                </tr>
                            ` : ''}
                            <tr>
                                <td colspan="4" style="padding: 10px; border: 1px solid #ddd; text-align:right;"><strong>IVA</strong></td>
                                <td style="padding: 10px; border: 1px solid #ddd; text-align:right;">$${facturaModel_formatearNumero(impuesto)}</td>
                            </tr>
                            ${impuestosAdicionales > 0 ? `
                                <tr>
                                    <td colspan="4" style="padding: 10px; border: 1px solid #ddd; text-align:right;"><strong>Impuestos Adicionales</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd; text-align:right;">$${facturaModel_formatearNumero(impuestosAdicionales)}</td>
                                </tr>
                            ` : ''}
                            ${propinaValor > 0 ? `
                                <tr>
                                    <td colspan="4" style="padding: 10px; border: 1px solid #ddd; text-align:right;">Propina (${ventaData.propina_porcentaje || 0}%)</td>
                                    <td style="padding: 10px; border: 1px solid #ddd; text-align:right;">$${facturaModel_formatearNumero(propinaValor)}</td>
                                </tr>
                            ` : ''}
                            <tr style="background: ${config.colorPrimario}; color: white;">
                                <td colspan="4" style="padding: 10px; border: 1px solid ${config.colorPrimario}; text-align:right;"><strong>TOTAL</strong></td>
                                <td style="padding: 10px; border: 1px solid ${config.colorPrimario}; text-align:right;"><strong>$${facturaModel_formatearNumero(total)}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                ${ventaData.notas ? `
                    <div style="margin-top: 20px; padding: 14px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fbfbfb;">
                        <strong>Notas</strong><br>
                        <p style="margin: 0;">${ventaData.notas}</p>
                    </div>
                ` : ''}

                <div style="margin-top: 24px; text-align:center; color: #6c757d;">
                    ${badgeHtml}
                    <p style="margin-top: 12px; font-size: 0.95rem;">Gracias por preferirnos.</p>
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
