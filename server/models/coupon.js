import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, trim: true, uppercase: true, unique: true, maxlength: 80 },
    discountPercent: { type: Number, required: true, min: 1, max: 99, validate: Number.isInteger }
}, {
    collection: "coupons",
    versionKey: false,
    strict: "throw",
    bufferCommands: false
});

export const Coupon = mongoose.model("Coupon", couponSchema);
