const mongoose = require("mongoose");

const FavoriteProductSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

FavoriteProductSchema.index({ userId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model("FavoriteProduct", FavoriteProductSchema);