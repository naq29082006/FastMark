const mongoose = require("mongoose");

const SellerVerificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  cccdFrontImage: String,
  cccdBackImage: String,
  selfieImage: String,

  address: String,
  DiaChiHeThong: String,

  latitude: Number,
  longitude: Number,

  note: String,
  LyDoTuChoi: String,

  status: { type: Number, default: 0 },

  submittedAt: Date,
  approvedAt: Date,
  rejectedAt: Date,

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SellerVerification", SellerVerificationSchema);
