const mongoose = require("mongoose");

const ProductCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  categoryName: { type: String, trim: true },
  description: String,
  icon: String,
  IsDeleted: { type: Number, default: 1 },
  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

ProductCategorySchema.pre("save", function syncLegacyName() {
  if (this.name) {
    this.categoryName = this.name;
  } else if (this.categoryName) {
    this.name = this.categoryName;
  }
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("ProductCategory", ProductCategorySchema, "categories");
