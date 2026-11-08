import { Router } from "express";
import mongoose from "mongoose";
import { ORDER_STATUSES } from "./models/order.js";

const phonePattern = /^(?:598\d{8}|09\d{7})$/;

function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function representar(order, user) {
    return {
        id: String(order._id),
        user: user ? {
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email
        } : undefined,
        items: order.items,
        address: order.address,
        phone: order.phone,
        subtotal: order.subtotal,
        couponCode: order.couponCode,
        discountPercent: order.discountPercent,
        discountAmount: order.discountAmount,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt
    };
}

export function crearRutasOrdenes({
    autenticar,
    soloAdmin,
    listarOrdenes,
    buscarOrden,
    crearOrden,
    actualizarEstadoOrden,
    buscarUsuarioPorId,
    buscarProducto,
    buscarCuponPorCodigo,
    leerCarritoUsuario,
    guardarCarritoUsuario
}) {
    const router = Router();
    router.use(autenticar);

    router.get("/", async (request, response) => {
        try {
            const admin = request.usuario.role === "admin";
            const orders = await listarOrdenes(admin ? {} : { userId: request.usuario._id });
            const result = await Promise.all(orders.map(async order => {
                const user = admin ? await buscarUsuarioPorId(order.userId) : null;
                return representar(order, user);
            }));
            return response.set("Cache-Control", "no-store").json(result);
        } catch {
            return response.status(503).json({ error: "No se pudieron cargar las órdenes." });
        }
    });

    router.post("/", async (request, response) => {
        const address = typeof request.body?.address === "string" ? request.body.address.trim() : "";
        const phone = typeof request.body?.phone === "string" ? request.body.phone : "";
        const rawCode = request.body?.couponCode;
        if (address.length < 15 || address.length > 240 || !phonePattern.test(phone) ||
            (rawCode !== undefined && rawCode !== "" &&
                (typeof rawCode !== "string" || rawCode.trim().length > 80))) {
            return response.status(400).json({ error: "Revisá la dirección (mínimo 15 caracteres) y el celular." });
        }

        const whatsappNumber = process.env.WHATSAPP_BUSINESS_NUMBER?.trim() || "";
        if (!/^\d{8,15}$/.test(whatsappNumber)) {
            return response.status(503).json({ error: "El WhatsApp del negocio aún no está configurado. No se creó la orden; contactá al administrador." });
        }

        try {
            let coupon;
            const couponCode = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
            if (couponCode) {
                coupon = await buscarCuponPorCodigo(couponCode);
                if (!coupon) return response.status(400).json({ error: "El cupón ya no es válido. Aplicalo nuevamente." });
            }

            const cart = await leerCarritoUsuario(request.usuario._id);
            if (!cart.entries.length) {
                return response.status(400).json({ error: "Tu carrito está vacío." });
            }
            const items = [];
            for (const entry of cart.entries) {
                const product = await buscarProducto(entry.productId);
                if (!product || !product.colors.includes(entry.color) ||
                    !product.size.includes(entry.size) || !Number.isInteger(entry.quantity) ||
                    entry.quantity < 1 || entry.quantity > 15) {
                    return response.status(400).json({ error: "El carrito contiene productos no disponibles. Revisalo antes de continuar." });
                }
                items.push({
                    productId: String(product._id),
                    name: product.name,
                    imgSrc: product.imgSrc,
                    price: Number(product.price),
                    color: entry.color,
                    size: entry.size,
                    quantity: entry.quantity
                });
            }

            const subtotal = roundMoney(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
            const discountPercent = coupon?.discountPercent || 0;
            const discountAmount = roundMoney(subtotal * discountPercent / 100);
            const order = await crearOrden({
                userId: request.usuario._id,
                items,
                address,
                phone,
                subtotal,
                couponCode: coupon?.code || "",
                discountPercent,
                discountAmount,
                total: roundMoney(subtotal - discountAmount),
                status: "Orden recibida"
            });

            let warning = "";
            try {
                const cartCleared = await guardarCarritoUsuario(request.usuario._id, cart.version, {
                    entries: [],
                    mergeIds: cart.mergeIds
                });
                if (!cartCleared) warning = "La orden se creó, pero el carrito cambió en otra pestaña y no se pudo vaciar.";
            } catch (error) {
                console.error("La orden se creó, pero no se pudo vaciar el carrito:", error);
                warning = "La orden se creó, pero no se pudo vaciar el carrito.";
            }

            const message = `Hola! Solicite una orden de compra con la ID ${String(order._id)}, estoy atento a novedades del envío.`;
            const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
            return response.status(201).json({ ...representar(order), whatsappUrl, warning });
        } catch (error) {
            if (error instanceof mongoose.Error.ValidationError ||
                error instanceof mongoose.Error.StrictModeError) {
                return response.status(400).json({ error: "Los datos de la orden no son válidos." });
            }
            return response.status(503).json({ error: "No se pudo crear la orden. Reintentá sin cerrar sesión." });
        }
    });

    router.post("/:id/discard", async (request, response) => {
        if (!mongoose.isValidObjectId(request.params.id)) {
            return response.status(404).json({ error: "Orden no encontrada." });
        }
        try {
            const order = await buscarOrden(request.params.id);
            if (!order || String(order.userId) !== String(request.usuario._id)) {
                return response.status(404).json({ error: "Orden no encontrada." });
            }
            if (!["Orden recibida", "Procesando"].includes(order.status)) {
                return response.status(409).json({ error: "Esta orden ya no se puede descartar porque fue enviada o finalizada." });
            }
            const updated = await actualizarEstadoOrden(request.params.id, "Descartado");
            if (!updated) return response.status(404).json({ error: "Orden no encontrada." });
            return response.json(representar(updated));
        } catch {
            return response.status(503).json({ error: "No se pudo descartar la orden." });
        }
    });

    router.patch("/:id/status", soloAdmin, async (request, response) => {
        if (!mongoose.isValidObjectId(request.params.id)) {
            return response.status(404).json({ error: "Orden no encontrada." });
        }
        const { status } = request.body || {};
        if (!ORDER_STATUSES.includes(status)) {
            return response.status(400).json({ error: "Seleccioná un estado de orden válido." });
        }
        try {
            const order = await actualizarEstadoOrden(request.params.id, status);
            if (!order) return response.status(404).json({ error: "Orden no encontrada." });
            return response.json(representar(order));
        } catch {
            return response.status(503).json({ error: "No se pudo actualizar el estado de la orden." });
        }
    });

    return router;
}
