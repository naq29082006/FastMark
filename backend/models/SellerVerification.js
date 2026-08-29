const mongoose = require("mongoose");

/**
 * SellerVerification — hồ sơ đăng ký bán hàng (KYC).
 * status: 0 chờ duyệt, 1 đã duyệt, 2 từ chối.
 * Thời điểm trạng thái cuối = UpdatedAt (duyệt / từ chối đều cập nhật UpdatedAt).
 */
const SellerVerificationSchema = new mongoose.Schema({
  // User gửi đăng ký (ref User).
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  // URL ảnh CCCD mặt trước / sau.
  anhCccdTruoc: { type: String, default: "" },
  anhCccdSau: { type: String, default: "" },
  // URL ảnh selfie cầm CCCD / xác minh khuôn mặt.
  selfieImage: { type: String, default: "" },

  // Họ tên in trên CCCD/CMND (KYC).
  fullName: { type: String, default: "", trim: true },
  // Số CCCD/CMND (chỉ chữ số, 9 hoặc 12).
  cccdNumber: { type: String, default: "", trim: true, index: true },

  // URL ảnh giấy phép kinh doanh hoặc giấy chứng nhận ATTP.
  anhKD: { type: String, default: "" },

  // Danh mục kinh doanh đề xuất (ref ShopCategory).
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "ShopCategory" },

  // Tên hiển thị gian hàng (lưu tại thời điểm đăng ký).
  shopName: { type: String, default: "", trim: true },
  // Username gian hàng (@handle).
  shopUsername: { type: String, default: "", trim: true, lowercase: true, index: true },

  // Địa chỉ hệ thống / geocode.
  addressHeThong: { type: String, default: "" },

  // Tọa độ GPS gian hàng lúc đăng ký.
  latlong: {
    lat: { type: Number, default: null },
    long: { type: Number, default: null },
  },

  // Trạng thái KYC: 0 = chờ duyệt, 1 = duyệt, 2 = từ chối.
  status: { type: Number, default: 0, index: true },

  // Lý do bị từ chối khi đăng ký seller (chỉ khi status = 2).
  LyDoTuChoi: { type: String, default: "" },

  // Admin duyệt / từ chối (ref User role admin).
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

  // Thời điểm gửi đăng ký.
  CreatedAt: { type: Date, default: Date.now },
  // Cập nhật khi gửi lại / admin xử lý — dùng làm mốc thời gian trạng thái cuối.
  UpdatedAt: { type: Date, default: Date.now },
});

SellerVerificationSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("SellerVerification", SellerVerificationSchema);
