import express from "express";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { Category } from "./models/category.js";
import { Product } from "./models/product.js";

const frontendDirectory = fileURLToPath(new URL("../frontend/", import.meta.url));
const browserScriptsDirectory = fileURLToPath(new URL("../backend/", import.meta.url));
const browserScripts = new Set([
    "calculos.js", "carrito.js", "carrusel_resenas.js", "cart_storage.js",
    "catalogo.js", "checkout.js", "filter_products.js", "load_products.js",
    "navbar.js", "panel_admin-logica.js", "theme.js"
]);

function idDeCategoria(categoria) {
    return String(categoria && typeof categoria === "object" ? categoria._id : categoria);
}

function serializarProducto(documento, nombresPorId) {
    const producto = typeof documento.toObject === "function" ? documento.toObject() : documento;
    const referencias = producto.categoryIds || [];
    const ids = referencias.map(idDeCategoria);
    const categorias = Array.isArray(producto.categories)
        ? producto.categories
        : referencias.map(categoria => {
            if (categoria && typeof categoria === "object" && categoria.name) return categoria.name;
            return nombresPorId.get(idDeCategoria(categoria));
        }).filter(Boolean);
    const { _id, categories, categoryIds, ...datos } = producto;
    return { id: String(_id), ...datos, categories: categorias, categoryIds: ids };
}

class DatosProductoInvalidos extends Error {}

async function normalizarCamposProducto(datos, parcial, buscarCategoriasPorNombre, buscarCategoriasPorId) {
    const campos = { ...datos };
    const tieneIds = Object.hasOwn(campos, "categoryIds");
    const tieneNombres = Object.hasOwn(campos, "categories");

    if (tieneIds || tieneNombres) {
        const esLista = tieneIds ? Array.isArray(campos.categoryIds) : Array.isArray(campos.categories);
        if (!esLista) throw new DatosProductoInvalidos();

        let categorias;
        if (tieneIds) {
            const ids = [...new Set(campos.categoryIds.map(String))];
            if (ids.some(id => !mongoose.isValidObjectId(id))) throw new DatosProductoInvalidos();
            categorias = await buscarCategoriasPorId(ids);
            if (categorias.length !== ids.length) throw new DatosProductoInvalidos();
        } else {
            const nombres = [...new Set(campos.categories.map(nombre =>
                typeof nombre === "string" ? nombre.trim() : ""
            ))];
            if (nombres.some(nombre => !nombre)) throw new DatosProductoInvalidos();
            categorias = await buscarCategoriasPorNombre(nombres);
            if (categorias.length !== nombres.length) throw new DatosProductoInvalidos();
        }
        campos.categoryIds = categorias.map(categoria => categoria._id);
    } else if (!parcial) {
        campos.categoryIds = [];
    }

    delete campos.categories;
    return campos;
}

export function createApp({
    listarProductos = () => Product.find().populate("categoryIds", "name").lean().exec(),
    buscarProducto = id => Product.findById(id).populate("categoryIds", "name").lean().exec(),
    crearProducto = producto => producto.save(),
    actualizarProducto = async (id, cambios) => {
        const producto = await Product.findById(id).exec();
        if (!producto) return null;
        Object.assign(producto, cambios);
        await producto.save();
        return producto;
    },
    eliminarProducto = id => Product.findByIdAndDelete(id).lean().exec(),
    listarCategorias = () => Category.find().sort({ name: 1 }).lean().exec(),
    buscarCategoria = id => Category.findById(id).lean().exec(),
    buscarCategoriaPorNombre = name => Category.findOne({ name }).lean().exec(),
    buscarCategoriasPorNombre = names => Category.find({ name: { $in: names } }).lean().exec(),
    buscarCategoriasPorId = ids => Category.find({ _id: { $in: ids } }).lean().exec(),
    crearCategoria = categoria => categoria.save(),
    actualizarCategoria = async (id, cambios) => {
        const categoria = await Category.findById(id).exec();
        if (!categoria) return null;
        Object.assign(categoria, cambios);
        await categoria.save();
        return categoria;
    },
    eliminarCategoria = id => Category.findByIdAndDelete(id).lean().exec(),
    categoriaEnUso = id => Product.exists({ categoryIds: id })
} = {}) {
    const app = express();
    app.disable("x-powered-by");
    app.use(express.json());

    app.get("/api/categories", async (request, response) => {
        const categorias = await listarCategorias();
        response.set("Cache-Control", "no-store").json(categorias.map(categoria => ({
            id: String(categoria._id),
            name: categoria.name
        })));
    });

    app.post("/api/categories", async (request, response) => {
        const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
        if (!name || name.length > 80) {
            return response.status(400).json({ error: "Ingresá un nombre de categoría de hasta 80 caracteres." });
        }
        try {
            if (await buscarCategoriaPorNombre(name)) {
                return response.status(409).json({ error: "Ya existe una categoría con ese nombre." });
            }
            const creada = await crearCategoria(new Category({ name }));
            return response.status(201).json({ id: String(creada._id), name: creada.name });
        } catch (error) {
            if (error.code === 11000) {
                return response.status(409).json({ error: "Ya existe una categoría con ese nombre." });
            }
            if (error instanceof mongoose.Error.ValidationError ||
                error instanceof mongoose.Error.StrictModeError) {
                return response.status(400).json({ error: "El nombre de categoría no es válido." });
            }
            return response.status(503).json({ error: "No se pudo guardar la categoría." });
        }
    });

    app.patch("/api/categories/:id", async (request, response) => {
        const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
        if (!mongoose.isValidObjectId(request.params.id)) {
            return response.status(404).json({ error: "Categoría no encontrada." });
        }
        if (!name || name.length > 80) {
            return response.status(400).json({ error: "Ingresá un nombre de categoría de hasta 80 caracteres." });
        }
        try {
            const existente = await buscarCategoria(request.params.id);
            if (!existente) return response.status(404).json({ error: "Categoría no encontrada." });
            const duplicada = await buscarCategoriaPorNombre(name);
            if (duplicada && String(duplicada._id) !== String(existente._id)) {
                return response.status(409).json({ error: "Ya existe una categoría con ese nombre." });
            }
            const actualizada = await actualizarCategoria(request.params.id, { name });
            if (!actualizada) return response.status(404).json({ error: "Categoría no encontrada." });
            return response.status(200).json({ id: String(actualizada._id), name: actualizada.name });
        } catch (error) {
            if (error.code === 11000) {
                return response.status(409).json({ error: "Ya existe una categoría con ese nombre." });
            }
            return response.status(503).json({ error: "No se pudo actualizar la categoría." });
        }
    });

    app.delete("/api/categories/:id", async (request, response) => {
        if (!mongoose.isValidObjectId(request.params.id)) {
            return response.status(404).json({ error: "Categoría no encontrada." });
        }
        try {
            const categoria = await buscarCategoria(request.params.id);
            if (!categoria) return response.status(404).json({ error: "Categoría no encontrada." });
            if (await categoriaEnUso(request.params.id)) {
                return response.status(409).json({ error: "No se puede eliminar una categoría asignada a productos." });
            }
            const eliminada = await eliminarCategoria(request.params.id);
            if (!eliminada) return response.status(404).json({ error: "Categoría no encontrada." });
            return response.status(200).json({ id: String(eliminada._id) });
        } catch {
            return response.status(503).json({ error: "No se pudo eliminar la categoría." });
        }
    });

    app.post("/api/products", async (request, response) => {
        const datos = request.body;
        if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
            return response.status(400).json({ error: "Enviá los datos del producto." });
        }
        let producto;
        try {
            const campos = await normalizarCamposProducto(
                datos, false, buscarCategoriasPorNombre, buscarCategoriasPorId
            );
            producto = new Product({
                ...campos,
                _id: campos._id ?? new mongoose.Types.ObjectId().toString()
            });
            await producto.validate();
        } catch (error) {
            if (!(error instanceof DatosProductoInvalidos) &&
                !(error instanceof mongoose.Error.ValidationError) &&
                !(error instanceof mongoose.Error.StrictModeError) &&
                !(error instanceof mongoose.Error.CastError)) {
                return response.status(503).json({ error: "No se pudieron validar las categorías del producto." });
            }
            return response.status(400).json({ error: "El producto no cumple el esquema." });
        }

        try {
            const creado = await crearProducto(producto);
            const categorias = await listarCategorias();
            const nombresPorId = new Map(categorias.map(categoria => [String(categoria._id), categoria.name]));
            return response.status(201).json(serializarProducto(creado, nombresPorId));
        } catch (error) {
            if (error.code === 11000) {
                return response.status(409).json({ error: "Ya existe un producto con ese ID." });
            }
            return response.status(503).json({ error: "No se pudo guardar el producto." });
        }
    });

    app.patch("/api/products/:id", async (request, response) => {
        const datos = request.body;
        if (!datos || typeof datos !== "object" || Array.isArray(datos) ||
            Object.keys(datos).length === 0) {
            return response.status(400).json({ error: "Enviá al menos un campo para actualizar." });
        }

        let existente;
        let cambios;
        try {
            existente = await buscarProducto(request.params.id);
            if (!existente) return response.status(404).json({ error: "Producto no encontrado." });

            cambios = await normalizarCamposProducto(
                datos, true, buscarCategoriasPorNombre, buscarCategoriasPorId
            );
            const original = typeof existente.toObject === "function" ? existente.toObject() : existente;
            const camposOriginales = { ...original };
            delete camposOriginales.categories;
            camposOriginales.categoryIds = (original.categoryIds || []).map(idDeCategoria);
            const validado = new Product({
                ...camposOriginales,
                _id: String(existente._id),
                ...cambios
            });
            await validado.validate();
        } catch (error) {
            if (error instanceof mongoose.Error.ValidationError ||
                error instanceof mongoose.Error.StrictModeError ||
                error instanceof mongoose.Error.CastError ||
                error instanceof DatosProductoInvalidos) {
                return response.status(400).json({ error: "El producto no cumple el esquema." });
            }
            return response.status(503).json({ error: "No se pudo actualizar el producto." });
        }

        try {
            const actualizado = await actualizarProducto(request.params.id, cambios);
            if (!actualizado) return response.status(404).json({ error: "Producto no encontrado." });
            const productoActualizado = await buscarProducto(request.params.id);
            const categorias = await listarCategorias();
            const nombresPorId = new Map(categorias.map(categoria => [String(categoria._id), categoria.name]));
            return response.status(200).json(serializarProducto(productoActualizado, nombresPorId));
        } catch (error) {
            if (error instanceof mongoose.Error.ValidationError ||
                error instanceof mongoose.Error.StrictModeError) {
                return response.status(400).json({ error: "El producto no cumple el esquema." });
            }
            return response.status(503).json({ error: "No se pudo actualizar el producto." });
        }
    });

    app.delete("/api/products/:id", async (request, response) => {
        try {
            const eliminado = await eliminarProducto(request.params.id);
            if (!eliminado) return response.status(404).json({ error: "Producto no encontrado." });
            return response.status(200).json({ id: String(eliminado._id) });
        } catch {
            return response.status(503).json({ error: "No se pudo eliminar el producto." });
        }
    });

    app.get("/api/products", async (request, response) => {
        const productos = await listarProductos();
        const categorias = await listarCategorias();
        const nombresPorId = new Map(categorias.map(categoria => [String(categoria._id), categoria.name]));
        const items = Object.fromEntries(productos.map(producto => [
            String(producto._id), serializarProducto(producto, nombresPorId)
        ]));
        response.set("Cache-Control", "no-store").json({ items });
    });

    app.get("/api/products/:id", async (request, response) => {
        const producto = await buscarProducto(request.params.id);
        if (!producto) return response.status(404).json({ error: "Producto no encontrado." });
        const categorias = await listarCategorias();
        const nombresPorId = new Map(categorias.map(categoria => [String(categoria._id), categoria.name]));
        response.json(serializarProducto(producto, nombresPorId));
    });

    app.post("/api/products/:id/variants", async (request, response) => {
        const producto = await buscarProducto(request.params.id);
        if (!producto) return response.status(404).json({ error: "Producto no encontrado." });

        const { color, size } = request.body || {};
        if (
            typeof color !== "string" || !color.trim() ||
            typeof size !== "string" || !size.trim()
        ) {
            return response.status(400).json({ error: "Seleccioná un color y un talle." });
        }
        if (
            !Array.isArray(producto.colors) || !producto.colors.includes(color) ||
            !Array.isArray(producto.size) || !producto.size.includes(size)
        ) {
            return response.status(400).json({ error: "El color o talle no está disponible para este producto." });
        }

        return response.status(200).json({ valid: true });
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
        const status = error.status === 400 ? 400 : 503;
        const mensaje = status === 400
            ? "La solicitud contiene JSON inválido."
            : "No se pudieron cargar los productos. Intentá nuevamente.";
        response.status(status).json({ error: mensaje });
    });

    return app;
}