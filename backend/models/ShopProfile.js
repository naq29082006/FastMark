const mongoose = require("mongoose");

/**
 * ShopProfile — hồ sơ gian hàng gắn với User đã được duyệt seller.
 * Tên hiển thị / username shop lưu riêng (shopName / shopUsername), tách khỏi tài khoản cá nhân.
 * Muốn dùng tính năng bán hàng công khai: cần SellerSubscription Active (isActive = 1).
 */
const ShopProfileSchema = new mongoose.Schema({
  // Chủ gian hàng (ref User, Role seller).
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

  // Tên hiển thị gian hàng (khác họ tên tài khoản).
  shopName: { type: String, default: "", trim: true },
  // Handle công khai @username của gian hàng.
  shopUsername: { type: String, default: "", trim: true, lowercase: true, index: true },
  // Ảnh đại diện gian hàng (tách khỏi avatar tài khoản cá nhân).
  avatar: { type: String, default: "" },

  // Mô tả gian hàng.
  description: { type: String, default: "" },

  // Địa chỉ chuẩn hóa từ hệ thống / geocode.
  addressHeThong: { type: String, default: "" },

  // Tọa độ GPS gian hàng.
  latlong: {
    lat: { type: Number, default: null },
    long: { type: Number, default: null },
  },

  // Danh mục loại gian hàng (ref ShopCategory).
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopCategory" },

  // Giờ mở cửa (chuỗi "HH:mm"), tùy chọn — luôn hiển thị công khai khi có giá trị.
  openTime: { type: String, default: "" },
  // Giờ đóng cửa (chuỗi "HH:mm"), tùy chọn.
  closeTime: { type: String, default: "" },
  // Trạng thái mở cửa hiển thị: 1 = đang mở, 0 = đóng cửa.
  isOpen: { type: Number, default: 1 },

  // Trạng thái gian hàng: 1 = hoạt động, 0 = bị khóa (admin).
  status: { type: Number, default: 1 },

  // Thời điểm bắt đầu lượt khóa gian hàng hiện tại.
  lockedAt: { type: Date, default: null },

  // Cache từ SellerSubscription Active — 1 = có gói còn hạn, 0 = không.
  isActive: { type: Number, default: 0, index: true },

  // Số người theo dõi gian hàng (Follow.shopId).
  soNguoiTheo: { type: Number, default: 0, min: 0 },

  diemTB: { type: Number, default: 0 },
  tongDG: { type: Number, default: 0 },
  tongSP: { type: Number, default: 0 },
  // Tổng số lượng đã bán.
  soldCount: { type: Number, default: 0 },

  // % đặt cọc khi giữ hàng (0–100; 0 = không cọc). Ví dụ 10, 30, 50.
  cocTien: { type: Number, default: 0, min: 0, max: 100 },

  // Thời điểm tạo hồ sơ gian hàng.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

ShopProfileSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

ShopProfileSchema.index({ status: 1, isActive: 1, "latlong.lat": 1, "latlong.long": 1 });
ShopProfileSchema.index({ status: 1, isActive: 1, categoryId: 1 });

module.exports = mongoose.model("ShopProfile", ShopProfileSchema);
