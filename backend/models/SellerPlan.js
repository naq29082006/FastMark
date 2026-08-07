const mongoose = require("mongoose");

/**
 * SellerPlan — gói bán hàng do admin cấu hình (thời hạn + giá).
 * Seller mua bằng ví → gian hàng hiện công khai đến hết hạn.
 * isActive: 1 = đang bán, 0 = xóa mềm.
 */
const SellerPlanSchema = new mongoose.Schema({
  // Tên gói (VD: Gói 1 tháng).
  name: { type: String, required: true, trim: true },
  // Mô tả quyền lợi hiển thị cho seller.
  description: { type: String, default: "", trim: true },
  // Số ngày hiệu lực sau khi mua.
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

SellerPlanSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("SellerPlan", SellerPlanSchema);
