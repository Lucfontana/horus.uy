import mongoose from "mongoose";

export const PRODUCT_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

const productSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    is_new: { type: Boolean, required: true },
    name: { type: String, required: true },
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    price: { type: Number, required: true, min: 0, validate: Number.isFinite },
    imgSrc: { type: String, required: true },
    imgSrcHover: { type: String, required: true },
    alt: { type: String, required: true },
    colors: { type: [String], default: [] },
    size: {
        type: [{ type: String, enum: PRODUCT_SIZES }],
        default: []
    }
}, {
    versionKey: false,
    strict: "throw",
    bufferCommands: false
});

export const Product = mongoose.model("Product", productSchema);