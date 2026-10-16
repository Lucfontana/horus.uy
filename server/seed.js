import mongoose from "mongoose";
import { conectarDB } from "./db.js";
import { importarProductos, leerProductosIniciales } from "./fixtures.js";

try {
    const productos = await leerProductosIniciales();
    await conectarDB();
    const resultado = await importarProductos(productos);
    console.log(`Productos insertados: ${resultado.upsertedCount}. Productos existentes conservados: ${resultado.matchedCount}.`);
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}