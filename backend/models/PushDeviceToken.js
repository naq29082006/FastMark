const mongoose = require("mongoose");

/**
 * PushDeviceToken — token FCM / push native gắn với user (1 token = 1 thiết bị).
 */
const PushDeviceTokenSchema = new mongoose.Schema({
  // Chủ thiết bị (ref User).
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  // Token push từ Firebase / APNs (unique toàn hệ thống).
  token: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  // Nền tảng thiết bị: android | ios | web | unknown.
  platform: {
    type: String,
    enum: ["android", "ios", "web", "unknown"],
    default: "unknown",
  },
  // Thời điểm đăng ký token lần đầu.
  CreatedAt: { type: Date, default: Date.now },
  // Lần cập nhật token / làm mới gần nhất.
  UpdatedAt: { type: Date, default: Date.now },
});

PushDeviceTokenSchema.pre("save", function saveHook() {
  this.UpdatedAt = new Date();
});

module.exports = mongoose.model("PushDeviceToken", PushDeviceTokenSchema);
