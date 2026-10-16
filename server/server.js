import mongoose from "mongoose";
import { createApp } from "./app.js";
import { conectarDB } from "./db.js";
import { leerProductosIniciales } from "./fixtures.js";

async function iniciarServidor() {
    const port = Number(process.env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("PORT debe ser un entero entre 1 y 65535.");
    }

    let app;
    if (process.argv.includes("--fixtures")) {
        const productos = await leerProductosIniciales();
        app = createApp({
            listarProductos: async () => productos,
            buscarProducto: async id => productos.find(producto => producto._id === id)
        });
        console.log("Modo demo: productos del JSON, sin conexión ni escritura en MongoDB.");
    } else {
        await conectarDB();
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