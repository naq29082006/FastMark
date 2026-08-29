const mongoose = require("mongoose");
const { WALLET_TX_TYPE, WALLET_TX_STATUS } = require("../constants");

/**
 * WalletTransaction — lịch sử ví user (nạp / thanh toán / cọc / hoàn / rút).
 * Liên kết nghiệp vụ qua referenceId + referenceType.
 */
const WalletTransactionSchema = new mongoose.Schema({
  // Chủ giao dịch (ref User).
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  // Loại GD: 1 nạp, 2 thanh toán, 3 hoàn, 4 rút, 5 đặt cọc, 6 hoàn cọc, 7 giải phóng cọc.
  type: {
    type: Number,
    enum: Object.values(WALLET_TX_TYPE),
    required: true,
    index: true,
  },
  // Số tiền giao dịch (VND, tối thiểu 1).
  amount: { type: Number, required: true, min: 1 },
  // Trạng thái: 0 chờ, 1 thành công, 2 thất bại, 3 hủy.
  status: {
    type: Number,
    enum: Object.values(WALLET_TX_STATUS),
    default: WALLET_TX_STATUS.PENDING,
    index: true,
  },
  // Mã đơn nội bộ (unique, dùng đối soát / PayOS).
  orderCode: { type: Number, required: true, unique: true, index: true },
  // ID link thanh toán cổng (PayOS…), nếu có.
  paymentLinkId: { type: String, default: "" },
  // URL checkout cổng thanh toán, nếu có.
  checkoutUrl: { type: String, default: "" },
  // Mô tả giao dịch.
  description: { type: String, default: "" },
  // Số dư ví trước giao dịch (VND).
  balanceBefore: { type: Number, default: null },
  // Số dư ví sau giao dịch (VND; null nếu chưa áp dụng).
  balanceAfter: { type: Number, default: null },
  // Đơn giữ hàng liên quan (cọc / hoàn / giải phóng) — denormalize để query nhanh.
  reservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Reservation",
    default: null,
    index: true,
  },
  // ID đối tượng tham chiếu (Reservation / Report / …).
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true,
  },
  // Loại tham chiếu: Reservation | Report | WithdrawRequest | Topup | …
  referenceType: { type: String, default: "", index: true },
  // Thời điểm tạo giao dịch.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

WalletTransactionSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("WalletTransaction", WalletTransactionSchema);
