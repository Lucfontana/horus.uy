import mongoose from "mongoose";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

function bucket() {
    if (!mongoose.connection.db) throw new Error("MongoDB no está conectado.");
    return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "productImages" });
}

export async function guardarImagen(buffer, filename, contentType) {
    const upload = bucket().openUploadStream(filename, { metadata: { contentType } });
    await pipeline(Readable.from([buffer]), upload);
    return upload.id;
}

export async function obtenerImagen(id) {
    const gridfs = bucket();
    const [file] = await gridfs.find({ _id: id }).limit(1).toArray();
    if (!file) return null;
    return {
        contentType: file.metadata?.contentType || "application/octet-stream",
        stream: gridfs.openDownloadStream(id)
    };
}

export function eliminarImagen(id) {
    return bucket().delete(id);
}
