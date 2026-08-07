const mongoose = require("mongoose");



/**

 * Reservation — đơn giữ hàng giữa buyer và seller.

 *

 * Luồng trạng thái: Pending → Confirmed → WaitingPickup → Completed (+ escrow) / Disputed / Cancelled.

 * Cọc escrow: SystemWallet giữ → release seller hoặc refund buyer (xem WalletTransaction theo reservationId).

 *

 * Tranh chấp giữ hàng: nội dung + ảnh trong ReservationDispute (không lưu GPS).

 */

const ReservationSchema = new mongoose.Schema({

  // Người mua (ref User). Data cũ lưu userId; data mới có thể dùng buyerId.
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

  // Chủ shop / seller (ref User) — denormalize từ ShopProfile.userId.

  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

  // Gian hàng bán (ref ShopProfile).

  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopProfile", index: true },

  // Sản phẩm giữ (ref Product).

  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },

  // Biến thể đã chọn (ref ProductVariant); null nếu sản phẩm không có biến thể.

  variantId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", default: null },



  // Số lượng giữ.

  quantity: Number,

  // Giá đơn vị lúc đặt (VND).

  reservedPrice: Number,

  // Số tiền cọc đã trừ ví buyer (VND).

  depositAmount: { type: Number, default: 0 },



  // Mã 6 số buyer đưa shop quét QR khi nhận hàng.

  pickupCode: { type: String, default: "", trim: true, index: true },

  // Giờ hẹn buyer đến nhận hàng.

  pickupTime: { type: Date, index: true },

  // Ghi chú buyer gửi khi đặt giữ.

  note: { type: String, default: "" },



  /**

   * Trạng thái đơn:

   * 0 Pending | 1 Confirmed | 2 WaitingPickup | 3 Received (legacy)

   * 4 Disputed | 5 Completed | 6 Cancelled

   */

  status: { type: Number, default: 0, index: true },

  // Có tranh chấp / khiếu nại đang mở.

  hasDispute: { type: Boolean, default: false, index: true },

  // Buyer đã đánh giá đơn này chưa.

  hasReview: { type: Boolean, default: false, index: true },



  // Seller xác nhận đơn lúc nào.

  sellerConfirmedAt: { type: Date, default: null },

  // Shop quét QR / buyer nhận hàng / đơn hoàn thành lúc nào.

  completedAt: { type: Date, default: null },

  // Đơn bị hủy lúc nào.

  cancelledAt: { type: Date, default: null },

  // Mã lý do hủy / kết thúc (RESERVATION_CANCEL_REASON string).

  cancelReason: { type: String, default: "" },

  // Lý do shop nhập khi hủy đơn đã xác nhận giữ hàng.

  cancelNote: { type: String, default: "" },

  // Ai hủy: buyer | seller_reject | seller_after_accept | system | admin

  cancelledBy: { type: String, default: "" },

  // Shop hủy sau khi đã xác nhận giữ hàng (WaitingPickup).

  cancelledBySellerAfterAccept: { type: Boolean, default: false },

  // Ảnh minh chứng khi shop hủy đơn đã xác nhận.

  sellerCancelImages: { type: [String], default: [] },



  /** —— Escrow / ví (nội bộ) —— */

  // % cọc áp dụng lúc đặt (0–100).

  depositPercent: { type: Number, default: 0 },

  // Thời điểm trừ cọc từ ví buyer vào SystemWallet.

  depositPaidAt: { type: Date, default: null },

  // Thời điểm cọc được release/refund.

  depositSettledAt: { type: Date, default: null },

  // Cọc chuyển cho ai: 0 đang giữ (escrow) | 1 hoàn buyer | 2 giải ngân seller.

  depositSettleTo: { type: Number, default: 0, enum: [0, 1, 2], index: true },

  // Số ngày buyer được khiếu nại sau giao (snapshot từ ProductCategory.disputeDays).

  escrowProtectionDays: { type: Number, default: null, min: 1, max: 30 },

  // Hết hạn cửa sổ khiếu nại + auto release cọc cho seller nếu không tranh chấp.

  escrowReleaseAt: { type: Date, default: null, index: true },

  // Tồn kho biến thể đã trừ khi giữ (tránh oversell).

  inventoryHeld: { type: Boolean, default: false },



  createdAt: { type: Date, default: Date.now },

  updatedAt: { type: Date, default: Date.now },

});



ReservationSchema.index({ status: 1, escrowReleaseAt: 1 });

ReservationSchema.index({ status: 2, pickupTime: 1 });

ReservationSchema.virtual("disputed")

  .get(function getDisputed() {

    return this.hasDispute;

  })

  .set(function setDisputed(value) {

    this.hasDispute = Boolean(value);

  });



ReservationSchema.virtual("hasReviewed")

  .get(function getHasReviewed() {

    return this.hasReview;

  })

  .set(function setHasReviewed(value) {

    this.hasReview = Boolean(value);

  });



ReservationSchema.virtual("CreatedAt")

  .get(function getCreatedAt() {

    return this.createdAt;

  })

  .set(function setCreatedAt(value) {

    this.createdAt = value;

  });



ReservationSchema.virtual("UpdatedAt")

  .get(function getUpdatedAt() {

    return this.updatedAt;

  })

  .set(function setUpdatedAt(value) {

    this.updatedAt = value;

  });



ReservationSchema.set("toJSON", { virtuals: true });

ReservationSchema.set("toObject", { virtuals: true });



ReservationSchema.pre("save", function saveHook() {
  if (this.buyerId && !this.userId) {
    this.userId = this.buyerId;
  } else if (this.userId && !this.buyerId) {
    this.buyerId = this.userId;
  }
  this.updatedAt = new Date();
});



module.exports = mongoose.model("Reservation", ReservationSchema);

