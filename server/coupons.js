import { Router } from "express";
import mongoose from "mongoose";

function representar(coupon) {
    return {
        id: String(coupon._id),
        code: coupon.code,
        discountPercent: coupon.discountPercent
    };
}

export function crearRutasCupones({
    autenticar,
    soloAdmin,
    listarCupones,
    buscarCuponPorCodigo,
    crearCupon,
    eliminarCupon
}) {
    const router = Router();

    router.post("/validate", async (request, response) => {
        const code = typeof request.body?.code === "string" ? request.body.code.trim().toUpperCase() : "";
        if (!code || code.length > 80) {
            return response.status(400).json({ error: "Ingresá un código de descuento válido." });
        }
        try {
            const coupon = await buscarCuponPorCodigo(code);
            if (!coupon) return response.status(404).json({ error: "El código de descuento no es válido." });
            return response.set("Cache-Control", "no-store").json(representar(coupon));
        } catch {
            return response.status(503).json({ error: "No se pudo validar el código de descuento." });
        }
    });

    router.use(autenticar, soloAdmin);

    router.get("/", async (request, response) => {
        try {
            const coupons = await listarCupones();
            return response.set("Cache-Control", "no-store").json(coupons.map(representar));
        } catch {
            return response.status(503).json({ error: "No se pudieron cargar los cupones." });
        }
    });

    router.post("/", async (request, response) => {
        const code = typeof request.body?.code === "string" ? request.body.code.trim().toUpperCase() : "";
        const discountPercent = request.body?.discountPercent;
        if (!code || code.length > 80 || !Number.isInteger(discountPercent) ||
            discountPercent < 1 || discountPercent > 99) {
            return response.status(400).json({ error: "Ingresá un código y un porcentaje entero entre 1 y 99." });
        }
        try {
            if (await buscarCuponPorCodigo(code)) {
                return response.status(409).json({ error: "Ya existe un cupón con ese código." });
            }
            const coupon = await crearCupon({ code, discountPercent });
            return response.status(201).json(representar(coupon));
        } catch (error) {
            if (error.code === 11000) {
                return response.status(409).json({ error: "Ya existe un cupón con ese código." });
            }
            if (error instanceof mongoose.Error.ValidationError ||
                error instanceof mongoose.Error.StrictModeError) {
                return response.status(400).json({ error: "Los datos del cupón no son válidos." });
            }
            return response.status(503).json({ error: "No se pudo guardar el cupón." });
        }
    });

    router.delete("/:id", async (request, response) => {
        if (!mongoose.isValidObjectId(request.params.id)) {
            return response.status(404).json({ error: "Cupón no encontrado." });
        }
        try {
            const coupon = await eliminarCupon(request.params.id);
            if (!coupon) return response.status(404).json({ error: "Cupón no encontrado." });
            return response.status(200).json({ id: String(coupon._id) });
        } catch {
            return response.status(503).json({ error: "No se pudo eliminar el cupón." });
        }
    });

    return router;
}
