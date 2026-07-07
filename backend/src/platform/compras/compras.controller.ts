/**
 * =============================================
 * KORE INVENTORY - COMPRAS CONTROLLER
 * Controlador para gestión de compras
 * =============================================
 */

import { Request, Response } from 'express';
import { query } from '../../shared/database';
import { successResponse, errorResponse } from '../../shared/helpers';
import logger from '../../shared/logger';

/**
 * Obtener listado de compras con filtros
 */
export const getCompras = async (req: Request, res: Response) => {
    try {
        const { 
            empresaId, 
            estado, 
            proveedorId,
            fechaInicio, 
            fechaFin 
        } = req.query;

        if (!empresaId) {
            return errorResponse(res, 'El ID de empresa es requerido', 400);
        }

        let sql = `
            SELECT 
                c.*,
                p.razon_social as proveedor_nombre,
                p.tipo_documento as proveedor_tipo_doc,
                p.numero_documento as proveedor_documento,
                u.nombre as usuario_nombre,
                u.apellido as usuario_apellido
            FROM compras c
            LEFT JOIN proveedores p ON c.proveedor_id = p.id
            LEFT JOIN usuarios u ON c.usuario_id = u.id
            WHERE c.empresa_id = ?
        `;

        const params: any[] = [empresaId];

        if (estado) {
            sql += ' AND c.estado = ?';
            params.push(estado);
        }

        if (proveedorId) {
            sql += ' AND c.proveedor_id = ?';
            params.push(proveedorId);
        }

        if (fechaInicio) {
            sql += ' AND c.fecha_compra >= ?';
            params.push(fechaInicio);
        }

        if (fechaFin) {
            sql += ' AND c.fecha_compra <= ?';
            params.push(fechaFin);
        }

        sql += ' ORDER BY c.fecha_compra DESC, c.id DESC LIMIT 500';

        const compras = await query(sql, params);

        return successResponse(res, 'Compras obtenidas exitosamente', compras);

    } catch (error: any) {
        logger.error('Error en getCompras:', error);
        return errorResponse(res, 'Error al obtener las compras', 500);
    }
};

/**
 * Obtener detalle de una compra específica
 */
export const getCompra = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { empresaId } = req.query;

        if (!empresaId) {
            return errorResponse(res, 'El ID de empresa es requerido', 400);
        }

        // Obtener compra
        const [compra]: any = await query(
            `SELECT 
                c.*,
                p.razon_social as proveedor_nombre,
                u.nombre as usuario_nombre,
                u.apellido as usuario_apellido
            FROM compras c
            LEFT JOIN proveedores p ON c.proveedor_id = p.id
            LEFT JOIN usuarios u ON c.usuario_id = u.id
            WHERE c.id = ? AND c.empresa_id = ?`,
            [id, empresaId]
        );

        if (!compra) {
            return errorResponse(res, 'Compra no encontrada', 404);
        }

        // Obtener detalle de productos
        const detalle = await query(
            `SELECT 
                cd.*,
                pr.nombre as producto_nombre,
                pr.sku,
                pr.codigo_barras
            FROM compras_detalle cd
            LEFT JOIN productos pr ON cd.producto_id = pr.id
            WHERE cd.compra_id = ?`,
            [id]
        );

        const resultado = {
            ...compra,
            productos: detalle
        };

        return successResponse(res, 'Compra obtenida exitosamente', resultado);

    } catch (error: any) {
        logger.error('Error en getCompra:', error);
        return errorResponse(res, 'Error al obtener la compra', 500);
    }
};

/**
 * Crear nueva compra
 */
export const crearCompra = async (req: Request, res: Response) => {
    try {
        const {
            empresaId,
            proveedorId,
            numeroCompra,
            fechaCompra,
            tipoCompra,
            productos,
            impuestos,
            descuento,
            notas,
            usuarioId
        } = req.body;

        // Validaciones
        if (!empresaId || !proveedorId || !numeroCompra || !fechaCompra || !productos || productos.length === 0) {
            return errorResponse(res, 'Faltan datos requeridos', 400);
        }

        // Calcular totales
        let subtotal = 0;
        productos.forEach((prod: any) => {
            subtotal += prod.cantidad * prod.precio_unitario;
        });

        const total = subtotal + (impuestos || 0) - (descuento || 0);

        // Insertar compra
        const resultado: any = await query(
            `INSERT INTO compras (
                empresa_id, proveedor_id, numero_compra, fecha_compra, 
                tipo_compra, subtotal, impuestos, descuento, total, 
                estado, notas, usuario_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)`,
            [
                empresaId, proveedorId, numeroCompra, fechaCompra,
                tipoCompra || 'contado', subtotal, impuestos || 0, descuento || 0, total,
                notas, usuarioId
            ]
        );

        const compraId = resultado.insertId;

        // Insertar detalle de productos
        for (const producto of productos) {
            const subtotalProducto = producto.cantidad * producto.precio_unitario;
            await query(
                `INSERT INTO compras_detalle (
                    compra_id, producto_id, cantidad, precio_unitario, subtotal
                ) VALUES (?, ?, ?, ?, ?)`,
                [compraId, producto.producto_id, producto.cantidad, producto.precio_unitario, subtotalProducto]
            );
        }

        return successResponse(res, 'Compra creada exitosamente', { id: compraId }, 201);

    } catch (error: any) {
        logger.error('Error en crearCompra:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return errorResponse(res, 'El número de compra ya existe', 400);
        }
        return errorResponse(res, 'Error al crear la compra', 500);
    }
};

/**
 * Recibir compra y actualizar inventario
 */
export const recibirCompra = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { empresaId, fechaRecepcion, usuarioId } = req.body;

        if (!empresaId) {
            return errorResponse(res, 'El ID de empresa es requerido', 400);
        }

        // Verificar que la compra existe y está pendiente
        const [compra]: any = await query(
            'SELECT * FROM compras WHERE id = ? AND empresa_id = ?',
            [id, empresaId]
        );

        if (!compra) {
            return errorResponse(res, 'Compra no encontrada', 404);
        }

        if (compra.estado !== 'pendiente') {
            return errorResponse(res, 'La compra ya ha sido procesada', 400);
        }

        // Obtener productos de la compra
        const productos = await query(
            'SELECT * FROM compras_detalle WHERE compra_id = ?',
            [id]
        );

        // Obtener bodega principal de la empresa
        const [bodegaPrincipal]: any = await query(
            'SELECT id FROM bodegas WHERE empresa_id = ? AND es_principal = TRUE AND estado = "activa" LIMIT 1',
            [empresaId]
        );

        // Actualizar inventario de cada producto con Costo Promedio Ponderado (CPP)
        for (const prod of productos as any[]) {
            // Obtener datos actuales del producto
            const [producto]: any = await query(
                'SELECT stock_actual, precio_compra, maneja_inventario FROM productos WHERE id = ?',
                [prod.producto_id]
            );

            if (!producto) {
                logger.info(`Producto ${prod.producto_id} no encontrado, saltando`);
                continue;
            }

            const stockAnterior = producto.stock_actual || 0;
            const stockNuevo = stockAnterior + prod.cantidad;
            const precioAnterior = parseFloat(producto.precio_compra) || 0;
            const precioNuevo = parseFloat(prod.precio_unitario);

            // ── Costo Promedio Ponderado (CPP) ──────────────────────────────
            // Si hay stock existente: promediamos ponderado
            // Si no hay stock (o es 0): el nuevo precio reemplaza directamente
            let nuevoPrecioCompra: number;
            if (stockAnterior > 0 && precioAnterior > 0) {
                nuevoPrecioCompra = Math.round(
                    ((stockAnterior * precioAnterior) + (prod.cantidad * precioNuevo))
                    / stockNuevo * 100
                ) / 100;
            } else {
                // Sin stock previo o sin precio anterior → precio nuevo directo
                nuevoPrecioCompra = Math.round(precioNuevo * 100) / 100;
            }
            // ────────────────────────────────────────────────────────────────

            // Actualizar stock y precio_compra (CPP) en la tabla productos
            await query(
                'UPDATE productos SET stock_actual = ?, precio_compra = ? WHERE id = ?',
                [stockNuevo, nuevoPrecioCompra, prod.producto_id]
            );

            // Actualizar stock en bodega principal
            if (bodegaPrincipal) {
                await query(
                    `INSERT INTO productos_bodegas (producto_id, bodega_id, stock_actual)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE stock_actual = stock_actual + ?`,
                    [prod.producto_id, bodegaPrincipal.id, prod.cantidad, prod.cantidad]
                );
            }

            // Construir nota con detalle del CPP para trazabilidad
            const notaCPP = stockAnterior > 0 && precioAnterior > 0
                ? `CPP: (${stockAnterior} u × $${precioAnterior} + ${prod.cantidad} u × $${precioNuevo}) / ${stockNuevo} u = $${nuevoPrecioCompra}`
                : `Precio directo (sin stock previo): $${nuevoPrecioCompra}`;

            // Registrar movimiento con costo unitario CPP
            try {
                await query(
                    `INSERT INTO inventario_movimientos (
                        producto_id, tipo_movimiento, cantidad, stock_anterior,
                        stock_nuevo, costo_unitario, precio_costo_anterior,
                        motivo, referencia_tipo, referencia_id,
                        usuario_id, fecha, notas
                    ) VALUES (?, 'entrada', ?, ?, ?, ?, ?, 'compra', 'compra', ?, ?, ?, ?)`,
                    [
                        prod.producto_id, prod.cantidad, stockAnterior, stockNuevo,
                        nuevoPrecioCompra, precioAnterior > 0 ? precioAnterior : null,
                        id, usuarioId, fechaRecepcion || new Date(), notaCPP
                    ]
                );
            } catch (movErr: any) {
                // Si las columnas CPP no existen aún (migración pendiente), insertar sin ellas
                if (movErr.code === 'ER_BAD_FIELD_ERROR') {
                    await query(
                        `INSERT INTO inventario_movimientos (
                            producto_id, tipo_movimiento, cantidad, stock_anterior,
                            stock_nuevo, motivo, referencia_tipo, referencia_id,
                            usuario_id, fecha, notas
                        ) VALUES (?, 'entrada', ?, ?, ?, 'compra', 'compra', ?, ?, ?, ?)`,
                        [
                            prod.producto_id, prod.cantidad, stockAnterior, stockNuevo,
                            id, usuarioId, fechaRecepcion || new Date(), notaCPP
                        ]
                    );
                } else {
                    throw movErr;
                }
            }

            logger.info(
                `Producto ${prod.producto_id}: stock ${stockAnterior}→${stockNuevo}, ` +
                `precio_compra $${precioAnterior}→$${nuevoPrecioCompra} (CPP)`
            );
        }

        // Actualizar estado de la compra
        await query(
            'UPDATE compras SET estado = "recibida", fecha_recepcion = ? WHERE id = ?',
            [fechaRecepcion || new Date(), id]
        );

        return successResponse(res, 'Compra recibida e inventario actualizado exitosamente', null);

    } catch (error: any) {
        logger.error('Error en recibirCompra:', error);
        return errorResponse(res, 'Error al recibir la compra', 500);
    }
};

/**
 * Anular compra
 */
export const anularCompra = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { empresaId } = req.body;

        if (!empresaId) {
            return errorResponse(res, 'El ID de empresa es requerido', 400);
        }

        // Verificar que la compra existe
        const [compra]: any = await query(
            'SELECT * FROM compras WHERE id = ? AND empresa_id = ?',
            [id, empresaId]
        );

        if (!compra) {
            return errorResponse(res, 'Compra no encontrada', 404);
        }

        if (compra.estado === 'anulada') {
            return errorResponse(res, 'La compra ya está anulada', 400);
        }

        // Si la compra ya fue recibida, no se puede anular sin ajustar inventario
        if (compra.estado === 'recibida') {
            return errorResponse(res, 'No se puede anular una compra recibida. Debe hacer un ajuste de inventario.', 400);
        }

        // Anular compra
        await query(
            'UPDATE compras SET estado = "anulada" WHERE id = ?',
            [id]
        );

        return successResponse(res, 'Compra anulada exitosamente', null);

    } catch (error: any) {
        logger.error('Error en anularCompra:', error);
        return errorResponse(res, 'Error al anular la compra', 500);
    }
};

/**
 * Obtener resumen/estadísticas de compras
 */
export const getResumen = async (req: Request, res: Response) => {
    try {
        const { empresaId } = req.query;

        if (!empresaId) {
            return errorResponse(res, 'El ID de empresa es requerido', 400);
        }

        // Total de compras
        const [totalCompras]: any = await query(
            'SELECT COUNT(*) as total FROM compras WHERE empresa_id = ? AND estado != "anulada"',
            [empresaId]
        );

        // Compras pendientes
        const [comprasPendientes]: any = await query(
            'SELECT COUNT(*) as total FROM compras WHERE empresa_id = ? AND estado = "pendiente"',
            [empresaId]
        );

        // Total gastado este mes
        const [totalMes]: any = await query(
            `SELECT COALESCE(SUM(total), 0) as total 
            FROM compras 
            WHERE empresa_id = ? 
            AND estado != "anulada"
            AND MONTH(fecha_compra) = MONTH(CURRENT_DATE())
            AND YEAR(fecha_compra) = YEAR(CURRENT_DATE())`,
            [empresaId]
        );

        const resumen = {
            total_compras: totalCompras.total,
            compras_pendientes: comprasPendientes.total,
            total_mes: totalMes.total
        };

        return successResponse(res, 'Resumen obtenido exitosamente', resumen);

    } catch (error: any) {
        logger.error('Error en getResumen:', error);
        return errorResponse(res, 'Error al obtener el resumen', 500);
    }
};
