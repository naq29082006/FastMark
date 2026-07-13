const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  ShopId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopProfile", required: true, index: true },
  CategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductCategory", required: true, index: true },

  ProductName: { type: String, required: true, trim: true },
  Description: { type: String, default: "" },
  DonVi: { type: String, default: "", trim: true },

  Thumbnail: { type: String, default: "" },
  ViewCount: { type: Number, default: 0 },
  LikeCount: { type: Number, default: 0 },
  SoldCount: { type: Number, default: 0 },
  Status: { type: Number, default: 1, index: true },

  MinPrice: { type: Number, default: 0 },
  MaxPrice: { type: Number, default: 0 },

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

ProductSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("Product", ProductSchema);
