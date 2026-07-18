const mongoose = require("mongoose");

const ShopProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  externalRestaurantId: { type: String, default: "", index: true, sparse: true },

  description: String,
  avatar: { type: String, default: "" },
  address: String,
  DiaChiHeThong: String,

  latitude: Number,
  longitude: Number,

  shopUsername: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
  shopName: String,
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopCategory" },

  phone: String,

  openTime: String,
  closeTime: String,

  isOpen: { type: Number, default: 1 },
  status: { type: Number, default: 1 },
  visibilityRestrictedUntil: { type: Date, default: null },
  suspendedUntil: { type: Date, default: null },
  permanentlyClosedAt: { type: Date, default: null },

  averageRating: { type: Number, default: 0 },
  followersCount: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  totalProducts: { type: Number, default: 0 },
  soldCount: { type: Number, default: 0 },

  /** Cho phép buyer giữ hàng */
  allowReserve: { type: Boolean, default: true },
  /** % đặt cọc (0 = không cọc). Ví dụ 10, 30, 50 */
  depositPercent: { type: Number, default: 0, min: 0, max: 100 },

  /** Gói người bán: 1 | 3 | 6 (tháng), null = chưa mua */
  subscriptionPlan: { type: Number, default: null },
  subscriptionExpiresAt: { type: Date, default: null, index: true },
  /** Ghim giờ mở/đóng cửa trên trang shop công khai */
  pinHours: { type: Boolean, default: false },

  DangHoatDong: { type: Boolean, default: false },
  LanHoatDongCuoi: { type: Date, default: null },

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ShopProfile", ShopProfileSchema);
