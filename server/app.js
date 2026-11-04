import express from "express";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { User } from "./models/user.js";
import { Session } from "./models/session.js";
import { Category } from "./models/category.js";
import { Product } from "./models/product.js";
import { leerCarritoUsuario, guardarCarritoUsuario } from "./models/cart.js";
import { crearRutasCarrito } from "./cart.js";
import {
    borrarCookieSesion, crearTokenSesion, hashPassword, hashToken, guardarCookieSesion,
    leerTokenSesion, verificarContrasena, venceSesion
} from "./auth.js";

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
    categoriaEnUso = id => Product.exists({ categoryIds: id }),
    buscarUsuarioPorEmail = email => User.findOne({ email }).select("+hashed_password").lean().exec(),
    buscarUsuarioPorId = id => User.findById(id).select("+hashed_password").lean().exec(),
    crearUsuario = usuario => usuario.save(),
    actualizarContrasena = async (id, hashedPassword) => {
        const usuario = await User.findById(id).select("+hashed_password").exec();
        if (!usuario) return null;
        usuario.hashed_password = hashedPassword;
        await usuario.save();
        return usuario;
    },
    crearSesion = sesion => new Session(sesion).save(),
    buscarSesion = tokenHash => Session.findOne({ tokenHash }).lean().exec(),
    eliminarSesion = tokenHash => Session.deleteOne({ tokenHash }).exec(),
    eliminarOtrasSesiones = (userId, tokenHash) =>
        Session.deleteMany({ userId, tokenHash: { $ne: tokenHash } }).exec(),
    leerCarrito = leerCarritoUsuario,
    guardarCarrito = guardarCarritoUsuario
} = {}) {
    const app = express();
    app.disable("x-powered-by");
    app.use(express.json());

    function usuarioPublico(usuario) {
        return {
            id: String(usuario._id),
            uuid: usuario.uuid,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            email: usuario.email,
            role: usuario.role,
            direccion: usuario.direccion || ""
        };
    }

    async function autenticar(request, response, next) {
        const token = leerTokenSesion(request);
        if (!token) return response.status(401).json({ error: "Iniciá sesión para continuar." });
        const tokenHash = hashToken(token);
        try {
            const sesion = await buscarSesion(tokenHash);
            if (!sesion || new Date(sesion.expiresAt) <= new Date()) {
                return response.status(401).json({ error: "La sesión venció. Iniciá sesión nuevamente." });
            }
            const usuario = await buscarUsuarioPorId(sesion.userId);
            if (!usuario) return response.status(401).json({ error: "La sesión no es válida." });
            request.usuario = usuario;
            request.tokenHash = tokenHash;
            return next();
        } catch {
            return response.status(503).json({ error: "No se pudo validar la sesión." });
        }
    }

    function soloAdmin(request, response, next) {
        if (request.usuario.role !== "admin") {
            return response.status(403).json({ error: "Se requiere una cuenta de administrador." });
        }
        return next();
    }

    app.use("/api/cart", autenticar, crearRutasCarrito({
        buscarProducto, leerCarritoUsuario: leerCarrito, guardarCarritoUsuario: guardarCarrito
    }));

    app.post("/api/register", async (request, response) => {
        const { nombre, apellido, email, password } = request.body || {};
        const nombreLimpio = typeof nombre === "string" ? nombre.trim() : "";
        const apellidoLimpio = typeof apellido === "string" ? apellido.trim() : "";
        const emailLimpio = typeof email === "string" ? email.trim().toLowerCase() : "";
        if (!nombreLimpio || nombreLimpio.length > 80 ||
            !apellidoLimpio || apellidoLimpio.length > 80 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio) || emailLimpio.length > 254 ||
            typeof password !== "string" || password.length < 8 || password.length > 128) {
            return response.status(400).json({ error: "Revisá los datos. La contraseña debe tener entre 8 y 128 caracteres." });
        }

        try {
            if (await buscarUsuarioPorEmail(emailLimpio)) {
                return response.status(409).json({ error: "Ya existe una cuenta con ese email." });
            }
            const usuario = await crearUsuario(new User({
                nombre: nombreLimpio,
                apellido: apellidoLimpio,
                email: emailLimpio,
                hashed_password: await hashPassword(password)
            }));
            const token = crearTokenSesion();
            await crearSesion({ userId: usuario._id, tokenHash: hashToken(token), expiresAt: venceSesion() });
            guardarCookieSesion(response, token);
            return response.status(201).set("Cache-Control", "no-store").json(usuarioPublico(usuario));
        } catch (error) {
            if (error.code === 11000) {
                return response.status(409).json({ error: "Ya existe una cuenta con ese email." });
            }
            if (error instanceof mongoose.Error.ValidationError ||
                error instanceof mongoose.Error.StrictModeError) {
                return response.status(400).json({ error: "Los datos de la cuenta no son válidos." });
            }
            return response.status(503).json({ error: "No se pudo crear la cuenta." });
        }
    });

    app.post("/api/login", async (request, response) => {
        const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
        const password = typeof request.body?.password === "string" ? request.body.password : "";
        if (!email || email.length > 254 || !password || password.length > 128) {
            return response.status(400).json({ error: "Ingresá un email y una contraseña válidos." });
        }
        try {
            const usuario = await buscarUsuarioPorEmail(email);
            const dummyPassword = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;
            const passwordValida = await verificarContrasena(
                password, usuario?.hashed_password || dummyPassword
            );
            if (!usuario || !passwordValida) {
                return response.status(401).json({ error: "Email o contraseña incorrectos." });
            }
            const token = crearTokenSesion();
            await crearSesion({ userId: usuario._id, tokenHash: hashToken(token), expiresAt: venceSesion() });
            guardarCookieSesion(response, token);
            return response.set("Cache-Control", "no-store").json(usuarioPublico(usuario));
        } catch {
            return response.status(503).json({ error: "No se pudo iniciar sesión." });
        }
    });

    app.get("/api/session", autenticar, (request, response) => {
        response.set("Cache-Control", "no-store").json(usuarioPublico(request.usuario));
    });

    app.post("/api/logout", async (request, response) => {
        try {
            const token = leerTokenSesion(request);
            if (token) await eliminarSesion(hashToken(token));
            borrarCookieSesion(response);
            return response.status(204).end();
        } catch {
            return response.status(503).json({ error: "No se pudo cerrar sesión." });
        }
    });

    app.patch("/api/change-password", autenticar, async (request, response) => {
        const { currentPassword, newPassword } = request.body || {};
        if (typeof currentPassword !== "string" || !currentPassword ||
            typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
            return response.status(400).json({ error: "Ingresá la contraseña actual y una nueva de al menos 8 caracteres." });
        }
        try {
            const usuario = await buscarUsuarioPorId(request.usuario._id);
            if (!usuario || !await verificarContrasena(currentPassword, usuario.hashed_password)) {
                return response.status(400).json({ error: "La contraseña actual es incorrecta." });
            }
            if (currentPassword === newPassword) {
                return response.status(400).json({ error: "La nueva contraseña debe ser diferente." });
            }
            await actualizarContrasena(usuario._id, await hashPassword(newPassword));
            await eliminarOtrasSesiones(usuario._id, request.tokenHash);
            return response.status(200).json({ message: "La contraseña se actualizó correctamente." });
        } catch {
            return response.status(503).json({ error: "No se pudo cambiar la contraseña." });
        }
    });

    app.get("/api/categories", async (request, response) => {
        const categorias = await listarCategorias();
        response.set("Cache-Control", "no-store").json(categorias.map(categoria => ({
            id: String(categoria._id),
            name: categoria.name
        })));
    });

    app.post("/api/categories", autenticar, soloAdmin, async (request, response) => {
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

    app.patch("/api/categories/:id", autenticar, soloAdmin, async (request, response) => {
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

    app.delete("/api/categories/:id", autenticar, soloAdmin, async (request, response) => {
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

    app.post("/api/products", autenticar, soloAdmin, async (request, response) => {
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

    app.patch("/api/products/:id", autenticar, soloAdmin, async (request, response) => {
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

    app.delete("/api/products/:id", autenticar, soloAdmin, async (request, response) => {
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
    app.use("/react", express.static(fileURLToPath(new URL("../dist/", import.meta.url)), { dotfiles: "deny" }));
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