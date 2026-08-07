const mongoose = require("mongoose");
const {
  SELLER_BANNER_STATUS,
  BANNER_TARGET_TYPE,
} = require("../constants");

/**
 * SellerBannerPlan — lần mua gói banner + creative hiển thị trang Home.
 * Luồng: PURCHASED → PENDING_REVIEW → ACTIVE | REJECTED.
 * startDate/endDate chỉ gắn khi admin duyệt treo banner.
 */
const SellerBannerPlanSchema = new mongoose.Schema({
  // Seller mua gói (ref User).
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  // Gian hàng treo banner (ref ShopProfile).
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ShopProfile",
    required: true,
    index: true,
  },
  // Gói banner đã mua (ref BannerPlan).
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BannerPlan",
    required: true,
    index: true,
  },
  // Snapshot tên gói lúc mua.
  planName: { type: String, default: "" },
  // Snapshot số ngày hiệu lực (dùng khi admin duyệt).
  durationDays: { type: Number, default: 7, min: 1 },
  // Số tiền đã trừ ví (VND).
  amount: { type: Number, required: true, min: 0 },
  // Ngày mua gói (trừ ví).
  ngayMua: { type: Date, default: Date.now, index: true },
  // Ngày bắt đầu hiển thị — null cho đến khi admin duyệt.
  startDate: { type: Date, default: null },
  // Ngày hết hạn hiển thị banner.
  endDate: { type: Date, default: null, index: true },
  // Trạng thái: PURCHASED | PENDING_REVIEW | ACTIVE | REJECTED | EXPIRED.
  status: {
    type: Number,
    enum: Object.values(SELLER_BANNER_STATUS),
    default: SELLER_BANNER_STATUS.PURCHASED,
    index: true,
  },
  // Thời điểm admin duyệt treo banner.
  approvedAt: { type: Date, default: null },
  // Lý do admin từ chối / gỡ banner vi phạm.
  violationReason: { type: String, default: "", trim: true },

  // URL ảnh banner.
  image: { type: String, default: "" },
  // Loại đích click: shop | product.
  targetType: {
    type: Number,
    enum: Object.values(BANNER_TARGET_TYPE),
    default: BANNER_TARGET_TYPE.SHOP,
  },
  // ID shop hoặc product khi click banner.
  targetId: { type: String, default: "" },
  // Số lần user click banner (thống kê).
  clickCount: { type: Number, default: 0, min: 0 },

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

SellerBannerPlanSchema.index({ shopId: 1, status: 1, endDate: -1 });
SellerBannerPlanSchema.index({ status: 1, endDate: -1, CreatedAt: -1 });
SellerBannerPlanSchema.index({ shopId: 1, ngayMua: -1 });

SellerBannerPlanSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("SellerBannerPlan", SellerBannerPlanSchema);
