const mongoose = require("mongoose");

const SellerVerificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  cccdFrontImage: String,
  cccdBackImage: String,
  selfieImage: String,

  shopUsername: { type: String, trim: true, lowercase: true },
  shopName: String,
  shopDescription: String,
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopCategory" },

  address: String,
  DiaChiHeThong: String,
  latitude: Number,
  longitude: Number,

  status: { type: Number, default: 0 },
  LyDoTuChoi: String,

  submittedAt: Date,
  approvedAt: Date,
  rejectedAt: Date,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SellerVerification", SellerVerificationSchema);
