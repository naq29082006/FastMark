const mongoose = require("mongoose");
const { embeddedImagesField } = require("../utils/embeddedImages");

/**
 * Report — báo cáo nội dung (review / shop / product / system / khiếu nại khóa).
 *
 * Tranh chấp giữ hàng (buyer/seller khiếu nại) dùng ReservationDispute — không tạo Report.
 * Không lưu GPS — tranh chấp giữ hàng dùng ReservationDispute (lý do + mô tả + ảnh).
 */
const ReportSchema = new mongoose.Schema({
  // Người gửi báo cáo (ref User).
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  // Sản phẩm bị báo cáo (reportType = 3).
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true },
  // Gian hàng bị báo cáo (reportType = 2 hoặc khiếu nại khóa shop).
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopProfile", index: true },
  // Đánh giá bị báo cáo (reportType = 1).
  reviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Review", default: null, index: true },

  /**
   * Loại báo cáo (mã tuần tự):
   * 1 đánh giá | 2 gian hàng | 3 sản phẩm | 4 hệ thống | 5 khác
   * 6 khiếu nại khóa tài khoản | 7 khiếu nại khóa gian hàng
   */
  reportType: { type: Number, required: true, index: true },

  // Tiêu đề / nội dung / ảnh minh chứng (báo cáo nội dung).
  title: String,
  content: String,
  images: embeddedImagesField,

  // Trạng thái: 0 = chờ xử lý, 1 = đã duyệt/xử lý, 2 = bác bỏ.
  status: { type: Number, default: 0, index: true },

  // Mốc lượt khóa khi tạo khiếu nại (đối chiếu user.lockedAt / shop.lockedAt).
  lockSessionAt: { type: Date, default: null },

  // Admin xử lý (ref User).
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  // Thời điểm admin xử lý.
  processedAt: Date,
  // Ghi chú / quyết định admin (approve-buyer | approve-seller | reject).
  adminDecision: { type: String, default: "" },
  // Ghi chú xử lý của admin.
  adminNote: { type: String, default: "" },

  // Thời điểm tạo báo cáo.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất.
  UpdatedAt: { type: Date, default: Date.now },
});

ReportSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("Report", ReportSchema);
