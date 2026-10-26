import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, unique: true, maxlength: 80 }
}, {
    versionKey: false,
    strict: "throw",
    bufferCommands: false
});

export const Category = mongoose.model("Category", categorySchema);
