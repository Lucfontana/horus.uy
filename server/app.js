import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { User } from "./models/user.js";
import { Session } from "./models/session.js";
import { Category } from "./models/category.js";
import { Product } from "./models/product.js";
import {
    eliminarImagen as eliminarImagenGridFs,
    guardarImagen as guardarImagenGridFs,
    obtenerImagen as obtenerImagenGridFs
} from "./images.js";
import { Coupon } from "./models/coupon.js";
import { Order } from "./models/order.js";
import { leerCarritoUsuario, guardarCarritoUsuario } from "./models/cart.js";
import { crearRutasCarrito } from "./cart.js";
import { crearRutasCupones } from "./coupons.js";
import { crearRutasOrdenes } from "./orders.js";
import {
    borrarCookieSesion, crearTokenSesion, hashPassword, hashToken, guardarCookieSesion,
    leerTokenSesion, verificarContrasena, venceSesion
} from "./auth.js";

const frontendDirectory = fileURLToPath(new URL("../frontend/", import.meta.url));
const chatWindowMs = 60 * 60 * 1000;
const chatRateLimits = new Map();
const chatKnowledgeUrl = new URL("../conocimiento.txt", import.meta.url);

function limitarSolicitudesChat(ip, ahora = Date.now()) {
    let limite = chatRateLimits.get(ip);
    if (!limite || ahora - limite.inicio >= chatWindowMs) {
        limite = { inicio: ahora, cantidad: 0 };
        chatRateLimits.set(ip, limite);
    }
    if (limite.cantidad >= 15) return Math.ceil((chatWindowMs - (ahora - limite.inicio)) / 1000);
    limite.cantidad += 1;
    return 0;
}

async function consultarGroq({ clave, modelo, mensajes }) {
    const respuesta = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${clave}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: modelo,
            messages: mensajes,
            temperature: 0.2,
            max_tokens: 300,
            response_format: { type: "json_object" }
        }),
        signal: AbortSignal.timeout(20000)
    });
    if (!respuesta.ok) throw new Error("Groq request failed");
    const datos = await respuesta.json();
    const contenido = datos.choices?.[0]?.message?.content;
    if (typeof contenido !== "string") throw new Error("Groq response was invalid");
    const resultado = JSON.parse(contenido);
    if (typeof resultado.answer !== "string" || !resultado.answer.trim() ||
        typeof resultado.needsHuman !== "boolean" || typeof resultado.needsCatalog !== "boolean") {
        throw new Error("Groq response was invalid");
    }
    return {
        answer: resultado.answer.slice(0, 1200),
        needsHuman: resultado.needsHuman,
        needsCatalog: resultado.needsCatalog
    };
}

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
    const { _id, categories, categoryIds, imgFileId, imgHoverFileId, ...datos } = producto;
    if (imgFileId) datos.imgSrc = `/api/products/images/${imgFileId}`;
    if (imgHoverFileId) datos.imgSrcHover = `/api/products/images/${imgHoverFileId}`;
    return { id: String(_id), ...datos, categories: categorias, categoryIds: ids };
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class DatosProductoInvalidos extends Error {}

const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 2, fields: 1 }
}).fields([{ name: "image", maxCount: 1 }, { name: "hoverImage", maxCount: 1 }]);

function receiveProductUpload(request, response, next) {
    imageUpload(request, response, error => {
        if (!error) return next();
        if (error instanceof multer.MulterError) {
            const message = error.code === "LIMIT_FILE_SIZE"
                ? "Cada imagen debe pesar 5 MB o menos."
                : "La carga admite una imagen principal y una alternativa.";
            return response.status(400).json({ error: message });
        }
        return response.status(400).json({ error: "No se pudieron leer las imágenes enviadas." });
    });
}

function productRequestData(request) {
    if (!request.is("multipart/form-data")) return request.body;
    if (typeof request.body?.product !== "string") throw new DatosProductoInvalidos();
    let data;
    try {
        data = JSON.parse(request.body.product);
    } catch {
        throw new DatosProductoInvalidos();
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new DatosProductoInvalidos();
    return data;
}

function imageContentType(buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return "image/jpeg";
    }
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        return "image/png";
    }
    if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP") {
        return "image/webp";
    }
    return "";
}

function productImages(request) {
    const files = request.files || {};
    const images = [];
    for (const [field, file] of [["image", files.image?.[0]], ["hoverImage", files.hoverImage?.[0]]]) {
        if (!file) continue;
        const contentType = imageContentType(file.buffer);
        if (!contentType) throw new DatosProductoInvalidos();
        images.push({ field, file, contentType });
    }
    if (images.length === 1 && !request.params.id) throw new DatosProductoInvalidos();
    return images;
}

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
    listarProductosPaginados = (filter, sort, skip, limit) =>
        Product.find(filter).populate("categoryIds", "name").sort(sort).skip(skip).limit(limit).lean().exec(),
    contarProductos = filter => Product.countDocuments(filter).exec(),
    rangoPreciosProductos = () => Product.aggregate([
        { $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } }
    ]).exec(),
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
    guardarImagen = guardarImagenGridFs,
    obtenerImagen = obtenerImagenGridFs,
    eliminarImagen = eliminarImagenGridFs,
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
    listarCupones = () => Coupon.find().sort({ code: 1 }).lean().exec(),
    buscarCuponPorCodigo = code => Coupon.findOne({ code }).lean().exec(),
    crearCupon = coupon => new Coupon(coupon).save(),
    eliminarCupon = id => Coupon.findByIdAndDelete(id).lean().exec(),
    listarOrdenes = filter => Order.find(filter).sort({ createdAt: -1 }).lean().exec(),
    buscarOrden = id => Order.findById(id).lean().exec(),
    crearOrden = order => new Order(order).save(),
    actualizarEstadoOrden = (id, status) =>
        Order.findByIdAndUpdate(id, { status }, { returnDocument: "after", runValidators: true }).lean().exec(),
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

    async function guardarImagenes(images) {
        const saved = [];
        try {
            for (const { field, file, contentType } of images) {
                saved.push({
                    field,
                    id: await guardarImagen(file.buffer, file.originalname, contentType)
                });
            }
            return saved;
        } catch (error) {
            await eliminarImagenes(saved.map(image => image.id));
            throw error;
        }
    }

    async function eliminarImagenes(ids) {
        for (const id of ids.filter(Boolean)) {
            try {
                await eliminarImagen(id);
            } catch (error) {
                console.error("No se pudo eliminar una imagen de producto:", error);
            }
        }
    }

    app.use("/api/cart", autenticar, crearRutasCarrito({
        buscarProducto, leerCarritoUsuario: leerCarrito, guardarCarritoUsuario: guardarCarrito
    }));
    app.use("/api/coupons", crearRutasCupones({
        autenticar, soloAdmin, listarCupones, buscarCuponPorCodigo, crearCupon, eliminarCupon
    }));
    app.use("/api/orders", crearRutasOrdenes({
        autenticar, soloAdmin, listarOrdenes, buscarOrden, crearOrden, actualizarEstadoOrden,
        buscarUsuarioPorId, buscarProducto, buscarCuponPorCodigo,
        leerCarritoUsuario: leerCarrito, guardarCarritoUsuario: guardarCarrito
    }));

    app.post("/api/chat", async (request, response) => {
        const message = request.body?.message;
        const history = request.body?.history ?? [];
        if (typeof message !== "string" || !message.trim() || message.length > 400 ||
            !Array.isArray(history) || history.length > 10 || history.some(item =>
                !item || !["user", "assistant"].includes(item.role) ||
                typeof item.content !== "string" || item.content.length > (item.role === "user" ? 400 : 1200)
            )) {
            return response.status(400).json({ error: "Escribí un mensaje de hasta 400 caracteres." });
        }

        const segundosRestantes = limitarSolicitudesChat(request.ip || request.socket.remoteAddress || "unknown");
        if (segundosRestantes > 0) {
            response.set("Retry-After", String(segundosRestantes));
            return response.status(429).json({ error: "Alcanzó el límite de 15 mensajes por hora. Intente más tarde." });
        }

        const clave = process.env.GROQ_API;
        if (!clave) return response.status(503).json({ error: "El asistente no está disponible por el momento." });

        try {
            const conocimiento = await readFile(chatKnowledgeUrl, "utf8");
            const instrucciones = [
                "Sos el asistente oficial de Horus Uruguay, una tienda de ropa.",
                "Respondé en el idioma del último mensaje del cliente. Usá un tono formal y breve.",
                "Respondé solo con información respaldada por el conocimiento proporcionado. No inventes datos.",
                "No informes ni confirmes stock, disponibilidad, colores o talles. Si preguntan por stock, indicá que visiten el catálogo y usen sus filtros; marcá needsCatalog como true y needsHuman como false.",
                "Si la respuesta no está en el conocimiento, reconocelo, marcá needsHuman como true y needsCatalog como false.",
                "Devolvé únicamente un objeto JSON con las propiedades answer (texto), needsHuman (booleano) y needsCatalog (booleano).",
                'Ejemplo de formato: {"answer":"Puedo ayudarle con información de Horus.","needsHuman":false,"needsCatalog":false}',
                `Conocimiento de la tienda:\n${conocimiento}`
            ].join("\n\n");
            const mensajes = [
                { role: "system", content: instrucciones },
                ...history.map(({ role, content }) => ({ role, content })),
                { role: "user", content: message.trim() }
            ];
            const resultado = await consultarGroq({
                clave,
                modelo: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
                mensajes
            });
            return response.set("Cache-Control", "no-store").json(resultado);
        } catch {
            return response.status(503).json({ error: "No se pudo obtener una respuesta del asistente." });
        }
    });

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

    app.post("/api/products", autenticar, soloAdmin, receiveProductUpload, async (request, response) => {
        let datos;
        let images;
        let campos;
        try {
            datos = productRequestData(request);
            if (!datos || typeof datos !== "object" || Array.isArray(datos) ||
                Object.hasOwn(datos, "imgFileId") || Object.hasOwn(datos, "imgHoverFileId")) {
                throw new DatosProductoInvalidos();
            }
            images = productImages(request);
            if (!images.length && (!datos.imgSrc || !datos.imgSrcHover)) {
                throw new DatosProductoInvalidos();
            }
            campos = await normalizarCamposProducto(
                datos, false, buscarCategoriasPorNombre, buscarCategoriasPorId
            );
            if (images.length) {
                campos.imgSrc ||= "/api/products/images/pending";
                campos.imgSrcHover ||= "/api/products/images/pending";
            }
            const producto = new Product({
                ...campos,
                _id: campos._id ?? new mongoose.Types.ObjectId().toString(),
                ...(images.some(image => image.field === "image") ? { imgFileId: new mongoose.Types.ObjectId() } : {}),
                ...(images.some(image => image.field === "hoverImage") ? { imgHoverFileId: new mongoose.Types.ObjectId() } : {})
            });
            await producto.validate();
        } catch (error) {
            if (!(error instanceof DatosProductoInvalidos) &&
                !(error instanceof mongoose.Error.ValidationError) &&
                !(error instanceof mongoose.Error.StrictModeError) &&
                !(error instanceof mongoose.Error.CastError)) {
                return response.status(503).json({ error: "No se pudieron validar las categorías del producto." });
            }
            return response.status(400).json({ error: "El producto o sus imágenes no son válidos." });
        }

        let uploaded;
        try {
            uploaded = await guardarImagenes(images);
        } catch (error) {
            console.error("No se pudieron guardar imágenes del producto:", error.name, error.code || "sin código", error.message);
            return response.status(503).json({ error: "No se pudieron guardar las imágenes. Revisá el log del servidor para ver el motivo." });
        }
        for (const { field, id } of uploaded) {
            if (field === "image") {
                campos.imgFileId = id;
                campos.imgSrc = `/api/products/images/${id}`;
            } else {
                campos.imgHoverFileId = id;
                campos.imgSrcHover = `/api/products/images/${id}`;
            }
        }
        const producto = new Product({
            ...campos,
            _id: campos._id ?? new mongoose.Types.ObjectId().toString()
        });
        let creado;
        try {
            creado = await crearProducto(producto);
        } catch (error) {
            await eliminarImagenes(uploaded.map(image => image.id));
            if (error.code === 11000) {
                return response.status(409).json({ error: "Ya existe un producto con ese ID." });
            }
            if (error instanceof mongoose.Error.ValidationError ||
                error instanceof mongoose.Error.StrictModeError) {
                return response.status(400).json({ error: "El producto no cumple el esquema." });
            }
            return response.status(503).json({ error: "No se pudo guardar el producto." });
        }
        const categorias = await listarCategorias();
        const nombresPorId = new Map(categorias.map(categoria => [String(categoria._id), categoria.name]));
        return response.status(201).json(serializarProducto(creado, nombresPorId));
    });

    app.patch("/api/products/:id", autenticar, soloAdmin, receiveProductUpload, async (request, response) => {
        let existente;
        let cambios;
        let images;
        try {
            const datos = productRequestData(request);
            if (!datos || typeof datos !== "object" || Array.isArray(datos) ||
                Object.keys(datos).length === 0 ||
                Object.hasOwn(datos, "imgFileId") || Object.hasOwn(datos, "imgHoverFileId")) {
                throw new DatosProductoInvalidos();
            }
            images = productImages(request);
            existente = await buscarProducto(request.params.id);
            if (!existente) return response.status(404).json({ error: "Producto no encontrado." });

            cambios = await normalizarCamposProducto(
                datos, true, buscarCategoriasPorNombre, buscarCategoriasPorId
            );
            const original = typeof existente.toObject === "function" ? existente.toObject() : existente;
            const camposOriginales = { ...original };
            delete camposOriginales.categories;
            camposOriginales.categoryIds = (original.categoryIds || []).map(idDeCategoria);
            const provisional = Object.fromEntries(images.map(({ field }) => [
                field === "image" ? "imgFileId" : "imgHoverFileId",
                new mongoose.Types.ObjectId()
            ]));
            await new Product({
                ...camposOriginales,
                _id: String(existente._id),
                ...cambios,
                ...provisional
            }).validate();
        } catch (error) {
            if (error instanceof mongoose.Error.ValidationError ||
                error instanceof mongoose.Error.StrictModeError ||
                error instanceof mongoose.Error.CastError ||
                error instanceof DatosProductoInvalidos) {
                return response.status(400).json({ error: "El producto o sus imágenes no son válidos." });
            }
            return response.status(503).json({ error: "No se pudo actualizar el producto." });
        }

        let uploaded;
        try {
            uploaded = await guardarImagenes(images);
        } catch (error) {
            console.error("No se pudieron guardar imágenes del producto:", error.name, error.code || "sin código", error.message);
            return response.status(503).json({ error: "No se pudieron guardar las imágenes. Revisá el log del servidor para ver el motivo." });
        }
        const oldImageIds = [];
        for (const { field, id } of uploaded) {
            if (field === "image") {
                if (existente.imgFileId) oldImageIds.push(existente.imgFileId);
                cambios.imgFileId = id;
                cambios.imgSrc = `/api/products/images/${id}`;
            } else {
                if (existente.imgHoverFileId) oldImageIds.push(existente.imgHoverFileId);
                cambios.imgHoverFileId = id;
                cambios.imgSrcHover = `/api/products/images/${id}`;
            }
        }
        let actualizado;
        try {
            actualizado = await actualizarProducto(request.params.id, cambios);
        } catch (error) {
            await eliminarImagenes(uploaded.map(image => image.id));
            if (error instanceof mongoose.Error.ValidationError ||
                error instanceof mongoose.Error.StrictModeError) {
                return response.status(400).json({ error: "El producto no cumple el esquema." });
            }
            return response.status(503).json({ error: "No se pudo actualizar el producto." });
        }
        if (!actualizado) {
            await eliminarImagenes(uploaded.map(image => image.id));
            return response.status(404).json({ error: "Producto no encontrado." });
        }
        await eliminarImagenes(oldImageIds);
        const productoActualizado = await buscarProducto(request.params.id);
        const categorias = await listarCategorias();
        const nombresPorId = new Map(categorias.map(categoria => [String(categoria._id), categoria.name]));
        return response.status(200).json(serializarProducto(productoActualizado, nombresPorId));
    });

    app.delete("/api/products/:id", autenticar, soloAdmin, async (request, response) => {
        try {
            const eliminado = await eliminarProducto(request.params.id);
            if (!eliminado) return response.status(404).json({ error: "Producto no encontrado." });
            await eliminarImagenes([eliminado.imgFileId, eliminado.imgHoverFileId]);
            return response.status(200).json({ id: String(eliminado._id) });
        } catch {
            return response.status(503).json({ error: "No se pudo eliminar el producto." });
        }
    });

    app.get("/api/products", async (request, response) => {
        if (request.query.page !== undefined) {
            const page = Number(request.query.page);
            const limit = Number(request.query.limit ?? 12);
            if (!Number.isInteger(page) || page < 1 ||
                !Number.isInteger(limit) || limit !== 12) {
                return response.status(400).json({ error: "La página debe ser positiva y el tamaño de página debe ser 12." });
            }

            const categoryNames = request.query.category;
            const colorNames = request.query.color;
            const sizesSelected = request.query.size;
            const list = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
            const categoriesSelected = list(categoryNames);
            const colorsSelected = list(colorNames);
            const sizes = list(sizesSelected);
            if ([...categoriesSelected, ...colorsSelected, ...sizes].some(value =>
                typeof value !== "string" || value.length > 80)) {
                return response.status(400).json({ error: "Uno o más filtros no son válidos." });
            }

            try {
                const range = (await rangoPreciosProductos())[0] || { min: 0, max: 0 };
                const minPrice = request.query.minPrice === undefined ? range.min : Number(request.query.minPrice);
                const maxPrice = request.query.maxPrice === undefined ? range.max : Number(request.query.maxPrice);
                if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || minPrice > maxPrice) {
                    return response.status(400).json({ error: "El rango de precios no es válido." });
                }

                const filter = { price: { $gte: minPrice, $lte: maxPrice } };
                if (categoriesSelected.length) {
                    const selected = new Set(categoriesSelected.map(value => value.toLocaleLowerCase()));
                    const categories = await listarCategorias();
                    const categoryIds = categories
                        .filter(category => selected.has(category.name.toLocaleLowerCase()))
                        .map(category => category._id);
                    filter.categoryIds = { $in: categoryIds };
                }
                if (colorsSelected.length) {
                    filter.colors = { $in: colorsSelected.map(value => new RegExp(`^${escapeRegex(value)}$`, "i")) };
                }
                if (sizes.length) filter.size = { $in: sizes };

                const order = request.query.sort || "newest";
                const sort = order === "price-asc"
                    ? { price: 1, _id: 1 }
                    : order === "price-desc"
                        ? { price: -1, _id: 1 }
                        : order === "newest" ? { is_new: -1, _id: 1 } : null;
                if (!sort) return response.status(400).json({ error: "El orden seleccionado no es válido." });

                const skip = (page - 1) * limit;
                const [productos, total, categorias] = await Promise.all([
                    listarProductosPaginados(filter, sort, skip, limit),
                    contarProductos(filter),
                    listarCategorias()
                ]);
                const nombresPorId = new Map(categorias.map(category => [String(category._id), category.name]));
                const items = Object.fromEntries(productos.map(producto => [
                    String(producto._id), serializarProducto(producto, nombresPorId)
                ]));
                return response.set("Cache-Control", "no-store").json({
                    items,
                    page,
                    limit,
                    total,
                    hasMore: skip + productos.length < total,
                    minPrice: range.min,
                    maxPrice: range.max
                });
            } catch {
                return response.status(503).json({ error: "No se pudieron cargar los productos." });
            }
        }

        const productos = await listarProductos();
        const categorias = await listarCategorias();
        const nombresPorId = new Map(categorias.map(categoria => [String(categoria._id), categoria.name]));
        const items = Object.fromEntries(productos.map(producto => [
            String(producto._id), serializarProducto(producto, nombresPorId)
        ]));
        response.set("Cache-Control", "no-store").json({ items });
    });

    app.get("/api/products/images/:id", async (request, response) => {
        if (!mongoose.isValidObjectId(request.params.id)) {
            return response.status(404).json({ error: "Imagen no encontrada." });
        }
        try {
            const image = await obtenerImagen(new mongoose.Types.ObjectId(request.params.id));
            if (!image) return response.status(404).json({ error: "Imagen no encontrada." });
            response.set({
                "Content-Type": image.contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Content-Type-Options": "nosniff"
            });
            image.stream.on("error", error => {
                console.error("No se pudo transmitir una imagen de producto:", error);
                if (response.headersSent) response.destroy(error);
                else {
                    response.removeHeader("Content-Type");
                    response.removeHeader("Cache-Control");
                    response.status(503).json({ error: "No se pudo cargar la imagen." });
                }
            });
            image.stream.pipe(response);
        } catch {
            return response.status(503).json({ error: "No se pudo cargar la imagen." });
        }
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

    app.get("/", (request, response) => response.redirect("/react/"));
    app.use("/react", express.static(fileURLToPath(new URL("../dist/", import.meta.url)), { dotfiles: "deny" }));
    app.use("/frontend", express.static(frontendDirectory, { dotfiles: "deny" }));

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