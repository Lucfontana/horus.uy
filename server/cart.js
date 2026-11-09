import { Router } from "express";
import { claveEntradaCarrito } from "../backend/cart_storage.js";

function entradaValida(entry, allowZero = false) {
    return entry && typeof entry === "object" && !Array.isArray(entry) &&
        typeof entry.productId === "string" && entry.productId.length > 0 && entry.productId.length <= 160 &&
        typeof entry.color === "string" && entry.color.length > 0 && entry.color.length <= 80 &&
        typeof entry.size === "string" && entry.size.length > 0 && entry.size.length <= 80 &&
        Number.isInteger(entry.quantity) && entry.quantity >= (allowZero ? 0 : 1) && entry.quantity <= 15;
}

function soloVariante({ productId, color, size, quantity }) {
    return { productId, color, size, quantity };
}

export function crearRutasCarrito({ buscarProducto, leerCarritoUsuario, guardarCarritoUsuario }) {
    const router = Router();

    async function representar(cart, userId, warnings = []) {
        const entries = [];
        for (const entry of cart.entries) {
            const product = await buscarProducto(entry.productId);
            if (!product || !product.colors.includes(entry.color) || !product.size.includes(entry.size)) {
                warnings.push("Hay productos o variantes que ya no están disponibles y no se muestran en tu carrito.");
                continue;
            }
            entries.push({
                ...soloVariante(entry),
                name: product.name,
                imgSrc: product.imgSrc,
                price: product.price
            });
        }
        return { userId: String(userId), entries, version: cart.version, warnings: [...new Set(warnings)] };
    }

    router.use((request, response, next) => {
        response.set("Cache-Control", "no-store");
        if (request.get("X-Cart-User") && request.get("X-Cart-User") !== String(request.usuario._id)) {
            return response.status(409).json({ error: "La sesión cambió. Actualizá tu cuenta antes de continuar." });
        }
        next();
    });

    router.get("/", async (request, response) => {
        const cart = await leerCarritoUsuario(request.usuario._id);
        response.json(await representar(cart, request.usuario._id));
    });

    router.post("/merge", async (request, response) => {
        const { mergeId, entries } = request.body || {};
        if (typeof mergeId !== "string" || !/^[\da-f-]{36}$/i.test(mergeId) ||
            !Array.isArray(entries) || entries.length > 200 || !entries.every(entry => entradaValida(entry))) {
            return response.status(400).json({ error: "El carrito de invitado no es válido." });
        }
        const userId = request.usuario._id;
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const cart = await leerCarritoUsuario(userId);
            if (cart.mergeIds.includes(mergeId)) {
                return response.json({ ...await representar(cart, userId), merged: entries.length > 0 });
            }
            const warnings = [];
            const combined = new Map(cart.entries.map(entry => [claveEntradaCarrito(entry), soloVariante(entry)]));
            for (const entry of entries) {
                const product = await buscarProducto(entry.productId);
                if (!product || !product.colors.includes(entry.color) || !product.size.includes(entry.size)) {
                    warnings.push("No se agregaron productos o variantes que ya no están disponibles.");
                    continue;
                }
                const key = claveEntradaCarrito(entry);
                const quantity = (combined.get(key)?.quantity || 0) + entry.quantity;
                if (quantity > 15) warnings.push("Se ajustaron cantidades al máximo de 15 unidades por variante.");
                combined.set(key, { ...soloVariante(entry), quantity: Math.min(15, quantity) });
            }
            if (combined.size > 200) {
                return response.status(400).json({ error: "El carrito admite hasta 200 variantes. Revisalo antes de combinar." });
            }
            const saved = await guardarCarritoUsuario(userId, cart.version, {
                entries: [...combined.values()], mergeIds: [...cart.mergeIds, mergeId]
            });
            if (saved) return response.json({ ...await representar(saved, userId, warnings), merged: entries.length > 0 });
        }
        return response.status(409).json({ error: "El carrito cambió en otro dispositivo. Reintentá la combinación." });
    });

    router.put("/entry", async (request, response) => {
        const { entry, version } = request.body || {};
        if (!entradaValida(entry, true) || !Number.isInteger(version) || version < 0) {
            return response.status(400).json({ error: "La variante o cantidad del carrito no es válida." });
        }
        const userId = request.usuario._id;
        const cart = await leerCarritoUsuario(userId);
        if (cart.version !== version) {
            return response.status(409).json({ error: "Tu carrito cambió en otra pestaña o dispositivo. Revisalo y reintentá." });
        }
        if (entry.quantity > 0) {
            const product = await buscarProducto(entry.productId);
            if (!product || !product.colors.includes(entry.color) || !product.size.includes(entry.size)) {
                return response.status(400).json({ error: "El producto o variante ya no está disponible." });
            }
        }
        const key = claveEntradaCarrito(entry);
        const entries = cart.entries.filter(item => claveEntradaCarrito(item) !== key).map(soloVariante);
        if (entry.quantity > 0) entries.push(soloVariante(entry));
        if (entries.length > 200) return response.status(400).json({ error: "El carrito admite hasta 200 variantes." });
        const saved = await guardarCarritoUsuario(userId, version, { entries });
        if (!saved) return response.status(409).json({ error: "Tu carrito cambió. Actualizalo antes de reintentar." });
        return response.json(await representar(saved, userId));
    });

    router.use((error, request, response, next) => {
        if (response.headersSent) return next(error);
        return response.status(503).json({ error: "No se pudo cargar o guardar tu carrito. Reintentá sin cerrar sesión." });
    });
    return router;
}
