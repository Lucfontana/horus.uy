import mongoose from "mongoose";

export const ORDER_STATUSES = ["Orden recibida", "Procesando", "Enviado", "Finalizado", "Descartado"];

const itemSchema = new mongoose.Schema({
    productId: { type: String, required: true },
    name: { type: String, required: true },
    imgSrc: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    color: { type: String, required: true },
    size: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, max: 15 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [itemSchema], required: true, validate: items => items.length > 0 },
    address: { type: String, required: true, trim: true, minlength: 15, maxlength: 240 },
    phone: { type: String, required: true, match: /^(?:598\d{8}|09\d{7})$/ },
    subtotal: { type: Number, required: true, min: 0 },
    couponCode: { type: String, default: "" },
    discountPercent: { type: Number, default: 0, min: 0, max: 99, validate: Number.isInteger },
    discountAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ORDER_STATUSES, default: "Orden recibida", required: true },
    createdAt: { type: Date, default: Date.now }
}, {
    collection: "order_placed",
    versionKey: false,
    strict: "throw",
    bufferCommands: false
});

export const Order = mongoose.model("Order", orderSchema);
