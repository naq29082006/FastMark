const mongoose = require("mongoose");

/**
 * Reservation — đơn giữ hàng giữa người mua (userId) và gian hàng (shopId).
 *
 * Trạng thái (status):
 *   0 Pending — chờ shop xác nhận
 *   1 WaitingPickup — shop đã đồng ý, chờ buyer đến lấy / quét QR
 *   2 PickupConfirmed — đã nhận hàng; cửa sổ khiếu nại đến hanGiaiCoc
 *   3 Disputed — tranh chấp (kết quả qua cocChuyenDen)
 *   4 Completed — hoàn tất, cọc đã giải ngân seller (nếu có)
 *   5 Cancelled — đã hủy (không phải kết quả tranh chấp)
 *
 * Cọc: depositAmount + depositPercent; thời điểm trừ ví → WalletTransaction (DEPOSIT_HOLD).
 * Chi tiết tranh chấp (ảnh, phản hồi shop, admin) → collection ReservationDispute.
 */
const ReservationSchema = new mongoose.Schema({
  // Người mua — ref User.
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  // Gian hàng — ref ShopProfile (chủ shop lấy qua shop.userId khi cần).
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopProfile", index: true },
  // Sản phẩm được giữ.
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  // Biến thể đã chọn; null nếu sản phẩm không có biến thể.
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", default: null },

  // Số lượng giữ.
  quantity: Number,
  // Giá đơn vị lúc đặt (VND); shop điều chỉnh tại quầy cập nhật field này.
  reservedPrice: Number,
  // Số tiền cọc đã trừ ví buyer (VND); 0 nếu danh mục không yêu cầu cọc.
  depositAmount: { type: Number, default: 0 },
  // % cọc snapshot lúc đặt (0–100), không đổi theo cấu hình danh mục sau này.
  depositPercent: { type: Number, default: 0 },

  // Mã 6 số buyer đưa shop quét QR (fallback: 6 số cuối orderCode).
  pickupCode: { type: String, default: "", trim: true, index: true },
  // Giờ hẹn buyer đến nhận hàng.
  pickupTime: { type: Date, index: true },
  // Ghi chú buyer gửi shop khi đặt giữ (không dùng cho ghi chú admin / xử lý tranh chấp).
  note: { type: String, default: "" },

  /** Trạng thái đơn — xem bảng 0–5 ở đầu file. */
  status: { type: Number, default: 0, index: true },
  // Buyer đã đánh giá đơn này chưa.
  hasReview: { type: Boolean, default: false, index: true },

  // Thời điểm shop đồng ý giữ hàng.
  tgShopXN: { type: Date, default: null },
  // Thời điểm xác nhận đã nhận hàng (quét QR).
  tgNhanHang: { type: Date, default: null },
  // Thời điểm đơn bị hủy hoặc kết thúc dạng hủy.
  cancelledAt: { type: Date, default: null },
  /**
   * Ghi chú hủy đơn do seller hoặc admin nhập.
   * Không dùng để lưu mã trạng thái hệ thống.
   *
   * Ví dụ:
   * - "Hàng bị hỏng."
   * - "Sản phẩm hết hàng."
   * - "Vi phạm chính sách."
   */
  cancelNote: { type: String, default: "" },
  /**
   * Loại hủy đơn để hệ thống xác định ngữ cảnh.
   * Giá trị: mã RESERVATION_CANCEL_REASON (buyer_cancel_pending, admin_buyer_win, …).
   * Xem backend/constants/reservationOrderFlow.js.
   */
  cancelType: { type: String, default: "" },
  // URL ảnh minh chứng khi shop hủy đơn đã xác nhận.
  anhHuyShop: { type: [String], default: [] },

  tgGiaiCoc: { type: Date, default: null },
  cocChuyenDen: { type: Number, default: 0, enum: [0, 1, 2], index: true },
  soNgayKN: { type: Number, default: null, min: 1, max: 30 },
  hanGiaiCoc: { type: Date, default: null, index: true },
  // true nếu đã trừ tồn kho variant khi tạo đơn — hoàn kho khi hủy.
  inventoryHeld: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Job escrow / auto xử lý cọc theo hạn.
ReservationSchema.index({ status: 1, hanGiaiCoc: 1 });
// Job nhắc lấy hàng / quá giờ pickup khi WaitingPickup.
ReservationSchema.index({ status: 1, pickupTime: 1 });

ReservationSchema.pre("save", function saveHook() {
  this.updatedAt = new Date();
});

module.exports = mongoose.model("Reservation", ReservationSchema);
