import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

const userSchema = new mongoose.Schema({
    nombre: { type: String, required: true, trim: true, maxlength: 80 },
    apellido: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 254 },
    hashed_password: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user", required: true },
    uuid: { type: String, required: true, unique: true, default: randomUUID },
    direccion: { type: String, default: "", maxlength: 240 }
}, {
    collection: "users",
    versionKey: false,
    strict: "throw",
    bufferCommands: false
});

export const User = mongoose.model("User", userSchema);
