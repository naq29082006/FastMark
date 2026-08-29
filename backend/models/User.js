const mongoose = require("mongoose");

/**
 * User — tài khoản chung (buyer + seller cùng 1 user).
 * Tên hiển thị / username dùng chung; gian hàng lấy từ User, không tách profile riêng.
 *
 * OTP email/SĐT: không lưu trên User — chỉ giữ phiên tạm trong bộ nhớ server
 * (otpSessionStore). SĐT đã xác minh = đã có Phone 10 số (chỉ ghi khi OTP đúng).
 */
const userSchema = new mongoose.Schema({
  // UID từ Firebase Auth (đăng nhập email/Google).
  FirebaseUID: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  // Tên đăng nhập công khai (cũng dùng làm handle gian hàng khi là seller).
  UserName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
  },

  // Họ tên hiển thị (cũng dùng làm tên gian hàng khi là seller).
  FullName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50,
  },

  // Email (sparse: Google có thể chưa có lúc tạo tạm).
  Email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
  },

  // SĐT 10 số — chỉ ghi vào DB sau khi xác minh OTP thành công.
  Phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    minlength: 10,
    maxlength: 10,
  },

  // Phương thức đăng ký ban đầu: "email" | "google".
  AuthProvider: {
    type: String,
    enum: ["email", "google"],
    required: true,
  },

  // URL ảnh đại diện.
  Avatar: { type: String, default: "" },

  // Vai trò: 1 = buyer, 2 = seller (đã duyệt), 3 = admin.
  Role: { type: Number, default: 1 },

  // Trạng thái tài khoản: 0 = khóa, 1 = hoạt động.
  Status: { type: Number, default: 1 },

  // Thời điểm bắt đầu lượt khóa hiện tại (khiếu nại khóa gắn theo lượt này).
  lockedAt: { type: Date, default: null },

  // Số gian hàng mà tài khoản này đang theo dõi (Follow.followerId → shopId).
  SoTheoDoi: { type: Number, default: 0 },

  // Lần hoạt động gần nhất — admin theo dõi, cập nhật khi user online/offline hoặc tương tác.
  HoatDongCuoi: { type: Date, default: null },

  // true sau khi xác nhận mã OTP email (đăng ký email). Google có thể set sẵn true.
  VerifyAccount: { type: Boolean, default: false },

  // Thời điểm tạo tài khoản.
  CreatedAt: { type: Date, default: Date.now },
  // Thời điểm cập nhật gần nhất (auto trong pre-save).
  UpdatedAt: { type: Date, default: Date.now },
});

userSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

function isPhoneVerified(user) {
  return /^\d{10}$/.test(String(user?.Phone || "").trim());
}

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id,
    firebaseUid: this.FirebaseUID,
    userName: this.UserName || "",
    fullName: this.FullName,
    email: this.Email || "",
    phone: this.Phone || "",
    authProvider: this.AuthProvider,
    avatar: this.Avatar || "",
    role: this.Role,
    status: this.Status,
    verifyAccount: this.VerifyAccount,
    // Tương thích client: đã xác minh SĐT khi có Phone hợp lệ.
    sellerPhoneVerified: isPhoneVerified(this),
    followingCount: Number(this.SoTheoDoi ?? this.SoTheoDoi) || 0,
    createdAt: this.CreatedAt,
    updatedAt: this.UpdatedAt,
  };
};

userSchema.statics.isPhoneVerified = isPhoneVerified;

module.exports = mongoose.model("User", userSchema);
