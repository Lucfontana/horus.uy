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
        const productos = iniciales.map(({ categories: nombres, ...producto }) =>
            new Product({
                ...producto,
                categoryIds: nombres.map(name => idPorNombre.get(name))
            }).toObject()
        );
        app = createApp({
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
                productos.some(producto => producto.categoryIds.some(categoriaId => String(categoriaId) === id))
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