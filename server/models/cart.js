import mongoose from "mongoose";

const entrySchema = new mongoose.Schema({
    productId: { type: String, required: true },
    color: { type: String, required: true },
    size: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, max: 15 }
}, { _id: false });

const cartSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    entries: { type: [entrySchema], default: [] },
    mergeIds: { type: [String], default: [] },
    version: { type: Number, default: 0 }
}, { versionKey: false, bufferCommands: false });

export const Cart = mongoose.model("Cart", cartSchema);

export async function leerCarritoUsuario(userId) {
    try {
        return await Cart.findOneAndUpdate(
            { _id: userId },
            { $setOnInsert: { entries: [], mergeIds: [], version: 0 } },
            { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        ).lean().exec();
    } catch (error) {
        if (error.code !== 11000) throw error;
        return Cart.findById(userId).lean().exec();
    }
}

export function guardarCarritoUsuario(userId, version, changes) {
    return Cart.findOneAndUpdate(
        { _id: userId, version },
        { $set: changes, $inc: { version: 1 } },
        { returnDocument: "after", runValidators: true }
    ).lean().exec();
}
