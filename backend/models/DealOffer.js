const mongoose = require("mongoose");

const DealOfferSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopProfile" },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation" },

  originalPrice: Number,
  offeredPrice: Number,
  sellerCounterPrice: Number,
  discountPercent: Number,

  quantity: { type: Number, default: 1, min: 1 },
  status: { type: Number, default: 0 },
  note: String,
  sellerNote: String,

  respondedAt: Date,

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("DealOffer", DealOfferSchema);
