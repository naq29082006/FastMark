const mongoose = require("mongoose");

const ReservationSchema = new mongoose.Schema({
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopProfile" },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  dealOfferId: { type: mongoose.Schema.Types.ObjectId, ref: "DealOffer" },

  quantity: Number,
  reservedPrice: Number,
  agreedPrice: Number,

  pickupTime: Date,
  note: String,

  status: { type: Number, default: 0 },

  confirmedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  buyerPriceAcceptedAt: Date,
  cancelLockedAt: Date,

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Reservation", ReservationSchema);
