const mongoose = require("mongoose");

const ShopCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: String,
  icon: String,
  IsDeleted: { type: Number, default: 1 },
  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

ShopCategorySchema.pre("save", function touchUpdatedAt() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("ShopCategory", ShopCategorySchema, "shopcategories");
