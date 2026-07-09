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

  AnhBia: { type: String, default: "" },
  Avatar: { type: String, default: "" },
  Bio: { type: String, default: "" },

  Role: { type: Number, default: 1 },
  Status: { type: Number, default: 1 },

  FollowersCount: { type: Number, default: 0 },
  FollowingCount: { type: Number, default: 0 },

  DangHoatDong: { type: Boolean, default: false },
  LanHoatDongCuoi: { type: Date, default: null },

  VerifyAccount: { type: Boolean, default: false },

  EmailVerifyCode: { type: String, default: null },
  EmailVerifyCodeExpiresAt: { type: Date, default: null },

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
    createdAt: this.CreatedAt,
    updatedAt: this.UpdatedAt,
  };
};

module.exports = mongoose.model("User", userSchema);
