import mongoose from "mongoose";
import { createApp } from "./app.js";
import { conectarDB } from "./db.js";
import { migrarCategoriasLegadas, leerProductosIniciales } from "./fixtures.js";
import { Category } from "./models/category.js";
import { Product } from "./models/product.js";

async function iniciarServidor() {
    const port = Number(process.env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("PORT debe ser un entero entre 1 y 65535.");
    }

    let app;
    if (process.argv.includes("--fixtures")) {
        const iniciales = await leerProductosIniciales();
        const nombresCategorias = [...new Set(iniciales.flatMap(producto => producto.categories))];
        const categorias = nombresCategorias.map(name => new Category({ name }).toObject());
        const idPorNombre = new Map(categorias.map(categoria => [categoria.name, categoria._id]));
        const usuarios = [];
        const sesiones = [];
        const carritos = new Map();
        const cupones = [];
        const ordenes = [];
        const productos = iniciales.map(({ categories: nombres, ...producto }) =>
            new Product({
                ...producto,
                categoryIds: nombres.map(name => idPorNombre.get(name))
            }).toObject()
        );
        app = createApp({
            leerCarrito: async userId => {
                const key = String(userId);
                if (!carritos.has(key)) carritos.set(key, { entries: [], mergeIds: [], version: 0 });
                return structuredClone(carritos.get(key));
            },
            guardarCarrito: async (userId, version, changes) => {
                const key = String(userId);
                const cart = carritos.get(key);
                if (!cart || cart.version !== version) return null;
                const saved = { ...cart, ...structuredClone(changes), version: version + 1 };
                carritos.set(key, saved);
                return structuredClone(saved);
            },
            listarCupones: async () => cupones,
            buscarCuponPorCodigo: async code => cupones.find(coupon => coupon.code === code),
            crearCupon: async coupon => {
                const created = { ...coupon, _id: new mongoose.Types.ObjectId() };
                cupones.push(created);
                return created;
            },
            eliminarCupon: async id => {
                const index = cupones.findIndex(coupon => String(coupon._id) === id);
                return index === -1 ? null : cupones.splice(index, 1)[0];
            },
            listarOrdenes: async filter => ordenes.filter(order =>
                !filter.userId || String(order.userId) === String(filter.userId)),
            buscarOrden: async id => ordenes.find(order => String(order._id) === id),
            crearOrden: async order => {
                const created = { ...structuredClone(order), _id: new mongoose.Types.ObjectId(), createdAt: new Date() };
                ordenes.push(created);
                return created;
            },
            actualizarEstadoOrden: async (id, status) => {
                const order = ordenes.find(item => String(item._id) === id);
                if (!order) return null;
                order.status = status;
                return order;
            },
            listarProductos: async () => productos,
            buscarProducto: async id => productos.find(producto => producto._id === id),
            crearProducto: async producto => {
                const documento = producto.toObject();
                productos.push(documento);
                return documento;
            },
            actualizarProducto: async (id, cambios) => {
                const producto = productos.find(item => item._id === id);
                if (!producto) return null;
                Object.assign(producto, cambios);
                return producto;
            },
            eliminarProducto: async id => {
                const indice = productos.findIndex(producto => producto._id === id);
                return indice === -1 ? null : productos.splice(indice, 1)[0];
            },
            listarCategorias: async () => categorias,
            buscarCategoria: async id => categorias.find(categoria => String(categoria._id) === id),
            buscarCategoriaPorNombre: async name => categorias.find(categoria => categoria.name === name),
            buscarCategoriasPorNombre: async names =>
                categorias.filter(categoria => names.includes(categoria.name)),
            buscarCategoriasPorId: async ids =>
                categorias.filter(categoria => ids.includes(String(categoria._id))),
            crearCategoria: async categoria => {
                const documento = categoria.toObject();
                categorias.push(documento);
                return documento;
            },
            actualizarCategoria: async (id, cambios) => {
                const categoria = categorias.find(item => String(item._id) === id);
                if (!categoria) return null;
                Object.assign(categoria, cambios);
                return categoria;
            },
            eliminarCategoria: async id => {
                const indice = categorias.findIndex(categoria => String(categoria._id) === id);
                return indice === -1 ? null : categorias.splice(indice, 1)[0];
            },
            categoriaEnUso: async id =>
                productos.some(producto => producto.categoryIds.some(categoriaId => String(categoriaId) === id)),
            buscarUsuarioPorEmail: async email => usuarios.find(usuario => usuario.email === email),
            buscarUsuarioPorId: async id => usuarios.find(usuario => String(usuario._id) === String(id)),
            crearUsuario: async usuario => {
                const documento = usuario.toObject();
                usuarios.push(documento);
                return documento;
            },
            actualizarContrasena: async (id, hashedPassword) => {
                const usuario = usuarios.find(item => String(item._id) === String(id));
                if (!usuario) return null;
                usuario.hashed_password = hashedPassword;
                return usuario;
            },
            crearSesion: async sesion => {
                sesiones.push(sesion);
                return sesion;
            },
            buscarSesion: async tokenHash => sesiones.find(sesion => sesion.tokenHash === tokenHash),
            eliminarSesion: async tokenHash => {
                const indice = sesiones.findIndex(sesion => sesion.tokenHash === tokenHash);
                if (indice !== -1) sesiones.splice(indice, 1);
            },
            eliminarOtrasSesiones: async (userId, tokenHash) => {
                for (let indice = sesiones.length - 1; indice >= 0; indice -= 1) {
                    if (String(sesiones[indice].userId) === String(userId) && sesiones[indice].tokenHash !== tokenHash) {
                        sesiones.splice(indice, 1);
                    }
                }
            }
        });
        console.log("Modo demo: productos del JSON, sin conexión ni escritura en MongoDB.");
    } else {
        await conectarDB();
        await migrarCategoriasLegadas();
        app = createApp();
    }

    const server = app.listen(port, () => {
        console.log(`Horus disponible en http://localhost:${port}/frontend/catalogo.html`);
    });
    server.on("error", async () => {
        console.error("No se pudo iniciar HTTP. Revisá si PORT está ocupado.");
        await mongoose.disconnect();
        process.exitCode = 1;
    });

    function detenerServidor() {
        server.close(async () => {
            await mongoose.disconnect();
            process.exit(0);
        });
    }
    process.once("SIGINT", detenerServidor);
    process.once("SIGTERM", detenerServidor);
}

iniciarServidor().catch(async error => {
    console.error(error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
});