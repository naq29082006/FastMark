const mongoose = require("mongoose");

const ReservationSchema = new mongoose.Schema({
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopProfile" },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  quantity: Number,
  reservedPrice: Number,
  agreedPrice: Number,

  pickupTime: Date,
  note: String,

  status: { type: Number, default: 0 },

  confirmedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancelReason: String,
  buyerPriceAcceptedAt: Date,
  cancelLockedAt: Date,
  inventoryHeld: { type: Boolean, default: false },

  depositRequired: { type: Boolean, default: false },
  depositPercent: { type: Number, default: 0 },
  depositAmount: { type: Number, default: 0 },
  depositPaidAt: { type: Date, default: null },
  depositTxnId: { type: mongoose.Schema.Types.ObjectId, ref: "WalletTransaction", default: null },
  voucherCode: { type: String, default: "" },
  discountAmount: { type: Number, default: 0 },

  // Mã nhận hàng — buyer hiện QR, shop quét để hoàn thành.
  pickupCode: { type: String, default: "", index: true },

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Reservation", ReservationSchema);
