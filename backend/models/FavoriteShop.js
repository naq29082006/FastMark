const mongoose = require("mongoose");

const FavoriteShopSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopProfile", required: true, index: true },

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

FavoriteShopSchema.index({ userId: 1, shopId: 1 }, { unique: true });

module.exports = mongoose.model("FavoriteShop", FavoriteShopSchema);
