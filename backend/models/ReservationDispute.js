const mongoose = require("mongoose");
const { embeddedImagesField } = require("../utils/embeddedImages");

/**
 * ReservationDispute — tranh chấp / khiếu nại gắn một đơn giữ hàng (1 bản ghi / reservation).
 *
 * Buyer và seller mỗi bên có bộ field riêng (reasonType, content, images max 5).
 * Không lưu GPS — admin xử lý dựa trên lý do, mô tả và ảnh chứng cứ.
 * Admin xử lý → auditLogs[].
 */
const DisputeAuditLogSchema = new mongoose.Schema(
  {
    // Admin thực hiện hành động (ref User role admin).
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Mã hành động (vd: resolve, note).
    action: { type: String, required: true },
    // Quyết định admin (vd: accept_buyer, accept_seller, reject).
    decision: { type: String, default: "" },
    // Ghi chú admin khi xử lý.
    note: { type: String, default: "", trim: true },
    // Thời điểm ghi log.
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ReservationDisputeSchema = new mongoose.Schema({
  // Đơn giữ hàng tranh chấp (ref Reservation) — unique.
  reservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Reservation",
    required: true,
    unique: true,
    index: true,
  },

  // —— Khiếu nại buyer (ref User) ——
  buyerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  // Mã lý do (enum DISPUTE_REASON_TYPE / RESERVATION_DISPUTE_REASON).
  maLyDoBuyer: { type: Number, default: null },
  // Nội dung mô tả chi tiết.
  buyerContent: { type: String, default: "", trim: true },
  // Ảnh chứng cứ (URL, tối đa 5).
  buyerImages: embeddedImagesField,
  // Thời điểm buyer gửi khiếu nại.
  tgKnBuyer: { type: Date, default: null },

  // —— Khiếu nại seller (pickup) hoặc phản hồi post-delivery (không set maLyDoShop) ——
  sellerShopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ShopProfile",
    default: null,
    index: true,
  },
  // Mã lý do seller khiếu nại pickup (post-delivery phản hồi không dùng field này).
  maLyDoShop: { type: Number, default: null },
  sellerContent: { type: String, default: "", trim: true },
  sellerImages: embeddedImagesField,
  // Thời điểm seller khiếu nại pickup hoặc phản hồi post-delivery.
  tgKnShop: { type: Date, default: null },

  /**
   * Loại tranh chấp: pickup (quá giờ nhận) | post_delivery (sau khi đã giao).
   * post_delivery: buyer khiếu nại (tgKnBuyer) → seller phản hồi (sellerContent/tgKnShop) → admin xử lý.
   */
  disputeKind: {
    type: String,
    enum: ["pickup", "post_delivery"],
    default: "pickup",
    index: true,
  },

  // Trạng thái tranh chấp (enum DISPUTE_STATUS: chờ / buyer thắng / seller thắng / đóng).
  status: { type: Number, default: 0, index: true },
  // Ghi chú admin khi kết thúc tranh chấp.
  adminNote: { type: String, default: "", trim: true },
  // Admin xử lý cuối (ref User).
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  // Thời điểm admin kết thúc tranh chấp.
  resolvedAt: { type: Date, default: null },

  // Lịch sử hành động admin trên tranh chấp này.
  auditLogs: { type: [DisputeAuditLogSchema], default: [] },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ReservationDisputeSchema.pre("save", function saveHook() {
  this.updatedAt = new Date();
});

ReservationDisputeSchema.index({ status: 1, createdAt: -1 });
ReservationDisputeSchema.index({ reservationId: 1, status: 1 });

module.exports = mongoose.model("ReservationDispute", ReservationDisputeSchema);
