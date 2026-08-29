const mongoose = require("mongoose");
const { SELLER_SUBSCRIPTION_STATUS } = require("../constants");

/**
 * SellerSubscription — lần mua gói bán hàng của seller.
 */
const SellerSubscriptionSchema = new mongoose.Schema({
  // Seller mua gói (ref User).
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  // Gian hàng áp dụng gói (ref ShopProfile).
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ShopProfile",
    required: true,
    index: true,
  },
  // Gói đã mua (ref SellerPlan).
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SellerPlan",
    required: true,
    index: true,
  },
  // Snapshot tên gói lúc mua.
  planName: { type: String, default: "" },
  // Số tiền đã trừ ví (VND).
  amount: { type: Number, required: true, min: 0 },
  // Ngày mua gói (có thể khác startDate khi stack gia hạn).
  ngayMua: { type: Date, default: Date.now },
  // Ngày bắt đầu hiệu lực.
  startDate: { type: Date, required: true },
  // Ngày hết hạn gói.
  endDate: { type: Date, required: true, index: true },
  // Trạng thái: PENDING_PAYMENT | ACTIVE | EXPIRED | CANCELLED.
  status: {
    type: Number,
    enum: Object.values(SELLER_SUBSCRIPTION_STATUS),
    default: SELLER_SUBSCRIPTION_STATUS.PENDING_PAYMENT,
    index: true,
  },
  // Giao dịch ví đã trừ khi mua gói (ref WalletTransaction).
  gdViId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "WalletTransaction",
    default: null,
    index: true,
  },
  // Thời điểm tạo lần mua.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

SellerSubscriptionSchema.index({ shopId: 1, status: 1, endDate: -1 });
SellerSubscriptionSchema.index({ sellerId: 1, CreatedAt: -1 });

SellerSubscriptionSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("SellerSubscription", SellerSubscriptionSchema);
