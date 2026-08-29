const mongoose = require("mongoose");
const { embeddedImagesField } = require("../utils/embeddedImages");

/**
 * Review — đánh giá sản phẩm sau khi đơn giữ hàng hoàn thành.
 * Xóa mềm / ẩn theo mẫu Product: isDeleted + removedBy + lyDoGo + removedAt.
 */
const ReviewSchema = new mongoose.Schema({
  // Người viết đánh giá (ref User).
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  // Gian hàng của sản phẩm (ref ShopProfile).
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ShopProfile",
    required: true,
    index: true,
  },

  // Sản phẩm đã mua được đánh giá (ref Product).
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
    index: true,
  },

  // Đơn giữ hàng đã hoàn thành gắn với đánh giá (ref Reservation).
  reservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Reservation",
    required: true,
    index: true,
  },

  // Số sao 1–5.
  rating: { type: Number, required: true, min: 1, max: 5 },
  // Nội dung chữ.
  comment: { type: String, default: "" },

  // Ảnh đính kèm (URL, tối đa 5).
  images: embeddedImagesField,

  /** Trạng thái xóa mềm: 1 = còn hiệu lực, 0 = đã gỡ. */
  isDeleted: { type: Number, default: 1, index: true },
  /** Ai gỡ / ẩn: buyer | admin — rỗng khi còn hiển thị công khai. */
  removedBy: { type: String, default: "", trim: true, index: true },
  /** Lý do gỡ (bắt buộc khi removedBy = admin). */
  lyDoGo: { type: String, default: "", trim: true },
  /** Thời điểm gỡ hoặc admin ẩn. */
  removedAt: { type: Date, default: null },

  // Thời điểm tạo đánh giá.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

ReviewSchema.index({ shopId: 1, CreatedAt: -1 });
ReviewSchema.index({ productId: 1, CreatedAt: -1 });
ReviewSchema.index({ userId: 1, CreatedAt: -1 });
ReviewSchema.index(
  { reservationId: 1 },
  {
    unique: true,
    // Chỉ một đánh giá “còn hiệu lực” / đơn — Mongo không hỗ trợ $exists trong partial index.
    partialFilterExpression: { isDeleted: 1 },
    name: "reservationId_1_active",
  }
);

ReviewSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("Review", ReviewSchema);
