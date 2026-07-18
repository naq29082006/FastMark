const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  FirebaseUID: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  UserName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
  },

  FullName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50,
  },

  Email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
  },

  Phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    minlength: 10,
    maxlength: 10,
  },

  AuthProvider: {
    type: String,
    enum: ["email", "google"],
    required: true,
  },

  Avatar: { type: String, default: "" },

  Role: { type: Number, default: 1 },
  Status: { type: Number, default: 1 },

  // Số gian hàng / người bán user đang theo dõi (ShopFollow).
  FollowingCount: { type: Number, default: 0 },
  // Số người đang theo dõi user này (qua gian hàng của họ).
  FollowersCount: { type: Number, default: 0 },

  DangHoatDong: { type: Boolean, default: false },
  LanHoatDongCuoi: { type: Date, default: null },

  VerifyAccount: { type: Boolean, default: false },

  EmailVerifyCode: { type: String, default: null },
  EmailVerifyCodeExpiresAt: { type: Date, default: null },
  EmailVerifyResendAt: { type: Date, default: null },

  SellerPhoneVerified: { type: Boolean, default: false },
  SellerPhoneVerifyCode: { type: String, default: null },
  SellerPhoneVerifyCodeExpiresAt: { type: Date, default: null },
  SellerPhoneVerifyResendAt: { type: Date, default: null },
  SellerPhoneVerifyFailCount: { type: Number, default: 0 },

  CreatedAt: { type: Date, default: Date.now },
  UpdatedAt: { type: Date, default: Date.now },
});

userSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

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
    sellerPhoneVerified: Boolean(this.SellerPhoneVerified),
    followingCount: Number(this.FollowingCount) || 0,
    followersCount: Number(this.FollowersCount) || 0,
    createdAt: this.CreatedAt,
    updatedAt: this.UpdatedAt,
  };
};

module.exports = mongoose.model("User", userSchema);
