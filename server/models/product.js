import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    is_new: { type: Boolean, required: true },
    name: { type: String, required: true },
    categories: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0, validate: Number.isFinite },
    imgSrc: { type: String, required: true },
    imgSrcHover: { type: String, required: true },
    alt: { type: String, required: true },
    colors: { type: [String], default: [] },
    size: { type: [String], default: [] }
}, {
    versionKey: false,
    strict: "throw",
    bufferCommands: false
});

export const Product = mongoose.model("Product", productSchema);