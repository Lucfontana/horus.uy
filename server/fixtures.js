import { readFile } from "node:fs/promises";
import { Product } from "./models/product.js";

export async function leerProductosIniciales() {
    const data = JSON.parse(await readFile(new URL("../backend/db/db.json", import.meta.url), "utf8"));
    return Promise.all(Object.entries(data.items).map(async ([id, producto]) => {
        const documento = new Product({ ...producto, _id: id });
        await documento.validate();
        return documento.toObject();
    }));
}

export async function importarProductos(productos, modelo = Product) {
    return modelo.bulkWrite(productos.map(({ _id, ...producto }) => ({
        updateOne: {
            filter: { _id },
            update: { $setOnInsert: producto },
            upsert: true
        }
    })));
}