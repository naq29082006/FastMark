const mongoose = require("mongoose");

/**
 * BannerPlan — gói banner do admin cấu hình (thời hạn theo tháng + giá).
 * Seller mua khi có SellerSubscription Active; hiển thị Home theo thứ tự ngẫu nhiên.
 * isActive: 1 = đang bán, 0 = xóa mềm.
 */
const BannerPlanSchema = new mongoose.Schema({
  // Tên gói banner (VD: Banner 1 tháng).
  name: { type: String, required: true, trim: true },
  // chi tiết gói (quyền lợi / mô tả hiển thị khi seller chọn mua).
  description: { type: String, default: "", trim: true },
  // Số ngày hiển thị sau khi mua (admin nhập theo tháng → lưu = tháng × 30).
  durationDays: { type: Number, required: true, min: 1 },
  // Giá gói (VND), trừ từ ví seller khi mua.
  price: { type: Number, required: true, min: 0 },
  // 1 = đang bán, 0 = xóa mềm.
  isActive: { type: Number, default: 1, index: true },
  // Thời điểm tạo gói.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

BannerPlanSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("BannerPlan", BannerPlanSchema);
