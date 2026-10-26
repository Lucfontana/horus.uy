import { readFile } from "node:fs/promises";
import { Category } from "./models/category.js";
import { Product } from "./models/product.js";

export async function leerProductosIniciales() {
    const data = JSON.parse(await readFile(new URL("../backend/db/db.json", import.meta.url), "utf8"));
    return Promise.all(Object.entries(data.items).map(async ([id, producto]) => {
        const { categories, ...camposProducto } = producto;
        const documento = new Product({ ...camposProducto, _id: id, categoryIds: [] });
        await documento.validate();
        return { _id: id, ...camposProducto, categories };
    }));
}

export async function importarProductos(productos, modelo = Product, modeloCategoria = Category) {
    const nombresCategorias = [...new Set(productos.flatMap(producto => producto.categories || []))];
    if (nombresCategorias.some(nombre => typeof nombre !== "string" || !nombre.trim())) {
        throw new Error("Las categorías iniciales deben tener nombres válidos.");
    }

    if (nombresCategorias.length) {
        await modeloCategoria.bulkWrite(nombresCategorias.map(name => ({
            updateOne: {
                filter: { name },
                update: { $setOnInsert: { name } },
                upsert: true
            }
        })));
    }
    const categorias = nombresCategorias.length
        ? await modeloCategoria.find({ name: { $in: nombresCategorias } }).lean().exec()
        : [];
    const idPorNombre = new Map(categorias.map(categoria => [categoria.name, categoria._id]));
    if (idPorNombre.size !== nombresCategorias.length) {
        throw new Error("No se pudieron resolver las categorías iniciales.");
    }

    return modelo.bulkWrite(productos.map(({ _id, categories = [], ...producto }) => ({
        updateOne: {
            filter: { _id },
            update: {
                $setOnInsert: {
                    ...producto,
                    categoryIds: categories.map(name => idPorNombre.get(name))
                }
            },
            upsert: true
        }
    })));
}

export async function migrarCategoriasLegadas() {
    const productos = await Product.collection.find({ categories: { $exists: true } }).toArray();
    const nombresCategorias = [...new Set(productos.flatMap(producto => producto.categories || []))];
    if (nombresCategorias.some(nombre => typeof nombre !== "string" || !nombre.trim())) {
        throw new Error("Hay productos con categorías antiguas inválidas.");
    }

    const categoriasPorNombre = new Map();
    for (const name of nombresCategorias) {
        const categoria = await Category.findOneAndUpdate(
            { name },
            { $setOnInsert: { name } },
            { upsert: true, new: true }
        ).lean().exec();
        categoriasPorNombre.set(name, categoria._id);
    }

    for (const producto of productos) {
        await Product.collection.updateOne(
            { _id: producto._id },
            {
                $set: {
                    categoryIds: (producto.categories || []).map(name => categoriasPorNombre.get(name))
                },
                $unset: { categories: "" }
            }
        );
    }
    return productos.length;
}