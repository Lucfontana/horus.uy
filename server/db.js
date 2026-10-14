import mongoose from "mongoose";

export async function conectarDB(uri = process.env.MONGODB_URI) {
    if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
        throw new Error("Configurá MONGODB_URI con una URI válida en .env.");
    }
    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
    } catch {
        throw new Error("No se pudo conectar a MongoDB. Revisá la URI, las credenciales y el acceso de red. Para probar sin MongoDB, usá npm run demo.");
    }
}