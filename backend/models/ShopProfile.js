const mongoose = require("mongoose");

const ShopProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  externalRestaurantId: { type: String, default: "", index: true, sparse: true },

  description: String,
  address: String,
  DiaChiHeThong: String,

  latitude: Number,
  longitude: Number,

  shopUsername: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
  shopName: String,
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },

  phone: String,

  openTime: String,
  closeTime: String,

  isOpen: { type: Number, default: 1 },
  status: { type: Number, default: 1 },

  averageRating: { type: Number, default: 0 },
  totalLikes: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  totalProducts: { type: Number, default: 0 },
  soldCount: { type: Number, default: 0 },

  DangHoatDong: { type: Boolean, default: false },
  LanHoatDongCuoi: { type: Date, default: null },

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ShopProfile", ShopProfileSchema);
