import express from "express";
import { fileURLToPath } from "node:url";
import { Product } from "./models/product.js";

const frontendDirectory = fileURLToPath(new URL("../frontend/", import.meta.url));
const browserScriptsDirectory = fileURLToPath(new URL("../backend/", import.meta.url));
const browserScripts = new Set([
    "calculos.js", "carrito.js", "carrusel_resenas.js", "cart_storage.js",
    "catalogo.js", "checkout.js", "filter_products.js", "load_products.js",
    "navbar.js", "theme.js"
]);

function serializarProducto(documento) {
    const { _id, ...producto } = documento;
    return producto;
}

export function createApp({
    listarProductos = () => Product.find().lean().exec(),
    buscarProducto = id => Product.findById(id).lean().exec(),
    crearProducto = producto => producto.save()
} = {}) {
    const app = express();
    app.disable("x-powered-by");
    app.use(express.json());

    app.post("/api/products", async (request, response) => {
        let producto;
        try {
            producto = new Product(request.body);
            await producto.validate();
        } catch {
            return response.status(400).json({ error: "El producto no cumple el esquema." });
        }

        try {
            const creado = await crearProducto(producto);
            const documento = typeof creado.toObject === "function" ? creado.toObject() : creado;
            const { _id, ...datos } = documento;
            return response.status(201).json({ id: String(_id), ...datos });
        } catch (error) {
            if (error.code === 11000) {
                return response.status(409).json({ error: "Ya existe un producto con ese ID." });
            }
            return response.status(503).json({ error: "No se pudo guardar el producto." });
        }
    });

    app.get("/api/products", async (request, response) => {
        const productos = await listarProductos();
        const items = Object.fromEntries(productos.map(producto => [
            String(producto._id), serializarProducto(producto)
        ]));
        response.set("Cache-Control", "no-store").json({ items });
    });

    app.get("/api/products/:id", async (request, response) => {
        const producto = await buscarProducto(request.params.id);
        if (!producto) return response.status(404).json({ error: "Producto no encontrado." });
        response.json({ id: String(producto._id), ...serializarProducto(producto) });
    });

    app.get("/", (request, response) => response.redirect("/frontend/index.html"));
    app.use("/frontend", express.static(frontendDirectory, { dotfiles: "deny" }));
    app.get("/backend/:filename", (request, response, next) => {
        if (!browserScripts.has(request.params.filename)) return next();
        response.sendFile(request.params.filename, { root: browserScriptsDirectory });
    });

    app.use((request, response) => {
        response.status(404).json({ error: "Ruta no encontrada." });
    });

    app.use((error, request, response, next) => {
        if (response.headersSent) return next(error);
        response.status(503).json({ error: "No se pudieron cargar los productos. Intentá nuevamente." });
    });

    return app;
}