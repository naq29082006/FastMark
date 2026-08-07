const mongoose = require("mongoose");

/**
 * Follow — user theo dõi gian hàng.
 * followerId (User) → shopId (ShopProfile)
 */
const FollowSchema = new mongoose.Schema({
  // Người đi theo dõi (ref User).
  followerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  // Gian hàng được theo dõi (ref ShopProfile).
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ShopProfile",
    required: true,
    index: true,
  },
  // Thời điểm bắt đầu follow.
  CreatedAt: { type: Date, default: Date.now },
});

FollowSchema.index({ followerId: 1, shopId: 1 }, { unique: true });
FollowSchema.index({ shopId: 1, CreatedAt: -1 });
FollowSchema.index({ followerId: 1, CreatedAt: -1 });

module.exports = mongoose.model("Follow", FollowSchema);
